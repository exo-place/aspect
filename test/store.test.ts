import { describe, expect, test, beforeEach } from "bun:test";
import { CardGraph } from "../src/graph";
import { LocalStorageStore } from "../src/store/local-storage";
import { autoSave } from "../src/persistence";

describe("LocalStorageStore", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("load returns null when empty", async () => {
    const store = new LocalStorageStore("test:store");
    expect(await store.load()).toBeNull();
  });

  test("save and load round-trips graph data", async () => {
    const store = new LocalStorageStore("test:store");
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
    const store = new LocalStorageStore("test:store");
    const graph = new CardGraph();
    graph.addCard("x", { x: 0, y: 0 });
    await store.save(graph.toJSON());
    await store.clear();
    expect(await store.load()).toBeNull();
  });
});

describe("autoSave", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  test("saves graph data after debounce", async () => {
    const store = new LocalStorageStore("test:auto");
    const graph = new CardGraph();
    const dispose = autoSave(graph, store, 10);

    graph.addCard("hello", { x: 0, y: 0 });

    // Wait for debounce
    await new Promise((r) => setTimeout(r, 50));

    const loaded = await store.load();
    expect(loaded).not.toBeNull();
    expect(Object.keys(loaded!.cards)).toHaveLength(1);

    dispose();
  });

  test("debounces multiple changes", async () => {
    const store = new LocalStorageStore("test:auto");
    const graph = new CardGraph();
    let saveCount = 0;
    const origSave = store.save.bind(store);
    store.save = async (data) => {
      saveCount++;
      return origSave(data);
    };

    const dispose = autoSave(graph, store, 10);

    graph.addCard("a", { x: 0, y: 0 });
    graph.addCard("b", { x: 1, y: 0 });
    graph.addCard("c", { x: 2, y: 0 });

    await new Promise((r) => setTimeout(r, 50));

    expect(saveCount).toBe(1);

    dispose();
  });

  test("dispose stops auto-saving", async () => {
    const store = new LocalStorageStore("test:auto");
    const graph = new CardGraph();
    const dispose = autoSave(graph, store, 10);
    dispose();

    graph.addCard("after-dispose", { x: 0, y: 0 });

    await new Promise((r) => setTimeout(r, 50));

    expect(await store.load()).toBeNull();
  });
});
