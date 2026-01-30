import type { CardGraph } from "./graph";
import type { WorldPackStore } from "./pack";
import type { Affordance } from "./affordance-types";
import { isActionAvailable } from "./action";

export function buildAffordances(
  contextCardId: string,
  graph: CardGraph,
  packStore: WorldPackStore,
): Affordance[] {
  const pack = packStore.get();
  if (!pack || !pack.actions || pack.actions.length === 0) return [];

  const contextCard = graph.getCard(contextCardId);
  if (!contextCard) return [];

  const affordances: Affordance[] = [];

  for (const action of pack.actions) {
    if (action.context.kind !== undefined && contextCard.kind !== action.context.kind) {
      continue;
    }

    for (const card of graph.allCards()) {
      if (card.id === contextCardId) continue;

      if (action.target.kind !== undefined && card.kind !== action.target.kind) {
        continue;
      }

      if (isActionAvailable(action, graph, packStore, contextCardId, card.id)) {
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
