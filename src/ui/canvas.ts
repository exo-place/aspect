import { parseViewportHash, writeViewportHash } from "../viewport-hash";

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

const ZOOM_SENSITIVITY = 0.001;
const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_THRESHOLD = 5;
const VIEWPORT_SAVE_DEBOUNCE_MS = 500;

export class Canvas {
  readonly root: HTMLDivElement;
  readonly world: HTMLDivElement;
  readonly edgeLayer: SVGSVGElement;
  readonly cardLayer: HTMLDivElement;

  minZoom = 0.1;
  maxZoom = 4;

  private state: CanvasState = { panX: 0, panY: 0, zoom: 1 };
  private isPanning = false;
  private panStartX = 0;
  private panStartY = 0;
  private panOriginX = 0;
  private panOriginY = 0;
  private clickTimer: number | null = null;

  // Multi-touch pinch-to-zoom
  private activePointers = new Map<number, { x: number; y: number }>();
  private lastPinchDist = 0;
  private isPinching = false;

  // Long-press
  private longPressTimer: ReturnType<typeof setTimeout> | null = null;
  private longPressFired = false;

  // Viewport persistence
  private roomName: string | null = null;
  syncHash = false;
  private viewportSaveTimer: ReturnType<typeof setTimeout> | null = null;

  // Brush selection
  private isBrushing = false;
  private brushStartX = 0;
  private brushStartY = 0;
  private brushRect: HTMLDivElement | null = null;

  events: CanvasEvents | null = null;
  onTransformChange: (() => void) | null = null;
  onBrushSelect: ((cardIds: string[]) => void) | null = null;

