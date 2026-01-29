# CLAUDE.md

Behavioral rules for Claude Code in the aspect repository.

## Project Overview

Card-based identity exploration sandbox. Like MOOs if the primitives were navigate and edit, not script.

Part of the [exo-place ecosystem](https://exo-place.github.io).

## Tech Stack

- **App**: SPA (local-first, Y.js CRDT multiplayer via y-websocket)
- **Dev server**: Bun
- **Language**: TypeScript (strict)
- **Linting**: oxlint
- **Type checking**: tsgo
- **Docs**: VitePress

## Architecture

### Core Primitives

- **Card** — atomic unit of existence with text content and edges to other cards
- **Edge** — directional connection between two cards
- **Navigate** — move to a connected card along an edge
- **Edit** — modify the content of the current card

### Multiplayer

Y.js CRDTs are the source of truth for all card/edge state. `CardGraph` wraps `Y.Map` collections from a shared `Y.Doc`. Persistence uses `y-indexeddb`; real-time sync uses `y-websocket` with a Bun WebSocket server at `/ws/:room`. Undo/redo is per-client via `Y.UndoManager`.

### Design Principles

**Navigate and edit over script.** The fundamental interactions are moving through a space and changing what's there — not writing code.

**Cards over pages.** Atomic, composable units of meaning rather than documents.

**Edges are structure.** The graph of connections *is* the world. No separate map or index.

**Identity as exploration.** Who you are emerges from where you go and what you change.

**Definitions over behavior.** What something *is* matters more than what it *does*.

## Development

```bash
nix develop          # Enter dev shell
bun install          # Install dependencies
bun run dev          # Development with watch
bun run lint         # oxlint
bun run check:types  # TypeScript check
bun test             # Run tests
cd docs && bun dev   # Local docs
```

## Core Rules

- **Note things down immediately:** problems, tech debt, issues → TODO.md
- **Do the work properly.** No undocumented workarounds.
- **Update docs after every task.** Keep docs/, README.md, and CLAUDE.md in sync.

## Commit Convention

Use conventional commits: `type(scope): message`

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

Before committing: `bun run lint && bun run check:types` must pass.

## Negative Constraints

Do not:
- Announce actions ("I will now...") - just do them
- Leave work uncommitted
- Use `--no-verify` - fix the issue or fix the hook
- Assume tools are missing - check if `bun` is available
