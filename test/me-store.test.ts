import { describe, expect, test, beforeEach } from "bun:test";
import { MeStore } from "../src/me-store";

const storage = new Map<string, string>();
globalThis.localStorage = {
  getItem: (k: string) => storage.get(k) ?? null,
  setItem: (k: string, v: string) => { storage.set(k, v); },
  removeItem: (k: string) => { storage.delete(k); },
  clear: () => storage.clear(),
  get length() { return storage.size; },
  key: (_i: number) => null,
} as Storage;

describe("MeStore", () => {
  beforeEach(() => {
    storage.clear();
  });

  test("starts empty", () => {
    const store = new MeStore("test-room");
    expect(store.size).toBe(0);
    expect(store.getAll()).toEqual([]);
  });

  test("add and has", () => {
    const store = new MeStore("test-room");
    store.add("card-1");
    expect(store.has("card-1")).toBe(true);
    expect(store.has("card-2")).toBe(false);
    expect(store.size).toBe(1);
  });

  test("add is idempotent", () => {
    const store = new MeStore("test-room");
    const events: Event[] = [];
    store.addEventListener("change", (e) => events.push(e));
    store.add("card-1");
    store.add("card-1");
    expect(store.size).toBe(1);
    expect(events).toHaveLength(1);
  });

  test("remove", () => {
    const store = new MeStore("test-room");
    store.add("card-1");
    store.remove("card-1");
    expect(store.has("card-1")).toBe(false);
    expect(store.size).toBe(0);
  });

  test("remove non-existent is no-op", () => {
    const store = new MeStore("test-room");
    const events: Event[] = [];
    store.addEventListener("change", (e) => events.push(e));
    store.remove("card-1");
    expect(events).toHaveLength(0);
  });

  test("toggle", () => {
    const store = new MeStore("test-room");
    store.toggle("card-1");
    expect(store.has("card-1")).toBe(true);
    store.toggle("card-1");
    expect(store.has("card-1")).toBe(false);
  });

  test("getAll returns all IDs", () => {
    const store = new MeStore("test-room");
    store.add("a");
    store.add("b");
    store.add("c");
    expect(store.getAll().sort()).toEqual(["a", "b", "c"]);
  });

  test("persists to localStorage", () => {
    const store = new MeStore("room-1");
    store.add("card-1");
    store.add("card-2");
    const raw = storage.get("aspect:me:room-1");
    expect(raw).toBeDefined();
    const arr = JSON.parse(raw!);
    expect(arr.sort()).toEqual(["card-1", "card-2"]);
  });

  test("loads from localStorage on construction", () => {
    storage.set("aspect:me:room-1", JSON.stringify(["x", "y"]));
    const store = new MeStore("room-1");
    expect(store.has("x")).toBe(true);
    expect(store.has("y")).toBe(true);
    expect(store.size).toBe(2);
  });

  test("handles corrupt localStorage gracefully", () => {
    storage.set("aspect:me:room-1", "not json");
    const store = new MeStore("room-1");
    expect(store.size).toBe(0);
  });

  test("removes localStorage key when empty", () => {
    const store = new MeStore("room-1");
    store.add("card-1");
    expect(storage.has("aspect:me:room-1")).toBe(true);
    store.remove("card-1");
    expect(storage.has("aspect:me:room-1")).toBe(false);
  });

  test("prune removes invalid IDs", () => {
    const store = new MeStore("test-room");
    store.add("a");
    store.add("b");
    store.add("c");

    const events: Event[] = [];
    store.addEventListener("change", (e) => events.push(e));

    store.prune(new Set(["a", "c"]));
    expect(store.has("a")).toBe(true);
    expect(store.has("b")).toBe(false);
    expect(store.has("c")).toBe(true);
    expect(store.size).toBe(2);
    expect(events).toHaveLength(1);
  });

  test("prune with all valid is no-op", () => {
    const store = new MeStore("test-room");
    store.add("a");
    const events: Event[] = [];
    store.addEventListener("change", (e) => events.push(e));
    store.prune(new Set(["a", "b"]));
    expect(events).toHaveLength(0);
  });

  test("dispatches change on add", () => {
    const store = new MeStore("test-room");
    const events: Event[] = [];
    store.addEventListener("change", (e) => events.push(e));
    store.add("card-1");
    expect(events).toHaveLength(1);
  });

  test("dispatches change on remove", () => {
    const store = new MeStore("test-room");
    store.add("card-1");
    const events: Event[] = [];
    store.addEventListener("change", (e) => events.push(e));
    store.remove("card-1");
    expect(events).toHaveLength(1);
  });

  test("rooms are isolated", () => {
    const store1 = new MeStore("room-a");
    const store2 = new MeStore("room-b");
    store1.add("card-1");
    expect(store2.has("card-1")).toBe(false);
  });
});
