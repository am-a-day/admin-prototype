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
  await page.getByRole("button", { name: "Prototype tools" }).click();
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
  await expect(page.getByText("Каталог пока пуст", { exact: true })).toBeVisible();
  await expect(page.getByText("Кухня", { exact: true })).toHaveCount(0);
  await expect(page.getByText("Омлет с томатами и сыром", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${screenshotDirectory}/01-empty-catalog.png` });

  await page.getByRole("button", { name: "Создать раздел", exact: true }).click();
  const sectionDialog = page.getByRole("dialog", { name: "Новый раздел" });
  await sectionDialog.getByLabel("Название раздела").fill(firstSectionName);
  await sectionDialog.getByRole("button", { name: "Добавить раздел" }).click();
  await expect(page.getByRole("button", { name: `Действия с разделом ${firstSectionName}`, exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Все позиции 0" })).toBeVisible();
  await expect(page.getByText("Пепперони Фреш", { exact: true })).toHaveCount(0);
  await page.screenshot({ path: `${screenshotDirectory}/02-first-section.png` });

  await page.locator("aside").getByText(firstSectionName, { exact: true }).click();
  await expect(page.getByText("В меню пока нет позиций", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Новая позиция", exact: true }).click();
  const createPositionDialog = page.getByRole("dialog", { name: "Новая позиция" });
  await expect(createPositionDialog.getByRole("combobox", { name: "Раздел" })).toHaveValue(/draft-section-/);
  await page.screenshot({ path: `${screenshotDirectory}/03-create-position.png` });
  await createPositionDialog.getByRole("textbox", { name: "Название" }).fill(firstPositionName);
  await createPositionDialog.getByRole("button", { name: "Создать", exact: true }).click();

  const draft = page.locator("[data-structure-position-draft]");
  await expect(draft.getByRole("heading", { name: "Новая позиция" })).toBeVisible();
  await expect(draft.getByRole("textbox", { name: "Например, Пицца" })).toHaveValue(firstPositionName);
  await draft.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("heading", { name: firstPositionName })).toBeVisible();
  await page.screenshot({ path: `${screenshotDirectory}/04-first-position-editor.png` });

  const description = page.getByRole("textbox", { name: "Описание" });
  await description.fill("Короткое описание первой позиции");
  await page.waitForTimeout(650);
  await page.getByRole("navigation", { name: "Положение позиции в каталоге" })
    .getByRole("button", { name: firstSectionName, exact: true })
    .click();
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstPositionName })).toBeVisible();
  await page.screenshot({ path: `${screenshotDirectory}/05-after-first-position.png` });

  await page.getByRole("button", { name: "Новая позиция", exact: true }).click();
  const secondPositionDialog = page.getByRole("dialog", { name: "Новая позиция" });
  await secondPositionDialog.getByRole("textbox", { name: "Название" }).fill("Вторая позиция");
  await secondPositionDialog.getByRole("button", { name: "Создать", exact: true }).click();
  const secondDraft = page.locator("[data-structure-position-draft]");
  await secondDraft.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Вторая позиция" })).toBeVisible();
  await page.getByRole("navigation", { name: "Положение позиции в каталоге" })
    .getByRole("button", { name: firstSectionName, exact: true })
    .click();
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstPositionName })).toBeVisible();
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: "Вторая позиция" })).toBeVisible();
  await page.screenshot({ path: `${screenshotDirectory}/06-small-catalog.png` });

  await page.getByRole("button", { name: "Добавить раздел", exact: true }).click();
  const secondSectionDialog = page.getByRole("dialog", { name: "Новый раздел" });
  await secondSectionDialog.getByLabel("Название раздела").fill("Второй раздел");
  await secondSectionDialog.getByRole("button", { name: "Добавить раздел" }).click();
  await page.locator("aside").getByText("Второй раздел", { exact: true }).click();
  // Current first-run finding: an empty leaf opens in positions mode and does
  // not expose the existing composition-only "Добавить подраздел" action.
  await expect(page.getByRole("button", { name: "Добавить подраздел", exact: true })).toHaveCount(0);

  await page.reload();
  await expect.poll(() => page.evaluate(() => window.localStorage.getItem("tasko.prototype.catalogDataScenario.v1"))).toBe("empty");
  await expect.poll(() => page.evaluate((title) => {
    const stored = JSON.parse(window.localStorage.getItem("tasko.catalog.createdItems") ?? "[]") as Array<{ title?: string }>;
    return stored.some((item) => item.title === title);
  }, firstPositionName)).toBe(true);
  // Current baseline: created positions persist, while the locally created first
  // section is not restored after reload and therefore disappears from structure.
  await expect(page.getByText(firstSectionName, { exact: true })).toHaveCount(0);
});
