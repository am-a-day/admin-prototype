import { expect, test, type Page } from "@playwright/test";

const scenarios = [
  "default",
  "discount-kbju",
  "saving",
  "validation",
  "long-content",
] as const;

async function openScenario(
  page: Page,
  scenario: (typeof scenarios)[number],
  viewport: { width: number; height: number },
) {
  await page.setViewportSize(viewport);
  await page.goto(`/__design/position-editor/${scenario}`);
  await expect(page.locator(`[data-design-lab-scenario="${scenario}"]`)).toBeVisible();
  await expect(page.locator("[data-position-editor-surface]")).toBeVisible();
  await expect(page.locator("[data-position-editor-pane]")).toHaveAttribute("data-position-editor-state", "open");
  await expect(page.locator("[data-position-detail-pane]")).toBeVisible();
  await expect(page.getByRole("button", { name: "Основное", exact: true })).toBeVisible();
}

for (const scenario of scenarios) {
  test(`loads the ${scenario} Position Editor fixture deterministically`, async ({ page }) => {
    await openScenario(page, scenario, { width: 1440, height: 900 });

    if (scenario === "saving") {
      test.setTimeout(25_000);
      const savingStatus = page.locator('[data-position-save-status][data-save-status="saving"]');
      await expect(savingStatus).toContainText("Сохранение…");
      await page.waitForTimeout(10_250);
      await expect(savingStatus).toBeVisible();
    }

    if (scenario === "validation") {
      await expect(page.locator('[data-position-editor-validation="invalid"]')).toBeVisible();
      await expect(page.getByRole("alert")).toContainText("Введите название позиции");
    }

    await page.reload();
    await expect(page.locator(`[data-design-lab-scenario="${scenario}"]`)).toBeVisible();
    await expect(page.locator("[data-position-editor-pane]")).toBeVisible();
  });
}

for (const scenario of ["default", "discount-kbju"] as const) {
  test(`uses the production compact width for ${scenario}`, async ({ page }) => {
    await openScenario(page, scenario, { width: 1280, height: 800 });
    await expect(page.locator("[data-position-editor-pane]")).toHaveCSS("width", "400px");
  });
}

test("uses the production desktop width", async ({ page }) => {
  await openScenario(page, "default", { width: 1440, height: 900 });
  await expect(page.locator("[data-position-editor-pane]")).toHaveCSS("width", "470px");
});

test("isolates the fixture from a persisted production Side Peek width", async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.setItem("tasko.catalog.positionSidePeek.width.v1", "600");
  });

  await openScenario(page, "default", { width: 1440, height: 900 });
  await expect(page.locator("[data-position-editor-pane]")).toHaveCSS("width", "470px");
  await expect.poll(() => page.evaluate(
    () => window.localStorage.getItem("tasko.catalog.positionSidePeek.width.v1"),
  )).toBe("600");
});
