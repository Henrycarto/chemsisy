import { expect, test } from "@playwright/test";
import { figureReady, skipTour } from "./helpers.ts";

test.describe("tooltips", () => {
  test("open on hover, on keyboard focus and close with Escape; screen readers get them", async ({ page, isMobile }) => {
    test.skip(isMobile, "hover is a desktop interaction");
    await skipTour(page);
    await page.goto("/drug/amoxicillin");
    const theme = page.getByRole("button", { name: /Switch to the (dark|light) theme/ });

    await theme.hover();
    const tip = page.getByRole("tooltip");
    await expect(tip).toBeVisible();
    await expect(tip).toContainText(/Switch to the/);
    await page.mouse.move(0, 400);
    await expect(tip).toBeHidden();

    // Keyboard focus opens it and wires aria-describedby to the tooltip.
    await page.keyboard.press("Tab");
    await theme.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(tip).toBeVisible();
    const id = await tip.getAttribute("id");
    await expect(theme).toHaveAttribute("aria-describedby", id!);
    await page.keyboard.press("Escape");
    await expect(tip).toBeHidden();
  });

  test("a chemistry term explains itself, with its source", async ({ page, isMobile }) => {
    test.skip(isMobile, "covered by the tap test");
    await skipTour(page);
    await page.goto("/drug/amoxicillin");
    await page.getByRole("button", { name: "ATC", exact: true }).hover();
    await expect(page.getByRole("tooltip")).toContainText("Source:");
  });

  test("open on tap on a touch screen", async ({ page, isMobile }) => {
    test.skip(!isMobile, "touch only");
    await skipTour(page);
    await page.goto("/drug/amoxicillin");
    await page.getByRole("button", { name: "ATC", exact: true }).tap();
    await expect(page.getByRole("tooltip")).toBeVisible();
    await page.getByRole("heading", { level: 1 }).tap();
    await expect(page.getByRole("tooltip")).toBeHidden();
  });
});

test.describe("first-visit tour", () => {
  test("appears once, can be skipped, and the ? button brings it back", async ({ page }) => {
    await page.goto("/");
    const tour = page.getByRole("dialog");
    await expect(tour).toBeVisible();
    await expect(tour).toContainText("Step 1 of 5");
    await tour.getByRole("button", { name: "Next" }).click();
    await expect(tour).toContainText("Step 2 of 5");
    await tour.getByRole("button", { name: "Skip tour" }).click();
    await expect(tour).toBeHidden();

    await page.reload();
    await page.waitForTimeout(1200);
    await expect(page.getByRole("dialog")).toBeHidden();

    await page.getByRole("button", { name: "Open the tour" }).click();
    await expect(page.getByRole("dialog")).toContainText("Step 1 of 5");
    await page.keyboard.press("Escape");
    await expect(page.getByRole("dialog")).toBeHidden();
  });
});

test.describe("keyboard control of the viewer", () => {
  test("rotate, zoom, step through groups and clear the focus", async ({ page, isMobile }) => {
    test.skip(isMobile, "keyboard test runs on desktop");
    await skipTour(page);
    await page.goto("/drug/omeprazole");
    await figureReady(page);
    const figure = page.getByRole("application", { name: /3D model of Omeprazole/ });
    await expect(figure).toHaveAttribute("aria-label", /Arrow keys rotate/);
    await figure.focus();

    // The first group with a note is open; ] moves to the next one and the list follows.
    const open = () => page.locator(".group.is-open .gname").textContent();
    const first = await open();
    await page.keyboard.press("]");
    await expect.poll(open).not.toBe(first);
    await expect(page.locator("[aria-live='polite']").filter({ hasText: "in focus" })).toHaveCount(1);
    await page.keyboard.press("[");
    await expect.poll(open).toBe(first);

    // Rotation and zoom change the camera; the canvas redraws.
    const shot = async () => (await figure.screenshot()).toString("base64");
    const before = await shot();
    await page.keyboard.press("ArrowRight");
    await page.keyboard.press("+");
    await page.waitForTimeout(400);
    expect(await shot()).not.toBe(before);

    await page.keyboard.press("Escape");
    await expect(page.locator(".group.is-open")).toHaveCount(0);
  });

  test("the table is a text alternative with every group and its atoms", async ({ page }) => {
    await skipTour(page);
    await page.goto("/drug/amoxicillin");
    await page.getByRole("button", { name: /Table/ }).click();
    const table = page.getByRole("table", { name: /Functional groups of amoxicillin/ });
    await expect(table).toBeVisible();
    await expect(table.getByRole("row")).toHaveCount(7);
    await expect(table).toContainText("β-lactam ring");
  });
});

test.describe("search and pages", () => {
  test("brand search opens the drug, with its product information link", async ({ page }) => {
    await skipTour(page);
    await page.goto("/");
    const search = page.getByRole("combobox", { name: "Search drugs" }).first();
    await search.fill("Voltarn");
    await expect(page.getByRole("option", { name: /Diclofenac/ })).toBeVisible();
    await search.press("Enter");
    await expect(page).toHaveURL(/\/drug\/diclofenac/);
    const product = page.getByRole("link", { name: /Product information/ }).first();
    await expect(product).toHaveAttribute("href", /medikamente\.basg\.gv\.at\/documents\/1-16506__DOTC_FACH_INFO\.pdf/);
  });

  test("every note has a source link and an honest review status", async ({ page }) => {
    await skipTour(page);
    await page.goto("/drug/amoxicillin?group=beta_lactam");
    const note = page.getByRole("region", { name: /β-lactam ring note/ });
    await expect(note.getByRole("link").first()).toHaveAttribute("href", /^https:\/\//);
    await expect(note.getByRole("button", { name: "Sourced, not yet reviewed" })).toBeVisible();
  });

  test("the about page says it is not medical advice", async ({ page }) => {
    await skipTour(page);
    await page.goto("/about");
    await expect(page.getByText("For education. Not medical advice.").first()).toBeVisible();
  });
});
