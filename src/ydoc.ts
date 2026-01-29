import * as Y from "yjs";

export interface YDocBundle {
  doc: Y.Doc;
  cards: Y.Map<Y.Map<unknown>>;
  edges: Y.Map<Y.Map<unknown>>;
  pack: Y.Map<unknown>;
}

export function createYDoc(): YDocBundle {
  const doc = new Y.Doc();
  const cards = doc.getMap("cards") as Y.Map<Y.Map<unknown>>;
  const edges = doc.getMap("edges") as Y.Map<Y.Map<unknown>>;
  const pack = doc.getMap("pack") as Y.Map<unknown>;
  return { doc, cards, edges, pack };
}
