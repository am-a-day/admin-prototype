import { expect, test, type Locator, type Page } from "@playwright/test";

const firstItemTitle = "Омлет с томатами и сыром";
const firstItemId = "669204cd-0d0d-4782-8784-27df185f169e";
const kitchenSectionId = "36aaedf1-a675-47ee-be09-6c6764d9080f";
const breakfastSectionId = "bbcc693d-bb99-4666-b5b0-98c05cd63af9";
const bakerySectionId = "97869cb7-1192-4bf6-9db8-6680fb2fc8a4";
const barSectionId = "247627eb-93f7-4a68-990d-8cb1912fcddf";
const structureCreateTitle = "Structure create characterization";
const directCreateTitle = "Direct create characterization";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });
});

async function openItemFromLeaf(page: Page) {
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();
  await page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle }).click();
  await expect(page.getByRole("complementary", { name: firstItemTitle })).toBeVisible();
}

async function openItemFromAllPositions(page: Page) {
  await page.goto("/?editorNav=unified");
  await page.getByRole("textbox", { name: "Найти позицию" }).fill("Омлет");
  await page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle }).click();
  await expect(page.getByRole("complementary", { name: firstItemTitle })).toBeVisible();
}

async function openEntityItem(page: Page) {
  await page.goto(`/?editorNav=entity&sectionId=${breakfastSectionId}`);
  await page.locator("[data-composition-title=true]").filter({ hasText: firstItemTitle }).click();
  await expect(page.getByRole("complementary", { name: firstItemTitle })).toBeVisible();
}

async function revealEditorQueueNavigation(page: Page) {
  await page.locator("[data-position-editor-controls]").hover();
}

async function openPositionEditorTab(page: Page, pane: Locator, label: string) {
  const tab = pane.getByRole("button", { name: label, exact: true });
  if (await tab.isVisible()) {
    await tab.click();
    return tab;
  }

  await pane.getByRole("button", { name: /^Еще \d+$/ }).click();
  await page.getByRole("menuitem", { name: label, exact: true }).click();
  await expect(tab).toBeVisible();
  return tab;
}

async function openStructureCreateDraft(page: Page) {
  await page.goto(`/?editorNav=entity&sectionId=${breakfastSectionId}`);
  await page.getByRole("button", { name: "Добавить позицию", exact: true }).last().click();
  const draft = page.locator("[data-structure-position-draft]");
  await expect(draft).toBeVisible();
  await expect(draft).toHaveAccessibleName("Новая позиция");
  return draft;
}

async function openDirectCreateDraft(page: Page) {
  await page.goto(`/?editorNav=unified&createPosition=1&sectionId=${breakfastSectionId}`);
  await expect(page.getByRole("complementary", { name: "Новая позиция" })).toBeVisible();
}

async function openRowMoveMenu(page: Page, row: ReturnType<Page["locator"]>) {
  await row.hover();
  await row.locator("[data-catalog-row-more]").click();
  const moveItem = page.getByRole("menuitem", { name: "Переместить", exact: true });
  await moveItem.hover();
  const dialog = page.getByRole("dialog", { name: "Переместить в раздел" });
  await expect(dialog).toBeVisible();
  await expect(moveItem).toBeVisible();
  await expect(dialog.locator("xpath=..")).toHaveAttribute("data-side", /^(left|right)$/);
  return dialog;
}

async function preserveLocalStorageOnReload(page: Page) {
  await page.addInitScript(() => {
    const snapshot = window.sessionStorage.getItem("catalog-e2e-local-storage-snapshot");
    if (!snapshot) return;
    const values = JSON.parse(snapshot) as Record<string, string>;
    Object.entries(values).forEach(([key, value]) => window.localStorage.setItem(key, value));
  });
  await page.evaluate(() => {
    const values = Object.fromEntries(
      Object.entries(window.localStorage).map(([key, value]) => [key, value]),
    );
    window.sessionStorage.setItem("catalog-e2e-local-storage-snapshot", JSON.stringify(values));
  });
}

async function pointerDrag(
  page: Page,
  source: Locator,
  target: Locator,
  onActivated?: () => Promise<void>,
) {
  const [sourceBox, targetBox] = await Promise.all([source.boundingBox(), target.boundingBox()]);
  if (!sourceBox || !targetBox) throw new Error("Drag source or target is outside the viewport");
  const start = { x: sourceBox.x + sourceBox.width / 2, y: sourceBox.y + sourceBox.height / 2 };
  const end = { x: targetBox.x + targetBox.width / 2, y: targetBox.y + targetBox.height / 2 };
  const horizontal = Math.abs(end.x - start.x) >= Math.abs(end.y - start.y);
  const activation = {
    x: start.x + (horizontal ? Math.sign(end.x - start.x || 1) * 10 : 0),
    y: start.y + (horizontal ? 0 : Math.sign(end.y - start.y || 1) * 10),
  };

  await page.mouse.move(start.x, start.y);
  await page.mouse.down();
  try {
    await page.mouse.move(activation.x, activation.y, { steps: 2 });
    await page.mouse.move(end.x, end.y, { steps: 8 });
    await onActivated?.();
  } finally {
    await page.mouse.up();
  }
}

async function getVisibleUserColumnOrder(page: Page) {
  return page.locator("[data-catalog-table-header] [data-catalog-draggable-column-header]").evaluateAll((headers) =>
    headers.map((header) => header.getAttribute("data-catalog-draggable-column-header")),
  );
}

async function getFirstRowUserColumnOrder(page: Page) {
  return page.locator("[data-catalog-table-row]").first().locator("[data-catalog-table-content-cell]").evaluateAll((cells) =>
    cells
      .map((cell) => cell.getAttribute("data-catalog-table-content-cell"))
      .filter((id) => id && id !== "position"),
  );
}

async function getCatalogRowOrder(page: Page) {
  return page.locator("[data-catalog-table-row]").evaluateAll((rows) =>
    rows.map((row) => row.getAttribute("data-catalog-table-row")),
  );
}

async function getSubsectionOrder(page: Page) {
  return page.locator("[data-composition-dnd-handle]").evaluateAll((handles) => handles.map((handle) => {
    return (handle.getAttribute("aria-label") ?? "").replace("Изменить порядок подраздела ", "");
  }));
}

test("keeps catalog add and table controls compact and aligned", async ({ page }) => {
  await page.goto("/?editorNav=unified");

  const addSection = page.getByRole("button", { name: "Добавить раздел", exact: true });
  await expect(addSection).toBeVisible();
  await expect(addSection).toHaveCSS("width", "28px");
  await expect(addSection).toHaveCSS("height", "28px");
  await expect(addSection.locator("svg")).toHaveAttribute("width", "16");
  await expect(addSection.locator("svg")).toHaveAttribute("height", "16");
  await expect(addSection).toHaveCSS("color", "rgb(87, 83, 77)");
  await expect(page.locator("[data-catalog-table-header]")).toBeVisible();

  await expect(page.getByRole("button", { name: "Сортировать по возрастанию" })).toHaveClass(/justify-end/);

  const breakfastRow = page.locator("[data-tree-section-id]").filter({ hasText: "Завтраки" }).first();
  const breakfastActions = breakfastRow.getByRole("button", { name: "Действия с разделом Завтраки" });
  await expect(breakfastActions).toHaveCSS("position", "absolute");
  const rowBeforeHover = await breakfastRow.boundingBox();
  await breakfastRow.hover();
  await expect(breakfastActions).toHaveCSS("opacity", "1");
  const rowAfterHover = await breakfastRow.boundingBox();
  expect(rowBeforeHover && rowAfterHover).toBeTruthy();
  expect(rowAfterHover!.width).toBe(rowBeforeHover!.width);

  const languageSettings = page.getByRole("button", { name: "Управлять языками", exact: true });
  await expect(languageSettings).toHaveCSS("width", "24px");
  await expect(languageSettings).toHaveCSS("height", "24px");
  await expect(languageSettings.locator("svg")).toHaveAttribute("width", "15");
});

test("reserves toolbar space for the selected filter label", async ({ page }) => {
  await page.setViewportSize({ width: 859, height: 747 });
  await page.goto(`/?editorNav=unified&sectionId=${breakfastSectionId}`);

  const filterCell = page.locator("[data-catalog-table-filter-cell]");
  const filterTrigger = page.locator("[data-catalog-table-filter-trigger]");
  const search = page.locator("[data-catalog-table-search-control] label");
  const readGeometry = async () => {
    const [cell, trigger, searchBox] = await Promise.all([
      filterCell.boundingBox(),
      filterTrigger.boundingBox(),
      search.boundingBox(),
    ]);
    if (!cell || !trigger || !searchBox) throw new Error("Toolbar controls are outside the viewport");
    return { cell, trigger, search: searchBox };
  };

  expect((await readGeometry()).cell.width).toBe(60);

  await page.getByRole("button", { name: "Фильтр таблицы: Все" }).click();
  await page.getByRole("menuitem", { name: /^В архиве/ }).click();
  const archived = await readGeometry();
  expect(archived.cell.width).toBeGreaterThan(60);
  expect(archived.trigger.x + archived.trigger.width).toBeLessThanOrEqual(archived.search.x);

  await page.getByRole("button", { name: "Фильтр таблицы: В архиве" }).click();
  await page.getByRole("menuitem", { name: /^По расписанию/ }).click();
  const scheduled = await readGeometry();
  expect(scheduled.cell.width).toBeGreaterThan(archived.cell.width);
  expect(scheduled.trigger.x + scheduled.trigger.width).toBeLessThanOrEqual(scheduled.search.x);

  await page.getByRole("textbox", { name: "Найти позицию" }).focus();
  const [focusedCell, divider] = await Promise.all([
    filterCell.boundingBox(),
    page.locator("[data-catalog-table-search-divider]").boundingBox(),
  ]);
  expect(focusedCell && divider).toBeTruthy();
  expect(Math.abs(focusedCell!.x + focusedCell!.width - (divider!.x + divider!.width))).toBeLessThanOrEqual(1);

  await page.getByRole("button", { name: "Фильтр таблицы: По расписанию" }).click();
  await page.getByRole("menuitem", { name: "Все позиции" }).click();
  expect((await readGeometry()).cell.width).toBe(60);
});

test("shows row More only for hover, focus, and an open menu without shifting the table", async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();

  const rows = page.locator("[data-catalog-table-row]");
  const firstRow = rows.first();
  const secondRow = rows.nth(1);
  const firstMore = firstRow.locator("[data-catalog-row-more]");
  const secondMore = secondRow.locator("[data-catalog-row-more]");
  const geometry = (row: typeof firstRow) => row.evaluate((element) => {
    const rect = (target: Element | null) => {
      if (!target) return null;
      const box = target.getBoundingClientRect();
      return { x: box.x, y: box.y, width: box.width, height: box.height };
    };
    return {
      row: rect(element),
      title: rect(element.querySelector("[data-catalog-table-content-cell=position]")),
      actions: rect(element.querySelector("[data-catalog-table-actions]")),
      more: rect(element.querySelector("[data-catalog-row-more]")),
    };
  });

  await expect(firstMore).toHaveCSS("opacity", "0");
  await expect(firstMore).toHaveCSS("pointer-events", "none");
  const defaultGeometry = await geometry(firstRow);
  expect(defaultGeometry.row?.height).toBe(38);
  expect(defaultGeometry.actions?.width).toBe(33);
  expect(defaultGeometry.actions!.x + defaultGeometry.actions!.width)
    .toBeLessThanOrEqual(defaultGeometry.row!.x + defaultGeometry.row!.width);

  await firstRow.hover();
  await expect(firstMore).toHaveCSS("opacity", "1");
  await expect(firstMore).toHaveCSS("pointer-events", "auto");
  await expect(firstMore).toHaveClass(/bg-stone-50/);
  expect(await geometry(firstRow)).toEqual(defaultGeometry);

  await secondRow.hover();
  await expect(firstMore).toHaveCSS("opacity", "0");
  await expect(secondMore).toHaveCSS("opacity", "1");

  await secondMore.click();
  await expect(secondMore).toHaveAttribute("data-state", "open");
  await expect(page.getByRole("menu")).toBeVisible();
  await page.getByRole("menu").hover();
  await expect(secondMore).toHaveCSS("opacity", "1");
  await expect(page.locator("[data-position-editor-pane]")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("textbox", { name: "Найти позицию" }).focus();
  await expect(secondMore).toHaveCSS("opacity", "0");
  await firstRow.focus();
  await expect(firstMore).toHaveCSS("opacity", "1");
  await firstMore.focus();
  await expect(firstMore).toHaveCSS("opacity", "1");
  expect(await geometry(firstRow)).toEqual(defaultGeometry);

  await page.getByText("Кухня", { exact: true }).first().click();
  const subsectionRows = page.locator("[data-subsection-row]");
  const firstSubsection = subsectionRows.first();
  const secondSubsection = subsectionRows.nth(1);
  const firstSubsectionMore = firstSubsection.locator("[data-catalog-row-more]");
  const secondSubsectionMore = secondSubsection.locator("[data-catalog-row-more]");
  await expect(page.locator("[data-catalog-table-header] [data-catalog-table-actions]")).toHaveCount(0);
  await expect(firstSubsection.locator("[data-no-dnd]").last()).toHaveCSS("position", "absolute");
  await expect(firstSubsectionMore).toHaveCSS("opacity", "0");
  await firstSubsection.hover();
  await expect(firstSubsectionMore).toHaveCSS("opacity", "1");
  await expect(firstSubsectionMore).toHaveClass(/bg-stone-50/);
  await secondSubsection.hover();
  await expect(firstSubsectionMore).toHaveCSS("opacity", "0");
  await expect(secondSubsectionMore).toHaveCSS("opacity", "1");
});

