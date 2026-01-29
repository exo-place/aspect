# Roadmap

What exists, what's planned, and what's still open.

## Implemented

The core graph layer and multiplayer infrastructure are working:

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

## Current Limitations

- **Untyped edges** — edges have labels but no kind/type system; no semantic constraints
- **No world packs** — all cards and edges are undifferentiated; no kinds, no edge type definitions
- **No projection layer** — the only view is the graph editor (builder mode)
- **No affordance discovery** — no mechanism to derive available actions from structure
- **No action system** — no declarative when/do language, no compressed graph transformations
- **No rules engine** — no validation rules or derivation rules
- **Single view mode** — graph editor only; no experiential/inhabitation mode

## Phases

### Phase 1: World Pack Format + Loader

Define the world pack file format and implement loading:

- Kind definitions (card types with fields and UI hints)
- Edge type definitions (from/to constraints, directionality, UI mapping)
- Pack metadata (packId, packVersion)
- Runtime loader that interprets pack definitions against the live graph
- Kind assignment UI (tag a card with a kind from the active world pack)

### Phase 2: Action System

Implement the declarative action language:

- `when` predicate evaluator (kind checks, edge existence, field comparisons)
- `do` effect executor (addEdge, removeEdge, set, emit)
- Action definitions in world packs
- Action execution integrated with Y.js transactions (atomic, undoable)
- Action history / event log

### Phase 3: Projection Layer

Build the experiential UI:

- Projection renderer that reads world pack UI hints
- Edge-type-to-panel mapping (exits → navigation, contains → inventory, etc.)
- Place rendering (current card as location, not as node)
- Reactive updates from CRDT changes
- Toggle or route switch between graph editor and projection

### Phase 4: Affordance Discovery

Connect actions to projection:

- Evaluate action preconditions against graph neighborhood
- Surface available actions as UI affordances in projection
- Contextual affordance updates on navigation
- Affordance grouping and presentation (per-target, per-category)

## Open Questions

- **World pack file format** — JSON, YAML, or a custom format? JSON is simplest; YAML is more readable; a custom format could be more expressive.
- **Predicate language** — CEL, JSONLogic, or custom? CEL is proven but complex; JSONLogic is JSON-native; custom allows tighter integration but costs more to implement.
- **Projection routing** — separate route (`/room/name/projection`) vs toggle within the same view? Routing is cleaner; toggle is more fluid.
- **World pack distribution** — how are packs shared? Git repos, a registry, inline in the Y.Doc?
- **Multi-pack composition** — how do multiple world packs interact? Override rules, namespace isolation, or explicit merging?
- **Migration strategy** — how do graphs adapt when a world pack version changes? Automatic migration, manual upgrade, or dual-version support?
