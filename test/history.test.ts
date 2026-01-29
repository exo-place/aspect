import { describe, expect, test } from "bun:test";
import { CardGraph } from "../src/graph";
import { History } from "../src/history";

function setup() {
  const graph = new CardGraph();
  const history = new History(graph);
  return { graph, history };
}

describe("History", () => {
  test("undo restores previous state", () => {
    const { graph, history } = setup();
    const a = graph.addCard("alpha", { x: 0, y: 0 });

    history.capture();
    graph.updateCard(a.id, { text: "changed" });

    expect(graph.getCard(a.id)!.text).toBe("changed");
    history.undo();
    expect(graph.getCard(a.id)!.text).toBe("alpha");
  });

  test("redo restores undone state", () => {
    const { graph, history } = setup();
    const a = graph.addCard("alpha", { x: 0, y: 0 });

    history.capture();
    graph.updateCard(a.id, { text: "changed" });

    history.undo();
    expect(graph.getCard(a.id)!.text).toBe("alpha");

    history.redo();
    expect(graph.getCard(a.id)!.text).toBe("changed");
  });

  test("new mutation clears redo stack", () => {
    const { graph, history } = setup();
    const a = graph.addCard("alpha", { x: 0, y: 0 });

    history.capture();
    graph.updateCard(a.id, { text: "v2" });

    history.undo();

    history.capture();
    graph.updateCard(a.id, { text: "v3" });

    expect(history.canRedo).toBe(false);
    expect(history.redo()).toBe(false);
  });

  test("undo returns false when empty", () => {
    const { history } = setup();
    expect(history.undo()).toBe(false);
    expect(history.canUndo).toBe(false);
  });

  test("redo returns false when empty", () => {
    const { history } = setup();
    expect(history.redo()).toBe(false);
    expect(history.canRedo).toBe(false);
  });

  test("multiple undos walk back through history", () => {
    const { graph, history } = setup();
    const a = graph.addCard("v1", { x: 0, y: 0 });

    history.capture();
    graph.updateCard(a.id, { text: "v2" });

    history.capture();
    graph.updateCard(a.id, { text: "v3" });

    history.capture();
    graph.updateCard(a.id, { text: "v4" });

    expect(graph.getCard(a.id)!.text).toBe("v4");

    history.undo();
    expect(graph.getCard(a.id)!.text).toBe("v3");

    history.undo();
    expect(graph.getCard(a.id)!.text).toBe("v2");

    history.undo();
    expect(graph.getCard(a.id)!.text).toBe("v1");

    expect(history.canUndo).toBe(false);
  });

  test("undo/redo preserves edges", () => {
    const { graph, history } = setup();
    const a = graph.addCard("a", { x: 0, y: 0 });
    const b = graph.addCard("b", { x: 100, y: 0 });

    history.capture();
    graph.addEdge(a.id, b.id, "link");

    expect(graph.allEdges()).toHaveLength(1);

    history.undo();
    expect(graph.allEdges()).toHaveLength(0);

    history.redo();
    expect(graph.allEdges()).toHaveLength(1);
  });

  test("undo/redo handles card creation and deletion", () => {
    const { graph, history } = setup();

    history.capture();
    const a = graph.addCard("new", { x: 0, y: 0 });
    const id = a.id;

    expect(graph.allCards()).toHaveLength(1);

    history.undo();
    expect(graph.allCards()).toHaveLength(0);

    history.redo();
    expect(graph.allCards()).toHaveLength(1);
    expect(graph.getCard(id)!.text).toBe("new");
  });

  test("respects max stack size", () => {
    const { graph } = setup();
    const small = new History(graph, 3);
    const a = graph.addCard("v0", { x: 0, y: 0 });

    for (let i = 1; i <= 5; i++) {
      small.capture();
      graph.updateCard(a.id, { text: `v${i}` });
    }

    // Should only be able to undo 3 times (max=3)
    expect(small.undo()).toBe(true); // v5 -> v4
    expect(small.undo()).toBe(true); // v4 -> v3
    expect(small.undo()).toBe(true); // v3 -> v2
    expect(small.undo()).toBe(false); // can't go further
    expect(graph.getCard(a.id)!.text).toBe("v2");
  });

  test("canUndo and canRedo reflect state", () => {
    const { graph, history } = setup();
    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(false);

    const a = graph.addCard("x", { x: 0, y: 0 });

    history.capture();
    graph.updateCard(a.id, { text: "y" });

    expect(history.canUndo).toBe(true);
    expect(history.canRedo).toBe(false);

    history.undo();

    expect(history.canUndo).toBe(false);
    expect(history.canRedo).toBe(true);
  });
});
