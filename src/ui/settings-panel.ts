import { fuzzyMatcher } from "keybinds";
import { SettingsStore, SETTINGS_SCHEMA, type SettingsKey, type SettingDef, type ControlType } from "../settings";

export class SettingsPanel {
  private overlay: HTMLDivElement | null = null;
  private store: SettingsStore;

  constructor(store: SettingsStore) {
    this.store = store;
  }

  get isOpen(): boolean {
    return this.overlay !== null && this.overlay.parentNode !== null;
  }

  open(): void {
    if (this.isOpen) return;

    this.overlay = document.createElement("div");
    this.overlay.className = "settings-overlay";

    const panel = document.createElement("div");
    panel.className = "settings-panel";

    // Header
    const header = document.createElement("div");
    header.className = "settings-header";

    const title = document.createElement("h2");
    title.className = "settings-title";
    title.textContent = "Settings";
    header.appendChild(title);

    const closeBtn = document.createElement("button");
    closeBtn.className = "settings-close";
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", () => this.close());
    header.appendChild(closeBtn);

    panel.appendChild(header);

    // Search
    const searchInput = document.createElement("input");
    searchInput.type = "text";
    searchInput.className = "settings-search";
    searchInput.placeholder = "Search settings\u2026";
    panel.appendChild(searchInput);

    // Body
    const body = document.createElement("div");
    body.className = "settings-body";

    const rows = this.buildSections(body);
    panel.appendChild(body);

    // Wire search filtering
    searchInput.addEventListener("input", () => {
      const query = searchInput.value.trim();
      this.filterRows(rows, query);
    });

    this.overlay.appendChild(panel);
    this.overlay.addEventListener("pointerdown", (e) => {
      if (e.target === this.overlay) this.close();
    });

    document.body.appendChild(this.overlay);
    searchInput.focus();

    // Close on Escape
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

  private buildSections(body: HTMLDivElement): RowInfo[] {
    const sections = new Map<string, { heading: HTMLElement; rows: RowInfo[] }>();
    const allRows: RowInfo[] = [];

    // Group schema entries by section
    for (const [key, def] of Object.entries(SETTINGS_SCHEMA) as [SettingsKey, SettingDef][]) {
      if (!sections.has(def.section)) {
        const heading = document.createElement("h3");
        heading.className = "settings-section-heading";
        heading.textContent = def.section;
        sections.set(def.section, { heading, rows: [] });
      }
      const section = sections.get(def.section)!;

      const row = document.createElement("div");
      row.className = "settings-row";

      const labelEl = document.createElement("label");
      labelEl.className = "settings-label";
      labelEl.textContent = def.label;
      row.appendChild(labelEl);

      const control = this.createControl(key, def.control);
      row.appendChild(control);

      const info: RowInfo = {
        key,
        searchText: `${def.section} ${def.label} ${def.description ?? ""}`.toLowerCase(),
        row,
        section: def.section,
      };
      section.rows.push(info);
      allRows.push(info);
    }

    // Keyboard section
    const kbSection = "Keyboard";
    const kbHeading = document.createElement("h3");
    kbHeading.className = "settings-section-heading";
    kbHeading.textContent = kbSection;
    sections.set(kbSection, { heading: kbHeading, rows: [] });

    const kbRow = document.createElement("div");
    kbRow.className = "settings-row";

    const kbLabel = document.createElement("label");
    kbLabel.className = "settings-label";
    kbLabel.textContent = "Keyboard Shortcuts";
    kbRow.appendChild(kbLabel);

    const kbBtn = document.createElement("button");
    kbBtn.className = "settings-keybinds-btn";
    kbBtn.textContent = "Configure\u2026";
    kbBtn.addEventListener("click", () => {
      this.close();
      const el = document.querySelector("keybind-settings");
      if (el) (el as HTMLElement & { open: boolean }).open = true;
    });
    kbRow.appendChild(kbBtn);

    const kbInfo: RowInfo = {
      key: null,
      searchText: "keyboard shortcuts keybinds hotkeys",
      row: kbRow,
      section: kbSection,
    };
    sections.get(kbSection)!.rows.push(kbInfo);
    allRows.push(kbInfo);

    // Append sections to body
    for (const [, { heading, rows }] of sections) {
      body.appendChild(heading);
      for (const r of rows) {
        body.appendChild(r.row);
      }
    }

    return allRows;
  }

  private createControl(key: SettingsKey, control: ControlType): HTMLElement {
    switch (control.type) {
      case "toggle": {
        const label = document.createElement("label");
        label.className = "settings-toggle";
        const input = document.createElement("input");
        input.type = "checkbox";
        input.checked = this.store.get(key) as boolean;
        input.addEventListener("change", () => {
          this.store.set(key, input.checked as never);
        });
        const slider = document.createElement("span");
        slider.className = "settings-toggle-slider";
        label.appendChild(input);
        label.appendChild(slider);
        return label;
      }

      case "select": {
        const select = document.createElement("select");
        select.className = "settings-select";
        for (const opt of control.options) {
          const option = document.createElement("option");
          option.value = opt.value;
          option.textContent = opt.label;
          select.appendChild(option);
        }
        select.value = this.store.get(key) as string;
        select.addEventListener("change", () => {
          this.store.set(key, select.value as never);
        });
        return select;
      }

      case "number": {
        const input = document.createElement("input");
        input.type = "number";
        input.className = "settings-number";
        input.min = String(control.min);
        input.max = String(control.max);
        input.step = String(control.step);
        input.value = String(this.store.get(key));
        input.addEventListener("change", () => {
          const val = parseFloat(input.value);
          if (!Number.isNaN(val)) {
            const clamped = Math.min(control.max, Math.max(control.min, val));
            input.value = String(clamped);
            this.store.set(key, clamped as never);
          }
        });
        return input;
      }

      case "text": {
        const input = document.createElement("input");
        input.type = "text";
        input.className = "settings-text";
        input.value = this.store.get(key) as string;
        input.addEventListener("change", () => {
          this.store.set(key, input.value as never);
        });
        return input;
      }

      case "color": {
        const input = document.createElement("input");
        input.type = "color";
        input.className = "settings-color";
        input.value = this.store.get(key) as string;
        input.addEventListener("input", () => {
          this.store.set(key, input.value as never);
        });
        return input;
      }
    }
  }

  private filterRows(rows: RowInfo[], query: string): void {
    const visibleSections = new Set<string>();

    for (const row of rows) {
      if (!query) {
        row.row.style.display = "";
        visibleSections.add(row.section);
        continue;
      }
      const match = fuzzyMatcher(query.toLowerCase(), row.searchText);
      if (match) {
        row.row.style.display = "";
        visibleSections.add(row.section);
      } else {
        row.row.style.display = "none";
      }
    }

    // Hide/show section headings
    const headings = this.overlay?.querySelectorAll(".settings-section-heading");
    if (headings) {
      for (const h of headings) {
        const sectionName = h.textContent ?? "";
        (h as HTMLElement).style.display = visibleSections.has(sectionName) ? "" : "none";
      }
    }
  }
}

interface RowInfo {
  key: SettingsKey | null;
  searchText: string;
  row: HTMLElement;
  section: string;
}
