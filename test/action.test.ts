import { describe, expect, test } from "bun:test";
import { CardGraph } from "../src/graph";
import { WorldPackStore } from "../src/pack";
import { EventLog } from "../src/event-log";
import { History } from "../src/history";
import { createYDoc } from "../src/ydoc";
import { isActionAvailable, executeAction, findActionTargets } from "../src/action";
import type { ActionDef } from "../src/action-types";
import type { WorldPack } from "../src/pack-types";

const PACK: WorldPack = {
  packId: "test",
  packVersion: 1,
  name: "Test",
  kinds: [
    { id: "room", label: "Room" },
    { id: "item", label: "Item" },
    { id: "character", label: "Character" },
  ],
  edgeTypes: [
    { id: "contains", label: "contains", constraint: { from: ["room"], to: ["item", "character"] } },
    { id: "carries", label: "carries", constraint: { from: ["character"], to: ["item"] } },
    { id: "exit", label: "exit", constraint: { from: ["room"], to: ["room"] } },
  ],
};

function makeWorld() {
  const bundle = createYDoc();
  const graph = new CardGraph(bundle);
  const packStore = new WorldPackStore(bundle);
  const eventLog = new EventLog(bundle);
  const history = new History(bundle);
  packStore.load(PACK);
  graph.setPackStore(packStore);
  return { bundle, graph, packStore, eventLog, history };
}

// Simple helper: an action whose run always returns the given effects
function always(...effects: unknown[]): unknown {
  return ["array", ...effects.map(e => ["array", ...e as unknown[]])];
}

describe("isActionAvailable", () => {
  test("returns true when kinds match and run returns effects", () => {
    const { graph, packStore } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: { kind: "character" },
      target: { kind: "item" },
      run: always(["emit", "ok"]),
    };
    expect(isActionAvailable(action, graph, packStore, char.id, item.id)).toBe(true);
  });

  test("returns false when context kind doesn't match", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: { kind: "character" },
      target: {},
      run: always(["emit", "ok"]),
    };
    expect(isActionAvailable(action, graph, packStore, room.id, item.id)).toBe(false);
  });

  test("returns false when target kind doesn't match", () => {
    const { graph, packStore } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");
    const room = graph.addCard("Hall", { x: 100, y: 0 }, "room");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: { kind: "character" },
      target: { kind: "item" },
      run: always(["emit", "ok"]),
    };
    expect(isActionAvailable(action, graph, packStore, char.id, room.id)).toBe(false);
  });

  test("checks edge type with default direction (from)", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");
    graph.addEdge(room.id, item.id, undefined, "contains");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: { kind: "room" },
      target: { kind: "item", edgeType: "contains" },
      run: always(["emit", "ok"]),
    };
    expect(isActionAvailable(action, graph, packStore, room.id, item.id)).toBe(true);
  });

  test("returns false when required edge is missing", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: { kind: "room" },
      target: { kind: "item", edgeType: "contains" },
      run: always(["emit", "ok"]),
    };
    expect(isActionAvailable(action, graph, packStore, room.id, item.id)).toBe(false);
  });

  test("checks edge type with direction 'to'", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");
    graph.addEdge(room.id, item.id, undefined, "contains");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: {},
      target: { edgeType: "contains", direction: "to" },
      run: always(["emit", "ok"]),
    };
    expect(isActionAvailable(action, graph, packStore, item.id, room.id)).toBe(true);
  });

  test("run returning null means not available", () => {
    const { graph, packStore } = makeWorld();
    const a = graph.addCard("A", { x: 0, y: 0 }, "room");
    const b = graph.addCard("B", { x: 100, y: 0 }, "room");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: {},
      target: {},
      run: null,
    };
    expect(isActionAvailable(action, graph, packStore, a.id, b.id)).toBe(false);
  });

  test("run with conditional predicate", () => {
    const { graph, packStore } = makeWorld();
    const a = graph.addCard("A", { x: 0, y: 0 }, "room");
    const b = graph.addCard("B", { x: 100, y: 0 }, "room");

    const actionTrue: ActionDef = {
      id: "test-true",
      label: "Test",
      context: {},
      target: {},
      run: ["if", ["==", ["get", ["var", "context"], "kind"], "room"],
        ["array", ["call", ["var", "emit"], "ok"]],
        null,
      ],
    };
    expect(isActionAvailable(actionTrue, graph, packStore, a.id, b.id)).toBe(true);

    const actionFalse: ActionDef = {
      id: "test-false",
      label: "Test",
      context: {},
      target: {},
      run: ["if", ["==", ["get", ["var", "context"], "kind"], "item"],
        ["array", ["call", ["var", "emit"], "ok"]],
        null,
      ],
    };
    expect(isActionAvailable(actionFalse, graph, packStore, a.id, b.id)).toBe(false);
  });

  test("field predicates via fieldNames env", () => {
    const bundle = createYDoc();
    const graph = new CardGraph(bundle);
    const packStore = new WorldPackStore(bundle);
    packStore.load({ ...PACK, fieldNames: ["flammable"] });
    graph.setPackStore(packStore);

    const a = graph.addCard("A", { x: 0, y: 0 });
    graph.setField(a.id, "flammable", true);
    const b = graph.addCard("B", { x: 100, y: 0 });

    const action: ActionDef = {
      id: "field-test",
      label: "Test",
      context: {},
      target: {},
      run: ["if", ["get", ["var", "contextFields"], "flammable"],
        ["array", ["call", ["var", "emit"], "ok"]],
        null,
      ],
    };
    expect(isActionAvailable(action, graph, packStore, a.id, b.id)).toBe(true);
    expect(isActionAvailable(action, graph, packStore, b.id, a.id)).toBe(false);
  });
});

