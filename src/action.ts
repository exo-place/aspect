import type { CardGraph } from "./graph";
import type { WorldPackStore } from "./pack";
import type { EventLog } from "./event-log";
import type { ActionDef, ActionResult, ActionEvent } from "./action-types";
import type { Edge } from "./types";
import { compile, CompileError } from "@dusklight/marinada";
import type { Expr } from "@dusklight/marinada";

export interface EdgeIndex {
  from: Map<string, Edge[]>;
  to: Map<string, Edge[]>;
}

export function buildEdgeIndex(graph: CardGraph): EdgeIndex {
  const from = new Map<string, Edge[]>();
  const to = new Map<string, Edge[]>();
  for (const edge of graph.allEdges()) {
    let fList = from.get(edge.from);
    if (!fList) { fList = []; from.set(edge.from, fList); }
    fList.push(edge);
    let tList = to.get(edge.to);
    if (!tList) { tList = []; to.set(edge.to, tList); }
    tList.push(edge);
  }
  return { from, to };
}

const compiledRuns = new Map<string, (env: Record<string, unknown>) => unknown>();

function runCacheKey(action: ActionDef): string {
  return action.id + "\0" + JSON.stringify(action.run);
}

function buildRunEnv(
  graph: CardGraph,
  contextId: string,
  targetId: string,
  edgeIndex: EdgeIndex,
  packStore: WorldPackStore,
): Record<string, unknown> {
  const contextCard = graph.getCard(contextId);
  const targetCard = graph.getCard(targetId);

  const edgesFromContextToTarget: Array<{ type?: string; label?: string }> = [];
  const edgesFromTargetToContext: Array<{ type?: string; label?: string }> = [];
  const contextEdgesFrom: Array<{ to: string; toKind?: string; type?: string }> = [];
  const contextEdgesTo: Array<{ from: string; fromKind?: string; type?: string }> = [];
  const targetEdgesFrom: Array<{ to: string; toKind?: string; type?: string }> = [];
  const targetEdgesTo: Array<{ from: string; fromKind?: string; type?: string }> = [];
  const contextNeighborIds = new Set<string>();
  const targetNeighborIds = new Set<string>();

  for (const edge of edgeIndex.from.get(contextId) ?? []) {
    if (edge.to === targetId) edgesFromContextToTarget.push({ ...(edge.type !== undefined ? { type: edge.type } : {}), ...(edge.label !== undefined ? { label: edge.label } : {}) });
    const toCard = graph.getCard(edge.to);
    contextEdgesFrom.push({ to: edge.to, ...(toCard?.kind !== undefined ? { toKind: toCard.kind } : {}), ...(edge.type !== undefined ? { type: edge.type } : {}) });
    contextNeighborIds.add(edge.to);
  }
  for (const edge of edgeIndex.to.get(contextId) ?? []) {
    if (edge.from === targetId) edgesFromTargetToContext.push({ ...(edge.type !== undefined ? { type: edge.type } : {}), ...(edge.label !== undefined ? { label: edge.label } : {}) });
    const fromCard = graph.getCard(edge.from);
    contextEdgesTo.push({ from: edge.from, ...(fromCard?.kind !== undefined ? { fromKind: fromCard.kind } : {}), ...(edge.type !== undefined ? { type: edge.type } : {}) });
    contextNeighborIds.add(edge.from);
  }
  for (const edge of edgeIndex.from.get(targetId) ?? []) {
    const toCard = graph.getCard(edge.to);
    targetEdgesFrom.push({ to: edge.to, ...(toCard?.kind !== undefined ? { toKind: toCard.kind } : {}), ...(edge.type !== undefined ? { type: edge.type } : {}) });
    targetNeighborIds.add(edge.to);
  }
  for (const edge of edgeIndex.to.get(targetId) ?? []) {
    const fromCard = graph.getCard(edge.from);
    targetEdgesTo.push({ from: edge.from, ...(fromCard?.kind !== undefined ? { fromKind: fromCard.kind } : {}), ...(edge.type !== undefined ? { type: edge.type } : {}) });
    targetNeighborIds.add(edge.from);
  }

  const sharedNeighbors: Array<{ id: string; kind?: string }> = [];
  for (const id of contextNeighborIds) {
    if (id !== contextId && id !== targetId && targetNeighborIds.has(id)) {
      const card = graph.getCard(id);
      if (card) sharedNeighbors.push({ id, ...(card.kind !== undefined ? { kind: card.kind } : {}) });
    }
  }

  const env: Record<string, unknown> = {
    // Effect type name strings (self-referential for use as effect tags)
    setKind: "setKind", setText: "setText", setField: "setField",
    removeField: "removeField", removeCard: "removeCard",
    addEdge: "addEdge", removeEdge: "removeEdge",
    createCard: "createCard", emit: "emit",
    // Common field/property name strings
    id: "id", kind: "kind", text: "text", fields: "fields",
    from: "from", to: "to", type: "type", label: "label",
    // Collection helpers
    any: (arr: unknown[], pred: (x: unknown) => unknown) => (arr as unknown[]).some(x => !!pred(x)),
    every: (arr: unknown[], pred: (x: unknown) => unknown) => (arr as unknown[]).every(x => !!pred(x)),
    none: (arr: unknown[], pred: (x: unknown) => unknown) => !(arr as unknown[]).some(x => !!pred(x)),
    filter: (arr: unknown[], pred: (x: unknown) => unknown) => (arr as unknown[]).filter(x => !!pred(x)),
    count: (arr: unknown[]) => (arr as unknown[]).length,
    // Kind label lookup
    kindLabel: (kindId: unknown) => packStore.getKind(String(kindId))?.label ?? String(kindId),
    // Card data
    context: { id: contextId, text: contextCard?.text ?? "", kind: contextCard?.kind ?? null, fields: contextCard?.fields ?? {} },
    target: { id: targetId, text: targetCard?.text ?? "", kind: targetCard?.kind ?? null, fields: targetCard?.fields ?? {} },
    contextKind: contextCard?.kind ?? null,
    targetKind: targetCard?.kind ?? null,
    contextText: contextCard?.text ?? "",
    targetText: targetCard?.text ?? "",
    contextId,
    targetId,
    contextFields: contextCard?.fields ?? {},
    targetFields: targetCard?.fields ?? {},
    // Edge data
    edgesFromContextToTarget,
    edgesFromTargetToContext,
    contextEdgesFrom,
    contextEdgesTo,
    targetEdgesFrom,
    targetEdgesTo,
    sharedNeighbors,
  };

  const pack = packStore.get();
  if (pack) {
    for (const k of pack.kinds) env[k.id] = k.id;
    for (const et of pack.edgeTypes) env[et.id] = et.id;
    for (const name of pack.fieldNames ?? []) env[name] = name;
  }

  return env;
}

