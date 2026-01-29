import { describe, expect, test } from "bun:test";
import * as Y from "yjs";
import { WorldPackStore } from "../src/pack";
import { createYDoc } from "../src/ydoc";
import { DEFAULT_PACK } from "../src/default-pack";
import type { WorldPack } from "../src/pack-types";

function makeStore() {
  const bundle = createYDoc();
  const store = new WorldPackStore(bundle);
  return { bundle, store };
}

const TEST_PACK: WorldPack = {
  packId: "test-pack",
  packVersion: 1,
  name: "Test Pack",
  description: "A test pack",
  kinds: [
    { id: "room", label: "Room", style: { color: "#56b6c2", icon: "\u{1F3E0}" } },
    { id: "item", label: "Item", style: { color: "#e5c07b" } },
    { id: "plain", label: "Plain" },
  ],
  edgeTypes: [
    { id: "exit", label: "exit", constraint: { from: ["room"], to: ["room"] } },
    { id: "contains", label: "contains", constraint: { from: ["room"], to: ["item"] } },
    { id: "link", label: "link" },
  ],
};

describe("WorldPackStore", () => {
  describe("load/get/clear", () => {
    test("isLoaded is false when empty", () => {
      const { store } = makeStore();
      expect(store.isLoaded).toBe(false);
    });

    test("get() returns null when empty", () => {
      const { store } = makeStore();
      expect(store.get()).toBeNull();
    });

    test("load sets pack and isLoaded becomes true", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.isLoaded).toBe(true);
    });

    test("get() returns loaded pack", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      const pack = store.get();
      expect(pack).not.toBeNull();
      expect(pack!.packId).toBe("test-pack");
      expect(pack!.packVersion).toBe(1);
      expect(pack!.name).toBe("Test Pack");
      expect(pack!.description).toBe("A test pack");
      expect(pack!.kinds).toHaveLength(3);
      expect(pack!.edgeTypes).toHaveLength(3);
    });

    test("clear removes pack", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      store.clear();
      expect(store.isLoaded).toBe(false);
      expect(store.get()).toBeNull();
    });

    test("load replaces existing pack", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      store.load({ ...TEST_PACK, packId: "other", name: "Other" });
      const pack = store.get();
      expect(pack!.packId).toBe("other");
      expect(pack!.name).toBe("Other");
    });
  });

  describe("kind lookup", () => {
    test("getKind returns kind by id", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      const kind = store.getKind("room");
      expect(kind).toBeDefined();
      expect(kind!.id).toBe("room");
      expect(kind!.label).toBe("Room");
      expect(kind!.style?.color).toBe("#56b6c2");
      expect(kind!.style?.icon).toBe("\u{1F3E0}");
    });

    test("getKind returns undefined for unknown id", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.getKind("nonexistent")).toBeUndefined();
    });

    test("getKind returns undefined when no pack loaded", () => {
      const { store } = makeStore();
      expect(store.getKind("room")).toBeUndefined();
    });

    test("kindIds returns all kind ids", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.kindIds()).toEqual(["room", "item", "plain"]);
    });

    test("kindIds returns empty when no pack", () => {
      const { store } = makeStore();
      expect(store.kindIds()).toEqual([]);
    });

    test("kind without style has no style property", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      const kind = store.getKind("plain");
      expect(kind).toBeDefined();
      expect(kind!.style).toBeUndefined();
    });
  });

  describe("edge type lookup", () => {
    test("getEdgeType returns edge type by id", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      const et = store.getEdgeType("exit");
      expect(et).toBeDefined();
      expect(et!.id).toBe("exit");
      expect(et!.label).toBe("exit");
      expect(et!.constraint?.from).toEqual(["room"]);
      expect(et!.constraint?.to).toEqual(["room"]);
    });

    test("getEdgeType returns undefined for unknown id", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.getEdgeType("nonexistent")).toBeUndefined();
    });

    test("getEdgeType returns undefined when no pack loaded", () => {
      const { store } = makeStore();
      expect(store.getEdgeType("exit")).toBeUndefined();
    });

    test("edge type without constraint has no constraint property", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      const et = store.getEdgeType("link");
      expect(et).toBeDefined();
      expect(et!.constraint).toBeUndefined();
    });
  });

  describe("validateEdge", () => {
    test("valid edge passes", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.validateEdge("exit", "room", "room")).toBe(true);
    });

    test("invalid from kind fails", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.validateEdge("exit", "item", "room")).toBe(false);
    });

    test("invalid to kind fails", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.validateEdge("exit", "room", "item")).toBe(false);
    });

    test("untyped from card passes through constraint", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.validateEdge("exit", undefined, "room")).toBe(true);
    });

    test("untyped to card passes through constraint", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.validateEdge("exit", "room", undefined)).toBe(true);
    });

    test("unconstrained edge type always passes", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.validateEdge("link", "room", "item")).toBe(true);
    });

    test("unknown edge type returns false", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      expect(store.validateEdge("nonexistent", "room", "room")).toBe(false);
    });
  });

  describe("onChange", () => {
    test("fires on load", () => {
      const { store } = makeStore();
      let called = false;
      store.onChange = () => { called = true; };
      store.load(TEST_PACK);
      expect(called).toBe(true);
    });

    test("fires on clear", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      let called = false;
      store.onChange = () => { called = true; };
      store.clear();
      expect(called).toBe(true);
    });
  });

  describe("CRDT sync", () => {
    test("pack syncs between two docs", () => {
      const bundle1 = createYDoc();
      const bundle2 = createYDoc();
      const store1 = new WorldPackStore(bundle1);
      const store2 = new WorldPackStore(bundle2);

      store1.load(TEST_PACK);

      // Sync doc1 → doc2
      const update = Y.encodeStateAsUpdate(bundle1.doc);
      Y.applyUpdate(bundle2.doc, update);

      expect(store2.isLoaded).toBe(true);
      const pack = store2.get();
      expect(pack!.packId).toBe("test-pack");
      expect(pack!.kinds).toHaveLength(3);
      expect(pack!.edgeTypes).toHaveLength(3);
    });
  });

  describe("toJSON round-trip", () => {
    test("get() returns data matching what was loaded", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      const pack = store.get()!;
      expect(pack.packId).toBe(TEST_PACK.packId);
      expect(pack.packVersion).toBe(TEST_PACK.packVersion);
      expect(pack.name).toBe(TEST_PACK.name);
      expect(pack.description).toBe(TEST_PACK.description);
      expect(pack.kinds).toHaveLength(TEST_PACK.kinds.length);
      expect(pack.edgeTypes).toHaveLength(TEST_PACK.edgeTypes.length);

      // Re-load from get result
      const { store: store2 } = makeStore();
      store2.load(pack);
      const pack2 = store2.get()!;
      expect(pack2.packId).toBe(TEST_PACK.packId);
      expect(pack2.kinds).toHaveLength(TEST_PACK.kinds.length);
    });
  });

  describe("validation on load", () => {
    test("throws on invalid pack", () => {
      const { store } = makeStore();
      expect(() => store.load({} as WorldPack)).toThrow("Invalid world pack");
    });

    test("succeeds on valid pack", () => {
      const { store } = makeStore();
      expect(() => store.load(TEST_PACK)).not.toThrow();
      expect(store.isLoaded).toBe(true);
    });
  });

  describe("JSON round-trip fidelity", () => {
    test("load → get → JSON.stringify → JSON.parse → load → get preserves data", () => {
      const { store } = makeStore();
      store.load(TEST_PACK);
      const json = JSON.stringify(store.get());
      const parsed = JSON.parse(json);
      const { store: store2 } = makeStore();
      store2.load(parsed);
      const result = store2.get()!;
      expect(result.packId).toBe(TEST_PACK.packId);
      expect(result.packVersion).toBe(TEST_PACK.packVersion);
      expect(result.name).toBe(TEST_PACK.name);
      expect(result.description).toBe(TEST_PACK.description);
      expect(result.kinds).toEqual(TEST_PACK.kinds);
      expect(result.edgeTypes).toEqual(TEST_PACK.edgeTypes);
    });
  });

  describe("default pack", () => {
    test("DEFAULT_PACK loads successfully", () => {
      const { store } = makeStore();
      store.load(DEFAULT_PACK);
      expect(store.isLoaded).toBe(true);
      const pack = store.get()!;
      expect(pack.packId).toBe("rooms-and-items");
      expect(pack.kinds).toHaveLength(3);
      expect(pack.edgeTypes).toHaveLength(3);
    });
  });
});
