import { expect, test, type Page } from "@playwright/test";

const firstItemTitle = "Омлет с томатами и сыром";
const firstItemId = "669204cd-0d0d-4782-8784-27df185f169e";
const breakfastSectionId = "bbcc693d-bb99-4666-b5b0-98c05cd63af9";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });
});

async function openItemFromLeaf(page: Page) {
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();
  await page.getByText(firstItemTitle, { exact: true }).click();
  await expect(page.getByRole("heading", { name: firstItemTitle })).toBeVisible();
}

async function openItemFromAllPositions(page: Page) {
  await page.goto("/?editorNav=unified");
  await page.getByRole("textbox", { name: "Найти позицию" }).fill("Омлет");
  await page.getByText(firstItemTitle, { exact: true }).click();
  await expect(page.getByRole("heading", { name: firstItemTitle })).toBeVisible();
}

async function openEntityItem(page: Page) {
  await page.goto(`/?editorNav=entity&sectionId=${breakfastSectionId}`);
  await page.getByText(firstItemTitle, { exact: true }).click();
  await expect(page.getByRole("heading", { name: firstItemTitle })).toBeVisible();
}

test("opens editor from a leaf and keeps the preview bridge mounted", async ({ page }) => {
  await openItemFromLeaf(page);

  await expect(page.getByRole("button", { name: "Основное" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Следующая позиция в выборке" })).toBeVisible();
  await expect(page.getByText("Предпросмотр", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/\?editorNav=unified$/);
});

test("returns from an all-positions editor with the same search context", async ({ page }) => {
  await openItemFromAllPositions(page);

  await page.getByRole("button", { name: /^Все позиции$/ }).click();

  await expect(page.getByPlaceholder("Поиск по названию")).toHaveValue("Омлет");
  await expect(page.getByText(firstItemTitle, { exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: /Выбран раздел: Все разделы/ })).toBeVisible();
});

test("records the current entity Back/Forward history behavior", async ({ page }) => {
  await openEntityItem(page);

  await expect(page).toHaveURL(new RegExp(`editorNav=entity&positionId=${firstItemId}`));

  // Current baseline: entity navigation uses replaceState, so Back leaves the
  // catalog entry; Forward restores the editor entry and its context.
  await page.goBack();
  await expect(page).toHaveURL("about:blank");
  await expect(page.getByRole("heading", { name: firstItemTitle })).not.toBeVisible();

  await page.goForward();
  await expect(page).toHaveURL(new RegExp(`editorNav=entity&positionId=${firstItemId}`));
  await expect(page.getByRole("heading", { name: firstItemTitle })).toBeVisible();
});

test("keeps the editor route after a hard reload", async ({ page }) => {
  await openEntityItem(page);
  const editorUrl = page.url();

  await page.reload();

  await expect(page).toHaveURL(editorUrl);
  await expect(page.getByRole("heading", { name: firstItemTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: "Основное" })).toBeVisible();
});

test("keeps the current autosave UI stable and records unsaved reload behavior", async ({ page }) => {
  await openEntityItem(page);
  const description = page.getByRole("textbox", { name: "Описание" });

  await description.fill("Baseline browser smoke");
  await expect(description).toContainText("Baseline browser smoke");
  await page.waitForTimeout(650);
  await expect(page.getByRole("button", { name: "Основное" })).toBeVisible();

  // Current baseline: the editor remains open, but this local description is
  // not restored after a full reload.
  await page.reload();
  const reloadedDescription = page.getByRole("textbox", { name: "Описание" });
  await expect(reloadedDescription).toHaveText("");
  await expect(reloadedDescription).toHaveAttribute("data-placeholder", "Кратко опишите состав, вкус или способ подачи");
});
