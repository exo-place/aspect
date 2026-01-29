# Reference

## Primitives

| Primitive | Description |
|-----------|-------------|
| **Card** | Atomic unit of existence with text content and edges |
| **Edge** | Directional connection between two cards |
| **Navigate** | Move to a connected card along an edge |
| **Edit** | Modify the content of the current card |

## Domain API

### CardGraph

Y.js CRDT-backed card and edge store with change notifications.

- `addCard(text, position)` — create a new card
- `getCard(id)` — retrieve a card by ID
- `updateCard(id, patch)` — update text or position
- `removeCard(id)` — delete a card (cascades edges)
- `addEdge(from, to, label?)` — create a directional edge
- `removeEdge(id)` — delete an edge
- `edgesFrom(id)` / `edgesTo(id)` — query edges by direction
- `neighbors(id)` — all adjacent cards (both directions)
- `allCards()` / `allEdges()` — list all
- `toJSON()` / `loadJSON(data)` — serialize / deserialize
- `onChange` — callback fired on any mutation

### Navigator

Tracks the current card and provides movement.

- `current` — the card you're looking at
- `exits` — outgoing edges from the current card
- `reachable` — cards reachable via exits
- `moveTo(id)` — follow an edge (throws if no edge exists)
- `jumpTo(id)` — move to any card (unconstrained, for canvas clicks)
- `onNavigate` — callback fired on movement

### Editor

Thin mutation layer over CardGraph.

- `setText(id, text)` — change a card's text content
- `setPosition(id, position)` — change a card's position
- `onEdit` — callback fired on edits

### Persistence & Multiplayer

All state lives in a `Y.Doc` (Y.js CRDT). Persistence and sync are handled automatically:

- **y-indexeddb** — local persistence to IndexedDB for offline support
- **y-websocket** — real-time sync via WebSocket at `/ws/:room`
- **Y.UndoManager** — per-client undo/redo (tracks cards and edges)

Open `/room/<name>` in multiple tabs or browsers to share a world.

## Canvas Interactions

| Gesture | Action |
|---------|--------|
| Drag empty space | Pan the canvas |
| Scroll wheel | Zoom at cursor |
| Click card | Navigate to card |
| Double-click card | Edit card text inline |
| Drag card | Reposition card |
| Double-click empty space | Create new card with edge from current |
