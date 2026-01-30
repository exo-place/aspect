import { CardGraph } from "../graph";
import { Navigator } from "../navigator";
import { Editor } from "../editor";
import { Selection } from "../selection";
import { History } from "../history";
import type { Presence } from "../presence";
import type { WorldPackStore } from "../pack";
import { DEFAULT_PACK } from "../default-pack";
import { resolveEdgeToggle } from "../edge-toggle";
import { Canvas } from "./canvas";
import { TabBar } from "./tab-bar";
import type { TabMode } from "./tab-bar";
import { ProjectionView } from "./projection-view";
import { buildProjectionData } from "../projection";
import { buildAffordances, getAffordancesForCard } from "../affordance";
import { EventLog } from "../event-log";
import { executeAction } from "../action";
import { createCardElement, updateCardElement, startEditing } from "./card-node";
import type { CardNodeEvents } from "./card-node";
import { createEdgeGroup, updateEdgeGroup, ensureArrowDefs } from "./edge-line";
import { renderPresenceDots } from "./presence-dots";
import { PresencePanel } from "./presence-panel";
import { setupKeybinds } from "./keybinds";
import { SearchOverlay } from "./search";
import { showKindPicker } from "./kind-picker";
import { showEdgeTypePicker, autoResolveEdgeType } from "./edge-type-picker";
import { Minimap } from "./minimap";
import { SettingsPanel } from "./settings-panel";
import { PackInfoPanel } from "./pack-info-panel";
import { SettingsStore } from "../settings";
import type { EdgeStyle } from "./edge-line";
import type { YDocBundle } from "../ydoc";
import { downloadJSON, uploadJSON } from "../file-io";
import { exportSnapshot, validateSnapshot, importSnapshotReplace } from "../snapshot";
import { validateWorldPack } from "../pack-validate";

export class App {
  private tabBar: TabBar;
  private canvas: Canvas;
  private graph: CardGraph;
  private navigator: Navigator;
  private editor: Editor;
  private selection: Selection;
  private history: History;
  private search: SearchOverlay;
  private presence: Presence;
  private presencePanel: PresencePanel;
  private packStore: WorldPackStore;
  private settings: SettingsStore;
  private settingsPanel: SettingsPanel;
  private cardElements = new Map<string, HTMLDivElement>();
  private edgeElements = new Map<string, SVGGElement>();
  private minimap: Minimap;
  private cardEvents: CardNodeEvents;
  private ghostEdge: SVGLineElement | null = null;
  private ghostEdgeSource: string | null = null;
  private liveRegion: HTMLDivElement;
  private packInfoPanel: PackInfoPanel;
  private mode: TabMode = "graph";
  private projectionView: ProjectionView;
  private eventLog: EventLog;
  private container: HTMLElement;

