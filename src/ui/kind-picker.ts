import type { KindDef } from "../pack-types";

export function showKindPicker(
  anchorX: number,
  anchorY: number,
  currentKind: string | undefined,
  kinds: KindDef[],
  onSelect: (kindId: string | null) => void,
): void {
  // Remove any existing picker
  document.querySelector(".kind-picker")?.remove();

  const picker = document.createElement("div");
  picker.className = "kind-picker";
  picker.style.left = `${anchorX}px`;
  picker.style.top = `${anchorY}px`;

  // "(none)" option to clear kind
  const noneBtn = document.createElement("button");
  noneBtn.className = "kind-picker-item";
  if (!currentKind) noneBtn.classList.add("active");
  noneBtn.textContent = "(none)";
  noneBtn.addEventListener("click", () => {
    picker.remove();
    onSelect(null);
  });
  picker.appendChild(noneBtn);

  for (const kind of kinds) {
    const btn = document.createElement("button");
    btn.className = "kind-picker-item";
    if (currentKind === kind.id) btn.classList.add("active");

    if (kind.style?.icon) {
      const icon = document.createElement("span");
      icon.className = "kind-picker-icon";
      icon.textContent = kind.style.icon;
      btn.appendChild(icon);
    } else if (kind.style?.color) {
      const dot = document.createElement("span");
      dot.className = "kind-picker-color";
      dot.style.backgroundColor = kind.style.color;
      btn.appendChild(dot);
    }

    const label = document.createElement("span");
    label.textContent = kind.label;
    btn.appendChild(label);

    btn.addEventListener("click", () => {
      picker.remove();
      onSelect(kind.id);
    });
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
