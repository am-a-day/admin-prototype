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

async function getSubsectionOrder(page: Page) {
  return page.locator("[data-composition-dnd-handle]").evaluateAll((handles) => handles.map((handle) => {
    return (handle.getAttribute("aria-label") ?? "").replace("Изменить порядок подраздела ", "");
  }));
}

function directChildRows(page: Page, parentName: string) {
  const parentRow = page.locator("[data-tree-section-id]").filter({ hasText: parentName }).first();
  return parentRow.locator("xpath=..").locator(":scope > div").nth(1).locator(":scope > div > div[data-tree-section-id]");
}

test("opens editor from a leaf and keeps the preview bridge mounted", async ({ page }) => {
  await openItemFromLeaf(page);

  await expect(page.getByRole("button", { name: "Основное" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Следующая позиция в выборке" })).toBeVisible();
  await expect(page.getByText("Предпросмотр", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/\?editorNav=unified$/);
});

test("keeps previous and next navigation inside the current editor selection", async ({ page }) => {
  await openItemFromLeaf(page);

  const previous = page.getByRole("button", { name: "Предыдущая позиция в выборке" });
  const next = page.getByRole("button", { name: "Следующая позиция в выборке" });
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();

  await next.click();
  await expect(page.getByRole("heading", { name: firstItemTitle })).not.toBeVisible();
  await expect(previous).toBeEnabled();

  await previous.click();
  await expect(page.getByRole("heading", { name: firstItemTitle })).toBeVisible();
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

test("records direct subsection reorder and current reload behavior", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByText("Кухня", { exact: true }).first().click();

  const before = await getSubsectionOrder(page);
  expect(before.indexOf("Завтраки")).toBeGreaterThanOrEqual(0);
  expect(before.indexOf("Выпечка")).toBeGreaterThan(before.indexOf("Завтраки"));

  const breakfastHandle = page.getByRole("button", { name: "Изменить порядок подраздела Завтраки", exact: true });
  await breakfastHandle.focus();
  await breakfastHandle.press("Space");
  await breakfastHandle.press("ArrowDown");
  await breakfastHandle.press("Space");

  await expect(page.getByText("Порядок подразделов изменён", { exact: true })).toBeVisible();
  const after = await getSubsectionOrder(page);
  expect(after.indexOf("Выпечка")).toBeLessThan(after.indexOf("Завтраки"));

  await page.reload();
  await page.locator("[data-tree-section-id]").filter({ hasText: "Кухня" }).first().click();
  const afterReload = await getSubsectionOrder(page);
  // Current baseline: the direct subsection order returns to its fixture order after a full reload.
  expect(afterReload).toEqual(before);
});

test("records explicit position move parent/order and current reload behavior", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();

  const sourceRow = page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle }).first();
  await sourceRow.getByRole("button", { name: `Действия для ${firstItemTitle}` }).click();
  await page.getByRole("menuitem", { name: "Переместить в раздел…" }).click();

  const moveDialog = page.getByRole("dialog", { name: "Переместить в раздел" });
  await moveDialog.getByRole("button", { name: "Выпечка", exact: true }).click();
  await expect(page.getByText("Позиция перемещена в «Выпечка»", { exact: true })).toBeVisible();

  await page.getByText("Выпечка", { exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Действия с разделом «Выпечка»" })).toBeVisible();
  await expect(page.locator("[data-catalog-table-row]").last()).toContainText(firstItemTitle);

  await page.reload();
  // Current baseline: a full reload returns to the all-positions scope; the item remains in the catalog.
  await expect(page.getByText(firstItemTitle, { exact: true })).toBeVisible();
});

test("records explicit subsection move parent/order and current reload behavior", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByRole("button", { name: "Раскрыть раздел Бар", exact: true }).click();
  const barOrderBeforeMove = await directChildRows(page, "Бар").allTextContents();

  await page.getByRole("button", { name: "Действия с разделом Завтраки", exact: true }).click();
  await page.getByRole("menuitem", { name: "Переместить…" }).click();

  const moveDialog = page.getByRole("dialog", { name: "Переместить раздел" });
  await moveDialog.getByRole("button", { name: "Бар", exact: true }).click();
  await expect(page.getByText("Раздел перемещён в «Бар»", { exact: true })).toBeVisible();

  const barChildren = directChildRows(page, "Бар");
  await expect(barChildren.last()).toContainText("Завтраки");

  await page.reload();
  await page.getByRole("button", { name: "Раскрыть раздел Бар", exact: true }).click();
  // Current baseline: the moved subsection returns to its original parent/order after a full reload.
  await expect(directChildRows(page, "Бар").allTextContents()).resolves.toEqual(barOrderBeforeMove);
});
