import { describe, expect, test } from "bun:test";
import { apply } from "../src/json-logic";

describe("json-logic", () => {
  describe("var", () => {
    test("retrieves top-level key", () => {
      expect(apply({ var: "a" }, { a: 1 })).toBe(1);
    });

    test("retrieves nested key", () => {
      expect(apply({ var: "a.b" }, { a: { b: 2 } })).toBe(2);
    });

    test("returns undefined for missing key", () => {
      expect(apply({ var: "x" }, { a: 1 })).toBeUndefined();
    });

    test("returns fallback for missing key", () => {
      expect(apply({ var: ["x", 42] }, { a: 1 })).toBe(42);
    });

    test("returns entire data with empty string", () => {
      const data = { a: 1 };
      expect(apply({ var: "" }, data)).toEqual(data);
    });

    test("accesses array indices", () => {
      expect(apply({ var: "arr.1" }, { arr: [10, 20, 30] })).toBe(20);
    });
  });

  describe("equality", () => {
    test("== with loose equality", () => {
      expect(apply({ "==": [1, 1] })).toBe(true);
      expect(apply({ "==": [1, "1"] })).toBe(true);
      expect(apply({ "==": [1, 2] })).toBe(false);
    });

    test("!= loose inequality", () => {
      expect(apply({ "!=": [1, 2] })).toBe(true);
      expect(apply({ "!=": [1, "1"] })).toBe(false);
    });

    test("=== strict equality", () => {
      expect(apply({ "===": [1, 1] })).toBe(true);
      expect(apply({ "===": [1, "1"] })).toBe(false);
    });

    test("!== strict inequality", () => {
      expect(apply({ "!==": [1, "1"] })).toBe(true);
      expect(apply({ "!==": [1, 1] })).toBe(false);
    });
  });

  describe("comparison", () => {
    test("> greater than", () => {
      expect(apply({ ">": [2, 1] })).toBe(true);
      expect(apply({ ">": [1, 2] })).toBe(false);
      expect(apply({ ">": [1, 1] })).toBe(false);
    });

    test(">= greater than or equal", () => {
      expect(apply({ ">=": [2, 1] })).toBe(true);
      expect(apply({ ">=": [1, 1] })).toBe(true);
      expect(apply({ ">=": [0, 1] })).toBe(false);
    });

    test("< less than", () => {
      expect(apply({ "<": [1, 2] })).toBe(true);
      expect(apply({ "<": [2, 1] })).toBe(false);
    });

    test("<= less than or equal", () => {
      expect(apply({ "<=": [1, 2] })).toBe(true);
      expect(apply({ "<=": [1, 1] })).toBe(true);
      expect(apply({ "<=": [2, 1] })).toBe(false);
    });

    test("< between (3 args)", () => {
      expect(apply({ "<": [1, 2, 3] })).toBe(true);
      expect(apply({ "<": [1, 1, 3] })).toBe(false);
      expect(apply({ "<": [1, 4, 3] })).toBe(false);
    });

    test("<= between (3 args)", () => {
      expect(apply({ "<=": [1, 1, 3] })).toBe(true);
      expect(apply({ "<=": [1, 3, 3] })).toBe(true);
      expect(apply({ "<=": [1, 4, 3] })).toBe(false);
    });
  });

  describe("logic", () => {
    test("and returns last truthy or first falsy", () => {
      expect(apply({ and: [true, true] })).toBe(true);
      expect(apply({ and: [true, false] })).toBe(false);
      expect(apply({ and: [true, "yes"] })).toBe("yes");
      expect(apply({ and: [0, "yes"] })).toBe(0);
    });

    test("or returns first truthy or last falsy", () => {
      expect(apply({ or: [false, true] })).toBe(true);
      expect(apply({ or: [false, false] })).toBe(false);
      expect(apply({ or: [false, "yes"] })).toBe("yes");
      expect(apply({ or: ["", 0] })).toBe(0);
    });

    test("not / ! negates", () => {
      expect(apply({ not: [true] })).toBe(false);
      expect(apply({ not: [false] })).toBe(true);
      expect(apply({ "!": [true] })).toBe(false);
      expect(apply({ "!": [0] })).toBe(true);
    });

    test("!! double negation (truthy cast)", () => {
      expect(apply({ "!!": [1] })).toBe(true);
      expect(apply({ "!!": [0] })).toBe(false);
      expect(apply({ "!!": ["hello"] })).toBe(true);
      expect(apply({ "!!": [""] })).toBe(false);
    });

    test("empty array is falsy", () => {
      expect(apply({ "!!": [[]] })).toBe(false);
      expect(apply({ "!!": [[1]] })).toBe(true);
    });
  });

  describe("if", () => {
    test("if-then-else", () => {
      expect(apply({ if: [true, "yes", "no"] })).toBe("yes");
      expect(apply({ if: [false, "yes", "no"] })).toBe("no");
    });

    test("if-then-elseif-then-else", () => {
      expect(apply({ if: [false, "a", true, "b", "c"] })).toBe("b");
      expect(apply({ if: [false, "a", false, "b", "c"] })).toBe("c");
    });

    test("if with no else returns null", () => {
      expect(apply({ if: [false, "yes"] })).toBe(null);
    });
  });

  describe("in", () => {
    test("in string", () => {
      expect(apply({ in: ["ell", "hello"] })).toBe(true);
      expect(apply({ in: ["xyz", "hello"] })).toBe(false);
    });

    test("in array", () => {
      expect(apply({ in: [2, [1, 2, 3]] })).toBe(true);
      expect(apply({ in: [4, [1, 2, 3]] })).toBe(false);
    });

    test("in non-iterable returns false", () => {
      expect(apply({ in: ["a", 123] })).toBe(false);
    });
  });

  describe("array operations", () => {
    test("some returns true if any match", () => {
      expect(apply(
        { some: [[1, 2, 3], { ">": [{ var: "" }, 2] }] },
      )).toBe(true);
    });

    test("some returns false if none match", () => {
      expect(apply(
        { some: [[1, 2, 3], { ">": [{ var: "" }, 5] }] },
      )).toBe(false);
    });

    test("some on non-array returns false", () => {
      expect(apply({ some: ["not-array", { "!!": [{ var: "" }] }] })).toBe(false);
    });

    test("all returns true if every element matches", () => {
      expect(apply(
        { all: [[2, 3, 4], { ">": [{ var: "" }, 1] }] },
      )).toBe(true);
    });

    test("all returns false if any element fails", () => {
      expect(apply(
        { all: [[2, 3, 4], { ">": [{ var: "" }, 3] }] },
      )).toBe(false);
    });

    test("all on empty array returns false", () => {
      expect(apply({ all: [[], { "!!": [{ var: "" }] }] })).toBe(false);
    });

    test("none returns true if no elements match", () => {
      expect(apply(
        { none: [[1, 2, 3], { ">": [{ var: "" }, 5] }] },
      )).toBe(true);
    });

    test("none returns false if any match", () => {
      expect(apply(
        { none: [[1, 2, 3], { ">": [{ var: "" }, 2] }] },
      )).toBe(false);
    });

    test("none on non-array returns true", () => {
      expect(apply({ none: ["not-array", { "!!": [{ var: "" }] }] })).toBe(true);
    });
  });

  describe("string", () => {
    test("cat concatenates", () => {
      expect(apply({ cat: ["hello", " ", "world"] })).toBe("hello world");
    });

    test("cat with numbers", () => {
      expect(apply({ cat: ["count: ", 3] })).toBe("count: 3");
    });
  });

  describe("arithmetic", () => {
    test("+ adds", () => {
      expect(apply({ "+": [1, 2] })).toBe(3);
      expect(apply({ "+": [1, 2, 3] })).toBe(6);
    });

    test("- subtracts", () => {
      expect(apply({ "-": [5, 2] })).toBe(3);
    });

    test("- unary negation", () => {
      expect(apply({ "-": [5] })).toBe(-5);
    });

    test("* multiplies", () => {
      expect(apply({ "*": [3, 4] })).toBe(12);
      expect(apply({ "*": [2, 3, 4] })).toBe(24);
    });

    test("/ divides", () => {
      expect(apply({ "/": [10, 2] })).toBe(5);
    });

    test("% modulo", () => {
      expect(apply({ "%": [7, 3] })).toBe(1);
    });

    test("min returns minimum", () => {
      expect(apply({ min: [3, 1, 2] })).toBe(1);
    });

    test("max returns maximum", () => {
      expect(apply({ max: [3, 1, 2] })).toBe(3);
    });
  });

  describe("nesting", () => {
    test("nested expressions evaluate", () => {
      // (2 + 3) > 4
      expect(apply({ ">": [{ "+": [2, 3] }, 4] })).toBe(true);
    });

    test("var in nested expression", () => {
      expect(apply(
        { "==": [{ var: "kind" }, "room"] },
        { kind: "room" },
      )).toBe(true);
    });
  });

  describe("edge cases", () => {
    test("null logic returns null", () => {
      expect(apply(null)).toBe(null);
    });

    test("undefined logic returns undefined", () => {
      expect(apply(undefined)).toBeUndefined();
    });

    test("primitive logic returns itself", () => {
      expect(apply(42)).toBe(42);
      expect(apply("hello")).toBe("hello");
      expect(apply(true)).toBe(true);
    });

    test("array of primitives maps through", () => {
      expect(apply([1, 2, 3])).toEqual([1, 2, 3]);
    });

    test("array with nested logic evaluates", () => {
      expect(apply([{ "+": [1, 2] }, { var: "x" }], { x: 10 })).toEqual([3, 10]);
    });

    test("unknown operator throws", () => {
      expect(() => apply({ foobar: [1] })).toThrow("Unknown operator: foobar");
    });

    test("string coercion in arithmetic", () => {
      expect(apply({ "+": ["3", "4"] })).toBe(7);
    });
  });

  describe("some/all/none with data context", () => {
    test("some can access element properties", () => {
      const data = {
        items: [
          { type: "exit" },
          { type: "contains" },
        ],
      };
      expect(apply(
        { some: [{ var: "items" }, { "===": [{ var: "type" }, "exit"] }] },
        data,
      )).toBe(true);
    });
  });
});
