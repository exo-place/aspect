export interface CanvasState {
  panX: number;
  panY: number;
  zoom: number;
}

export interface CanvasEvents {
  onDoubleClickEmpty(worldX: number, worldY: number): void;
  onClickEmpty(): void;
  onContextMenu(screenX: number, screenY: number, worldX: number, worldY: number): void;
}

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 4;
const ZOOM_SENSITIVITY = 0.001;

export class Canvas {
  readonly root: HTMLDivElement;
  readonly world: HTMLDivElement;
  readonly edgeLayer: SVGSVGElement;
  readonly cardLayer: HTMLDivElement;

  private state: CanvasState = { panX: 0, panY: 0, zoom: 1 };
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private clickTimer: number | null = null;

  events: CanvasEvents | null = null;
  onTransformChange: (() => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "canvas";

    this.world = document.createElement("div");
    this.world.className = "world";

    this.edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.edgeLayer.classList.add("edge-layer");

    this.cardLayer = document.createElement("div");
    this.cardLayer.className = "card-layer";

    this.world.appendChild(this.edgeLayer);
    this.world.appendChild(this.cardLayer);
    this.root.appendChild(this.world);
    container.appendChild(this.root);

    this.bindEvents();
    this.applyTransform();
  }

  screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const rect = this.root.getBoundingClientRect();
    return {
      x: (screenX - rect.left - this.state.panX) / this.state.zoom,
      y: (screenY - rect.top - this.state.panY) / this.state.zoom,
    };
  }

  getState(): CanvasState {
    return { ...this.state };
  }

  centerOn(x: number, y: number): void {
    const rect = this.root.getBoundingClientRect();
    this.state.panX = rect.width / 2 - x * this.state.zoom;
    this.state.panY = rect.height / 2 - y * this.state.zoom;
    this.applyTransform();
  }

  getViewportSize(): { width: number; height: number } {
    const rect = this.root.getBoundingClientRect();
    return { width: rect.width, height: rect.height };
  }

  private applyTransform(): void {
    this.world.style.transform =
      `translate(${this.state.panX}px, ${this.state.panY}px) scale(${this.state.zoom})`;
    this.onTransformChange?.();
  }

  private bindEvents(): void {
    this.root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.root.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.root.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.root.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    this.root.addEventListener("dblclick", (e) => this.onDblClick(e));
    this.root.addEventListener("contextmenu", (e) => this.onContextMenuEvent(e));
  }

  private onPointerDown(e: PointerEvent): void {
    if (e.button !== 0) return;
    // Only pan when clicking directly on canvas or world (not on cards)
    const target = e.target as HTMLElement;
    if (target !== this.root && target !== this.world && target !== this.cardLayer) return;
    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.panOriginX = this.state.panX;
    this.panOriginY = this.state.panY;
    this.root.classList.add("panning");
    this.root.setPointerCapture(e.pointerId);
  }

  private onPointerMove(e: PointerEvent): void {
    if (!this.isPanning) return;
    this.state.panX = this.panOriginX + (e.clientX - this.panStartX);
    this.state.panY = this.panOriginY + (e.clientY - this.panStartY);
    this.applyTransform();
  }

  private onPointerUp(e: PointerEvent): void {
    if (this.isPanning) {
      const dx = e.clientX - this.panStartX;
      const dy = e.clientY - this.panStartY;
      if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
        this.clickTimer = requestAnimationFrame(() => {
          this.clickTimer = null;
          this.events?.onClickEmpty();
        });
      }
    }
    this.isPanning = false;
    this.root.classList.remove("panning");
  }

  private onWheel(e: WheelEvent): void {
    e.preventDefault();
    const rect = this.root.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    const oldZoom = this.state.zoom;
    const delta = -e.deltaY * ZOOM_SENSITIVITY;
    const newZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, oldZoom * (1 + delta)));

    // Zoom toward cursor
    this.state.panX = mouseX - (mouseX - this.state.panX) * (newZoom / oldZoom);
    this.state.panY = mouseY - (mouseY - this.state.panY) * (newZoom / oldZoom);
    this.state.zoom = newZoom;

    this.applyTransform();
  }

  private onDblClick(e: MouseEvent): void {
    if (this.clickTimer !== null) {
      cancelAnimationFrame(this.clickTimer);
      this.clickTimer = null;
    }
    const target = e.target as HTMLElement;
    if (target !== this.root && target !== this.world && target !== this.cardLayer) return;
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.events?.onDoubleClickEmpty(world.x, world.y);
  }

  private onContextMenuEvent(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (target !== this.root && target !== this.world && target !== this.cardLayer) return;
    e.preventDefault();
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.events?.onContextMenu(e.clientX, e.clientY, world.x, world.y);
  }

  getViewportCenter(): { x: number; y: number } {
    const rect = this.root.getBoundingClientRect();
    return this.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
}
