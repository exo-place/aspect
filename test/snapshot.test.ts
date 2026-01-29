import { describe, expect, test } from "bun:test";
import { CardGraph } from "../src/graph";
import { WorldPackStore } from "../src/pack";
import { createYDoc } from "../src/ydoc";
import { DEFAULT_PACK } from "../src/default-pack";
import {
  exportSnapshot,
  validateSnapshot,
  importSnapshotReplace,
  importSnapshotMerge,
} from "../src/snapshot";
import type { AspectSnapshot } from "../src/snapshot";

function makeGraphAndPack() {
  const bundle = createYDoc();
  const graph = new CardGraph(bundle);
  const packStore = new WorldPackStore(bundle);
  return { bundle, graph, packStore };
}

function buildSnapshot(): AspectSnapshot {
  const { graph, packStore } = makeGraphAndPack();
  packStore.load(DEFAULT_PACK);
  const a = graph.addCard("Room A", { x: 0, y: 0 }, "room");
  const b = graph.addCard("Room B", { x: 200, y: 0 }, "room");
  graph.addEdge(a.id, b.id);
  return exportSnapshot(graph, packStore);
}

describe("exportSnapshot", () => {
  test("captures graph and pack state", () => {
    const snapshot = buildSnapshot();
    expect(snapshot.version).toBe(1);
    expect(Object.keys(snapshot.graph.cards)).toHaveLength(2);
    expect(Object.keys(snapshot.graph.edges)).toHaveLength(1);
    expect(snapshot.pack).not.toBeNull();
    expect(snapshot.pack!.packId).toBe("rooms-and-items");
  });

  test("captures null pack when none loaded", () => {
    const { graph, packStore } = makeGraphAndPack();
    graph.addCard("hello", { x: 0, y: 0 });
    const snapshot = exportSnapshot(graph, packStore);
    expect(snapshot.pack).toBeNull();
  });
});

describe("validateSnapshot", () => {
  test("accepts a valid snapshot", () => {
    const snapshot = buildSnapshot();
    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(true);
  });

  test("accepts snapshot with null pack", () => {
    const { graph, packStore } = makeGraphAndPack();
    graph.addCard("test", { x: 0, y: 0 });
    const snapshot = exportSnapshot(graph, packStore);
    const result = validateSnapshot(snapshot);
    expect(result.valid).toBe(true);
  });

  test("rejects non-object input", () => {
    const result = validateSnapshot("bad");
    expect(result.valid).toBe(false);
  });

  test("rejects wrong version", () => {
    const snapshot = buildSnapshot();
    const result = validateSnapshot({ ...snapshot, version: 2 });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.path === "version")).toBe(true);
    }
  });

  test("rejects missing graph", () => {
    const result = validateSnapshot({ version: 1 });
    expect(result.valid).toBe(false);
  });

  test("rejects invalid card structure", () => {
    const result = validateSnapshot({
      version: 1,
      graph: {
        cards: { c1: { text: 123, position: { x: 0, y: 0 } } },
        edges: {},
      },
      pack: null,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.path.includes("text"))).toBe(true);
    }
  });

  test("rejects edge referencing unknown card", () => {
    const result = validateSnapshot({
      version: 1,
      graph: {
        cards: { c1: { id: "c1", text: "A", position: { x: 0, y: 0 } } },
        edges: { e1: { id: "e1", from: "c1", to: "nonexistent" } },
      },
      pack: null,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.message.includes("nonexistent"))).toBe(true);
    }
  });

  test("rejects invalid pack within snapshot", () => {
    const result = validateSnapshot({
      version: 1,
      graph: { cards: {}, edges: {} },
      pack: { packId: 42 },
    });
    expect(result.valid).toBe(false);
    if (!result.valid) {
      expect(result.errors.some((e) => e.path.startsWith("pack."))).toBe(true);
    }
  });
});

describe("importSnapshotReplace", () => {
  test("replaces graph and pack", () => {
    const snapshot = buildSnapshot();
    const { graph, packStore } = makeGraphAndPack();

    // Add existing data that should be replaced
    graph.addCard("old card", { x: 100, y: 100 });

    importSnapshotReplace(snapshot, graph, packStore);

    expect(graph.allCards()).toHaveLength(2);
    expect(graph.allEdges()).toHaveLength(1);
    expect(packStore.isLoaded).toBe(true);
    expect(packStore.get()!.packId).toBe("rooms-and-items");
  });

  test("clears pack when snapshot has null pack", () => {
    const { graph: srcGraph, packStore: srcPack } = makeGraphAndPack();
    srcGraph.addCard("test", { x: 0, y: 0 });
    const snapshot = exportSnapshot(srcGraph, srcPack);

    const { graph, packStore } = makeGraphAndPack();
    packStore.load(DEFAULT_PACK);
    importSnapshotReplace(snapshot, graph, packStore);

    expect(packStore.isLoaded).toBe(false);
  });

  test("round-trips through export/replace", () => {
    const snapshot = buildSnapshot();
    const { graph, packStore } = makeGraphAndPack();
    importSnapshotReplace(snapshot, graph, packStore);

    const reexported = exportSnapshot(graph, packStore);
    expect(Object.keys(reexported.graph.cards)).toHaveLength(2);
    expect(Object.keys(reexported.graph.edges)).toHaveLength(1);
    expect(reexported.pack!.packId).toBe(snapshot.pack!.packId);
  });
});

describe("importSnapshotMerge", () => {
  test("generates new IDs for merged cards", () => {
    const snapshot = buildSnapshot();
    const { graph } = makeGraphAndPack();

    const existing = graph.addCard("existing", { x: -100, y: 0 });
    const idMap = importSnapshotMerge(snapshot, graph);

    // Original card still exists + 2 merged
    expect(graph.allCards()).toHaveLength(3);

    // All old IDs have mappings
    const snapshotCardIds = Object.keys(snapshot.graph.cards);
    for (const oldId of snapshotCardIds) {
      expect(idMap[oldId]).toBeDefined();
      expect(idMap[oldId]).not.toBe(oldId);
    }

    // Existing card was not affected
    expect(graph.getCard(existing.id)).toBeDefined();
  });

  test("remaps edges to new card IDs", () => {
    const snapshot = buildSnapshot();
    const { graph } = makeGraphAndPack();

    const idMap = importSnapshotMerge(snapshot, graph);

    const edges = graph.allEdges();
    expect(edges).toHaveLength(1);

    const edge = edges[0];
    const newIds = new Set(Object.values(idMap));
    expect(newIds.has(edge.from)).toBe(true);
    expect(newIds.has(edge.to)).toBe(true);
  });
});
