# Affordances

Affordances are what you can do from where you are. In Aspect, they're derived from graph structure and world pack definitions — not memorized, not typed, not guessed.

## Three Paradigms

### Language-driven (MOO)

You learn a command syntax. `take hoodie`, `wear hoodie`, `go north`. The interface is a text parser. Interaction is **incantation** — you speak the right words and things happen. Power comes from knowing the vocabulary. Discoverability is poor: you read docs, ask other players, or guess.

### Menu-driven (GUI games)

The game presents fixed UI panels: inventory, equipment, minimap. Interaction is **selection** — you click predefined buttons. Discoverability is high but flexibility is low: you can only do what the designers built buttons for.

### Structure-driven (Aspect)

The graph neighborhood + world pack → projected affordances. Interaction is **affordance** — the world shows you what's possible based on where you are and what's around you. Discoverability is intrinsic: if you can do it, you can see it.

## How Affordances Are Discovered

1. The projection layer reads the current card and its graph neighborhood (one hop)
2. For each action defined in the active world pack, it evaluates the `when` preconditions against the current context
3. Actions whose preconditions are satisfied become available affordances
4. These affordances are rendered as actionable UI elements in the projection

For example, if the world pack defines a `take` action with `when: { target.kind == "item" && edge(here, target, "contains") }`, then every item-kind card connected to the current card by a "contains" edge will have "Take" as a visible affordance.

## Properties

**Discoverable.** Affordances are always visible. You never need to guess what commands exist or read documentation to find them. If an action is available, it appears in the projection.

**Contextual.** Affordances change as you navigate. In a room with a hoodie, you see "Take". Holding the hoodie, you see "Wear" and "Drop". Wearing it, you see "Remove". The graph determines the options.

**Accessible.** No command syntax to learn. No verb-noun parsing. No abbreviations. Affordances are presented as plain actions with clear targets.

**Adaptive.** Change the graph and affordances change automatically. Add an item to a room and "Take" appears. Remove an exit and the navigation option disappears. The UI is always consistent with the world state.

**Defined by world packs.** The affordance vocabulary comes from the world pack's action definitions. Different world packs produce different affordances from the same graph. A social world pack might offer "greet" and "follow"; a survival world pack might offer "craft" and "forage".

## Affordances vs Commands

In a MOO, `wear hoodie` is a command you type. You need to know the verb exists, know the syntax, and hope there's no typo. In Aspect, "Wear" appears as an affordance on the hoodie when your world pack defines a `wear` action and the preconditions are met (you're holding the item, it's wearable). The same graph mutation happens — the difference is how you get there.

Commands are **imperative**: you tell the world what to do.
Affordances are **declarative**: the world tells you what you can do.
