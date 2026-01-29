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

**Status**: Resolved — all edges are directed.

**Decision**: Edges are always directed. A→B and B→A are distinct edges that can coexist.

**Implementation plan**:

1. **Offset parallel edges** — when A→B and B→A both exist, render as two visually separate spline paths (like road lanes)
2. **Arrowheads** — show direction on all edges
3. **Direction-aware unlinking** — removing A→B leaves B→A intact; `unlinkCards` and shift+drag unlink operate on one direction only
4. **Consistent enforcement in `addEdge`** — reject duplicate (same source, same target) but allow A→B and B→A to coexist; `linkCards` and shift+drag should use `addEdge` and let it handle uniqueness
