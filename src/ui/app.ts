import { CardGraph } from "../graph";
import { Navigator } from "../navigator";
import { Editor } from "../editor";
import { Selection } from "../selection";
import { Canvas } from "./canvas";
import { createCardElement, updateCardElement, startEditing } from "./card-node";
import type { CardNodeEvents } from "./card-node";
import { createEdgeGroup, updateEdgeGroup } from "./edge-line";
import { setupKeybinds } from "./keybinds";

export class App {
  private canvas: Canvas;
  private graph: CardGraph;
  private navigator: Navigator;
  private editor: Editor;
  private selection: Selection;
  private cardElements = new Map<string, HTMLDivElement>();
  private edgeElements = new Map<string, SVGGElement>();
  private cardEvents: CardNodeEvents;
  private ghostEdge: SVGLineElement | null = null;
  private ghostEdgeSource: string | null = null;

  constructor(container: HTMLElement, graph: CardGraph) {
    this.graph = graph;
    this.navigator = new Navigator(graph);
    this.editor = new Editor(graph);
    this.selection = new Selection();
    this.canvas = new Canvas(container);

    const { showContextMenu } = setupKeybinds({
      deleteCard: (cardId) => this.deleteCard(cardId),
      editCard: (cardId) => this.editCard(cardId),
      createCard: (worldX, worldY) => this.createCard(worldX, worldY),
      linkCards: () => this.linkCards(),
      labelEdge: () => this.labelEdge(),
      deselect: () => {
        this.selection.clear();
        this.navigator.deselect();
      },
      getCurrentCardId: () => this.navigator.current?.id ?? null,
      getSelectedCount: () => this.selection.size,
      getViewportCenter: () => this.canvas.getViewportCenter(),
    });

    this.cardEvents = {
      onClick: (cardId, event) => {
        if (event.shiftKey) {
          this.selection.toggle(cardId);
          if (!this.navigator.current) {
            this.navigator.jumpTo(cardId);
          }
        } else {
          this.selection.set(cardId);
          this.navigator.jumpTo(cardId);
        }
      },
      onDoubleClick: (cardId, element) => {
        const card = this.graph.getCard(cardId);
        if (!card) return;
        startEditing(element, card.text, (text) => {
          this.editor.setText(cardId, text);
        });
      },
      onContextMenu: (cardId, screenX, screenY) => {
        this.navigator.jumpTo(cardId);
        showContextMenu("card", screenX, screenY, { cardId });
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
      onEdgeDragStart: (sourceCardId) => {
        this.ghostEdgeSource = sourceCardId;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.classList.add("edge-line", "ghost");
        this.canvas.edgeLayer.appendChild(line);
        this.ghostEdge = line;
      },
      onEdgeDragMove: (sourceCardId, screenX, screenY) => {
        if (!this.ghostEdge) return;
        const fromEl = this.cardElements.get(sourceCardId);
        if (!fromEl) return;
        const fromX = parseFloat(fromEl.style.left) || 0;
        const fromY = parseFloat(fromEl.style.top) || 0;
        const fhw = (fromEl.offsetWidth || 120) / 2;
        const fhh = (fromEl.offsetHeight || 40) / 2;
        const fromCx = fromX + fhw;
        const fromCy = fromY + fhh;

        let worldTarget = this.canvas.screenToWorld(screenX, screenY);

        // Snap to target card center if hovering over one
        const hitEl = document.elementsFromPoint(screenX, screenY)
          .find((el) => el instanceof HTMLElement && el.dataset.cardId && el.dataset.cardId !== sourceCardId);
        if (hitEl instanceof HTMLElement && hitEl.dataset.cardId) {
          const tX = parseFloat(hitEl.style.left) || 0;
          const tY = parseFloat(hitEl.style.top) || 0;
          const thw = (hitEl.offsetWidth || 120) / 2;
          const thh = (hitEl.offsetHeight || 40) / 2;
          worldTarget = { x: tX + thw, y: tY + thh };
        }

        this.ghostEdge.setAttribute("x1", String(fromCx));
        this.ghostEdge.setAttribute("y1", String(fromCy));
        this.ghostEdge.setAttribute("x2", String(worldTarget.x));
        this.ghostEdge.setAttribute("y2", String(worldTarget.y));
      },
      onEdgeDragEnd: (sourceCardId, screenX, screenY) => {
        if (this.ghostEdge) {
          this.ghostEdge.remove();
          this.ghostEdge = null;
        }
        this.ghostEdgeSource = null;

        const hitEl = document.elementsFromPoint(screenX, screenY)
          .find((el) => el instanceof HTMLElement && el.dataset.cardId && el.dataset.cardId !== sourceCardId);
        if (hitEl instanceof HTMLElement && hitEl.dataset.cardId) {
          const targetId = hitEl.dataset.cardId;
          // Skip if edge already exists
          const existing = this.graph.edgesFrom(sourceCardId).find((e) => e.to === targetId);
          if (!existing) {
            this.graph.addEdge(sourceCardId, targetId);
          }
        }
      },
    };

    this.canvas.events = {
      onDoubleClickEmpty: (worldX, worldY) => {
        this.createCard(worldX, worldY);
      },
      onClickEmpty: () => {
        this.selection.clear();
        this.navigator.deselect();
      },
      onContextMenu: (screenX, screenY, worldX, worldY) => {
        showContextMenu("canvas", screenX, screenY, { worldX, worldY });
      },
    };

    this.graph.onChange = () => this.render();
    this.navigator.onNavigate = () => this.render();
    this.selection.onChange = () => this.render();
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
      updateCardElement(el, card, card.id === currentId, this.selection.has(card.id));
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
      let group = this.edgeElements.get(edge.id);
      if (!group) {
        group = createEdgeGroup();
        this.canvas.edgeLayer.appendChild(group);
        this.edgeElements.set(edge.id, group);
      }
      const fromEl = this.cardElements.get(edge.from);
      const toEl = this.cardElements.get(edge.to);
      if (fromEl && toEl) {
        updateEdgeGroup(group, fromEl, toEl, edge.from === currentId || edge.to === currentId, edge.label);
      }
    }
    for (const [id, el] of this.edgeElements) {
      if (!activeEdgeIds.has(id)) {
        el.remove();
        this.edgeElements.delete(id);
      }
    }
  }

