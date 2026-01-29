# TODO

## Core

- [x] Card data model and storage
- [x] Edge data model and graph operations
- [x] Navigation engine
- [x] Edit operations

## Next

- [ ] IndexedDB storage backend
- [ ] Undo/redo stack in Editor
- [ ] Y.js multiplayer upgrade
- [x] Edge labels visible in UI
- [ ] Keyboard navigation (arrow keys follow edges)
- [ ] Card search / jump-to by text

## Design decisions

### Bidirectional edges between the same pair of cards

**Status**: Unresolved — works but needs design attention.

**Current behavior**: Two cards can have separate edges in both directions (A→B and B→A). The graph model treats them as independent edges, each with its own id and optional label. The renderer draws each as a separate SVG spline path. Because both paths share the same border attachment points and control point logic, they overlap visually and appear as a single edge.

**How it happens**: Double-click to create a card always creates an edge from the *current* card to the new card. If you later create an edge in the opposite direction (via shift+drag or Cmd+L), you end up with two edges between the same pair. `linkCards` checks `edgeBetween` (which finds either direction) and won't create a duplicate, but shift+drag uses `addEdge(source, target)` which always creates A→B — if B→A already exists, both will coexist.

**Issues to resolve**:

1. **Visual ambiguity**: Two edges between the same pair look identical. Options:
   - Offset parallel edges so both are visible (like a road with two lanes)
   - Add arrowheads to show direction
   - Treat edges as undirected (prevent duplicates in either direction)
   - Some combination

2. **Semantic question**: Are edges directed or undirected?
   - Directed edges match the MOO/hypertext model — "this card links to that card" is not the same as the reverse
   - Undirected edges are simpler — "these cards are connected" — and avoid the duplicate problem entirely
   - Could support both: default undirected, with an option to make an edge directed

3. **Unlinking behavior**: `unlinkCards` and shift+drag unlink currently remove edges in *both* directions via `allEdgesBetween`. This is correct for undirected semantics but destructive if edges are meant to be directional — unlinking A from B would also destroy the B→A edge.

4. **Graph-level enforcement**: Both `linkCards` and shift+drag currently check `edgeBetween` before creating, so they won't create A→B if B→A already exists. But `addEdge` itself has no such guard — any caller that skips the check (e.g. double-click card creation) can still create duplicates. Consider enforcing uniqueness in `addEdge` directly if edges are undirected.

**Recommendation**: Decide whether edges are directed or undirected. If undirected, enforce uniqueness at the graph level (reject `addEdge(A, B)` if B→A exists) and remove arrowhead concerns. If directed, add visual indicators (arrowheads or offset paths) and make unlink direction-aware.
