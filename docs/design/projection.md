# Projection

Projection is the layer that turns graph structure into lived experience. It's the difference between seeing the world and seeing a diagram of it.

## Graph vs Experience

The graph is **ontological** — it describes what exists. Nodes, edges, labels, topology. A graph editor shows you `[Bedroom] --exit--> [Hallway]` and `[Bedroom] --contains--> [Hoodie]`. This is useful for building, but it's not what inhabiting a world feels like.

Projection is **phenomenological** — it describes what it feels like to be somewhere. Instead of nodes and lines, you see:

```
Bedroom
Exits: Hallway, Kitchen
You see: Hoodie, Mirror
Actions: Inspect, Take, Wear
```

No topology. No edge arrows. Just place, context, and possibility.

## What Projection Is Not

Projection is **not** a local graph view. It doesn't show a zoomed-in subgraph centered on the current node. It doesn't show edges as lines or cards as boxes. That's the graph editor — builder mode, god-mode. Projection is the primary experience mode.

Projection is also not a static template. It reads the active world pack to determine how each edge type maps to a UI panel. Change the world pack and the projection adapts: different edge types produce different sections, different kinds render differently.

## How It Works

The projection layer takes two inputs:

1. **World pack** — defines kinds, edge types, and UI hints
2. **Graph neighborhood** — the current card and everything reachable by one hop

From these, it produces an experiential UI:

- **Edge type "exit"** → navigation panel (places you can go)
- **Edge type "contains"** → inventory/presence list (things here)
- **Edge type "wearing"** → equipment/state panel
- **Card kind "room"** → place rendering (description, atmosphere)
- **Card kind "item"** → object rendering (inspectable, actionable)

The mapping is defined in the world pack, not hardcoded. A different world pack could use entirely different edge types and produce an entirely different projection.

## Builder Mode vs Experience Mode

The graph editor that exists today is builder mode. You see the raw graph, manipulate nodes and edges directly, and have full structural control. This is the equivalent of a level editor or a MOO's `@dig` / `@create` commands.

Projection is experience mode. You inhabit the world rather than editing its wiring. The two modes complement each other: build in the editor, experience through projection.

## The World Speaks to You

A MOO makes you speak to the world — learn verb syntax, type commands, parse error messages. Aspect inverts this. The world speaks to you: it shows you where you are, what's here, and what you can do. No incantations, no syntax, no hidden commands. The structure of the graph, interpreted through the world pack, produces the interface.

This is why projection matters. Without it, the graph is just data. With it, the graph becomes a place.

## Adaptation

Projection adapts automatically when the graph or world pack changes:

- Navigate to a new card → projection re-renders for the new neighborhood
- Someone adds an item to your room (multiplayer) → it appears in your projection
- Load a different world pack → same graph, different experience
- Edit a card's content → projection updates in real time (CRDT sync)

The projection layer is reactive, not cached. It always reflects the current state of the graph as interpreted through the current world pack.
