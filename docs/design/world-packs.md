# World Packs

A world pack is a portable, declarative definition file that gives the graph meaning. Core is semantic-free — it stores cards, edges, patches, and events but never knows what a "room" or "item" is. World packs supply that semantics.

## What a World Pack Defines

A world pack defines five things:

### 1. Kinds (card types)

A kind is a category of card: room, item, identity, container, portal. Each kind declares:

- **Fields** — structured data beyond the card's text content (e.g., `capacity: number` for a container)
- **UI hints** — icon, color, rendering style in projection

Kinds constrain what a card can be. A card tagged with kind "room" is treated as a place; a card tagged "item" is treated as an object.

### 2. Edge Types (relations)

An edge type is a named, directional relation: exit, contains, wearing, blocks, follows. Each edge type declares:

- **From/to kind constraints** — which kinds can appear at each end (e.g., "exit" goes from room to room; "contains" goes from room or identity to item)
- **Directionality** — whether the relation is symmetric, asymmetric, or bidirectional
- **UI mapping** — how projection renders edges of this type (navigation panel, inventory list, etc.)

### 3. Actions (verbs)

An action is a named, parameterized bundle of graph mutations: move, take, wear, drop, inspect. Each action declares:

- **Context** — where the actor must be (e.g., in a room)
- **Target** — what the action applies to (e.g., an item)
- **Preconditions (`when`)** — predicates that must be true for the action to be available
- **Effects (`do`)** — graph mutations that execute when the action is performed

Actions are how affordances get their vocabulary. See [Affordances](./affordances.md).

### 4. Rules (validation + derivation)

Rules enforce invariants and derive state:

- **Validation rules** — constraints that must hold (e.g., no self-referential exits, items can only be in one container)
- **Derivation rules** — automatic consequences (e.g., entering a room auto-creates a "visited" edge)

### 5. UI Hints (presentation)

Metadata for the projection layer: colors, icons, grouping order, section labels, rendering style. UI hints don't affect semantics — they affect how semantics are displayed.

## The `when`/`do` Language

Actions use a declarative language for preconditions and effects.

### Preconditions (`when`)

A pure predicate language. No side effects, no mutation. Predicates can test:

- Card kind: `target.kind == "item"`
- Edge existence: `edge(self, target, "contains")`
- Edge absence: `!edge(self, target, "wearing")`
- Field values: `target.fields.wearable == true`
- Graph neighborhood: `connected(here, target, "exit")`

### Effects (`do`)

A constrained patch language. Effects can:

- `addEdge(from, to, type)` — create an edge
- `removeEdge(from, to, type)` — remove an edge
- `set(card, field, value)` — set a field
- `emit(event)` — record an event

No arbitrary computation. No loops, conditionals, or variable binding beyond the action's parameters. Effects are a sequence of graph mutations.

## Actions as Compressed Graph Transformations

Actions aren't behavior in the programming sense. They're packaging — a named, validated shorthand for a sequence of atomic graph operations.

`wear(hoodie)`:
```
when:
  self.kind == "identity"
  target.kind == "item"
  target.fields.wearable == true
  edge(self, target, "contains")
do:
  removeEdge(self, target, "contains")
  addEdge(self, target, "wearing")
  emit("wore", { actor: self, item: target })
```

This compresses two atomic ops and an event into a single verb. The semantics are entirely in the graph change — the action just makes it nameable and discoverable.

## Properties

- **Versionable** — world packs have a `packId` and `packVersion`; changes are tracked
- **Serializable** — pure data, no code; can be stored, transmitted, diffed
- **Composable** — multiple world packs can be loaded together (with conflict resolution)
- **Diffable** — structural diffs between versions are meaningful
- **Replayable** — action history can be replayed to reconstruct state
- **Discoverable** — action definitions are introspectable at runtime for affordance generation
- **Shareable** — world packs are portable across Aspect instances

## Versioning and Portability

Each world pack has:

