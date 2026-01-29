import type { CardGraph } from "./graph";
import type { CardGraphData } from "./types";

const DEFAULT_MAX = 100;

export class History {
  private undoStack: CardGraphData[] = [];
  private redoStack: CardGraphData[] = [];
  private max: number;
  private graph: CardGraph;

  constructor(graph: CardGraph, max = DEFAULT_MAX) {
    this.graph = graph;
    this.max = max;
  }

  /** Call before a mutation to snapshot the current state. */
  capture(): void {
    this.undoStack.push(this.graph.toJSON());
    if (this.undoStack.length > this.max) {
      this.undoStack.shift();
    }
    this.redoStack.length = 0;
  }

  undo(): boolean {
    const snapshot = this.undoStack.pop();
    if (!snapshot) return false;
    this.redoStack.push(this.graph.toJSON());
    this.graph.loadJSON(snapshot);
    return true;
  }

  redo(): boolean {
    const snapshot = this.redoStack.pop();
    if (!snapshot) return false;
    this.undoStack.push(this.graph.toJSON());
    this.graph.loadJSON(snapshot);
    return true;
  }

  get canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.redoStack.length > 0;
  }
}
