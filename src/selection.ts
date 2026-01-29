export type SelectionCallback = () => void;

export class Selection {
  private ids = new Set<string>();

  onChange: SelectionCallback | null = null;

  set(id: string | null): void {
    this.ids.clear();
    if (id !== null) this.ids.add(id);
    this.notify();
  }

  add(id: string): void {
    this.ids.add(id);
    this.notify();
  }

  remove(id: string): void {
    this.ids.delete(id);
    this.notify();
  }

  toggle(id: string): void {
    if (this.ids.has(id)) {
      this.ids.delete(id);
    } else {
      this.ids.add(id);
    }
    this.notify();
  }

  clear(): void {
    this.ids.clear();
    this.notify();
  }

  has(id: string): boolean {
    return this.ids.has(id);
  }

  get size(): number {
    return this.ids.size;
  }

  toArray(): string[] {
    return [...this.ids];
  }

  private notify(): void {
    this.onChange?.();
  }
}
