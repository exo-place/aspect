import * as Y from "yjs";
import type { YDocBundle } from "./ydoc";
import type { ActionEvent } from "./action-types";

export class EventLog {
  private events: Y.Array<Y.Map<unknown>>;
  private doc: Y.Doc;

  onChange: (() => void) | null = null;

  constructor(bundle: YDocBundle) {
    this.doc = bundle.doc;
    this.events = bundle.events;

    this.events.observe(() => {
      this.onChange?.();
    });
  }

  append(event: ActionEvent): void {
    this.doc.transact(() => {
      const yEvent = new Y.Map<unknown>();
      yEvent.set("timestamp", event.timestamp);
      yEvent.set("actor", event.actor);
      yEvent.set("actionId", event.actionId);
      yEvent.set("event", event.event);
      yEvent.set("contextCardId", event.contextCardId);
      yEvent.set("targetCardId", event.targetCardId);
      if (event.data !== undefined) {
        yEvent.set("data", JSON.stringify(event.data));
      }
      this.events.push([yEvent]);
    });
  }

  getAll(): ActionEvent[] {
    const result: ActionEvent[] = [];
    for (const yEvent of this.events) {
      result.push(this.materialize(yEvent));
    }
    return result;
  }

  getRecent(count: number): ActionEvent[] {
    const len = this.events.length;
    const start = Math.max(0, len - count);
    const result: ActionEvent[] = [];
    for (let i = start; i < len; i++) {
      result.push(this.materialize(this.events.get(i)));
    }
    return result;
  }

  private materialize(yEvent: Y.Map<unknown>): ActionEvent {
    const event: ActionEvent = {
      timestamp: yEvent.get("timestamp") as number,
      actor: yEvent.get("actor") as string,
      actionId: yEvent.get("actionId") as string,
      event: yEvent.get("event") as string,
      contextCardId: yEvent.get("contextCardId") as string,
      targetCardId: yEvent.get("targetCardId") as string,
    };
    const dataStr = yEvent.get("data") as string | undefined;
    if (dataStr !== undefined) {
      event.data = JSON.parse(dataStr);
    }
    return event;
  }
}
