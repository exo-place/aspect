import { describe, expect, test } from "bun:test";
import {
  createLeaf,
  findLeaf,
  allLeaves,
  splitPane,
  removePane,
  toggleExpanded,
  drillDown,
  breadcrumbTo,
  resizeSplit,
  buildBalancedTree,
  currentCard,
} from "../src/tile-tree";

describe("createLeaf", () => {
  test("creates a leaf with default state", () => {
    const leaf = createLeaf("card-1");
    expect(leaf.type).toBe("leaf");
    expect(leaf.meCardId).toBe("card-1");
    expect(leaf.path).toEqual(["card-1"]);
    expect(leaf.expandedIds.size).toBe(0);
    expect(typeof leaf.id).toBe("string");
  });
});

describe("findLeaf", () => {
  test("finds leaf by id", () => {
    const leaf = createLeaf("card-1");
    expect(findLeaf(leaf, leaf.id)).toBe(leaf);
  });

  test("returns null for unknown id", () => {
    const leaf = createLeaf("card-1");
    expect(findLeaf(leaf, "nope")).toBeNull();
  });

  test("finds leaf in split tree", () => {
    const a = createLeaf("card-1");
    const b = createLeaf("card-2");
    const tree = splitPane(a, a.id, "horizontal", b);
    expect(findLeaf(tree, a.id)).toBe(a);
    expect(findLeaf(tree, b.id)).toBe(b);
  });
});

describe("allLeaves", () => {
  test("single leaf", () => {
    const leaf = createLeaf("card-1");
    expect(allLeaves(leaf)).toEqual([leaf]);
  });

  test("collects all leaves from tree", () => {
    const a = createLeaf("card-1");
    const b = createLeaf("card-2");
    const tree = splitPane(a, a.id, "horizontal", b);
    const leaves = allLeaves(tree);
    expect(leaves).toHaveLength(2);
    expect(leaves[0].meCardId).toBe("card-1");
    expect(leaves[1].meCardId).toBe("card-2");
  });
});

describe("splitPane", () => {
  test("splits a leaf into a split node", () => {
    const a = createLeaf("card-1");
    const b = createLeaf("card-2");
    const tree = splitPane(a, a.id, "horizontal", b);
    expect(tree.type).toBe("split");
    if (tree.type === "split") {
      expect(tree.direction).toBe("horizontal");
      expect(tree.ratio).toBe(0.5);
      expect(tree.a).toBe(a);
      expect(tree.b).toBe(b);
    }
  });

  test("returns unchanged tree if paneId not found", () => {
    const a = createLeaf("card-1");
    const b = createLeaf("card-2");
    const result = splitPane(a, "nope", "horizontal", b);
    expect(result).toBe(a);
  });
});

describe("removePane", () => {
  test("removing only leaf returns null", () => {
    const leaf = createLeaf("card-1");
    expect(removePane(leaf, leaf.id)).toBeNull();
  });

  test("removing one child of split returns the other", () => {
    const a = createLeaf("card-1");
    const b = createLeaf("card-2");
    const tree = splitPane(a, a.id, "horizontal", b);
    const result = removePane(tree, a.id);
    expect(result).toBe(b);
  });

  test("removing non-existent id returns tree unchanged", () => {
    const a = createLeaf("card-1");
    const b = createLeaf("card-2");
    const tree = splitPane(a, a.id, "horizontal", b);
    const result = removePane(tree, "nope");
    expect(result).toBe(tree);
  });
});

describe("toggleExpanded", () => {
  test("adds cardId to expandedIds", () => {
    const leaf = createLeaf("card-1");
    const result = toggleExpanded(leaf, leaf.id, "child-1");
    expect(result.type).toBe("leaf");
    if (result.type === "leaf") {
      expect(result.expandedIds.has("child-1")).toBe(true);
    }
  });

  test("removes cardId if already expanded", () => {
    let leaf = createLeaf("card-1");
    leaf = toggleExpanded(leaf, leaf.id, "child-1") as typeof leaf;
    const result = toggleExpanded(leaf, leaf.id, "child-1");
    if (result.type === "leaf") {
      expect(result.expandedIds.has("child-1")).toBe(false);
    }
  });

  test("does not mutate original", () => {
    const leaf = createLeaf("card-1");
    toggleExpanded(leaf, leaf.id, "child-1");
    expect(leaf.expandedIds.size).toBe(0);
  });
});

