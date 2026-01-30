import { test, expect } from "@playwright/test";
import { uniqueRoom, gotoRoom, cardCount } from "./helpers";

test.describe("Multiplayer", () => {
  test("card creation syncs between two contexts", async ({ browser }) => {
    const room = uniqueRoom();

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await gotoRoom(page1, room);
    await gotoRoom(page2, room);

    // Both should see the bootstrap card
    await page1.waitForSelector(".card", { timeout: 10_000 });
    await page2.waitForSelector(".card", { timeout: 10_000 });

    const initialCount = await cardCount(page2);

    // Create a card in page1 by double-clicking the canvas
    const canvas = page1.locator(".canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    await page1.mouse.dblclick(box.x + 200, box.y + 200);

    // Page1 should get a new card
    await expect(page1.locator(".card")).toHaveCount(initialCount + 1, { timeout: 5_000 });

    // Page2 should also see the new card (via WebSocket sync)
    await expect(page2.locator(".card")).toHaveCount(initialCount + 1, { timeout: 10_000 });

    await ctx1.close();
    await ctx2.close();
  });

  test("text edit syncs between two contexts", async ({ browser }) => {
    const room = uniqueRoom();

    const ctx1 = await browser.newContext();
    const ctx2 = await browser.newContext();
    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    await gotoRoom(page1, room);
    await gotoRoom(page2, room);

    // Wait for bootstrap card
    await page1.waitForSelector(".card", { timeout: 10_000 });
    await page2.waitForSelector(".card", { timeout: 10_000 });

    // Dispatch dblclick directly on the card element
    const card1 = page1.locator(".card").first();
    await card1.dispatchEvent("dblclick");

    // Type new text into the card editor
    const editor = page1.locator(".card-editor");
    await editor.waitFor({ state: "visible", timeout: 5_000 });
    await editor.fill("Synced text");
    await editor.press("Enter");

    // Wait for sync, then check page2
    await page2.waitForFunction(
      () => {
        const cards = document.querySelectorAll(".card");
        for (const card of cards) {
          if (card.textContent?.includes("Synced text")) return true;
        }
        return false;
      },
      { timeout: 10_000 },
    );

    await ctx1.close();
    await ctx2.close();
  });
});
