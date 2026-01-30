import { describe, expect, test } from "bun:test";
import { CardGraph } from "../src/graph";
import { WorldPackStore } from "../src/pack";
import { EventLog } from "../src/event-log";
import { createYDoc } from "../src/ydoc";
import { buildAffordances, getAffordancesForCard } from "../src/affordance";
import { executeAction } from "../src/action";
import { DEFAULT_PACK } from "../src/default-pack";
import type { WorldPack } from "../src/pack-types";

function makeWorld(pack: WorldPack = DEFAULT_PACK) {
  const bundle = createYDoc();
  const graph = new CardGraph(bundle);
  const packStore = new WorldPackStore(bundle);
  const eventLog = new EventLog(bundle);
  packStore.load(pack);
  graph.setPackStore(packStore);
  return { bundle, graph, packStore, eventLog };
}

describe("buildAffordances", () => {
  test("returns empty when no actions in pack", () => {
    const pack: WorldPack = {
      packId: "no-actions",
      packVersion: 1,
      name: "No Actions",
      kinds: [{ id: "room", label: "Room" }],
      edgeTypes: [],
    };
    const { graph, packStore } = makeWorld(pack);
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");

    const affordances = buildAffordances(room.id, graph, packStore);
    expect(affordances).toHaveLength(0);
  });

  test("returns empty when no pack loaded", () => {
    const bundle = createYDoc();
    const graph = new CardGraph(bundle);
    const packStore = new WorldPackStore(bundle);
    const card = graph.addCard("A", { x: 0, y: 0 });

    const affordances = buildAffordances(card.id, graph, packStore);
    expect(affordances).toHaveLength(0);
  });

  test("skips actions where context kind doesn't match", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");
    graph.addEdge(room.id, item.id, undefined, "contains");

    // pick-up and drop both require context kind "character"
    const affordances = buildAffordances(room.id, graph, packStore);
    expect(affordances).toHaveLength(0);
  });

  test("finds pick-up affordance when character and item share a room", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const char = graph.addCard("Hero", { x: 100, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 200, y: 0 }, "item");
    graph.addEdge(room.id, char.id, undefined, "contains");
    graph.addEdge(room.id, item.id, undefined, "contains");

    const affordances = buildAffordances(char.id, graph, packStore);
    expect(affordances).toHaveLength(1);
    expect(affordances[0].actionId).toBe("pick-up");
    expect(affordances[0].actionLabel).toBe("Pick Up");
    expect(affordances[0].targetCardId).toBe(item.id);
    expect(affordances[0].targetText).toBe("Sword");
    expect(affordances[0].targetKind).toBe("item");
    expect(affordances[0].targetKindStyle).toBeDefined();
  });

  test("does not find pick-up when no shared room", () => {
    const { graph, packStore } = makeWorld();
    const room1 = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const room2 = graph.addCard("Yard", { x: 300, y: 0 }, "room");
    const char = graph.addCard("Hero", { x: 100, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 200, y: 0 }, "item");
    graph.addEdge(room1.id, char.id, undefined, "contains");
    graph.addEdge(room2.id, item.id, undefined, "contains");

    const affordances = buildAffordances(char.id, graph, packStore);
    expect(affordances).toHaveLength(0);
  });

  test("does not find pick-up when carries edge already exists", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const char = graph.addCard("Hero", { x: 100, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 200, y: 0 }, "item");
    graph.addEdge(room.id, char.id, undefined, "contains");
    graph.addEdge(room.id, item.id, undefined, "contains");
    graph.addEdge(char.id, item.id, undefined, "carries");

    const affordances = buildAffordances(char.id, graph, packStore);
    // Should only find drop, not pick-up
    const pickUp = affordances.filter((a) => a.actionId === "pick-up");
    expect(pickUp).toHaveLength(0);
  });

  test("finds drop affordance when carries edge exists", () => {
    const { graph, packStore } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 100, y: 0 }, "item");
    graph.addEdge(char.id, item.id, undefined, "carries");

    const affordances = buildAffordances(char.id, graph, packStore);
    expect(affordances).toHaveLength(1);
    expect(affordances[0].actionId).toBe("drop");
    expect(affordances[0].targetCardId).toBe(item.id);
  });

  test("finds multiple affordances for different targets", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const char = graph.addCard("Hero", { x: 100, y: 0 }, "character");
    const item1 = graph.addCard("Sword", { x: 200, y: 0 }, "item");
    const item2 = graph.addCard("Shield", { x: 300, y: 0 }, "item");
    graph.addEdge(room.id, char.id, undefined, "contains");
    graph.addEdge(room.id, item1.id, undefined, "contains");
    graph.addEdge(room.id, item2.id, undefined, "contains");

    const affordances = buildAffordances(char.id, graph, packStore);
    expect(affordances).toHaveLength(2);
    const targetIds = affordances.map((a) => a.targetCardId);
    expect(targetIds).toContain(item1.id);
    expect(targetIds).toContain(item2.id);
  });

  test("never includes context card as target", () => {
    const { graph, packStore } = makeWorld();
    const char = graph.addCard("Hero", { x: 0, y: 0 }, "character");

    const affordances = buildAffordances(char.id, graph, packStore);
    const selfTargets = affordances.filter((a) => a.targetCardId === char.id);
    expect(selfTargets).toHaveLength(0);
  });
});

