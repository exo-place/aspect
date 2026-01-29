import { describe, expect, test } from "bun:test";
import { CardGraph } from "../src/graph";
import { Editor } from "../src/editor";

describe("Editor", () => {
  function setup() {
    const graph = new CardGraph();
    const card = graph.addCard("Original", { x: 10, y: 20 });
    const editor = new Editor(graph);
    return { graph, editor, card };
  }

  test("setText updates card text", () => {
    const { graph, editor, card } = setup();
    editor.setText(card.id, "Changed");
    expect(graph.getCard(card.id)!.text).toBe("Changed");
  });

  test("setText returns the updated card", () => {
    const { editor, card } = setup();
    const result = editor.setText(card.id, "Changed");
    expect(result.text).toBe("Changed");
  });

  test("setText throws for unknown card", () => {
    const { editor } = setup();
    expect(() => editor.setText("nope", "x")).toThrow("Card not found");
  });

  test("setPosition updates card position", () => {
    const { graph, editor, card } = setup();
    editor.setPosition(card.id, { x: 99, y: 88 });
    expect(graph.getCard(card.id)!.position).toEqual({ x: 99, y: 88 });
  });

  test("setPosition returns the updated card", () => {
    const { editor, card } = setup();
    const result = editor.setPosition(card.id, { x: 50, y: 60 });
    expect(result.position).toEqual({ x: 50, y: 60 });
  });

  test("setPosition throws for unknown card", () => {
    const { editor } = setup();
    expect(() => editor.setPosition("nope", { x: 0, y: 0 })).toThrow("Card not found");
  });

  test("onEdit fires on setText", () => {
    const { editor, card } = setup();
    let edited = "";
    editor.onEdit = (c) => { edited = c.id; };
    editor.setText(card.id, "new");
    expect(edited).toBe(card.id);
  });

  test("onEdit fires on setPosition", () => {
    const { editor, card } = setup();
    let edited = "";
    editor.onEdit = (c) => { edited = c.id; };
    editor.setPosition(card.id, { x: 0, y: 0 });
    expect(edited).toBe(card.id);
  });
});
