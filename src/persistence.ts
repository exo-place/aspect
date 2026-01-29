import { IndexeddbPersistence } from "y-indexeddb";
import type * as Y from "yjs";

export function setupPersistence(roomName: string, doc: Y.Doc): IndexeddbPersistence {
  return new IndexeddbPersistence(`aspect:${roomName}`, doc);
}
