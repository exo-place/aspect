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
| Click empty space | Deselect current card |
| Double-click card | Edit card text inline |
| Drag card | Reposition card |
| Double-click empty space | Create new card with edge from current |
| Backspace / Delete | Delete the selected card |
| Escape | Deselect current card |
| Ctrl/Cmd+K | Open command palette |
| Hold Control | Show keybind cheatsheet |
| Right-click card | Context menu (delete) |

All card data is persisted locally via IndexedDB (Y.js CRDT). Open `/room/<name>` for real-time multiplayer. The app works offline as an installable PWA.

## Design Philosophy

- **Navigate and edit over script** — moving and reshaping, not programming
- **Cards over pages** — atomic, composable units of meaning
- **Edges are structure** — the graph of connections *is* the world
- **Identity as exploration** — who you are emerges from where you go
- **Definitions over behavior** — what something *is* matters more than what it *does*

## Architecture

Local-first SPA with vanilla TypeScript. No framework — direct DOM manipulation with in-place reconciliation. Y.js CRDTs are the source of truth, persisted via `y-indexeddb` and synced in real-time via `y-websocket`. Open `/room/<name>` to share a world with others.

## Development

```bash
bun install          # Install dependencies
bun run dev          # Dev server on localhost:3000
bun run lint         # oxlint
bun run check:types  # TypeScript check (tsgo)
bun test             # Run tests
bun run build        # Bundle for production
```

## License

MIT
