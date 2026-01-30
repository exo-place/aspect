import { test, expect } from "@playwright/test";
import { uniqueRoom } from "./helpers";

test.describe("Lobby", () => {
  test("shows heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("h1")).toHaveText("Aspect");
  });

  test("create form navigates to room", async ({ page }) => {
    const roomName = uniqueRoom();
    await page.goto("/");
    await page.fill("#room-input", roomName);
    await page.click("#create-btn");
    await page.waitForURL(`**/room/${roomName}`);
    expect(page.url()).toContain(`/room/${roomName}`);
  });

  test("room appears in list after creation", async ({ page }) => {
    const roomName = uniqueRoom();

    // Visit the room to create it (server persistence creates on connect)
    await page.goto(`/room/${roomName}`);
    await page.waitForSelector(".canvas, .projection-view", { timeout: 15_000 });

    // Wait for WebSocket sync to persist
    await page.waitForTimeout(3000);

    // Go back to lobby
    await page.goto("/");
    await page.waitForSelector(".room-list");

    // Room should appear in the list
    await expect(page.locator(".room-link", { hasText: roomName })).toBeVisible({ timeout: 5_000 });
  });
});
