import type { Card } from "../types";

export interface CardNodeEvents {
  onClick(cardId: string): void;
  onDoubleClick(cardId: string, element: HTMLDivElement): void;
  onDragStart(cardId: string): void;
  onDrag(cardId: string, worldX: number, worldY: number): void;
  onDragEnd(cardId: string): void;
}

export function renderCard(
  card: Card,
  currentId: string | null,
  container: HTMLElement,
  events: CardNodeEvents,
  zoom: number,
): HTMLDivElement {
  const el = document.createElement("div");
  el.className = "card";
  el.dataset.cardId = card.id;
  if (card.id === currentId) el.classList.add("current");

  el.style.left = `${card.position.x}px`;
  el.style.top = `${card.position.y}px`;
  el.textContent = card.text || "(empty)";

  let isDragging = false;
  let dragStartX = 0;
  let dragStartY = 0;
  let cardOriginX = card.position.x;
  let cardOriginY = card.position.y;

  el.addEventListener("pointerdown", (e) => {
    e.stopPropagation();
    isDragging = true;
    dragStartX = e.clientX;
    dragStartY = e.clientY;
    cardOriginX = card.position.x;
    cardOriginY = card.position.y;
    el.classList.add("dragging");
    el.setPointerCapture(e.pointerId);
    events.onDragStart(card.id);
  });

  el.addEventListener("pointermove", (e) => {
    if (!isDragging) return;
    const dx = (e.clientX - dragStartX) / zoom;
    const dy = (e.clientY - dragStartY) / zoom;
    const newX = cardOriginX + dx;
    const newY = cardOriginY + dy;
    el.style.left = `${newX}px`;
    el.style.top = `${newY}px`;
    events.onDrag(card.id, newX, newY);
  });

  el.addEventListener("pointerup", (e) => {
    if (!isDragging) return;
    isDragging = false;
    el.classList.remove("dragging");
    const dx = (e.clientX - dragStartX) / zoom;
    const dy = (e.clientY - dragStartY) / zoom;
    if (Math.abs(dx) < 3 && Math.abs(dy) < 3) {
      events.onClick(card.id);
    } else {
      events.onDragEnd(card.id);
    }
  });

  el.addEventListener("dblclick", (e) => {
    e.stopPropagation();
    events.onDoubleClick(card.id, el);
  });

  container.appendChild(el);
  return el;
}

export function startEditing(
  cardEl: HTMLDivElement,
  currentText: string,
  onCommit: (text: string) => void,
): void {
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
    onCommit(textarea.value);
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
