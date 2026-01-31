export interface TileLeaf {
  type: "leaf";
  id: string;
  meCardId: string;
  expandedIds: Set<string>;
  path: string[];
}

export interface TileSplit {
  type: "split";
  direction: "horizontal" | "vertical";
  ratio: number;
  a: TileNode;
  b: TileNode;
}

export type TileNode = TileLeaf | TileSplit;

export interface TileLayoutEvents {
  onToggleExpand(paneId: string, cardId: string): void;
  onDrillDown(paneId: string, cardId: string): void;
  onBreadcrumb(paneId: string, index: number): void;
  onEditText(cardId: string, newText: string): void;
  onAffordance(paneId: string, actionId: string, targetCardId: string): void;
  onClose(paneId: string): void;
}
