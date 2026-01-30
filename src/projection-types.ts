import type { KindStyle } from "./pack-types";
import type { Affordance } from "./affordance-types";

export interface PanelItem {
  cardId: string;
  text: string;
  kind?: string;
  kindStyle?: KindStyle;
  affordances?: Affordance[];
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
  extraAffordances?: Affordance[];
}
