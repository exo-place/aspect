export interface Position {
  x: number;
  y: number;
}

export interface Card {
  readonly id: string;
  text: string;
  position: Position;
  kind?: string;
}

export interface Edge {
  readonly id: string;
  readonly from: string;
  readonly to: string;
  label?: string;
  type?: string;
}

export interface CardGraphData {
  cards: Record<string, Card>;
  edges: Record<string, Edge>;
}
