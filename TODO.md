# TODO

## Done

- [x] Card data model and storage
- [x] Edge data model and graph operations
- [x] Navigation engine
- [x] Edit operations
- [x] IndexedDB storage backend
- [x] Undo/redo stack
- [x] Y.js multiplayer upgrade
- [x] Edge labels visible in UI
- [x] Keyboard navigation (arrow keys follow edges)
- [x] Card search / jump-to by text
- [x] Directional edges with arrowheads
- [x] Direction-aware unlinking
- [x] Parallel edge offset rendering
- [x] Card-level multiplayer presence
- [x] Comprehensive design documentation

## Immediate: polish and prep

- [ ] **Edge label editing UX** — double-click edge label to edit inline (currently requires menu)
- [ ] **Multi-select delete** — Backspace/Delete removes all selected cards, not just current
- [ ] **Canvas minimap** — small overview inset showing full graph extent and viewport position
- [ ] **Card resize** — cards auto-size to content but allow manual width override
- [ ] **Touch support** — pinch-to-zoom, tap-to-select, long-press context menu for mobile/tablet
- [ ] **Accessibility audit** — ARIA roles on cards/edges, keyboard focus management, screen reader labels
- [ ] **Export/import** — JSON export of full graph state, import to merge or replace

## Phase 1: world pack format + loader

The foundation. Define the portable semantic layer and teach core to load it.

- [ ] **World pack schema** — define the JSON format for kinds, edge types, pack metadata (packId, packVersion)
- [ ] **Kind definitions** — card type declarations with fields and UI hints (icon, color)
- [ ] **Edge type definitions** — from/to kind constraints, directionality, UI mapping hints
- [ ] **Pack loader** — runtime loader that reads a world pack and makes definitions queryable
- [ ] **Pack storage** — store active world pack in Y.Doc so it syncs across multiplayer
- [ ] **Kind assignment UI** — tag a card with a kind from the active world pack (dropdown or palette)
- [ ] **Kind-aware rendering** — cards render with kind-specific colors/icons in graph editor
- [ ] **Edge type enforcement** — addEdge validates from/to kind constraints when a world pack is active
- [ ] **Default world pack** — ship a built-in "rooms and items" pack as the starter experience
- [ ] **Pack validation** — schema validation on load, clear error messages for malformed packs
- [ ] **Tests for pack loader** — unit tests for schema parsing, kind lookup, edge type constraint checking

## Phase 2: action system

Declarative when/do language for compressed graph transformations.

- [ ] **Action schema** — extend world pack format with action definitions (context, target, when, do)
- [ ] **Predicate evaluator** — evaluate `when` preconditions against graph state (kind checks, edge existence, field comparisons)
- [ ] **Effect executor** — execute `do` effects as atomic graph mutations (addEdge, removeEdge, set, emit)
- [ ] **Action-Y.js integration** — wrap action execution in Y.js transactions (atomic, undoable)
- [ ] **Event log** — record emitted events with timestamps and actor identity
- [ ] **Action tests** — unit tests for predicate evaluation, effect execution, atomicity guarantees
- [ ] **Predicate language decision** — choose between CEL, JSONLogic, or custom DSL (see open questions in roadmap)

## Phase 3: projection layer

The experiential UI — graph rendered as place, not diagram.

- [ ] **Projection renderer** — new UI mode that reads world pack to determine panel layout
- [ ] **Edge-type-to-panel mapping** — exits → navigation, contains → inventory, wearing → equipment
- [ ] **Place rendering** — current card as location description, not as graph node
- [ ] **Reactive projection** — re-render on CRDT changes (navigation, remote edits, multiplayer)
- [ ] **Mode toggle** — switch between graph editor (builder) and projection (experience) views
- [ ] **Projection routing** — decide: separate route vs toggle (see open questions)
- [ ] **Projection presence** — show who else is "in" the same projected location
- [ ] **Projection tests** — test that world pack → panel mapping produces correct UI structure

## Phase 4: affordance discovery

Connect actions to projection. The world shows you what you can do.

- [ ] **Affordance evaluator** — for each action in world pack, evaluate preconditions against graph neighborhood
- [ ] **Affordance rendering** — surface available actions as buttons/links in projection panels
- [ ] **Contextual updates** — re-evaluate affordances on navigation, graph change, pack change
- [ ] **Affordance grouping** — group by target card, by category, or by action type
- [ ] **Action execution UI** — click an affordance → execute the action → see the result in projection
- [ ] **Affordance tests** — test that graph neighborhood + world pack → correct available actions

## Tech debt and infrastructure

- [ ] **Server persistence** — server-side Y.Doc persistence (currently in-memory only; rooms lost on restart)
- [ ] **Room management** — list rooms, delete rooms, room metadata
- [ ] **Error boundaries** — graceful handling of CRDT conflicts, WebSocket disconnects, corrupt state
- [ ] **Performance profiling** — benchmark render loop, DOM reconciliation, and Y.js update handling at scale (100+ cards)
- [ ] **Bundle optimization** — tree-shake Y.js, lazy-load non-critical UI, measure bundle size
- [ ] **E2E tests** — browser-based tests for canvas interaction, multiplayer sync, persistence
- [ ] **CI pipeline** — automated lint + typecheck + test on push

## Open questions

- **World pack file format** — JSON vs YAML vs custom? JSON is simplest for tooling; YAML is more readable; custom could be more expressive. Current lean: JSON.
- **Predicate language** — CEL vs JSONLogic vs custom DSL? CEL is proven but heavy; JSONLogic is JSON-native but awkward; custom allows tight integration but costs more.
- **Projection routing** — separate route (`/room/name/projection`) vs toggle within same view? Routing is cleaner; toggle is more fluid.
- **World pack distribution** — git repos, a registry, inline in Y.Doc, or all three?
- **Multi-pack composition** — how do multiple packs interact? Override? Namespace? Merge?
- **Migration strategy** — how do graphs adapt when a world pack version changes?

## Design decisions

### Bidirectional edges between the same pair of cards

**Status**: Resolved — all edges are directed.

**Decision**: Edges are always directed. A→B and B→A are distinct edges that can coexist.

**Implementation plan**:

1. [x] **Offset parallel edges** — when A→B and B→A both exist, render as two visually separate spline paths (like road lanes)
2. [x] **Arrowheads** — show direction on all edges
3. [x] **Direction-aware unlinking** — removing A→B leaves B→A intact; `unlinkCards` and shift+drag unlink operate on one direction only
4. [x] **Consistent enforcement in `addEdge`** — reject duplicate (same source, same target) but allow A→B and B→A to coexist; `linkCards` and shift+drag should use `addEdge` and let it handle uniqueness
