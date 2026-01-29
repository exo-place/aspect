const SVG_NS = "http://www.w3.org/2000/svg";

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

export function updateEdgeLine(
  line: SVGLineElement,
  fromEl: HTMLElement,
  toEl: HTMLElement,
  isConnected: boolean,
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

  const from = borderPoint(fromCx, fromCy, fhw, fhh, toCx, toCy);
  const to = borderPoint(toCx, toCy, thw, thh, fromCx, fromCy);

  line.setAttribute("x1", String(from.x));
  line.setAttribute("y1", String(from.y));
  line.setAttribute("x2", String(to.x));
  line.setAttribute("y2", String(to.y));
  line.classList.toggle("connected", isConnected);
}
