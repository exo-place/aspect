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

- **Card** — atomic unit of existence with text content, edges, optional `kind`, and optional `width`
- **Edge** — directional connection between two cards, with optional `type`
- **Navigate** — move to a connected card along an edge
- **Edit** — modify the content of the current card

### World Packs

A world pack is a portable JSON definition that gives the graph meaning. Defines **kinds** (card types with icon/color) and **edge types** (relations with from/to kind constraints). Stored in Y.Doc at key `"pack"` via `WorldPackStore`.

Key modules:
- `src/pack-types.ts` — pure data interfaces (`WorldPack`, `KindDef`, `EdgeTypeDef`)
- `src/pack.ts` — `WorldPackStore` class (wraps `Y.Map`, CRDT-synced, validates on load)
- `src/pack-validate.ts` — `validateWorldPack()` schema validator (structure, uniqueness, referential integrity)
- `src/default-pack.ts` — built-in "Rooms & Items" starter pack

### Actions

Declarative when/do language for graph transformations. Actions live in world packs and define context/target preconditions plus atomic effects. Uses JSONLogic predicates for `when` clauses.

Key modules:
- `src/action-types.ts` — pure data interfaces (`ActionDef`, `ActionData`, `ActionEvent`, `ActionEffect`, `CardRef`, `JsonLogic`)
- `src/json-logic.ts` — minimal JSONLogic evaluator (own implementation, no dependency)
- `src/action.ts` — `buildActionData()`, `isActionAvailable()`, `findActionTargets()`, `executeAction()`
- `src/event-log.ts` — `EventLog` class (CRDT-synced `Y.Array`, append-only, dispatches `onChange`)

### Projection Layer

A second UI mode that renders the graph as a **place** rather than a diagram. The current card becomes a location description with panels derived from its edges, categorized by edge type from the world pack. Both modes share all state; switching hides one, shows the other.

Key modules:
- `src/projection-types.ts` — `PanelItem`, `PanelDef`, `ProjectionData` interfaces (with optional `affordances` and `extraAffordances`)
- `src/projection.ts` — `buildProjectionData()` pure function (pack-driven panel mapping)
- `src/ui/projection-view.ts` — `ProjectionView` DOM renderer (location header, panels, affordance buttons, presence)
- `src/ui/tab-bar.ts` — `TabBar` component (Build/Experience tabs, `TabMode` type)

### Affordance Discovery

Connects the action system to the projection layer. For each action in the world pack, evaluates preconditions against the current graph state and surfaces available actions as buttons in the experiential view. Inline buttons appear on connected panel items; a separate "Actions" panel shows actions targeting non-connected cards.

Key modules:
- `src/affordance-types.ts` — `Affordance` interface (action + target card metadata)
- `src/affordance.ts` — `buildAffordances()` evaluator, `getAffordancesForCard()` filter helper
- `src/ui/app.ts` — `executeAffordance()` wires click → `executeAction()` → reactive re-render

### Snapshots

Full graph state can be exported/imported as JSON files (`AspectSnapshot` format: version, graph data, world pack).

Key modules:
- `src/snapshot.ts` — export, validate, replace-import, merge-import
- `src/file-io.ts` — `downloadJSON()` / `uploadJSON()` browser file helpers

### Settings

User-configurable preferences stored in localStorage (sparse overrides, only non-default values persisted). Schema-driven: adding a new setting = adding one entry to `SETTINGS_SCHEMA`.

Key modules:
- `src/settings.ts` — `SettingsStore` class (extends `EventTarget`, dispatches `"change"` events) + `SETTINGS_SCHEMA`
- `src/ui/settings-panel.ts` — `SettingsPanel` overlay with fuzzy search, auto-generated controls, keyboard shortcuts link

### UI Components

- `src/ui/minimap.ts` — `Minimap` class: overview inset showing all cards and viewport, click-to-navigate, independent zoom
- `src/ui/card-node.ts` — card DOM element creation with drag, resize handle, edge-drag, and editing
- `src/ui/edge-line.ts` — SVG edge rendering with multiple styles, labels (double-click to edit), arrow markers

### Server Persistence

Server-side Y.Doc state is persisted to SQLite via `bun:sqlite`. On room creation, saved state is loaded and applied. Doc updates are debounced (2s) and flushed on last disconnect or server shutdown. Zero external dependencies.

Key modules:
- `src/server/persist.ts` — `RoomPersistence` class (SQLite WAL mode, prepared statements, UPSERT)
- `src/server/debounce.ts` — `DebouncedSaver` class (timer-per-room, flush on demand, destroy all)
- `src/server/types.ts` — shared server interfaces (`WsData`, `Conn`, `Room`)
- `src/server/api.ts` — REST API handler (`GET /api/rooms`, `GET /api/rooms/:name`, `DELETE /api/rooms/:name`)

Room lifecycle: connect → load from SQLite → sync → debounced saves → flush on last disconnect → destroy in memory.

### Room Management

Lobby page (`public/lobby.html`) lists rooms with activity status, relative timestamps, and connection counts. Rooms can be created by navigating to `/room/:name` or deleted via the lobby. REST API merges persisted (SQLite) and in-memory active rooms. `destroyRoom()` in `server.ts` handles connection teardown on deletion.

Routing: `/` → lobby, `/room/*` → SPA fallback, `/api/*` → REST API, `/ws/:room` → WebSocket.

### Multiplayer

Y.js CRDTs are the source of truth for all card/edge/pack/event state. `CardGraph` wraps `Y.Map` collections from a shared `Y.Doc`. Persistence uses `y-indexeddb`; real-time sync uses `y-websocket` with a Bun WebSocket server at `/ws/:room`. Undo/redo is per-client via `Y.UndoManager` (tracks cards, edges, pack, and events).

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
bun run build        # Production build (minified + sourcemaps)
bun run build:analyze # Bundle size breakdown by module
bun run check:size   # Build + size budget check (<120 KB gzip, <100 KB brotli)
bun run lint         # oxlint
bun run check:types  # TypeScript check
bun test             # Run tests
cd docs && bun dev   # Local docs
```

Production mode: `NODE_ENV=production bun run start` serves from `dist/` with cache headers.

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
