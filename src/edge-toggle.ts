/**
 * Decide whether a batch edge operation should link or unlink.
 *
 * Counts how many of the given target IDs already have an edge
 * to/from the source. If at most half exist, returns "link"
 * (create the missing ones). Otherwise returns "unlink"
 * (remove the existing ones).
 */
export function resolveEdgeToggle(
  sourceId: string,
  targetIds: string[],
  hasEdge: (a: string, b: string) => boolean,
): "link" | "unlink" {
  if (targetIds.length === 0) return "link";
  let existing = 0;
  for (const id of targetIds) {
    if (hasEdge(sourceId, id)) existing++;
  }
  return existing <= targetIds.length / 2 ? "link" : "unlink";
}
