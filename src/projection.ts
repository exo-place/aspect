import type { CardGraph } from "./graph";
import type { WorldPackStore } from "./pack";
import type { ProjectionData, PanelDef, PanelItem } from "./projection-types";

export function buildProjectionData(
  cardId: string,
  graph: CardGraph,
  packStore: WorldPackStore,
): ProjectionData | null {
  const card = graph.getCard(cardId);
  if (!card) return null;

  const pack = packStore.get();
  const kindDef = card.kind ? packStore.getKind(card.kind) : undefined;

  // Build ordered list of edge type ids from pack (for sort order)
  const edgeTypeOrder = new Map<string, number>();
  if (pack) {
    for (let i = 0; i < pack.edgeTypes.length; i++) {
      edgeTypeOrder.set(pack.edgeTypes[i].id, i);
    }
  }

  // Group outgoing edges by type
  const outgoing = graph.edgesFrom(cardId);
  const outByType = new Map<string | null, PanelItem[]>();
  for (const edge of outgoing) {
    const typeKey = edge.type ?? null;
    const target = graph.getCard(edge.to);
    if (!target) continue;
    const targetKind = target.kind ? packStore.getKind(target.kind) : undefined;
    const item: PanelItem = {
      cardId: target.id,
      text: target.text,
    };
    if (target.kind) item.kind = target.kind;
    if (targetKind?.style) item.kindStyle = targetKind.style;
    if (!outByType.has(typeKey)) outByType.set(typeKey, []);
    outByType.get(typeKey)!.push(item);
  }

  // Group incoming edges by type
  const incoming = graph.edgesTo(cardId);
  const inByType = new Map<string | null, PanelItem[]>();
  for (const edge of incoming) {
    const typeKey = edge.type ?? null;
    const source = graph.getCard(edge.from);
    if (!source) continue;
    const sourceKind = source.kind ? packStore.getKind(source.kind) : undefined;
    const item: PanelItem = {
      cardId: source.id,
      text: source.text,
    };
    if (source.kind) item.kind = source.kind;
    if (sourceKind?.style) item.kindStyle = sourceKind.style;
    if (!inByType.has(typeKey)) inByType.set(typeKey, []);
    inByType.get(typeKey)!.push(item);
  }

  // Build panels
  const panels: PanelDef[] = [];

  // Outgoing panels
  for (const [typeId, items] of outByType) {
    const edgeType = typeId ? packStore.getEdgeType(typeId) : undefined;
    panels.push({
      edgeTypeId: typeId,
      label: edgeType?.label ?? "Connected",
      direction: "from",
      items,
    });
  }

  // Incoming panels
  for (const [typeId, items] of inByType) {
    // Skip incoming edges of the same type if they already have an outgoing panel
    // (they'll show in the outgoing panel already via bidirectional edges)
    // Actually no — incoming and outgoing are distinct directions, so keep both
    const edgeType = typeId ? packStore.getEdgeType(typeId) : undefined;
    panels.push({
      edgeTypeId: typeId,
      label: edgeType?.label ?? "Connected",
      direction: "to",
      items,
    });
  }

  // Sort: typed panels in pack definition order, untyped ("Connected") last
  panels.sort((a, b) => {
    const aOrder = a.edgeTypeId !== null ? (edgeTypeOrder.get(a.edgeTypeId) ?? Infinity) : Infinity;
    const bOrder = b.edgeTypeId !== null ? (edgeTypeOrder.get(b.edgeTypeId) ?? Infinity) : Infinity;
    if (aOrder !== bOrder) return aOrder - bOrder;
    // Same type: "from" before "to"
    if (a.direction !== b.direction) return a.direction === "from" ? -1 : 1;
    return 0;
  });

  const data: ProjectionData = {
    cardId,
    text: card.text,
    panels,
  };
  if (card.kind) data.kind = card.kind;
  if (kindDef?.style) data.kindStyle = kindDef.style;

  return data;
}
