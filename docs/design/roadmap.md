# Roadmap

What exists, what's planned, and what's still open.

## Implemented

The core graph layer, multiplayer infrastructure, and world pack foundation are working:

- **Card/edge data model** — `CardGraph` wrapping Y.js `Y.Map` collections from a shared `Y.Doc`
- **Canvas UI** — infinite canvas with pan, zoom, multi-select, drag repositioning
- **Navigator** — click to select, keyboard arrow navigation between connected cards
- **Inline editor** — double-click to edit card text, Enter to commit, Escape to cancel
- **Edge labels** — edges display optional text labels
- **Directional edges** — edges have direction; unlinking is direction-aware
- **Card creation** — double-click empty space; new card auto-edges from current card
- **Card deletion** — Backspace/Delete removes card and its edges
- **Command palette** — Ctrl+K / Cmd+K for searchable command execution
- **Keyboard shortcuts** — full keybind system with cheatsheet overlay (hold Ctrl)
- **Card search** — search cards by content with jump-to-card
- **IndexedDB persistence** — via `y-indexeddb`; data survives refresh
- **WebSocket multiplayer** — `y-websocket` with Bun server at `/ws/:room`
- **Multiplayer presence** — cursor positions and card-level awareness via Y.js awareness protocol
- **Per-client undo/redo** — via `Y.UndoManager`
- **PWA** — installable, works offline
- **Context menu** — right-click for card actions
- **World pack format** — JSON schema for kinds (card types) and edge types with constraints
- **World pack loader** — `WorldPackStore` wrapping `Y.Map` for CRDT sync and persistence
- **Card kinds** — cards can be tagged with a kind from the active world pack
- **Kind-aware rendering** — cards show kind-specific left border accent color and icon badge
- **Kind assignment UI** — dropdown picker via K key or context menu
- **Edge types** — edges can carry a type referencing an edge type definition
- **Edge type enforcement** — `addEdge` validates from/to kind constraints when pack and type are present
- **Edge type picker** — right-click an edge to change its type; multi-edge support
- **Default world pack** — built-in "Rooms & Items" pack (room/item/character + exit/contains/carries)
- **Pack schema validation** — malformed world pack JSON is validated on load
- **Action system** — declarative `when`/`do` language in world packs; JSONLogic predicates; Y.js-integrated execution
- **Event log** — records action history; replayable
- **Affordance discovery** — `buildAffordances` evaluates action preconditions against graph neighborhood; O(E + A×candidates×degree) algorithm
- **Projection layer** — `buildProjectionData` renders graph neighborhood as place with edge-type panels
- **Tiling layout** — multiple projection panes, each navigating an independent path
- **"Me" cards** — mark cards as representing you; used as projection navigation anchors
- **Multi-select** — Shift+click or brush select; multi-select drag, edge creation from all selected cards
- **Shift+drag to empty space** — creates a new connected card from all selected cards
- **Graph snapshot export/import** — save and load the full card/edge graph as JSON
- **Room management REST API** — `GET/DELETE /api/rooms`, `GET /api/rooms/:name`; SQLite-persisted room state
- **Lobby UI** — server-side room listing page
- **Minimap panning** — right-click or middle-click drag on the minimap; continuous drag navigation
- **Zoom controls** — zoom in/out buttons, reset zoom, viewport persistence
- **Brotli bundle size tracking** — CI checks bundle size against a budget

## Current Limitations

- **No pack import/export UI** — world packs can only be loaded via code, not uploaded
- **No rules engine** — validation rules or derivation rules not yet implemented
- **No pack switching UI** — the active world pack cannot be changed via the UI

## Phases

### Phase 1: World Pack Format + Loader ✓

Complete. Kind definitions, edge type definitions, pack loader, CRDT-synced pack storage, kind-aware rendering, edge type enforcement, default pack, schema validation on load, and edge type picker all implemented.

### Phase 2: Action System ✓

Complete. Declarative action language implemented with JSONLogic predicates.

- `when` predicate evaluator via JSONLogic (`src/json-logic.ts`)
- `do` effect executor (addEdge, removeEdge, set, emit)
- Action definitions in world pack format (`actions` array)
- Action execution integrated with Y.js transactions (atomic, undoable)
- Action history / event log (`src/event-log.ts`)
- Affordance evaluation connected to the projection layer

### Phase 3: Projection Layer ✓

Complete. Experiential view implemented as a tiling projection layout alongside the graph editor.

- `buildProjectionData` (`src/projection.ts`) — reads graph neighborhood + world pack to produce panel data
- Edge-type-to-panel mapping (edge types group into named panels)
- Place rendering: current card as location with outgoing/incoming panels
- Tiling layout: multiple projection panes side by side, each drilling its own path (`src/tile-tree.ts`)
- "Me" cards: mark cards as representing you; these become navigation anchors
- Reactive updates: projection re-renders on graph or pack changes

### Phase 4: Affordance Discovery ✓

Complete. Actions are connected to the projection layer.

- `buildAffordances` (`src/affordance.ts`) — evaluates action preconditions against graph neighborhood
- Edge index (`buildEdgeIndex` in `src/action.ts`) — O(E) once per render, O(degree) per lookup
- Kind grouping — candidate narrowing before JSONLogic evaluation
- Affordances rendered as actionable UI elements in the projection view

## Resolved Questions

- **World pack file format** — JSON
- **Predicate language** — JSONLogic
- **Projection routing** — Tabs
- **World pack distribution** — Git repos + registry + inline Y.Doc + file upload
- **Multi-pack composition** — Merge
- **Migration on version change** — Warn ("world pack version has changed")
- **Version history** — Save all world pack versions
