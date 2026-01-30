import type { KindStyle } from "./pack-types";

/** A single available action on a specific target card */
export interface Affordance {
  actionId: string;
  actionLabel: string;
  actionDescription?: string;
  targetCardId: string;
  targetText: string;
  targetKind?: string;
  targetKindStyle?: KindStyle;
}
