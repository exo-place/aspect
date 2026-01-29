import { WebsocketProvider } from "y-websocket";
import { CardGraph } from "./graph";
import { setupPersistence } from "./persistence";
import { createYDoc } from "./ydoc";
import { App } from "./ui/app";

function getRoomName(): string {
  const match = location.pathname.match(/^\/room\/(.+)$/);
  return match ? match[1] : "default";
}

async function migrateOldStore(graph: CardGraph): Promise<void> {
  // One-time migration from old IndexedDB store
  const DB_NAME = "aspect";
  const STORE_NAME = "graph";
  const DATA_KEY = "data";

  try {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, 1);
      request.onupgradeneeded = () => {
        // DB didn't exist — nothing to migrate
        request.result.close();
        reject(new Error("no old data"));
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    const data = await new Promise<unknown>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const request = tx.objectStore(STORE_NAME).get(DATA_KEY);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });

    if (data && typeof data === "object" && "cards" in data && "edges" in data) {
      graph.loadJSON(data as { cards: Record<string, import("./types").Card>; edges: Record<string, import("./types").Edge> });

      // Clear old store
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        tx.objectStore(STORE_NAME).delete(DATA_KEY);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    }

    db.close();
  } catch {
    // No old data or DB doesn't exist — nothing to migrate
  }
}

async function main() {
  const container = document.getElementById("app");
  if (!container) throw new Error("Missing #app element");

  const roomName = getRoomName();
  const bundle = createYDoc();
  const { doc } = bundle;

  // Set up IndexedDB persistence for offline
  const persistence = setupPersistence(roomName, doc);

  // Connect WebSocket provider for multiplayer
  const wsProtocol = location.protocol === "https:" ? "wss:" : "ws:";
  new WebsocketProvider(`${wsProtocol}//${location.host}/ws/${roomName}`, roomName, doc);

  // Wait for local persistence to sync
  await persistence.whenSynced;

  const graph = new CardGraph(bundle);

  // Migrate old data if Y.Doc is empty
  if (graph.allCards().length === 0) {
    await migrateOldStore(graph);
  }

  const app = new App(container, graph, bundle);
  app.bootstrap();
}

main();

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}