describe("executeAction", () => {
  test("addEdge effect creates an edge", () => {
    const { graph, packStore, eventLog } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    const action: ActionDef = {
      id: "grab",
      label: "Grab",
      context: { kind: "character" },
      target: { kind: "item" },
      run: ["array", ["call", ["var", "addEdge"], ["var", "context"], ["var", "target"], "carries"]],
    };

    const result = executeAction(action, graph, packStore, char.id, item.id, eventLog, "tester");
    expect(result.success).toBe(true);
    const edges = graph.edgesFrom(char.id);
    expect(edges).toHaveLength(1);
    expect(edges[0].to).toBe(item.id);
    expect(edges[0].type).toBe("carries");
  });

  test("removeEdge effect removes an edge", () => {
    const { graph, packStore, eventLog } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");
    graph.addEdge(room.id, item.id, undefined, "contains");

    const action: ActionDef = {
      id: "remove",
      label: "Remove",
      context: { kind: "room" },
      target: { kind: "item", edgeType: "contains" },
      run: ["array", ["call", ["var", "removeEdge"], ["var", "context"], ["var", "target"], "contains"]],
    };

    const result = executeAction(action, graph, packStore, room.id, item.id, eventLog, "tester");
    expect(result.success).toBe(true);
    expect(graph.edgesFrom(room.id)).toHaveLength(0);
  });

  test("setKind effect changes card kind and auto-labels", () => {
    const { graph, packStore, eventLog } = makeWorld();
    const card = graph.addCard("Thing", { x: 0, y: 0 }, "item");
    const other = graph.addCard("Other", { x: 100, y: 0 }, "room");

    const action: ActionDef = {
      id: "transform",
      label: "Transform",
      context: {},
      target: {},
      run: ["array", ["call", ["var", "setKind"], ["var", "context"], "room"]],
    };

    executeAction(action, graph, packStore, card.id, other.id, eventLog, "tester");
    expect(graph.getCard(card.id)!.kind).toBe("room");
    expect(graph.getCard(card.id)!.text).toBe("Room"); // auto-labelled
  });

  test("setText effect changes card text", () => {
    const { graph, packStore, eventLog } = makeWorld();
    const card = graph.addCard("Old text", { x: 0, y: 0 });
    const other = graph.addCard("Other", { x: 100, y: 0 });

    const action: ActionDef = {
      id: "rename",
      label: "Rename",
      context: {},
      target: {},
      run: ["array", ["call", ["var", "setText"], ["var", "context"], "New text"]],
    };

    executeAction(action, graph, packStore, card.id, other.id, eventLog, "tester");
    expect(graph.getCard(card.id)!.text).toBe("New text");
  });

  test("emit effect produces events", () => {
    const { graph, packStore, eventLog } = makeWorld();
    const a = graph.addCard("A", { x: 0, y: 0 });
    const b = graph.addCard("B", { x: 100, y: 0 });

    const action: ActionDef = {
      id: "signal",
      label: "Signal",
      context: {},
      target: {},
      run: ["array", ["call", ["var", "emit"], "thing-happened"]],
    };

    const result = executeAction(action, graph, packStore, a.id, b.id, eventLog, "tester");
    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].event).toBe("thing-happened");
    const all = eventLog.getAll();
    expect(all).toHaveLength(1);
    expect(all[0].event).toBe("thing-happened");
  });

  test("returns failure when action is unavailable", () => {
    const { graph, packStore, eventLog } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: { kind: "character" },
      target: {},
      run: ["array", ["call", ["var", "setText"], ["var", "context"], "changed"]],
    };

    const result = executeAction(action, graph, packStore, room.id, item.id, eventLog, "tester");
    expect(result.success).toBe(false);
    expect(graph.getCard(room.id)!.text).toBe("Hall");
  });

  test("multiple effects execute atomically", () => {
    const { graph, packStore } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    const action: ActionDef = {
      id: "pick-up",
      label: "Pick Up",
      context: { kind: "character" },
      target: { kind: "item" },
      run: ["array",
        ["call", ["var", "addEdge"], ["var", "context"], ["var", "target"], "carries"],
        ["call", ["var", "setText"], ["var", "target"], "Carried Sword"],
      ],
    };

    let changeCount = 0;
    graph.onChange = () => { changeCount++; };

    const result = executeAction(action, graph, packStore, char.id, item.id, null, "tester");
    expect(result.success).toBe(true);
    expect(changeCount).toBe(1);
    expect(graph.getCard(item.id)!.text).toBe("Carried Sword");
    expect(graph.edgesFrom(char.id)).toHaveLength(1);
    expect(graph.edgesFrom(char.id)[0].type).toBe("carries");
  });

  test("action execution is undoable", () => {
    const { graph, packStore, eventLog, history } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    const action: ActionDef = {
      id: "grab",
      label: "Grab",
      context: { kind: "character" },
      target: { kind: "item" },
      run: ["array", ["call", ["var", "addEdge"], ["var", "context"], ["var", "target"], "carries"]],
    };

    executeAction(action, graph, packStore, char.id, item.id, eventLog, "tester");
    expect(graph.edgesFrom(char.id)).toHaveLength(1);
    history.undo();
    expect(graph.edgesFrom(char.id)).toHaveLength(0);
  });

  test("executeAction without eventLog works", () => {
    const { graph, packStore } = makeWorld();
    const a = graph.addCard("A", { x: 0, y: 0 });
    const b = graph.addCard("B", { x: 100, y: 0 });

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: {},
      target: {},
      run: ["array", ["call", ["var", "emit"], "test-event"]],
    };

    const result = executeAction(action, graph, packStore, a.id, b.id, null, "tester");
    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(1);
  });
});

describe("findActionTargets", () => {
  test("finds valid targets for action", () => {
    const { graph, packStore } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");
    const item1 = graph.addCard("Sword", { x: 100, y: 0 }, "item");
    const item2 = graph.addCard("Shield", { x: 200, y: 0 }, "item");
    const room = graph.addCard("Hall", { x: 300, y: 0 }, "room");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: { kind: "character" },
      target: { kind: "item" },
      run: ["array", ["call", ["var", "emit"], "ok"]],
    };

    const targets = findActionTargets(action, graph, packStore, char.id);
    expect(targets).toHaveLength(2);
    expect(targets).toContain(item1.id);
    expect(targets).toContain(item2.id);
    expect(targets).not.toContain(room.id);
  });

  test("does not include context card as target", () => {
    const { graph, packStore } = makeWorld();
    const a = graph.addCard("A", { x: 0, y: 0 });
    const b = graph.addCard("B", { x: 100, y: 0 });

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: {},
      target: {},
      run: ["array", ["call", ["var", "emit"], "ok"]],
    };

    const targets = findActionTargets(action, graph, packStore, a.id);
    expect(targets).not.toContain(a.id);
    expect(targets).toContain(b.id);
  });
});
