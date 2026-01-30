import { afterEach, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import { RoomPersistence } from "../src/server/persist";
import * as Y from "yjs";

const TEST_DB = "/tmp/aspect-persist-test.db";

function cleanup() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try {
      unlinkSync(TEST_DB + suffix);
    } catch {
      // ignore
    }
  }
}

function makePersistence(): RoomPersistence {
  cleanup();
  return new RoomPersistence(TEST_DB);
}

afterEach(() => {
  cleanup();
});

describe("RoomPersistence", () => {
  test("loadRoom returns null for unknown room", () => {
    const p = makePersistence();
    expect(p.loadRoom("nonexistent")).toBeNull();
    p.close();
  });

  test("saveRoom + loadRoom round-trips state", () => {
    const p = makePersistence();
    const state = new Uint8Array([1, 2, 3, 4, 5]);
    p.saveRoom("test-room", state);
    const loaded = p.loadRoom("test-room");
    expect(loaded).toEqual(state);
    p.close();
  });

  test("saveRoom upserts (overwrites existing)", () => {
    const p = makePersistence();
    p.saveRoom("room", new Uint8Array([1]));
    p.saveRoom("room", new Uint8Array([2, 3]));
    const loaded = p.loadRoom("room");
    expect(loaded).toEqual(new Uint8Array([2, 3]));
    p.close();
  });

  test("deleteRoom removes the room", () => {
    const p = makePersistence();
    p.saveRoom("room", new Uint8Array([1]));
    p.deleteRoom("room");
    expect(p.loadRoom("room")).toBeNull();
    p.close();
  });

  test("deleteRoom is no-op for unknown room", () => {
    const p = makePersistence();
    p.deleteRoom("nonexistent"); // should not throw
    p.close();
  });

  test("listRooms returns all rooms sorted by updated_at desc", () => {
    const p = makePersistence();
    p.saveRoom("old", new Uint8Array([1]));
    // Ensure different timestamps
    p.saveRoom("new", new Uint8Array([2]));
    const list = p.listRooms();
    expect(list).toHaveLength(2);
    expect(list[0].name).toBe("new");
    expect(list[1].name).toBe("old");
    expect(list[0].updatedAt).toBeGreaterThanOrEqual(list[1].updatedAt);
    p.close();
  });

  test("listRooms returns empty array when no rooms", () => {
    const p = makePersistence();
    expect(p.listRooms()).toEqual([]);
    p.close();
  });

  test("full Y.Doc round-trip preserves cards, edges, pack, and events", () => {
    const p = makePersistence();

    // Build a Y.Doc with data in all four structures
    const doc = new Y.Doc();
    const cards = doc.getMap("cards") as Y.Map<Y.Map<unknown>>;
    const edges = doc.getMap("edges") as Y.Map<Y.Map<unknown>>;
    const pack = doc.getMap("pack") as Y.Map<unknown>;
    const events = doc.getArray("events") as Y.Array<Y.Map<unknown>>;

    doc.transact(() => {
      const card = new Y.Map<unknown>();
      card.set("text", "Hello");
      card.set("x", 10);
      card.set("y", 20);
      card.set("kind", "room");
      cards.set("c1", card);

      const card2 = new Y.Map<unknown>();
      card2.set("text", "World");
      card2.set("x", 100);
      card2.set("y", 200);
      cards.set("c2", card2);

      const edge = new Y.Map<unknown>();
      edge.set("from", "c1");
      edge.set("to", "c2");
      edge.set("type", "exit");
      edges.set("e1", edge);

      pack.set("packId", "test-pack");
      pack.set("name", "Test Pack");

      const event = new Y.Map<unknown>();
      event.set("timestamp", 12345);
      event.set("actionId", "test");
      events.push([event]);
    });

    // Save the state
    const state = Y.encodeStateAsUpdate(doc);
    p.saveRoom("world", state);

    // Load into a fresh doc
    const doc2 = new Y.Doc();
    const loaded = p.loadRoom("world");
    expect(loaded).not.toBeNull();
    Y.applyUpdate(doc2, loaded!);

    // Verify all structures
    const cards2 = doc2.getMap("cards") as Y.Map<Y.Map<unknown>>;
    const edges2 = doc2.getMap("edges") as Y.Map<Y.Map<unknown>>;
    const pack2 = doc2.getMap("pack") as Y.Map<unknown>;
    const events2 = doc2.getArray("events") as Y.Array<Y.Map<unknown>>;

    expect(cards2.size).toBe(2);
    expect((cards2.get("c1") as Y.Map<unknown>).get("text")).toBe("Hello");
    expect((cards2.get("c1") as Y.Map<unknown>).get("kind")).toBe("room");
    expect((cards2.get("c2") as Y.Map<unknown>).get("text")).toBe("World");

    expect(edges2.size).toBe(1);
    expect((edges2.get("e1") as Y.Map<unknown>).get("from")).toBe("c1");
    expect((edges2.get("e1") as Y.Map<unknown>).get("type")).toBe("exit");

    expect(pack2.get("packId")).toBe("test-pack");
    expect(pack2.get("name")).toBe("Test Pack");

    expect(events2.length).toBe(1);
    expect((events2.get(0) as Y.Map<unknown>).get("actionId")).toBe("test");

    p.close();
  });
});
