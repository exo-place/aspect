import type { WorldPack } from "./pack-types";

export const DEFAULT_PACK: WorldPack = {
  packId: "rooms-and-items",
  packVersion: 2,
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
  actions: [
    {
      id: "pick-up",
      label: "Pick Up",
      description: "Character picks up an item from a shared room",
      context: { kind: "character" },
      target: { kind: "item" },
      trigger: "both",
      run: ["if",
        ["and",
          ["call", ["var", "any"], ["var", "sharedNeighbors"], ["fn", ["n"], ["==", ["get", ["var", "n"], "kind"], "room"]]],
          ["not", ["call", ["var", "any"], ["var", "edgesFromContextToTarget"], ["fn", ["e"], ["==", ["get", ["var", "e"], "type"], "carries"]]]],
        ],
        ["array",
          ["call", ["var", "addEdge"], ["var", "context"], ["var", "target"], "carries"],
          ["call", ["var", "emit"], "picked-up"],
        ],
        null,
      ],
    },
    {
      id: "drop",
      label: "Drop",
      description: "Character drops a carried item into the current room",
      context: { kind: "character" },
      target: { kind: "item", edgeType: "carries" },
      run: ["array",
        ["call", ["var", "removeEdge"], ["var", "context"], ["var", "target"], "carries"],
        ["call", ["var", "emit"], "dropped"],
      ],
    },
  ],
};
