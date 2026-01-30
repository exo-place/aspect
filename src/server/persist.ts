import { Database } from "bun:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

export class RoomPersistence {
  private db: Database;
  private stmtLoad: ReturnType<Database["prepare"]>;
  private stmtSave: ReturnType<Database["prepare"]>;
  private stmtDelete: ReturnType<Database["prepare"]>;
  private stmtList: ReturnType<Database["prepare"]>;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.exec("PRAGMA journal_mode=WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS rooms (
        name       TEXT PRIMARY KEY,
        state      BLOB NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.stmtLoad = this.db.prepare("SELECT state FROM rooms WHERE name = ?");
    this.stmtSave = this.db.prepare(
      "INSERT INTO rooms (name, state, updated_at) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET state = excluded.state, updated_at = excluded.updated_at",
    );
    this.stmtDelete = this.db.prepare("DELETE FROM rooms WHERE name = ?");
    this.stmtList = this.db.prepare(
      "SELECT name, updated_at FROM rooms ORDER BY updated_at DESC",
    );
  }

  loadRoom(name: string): Uint8Array | null {
    const row = this.stmtLoad.get(name) as { state: Buffer } | null;
    if (!row) return null;
    return new Uint8Array(row.state);
  }

  saveRoom(name: string, state: Uint8Array): void {
    this.stmtSave.run(name, state, Date.now());
  }

  deleteRoom(name: string): void {
    this.stmtDelete.run(name);
  }

  listRooms(): Array<{ name: string; updatedAt: number }> {
    const rows = this.stmtList.all() as Array<{
      name: string;
      updated_at: number;
    }>;
    return rows.map((r) => ({ name: r.name, updatedAt: r.updated_at }));
  }

  close(): void {
    this.db.close();
  }
}
