import { expect, test, type Locator, type Page } from "@playwright/test";

const firstItemTitle = "Омлет с томатами и сыром";
const breakfastSectionId = "bbcc693d-bb99-4666-b5b0-98c05cd63af9";
const kitchenSectionId = "36aaedf1-a675-47ee-be09-6c6764d9080f";
const bakerySectionId = "97869cb7-1192-4bf6-9db8-6680fb2fc8a4";
const emptyRootSectionId = "c8ea1fcf-220a-405d-9841-df1c046d85e6";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });
  await page.goto(`/?editorNav=unified&sectionId=${breakfastSectionId}`);
});

function sectionRow(page: Page, sectionId: string) {
  return page.locator(`[data-tree-section-id="${sectionId}"]`);
}

async function startPositionMove(page: Page) {
  const row = page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle }).first();
  await row.hover();
  await row.locator("[data-catalog-row-more]").click();
  await page.getByRole("menuitem", { name: "Переместить", exact: true }).click();
  const mode = page.locator("[data-catalog-tree-move-mode]");
  await expect(mode).toContainText("Куда переместить?");
  await expect(mode).toContainText(`Позиция «${firstItemTitle}»`);
  await expect(page.getByRole("dialog", { name: "Переместить в раздел" })).toHaveCount(0);
  return row;
}

async function startSectionMove(page: Page, row: Locator, sectionName: string) {
  await row.hover();
  await page.getByRole("button", { name: `Действия с разделом ${sectionName}` }).click();
  await page.getByRole("menuitem", { name: "Переместить", exact: true }).click();
  const mode = page.locator("[data-catalog-tree-move-mode]");
  await expect(mode).toContainText("Куда переместить?");
  await expect(mode).toContainText(`Раздел «${sectionName}»`);
  await expect(page.getByRole("dialog", { name: "Переместить раздел" })).toHaveCount(0);
}

test("moves a position to an available section through the existing tree", async ({ page }) => {
  const sourceRow = await startPositionMove(page);

  await page.getByRole("button", { name: "Переместить сюда: Выпечка" }).click();

  await expect(page.locator("[data-catalog-tree-move-mode]")).toHaveCount(0);
  await expect(page.getByText("Позиция перемещена в «Выпечка»", { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Отменить", exact: true })).toBeVisible();
  await expect(sourceRow).toHaveCount(0);
  await sectionRow(page, bakerySectionId).click();
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle })).toBeVisible();
});

test("keeps an unavailable parent navigable to an available child", async ({ page }) => {
  await startPositionMove(page);

  const kitchen = sectionRow(page, kitchenSectionId);
  await expect(kitchen.getByRole("button", { name: /Переместить сюда/ })).toHaveCount(0);
  await kitchen.getByRole("button", { name: "Свернуть раздел Кухня" }).click();
  await expect(sectionRow(page, bakerySectionId)).toHaveCount(0);
  await kitchen.getByRole("button", { name: "Раскрыть раздел Кухня" }).click();
  await expect(page.getByRole("button", { name: "Переместить сюда: Выпечка" })).toBeVisible();
});

test("moves a section into a structurally valid destination", async ({ page }) => {
  await startSectionMove(page, sectionRow(page, breakfastSectionId), "Завтраки");

  await page.getByRole("button", { name: "Переместить сюда: Без названия" }).click();

  await expect(page.locator("[data-catalog-tree-move-mode]")).toHaveCount(0);
  await expect(page.getByText("Раздел перемещён в «Без названия»", { exact: true })).toBeVisible();
  await expect.poll(async () => {
    const parentList = sectionRow(page, breakfastSectionId).locator("xpath=ancestor::*[@data-section-parent-id][1]");
    return parentList.getAttribute("data-section-parent-id");
  }).toBe(emptyRootSectionId);
});

test("cancels the move mode without changing data by close button and Escape", async ({ page }) => {
  const sourceRow = await startPositionMove(page);
  await page.getByRole("button", { name: "Отменить перемещение" }).click();
  await expect(page.locator("[data-catalog-tree-move-mode]")).toHaveCount(0);
  await expect(sourceRow).toBeVisible();

  await startPositionMove(page);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-catalog-tree-move-mode]")).toHaveCount(0);
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle })).toBeVisible();
});