test("opens column actions from the full header cell and keeps sorting and visibility synchronized", async ({ page }) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto("/?editorNav=unified");

  const priceHeader = page.getByRole("button", { name: "Настройки колонки «Базовая цена»", exact: true });
  const geometry = await priceHeader.evaluate((element) => {
    const trigger = element.getBoundingClientRect();
    const cell = element.parentElement?.getBoundingClientRect();
    return {
      trigger: { x: trigger.x, y: trigger.y, width: trigger.width, height: trigger.height },
      cell: cell ? { x: cell.x, y: cell.y, width: cell.width, height: cell.height } : null,
    };
  });
  expect(geometry.cell).not.toBeNull();
  expect(Math.abs(geometry.trigger.x - geometry.cell!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(geometry.trigger.width - geometry.cell!.width)).toBeLessThanOrEqual(2);
  expect(Math.abs(geometry.trigger.height - geometry.cell!.height)).toBeLessThanOrEqual(1);

  for (const offsetX of [8, geometry.trigger.width / 2, geometry.trigger.width - 8]) {
    await priceHeader.click({ position: { x: offsetX, y: geometry.trigger.height / 2 } });
    await expect(page.getByRole("menuitemradio", { name: "Сначала дешевле" })).toBeVisible();
    await page.keyboard.press("Escape");
  }

  await priceHeader.click();
  await page.getByRole("menuitemradio", { name: "Сначала дешевле" }).click();
  await expect(priceHeader).toHaveAttribute("data-sort-direction", "asc");
  await priceHeader.click();
  await expect(page.getByRole("menuitemradio", { name: "Сначала дешевле" })).toHaveAttribute("aria-checked", "true");
  await page.getByRole("menuitemradio", { name: "Сначала дороже" }).click();
  await expect(priceHeader).toHaveAttribute("data-sort-direction", "desc");

  const prices = await page.locator("[data-catalog-table-row] [data-catalog-table-content-cell=price]").evaluateAll((cells) => {
    return cells
      .map((cell) => Number((cell.textContent ?? "").replace(/\D/g, "")))
      .filter((value) => Number.isFinite(value) && value > 0);
  });
  expect(prices).toEqual([...prices].sort((left, right) => right - left));

  await priceHeader.click();
  await page.getByRole("menuitem", { name: "Сбросить сортировку" }).click();
  await expect(priceHeader).not.toHaveAttribute("data-sort-direction");

  const weightHeader = page.getByRole("button", { name: "Настройки колонки «Вес или объём»", exact: true });
  await weightHeader.click({ position: { x: 8, y: 16 } });
  await expect(page.getByRole("menuitemradio", { name: /Сначала/ })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Скрыть колонку" }).click();
  await expect(weightHeader).toHaveCount(0);
  await page.getByRole("button", { name: "Настроить колонки" }).click();
  await expect(page.getByRole("button", { name: "Показать колонку «Вес или объём»" })).toBeVisible();
  await page.getByRole("button", { name: "Показать колонку «Описание»" }).click();
  await page.getByLabel("Поиск по колонкам").press("Escape");

  const descriptionHeader = page.getByRole("button", { name: "Настройки колонки «Описание»", exact: true });
  await descriptionHeader.click({ position: { x: 8, y: 16 } });
  await expect(page.getByRole("menuitem", { name: "Скрыть колонку" })).toBeVisible();
  await expect(page.getByRole("menuitemradio")).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Добавить колонку" }).click();
  await page.getByRole("menuitem", { name: "Скидка", exact: true }).click();
  const discountHeader = page.getByRole("button", { name: "Настройки колонки «Скидка»", exact: true });
  await discountHeader.click();
  await expect(page.getByRole("menuitemradio", { name: "Сначала меньшая скидка" })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: "Сначала большая скидка" })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: /Показать/ })).toHaveCount(0);
  await page.keyboard.press("Escape");
});

test("keeps column header click and repeated pointer reordering compatible across rerenders", async ({ page }) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto(`/?editorNav=unified&sectionId=${breakfastSectionId}`);

  const weightHeader = page.locator('[data-catalog-column-menu-trigger="weight"]');
  const priceHeader = page.locator('[data-catalog-column-menu-trigger="price"]');
  const positionHeader = page.locator('[data-catalog-column-menu-trigger="position"]');
  await expect.poll(() => getVisibleUserColumnOrder(page)).toEqual(["weight", "price"]);
  await expect(weightHeader).toHaveCSS("cursor", "grab");
  await expect(positionHeader).toHaveCSS("cursor", "default");

  await weightHeader.click();
  await expect(page.getByRole("menuitem", { name: "Скрыть колонку" })).toBeVisible();
  await expect(page.locator("[data-catalog-column-drag-preview]")).toHaveCount(0);
  await expect.poll(() => getVisibleUserColumnOrder(page)).toEqual(["weight", "price"]);
  await expect(page.getByRole("menuitem", { name: "Сдвинуть влево" })).toHaveAttribute("data-disabled");
  await page.getByRole("menuitem", { name: "Сдвинуть вправо" }).click();
  await expect.poll(() => getVisibleUserColumnOrder(page)).toEqual(["price", "weight"]);
  await expect.poll(() => getFirstRowUserColumnOrder(page)).toEqual(["price", "weight"]);
  await weightHeader.click();
  await page.getByRole("menuitem", { name: "Сдвинуть влево" }).click();
  await expect.poll(() => getVisibleUserColumnOrder(page)).toEqual(["weight", "price"]);
  await expect.poll(() => getFirstRowUserColumnOrder(page)).toEqual(["weight", "price"]);

  await pointerDrag(page, weightHeader, priceHeader, async () => {
    await expect(page.locator("[data-catalog-column-drag-preview]")).toBeVisible();
    await expect(page.locator("[data-catalog-column-drop-indicator]")).toBeVisible();
    await expect(weightHeader).toHaveCSS("cursor", "grabbing");
    await expect.poll(() => getVisibleUserColumnOrder(page)).toEqual(["weight", "price"]);
  });
  await expect.poll(() => getVisibleUserColumnOrder(page)).toEqual(["price", "weight"]);
  await expect.poll(() => getFirstRowUserColumnOrder(page)).toEqual(["price", "weight"]);
  await expect(page.getByRole("menu")).toHaveCount(0);

  await priceHeader.click();
  await expect(page.getByRole("menuitem", { name: "Скрыть колонку" })).toBeVisible();
  await page.getByRole("menuitem", { name: "Скрыть колонку" }).press("Escape");
  await pointerDrag(page, priceHeader, weightHeader);
  await expect.poll(() => getVisibleUserColumnOrder(page)).toEqual(["weight", "price"]);
  await expect.poll(() => getFirstRowUserColumnOrder(page)).toEqual(["weight", "price"]);
  await expect(page.getByRole("menu")).toHaveCount(0);

  await weightHeader.click();
  await page.getByRole("menuitem", { name: "Скрыть колонку" }).click();
  await expect(weightHeader).toHaveCount(0);
  await page.getByRole("button", { name: "Настроить колонки" }).click();
  await page.getByRole("button", { name: "Показать колонку «Вес или объём»" }).click();
  await page.getByLabel("Поиск по колонкам").press("Escape");
  await expect(weightHeader).toBeVisible();

  await pointerDrag(page, weightHeader, priceHeader);
  await expect.poll(() => getVisibleUserColumnOrder(page)).toEqual(["price", "weight"]);
  await expect.poll(() => getFirstRowUserColumnOrder(page)).toEqual(["price", "weight"]);
  await expect(page.getByRole("menu")).toHaveCount(0);

  await preserveLocalStorageOnReload(page);
  await page.reload();
  await expect.poll(() => getVisibleUserColumnOrder(page)).toEqual(["price", "weight"]);
  await expect.poll(() => getFirstRowUserColumnOrder(page)).toEqual(["price", "weight"]);
  await priceHeader.click();
  await expect(page.getByRole("menuitem", { name: "Скрыть колонку" })).toBeVisible();
});

test("keeps row handles visible in reorderable state and supports repeated pointer reordering", async ({ page }) => {
  test.setTimeout(45_000);
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto(`/?editorNav=unified&sectionId=${breakfastSectionId}`);

  const handles = page.locator('[data-catalog-table-row] [data-catalog-dnd-handle]');
  await expect(handles.first()).toBeVisible();
  await expect(handles.first()).toHaveCSS("position", "absolute");
  await expect(handles.first()).toHaveCSS("opacity", "1");
  await expect(handles).toHaveCount(await page.locator("[data-catalog-table-row]").count());
  await handles.first().hover();
  await page.waitForTimeout(350);
  await expect(page.getByRole("tooltip")).toHaveCount(0);

  const initialOrder = await getCatalogRowOrder(page);
  await pointerDrag(
    page,
    page.locator(`[data-catalog-table-row="${initialOrder[0]}"] [data-catalog-dnd-handle]`),
    page.locator(`[data-catalog-table-row="${initialOrder[1]}"] [data-catalog-dnd-handle]`),
  );
  const firstExpected = [initialOrder[1], initialOrder[0], ...initialOrder.slice(2)];
  await expect.poll(() => getCatalogRowOrder(page)).toEqual(firstExpected);

  await pointerDrag(
    page,
    page.locator(`[data-catalog-table-row="${firstExpected[2]}"] [data-catalog-dnd-handle]`),
    page.locator(`[data-catalog-table-row="${firstExpected[0]}"] [data-catalog-dnd-handle]`),
  );
  const secondExpected = [firstExpected[2], firstExpected[0], firstExpected[1], ...firstExpected.slice(3)];
  await expect.poll(() => getCatalogRowOrder(page)).toEqual(secondExpected);

  const priceHeader = page.locator('[data-catalog-column-menu-trigger="price"]');
  await priceHeader.click();
  await page.getByRole("menuitemradio", { name: "Сначала дороже" }).click();
  await expect(handles).toHaveCount(await page.locator("[data-catalog-table-row]").count());
  await expect(handles.first()).toHaveAttribute("aria-disabled", "true");
  await expect(handles.first()).toHaveCSS("opacity", "0.4");
  await handles.first().hover();
  await expect(page.getByRole("tooltip")).toHaveText("Сбросьте сортировку, чтобы изменить порядок");
  await priceHeader.click();
  await page.getByRole("menuitem", { name: "Сбросить сортировку" }).click();
  await expect(handles.first()).toBeVisible();
  await expect(handles.first()).toHaveAttribute("aria-disabled", "false");
  await expect.poll(() => getCatalogRowOrder(page)).toEqual(secondExpected);

  const search = page.getByRole("textbox", { name: "Найти позицию" });
  await search.fill("Омлет");
  await expect(handles.first()).toHaveAttribute("aria-disabled", "true");
  await expect(handles.first()).toHaveCSS("opacity", "0.4");
  await handles.first().hover();
  await expect(page.getByRole("tooltip")).toHaveText("Очистите поиск, чтобы изменить порядок");
  const filteredOrder = await getCatalogRowOrder(page);
  await pointerDrag(page, handles.first(), handles.nth(1));
  await expect.poll(() => getCatalogRowOrder(page)).toEqual(filteredOrder);
  await search.fill("");
  await expect(handles.first()).toHaveAttribute("aria-disabled", "false");

  await page.getByRole("button", { name: "Фильтр таблицы: Все" }).click();
  await page.getByRole("menuitem", { name: /^По расписанию/ }).click();
  await expect(handles.first()).toHaveAttribute("aria-disabled", "true");
  await handles.first().hover();
  await expect(page.getByRole("tooltip")).toHaveText("Сбросьте фильтры, чтобы изменить порядок");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Фильтр таблицы: По расписанию" }).click();
  await page.getByRole("menuitem", { name: /^Все позиции/ }).click();
  await expect(handles.first()).toHaveAttribute("aria-disabled", "false");

  await preserveLocalStorageOnReload(page);
  await page.reload();
  await expect(handles.first()).toBeVisible();
  await expect.poll(() => getCatalogRowOrder(page)).toEqual(secondExpected);
  await expect(priceHeader).not.toHaveAttribute("data-sort-direction");
});

test("renders More above row content without reserving a table column", async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 720 });
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();

  const horizontalScroll = page.locator("[data-catalog-table-horizontal-scroll]");
  const headerActions = page.locator("[data-catalog-table-header] [data-catalog-table-actions]");
  const rowActions = page.locator("[data-catalog-table-row] [data-catalog-table-actions]").first();
  await expect(headerActions).toHaveCount(0);
  await expect(rowActions).toHaveCSS("position", "sticky");
  await expect(rowActions).toHaveCSS("margin-left", "-33px");
  await expect(rowActions).toHaveCSS("background-color", "rgba(0, 0, 0, 0)");
  await expect(page.locator("[data-catalog-position-create-row] [data-catalog-table-actions]")).toHaveCount(0);

  await page.getByRole("button", { name: "Добавить колонку" }).click();
  await page.getByRole("menuitem", { name: "Описание", exact: true }).click();

  const stickyX = (await rowActions.boundingBox())!.x;
  await horizontalScroll.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await expect.poll(async () => horizontalScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect(Math.abs((await rowActions.boundingBox())!.x - stickyX)).toBeLessThanOrEqual(1);

  await horizontalScroll.evaluate((element) => { element.scrollLeft = 0; });
  await page.locator("[data-catalog-position-create-row]").click();
  await expect(page.getByRole("complementary", { name: "Новая позиция" })).toBeVisible();
  await expect(rowActions).toHaveCSS("position", "absolute");
  const createX = (await rowActions.boundingBox())!.x;
  await horizontalScroll.evaluate((element) => { element.scrollLeft = element.scrollWidth; });
  await expect.poll(async () => horizontalScroll.evaluate((element) => element.scrollLeft)).toBeGreaterThan(0);
  expect((await rowActions.boundingBox())!.x).toBeLessThan(createX - 10);

  await page.getByRole("button", { name: "Отменить создание" }).click();
  await expect(rowActions).toHaveCSS("position", "sticky");
  await page.locator("[data-catalog-table-row]").first().click();
  await expect(page.locator("[data-position-editor-pane]")).toBeVisible();
  await expect(rowActions).toHaveCSS("position", "sticky");
});

