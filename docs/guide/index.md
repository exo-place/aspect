# Getting Started

Aspect is a card-based identity exploration sandbox.

## Running

```bash
bun install
bun run dev
```

Open [localhost:3000](http://localhost:3000). You'll see a single card on an infinite canvas.

## Interacting

### Navigate

Click any card to make it the current card. The current card is highlighted with a blue border. Edges connect to other cards — the graph of connections is the world you move through.

### Edit

Double-click a card to edit its text inline. Press Enter to commit, Escape to cancel. Shift+Enter for newlines.

### Create

Double-click empty space to create a new card. It will be connected to the current card by an edge and immediately open for editing.

### Move

Drag a card to reposition it on the canvas. Drag empty space to pan. Scroll to zoom.

### Delete

Press Backspace or Delete to remove the current card (and its edges). You can also right-click a card for a context menu with Delete.

## Persistence

All data is saved to localStorage automatically. Refresh the page and your cards are still there. Aspect also works offline as an installable PWA.

## Core Concepts

### Cards

A card is the fundamental unit. It has content — text that describes what it is. A card might be a place, a trait, a memory, an object, or anything else.

### Edges

Cards connect to other cards through directional edges. Edges form the graph you navigate. When you create a new card, it gets an edge from the current card.

### The Graph

There is no separate map or index. The structure of the world is the graph of cards and edges. You explore it by navigating, and reshape it by editing.

## Philosophy

Aspect is like a MOO, but the primitives are **navigate** and **edit** — not script. You don't program the world. You move through it and reshape it.

See [Philosophy](/philosophy) for the full design rationale.
