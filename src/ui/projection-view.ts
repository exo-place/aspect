import type { ProjectionData, PanelDef } from "../projection-types";
import type { PeerState } from "../presence";

export interface ProjectionViewEvents {
  onNavigate(cardId: string): void;
  onEditText(cardId: string, newText: string): void;
}

export class ProjectionView {
  readonly el: HTMLDivElement;
  private events: ProjectionViewEvents;
  private headerEl: HTMLDivElement;
  private panelsEl: HTMLDivElement;
  private presenceEl: HTMLDivElement;
  private emptyEl: HTMLDivElement;

  constructor(events: ProjectionViewEvents) {
    this.events = events;

    this.el = document.createElement("div");
    this.el.className = "projection-view";
    this.el.setAttribute("role", "region");
    this.el.setAttribute("aria-label", "Projection view");

    this.headerEl = document.createElement("div");
    this.headerEl.className = "projection-header";

    this.panelsEl = document.createElement("div");
    this.panelsEl.className = "projection-panels";

    this.presenceEl = document.createElement("div");
    this.presenceEl.className = "projection-presence";

    this.emptyEl = document.createElement("div");
    this.emptyEl.className = "projection-empty";
    this.emptyEl.textContent = "No card selected";

    this.el.appendChild(this.headerEl);
    this.el.appendChild(this.panelsEl);
    this.el.appendChild(this.presenceEl);
    this.el.appendChild(this.emptyEl);
  }

  render(data: ProjectionData | null): void {
    if (!data) {
      this.headerEl.style.display = "none";
      this.panelsEl.style.display = "none";
      this.presenceEl.style.display = "none";
      this.emptyEl.style.display = "";
      return;
    }

    this.emptyEl.style.display = "none";
    this.headerEl.style.display = "";
    this.panelsEl.style.display = "";

    this.renderHeader(data);
    this.renderPanels(data);
  }

  renderPresence(peers: PeerState[]): void {
    this.presenceEl.innerHTML = "";
    if (peers.length === 0) {
      this.presenceEl.style.display = "none";
      return;
    }
    this.presenceEl.style.display = "";

    const title = document.createElement("h2");
    title.className = "projection-presence-title";
    title.textContent = "Who's here";
    this.presenceEl.appendChild(title);

    const list = document.createElement("div");
    list.className = "projection-presence-list";

    for (const peer of peers) {
      const item = document.createElement("span");
      item.className = "projection-presence-peer";

      const dot = document.createElement("span");
      dot.className = "presence-dot";
      dot.style.backgroundColor = peer.color;
      item.appendChild(dot);

      const name = document.createElement("span");
      name.textContent = peer.name;
      item.appendChild(name);

      list.appendChild(item);
    }

    this.presenceEl.appendChild(list);
  }

  private renderHeader(data: ProjectionData): void {
    this.headerEl.innerHTML = "";

    if (data.kindStyle?.icon) {
      const icon = document.createElement("span");
      icon.className = "projection-kind-icon";
      icon.textContent = data.kindStyle.icon;
      this.headerEl.appendChild(icon);
    }

    const title = document.createElement("h1");
    title.className = "projection-title";
    title.textContent = data.text || "(empty)";
    if (data.kindStyle?.color) {
      title.style.borderLeftColor = data.kindStyle.color;
    } else {
      title.style.borderLeftColor = "transparent";
    }

    title.addEventListener("dblclick", () => {
      const input = document.createElement("textarea");
      input.className = "projection-title-editor";
      input.value = data.text;
      title.replaceWith(input);
      input.focus();
      input.select();

      let committed = false;
      const commit = () => {
        if (committed) return;
        committed = true;
        const newText = input.value;
        input.replaceWith(title);
        if (newText !== data.text) {
          this.events.onEditText(data.cardId, newText);
        }
      };

      input.addEventListener("blur", commit);
      input.addEventListener("keydown", (e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          committed = true;
          input.replaceWith(title);
        }
      });
    });

    this.headerEl.appendChild(title);
  }

  private renderPanels(data: ProjectionData): void {
    this.panelsEl.innerHTML = "";

    for (const panel of data.panels) {
      this.panelsEl.appendChild(this.createPanel(panel));
    }
  }

  private createPanel(panel: PanelDef): HTMLElement {
    const section = document.createElement("section");
    section.className = "projection-panel";

    const heading = document.createElement("h2");
    heading.className = "projection-panel-title";
    const dirLabel = panel.direction === "to" ? `${panel.label} (incoming)` : panel.label;
    heading.textContent = dirLabel;
    section.appendChild(heading);

    const list = document.createElement("div");
    list.className = "projection-panel-items";

    for (const item of panel.items) {
      const btn = document.createElement("button");
      btn.className = "projection-item-btn";

      if (item.kindStyle?.icon) {
        const icon = document.createElement("span");
        icon.className = "projection-item-icon";
        icon.textContent = item.kindStyle.icon;
        btn.appendChild(icon);
      }

      const label = document.createElement("span");
      label.className = "projection-item-label";
      label.textContent = item.text || "(empty)";
      btn.appendChild(label);

      if (item.kindStyle?.color) {
        btn.style.borderLeftColor = item.kindStyle.color;
      }

      btn.addEventListener("click", () => {
        this.events.onNavigate(item.cardId);
      });

      list.appendChild(btn);
    }

    section.appendChild(list);
    return section;
  }
}
