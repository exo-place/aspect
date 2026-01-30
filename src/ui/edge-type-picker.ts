import type { EdgeTypeDef } from "../pack-types";
import type { WorldPackStore } from "../pack";

export function showEdgeTypePicker(
  anchorX: number,
  anchorY: number,
  currentType: string | undefined,
  edgeTypes: EdgeTypeDef[],
  sourceKind: string | undefined,
  targetKind: string | undefined,
  packStore: WorldPackStore,
  onSelect: (typeId: string | null) => void,
): void {
  // Remove any existing picker
  document.querySelector(".edge-type-picker")?.remove();

  const picker = document.createElement("div");
  picker.className = "edge-type-picker";
  picker.setAttribute("role", "listbox");
  picker.setAttribute("aria-label", "Select edge type");
  picker.style.left = `${anchorX}px`;
  picker.style.top = `${anchorY}px`;

  // "(none)" option to clear type
  const noneBtn = document.createElement("button");
  noneBtn.className = "edge-type-picker-item";
  noneBtn.setAttribute("role", "option");
  noneBtn.setAttribute("aria-selected", String(!currentType));
  if (!currentType) noneBtn.classList.add("active");
  noneBtn.textContent = "(none)";
  noneBtn.addEventListener("click", () => {
    picker.remove();
    onSelect(null);
  });
  picker.appendChild(noneBtn);

  for (const et of edgeTypes) {
    const valid = packStore.validateEdge(et.id, sourceKind, targetKind);
    const btn = document.createElement("button");
    btn.className = "edge-type-picker-item";
    btn.setAttribute("role", "option");
    btn.setAttribute("aria-selected", String(currentType === et.id));
    if (currentType === et.id) btn.classList.add("active");
    if (!valid) btn.classList.add("dimmed");

    const label = document.createElement("span");
    label.textContent = et.label;
    btn.appendChild(label);

    if (valid) {
      btn.addEventListener("click", () => {
        picker.remove();
        onSelect(et.id);
      });
    } else {
      btn.disabled = true;
    }

    picker.appendChild(btn);
  }

  document.body.appendChild(picker);

  const dismiss = (e: Event) => {
    if (!picker.contains(e.target as Node)) {
      picker.remove();
      document.removeEventListener("pointerdown", dismiss);
    }
  };
  requestAnimationFrame(() => {
    document.addEventListener("pointerdown", dismiss);
  });
}

/**
 * If only one valid edge type exists for the given kind pair, returns it.
 * Otherwise returns null (caller should show picker).
 */
export function autoResolveEdgeType(
  edgeTypes: EdgeTypeDef[],
  sourceKind: string | undefined,
  targetKind: string | undefined,
  packStore: WorldPackStore,
): EdgeTypeDef | null {
  const valid = edgeTypes.filter((et) =>
    packStore.validateEdge(et.id, sourceKind, targetKind),
  );
  return valid.length === 1 ? valid[0] : null;
}
