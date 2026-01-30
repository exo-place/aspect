import { describe, expect, test } from "bun:test";
import { CardGraph } from "../src/graph";
import { WorldPackStore } from "../src/pack";
import { createYDoc } from "../src/ydoc";
import { buildProjectionData } from "../src/projection";
import { DEFAULT_PACK } from "../src/default-pack";
import type { WorldPack } from "../src/pack-types";

function makeEnv(pack?: WorldPack) {
  const bundle = createYDoc();
  const graph = new CardGraph(bundle);
  const packStore = new WorldPackStore(bundle);
  if (pack) {
    packStore.load(pack);
    graph.setPackStore(packStore);
  }
  return { graph, packStore };
}

describe("buildProjectionData", () => {
  test("returns null for unknown card", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    expect(buildProjectionData("nope", graph, packStore)).toBeNull();
  });

  test("returns data for card with no edges", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const card = graph.addCard("Lonely", { x: 0, y: 0 }, "room");
    const data = buildProjectionData(card.id, graph, packStore);
    expect(data).not.toBeNull();
    expect(data!.cardId).toBe(card.id);
    expect(data!.text).toBe("Lonely");
    expect(data!.kind).toBe("room");
    expect(data!.kindStyle?.color).toBe("#56b6c2");
    expect(data!.panels).toHaveLength(0);
  });

  test("groups outgoing edges by type", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const hall = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const kitchen = graph.addCard("Kitchen", { x: 100, y: 0 }, "room");
    const garden = graph.addCard("Garden", { x: 200, y: 0 }, "room");
    const sword = graph.addCard("Sword", { x: 0, y: 100 }, "item");

    graph.addEdge(hall.id, kitchen.id, undefined, "exit");
    graph.addEdge(hall.id, garden.id, undefined, "exit");
    graph.addEdge(hall.id, sword.id, undefined, "contains");

    const data = buildProjectionData(hall.id, graph, packStore)!;
    expect(data.panels.length).toBeGreaterThanOrEqual(2);

    const exitPanel = data.panels.find((p) => p.edgeTypeId === "exit" && p.direction === "from");
    expect(exitPanel).toBeDefined();
    expect(exitPanel!.label).toBe("exit");
    expect(exitPanel!.items).toHaveLength(2);

    const containsPanel = data.panels.find((p) => p.edgeTypeId === "contains" && p.direction === "from");
    expect(containsPanel).toBeDefined();
    expect(containsPanel!.items).toHaveLength(1);
    expect(containsPanel!.items[0].text).toBe("Sword");
  });

  test("groups incoming edges by type", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const hall = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const sword = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    graph.addEdge(hall.id, sword.id, undefined, "contains");

    const data = buildProjectionData(sword.id, graph, packStore)!;
    const inPanel = data.panels.find((p) => p.direction === "to" && p.edgeTypeId === "contains");
    expect(inPanel).toBeDefined();
    expect(inPanel!.items).toHaveLength(1);
    expect(inPanel!.items[0].text).toBe("Hall");
  });

  test("sorts typed panels in pack definition order", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const room = graph.addCard("Room", { x: 0, y: 0 }, "room");
    const room2 = graph.addCard("Room2", { x: 100, y: 0 }, "room");
    const sword = graph.addCard("Sword", { x: 0, y: 100 }, "item");

    // Add contains before exit — should still sort exit first (pack order)
    graph.addEdge(room.id, sword.id, undefined, "contains");
    graph.addEdge(room.id, room2.id, undefined, "exit");

    const data = buildProjectionData(room.id, graph, packStore)!;
    const outPanels = data.panels.filter((p) => p.direction === "from");
    expect(outPanels[0].edgeTypeId).toBe("exit");
    expect(outPanels[1].edgeTypeId).toBe("contains");
  });

  test("untyped edges get Connected panel sorted last", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const room = graph.addCard("Room", { x: 0, y: 0 }, "room");
    const room2 = graph.addCard("Room2", { x: 100, y: 0 }, "room");
    const plain = graph.addCard("Plain", { x: 200, y: 0 });

    graph.addEdge(room.id, room2.id, undefined, "exit");
    graph.addEdge(room.id, plain.id);

    const data = buildProjectionData(room.id, graph, packStore)!;
    const last = data.panels[data.panels.length - 1];
    expect(last.edgeTypeId).toBeNull();
    expect(last.label).toBe("Connected");
  });

  test("enriches items with kind icon and color", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const room = graph.addCard("Room", { x: 0, y: 0 }, "room");
    const sword = graph.addCard("Sword", { x: 100, y: 0 }, "item");

    graph.addEdge(room.id, sword.id, undefined, "contains");

    const data = buildProjectionData(room.id, graph, packStore)!;
    const panel = data.panels.find((p) => p.edgeTypeId === "contains")!;
    expect(panel.items[0].kind).toBe("item");
    expect(panel.items[0].kindStyle?.icon).toBe("\u{1F4E6}");
    expect(panel.items[0].kindStyle?.color).toBe("#e5c07b");
  });

  test("works with no pack loaded — all edges in Connected panel", () => {
    const { graph, packStore } = makeEnv();
    const a = graph.addCard("A", { x: 0, y: 0 });
    const b = graph.addCard("B", { x: 100, y: 0 });
    graph.addEdge(a.id, b.id);

    const data = buildProjectionData(a.id, graph, packStore)!;
    expect(data.panels).toHaveLength(1);
    expect(data.panels[0].label).toBe("Connected");
    expect(data.panels[0].edgeTypeId).toBeNull();
    expect(data.panels[0].items[0].text).toBe("B");
  });
});
