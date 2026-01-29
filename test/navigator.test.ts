import { describe, expect, test } from "bun:test";
import { CardGraph } from "../src/graph";
import { Navigator } from "../src/navigator";

describe("Navigator", () => {
  function setup() {
    const graph = new CardGraph();
    const a = graph.addCard("Alpha", { x: 0, y: 0 });
    const b = graph.addCard("Beta", { x: 100, y: 0 });
    const c = graph.addCard("Gamma", { x: 200, y: 0 });
    graph.addEdge(a.id, b.id, "east");
    graph.addEdge(b.id, c.id, "east");
    graph.addEdge(b.id, a.id, "west");
    const nav = new Navigator(graph);
    return { graph, nav, a, b, c };
  }

  test("current is null initially", () => {
    const { nav } = setup();
    expect(nav.current).toBeNull();
  });

  test("jumpTo sets current card", () => {
    const { nav, a } = setup();
    nav.jumpTo(a.id);
    expect(nav.current).toBe(a);
  });

  test("jumpTo throws for unknown card", () => {
    const { nav } = setup();
    expect(() => nav.jumpTo("nope")).toThrow("Card not found");
  });

  test("exits returns outgoing edges from current card", () => {
    const { nav, b } = setup();
    nav.jumpTo(b.id);
    expect(nav.exits).toHaveLength(2);
  });

  test("exits returns empty when no current card", () => {
    const { nav } = setup();
    expect(nav.exits).toEqual([]);
  });

  test("reachable returns cards reachable via exits", () => {
    const { nav, a, b } = setup();
    nav.jumpTo(a.id);
    const reachable = nav.reachable;
    expect(reachable).toHaveLength(1);
    expect(reachable[0].id).toBe(b.id);
  });

  test("moveTo follows an edge", () => {
    const { nav, a, b } = setup();
    nav.jumpTo(a.id);
    nav.moveTo(b.id);
    expect(nav.current!.id).toBe(b.id);
  });

  test("moveTo throws when no current card", () => {
    const { nav, b } = setup();
    expect(() => nav.moveTo(b.id)).toThrow("No current card");
  });

  test("moveTo throws when no edge exists", () => {
    const { nav, a, c } = setup();
    nav.jumpTo(a.id);
    expect(() => nav.moveTo(c.id)).toThrow("No edge from current card");
  });

  test("onNavigate fires on jumpTo", () => {
    const { nav, a } = setup();
    let navigated: string | null = null;
    nav.onNavigate = (card) => { navigated = card.id; };
    nav.jumpTo(a.id);
    expect(navigated).toBe(a.id);
  });

  test("onNavigate fires on moveTo", () => {
    const { nav, a, b } = setup();
    nav.jumpTo(a.id);
    let navigated: string | null = null;
    nav.onNavigate = (card) => { navigated = card.id; };
    nav.moveTo(b.id);
    expect(navigated).toBe(b.id);
  });
});
