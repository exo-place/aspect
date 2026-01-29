import type { CardGraph } from "./graph";
import type { WorldPackStore } from "./pack";
import type { CardGraphData, Card, Edge } from "./types";
import type { WorldPack } from "./pack-types";
import { validateWorldPack } from "./pack-validate";


export interface AspectSnapshot {
  version: 1;
  graph: CardGraphData;
  pack: WorldPack | null;
}

export interface SnapshotValidationError {
  path: string;
  message: string;
}

export type SnapshotValidationResult =
  | { valid: true; snapshot: AspectSnapshot }
  | { valid: false; errors: SnapshotValidationError[] };

export function exportSnapshot(graph: CardGraph, packStore: WorldPackStore): AspectSnapshot {
  return {
    version: 1,
    graph: graph.toJSON(),
    pack: packStore.get(),
  };
}

export function validateSnapshot(input: unknown): SnapshotValidationResult {
  const errors: SnapshotValidationError[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: false, errors: [{ path: "", message: "Expected an object" }] };
  }

  const obj = input as Record<string, unknown>;

  if (obj.version !== 1) {
    errors.push({ path: "version", message: "Must be 1" });
  }

  if (typeof obj.graph !== "object" || obj.graph === null || Array.isArray(obj.graph)) {
    errors.push({ path: "graph", message: "Must be an object" });
    return { valid: false, errors };
  }

  const graph = obj.graph as Record<string, unknown>;

  if (typeof graph.cards !== "object" || graph.cards === null || Array.isArray(graph.cards)) {
    errors.push({ path: "graph.cards", message: "Must be an object" });
  } else {
    const cards = graph.cards as Record<string, unknown>;
    for (const [id, val] of Object.entries(cards)) {
      if (typeof val !== "object" || val === null || Array.isArray(val)) {
        errors.push({ path: `graph.cards.${id}`, message: "Must be an object" });
        continue;
      }
      const card = val as Record<string, unknown>;
      if (typeof card.text !== "string") {
        errors.push({ path: `graph.cards.${id}.text`, message: "Must be a string" });
      }
      if (typeof card.position !== "object" || card.position === null) {
        errors.push({ path: `graph.cards.${id}.position`, message: "Must be an object" });
      } else {
        const pos = card.position as Record<string, unknown>;
        if (typeof pos.x !== "number") {
          errors.push({ path: `graph.cards.${id}.position.x`, message: "Must be a number" });
        }
        if (typeof pos.y !== "number") {
          errors.push({ path: `graph.cards.${id}.position.y`, message: "Must be a number" });
        }
      }
    }
  }

  if (typeof graph.edges !== "object" || graph.edges === null || Array.isArray(graph.edges)) {
    errors.push({ path: "graph.edges", message: "Must be an object" });
  } else {
    const edges = graph.edges as Record<string, unknown>;
    const cardIds = typeof graph.cards === "object" && graph.cards !== null && !Array.isArray(graph.cards)
      ? new Set(Object.keys(graph.cards as Record<string, unknown>))
      : new Set<string>();

    for (const [id, val] of Object.entries(edges)) {
      if (typeof val !== "object" || val === null || Array.isArray(val)) {
        errors.push({ path: `graph.edges.${id}`, message: "Must be an object" });
        continue;
      }
      const edge = val as Record<string, unknown>;
      if (typeof edge.from !== "string") {
        errors.push({ path: `graph.edges.${id}.from`, message: "Must be a string" });
      } else if (!cardIds.has(edge.from)) {
        errors.push({ path: `graph.edges.${id}.from`, message: `References unknown card "${edge.from}"` });
      }
      if (typeof edge.to !== "string") {
        errors.push({ path: `graph.edges.${id}.to`, message: "Must be a string" });
      } else if (!cardIds.has(edge.to)) {
        errors.push({ path: `graph.edges.${id}.to`, message: `References unknown card "${edge.to}"` });
      }
    }
  }

  // Validate pack if present
  if (obj.pack !== null && obj.pack !== undefined) {
    const packResult = validateWorldPack(obj.pack);
    if (!packResult.valid) {
      for (const err of packResult.errors) {
        errors.push({ path: `pack.${err.path}`, message: err.message });
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  // Materialize the validated snapshot
  const graphData = graph as { cards: Record<string, unknown>; edges: Record<string, unknown> };
  const cards: Record<string, Card> = {};
  for (const [id, val] of Object.entries(graphData.cards)) {
    const raw = val as Record<string, unknown>;
    const card: Card = {
      id,
      text: raw.text as string,
      position: raw.position as { x: number; y: number },
    };
    if (typeof raw.kind === "string") {
      (card as { kind?: string }).kind = raw.kind;
    }
    cards[id] = card;
  }
  const edges: Record<string, Edge> = {};
  for (const [id, val] of Object.entries(graphData.edges)) {
    const raw = val as Record<string, unknown>;
    const edge: Edge = {
      id,
      from: raw.from as string,
      to: raw.to as string,
    };
    if (typeof raw.label === "string") {
      (edge as { label?: string }).label = raw.label;
    }
    if (typeof raw.type === "string") {
      (edge as { type?: string }).type = raw.type;
    }
    edges[id] = edge;
  }

  return {
    valid: true,
    snapshot: {
      version: 1,
      graph: { cards, edges },
      pack: obj.pack !== null && obj.pack !== undefined ? (obj.pack as WorldPack) : null,
    },
  };
}

export function importSnapshotReplace(
  snapshot: AspectSnapshot,
  graph: CardGraph,
  packStore: WorldPackStore,
): void {
  graph.loadJSON(snapshot.graph);
  if (snapshot.pack) {
    packStore.load(snapshot.pack);
  } else {
    packStore.clear();
  }
}

export function importSnapshotMerge(
  snapshot: AspectSnapshot,
  graph: CardGraph,
): Record<string, string> {
  const idMap: Record<string, string> = {};

  // Add cards with new IDs
  for (const [oldId, card] of Object.entries(snapshot.graph.cards)) {
    const added = graph.addCard(card.text, card.position, card.kind);
    idMap[oldId] = added.id;
  }

  // Add edges with remapped IDs
  for (const edge of Object.values(snapshot.graph.edges)) {
    const newFrom = idMap[edge.from];
    const newTo = idMap[edge.to];
    if (newFrom && newTo) {
      graph.addEdge(newFrom, newTo, edge.label, edge.type);
    }
  }

  return idMap;
}
