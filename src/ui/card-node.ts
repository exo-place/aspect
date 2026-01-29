import type { Card } from "../types";
import type { KindDef } from "../pack-types";

export interface CardNodeEvents {
  onClick(cardId: string, event: PointerEvent): void;
  onDoubleClick(cardId: string, element: HTMLDivElement): void;
  onContextMenu(cardId: string, screenX: number, screenY: number): void;
  onDragStart(cardId: string): void;
  onDrag(cardId: string, worldX: number, worldY: number): void;
  onDragEnd(cardId: string): void;
  onEdgeDragStart?(sourceCardId: string): void;
  onEdgeDragMove?(sourceCardId: string, screenX: number, screenY: number): void;
  onEdgeDragEnd?(sourceCardId: string, screenX: number, screenY: number): void;
}

export function createCardElement(
  cardId: string,
  events: CardNodeEvents,
  getZoom: () => number,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.cardId = cardId;

  let isDragging = false;
  let isEdgeDragging = false;
  let shiftPending = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let cardOriginX = 0;
  let cardOriginY = 0;

  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    el.setPointerCapture(e.pointerId);

    if (e.shiftKey && events.onEdgeDragStart) {
      // Defer edge-drag until actual movement so shift+click works for multi-select
      shiftPending = true;
    } else {
      isDragging = true;
      cardOriginX = parseFloat(el.style.left);
      cardOriginY = parseFloat(el.style.top);
      el.classList.add("dragging");
      el.parentNode?.appendChild(el);
      events.onDragStart(cardId);
    }
  });

  el.addEventListener("pointermove", (e) => {
    if (shiftPending) {
      const dx = e.clientX - dragStartX;
      const dy = e.clientY - dragStartY;
      if (Math.abs(dx) >= 3 || Math.abs(dy) >= 3) {
        shiftPending = false;
        isEdgeDragging = true;
        events.onEdgeDragStart!(cardId);
        events.onEdgeDragMove?.(cardId, e.clientX, e.clientY);
      }
      return;
    }
    if (isEdgeDragging) {
      events.onEdgeDragMove?.(cardId, e.clientX, e.clientY);
      return;
    }
    if (!isDragging) return;
    const zoom = getZoom();
    const dx = (e.clientX - dragStartX) / zoom;
    const dy = (e.clientY - dragStartY) / zoom;
    el.style.left = `${cardOriginX + dx}px`;
    el.style.top = `${cardOriginY + dy}px`;
    events.onDrag(cardId, cardOriginX + dx, cardOriginY + dy);
  });

  el.addEventListener("pointerup", (e) => {
    if (shiftPending) {
      // Shift+click with no drag — treat as click for multi-select
      shiftPending = false;
      events.onClick(cardId, e);
      return;
    }
    if (isEdgeDragging) {
      isEdgeDragging = false;
      events.onEdgeDragEnd?.(cardId, e.clientX, e.clientY);
      return;
    }
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove("dragging");
    const zoom = getZoom();
    const dx = (e.clientX - dragStartX) / zoom;
    const dy = (e.clientY - dragStartY) / zoom;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
      events.onClick(cardId, e);
    } else {
      events.onDragEnd(cardId);
    }
  });

  el.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    events.onDoubleClick(cardId, el);
  });

  el.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    e.stopPropagation();
    events.onContextMenu(cardId, e.clientX, e.clientY);
  });

  return el;
}

export function updateCardElement(
  el: HTMLDivElement,
  card: Card,
  isCurrent: boolean,
  isSelected: boolean,
  kindDef?: KindDef,
): void {
  if (!el.classList.contains("dragging")) {
    el.style.left = `${card.position.x}px`;
    el.style.top = `${card.position.y}px`;
  }

  // Update text content (preserve editor if open)
  if (!el.querySelector(".card-editor")) {
    // Preserve or create kind badge, then set text
    let badge = el.querySelector(".kind-badge") as HTMLSpanElement | null;
    if (kindDef?.style?.icon) {
      if (!badge) {
        badge = document.createElement("span");
        badge.className = "kind-badge";
      }
      badge.textContent = kindDef.style.icon;
    } else if (badge) {
      badge.remove();
      badge = null;
    }

    el.textContent = "";
    if (badge) el.appendChild(badge);
    el.appendChild(document.createTextNode(card.text || "(empty)"));
  }

  el.classList.toggle("current", isCurrent);
  el.classList.toggle("selected", isSelected);
  el.classList.toggle("has-kind", !!kindDef);

  if (kindDef?.style?.color) {
    el.style.setProperty("--kind-color", kindDef.style.color);
  } else {
    el.style.removeProperty("--kind-color");
  }
}

export function startEditing(
  cardEl: HTMLDivElement,
  currentText: string,
  onCommit: (text: string) => void,
): void {
  if (cardEl.querySelector(".card-editor")) return;

  cardEl.textContent = "";
  const textarea = document.createElement("textarea");
  textarea.className = "card-editor";
  textarea.value = currentText;
  cardEl.appendChild(textarea);
  textarea.focus();
  textarea.select();

  let committed = false;
  const commit = () => {
    if (committed) return;
    committed = true;
    const text = textarea.value;
    textarea.remove();
    cardEl.textContent = text || "(empty)";
    onCommit(text);
  };

  textarea.addEventListener("blur", commit);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      commit();
    }
    if (e.key === "Escape") {
      textarea.value = currentText;
      commit();
    }
  });
}
