import { describe, expect, test } from "bun:test";
import * as Y from "yjs";
import { EventLog } from "../src/event-log";
import { createYDoc } from "../src/ydoc";
import type { ActionEvent } from "../src/action-types";

function makeEventLog() {
  const bundle = createYDoc();
  const log = new EventLog(bundle);
  return { bundle, log };
}

function makeEvent(overrides: Partial<ActionEvent> = {}): ActionEvent {
  return {
    timestamp: Date.now(),
    actor: "test-user",
    actionId: "test-action",
    event: "test-event",
    contextCardId: "card-a",
    targetCardId: "card-b",
    ...overrides,
  };
}

describe("EventLog", () => {
  describe("append and getAll", () => {
    test("starts empty", () => {
      const { log } = makeEventLog();
      expect(log.getAll()).toEqual([]);
    });

    test("appends and retrieves events", () => {
      const { log } = makeEventLog();
      const event = makeEvent();
      log.append(event);
      const all = log.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].actor).toBe("test-user");
      expect(all[0].actionId).toBe("test-action");
      expect(all[0].event).toBe("test-event");
    });

    test("appends multiple events in order", () => {
      const { log } = makeEventLog();
      log.append(makeEvent({ event: "first" }));
      log.append(makeEvent({ event: "second" }));
      log.append(makeEvent({ event: "third" }));
      const all = log.getAll();
      expect(all).toHaveLength(3);
      expect(all[0].event).toBe("first");
      expect(all[1].event).toBe("second");
      expect(all[2].event).toBe("third");
    });

    test("preserves data field", () => {
      const { log } = makeEventLog();
      log.append(makeEvent({ data: { score: 10, tag: "win" } }));
      const all = log.getAll();
      expect(all[0].data).toEqual({ score: 10, tag: "win" });
    });

    test("omits data when undefined", () => {
      const { log } = makeEventLog();
      log.append(makeEvent());
      const all = log.getAll();
      expect(all[0].data).toBeUndefined();
    });
  });

  describe("getRecent", () => {
    test("returns last N events", () => {
      const { log } = makeEventLog();
      log.append(makeEvent({ event: "a" }));
      log.append(makeEvent({ event: "b" }));
      log.append(makeEvent({ event: "c" }));
      const recent = log.getRecent(2);
      expect(recent).toHaveLength(2);
      expect(recent[0].event).toBe("b");
      expect(recent[1].event).toBe("c");
    });

    test("returns all when count exceeds length", () => {
      const { log } = makeEventLog();
      log.append(makeEvent({ event: "only" }));
      const recent = log.getRecent(5);
      expect(recent).toHaveLength(1);
      expect(recent[0].event).toBe("only");
    });

    test("returns empty when log is empty", () => {
      const { log } = makeEventLog();
      expect(log.getRecent(3)).toEqual([]);
    });
  });

  describe("onChange", () => {
    test("fires on append", () => {
      const { log } = makeEventLog();
      let called = false;
      log.onChange = () => { called = true; };
      log.append(makeEvent());
      expect(called).toBe(true);
    });
  });

  describe("CRDT sync", () => {
    test("events sync between two docs", () => {
      const bundle1 = createYDoc();
      const bundle2 = createYDoc();
      const log1 = new EventLog(bundle1);
      const log2 = new EventLog(bundle2);

      log1.append(makeEvent({ event: "from-peer-1" }));

      const update = Y.encodeStateAsUpdate(bundle1.doc);
      Y.applyUpdate(bundle2.doc, update);

      const all = log2.getAll();
      expect(all).toHaveLength(1);
      expect(all[0].event).toBe("from-peer-1");
    });
  });
});
