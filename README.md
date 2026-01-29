# Aspect

Card-based identity exploration sandbox. Like MOOs if the primitives were navigate and edit, not script.

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

## Design Philosophy

- **Navigate and edit over script** — moving and reshaping, not programming
- **Cards over pages** — atomic, composable units of meaning
- **Edges are structure** — the graph of connections *is* the world
- **Identity as exploration** — who you are emerges from where you go
- **Definitions over behavior** — what something *is* matters more than what it *does*

## Architecture

Local-first SPA. All card data lives in the browser. Y.js multiplayer upgrade path for shared worlds.

Bun for local dev server.

## Development

```bash
bun install          # Install dependencies
bun run dev          # Development with watch
bun run lint         # oxlint
bun run check:types  # TypeScript check
bun test             # Run tests
```

## License

MIT