  constructor(container: HTMLElement, graph: CardGraph, bundle: YDocBundle, presence: Presence, packStore: WorldPackStore, roomName?: string) {
    this.container = container;
    this.graph = graph;
    this.navigator = new Navigator(graph);
    this.editor = new Editor(graph);
    this.selection = new Selection();
    this.history = new History(bundle);
    this.tabBar = new TabBar();
    container.appendChild(this.tabBar.el);
    this.canvas = new Canvas(container);
    if (roomName) {
      this.canvas.setRoomName(roomName);
    }
    this.eventLog = new EventLog(bundle);
    this.projectionView = new ProjectionView({
      onNavigate: (cardId) => {
        this.navigator.jumpTo(cardId);
        this.selection.set(cardId);
      },
      onEditText: (cardId, newText) => {
        this.history.capture();
        this.editor.setText(cardId, newText);
      },
      onAffordance: (actionId, targetCardId) => {
        this.executeAffordance(actionId, targetCardId);
      },
    });
    container.appendChild(this.projectionView.el);
    this.projectionView.el.style.display = "none";
    this.tabBar.onModeChange = (mode) => this.setMode(mode);
    this.tabBar.onSettingsClick = () => {
      if (this.settingsPanel.isOpen) {
        this.settingsPanel.close();
      } else {
        this.settingsPanel.open();
      }
    };
    this.presence = presence;
    this.packStore = packStore;
    this.presencePanel = new PresencePanel(
      container,
      presence,
      (cardId) => this.graph.getCard(cardId)?.text ?? "",
    );
    this.search = new SearchOverlay(
      () => this.graph.allCards(),
      {
        onJump: (cardId) => {
          const card = this.graph.getCard(cardId);
          if (!card) return;
          this.navigator.jumpTo(cardId);
          this.selection.set(cardId);
          this.canvas.centerOn(card.position.x, card.position.y);
        },
        onClose: () => {},
      },
    );
    this.settings = new SettingsStore();
    this.settingsPanel = new SettingsPanel(this.settings);
    this.packInfoPanel = new PackInfoPanel(this.packStore, {
      onImportPack: () => this.importPack(),
      onExportPack: () => this.exportPack(),
    });

    // Live region for screen reader announcements
    this.liveRegion = document.createElement("div");
    this.liveRegion.setAttribute("aria-live", "polite");
    this.liveRegion.setAttribute("role", "status");
    this.liveRegion.className = "sr-live-region";
    container.appendChild(this.liveRegion);

    // Apply initial settings
    this.canvas.minZoom = this.settings.get("minZoom");
    this.canvas.maxZoom = this.settings.get("maxZoom");

    this.settings.addEventListener("change", ((e: CustomEvent) => {
      const { key } = e.detail as { key: string; value: unknown };
      switch (key) {
        case "edgeStyle":
          this.renderEdges();
          break;
        case "showMinimap":
          this.minimap.el.style.display = this.settings.get("showMinimap") ? "" : "none";
          break;
        case "minZoom":
          this.canvas.minZoom = this.settings.get("minZoom");
          break;
        case "maxZoom":
          this.canvas.maxZoom = this.settings.get("maxZoom");
          break;
      }
    }) as EventListener);

    ensureArrowDefs(this.canvas.edgeLayer);

    this.canvas.edgeLayer.addEventListener("dblclick", (e) => {
      const target = e.target as Element;
      if (!target.classList.contains("edge-label")) return;
      const g = target.closest("g");
      const edgeId = g?.dataset.edgeId;
      if (edgeId) this.labelEdgeById(edgeId);
    });

    this.minimap = new Minimap();
    container.appendChild(this.minimap.el);
    if (!this.settings.get("showMinimap")) {
      this.minimap.el.style.display = "none";
    }
    this.minimap.onClick = (worldX, worldY) => {
      this.canvas.centerOn(worldX, worldY);
    };
    this.minimap.onDrag = (worldX, worldY) => {
      this.canvas.centerOn(worldX, worldY);
    };
    this.presencePanel.onZoomIn = () => this.canvas.zoomBy(1.25);
    this.presencePanel.onZoomOut = () => this.canvas.zoomBy(0.8);
    this.canvas.onTransformChange = () => {
      this.renderMinimap();
      this.presencePanel.setZoom(this.canvas.getState().zoom);
    };

    const { showContextMenu } = setupKeybinds({
      deleteCards: () => this.deleteCards(),
      editCard: (cardId) => this.editCard(cardId),
      setKind: (cardId) => this.showKindPicker(cardId),
      setEdgeType: () => this.showEdgeTypePickerForSelection(),
      createCard: (worldX, worldY) => this.createCard(worldX, worldY),
      linkCards: () => this.linkCards(),
      unlinkCards: () => this.unlinkCards(),
      labelEdge: () => this.labelEdge(),
      undo: () => this.history.undo(),
      redo: () => this.history.redo(),
      resetZoom: () => this.canvas.resetZoom(),
      navigateDirection: (dir) => this.navigateDirection(dir),
      search: () => this.search.open(),
      openSettings: () => {
        if (this.settingsPanel.isOpen) {
          this.settingsPanel.close();
        } else {
          this.settingsPanel.open();
        }
      },
      openPackInfo: () => {
        if (this.packInfoPanel.isOpen) {
          this.packInfoPanel.close();
        } else {
          this.packInfoPanel.open();
        }
      },
      cycleMode: () => {
        this.setMode(this.mode === "graph" ? "projection" : "graph");
      },
      exportGraph: () => this.exportGraph(),
      importGraph: () => this.importGraph(),
      exportPack: () => this.exportPack(),
      importPack: () => this.importPack(),
      deselect: () => {
        this.selection.clear();
        this.navigator.deselect();
      },
      getCurrentCardId: () => this.navigator.current?.id ?? null,
      getSelectedCount: () => this.selection.size,
      getViewportCenter: () => this.canvas.getViewportCenter(),
      isSettingsOpen: () => this.settingsPanel.isOpen,
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
          this.history.capture();
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
          this.history.capture();
          this.editor.setPosition(cardId, {
            x: parseFloat(el.style.left),
            y: parseFloat(el.style.top),
          });
        }
      },
      onResize: (cardId, width) => {
        this.history.capture();
        this.graph.setWidth(cardId, width < 0 ? null : width);
      },
      onEdgeDragStart: (sourceCardId) => {
        this.ghostEdgeSource = sourceCardId;
        const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
        line.classList.add("edge-line", "ghost");
        line.setAttribute("marker-end", "url(#arrow-ghost)");
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

        // Find the card under the drop point
        const hitEl = document.elementsFromPoint(screenX, screenY)
          .find((el) => el instanceof HTMLElement && el.dataset.cardId && el.dataset.cardId !== sourceCardId);
        if (!(hitEl instanceof HTMLElement) || !hitEl.dataset.cardId) return;

        const targets = new Set([hitEl.dataset.cardId]);
        // Also include selected cards (except source and drop target)
        for (const id of this.selection.toArray()) {
          if (id !== sourceCardId) targets.add(id);
        }

        const targetArr = [...targets];
        const action = resolveEdgeToggle(
          sourceCardId, targetArr,
          (a, b) => !!this.graph.directEdge(a, b),
        );

        this.history.capture();
        if (action === "link") {
          for (const targetId of targetArr) {
            this.graph.addEdge(sourceCardId, targetId);
          }
          // Show edge type picker if pack has edge types
          if (targetArr.length === 1) {
            this.maybeShowEdgeTypePicker(sourceCardId, targetArr[0], screenX, screenY);
          }
        } else {
          for (const targetId of targetArr) {
            const edge = this.graph.directEdge(sourceCardId, targetId);
            if (edge) this.graph.removeEdge(edge.id);
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

    this.canvas.onBrushSelect = (cardIds) => {
      this.selection.clear();
      for (const id of cardIds) {
        this.selection.toggle(id);
      }
      if (cardIds.length > 0 && !this.navigator.current) {
        this.navigator.jumpTo(cardIds[0]);
      }
    };

    this.graph.onChange = () => this.renderActiveMode();
    this.navigator.onNavigate = (card) => {
      this.presence.setCurrentCard(card?.id ?? null);
      if (card) {
        this.announce(`Navigated to ${card.text || "empty card"}`);
      }
      this.renderActiveMode();
    };
    this.selection.onChange = () => this.renderActiveMode();
    this.presence.onChange = () => this.renderPresence();
    this.packStore.onChange = () => this.renderActiveMode();
  }

  get nav(): Navigator {
    return this.navigator;
  }

  private announce(message: string): void {
    this.liveRegion.textContent = message;
  }

  setMode(mode: TabMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.tabBar.setMode(mode);
    if (mode === "graph") {
      this.canvas.root.style.display = "";
      this.projectionView.el.style.display = "none";
      this.minimap.el.style.display = this.settings.get("showMinimap") ? "" : "none";
      this.presencePanel.show();
      this.render();
    } else {
      this.canvas.root.style.display = "none";
      this.projectionView.el.style.display = "";
      this.minimap.el.style.display = "none";
      this.presencePanel.hide();
      this.renderProjection();
    }
  }

  getMode(): TabMode {
    return this.mode;
  }

  private renderActiveMode(): void {
    if (this.mode === "graph") {
      this.render();
    } else {
      this.renderProjection();
    }
  }

  private renderProjection(): void {
    const currentId = this.navigator.current?.id ?? null;
    const data = currentId ? buildProjectionData(currentId, this.graph, this.packStore) : null;
    if (data) {
      const affordances = buildAffordances(data.cardId, this.graph, this.packStore);
      const connectedIds = new Set(data.panels.flatMap((p) => p.items.map((i) => i.cardId)));
      for (const panel of data.panels) {
        for (const item of panel.items) {
          const itemAffs = getAffordancesForCard(affordances, item.cardId);
          if (itemAffs.length > 0) item.affordances = itemAffs;
        }
      }
      const extra = affordances.filter((a) => !connectedIds.has(a.targetCardId));
      if (extra.length > 0) data.extraAffordances = extra;
    }
    this.projectionView.render(data);
    this.renderProjectionPresence();
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
      const kindDef = card.kind ? this.packStore.getKind(card.kind) : undefined;
      updateCardElement(el, card, card.id === currentId, this.selection.has(card.id), kindDef);
      renderPresenceDots(el, this.presence.getPeersOnCard(card.id));
    }
    for (const [id, el] of this.cardElements) {
      if (!activeCardIds.has(id)) {
        el.remove();
        this.cardElements.delete(id);
      }
    }

    this.renderEdges();
    this.renderMinimap();
    this.presencePanel.render();
  }

  private renderPresence(): void {
    if (this.mode === "projection") {
      this.renderProjectionPresence();
      return;
    }
    for (const [cardId, el] of this.cardElements) {
      renderPresenceDots(el, this.presence.getPeersOnCard(cardId));
    }
    this.presencePanel.render();
  }

  private renderProjectionPresence(): void {
    const currentId = this.navigator.current?.id ?? null;
    if (!currentId) {
      this.projectionView.renderPresence([]);
      return;
    }
    this.projectionView.renderPresence(this.presence.getPeersOnCard(currentId));
  }

  private executeAffordance(actionId: string, targetCardId: string): void {
    const contextId = this.navigator.current?.id;
    if (!contextId) return;
    const action = this.packStore.getAction(actionId);
    if (!action) return;
    this.history.capture();
    const actor = this.presence.getLocalIdentity().name;
    executeAction(action, this.graph, this.packStore, contextId, targetCardId, this.eventLog, actor);
  }

  private renderMinimap(): void {
    const cards = this.graph.allCards();
    const state = this.canvas.getState();
    const vp = this.canvas.getViewportSize();
    this.minimap.render(cards, state, vp.width, vp.height);
  }


  private renderEdges(): void {
    const currentId = this.navigator.current?.id ?? null;
    const allEdges = this.graph.allEdges();
    const edgeStyle = this.settings.get("edgeStyle") as EdgeStyle;

    // Detect paired edges (A→B and B→A both exist)
    const edgeKeys = new Set<string>();
    for (const edge of allEdges) {
      edgeKeys.add(`${edge.from}:${edge.to}`);
    }
    const pairedKeys = new Set<string>();
    for (const edge of allEdges) {
      if (edgeKeys.has(`${edge.to}:${edge.from}`)) {
        pairedKeys.add(`${edge.from}:${edge.to}`);
      }
    }

    const activeEdgeIds = new Set<string>();
    for (const edge of allEdges) {
      activeEdgeIds.add(edge.id);
      let group = this.edgeElements.get(edge.id);
      if (!group) {
        group = createEdgeGroup(edge.id);
        this.canvas.edgeLayer.appendChild(group);
        this.edgeElements.set(edge.id, group);
      }
      const fromEl = this.cardElements.get(edge.from);
      const toEl = this.cardElements.get(edge.to);
      if (fromEl && toEl) {
        const isPaired = pairedKeys.has(`${edge.from}:${edge.to}`);
        updateEdgeGroup(group, fromEl, toEl, edge.from === currentId || edge.to === currentId, edge.label, edgeStyle, isPaired ? 8 : 0);
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
      this.history.capture();
      this.editor.setText(cardId, text);
    });
  }

  private showKindPicker(cardId: string): void {
    const cardEl = this.cardElements.get(cardId);
    if (!cardEl) return;
    const card = this.graph.getCard(cardId);
    if (!card) return;

    const pack = this.packStore.get();
    if (!pack) return;

    const rect = cardEl.getBoundingClientRect();
    showKindPicker(
      rect.left,
      rect.bottom + 4,
      card.kind,
      pack.kinds,
      (kindId) => {
        this.history.capture();
        this.graph.setKind(cardId, kindId);
      },
    );
  }

  private maybeShowEdgeTypePicker(fromId: string, toId: string, anchorX: number, anchorY: number): void {
    const pack = this.packStore.get();
    if (!pack || pack.edgeTypes.length === 0) return;

    const edge = this.graph.directEdge(fromId, toId);
    if (!edge) return;

    const fromCard = this.graph.getCard(fromId);
    const toCard = this.graph.getCard(toId);
    const sourceKind = fromCard?.kind;
    const targetKind = toCard?.kind;

    // Auto-apply if only one valid type
    const auto = autoResolveEdgeType(pack.edgeTypes, sourceKind, targetKind, this.packStore);
    if (auto) {
      this.history.capture();
      this.graph.setEdgeType(edge.id, auto.id);
      return;
    }

    showEdgeTypePicker(
      anchorX,
      anchorY,
      edge.type,
      pack.edgeTypes,
      sourceKind,
      targetKind,
      this.packStore,
      (typeId) => {
        this.history.capture();
        this.graph.setEdgeType(edge.id, typeId);
      },
    );
  }

  private showEdgeTypePickerForSelection(): void {
    const selected = this.selection.toArray();
    if (selected.length !== 2) return;
    const [a, b] = selected;
    const edge = this.graph.edgesFrom(a).find((e) => e.to === b)
      ?? this.graph.edgesFrom(b).find((e) => e.to === a);
    if (!edge) return;

    const pack = this.packStore.get();
    if (!pack || pack.edgeTypes.length === 0) return;

    // Anchor near the midpoint of the two cards
    const elA = this.cardElements.get(edge.from);
    const elB = this.cardElements.get(edge.to);
    if (!elA || !elB) return;
    const rectA = elA.getBoundingClientRect();
    const rectB = elB.getBoundingClientRect();
    const anchorX = (rectA.left + rectB.left) / 2;
    const anchorY = (rectA.bottom + rectB.bottom) / 2;

    const fromCard = this.graph.getCard(edge.from);
    const toCard = this.graph.getCard(edge.to);

    showEdgeTypePicker(
      anchorX,
      anchorY,
      edge.type,
      pack.edgeTypes,
      fromCard?.kind,
      toCard?.kind,
      this.packStore,
      (typeId) => {
        this.history.capture();
        this.graph.setEdgeType(edge.id, typeId);
      },
    );
  }

  private createCard(worldX: number, worldY: number): void {
    this.history.capture();
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

  private deleteCards(): void {
    const ids = new Set(this.selection.toArray());
    const currentId = this.navigator.current?.id;
    if (currentId) ids.add(currentId);
    if (ids.size === 0) return;

    // Find a surviving neighbor before deletion
    let survivor: string | null = null;
    for (const id of ids) {
      for (const neighbor of this.graph.neighbors(id)) {
        if (!ids.has(neighbor.id)) {
          survivor = neighbor.id;
          break;
        }
      }
      if (survivor) break;
    }

    this.history.capture();
    this.graph.removeCards([...ids]);
    this.selection.clear();
    if (survivor) {
      this.navigator.jumpTo(survivor);
    } else {
      this.navigator.deselect();
    }
  }

  private navigateDirection(direction: "up" | "down" | "left" | "right"): void {
    const current = this.navigator.current;
    if (!current) return;

    const neighbors = this.graph.neighbors(current.id);
    if (neighbors.length === 0) return;

    // Target angles: right=0, down=π/2, left=π, up=-π/2
    const targetAngle: Record<string, number> = {
      right: 0,
      down: Math.PI / 2,
      left: Math.PI,
      up: -Math.PI / 2,
    };
    const angle = targetAngle[direction];
    const cone = Math.PI / 4; // ±45° cone

    const cx = current.position.x;
    const cy = current.position.y;

    let best: { id: string; dist: number } | null = null;

    for (const neighbor of neighbors) {
      const dx = neighbor.position.x - cx;
      const dy = neighbor.position.y - cy;
      const neighborAngle = Math.atan2(dy, dx);

      // Angular difference, normalized to [-π, π]
      let diff = neighborAngle - angle;
      if (diff > Math.PI) diff -= 2 * Math.PI;
      if (diff < -Math.PI) diff += 2 * Math.PI;

      if (Math.abs(diff) > cone) continue;

      const dist = Math.sqrt(dx * dx + dy * dy);
      if (!best || dist < best.dist) {
        best = { id: neighbor.id, dist };
      }
    }

    if (best) {
      this.navigator.jumpTo(best.id);
      this.selection.set(best.id);
      this.canvas.centerOn(
        this.graph.getCard(best.id)!.position.x,
        this.graph.getCard(best.id)!.position.y,
      );
    }
  }

  private linkCards(): void {
    const currentId = this.navigator.current?.id;
    if (!currentId) return;
    const selected = this.selection.toArray().filter((id) => id !== currentId);
    if (selected.length === 0) return;
    this.history.capture();
    for (const targetId of selected) {
      this.graph.addEdge(currentId, targetId);
    }
    // Show edge type picker if pack has edge types and single target
    if (selected.length === 1) {
      const targetEl = this.cardElements.get(selected[0]);
      if (targetEl) {
        const rect = targetEl.getBoundingClientRect();
        this.maybeShowEdgeTypePicker(currentId, selected[0], rect.left, rect.bottom + 4);
      }
    }
  }

  private unlinkCards(): void {
    const currentId = this.navigator.current?.id;
    if (!currentId) return;
    const selected = this.selection.toArray().filter((id) => id !== currentId);
    if (selected.length === 0) return;
    this.history.capture();
    for (const targetId of selected) {
      const edge = this.graph.directEdge(currentId, targetId);
      if (edge) this.graph.removeEdge(edge.id);
    }
  }

  private labelEdge(): void {
    const selected = this.selection.toArray();
    if (selected.length !== 2) return;
    const [a, b] = selected;
    const edge = this.graph.edgesFrom(a).find((e) => e.to === b)
      ?? this.graph.edgesFrom(b).find((e) => e.to === a);
    if (!edge) return;
    this.labelEdgeById(edge.id);
  }

  private labelEdgeById(edgeId: string): void {
    const edges = this.graph.allEdges();
    const edge = edges.find((e) => e.id === edgeId);
    if (!edge) return;

    const elA = this.cardElements.get(edge.from);
    const elB = this.cardElements.get(edge.to);
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
      this.history.capture();
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

  private exportGraph(): void {
    const snapshot = exportSnapshot(this.graph, this.packStore);
    const packName = this.packStore.get()?.name ?? "aspect";
    const filename = `${packName.toLowerCase().replace(/\s+/g, "-")}-export.json`;
    downloadJSON(snapshot, filename);
  }

  private importGraph(): void {
    uploadJSON().then((data) => {
      const result = validateSnapshot(data);
      if (!result.valid) {
        const messages = result.errors.map((e) => `${e.path}: ${e.message}`);
        alert(`Invalid snapshot:\n${messages.join("\n")}`);
        return;
      }
      importSnapshotReplace(result.snapshot, this.graph, this.packStore);
      const cards = this.graph.allCards();
      if (cards.length > 0) {
        this.navigator.jumpTo(cards[0].id);
        this.canvas.centerOn(cards[0].position.x, cards[0].position.y);
      }
    }).catch(() => {
      // User cancelled file picker or read error
    });
  }

  private exportPack(): void {
    const pack = this.packStore.get();
    if (!pack) {
      alert("No world pack loaded");
      return;
    }
    const filename = `${pack.name.toLowerCase().replace(/\s+/g, "-")}-pack.json`;
    downloadJSON(pack, filename);
  }

  private importPack(): void {
    uploadJSON().then((data) => {
      const result = validateWorldPack(data);
      if (!result.valid) {
        const messages = result.errors.map((e) => `${e.path}: ${e.message}`);
        alert(`Invalid world pack:\n${messages.join("\n")}`);
        return;
      }
      this.packStore.load(result.pack);
    }).catch(() => {
      // User cancelled file picker or read error
    });
  }

  bootstrap(): void {
    const cards = this.graph.allCards();
    const isEmpty = cards.length === 0;

    // Load default pack when doc has no pack and graph is empty
    if (!this.packStore.isLoaded && isEmpty) {
      this.packStore.load(DEFAULT_PACK);
    }

    if (isEmpty) {
      const start = this.graph.addCard(
        "Double-click empty space to create a card\nClick a card to select it\nDouble-click a card to edit\nRight-click a card for options\nDrag cards to rearrange\nScroll to zoom",
        { x: 0, y: 0 },
      );
      this.navigator.jumpTo(start.id);
      this.canvas.centerOn(0, 0);
    } else {
      this.navigator.jumpTo(cards[0].id);
      // Restore viewport: hash > localStorage > center on first card
      const restoredHash = this.canvas.restoreFromHash();
      if (!restoredHash) {
        const restoredLocal = this.canvas.restoreViewport();
        if (!restoredLocal) {
          this.canvas.centerOn(cards[0].position.x, cards[0].position.y);
        }
      }
    }

    this.canvas.syncHash = true;

    // Apply default mode from settings
    const defaultMode = this.settings.get("defaultMode");
    if (defaultMode !== "graph") {
      this.setMode(defaultMode);
    }
  }
}