function runAction(
  action: ActionDef,
  graph: CardGraph,
  packStore: WorldPackStore,
  contextId: string,
  targetId: string,
  edgeIndex: EdgeIndex,
): unknown[] | null {
  const key = runCacheKey(action);
  try {
    let fn = compiledRuns.get(key);
    if (!fn) {
      fn = compile(action.run as Expr);
      compiledRuns.set(key, fn);
    }
    const env = buildRunEnv(graph, contextId, targetId, edgeIndex, packStore);
    const result = fn(env);
    if (!result || !Array.isArray(result) || result.length === 0) return null;
    return result as unknown[];
  } catch (e) {
    if (e instanceof CompileError) compiledRuns.delete(key);
    return null;
  }
}

export function isActionAvailable(
  action: ActionDef,
  graph: CardGraph,
  packStore: WorldPackStore,
  contextId: string,
  targetId: string,
  edgeIndex?: EdgeIndex,
): boolean {
  if (action.context.kind !== undefined) {
    const contextCard = graph.getCard(contextId);
    if (!contextCard || contextCard.kind !== action.context.kind) return false;
  }
  if (action.target.kind !== undefined) {
    const targetCard = graph.getCard(targetId);
    if (!targetCard || targetCard.kind !== action.target.kind) return false;
  }
  if (action.target.edgeType !== undefined) {
    const direction = action.target.direction ?? "from";
    const fromId = direction === "from" ? contextId : targetId;
    const toId = direction === "from" ? targetId : contextId;
    const idx = edgeIndex ?? buildEdgeIndex(graph);
    const hasEdge = (idx.from.get(fromId) ?? []).some(e => e.to === toId && e.type === action.target.edgeType);
    if (!hasEdge) return false;
  }

  const idx = edgeIndex ?? buildEdgeIndex(graph);
  return runAction(action, graph, packStore, contextId, targetId, idx) !== null;
}

export function findActionTargets(
  action: ActionDef,
  graph: CardGraph,
  packStore: WorldPackStore,
  contextId: string,
  edgeIndex?: EdgeIndex,
): string[] {
  const idx = edgeIndex ?? buildEdgeIndex(graph);
  const targets: string[] = [];
  for (const card of graph.allCards()) {
    if (card.id === contextId) continue;
    if (isActionAvailable(action, graph, packStore, contextId, card.id, idx)) {
      targets.push(card.id);
    }
  }
  return targets;
}