  constructor(container: HTMLElement) {
    this.root = document.createElement("div");
    this.root.className = "canvas";
    this.root.setAttribute("role", "application");
    this.root.setAttribute("aria-label", "Card graph canvas");

    this.world = document.createElement("div");
    this.world.className = "world";

    this.edgeLayer = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    this.edgeLayer.classList.add("edge-layer");
    this.edgeLayer.setAttribute("aria-hidden", "true");

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

  setRoomName(name: string): void {
    this.roomName = name;
  }

  saveViewport(): void {
    if (!this.roomName) return;
    const data = { panX: this.state.panX, panY: this.state.panY, zoom: this.state.zoom };
    try {
      localStorage.setItem(`aspect:viewport:${this.roomName}`, JSON.stringify(data));
    } catch {
      // localStorage full or unavailable
    }
  }

  restoreViewport(): boolean {
    if (!this.roomName) return false;
    try {
      const raw = localStorage.getItem(`aspect:viewport:${this.roomName}`);
      if (!raw) return false;
      const data = JSON.parse(raw) as { panX: number; panY: number; zoom: number };
      if (!Number.isFinite(data.panX) || !Number.isFinite(data.panY) || !Number.isFinite(data.zoom)) return false;
      if (data.zoom <= 0) return false;
      this.state.panX = data.panX;
      this.state.panY = data.panY;
      this.state.zoom = data.zoom;
      this.applyTransform();
      return true;
    } catch {
      return false;
    }
  }

  restoreFromHash(): boolean {
    const vp = parseViewportHash();
    if (!vp) return false;
    this.state.panX = vp.panX;
    this.state.panY = vp.panY;
    this.state.zoom = vp.zoom;
    this.applyTransform();
    return true;
  }

  private debouncedSaveViewport(): void {
    if (this.viewportSaveTimer !== null) {
      clearTimeout(this.viewportSaveTimer);
    }
    this.viewportSaveTimer = setTimeout(() => {
      this.viewportSaveTimer = null;
      this.saveViewport();
      if (this.syncHash) {
        writeViewportHash(this.state.panX, this.state.panY, this.state.zoom);
      }
    }, VIEWPORT_SAVE_DEBOUNCE_MS);
  }

  private applyTransform(): void {
    this.world.style.transform =
      `translate(${this.state.panX}px, ${this.state.panY}px) scale(${this.state.zoom})`;
    this.onTransformChange?.();
    this.debouncedSaveViewport();
  }

  private bindEvents(): void {
    this.root.addEventListener("pointerdown", (e) => this.onPointerDown(e));
    this.root.addEventListener("pointermove", (e) => this.onPointerMove(e));
    this.root.addEventListener("pointerup", (e) => this.onPointerUp(e));
    this.root.addEventListener("pointercancel", (e) => this.onPointerUp(e));
    this.root.addEventListener("wheel", (e) => this.onWheel(e), { passive: false });
    this.root.addEventListener("dblclick", (e) => this.onDblClick(e));
    this.root.addEventListener("contextmenu", (e) => this.onContextMenuEvent(e));
  }

  private isCanvasTarget(target: EventTarget | null): boolean {
    return target === this.root || target === this.world || target === this.cardLayer;
  }

  private cancelLongPress(): void {
    if (this.longPressTimer !== null) {
      clearTimeout(this.longPressTimer);
      this.longPressTimer = null;
    }
  }

  private pinchDistance(): number {
    const pts = [...this.activePointers.values()];
    if (pts.length < 2) return 0;
    const dx = pts[1].x - pts[0].x;
    const dy = pts[1].y - pts[0].y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  private pinchCenter(): { x: number; y: number } {
    const pts = [...this.activePointers.values()];
    if (pts.length < 2) return { x: 0, y: 0 };
    return { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
  }

  private onPointerDown(e: PointerEvent): void {
    this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (this.activePointers.size >= 2) {
      // Start pinch — cancel any pan or long-press in progress
      this.isPanning = false;
      this.root.classList.remove("panning");
      this.cancelLongPress();
      this.isPinching = true;
      this.lastPinchDist = this.pinchDistance();
      return;
    }

    if (e.button !== 0) return;
    // Only pan when clicking directly on canvas or world (not on cards)
    if (!this.isCanvasTarget(e.target)) return;

    // Shift-click on canvas background starts brush selection
    if (e.shiftKey) {
      this.isBrushing = true;
      this.brushStartX = e.clientX;
      this.brushStartY = e.clientY;
      const rect = document.createElement("div");
      rect.className = "selection-brush";
      rect.style.left = `${e.clientX}px`;
      rect.style.top = `${e.clientY}px`;
      rect.style.width = "0px";
      rect.style.height = "0px";
      document.body.appendChild(rect);
      this.brushRect = rect;
      this.root.setPointerCapture(e.pointerId);
      return;
    }

    this.isPanning = true;
    this.panStartX = e.clientX;
    this.panStartY = e.clientY;
    this.panOriginX = this.state.panX;
    this.panOriginY = this.state.panY;
    this.root.classList.add("panning");
    this.root.setPointerCapture(e.pointerId);

    // Long-press
    this.longPressFired = false;
    this.cancelLongPress();
    const lpX = e.clientX;
    const lpY = e.clientY;
    this.longPressTimer = setTimeout(() => {
      this.longPressTimer = null;
      this.longPressFired = true;
      this.isPanning = false;
      this.root.classList.remove("panning");
      const world = this.screenToWorld(lpX, lpY);
      this.events?.onContextMenu(lpX, lpY, world.x, world.y);
    }, LONG_PRESS_MS);
  }

  private onPointerMove(e: PointerEvent): void {
    // Update tracked pointer
    if (this.activePointers.has(e.pointerId)) {
      this.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    // Brush selection
    if (this.isBrushing && this.brushRect) {
      const x = Math.min(this.brushStartX, e.clientX);
      const y = Math.min(this.brushStartY, e.clientY);
      const w = Math.abs(e.clientX - this.brushStartX);
      const h = Math.abs(e.clientY - this.brushStartY);
      this.brushRect.style.left = `${x}px`;
      this.brushRect.style.top = `${y}px`;
      this.brushRect.style.width = `${w}px`;
      this.brushRect.style.height = `${h}px`;
      return;
    }

    // Pinch-to-zoom
    if (this.isPinching && this.activePointers.size >= 2) {
      const dist = this.pinchDistance();
      if (this.lastPinchDist > 0) {
        const scale = dist / this.lastPinchDist;
        const center = this.pinchCenter();
        const rect = this.root.getBoundingClientRect();
        const cx = center.x - rect.left;
        const cy = center.y - rect.top;
        const oldZoom = this.state.zoom;
        const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, oldZoom * scale));
        this.state.panX = cx - (cx - this.state.panX) * (newZoom / oldZoom);
        this.state.panY = cy - (cy - this.state.panY) * (newZoom / oldZoom);
        this.state.zoom = newZoom;
        this.applyTransform();
      }
      this.lastPinchDist = dist;
      return;
    }

    // Cancel long-press if moved too far
    if (this.longPressTimer !== null) {
      const dx = e.clientX - this.panStartX;
      const dy = e.clientY - this.panStartY;
      if (Math.abs(dx) > LONG_PRESS_MOVE_THRESHOLD || Math.abs(dy) > LONG_PRESS_MOVE_THRESHOLD) {
        this.cancelLongPress();
      }
    }

    if (!this.isPanning) return;
    this.state.panX = this.panOriginX + (e.clientX - this.panStartX);
    this.state.panY = this.panOriginY + (e.clientY - this.panStartY);
    this.applyTransform();
  }

  private onPointerUp(e: PointerEvent): void {
    this.activePointers.delete(e.pointerId);

    // Brush selection end
    if (this.isBrushing) {
      this.isBrushing = false;
      if (this.brushRect) {
        const bw = Math.abs(e.clientX - this.brushStartX);
        const bh = Math.abs(e.clientY - this.brushStartY);
        if (bw >= 5 || bh >= 5) {
          const brushLeft = Math.min(this.brushStartX, e.clientX);
          const brushTop = Math.min(this.brushStartY, e.clientY);
          const brushRight = brushLeft + Math.abs(e.clientX - this.brushStartX);
          const brushBottom = brushTop + Math.abs(e.clientY - this.brushStartY);

          const selected: string[] = [];
          const cards = this.cardLayer.querySelectorAll<HTMLDivElement>(".card");
          for (const card of cards) {
            const cr = card.getBoundingClientRect();
            // AABB overlap test
            if (cr.right >= brushLeft && cr.left <= brushRight &&
                cr.bottom >= brushTop && cr.top <= brushBottom) {
              const id = card.dataset.cardId;
              if (id) selected.push(id);
            }
          }
          this.onBrushSelect?.(selected);
        }
        this.brushRect.remove();
        this.brushRect = null;
      }
      return;
    }

    this.cancelLongPress();

    if (this.isPinching) {
      if (this.activePointers.size < 2) {
        this.isPinching = false;
        this.lastPinchDist = 0;
      }
      return;
    }

    if (this.longPressFired) {
      this.longPressFired = false;
      this.isPanning = false;
      this.root.classList.remove("panning");
      return;
    }

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
    const newZoom = Math.min(this.maxZoom, Math.max(this.minZoom, oldZoom * (1 + delta)));

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
    if (!this.isCanvasTarget(e.target)) return;
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.events?.onDoubleClickEmpty(world.x, world.y);
  }

  private onContextMenuEvent(e: MouseEvent): void {
    if (!this.isCanvasTarget(e.target)) return;
    e.preventDefault();
    const world = this.screenToWorld(e.clientX, e.clientY);
    this.events?.onContextMenu(e.clientX, e.clientY, world.x, world.y);
  }

  resetZoom(): void {
    const rect = this.root.getBoundingClientRect();
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const oldZoom = this.state.zoom;
    const newZoom = 1;
    this.state.panX = cx - (cx - this.state.panX) * (newZoom / oldZoom);
    this.state.panY = cy - (cy - this.state.panY) * (newZoom / oldZoom);
    this.state.zoom = newZoom;
    this.applyTransform();
  }

  getViewportCenter(): { x: number; y: number } {
    const rect = this.root.getBoundingClientRect();
    return this.screenToWorld(rect.left + rect.width / 2, rect.top + rect.height / 2);
  }
}
