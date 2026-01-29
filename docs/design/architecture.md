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

The core graph layer, CRDT multiplayer, and Phase 1 world pack support are implemented:

- Card/edge data model with `CardGraph` wrapping Y.js shared types
- Canvas-based graph editor UI (navigator, inline editor, multi-select)
- IndexedDB persistence via `y-indexeddb`
- WebSocket multiplayer via `y-websocket` with a Bun server
- Multiplayer presence (cursors, card-level awareness)
- Per-client undo/redo via `Y.UndoManager`
- Edge labels and directional edges
- Keyboard navigation, search, command palette
- Installable PWA with offline support
- World pack format (JSON) with kind definitions and edge type definitions
- `WorldPackStore` — CRDT-synced pack storage in `Y.Doc`, undoable
- Card kind assignment with kind-aware rendering (color accent, icon badge)
- Edge type enforcement (from/to kind constraints validated on `addEdge`)
- Default "Rooms & Items" world pack

The action system, affordance discovery, and the projection layer are planned. See [Roadmap](./roadmap.md) for the full timeline.

## Design Constraints

- Core never hardcodes semantic categories. No "room", "item", "wear" in core code.
- World packs are declarative. No Turing-complete scripting.
- Projection renders place, not topology. No nodes-and-edges diagrams in the experiential view.
- Actions are compressed graph mutations, not arbitrary behavior.
