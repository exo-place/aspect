type Logic = unknown;

function getVar(data: unknown, path: string): unknown {
  if (path === "" || path === null || path === undefined) return data;
  const parts = String(path).split(".");
  let current: unknown = data;
  for (const part of parts) {
    if (current === null || current === undefined) return undefined;
    if (Array.isArray(current)) {
      const idx = Number(part);
      if (Number.isNaN(idx)) return undefined;
      current = current[idx];
    } else if (typeof current === "object") {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return current;
}

function truthy(val: unknown): boolean {
  if (Array.isArray(val)) return val.length > 0;
  return !!val;
}

function toNumber(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") {
    const n = Number(val);
    return Number.isNaN(n) ? 0 : n;
  }
  if (typeof val === "boolean") return val ? 1 : 0;
  return 0;
}

export function apply(logic: Logic, data: unknown = {}): unknown {
  if (logic === null || logic === undefined) return logic;
  if (typeof logic !== "object") return logic;
  if (Array.isArray(logic)) {
    return logic.map((item) => apply(item, data));
  }

  const keys = Object.keys(logic as Record<string, unknown>);
  if (keys.length !== 1) return logic;

  const op = keys[0];
  const args = (logic as Record<string, unknown>)[op];
  const argList: unknown[] = Array.isArray(args) ? args : [args];

  switch (op) {
    case "var": {
      const path = argList[0];
      const fallback = argList.length > 1 ? argList[1] : undefined;
      const result = getVar(data, String(path ?? ""));
      return result === undefined ? fallback : result;
    }

    case "==":
      // biome-ignore lint: intentional loose equality
      return apply(argList[0], data) == apply(argList[1], data);
    case "!=":
      // biome-ignore lint: intentional loose equality
      return apply(argList[0], data) != apply(argList[1], data);
    case "===":
      return apply(argList[0], data) === apply(argList[1], data);
    case "!==":
      return apply(argList[0], data) !== apply(argList[1], data);

    case ">": {
      const a = toNumber(apply(argList[0], data));
      const b = toNumber(apply(argList[1], data));
      return a > b;
    }
    case ">=": {
      const a = toNumber(apply(argList[0], data));
      const b = toNumber(apply(argList[1], data));
      return a >= b;
    }
    case "<": {
      if (argList.length === 3) {
        const a = toNumber(apply(argList[0], data));
        const b = toNumber(apply(argList[1], data));
        const c = toNumber(apply(argList[2], data));
        return a < b && b < c;
      }
      const a = toNumber(apply(argList[0], data));
      const b = toNumber(apply(argList[1], data));
      return a < b;
    }
    case "<=": {
      if (argList.length === 3) {
        const a = toNumber(apply(argList[0], data));
        const b = toNumber(apply(argList[1], data));
        const c = toNumber(apply(argList[2], data));
        return a <= b && b <= c;
      }
      const a = toNumber(apply(argList[0], data));
      const b = toNumber(apply(argList[1], data));
      return a <= b;
    }

    case "and": {
      let result: unknown = true;
      for (const arg of argList) {
        result = apply(arg, data);
        if (!truthy(result)) return result;
      }
      return result;
    }
    case "or": {
      let result: unknown = false;
      for (const arg of argList) {
        result = apply(arg, data);
        if (truthy(result)) return result;
      }
      return result;
    }
    case "not":
    case "!":
      return !truthy(apply(argList[0], data));
    case "!!":
      return truthy(apply(argList[0], data));

    case "if": {
      for (let i = 0; i < argList.length; i += 2) {
        if (i + 1 >= argList.length) return apply(argList[i], data);
        if (truthy(apply(argList[i], data))) return apply(argList[i + 1], data);
      }
      return null;
    }

    case "in": {
      const needle = apply(argList[0], data);
      const haystack = apply(argList[1], data);
      if (typeof haystack === "string") {
        return haystack.includes(String(needle));
      }
      if (Array.isArray(haystack)) {
        return haystack.includes(needle);
      }
      return false;
    }

    case "some": {
      const arr = apply(argList[0], data);
      if (!Array.isArray(arr)) return false;
      const test = argList[1];
      return arr.some((item) => truthy(apply(test, item)));
    }
    case "all": {
      const arr = apply(argList[0], data);
      if (!Array.isArray(arr)) return false;
      if (arr.length === 0) return false;
      const test = argList[1];
      return arr.every((item) => truthy(apply(test, item)));
    }
    case "none": {
      const arr = apply(argList[0], data);
      if (!Array.isArray(arr)) return true;
      const test = argList[1];
      return !arr.some((item) => truthy(apply(test, item)));
    }

    case "cat": {
      return argList.map((arg) => String(apply(arg, data) ?? "")).join("");
    }

    case "+": {
      return argList.reduce<number>((sum, arg) => sum + toNumber(apply(arg, data)), 0);
    }
    case "-": {
      if (argList.length === 1) return -toNumber(apply(argList[0], data));
      return toNumber(apply(argList[0], data)) - toNumber(apply(argList[1], data));
    }
    case "*": {
      return argList.reduce<number>((product, arg) => product * toNumber(apply(arg, data)), 1);
    }
    case "/": {
      return toNumber(apply(argList[0], data)) / toNumber(apply(argList[1], data));
    }
    case "%": {
      return toNumber(apply(argList[0], data)) % toNumber(apply(argList[1], data));
    }

    case "min": {
      const values = argList.map((arg) => toNumber(apply(arg, data)));
      return Math.min(...values);
    }
    case "max": {
      const values = argList.map((arg) => toNumber(apply(arg, data)));
      return Math.max(...values);
    }

    default:
      throw new Error(`Unknown operator: ${op}`);
  }
}
