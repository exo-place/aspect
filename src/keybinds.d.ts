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

  export type BindingOverrides = Record<
    string,
    { keys?: string[]; mouse?: string[] }
  >;

  export type Matcher = (
    query: string,
    text: string,
  ) => { score: number; positions?: number[] } | null;

  export function defineSchema<T extends Schema>(schema: T): T;

  export function mergeBindings(
    schema: Schema,
    overrides: BindingOverrides,
  ): Schema;

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

  export function searchCommands(
    commands: Command[],
    query: string,
    context?: Record<string, unknown>,
    options?: { matcher?: Matcher },
  ): (Command & { active: boolean; score: number; positions?: number[] })[];

  export function groupByCategory(
    commands: Command[],
    context?: Record<string, unknown>,
  ): Record<string, (Command & { active: boolean })[]>;

  export function filterByMenu(
    commands: Command[],
    menu: string,
    context?: Record<string, unknown>,
  ): (Command & { active: boolean })[];

  export function validateCommands(commands: Command[]): true;

  export function executeCommand(
    commands: Command[],
    id: string,
    context?: Record<string, unknown>,
  ): boolean;

  export function formatKeyParts(key: string): string[];
  export function formatMouseParts(binding: string): string[];

  export function listBindings(
    schema: Schema,
  ): (BindingSchema & { id: string })[];

  export function eventToBindingString(event: KeyboardEvent): string | null;
  export function eventToMouseBindingString(event: MouseEvent): string | null;

  export function findConflict(
    schema: Schema,
    bindingStr: string,
    type: "keys" | "mouse",
    excludeId?: string,
  ): { commandId: string; label: string } | null;

  export class BindingsStore<T extends Schema = Schema> extends EventTarget {
    schema: T;
    storageKey: string;
    constructor(schema: T, storageKey: string);
    get(): T;
    getOverrides(): BindingOverrides;
    save(newOverrides: BindingOverrides): void;
  }

  export function onModifierHold(
    modifiers: string | string[],
    callback: (held: boolean) => void,
    options?: { delay?: number; target?: EventTarget },
  ): () => void;

  export const simpleMatcher: Matcher;
  export const fuzzyMatcher: Matcher;

  export function registerComponents(): void;

  export default keybinds;
}
