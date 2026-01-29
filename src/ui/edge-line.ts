import type { Card, Edge } from "../types";

const SVG_NS = "http://www.w3.org/2000/svg";

export function renderEdge(
  edge: Edge,
  cards: Record<string, Card>,
  currentId: string | null,
  container: SVGSVGElement,
): SVGLineElement | null {
  const from = cards[edge.from];
  const to = cards[edge.to];
  if (!from || !to) return null;

  const line = document.createElementNS(SVG_NS, "line");
  line.classList.add("edge-line");
  if (edge.from === currentId || edge.to === currentId) {
    line.classList.add("connected");
  }

  // Center of card (approximate: offset by half typical card width/height)
  const offsetX = 60;
  const offsetY = 20;
  line.setAttribute("x1", String(from.position.x + offsetX));
  line.setAttribute("y1", String(from.position.y + offsetY));
  line.setAttribute("x2", String(to.position.x + offsetX));
  line.setAttribute("y2", String(to.position.y + offsetY));

  container.appendChild(line);
  return line;
}
