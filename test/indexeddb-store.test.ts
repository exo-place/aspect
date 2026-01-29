// IndexedDB is not available in Bun's test environment.
// These tests use a minimal fake to verify IndexedDbStore logic.

import { describe, expect, test, beforeEach } from "bun:test";
import { CardGraph } from "../src/graph";

// --- Minimal IndexedDB fake ---

class FakeObjectStore {
  private data = new Map<string, unknown>();
  put(value: unknown, key: string) {
    this.data.set(key, structuredClone(value));
    return fakeRequest(undefined);
  }
  get(key: string) {
    return fakeRequest(structuredClone(this.data.get(key)) ?? undefined);
  }
  delete(key: string) {
    this.data.delete(key);
    return fakeRequest(undefined);
  }
}

class FakeTransaction {
  oncomplete: (() => void) | null = null;
  onerror: (() => void) | null = null;
  error: DOMException | null = null;
  private store: FakeObjectStore;

  constructor(store: FakeObjectStore) {
    this.store = store;
    queueMicrotask(() => this.oncomplete?.());
  }

  objectStore(_name: string) {
    return this.store;
  }
}

class FakeDatabase {
  objectStoreNames = { contains: () => true };
  private store = new FakeObjectStore();

  createObjectStore() {
    return this.store;
  }

  transaction(_name: string, _mode?: string) {
    return new FakeTransaction(this.store);
  }
}

function fakeRequest(result: unknown) {
  const req = {
    result,
    error: null as DOMException | null,
    onsuccess: null as (() => void) | null,
    onerror: null as (() => void) | null,
  };
  queueMicrotask(() => req.onsuccess?.());
  return req;
}

const fakeDb = new FakeDatabase();

// biome-ignore lint: test mock
(globalThis as any).indexedDB = {
  open(_name: string, _version?: number) {
    const req = {
      result: fakeDb,
      error: null as DOMException | null,
      onupgradeneeded: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
      onerror: null as (() => void) | null,
    };
    queueMicrotask(() => {
      req.onupgradeneeded?.();
      req.onsuccess?.();
    });
    return req;
  },
};

// Import after mock is installed
const { IndexedDbStore } = await import("../src/store/indexeddb-store");

describe("IndexedDbStore", () => {
  let store: InstanceType<typeof IndexedDbStore>;

  beforeEach(async () => {
    store = new IndexedDbStore();
    await store.clear();
  });

  test("load returns null when empty", async () => {
    expect(await store.load()).toBeNull();
  });

  test("save and load round-trips graph data", async () => {
    const graph = new CardGraph();
    const a = graph.addCard("Alpha", { x: 0, y: 0 });
    const b = graph.addCard("Beta", { x: 100, y: 0 });
    graph.addEdge(a.id, b.id, "link");

    await store.save(graph.toJSON());
    const loaded = await store.load();

    expect(loaded).not.toBeNull();
    expect(Object.keys(loaded!.cards)).toHaveLength(2);
    expect(Object.keys(loaded!.edges)).toHaveLength(1);
    expect(loaded!.cards[a.id].text).toBe("Alpha");
  });

  test("clear removes stored data", async () => {
    const graph = new CardGraph();
    graph.addCard("x", { x: 0, y: 0 });
    await store.save(graph.toJSON());
    await store.clear();
    expect(await store.load()).toBeNull();
  });

  test("save overwrites previous data", async () => {
    const graph = new CardGraph();
    graph.addCard("first", { x: 0, y: 0 });
    await store.save(graph.toJSON());

    const graph2 = new CardGraph();
    graph2.addCard("second", { x: 10, y: 10 });
    await store.save(graph2.toJSON());

    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(Object.keys(loaded!.cards)).toHaveLength(1);
    const card = Object.values(loaded!.cards)[0];
    expect(card.text).toBe("second");
  });
});
