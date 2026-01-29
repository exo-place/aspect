import {
  keybinds,
  defineSchema,
  fromBindings,
  registerComponents,
} from "keybinds";
import type { Command } from "keybinds";

export interface KeybindHandlers {
  deleteCurrentCard(): void;
  deselect(): void;
}

const schema = defineSchema({
  delete: {
    label: "Delete card",
    category: "Edit",
    keys: ["Backspace", "Delete"],
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

export function setupKeybinds(handlers: KeybindHandlers): () => void {
  registerComponents();

  const commands: Command[] = fromBindings(
    schema,
    {
      delete: () => handlers.deleteCurrentCard(),
      deselect: () => handlers.deselect(),
      "command-palette": () => {
        const el = document.querySelector("command-palette");
        if (el) (el as HTMLElement & { open: boolean }).open = !((el as HTMLElement & { open: boolean }).open);
      },
    },
    {
      delete: {
        when: () => !document.querySelector(".card-editor"),
      },
      deselect: {
        when: () => !document.querySelector(".card-editor"),
      },
      "command-palette": {
        captureInput: true,
      },
    },
  );

  const palette = document.createElement("command-palette");
  (palette as unknown as { commands: Command[] }).commands = commands;
  document.body.appendChild(palette);

  const cheatsheet = document.createElement("keybind-cheatsheet");
  cheatsheet.setAttribute("auto-trigger", "");
  (cheatsheet as unknown as { commands: Command[] }).commands = commands;
  document.body.appendChild(cheatsheet);

  return keybinds(commands);
}
