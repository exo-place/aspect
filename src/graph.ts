import type { Card, CardGraphData, Edge, Position } from "./types";
import { createId } from "./id";

export type ChangeCallback = () => void;

export class CardGraph {
  private cards: Map<string, Card> = new Map();
  private edges: Map<string, Edge> = new Map();

  onChange: ChangeCallback | null = null;

  addCard(text: string, position: Position): Card {
    const card: Card = { id: createId(), text, position: { ...position } };
    this.cards.set(card.id, card);
    this.notify();
    return card;
  }

  getCard(id: string): Card | undefined {
    return this.cards.get(id);
  }

  updateCard(id: string, patch: Partial<Pick<Card, "text" | "position">>): Card {
    const card = this.cards.get(id);
    if (!card) throw new Error(`Card not found: ${id}`);
    if (patch.text !== undefined) card.text = patch.text;
    if (patch.position !== undefined) card.position = { ...patch.position };
    this.notify();
    return card;
  }

  removeCard(id: string): void {
    if (!this.cards.has(id)) throw new Error(`Card not found: ${id}`);
    for (const [edgeId, edge] of this.edges) {
      if (edge.from === id || edge.to === id) {
        this.edges.delete(edgeId);
      }
    }
    this.cards.delete(id);
    this.notify();
  }

  addEdge(from: string, to: string, label?: string): Edge {
    if (!this.cards.has(from)) throw new Error(`Card not found: ${from}`);
    if (!this.cards.has(to)) throw new Error(`Card not found: ${to}`);
    const edge: Edge = { id: createId(), from, to, label };
    this.edges.set(edge.id, edge);
    this.notify();
    return edge;
  }

  updateEdge(id: string, label: string): Edge {
    const edge = this.edges.get(id);
    if (!edge) throw new Error(`Edge not found: ${id}`);
    edge.label = label || undefined;
    this.notify();
    return edge;
  }

  removeEdge(id: string): void {
    if (!this.edges.has(id)) throw new Error(`Edge not found: ${id}`);
    this.edges.delete(id);
    this.notify();
  }

  edgesFrom(cardId: string): Edge[] {
    const result: Edge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.from === cardId) result.push(edge);
    }
    return result;
  }

  edgesTo(cardId: string): Edge[] {
    const result: Edge[] = [];
    for (const edge of this.edges.values()) {
      if (edge.to === cardId) result.push(edge);
    }
    return result;
  }

  neighbors(cardId: string): Card[] {
    const neighborIds = new Set<string>();
    for (const edge of this.edges.values()) {
      if (edge.from === cardId) neighborIds.add(edge.to);
      if (edge.to === cardId) neighborIds.add(edge.from);
    }
    const result: Card[] = [];
    for (const id of neighborIds) {
      const card = this.cards.get(id);
      if (card) result.push(card);
    }
    return result;
  }

  allCards(): Card[] {
    return [...this.cards.values()];
  }

  allEdges(): Edge[] {
    return [...this.edges.values()];
  }

  toJSON(): CardGraphData {
    const cards: Record<string, Card> = {};
    for (const [id, card] of this.cards) {
      cards[id] = { ...card, position: { ...card.position } };
    }
    const edges: Record<string, Edge> = {};
    for (const [id, edge] of this.edges) {
      edges[id] = { ...edge };
    }
    return { cards, edges };
  }

  loadJSON(data: CardGraphData): void {
    this.cards.clear();
    this.edges.clear();
    for (const [id, card] of Object.entries(data.cards)) {
      this.cards.set(id, { ...card, position: { ...card.position } });
    }
    for (const [id, edge] of Object.entries(data.edges)) {
      this.edges.set(id, { ...edge });
    }
    this.notify();
  }

  private notify(): void {
    this.onChange?.();
  }
}
