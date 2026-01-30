export class DebouncedSaver {
  private timers = new Map<string, ReturnType<typeof setTimeout>>();
  private delayMs: number;
  private onSave: (roomName: string) => void;

  constructor(delayMs: number, onSave: (roomName: string) => void) {
    this.delayMs = delayMs;
    this.onSave = onSave;
  }

  schedule(roomName: string): void {
    const existing = this.timers.get(roomName);
    if (existing !== undefined) clearTimeout(existing);
    this.timers.set(
      roomName,
      setTimeout(() => {
        this.timers.delete(roomName);
        this.onSave(roomName);
      }, this.delayMs),
    );
  }

  flush(roomName: string): void {
    const existing = this.timers.get(roomName);
    if (existing === undefined) return;
    clearTimeout(existing);
    this.timers.delete(roomName);
    this.onSave(roomName);
  }

  destroy(): void {
    for (const timer of this.timers.values()) {
      clearTimeout(timer);
    }
    this.timers.clear();
  }
}
