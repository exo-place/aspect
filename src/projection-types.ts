import type { KindStyle } from "./pack-types";

export interface PanelItem {
  cardId: string;
  text: string;
  kind?: string;
  kindStyle?: KindStyle;
}

export interface PanelDef {
  edgeTypeId: string | null;
  label: string;
  direction: "from" | "to";
  items: PanelItem[];
}

export interface ProjectionData {
  cardId: string;
  text: string;
  kind?: string;
  kindStyle?: KindStyle;
  panels: PanelDef[];
}
