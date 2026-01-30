import { test, expect } from "@playwright/test";
import { uniqueRoom, gotoRoom } from "./helpers";

test.describe("Tab Switching", () => {
  test("Build tab is active by default", async ({ page }) => {
    const room = uniqueRoom();
    await gotoRoom(page, room);

    const buildTab = page.locator(".tab-bar-btn", { hasText: "Build" });
    await expect(buildTab).toHaveClass(/active/);
    await expect(page.locator(".canvas")).toBeVisible();
  });

  test("clicking Experience tab shows projection view", async ({ page }) => {
    const room = uniqueRoom();
    await gotoRoom(page, room);

    // Click Experience tab
    const experienceTab = page.locator(".tab-bar-btn", { hasText: "Experience" });
    await experienceTab.click();

    await expect(experienceTab).toHaveClass(/active/);
    await expect(page.locator(".projection-view")).toBeVisible();
    // Canvas should be hidden
    await expect(page.locator(".canvas")).toBeHidden();
  });

  test("switching back to Build restores canvas", async ({ page }) => {
    const room = uniqueRoom();
    await gotoRoom(page, room);

    // Switch to Experience
    await page.locator(".tab-bar-btn", { hasText: "Experience" }).click();
    await expect(page.locator(".projection-view")).toBeVisible();

    // Switch back to Build
    await page.locator(".tab-bar-btn", { hasText: "Build" }).click();
    await expect(page.locator(".canvas")).toBeVisible();
    await expect(page.locator(".projection-view")).toBeHidden();
  });
});
