export interface ActionTargetDef {
  kind?: string;
  edgeType?: string;
  direction?: "from" | "to";
}

export interface ActionDef {
  id: string;
  label: string;
  description?: string;
  context: { kind?: string };
  target: ActionTargetDef;
  trigger?: "affordance" | "combine" | "both";
  run: unknown;
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
