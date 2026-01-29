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
- **Default world pack** — built-in "Rooms & Items" pack (room/item/character + exit/contains/carries)

## Current Limitations

- **No pack validation** — malformed pack JSON is not validated on load
- **No edge type picker** — edge types must be assigned programmatically, not via UI
- **No pack import/export UI** — world packs can only be loaded via code, not uploaded
- **No projection layer** — the only view is the graph editor (builder mode)
- **No affordance discovery** — no mechanism to derive available actions from structure
- **No action system** — no declarative when/do language, no compressed graph transformations
- **No rules engine** — no validation rules or derivation rules
- **Single view mode** — graph editor only; no experiential/inhabitation mode

## Phases

### Phase 1: World Pack Format + Loader ✓

Core complete. Kind definitions, edge type definitions, pack loader, CRDT-synced pack storage, kind-aware rendering, edge type enforcement, and default pack all implemented.

Remaining polish:
- Pack validation (schema checking on load)
- Pack import/export UI (file upload/download)
- Edge type picker in edge creation flow
- Pack info panel (display loaded pack, switch/clear)

### Phase 2: Action System

Implement the declarative action language. Predicate language: JSONLogic.

- `when` predicate evaluator (kind checks, edge existence, field comparisons)
- `do` effect executor (addEdge, removeEdge, set, emit)
- Action definitions in world packs
- Action execution integrated with Y.js transactions (atomic, undoable)
- Action history / event log

### Phase 3: Projection Layer

Build the experiential UI. Routing: tabs (graph editor and projection as parallel views).

- Projection renderer that reads world pack UI hints
- Edge-type-to-panel mapping (exits → navigation, contains → inventory, etc.)
- Place rendering (current card as location, not as node)
- Reactive updates from CRDT changes
- Tab navigation between graph editor and projection

### Phase 4: Affordance Discovery

Connect actions to projection:

- Evaluate action preconditions against graph neighborhood
- Surface available actions as UI affordances in projection
- Contextual affordance updates on navigation
- Affordance grouping and presentation (per-target, per-category)

## Resolved Questions

- **World pack file format** — JSON
- **Predicate language** — JSONLogic
- **Projection routing** — Tabs
- **World pack distribution** — Git repos + registry + inline Y.Doc + file upload
- **Multi-pack composition** — Merge
- **Migration on version change** — Warn ("world pack version has changed")
- **Version history** — Save all world pack versions
