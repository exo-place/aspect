import {
  keybinds,
  defineSchema,
  fromBindings,
  registerComponents,
  formatKeyParts,
  BindingsStore,
} from "keybinds";
import type { Command } from "keybinds";

export interface KeybindHandlers {
  deleteCard(cardId: string): void;
  editCard(cardId: string): void;
  setKind(cardId: string): void;
  createCard(worldX: number, worldY: number): void;
  linkCards(): void;
  unlinkCards(): void;
  labelEdge(): void;
  deselect(): void;
  search(): void;
  undo(): void;
  redo(): void;
  navigateDirection(direction: "up" | "down" | "left" | "right"): void;
  exportGraph(): void;
  importGraph(): void;
  exportPack(): void;
  importPack(): void;
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
  "set-kind": {
    label: "Set kind",
    category: "Edit",
    keys: ["K"],
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
  "unlink-cards": {
    label: "Unlink cards",
    category: "Edit",
    keys: ["$mod+Shift+L"],
  },
  "label-edge": {
    label: "Label edge",
    category: "Edit",
  },
  undo: {
    label: "Undo",
    category: "Edit",
    keys: ["$mod+Z"],
  },
  redo: {
    label: "Redo",
    category: "Edit",
    keys: ["$mod+Shift+Z"],
  },
  "nav-up": {
    label: "Navigate up",
    category: "Navigation",
    keys: ["ArrowUp"],
  },
  "nav-down": {
    label: "Navigate down",
    category: "Navigation",
    keys: ["ArrowDown"],
  },
  "nav-left": {
    label: "Navigate left",
    category: "Navigation",
    keys: ["ArrowLeft"],
  },
  "nav-right": {
    label: "Navigate right",
    category: "Navigation",
    keys: ["ArrowRight"],
  },
  search: {
    label: "Search cards",
    category: "Navigation",
    keys: ["/"],
  },
  deselect: {
    label: "Deselect",
    category: "Navigation",
    keys: ["Escape"],
  },
  "export-graph": {
    label: "Export graph",
    category: "File",
    keys: ["$mod+Shift+E"],
  },
  "import-graph": {
    label: "Import graph",
    category: "File",
    keys: ["$mod+Shift+I"],
  },
  "export-pack": {
    label: "Export world pack",
    category: "File",
  },
  "import-pack": {
    label: "Import world pack",
    category: "File",
  },
  "command-palette": {
    label: "Command palette",
    category: "General",
    keys: ["$mod+K"],
  },
  "keybind-settings": {
    label: "Keyboard shortcuts",
    category: "General",
    keys: ["$mod+,"],
  },
});

const store = new BindingsStore(schema, "aspect:keybinds");

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
    store.get(),
    {
      "edit-card": (ctx) => handlers.editCard(ctx.cardId as string),
      "delete-card": (ctx) => handlers.deleteCard(ctx.cardId as string),
      "set-kind": (ctx) => handlers.setKind(ctx.cardId as string),
      "create-card": (ctx) => {
        if (ctx.worldX != null && ctx.worldY != null) {
          handlers.createCard(ctx.worldX as number, ctx.worldY as number);
        } else {
          const center = handlers.getViewportCenter();
          handlers.createCard(center.x, center.y);
        }
      },
      "link-cards": () => handlers.linkCards(),
      "unlink-cards": () => handlers.unlinkCards(),
      "label-edge": () => handlers.labelEdge(),
      undo: () => handlers.undo(),
      redo: () => handlers.redo(),
      "nav-up": () => handlers.navigateDirection("up"),
      "nav-down": () => handlers.navigateDirection("down"),
      "nav-left": () => handlers.navigateDirection("left"),
      "nav-right": () => handlers.navigateDirection("right"),
      search: () => handlers.search(),
      deselect: () => handlers.deselect(),
      "export-graph": () => handlers.exportGraph(),
      "import-graph": () => handlers.importGraph(),
      "export-pack": () => handlers.exportPack(),
      "import-pack": () => handlers.importPack(),
      "command-palette": () => {
        const el = document.querySelector("command-palette");
        if (el) (el as HTMLElement & { open: boolean }).open = !((el as HTMLElement & { open: boolean }).open);
      },
      "keybind-settings": () => {
        const el = document.querySelector("keybind-settings");
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
      "set-kind": {
        when: (ctx) => ctx.cardId != null && !ctx.isEditing,
      },
      "link-cards": {
        when: (ctx) => (ctx.selectedCount as number) >= 2 && !ctx.isEditing,
      },
      "unlink-cards": {
        when: (ctx) => (ctx.selectedCount as number) >= 2 && !ctx.isEditing,
      },
      "label-edge": {
        when: (ctx) => (ctx.selectedCount as number) === 2 && !ctx.isEditing,
      },
      undo: {
        when: (ctx) => !ctx.isEditing,
      },
      redo: {
        when: (ctx) => !ctx.isEditing,
      },
      "nav-up": {
        when: (ctx) => ctx.cardId != null && !ctx.isEditing,
      },
      "nav-down": {
        when: (ctx) => ctx.cardId != null && !ctx.isEditing,
      },
      "nav-left": {
        when: (ctx) => ctx.cardId != null && !ctx.isEditing,
      },
      "nav-right": {
        when: (ctx) => ctx.cardId != null && !ctx.isEditing,
      },
      search: {
        when: (ctx) => !ctx.isEditing && !ctx.isSearching,
      },
      deselect: {
        when: (ctx) => !ctx.isEditing,
      },
      "export-graph": {
        when: (ctx) => !ctx.isEditing,
      },
      "import-graph": {
        when: (ctx) => !ctx.isEditing,
      },
      "export-pack": {
        when: (ctx) => !ctx.isEditing,
      },
      "import-pack": {
        when: (ctx) => !ctx.isEditing,
      },
      "command-palette": {
        captureInput: true,
      },
      "keybind-settings": {
        captureInput: true,
      },
    },
  );

  // Add menu tags for context menu filtering
  const menuTags: Record<string, string> = {
    "edit-card": "card",
    "delete-card": "card",
    "set-kind": "card",
    "create-card": "canvas",
    "link-cards": "card",
    "unlink-cards": "card",
    "label-edge": "card",
    "export-graph": "canvas",
    "import-graph": "canvas",
    "export-pack": "canvas",
    "import-pack": "canvas",
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

  const settings = document.createElement("keybind-settings");
  (settings as unknown as { store: BindingsStore }).store = store;
  document.body.appendChild(settings);

  const getContext = () => ({
    cardId: handlers.getCurrentCardId(),
    selectedCount: handlers.getSelectedCount(),
    isEditing: !!document.querySelector(".card-editor"),
    isSearching: !!document.querySelector(".search-overlay"),
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
