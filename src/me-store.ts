const PREFIX = "aspect:me:";

export class MeStore extends EventTarget {
  private ids: Set<string>;
  private storageKey: string;

  constructor(room: string) {
    super();
    this.storageKey = PREFIX + room;
    this.ids = this.load();
  }

  has(cardId: string): boolean {
    return this.ids.has(cardId);
  }

  add(cardId: string): void {
    if (this.ids.has(cardId)) return;
    this.ids.add(cardId);
    this.save();
    this.dispatchEvent(new Event("change"));
  }

  remove(cardId: string): void {
    if (!this.ids.delete(cardId)) return;
    this.save();
    this.dispatchEvent(new Event("change"));
  }

  toggle(cardId: string): void {
    if (this.ids.has(cardId)) {
      this.remove(cardId);
    } else {
      this.add(cardId);
    }
  }

  getAll(): string[] {
    return [...this.ids];
  }

  get size(): number {
    return this.ids.size;
  }

  /** Remove IDs not present in the given set of valid card IDs. */
  prune(validIds: Set<string>): void {
    let changed = false;
    for (const id of this.ids) {
      if (!validIds.has(id)) {
        this.ids.delete(id);
        changed = true;
      }
    }
    if (changed) {
      this.save();
      this.dispatchEvent(new Event("change"));
    }
  }

  private load(): Set<string> {
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (!raw) return new Set();
      const arr: unknown = JSON.parse(raw);
      if (!Array.isArray(arr)) return new Set();
      return new Set(arr.filter((v): v is string => typeof v === "string"));
    } catch {
      return new Set();
    }
  }

  private save(): void {
    if (this.ids.size === 0) {
      localStorage.removeItem(this.storageKey);
    } else {
      localStorage.setItem(this.storageKey, JSON.stringify([...this.ids]));
    }
  }
}
