import { describe, expect, test } from "bun:test";
import { DebouncedSaver } from "../src/server/debounce";

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe("DebouncedSaver", () => {
  test("schedule calls onSave after delay", async () => {
    const calls: string[] = [];
    const saver = new DebouncedSaver(50, (name) => calls.push(name));

    saver.schedule("room1");
    expect(calls).toEqual([]);

    await wait(80);
    expect(calls).toEqual(["room1"]);

    saver.destroy();
  });

  test("repeated schedule resets timer (single callback)", async () => {
    const calls: string[] = [];
    const saver = new DebouncedSaver(50, (name) => calls.push(name));

    saver.schedule("room1");
    await wait(30);
    saver.schedule("room1"); // reset
    await wait(30);
    expect(calls).toEqual([]); // still waiting

    await wait(40);
    expect(calls).toEqual(["room1"]); // fired once

    saver.destroy();
  });

  test("flush fires immediately and cancels timer", async () => {
    const calls: string[] = [];
    const saver = new DebouncedSaver(500, (name) => calls.push(name));

    saver.schedule("room1");
    saver.flush("room1");
    expect(calls).toEqual(["room1"]);

    // Should not fire again
    await wait(600);
    expect(calls).toEqual(["room1"]);

    saver.destroy();
  });

  test("flush is no-op if nothing pending", () => {
    const calls: string[] = [];
    const saver = new DebouncedSaver(50, (name) => calls.push(name));

    saver.flush("room1"); // no-op
    expect(calls).toEqual([]);

    saver.destroy();
  });

  test("destroy cancels all pending timers", async () => {
    const calls: string[] = [];
    const saver = new DebouncedSaver(50, (name) => calls.push(name));

    saver.schedule("room1");
    saver.schedule("room2");
    saver.destroy();

    await wait(80);
    expect(calls).toEqual([]);
  });

  test("independent rooms have independent timers", async () => {
    const calls: string[] = [];
    const saver = new DebouncedSaver(50, (name) => calls.push(name));

    saver.schedule("room1");
    await wait(30);
    saver.schedule("room2");
    await wait(30);

    // room1 should have fired, room2 still pending
    expect(calls).toEqual(["room1"]);

    await wait(40);
    expect(calls).toEqual(["room1", "room2"]);

    saver.destroy();
  });
});