export function executeAction(
  action: ActionDef,
  graph: CardGraph,
  packStore: WorldPackStore,
  contextId: string,
  targetId: string,
  eventLog: EventLog | null,
  actor: string,
): ActionResult {
  const idx = buildEdgeIndex(graph);

  if (action.context.kind !== undefined) {
    const contextCard = graph.getCard(contextId);
    if (!contextCard || contextCard.kind !== action.context.kind) return { success: false, events: [] };
  }
  if (action.target.kind !== undefined) {
    const targetCard = graph.getCard(targetId);
    if (!targetCard || targetCard.kind !== action.target.kind) return { success: false, events: [] };
  }
  if (action.target.edgeType !== undefined) {
    const direction = action.target.direction ?? "from";
    const fromId = direction === "from" ? contextId : targetId;
    const toId = direction === "from" ? targetId : contextId;
    const hasEdge = (idx.from.get(fromId) ?? []).some(e => e.to === toId && e.type === action.target.edgeType);
    if (!hasEdge) return { success: false, events: [] };
  }

  const effects = runAction(action, graph, packStore, contextId, targetId, idx);
  if (!effects) return { success: false, events: [] };

  const emittedEvents: ActionEvent[] = [];

  function resolveRef(ref: unknown): string {
    if (ref === "context") return contextId;
    if (ref === "target") return targetId;
    if (typeof ref === "string") return ref;
    if (typeof ref === "object" && ref !== null) {
      const obj = ref as Record<string, unknown>;
      if (obj.id === contextId) return contextId;
      if (obj.id === targetId) return targetId;
      if (typeof obj.id === "string") return obj.id;
    }
    return String(ref);
  }

  graph.transact(() => {
    for (const eff of effects) {
      if (!Array.isArray(eff) || eff.length === 0) continue;
      const [tag, ...args] = eff as [string, ...unknown[]];
      switch (tag) {
        case "addEdge": {
          const [fromRef, toRef, edgeType, edgeLabel] = args as [unknown, unknown, string?, string?];
          const fromId = resolveRef(fromRef);
          const toId = resolveRef(toRef);
          graph.addEdge(fromId, toId, edgeLabel, edgeType);
          break;
        }
        case "removeEdge": {
          const [fromRef, toRef, edgeType] = args as [unknown, unknown, string?];
          const fromId = resolveRef(fromRef);
          const toId = resolveRef(toRef);
          for (const e of graph.edgesFrom(fromId)) {
            if (e.to === toId && (edgeType === undefined || e.type === edgeType)) {
              graph.removeEdge(e.id);
              break;
            }
          }
          break;
        }
        case "setKind": {
          const [cardRef, kind] = args as [unknown, string | null];
          const cardId = resolveRef(cardRef);
          graph.setKind(cardId, kind);
          // Auto-set text to kind label
          if (kind !== null) {
            const kindDef = packStore.getKind(kind);
            if (kindDef) graph.updateCard(cardId, { text: kindDef.label });
          }
          break;
        }
        case "setText": {
          const [cardRef, text] = args as [unknown, string];
          const cardId = resolveRef(cardRef);
          graph.updateCard(cardId, { text });
          break;
        }
        case "setField": {
          const [cardRef, key, value] = args as [unknown, string, unknown];
          const cardId = resolveRef(cardRef);
          graph.setField(cardId, key, value);
          break;
        }
        case "removeField": {
          const [cardRef, key] = args as [unknown, string];
          const cardId = resolveRef(cardRef);
          graph.deleteField(cardId, key);
          break;
        }
        case "removeCard": {
          const [cardRef] = args as [unknown];
          const cardId = resolveRef(cardRef);
          graph.removeCard(cardId);
          break;
        }
        case "createCard": {
          const text = args[0] as string;
          const kind = args[1] as string | undefined;
          const fields = args[2] as Record<string, unknown> | undefined;
          const nearRef = args[3];
          const nearId = nearRef !== undefined ? resolveRef(nearRef) : contextId;
          const nearCard = graph.getCard(nearId);
          const pos = nearCard ? { x: nearCard.position.x + 160, y: nearCard.position.y } : { x: 0, y: 0 };
          const newCard = graph.addCard(text, pos, kind);
          if (fields) {
            for (const [k, v] of Object.entries(fields)) graph.setField(newCard.id, k, v);
          }
          break;
        }
        case "emit": {
          const [event, data] = args as [string, Record<string, unknown>?];
          emittedEvents.push({
            timestamp: Date.now(),
            actor,
            actionId: action.id,
            event,
            contextCardId: contextId,
            targetCardId: targetId,
            ...(data !== undefined ? { data } : {}),
          });
          break;
        }
      }
    }

    if (eventLog) {
      for (const event of emittedEvents) eventLog.append(event);
    }
  });

  return { success: true, events: emittedEvents };
}
