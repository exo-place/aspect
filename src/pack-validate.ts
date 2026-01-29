import type { WorldPack } from "./pack-types";

export interface PackValidationError {
  path: string;
  message: string;
}

export type PackValidationResult =
  | { valid: true; pack: WorldPack }
  | { valid: false; errors: PackValidationError[] };

export function validateWorldPack(input: unknown): PackValidationResult {
  const errors: PackValidationError[] = [];

  if (typeof input !== "object" || input === null || Array.isArray(input)) {
    return { valid: false, errors: [{ path: "", message: "Expected an object" }] };
  }

  const obj = input as Record<string, unknown>;

  // Top-level required fields
  if (typeof obj.packId !== "string") {
    errors.push({ path: "packId", message: "Must be a string" });
  }
  if (typeof obj.packVersion !== "number") {
    errors.push({ path: "packVersion", message: "Must be a number" });
  }
  if (typeof obj.name !== "string") {
    errors.push({ path: "name", message: "Must be a string" });
  }
  if (obj.description !== undefined && typeof obj.description !== "string") {
    errors.push({ path: "description", message: "Must be a string if provided" });
  }

  // kinds
  if (!Array.isArray(obj.kinds)) {
    errors.push({ path: "kinds", message: "Must be an array" });
  }
  // edgeTypes
  if (!Array.isArray(obj.edgeTypes)) {
    errors.push({ path: "edgeTypes", message: "Must be an array" });
  }

  // If structural issues, bail early
  if (errors.length > 0) {
    return { valid: false, errors };
  }

  const kinds = obj.kinds as unknown[];
  const edgeTypes = obj.edgeTypes as unknown[];
  const kindIds = new Set<string>();

  // Validate kinds
  for (let i = 0; i < kinds.length; i++) {
    const prefix = `kinds[${i}]`;
    const k = kinds[i];
    if (typeof k !== "object" || k === null || Array.isArray(k)) {
      errors.push({ path: prefix, message: "Must be an object" });
      continue;
    }
    const kind = k as Record<string, unknown>;
    if (typeof kind.id !== "string" || kind.id === "") {
      errors.push({ path: `${prefix}.id`, message: "Must be a non-empty string" });
    }
    if (typeof kind.label !== "string" || kind.label === "") {
      errors.push({ path: `${prefix}.label`, message: "Must be a non-empty string" });
    }
    if (kind.style !== undefined) {
      if (typeof kind.style !== "object" || kind.style === null || Array.isArray(kind.style)) {
        errors.push({ path: `${prefix}.style`, message: "Must be an object if provided" });
      } else {
        const style = kind.style as Record<string, unknown>;
        if (style.color !== undefined && typeof style.color !== "string") {
          errors.push({ path: `${prefix}.style.color`, message: "Must be a string if provided" });
        }
        if (style.icon !== undefined && typeof style.icon !== "string") {
          errors.push({ path: `${prefix}.style.icon`, message: "Must be a string if provided" });
        }
      }
    }
    // Track IDs for uniqueness
    if (typeof kind.id === "string" && kind.id !== "") {
      if (kindIds.has(kind.id)) {
        errors.push({ path: `${prefix}.id`, message: `Duplicate kind ID "${kind.id}"` });
      }
      kindIds.add(kind.id);
    }
  }

  // Validate edgeTypes
  const edgeTypeIds = new Set<string>();
  for (let i = 0; i < edgeTypes.length; i++) {
    const prefix = `edgeTypes[${i}]`;
    const e = edgeTypes[i];
    if (typeof e !== "object" || e === null || Array.isArray(e)) {
      errors.push({ path: prefix, message: "Must be an object" });
      continue;
    }
    const et = e as Record<string, unknown>;
    if (typeof et.id !== "string" || et.id === "") {
      errors.push({ path: `${prefix}.id`, message: "Must be a non-empty string" });
    }
    if (typeof et.label !== "string" || et.label === "") {
      errors.push({ path: `${prefix}.label`, message: "Must be a non-empty string" });
    }
    if (et.constraint !== undefined) {
      if (typeof et.constraint !== "object" || et.constraint === null || Array.isArray(et.constraint)) {
        errors.push({ path: `${prefix}.constraint`, message: "Must be an object if provided" });
      } else {
        const constraint = et.constraint as Record<string, unknown>;
        if (constraint.from !== undefined) {
          if (!Array.isArray(constraint.from) || !constraint.from.every((v: unknown) => typeof v === "string")) {
            errors.push({ path: `${prefix}.constraint.from`, message: "Must be an array of strings" });
          } else {
            for (const ref of constraint.from as string[]) {
              if (!kindIds.has(ref)) {
                errors.push({ path: `${prefix}.constraint.from`, message: `References unknown kind "${ref}"` });
              }
            }
          }
        }
        if (constraint.to !== undefined) {
          if (!Array.isArray(constraint.to) || !constraint.to.every((v: unknown) => typeof v === "string")) {
            errors.push({ path: `${prefix}.constraint.to`, message: "Must be an array of strings" });
          } else {
            for (const ref of constraint.to as string[]) {
              if (!kindIds.has(ref)) {
                errors.push({ path: `${prefix}.constraint.to`, message: `References unknown kind "${ref}"` });
              }
            }
          }
        }
      }
    }
    // Track IDs for uniqueness
    if (typeof et.id === "string" && et.id !== "") {
      if (edgeTypeIds.has(et.id)) {
        errors.push({ path: `${prefix}.id`, message: `Duplicate edge type ID "${et.id}"` });
      }
      edgeTypeIds.add(et.id);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, pack: input as WorldPack };
}
