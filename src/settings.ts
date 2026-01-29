import type { EdgeStyle } from "./ui/edge-line";

export type ControlType =
  | { type: "toggle" }
  | { type: "select"; options: { value: string; label: string }[] }
  | { type: "number"; min: number; max: number; step: number }
  | { type: "text" }
  | { type: "color" };

export interface SettingDef {
  default: unknown;
  label: string;
  section: string;
  description?: string;
  control: ControlType;
}

export const SETTINGS_SCHEMA: Record<string, SettingDef> = {
  edgeStyle: {
    default: "spline" as EdgeStyle,
    label: "Edge curve style",
    section: "Appearance",
    control: {
      type: "select",
      options: [
        { value: "spline", label: "Spline" },
        { value: "line", label: "Straight" },
        { value: "taxicab", label: "Taxicab" },
        { value: "rounded-taxicab", label: "Rounded taxicab" },
      ],
    },
  },
  showMinimap: {
    default: true,
    label: "Show minimap",
    section: "Appearance",
    control: { type: "toggle" },
  },
  minZoom: {
    default: 0.1,
    label: "Minimum zoom",
    section: "Canvas",
    control: { type: "number", min: 0.05, max: 1.0, step: 0.05 },
  },
  maxZoom: {
    default: 4,
    label: "Maximum zoom",
    section: "Canvas",
    control: { type: "number", min: 1.0, max: 10.0, step: 0.5 },
  },
};

export type SettingsKey = "edgeStyle" | "showMinimap" | "minZoom" | "maxZoom";

export interface SettingsValues {
  edgeStyle: EdgeStyle;
  showMinimap: boolean;
  minZoom: number;
  maxZoom: number;
}

const STORAGE_KEY = "aspect:settings";

export class SettingsStore extends EventTarget {
  private overrides: Partial<SettingsValues>;

  constructor() {
    super();
    this.overrides = this.load();
  }

  get<K extends SettingsKey>(key: K): SettingsValues[K] {
    if (key in this.overrides) {
      return this.overrides[key] as SettingsValues[K];
    }
    return SETTINGS_SCHEMA[key].default as SettingsValues[K];
  }

  set<K extends SettingsKey>(key: K, value: SettingsValues[K]): void {
    const def = SETTINGS_SCHEMA[key].default;
    if (value === def) {
      delete this.overrides[key];
    } else {
      (this.overrides as Record<string, unknown>)[key] = value;
    }
    this.save();
    this.dispatchEvent(new CustomEvent("change", { detail: { key, value } }));
  }

  reset<K extends SettingsKey>(key: K): void {
    if (!(key in this.overrides)) return;
    delete this.overrides[key];
    this.save();
    const value = SETTINGS_SCHEMA[key].default as SettingsValues[K];
    this.dispatchEvent(new CustomEvent("change", { detail: { key, value } }));
  }

  resetAll(): void {
    const keys = Object.keys(this.overrides) as SettingsKey[];
    this.overrides = {};
    this.save();
    for (const key of keys) {
      const value = SETTINGS_SCHEMA[key].default;
      this.dispatchEvent(new CustomEvent("change", { detail: { key, value } }));
    }
  }

  private load(): Partial<SettingsValues> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return {};
      return JSON.parse(raw) as Partial<SettingsValues>;
    } catch {
      return {};
    }
  }

  private save(): void {
    if (Object.keys(this.overrides).length === 0) {
      localStorage.removeItem(STORAGE_KEY);
    } else {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.overrides));
    }
  }
}
