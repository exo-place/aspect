import type { CardGraph } from "./graph";
import type { WorldPackStore } from "./pack";
import type { EventLog } from "./event-log";
import type { ActionDef, ActionData, ActionResult, ActionEvent, CardRef } from "./action-types";
import type { Edge } from "./types";
import { compile, CompileError } from "@dusklight/marinada";
import type { Expr } from "@dusklight/marinada";

const compiledPredicates = new Map<string, (env: Record<string, unknown>) => unknown>();

// Bare strings in Marinada are variable references, not literals. To write string
// values in predicates, the strings must exist in the env. We populate the env with
// common field names and all pack kind/edge-type IDs as self-referential strings,
// so pack authors can write e.g. ["===", ["get", "context", "kind"], "room"].
function buildPredicateEnv(data: ActionData, packStore: WorldPackStore): Record<string, unknown> {
  const env: Record<string, unknown> = {
    // Common field name strings for use as record keys
    id: "id", kind: "kind", text: "text", fields: "fields",
    from: "from", to: "to", type: "type", label: "label",
    // Collection helpers (native JS functions callable via ["call", "any", arr, pred])
    any: (arr: unknown[], pred: (x: unknown) => unknown) => (arr as unknown[]).some(x => !!pred(x)),
    every: (arr: unknown[], pred: (x: unknown) => unknown) => (arr as unknown[]).every(x => !!pred(x)),
    none: (arr: unknown[], pred: (x: unknown) => unknown) => !(arr as unknown[]).some(x => !!pred(x)),
    filter: (arr: unknown[], pred: (x: unknown) => unknown) => (arr as unknown[]).filter(x => !!pred(x)),
    count: (arr: unknown[]) => (arr as unknown[]).length,
    // ActionData
    context: data.context,
    target: data.target,
    contextKind: data.context.kind,
    targetKind: data.target.kind,
    contextText: data.context.text,
    targetText: data.target.text,
    contextId: data.context.id,
    targetId: data.target.id,
    contextFields: data.context.fields,
    targetFields: data.target.fields,
    edgesFromContextToTarget: data.edgesFromContextToTarget,
    edgesFromTargetToContext: data.edgesFromTargetToContext,
    contextEdgesFrom: data.contextEdgesFrom,
    contextEdgesTo: data.contextEdgesTo,
    targetEdgesFrom: data.targetEdgesFrom,
    targetEdgesTo: data.targetEdgesTo,
    sharedNeighbors: data.sharedNeighbors,
  };
  const pack = packStore.get();
  if (pack) {
    for (const kind of pack.kinds) env[kind.id] = kind.id;
    for (const et of pack.edgeTypes) env[et.id] = et.id;
    for (const name of pack.fieldNames ?? []) env[name] = name;
  }
  return env;
}

function evaluatePredicate(actionId: string, when: unknown, data: ActionData, packStore: WorldPackStore): boolean {
  try {
    let fn = compiledPredicates.get(actionId);
    if (!fn) {
      fn = compile(when as Expr);
      compiledPredicates.set(actionId, fn);
    }
    return !!fn(buildPredicateEnv(data, packStore));
  } catch (e) {
    if (e instanceof CompileError) compiledPredicates.delete(actionId);
    return false;
  }
}

export interface EdgeIndex {
  from: Map<string, Edge[]>;
  to: Map<string, Edge[]>;
}

export function buildEdgeIndex(graph: CardGraph): EdgeIndex {
  const from = new Map<string, Edge[]>();
  const to = new Map<string, Edge[]>();
  for (const edge of graph.allEdges()) {
    let fList = from.get(edge.from);
    if (!fList) {
      fList = [];
      from.set(edge.from, fList);
    }
    fList.push(edge);
    let tList = to.get(edge.to);
    if (!tList) {
      tList = [];
      to.set(edge.to, tList);
    }
    tList.push(edge);
  }
  return { from, to };
}

