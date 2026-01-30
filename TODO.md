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

- [x] **Action schema** — `ActionDef` in `src/action-types.ts`, `actions?` on `WorldPack`
- [x] **JSONLogic evaluator** — own implementation in `src/json-logic.ts` (no dependencies)
- [x] **Pack validation** — action validation in `src/pack-validate.ts` (structure, uniqueness, referential integrity)
- [x] **Pack store** — action serialization/deserialization in `src/pack.ts` (CRDT-synced via `Y.Array<Y.Map>`)
- [x] **Predicate evaluator** — `isActionAvailable()` in `src/action.ts` (kind check → edge type check → JSONLogic)
- [x] **Effect executor** — `executeAction()` in `src/action.ts` (addEdge, removeEdge, setKind, setText, emit)
- [x] **Action-Y.js integration** — `graph.transact()` wrapper, effects atomic and undoable
- [x] **Event log** — `EventLog` in `src/event-log.ts` (CRDT-synced `Y.Array`, append-only)
- [x] **Default pack actions** — "pick-up" and "drop" actions in `src/default-pack.ts`
- [x] **Action tests** — 308 tests across json-logic, action, event-log, pack-validate, pack

## Phase 3: projection layer

The experiential UI — graph rendered as place, not diagram. Routing: **tabs** (graph editor and projection as parallel tabs).

- [x] **Projection data types and builder** — `ProjectionData`, `PanelDef`, `PanelItem` in `src/projection-types.ts`; `buildProjectionData()` in `src/projection.ts`
- [x] **Tab bar component** — `TabBar` in `src/ui/tab-bar.ts` with Build/Experience tabs
- [x] **Projection renderer** — `ProjectionView` in `src/ui/projection-view.ts` (location header, panel sections, item buttons)
- [x] **Edge-type-to-panel mapping** — pack-driven: each `EdgeTypeDef` becomes a panel, sorted in pack definition order, untyped edges in "Connected" panel
- [x] **Place rendering** — current card as location description with kind icon, editable text (double-click)
- [x] **Reactive projection** — re-renders on graph.onChange, navigator.onNavigate, packStore.onChange, selection.onChange
- [x] **Tab navigation** — `cycle-mode` keybind (`$mod+.`), `defaultMode` setting in settings
- [x] **Projection presence** — "Who's here" section shows peers on current card
- [x] **Projection tests** — 18 tests covering all edge cases (null card, isolated, typed/untyped, bidirectional, no pack, etc.)

### Future projection ideas

- [ ] **Pack-defined projections** — packs could define multiple projection layouts (e.g. map view, inventory view)
- [ ] **Alternate canonical projections** — additional built-in views beyond graph and place (e.g. tree, timeline)

## Phase 4: affordance discovery

Connect actions to projection. The world shows you what you can do.

- [x] **Affordance evaluator** — `buildAffordances()` in `src/affordance.ts` evaluates all pack actions against graph neighborhood
- [x] **Affordance rendering** — inline action buttons on panel items + separate "Actions" panel for non-connected targets in `src/ui/projection-view.ts`
- [x] **Contextual updates** — affordances recompute inside `renderProjection()`, which fires on graph/navigation/pack/selection changes
- [x] **Affordance grouping** — `getAffordancesForCard()` filter helper; inline on connected items, standalone panel for reachable-but-unconnected
- [x] **Action execution UI** — `executeAffordance()` in `src/ui/app.ts` wires click → `executeAction()` → graph change → reactive re-render
- [x] **Affordance tests** — 11 tests in `test/affordance.test.ts` covering empty states, kind filtering, pick-up/drop cycle, multi-target, full lifecycle

## Tech debt and infrastructure

- [x] **Server persistence** — server-side Y.Doc persistence via SQLite (`src/server/persist.ts`, `src/server/debounce.ts`)
- [x] **Room management** — REST API (`src/server/api.ts`), lobby UI (`public/lobby.html`), room list/detail/delete endpoints
- [x] **Error boundaries** — graceful handling of CRDT conflicts, WebSocket disconnects, corrupt state
- [ ] **Performance profiling** — benchmark render loop, DOM reconciliation, and Y.js update handling at scale (100+ cards)
- [x] **Bundle optimization** — minified build with sourcemaps (`scripts/build.ts`), analyzer (`scripts/analyze.ts`), size budget check (`scripts/check-size.ts`), production serving mode
- [ ] **E2E tests** — browser-based tests for canvas interaction, multiplayer sync, persistence
- [x] **CI pipeline** — automated lint + typecheck + test + build on push

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
