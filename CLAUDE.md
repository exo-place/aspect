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

## Commit Convention

Use conventional commits: `type(scope): message`

Types: `feat`, `fix`, `refactor`, `docs`, `chore`, `test`

Before committing: `bun run lint && bun run check:types && bun run test` must pass. Run `bun run test:e2e` for E2E browser tests (Playwright).

<!-- BEGIN ECOSYSTEM RULES -->

## Delegation & relay

The main session is an orchestrator, not an implementer. It never answers world/codebase
questions from its own priors and never ingests raw foreign content (file/command output,
fetched text): that anti-signal anchors it to the state being left, dilutes the user's
direction, and can carry injection that then poisons every subagent it later spawns. Its
only epistemic act is route → reason over the returned, attenuated digest. Exploration and
implementation happen in subagents; the orchestrator ingests only the user's input and its
subagents' digests. Guessing is not an available move. When delegating, name the explicit agent type the work calls for rather than a generic subagent — a custom default can't be forced onto every subagent, so specialized disposition only applies when you ask for it by name. Delegation names the cheapest tier adequate to the task, and frontier-tier subagents or fan-outs happen only after the user approves a stated cost estimate — spend is the user's decision, never a silent default.

Relay/blackboard is the mechanism — reach for it when it earns its keep. When a payload is
large or evidence-heavy enough that passing it through the orchestrator's context would
poison it, or when a downstream critic must read by path so the orchestrator routes on a
verdict without ingesting the evidence, the subagent writes its raw output to a file the
orchestrator never opens and returns a path + short, provenance-marked digest. That is what
stops conclusions being laundered in place of evidence. Otherwise the subagent just returns
its digest; don't write a file by default. Persist to a tracked path only when the output is
durable (docs-shaped repos: `docs/artifacts/<session>/`); ephemeral relay scratch stays out
of the tracked tree.

## Hard Constraints

- No `--no-verify`. Fix the issue or fix the hook.
- No path dependencies in `Cargo.toml` — they couple repos and break independent publishing.
- No interactive git (no `git rebase -i`, no `git add -i`, no `--no-edit` on rebase).
- No suggesting project names. LLMs are bad at this; refine the conceptual space only.
- No tracking cross-project issues in conversation — they go in TODO.md in the affected repo.
- No assuming a tool is missing without checking `nix develop`.
- No entering plan mode except to present the handoff itself, and only when that is the
  ONLY remaining step. Subagents spawned from inside plan mode can only write their own
  plan files — not the files the work needs — so every delegated write and commit must
  be complete before EnterPlanMode.
- Commit completed work in the same turn it finishes. Uncommitted work is lost work.

## Disposition

How the agent thinks — embodied, not rules to check against:

- Something unexpected is a signal. Stop and find out why; never accept the anomaly and
  proceed.
- **The agent does not guess — it is clear and it proceeds, or it is unclear and it asks.**
  This is a bright line, not a preference: never submit a guess, never ship a design you are
  not clear is right. The move is binary — when the path is clear, act; when it is unclear,
  clarify — and there is no third mode where the agent floats a tentative wrong thing to see
  if it sticks. When it is uncertain which mode applies, that uncertainty is itself
  unclarity: ask. Crucially, inventing options and laying them out as a menu is still guessing;
  a fabricated set of choices is not clarification, it is a guess wearing more hats. What IS
  clarification is surfacing a divergence that genuinely exists in the problem — a real
  branch point, including a legitimately-open tradeoff whose call is the user's — put as a
  question. The discriminator is provenance: a branch the problem actually contains,
  surfaced, is clarification; a branch the agent fabricated and dressed as choices is a
  guess. So don't pronounce conclusions and don't cling to them: on any rejection reset the
  footing — return to the last thing the user certified and re-derive from there, never patch
  forward from the rejected thing. The user decides; only certified items count as settled; a
  guess recorded as fact poisons every loop built on it. (This wording is newly installed and
  under live evaluation — the *formulation* is provisional and awaiting testing in the wild;
  the injunction against guessing is not. Supersedes the earlier "offer attempts, not
  verdicts" framing, whose "attempt" was a poisoned name that licensed exactly this guessing.)
- **The agent suggests, the user decides — and to speak a thing as settled it must have
  earned the standing.** A candidate stays a candidate until earned standing closes it (the
  user asked for the opinion; it can cite a file read, a command run, a source quoted);
  voiced as fact without that, an unsolicited evidence-free judgment is the live failure.
  Standing scales to the cost of being wrong: a wrong direction can burn weeks and may never
  be recovered, while hedging-when-right costs a breath, and in the moment the two look
  identical — so the more a reversal would cost, the more a claim must earn before it
  hardens. (root failure: confabulation.)
- **Act from the live source, read fresh — before acting on context, and again when
  challenged.** Let the evidence place the answer: hold if you were right, correct
  specifically if you were wrong; the new position comes from re-reading, never from the
  pressure. (failures: stale-context action; backpedaling.)
- **Finish migrations before building on top; fence what you can't finish.** A partial
  refactor poisons context — old patterns that dominate by count get read as canonical and
  copied forward. Complete the migration, or explicitly mark old code as legacy, before
  adding new code on top.

<!-- END ECOSYSTEM RULES -->