test("keeps nested move menus open through three levels and applies the deep target", async ({ page }) => {
  test.setTimeout(30_000);
  await page.setViewportSize({ width: 1280, height: 820 });
  await page.goto("/?editorNav=unified");

  await page.getByRole("button", { name: "Добавить раздел", exact: true }).click();
  await page.getByLabel("Название раздела").fill("E2E корень");
  await page.getByLabel("Название раздела").press("Enter");
  const rootRow = page.locator("[data-tree-section-id]").filter({ hasText: "E2E корень" }).first();
  await rootRow.hover();
  await page.getByRole("button", { name: "Добавить подраздел в раздел E2E корень" }).click();
  await page.getByLabel("Название раздела").fill("E2E уровень 2");
  await page.getByLabel("Название раздела").press("Enter");
  const middleRow = page.locator("[data-tree-section-id]").filter({ hasText: "E2E уровень 2" }).first();
  await middleRow.hover();
  await page.getByRole("button", { name: "Добавить подраздел в раздел E2E уровень 2" }).click();
  await page.getByLabel("Название раздела").fill("E2E глубокий раздел");
  await page.getByLabel("Название раздела").press("Enter");
  await expect(page.getByRole("button", { name: "Раздел E2E глубокий раздел" })).toBeVisible();

  await page.getByText("Завтраки", { exact: true }).first().click();
  const sourceRow = page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle }).first();
  const moveDialog = await openRowMoveMenu(page, sourceRow);
  const destinationHint = moveDialog.locator("[data-move-destinations-hint]");
  await destinationHint.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Показаны разделы без подразделов — только в них можно перемещать позиции.");
  await moveDialog.getByRole("menuitem", { name: "Кухня", exact: true }).hover();
  const scrollableNestedMenu = page.locator("[data-move-to-section-nested-menu]").last();
  await expect(scrollableNestedMenu).toHaveCSS("overflow-y", "auto");
  const nestedMenuSize = await scrollableNestedMenu.boundingBox();
  expect(nestedMenuSize).not.toBeNull();
  expect(nestedMenuSize!.height).toBeLessThanOrEqual(340);
  await expect.poll(async () => scrollableNestedMenu.evaluate((element) => element.scrollHeight > element.clientHeight)).toBe(true);

  const kitchenTarget = moveDialog.getByRole("menuitem", { name: "E2E корень", exact: true });
  await kitchenTarget.hover();
  const breakfastTarget = page.getByRole("menuitem", { name: "E2E корень / E2E уровень 2", exact: true });
  await expect(breakfastTarget).toBeVisible();

  const kitchenBox = await kitchenTarget.boundingBox();
  const breakfastBox = await breakfastTarget.boundingBox();
  expect(kitchenBox && breakfastBox).toBeTruthy();
  await page.mouse.move(kitchenBox!.x + kitchenBox!.width - 2, kitchenBox!.y + kitchenBox!.height / 2);
  await page.mouse.move(breakfastBox!.x + 2, breakfastBox!.y + breakfastBox!.height / 2, { steps: 6 });
  await expect(breakfastTarget).toBeVisible();

  await breakfastTarget.hover();
  const deepTarget = page.getByRole("menuitem", { name: "E2E корень / E2E уровень 2 / E2E глубокий раздел", exact: true });
  await expect(deepTarget).toBeVisible();
  const deepBox = await deepTarget.boundingBox();
  expect(deepBox).not.toBeNull();
  await page.mouse.move(breakfastBox!.x + breakfastBox!.width - 2, breakfastBox!.y + breakfastBox!.height / 2);
  await page.mouse.move(deepBox!.x + 2, deepBox!.y + deepBox!.height / 2, { steps: 6 });
  await expect(deepTarget).toBeVisible();
  await deepTarget.click();

  await expect(page.getByText("Позиция перемещена в «E2E глубокий раздел»", { exact: true })).toBeVisible();
  await page.getByText("E2E глубокий раздел", { exact: true }).first().click();
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle })).toBeVisible();
});

test("creates a destination while moving one position", async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();

  const firstRow = page.locator("[data-catalog-table-row]").first();
  const firstTitle = (await firstRow.locator("[data-catalog-table-content-cell=position]").innerText()).trim();
  let moveDialog = await openRowMoveMenu(page, firstRow);
  await moveDialog.getByRole("menuitem", { name: "Создать раздел…" }).click();
  await page.getByLabel("Название нового раздела").fill("E2E перенос одной");
  await page.getByRole("button", { name: "Создать и переместить" }).click();
  await expect(page.getByText("E2E перенос одной", { exact: true })).toBeVisible();
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstTitle })).toHaveCount(0);
  await page.getByText("E2E перенос одной", { exact: true }).first().click();
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstTitle })).toBeVisible();
});

test("creates a destination while moving a bulk selection", async ({ page }) => {
  test.setTimeout(30_000);
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();

  const bulkRows = page.locator("[data-catalog-table-row]");
  const bulkTitles = [
    (await bulkRows.nth(0).locator("[data-catalog-table-content-cell=position]").innerText()).trim(),
    (await bulkRows.nth(1).locator("[data-catalog-table-content-cell=position]").innerText()).trim(),
  ];
  await bulkRows.nth(0).getByRole("checkbox").check();
  await bulkRows.nth(1).getByRole("checkbox").check();
  await page.getByRole("button", { name: "Переместить", exact: true }).click();
  const moveDialog = page.getByRole("dialog", { name: "Переместить в раздел" });
  await expect(moveDialog).toBeVisible();
  await moveDialog.getByRole("menuitem", { name: "Создать раздел…" }).click();
  await page.getByLabel("Название нового раздела").fill("E2E bulk перенос");
  await page.getByRole("button", { name: "Создать и переместить" }).click();
  await expect(page.locator("[data-catalog-selection-toolbar]")).toHaveCount(0);
  await expect(page.getByText("E2E bulk перенос", { exact: true })).toBeVisible();
  for (const title of bulkTitles) {
    await expect(page.locator("[data-catalog-table-row]").filter({ hasText: title })).toHaveCount(0);
  }
  await page.getByText("E2E bulk перенос", { exact: true }).first().click();
  for (const title of bulkTitles) {
    await expect(page.locator("[data-catalog-table-row]").filter({ hasText: title })).toBeVisible();
  }
});

test("creates a destination while moving a section", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByRole("button", { name: "Действия с разделом Завтраки", exact: true }).click();
  await page.getByRole("menuitem", { name: "Переместить", exact: true }).hover();

  const moveDialog = page.getByRole("dialog", { name: "Переместить раздел" });
  await expect(moveDialog).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Переместить", exact: true })).toBeVisible();
  await moveDialog.getByRole("menuitem", { name: "Создать раздел…" }).click();
  await page.getByLabel("Название нового раздела").fill("E2E назначение раздела");
  await page.getByRole("button", { name: "Создать и переместить" }).click();
  await expect(page.getByText("Раздел перемещён в «E2E назначение раздела»", { exact: true })).toBeVisible();

  const destinationRow = page.getByRole("button", { name: "Раздел E2E назначение раздела", exact: true });
  await expect(destinationRow).toBeVisible();
  const destinationId = await destinationRow.getAttribute("data-tree-section-id");
  expect(destinationId).not.toBeNull();
  const breakfastParent = page.locator(`[data-tree-section-id="${breakfastSectionId}"]`).locator("xpath=ancestor::*[@data-section-parent-id][1]");
  await expect(breakfastParent).toHaveAttribute("data-section-parent-id", destinationId!);
});

test("uses one aligned workspace header and toolbar for every catalog table state", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?editorNav=unified");

  const readChrome = () => page.evaluate(() => {
    const rect = (target: Element | null) => {
      if (!target) return null;
      const box = target.getBoundingClientRect();
      return { left: box.left, right: box.right, top: box.top, bottom: box.bottom, width: box.width, height: box.height };
    };
    const tableHeader = document.querySelector("[data-catalog-table-header]");
    const emptyScaffold = document.querySelector("[data-empty-section-scaffold]");
    return {
      header: rect(document.querySelector("[data-catalog-workspace-table-header]")),
      gap: rect(document.querySelector("[data-catalog-workspace-table-gap]")),
      title: rect(document.querySelector("[data-catalog-workspace-table-title]")),
      create: rect(document.querySelector("[data-position-create-button], [data-subsection-create-button]")),
      toolbar: rect(document.querySelector("[data-catalog-table-toolbar]")),
      filter: rect(document.querySelector("[data-catalog-table-filter-trigger]")),
      tableHeader: rect(tableHeader),
      serviceCell: rect(tableHeader?.querySelector("span") ?? emptyScaffold?.querySelector("[data-catalog-utility-cell]") ?? null),
      emptyScaffold: rect(emptyScaffold),
    };
  });
  const expectSharedChrome = (chrome: Awaited<ReturnType<typeof readChrome>>) => {
    expect(chrome.header).toBeTruthy();
    expect(chrome.header!.height).toBe(54);
    expect(chrome.gap!.height).toBe(5);
    expect(chrome.title!.left - chrome.header!.left).toBe(16);
    expect(chrome.header!.right - chrome.create!.right).toBe(16);
    expect(chrome.gap!.left).toBe(chrome.header!.left);
    expect(chrome.gap!.right).toBe(chrome.header!.right);
    expect(chrome.gap!.top).toBe(chrome.header!.bottom);
    expect(chrome.toolbar!.left).toBe(chrome.header!.left);
    expect(chrome.toolbar!.right).toBe(chrome.header!.right);
    expect(chrome.toolbar!.top).toBe(chrome.gap!.bottom);
    expect(chrome.filter!.left - chrome.toolbar!.left).toBe(16);
    expect(chrome.serviceCell!.width).toBe(60);
  };

  await page.getByRole("button", { name: /^Раздел Завтраки/ }).click();
  const leaf = await readChrome();
  expectSharedChrome(leaf);
  expect(leaf.tableHeader!.top - leaf.toolbar!.bottom).toBe(6);

  await page.getByRole("button", { name: /^Раздел Кухня/ }).click();
  const parent = await readChrome();
  expectSharedChrome(parent);
  expect(parent.tableHeader!.top - parent.toolbar!.bottom).toBe(6);

  await page.getByRole("button", { name: /^Раздел Повреждение имущества/ }).click();
  const empty = await readChrome();
  expectSharedChrome(empty);
  expect(empty.emptyScaffold!.top - empty.toolbar!.bottom).toBe(6);

  await page.getByRole("button", { name: /^Все позиции \d+$/ }).click();
  const overview = await readChrome();
  expectSharedChrome(overview);
  expect(overview.tableHeader!.top - overview.toolbar!.bottom).toBe(6);
  await expect(page.locator("[data-catalog-overview-header-trigger]")).toContainText("Все позиции");
  await expect(page.locator("[data-position-create-button]")).toContainText("Новая позиция");
});

test("stretches the table across the available workspace while panels change", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();

  const showPreview = page.getByRole("button", { name: "Показать предпросмотр" });
  if (await showPreview.isVisible()) await showPreview.click();
  await expect(page.getByRole("button", { name: "Скрыть предпросмотр" })).toBeVisible();

  const readGeometry = () => page.evaluate(() => {
    const rect = (selector: string) => {
      const element = document.querySelector(selector);
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return { left: box.left, right: box.right, width: box.width };
    };
    return {
      workspace: rect("[data-catalog-workspace-layout]"),
      surface: rect("[data-position-editor-surface]"),
      results: rect("[data-catalog-results-scroll]"),
      card: rect("[data-catalog-items-card]"),
      toolbar: rect("[data-catalog-table-toolbar]"),
      header: rect("[data-catalog-table-header]"),
      body: rect("[data-catalog-table-body]"),
      actions: rect("[data-catalog-table-row] [data-catalog-table-actions]"),
      filler: rect("[data-catalog-table-row] [data-catalog-table-filler]"),
      position: rect("[data-catalog-table-row] [data-catalog-table-content-cell=position]"),
      weight: rect("[data-catalog-table-row] [data-catalog-table-content-cell=weight]"),
      price: rect("[data-catalog-table-row] [data-catalog-table-content-cell=price]"),
      peek: rect("[data-position-editor-pane]"),
    };
  });
  const expectTableEdges = (geometry: Awaited<ReturnType<typeof readGeometry>>, left: number, right: number) => {
    [geometry.results, geometry.card, geometry.toolbar, geometry.header, geometry.body].forEach((box) => {
      expect(box).toBeTruthy();
      expect(Math.abs(box!.left - left)).toBeLessThanOrEqual(1);
      expect(Math.abs(box!.right - right)).toBeLessThanOrEqual(1);
    });
    expect(Math.abs(geometry.actions!.right - right)).toBeLessThanOrEqual(1);
  };

  const previewOpen = await readGeometry();
  expectTableEdges(previewOpen, previewOpen.surface!.left, previewOpen.surface!.right);
  expect(previewOpen.filler!.width).toBeGreaterThan(0);
  expect(previewOpen.position!.width).toBe(231);
  expect(previewOpen.weight!.width).toBe(119);
  expect(previewOpen.price!.width).toBe(119);

  await page.getByRole("button", { name: "Скрыть предпросмотр" }).click();
  await expect(page.getByRole("button", { name: "Показать предпросмотр" })).toBeVisible();
  const previewClosed = await readGeometry();
  expectTableEdges(previewClosed, previewClosed.surface!.left, previewClosed.surface!.right);
  expect(previewClosed.card!.width).toBeGreaterThan(previewOpen.card!.width);
  expect(previewClosed.position!.width).toBe(231);
  expect(previewClosed.weight!.width).toBe(119);
  expect(previewClosed.price!.width).toBe(119);

  await page.getByRole("button", { name: "Свернуть разделы" }).click();
  const workspace = page.locator("[data-catalog-workspace-layout]");
  const sectionTree = page.locator("[data-catalog-tree-shell]");
  await expect(workspace).toHaveAttribute("data-catalog-tree-hidden", "true");
  await expect(sectionTree).toHaveCSS("width", "0px");
  const treeClosed = await readGeometry();
  expectTableEdges(treeClosed, treeClosed.workspace!.left, treeClosed.surface!.right);
  expect(treeClosed.card!.width).toBeGreaterThan(previewClosed.card!.width);

  await page.getByRole("button", { name: "Показать разделы" }).click();
  await expect(sectionTree).toHaveCSS("width", "250px");
  await page.getByRole("button", { name: "Показать предпросмотр" }).click();
  await expect(page.getByRole("button", { name: "Скрыть предпросмотр" })).toBeVisible();
  await page.locator("[data-catalog-table-row]").first().click();
  const pane = page.locator("[data-position-editor-pane]");
  await expect(pane).toBeVisible();
  await expect(pane).toHaveCSS("transform", "none");
  const peekOpen = await readGeometry();
  expectTableEdges(peekOpen, peekOpen.results!.left, peekOpen.peek!.left);

  await page.setViewportSize({ width: 1024, height: 720 });
  await expect(workspace).toHaveAttribute("data-catalog-tree-hidden", "true");
  await expect(sectionTree).toHaveCSS("width", "0px");
  const narrow = await readGeometry();
  expectTableEdges(narrow, narrow.surface!.left, narrow.peek!.left);
  expect(narrow.position!.width).toBe(231);
  expect(narrow.weight!.width).toBe(119);
  expect(narrow.price!.width).toBe(119);
});

