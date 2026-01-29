import { describe, expect, test } from "bun:test";
import { resolveEdgeToggle } from "../src/edge-toggle";

describe("resolveEdgeToggle", () => {
  describe("single target", () => {
    test("links when no edge exists", () => {
      const result = resolveEdgeToggle("A", ["B"], () => false);
      expect(result).toBe("link");
    });

    test("unlinks when edge exists", () => {
      const result = resolveEdgeToggle("A", ["B"], () => true);
      expect(result).toBe("unlink");
    });
  });

  describe("two targets", () => {
    test("links when no edges exist (0/2)", () => {
      const result = resolveEdgeToggle("A", ["B", "C"], () => false);
      expect(result).toBe("link");
    });

    test("links when minority of edges exist (1/2)", () => {
      const edges = new Set(["A-B"]);
      const result = resolveEdgeToggle("A", ["B", "C"], (a, b) =>
        edges.has(`${a}-${b}`) || edges.has(`${b}-${a}`),
      );
      expect(result).toBe("link");
    });

    test("unlinks when all edges exist (2/2)", () => {
      const result = resolveEdgeToggle("A", ["B", "C"], () => true);
      expect(result).toBe("unlink");
    });
  });

  describe("three targets", () => {
    test("links when 0/3 exist", () => {
      const result = resolveEdgeToggle("A", ["B", "C", "D"], () => false);
      expect(result).toBe("link");
    });

    test("links when 1/3 exist (minority)", () => {
      const edges = new Set(["A-B"]);
      const result = resolveEdgeToggle("A", ["B", "C", "D"], (a, b) =>
        edges.has(`${a}-${b}`) || edges.has(`${b}-${a}`),
      );
      expect(result).toBe("link");
    });

    test("unlinks when 2/3 exist (majority)", () => {
      const edges = new Set(["A-B", "A-C"]);
      const result = resolveEdgeToggle("A", ["B", "C", "D"], (a, b) =>
        edges.has(`${a}-${b}`) || edges.has(`${b}-${a}`),
      );
      expect(result).toBe("unlink");
    });

    test("unlinks when 3/3 exist", () => {
      const result = resolveEdgeToggle("A", ["B", "C", "D"], () => true);
      expect(result).toBe("unlink");
    });
  });

  describe("edge direction independence", () => {
    test("detects edge regardless of direction via hasEdge callback", () => {
      // Simulates edge going B→A (reverse direction)
      const edges = [{ from: "B", to: "A" }];
      const hasEdge = (a: string, b: string) =>
        edges.some((e) => (e.from === a && e.to === b) || (e.from === b && e.to === a));
      const result = resolveEdgeToggle("A", ["B"], hasEdge);
      expect(result).toBe("unlink");
    });
  });

  describe("empty targets", () => {
    test("returns link for empty target list", () => {
      const result = resolveEdgeToggle("A", [], () => true);
      expect(result).toBe("link");
    });
  });

  describe("boundary: exactly half", () => {
    test("links when exactly half exist (2/4)", () => {
      const edges = new Set(["A-B", "A-C"]);
      const result = resolveEdgeToggle("A", ["B", "C", "D", "E"], (a, b) =>
        edges.has(`${a}-${b}`) || edges.has(`${b}-${a}`),
      );
      // 2 <= 4/2 → true → link
      expect(result).toBe("link");
    });
  });
});
