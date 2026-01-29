import type { Card } from "../types";

export interface CardNodeEvents {
  onClick(cardId: string): void;
  onDoubleClick(cardId: string, element: HTMLDivElement): void;
  onContextMenu(cardId: string, screenX: number, screenY: number): void;
  onDragStart(cardId: string): void;
  onDrag(cardId: string, worldX: number, worldY: number): void;
  onDragEnd(cardId: string): void;
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
  let dragStartX = 0;
  let dragStartY = 0;
  let cardOriginX = 0;
  let cardOriginY = 0;

  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    e.stopPropagation();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    cardOriginX = parseFloat(el.style.left);
    cardOriginY = parseFloat(el.style.top);
    el.classList.add("dragging");
    el.parentNode?.appendChild(el);
    el.setPointerCapture(e.pointerId);
    events.onDragStart(cardId);
  });

  el.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const zoom = getZoom();
    const dx = (e.clientX - dragStartX) / zoom;
    const dy = (e.clientY - dragStartY) / zoom;
    el.style.left = `${cardOriginX + dx}px`;
    el.style.top = `${cardOriginY + dy}px`;
    events.onDrag(cardId, cardOriginX + dx, cardOriginY + dy);
  });

  el.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove("dragging");
    const zoom = getZoom();
    const dx = (e.clientX - dragStartX) / zoom;
    const dy = (e.clientY - dragStartY) / zoom;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
      events.onClick(cardId);
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
): void {
  if (!el.classList.contains("dragging")) {
    el.style.left = `${card.position.x}px`;
    el.style.top = `${card.position.y}px`;
  }
  if (!el.querySelector(".card-editor")) {
    el.textContent = card.text || "(empty)";
  }
  el.classList.toggle("current", isCurrent);
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

