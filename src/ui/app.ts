import { CardGraph } from "../graph";
import { Navigator } from "../navigator";
import { Editor } from "../editor";
import { Canvas } from "./canvas";
import { renderCard, startEditing } from "./card-node";
import type { CardNodeEvents } from "./card-node";
import { renderEdge } from "./edge-line";

export class App {
  private canvas: Canvas;
  private graph: CardGraph;
  private navigator: Navigator;
  private editor: Editor;
  private suppressRender = false;

  constructor(container: HTMLElement, graph: CardGraph) {
    this.graph = graph;
    this.navigator = new Navigator(graph);
    this.editor = new Editor(graph);
    this.canvas = new Canvas(container);

    this.canvas.events = {
      onDoubleClickEmpty: (worldX, worldY) => {
        const card = this.graph.addCard("", { x: worldX - 60, y: worldY - 20 });
        const current = this.navigator.current;
        if (current) {
          this.graph.addEdge(current.id, card.id);
        }
        this.navigator.jumpTo(card.id);
        this.render();
        // Start editing the new card immediately
        const cardEl = this.canvas.cardLayer.querySelector(
          `[data-card-id="${card.id}"]`,
        ) as HTMLDivElement | null;
        if (cardEl) {
          startEditing(cardEl, "", (text) => {
            this.editor.setText(card.id, text);
            this.render();
          });
        }
      },
    };

    this.graph.onChange = () => {
      if (!this.suppressRender) this.render();
    };
    this.navigator.onNavigate = () => {
      if (!this.suppressRender) this.render();
    };

    this.render();
  }

  get nav(): Navigator {
    return this.navigator;
  }

  render(): void {
    const { cardLayer, edgeLayer } = this.canvas;
    cardLayer.innerHTML = "";
    edgeLayer.innerHTML = "";

    const currentId = this.navigator.current?.id ?? null;
    const allCards = this.graph.allCards();
    const allEdges = this.graph.allEdges();

    // Build cards lookup for edge rendering
    const cardsMap: Record<string, typeof allCards[0]> = {};
    for (const card of allCards) {
      cardsMap[card.id] = card;
    }

    // Render edges first (below cards)
    for (const edge of allEdges) {
      renderEdge(edge, cardsMap, currentId, edgeLayer);
    }

    // Render cards
    const cardEvents: CardNodeEvents = {
      onClick: (cardId) => {
        this.navigator.jumpTo(cardId);
        this.render();
      },
      onDoubleClick: (cardId, element) => {
        const card = this.graph.getCard(cardId);
        if (!card) return;
        startEditing(element, card.text, (text) => {
          this.editor.setText(cardId, text);
          this.render();
        });
      },
      onDragStart: () => {
        this.suppressRender = true;
      },
      onDrag: (_cardId, worldX, worldY) => {
        // Update edges visually without committing to graph
        edgeLayer.innerHTML = "";
        const tempMap: Record<string, typeof allCards[0]> = {};
        for (const c of this.graph.allCards()) {
          tempMap[c.id] = c.id === _cardId
            ? { ...c, position: { x: worldX, y: worldY } }
            : c;
        }
        for (const edge of allEdges) {
          renderEdge(edge, tempMap, currentId, edgeLayer);
        }
      },
      onDragEnd: (cardId) => {
        const el = cardLayer.querySelector(`[data-card-id="${cardId}"]`) as HTMLElement | null;
        this.suppressRender = false;
        if (el) {
          const x = parseFloat(el.style.left);
          const y = parseFloat(el.style.top);
          this.editor.setPosition(cardId, { x, y });
        }
      },
    };

    const zoom = this.canvas.getState().zoom;
    for (const card of allCards) {
      renderCard(card, currentId, cardLayer, cardEvents, zoom);
    }
  }

  bootstrap(): void {
    const cards = this.graph.allCards();
    if (cards.length === 0) {
      const start = this.graph.addCard("Start here", { x: 0, y: 0 });
      this.navigator.jumpTo(start.id);
      this.canvas.centerOn(0, 0);
    } else {
      this.navigator.jumpTo(cards[0].id);
      this.canvas.centerOn(cards[0].position.x, cards[0].position.y);
    }
    this.render();
  }
}