test("keeps sibling sections grouped under their parent in the left tree", async ({ page }) => {
  await page.goto("/?editorNav=unified");

  const breakfastRow = page.getByRole("button", { name: "Раздел Завтраки", exact: true });
  const bakeryRow = page.getByRole("button", { name: "Раздел Выпечка", exact: true });
  const breakfastId = await breakfastRow.getAttribute("data-tree-section-id");
  const bakeryId = await bakeryRow.getAttribute("data-tree-section-id");
  expect(breakfastId && bakeryId).toBeTruthy();
  const beforeBreakfast = await breakfastRow.boundingBox();
  const beforeBakery = await bakeryRow.boundingBox();
  expect(beforeBreakfast && beforeBakery).toBeTruthy();
  expect(beforeBreakfast!.y).toBeLessThan(beforeBakery!.y);

  const breakfastParent = breakfastRow.locator("xpath=..");
  expect(await breakfastParent.getAttribute("data-section-parent-id")).toBeTruthy();
  expect(beforeBreakfast!.x).toBeGreaterThan(beforeBakery!.x - 1);
});

test("opens editor from a leaf and keeps the preview bridge mounted", async ({ page }) => {
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  await expect(pane).toBeVisible();
  await expect(pane).toHaveCSS("width", "400px");
  await expect(pane.getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` })).toHaveCSS("font-size", "14px");
  await expect(page.locator("[data-position-editor-overlay]")).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: firstItemTitle })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Основное" })).toBeVisible();
  await revealEditorQueueNavigation(page);
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Следующая позиция в выборке" })).toBeVisible();
  await expect(page.locator(`[data-catalog-table-row="${firstItemId}"]`)).toHaveAttribute("data-active-position", "true");
  await expect(page.getByText("Предпросмотр", { exact: true })).toBeVisible();
  await expect(page).toHaveURL(/\/\?editorNav=unified$/);

  const listWidthWhileEditing = (await page.locator("[data-catalog-items-card]").boundingBox())?.width ?? 0;
  await page.getByRole("button", { name: "Свернуть редактор" }).click();
  await expect(pane).toHaveCount(0);
  await expect(page.locator("[data-position-editor-surface]")).toHaveCSS("padding-right", "0px");
  const restoredListWidth = (await page.locator("[data-catalog-items-card]").boundingBox())?.width ?? 0;
  expect(Math.abs(restoredListWidth - listWidthWhileEditing)).toBeLessThanOrEqual(1);
});

test("keeps previous and next navigation inside the current editor selection", async ({ page }) => {
  await openItemFromLeaf(page);

  const previous = page.getByRole("button", { name: "Предыдущая позиция в выборке" });
  const next = page.getByRole("button", { name: "Следующая позиция в выборке" });
  await revealEditorQueueNavigation(page);
  await expect(previous).toBeDisabled();
  await expect(next).toBeEnabled();

  await next.click();
  await expect(page.getByRole("complementary", { name: firstItemTitle })).toHaveCount(0);
  await revealEditorQueueNavigation(page);
  await expect(previous).toBeEnabled();

  await previous.click();
  await expect(page.getByRole("complementary", { name: firstItemTitle })).toBeVisible();
});

test("switches the open detail pane from the visible list without closing it", async ({ page }) => {
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  const targetRow = page.locator("[data-catalog-table-row]").nth(2);
  const targetId = await targetRow.getAttribute("data-catalog-table-row");
  const targetTitle = (await targetRow.locator("[data-catalog-position-title]").textContent())?.trim();
  expect(targetId).toBeTruthy();
  expect(targetTitle).toBeTruthy();

  await targetRow.locator("[data-catalog-position-title]").click({ position: { x: 2, y: 8 } });

  await expect(pane).toBeVisible();
  await expect(page.getByRole("complementary", { name: targetTitle! })).toBeVisible();
  await expect(page.locator(`[data-catalog-table-row="${targetId}"]`)).toHaveAttribute("data-active-position", "true");
});

test("keeps price-volume order and renders optional fields inline in the side peek", async ({ page }) => {
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  await expect(pane.getByText("Добавить в", { exact: true })).toHaveCount(0);
  await expect(pane.locator("[data-position-availability-trigger]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Свернуть редактор" })).toBeVisible();

  const price = await pane.getByRole("textbox", { name: "Цена позиции" }).boundingBox();
  const volume = await pane.getByRole("textbox", { name: "Объем позиции" }).boundingBox();
  const optionalFields = pane.locator("[data-inline-optional-fields]");
  const discount = await optionalFields.getByRole("button", { name: "Добавить скидку" }).boundingBox();
  const optionalFieldsBox = await optionalFields.boundingBox();
  expect(price && volume && discount && optionalFieldsBox).toBeTruthy();
  expect(price!.x).toBeLessThan(volume!.x);
  expect(discount!.y).toBeGreaterThanOrEqual(optionalFieldsBox!.y);
  await expect(optionalFields).toContainText("КБЖУ");

  await openPositionEditorTab(page, pane, "Доступность");
  const availabilityEditor = pane.getByRole("radiogroup", { name: "Доступность позиции" });
  await expect(availabilityEditor).toBeVisible();
  await availabilityEditor.getByRole("radio", { name: /На стопе/ }).click();
  await expect(availabilityEditor.getByRole("radio", { name: /На стопе/ })).toBeChecked();

  await availabilityEditor.getByRole("radio", { name: "По расписанию", exact: true }).click();
  await expect(availabilityEditor.getByRole("radio", { name: "По расписанию", exact: true })).toBeChecked();

  await pane.getByRole("button", { name: /Действия с позицией/ }).click();
  await page.getByRole("menuitem", { name: "Архивировать", exact: true }).click();
  await expect(pane).toBeVisible();
  await expect(pane.getByText("Эти настройки недоступны для архивной позиции", { exact: true })).toBeVisible();
  const archivedModes = pane.getByRole("radiogroup", { name: "Доступность позиции" });
  await expect(archivedModes.getByRole("radio", { name: "Доступно", exact: true })).toBeDisabled();
  await expect(pane.getByRole("button", { name: "Вернуть из архива", exact: true })).toBeVisible();
  await pane.getByRole("button", { name: "Вернуть из архива", exact: true }).click();
  await expect(pane.getByText("Эти настройки недоступны для архивной позиции", { exact: true })).toHaveCount(0);
  await expect(pane.getByRole("radio", { name: "По расписанию", exact: true })).toBeChecked();
});

test("adapts position availability blocks and edits an individual day schedule", async ({ page }) => {
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  await openPositionEditorTab(page, pane, "Доступность");
  const modes = pane.getByRole("radiogroup", { name: "Доступность позиции" });

  await modes.getByRole("radio", { name: "Доступно", exact: true }).click();
  await expect(pane.getByRole("region", { name: "Расписание доступности" })).toHaveCount(0);
  await expect(pane.getByRole("region", { name: "Отображение в меню" })).toHaveCount(0);

  await modes.getByRole("radio", { name: "На стопе", exact: true }).click();
  await expect(pane.getByRole("region", { name: "Расписание доступности" })).toHaveCount(0);
  const stopDisplay = pane.getByRole("region", { name: "Отображение в меню" });
  await expect(stopDisplay).toBeVisible();
  await stopDisplay.getByRole("radio", { name: "Показывать без возможности заказа" }).click();
  await expect(stopDisplay.getByRole("radio", { name: "Показывать без возможности заказа" })).toBeChecked();

  await modes.getByRole("radio", { name: "По расписанию", exact: true }).click();
  const schedule = pane.getByRole("region", { name: "Расписание доступности" });
  await expect(schedule).toBeVisible();
  const unavailableBehavior = pane.getByRole("region", { name: "Отображение вне расписания" });
  await expect(unavailableBehavior).toBeVisible();
  await expect(unavailableBehavior.getByRole("radio", { name: "Скрывать из меню", exact: true })).toBeVisible();
  await expect(unavailableBehavior.getByRole("radio", { name: "Показывать без возможности заказа", exact: true })).toBeVisible();
  await expect(schedule.getByText("Понедельник", { exact: true })).toBeVisible();
  await expect(schedule.getByText("Воскресенье", { exact: true })).toBeVisible();
  await expect(schedule.getByText("Среда", { exact: true })).toHaveCSS("color", "rgb(166, 160, 155)");

  const tuesdayMode = schedule.getByRole("button", { name: "Вторник: режим расписания" });
  await expect(tuesdayMode.locator("svg")).toHaveCount(1);
  await tuesdayMode.click();
  await expect(page.getByRole("menuitemradio", { name: "Весь день", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: "По часам", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitemradio", { name: "Недоступно", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitemradio", { name: "Весь день", exact: true })).toHaveCount(0);
  await expect(pane).toBeVisible();
  await tuesdayMode.click();
  await page.getByRole("menuitemradio", { name: "Весь день", exact: true }).click();

  await schedule.getByRole("button", { name: "Среда: режим расписания" }).click();
  await page.getByRole("menuitemradio", { name: "По часам", exact: true }).click();
  await schedule.getByLabel("Среда: начало").fill("10:00");
  await schedule.getByLabel("Среда: конец").fill("19:00");
  await expect(schedule.getByLabel("Среда: начало")).toHaveValue("10:00");
  await expect(schedule.getByLabel("Среда: конец")).toHaveValue("19:00");

  await modes.getByRole("radio", { name: "На стопе", exact: true }).click();
  await expect(schedule).toHaveCount(0);
  await modes.getByRole("radio", { name: "По расписанию", exact: true }).click();
  await expect(pane.getByRole("region", { name: "Расписание доступности" }).getByLabel("Среда: начало")).toHaveValue("10:00");
});

test("updates the availability tab icon with the current position status", async ({ page }) => {
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  const availabilityTab = await openPositionEditorTab(page, pane, "Доступность");
  const availabilityTabIcon = availabilityTab.locator("[data-position-availability-tab-icon]");
  const modes = pane.getByRole("radiogroup", { name: "Доступность позиции" });

  await expect(availabilityTabIcon).toHaveAttribute("data-position-availability-tab-icon", "available");
  await modes.getByRole("radio", { name: "На стопе", exact: true }).click();
  await expect(availabilityTabIcon).toHaveAttribute("data-position-availability-tab-icon", "stopped");
  await modes.getByRole("radio", { name: "По расписанию", exact: true }).click();
  await expect(availabilityTabIcon).toHaveAttribute("data-position-availability-tab-icon", "schedule");
});

test("restores the previous stopped availability mode after archiving", async ({ page }) => {
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  const availabilityTab = await openPositionEditorTab(page, pane, "Доступность");
  const availabilityTabIcon = availabilityTab.locator("[data-position-availability-tab-icon]");
  const modes = pane.getByRole("radiogroup", { name: "Доступность позиции" });
  await modes.getByRole("radio", { name: "На стопе", exact: true }).click();
  await expect(availabilityTabIcon).toHaveAttribute("data-position-availability-tab-icon", "stopped");
  const display = pane.getByRole("region", { name: "Отображение в меню" });
  await display.getByRole("radio", { name: "Показывать без возможности заказа", exact: true }).click();

  await pane.getByRole("button", { name: /Действия с позицией/ }).click();
  await page.getByRole("menuitem", { name: "Архивировать", exact: true }).click();
  await expect(availabilityTabIcon).toHaveAttribute("data-position-availability-tab-icon", "archive");
  await expect(pane.getByText("Эти настройки недоступны для архивной позиции", { exact: true })).toBeVisible();
  await pane.getByRole("button", { name: "Вернуть из архива", exact: true }).click();

  await expect(pane.getByRole("radio", { name: "На стопе", exact: true })).toBeChecked();
  await expect(availabilityTabIcon).toHaveAttribute("data-position-availability-tab-icon", "stopped");
  await expect(pane.getByRole("region", { name: "Отображение в меню" }).getByRole("radio", { name: "Показывать без возможности заказа", exact: true })).toBeChecked();
});

test("configures card display with an instant mini and live preview", async ({ page }) => {
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  await openPositionEditorTab(page, pane, "Вид");

  const configurator = pane.locator("[data-position-display-configurator]");
  const miniCard = configurator.locator("[data-position-card-preview]");
  const livePreview = page.locator('[data-tour="preview-panel"]');
  const priceSwitch = configurator.getByRole("switch", { name: "Показывать цену", exact: true });
  const buttonSwitch = configurator.getByRole("switch", { name: "Показывать кнопку «Добавить»", exact: true });

  await expect(configurator).toBeVisible();
  await expect(miniCard).toContainText(firstItemTitle);
  await expect(priceSwitch).toBeChecked();
  await expect(buttonSwitch).toBeChecked();
  const priceText = (await miniCard.locator("[data-position-card-preview-price]").textContent())?.trim();
  expect(priceText).toBeTruthy();
  await expect(livePreview.getByText(priceText!, { exact: true })).toBeVisible();
  await expect(miniCard.locator("[data-position-card-preview-add]")).toBeVisible();
  await expect(livePreview.getByRole("button", { name: "В корзину", exact: true })).toBeVisible();

  await priceSwitch.click();
  await expect(priceSwitch).not.toBeChecked();
  await expect(buttonSwitch).not.toBeChecked();
  await expect(buttonSwitch).toBeDisabled();
  await expect(miniCard.locator("[data-position-card-preview-price]")).toHaveCount(0);
  await expect(miniCard.locator("[data-position-card-preview-add]")).toHaveCount(0);
  await expect(livePreview.getByText(priceText!, { exact: true })).toHaveCount(0);
  await expect(livePreview.getByRole("button", { name: "В корзину", exact: true })).toHaveCount(0);

  await priceSwitch.click();
  await expect(miniCard.locator("[data-position-card-preview-price]")).toHaveText(priceText!);
  await expect(miniCard.locator("[data-position-card-preview-add]")).toHaveCount(0);
  await expect(livePreview.getByText(priceText!, { exact: true })).toBeVisible();

  await buttonSwitch.click();
  await expect(miniCard.locator("[data-position-card-preview-add]")).toBeVisible();
  await expect(livePreview.getByRole("button", { name: "В корзину", exact: true })).toBeVisible();
});

test("toggles manual recommendations instantly in an anchored popover", async ({ page }) => {
  test.setTimeout(30_000);
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  await pane.getByRole("button", { name: "Рекомендации", exact: true }).click();
  const recommendations = pane.locator('[data-upsell-card="recommendations"]');
  const trigger = recommendations.getByRole("button", { name: "Добавить вручную", exact: true });
  await trigger.click();

  const picker = page.locator("[data-recommendation-picker]");
  await expect(picker).toBeVisible();
  await expect(picker).not.toHaveAttribute("aria-modal", "true");
  await expect(page.getByRole("dialog", { name: "Добавить рекомендуемые позиции" })).toHaveCount(0);
  await expect(page.locator(".fixed.inset-0.bg-black\\/20")).toHaveCount(0);
  await expect(picker.getByText("Добавить рекомендуемые позиции", { exact: true })).toHaveCount(0);
  await expect(picker.getByText("Рекомендовать позиции друг друга", { exact: true })).toHaveCount(0);
  await expect(picker.getByText(/^Выбрано:/)).toHaveCount(0);
  await expect(picker.getByRole("button", { name: "Отмена", exact: true })).toHaveCount(0);
  await expect(picker.getByRole("button", { name: "Добавить", exact: true })).toHaveCount(0);
  await expect(picker.getByRole("checkbox", { name: `Рекомендовать «${firstItemTitle}»` })).toHaveCount(0);

  const firstCheckbox = picker.getByRole("checkbox").first();
  const firstRow = firstCheckbox.locator("xpath=..");
  const checkboxName = await firstCheckbox.getAttribute("aria-label");
  expect(checkboxName).toBeTruthy();
  const candidateTitle = checkboxName!.replace(/^Рекомендовать «|»$/g, "");

  await firstRow.click();
  await expect(firstCheckbox).toBeChecked();
  await expect(picker).toBeVisible();
  await expect(recommendations.getByText(candidateTitle, { exact: true })).toBeVisible();

  await firstRow.click();
  await expect(firstCheckbox).not.toBeChecked();
  await expect(recommendations.getByText(candidateTitle, { exact: true })).toHaveCount(0);

  await firstRow.click();
  await page.keyboard.press("Escape");
  await expect(picker).toHaveCount(0);
  await trigger.click();
  const reopenedPicker = page.locator("[data-recommendation-picker]").filter({ visible: true });
  await expect(reopenedPicker.getByRole("checkbox", { name: checkboxName! }).first()).toBeChecked();

  await page.keyboard.press("Escape");
  await page.waitForTimeout(700);
  await preserveLocalStorageOnReload(page);
  await openItemFromLeaf(page);
  await pane.getByRole("button", { name: "Рекомендации", exact: true }).click();
  await recommendations.getByRole("button", { name: "Добавить вручную", exact: true }).click();
  await expect(page.locator("[data-recommendation-picker]").filter({ visible: true }).getByRole("checkbox", { name: checkboxName! }).first()).toBeChecked();
});

test("edits and removes a discount in a compact popover", async ({ page }) => {
  await openEntityItem(page);

  const pane = page.locator("[data-position-editor-pane]");
  const addDiscount = pane.getByRole("button", { name: "Добавить скидку", exact: true });
  const basePrice = Number((await pane.getByLabel("Цена позиции").inputValue()).replace(/\s/g, ""));
  await expect(addDiscount).toBeVisible();
  await addDiscount.click();
  await expect(page.getByLabel("Размер скидки")).toBeVisible();
  await expect(page.getByLabel("Цена после скидки")).toBeVisible();

  await page.getByLabel("Размер скидки").fill("10");
  await expect.poll(async () => (await page.getByLabel("Цена после скидки").inputValue()).replace(/\s/g, "")).toBe(String(Math.round(basePrice * 0.9)));
  await expect(pane.locator("[data-discount-trigger]")).toContainText("−10%");
  await expect(pane.locator("[data-discount-badge]")).toContainText("−10%");
  await expect(pane.locator("[data-discount-trigger]")).not.toContainText("итог");
  await page.keyboard.press("Escape");
  await expect(page.getByLabel("Цена после скидки")).toHaveCount(0);
  await expect(pane).toBeVisible();

  await pane.getByRole("button", { name: "Убрать скидку", exact: true }).click();
  await expect(pane.getByRole("button", { name: "Добавить скидку", exact: true })).toBeVisible();
  await expect(page.getByLabel("Цена после скидки")).toHaveCount(0);
});

test("combines recommendation title search and section filtering in a compact scrolling list", async ({ page }) => {
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  await pane.getByRole("button", { name: "Рекомендации", exact: true }).click();
  const trigger = pane.getByRole("button", { name: "Добавить вручную", exact: true });
  await trigger.click();

  const picker = page.locator("[data-recommendation-picker]").filter({ visible: true });
  const rows = picker.locator("[data-recommendation-picker-row]");
  const list = picker.locator("[data-recommendation-picker-list]");
  await expect(picker).toHaveCSS("width", "372px");
  await expect(rows.first()).toHaveCSS("height", "38px");
  await expect(rows.first().getByRole("checkbox")).toHaveCSS("width", "16px");
  await expect(rows.first().locator("img")).toHaveCSS("width", "20px");
  await expect(rows.first().locator("img")).toHaveCSS("height", "20px");
  await expect(rows.first().locator("span[title]")).toHaveCSS("font-size", "13px");
  await expect(rows.first().locator("span[title]")).toHaveCSS("font-weight", "400");
  await expect(list.evaluate((element) => element.scrollHeight > element.clientHeight)).resolves.toBe(true);
  await expect(picker).toHaveAttribute("data-side", /^(top|bottom)$/);

  const longTitle = "Хрустящая булка с жаренным цыпленком";
  const longTitleElement = rows.getByTitle(longTitle).first();
  await expect(longTitleElement).toHaveCSS("text-overflow", "ellipsis");

  await picker.getByRole("button", { name: "Фильтр по разделу" }).click();
  await page.getByRole("menuitem", { name: "Выпечка", exact: true }).click();
  await expect(picker).toBeVisible();
  await expect(rows).toHaveCount(7);

  const duplicatedTitle = "Хрустящая булка с говяжьей колбаской";
  await picker.getByRole("textbox", { name: "Найти позицию" }).fill(duplicatedTitle);
  await expect(rows).toHaveCount(1);
  await expect(rows.first()).toContainText(duplicatedTitle);

  await picker.getByRole("textbox", { name: "Найти позицию" }).fill("Мини-самса");
  await expect(rows).toHaveCount(2);
  await expect(rows.first()).toContainText("Мини-самса");
});

test("keeps the side peek open through outside interaction and closes it explicitly", async ({ page }) => {
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  await page.getByText("Предпросмотр", { exact: true }).click();
  await expect(pane).toBeVisible();

  await page.locator(`[data-catalog-table-row="${firstItemId}"]`).click({ position: { x: 12, y: 19 } });
  await expect(pane).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(pane).toHaveCount(0);
});

test("resizes the side peek while the table fills the remaining workspace", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto("/?editorNav=unified");
  await page.evaluate(() => window.localStorage.removeItem("tasko.catalog.positionSidePeek.width.v1"));
  await page.reload();
  const collapseMainMenu = page.getByRole("button", { name: "Свернуть меню", exact: true });
  if (await collapseMainMenu.isVisible()) {
    await collapseMainMenu.click();
    await expect(page.getByRole("button", { name: "Развернуть меню", exact: true })).toBeVisible();
  }
  await page.getByText("Завтраки", { exact: true }).first().click();

  const card = page.locator("[data-catalog-items-card]");
  const preview = page.locator('[data-tour="preview-panel"]');
  const row = page.locator(`[data-catalog-table-row="${firstItemId}"]`);
  const before = await Promise.all([card.boundingBox(), preview.boundingBox()]);

  await row.click();
  const pane = page.locator("[data-position-editor-pane]");
  await expect(pane).toHaveCSS("width", "470px");
  await expect(page.getByText("Вес", { exact: true })).toHaveCount(1);
  await expect(page.getByText("Описание", { exact: true }).first()).toBeAttached();
  await expect(page.getByText("Цена", { exact: true }).first()).toBeAttached();

  const opened = await Promise.all([card.boundingBox(), preview.boundingBox(), pane.boundingBox()]);
  expect(Math.abs(opened[0]!.width - (before[0]!.width - opened[2]!.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(opened[0]!.x + opened[0]!.width - opened[2]!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(opened[1]!.x - before[1]!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(opened[1]!.width - before[1]!.width)).toBeLessThanOrEqual(1);

  const resizeHandle = page.getByRole("separator", { name: "Изменить ширину редактора" });
  const handleBox = await resizeHandle.boundingBox();
  expect(handleBox).toBeTruthy();
  await page.mouse.move(handleBox!.x + handleBox!.width / 2, handleBox!.y + 80);
  await page.mouse.down();
  await page.mouse.move(handleBox!.x - 40, handleBox!.y + 80, { steps: 4 });
  await page.mouse.up();
  const resizedPane = await pane.boundingBox();
  expect(resizedPane).toBeTruthy();
  expect(resizedPane!.width).toBeGreaterThanOrEqual(opened[2]!.width + 35);
  expect(resizedPane!.width).toBeLessThanOrEqual(opened[2]!.width + 50);

  const resized = await Promise.all([card.boundingBox(), preview.boundingBox()]);
  expect(Math.abs(resized[0]!.width - (before[0]!.width - resizedPane!.width))).toBeLessThanOrEqual(1);
  expect(Math.abs(resized[0]!.x + resized[0]!.width - resizedPane!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(resized[1]!.x - before[1]!.x)).toBeLessThanOrEqual(1);
  const persistedWidth = await page.evaluate(() =>
    window.localStorage.getItem("tasko.catalog.positionSidePeek.width.v1"),
  );
  expect(Number(persistedWidth)).toBe(Math.round(resizedPane!.width));

  await page.getByRole("button", { name: "Свернуть редактор" }).click();
  await expect(pane).toHaveCount(0);
  await row.click();
  const restoredPane = await page.locator("[data-position-editor-pane]").boundingBox();
  expect(restoredPane).toBeTruthy();
  expect(Math.abs(restoredPane!.width - Number(persistedWidth))).toBeLessThanOrEqual(1);
});

test("uses the wider responsive side-peek default from 1400px", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await openItemFromLeaf(page);
  await expect(page.locator("[data-position-editor-pane]")).toHaveCSS("width", "470px");
});

test("supports the 310px side-peek minimum with responsive tab overflow", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 760 });
  await page.goto("/?editorNav=unified");
  await page.evaluate(() => window.localStorage.setItem("tasko.catalog.positionSidePeek.width.v1", "310"));
  await page.getByText("Завтраки", { exact: true }).first().click();
  await page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle }).click();

  const pane = page.locator("[data-position-editor-pane]");
  await expect(pane).toHaveCSS("width", "310px");
  await expect(page.getByRole("separator", { name: "Изменить ширину редактора" })).toHaveAttribute("aria-valuemin", "310");
  const tabs = pane.locator("[data-workspace-local-tabs]");
  await expect(tabs).toHaveCSS("height", "41px");
  const overflowTab = tabs.getByRole("button", { name: /^Еще \d+$/ });
  await expect(overflowTab).toBeVisible();

  await overflowTab.click();
  await page.getByRole("menuitem", { name: "Вид", exact: true }).click();

  await expect(overflowTab).toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("button", { name: "Основное", exact: true })).not.toHaveAttribute("aria-current", "page");
  await expect(tabs.getByRole("button", { name: "Вид", exact: true })).not.toBeVisible();
});

test("returns from an all-positions editor with the same search context", async ({ page }) => {
  await openItemFromAllPositions(page);

  await page.getByRole("button", { name: /^Все позиции/ }).click();

  await expect(page.getByPlaceholder("Поиск по названию")).toHaveValue("Омлет");
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle })).toBeVisible();
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

test("keeps the current autosave UI stable and restores the saved description", async ({ page }) => {
  await openEntityItem(page);
  const description = page.getByRole("textbox", { name: "Описание" });

  await description.fill("Baseline browser smoke");
  await expect(description).toContainText("Baseline browser smoke");
  await page.waitForTimeout(650);
  await expect(page.getByRole("button", { name: "Основное" })).toBeVisible();

  await preserveLocalStorageOnReload(page);
  await page.reload();
  const reloadedDescription = page.getByRole("textbox", { name: "Описание" });
  await expect(reloadedDescription).toHaveText("Baseline browser smoke");
});

test("live-updates preview and swaps autosave status for hover navigation", async ({ page }) => {
  await openEntityItem(page);

  const pane = page.locator("[data-position-editor-pane]");
  const price = pane.getByLabel("Цена позиции");
  await price.fill("2450");

  await expect(pane.getByText("Сохраняем", { exact: true })).toBeVisible();
  await expect(page.locator('[data-tour="preview-panel"]')).toContainText("2 450 ₸");
  await expect(pane.getByText("Сохранено", { exact: true })).toBeVisible();

  await revealEditorQueueNavigation(page);
  await expect(pane.getByText("Сохранено", { exact: true })).toBeHidden();
  await expect(pane.getByRole("button", { name: "Предыдущая позиция в выборке" })).toBeVisible();
  await expect(pane.getByRole("button", { name: "Следующая позиция в выборке" })).toBeVisible();
});

test("persists the complete basic position editor record across reload", async ({ page }) => {
  await openEntityItem(page);
  const pane = page.locator("[data-position-editor-pane]");

  await page.getByLabel("Цена позиции").fill("2450");
  await page.getByLabel("Цена позиции").blur();
  await page.getByLabel("Объем позиции").fill("350");
  await page.getByLabel("Объем позиции").blur();
  await page.getByRole("textbox", { name: "Описание" }).fill("Сохраняемое описание позиции");
  await page.getByRole("button", { name: "Добавить скидку" }).click();
  await page.getByLabel("Цена после скидки").fill("1990");
  await page.getByLabel("Цена после скидки").blur();
  await page.getByRole("button", { name: "Добавить КБЖУ" }).click();
  await page.getByLabel("Калорийность").fill("560");
  await openPositionEditorTab(page, pane, "Вид");
  await page.getByRole("switch", { name: "Показывать кнопку «Добавить»" }).click();
  await page.waitForTimeout(700);
  await openPositionEditorTab(page, pane, "Основное");
  const expectedDiscountValue = await page.evaluate((itemId) => {
    const records = JSON.parse(window.localStorage.getItem("tasko.catalog.itemRecords") ?? "{}");
    return String(records[itemId]?.priceWithSale ?? "");
  }, firstItemId);

  await preserveLocalStorageOnReload(page);
  await page.reload();
  await page.locator("[data-composition-title=true]").filter({ hasText: firstItemTitle }).click();
  await expect.poll(async () => (await page.getByLabel("Цена позиции").inputValue()).replace(/\s/g, "")).toBe("2450");
  await expect(page.getByLabel("Объем позиции")).toHaveValue("350");
  await expect(page.getByRole("textbox", { name: "Описание" })).toHaveText("Сохраняемое описание позиции");
  await expect(page.getByRole("button", { name: "Добавить КБЖУ" })).toHaveCount(0);
  await expect(page.getByLabel("Калорийность")).toHaveValue("560");
  const discountTrigger = page.locator("[data-discount-trigger]");
  await expect(discountTrigger).toContainText("−");
  await discountTrigger.click();
  await expect.poll(async () => (await page.getByLabel("Цена после скидки").inputValue()).replace(/\s/g, "")).toBe(expectedDiscountValue);
  await openPositionEditorTab(page, page.locator("[data-position-editor-pane]"), "Вид");
  await expect(page.getByRole("switch", { name: "Показывать кнопку «Добавить»" })).not.toBeChecked();
});

test("uses the position title chevron for actions and preserves queue plus destructive semantics", async ({ page }) => {
  await openEntityItem(page);

  const actionTrigger = page.getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` });
  await expect(actionTrigger).toBeVisible();
  await expect(page.getByRole("button", { name: "Действия с позицией", exact: true })).toHaveCount(0);
  await expect(actionTrigger).toHaveCSS("max-width", "280px");

  await actionTrigger.click();
  await expect(page.getByRole("menuitem", { name: "Переместить", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Архивировать", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("menuitem", { name: "Архивировать", exact: true })).toHaveCount(0);

  await actionTrigger.click();
  await page.getByRole("menuitem", { name: "Переместить", exact: true }).hover();
  await expect(page.getByRole("dialog", { name: "Переместить в раздел" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Переместить в раздел" })).toHaveCount(0);

  await actionTrigger.click();
  await page.getByRole("menuitem", { name: "Архивировать", exact: true }).click();
  await expect.poll(async () => page.getByRole("button", { name: /Действия с позицией «/ }).count()).toBe(1);
  await page.getByRole("button", { name: /Действия с позицией «/ }).click();
  await page.getByRole("menuitem", { name: "Удалить навсегда", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Удалить позицию навсегда?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Удалить позицию навсегда?" })).toHaveCount(0);

  await openItemFromLeaf(page);
  await revealEditorQueueNavigation(page);
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).toBeVisible();
  await page.getByRole("button", { name: "Следующая позиция в выборке" }).click();
  await expect(page.getByRole("button", { name: /Действия с позицией «/ })).toHaveCount(1);
});

test("restores structured promo, options, and availability editor state", async ({ page }) => {
  await openEntityItem(page);
  const pane = page.locator("[data-position-editor-pane]");

  await page.getByRole("button", { name: "Рекомендации" }).click();
  await page.getByRole("button", { name: "Добавить стикер", exact: true }).click();
  const inlineStickerInput = page.getByRole("textbox", { name: "Название нового стикера" });
  if (await inlineStickerInput.count()) {
    await inlineStickerInput.fill("Хит");
    await inlineStickerInput.press("Enter");
  } else {
    const sharedStickerSearch = page.getByPlaceholder("Найти или создать стикер");
    await sharedStickerSearch.fill("Хит");
    await sharedStickerSearch.press("Enter");
  }
  await expect(page.locator("[data-position-editor-pane]").getByText("Хит", { exact: true }).first()).toBeVisible();

  await openPositionEditorTab(page, pane, "Опции");
  await page.getByRole("button", { name: "Добавить опцию", exact: true }).click();
  await page.getByLabel("Название опции").fill("Размер порции");
  await page.keyboard.press("Escape");
  await expect(page.getByText("Размер порции", { exact: true })).toBeVisible();

  await openPositionEditorTab(page, pane, "Доступность");
  const schedule = page.getByRole("radio", { name: /По расписанию/ });
  await schedule.click();
  const availability = page.getByRole("region", { name: "Расписание доступности" });
  await availability.getByRole("button", { name: "Понедельник: режим расписания" }).click();
  await page.getByRole("menuitemradio", { name: "По часам", exact: true }).click();
  await availability.getByLabel("Понедельник: начало").fill("10:00");
  await availability.getByLabel("Понедельник: конец").fill("19:00");
  await page.waitForTimeout(350);

  await preserveLocalStorageOnReload(page);
  await page.reload();

  await page.locator("[data-composition-title=true]").filter({ hasText: firstItemTitle }).click();
  const reloadedPane = page.locator("[data-position-editor-pane]");
  await expect(reloadedPane).toBeVisible();
  await reloadedPane.getByRole("button", { name: "Рекомендации", exact: true }).click();
  await expect(reloadedPane.getByText("Хит", { exact: true }).first()).toBeVisible();
  await openPositionEditorTab(page, reloadedPane, "Опции");
  await expect(page.getByText("Размер порции", { exact: true })).toBeVisible();
  await openPositionEditorTab(page, reloadedPane, "Доступность");
  await expect(page.getByRole("radio", { name: /По расписанию/ })).toBeChecked();
  await expect(page.getByRole("region", { name: "Расписание доступности" }).getByLabel("Понедельник: начало")).toHaveValue("10:00");
  await expect(page.getByRole("region", { name: "Расписание доступности" }).getByLabel("Понедельник: конец")).toHaveValue("19:00");
});

test("edits option groups in compact option popovers", async ({ page }) => {
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  await openPositionEditorTab(page, pane, "Опции");
  await pane.getByRole("button", { name: "Добавить опцию", exact: true }).click();

  const optionPopover = page.locator("[data-option-popover]");
  await expect(optionPopover).toBeVisible();
  await expect(optionPopover.getByLabel("Название опции")).toBeFocused();
  await expect(optionPopover.getByLabel("Название опции")).toHaveValue("Новая опция");
  await expect.poll(async () => optionPopover.getByLabel("Название опции").evaluate((input) => ({
    start: input.selectionStart,
    end: input.selectionEnd,
  }))).toEqual({ start: 0, end: "Новая опция".length });
  await expect(optionPopover.getByRole("tab", { name: "Варианты", exact: true })).toBeVisible();
  await expect(optionPopover.getByRole("tab", { name: "Настройки", exact: true })).toBeVisible();
  await expect(optionPopover.getByRole("button", { name: "Удалить опцию", exact: true })).toBeVisible();

  await optionPopover.getByLabel("Название опции").fill("Добавки");
  await optionPopover.getByRole("tab", { name: "Варианты", exact: true }).click();
  await optionPopover.getByRole("button", { name: "Добавить вариант", exact: true }).click();
  await expect(optionPopover.getByLabel("Название варианта")).toHaveCount(1);
  await optionPopover.getByLabel("Название варианта").press("Escape");
  await expect(optionPopover).toHaveCount(0);
  await pane.getByRole("button", { name: "Редактировать группу «Добавки»" }).click();
  await expect(optionPopover.getByLabel("Название варианта")).toHaveCount(0);
  await optionPopover.getByRole("button", { name: "Добавить вариант", exact: true }).click();
  await optionPopover.getByLabel("Название варианта").blur();
  await expect(optionPopover.getByLabel("Название варианта")).toHaveCount(0);
  await optionPopover.getByRole("button", { name: "Добавить вариант", exact: true }).click();
  await optionPopover.getByLabel("Название варианта").fill("Сыр");
  await expect(optionPopover.getByLabel("Название варианта")).toHaveValue("Сыр");
  await optionPopover.getByLabel("Стоимость варианта").fill("500");

  await optionPopover.getByRole("tab", { name: "Настройки", exact: true }).click();
  await optionPopover.getByRole("switch", { name: "Обязательный выбор" }).click();
  await expect(optionPopover.getByRole("switch", { name: "Обязательный выбор" })).toBeChecked();
  await optionPopover.getByRole("button", { name: "Несколько", exact: true }).click();
  await optionPopover.getByRole("button", { name: "Доплата", exact: true }).click();

  await page.keyboard.press("Escape");
  await expect(page.locator("[data-option-popover]")).toHaveCount(0);
  await expect(pane.getByRole("button", { name: "Редактировать группу «Добавки»" })).toBeVisible();

  await pane.getByRole("button", { name: "Добавить опцию", exact: true }).click();
  await expect(page.locator("[data-option-popover]")).toHaveCount(1);
  await expect(pane.getByRole("button", { name: "Редактировать группу «Добавки»" })).toBeVisible();
  await page.locator("[data-option-popover]").getByLabel("Название опции").fill("Соусы");
  await page.keyboard.press("Escape");

  await expect(pane.getByRole("button", { name: "Редактировать группу «Добавки»" })).toBeVisible();
  await expect(pane.getByRole("button", { name: "Редактировать группу «Соусы»" })).toBeVisible();

  const groupHandles = pane.getByRole("button", { name: /Перетащить опцию/ });
  await groupHandles.first().focus();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("Space");
  await expect(pane.getByRole("button", { name: /Редактировать группу «Соусы»/ }).first()).toBeVisible();

  await pane.getByRole("button", { name: "Редактировать группу «Добавки»" }).click();
  await page.locator("[data-option-popover]").getByRole("button", { name: "Удалить опцию", exact: true }).click();
  const deleteDialog = page.getByRole("alertdialog");
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Удалить", exact: true }).click();
  await expect(pane.getByRole("button", { name: "Редактировать группу «Добавки»" })).toHaveCount(0);
});

test("keeps option variants editable, reorderable, and scrollable", async ({ page }) => {
  test.setTimeout(30_000);
  await openItemFromLeaf(page);

  const pane = page.locator("[data-position-editor-pane]");
  await openPositionEditorTab(page, pane, "Опции");
  await pane.getByRole("button", { name: "Добавить опцию", exact: true }).click();

  const optionPopover = page.locator("[data-option-popover]");
  await optionPopover.getByLabel("Название опции").fill("Размер");
  await optionPopover.getByRole("tab", { name: "Варианты", exact: true }).click();

  for (let index = 1; index <= 8; index += 1) {
    await optionPopover.getByRole("button", { name: /Добавить(?: еще)? вариант/ }).last().click();
    const nameInput = optionPopover.getByLabel("Название варианта").last();
    await nameInput.fill(`${index}0см`);
    await optionPopover.getByLabel("Стоимость варианта").last().fill(String(index * 100));
    await nameInput.blur();
  }

  const variantsList = optionPopover.locator("[data-option-variants-list]");
  await expect(optionPopover.getByLabel("Название варианта")).toHaveCount(8);
  await expect(variantsList).toHaveCSS("max-height", "260px");
  await expect(variantsList.evaluate((element) => element.scrollHeight > element.clientHeight)).resolves.toBe(true);

  const firstHandle = optionPopover.getByRole("button", { name: /Перетащить вариант/ }).first();
  await firstHandle.focus();
  await expect(firstHandle).toBeFocused();
  await page.keyboard.press("Space");
  await page.keyboard.press("ArrowDown");
  await page.waitForTimeout(100);
  await page.keyboard.press("Space");
  await expect(optionPopover.getByLabel("Название варианта").first()).toHaveValue("20см");

  await optionPopover.getByRole("button", { name: "Удалить вариант" }).last().click();
  await expect(optionPopover.getByLabel("Название варианта")).toHaveCount(7);

  await page.keyboard.press("Escape");
  const optionRow = pane.getByRole("button", { name: "Редактировать группу «Размер»" });
  await expect(optionRow).toContainText("20см");

  await optionRow.click();
  const reopenedPopover = page.locator("[data-option-popover]");
  await expect(reopenedPopover.getByLabel("Название опции")).toHaveValue("Размер");
  await expect(reopenedPopover.getByLabel("Название варианта")).toHaveCount(7);
  await page.keyboard.press("Escape");
  await expect(page.locator("[data-option-popover]")).toHaveCount(0);
  await expect(pane).toBeVisible();

  await optionRow.click();
  await expect(page.locator("[data-option-popover]")).toBeVisible();
  await page.waitForTimeout(100);
  await page.mouse.click(20, 20);
  await expect(page.locator("[data-option-popover]")).toHaveCount(0);
});

test("does not leak editor values between queued positions", async ({ page }) => {
  await openItemFromLeaf(page);
  const firstDescription = page.getByRole("textbox", { name: "Описание" });
  await firstDescription.fill("Описание позиции A");
  await page.getByLabel("Цена позиции").fill("3100");
  await page.getByLabel("Цена позиции").blur();
  await page.waitForTimeout(500);

  await revealEditorQueueNavigation(page);
  await page.getByRole("button", { name: "Следующая позиция в выборке" }).click();
  await expect(page.getByRole("textbox", { name: "Описание" })).not.toHaveText("Описание позиции A");
  await page.getByRole("textbox", { name: "Описание" }).fill("Описание позиции B");
  await page.getByLabel("Цена позиции").fill("4200");
  await page.getByLabel("Цена позиции").blur();
  await page.waitForTimeout(500);

  await revealEditorQueueNavigation(page);
  await page.getByRole("button", { name: "Предыдущая позиция в выборке" }).click();
  await expect(page.getByRole("textbox", { name: "Описание" })).toHaveText("Описание позиции A");
  await expect.poll(async () => (await page.getByLabel("Цена позиции").inputValue()).replace(/\s/g, "")).toBe("3100");
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
  await expect(page.locator('[id^="DndLiveRegion"]').last()).toContainText(`section:${bakerySectionId}`);
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

test("uses the section chevron for actions and creates a subsection from the workspace", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByText("Кухня", { exact: true }).first().click();

  const sectionActions = page.getByRole("button", { name: "Действия с разделом «Кухня»" });
  await expect(sectionActions).toBeVisible();
  await expect(page.getByRole("button", { name: "Действия с разделом", exact: true })).toHaveCount(0);
  await sectionActions.click();
  await page.getByRole("menuitem", { name: "Добавить подраздел" }).click();
  const menuInlineName = page.getByPlaceholder("Название подраздела...");
  await expect(menuInlineName).toBeFocused();
  await menuInlineName.press("Escape");
  await expect(menuInlineName).toHaveCount(0);

  await page.getByRole("button", { name: "Новый подраздел" }).click();
  const inlineName = page.getByPlaceholder("Название подраздела...");
  await expect(inlineName).toBeFocused();
  await inlineName.fill("Сезонное меню");
  await inlineName.press("Enter");
  await expect(page.getByText("Сезонное меню", { exact: true }).first()).toBeVisible();
});

test("opens compact section rename and icon overlays from the section chevron", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByText("Кухня", { exact: true }).first().click();

  const sectionActions = page.getByRole("button", { name: "Действия с разделом «Кухня»" });
  await sectionActions.click();
  await expect(page.getByRole("menuitem", { name: "Переместить…" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Переименовать…" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Сменить иконку…" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Архивировать", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Удалить", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Настройки раздела", exact: true })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Показывать на витрине", exact: true })).toHaveCount(0);
  await expect(page.getByRole("menuitem", { name: "Доступен для заказа", exact: true })).toHaveCount(0);

  await page.getByRole("menuitem", { name: "Доступность" }).click();
  await expect(page.getByRole("menuitem", { name: "Доступно", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Показывать «Скоро будет»", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Скрыть", exact: true })).toBeVisible();

  await page.getByRole("menuitem", { name: "Переименовать…" }).click();
  const renameDialog = page.getByRole("dialog", { name: "Переименовать раздел" });
  await expect(renameDialog.getByLabel("Название раздела на Русский")).toHaveValue("Кухня");
  await expect(renameDialog.getByLabel("Название раздела на Қазақша")).toBeVisible();
  await expect(renameDialog.getByLabel("Название раздела на English")).toBeVisible();
  await expect(renameDialog.getByLabel("Название раздела на Srpski")).toBeVisible();
  await renameDialog.getByLabel("Название раздела на Русский").fill("Кухня обновлённая");
  await renameDialog.getByLabel("Название раздела на Қазақша").fill("Жаңартылған ас үй");
  await renameDialog.getByRole("button", { name: "Готово" }).click();
  await expect(page.getByText("Кухня обновлённая", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Действия с разделом «Кухня обновлённая»" }).click();
  await page.getByRole("menuitem", { name: "Переименовать…" }).click();
  const reopenedRenameDialog = page.getByRole("dialog", { name: "Переименовать раздел" });
  await expect(reopenedRenameDialog.getByLabel("Название раздела на Русский")).toHaveValue("Кухня обновлённая");
  await expect(reopenedRenameDialog.getByLabel("Название раздела на Қазақша")).toHaveValue("Жаңартылған ас үй");
  await reopenedRenameDialog.getByRole("button", { name: "Готово" }).click();

  await preserveLocalStorageOnReload(page);
  await page.reload();
  await expect(page.getByText("Кухня обновлённая", { exact: true }).first()).toBeVisible();
  await page.getByText("Кухня обновлённая", { exact: true }).first().click();

  await page.getByRole("button", { name: "Действия с разделом «Кухня обновлённая»" }).click();
  await page.getByRole("menuitem", { name: "Сменить иконку…" }).click();
  const iconDialog = page.getByRole("dialog", { name: "Сменить иконку раздела" });
  await expect(iconDialog.getByRole("button", { name: "Выбрать изображение" })).toBeVisible();
  await iconDialog.locator("input[type=file]").setInputFiles({
    name: "section.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=", "base64"),
  });
  await expect(iconDialog).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Изменить иконку" }).first().locator("img")).toBeVisible();
  await expect.poll(async () => page.evaluate(() => Object.values(localStorage).some((value) => value.includes("Жаңартылған ас үй")))).toBe(true);

  await page.reload();
  await page.getByText("Кухня обновлённая", { exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Изменить иконку" }).first().locator("img")).toBeVisible();
});

test("uses the shared compact bulk toolbar for subsection selection", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByText("Кухня", { exact: true }).first().click();

  const breakfastCheckbox = page.getByRole("checkbox", { name: "Выбрать подраздел Завтраки" });
  await breakfastCheckbox.check();
  const toolbar = page.locator("[data-subsection-bulk-toolbar]");
  await expect(toolbar).toContainText("1 выбрано");
  await expect(toolbar.getByRole("button", { name: "Доступность" })).toHaveCount(0);
  await expect(toolbar.getByRole("button", { name: "Переместить", exact: true })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Ещё действия" })).toBeVisible();
  await expect(toolbar.getByRole("button", { name: "Снять выделение" })).toBeVisible();

  await toolbar.getByRole("button", { name: "Ещё действия" }).click();
  await expect(page.getByRole("menuitem", { name: "Архивировать", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Удалить", exact: true })).toBeVisible();
  await page.keyboard.press("Escape");

  await toolbar.getByRole("button", { name: "Ещё действия" }).click();
  await page.getByRole("menuitem", { name: "Удалить", exact: true }).click();
  const deleteDialog = page.getByRole("dialog", { name: "Удалить подразделы" });
  await expect(deleteDialog).toBeVisible();
  await deleteDialog.getByRole("button", { name: "Отмена" }).click();
  await expect(deleteDialog).toHaveCount(0);

  await toolbar.getByRole("button", { name: "Переместить", exact: true }).click();
  const moveDialog = page.getByRole("dialog", { name: "Переместить раздел" });
  await expect(moveDialog.getByRole("menuitem", { name: "Основное меню" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(toolbar).not.toBeVisible();
});

test("opens the existing schedule settings from the single schedule action", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();
  await page.getByRole("button", { name: "Действия с разделом «Завтраки»" }).click();

  await expect(page.getByRole("menuitem", { name: /Настроить расписание/ })).toHaveCount(0);
  await page.getByRole("menuitem", { name: "Доступность" }).click();
  await expect(page.getByRole("menuitem", { name: "Доступно", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Показывать «Скоро будет»", exact: true })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Скрыть" })).toBeVisible();
  await page.getByRole("menuitem", { name: "По расписанию…", exact: true }).click();
  await expect(page.getByRole("radiogroup", { name: "Доступность раздела" })).toBeVisible();
});

test("maps section availability choices to the current status badge", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();
  const sectionActions = page.getByRole("button", { name: "Действия с разделом «Завтраки»" });

  await sectionActions.click();
  await page.getByRole("menuitem", { name: "Доступность" }).click();
  await page.getByRole("menuitem", { name: "Показывать «Скоро будет»", exact: true }).click();
  await expect(page.getByText("На стопе", { exact: true })).toBeVisible();

  await sectionActions.click();
  await page.getByRole("menuitem", { name: "Доступность" }).click();
  await page.getByRole("menuitem", { name: "Скрыть", exact: true }).click();
  await expect(page.getByText("На стопе", { exact: true })).toBeVisible();
  await expect(page.getByText("Скрыт", { exact: true })).toHaveCount(0);

  await sectionActions.click();
  await page.getByRole("menuitem", { name: "Доступность" }).click();
  await page.getByRole("menuitem", { name: "Доступно", exact: true }).click();
  await expect(page.getByText("На стопе", { exact: true })).toHaveCount(0);
});

test("records explicit position move parent/order and current reload behavior", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();

  const sourceRow = page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle }).first();
  const moveDialog = await openRowMoveMenu(page, sourceRow);
  await moveDialog.getByPlaceholder("Найти раздел...").fill("Выпечка");
  await moveDialog.getByRole("menuitem", { name: "Кухня / Выпечка" }).click();
  await expect(page.getByText("Позиция перемещена в «Выпечка»", { exact: true })).toBeVisible();

  await page.getByText("Выпечка", { exact: true }).first().click();
  await expect(page.getByRole("button", { name: "Действия с разделом «Выпечка»" })).toBeVisible();
  await expect(page.locator("[data-catalog-table-row]").last()).toContainText(firstItemTitle);

  await page.reload();
  // Current baseline: a full reload returns to the all-positions scope; the item remains in the catalog.
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle })).toBeVisible();
});

test("records explicit subsection move parent/order and current reload behavior", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByRole("button", { name: "Раскрыть раздел Бар", exact: true }).click();

  await page.getByRole("button", { name: "Действия с разделом Завтраки", exact: true }).click();
  await page.getByRole("menuitem", { name: "Переместить", exact: true }).hover();

  const moveDialog = page.getByRole("dialog", { name: "Переместить раздел" });
  await moveDialog.getByRole("menuitem", { name: "Бар", exact: true }).click();
  await expect(page.getByText("Раздел перемещён в «Бар»", { exact: true })).toBeVisible();

  const breakfastParent = page.locator(`[data-tree-section-id="${breakfastSectionId}"]`).locator("xpath=ancestor::*[@data-section-parent-id][1]");
  await expect(breakfastParent).toHaveAttribute("data-section-parent-id", barSectionId);

  await page.reload();
  await page.getByRole("button", { name: "Раскрыть раздел Бар", exact: true }).click();
  // Current baseline: the moved subsection returns to its original parent/order after a full reload.
  const restoredBreakfastParent = page.locator(`[data-tree-section-id="${breakfastSectionId}"]`).locator("xpath=ancestor::*[@data-section-parent-id][1]");
  await expect(restoredBreakfastParent).toHaveAttribute("data-section-parent-id", kitchenSectionId);
});

test("shows only valid section move targets and explains an unavailable search match", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByRole("button", { name: "Действия с разделом Кухня", exact: true }).click();
  await page.getByRole("menuitem", { name: "Переместить", exact: true }).hover();

  const moveDialog = page.getByRole("dialog", { name: "Переместить раздел" });
  await expect(moveDialog.getByRole("menuitem", { name: "Основное меню" })).toHaveCount(0);
  await expect(moveDialog.getByPlaceholder("Найти раздел...")).toBeVisible();
  await expect(moveDialog.locator("xpath=..")).toHaveAttribute("data-side", /^(left|right)$/);

  const hint = moveDialog.locator("[data-move-destinations-hint]");
  await expect(hint).toHaveText("Можно переместить в");
  await expect(hint).toHaveCSS("border-bottom-style", "dashed");
  await hint.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Показаны разделы без позиций — только в них можно перемещать другие разделы.");

  await expect(moveDialog.getByRole("menuitem", { name: "Кухня", exact: true })).toHaveCount(0);
  await moveDialog.getByPlaceholder("Найти раздел...").fill("Завтраки");
  const unavailableResult = moveDialog.locator("[data-move-unavailable-search-result]").filter({ hasText: "Кухня / Завтраки" });
  await expect(unavailableResult).toBeVisible();
  await expect(unavailableResult).toContainText("Нельзя переместить раздел в его подраздел");
  await expect(unavailableResult.getByRole("menuitem")).toHaveCount(0);
});

test("keeps bulk selection commands in the sticky local header without shifting table rows", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 640 });
  await page.goto("/?editorNav=unified");

  const scrollContainer = page.locator("[data-catalog-results-scroll]");
  const localHeader = page.locator("[data-catalog-local-header]");
  const tableHeader = page.locator("[data-catalog-table-header]");
  const firstRow = page.locator("[data-catalog-table-row]").first();
  const firstCheckbox = firstRow.getByRole("checkbox");
  const normalGeometry = await Promise.all([
    tableHeader.boundingBox(),
    firstRow.boundingBox(),
  ]);

  await firstCheckbox.check();
  const toolbar = page.locator("[data-catalog-selection-toolbar]");
  await expect(toolbar).toContainText("1 выбрано");
  await expect(tableHeader).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Доступность" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Витрина" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Для заказа" })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Переместить", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ещё действия" })).toBeVisible();

  const selectionGeometry = await Promise.all([
    localHeader.boundingBox(),
    firstRow.boundingBox(),
  ]);
  expect(normalGeometry.every(Boolean)).toBe(true);
  expect(selectionGeometry.every(Boolean)).toBe(true);
  expect(Math.abs(normalGeometry[0]!.y - selectionGeometry[0]!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(normalGeometry[0]!.height - selectionGeometry[0]!.height)).toBeLessThanOrEqual(1);
  expect(Math.abs(normalGeometry[1]!.y - selectionGeometry[1]!.y)).toBeLessThanOrEqual(1);
  expect(Math.abs(normalGeometry[1]!.height - selectionGeometry[1]!.height)).toBeLessThanOrEqual(1);
  expect(selectionGeometry[1]!.y).toBeGreaterThanOrEqual(selectionGeometry[0]!.y + selectionGeometry[0]!.height - 1);

  await page.getByRole("button", { name: "Переместить", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Переместить в раздел" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Переместить в раздел" })).not.toBeVisible();
  await expect(toolbar).not.toBeVisible();

  await firstCheckbox.check();
  await page.getByRole("button", { name: "Доступность" }).click();
  await page.getByRole("menuitem", { name: "Поставить на стоп" }).click();
  await page.getByRole("menuitemradio", { name: "Скрывать из меню" }).click();
  await expect(page.getByText("Позиции поставлены на стоп", { exact: true })).toBeVisible();
  await expect(toolbar).not.toBeVisible();

  await firstCheckbox.check();
  await scrollContainer.evaluate((element) => { element.scrollTop = 500; });
  await expect.poll(async () => scrollContainer.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(toolbar).toContainText("1 выбрано");
  const [scrollBox, stickyLocalBox] = await Promise.all([
    scrollContainer.boundingBox(),
    localHeader.boundingBox(),
  ]);
  expect(scrollBox && stickyLocalBox).toBeTruthy();
  expect(Math.abs(stickyLocalBox!.y - (scrollBox!.y + 39))).toBeLessThanOrEqual(1);
  await expect(tableHeader).toHaveCount(0);

  await page.keyboard.press("Escape");
  await expect(toolbar).not.toBeVisible();
  await expect(localHeader).toHaveCount(0);
  await expect(page.locator("[data-catalog-table-header]")).toBeVisible();

  await scrollContainer.evaluate((element) => { element.scrollTop = 0; });
  await firstCheckbox.check();
  await page.keyboard.press("Escape");
  await expect(toolbar).not.toBeVisible();
});

test("keeps the bulk toolbar compact at a narrow workspace width", async ({ page }) => {
  await page.setViewportSize({ width: 1024, height: 720 });
  await page.goto("/?editorNav=unified");

  await page.locator("[data-catalog-table-row]").first().getByRole("checkbox").check();
  const localHeader = page.locator("[data-catalog-local-header]");
  const toolbar = page.locator("[data-catalog-selection-toolbar]");
  await expect(toolbar).toContainText("1 выбрано");
  await expect(page.getByRole("button", { name: "Ещё действия" })).toBeVisible();

  const metrics = await toolbar.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    height: element.getBoundingClientRect().height,
    localHeaderHeight: element.parentElement?.getBoundingClientRect().height ?? 0,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.height).toBe(38);
  expect(metrics.localHeaderHeight).toBe(38);
  await expect(localHeader).toHaveCSS("position", "sticky");
});

test("characterizes structure create draft context and cancel/back behavior", async ({ page }) => {
  const draft = await openStructureCreateDraft(page);

  await expect(draft.getByText("Завтраки", { exact: true })).toBeVisible();
  await expect(draft).toHaveAttribute("data-position-create-pane", "true");
  await expect(page.locator("[data-position-editor-overlay]")).toHaveCount(0);
  await draft.getByRole("textbox", { name: "Название позиции" }).fill(structureCreateTitle);
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Следующая позиция в выборке" })).not.toBeVisible();

  // Current baseline: structure create has no create history entry; Back only
  // cancels the local draft and keeps the entity section URL.
  await draft.getByRole("button", { name: "Отмена", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Завтраки" })).toBeVisible();
  const afterBack = new URL(page.url());
  expect(afterBack.searchParams.get("sectionId")).toBe(breakfastSectionId);
  expect(afterBack.searchParams.get("positionId")).toBeNull();
  await expect(page.getByText(structureCreateTitle, { exact: true })).not.toBeVisible();
});

test("characterizes structure create completion, active item, section, queue, and reload", async ({ page }) => {
  const draft = await openStructureCreateDraft(page);
  await draft.getByRole("textbox", { name: "Название позиции" }).fill(structureCreateTitle);
  await draft.getByLabel("Цена позиции").fill("1750");
  await draft.getByLabel("Цена позиции").blur();
  await draft.getByRole("textbox", { name: "Описание" }).fill("Описание структурно созданной позиции");
  await draft.getByRole("button", { name: "Добавить позицию", exact: true }).click();

  const editorPane = page.locator("[data-position-editor-pane]");
  await expect(editorPane).toBeVisible();
  await expect(editorPane).not.toHaveAttribute("data-position-create-pane", "true");
  await expect(editorPane.getByRole("heading", { name: structureCreateTitle })).toBeVisible();
  await expect.poll(async () => (await editorPane.getByLabel("Цена позиции").inputValue()).replace(/\s/g, "")).toBe("1750");
  await expect(editorPane.getByRole("textbox", { name: "Описание" })).toHaveText("Описание структурно созданной позиции");
  const createdUrl = new URL(page.url());
  expect(createdUrl.searchParams.get("sectionId")).toBe(breakfastSectionId);
  expect(createdUrl.searchParams.get("positionId")).toBeNull();
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Следующая позиция в выборке" })).toBeVisible();

  await editorPane.getByRole("button", { name: "Закрыть редактор" }).click();
  await expect(editorPane).toHaveCount(0);
  await expect.poll(async () => page.evaluate((title) => {
    const stored = JSON.parse(window.localStorage.getItem("tasko.catalog.createdItems") ?? "[]") as Array<{ title?: string }>;
    return stored.some((item) => item.title === title);
  }, structureCreateTitle)).toBe(true);
  await preserveLocalStorageOnReload(page);
  await page.reload();
  await expect(page).toHaveURL(createdUrl.toString());
  await expect.poll(async () => page.evaluate((title) => {
    const stored = JSON.parse(window.localStorage.getItem("tasko.catalog.createdItems") ?? "[]") as Array<{ title?: string }>;
    return stored.some((item) => item.title === title);
  }, structureCreateTitle)).toBe(true);
});

test("opens direct creation in a side peek and discards it on cancel", async ({ page }) => {
  await openDirectCreateDraft(page);

  const createUrl = new URL(page.url());
  expect(createUrl.searchParams.get("createPosition")).toBe("1");
  expect(createUrl.searchParams.get("sectionId")).toBe(breakfastSectionId);
  const pane = page.locator("[data-position-editor-pane]");
  await expect(pane).toBeVisible();
  await expect(pane).toHaveAttribute("data-position-create-pane", "true");
  await expect(page.getByRole("dialog", { name: "Новая позиция" })).toHaveCount(0);
  await expect(page.locator("[data-position-editor-overlay]")).toHaveCount(0);
  await expect(pane.getByRole("button", { name: "Добавить позицию", exact: true })).toBeVisible();
  await expect(pane.getByRole("button", { name: "Отмена", exact: true })).toBeVisible();
  await pane.getByRole("textbox", { name: "Название позиции" }).fill(directCreateTitle);
  await pane.getByRole("button", { name: "Отмена", exact: true }).click();

  await expect(page.getByRole("heading", { name: "Новая позиция" })).not.toBeVisible();
  const afterCancel = new URL(page.url());
  expect(afterCancel.searchParams.get("createPosition")).toBeNull();
  expect(afterCancel.searchParams.get("sectionId")).toBe(breakfastSectionId);
  await expect(page.getByText(directCreateTitle, { exact: true })).not.toBeVisible();
});

test("keeps the created editor queue in the destination selected in the side peek", async ({ page }) => {
  await openDirectCreateDraft(page);
  const pane = page.locator("[data-position-editor-pane]");
  await pane.getByRole("button", { name: "Добавить в: Завтраки", exact: true }).click();
  await page.getByRole("menuitem", { name: /Выпечка/ }).click();
  await expect(pane.getByRole("button", { name: "Добавить в: Выпечка", exact: true })).toBeVisible();

  await pane.getByRole("textbox", { name: "Название позиции" }).fill("Created in bakery");
  await pane.getByRole("button", { name: "Добавить позицию", exact: true }).click();

  await expect(pane).not.toHaveAttribute("data-position-create-pane", "true");
  await expect(pane.getByRole("heading", { name: "Created in bakery" })).toBeVisible();
  await expect.poll(async () => page.evaluate(() => {
    const stored = JSON.parse(window.localStorage.getItem("tasko.catalog.createdItems") ?? "[]") as Array<{ title?: string; sectionId?: string }>;
    return stored.find((item) => item.title === "Created in bakery")?.sectionId ?? null;
  })).toBe(bakerySectionId);
  await expect(page.getByRole("button", { name: "Следующая позиция в выборке" })).toBeVisible();
});

test("characterizes direct create Back/Forward, active queue, and reload behavior", async ({ page }) => {
  await openDirectCreateDraft(page);
  const createUrl = new URL(page.url());

  // Current baseline: direct create owns a browser history entry; Back closes
  // the draft and Forward reconstructs pendingOpen and the draft editor.
  await page.goBack();
  await expect(page.getByPlaceholder("Поиск по названию")).toBeVisible();
  const afterBack = new URL(page.url());
  expect(afterBack.searchParams.get("createPosition")).toBeNull();
  expect(afterBack.searchParams.get("sectionId")).toBe(breakfastSectionId);

  await page.goForward();
  await expect(page).toHaveURL(createUrl.toString());
  await expect(page.getByRole("heading", { name: "Новая позиция" })).toBeVisible();

  await page.getByRole("textbox", { name: "Название позиции" }).fill(directCreateTitle);
  await page.locator("[data-position-editor-pane]").getByRole("button", { name: "Добавить позицию", exact: true }).click();

  await expect(page.locator("[data-position-editor-pane]").getByRole("heading", { name: directCreateTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Следующая позиция в выборке" })).toBeVisible();
  const completedUrl = new URL(page.url());
  expect(completedUrl.searchParams.get("createPosition")).toBe("1");
  expect(completedUrl.searchParams.get("positionId")).toBeNull();
  expect(completedUrl.searchParams.get("sectionId")).toBe(breakfastSectionId);
  await expect(page.locator("[data-position-editor-pane]")).toContainText("Доступно");

  await preserveLocalStorageOnReload(page);
  await page.reload();
  await expect.poll(async () => page.evaluate((title) => {
    const stored = JSON.parse(window.localStorage.getItem("tasko.catalog.createdItems") ?? "[]") as Array<{ title?: string }>;
    return stored.some((item) => item.title === title);
  }, directCreateTitle)).toBe(true);
  await expect(page.locator("[data-catalog-position-title]").getByText(directCreateTitle, { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: directCreateTitle })).not.toBeVisible();
});

test("restores complete fields for a position created through the direct flow", async ({ page }) => {
  await openDirectCreateDraft(page);
  const createPane = page.locator("[data-position-editor-pane]");
  await createPane.getByRole("textbox", { name: "Название позиции" }).fill("Direct persisted position");
  await page.getByLabel("Цена позиции").fill("2850");
  await page.getByLabel("Цена позиции").blur();
  await page.getByRole("textbox", { name: "Описание" }).fill("Описание direct-created позиции");
  await createPane.getByRole("button", { name: "Добавить позицию", exact: true }).click();
  await expect(createPane.getByRole("heading", { name: "Direct persisted position" })).toBeVisible();

  const created = await page.evaluate(() => {
    const items = JSON.parse(window.localStorage.getItem("tasko.catalog.createdItems") ?? "[]") as Array<{ id?: string; title?: string }>;
    return items.find((item) => item.title === "Direct persisted position");
  });
  expect(created?.id).toBeTruthy();
  await preserveLocalStorageOnReload(page);
  await page.goto(`/?editorNav=unified&sectionId=${breakfastSectionId}`);
  await page.locator(`[data-catalog-table-row="${created?.id}"]`).click();
  const restoredPane = page.locator("[data-position-editor-pane]");
  await expect(restoredPane.getByRole("heading", { name: "Direct persisted position" })).toBeVisible();
  await expect.poll(async () => (await restoredPane.getByLabel("Цена позиции").inputValue()).replace(/\s/g, "")).toBe("2850");
  await expect(restoredPane.getByRole("textbox", { name: "Описание" })).toHaveText("Описание direct-created позиции");
});
