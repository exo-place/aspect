import { test, expect } from "@playwright/test";
import { uniqueRoom, gotoRoom, cardCount } from "./helpers";

test.describe("Persistence", () => {
  test("page reload preserves cards", async ({ page }) => {
    const room = uniqueRoom();
    await gotoRoom(page, room);

    // Wait for bootstrap card
    await page.waitForSelector(".card", { timeout: 10_000 });
    const count = await cardCount(page);
    expect(count).toBeGreaterThan(0);

    // Wait for persistence (debounced save is 2s)
    await page.waitForTimeout(3000);

    // Reload the page
    await page.reload();
    await page.waitForSelector(".card", { timeout: 15_000 });

    // Cards should still be there
    const countAfterReload = await cardCount(page);
    expect(countAfterReload).toBe(count);
  });

  test("new session sees server-persisted data", async ({ browser }) => {
    const room = uniqueRoom();

    // Session 1: create and wait for persistence
    const ctx1 = await browser.newContext();
    const page1 = await ctx1.newPage();
    await gotoRoom(page1, room);
    await page1.waitForSelector(".card", { timeout: 10_000 });
    const count = await cardCount(page1);

    // Wait for server persistence
    await page1.waitForTimeout(3000);
    await ctx1.close();

    // Session 2: separate browser context, should see the persisted data
    const ctx2 = await browser.newContext();
    const page2 = await ctx2.newPage();
    await gotoRoom(page2, room);
    await page2.waitForSelector(".card", { timeout: 15_000 });

    const countInSession2 = await cardCount(page2);
    expect(countInSession2).toBe(count);

    await ctx2.close();
  });

  test("REST API reflects room", async ({ page }) => {
    const room = uniqueRoom();
    await gotoRoom(page, room);

    // Wait for the room to be registered on the server
    await page.waitForSelector(".card", { timeout: 10_000 });
    // Wait for WebSocket sync and server-side persistence
    await page.waitForTimeout(3000);

    // y-websocket appends room name to URL, so server sees "roomName/roomName"
    // Query the room list API and check our room appears
    const result = await page.evaluate(async (roomName) => {
      const res = await fetch("/api/rooms");
      const data = await res.json();
      // Room key includes the y-websocket provider path: "name/name"
      return data.rooms.some((r: { name: string }) => r.name.includes(roomName));
    }, room);

    expect(result).toBe(true);
  });
});
