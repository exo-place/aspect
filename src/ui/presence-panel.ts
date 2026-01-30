import type { Presence } from "../presence";

export class PresencePanel {
  private el: HTMLDivElement;
  private presence: Presence;
  private getCardText: (cardId: string) => string;
  private zoomRow: HTMLDivElement;

  constructor(
    container: HTMLElement,
    presence: Presence,
    getCardText: (cardId: string) => string,
  ) {
    this.presence = presence;
    this.getCardText = getCardText;
    this.el = document.createElement("div");
    this.el.className = "presence-panel";
    this.zoomRow = document.createElement("div");
    this.zoomRow.className = "presence-zoom-row";
    container.appendChild(this.el);
  }

  show(): void {
    this.el.style.display = "";
  }

  hide(): void {
    this.el.style.display = "none";
  }

  setZoom(zoom: number): void {
    this.zoomRow.textContent = `${Math.round(zoom * 100)}%`;
  }

  render(): void {
    const local = this.presence.getLocalIdentity();
    const peers = this.presence.getRemotePeers();

    this.el.innerHTML = "";

    // Self row
    const selfRow = this.createRow(local.name, local.color, undefined, true);
    this.el.appendChild(selfRow);

    // Remote peers
    for (const peer of peers) {
      const cardText = peer.currentCardId
        ? this.getCardText(peer.currentCardId)
        : undefined;
      const row = this.createRow(peer.name, peer.color, cardText, false);
      this.el.appendChild(row);
    }

    // Zoom row is always last
    this.el.appendChild(this.zoomRow);
  }

  private createRow(
    name: string,
    color: string,
    cardText: string | undefined,
    isSelf: boolean,
  ): HTMLDivElement {
    const row = document.createElement("div");
    row.className = "presence-panel-item";

    const dot = document.createElement("span");
    dot.className = "presence-dot";
    dot.style.backgroundColor = color;
    row.appendChild(dot);

    if (isSelf) {
      const nameSpan = document.createElement("span");
      nameSpan.className = "presence-name-self";
      nameSpan.textContent = name;
      nameSpan.title = "Click to rename";
      nameSpan.addEventListener("click", () => {
        this.startRename(row, nameSpan);
      });
      row.appendChild(nameSpan);

      const youLabel = document.createElement("span");
      youLabel.className = "presence-you-label";
      youLabel.textContent = "(you)";
      row.appendChild(youLabel);
    } else {
      const nameSpan = document.createElement("span");
      nameSpan.className = "presence-name";
      nameSpan.textContent = name;
      row.appendChild(nameSpan);
    }

    if (cardText !== undefined) {
      const loc = document.createElement("span");
      loc.className = "presence-location";
      loc.textContent = truncate(cardText, 20);
      loc.title = cardText;
      row.appendChild(loc);
    }

    return row;
  }

  private startRename(row: HTMLDivElement, nameSpan: HTMLSpanElement): void {
    const input = document.createElement("input");
    input.type = "text";
    input.className = "presence-name-input";
    input.value = nameSpan.textContent ?? "";
    nameSpan.replaceWith(input);
    input.focus();
    input.select();

    let committed = false;
    const commit = () => {
      if (committed) return;
      committed = true;
      const value = input.value.trim();
      if (value) {
        this.presence.setName(value);
      }
      this.render();
    };

    input.addEventListener("blur", commit);
    input.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        commit();
      }
      if (e.key === "Escape") {
        e.preventDefault();
        committed = true;
        this.render();
      }
    });
  }
}

function truncate(text: string, maxLen: number): string {
  if (!text) return "(empty)";
  const oneLine = text.replace(/\n/g, " ");
  if (oneLine.length <= maxLen) return oneLine;
  return `${oneLine.slice(0, maxLen)}…`;
}
