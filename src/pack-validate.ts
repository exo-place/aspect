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

  // Validate actions (optional)
  if (obj.actions !== undefined) {
    if (!Array.isArray(obj.actions)) {
      errors.push({ path: "actions", message: "Must be an array if provided" });
    } else {
      const actions = obj.actions as unknown[];
      const actionIds = new Set<string>();
      for (let i = 0; i < actions.length; i++) {
        const prefix = `actions[${i}]`;
        const a = actions[i];
        if (typeof a !== "object" || a === null || Array.isArray(a)) {
          errors.push({ path: prefix, message: "Must be an object" });
          continue;
        }
        const action = a as Record<string, unknown>;
        if (typeof action.id !== "string" || action.id === "") {
          errors.push({ path: `${prefix}.id`, message: "Must be a non-empty string" });
        }
        if (typeof action.label !== "string" || action.label === "") {
          errors.push({ path: `${prefix}.label`, message: "Must be a non-empty string" });
        }
        if (action.description !== undefined && typeof action.description !== "string") {
          errors.push({ path: `${prefix}.description`, message: "Must be a string if provided" });
        }

        // context
        if (typeof action.context !== "object" || action.context === null || Array.isArray(action.context)) {
          errors.push({ path: `${prefix}.context`, message: "Must be an object" });
        } else {
          const ctx = action.context as Record<string, unknown>;
          if (ctx.kind !== undefined) {
            if (typeof ctx.kind !== "string") {
              errors.push({ path: `${prefix}.context.kind`, message: "Must be a string if provided" });
            } else if (!kindIds.has(ctx.kind)) {
              errors.push({ path: `${prefix}.context.kind`, message: `References unknown kind "${ctx.kind}"` });
            }
          }
        }

        // target
        if (typeof action.target !== "object" || action.target === null || Array.isArray(action.target)) {
          errors.push({ path: `${prefix}.target`, message: "Must be an object" });
        } else {
          const tgt = action.target as Record<string, unknown>;
          if (tgt.kind !== undefined) {
            if (typeof tgt.kind !== "string") {
              errors.push({ path: `${prefix}.target.kind`, message: "Must be a string if provided" });
            } else if (!kindIds.has(tgt.kind)) {
              errors.push({ path: `${prefix}.target.kind`, message: `References unknown kind "${tgt.kind}"` });
            }
          }
          if (tgt.edgeType !== undefined) {
            if (typeof tgt.edgeType !== "string") {
              errors.push({ path: `${prefix}.target.edgeType`, message: "Must be a string if provided" });
            } else if (!edgeTypeIds.has(tgt.edgeType)) {
              errors.push({ path: `${prefix}.target.edgeType`, message: `References unknown edge type "${tgt.edgeType}"` });
            }
          }
          if (tgt.direction !== undefined && tgt.direction !== "from" && tgt.direction !== "to") {
            errors.push({ path: `${prefix}.target.direction`, message: 'Must be "from" or "to" if provided' });
          }
        }

        // do (effects)
        if (!Array.isArray(action.do)) {
          errors.push({ path: `${prefix}.do`, message: "Must be an array" });
        } else {
          validateEffects(action.do as unknown[], prefix, kindIds, edgeTypeIds, errors);
        }

        // uniqueness
        if (typeof action.id === "string" && action.id !== "") {
          if (actionIds.has(action.id)) {
            errors.push({ path: `${prefix}.id`, message: `Duplicate action ID "${action.id}"` });
          }
          actionIds.add(action.id);
        }
      }
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  return { valid: true, pack: input as WorldPack };
}

function validateEffects(
  effects: unknown[],
  actionPrefix: string,
  kindIds: Set<string>,
  edgeTypeIds: Set<string>,
  errors: PackValidationError[],
): void {
  for (let j = 0; j < effects.length; j++) {
    const ePrefix = `${actionPrefix}.do[${j}]`;
    const eff = effects[j];
    if (typeof eff !== "object" || eff === null || Array.isArray(eff)) {
      errors.push({ path: ePrefix, message: "Must be an object" });
      continue;
    }
    const effect = eff as Record<string, unknown>;
    const type = effect.type;
    if (typeof type !== "string") {
      errors.push({ path: `${ePrefix}.type`, message: "Must be a string" });
      continue;
    }
    switch (type) {
      case "addEdge":
      case "removeEdge":
        if (!isCardRef(effect.from)) {
          errors.push({ path: `${ePrefix}.from`, message: 'Must be "context" or "target"' });
        }
        if (!isCardRef(effect.to)) {
          errors.push({ path: `${ePrefix}.to`, message: 'Must be "context" or "target"' });
        }
        if (effect.edgeType !== undefined) {
          if (typeof effect.edgeType !== "string") {
            errors.push({ path: `${ePrefix}.edgeType`, message: "Must be a string if provided" });
          } else if (!edgeTypeIds.has(effect.edgeType)) {
            errors.push({ path: `${ePrefix}.edgeType`, message: `References unknown edge type "${effect.edgeType}"` });
          }
        }
        if (type === "addEdge" && effect.label !== undefined && typeof effect.label !== "string") {
          errors.push({ path: `${ePrefix}.label`, message: "Must be a string if provided" });
        }
        break;
      case "setKind":
        if (!isCardRef(effect.card)) {
          errors.push({ path: `${ePrefix}.card`, message: 'Must be "context" or "target"' });
        }
        if (effect.kind !== null && typeof effect.kind !== "string") {
          errors.push({ path: `${ePrefix}.kind`, message: "Must be a string or null" });
        } else if (typeof effect.kind === "string" && !kindIds.has(effect.kind)) {
          errors.push({ path: `${ePrefix}.kind`, message: `References unknown kind "${effect.kind}"` });
        }
        break;
      case "setText":
        if (!isCardRef(effect.card)) {
          errors.push({ path: `${ePrefix}.card`, message: 'Must be "context" or "target"' });
        }
        if (typeof effect.text !== "string") {
          errors.push({ path: `${ePrefix}.text`, message: "Must be a string" });
        }
        break;
      case "emit":
        if (typeof effect.event !== "string" || effect.event === "") {
          errors.push({ path: `${ePrefix}.event`, message: "Must be a non-empty string" });
        }
        if (effect.data !== undefined) {
          if (typeof effect.data !== "object" || effect.data === null || Array.isArray(effect.data)) {
            errors.push({ path: `${ePrefix}.data`, message: "Must be an object if provided" });
          }
        }
        break;
      default:
        errors.push({ path: `${ePrefix}.type`, message: `Unknown effect type "${type}"` });
    }
  }
}

function isCardRef(val: unknown): val is "context" | "target" {
  return val === "context" || val === "target";
}
