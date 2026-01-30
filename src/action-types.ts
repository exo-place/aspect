export type CardRef = "context" | "target";

export interface ActionTargetDef {
  kind?: string;
  edgeType?: string;
  direction?: "from" | "to";
}

export type ActionEffect =
  | { type: "addEdge"; from: CardRef; to: CardRef; edgeType?: string; label?: string }
  | { type: "removeEdge"; from: CardRef; to: CardRef; edgeType?: string }
  | { type: "setKind"; card: CardRef; kind: string | null }
  | { type: "setText"; card: CardRef; text: string }
  | { type: "emit"; event: string; data?: Record<string, unknown> };

export type JsonLogic = unknown;

export interface ActionDef {
  id: string;
  label: string;
  description?: string;
  context: { kind?: string };
  target: ActionTargetDef;
  when?: JsonLogic;
  do: ActionEffect[];
}

export interface ActionData {
  context: { id: string; text: string; kind: string | null };
  target: { id: string; text: string; kind: string | null };
  edgesFromContextToTarget: Array<{ type?: string; label?: string }>;
  edgesFromTargetToContext: Array<{ type?: string; label?: string }>;
  contextEdgesFrom: Array<{ to: string; toKind?: string; type?: string }>;
  contextEdgesTo: Array<{ from: string; fromKind?: string; type?: string }>;
  targetEdgesFrom: Array<{ to: string; toKind?: string; type?: string }>;
  targetEdgesTo: Array<{ from: string; fromKind?: string; type?: string }>;
  sharedNeighbors: Array<{ id: string; kind?: string }>;
}

export interface ActionResult {
  success: boolean;
  events: ActionEvent[];
}

export interface ActionEvent {
  timestamp: number;
  actor: string;
  actionId: string;
  event: string;
  contextCardId: string;
  targetCardId: string;
  data?: Record<string, unknown>;
}
