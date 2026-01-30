import * as Y from "yjs";
import type { YDocBundle } from "./ydoc";
import type {
  WorldPack,
  KindDef,
  EdgeTypeDef,
  KindStyle,
} from "./pack-types";
import type { ActionDef } from "./action-types";
import { validateWorldPack } from "./pack-validate";

export type PackChangeCallback = () => void;

export class WorldPackStore {
  private packMap: Y.Map<unknown>;
  private doc: Y.Doc;

  onChange: PackChangeCallback | null = null;

  constructor(bundle: YDocBundle) {
    this.doc = bundle.doc;
    this.packMap = bundle.pack;

    this.packMap.observeDeep(() => {
      this.onChange?.();
    });
  }

  get isLoaded(): boolean {
    return this.packMap.has("packId");
  }

  get(): WorldPack | null {
    if (!this.isLoaded) return null;

    const kinds: KindDef[] = [];
    const yKinds = this.packMap.get("kinds") as Y.Array<Y.Map<unknown>> | undefined;
    if (yKinds) {
      for (const yKind of yKinds) {
        const style: KindStyle = {};
        const color = yKind.get("color") as string | undefined;
        const icon = yKind.get("icon") as string | undefined;
        if (color !== undefined) style.color = color;
        if (icon !== undefined) style.icon = icon;
        kinds.push({
          id: yKind.get("id") as string,
          label: yKind.get("label") as string,
          ...(Object.keys(style).length > 0 ? { style } : {}),
        });
      }
    }

    const edgeTypes: EdgeTypeDef[] = [];
    const yEdgeTypes = this.packMap.get("edgeTypes") as Y.Array<Y.Map<unknown>> | undefined;
    if (yEdgeTypes) {
      for (const yET of yEdgeTypes) {
        const def: EdgeTypeDef = {
          id: yET.get("id") as string,
          label: yET.get("label") as string,
        };
        const fromKinds = yET.get("fromKinds") as string[] | undefined;
        const toKinds = yET.get("toKinds") as string[] | undefined;
        if (fromKinds || toKinds) {
          def.constraint = {};
          if (fromKinds) def.constraint.from = fromKinds;
          if (toKinds) def.constraint.to = toKinds;
        }
        edgeTypes.push(def);
      }
    }

    const pack: WorldPack = {
      packId: this.packMap.get("packId") as string,
      packVersion: this.packMap.get("packVersion") as number,
      name: this.packMap.get("name") as string,
      kinds,
      edgeTypes,
    };
    const description = this.packMap.get("description") as string | undefined;
    if (description !== undefined) pack.description = description;

    const yActions = this.packMap.get("actions") as Y.Array<Y.Map<unknown>> | undefined;
    if (yActions && yActions.length > 0) {
      const actions: ActionDef[] = [];
      for (const yAction of yActions) {
        actions.push({
          id: yAction.get("id") as string,
          label: yAction.get("label") as string,
          ...(yAction.get("description") !== undefined ? { description: yAction.get("description") as string } : {}),
          context: JSON.parse(yAction.get("context") as string),
          target: JSON.parse(yAction.get("target") as string),
          ...(yAction.get("when") !== undefined ? { when: JSON.parse(yAction.get("when") as string) } : {}),
          do: JSON.parse(yAction.get("do") as string),
        });
      }
      pack.actions = actions;
    }

    return pack;
  }

