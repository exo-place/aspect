import type { CardGraph } from "./graph";
import type { WorldPackStore } from "./pack";
import type { EventLog } from "./event-log";
import type { ActionDef, ActionData, ActionResult, ActionEvent, CardRef } from "./action-types";
import { apply } from "./json-logic";

export function buildActionData(
  graph: CardGraph,
  contextId: string,
  targetId: string,
): ActionData | null {
  const contextCard = graph.getCard(contextId);
  const targetCard = graph.getCard(targetId);
  if (!contextCard || !targetCard) return null;

  const allEdges = graph.allEdges();

  const edgesFromContextToTarget: ActionData["edgesFromContextToTarget"] = [];
  const edgesFromTargetToContext: ActionData["edgesFromTargetToContext"] = [];
  const contextEdgesFrom: ActionData["contextEdgesFrom"] = [];
  const contextEdgesTo: ActionData["contextEdgesTo"] = [];
  const targetEdgesFrom: ActionData["targetEdgesFrom"] = [];
  const targetEdgesTo: ActionData["targetEdgesTo"] = [];

  const contextNeighborIds = new Set<string>();
  const targetNeighborIds = new Set<string>();

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
    context: { id: contextId, text: contextCard.text, kind: contextCard.kind ?? null },
    target: { id: targetId, text: targetCard.text, kind: targetCard.kind ?? null },
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
    const edges = graph.allEdges();
    const hasEdge = edges.some(
      (e) => e.from === fromId && e.to === toId && e.type === action.target.edgeType,
    );
    if (!hasEdge) return false;
  }

  // JSONLogic predicate
  if (action.when !== undefined) {
    const data = buildActionData(graph, contextId, targetId);
    if (!data) return false;
    const result = apply(action.when, data as unknown as Record<string, unknown>);
    if (!result) return false;
  }

  return true;
}

export function findActionTargets(
  action: ActionDef,
  graph: CardGraph,
  packStore: WorldPackStore,
  contextId: string,
): string[] {
  const targets: string[] = [];
  for (const card of graph.allCards()) {
    if (card.id === contextId) continue;
    if (isActionAvailable(action, graph, packStore, contextId, card.id)) {
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
          const edges = graph.allEdges();
          for (const e of edges) {
            if (e.from === fromId && e.to === toId) {
              if (effect.edgeType === undefined || e.type === effect.edgeType) {
                graph.removeEdge(e.id);
                break;
              }
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
  });

  if (eventLog) {
    for (const event of emittedEvents) {
      eventLog.append(event);
    }
  }

  return { success: true, events: emittedEvents };
}
