import * as Y from "yjs";
import type { YDocBundle } from "./ydoc";

export interface HistoryOptions {
  captureTimeout?: number;
}

export class History {
  private undoManager: Y.UndoManager;

  constructor(bundle: YDocBundle, options: HistoryOptions = {}) {
    const { captureTimeout = 500 } = options;
    this.undoManager = new Y.UndoManager([bundle.cards, bundle.edges, bundle.pack, bundle.events], {
      captureTimeout,
    });
  }

  /** No-op — Y.UndoManager auto-captures by transaction. */
  capture(): void {}

  undo(): boolean {
    if (!this.canUndo) return false;
    this.undoManager.undo();
    return true;
  }

  redo(): boolean {
    if (!this.canRedo) return false;
    this.undoManager.redo();
    return true;
  }

  get canUndo(): boolean {
    return this.undoManager.undoStack.length > 0;
  }

  get canRedo(): boolean {
    return this.undoManager.redoStack.length > 0;
  }
}