  load(pack: WorldPack): void {
    const result = validateWorldPack(pack);
    if (!result.valid) {
      const messages = result.errors.map((e) => `${e.path}: ${e.message}`);
      throw new Error(`Invalid world pack:\n${messages.join("\n")}`);
    }
    this.doc.transact(() => {
      // Clear existing
      this.packMap.forEach((_, key) => this.packMap.delete(key));

      this.packMap.set("packId", pack.packId);
      this.packMap.set("packVersion", pack.packVersion);
      this.packMap.set("name", pack.name);
      if (pack.description !== undefined) {
        this.packMap.set("description", pack.description);
      }

      const yKinds = new Y.Array<Y.Map<unknown>>();
      for (const kind of pack.kinds) {
        const yKind = new Y.Map<unknown>();
        yKind.set("id", kind.id);
        yKind.set("label", kind.label);
        if (kind.style?.color !== undefined) yKind.set("color", kind.style.color);
        if (kind.style?.icon !== undefined) yKind.set("icon", kind.style.icon);
        yKinds.push([yKind]);
      }
      this.packMap.set("kinds", yKinds);

      const yEdgeTypes = new Y.Array<Y.Map<unknown>>();
      for (const et of pack.edgeTypes) {
        const yET = new Y.Map<unknown>();
        yET.set("id", et.id);
        yET.set("label", et.label);
        if (et.constraint?.from) yET.set("fromKinds", et.constraint.from);
        if (et.constraint?.to) yET.set("toKinds", et.constraint.to);
        yEdgeTypes.push([yET]);
      }
      this.packMap.set("edgeTypes", yEdgeTypes);

      if (pack.actions && pack.actions.length > 0) {
        const yActions = new Y.Array<Y.Map<unknown>>();
        for (const action of pack.actions) {
          const yAction = new Y.Map<unknown>();
          yAction.set("id", action.id);
          yAction.set("label", action.label);
          if (action.description !== undefined) yAction.set("description", action.description);
          yAction.set("context", JSON.stringify(action.context));
          yAction.set("target", JSON.stringify(action.target));
          if (action.when !== undefined) yAction.set("when", JSON.stringify(action.when));
          yAction.set("do", JSON.stringify(action.do));
          yActions.push([yAction]);
        }
        this.packMap.set("actions", yActions);
      }
    });
  }

  clear(): void {
    this.doc.transact(() => {
      this.packMap.forEach((_, key) => this.packMap.delete(key));
    });
  }

  getKind(id: string): KindDef | undefined {
    const yKinds = this.packMap.get("kinds") as Y.Array<Y.Map<unknown>> | undefined;
    if (!yKinds) return undefined;
    for (const yKind of yKinds) {
      if (yKind.get("id") === id) {
        const style: KindStyle = {};
        const color = yKind.get("color") as string | undefined;
        const icon = yKind.get("icon") as string | undefined;
        if (color !== undefined) style.color = color;
        if (icon !== undefined) style.icon = icon;
        return {
          id: yKind.get("id") as string,
          label: yKind.get("label") as string,
          ...(Object.keys(style).length > 0 ? { style } : {}),
        };
      }
    }
    return undefined;
  }

  getEdgeType(id: string): EdgeTypeDef | undefined {
    const yEdgeTypes = this.packMap.get("edgeTypes") as Y.Array<Y.Map<unknown>> | undefined;
    if (!yEdgeTypes) return undefined;
    for (const yET of yEdgeTypes) {
      if (yET.get("id") === id) {
        const def: EdgeTypeDef = {
          id: yET.get("id") as string,
          label: yET.get("label") as string,
        };
        const fromKinds = yET.get("fromKinds") as string[] | undefined;
        const toKinds = yET.get("toKinds") as string[] | undefined;
        if (fromKinds || toKinds) {
          def.constraint = {};
          if (fromKinds) def.constraint.from = fromKinds;
          if (toKinds) def.constraint.to = toKinds;
        }
        return def;
      }
    }
    return undefined;
  }

  kindIds(): string[] {
    const yKinds = this.packMap.get("kinds") as Y.Array<Y.Map<unknown>> | undefined;
    if (!yKinds) return [];
    const ids: string[] = [];
    for (const yKind of yKinds) {
      ids.push(yKind.get("id") as string);
    }
    return ids;
  }

  getAction(id: string): ActionDef | undefined {
    const yActions = this.packMap.get("actions") as Y.Array<Y.Map<unknown>> | undefined;
    if (!yActions) return undefined;
    for (const yAction of yActions) {
      if (yAction.get("id") === id) {
        return {
          id: yAction.get("id") as string,
          label: yAction.get("label") as string,
          ...(yAction.get("description") !== undefined ? { description: yAction.get("description") as string } : {}),
          context: JSON.parse(yAction.get("context") as string),
          target: JSON.parse(yAction.get("target") as string),
          ...(yAction.get("when") !== undefined ? { when: JSON.parse(yAction.get("when") as string) } : {}),
          do: JSON.parse(yAction.get("do") as string),
        };
      }
    }
    return undefined;
  }

  validateEdge(typeId: string, fromKind?: string, toKind?: string): boolean {
    const edgeType = this.getEdgeType(typeId);
    if (!edgeType) return false;
    if (!edgeType.constraint) return true;

    if (edgeType.constraint.from) {
      if (fromKind === undefined) return true; // untyped cards pass through
      if (!edgeType.constraint.from.includes(fromKind)) return false;
    }
    if (edgeType.constraint.to) {
      if (toKind === undefined) return true; // untyped cards pass through
      if (!edgeType.constraint.to.includes(toKind)) return false;
    }
    return true;
  }
}
