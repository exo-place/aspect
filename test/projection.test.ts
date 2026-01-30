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

  test("returns data for card with no edges (isolated card)", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const card = graph.addCard("Lonely", { x: 0, y: 0 }, "room");
    const data = buildProjectionData(card.id, graph, packStore);
    expect(data).not.toBeNull();
    expect(data!.cardId).toBe(card.id);
    expect(data!.text).toBe("Lonely");
    expect(data!.kind).toBe("room");
    expect(data!.kindStyle?.color).toBe("#56b6c2");
    expect(data!.kindStyle?.icon).toBe("\u{1F3E0}");
    expect(data!.panels).toHaveLength(0);
  });

  test("card without kind has no kind or kindStyle", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const card = graph.addCard("Plain", { x: 0, y: 0 });
    const data = buildProjectionData(card.id, graph, packStore)!;
    expect(data.kind).toBeUndefined();
    expect(data.kindStyle).toBeUndefined();
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

    const exitPanel = data.panels.find((p) => p.edgeTypeId === "exit" && p.direction === "from");
    expect(exitPanel).toBeDefined();
    expect(exitPanel!.label).toBe("exit");
    expect(exitPanel!.items).toHaveLength(2);
    const exitTexts = exitPanel!.items.map((i) => i.text);
    expect(exitTexts).toContain("Kitchen");
    expect(exitTexts).toContain("Garden");

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
    expect(inPanel!.items[0].kind).toBe("room");
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
    const outPanels = data.panels.filter((p) => p.direction === "from");
    const last = outPanels[outPanels.length - 1];
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

  test("items without kind have no kindStyle", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const room = graph.addCard("Room", { x: 0, y: 0 }, "room");
    const plain = graph.addCard("No Kind", { x: 100, y: 0 });
    graph.addEdge(room.id, plain.id);

    const data = buildProjectionData(room.id, graph, packStore)!;
    const panel = data.panels.find((p) => p.edgeTypeId === null)!;
    expect(panel.items[0].kind).toBeUndefined();
    expect(panel.items[0].kindStyle).toBeUndefined();
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
    expect(data.panels[0].direction).toBe("from");
    expect(data.panels[0].items[0].text).toBe("B");
  });

  test("bidirectional edges create separate from/to panels", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const room1 = graph.addCard("Room 1", { x: 0, y: 0 }, "room");
    const room2 = graph.addCard("Room 2", { x: 100, y: 0 }, "room");

    graph.addEdge(room1.id, room2.id, undefined, "exit");
    graph.addEdge(room2.id, room1.id, undefined, "exit");

    const data = buildProjectionData(room1.id, graph, packStore)!;
    const exitFrom = data.panels.find((p) => p.edgeTypeId === "exit" && p.direction === "from");
    const exitTo = data.panels.find((p) => p.edgeTypeId === "exit" && p.direction === "to");
    expect(exitFrom).toBeDefined();
    expect(exitTo).toBeDefined();
    expect(exitFrom!.items[0].text).toBe("Room 2");
    expect(exitTo!.items[0].text).toBe("Room 2");
  });

  test("from panels sort before to panels for same edge type", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const room1 = graph.addCard("Room 1", { x: 0, y: 0 }, "room");
    const room2 = graph.addCard("Room 2", { x: 100, y: 0 }, "room");

    graph.addEdge(room1.id, room2.id, undefined, "exit");
    graph.addEdge(room2.id, room1.id, undefined, "exit");

    const data = buildProjectionData(room1.id, graph, packStore)!;
    const exitPanels = data.panels.filter((p) => p.edgeTypeId === "exit");
    expect(exitPanels).toHaveLength(2);
    expect(exitPanels[0].direction).toBe("from");
    expect(exitPanels[1].direction).toBe("to");
  });

  test("mixed typed and untyped edges from same card", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const room = graph.addCard("Room", { x: 0, y: 0 }, "room");
    const room2 = graph.addCard("Room 2", { x: 100, y: 0 }, "room");
    const item = graph.addCard("Item", { x: 200, y: 0 }, "item");
    const misc = graph.addCard("Misc", { x: 300, y: 0 });

    graph.addEdge(room.id, room2.id, undefined, "exit");
    graph.addEdge(room.id, item.id, undefined, "contains");
    graph.addEdge(room.id, misc.id);

    const data = buildProjectionData(room.id, graph, packStore)!;
    const outPanels = data.panels.filter((p) => p.direction === "from");
    expect(outPanels).toHaveLength(3);
    // exit before contains before Connected (pack order, untyped last)
    expect(outPanels[0].edgeTypeId).toBe("exit");
    expect(outPanels[1].edgeTypeId).toBe("contains");
    expect(outPanels[2].edgeTypeId).toBeNull();
  });

  test("multiple incoming edge types", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const room = graph.addCard("Room", { x: 0, y: 0 }, "room");
    const char = graph.addCard("Hero", { x: 100, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 200, y: 0 }, "item");

    graph.addEdge(room.id, item.id, undefined, "contains");
    graph.addEdge(char.id, item.id, undefined, "carries");

    const data = buildProjectionData(item.id, graph, packStore)!;
    // All panels should be incoming
    expect(data.panels.every((p) => p.direction === "to")).toBe(true);
    expect(data.panels).toHaveLength(2);
    const containsIn = data.panels.find((p) => p.edgeTypeId === "contains");
    const carriesIn = data.panels.find((p) => p.edgeTypeId === "carries");
    expect(containsIn).toBeDefined();
    expect(carriesIn).toBeDefined();
    expect(containsIn!.items[0].text).toBe("Room");
    expect(carriesIn!.items[0].text).toBe("Hero");
  });

  test("no pack with typed edges still groups by type but labels Connected", () => {
    const { graph, packStore } = makeEnv();
    const a = graph.addCard("A", { x: 0, y: 0 });
    const b = graph.addCard("B", { x: 100, y: 0 });
    // Can add typed edge even without pack validation
    graph.addEdge(a.id, b.id, "test", "custom");

    const data = buildProjectionData(a.id, graph, packStore)!;
    // Without pack, edge types can't be resolved, so label falls back to "Connected"
    expect(data.panels).toHaveLength(1);
    expect(data.panels[0].edgeTypeId).toBe("custom");
    expect(data.panels[0].label).toBe("Connected");
  });

  test("empty text card", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const card = graph.addCard("", { x: 0, y: 0 });
    const data = buildProjectionData(card.id, graph, packStore)!;
    expect(data.text).toBe("");
  });

  test("card with unknown kind has no kindStyle", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const card = graph.addCard("Mystery", { x: 0, y: 0 }, "unknown-kind");
    const data = buildProjectionData(card.id, graph, packStore)!;
    expect(data.kind).toBe("unknown-kind");
    expect(data.kindStyle).toBeUndefined();
  });

  test("default pack full scenario: room with exits, items, and character", () => {
    const { graph, packStore } = makeEnv(DEFAULT_PACK);
    const hall = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const kitchen = graph.addCard("Kitchen", { x: 200, y: 0 }, "room");
    const garden = graph.addCard("Garden", { x: -200, y: 0 }, "room");
    const sword = graph.addCard("Sword", { x: 0, y: 100 }, "item");
    const shield = graph.addCard("Shield", { x: 100, y: 100 }, "item");
    const hero = graph.addCard("Hero", { x: -100, y: 100 }, "character");

    // Exits
    graph.addEdge(hall.id, kitchen.id, undefined, "exit");
    graph.addEdge(hall.id, garden.id, undefined, "exit");
    graph.addEdge(kitchen.id, hall.id, undefined, "exit");

    // Contents
    graph.addEdge(hall.id, sword.id, undefined, "contains");
    graph.addEdge(hall.id, shield.id, undefined, "contains");
    graph.addEdge(hall.id, hero.id, undefined, "contains");

    const data = buildProjectionData(hall.id, graph, packStore)!;
    expect(data.text).toBe("Hall");
    expect(data.kind).toBe("room");

    // Outgoing exit panel
    const exitOut = data.panels.find((p) => p.edgeTypeId === "exit" && p.direction === "from")!;
    expect(exitOut.items).toHaveLength(2);

    // Incoming exit panel (kitchen→hall)
    const exitIn = data.panels.find((p) => p.edgeTypeId === "exit" && p.direction === "to")!;
    expect(exitIn.items).toHaveLength(1);
    expect(exitIn.items[0].text).toBe("Kitchen");

    // Outgoing contains panel
    const containsOut = data.panels.find((p) => p.edgeTypeId === "contains" && p.direction === "from")!;
    expect(containsOut.items).toHaveLength(3);

    // Overall order: exit panels first (pack index 0), then contains (index 1)
    const typedPanels = data.panels.filter((p) => p.edgeTypeId !== null);
    const exitIdx = typedPanels.findIndex((p) => p.edgeTypeId === "exit");
    const containsIdx = typedPanels.findIndex((p) => p.edgeTypeId === "contains");
    expect(exitIdx).toBeLessThan(containsIdx);
  });
});
