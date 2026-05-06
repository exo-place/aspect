export interface KindStyle {
  color?: string;
  icon?: string;
}

export interface KindDef {
  id: string;
  label: string;
  style?: KindStyle;
  fields?: Record<string, unknown>;
}

export interface EdgeTypeConstraint {
  from?: string[];
  to?: string[];
}

export interface EdgeTypeDef {
  id: string;
  label: string;
  constraint?: EdgeTypeConstraint;
}

export interface WorldPack {
  packId: string;
  packVersion: number;
  name: string;
  description?: string;
  kinds: KindDef[];
  edgeTypes: EdgeTypeDef[];
  actions?: import("./action-types").ActionDef[];
  fieldNames?: string[];
}