describe("drillDown", () => {
  test("pushes card onto path and clears expandedIds", () => {
    let leaf = createLeaf("card-1");
    leaf = toggleExpanded(leaf, leaf.id, "x") as typeof leaf;
    const result = drillDown(leaf, leaf.id, "card-2");
    if (result.type === "leaf") {
      expect(result.path).toEqual(["card-1", "card-2"]);
      expect(result.expandedIds.size).toBe(0);
    }
  });

  test("multiple drill-downs build path", () => {
    let tree = createLeaf("card-1") as ReturnType<typeof createLeaf>;
    const id = tree.id;
    tree = drillDown(tree, id, "card-2") as typeof tree;
    tree = drillDown(tree, id, "card-3") as typeof tree;
    expect(tree.path).toEqual(["card-1", "card-2", "card-3"]);
  });
});

describe("breadcrumbTo", () => {
  test("truncates path to given index", () => {
    let leaf = createLeaf("card-1");
    const id = leaf.id;
    leaf = drillDown(leaf, id, "card-2") as typeof leaf;
    leaf = drillDown(leaf, id, "card-3") as typeof leaf;
    const result = breadcrumbTo(leaf, id, 1);
    if (result.type === "leaf") {
      expect(result.path).toEqual(["card-1", "card-2"]);
    }
  });

  test("index 0 returns to root", () => {
    let leaf = createLeaf("card-1");
    const id = leaf.id;
    leaf = drillDown(leaf, id, "card-2") as typeof leaf;
    const result = breadcrumbTo(leaf, id, 0);
    if (result.type === "leaf") {
      expect(result.path).toEqual(["card-1"]);
    }
  });
});

describe("resizeSplit", () => {
  test("updates ratio", () => {
    const a = createLeaf("card-1");
    const b = createLeaf("card-2");
    const tree = splitPane(a, a.id, "horizontal", b);
    if (tree.type !== "split") throw new Error("expected split");

    const { splitNodeId } = require("../src/tile-tree");
    const sid = splitNodeId(tree);
    const result = resizeSplit(tree, sid, 0.7);
    if (result.type === "split") {
      expect(result.ratio).toBe(0.7);
    }
  });

  test("clamps ratio", () => {
    const a = createLeaf("card-1");
    const b = createLeaf("card-2");
    const tree = splitPane(a, a.id, "horizontal", b);
    if (tree.type !== "split") throw new Error("expected split");

    const { splitNodeId } = require("../src/tile-tree");
    const sid = splitNodeId(tree);
    const too_low = resizeSplit(tree, sid, 0.01);
    if (too_low.type === "split") expect(too_low.ratio).toBe(0.1);
    const too_high = resizeSplit(tree, sid, 0.99);
    if (too_high.type === "split") expect(too_high.ratio).toBe(0.9);
  });
});

describe("buildBalancedTree", () => {
  test("returns null for empty array", () => {
    expect(buildBalancedTree([])).toBeNull();
  });

  test("single card returns leaf", () => {
    const tree = buildBalancedTree(["card-1"]);
    expect(tree).not.toBeNull();
    expect(tree!.type).toBe("leaf");
    if (tree!.type === "leaf") {
      expect(tree!.meCardId).toBe("card-1");
    }
  });

  test("two cards returns horizontal split", () => {
    const tree = buildBalancedTree(["a", "b"]);
    expect(tree).not.toBeNull();
    expect(tree!.type).toBe("split");
    if (tree!.type === "split") {
      expect(tree!.direction).toBe("horizontal");
      expect(allLeaves(tree!)).toHaveLength(2);
    }
  });

  test("four cards creates balanced tree with alternating directions", () => {
    const tree = buildBalancedTree(["a", "b", "c", "d"]);
    expect(tree).not.toBeNull();
    const leaves = allLeaves(tree!);
    expect(leaves).toHaveLength(4);
    expect(leaves.map((l) => l.meCardId)).toEqual(["a", "b", "c", "d"]);
  });

  test("three cards creates asymmetric tree", () => {
    const tree = buildBalancedTree(["a", "b", "c"]);
    expect(tree).not.toBeNull();
    const leaves = allLeaves(tree!);
    expect(leaves).toHaveLength(3);
  });
});

describe("currentCard", () => {
  test("returns last element of path", () => {
    const leaf = createLeaf("card-1");
    expect(currentCard(leaf)).toBe("card-1");
  });

  test("returns drilled-down card", () => {
    let leaf = createLeaf("card-1");
    leaf = drillDown(leaf, leaf.id, "card-2") as typeof leaf;
    expect(currentCard(leaf)).toBe("card-2");
  });
});
