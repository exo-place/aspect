import { describe, test } from "bun:test";
import * as Y from "yjs";
import { CardGraph } from "../src/graph";
import { WorldPackStore } from "../src/pack";
import { EventLog } from "../src/event-log";
import { createYDoc, type YDocBundle } from "../src/ydoc";
import { DEFAULT_PACK } from "../src/default-pack";
import { buildProjectionData } from "../src/projection";
import { buildAffordances } from "../src/affordance";
import { buildActionData, isActionAvailable, buildEdgeIndex } from "../src/action";

// --- Bench utility ---

interface BenchResult {
  label: string;
  iterations: number;
  median: number;
  p95: number;
  min: number;
  max: number;
}

function bench(label: string, iterations: number, fn: () => void): BenchResult {
  // Warm-up run
  fn();

  const times: number[] = [];
  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  times.sort((a, b) => a - b);
  const median = times[Math.floor(times.length / 2)];
  const p95 = times[Math.floor(times.length * 0.95)];
  const min = times[0];
  const max = times[times.length - 1];

  console.log(
    `  ${label}: median=${median.toFixed(3)}ms  p95=${p95.toFixed(3)}ms  min=${min.toFixed(3)}ms  max=${max.toFixed(3)}ms  (${iterations} iterations)`,
  );

  return { label, iterations, median, p95, min, max };
}

// --- World generator ---

interface GeneratedWorld {
  bundle: YDocBundle;
  graph: CardGraph;
  packStore: WorldPackStore;
  eventLog: EventLog;
  roomIds: string[];
  itemIds: string[];
  charIds: string[];
}

function generateWorld(cardCount: number): GeneratedWorld {
  const bundle = createYDoc();
  const graph = new CardGraph(bundle);
  const packStore = new WorldPackStore(bundle);
  const eventLog = new EventLog(bundle);
  packStore.load(DEFAULT_PACK);
  graph.setPackStore(packStore);

  const roomCount = Math.floor(cardCount * 0.4);
  const itemCount = Math.floor(cardCount * 0.4);
  const charCount = cardCount - roomCount - itemCount;

  const roomIds: string[] = [];
  const itemIds: string[] = [];
  const charIds: string[] = [];

  // Create rooms in a grid
  const cols = Math.ceil(Math.sqrt(roomCount));
  for (let i = 0; i < roomCount; i++) {
    const x = (i % cols) * 200;
    const y = Math.floor(i / cols) * 200;
    const card = graph.addCard(`Room ${i}`, { x, y }, "room");
    roomIds.push(card.id);
  }

  // Create items
  for (let i = 0; i < itemCount; i++) {
    const card = graph.addCard(`Item ${i}`, { x: i * 50, y: -200 }, "item");
    itemIds.push(card.id);
  }

  // Create characters
  for (let i = 0; i < charCount; i++) {
    const card = graph.addCard(`Character ${i}`, { x: i * 50, y: -400 }, "character");
    charIds.push(card.id);
  }

  // Exit edges: connect rooms in a grid pattern
  for (let i = 0; i < roomIds.length; i++) {
    // Right neighbor
    if ((i + 1) % cols !== 0 && i + 1 < roomIds.length) {
      graph.addEdge(roomIds[i], roomIds[i + 1], undefined, "exit");
    }
    // Down neighbor
    if (i + cols < roomIds.length) {
      graph.addEdge(roomIds[i], roomIds[i + cols], undefined, "exit");
    }
  }

  // Contains edges: distribute items and characters into rooms
  for (let i = 0; i < itemIds.length; i++) {
    const roomIdx = i % roomIds.length;
    graph.addEdge(roomIds[roomIdx], itemIds[i], undefined, "contains");
  }
  for (let i = 0; i < charIds.length; i++) {
    const roomIdx = i % roomIds.length;
    graph.addEdge(roomIds[roomIdx], charIds[i], undefined, "contains");
  }

  // Carries edges: first character carries first item (if both exist)
  if (charIds.length > 0 && itemIds.length > 0) {
    graph.addEdge(charIds[0], itemIds[0], undefined, "carries");
  }

  return { bundle, graph, packStore, eventLog, roomIds, itemIds, charIds };
}

// --- Benchmark suites ---

const SCALES = [100, 500, 1000];
const ITERATIONS = 50;

