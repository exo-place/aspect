import { describe, expect, test, beforeEach } from "bun:test";
import { SettingsStore, SETTINGS_SCHEMA } from "../src/settings";

// Stub localStorage for tests
const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (_i: number) => null,
} as Storage;

describe("SettingsStore", () => {
  beforeEach(() => {
    storage.clear();
  });

  test("get returns defaults when no overrides", () => {
    const store = new SettingsStore();
    expect(store.get("edgeStyle")).toBe("spline");
    expect(store.get("showMinimap")).toBe(true);
    expect(store.get("minZoom")).toBe(0.1);
    expect(store.get("maxZoom")).toBe(4);
  });

  test("set persists a non-default value", () => {
    const store = new SettingsStore();
    store.set("edgeStyle", "line");
    expect(store.get("edgeStyle")).toBe("line");

    // Persisted to localStorage
    const raw = storage.get("aspect:settings");
    expect(raw).toBeDefined();
    expect(JSON.parse(raw!)).toEqual({ edgeStyle: "line" });
  });

  test("set removes override when value equals default", () => {
    const store = new SettingsStore();
    store.set("edgeStyle", "line");
    expect(store.get("edgeStyle")).toBe("line");

    store.set("edgeStyle", "spline");
    expect(store.get("edgeStyle")).toBe("spline");
    // Storage should be cleared (no overrides left)
    expect(storage.get("aspect:settings")).toBeUndefined();
  });

  test("reset restores a key to its default", () => {
    const store = new SettingsStore();
    store.set("showMinimap", false);
    expect(store.get("showMinimap")).toBe(false);

    store.reset("showMinimap");
    expect(store.get("showMinimap")).toBe(true);
  });

  test("resetAll clears all overrides", () => {
    const store = new SettingsStore();
    store.set("edgeStyle", "taxicab");
    store.set("showMinimap", false);
    store.set("minZoom", 0.5);

    store.resetAll();
    expect(store.get("edgeStyle")).toBe("spline");
    expect(store.get("showMinimap")).toBe(true);
    expect(store.get("minZoom")).toBe(0.1);
    expect(storage.get("aspect:settings")).toBeUndefined();
  });

  test("dispatches change event on set", () => {
    const store = new SettingsStore();
    const events: { key: string; value: unknown }[] = [];
    store.addEventListener("change", ((e: CustomEvent) => {
      events.push(e.detail);
    }) as EventListener);

    store.set("edgeStyle", "taxicab");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ key: "edgeStyle", value: "taxicab" });
  });

  test("dispatches change event on reset", () => {
    const store = new SettingsStore();
    store.set("showMinimap", false);

    const events: { key: string; value: unknown }[] = [];
    store.addEventListener("change", ((e: CustomEvent) => {
      events.push(e.detail);
    }) as EventListener);

    store.reset("showMinimap");
    expect(events).toHaveLength(1);
    expect(events[0]).toEqual({ key: "showMinimap", value: true });
  });

  test("dispatches change events for each key on resetAll", () => {
    const store = new SettingsStore();
    store.set("edgeStyle", "line");
    store.set("maxZoom", 8);

    const events: { key: string; value: unknown }[] = [];
    store.addEventListener("change", ((e: CustomEvent) => {
      events.push(e.detail);
    }) as EventListener);

    store.resetAll();
    expect(events).toHaveLength(2);
    const keys = events.map((e) => e.key).sort();
    expect(keys).toEqual(["edgeStyle", "maxZoom"]);
  });

  test("loads overrides from localStorage on construction", () => {
    storage.set("aspect:settings", JSON.stringify({ edgeStyle: "taxicab", minZoom: 0.5 }));
    const store = new SettingsStore();
    expect(store.get("edgeStyle")).toBe("taxicab");
    expect(store.get("minZoom")).toBe(0.5);
    expect(store.get("showMinimap")).toBe(true); // still default
  });

  test("handles corrupt localStorage gracefully", () => {
    storage.set("aspect:settings", "not json");
    const store = new SettingsStore();
    expect(store.get("edgeStyle")).toBe("spline"); // falls back to default
  });

  test("reset on key with no override is a no-op", () => {
    const store = new SettingsStore();
    const events: unknown[] = [];
    store.addEventListener("change", () => events.push(1));
    store.reset("edgeStyle");
    expect(events).toHaveLength(0);
  });

  test("SETTINGS_SCHEMA has expected sections", () => {
    const sections = new Set(Object.values(SETTINGS_SCHEMA).map((d) => d.section));
    expect(sections.has("Appearance")).toBe(true);
    expect(sections.has("Canvas")).toBe(true);
  });
});
