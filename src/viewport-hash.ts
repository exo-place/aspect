export function parseViewportHash(): { panX: number; panY: number; zoom: number } | null {
  const hash = location.hash;
  if (!hash.startsWith("#v=")) return null;
  const parts = hash.slice(3).split(",");
  if (parts.length !== 3) return null;
  const panX = parseFloat(parts[0]);
  const panY = parseFloat(parts[1]);
  const zoom = parseFloat(parts[2]);
  if (!Number.isFinite(panX) || !Number.isFinite(panY) || !Number.isFinite(zoom)) return null;
  if (zoom <= 0) return null;
  return { panX, panY, zoom };
}

export function writeViewportHash(panX: number, panY: number, zoom: number): void {
  const hash = `#v=${panX.toFixed(1)},${panY.toFixed(1)},${zoom.toFixed(3)}`;
  history.replaceState(null, "", hash);
}
