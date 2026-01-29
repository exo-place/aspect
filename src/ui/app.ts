import { CardGraph } from "../graph";
import { Navigator } from "../navigator";
import { Editor } from "../editor";
import { Canvas } from "./canvas";
import { createCardElement, updateCardElement, startEditing } from "./card-node";
import type { CardNodeEvents } from "./card-node";
import { createEdgeLine, updateEdgeLine } from "./edge-line";
import { setupKeybinds } from "./keybinds";

export class App {
  private canvas: Canvas;
  private graph: CardGraph;
  private navigator: Navigator;
  private editor: Editor;
  private cardElements = new Map<string, HTMLDivElement>();
  private edgeElements = new Map<string, SVGLineElement>();
  private cardEvents: CardNodeEvents;

  constructor(container: HTMLElement, graph: CardGraph) {
    this.graph = graph;
    this.navigator = new Navigator(graph);
    this.editor = new Editor(graph);
    this.canvas = new Canvas(container);

    this.cardEvents = {
      onClick: (cardId) => {
        this.navigator.jumpTo(cardId);
      },
      onDoubleClick: (cardId, element) => {
        const card = this.graph.getCard(cardId);
        if (!card) return;
        startEditing(element, card.text, (text) => {
          this.editor.setText(cardId, text);
        });
      },
      onDelete: (cardId) => {
        this.deleteCard(cardId);
      },
      onDragStart: () => {},
      onDrag: () => {
        this.renderEdges();
      },
      onDragEnd: (cardId) => {
        const el = this.cardElements.get(cardId);
        if (el) {
          this.editor.setPosition(cardId, {
            x: parseFloat(el.style.left),
            y: parseFloat(el.style.top),
          });
        }
      },
    };

    this.canvas.events = {
      onDoubleClickEmpty: (worldX, worldY) => {
        const card = this.graph.addCard("", { x: worldX - 60, y: worldY - 20 });
        const current = this.navigator.current;
        if (current) {
          this.graph.addEdge(current.id, card.id);
        }
        this.navigator.jumpTo(card.id);
        const cardEl = this.cardElements.get(card.id);
        if (cardEl) {
          startEditing(cardEl, "", (text) => {
            this.editor.setText(card.id, text);
          });
        }
      },
      onClickEmpty: () => {
        this.navigator.deselect();
      },
    };

    this.graph.onChange = () => this.render();
    this.navigator.onNavigate = () => this.render();

    setupKeybinds({
      deleteCurrentCard: () => this.deleteCurrentCard(),
      deselect: () => this.navigator.deselect(),
    });
  }

  get nav(): Navigator {
    return this.navigator;
  }

  render(): void {
    const currentId = this.navigator.current?.id ?? null;
    const allCards = this.graph.allCards();

    // Reconcile cards
    const activeCardIds = new Set<string>();
    for (const card of allCards) {
      activeCardIds.add(card.id);
      let el = this.cardElements.get(card.id);
      if (!el) {
        el = createCardElement(card.id, this.cardEvents, () => this.canvas.getState().zoom);
        this.canvas.cardLayer.appendChild(el);
        this.cardElements.set(card.id, el);
      }
      updateCardElement(el, card, card.id === currentId);
    }
    for (const [id, el] of this.cardElements) {
      if (!activeCardIds.has(id)) {
        el.remove();
        this.cardElements.delete(id);
      }
    }

    this.renderEdges();
  }

  private renderEdges(): void {
    const currentId = this.navigator.current?.id ?? null;
    const allEdges = this.graph.allEdges();

    const activeEdgeIds = new Set<string>();
    for (const edge of allEdges) {
      activeEdgeIds.add(edge.id);
      let line = this.edgeElements.get(edge.id);
      if (!line) {
        line = createEdgeLine();
        this.canvas.edgeLayer.appendChild(line);
        this.edgeElements.set(edge.id, line);
      }
      const fromEl = this.cardElements.get(edge.from);
      const toEl = this.cardElements.get(edge.to);
      if (fromEl && toEl) {
        updateEdgeLine(line, fromEl, toEl, edge.from === currentId || edge.to === currentId);
      }
    }
    for (const [id, el] of this.edgeElements) {
      if (!activeEdgeIds.has(id)) {
        el.remove();
        this.edgeElements.delete(id);
      }
    }
  }

  deleteCurrentCard(): void {
    const current = this.navigator.current;
    if (current) this.deleteCard(current.id);
  }

  private deleteCard(cardId: string): void {
    const neighbors = this.graph.neighbors(cardId);
    this.graph.removeCard(cardId);
    // Navigate to a neighbor, or deselect if none left
    if (neighbors.length > 0) {
      this.navigator.jumpTo(neighbors[0].id);
    } else {
      const remaining = this.graph.allCards();
      if (remaining.length > 0) {
        this.navigator.jumpTo(remaining[0].id);
      } else {
        this.navigator.deselect();
      }
    }
  }

  bootstrap(): void {
    const cards = this.graph.allCards();
    if (cards.length === 0) {
      const start = this.graph.addCard(
        "Double-click empty space to create a card\nClick a card to select it\nDouble-click a card to edit\nRight-click a card for options\nDrag cards to rearrange\nScroll to zoom",
        { x: 0, y: 0 },
      );
      this.navigator.jumpTo(start.id);
      this.canvas.centerOn(0, 0);
    } else {
      this.navigator.jumpTo(cards[0].id);
      this.canvas.centerOn(cards[0].position.x, cards[0].position.y);
    }
  }
}
