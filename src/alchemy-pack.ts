import type { WorldPack } from "./pack-types";

export const ALCHEMY_PACK: WorldPack = {
  packId: "elemental-alchemy",
  packVersion: 1,
  name: "Elemental Alchemy",
  description: "Combine materials based on their properties. Drag one onto another to combine.",
  fieldNames: ["flammable", "wet", "hot", "hard", "sharp", "ash", "cold"],
  kinds: [
    {
      id: "wood",
      label: "Wood",
      style: { color: "#a0522d", icon: "🪵" },
      fields: { flammable: true },
    },
    {
      id: "fire",
      label: "Fire",
      style: { color: "#ff6b35", icon: "🔥" },
      fields: { hot: true },
    },
    {
      id: "water",
      label: "Water",
      style: { color: "#4a90d9", icon: "💧" },
      fields: { wet: true, cold: true },
    },
    {
      id: "stone",
      label: "Stone",
      style: { color: "#888", icon: "🪨" },
      fields: { hard: true },
    },
    {
      id: "ash",
      label: "Ash",
      style: { color: "#666", icon: "🌫️" },
      fields: { ash: true },
    },
    {
      id: "steam",
      label: "Steam",
      style: { color: "#ccc", icon: "♨️" },
      fields: { hot: true, wet: true },
    },
    {
      id: "obsidian",
      label: "Obsidian",
      style: { color: "#1a1a2e", icon: "🔲" },
      fields: { hard: true, sharp: true },
    },
    {
      id: "mud",
      label: "Mud",
      style: { color: "#8b5e3c", icon: "🟫" },
      fields: { wet: true },
    },
  ],
  edgeTypes: [],
  actions: [
    // Wood + Fire → Ash (flammable + hot)
    {
      id: "ignite",
      label: "Ignite",
      description: "Flammable material catches fire and becomes ash",
      context: { kind: "wood" },
      target: { kind: "fire" },
      trigger: "combine",
      when: ["and",
        ["get", "contextFields", "flammable"],
        ["get", "targetFields", "hot"],
      ],
      do: [
        { type: "setKind", card: "context", kind: "ash" },
        { type: "setText", card: "context", text: "Ash" },
      ],
    },
    // Fire + Water → Steam (hot + wet)
    {
      id: "extinguish",
      label: "Extinguish",
      description: "Water extinguishes fire, producing steam",
      context: { kind: "water" },
      target: { kind: "fire" },
      trigger: "combine",
      when: ["and",
        ["get", "contextFields", "wet"],
        ["get", "targetFields", "hot"],
      ],
      do: [
        { type: "setKind", card: "target", kind: "steam" },
        { type: "setText", card: "target", text: "Steam" },
      ],
    },
    // Stone + Water → Mud (hard + wet)
    {
      id: "erode",
      label: "Erode",
      description: "Water erodes stone into mud",
      context: { kind: "water" },
      target: { kind: "stone" },
      trigger: "combine",
      when: ["and",
        ["get", "contextFields", "wet"],
        ["get", "targetFields", "hard"],
      ],
      do: [
        { type: "setKind", card: "target", kind: "mud" },
        { type: "setText", card: "target", text: "Mud" },
      ],
    },
    // Stone + Fire → Obsidian (hard + hot)
    {
      id: "forge",
      label: "Forge",
      description: "Extreme heat transforms stone into obsidian",
      context: { kind: "stone" },
      target: { kind: "fire" },
      trigger: "combine",
      when: ["and",
        ["get", "contextFields", "hard"],
        ["get", "targetFields", "hot"],
      ],
      do: [
        { type: "setKind", card: "context", kind: "obsidian" },
        { type: "setText", card: "context", text: "Obsidian" },
      ],
    },
    // Wood + Water → Wet Wood (flammable removed, wet added)
    {
      id: "soak",
      label: "Soak",
      description: "Water soaks wood, making it harder to burn",
      context: { kind: "wood" },
      target: { kind: "water" },
      trigger: "combine",
      when: ["and",
        ["get", "contextFields", "flammable"],
        ["get", "targetFields", "wet"],
      ],
      do: [
        { type: "setField", card: "context", key: "flammable", value: false },
        { type: "setField", card: "context", key: "wet", value: true },
        { type: "setText", card: "context", text: "Wet Wood" },
      ],
    },
  ],
};