  private editCard(cardId: string): void {
    const card = this.graph.getCard(cardId);
    const cardEl = this.cardElements.get(cardId);
    if (!card || !cardEl) return;
    startEditing(cardEl, card.text, (text) => {
      this.editor.setText(cardId, text);
    });
  }

  private createCard(worldX: number, worldY: number): void {
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
  }

  private deleteCard(cardId: string): void {
    const neighbors = this.graph.neighbors(cardId);
    this.graph.removeCard(cardId);
    if (neighbors.length > 0) {
      this.navigator.jumpTo(neighbors[0].id);
    } else {
      this.navigator.deselect();
    }
  }

  private linkCards(): void {
    const currentId = this.navigator.current?.id;
    if (!currentId) return;
    const selected = this.selection.toArray().filter((id) => id !== currentId);
    if (selected.length === 0) return;
    for (const targetId of selected) {
      const existing = this.graph.edgesFrom(currentId).find((e) => e.to === targetId);
      if (!existing) {
        this.graph.addEdge(currentId, targetId);
      }
    }
  }

  private labelEdge(): void {
    const selected = this.selection.toArray();
    if (selected.length !== 2) return;
    const [a, b] = selected;
    const edge = this.graph.edgesFrom(a).find((e) => e.to === b)
      ?? this.graph.edgesFrom(b).find((e) => e.to === a);
    if (!edge) return;

    // Find midpoint between the two cards
    const elA = this.cardElements.get(a);
    const elB = this.cardElements.get(b);
    if (!elA || !elB) return;
    const ax = parseFloat(elA.style.left) + (elA.offsetWidth || 120) / 2;
    const ay = parseFloat(elA.style.top) + (elA.offsetHeight || 40) / 2;
    const bx = parseFloat(elB.style.left) + (elB.offsetWidth || 120) / 2;
    const by = parseFloat(elB.style.top) + (elB.offsetHeight || 40) / 2;
    const mx = (ax + bx) / 2;
    const my = (ay + by) / 2;

    const input = document.createElement("input");
    input.type = "text";
    input.className = "edge-label-editor";
    input.value = edge.label ?? "";
    input.style.left = `${mx}px`;
    input.style.top = `${my}px`;
    this.canvas.cardLayer.appendChild(input);
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const value = input.value.trim();
      input.remove();
      this.graph.updateEdge(edge.id, value);
    };
    const cancel = () => {
      if (committed) return;
      committed = true;
      input.remove();
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        cancel();
      }
    });
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
