const SVG_NS = "http://www.w3.org/2000/svg";

export type EdgeStyle = "line" | "spline" | "taxicab" | "rounded-taxicab";

export function ensureArrowDefs(svg: SVGSVGElement): void {
  if (svg.querySelector("defs")) return;
  const defs = document.createElementNS(SVG_NS, "defs");

  const markers: [string, string][] = [
    ["arrow", "#555"],
    ["arrow-connected", "#888"],
    ["arrow-ghost", "rgba(124,156,255,0.5)"],
  ];

  for (const [id, fill] of markers) {
    const marker = document.createElementNS(SVG_NS, "marker");
    marker.setAttribute("id", id);
    marker.setAttribute("viewBox", "0 0 10 6");
    marker.setAttribute("refX", "10");
    marker.setAttribute("refY", "3");
    marker.setAttribute("markerWidth", "10");
    marker.setAttribute("markerHeight", "6");
    marker.setAttribute("orient", "auto-start-reverse");
    const polygon = document.createElementNS(SVG_NS, "polygon");
    polygon.setAttribute("points", "0,0 10,3 0,6");
    polygon.setAttribute("fill", fill);
    marker.appendChild(polygon);
    defs.appendChild(marker);
  }

  svg.insertBefore(defs, svg.firstChild);
}

export function createEdgeGroup(edgeId?: string): SVGGElement {
  const g = document.createElementNS(SVG_NS, "g");
  if (edgeId) g.dataset.edgeId = edgeId;
  const path = document.createElementNS(SVG_NS, "path");
  path.classList.add("edge-line");
  const text = document.createElementNS(SVG_NS, "text");
  text.classList.add("edge-label");
  g.appendChild(path);
  g.appendChild(text);
  return g;
}

// Keep for ghost edge creation
export function createEdgeLine(): SVGLineElement {
  const line = document.createElementNS(SVG_NS, "line");
  line.classList.add("edge-line");
  return line;
}

function borderPoint(
  cx: number, cy: number,
  hw: number, hh: number,
  tx: number, ty: number,
): { x: number; y: number } {
  const dx = tx - cx;
  const dy = ty - cy;
  if (dx === 0 && dy === 0) return { x: cx, y: cy };
  const sx = dx !== 0 ? hw / Math.abs(dx) : Infinity;
  const sy = dy !== 0 ? hh / Math.abs(dy) : Infinity;
  const s = Math.min(sx, sy);
  return { x: cx + dx * s, y: cy + dy * s };
}

function exitDirection(
  cx: number, cy: number,
  hw: number, hh: number,
  bx: number, by: number,
): { dx: number; dy: number } {
  const dx = bx - cx;
  const dy = by - cy;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return { dx: 0, dy: -1 };
  return { dx: dx / len, dy: dy / len };
}

function buildPath(
  from: { x: number; y: number },
  to: { x: number; y: number },
  fromDir: { dx: number; dy: number },
  toDir: { dx: number; dy: number },
  style: EdgeStyle,
): string {
  switch (style) {
    case "line":
      return `M ${from.x},${from.y} L ${to.x},${to.y}`;

    case "spline": {
      const dist = Math.sqrt((to.x - from.x) ** 2 + (to.y - from.y) ** 2);
      const offset = dist * 0.3;
      const cp1x = from.x + fromDir.dx * offset;
      const cp1y = from.y + fromDir.dy * offset;
      const cp2x = to.x + toDir.dx * offset;
      const cp2y = to.y + toDir.dy * offset;
      return `M ${from.x},${from.y} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${to.x},${to.y}`;
    }

    case "taxicab": {
      const mx = (from.x + to.x) / 2;
      return `M ${from.x},${from.y} L ${mx},${from.y} L ${mx},${to.y} L ${to.x},${to.y}`;
    }

    case "rounded-taxicab": {
      const mx = (from.x + to.x) / 2;
      const r = 8;
      const dy1 = to.y > from.y ? 1 : -1;
      const dx2 = to.x > from.x ? 1 : -1;
      const ry = Math.min(r, Math.abs(to.y - from.y) / 2);
      const rx = Math.min(r, Math.abs(mx - from.x), Math.abs(to.x - mx));
      return [
        `M ${from.x},${from.y}`,
        `L ${mx - rx * dx2},${from.y}`,
        `A ${rx},${ry} 0 0 ${dy1 > 0 ? (dx2 > 0 ? 1 : 0) : (dx2 > 0 ? 0 : 1)} ${mx},${from.y + ry * dy1}`,
        `L ${mx},${to.y - ry * dy1}`,
        `A ${rx},${ry} 0 0 ${dy1 > 0 ? (dx2 > 0 ? 0 : 1) : (dx2 > 0 ? 1 : 0)} ${mx + rx * dx2},${to.y}`,
        `L ${to.x},${to.y}`,
      ].join(" ");
    }
  }
}

export function updateEdgeGroup(
  group: SVGGElement,
  fromEl: HTMLElement,
  toEl: HTMLElement,
  isConnected: boolean,
  label?: string,
  style: EdgeStyle = "spline",
  perpOffset: number = 0,
): void {
  const fromX = parseFloat(fromEl.style.left) || 0;
  const fromY = parseFloat(fromEl.style.top) || 0;
  const toX = parseFloat(toEl.style.left) || 0;
  const toY = parseFloat(toEl.style.top) || 0;

  const fhw = (fromEl.offsetWidth || 120) / 2;
  const fhh = (fromEl.offsetHeight || 40) / 2;
  const thw = (toEl.offsetWidth || 120) / 2;
  const thh = (toEl.offsetHeight || 40) / 2;

  const fromCx = fromX + fhw;
  const fromCy = fromY + fhh;
  const toCx = toX + thw;
  const toCy = toY + thh;

  // Compute perpendicular offset for parallel edges
  let offX = 0;
  let offY = 0;
  if (perpOffset !== 0) {
    const ddx = toCx - fromCx;
    const ddy = toCy - fromCy;
    const len = Math.sqrt(ddx * ddx + ddy * ddy);
    if (len > 0) {
      // Perpendicular: rotate direction 90° CCW
      offX = (-ddy / len) * perpOffset;
      offY = (ddx / len) * perpOffset;
    }
  }

  const from = borderPoint(fromCx + offX, fromCy + offY, fhw, fhh, toCx + offX, toCy + offY);
  const to = borderPoint(toCx + offX, toCy + offY, thw, thh, fromCx + offX, fromCy + offY);

  const fromDir = exitDirection(fromCx + offX, fromCy + offY, fhw, fhh, from.x, from.y);
  const toDir = exitDirection(toCx + offX, toCy + offY, thw, thh, to.x, to.y);

  const path = group.querySelector("path") as SVGPathElement;
  path.setAttribute("d", buildPath(from, to, fromDir, toDir, style));
  path.classList.toggle("connected", isConnected);
  path.setAttribute("marker-end", `url(#${isConnected ? "arrow-connected" : "arrow"})`);

  const text = group.querySelector("text") as SVGTextElement;
  if (label) {
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    text.setAttribute("x", String(mx));
    text.setAttribute("y", String(my - 6));
    text.textContent = label;
  } else {
    text.textContent = "";
  }
}
