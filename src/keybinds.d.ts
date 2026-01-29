declare module "keybinds" {
  export interface Command {
    id: string;
    label: string;
    category?: string;
    keys?: string[];
    mouse?: string[];
    menu?: string | string[];
    when?: (ctx: Record<string, unknown>) => boolean;
    execute: (ctx: Record<string, unknown>, event?: Event) => unknown;
    hidden?: boolean;
    captureInput?: boolean;
  }

  export interface BindingSchema {
    label: string;
    category?: string;
    keys?: string[];
    mouse?: string[];
    menu?: string | string[];
    hidden?: boolean;
  }

  export type Schema = Record<string, BindingSchema>;

  export function defineSchema<T extends Schema>(schema: T): T;

  export function fromBindings(
    bindings: Schema,
    handlers: Record<
      string,
      (ctx: Record<string, unknown>, event?: Event) => unknown
    >,
    options?: Record<
      string,
      {
        when?: (ctx: Record<string, unknown>) => boolean;
        captureInput?: boolean;
      }
    >,
  ): Command[];

  export function keybinds(
    commands: Command[],
    getContext?: () => Record<string, unknown>,
    options?: {
      target?: EventTarget;
      onExecute?: (cmd: Command, ctx: Record<string, unknown>) => void;
    },
  ): () => void;

  export function executeCommand(
    commands: Command[],
    id: string,
    context?: Record<string, unknown>,
  ): boolean;

  export function formatKeyParts(key: string): string[];

  export function registerComponents(): void;
}
