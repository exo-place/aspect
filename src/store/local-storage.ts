import type { CardGraphData } from "../types";
import type { Store } from "./store";

const DEFAULT_KEY = "aspect:graph";

export class LocalStorageStore implements Store {
  constructor(private key: string = DEFAULT_KEY) {}

  async save(data: CardGraphData): Promise<void> {
    localStorage.setItem(this.key, JSON.stringify(data));
  }

  async load(): Promise<CardGraphData | null> {
    const raw = localStorage.getItem(this.key);
    if (raw === null) return null;
    return JSON.parse(raw) as CardGraphData;
  }

  async clear(): Promise<void> {
    localStorage.removeItem(this.key);
  }
}
