import { describe, expect, test } from "bun:test";
import { CardGraph } from "../src/graph";
import { WorldPackStore } from "../src/pack";
import { EventLog } from "../src/event-log";
import { History } from "../src/history";
import { createYDoc } from "../src/ydoc";
import { buildActionData, isActionAvailable, executeAction, findActionTargets } from "../src/action";
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

describe("buildActionData", () => {
  test("builds data for two connected cards", () => {
    const { graph } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");
    graph.addEdge(room.id, item.id, "contains", "contains");

    const data = buildActionData(graph, room.id, item.id);
    expect(data).not.toBeNull();
    expect(data!.context.id).toBe(room.id);
    expect(data!.context.kind).toBe("room");
    expect(data!.target.id).toBe(item.id);
    expect(data!.target.kind).toBe("item");
    expect(data!.edgesFromContextToTarget).toHaveLength(1);
    expect(data!.edgesFromContextToTarget[0].type).toBe("contains");
  });

  test("returns null for missing card", () => {
    const { graph } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    expect(buildActionData(graph, room.id, "nonexistent")).toBeNull();
  });

  test("populates sharedNeighbors", () => {
    const { graph } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const char = graph.addCard("Hero", { x: 100, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 200, y: 0 }, "item");
    graph.addEdge(room.id, char.id, undefined, "contains");
    graph.addEdge(room.id, item.id, undefined, "contains");

    const data = buildActionData(graph, char.id, item.id);
    expect(data!.sharedNeighbors).toHaveLength(1);
    expect(data!.sharedNeighbors[0].id).toBe(room.id);
    expect(data!.sharedNeighbors[0].kind).toBe("room");
  });

  test("kind is null for untyped cards", () => {
    const { graph } = makeWorld();
    const a = graph.addCard("A", { x: 0, y: 0 });
    const b = graph.addCard("B", { x: 100, y: 0 });
    const data = buildActionData(graph, a.id, b.id);
    expect(data!.context.kind).toBeNull();
    expect(data!.target.kind).toBeNull();
  });
});

describe("isActionAvailable", () => {
  test("returns true when all conditions met", () => {
    const { graph, packStore } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: { kind: "character" },
      target: { kind: "item" },
      do: [],
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
      do: [],
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
      do: [],
    };
    expect(isActionAvailable(action, graph, packStore, char.id, room.id)).toBe(false);
  });

  test("returns true when kinds match and no further constraints", () => {
    const { graph, packStore } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: { kind: "character" },
      target: { kind: "item" },
      do: [],
    };
    expect(isActionAvailable(action, graph, packStore, char.id, item.id)).toBe(true);
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
      do: [],
    };
    expect(isActionAvailable(action, graph, packStore, room.id, item.id)).toBe(true);
  });

  test("returns false when edge type is missing", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");
    // No edge between them

    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: { kind: "room" },
      target: { kind: "item", edgeType: "contains" },
      do: [],
    };
    expect(isActionAvailable(action, graph, packStore, room.id, item.id)).toBe(false);
  });

  test("checks edge type with direction 'to'", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");
    graph.addEdge(room.id, item.id, undefined, "contains");

    // direction "to" means edge goes target→context, i.e. item→room
    // We only have room→item, so this should be false
    const action: ActionDef = {
      id: "test",
      label: "Test",
      context: {},
      target: { edgeType: "contains", direction: "to" },
      do: [],
    };
    expect(isActionAvailable(action, graph, packStore, item.id, room.id)).toBe(true);
  });

  test("evaluates when predicate", () => {
    const { graph, packStore } = makeWorld();
    const a = graph.addCard("A", { x: 0, y: 0 }, "room");
    const b = graph.addCard("B", { x: 100, y: 0 }, "room");

    const actionTrue: ActionDef = {
      id: "test-true",
      label: "Test",
      context: {},
      target: {},
      when: { "===": [{ var: "context.kind" }, "room"] },
      do: [],
    };
    expect(isActionAvailable(actionTrue, graph, packStore, a.id, b.id)).toBe(true);

    const actionFalse: ActionDef = {
      id: "test-false",
      label: "Test",
      context: {},
      target: {},
      when: { "===": [{ var: "context.kind" }, "item"] },
      do: [],
    };
    expect(isActionAvailable(actionFalse, graph, packStore, a.id, b.id)).toBe(false);
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
      do: [
        { type: "addEdge", from: "context", to: "target", edgeType: "carries", label: "carries" },
      ],
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
      do: [
        { type: "removeEdge", from: "context", to: "target", edgeType: "contains" },
      ],
    };

    const result = executeAction(action, graph, packStore, room.id, item.id, eventLog, "tester");
    expect(result.success).toBe(true);
    expect(graph.edgesFrom(room.id)).toHaveLength(0);
  });

  test("setKind effect changes card kind", () => {
    const { graph, packStore, eventLog } = makeWorld();
    const card = graph.addCard("Thing", { x: 0, y: 0 }, "item");
    const other = graph.addCard("Other", { x: 100, y: 0 }, "room");

    const action: ActionDef = {
      id: "transform",
      label: "Transform",
      context: {},
      target: {},
      do: [
        { type: "setKind", card: "context", kind: "room" },
      ],
    };

    executeAction(action, graph, packStore, card.id, other.id, eventLog, "tester");
    expect(graph.getCard(card.id)!.kind).toBe("room");
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
      do: [
        { type: "setText", card: "context", text: "New text" },
      ],
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
      do: [
        { type: "emit", event: "thing-happened", data: { detail: "info" } },
      ],
    };

    const result = executeAction(action, graph, packStore, a.id, b.id, eventLog, "tester");
    expect(result.success).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].event).toBe("thing-happened");
    expect(result.events[0].data).toEqual({ detail: "info" });

    // Event should be in the log
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
      context: { kind: "character" }, // room is not character
      target: {},
      do: [{ type: "setText", card: "context", text: "changed" }],
    };

    const result = executeAction(action, graph, packStore, room.id, item.id, eventLog, "tester");
    expect(result.success).toBe(false);
    expect(graph.getCard(room.id)!.text).toBe("Hall"); // unchanged
  });

  test("multiple graph effects execute atomically", () => {
    const { graph, packStore } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");
    const room = graph.addCard("Hall", { x: 200, y: 0 }, "room");
    graph.addEdge(room.id, item.id, undefined, "contains");

    const action: ActionDef = {
      id: "pick-up",
      label: "Pick Up",
      context: { kind: "character" },
      target: { kind: "item" },
      do: [
        { type: "removeEdge", from: "context", to: "target", edgeType: "contains" },
        { type: "addEdge", from: "context", to: "target", edgeType: "carries" },
        { type: "setText", card: "target", text: "Carried Sword" },
      ],
    };

    let changeCount = 0;
    graph.onChange = () => { changeCount++; };

    const result = executeAction(action, graph, packStore, char.id, item.id, null, "tester");
    expect(result.success).toBe(true);
    // All graph changes in single Y.js transaction → single onChange
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
      do: [
        { type: "addEdge", from: "context", to: "target", edgeType: "carries" },
      ],
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
      do: [
        { type: "emit", event: "test-event" },
      ],
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
      do: [],
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
      do: [],
    };

    const targets = findActionTargets(action, graph, packStore, a.id);
    expect(targets).not.toContain(a.id);
    expect(targets).toContain(b.id);
  });
});
