# Aspect

Card-based identity exploration sandbox. Like MOOs if the primitives were navigate and edit, not script.

Part of the [exo-place ecosystem](https://exo-place.github.io).

## Core Concept

Everything is a **card** with **edges**. Cards are atomic units of existence — a place, a trait, a relationship, a state. Edges connect cards into a navigable graph. The world is the sum of its cards and their connections.

You **navigate** by following edges between cards. You **edit** by changing the card you're looking at. That's it.

## Primitives

| Primitive | Description |
|-----------|-------------|
| **Card** | Atomic unit with text content and edges |
| **Edge** | Directional connection between cards |
| **Navigate** | Move along an edge to another card |
| **Edit** | Change the content of the current card |

## Using Aspect

Aspect runs as a local-first web app. Open it in a browser and interact with the infinite canvas:

| Gesture | Action |
|---------|--------|
| Drag empty space | Pan the canvas |
| Scroll wheel | Zoom at cursor |
| Click card | Select card |
| Shift+click card | Add to / remove from multi-selection |
| Drag to empty space | Brush-select multiple cards |
| Click empty space | Deselect |
| Double-click card | Edit card text inline |
| Drag card | Reposition card (moves all selected if multi-selected) |
| Double-click empty space | Create new card with edge from current |
| Shift+drag to empty space | Create a new card connected to all selected cards |
| Backspace / Delete | Delete the selected card (or all selected cards) |
| Escape | Deselect |
| Ctrl/Cmd+K | Open command palette |
| Hold Control | Show keybind cheatsheet |
| Right-click card | Context menu (kind, delete) |
| Right-click edge | Edge type picker |
| Right-click minimap | Pan viewport |
| Middle-click minimap | Pan viewport |

All card data is persisted locally via IndexedDB (Y.js CRDT). Open `/room/<name>` for real-time multiplayer. The app works offline as an installable PWA.

## Design Philosophy

- **Navigate and edit over script** — moving and reshaping, not programming
- **Cards over pages** — atomic, composable units of meaning
- **Edges are structure** — the graph of connections *is* the world
- **Identity as exploration** — who you are emerges from where you go
- **Definitions over behavior** — what something *is* matters more than what it *does*

## Architecture

Local-first SPA with vanilla TypeScript. No framework — direct DOM manipulation with in-place reconciliation. Y.js CRDTs are the source of truth, persisted via `y-indexeddb` and synced in real-time via `y-websocket`. Open `/room/<name>` to share a world with others.

The server (Bun) handles WebSocket sync, SQLite room persistence, and a REST API for room management (`/api/rooms`). A lobby UI at the server root lists active and persisted rooms.

The UI has two views: a **graph editor** (builder mode — raw structure) and a **projection view** (experiential mode — the graph rendered as place). World packs define kinds, edge types, and actions. Affordances are derived from action preconditions evaluated against the current graph neighborhood.

## Development

```bash
bun install          # Install dependencies
bun run dev          # Dev server on localhost:3000
bun run lint         # oxlint
bun run check:types  # TypeScript check (tsgo)
bun test             # Unit tests
bun run test:e2e     # Playwright E2E tests
bun run bench        # Performance benchmarks (affordance evaluation, Y.js)
bun run build        # Bundle for production (with Brotli size report)
```

## License

MIT
