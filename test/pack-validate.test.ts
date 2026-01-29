import { describe, expect, test } from "bun:test";
import { validateWorldPack } from "../src/pack-validate";
import type { WorldPack } from "../src/pack-types";
import { DEFAULT_PACK } from "../src/default-pack";

const VALID_PACK: WorldPack = {
  packId: "test",
  packVersion: 1,
  name: "Test",
  kinds: [
    { id: "room", label: "Room", style: { color: "#56b6c2", icon: "🏠" } },
    { id: "item", label: "Item" },
  ],
  edgeTypes: [
    { id: "exit", label: "exit", constraint: { from: ["room"], to: ["room"] } },
    { id: "link", label: "link" },
  ],
};

describe("validateWorldPack", () => {
  describe("valid packs", () => {
    test("accepts a minimal valid pack", () => {
      const result = validateWorldPack({
        packId: "min",
        packVersion: 1,
        name: "Minimal",
        kinds: [],
        edgeTypes: [],
      });
      expect(result.valid).toBe(true);
    });

    test("accepts a full valid pack", () => {
      const result = validateWorldPack(VALID_PACK);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.pack.packId).toBe("test");
      }
    });

    test("accepts DEFAULT_PACK", () => {
      const result = validateWorldPack(DEFAULT_PACK);
      expect(result.valid).toBe(true);
    });

    test("accepts pack with optional description", () => {
      const result = validateWorldPack({ ...VALID_PACK, description: "A test" });
      expect(result.valid).toBe(true);
    });

    test("returns pack data on success", () => {
      const result = validateWorldPack(VALID_PACK);
      expect(result.valid).toBe(true);
      if (result.valid) {
        expect(result.pack.kinds).toHaveLength(2);
        expect(result.pack.edgeTypes).toHaveLength(2);
      }
    });
  });

  describe("top-level errors", () => {
    test("rejects null", () => {
      const result = validateWorldPack(null);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors[0].message).toBe("Expected an object");
      }
    });

    test("rejects array", () => {
      const result = validateWorldPack([]);
      expect(result.valid).toBe(false);
    });

    test("rejects string", () => {
      const result = validateWorldPack("hello");
      expect(result.valid).toBe(false);
    });

    test("rejects missing packId", () => {
      const { packId: _, ...rest } = VALID_PACK;
      const result = validateWorldPack(rest);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "packId")).toBe(true);
      }
    });

    test("rejects missing packVersion", () => {
      const { packVersion: _, ...rest } = VALID_PACK;
      const result = validateWorldPack(rest);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "packVersion")).toBe(true);
      }
    });

    test("rejects missing name", () => {
      const { name: _, ...rest } = VALID_PACK;
      const result = validateWorldPack(rest);
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "name")).toBe(true);
      }
    });

    test("rejects non-string description", () => {
      const result = validateWorldPack({ ...VALID_PACK, description: 42 });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "description")).toBe(true);
      }
    });

    test("rejects non-array kinds", () => {
      const result = validateWorldPack({ ...VALID_PACK, kinds: "nope" });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "kinds")).toBe(true);
      }
    });

    test("rejects non-array edgeTypes", () => {
      const result = validateWorldPack({ ...VALID_PACK, edgeTypes: {} });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "edgeTypes")).toBe(true);
      }
    });
  });

  describe("kind errors", () => {
    test("rejects kind with missing id", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ label: "Room" }],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "kinds[0].id")).toBe(true);
      }
    });

    test("rejects kind with empty id", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "", label: "Room" }],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "kinds[0].id")).toBe(true);
      }
    });

    test("rejects kind with missing label", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "room" }],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "kinds[0].label")).toBe(true);
      }
    });

    test("rejects kind with empty label", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "room", label: "" }],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "kinds[0].label")).toBe(true);
      }
    });

    test("rejects non-object kind", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: ["not-an-object"],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "kinds[0]")).toBe(true);
      }
    });

    test("rejects non-string style.color", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "room", label: "Room", style: { color: 123 } }],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "kinds[0].style.color")).toBe(true);
      }
    });

    test("rejects non-string style.icon", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "room", label: "Room", style: { icon: false } }],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "kinds[0].style.icon")).toBe(true);
      }
    });

    test("rejects non-object style", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "room", label: "Room", style: "red" }],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "kinds[0].style")).toBe(true);
      }
    });
  });

  describe("edge type errors", () => {
    test("rejects edge type with missing id", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [],
        edgeTypes: [{ label: "exit" }],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "edgeTypes[0].id")).toBe(true);
      }
    });

    test("rejects edge type with empty id", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [],
        edgeTypes: [{ id: "", label: "exit" }],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "edgeTypes[0].id")).toBe(true);
      }
    });

    test("rejects edge type with missing label", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [],
        edgeTypes: [{ id: "exit" }],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "edgeTypes[0].label")).toBe(true);
      }
    });

    test("rejects non-object constraint", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "room", label: "Room" }],
        edgeTypes: [{ id: "exit", label: "exit", constraint: "bad" }],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "edgeTypes[0].constraint")).toBe(true);
      }
    });

    test("rejects non-array constraint.from", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "room", label: "Room" }],
        edgeTypes: [{ id: "exit", label: "exit", constraint: { from: "room" } }],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "edgeTypes[0].constraint.from")).toBe(true);
      }
    });

    test("rejects non-string items in constraint.to", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "room", label: "Room" }],
        edgeTypes: [{ id: "exit", label: "exit", constraint: { to: [42] } }],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "edgeTypes[0].constraint.to")).toBe(true);
      }
    });
  });

  describe("uniqueness", () => {
    test("rejects duplicate kind IDs", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [
          { id: "room", label: "Room" },
          { id: "room", label: "Another Room" },
        ],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.message.includes("Duplicate kind ID"))).toBe(true);
      }
    });

    test("rejects duplicate edge type IDs", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [],
        edgeTypes: [
          { id: "exit", label: "exit" },
          { id: "exit", label: "another exit" },
        ],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.message.includes("Duplicate edge type ID"))).toBe(true);
      }
    });
  });

  describe("referential integrity", () => {
    test("rejects constraint.from referencing unknown kind", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "room", label: "Room" }],
        edgeTypes: [{ id: "exit", label: "exit", constraint: { from: ["unknown"] } }],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) =>
          e.path === "edgeTypes[0].constraint.from" && e.message.includes("unknown"),
        )).toBe(true);
      }
    });

    test("rejects constraint.to referencing unknown kind", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [{ id: "room", label: "Room" }],
        edgeTypes: [{ id: "exit", label: "exit", constraint: { to: ["missing"] } }],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) =>
          e.path === "edgeTypes[0].constraint.to" && e.message.includes("missing"),
        )).toBe(true);
      }
    });

    test("accepts constraint referencing valid kinds", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [
          { id: "room", label: "Room" },
          { id: "item", label: "Item" },
        ],
        edgeTypes: [
          { id: "contains", label: "contains", constraint: { from: ["room"], to: ["item"] } },
        ],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe("error path formatting", () => {
    test("paths include array indices", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [
          { id: "a", label: "A" },
          { id: "b" }, // missing label
        ],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.some((e) => e.path === "kinds[1].label")).toBe(true);
      }
    });

    test("collects multiple errors", () => {
      const result = validateWorldPack({
        ...VALID_PACK,
        kinds: [
          { id: "", label: "" }, // two errors
        ],
        edgeTypes: [],
      });
      expect(result.valid).toBe(false);
      if (!result.valid) {
        expect(result.errors.length).toBeGreaterThanOrEqual(2);
      }
    });
  });
});
