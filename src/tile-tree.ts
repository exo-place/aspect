import type { TileLeaf, TileNode, TileSplit } from "./tile-types";
import { createId } from "./id";

export function createLeaf(meCardId: string): TileLeaf {
  return {
    type: "leaf",
    id: createId(),
    meCardId,
    expandedIds: new Set(),
    path: [meCardId],
  };
}

export function findLeaf(tree: TileNode, paneId: string): TileLeaf | null {
  if (tree.type === "leaf") return tree.id === paneId ? tree : null;
  return findLeaf(tree.a, paneId) ?? findLeaf(tree.b, paneId);
}

export function allLeaves(tree: TileNode): TileLeaf[] {
  if (tree.type === "leaf") return [tree];
  return [...allLeaves(tree.a), ...allLeaves(tree.b)];
}

export function splitPane(
  tree: TileNode,
  paneId: string,
  direction: "horizontal" | "vertical",
  newLeaf: TileLeaf,
): TileNode {
  if (tree.type === "leaf") {
    if (tree.id !== paneId) return tree;
    return { type: "split", direction, ratio: 0.5, a: tree, b: newLeaf };
  }
  const newA = splitPane(tree.a, paneId, direction, newLeaf);
  if (newA !== tree.a) return { ...tree, a: newA };
  const newB = splitPane(tree.b, paneId, direction, newLeaf);
  if (newB !== tree.b) return { ...tree, b: newB };
  return tree;
}

export function removePane(tree: TileNode, paneId: string): TileNode | null {
  if (tree.type === "leaf") return tree.id === paneId ? null : tree;
  const newA = removePane(tree.a, paneId);
  const newB = removePane(tree.b, paneId);
  if (newA === null) return newB;
  if (newB === null) return newA;
  if (newA !== tree.a || newB !== tree.b) return { ...tree, a: newA, b: newB };
  return tree;
}

export function toggleExpanded(tree: TileNode, paneId: string, cardId: string): TileNode {
  if (tree.type === "leaf") {
    if (tree.id !== paneId) return tree;
    const next = new Set(tree.expandedIds);
    if (next.has(cardId)) next.delete(cardId);
    else next.add(cardId);
    return { ...tree, expandedIds: next };
  }
  const newA = toggleExpanded(tree.a, paneId, cardId);
  if (newA !== tree.a) return { ...tree, a: newA };
  const newB = toggleExpanded(tree.b, paneId, cardId);
  if (newB !== tree.b) return { ...tree, b: newB };
  return tree;
}

export function drillDown(tree: TileNode, paneId: string, cardId: string): TileNode {
  if (tree.type === "leaf") {
    if (tree.id !== paneId) return tree;
    return { ...tree, path: [...tree.path, cardId], expandedIds: new Set() };
  }
  const newA = drillDown(tree.a, paneId, cardId);
  if (newA !== tree.a) return { ...tree, a: newA };
  const newB = drillDown(tree.b, paneId, cardId);
  if (newB !== tree.b) return { ...tree, b: newB };
  return tree;
}

export function breadcrumbTo(tree: TileNode, paneId: string, index: number): TileNode {
  if (tree.type === "leaf") {
    if (tree.id !== paneId) return tree;
    return { ...tree, path: tree.path.slice(0, index + 1), expandedIds: new Set() };
  }
  const newA = breadcrumbTo(tree.a, paneId, index);
  if (newA !== tree.a) return { ...tree, a: newA };
  const newB = breadcrumbTo(tree.b, paneId, index);
  if (newB !== tree.b) return { ...tree, b: newB };
  return tree;
}

export function resizeSplit(tree: TileNode, splitId: string, ratio: number): TileNode {
  if (tree.type === "leaf") return tree;
  const split = tree as TileSplit;
  if (splitId === splitNodeId(split)) {
    return { ...split, ratio: Math.max(0.1, Math.min(0.9, ratio)) };
  }
  const newA = resizeSplit(split.a, splitId, ratio);
  if (newA !== split.a) return { ...split, a: newA };
  const newB = resizeSplit(split.b, splitId, ratio);
  if (newB !== split.b) return { ...split, b: newB };
  return tree;
}

/** Derive a stable-ish ID for a split node from its children. */
export function splitNodeId(split: TileSplit): string {
  const aId = split.a.type === "leaf" ? split.a.id : splitNodeId(split.a);
  const bId = split.b.type === "leaf" ? split.b.id : splitNodeId(split.b);
  return `split:${aId}|${bId}`;
}

export function buildBalancedTree(meCardIds: string[]): TileNode | null {
  if (meCardIds.length === 0) return null;
  if (meCardIds.length === 1) return createLeaf(meCardIds[0]);

  const leaves = meCardIds.map(createLeaf);
  return buildSubtree(leaves, 0);
}

function buildSubtree(leaves: TileLeaf[], depth: number): TileNode {
  if (leaves.length === 1) return leaves[0];
  const mid = Math.ceil(leaves.length / 2);
  const left = buildSubtree(leaves.slice(0, mid), depth + 1);
  const right = buildSubtree(leaves.slice(mid), depth + 1);
  const direction = depth % 2 === 0 ? "horizontal" as const : "vertical" as const;
  return { type: "split", direction, ratio: 0.5, a: left, b: right };
}

export function currentCard(leaf: TileLeaf): string {
  return leaf.path[leaf.path.length - 1];
}
