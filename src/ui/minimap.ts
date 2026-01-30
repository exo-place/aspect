import type { Card } from "../types";
import type { CanvasState } from "./canvas";

const MINIMAP_WIDTH = 200;
const MINIMAP_HEIGHT = 140;
const CARD_W = 4;
const CARD_H = 3;
const PADDING = 20;

export class Minimap {
  readonly el: HTMLDivElement;
  private world: HTMLDivElement;
  private viewport: HTMLDivElement;
  private zoomBadge: HTMLDivElement;
  private cardEls = new Map<string, HTMLDivElement>();

  private panX = 0;
  private panY = 0;

  onClick: ((worldX: number, worldY: number) => void) | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "minimap";
    this.el.setAttribute("role", "img");
    this.el.setAttribute("aria-label", "Canvas minimap");

    this.world = document.createElement("div");
    this.world.className = "minimap-world";

    this.viewport = document.createElement("div");
    this.viewport.className = "minimap-viewport";

    this.zoomBadge = document.createElement("div");
    this.zoomBadge.className = "minimap-zoom-badge";

    this.el.appendChild(this.world);
    this.el.appendChild(this.viewport);
    this.el.appendChild(this.zoomBadge);

    this.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.stopPropagation();
      this.handleClick(e.clientX, e.clientY);
    });
  }

  render(
    cards: Card[],
    canvasState: CanvasState,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    if (cards.length === 0) {
      this.el.style.display = "none";
      return;
    }
    this.el.style.display = "";

    // Update zoom badge
    this.zoomBadge.textContent = `${Math.round(canvasState.zoom * 100)}%`;

    // Compute bounding box of cards only
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const card of cards) {
      const w = card.width ?? 120;
      minX = Math.min(minX, card.position.x);
      minY = Math.min(minY, card.position.y);
      maxX = Math.max(maxX, card.position.x + w);
      maxY = Math.max(maxY, card.position.y + 40);
    }

    const worldW = maxX - minX + PADDING * 2;
    const worldH = maxY - minY + PADDING * 2;

    // Fit scale clamped so tiny graphs don't over-zoom
    const fitScale = Math.min(1.0, Math.min(MINIMAP_WIDTH / worldW, MINIMAP_HEIGHT / worldH));
    const scale = fitScale;

    const offsetX = (MINIMAP_WIDTH - worldW * scale) / 2;
    const offsetY = (MINIMAP_HEIGHT - worldH * scale) / 2;

    this.panX = offsetX - (minX - PADDING) * scale;
    this.panY = offsetY - (minY - PADDING) * scale;

    this.world.style.transform =
      `translate(${this.panX}px, ${this.panY}px) scale(${scale})`;

    // Reconcile card dots
    const activeIds = new Set<string>();
    for (const card of cards) {
      activeIds.add(card.id);
      let dot = this.cardEls.get(card.id);
      if (!dot) {
        dot = document.createElement("div");
        dot.className = "minimap-card";
        this.world.appendChild(dot);
        this.cardEls.set(card.id, dot);
      }
      dot.style.left = `${card.position.x}px`;
      dot.style.top = `${card.position.y}px`;
      dot.style.width = `${CARD_W / scale}px`;
      dot.style.height = `${CARD_H / scale}px`;
    }
    for (const [id, dot] of this.cardEls) {
      if (!activeIds.has(id)) {
        dot.remove();
        this.cardEls.delete(id);
      }
    }

    // Position viewport indicator
    const vpLeft = -canvasState.panX / canvasState.zoom;
    const vpTop = -canvasState.panY / canvasState.zoom;
    const vw = viewportWidth / canvasState.zoom;
    const vh = viewportHeight / canvasState.zoom;
    this.viewport.style.left = `${this.panX + vpLeft * scale}px`;
    this.viewport.style.top = `${this.panY + vpTop * scale}px`;
    this.viewport.style.width = `${vw * scale}px`;
    this.viewport.style.height = `${vh * scale}px`;
  }

  private handleClick(clientX: number, clientY: number): void {
    const rect = this.el.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // Reverse the transform to get world coordinates
    // screen = panX + worldX * scale  =>  worldX = (screen - panX) / scale
    const transform = this.world.style.transform;
    const scaleMatch = transform.match(/scale\(([^)]+)\)/);
    const scale = scaleMatch ? parseFloat(scaleMatch[1]) : 1;

    const worldX = (mx - this.panX) / scale;
    const worldY = (my - this.panY) / scale;

    this.onClick?.(worldX, worldY);
  }
}
