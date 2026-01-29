import {
  keybinds,
  defineSchema,
  fromBindings,
  registerComponents,
  formatKeyParts,
} from "keybinds";
import type { Command } from "keybinds";

export interface KeybindHandlers {
  deleteCard(cardId: string): void;
  editCard(cardId: string): void;
  createCard(worldX: number, worldY: number): void;
  linkCards(): void;
  labelEdge(): void;
  deselect(): void;
  getCurrentCardId(): string | null;
  getSelectedCount(): number;
  getViewportCenter(): { x: number; y: number };
}

const schema = defineSchema({
  "edit-card": {
    label: "Edit card",
    category: "Edit",
    keys: ["Enter"],
  },
  "delete-card": {
    label: "Delete card",
    category: "Edit",
    keys: ["Backspace", "Delete"],
  },
  "create-card": {
    label: "Create card",
    category: "Edit",
  },
  "link-cards": {
    label: "Link cards",
    category: "Edit",
    keys: ["$mod+L"],
  },
  "label-edge": {
    label: "Label edge",
    category: "Edit",
  },
  deselect: {
    label: "Deselect",
    category: "Navigation",
    keys: ["Escape"],
  },
  "command-palette": {
    label: "Command palette",
    category: "General",
    keys: ["$mod+K"],
  },
});

export interface SetupResult {
  cleanup: () => void;
  showContextMenu: (
    menu: string,
    x: number,
    y: number,
    context: Record<string, unknown>,
  ) => void;
}

export function setupKeybinds(handlers: KeybindHandlers): SetupResult {
  registerComponents();

  const commands: Command[] = fromBindings(
    schema,
    {
      "edit-card": (ctx) => handlers.editCard(ctx.cardId as string),
      "delete-card": (ctx) => handlers.deleteCard(ctx.cardId as string),
      "create-card": (ctx) => {
        if (ctx.worldX != null && ctx.worldY != null) {
          handlers.createCard(ctx.worldX as number, ctx.worldY as number);
        } else {
          const center = handlers.getViewportCenter();
          handlers.createCard(center.x, center.y);
        }
      },
      "link-cards": () => handlers.linkCards(),
      "label-edge": () => handlers.labelEdge(),
      deselect: () => handlers.deselect(),
      "command-palette": () => {
        const el = document.querySelector("command-palette");
        if (el) (el as HTMLElement & { open: boolean }).open = !((el as HTMLElement & { open: boolean }).open);
      },
    },
    {
      "edit-card": {
        when: (ctx) => ctx.cardId != null && !ctx.isEditing,
      },
      "delete-card": {
        when: (ctx) => ctx.cardId != null && !ctx.isEditing,
      },
      "link-cards": {
        when: (ctx) => (ctx.selectedCount as number) >= 2 && !ctx.isEditing,
      },
      "label-edge": {
        when: (ctx) => (ctx.selectedCount as number) === 2 && !ctx.isEditing,
      },
      deselect: {
        when: (ctx) => !ctx.isEditing,
      },
      "command-palette": {
        captureInput: true,
      },
    },
  );

  // Add menu tags for context menu filtering
  const menuTags: Record<string, string> = {
    "edit-card": "card",
    "delete-card": "card",
    "create-card": "canvas",
    "link-cards": "card",
    "label-edge": "card",
  };
  for (const cmd of commands) {
    const menu = menuTags[cmd.id];
    if (menu) cmd.menu = menu;
  }

  const palette = document.createElement("command-palette");
  (palette as unknown as { commands: Command[] }).commands = commands;
  document.body.appendChild(palette);

  const cheatsheet = document.createElement("keybind-cheatsheet");
  cheatsheet.setAttribute("auto-trigger", "");
  (cheatsheet as unknown as { commands: Command[] }).commands = commands;
  document.body.appendChild(cheatsheet);

  const getContext = () => ({
    cardId: handlers.getCurrentCardId(),
    selectedCount: handlers.getSelectedCount(),
    isEditing: !!document.querySelector(".card-editor"),
  });

  const cleanup = keybinds(commands, getContext);

  const showContextMenu = (
    menu: string,
    x: number,
    y: number,
    context: Record<string, unknown>,
  ) => {
    showContextMenuUI(commands, menu, x, y, context);
  };

  return { cleanup, showContextMenu };
}

function filterByMenu(commands: Command[], menu: string): Command[] {
  return commands.filter((cmd) => {
    if (!cmd.menu) return false;
    if (Array.isArray(cmd.menu)) return cmd.menu.includes(menu);
    return cmd.menu === menu;
  });
}

function showContextMenuUI(
  commands: Command[],
  menu: string,
  x: number,
  y: number,
  context: Record<string, unknown>,
): void {
  const filtered = filterByMenu(commands, menu);
  if (filtered.length === 0) return;

  document.querySelector(".context-menu")?.remove();

  const menuEl = document.createElement("div");
  menuEl.className = "context-menu";
  menuEl.style.left = `${x}px`;
  menuEl.style.top = `${y}px`;

  for (const cmd of filtered) {
    const btn = document.createElement("button");
    btn.className = "context-menu-item";

    const label = document.createElement("span");
    label.textContent = cmd.label;
    btn.appendChild(label);

    if (cmd.keys?.[0]) {
      const hint = document.createElement("span");
      hint.className = "context-menu-hint";
      hint.textContent = formatKeyParts(cmd.keys[0]).join("");
      btn.appendChild(hint);
    }

    btn.addEventListener("click", () => {
      menuEl.remove();
      cmd.execute(context);
    });
    menuEl.appendChild(btn);
  }

  document.body.appendChild(menuEl);

  const dismiss = (e: Event) => {
    if (!menuEl.contains(e.target as Node)) {
      menuEl.remove();
      document.removeEventListener("pointerdown", dismiss);
    }
  };
  requestAnimationFrame(() => {
    document.addEventListener("pointerdown", dismiss);
  });
}
