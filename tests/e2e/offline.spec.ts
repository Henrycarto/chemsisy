import { expect, test } from "@playwright/test";
import { figureReady, skipTour } from "./helpers.ts";

test.describe("offline", () => {
  test("after one visit, the starter set works with the network off", async ({ page, context }) => {
    await skipTour(page);
    await page.goto("/");
    // Wait for the service worker to take control and finish precaching.
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller) {
        await new Promise<void>((r) => navigator.serviceWorker.addEventListener("controllerchange", () => r(), { once: true }));
      }
      return reg.active?.state;
    });
    await page.reload();
    await expect(page.getByRole("heading", { name: "All drugs, by class" })).toBeVisible();

    await context.setOffline(true);

    // A drug the browser has never opened before: its data must come from the precache.
    await page.goto("/drug/pantoprazole");
    await expect(page.getByRole("heading", { level: 1, name: "Pantoprazole" })).toBeVisible();
    await figureReady(page);
    await expect(page.getByRole("button", { name: /Difluoromethoxy/ })).toBeVisible();

    await page.goto("/compare/omeprazole/pantoprazole");
    await expect(page.getByRole("heading", { name: "One core, two substituent patterns" })).toBeVisible();
    await figureReady(page, 1);

    // Search runs on the bundled index, so it works offline too.
    await page.goto("/");
    const search = page.getByRole("combobox", { name: "Search drugs" }).first();
    await search.fill("Sortis");
    await expect(page.getByRole("option", { name: /Atorvastatin/ })).toBeVisible();
    await context.setOffline(false);
  });
});
