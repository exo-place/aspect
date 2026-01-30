import { test, expect } from "@playwright/test";
import { uniqueRoom, gotoRoom, cardCount } from "./helpers";

test.describe("Graph Editor", () => {
  test("room loads with graph editor visible", async ({ page }) => {
    const room = uniqueRoom();
    await gotoRoom(page, room);
    await expect(page.locator(".canvas")).toBeVisible();
  });

  test("double-click canvas creates a card", async ({ page }) => {
    const room = uniqueRoom();
    await gotoRoom(page, room);

    const initialCount = await cardCount(page);

    // Double-click on the canvas area
    const canvas = page.locator(".canvas");
    const box = await canvas.boundingBox();
    if (!box) throw new Error("Canvas not found");
    await page.mouse.dblclick(box.x + box.width / 2, box.y + box.height / 2);

    // Should have one more card
    await expect(page.locator(".card")).toHaveCount(initialCount + 1, { timeout: 5_000 });
  });

  test("double-click card opens editor", async ({ page }) => {
    const room = uniqueRoom();
    await gotoRoom(page, room);

    // Wait for bootstrap card
    const card = page.locator(".card").first();
    await card.waitFor({ state: "visible", timeout: 10_000 });

    // Use dispatchEvent to directly fire dblclick on the card element
    await card.dispatchEvent("dblclick");

    // The card-editor textarea should appear
    await expect(page.locator(".card-editor")).toBeVisible({ timeout: 5_000 });
  });

  test("click selects card", async ({ page }) => {
    const room = uniqueRoom();
    await gotoRoom(page, room);

    await page.waitForSelector(".card", { timeout: 10_000 });
    const card = page.locator(".card").first();
    await card.click();

    // Selected card gets the "selected" class
    await expect(card).toHaveClass(/selected/, { timeout: 3_000 });
  });
});