- `packId` — stable identifier (e.g., `"core.rooms"`)
- `packVersion` — semantic version
- `migrations` — transformations for upgrading graphs from older pack versions
- `dependencies` — other world packs this one extends or requires

World packs are designed to be shared and distributed independently of the graphs they interpret.

## Implemented Format

The implemented world pack format covers kinds, edge types, and actions. Rules and fields are not yet implemented.

```typescript
interface WorldPack {
  packId: string;
  packVersion: number;
  name: string;
  description?: string;
  kinds: KindDef[];
  edgeTypes: EdgeTypeDef[];
  actions?: ActionDef[];
}

interface KindDef {
  id: string;
  label: string;
  style?: { color?: string; icon?: string };
}

interface EdgeTypeDef {
  id: string;
  label: string;
  constraint?: { from?: string[]; to?: string[] };
}

interface ActionDef {
  id: string;
  label: string;
  context: { kind?: string };
  target: { kind?: string; edgeType?: string };
  when?: unknown;  // JSONLogic predicate
  do: EffectDef[];
}

interface EffectDef {
  op: "addEdge" | "removeEdge" | "set" | "emit";
  // ... op-specific fields
}
```

### Default Pack: Rooms & Items

The built-in starter pack shipped with Aspect:

```json
{
  "packId": "rooms-and-items",
  "packVersion": 1,
  "name": "Rooms & Items",
  "kinds": [
    { "id": "room", "label": "Room", "style": { "color": "#56b6c2", "icon": "🏠" } },
    { "id": "item", "label": "Item", "style": { "color": "#e5c07b", "icon": "📦" } },
    { "id": "character", "label": "Character", "style": { "color": "#c678dd", "icon": "🧑" } }
  ],
  "edgeTypes": [
    { "id": "exit", "label": "exit", "constraint": { "from": ["room"], "to": ["room"] } },
    { "id": "contains", "label": "contains", "constraint": { "from": ["room"], "to": ["item", "character"] } },
    { "id": "carries", "label": "carries", "constraint": { "from": ["character"], "to": ["item"] } }
  ]
}
```

### Storage

World packs are stored in the Y.Doc at key `"pack"` as nested `Y.Map`/`Y.Array` structures, managed by `WorldPackStore`. This means packs sync across multiplayer clients and are undoable via `Y.UndoManager`.

### Edge Type Enforcement

When a `WorldPackStore` is set on `CardGraph`, `addEdge` validates from/to kind constraints if a type is provided. Behavior:
- No pack → no validation
- No type on edge → no validation
- Untyped cards (no kind) pass through constraints

## Action Format

Actions are defined in the world pack's `actions` array. Predicates use [JSONLogic](https://jsonlogic.com/) syntax. Effects are a sequence of atomic graph operations.

```json
{
  "actions": [
    {
      "id": "take",
      "label": "Take",
      "context": {},
      "target": { "kind": "item", "edgeType": "contains" },
      "when": { "and": [{ "==": [{ "var": "context.kind" }, "character"] }] },
      "do": [
        { "op": "removeEdge", "from": "context", "to": "target", "edgeType": "contains" },
        { "op": "addEdge", "from": "context", "to": "target", "edgeType": "carries" }
      ]
    }
  ]
}
```

## Game Concept Mapping

How familiar game concepts map to world pack primitives:

| Game concept | World pack primitive |
|---|---|
| Rooms / locations | Kind: `room` + edge type: `exit` |
| Inventory | Edge type: `contains` (from identity to item) |
| Equipment / wearing | Edge type: `wearing` (from identity to item) |
| Body parts | Kind: `bodypart` + edge type: `partOf` |
| Crafting | Action with preconditions on inventory + effects that create new items |
| Locked doors | Edge type: `exit` + rule requiring key item |
| NPCs | Kind: `npc` with derivation rules for automatic responses |
| Quests | Kind: `quest` + edge types for progress tracking |