describe("performance benchmarks", () => {
  for (const scale of SCALES) {
    describe(`${scale} cards`, () => {
      let world: GeneratedWorld;

      // Generate world once per scale
      test(`setup (${scale} cards)`, () => {
        console.log(`\n=== ${scale} cards ===`);
        const start = performance.now();
        world = generateWorld(scale);
        const elapsed = performance.now() - start;
        console.log(`  world generation: ${elapsed.toFixed(1)}ms`);
        console.log(
          `  cards: ${world.roomIds.length} rooms, ${world.itemIds.length} items, ${world.charIds.length} chars`,
        );
        console.log(`  edges: ${world.graph.allEdges().length}`);
      });

      // 1. Graph materialization
      test("allCards()", () => {
        bench("allCards", ITERATIONS, () => world.graph.allCards());
      });

      test("allEdges()", () => {
        bench("allEdges", ITERATIONS, () => world.graph.allEdges());
      });

      test("edgesFrom()", () => {
        const roomId = world.roomIds[0];
        bench("edgesFrom", ITERATIONS, () => world.graph.edgesFrom(roomId));
      });

      test("edgesTo()", () => {
        const roomId = world.roomIds[0];
        bench("edgesTo", ITERATIONS, () => world.graph.edgesTo(roomId));
      });

      test("neighbors()", () => {
        const roomId = world.roomIds[0];
        bench("neighbors", ITERATIONS, () => world.graph.neighbors(roomId));
      });

      test("getCard()", () => {
        const roomId = world.roomIds[0];
        bench("getCard", ITERATIONS, () => world.graph.getCard(roomId));
      });

      // 2. Projection building
      test("buildProjectionData (connected room)", () => {
        const roomId = world.roomIds[0];
        bench("projection(connected)", ITERATIONS, () => {
          buildProjectionData(roomId, world.graph, world.packStore);
        });
      });

      test("buildProjectionData (isolated card)", () => {
        // Add an isolated card for this test
        const isolated = world.graph.addCard("Isolated", { x: -999, y: -999 });
        bench("projection(isolated)", ITERATIONS, () => {
          buildProjectionData(isolated.id, world.graph, world.packStore);
        });
      });

      // 3. Affordance evaluation
      test("buildAffordances (character context)", () => {
        if (world.charIds.length === 0) return;
        const charId = world.charIds[0];
        bench("affordances(char)", ITERATIONS, () => {
          buildAffordances(charId, world.graph, world.packStore);
        });
      });

      test("buildAffordances (room context)", () => {
        const roomId = world.roomIds[0];
        bench("affordances(room)", ITERATIONS, () => {
          buildAffordances(roomId, world.graph, world.packStore);
        });
      });

      // 4. Action data
      test("buildActionData", () => {
        if (world.charIds.length === 0 || world.itemIds.length === 0) return;
        const contextId = world.charIds[0];
        const targetId = world.itemIds[0];
        const edgeIdx = buildEdgeIndex(world.graph);
        bench("buildActionData", ITERATIONS, () => {
          buildActionData(world.graph, contextId, targetId, edgeIdx);
        });
      });

      test("isActionAvailable", () => {
        if (world.charIds.length === 0 || world.itemIds.length === 0) return;
        const action = world.packStore.getAction("pick-up")!;
        const contextId = world.charIds[0];
        const targetId = world.itemIds[1] ?? world.itemIds[0];
        const edgeIdx = buildEdgeIndex(world.graph);
        bench("isActionAvailable", ITERATIONS, () => {
          isActionAvailable(action, world.graph, world.packStore, contextId, targetId, edgeIdx);
        });
      });

      // 5. CRDT sync
      test("Y.encodeStateAsUpdate", () => {
        bench("encodeState", ITERATIONS, () => {
          Y.encodeStateAsUpdate(world.bundle.doc);
        });
      });

      test("Y.applyUpdate to fresh doc", () => {
        const update = Y.encodeStateAsUpdate(world.bundle.doc);
        bench("applyUpdate", ITERATIONS, () => {
          const fresh = new Y.Doc();
          Y.applyUpdate(fresh, update);
          fresh.destroy();
        });
      });

      test("full sync cycle (encode + apply)", () => {
        bench("syncCycle", ITERATIONS, () => {
          const update = Y.encodeStateAsUpdate(world.bundle.doc);
          const fresh = new Y.Doc();
          Y.applyUpdate(fresh, update);
          fresh.destroy();
        });
      });

      // 6. Incremental update
      test("updateCard (single)", () => {
        const cardId = world.roomIds[0];
        let counter = 0;
        bench("updateCard", ITERATIONS, () => {
          world.graph.updateCard(cardId, { text: `Room 0 v${counter++}` });
        });
      });

      test("addCard + addEdge", () => {
        bench("addCard+addEdge", ITERATIONS, () => {
          const card = world.graph.addCard("Temp", { x: 0, y: 0 }, "item");
          world.graph.addEdge(world.roomIds[0], card.id, undefined, "contains");
          // Clean up
          world.graph.removeCard(card.id);
        });
      });
    });
  }
});
