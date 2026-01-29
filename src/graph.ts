import * as Y from "yjs";
import type { Card, CardGraphData, Edge, Position } from "./types";
import type { YDocBundle } from "./ydoc";
import type { WorldPackStore } from "./pack";
import { createId } from "./id";

export type ChangeCallback = () => void;

export class CardGraph {
  private doc: Y.Doc;
  private cards: Y.Map<Y.Map<unknown>>;
  private edges: Y.Map<Y.Map<unknown>>;
  private packStore: WorldPackStore | null = null;

  onChange: ChangeCallback | null = null;

  constructor(bundle: YDocBundle) {
    this.doc = bundle.doc;
    this.cards = bundle.cards;
    this.edges = bundle.edges;

    this.doc.on("update", () => {
      this.notify();
    });
  }

  setPackStore(store: WorldPackStore): void {
    this.packStore = store;
  }

  addCard(text: string, position: Position, kind?: string): Card {
    const id = createId();
    this.doc.transact(() => {
      const yCard = new Y.Map<unknown>();
      yCard.set("text", text);
      yCard.set("x", position.x);
      yCard.set("y", position.y);
      if (kind !== undefined) yCard.set("kind", kind);
      this.cards.set(id, yCard);
    });
    return this.materializeCard(id, this.cards.get(id)!);
  }

  getCard(id: string): Card | undefined {
    const yCard = this.cards.get(id);
    if (!yCard) return undefined;
    return this.materializeCard(id, yCard);
  }

  updateCard(id: string, patch: Partial<Pick<Card, "text" | "position">>): Card {
    const yCard = this.cards.get(id);
    if (!yCard) throw new Error(`Card not found: ${id}`);
    this.doc.transact(() => {
      if (patch.text !== undefined) yCard.set("text", patch.text);
      if (patch.position !== undefined) {
        yCard.set("x", patch.position.x);
        yCard.set("y", patch.position.y);
      }
    });
    return this.materializeCard(id, yCard);
  }

  setKind(id: string, kind: string | null): void {
    const yCard = this.cards.get(id);
    if (!yCard) throw new Error(`Card not found: ${id}`);
    this.doc.transact(() => {
      if (kind === null) {
        yCard.delete("kind");
      } else {
        yCard.set("kind", kind);
      }
    });
  }

  removeCard(id: string): void {
    if (!this.cards.has(id)) throw new Error(`Card not found: ${id}`);
    this.doc.transact(() => {
      for (const [edgeId, yEdge] of this.edges) {
        if (yEdge.get("from") === id || yEdge.get("to") === id) {
          this.edges.delete(edgeId);
        }
      }
      this.cards.delete(id);
    });
  }

  addEdge(from: string, to: string, label?: string, type?: string): Edge {
    if (!this.cards.has(from)) throw new Error(`Card not found: ${from}`);
    if (!this.cards.has(to)) throw new Error(`Card not found: ${to}`);
    const existing = this.directEdge(from, to);
    if (existing) return existing;

    if (this.packStore && type !== undefined) {
      const fromCard = this.getCard(from);
      const toCard = this.getCard(to);
      if (!this.packStore.validateEdge(type, fromCard?.kind, toCard?.kind)) {
        const fk = fromCard?.kind ?? "(none)";
        const tk = toCard?.kind ?? "(none)";
        throw new Error("Edge type \"" + type + "\" not allowed between kinds \"" + fk + "\" and \"" + tk + "\"");
      }
    }

    const id = createId();
    this.doc.transact(() => {
      const yEdge = new Y.Map<unknown>();
      yEdge.set("from", from);
      yEdge.set("to", to);
      if (label !== undefined) yEdge.set("label", label);
      if (type !== undefined) yEdge.set("type", type);
      this.edges.set(id, yEdge);
    });
    return this.materializeEdge(id, this.edges.get(id)!);
  }

  updateEdge(id: string, label: string): Edge {
    const yEdge = this.edges.get(id);
    if (!yEdge) throw new Error(`Edge not found: ${id}`);
    this.doc.transact(() => {
      if (label) {
        yEdge.set("label", label);
      } else {
        yEdge.delete("label");
      }
    });
    return this.materializeEdge(id, yEdge);
  }

  removeEdge(id: string): void {
    if (!this.edges.has(id)) throw new Error(`Edge not found: ${id}`);
    this.doc.transact(() => {
      this.edges.delete(id);
    });
  }

  directEdge(from: string, to: string): Edge | undefined {
    for (const [id, yEdge] of this.edges) {
      if (yEdge.get("from") === from && yEdge.get("to") === to) {
        return this.materializeEdge(id, yEdge);
      }
    }
    return undefined;
  }