describe("getAffordancesForCard", () => {
  test("filters correctly", () => {
    const { graph, packStore } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const char = graph.addCard("Hero", { x: 100, y: 0 }, "character");
    const item1 = graph.addCard("Sword", { x: 200, y: 0 }, "item");
    const item2 = graph.addCard("Shield", { x: 300, y: 0 }, "item");
    graph.addEdge(room.id, char.id, undefined, "contains");
    graph.addEdge(room.id, item1.id, undefined, "contains");
    graph.addEdge(room.id, item2.id, undefined, "contains");

    const affordances = buildAffordances(char.id, graph, packStore);
    const forItem1 = getAffordancesForCard(affordances, item1.id);
    expect(forItem1).toHaveLength(1);
    expect(forItem1[0].targetCardId).toBe(item1.id);

    const forRoom = getAffordancesForCard(affordances, room.id);
    expect(forRoom).toHaveLength(0);
  });
});

describe("full cycle", () => {
  test("pick-up available → execute → drop available, pick-up gone", () => {
    const { graph, packStore, eventLog } = makeWorld();
    const room = graph.addCard("Hall", { x: 0, y: 0 }, "room");
    const char = graph.addCard("Hero", { x: 100, y: 0 }, "character");
    const item = graph.addCard("Sword", { x: 200, y: 0 }, "item");
    graph.addEdge(room.id, char.id, undefined, "contains");
    graph.addEdge(room.id, item.id, undefined, "contains");

    // Before pick-up: should have pick-up affordance
    const before = buildAffordances(char.id, graph, packStore);
    const pickUpBefore = before.filter((a) => a.actionId === "pick-up");
    const dropBefore = before.filter((a) => a.actionId === "drop");
    expect(pickUpBefore).toHaveLength(1);
    expect(dropBefore).toHaveLength(0);

    // Execute pick-up
    const action = packStore.getAction("pick-up")!;
    const result = executeAction(action, graph, packStore, char.id, item.id, eventLog, "tester");
    expect(result.success).toBe(true);

    // After pick-up: should have drop, no pick-up
    const after = buildAffordances(char.id, graph, packStore);
    const pickUpAfter = after.filter((a) => a.actionId === "pick-up");
    const dropAfter = after.filter((a) => a.actionId === "drop");
    expect(pickUpAfter).toHaveLength(0);
    expect(dropAfter).toHaveLength(1);
    expect(dropAfter[0].targetCardId).toBe(item.id);
  });
});
