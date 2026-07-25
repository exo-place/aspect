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

Items in the projection can be **expanded inline** (▶ toggle reveals nested sub-panels beneath) or **drilled down into** (click navigates into the item's full projection, breadcrumbs show path back). Expansion supports recursive nesting with cycle detection. When "me" cards are active, projection mode uses a tiling layout with one pane per identity.

Key modules:
- `src/projection-types.ts` — `PanelItem` (with optional `subData` for recursive inline expansion), `PanelDef`, `ProjectionData` interfaces
- `src/projection.ts` — `buildProjectionData()` pure function (pack-driven panel mapping, optional `expandedIds`/`visited` for recursive expansion)
- `src/ui/projection-view.ts` — `ProjectionView` DOM renderer (location header, panels, affordance buttons, expand toggles, drill-down, breadcrumbs, presence)
- `src/ui/tab-bar.ts` — `TabBar` component (Build/Experience tabs, settings gear button, `TabMode` type)

### "Me" Cards (Identity)

Per-client identity system. Players mark cards as "me" to claim them as their identity in the world. Each "me" card gets its own tile in projection mode. Stored per-room in localStorage.

Key modules:
- `src/me-store.ts` — `MeStore` class (extends `EventTarget`, per-room `Set<string>` in localStorage, dispatches `"change"`)

### Tile Layout

VS Code-style tiling layout for projection mode when multiple "me" cards are active. Each "me" card gets its own pane with independent navigation (drill-down path + inline expansion). Pure immutable tree data structure with recursive flex-based DOM renderer.

Key modules:
- `src/tile-types.ts` — `TileLeaf`, `TileSplit`, `TileNode`, `TileLayoutEvents` interfaces
- `src/tile-tree.ts` — pure functions on immutable `TileNode` trees (`createLeaf`, `splitPane`, `removePane`, `toggleExpanded`, `drillDown`, `breadcrumbTo`, `buildBalancedTree`, `currentCard`)
- `src/ui/tile-layout.ts` — `TileLayout` DOM renderer (recursive flex containers, draggable dividers, pane headers with home/close buttons)

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

- `src/ui/minimap.ts` — `Minimap` class: overview inset showing all cards and viewport, click-to-navigate, independent scroll-to-zoom
- `src/ui/card-node.ts` — card DOM element creation with drag, resize handle, edge-drag, editing, and "me" badge
- `src/ui/edge-line.ts` — SVG edge rendering with multiple styles, labels (double-click to edit), arrow markers
- `src/ui/canvas.ts` — `Canvas` class: pan/zoom, pinch-to-zoom, viewport persistence (localStorage + URL hash `#v=`), shift-drag brush selection
- `src/viewport-hash.ts` — parse/write `#v=panX,panY,zoom` URL hash for shareable viewport positions

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
bun run bench        # Performance benchmarks (100/500/1000 cards)
bun run test:e2e     # E2E browser tests (requires Node.js + Chromium)
cd docs && bun dev   # Local docs
```

E2E tests require Node.js (Playwright doesn't run under Bun). In the Nix environment: `nix-shell -p nodejs --run "npx playwright test"`.

Production mode: `NODE_ENV=production bun run start` serves from `dist/` with cache headers.

## Core Rules

- **Note things down immediately:** problems, tech debt, issues → TODO.md
- **Do the work properly.** No undocumented workarounds.
- **Update docs after every task.** Keep docs/, README.md, and CLAUDE.md in sync.

**Conversation is not memory.** Anything said in chat evaporates at session end. If it implies future behavior change, write it to CLAUDE.md or a memory file immediately — or it will not happen.

**Warning — these phrases mean something needs to be written down right now:**
- "I won't do X again" / "I'll remember to..." / "I've learned that..."
- "Next time I'll..." / "From now on I'll..."
- Any acknowledgement of a recurring error without a corresponding CLAUDE.md or memory edit

**When the user corrects you:** Ask what rule would have prevented this, and write it before proceeding. **"The rule exists, I just didn't follow it" is never the diagnosis** — a rule that doesn't prevent the failure it describes is incomplete; fix the rule, not your behavior.

**Something unexpected is a signal, not noise.** Surprising output, anomalous numbers, files containing what they shouldn't — stop and ask why before continuing. Don't accept anomalies and move on.

**Always commit completed work.** After tests pass, commit immediately — don't wait to be asked. When a plan has multiple phases, commit after each phase passes. Uncommitted work is lost work.

## Context Management

**Use subagents to protect the main context window.** For broad exploration or mechanical multi-file work, delegate to an Explore or general-purpose subagent rather than running searches inline. The subagent returns a distilled summary; raw tool output stays out of the main context.

Rules of thumb:
- Research tasks (investigating a question, surveying patterns) → subagent; don't pollute main context with exploratory noise
- Searching >5 files or running >3 rounds of grep/read → use a subagent
- Codebase-wide analysis (architecture, patterns, cross-file survey) → always subagent
- Mechanical work across many files (applying the same change everywhere) → parallel subagents
- Single targeted lookup (one file, one symbol) → inline is fine

## Session Handoff

Use plan mode as a handoff mechanism when:
- A task is fully complete (committed, pushed, docs updated)
- The session has drifted from its original purpose
- Context has accumulated enough that a fresh start would help

**For handoffs:** enter plan mode, write a short plan pointing at TODO.md, and ExitPlanMode. **Do NOT investigate first** — the session is context-heavy and about to be discarded. The fresh session investigates after approval.

**For mid-session planning** on a different topic: investigating inside plan mode is fine — context isn't being thrown away.

Before the handoff plan, update TODO.md and memory files with anything worth preserving.

## Commit Convention

Use conventional commits: `type(scope): message`

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

Before committing: `bun run lint && bun run check:types && bun run test` must pass. Run `bun run test:e2e` for E2E browser tests (Playwright).

## Negative Constraints

Do not:
- Announce actions ("I will now...") - just do them
- Leave work uncommitted
- Use interactive git commands (`git add -p`, `git add -i`, `git rebase -i`) — these block on stdin and hang in non-interactive shells; stage files by name instead
- Use `--no-verify` - fix the issue or fix the hook
- Assume tools are missing - check if `bun` is available
