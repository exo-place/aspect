export type TabMode = "graph" | "projection";

export class TabBar {
  readonly el: HTMLDivElement;
  private graphBtn: HTMLButtonElement;
  private projectionBtn: HTMLButtonElement;
  private mode: TabMode = "graph";

  onModeChange: ((mode: TabMode) => void) | null = null;

  constructor() {
    this.el = document.createElement("div");
    this.el.className = "tab-bar";
    this.el.setAttribute("role", "tablist");

    this.graphBtn = this.createTab("Build", "graph");
    this.projectionBtn = this.createTab("Experience", "projection");

    this.el.appendChild(this.graphBtn);
    this.el.appendChild(this.projectionBtn);

    this.updateActive();
  }

  getMode(): TabMode {
    return this.mode;
  }

  setMode(mode: TabMode): void {
    if (this.mode === mode) return;
    this.mode = mode;
    this.updateActive();
  }

  private createTab(label: string, mode: TabMode): HTMLButtonElement {
    const btn = document.createElement("button");
    btn.className = "tab-bar-btn";
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", "false");
    btn.textContent = label;
    btn.addEventListener("click", () => {
      if (this.mode === mode) return;
      this.mode = mode;
      this.updateActive();
      this.onModeChange?.(mode);
    });
    return btn;
  }

  private updateActive(): void {
    this.graphBtn.classList.toggle("active", this.mode === "graph");
    this.graphBtn.setAttribute("aria-selected", String(this.mode === "graph"));
    this.projectionBtn.classList.toggle("active", this.mode === "projection");
    this.projectionBtn.setAttribute("aria-selected", String(this.mode === "projection"));
  }
}
