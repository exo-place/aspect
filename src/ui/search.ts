import type { Card } from "../types";

export interface SearchEvents {
  onJump(cardId: string): void;
  onClose(): void;
}

const MAX_RESULTS = 10;

export class SearchOverlay {
  private overlay: HTMLDivElement;
  private input: HTMLInputElement;
  private resultsList: HTMLDivElement;
  private results: Card[] = [];
  private selectedIndex = 0;
  private allCards: () => Card[];
  private events: SearchEvents;

  constructor(allCards: () => Card[], events: SearchEvents) {
    this.allCards = allCards;
    this.events = events;

    this.overlay = document.createElement("div");
    this.overlay.className = "search-overlay";

    const container = document.createElement("div");
    container.className = "search-container";

    this.input = document.createElement("input");
    this.input.type = "text";
    this.input.className = "search-input";
    this.input.placeholder = "Search cards…";

    this.resultsList = document.createElement("div");
    this.resultsList.className = "search-results";

    container.appendChild(this.input);
    container.appendChild(this.resultsList);
    this.overlay.appendChild(container);

    this.input.addEventListener("input", () => this.updateResults());
    this.input.addEventListener("keydown", (e) => this.onKeyDown(e));
    this.overlay.addEventListener("pointerdown", (e) => {
      if (e.target === this.overlay) this.close();
    });
  }

  open(): void {
    document.body.appendChild(this.overlay);
    this.input.value = "";
    this.results = [];
    this.selectedIndex = 0;
    this.resultsList.innerHTML = "";
    this.input.focus();
  }

  close(): void {
    this.overlay.remove();
    this.events.onClose();
  }

  get isOpen(): boolean {
    return this.overlay.parentNode !== null;
  }

  private updateResults(): void {
    const query = this.input.value.toLowerCase();
    if (query === "") {
      this.results = [];
    } else {
      this.results = this.allCards()
        .filter((c) => c.text.toLowerCase().includes(query))
        .slice(0, MAX_RESULTS);
    }
    this.selectedIndex = 0;
    this.renderResults();
  }

  private renderResults(): void {
    this.resultsList.innerHTML = "";
    for (let i = 0; i < this.results.length; i++) {
      const card = this.results[i];
      const item = document.createElement("div");
      item.className = "search-result-item";
      if (i === this.selectedIndex) item.classList.add("selected");
      item.textContent = card.text || "(empty)";
      item.addEventListener("pointerdown", (e) => {
        e.preventDefault();
        this.jump(card.id);
      });
      this.resultsList.appendChild(item);
    }
  }

  private onKeyDown(e: KeyboardEvent): void {
    if (e.key === "Escape") {
      e.preventDefault();
      this.close();
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (this.results.length > 0) {
        this.selectedIndex = (this.selectedIndex + 1) % this.results.length;
        this.renderResults();
      }
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      if (this.results.length > 0) {
        this.selectedIndex = (this.selectedIndex - 1 + this.results.length) % this.results.length;
        this.renderResults();
      }
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      if (this.results.length > 0) {
        this.jump(this.results[this.selectedIndex].id);
      }
      return;
    }
  }

  private jump(cardId: string): void {
    this.close();
    this.events.onJump(cardId);
  }
}
