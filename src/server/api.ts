import * as Y from "yjs";
import type { RoomPersistence } from "./persist";
import type { Room } from "./types";

export interface ApiDeps {
  persistence: RoomPersistence;
  rooms: Map<string, Room>;
  destroyRoom: (name: string) => void;
}

interface RoomListEntry {
  name: string;
  updatedAt: number;
  active: boolean;
  connections: number;
}

export function handleApi(req: Request, path: string, deps: ApiDeps): Response | null {
  // GET /api/rooms
  if (path === "/api/rooms" && req.method === "GET") {
    return listRooms(deps);
  }

  // Match /api/rooms/:name
  const match = path.match(/^\/api\/rooms\/(.+)$/);
  if (!match) return null;
  const name = decodeURIComponent(match[1]);

  if (req.method === "GET") {
    return getRoomDetail(name, deps);
  }

  if (req.method === "DELETE") {
    return deleteRoom(name, deps);
  }

  return null;
}

function listRooms(deps: ApiDeps): Response {
  const { persistence, rooms } = deps;
  const persisted = persistence.listRooms();
  const seen = new Set<string>();
  const entries: RoomListEntry[] = [];

  // Persisted rooms first (sorted by updatedAt desc from DB)
  for (const row of persisted) {
    seen.add(row.name);
    const active = rooms.has(row.name);
    const connections = active ? rooms.get(row.name)!.conns.size : 0;
    entries.push({
      name: row.name,
      updatedAt: row.updatedAt,
      active,
      connections,
    });
  }

  // Active-only rooms (not yet persisted)
  for (const [name, room] of rooms) {
    if (seen.has(name)) continue;
    entries.push({
      name,
      updatedAt: Date.now(),
      active: true,
      connections: room.conns.size,
    });
  }

  return Response.json({ rooms: entries });
}

function getRoomDetail(name: string, deps: ApiDeps): Response {
  const { persistence, rooms } = deps;

  const activeRoom = rooms.get(name);
  const persisted = persistence.listRooms().find((r) => r.name === name);

  if (!activeRoom && !persisted) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  let cardCount = 0;
  let edgeCount = 0;

  // Decode Y.Doc state to get card/edge counts
  if (activeRoom) {
    cardCount = (activeRoom.doc.getMap("cards") as Y.Map<unknown>).size;
    edgeCount = (activeRoom.doc.getMap("edges") as Y.Map<unknown>).size;
  } else {
    const state = persistence.loadRoom(name);
    if (state) {
      const doc = new Y.Doc();
      Y.applyUpdate(doc, state);
      cardCount = (doc.getMap("cards") as Y.Map<unknown>).size;
      edgeCount = (doc.getMap("edges") as Y.Map<unknown>).size;
      doc.destroy();
    }
  }

  return Response.json({
    name,
    updatedAt: persisted?.updatedAt ?? Date.now(),
    active: !!activeRoom,
    connections: activeRoom?.conns.size ?? 0,
    cardCount,
    edgeCount,
  });
}

function deleteRoom(name: string, deps: ApiDeps): Response {
  const { persistence, rooms, destroyRoom } = deps;

  const activeRoom = rooms.get(name);
  const persisted = persistence.listRooms().find((r) => r.name === name);

  if (!activeRoom && !persisted) {
    return Response.json({ error: "Room not found" }, { status: 404 });
  }

  // Disconnect active connections and tear down in-memory room
  if (activeRoom) {
    destroyRoom(name);
  }

  persistence.deleteRoom(name);

  return new Response(null, { status: 204 });
}
