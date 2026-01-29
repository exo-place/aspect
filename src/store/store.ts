import type { CardGraphData } from "../types";

export interface Store {
  save(data: CardGraphData): Promise<void>;
  load(): Promise<CardGraphData | null>;
  clear(): Promise<void>;
}
