import type { WorldPack } from "./pack-types";

export const DEFAULT_PACK: WorldPack = {
  packId: "rooms-and-items",
  packVersion: 1,
  name: "Rooms & Items",
  kinds: [
    { id: "room", label: "Room", style: { color: "#56b6c2", icon: "\u{1F3E0}" } },
    { id: "item", label: "Item", style: { color: "#e5c07b", icon: "\u{1F4E6}" } },
    { id: "character", label: "Character", style: { color: "#c678dd", icon: "\u{1F9D1}" } },
  ],
  edgeTypes: [
    { id: "exit", label: "exit", constraint: { from: ["room"], to: ["room"] } },
    { id: "contains", label: "contains", constraint: { from: ["room"], to: ["item", "character"] } },
    { id: "carries", label: "carries", constraint: { from: ["character"], to: ["item"] } },
  ],
};
