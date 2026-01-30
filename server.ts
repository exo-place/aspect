import * as Y from "yjs";
import * as syncProtocol from "y-protocols/sync";
import * as awarenessProtocol from "y-protocols/awareness";
import * as encoding from "lib0/encoding";
import * as decoding from "lib0/decoding";
import { RoomPersistence } from "./src/server/persist";
import { DebouncedSaver } from "./src/server/debounce";
import { handleApi } from "./src/server/api";
import type { WsData, Conn, Room } from "./src/server/types";

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

const rooms = new Map<string, Room>();
const persistence = new RoomPersistence((process.env.DATA_DIR || "./data") + "/aspect.db");

function saveRoom(roomName: string): void {
  const room = rooms.get(roomName);
  if (!room) return;
  const state = Y.encodeStateAsUpdate(room.doc);
  persistence.saveRoom(roomName, state);
}

const saver = new DebouncedSaver(2000, saveRoom);

function getRoom(name: string): Room {
  let room = rooms.get(name);
  if (room) return room;

  const doc = new Y.Doc();

  // Restore persisted state
  const saved = persistence.loadRoom(name);
  if (saved) {
    Y.applyUpdate(doc, saved);
  }

  const awareness = new awarenessProtocol.Awareness(doc);
  awareness.setLocalState(null);

  awareness.on("update", ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    const changedClients = [...added, ...updated, ...removed];
    const room = rooms.get(name);
    if (!room) return;
    const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changedClients);
    const msg = createAwarenessMessage(update);
    for (const ws of room.conns.keys()) {
      ws.send(msg);
    }
  });

  // Schedule persistence on doc updates
  doc.on("update", () => {
    saver.schedule(name);
  });

  room = { doc, awareness, conns: new Map() };
  rooms.set(name, room);
  return room;
}

function destroyRoom(name: string): void {
  const room = rooms.get(name);
  if (!room) return;

  // Close all connections
  for (const ws of room.conns.keys()) {
    ws.close(1000, "room deleted");
  }

  saver.flush(name);
  room.awareness.destroy();
  room.doc.destroy();
  rooms.delete(name);
}

function createAwarenessMessage(update: Uint8Array): Uint8Array {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_AWARENESS);
  encoding.writeVarUint8Array(encoder, update);
  return encoding.toUint8Array(encoder);
}

function broadcastUpdate(room: Room, update: Uint8Array, origin: Conn | null): void {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeUpdate(encoder, update);
  const msg = encoding.toUint8Array(encoder);
  for (const ws of room.conns.keys()) {
    if (ws !== origin) {
      ws.send(msg);
    }
  }
}

