import type { ServerWebSocket } from "bun";
import type * as Y from "yjs";
import type * as awarenessProtocol from "y-protocols/awareness";

export interface WsData {
  roomName: string;
}

export type Conn = ServerWebSocket<WsData>;

export interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  conns: Map<Conn, Set<number>>;
}
