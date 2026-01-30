import type { WorldPackStore } from "../pack";

export interface PackInfoActions {
  onImportPack(): void;
  onExportPack(): void;
}

export class PackInfoPanel {
  private overlay: HTMLDivElement | null = null;
  private packStore: WorldPackStore;
  private actions: PackInfoActions;

  constructor(packStore: WorldPackStore, actions: PackInfoActions) {
    this.packStore = packStore;
    this.actions = actions;
  }

  get isOpen(): boolean {
    return this.overlay !== null && this.overlay.parentNode !== null;
  }

  open(): void {
    if (this.isOpen) return;

    this.overlay = document.createElement("div");
    this.overlay.className = "settings-overlay";
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-label", "Pack info");
    this.overlay.setAttribute("aria-modal", "true");

    const panel = document.createElement("div");
    panel.className = "settings-panel pack-info-panel";

    // Header
    const header = document.createElement("div");
    header.className = "settings-header";

    const title = document.createElement("h2");
    title.className = "settings-title";
    title.textContent = "World Pack";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "settings-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Body
    const body = document.createElement("div");
    body.className = "settings-body";

    const pack = this.packStore.get();

    if (pack) {
      const nameRow = this.createInfoRow("Name", pack.name);
      body.appendChild(nameRow);

      const versionRow = this.createInfoRow("Version", String(pack.packVersion));
      body.appendChild(versionRow);

      if (pack.description) {
        const descRow = this.createInfoRow("Description", pack.description);
        body.appendChild(descRow);
      }

      const kindsRow = this.createInfoRow("Kinds", String(pack.kinds.length));
      body.appendChild(kindsRow);

      const edgeTypesRow = this.createInfoRow("Edge types", String(pack.edgeTypes.length));
      body.appendChild(edgeTypesRow);

      // Actions
      const actions = document.createElement("div");
      actions.className = "pack-info-actions";

      const exportBtn = this.createActionButton("Export pack", () => {
        this.close();
        this.actions.onExportPack();
      });
      actions.appendChild(exportBtn);

      const importBtn = this.createActionButton("Import pack", () => {
        this.close();
        this.actions.onImportPack();
      });
      actions.appendChild(importBtn);

      const clearBtn = this.createActionButton("Clear pack", () => {
        this.packStore.clear();
        this.close();
      });
      clearBtn.classList.add("destructive");
      actions.appendChild(clearBtn);

      body.appendChild(actions);
    } else {
      const empty = document.createElement("p");
      empty.className = "pack-info-empty";
      empty.textContent = "No world pack loaded";
      body.appendChild(empty);

      const actions = document.createElement("div");
      actions.className = "pack-info-actions";

      const importBtn = this.createActionButton("Import pack", () => {
        this.close();
        this.actions.onImportPack();
      });
      actions.appendChild(importBtn);

      body.appendChild(actions);
    }

    panel.appendChild(body);
    this.overlay.appendChild(panel);

    this.overlay.addEventListener("pointerdown", (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.body.appendChild(this.overlay);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        this.close();
        document.removeEventListener("keydown", onKeyDown);
      }
    };
    document.addEventListener("keydown", onKeyDown);
  }

  close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }

  private createInfoRow(label: string, value: string): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "settings-row";

    const labelEl = document.createElement("span");
    labelEl.className = "settings-label";
    labelEl.textContent = label;
    row.appendChild(labelEl);

    const valueEl = document.createElement("span");
    valueEl.className = "pack-info-value";
    valueEl.textContent = value;
    row.appendChild(valueEl);

    return row;
  }

  private createActionButton(text: string, onClick: () => void): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "pack-info-btn";
    btn.textContent = text;
    btn.addEventListener("click", onClick);
    return btn;
  }
}