function shutdown(): void {
  // Save all active rooms before exit
  for (const roomName of rooms.keys()) {
    saver.flush(roomName);
  }
  saver.destroy();
  persistence.close();
  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

const isProduction = process.env.NODE_ENV === "production";

const server = Bun.serve<WsData>({
  port: Number(process.env.PORT) || 3000,
  async fetch(req, server) {
    const url = new URL(req.url);
    const path = url.pathname;

    // WebSocket upgrade for /ws/:room
    const wsMatch = path.match(/^\/ws\/(.+)$/);
    if (wsMatch && req.headers.get("upgrade")?.toLowerCase() === "websocket") {
      const roomName = wsMatch[1];
      const upgraded = server.upgrade(req, { data: { roomName } });
      if (upgraded) return undefined as unknown as Response;
      return new Response("WebSocket upgrade failed", { status: 400 });
    }

    // REST API
    if (path.startsWith("/api/")) {
      const res = handleApi(req, path, { persistence, rooms, destroyRoom });
      if (res) return res;
      return Response.json({ error: "Not found" }, { status: 404 });
    }

    // Lobby
    if (path === "/") {
      return new Response(Bun.file("./public/lobby.html"));
    }

    // Production: serve from dist/
    if (isProduction) {
      if (path.startsWith("/dist/")) {
        const file = Bun.file(`.${path}`);
        if (await file.exists()) {
          const headers: Record<string, string> = {};
          if (path.endsWith(".js")) {
            headers["Content-Type"] = "application/javascript";
            headers["Cache-Control"] = "public, max-age=31536000, immutable";
          } else if (path.endsWith(".js.map")) {
            headers["Content-Type"] = "application/json";
          }
          return new Response(file, { headers });
        }
      }
    }

    // Dev: resolve paths
    const servePath = path.startsWith("/room/") ? "/public/index.html" : path;

    // Serve CSS files directly
    if (servePath.endsWith(".css")) {
      const css = Bun.file(`.${servePath}`);
      if (await css.exists()) {
        return new Response(css, {
          headers: { "Content-Type": "text/css" },
        });
      }
    }

    // Bundle TypeScript from src/
    if (!isProduction && servePath.startsWith("/src/") && servePath.endsWith(".ts")) {
      const src = Bun.file(`.${servePath}`);
      if (await src.exists()) {
        const built = await Bun.build({ entrypoints: [`.${servePath}`], target: "browser" });
        const output = built.outputs[0];
        return new Response(output, {
          headers: { "Content-Type": "application/javascript" },
        });
      }
    }

    // Static files from public/
    const file = Bun.file(
      servePath.startsWith("/public/") ? `.${servePath}` : `./public${servePath}`,
    );
    if (await file.exists()) return new Response(file);

    // SPA fallback for /room/* paths
    if (path.startsWith("/room/")) {
      return new Response(Bun.file("./public/index.html"));
    }

    return new Response("Not found", { status: 404 });
  },
  websocket: {
    open(ws) {
      try {
        const { roomName } = ws.data;
        const room = getRoom(roomName);
        room.conns.set(ws, new Set());

        // Listen for doc updates to broadcast
        const onUpdate = (update: Uint8Array, origin: unknown) => {
          broadcastUpdate(room, update, origin as Conn | null);
        };
        room.doc.on("update", onUpdate);

        // Send sync step 1
        const syncEncoder = encoding.createEncoder();
        encoding.writeVarUint(syncEncoder, MSG_SYNC);
        syncProtocol.writeSyncStep1(syncEncoder, room.doc);
        ws.send(encoding.toUint8Array(syncEncoder));

        // Send current awareness states
        const clients = [...room.awareness.getStates().keys()];
        if (clients.length > 0) {
          const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(room.awareness, clients);
          ws.send(createAwarenessMessage(awarenessUpdate));
        }
      } catch (e) {
        console.error(`WebSocket open error [${ws.data.roomName}]:`, e);
      }
    },
    message(ws, message) {
      try {
        const { roomName } = ws.data;
        const room = rooms.get(roomName);
        if (!room) return;

        const data = message instanceof ArrayBuffer ? new Uint8Array(message) : message;
        if (typeof data === "string") return;

        const decoder = decoding.createDecoder(data);
        const messageType = decoding.readVarUint(decoder);

        switch (messageType) {
          case MSG_SYNC: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, MSG_SYNC);
            syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
            const reply = encoding.toUint8Array(encoder);
            // Only send if encoder has content beyond the message type
            if (reply.length > 1) {
              ws.send(reply);
            }
            break;
          }
          case MSG_AWARENESS: {
            const update = decoding.readVarUint8Array(decoder);
            awarenessProtocol.applyAwarenessUpdate(room.awareness, update, ws);
            break;
          }
        }
      } catch (e) {
        console.error(`WebSocket message error [${ws.data.roomName}]:`, e);
      }
    },
    close(ws) {
      const { roomName } = ws.data;
      const room = rooms.get(roomName);
      if (!room) return;

      const controlledIds = room.conns.get(ws);
      room.conns.delete(ws);

      if (controlledIds) {
        awarenessProtocol.removeAwarenessStates(room.awareness, [...controlledIds], null);
      }

      // Clean up empty rooms
      if (room.conns.size === 0) {
        saver.flush(roomName);
        room.awareness.destroy();
        room.doc.destroy();
        rooms.delete(roomName);
      }
    },
  },
});

console.log(`aspect ${isProduction ? "production" : "dev"} server: http://localhost:${server.port}`);
