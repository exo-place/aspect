import type { Page } from "@playwright/test";

let roomCounter = 0;

export function uniqueRoom(): string {
  return `e2e-room-${Date.now()}-${roomCounter++}`;
}

export async function gotoRoom(page: Page, roomName: string): Promise<void> {
  await page.goto(`/room/${roomName}`);
  // Wait for the app to initialize (canvas or projection view must be present)
  await page.waitForSelector(".canvas, .projection-view", { timeout: 15_000 });
}

export async function waitForCard(page: Page, text: string): Promise<void> {
  await page.waitForFunction(
    (t: string) => {
      const cards = document.querySelectorAll(".card");
      for (const card of cards) {
        if (card.textContent?.includes(t)) return true;
      }
      return false;
    },
    text,
    { timeout: 10_000 },
  );
}

export async function cardCount(page: Page): Promise<number> {
  return page.locator(".card").count();
}
