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
- [x] World pack JSON schema (`WorldPack`, `KindDef`, `EdgeTypeDef` in `src/pack-types.ts`)
- [x] Kind definitions with UI hints (icon, color)
- [x] Edge type definitions with from/to kind constraints
- [x] Pack loader (`WorldPackStore` wrapping `Y.Map` in `src/pack.ts`)
- [x] Pack storage in Y.Doc (syncs across multiplayer, undoable)
- [x] Kind assignment UI (dropdown picker, K key, context menu)
- [x] Kind-aware card rendering (left border accent, icon badge)
- [x] Edge type enforcement in `addEdge` (validates kind constraints when pack + type present)
- [x] Default "Rooms & Items" world pack (room/item/character kinds, exit/contains/carries edge types)
- [x] Tests for pack loader (~21 tests) and graph kind/type (~12 tests)

## Immediate: polish and prep

- [x] **Edge label editing UX** — double-click edge label to edit inline (`src/ui/edge-line.ts`, `src/ui/app.ts`)
- [x] **Multi-select delete** — Backspace/Delete removes all selected cards (`removeCards()` in `src/graph.ts`)
- [x] **Canvas minimap** — overview inset with click-to-navigate (`src/ui/minimap.ts`)
- [x] **Card resize** — manual width override via drag handle (`setWidth()` in `src/graph.ts`, `src/ui/card-node.ts`)
- [x] **Touch support** — pinch-to-zoom, tap-to-select, long-press context menu for mobile/tablet
- [x] **Accessibility audit** — ARIA roles on cards/edges, keyboard focus management, screen reader labels
- [x] **Export/import** — JSON snapshot export/import with validation (`src/snapshot.ts`, `src/file-io.ts`)
- [x] **Settings UI** — user-configurable settings panel (`src/settings.ts`, `src/ui/settings-panel.ts`, `$mod+,`)

## Phase 1 remaining: world pack polish

Phase 1 core is complete. Remaining polish:

- [x] **Pack validation** — `validateWorldPack()` in `src/pack-validate.ts`, gates `WorldPackStore.load()`
- [x] **Pack import/export UI** — upload/download world pack JSON via command palette + context menu
- [x] **Edge type picker** — when creating edges, optionally select edge type from active pack
- [x] **Kind-aware edge labels** — auto-populate edge label from edge type label when type is set
- [x] **Pack info panel** — display loaded pack name/version, allow switching or clearing pack

## Phase 2: action system

Declarative when/do language for compressed graph transformations. Predicate language: **JSONLogic**.

- [ ] **Action schema** — extend world pack format with action definitions (context, target, when, do)
- [ ] **Predicate evaluator** — evaluate `when` preconditions against graph state (kind checks, edge existence, field comparisons)
- [ ] **Effect executor** — execute `do` effects as atomic graph mutations (addEdge, removeEdge, set, emit)
- [ ] **Action-Y.js integration** — wrap action execution in Y.js transactions (atomic, undoable)
- [ ] **Event log** — record emitted events with timestamps and actor identity
- [ ] **Action tests** — unit tests for predicate evaluation, effect execution, atomicity guarantees

## Phase 3: projection layer

The experiential UI — graph rendered as place, not diagram. Routing: **tabs** (graph editor and projection as parallel tabs).

- [ ] **Projection renderer** — new UI mode that reads world pack to determine panel layout
- [ ] **Edge-type-to-panel mapping** — exits → navigation, contains → inventory, wearing → equipment
- [ ] **Place rendering** — current card as location description, not as graph node
- [ ] **Reactive projection** — re-render on CRDT changes (navigation, remote edits, multiplayer)
- [ ] **Tab navigation** — switch between graph editor (builder) and projection (experience) as tabs
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

## Design decisions

### Resolved

- **World pack file format** — **JSON**. Simplest for tooling, native to the stack.
- **Predicate language** — **JSONLogic**. JSON-native, sufficient for kind checks and edge existence predicates.
- **Projection routing** — **Tabs**. Graph editor and projection as parallel tabs, not a toggle.
- **World pack distribution** — **All three**: git repos, registry, inline Y.Doc. Plus file upload/download.
- **Multi-pack composition** — **Merge**. Multiple packs merge their kind/edge type definitions.
- **Migration on version change** — **Warn**. Show "world pack version has changed" notification.
- **Version history** — **Save all versions**. Keep all world pack versions for rollback.

### Bidirectional edges between the same pair of cards

**Status**: Resolved — all edges are directed.

**Decision**: Edges are always directed. A→B and B→A are distinct edges that can coexist.

**Implementation plan**:

1. [x] **Offset parallel edges** — when A→B and B→A both exist, render as two visually separate spline paths (like road lanes)
2. [x] **Arrowheads** — show direction on all edges
3. [x] **Direction-aware unlinking** — removing A→B leaves B→A intact; `unlinkCards` and shift+drag unlink operate on one direction only
4. [x] **Consistent enforcement in `addEdge`** — reject duplicate (same source, same target) but allow A→B and B→A to coexist; `linkCards` and shift+drag should use `addEdge` and let it handle uniqueness
