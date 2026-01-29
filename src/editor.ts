import type { Card, Position } from "./types";
import type { CardGraph } from "./graph";

export type EditCallback = (card: Card) => void;

export class Editor {
  onEdit: EditCallback | null = null;

  constructor(private graph: CardGraph) {}

  setText(cardId: string, text: string): Card {
    const card = this.graph.updateCard(cardId, { text });
    this.onEdit?.(card);
    return card;
  }

  setPosition(cardId: string, position: Position): Card {
    const card = this.graph.updateCard(cardId, { position });
    this.onEdit?.(card);
    return card;
  }
}
