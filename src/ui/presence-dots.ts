import type { PeerState } from "../presence";

export function renderPresenceDots(
  cardEl: HTMLDivElement,
  peers: PeerState[],
): void {
  let container = cardEl.querySelector<HTMLDivElement>(".presence-dots");

  if (peers.length === 0) {
    container?.remove();
    return;
  }

  if (!container) {
    container = document.createElement("div");
    container.className = "presence-dots";
    cardEl.appendChild(container);
  }

  // Reconcile dots
  const existing = container.querySelectorAll<HTMLSpanElement>(".presence-dot");
  const existingByClient = new Map<string, HTMLSpanElement>();
  for (const dot of existing) {
    if (dot.dataset.clientId) {
      existingByClient.set(dot.dataset.clientId, dot);
    }
  }

  const activeDots = new Set<string>();
  for (const peer of peers) {
    const key = String(peer.clientId);
    activeDots.add(key);
    let dot = existingByClient.get(key);
    if (!dot) {
      dot = document.createElement("span");
      dot.className = "presence-dot";
      dot.dataset.clientId = key;
      container.appendChild(dot);
    }
    dot.style.backgroundColor = peer.color;
    dot.title = peer.name;
  }

  // Remove stale dots
  for (const [key, dot] of existingByClient) {
    if (!activeDots.has(key)) {
      dot.remove();
    }
  }
}
