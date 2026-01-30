import { afterEach, describe, expect, test } from "bun:test";
import { unlinkSync } from "node:fs";
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";
import { RoomPersistence } from "../src/server/persist";
import { handleApi, type ApiDeps } from "../src/server/api";
import type { Room } from "../src/server/types";

const TEST_DB = "/tmp/aspect-api-test.db";

function cleanup() {
  for (const suffix of ["", "-wal", "-shm", "-journal"]) {
    try {
      unlinkSync(TEST_DB + suffix);
    } catch {
      // ignore
    }
  }
}

function makeDeps(overrides?: Partial<ApiDeps>): ApiDeps {
  const persistence = new RoomPersistence(TEST_DB);
  return {
    persistence,
    rooms: new Map<string, Room>(),
    destroyRoom: () => {},
    ...overrides,
  };
}

function makeRoom(): Room {
  const doc = new Y.Doc();
  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null);
  return { doc, awareness, conns: new Map() };
}

function req(method: string, path: string): Request {
  return new Request(`http://localhost${path}`, { method });
}

afterEach(() => {
  cleanup();
});

describe("GET /api/rooms", () => {
  test("returns empty list with no rooms", async () => {
    const deps = makeDeps();
    const res = handleApi(req("GET", "/api/rooms"), "/api/rooms", deps)!;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rooms).toEqual([]);
    deps.persistence.close();
  });

  test("returns persisted rooms", async () => {
    const deps = makeDeps();
    deps.persistence.saveRoom("alpha", new Uint8Array([1]));
    deps.persistence.saveRoom("beta", new Uint8Array([2]));

    const res = handleApi(req("GET", "/api/rooms"), "/api/rooms", deps)!;
    const body = await res.json();
    expect(body.rooms).toHaveLength(2);
    const names = body.rooms.map((r: { name: string }) => r.name).sort();
    expect(names).toEqual(["alpha", "beta"]);
    expect(body.rooms[0].active).toBe(false);
    expect(body.rooms[0].connections).toBe(0);
    deps.persistence.close();
  });

  test("returns active-only rooms not yet persisted", async () => {
    const deps = makeDeps();
    deps.rooms.set("live-room", makeRoom());

    const res = handleApi(req("GET", "/api/rooms"), "/api/rooms", deps)!;
    const body = await res.json();
    expect(body.rooms).toHaveLength(1);
    expect(body.rooms[0].name).toBe("live-room");
    expect(body.rooms[0].active).toBe(true);
    deps.persistence.close();
  });

  test("merges persisted and active rooms", async () => {
    const deps = makeDeps();
    deps.persistence.saveRoom("shared", new Uint8Array([1]));
    deps.rooms.set("shared", makeRoom());
    deps.rooms.set("ephemeral", makeRoom());

    const res = handleApi(req("GET", "/api/rooms"), "/api/rooms", deps)!;
    const body = await res.json();
    expect(body.rooms).toHaveLength(2);

    const shared = body.rooms.find((r: { name: string }) => r.name === "shared");
    const ephemeral = body.rooms.find((r: { name: string }) => r.name === "ephemeral");
    expect(shared.active).toBe(true);
    expect(ephemeral.active).toBe(true);
    deps.persistence.close();
  });
});

describe("GET /api/rooms/:name", () => {
  test("returns room detail with card/edge counts from persisted state", async () => {
    const deps = makeDeps();

    // Build a Y.Doc with cards and edges
    const doc = new Y.Doc();
    const cards = doc.getMap("cards") as Y.Map<Y.Map<unknown>>;
    const edges = doc.getMap("edges") as Y.Map<Y.Map<unknown>>;
    doc.transact(() => {
      const c1 = new Y.Map<unknown>();
      c1.set("text", "A");
      cards.set("c1", c1);
      const c2 = new Y.Map<unknown>();
      c2.set("text", "B");
      cards.set("c2", c2);
      const e1 = new Y.Map<unknown>();
      e1.set("from", "c1");
      e1.set("to", "c2");
      edges.set("e1", e1);
    });
    deps.persistence.saveRoom("world", Y.encodeStateAsUpdate(doc));

    const res = handleApi(req("GET", "/api/rooms/world"), "/api/rooms/world", deps)!;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("world");
    expect(body.cardCount).toBe(2);
    expect(body.edgeCount).toBe(1);
    expect(body.active).toBe(false);
    deps.persistence.close();
  });

  test("returns room detail from active room", async () => {
    const deps = makeDeps();
    const room = makeRoom();
    const cards = room.doc.getMap("cards") as Y.Map<Y.Map<unknown>>;
    room.doc.transact(() => {
      const c1 = new Y.Map<unknown>();
      c1.set("text", "X");
      cards.set("c1", c1);
    });
    deps.rooms.set("active-world", room);

    const res = handleApi(req("GET", "/api/rooms/active-world"), "/api/rooms/active-world", deps)!;
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.cardCount).toBe(1);
    expect(body.active).toBe(true);
    deps.persistence.close();
  });

  test("returns 404 for unknown room", async () => {
    const deps = makeDeps();
    const res = handleApi(req("GET", "/api/rooms/nope"), "/api/rooms/nope", deps)!;
    expect(res.status).toBe(404);
    deps.persistence.close();
  });
});

describe("DELETE /api/rooms/:name", () => {
  test("deletes persisted room", async () => {
    const deps = makeDeps();
    deps.persistence.saveRoom("doomed", new Uint8Array([1]));

    const res = handleApi(req("DELETE", "/api/rooms/doomed"), "/api/rooms/doomed", deps)!;
    expect(res.status).toBe(204);

    // Verify room is gone
    expect(deps.persistence.loadRoom("doomed")).toBeNull();
    deps.persistence.close();
  });

  test("calls destroyRoom for active room", async () => {
    const deps = makeDeps();
    let destroyed = false;
    deps.destroyRoom = (name: string) => {
      expect(name).toBe("live");
      destroyed = true;
    };
    deps.rooms.set("live", makeRoom());

    const res = handleApi(req("DELETE", "/api/rooms/live"), "/api/rooms/live", deps)!;
    expect(res.status).toBe(204);
    expect(destroyed).toBe(true);
    deps.persistence.close();
  });

  test("returns 404 for unknown room", async () => {
    const deps = makeDeps();
    const res = handleApi(req("DELETE", "/api/rooms/ghost"), "/api/rooms/ghost", deps)!;
    expect(res.status).toBe(404);
    deps.persistence.close();
  });
});

describe("unmatched routes", () => {
  test("returns null for unknown API paths", () => {
    const deps = makeDeps();
    const res = handleApi(req("GET", "/api/unknown"), "/api/unknown", deps);
    expect(res).toBeNull();
    deps.persistence.close();
  });

  test("returns null for unsupported methods", () => {
    const deps = makeDeps();
    const res = handleApi(req("PUT", "/api/rooms/test"), "/api/rooms/test", deps);
    expect(res).toBeNull();
    deps.persistence.close();
  });
});
