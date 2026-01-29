// In-memory localStorage mock for tests
const storage = new Map<string, string>();

globalThis.localStorage = {
  getItem(key: string): string | null {
    return storage.get(key) ?? null;
  },
  setItem(key: string, value: string): void {
    storage.set(key, value);
  },
  removeItem(key: string): void {
    storage.delete(key);
  },
  clear(): void {
    storage.clear();
  },
  get length(): number {
    return storage.size;
  },
  key(index: number): string | null {
    const keys = [...storage.keys()];
    return keys[index] ?? null;
  },
};
