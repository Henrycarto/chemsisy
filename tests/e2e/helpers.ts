import type { Page } from "@playwright/test";

/** Skip the first-visit tour unless a test is about the tour. */
export async function skipTour(page: Page) {
  await page.addInitScript(() => {
    try { localStorage.setItem("chemsisy.tour.v1", "done"); } catch { /* storage blocked */ }
  });
}

/** Wait until a molecule figure has drawn its labels. */
export async function figureReady(page: Page, nth = 0) {
  await page.locator(".figure-stage[data-labels-placed]").nth(nth).waitFor({ timeout: 30_000 });
}
