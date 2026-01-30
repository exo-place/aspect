import type { CardGraph } from "./graph";
import type { Card } from "./types";
import type { WorldPackStore } from "./pack";
import type { Affordance } from "./affordance-types";
import { isActionAvailable, buildEdgeIndex } from "./action";

export function buildAffordances(
  contextCardId: string,
  graph: CardGraph,
  packStore: WorldPackStore,
): Affordance[] {
  const pack = packStore.get();
  if (!pack || !pack.actions || pack.actions.length === 0) return [];

  const contextCard = graph.getCard(contextCardId);
  if (!contextCard) return [];

  const edgeIndex = buildEdgeIndex(graph);

  // Group non-context cards by kind for O(1) lookup
  const allCards: Card[] = [];
  const cardsByKind = new Map<string, Card[]>();
  for (const card of graph.allCards()) {
    if (card.id === contextCardId) continue;
    allCards.push(card);
    if (card.kind !== undefined) {
      let list = cardsByKind.get(card.kind);
      if (!list) {
        list = [];
        cardsByKind.set(card.kind, list);
      }
      list.push(card);
    }
  }

  const affordances: Affordance[] = [];

  for (const action of pack.actions) {
    if (action.context.kind !== undefined && contextCard.kind !== action.context.kind) {
      continue;
    }

    // Narrow candidate targets using the index
    let candidates: Iterable<Card>;

    if (action.target.edgeType !== undefined) {
      // Follow edges from/to context with the required type
      const direction = action.target.direction ?? "from";
      const edgeList = direction === "from"
        ? (edgeIndex.from.get(contextCardId) ?? [])
        : (edgeIndex.to.get(contextCardId) ?? []);

      const seen = new Set<string>();
      const narrowed: Card[] = [];
      for (const edge of edgeList) {
        if (edge.type !== action.target.edgeType) continue;
        const candidateId = direction === "from" ? edge.to : edge.from;
        if (candidateId === contextCardId || seen.has(candidateId)) continue;
        seen.add(candidateId);
        const card = graph.getCard(candidateId);
        if (!card) continue;
        if (action.target.kind !== undefined && card.kind !== action.target.kind) continue;
        narrowed.push(card);
      }
      candidates = narrowed;
    } else if (action.target.kind !== undefined) {
      candidates = cardsByKind.get(action.target.kind) ?? [];
    } else {
      candidates = allCards;
    }

    for (const card of candidates) {
      if (isActionAvailable(action, graph, packStore, contextCardId, card.id, edgeIndex)) {
        const kindDef = card.kind ? packStore.getKind(card.kind) : undefined;
        affordances.push({
          actionId: action.id,
          actionLabel: action.label,
          ...(action.description !== undefined ? { actionDescription: action.description } : {}),
          targetCardId: card.id,
          targetText: card.text,
          ...(card.kind !== undefined ? { targetKind: card.kind } : {}),
          ...(kindDef?.style !== undefined ? { targetKindStyle: kindDef.style } : {}),
        });
      }
    }
  }

  return affordances;
}

export function getAffordancesForCard(
  affordances: Affordance[],
  cardId: string,
): Affordance[] {
  return affordances.filter((a) => a.targetCardId === cardId);
}
