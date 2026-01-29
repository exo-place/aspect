import type { Card, Edge } from "./types";
import type { CardGraph } from "./graph";

export type NavigateCallback = (card: Card | null) => void;

export class Navigator {
  private currentId: string | null = null;

  onNavigate: NavigateCallback | null = null;

  constructor(private graph: CardGraph) {}

  get current(): Card | null {
    if (this.currentId === null) return null;
    return this.graph.getCard(this.currentId) ?? null;
  }

  get exits(): Edge[] {
    if (this.currentId === null) return [];
    return this.graph.edgesFrom(this.currentId);
  }

  get reachable(): Card[] {
    if (this.currentId === null) return [];
    return this.exits
      .map((e) => this.graph.getCard(e.to))
      .filter((c): c is Card => c !== undefined);
  }

  moveTo(cardId: string): Card {
    if (this.currentId === null) throw new Error("No current card");
    const edge = this.graph
      .edgesFrom(this.currentId)
      .find((e) => e.to === cardId);
    if (!edge) throw new Error(`No edge from current card to ${cardId}`);
    const card = this.graph.getCard(cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);
    this.currentId = cardId;
    this.onNavigate?.(card);
    return card;
  }

  jumpTo(cardId: string): Card {
    const card = this.graph.getCard(cardId);
    if (!card) throw new Error(`Card not found: ${cardId}`);
    this.currentId = cardId;
    this.onNavigate?.(card);
    return card;
  }

  deselect(): void {
    this.currentId = null;
    this.onNavigate?.(null);
  }
}