export function buildActionData(
  graph: CardGraph,
  contextId: string,
  targetId: string,
  edgeIndex?: EdgeIndex,
): ActionData | null {
  const contextCard = graph.getCard(contextId);
  const targetCard = graph.getCard(targetId);
  if (!contextCard || !targetCard) return null;

  const edgesFromContextToTarget: ActionData["edgesFromContextToTarget"] = [];
  const edgesFromTargetToContext: ActionData["edgesFromTargetToContext"] = [];
  const contextEdgesFrom: ActionData["contextEdgesFrom"] = [];
  const contextEdgesTo: ActionData["contextEdgesTo"] = [];
  const targetEdgesFrom: ActionData["targetEdgesFrom"] = [];
  const targetEdgesTo: ActionData["targetEdgesTo"] = [];

  const contextNeighborIds = new Set<string>();
  const targetNeighborIds = new Set<string>();

  if (edgeIndex) {
    for (const edge of edgeIndex.from.get(contextId) ?? []) {
      if (edge.to === targetId) {
        edgesFromContextToTarget.push({
          ...(edge.type !== undefined ? { type: edge.type } : {}),
          ...(edge.label !== undefined ? { label: edge.label } : {}),
        });
      }
      const toCard = graph.getCard(edge.to);
      contextEdgesFrom.push({
        to: edge.to,
        ...(toCard?.kind !== undefined ? { toKind: toCard.kind } : {}),
        ...(edge.type !== undefined ? { type: edge.type } : {}),
      });
      contextNeighborIds.add(edge.to);
    }

    for (const edge of edgeIndex.to.get(contextId) ?? []) {
      if (edge.from === targetId) {
        edgesFromTargetToContext.push({
          ...(edge.type !== undefined ? { type: edge.type } : {}),
          ...(edge.label !== undefined ? { label: edge.label } : {}),
        });
      }
      const fromCard = graph.getCard(edge.from);
      contextEdgesTo.push({
        from: edge.from,
        ...(fromCard?.kind !== undefined ? { fromKind: fromCard.kind } : {}),
        ...(edge.type !== undefined ? { type: edge.type } : {}),
      });
      contextNeighborIds.add(edge.from);
    }

    for (const edge of edgeIndex.from.get(targetId) ?? []) {
      const toCard = graph.getCard(edge.to);
      targetEdgesFrom.push({
        to: edge.to,
        ...(toCard?.kind !== undefined ? { toKind: toCard.kind } : {}),
        ...(edge.type !== undefined ? { type: edge.type } : {}),
      });
      targetNeighborIds.add(edge.to);
    }

    for (const edge of edgeIndex.to.get(targetId) ?? []) {
      const fromCard = graph.getCard(edge.from);
      targetEdgesTo.push({
        from: edge.from,
        ...(fromCard?.kind !== undefined ? { fromKind: fromCard.kind } : {}),
        ...(edge.type !== undefined ? { type: edge.type } : {}),
      });
      targetNeighborIds.add(edge.from);
    }
  } else {
    const allEdges = graph.allEdges();

    for (const edge of allEdges) {
      if (edge.from === contextId && edge.to === targetId) {
        edgesFromContextToTarget.push({
          ...(edge.type !== undefined ? { type: edge.type } : {}),
          ...(edge.label !== undefined ? { label: edge.label } : {}),
        });
      }
      if (edge.from === targetId && edge.to === contextId) {
        edgesFromTargetToContext.push({
          ...(edge.type !== undefined ? { type: edge.type } : {}),
          ...(edge.label !== undefined ? { label: edge.label } : {}),
        });
      }
      if (edge.from === contextId) {
        const toCard = graph.getCard(edge.to);
        contextEdgesFrom.push({
          to: edge.to,
          ...(toCard?.kind !== undefined ? { toKind: toCard.kind } : {}),
          ...(edge.type !== undefined ? { type: edge.type } : {}),
        });
        contextNeighborIds.add(edge.to);
      }
      if (edge.to === contextId) {
        const fromCard = graph.getCard(edge.from);
        contextEdgesTo.push({
          from: edge.from,
          ...(fromCard?.kind !== undefined ? { fromKind: fromCard.kind } : {}),
          ...(edge.type !== undefined ? { type: edge.type } : {}),
        });
        contextNeighborIds.add(edge.from);
      }
      if (edge.from === targetId) {
        const toCard = graph.getCard(edge.to);
        targetEdgesFrom.push({
          to: edge.to,
          ...(toCard?.kind !== undefined ? { toKind: toCard.kind } : {}),
          ...(edge.type !== undefined ? { type: edge.type } : {}),
        });
        targetNeighborIds.add(edge.to);
      }
      if (edge.to === targetId) {
        const fromCard = graph.getCard(edge.from);
        targetEdgesTo.push({
          from: edge.from,
          ...(fromCard?.kind !== undefined ? { fromKind: fromCard.kind } : {}),
          ...(edge.type !== undefined ? { type: edge.type } : {}),
        });
        targetNeighborIds.add(edge.from);
      }
    }
  }

  const sharedNeighbors: ActionData["sharedNeighbors"] = [];
  for (const id of contextNeighborIds) {
    if (id === contextId || id === targetId) continue;
    if (targetNeighborIds.has(id)) {
      const card = graph.getCard(id);
      if (card) {
        sharedNeighbors.push({
          id,
          ...(card.kind !== undefined ? { kind: card.kind } : {}),
        });
      }
    }
  }

  return {
    context: { id: contextId, text: contextCard.text, kind: contextCard.kind ?? null, fields: contextCard.fields ?? {} },
    target: { id: targetId, text: targetCard.text, kind: targetCard.kind ?? null, fields: targetCard.fields ?? {} },
    edgesFromContextToTarget,
    edgesFromTargetToContext,
    contextEdgesFrom,
    contextEdgesTo,
    targetEdgesFrom,
    targetEdgesTo,
    sharedNeighbors,
  };
}

