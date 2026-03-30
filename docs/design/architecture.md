# Architecture

Aspect is built in layers. Each layer adds meaning on top of the one below it, but the lower layers never depend on the upper ones.

## Core

Core stores **cards**, **edges**, **patches**, and **events**. That's it. Core has no concept of "room", "item", "identity", or any other semantic category. It knows that cards exist, that edges connect them directionally, that patches describe changes, and that events record history.

This semantic neutrality is a design constraint, not an accident. Core is a substrate — it provides structure without imposing interpretation.

## World Packs

A **world pack** is a portable, declarative definition file that gives the graph meaning. It defines:

- **Kinds** — card types like "room", "item", "identity"
- **Edge types** — relations like "exit", "contains", "wearing"
- **Actions** — verbs like "move", "take", "wear"
- **Rules** — validation and derivation logic
- **UI hints** — presentation metadata

Core loads and interprets world packs at runtime. Different world packs produce different experiences from the same graph primitives. See [World Packs](./world-packs.md) for the full specification.

## The Stack

The conceptual stack from raw data to lived experience:

```
Projection    UI surface — renders experience as place, not diagram
Experience    affordances — what you can do here
Compression   actions — named bundles of graph mutations
Change        atomic ops — addCard, removeCard, addEdge, removeEdge, updateCard
Reality       the graph — cards and edges
```

### Reality

The graph of cards and edges. This is what exists. Cards have text content; edges have direction and (optionally) labels. The graph is stored as Y.js CRDTs, replicated across clients.

### Change

Graph transformations. Five atomic operations: `addCard`, `removeCard`, `addEdge`, `removeEdge`, `updateCard`. Every modification to the world reduces to a sequence of these.

### Compression

Actions are named, parameterized bundles of graph mutations defined in world packs. `wear(hoodie)` compresses to `removeEdge(self, hoodie, "contains")` + `addEdge(self, hoodie, "wearing")`. Actions aren't behavior — they're packaging. The behavior is graph change.

### Experience

Affordances — what you can do from where you are. Derived from the world pack's action definitions combined with the current graph neighborhood. The set of available actions changes as you navigate. See [Affordances](./affordances.md).

### Projection

The UI surface that renders experience as **place**, not as diagram. Projection reads the world pack to determine how edge types map to UI panels: "exit" edges become a navigation panel, "contains" edges become an inventory list. See [Projection](./projection.md).

## What Exists Today

All five stack layers are implemented. The full pipeline from graph primitives through world pack interpretation to experiential projection with discoverable affordances is working:

- **Core graph layer** — `CardGraph` wrapping Y.js shared types; card/edge CRDT model
- **Canvas-based graph editor** — infinite canvas, pan, zoom, multi-select, drag repositioning, brush select
- **Inline editor** — double-click to edit, Enter to commit, Shift+Enter for newlines
- **Edge labels, directional edges, multi-edge support** — edges carry optional type and label; multiple edges between the same pair are supported
- **Edge type picker** — right-click an edge to assign or change its type
- **IndexedDB persistence** via `y-indexeddb`
- **WebSocket multiplayer** via `y-websocket` with a Bun server; per-client undo/redo via `Y.UndoManager`
- **Multiplayer presence** — cursor positions, card-level awareness
- **Keyboard navigation, search, command palette** (Ctrl+K)
- **Installable PWA** with offline support
- **World pack format** — kinds, edge types, actions (Phase 1+2 format); schema validation on load
- **`WorldPackStore`** — CRDT-synced pack storage in `Y.Doc`, undoable; default "Rooms & Items" pack
- **Kind-aware rendering** — color accent, icon badge; edge type enforcement on `addEdge`
- **Action system** — declarative `when`/`do` language; JSONLogic predicates; execution integrated with Y.js transactions; event log
- **Affordance discovery** — `buildAffordances` evaluates action preconditions in O(E + A×candidates×degree); results wired into the projection
- **Projection layer** — `buildProjectionData` renders graph neighborhood as place; edge-type panels (exits, inventory, etc.)
- **Tiling projection layout** — multiple projection panes, each navigating an independent path (`tile-tree.ts`)
- **"Me" cards** — per-client identity cards; used as projection anchors
- **Multi-select** — Shift+click and brush select; multi-select drag; Shift+drag to empty space creates connected cards
- **Graph snapshot export/import** — full card/edge graph as JSON
- **Room management REST API** — `GET /api/rooms`, `GET/DELETE /api/rooms/:name`; SQLite-persisted room state; lobby UI
- **Minimap** — right-click/middle-click drag, continuous navigation, zoom controls, viewport persistence
- **Brotli bundle size tracking** — CI reports size against a budget

See [Roadmap](./roadmap.md) for remaining open work.

## Design Constraints

- Core never hardcodes semantic categories. No "room", "item", "wear" in core code.
- World packs are declarative. No Turing-complete scripting.
- Projection renders place, not topology. No nodes-and-edges diagrams in the experiential view.
- Actions are compressed graph mutations, not arbitrary behavior.
