import { mkdir } from "node:fs/promises";
import { expect, test, type Page } from "@playwright/test";

const screenshotDirectory = "/tmp/tasko-new-user-audit";
const firstSectionName = "Первый раздел";
const firstPositionName = "Первая позиция";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    if (window.sessionStorage.getItem("tasko-new-user-e2e-ready") !== "1") {
      window.localStorage.clear();
      window.sessionStorage.setItem("tasko-new-user-e2e-ready", "1");
    }
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });
});

async function openPrototypeTools(page: Page) {
  await page.getByRole("button", { name: "Больше" }).first().click();
  await page.getByRole("button", { name: "Prototype tools DEV" }).first().click();
  await expect(page.getByText("Данные каталога", { exact: true })).toBeVisible();
}

async function chooseScenario(page: Page, label: "Пустой" | "Демо" | "Клиентский") {
  await openPrototypeTools(page);
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: label, exact: true }).click(),
  ]);
}

async function resetScenario(page: Page) {
  await openPrototypeTools(page);
  await Promise.all([
    page.waitForEvent("load"),
    page.getByRole("button", { name: "Сбросить сценарий", exact: true }).click(),
  ]);
}

test("switches deterministic catalog scenarios, persists selection, and resets only catalog data", async ({ page }) => {
  await page.goto("/?editorNav=unified");

  await chooseScenario(page, "Демо");
  await expect(page.getByText("Омлет с томатами", { exact: true }).first()).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("tasko.prototype.catalogDataScenario.v1"))).toBe("demo");

  await page.reload();
  await expect(page.getByText("Омлет с томатами", { exact: true }).first()).toBeVisible();
  await page.evaluate(() => {
    window.localStorage.setItem("tasko.prototype.unrelated", "keep");
    window.localStorage.setItem("tasko.catalog.createdItems", "[{\"id\":\"temporary\"}]");
  });
  await resetScenario(page);
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("tasko.catalog.createdItems"))).toBeNull();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("tasko.prototype.unrelated"))).toBe("keep");
  await expect(page.getByText("Омлет с томатами", { exact: true }).first()).toBeVisible();

  await chooseScenario(page, "Клиентский");
  await expect(page.getByText("Омлет с томатами и сыром", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Омлет с томатами", { exact: true })).toHaveCount(0);
});

test("walks the empty catalog first-user flow and records current persistence", async ({ page }) => {
  test.setTimeout(30_000);
  await mkdir(screenshotDirectory, { recursive: true });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?editorNav=unified");

  await chooseScenario(page, "Пустой");
  await resetScenario(page);
  await expect(page.getByRole("heading", { name: "Начните создавать меню" })).toBeVisible();
  await expect(page.getByText("Кухня", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Омлет с томатами и сыром", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${screenshotDirectory}/01-empty-catalog.png` });

  await page.getByRole("button", { name: "Создать раздел", exact: true }).click();
  const sectionDialog = page.getByRole("dialog", { name: "Новый раздел" });
  await sectionDialog.getByLabel("Название раздела").fill(firstSectionName);
  await sectionDialog.getByRole("button", { name: "Добавить раздел" }).click();
  await expect(page).toHaveURL(/sectionId=[^&]+/);
  await expect(page.getByRole("button", { name: `Действия с разделом «${firstSectionName}»`, exact: true })).toBeVisible();
  await expect(page.getByText("В разделе пока ничего нет", { exact: true })).toBeVisible();
  await expect(page.getByText("Пепперони Фреш", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${screenshotDirectory}/02-first-section.png` });

  await page.getByRole("button", { name: "Добавить позицию", exact: true }).click();
  const draft = page.locator("[data-structure-position-draft]");
  await expect(draft).toBeVisible();
  await expect(page.getByRole("dialog", { name: "Новая позиция" })).toHaveCount(0);
  await page.screenshot({ path: `${screenshotDirectory}/03-create-position.png` });
  await draft.getByRole("textbox", { name: "Название позиции" }).fill(firstPositionName);
  await expect(page.locator("[data-position-editor-pane]").getByRole("button", { name: `Действия с позицией «${firstPositionName}»` })).toBeVisible();
  await page.screenshot({ path: `${screenshotDirectory}/04-first-position-editor.png` });

  const description = page.getByRole("textbox", { name: "Описание" });
  await description.fill("Короткое описание первой позиции");
  await page.waitForTimeout(650);
  await page.getByRole("button", { name: "Свернуть редактор" }).click();
  await expect(page.locator("[data-position-editor-pane]")).toHaveCount(0);
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstPositionName })).toBeVisible();
  await page.screenshot({ path: `${screenshotDirectory}/05-after-first-position.png` });

  await page.getByRole("button", { name: "Добавить позицию", exact: true }).click();
  const secondDraft = page.locator("[data-structure-position-draft]");
  await expect(page.getByRole("dialog", { name: "Новая позиция" })).toHaveCount(0);
  await secondDraft.getByRole("textbox", { name: "Название позиции" }).fill("Вторая позиция");
  await expect(page.locator("[data-position-editor-pane]").getByRole("button", { name: "Действия с позицией «Вторая позиция»" })).toBeVisible();
  await page.getByRole("button", { name: "Свернуть редактор" }).click();
  await expect(page.locator("[data-position-editor-pane]")).toHaveCount(0);
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstPositionName })).toBeVisible();
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: "Вторая позиция" })).toBeVisible();
  await page.screenshot({ path: `${screenshotDirectory}/06-small-catalog.png` });

  await page.getByRole("button", { name: "Добавить раздел", exact: true }).click();
  const secondSectionName = page.getByRole("textbox", { name: "Название раздела", exact: true });
  await expect(secondSectionName).toBeFocused();
  await secondSectionName.fill("Второй раздел");
  await secondSectionName.press("Enter");
  await page.locator("aside").getByText("Второй раздел", { exact: true }).click();
  await expect(page.getByRole("button", { name: "Новый подраздел" })).toBeVisible();
  await page.getByRole("button", { name: "Новый подраздел" }).click();
  const subsectionName = page.getByPlaceholder("Название подраздела...");
  await expect(subsectionName).toBeFocused();
  await subsectionName.fill("Первый подраздел");
  await page.getByRole("button", { name: "Создать подраздел" }).click();
  await expect(page.locator("[data-subsection-row]").filter({ hasText: "Первый подраздел" })).toBeVisible();
  await page.getByRole("button", { name: "Раскрыть раздел Второй раздел" }).click();
  await expect(page.locator("aside").getByText("Первый подраздел", { exact: true })).toBeVisible();

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("tasko.prototype.catalogDataScenario.v1"))).toBe("empty");
  await expect.poll(() => page.evaluate((title) => {
    const stored = JSON.parse(window.localStorage.getItem("tasko.catalog.createdItems") ?? "[]") as Array<{ title?: string }>;
    return stored.some((item) => item.title === title);
  }, firstPositionName)).toBe(true);
  await expect(page.locator("aside").getByText(firstSectionName, { exact: true })).toHaveCount(1);
  await expect(page.locator("aside").getByText("Второй раздел", { exact: true })).toHaveCount(1);
  await expect(page.locator("aside").getByText("Первый подраздел", { exact: true })).toHaveCount(1);

  await page.locator("aside").getByText(firstSectionName, { exact: true }).click();
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstPositionName })).toBeVisible();
  await page.locator("aside").getByText("Второй раздел", { exact: true }).click();
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstPositionName })).toHaveCount(0);
});
