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
  private controls: HTMLDivElement;
  private zoomLabel: HTMLSpanElement;
  private cardEls = new Map<string, HTMLDivElement>();

  private zoom = 1;
  private panX = 0;
  private panY = 0;
  private currentScale = 1;
  private isDragging = false;

  // Frozen layout state during drag — prevents bbox recomputation
  private frozenPanX = 0;
  private frozenPanY = 0;
  private frozenScale = 1;

  // Cached render args for re-render on zoom change
  private lastCards: Card[] = [];
  private lastCanvasState: CanvasState = { panX: 0, panY: 0, zoom: 1 };
  private lastVpWidth = 0;
  private lastVpHeight = 0;

  onClick: ((worldX: number, worldY: number) => void) | null = null;
  onDrag: ((worldX: number, worldY: number) => void) | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "minimap";
    this.el.setAttribute("role", "img");
    this.el.setAttribute("aria-label", "Canvas minimap");

    this.world = document.createElement("div");
    this.world.className = "minimap-world";

    this.viewport = document.createElement("div");
    this.viewport.className = "minimap-viewport";

    // Zoom controls bar
    this.controls = document.createElement("div");
    this.controls.className = "minimap-controls";

    const minusBtn = document.createElement("button");
    minusBtn.className = "minimap-ctrl-btn";
    minusBtn.textContent = "\u2212";
    minusBtn.setAttribute("aria-label", "Zoom out minimap");
    minusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.zoom = Math.max(0.1, this.zoom * 0.8);
      this.rerender();
    });

    this.zoomLabel = document.createElement("span");
    this.zoomLabel.className = "minimap-zoom-label";
    this.updateZoomLabel();

    const plusBtn = document.createElement("button");
    plusBtn.className = "minimap-ctrl-btn";
    plusBtn.textContent = "+";
    plusBtn.setAttribute("aria-label", "Zoom in minimap");
    plusBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      this.zoom = Math.min(10, this.zoom * 1.25);
      this.rerender();
    });

    this.controls.appendChild(minusBtn);
    this.controls.appendChild(this.zoomLabel);
    this.controls.appendChild(plusBtn);

    this.el.appendChild(this.world);
    this.el.appendChild(this.viewport);
    this.el.appendChild(this.controls);

    this.el.addEventListener("wheel", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const delta = -e.deltaY * 0.002;
      this.zoom = Math.min(10, Math.max(0.1, this.zoom * (1 + delta)));
      this.rerender();
    }, { passive: false });

    this.el.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      // Don't start drag from control buttons
      if ((e.target as HTMLElement).closest(".minimap-controls")) return;
      e.stopPropagation();
      this.isDragging = true;
      // Freeze layout so bbox doesn't recompute during drag
      this.frozenPanX = this.panX;
      this.frozenPanY = this.panY;
      this.frozenScale = this.currentScale;
      this.el.setPointerCapture(e.pointerId);
      this.navigateTo(e.clientX, e.clientY);
    });

    this.el.addEventListener("pointermove", (e) => {
      if (!this.isDragging) return;
      this.navigateTo(e.clientX, e.clientY);
    });

    this.el.addEventListener("pointerup", (e) => {
      if (!this.isDragging) return;
      this.isDragging = false;
      this.el.releasePointerCapture(e.pointerId);
    });

    this.el.addEventListener("pointercancel", (e) => {
      this.isDragging = false;
      this.el.releasePointerCapture(e.pointerId);
    });
  }

  render(
    cards: Card[],
    canvasState: CanvasState,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    // Cache for re-render on zoom
    this.lastCards = cards;
    this.lastCanvasState = canvasState;
    this.lastVpWidth = viewportWidth;
    this.lastVpHeight = viewportHeight;

    if (this.isDragging) {
      // During drag: only update the viewport rect position, don't recompute layout
      this.updateViewportOnly(canvasState, viewportWidth, viewportHeight);
      return;
    }

    this.renderInternal(cards, canvasState, viewportWidth, viewportHeight);
  }

  private rerender(): void {
    this.updateZoomLabel();
    this.renderInternal(
      this.lastCards,
      this.lastCanvasState,
      this.lastVpWidth,
      this.lastVpHeight,
    );
  }

  private updateZoomLabel(): void {
    this.zoomLabel.textContent = `${Math.round(this.zoom * 100)}%`;
  }

  private renderInternal(
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

    // Compute bounding box of all cards
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (const card of cards) {
      const w = card.width ?? 120;
      minX = Math.min(minX, card.position.x);
      minY = Math.min(minY, card.position.y);
      maxX = Math.max(maxX, card.position.x + w);
      maxY = Math.max(maxY, card.position.y + 40);
    }

    // Include viewport bounds in the bounding box
    const vpLeft = -canvasState.panX / canvasState.zoom;
    const vpTop = -canvasState.panY / canvasState.zoom;
    const vpRight = vpLeft + viewportWidth / canvasState.zoom;
    const vpBottom = vpTop + viewportHeight / canvasState.zoom;
    minX = Math.min(minX, vpLeft);
    minY = Math.min(minY, vpTop);
    maxX = Math.max(maxX, vpRight);
    maxY = Math.max(maxY, vpBottom);

    const worldW = maxX - minX + PADDING * 2;
    const worldH = maxY - minY + PADDING * 2;

    // Fit scale
    const fitScale = Math.min(MINIMAP_WIDTH / worldW, MINIMAP_HEIGHT / worldH);
    const scale = fitScale * this.zoom;
    this.currentScale = scale;

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
    const vw = viewportWidth / canvasState.zoom;
    const vh = viewportHeight / canvasState.zoom;
    this.viewport.style.left = `${this.panX + vpLeft * scale}px`;
    this.viewport.style.top = `${this.panY + vpTop * scale}px`;
    this.viewport.style.width = `${vw * scale}px`;
    this.viewport.style.height = `${vh * scale}px`;
  }

  private updateViewportOnly(
    canvasState: CanvasState,
    viewportWidth: number,
    viewportHeight: number,
  ): void {
    const scale = this.frozenScale;
    const vpLeft = -canvasState.panX / canvasState.zoom;
    const vpTop = -canvasState.panY / canvasState.zoom;
    const vw = viewportWidth / canvasState.zoom;
    const vh = viewportHeight / canvasState.zoom;
    this.viewport.style.left = `${this.frozenPanX + vpLeft * scale}px`;
    this.viewport.style.top = `${this.frozenPanY + vpTop * scale}px`;
    this.viewport.style.width = `${vw * scale}px`;
    this.viewport.style.height = `${vh * scale}px`;
  }

  private navigateTo(clientX: number, clientY: number): void {
    const rect = this.el.getBoundingClientRect();
    const mx = clientX - rect.left;
    const my = clientY - rect.top;

    // During drag, use frozen layout so coordinates are stable
    const usePanX = this.isDragging ? this.frozenPanX : this.panX;
    const usePanY = this.isDragging ? this.frozenPanY : this.panY;
    const useScale = this.isDragging ? this.frozenScale : this.currentScale;

    const worldX = (mx - usePanX) / useScale;
    const worldY = (my - usePanY) / useScale;

    if (this.isDragging) {
      this.onDrag?.(worldX, worldY);
    } else {
      this.onClick?.(worldX, worldY);
    }
  }
}
