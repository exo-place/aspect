# Performance

Performance characteristics of the core systems, measured at 100/500/1000 cards with the default "Rooms & Items" world pack. Benchmarks live in `bench/bench.test.ts` and run via `bun run bench`.

## Affordance evaluation

`buildAffordances` is the hot path — called on every navigation, graph change, and pack change to surface available actions in the experiential view.

### Problem

The original algorithm was O(A × C × E) where A = actions, C = cards, E = edges. For each action, it iterated every card; for each candidate card, `isActionAvailable` called `buildActionData` which scanned every edge via `graph.allEdges()`. At 1000 cards with 1361 edges and 4 actions, that produced ~2.7M edge iterations per call (~200ms).

### Solution: edge index

`buildEdgeIndex` (`src/action.ts`) constructs an adjacency index in a single O(E) pass:

```ts
interface EdgeIndex {
  from: Map<string, Edge[]>;  // cardId → outgoing edges
  to: Map<string, Edge[]>;    // cardId → incoming edges
}
```

This index is built once per `buildAffordances` call and threaded through to `isActionAvailable` and `buildActionData`. Where those functions previously scanned all edges, they now do O(1) map lookups followed by O(degree) iteration.

`buildAffordances` (`src/affordance.ts`) also narrows candidates before evaluation:

1. **Edge type constraint** — if the action requires `edgeType`, follow only matching edges from the context card in the index. Candidates = direct neighbors of the right type.
2. **Kind constraint** — if the action requires `target.kind`, look up a pre-built kind-to-cards map instead of scanning all cards.
3. **No constraint** — fall back to all cards (rare in practice).

### Complexity

| Path | Before | After |
|------|--------|-------|
| `buildEdgeIndex` | — | O(E) once |
| Kind grouping | — | O(C) once |
| "drop" (edgeType: carries) | O(C × E) per action | O(context_degree) |
| "pick-up" (kind: item, when clause) | O(items × E) | O(items × degree) |
| `buildActionData` per call | O(E) | O(degree) |
| `isActionAvailable` per call | O(E) | O(degree) |

### Measured results (1000 cards, 1361 edges)

| Metric | Before | After |
|--------|--------|-------|
| `affordances(char)` | ~200ms | ~3.5ms |
| `affordances(room)` | — | ~1.2ms |
| `buildActionData` (indexed) | ~0.9ms | 0.002ms |
| `isActionAvailable` (indexed) | ~1.3ms | 0.003ms |

The non-indexed code path is preserved for callers that evaluate a single (context, target) pair where building the index isn't worth it.

## Y.js CRDT overhead

Y.js is the source of truth for all graph state. Its performance sets the floor for several operations.

### Materialization

Every `graph.getCard()`, `graph.allCards()`, `graph.allEdges()` call reads from `Y.Map` structures and materializes plain JS objects. At 1000 cards:

| Operation | Median |
|-----------|--------|
| `getCard` | <0.01ms |
| `allCards` | 0.18ms |
| `allEdges` | 0.29ms |
| `edgesFrom` | 0.21ms |

These costs are per-call. The edge index amortizes `allEdges` to a single call per render cycle.

### Sync

| Operation | 1000 cards |
|-----------|------------|
| `encodeStateAsUpdate` | ~2.7ms |
| `applyUpdate` (fresh doc) | ~9ms |
| Full sync cycle | ~11ms |

These happen on connect and background sync, not per-frame.

### Known issues

- **Y.Map write pattern bloat**: alternating writes to different keys in the same `Y.Map` defeats Yjs's internal run-length optimization, causing document size to grow faster than expected. The `YKeyValue` utility from `y-utility` mitigates this by batching writes.
- **Tombstone growth**: deleted CRDT structs can't be fully garbage collected while maintaining causal ordering. Yjs merges adjacent tombstones to reduce overhead, but documents grow monotonically.

### Alternatives considered

| Option | Tradeoff |
|--------|----------|
| **V2 encoding** (`encodeStateAsUpdateV2`) | Drop-in. Better compression for large documents, worse for small incremental updates. All clients must agree on encoding version. |
| **Yrs** (Rust port of Yjs) | Protocol-compatible. Server could use Yrs for persistence/encoding while clients stay on JS Yjs. Speeds up server-side work only. |
| **Loro** (Rust + WASM) | Best raw CRDT performance. Snapshot feature for fast loading. Full edit history DAG. Different API and wire protocol — requires rewriting `CardGraph`, persistence, and sync layers. |

Current stance: Y.js performance is acceptable. The per-frame bottleneck was affordance evaluation, now resolved. Sync overhead happens off the critical path. Revisit if document sizes grow large or materialization becomes a bottleneck.

## Sources

- [Yjs V2 encoding efficiency](https://discuss.yjs.dev/t/how-efficient-is-updatev2-encoding/1148) — discussion of V1 vs V2 tradeoffs, when V2 helps
- [Optimizing Yjs first load at Chronicle](https://anikd.com/blog/optimizing-yjs-first-load/) — real-world case study of Y.Map bloat causing >2MB initial sync payloads
- [Yjs vs Loro](https://discuss.yjs.dev/t/yjs-vs-loro-new-crdt-lib/2567) — community comparison of architecture, history tracking, and benchmark methodology
- [Loro JS/WASM benchmarks](https://loro.dev/docs/performance) — Loro's published encode/decode/edit benchmarks against Yjs and Automerge
- [crdt-benchmarks](https://github.com/dmonad/crdt-benchmarks) — canonical CRDT benchmark suite (Yjs, Automerge, Loro, json-joy)
- [Automerge 3.0 memory improvements](https://biggo.com/news/202508071934_Automerge_3.0_Memory_Improvements) — 10x memory reduction, columnar encoding
- [CRDTs go brrr](https://josephg.com/blog/crdts-go-brrr/) — Joseph Gentle's analysis of CRDT performance limits and Diamond Types
- [Yrs (Rust port)](https://docs.rs/yrs) — protocol-compatible Rust implementation of Yjs
- [y-protocols](https://github.com/yjs/y-protocols/blob/master/PROTOCOL.md) — Yjs wire protocol specification, varint encoding details
