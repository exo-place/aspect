import { describe, expect, test } from "bun:test";
import { createId } from "../src/id";

describe("createId", () => {
  test("returns a string of length 8", () => {
    const id = createId();
    expect(id).toHaveLength(8);
  });

  test("contains only lowercase alphanumeric characters", () => {
    for (let i = 0; i < 100; i++) {
      const id = createId();
      expect(id).toMatch(/^[0-9a-z]{8}$/);
    }
  });

  test("generates unique IDs", () => {
    const ids = new Set<string>();
    for (let i = 0; i < 1000; i++) {
      ids.add(createId());
    }
    expect(ids.size).toBe(1000);
  });
});
