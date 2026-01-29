import { describe, expect, test } from "bun:test";
import { CardGraph } from "../src/graph";
import { WorldPackStore } from "../src/pack";
import { createYDoc } from "../src/ydoc";
import type { WorldPack } from "../src/pack-types";

describe("CardGraph", () => {
  function makeGraph() {
    const bundle = createYDoc();
    const g = new CardGraph(bundle);
    const a = g.addCard("Alpha", { x: 0, y: 0 });
    const b = g.addCard("Beta", { x: 100, y: 0 });
    const c = g.addCard("Gamma", { x: 200, y: 0 });
    return { g, a, b, c };
  }

  describe("cards", () => {
    test("addCard creates a card with id, text, and position", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const card = g.addCard("hello", { x: 10, y: 20 });
      expect(card.id).toBeString();
      expect(card.text).toBe("hello");
      expect(card.position).toEqual({ x: 10, y: 20 });
    });

    test("getCard retrieves a card by id", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const card = g.addCard("hello", { x: 0, y: 0 });
      expect(g.getCard(card.id)).toEqual(card);
    });

    test("getCard returns undefined for unknown id", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      expect(g.getCard("nope")).toBeUndefined();
    });

    test("updateCard patches text", () => {
      const { g, a } = makeGraph();
      g.updateCard(a.id, { text: "Updated" });
      expect(g.getCard(a.id)!.text).toBe("Updated");
    });

    test("updateCard patches position", () => {
      const { g, a } = makeGraph();
      g.updateCard(a.id, { position: { x: 50, y: 50 } });
      expect(g.getCard(a.id)!.position).toEqual({ x: 50, y: 50 });
    });

    test("updateCard throws for unknown id", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      expect(() => g.updateCard("nope", { text: "x" })).toThrow("Card not found");
    });

    test("removeCard deletes the card", () => {
      const { g, a } = makeGraph();
      g.removeCard(a.id);
      expect(g.getCard(a.id)).toBeUndefined();
    });

    test("removeCard throws for unknown id", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      expect(() => g.removeCard("nope")).toThrow("Card not found");
    });

    test("removeCard cascades edges", () => {
      const { g, a, b } = makeGraph();
      g.addEdge(a.id, b.id);
      g.removeCard(a.id);
      expect(g.allEdges()).toHaveLength(0);
    });

    test("allCards returns all cards", () => {
      const { g } = makeGraph();
      expect(g.allCards()).toHaveLength(3);
    });

    test("removeCards deletes multiple cards and their edges atomically", () => {
      const { g, a, b, c } = makeGraph();
      g.addEdge(a.id, b.id);
      g.addEdge(b.id, c.id);
      g.addEdge(a.id, c.id);
      let changeCount = 0;
      g.onChange = () => { changeCount++; };
      g.removeCards([a.id, b.id]);
      expect(g.getCard(a.id)).toBeUndefined();
      expect(g.getCard(b.id)).toBeUndefined();
      expect(g.getCard(c.id)).toBeDefined();
      expect(g.allEdges()).toHaveLength(0);
      expect(changeCount).toBe(1);
    });
  });

  describe("edges", () => {
    test("addEdge creates an edge between cards", () => {
      const { g, a, b } = makeGraph();
      const edge = g.addEdge(a.id, b.id, "path");
      expect(edge.from).toBe(a.id);
      expect(edge.to).toBe(b.id);
      expect(edge.label).toBe("path");
    });

    test("addEdge throws for unknown from card", () => {
      const { g, b } = makeGraph();
      expect(() => g.addEdge("nope", b.id)).toThrow("Card not found");
    });

    test("addEdge throws for unknown to card", () => {
      const { g, a } = makeGraph();
      expect(() => g.addEdge(a.id, "nope")).toThrow("Card not found");
    });

    test("removeEdge deletes the edge", () => {
      const { g, a, b } = makeGraph();
      const edge = g.addEdge(a.id, b.id);
      g.removeEdge(edge.id);
      expect(g.allEdges()).toHaveLength(0);
    });

    test("removeEdge throws for unknown id", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      expect(() => g.removeEdge("nope")).toThrow("Edge not found");
    });

    test("edgesFrom returns outgoing edges", () => {
      const { g, a, b, c } = makeGraph();
      g.addEdge(a.id, b.id);
      g.addEdge(a.id, c.id);
      g.addEdge(b.id, c.id);
      expect(g.edgesFrom(a.id)).toHaveLength(2);
      expect(g.edgesFrom(b.id)).toHaveLength(1);
    });

    test("edgesTo returns incoming edges", () => {
      const { g, a, b, c } = makeGraph();
      g.addEdge(a.id, c.id);
      g.addEdge(b.id, c.id);
      expect(g.edgesTo(c.id)).toHaveLength(2);
      expect(g.edgesTo(a.id)).toHaveLength(0);
    });

    test("neighbors returns adjacent cards in both directions", () => {
      const { g, a, b, c } = makeGraph();
      g.addEdge(a.id, b.id);
      g.addEdge(c.id, a.id);
      const neighbors = g.neighbors(a.id);
      expect(neighbors).toHaveLength(2);
      const ids = neighbors.map((n) => n.id);
      expect(ids).toContain(b.id);
      expect(ids).toContain(c.id);
    });

    test("allEdges returns all edges", () => {
      const { g, a, b, c } = makeGraph();
      g.addEdge(a.id, b.id);
      g.addEdge(b.id, c.id);
      expect(g.allEdges()).toHaveLength(2);
    });

    test("edgeBetween finds forward edge", () => {
      const { g, a, b } = makeGraph();
      const edge = g.addEdge(a.id, b.id);
      expect(g.edgeBetween(a.id, b.id)).toEqual(edge);
    });

    test("edgeBetween finds reverse edge", () => {
      const { g, a, b } = makeGraph();
      const edge = g.addEdge(b.id, a.id);
      expect(g.edgeBetween(a.id, b.id)).toEqual(edge);
    });

    test("edgeBetween returns undefined when no edge", () => {
      const { g, a, b } = makeGraph();
      expect(g.edgeBetween(a.id, b.id)).toBeUndefined();
    });

    test("allEdgesBetween returns edges in both directions", () => {
      const { g, a, b } = makeGraph();
      g.addEdge(a.id, b.id);
      g.addEdge(b.id, a.id);
      expect(g.allEdgesBetween(a.id, b.id)).toHaveLength(2);
    });

    test("allEdgesBetween returns empty array when no edges", () => {
      const { g, a, b } = makeGraph();
      expect(g.allEdgesBetween(a.id, b.id)).toHaveLength(0);
    });

    test("directEdge finds forward edge only", () => {
      const { g, a, b } = makeGraph();
      const edge = g.addEdge(a.id, b.id);
      expect(g.directEdge(a.id, b.id)).toEqual(edge);
      expect(g.directEdge(b.id, a.id)).toBeUndefined();
    });

    test("addEdge returns existing on duplicate", () => {
      const { g, a, b } = makeGraph();
      const edge1 = g.addEdge(a.id, b.id);
      const edge2 = g.addEdge(a.id, b.id);
      expect(edge2).toEqual(edge1);
      expect(g.allEdges()).toHaveLength(1);
    });

    test("addEdge does not fire onChange on duplicate", () => {
      const { g, a, b } = makeGraph();
      g.addEdge(a.id, b.id);
      let called = false;
      g.onChange = () => { called = true; };
      g.addEdge(a.id, b.id);
      expect(called).toBe(false);
    });

    test("addEdge allows both directions as separate edges", () => {
      const { g, a, b } = makeGraph();
      const ab = g.addEdge(a.id, b.id);
      const ba = g.addEdge(b.id, a.id);
      expect(ab.id).not.toBe(ba.id);
      expect(g.allEdges()).toHaveLength(2);
    });

    test("updateEdge sets label", () => {
      const { g, a, b } = makeGraph();
      const edge = g.addEdge(a.id, b.id);
      g.updateEdge(edge.id, "hello");
      expect(g.allEdges()[0].label).toBe("hello");
    });

    test("updateEdge clears label with empty string", () => {
      const { g, a, b } = makeGraph();
      const edge = g.addEdge(a.id, b.id, "hello");
      g.updateEdge(edge.id, "");
      expect(g.allEdges()[0].label).toBeUndefined();
    });
  });

  describe("serialization", () => {
    test("toJSON round-trips through loadJSON", () => {
      const { g, a, b, c } = makeGraph();
      g.addEdge(a.id, b.id, "link");
      g.addEdge(b.id, c.id);

      const json = g.toJSON();
      const bundle2 = createYDoc();
      const g2 = new CardGraph(bundle2);
      g2.loadJSON(json);

      expect(g2.allCards()).toHaveLength(3);
      expect(g2.allEdges()).toHaveLength(2);
      expect(g2.getCard(a.id)!.text).toBe("Alpha");
      expect(g2.edgesFrom(a.id)[0].label).toBe("link");
    });

    test("toJSON creates deep copies", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const card = g.addCard("test", { x: 0, y: 0 });
      const json = g.toJSON();
      json.cards[card.id].text = "mutated";
      expect(g.getCard(card.id)!.text).toBe("test");
    });
  });

  describe("onChange", () => {
    test("fires on addCard", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      let called = false;
      g.onChange = () => { called = true; };
      g.addCard("x", { x: 0, y: 0 });
      expect(called).toBe(true);
    });

    test("fires on updateCard", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const card = g.addCard("x", { x: 0, y: 0 });
      let called = false;
      g.onChange = () => { called = true; };
      g.updateCard(card.id, { text: "y" });
      expect(called).toBe(true);
    });

    test("fires on removeCard", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const card = g.addCard("x", { x: 0, y: 0 });
      let called = false;
      g.onChange = () => { called = true; };
      g.removeCard(card.id);
      expect(called).toBe(true);
    });

    test("fires on addEdge", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const a = g.addCard("a", { x: 0, y: 0 });
      const b = g.addCard("b", { x: 1, y: 0 });
      let called = false;
      g.onChange = () => { called = true; };
      g.addEdge(a.id, b.id);
      expect(called).toBe(true);
    });

    test("fires on removeEdge", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const a = g.addCard("a", { x: 0, y: 0 });
      const b = g.addCard("b", { x: 1, y: 0 });
      const edge = g.addEdge(a.id, b.id);
      let called = false;
      g.onChange = () => { called = true; };
      g.removeEdge(edge.id);
      expect(called).toBe(true);
    });

    test("fires on loadJSON", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      g.addCard("a", { x: 0, y: 0 });
      const json = g.toJSON();
      const bundle2 = createYDoc();
      const g2 = new CardGraph(bundle2);
      let called = false;
      g2.onChange = () => { called = true; };
      g2.loadJSON(json);
      expect(called).toBe(true);
    });
  });

  describe("kind", () => {
    test("addCard with kind stores kind", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const card = g.addCard("Room A", { x: 0, y: 0 }, "room");
      expect(card.kind).toBe("room");
    });

    test("addCard without kind has no kind", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const card = g.addCard("Plain", { x: 0, y: 0 });
      expect(card.kind).toBeUndefined();
    });

    test("setKind assigns kind", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const card = g.addCard("X", { x: 0, y: 0 });
      g.setKind(card.id, "item");
      expect(g.getCard(card.id)!.kind).toBe("item");
    });

    test("setKind(null) clears kind", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const card = g.addCard("X", { x: 0, y: 0 }, "room");
      g.setKind(card.id, null);
      expect(g.getCard(card.id)!.kind).toBeUndefined();
    });

    test("setKind throws for unknown card", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      expect(() => g.setKind("nope", "room")).toThrow("Card not found");
    });
  });

  describe("edge type", () => {
    test("addEdge with type stores type", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const a = g.addCard("A", { x: 0, y: 0 });
      const b = g.addCard("B", { x: 1, y: 0 });
      const edge = g.addEdge(a.id, b.id, "go", "exit");
      expect(edge.type).toBe("exit");
      expect(edge.label).toBe("go");
    });

    test("addEdge without type has no type", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const a = g.addCard("A", { x: 0, y: 0 });
      const b = g.addCard("B", { x: 1, y: 0 });
      const edge = g.addEdge(a.id, b.id);
      expect(edge.type).toBeUndefined();
    });

    test("toJSON/loadJSON preserves kind and type", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const a = g.addCard("Room", { x: 0, y: 0 }, "room");
      const b = g.addCard("Item", { x: 100, y: 0 }, "item");
      g.addEdge(a.id, b.id, "contains", "contains");

      const json = g.toJSON();
      expect(json.cards[a.id].kind).toBe("room");
      expect(json.cards[b.id].kind).toBe("item");
      expect(Object.values(json.edges)[0].type).toBe("contains");

      const bundle2 = createYDoc();
      const g2 = new CardGraph(bundle2);
      g2.loadJSON(json);

      expect(g2.getCard(a.id)!.kind).toBe("room");
      expect(g2.getCard(b.id)!.kind).toBe("item");
      expect(g2.allEdges()[0].type).toBe("contains");
    });
  });

  describe("edge type enforcement", () => {
    const PACK: WorldPack = {
      packId: "test",
      packVersion: 1,
      name: "Test",
      kinds: [
        { id: "room", label: "Room" },
        { id: "item", label: "Item" },
      ],
      edgeTypes: [
        { id: "exit", label: "exit", constraint: { from: ["room"], to: ["room"] } },
        { id: "link", label: "link" },
      ],
    };

    function makeGraphWithPack() {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const store = new WorldPackStore(bundle);
      store.load(PACK);
      g.setPackStore(store);
      return { g, store };
    }

    test("valid typed edge succeeds", () => {
      const { g } = makeGraphWithPack();
      const a = g.addCard("R1", { x: 0, y: 0 }, "room");
      const b = g.addCard("R2", { x: 1, y: 0 }, "room");
      const edge = g.addEdge(a.id, b.id, "north", "exit");
      expect(edge.type).toBe("exit");
    });

    test("invalid typed edge throws", () => {
      const { g } = makeGraphWithPack();
      const a = g.addCard("R1", { x: 0, y: 0 }, "room");
      const b = g.addCard("I1", { x: 1, y: 0 }, "item");
      expect(() => g.addEdge(a.id, b.id, "go", "exit")).toThrow("not allowed");
    });

    test("untyped edge (no type param) bypasses validation", () => {
      const { g } = makeGraphWithPack();
      const a = g.addCard("R1", { x: 0, y: 0 }, "room");
      const b = g.addCard("I1", { x: 1, y: 0 }, "item");
      const edge = g.addEdge(a.id, b.id);
      expect(edge.type).toBeUndefined();
    });

    test("unconstrained edge type passes any kinds", () => {
      const { g } = makeGraphWithPack();
      const a = g.addCard("R1", { x: 0, y: 0 }, "room");
      const b = g.addCard("I1", { x: 1, y: 0 }, "item");
      const edge = g.addEdge(a.id, b.id, undefined, "link");
      expect(edge.type).toBe("link");
    });

    test("untyped cards pass through constraints", () => {
      const { g } = makeGraphWithPack();
      const a = g.addCard("X", { x: 0, y: 0 });
      const b = g.addCard("Y", { x: 1, y: 0 });
      const edge = g.addEdge(a.id, b.id, undefined, "exit");
      expect(edge.type).toBe("exit");
    });

    test("no pack store means no validation", () => {
      const bundle = createYDoc();
      const g = new CardGraph(bundle);
      const a = g.addCard("R1", { x: 0, y: 0 }, "room");
      const b = g.addCard("I1", { x: 1, y: 0 }, "item");
      const edge = g.addEdge(a.id, b.id, "go", "exit");
      expect(edge.type).toBe("exit");
    });
  });
});