  edgeBetween(a: string, b: string): Edge | undefined {
    for (const [id, yEdge] of this.edges) {
      const f = yEdge.get("from");
      const t = yEdge.get("to");
      if ((f === a && t === b) || (f === b && t === a)) {
        return this.materializeEdge(id, yEdge);
      }
    }
    return undefined;
  }

  allEdgesBetween(a: string, b: string): Edge[] {
    const result: Edge[] = [];
    for (const [id, yEdge] of this.edges) {
      const f = yEdge.get("from");
      const t = yEdge.get("to");
      if ((f === a && t === b) || (f === b && t === a)) {
        result.push(this.materializeEdge(id, yEdge));
      }
    }
    return result;
  }

  edgesFrom(cardId: string): Edge[] {
    const result: Edge[] = [];
    for (const [id, yEdge] of this.edges) {
      if (yEdge.get("from") === cardId) {
        result.push(this.materializeEdge(id, yEdge));
      }
    }
    return result;
  }

  edgesTo(cardId: string): Edge[] {
    const result: Edge[] = [];
    for (const [id, yEdge] of this.edges) {
      if (yEdge.get("to") === cardId) {
        result.push(this.materializeEdge(id, yEdge));
      }
    }
    return result;
  }

  neighbors(cardId: string): Card[] {
    const neighborIds = new Set<string>();
    for (const [, yEdge] of this.edges) {
      const f = yEdge.get("from") as string;
      const t = yEdge.get("to") as string;
      if (f === cardId) neighborIds.add(t);
      if (t === cardId) neighborIds.add(f);
    }
    const result: Card[] = [];
    for (const id of neighborIds) {
      const yCard = this.cards.get(id);
      if (yCard) result.push(this.materializeCard(id, yCard));
    }
    return result;
  }

  allCards(): Card[] {
    const result: Card[] = [];
    for (const [id, yCard] of this.cards) {
      result.push(this.materializeCard(id, yCard));
    }
    return result;
  }

  allEdges(): Edge[] {
    const result: Edge[] = [];
    for (const [id, yEdge] of this.edges) {
      result.push(this.materializeEdge(id, yEdge));
    }
    return result;
  }

  toJSON(): CardGraphData {
    const cards: Record<string, Card> = {};
    for (const [id, yCard] of this.cards) {
      cards[id] = this.materializeCard(id, yCard);
    }
    const edges: Record<string, Edge> = {};
    for (const [id, yEdge] of this.edges) {
      edges[id] = this.materializeEdge(id, yEdge);
    }
    return { cards, edges };
  }

  loadJSON(data: CardGraphData): void {
    this.doc.transact(() => {
      this.cards.forEach((_, id) => this.cards.delete(id));
      this.edges.forEach((_, id) => this.edges.delete(id));
      for (const [id, card] of Object.entries(data.cards)) {
        const yCard = new Y.Map<unknown>();
        yCard.set("text", card.text);
        yCard.set("x", card.position.x);
        yCard.set("y", card.position.y);
        if (card.kind !== undefined) yCard.set("kind", card.kind);
        this.cards.set(id, yCard);
      }
      for (const [id, edge] of Object.entries(data.edges)) {
        const yEdge = new Y.Map<unknown>();
        yEdge.set("from", edge.from);
        yEdge.set("to", edge.to);
        if (edge.label !== undefined) yEdge.set("label", edge.label);
        if (edge.type !== undefined) yEdge.set("type", edge.type);
        this.edges.set(id, yEdge);
      }
    });
  }

  private materializeCard(id: string, yCard: Y.Map<unknown>): Card {
    const card: Card = {
      id,
      text: yCard.get("text") as string,
      position: {
        x: yCard.get("x") as number,
        y: yCard.get("y") as number,
      },
    };
    const kind = yCard.get("kind") as string | undefined;
    if (kind !== undefined) {
      (card as { kind?: string }).kind = kind;
    }
    return card;
  }

  private materializeEdge(id: string, yEdge: Y.Map<unknown>): Edge {
    const label = yEdge.get("label") as string | undefined;
    const type = yEdge.get("type") as string | undefined;
    const edge: Edge = {
      id,
      from: yEdge.get("from") as string,
      to: yEdge.get("to") as string,
    };
    if (label !== undefined) {
      (edge as { label?: string }).label = label;
    }
    if (type !== undefined) {
      (edge as { type?: string }).type = type;
    }
    return edge;
  }

  private notify(): void {
    this.onChange?.();
  }
}