export function isActionAvailable(
  action: ActionDef,
  graph: CardGraph,
  packStore: WorldPackStore,
  contextId: string,
  targetId: string,
  edgeIndex?: EdgeIndex,
): boolean {
  // Kind checks (short-circuit)
  if (action.context.kind !== undefined) {
    const contextCard = graph.getCard(contextId);
    if (!contextCard || contextCard.kind !== action.context.kind) return false;
  }
  if (action.target.kind !== undefined) {
    const targetCard = graph.getCard(targetId);
    if (!targetCard || targetCard.kind !== action.target.kind) return false;
  }

  // Edge type check
  if (action.target.edgeType !== undefined) {
    const direction = action.target.direction ?? "from";
    const fromId = direction === "from" ? contextId : targetId;
    const toId = direction === "from" ? targetId : contextId;
    const edges = edgeIndex
      ? (edgeIndex.from.get(fromId) ?? [])
      : graph.edgesFrom(fromId);
    const hasEdge = edges.some(
      (e) => e.to === toId && e.type === action.target.edgeType,
    );
    if (!hasEdge) return false;
  }

  if (action.when !== undefined) {
    const data = buildActionData(graph, contextId, targetId, edgeIndex);
    if (!data) return false;
    if (!evaluatePredicate(action.id, action.when, data, packStore)) return false;
  }

  return true;
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
  if (!isActionAvailable(action, graph, packStore, contextId, targetId)) {
    return { success: false, events: [] };
  }

  const emittedEvents: ActionEvent[] = [];

  function resolveCardId(ref: CardRef): string {
    return ref === "context" ? contextId : targetId;
  }

  graph.transact(() => {
    for (const effect of action.do) {
      switch (effect.type) {
        case "addEdge": {
          const fromId = resolveCardId(effect.from);
          const toId = resolveCardId(effect.to);
          graph.addEdge(fromId, toId, effect.label, effect.edgeType);
          break;
        }
        case "removeEdge": {
          const fromId = resolveCardId(effect.from);
          const toId = resolveCardId(effect.to);
          for (const e of graph.edgesFrom(fromId)) {
            if (e.to === toId && (effect.edgeType === undefined || e.type === effect.edgeType)) {
              graph.removeEdge(e.id);
              break;
            }
          }
          break;
        }
        case "setKind": {
          const cardId = resolveCardId(effect.card);
          graph.setKind(cardId, effect.kind);
          break;
        }
        case "setText": {
          const cardId = resolveCardId(effect.card);
          graph.updateCard(cardId, { text: effect.text });
          break;
        }
        case "setField": {
          const cardId = resolveCardId(effect.card);
          graph.setField(cardId, effect.key, effect.value);
          break;
        }
        case "removeField": {
          const cardId = resolveCardId(effect.card);
          graph.deleteField(cardId, effect.key);
          break;
        }
        case "createCard": {
          const nearId = effect.near ? resolveCardId(effect.near) : contextId;
          const nearCard = graph.getCard(nearId);
          const pos = nearCard
            ? { x: nearCard.position.x + 160, y: nearCard.position.y }
            : { x: 0, y: 0 };
          const newCard = graph.addCard(effect.text, pos, effect.kind);
          if (effect.fields) {
            for (const [k, v] of Object.entries(effect.fields)) {
              graph.setField(newCard.id, k, v);
            }
          }
          break;
        }
        case "emit": {
          emittedEvents.push({
            timestamp: Date.now(),
            actor,
            actionId: action.id,
            event: effect.event,
            contextCardId: contextId,
            targetCardId: targetId,
            ...(effect.data !== undefined ? { data: effect.data } : {}),
          });
          break;
        }
      }
    }

    // Append events inside the same Y.js transaction so graph + log are atomic.
    // EventLog.append() calls doc.transact() internally; Y.js merges nested transactions.
    if (eventLog) {
      for (const event of emittedEvents) {
        eventLog.append(event);
      }
    }
  });

  return { success: true, events: emittedEvents };
}
