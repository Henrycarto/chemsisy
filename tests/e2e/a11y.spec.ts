import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { figureReady, skipTour } from "./helpers.ts";

const PAGES = [
  { name: "home", path: "/", figures: 1 },
  { name: "drug", path: "/drug/amoxicillin?group=beta_lactam", figures: 1 },
  { name: "compare", path: "/compare/simvastatin/atorvastatin", figures: 2 },
  { name: "about", path: "/about", figures: 0 },
];

for (const scheme of ["light", "dark"] as const) {
  test.describe(`axe, ${scheme}`, () => {
    test.use({ colorScheme: scheme });
    for (const p of PAGES) {
      test(`${p.name} has no WCAG A or AA violations`, async ({ page }) => {
        await skipTour(page);
        await page.goto(p.path);
        for (let i = 0; i < p.figures; i++) await figureReady(page, i);
        const results = await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
          .analyze();
        const summary = results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(", ")}`);
        expect(summary).toEqual([]);
      });
    }
  });
}
