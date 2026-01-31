import type { TileNode, TileSplit, TileLeaf, TileLayoutEvents } from "../tile-types";
import type { ProjectionData } from "../projection-types";
import type { BreadcrumbEntry } from "./projection-view";
import { ProjectionView } from "./projection-view";

export interface TilePaneData {
  projection: ProjectionData | null;
  breadcrumbs: BreadcrumbEntry[];
  meLabel: string;
  meIcon?: string;
  isHome: boolean;
}

export class TileLayout {
  readonly el: HTMLDivElement;
  private events: TileLayoutEvents;
  private panes = new Map<string, ProjectionView>();
  private tree: TileNode | null = null;

  constructor(events: TileLayoutEvents) {
    this.events = events;
    this.el = document.createElement("div");
    this.el.className = "tile-layout";
  }

  setTree(tree: TileNode | null): void {
    this.tree = tree;
    this.rebuild();
  }

  renderPane(paneId: string, data: TilePaneData): void {
    const view = this.panes.get(paneId);
    if (!view) return;
    view.render(
      data.projection,
      data.breadcrumbs.length > 1 ? data.breadcrumbs : undefined,
      (index) => this.events.onBreadcrumb(paneId, index),
    );
  }

  private rebuild(): void {
    this.el.innerHTML = "";
    const usedPaneIds = new Set<string>();
    if (this.tree) {
      const dom = this.buildNode(this.tree, usedPaneIds);
      this.el.appendChild(dom);
    }
    // Clean up pane views no longer in tree
    for (const [id] of this.panes) {
      if (!usedPaneIds.has(id)) this.panes.delete(id);
    }
  }

  private buildNode(node: TileNode, usedIds: Set<string>): HTMLElement {
    if (node.type === "leaf") return this.buildLeaf(node, usedIds);
    return this.buildSplit(node, usedIds);
  }

  private buildLeaf(leaf: TileLeaf, usedIds: Set<string>): HTMLElement {
    usedIds.add(leaf.id);

    const pane = document.createElement("div");
    pane.className = "tile-pane";
    pane.dataset.paneId = leaf.id;

    // Header
    const header = document.createElement("div");
    header.className = "tile-pane-header";

    const name = document.createElement("span");
    name.className = "tile-pane-header-name";
    // Will be updated when renderPane is called
    pane.appendChild(header);

    // Home button (visible when navigated away)
    const homeBtn = document.createElement("button");
    homeBtn.className = "tile-pane-header-btn";
    homeBtn.textContent = "\u2302";
    homeBtn.title = "Go home";
    homeBtn.addEventListener("click", () => {
      this.events.onBreadcrumb(leaf.id, 0);
    });

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "tile-pane-header-btn";
    closeBtn.textContent = "\u00D7";
    closeBtn.title = "Close";
    closeBtn.addEventListener("click", () => {
      this.events.onClose(leaf.id);
    });

    header.appendChild(name);
    header.appendChild(homeBtn);
    header.appendChild(closeBtn);

    // Body with ProjectionView
    const body = document.createElement("div");
    body.className = "tile-pane-body";

    let view = this.panes.get(leaf.id);
    if (!view) {
      view = new ProjectionView({
        onNavigate: () => {},
        onEditText: (cardId, newText) => {
          this.events.onEditText(cardId, newText);
        },
        onAffordance: (actionId, targetCardId) => {
          this.events.onAffordance(leaf.id, actionId, targetCardId);
        },
        onToggleExpand: (cardId) => {
          this.events.onToggleExpand(leaf.id, cardId);
        },
        onDrillDown: (cardId) => {
          this.events.onDrillDown(leaf.id, cardId);
        },
      });
      this.panes.set(leaf.id, view);
    }
    body.appendChild(view.el);
    pane.appendChild(body);

    return pane;
  }

  private buildSplit(split: TileSplit, usedIds: Set<string>): HTMLElement {
    const container = document.createElement("div");
    container.className = `tile-split tile-split--${split.direction}`;

    const childA = document.createElement("div");
    childA.className = "tile-child";
    childA.style.flex = String(split.ratio);
    childA.appendChild(this.buildNode(split.a, usedIds));

    const divider = document.createElement("div");
    divider.className = "tile-divider";

    const childB = document.createElement("div");
    childB.className = "tile-child";
    childB.style.flex = String(1 - split.ratio);
    childB.appendChild(this.buildNode(split.b, usedIds));

    container.appendChild(childA);
    container.appendChild(divider);
    container.appendChild(childB);

    // Divider drag
    let dragging = false;

    divider.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      dragging = true;
      divider.setPointerCapture(e.pointerId);
    });

    divider.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const rect = container.getBoundingClientRect();
      let ratio: number;
      if (split.direction === "horizontal") {
        ratio = (e.clientX - rect.left) / rect.width;
      } else {
        ratio = (e.clientY - rect.top) / rect.height;
      }
      ratio = Math.max(0.1, Math.min(0.9, ratio));
      childA.style.flex = String(ratio);
      childB.style.flex = String(1 - ratio);
    });

    divider.addEventListener("pointerup", (e) => {
      if (!dragging) return;
      dragging = false;
      const rect = container.getBoundingClientRect();
      let ratio: number;
      if (split.direction === "horizontal") {
        ratio = (e.clientX - rect.left) / rect.width;
      } else {
        ratio = (e.clientY - rect.top) / rect.height;
      }
      ratio = Math.max(0.1, Math.min(0.9, ratio));
      // Notify tree to commit ratio — re-render will pick it up
      // For now, just update DOM directly; the tree will be resized via app
      childA.style.flex = String(ratio);
      childB.style.flex = String(1 - ratio);
    });

    return container;
  }

  /** Update pane header to reflect me card identity. */
  updatePaneHeader(paneId: string, meLabel: string, meIcon?: string, isHome?: boolean): void {
    const paneEl = this.el.querySelector(`[data-pane-id="${paneId}"]`);
    if (!paneEl) return;
    const header = paneEl.querySelector(".tile-pane-header");
    if (!header) return;
    const nameEl = header.querySelector(".tile-pane-header-name");
    if (nameEl) {
      nameEl.textContent = meIcon ? `${meIcon} ${meLabel}` : meLabel;
    }
    const homeBtn = header.querySelectorAll(".tile-pane-header-btn")[0] as HTMLElement | undefined;
    if (homeBtn) {
      homeBtn.style.display = isHome === false ? "" : "none";
    }
  }
}
