import { expect, test, type Page } from "@playwright/test";

const firstItemTitle = "Омлет с томатами и сыром";
const firstItemId = "669204cd-0d0d-4782-8784-27df185f169e";
const breakfastSectionId = "bbcc693d-bb99-4666-b5b0-98c05cd63af9";
const bakerySectionId = "97869cb7-1192-4bf6-9db8-6680fb2fc8a4";
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
  await expect(page.getByRole("heading", { name: firstItemTitle })).toBeVisible();
}

async function openItemFromAllPositions(page: Page) {
  await page.goto("/?editorNav=unified");
  await page.getByRole("textbox", { name: "Найти позицию" }).fill("Омлет");
  await page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle }).click();
  await expect(page.getByRole("heading", { name: firstItemTitle })).toBeVisible();
}

async function openEntityItem(page: Page) {
  await page.goto(`/?editorNav=entity&sectionId=${breakfastSectionId}`);
  await page.locator("[data-composition-title=true]").filter({ hasText: firstItemTitle }).click();
  await expect(page.getByRole("heading", { name: firstItemTitle })).toBeVisible();
}

async function openStructureCreateDraft(page: Page) {
  await page.goto(`/?editorNav=entity&sectionId=${breakfastSectionId}`);
  await page.getByRole("button", { name: "Добавить позицию", exact: true }).first().click();
  const draft = page.locator("[data-structure-position-draft]");
  await expect(draft).toBeVisible();
  await expect(draft.getByRole("heading", { name: "Новая позиция" })).toBeVisible();
  return draft;
}

async function openDirectCreateDraft(page: Page) {
  await page.goto(`/?editorNav=unified&createPosition=1&sectionId=${breakfastSectionId}`);
  await expect(page.getByRole("heading", { name: "Новая позиция" })).toBeVisible();
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

test("persists the complete basic position editor record across reload", async ({ page }) => {
  await openEntityItem(page);

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
  await page.getByRole("button", { name: "Отображение" }).click();
  await page.getByRole("button", { name: /Без кнопки/ }).click();
  await page.waitForTimeout(700);
  await page.getByRole("button", { name: "Основное" }).click();
  const expectedDiscountValue = await page.evaluate((itemId) => {
    const records = JSON.parse(window.localStorage.getItem("tasko.catalog.itemRecords") ?? "{}");
    return String(records[itemId]?.priceWithSale ?? "");
  }, firstItemId);

  await preserveLocalStorageOnReload(page);
  await page.reload();
  await expect.poll(async () => (await page.getByLabel("Цена позиции").inputValue()).replace(/\s/g, "")).toBe("2450");
  await expect(page.getByLabel("Объем позиции")).toHaveValue("350");
  await expect(page.getByRole("textbox", { name: "Описание" })).toHaveText("Сохраняемое описание позиции");
  await expect(page.getByRole("button", { name: "Добавить КБЖУ" })).toHaveCount(0);
  await expect(page.getByLabel("Калорийность")).toHaveValue("560");
  await expect(page.getByRole("button", { name: "Добавить скидку" })).toHaveCount(0);
  await expect.poll(async () => (await page.getByLabel("Цена после скидки").inputValue()).replace(/\s/g, "")).toBe(expectedDiscountValue);
  await page.getByRole("button", { name: "Отображение" }).click();
  await expect(page.getByRole("button", { name: /Без кнопки/ })).toHaveClass(/border-\[#292524\]/);
});


test("restores structured promo, options, and availability editor state", async ({ page }) => {
  await openEntityItem(page);

  await page.getByRole("button", { name: "Допродажа" }).click();
  await page.getByRole("button", { name: "Добавить стикер", exact: true }).click();
  const stickerDialog = page.getByRole("dialog", { name: "Стикер" });
  await stickerDialog.getByLabel("Русский").fill("Хит");
  await stickerDialog.getByRole("button", { name: "Сохранить", exact: true }).click();
  await expect(page.getByText("Хит", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Опции" }).click();
  await page.getByRole("button", { name: "Добавить группу опций", exact: true }).click();
  await page.getByLabel("Название группы").fill("Размер порции");
  await page.getByRole("button", { name: "Создать группу", exact: true }).click();
  await expect(page.getByText("Размер порции", { exact: true })).toBeVisible();

  await page.getByRole("button", { name: "Доступность" }).click();
  const schedule = page.getByRole("radio", { name: /По расписанию/ });
  await schedule.click();
  await page.getByLabel("Понедельник: начало интервала 1").fill("10:00");
  await page.getByLabel("Понедельник: конец интервала 1").fill("19:00");
  await page.waitForTimeout(350);

  await preserveLocalStorageOnReload(page);
  await page.reload();

  await page.getByRole("button", { name: "Допродажа" }).click();
  await expect(page.getByText("Хит", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Опции" }).click();
  await expect(page.getByText("Размер порции", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Доступность" }).click();
  await expect(page.getByRole("radio", { name: /По расписанию/ })).toHaveAttribute("aria-checked", "true");
  await expect(page.getByLabel("Понедельник: начало интервала 1")).toHaveValue("10:00");
  await expect(page.getByLabel("Понедельник: конец интервала 1")).toHaveValue("19:00");
});

test("does not leak editor values between queued positions", async ({ page }) => {
  await openItemFromLeaf(page);
  const firstDescription = page.getByRole("textbox", { name: "Описание" });
  await firstDescription.fill("Описание позиции A");
  await page.getByLabel("Цена позиции").fill("3100");
  await page.getByLabel("Цена позиции").blur();
  await page.waitForTimeout(500);

  await page.getByRole("button", { name: "Следующая позиция в выборке" }).click();
  await expect(page.getByRole("textbox", { name: "Описание" })).not.toHaveText("Описание позиции A");
  await page.getByRole("textbox", { name: "Описание" }).fill("Описание позиции B");
  await page.getByLabel("Цена позиции").fill("4200");
  await page.getByLabel("Цена позиции").blur();
  await page.waitForTimeout(500);

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
  await expect(page.getByRole("menuitem", { name: "Добавить подраздел" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Добавить подраздел" }).click();
  const createDialog = page.getByRole("dialog", { name: "Новый раздел" });
  await expect(createDialog.getByRole("button", { name: "Расположение: Кухня" })).toBeVisible();
  await createDialog.getByLabel("Название раздела").fill("Сезонное меню");
  await createDialog.getByRole("button", { name: "Добавить раздел" }).click();
  await expect(page.getByText("Сезонное меню", { exact: true }).first()).toBeVisible();
});

test("opens the existing schedule settings from the single schedule action", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByText("Завтраки", { exact: true }).first().click();
  await page.getByRole("button", { name: "Действия с разделом «Завтраки»" }).click();

  await expect(page.getByRole("menuitem", { name: /Настроить расписание/ })).toHaveCount(0);
  const availabilitySubmenu = page.getByRole("menuitem", { name: "Ограничения доступности" });
  await availabilitySubmenu.hover();
  await page.getByRole("menuitemradio", { name: "По расписанию" }).click();
  await expect(page.getByRole("radiogroup", { name: "Доступность раздела" })).toBeVisible();
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
  await expect(page.locator("[data-catalog-table-row]").filter({ hasText: firstItemTitle })).toBeVisible();
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

test("keeps current section and descendants disabled as explicit move targets", async ({ page }) => {
  await page.goto("/?editorNav=unified");
  await page.getByRole("button", { name: "Действия с разделом Кухня", exact: true }).click();
  await page.getByRole("menuitem", { name: "Переместить…" }).click();

  const moveDialog = page.getByRole("dialog", { name: "Переместить раздел" });
  await expect(moveDialog.getByRole("button", { name: "В корень каталога" })).toBeVisible();
  await expect(moveDialog.getByPlaceholder("Найти раздел")).toBeVisible();
  await expect(moveDialog.locator("img")).toHaveCount(0);
  await expect(moveDialog.locator("xpath=..")).toHaveAttribute("data-side", /^(top|bottom)$/);
  await expect(moveDialog.getByRole("button", { name: /^Кухня/ })).toBeDisabled();
  await expect(moveDialog.getByRole("button", { name: /^Завтраки/ })).toBeDisabled();
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
    localHeader.boundingBox(),
    tableHeader.boundingBox(),
    firstRow.boundingBox(),
  ]);

  await firstCheckbox.check();
  const toolbar = page.locator("[data-catalog-selection-toolbar]");
  await expect(toolbar).toContainText("Выбрано: 1");
  await expect(page.getByRole("button", { name: "Витрина" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Для заказа" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Переместить", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Ещё действия" })).toBeVisible();

  const selectionGeometry = await Promise.all([
    localHeader.boundingBox(),
    tableHeader.boundingBox(),
    firstRow.boundingBox(),
  ]);
  expect(normalGeometry.every(Boolean)).toBe(true);
  expect(selectionGeometry.every(Boolean)).toBe(true);
  for (let index = 0; index < normalGeometry.length; index += 1) {
    expect(Math.abs(normalGeometry[index]!.y - selectionGeometry[index]!.y)).toBeLessThanOrEqual(1);
    expect(Math.abs(normalGeometry[index]!.height - selectionGeometry[index]!.height)).toBeLessThanOrEqual(1);
  }
  expect(selectionGeometry[2]!.y).toBeGreaterThanOrEqual(selectionGeometry[1]!.y + selectionGeometry[1]!.height - 1);

  await page.getByRole("button", { name: "Переместить", exact: true }).click();
  await expect(page.getByRole("dialog", { name: "Переместить в раздел" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog", { name: "Переместить в раздел" })).not.toBeVisible();
  await expect(toolbar).not.toBeVisible();

  await firstCheckbox.check();
  await page.getByRole("button", { name: "Для заказа" }).click();
  await page.getByRole("menuitem", { name: "Всегда доступно" }).click();
  await expect(page.getByText("Позиции всегда доступны", { exact: true })).toBeVisible();
  await expect(toolbar).not.toBeVisible();

  await firstCheckbox.check();
  await scrollContainer.evaluate((element) => { element.scrollTop = 500; });
  await expect.poll(async () => scrollContainer.evaluate((element) => element.scrollTop)).toBeGreaterThan(0);
  await expect(toolbar).toContainText("Выбрано: 1");
  const [scrollBox, stickyLocalBox, stickyTableBox] = await Promise.all([
    scrollContainer.boundingBox(),
    localHeader.boundingBox(),
    tableHeader.boundingBox(),
  ]);
  expect(scrollBox && stickyLocalBox && stickyTableBox).toBeTruthy();
  expect(Math.abs(stickyLocalBox!.y - scrollBox!.y)).toBeLessThanOrEqual(1);
  expect(stickyTableBox!.y).toBeGreaterThanOrEqual(stickyLocalBox!.y + stickyLocalBox!.height - 1);

  await page.getByRole("button", { name: "Снять выбор" }).click();
  await expect(toolbar).not.toBeVisible();
  await expect(localHeader.getByText("Новая позиция", { exact: true })).toBeVisible();

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
  await expect(toolbar).toContainText("Выбрано: 1");
  await expect(page.getByRole("button", { name: "Ещё действия" })).toBeVisible();

  const metrics = await toolbar.evaluate((element) => ({
    clientWidth: element.clientWidth,
    scrollWidth: element.scrollWidth,
    height: element.getBoundingClientRect().height,
    localHeaderHeight: element.parentElement?.getBoundingClientRect().height ?? 0,
  }));
  expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth);
  expect(metrics.height).toBe(32);
  expect(metrics.localHeaderHeight).toBe(44);
  await expect(localHeader).toHaveCSS("position", "sticky");
});

test("characterizes structure create draft context and cancel/back behavior", async ({ page }) => {
  const draft = await openStructureCreateDraft(page);

  await expect(draft.getByText("Завтраки", { exact: true })).toBeVisible();
  await draft.getByRole("textbox", { name: "Например, Пицца" }).fill(structureCreateTitle);
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Следующая позиция в выборке" })).not.toBeVisible();

  // Current baseline: structure create has no create history entry; Back only
  // cancels the local draft and keeps the entity section URL.
  await draft.getByRole("button", { name: "Назад" }).click();
  await expect(page.getByRole("heading", { name: "Завтраки" })).toBeVisible();
  const afterBack = new URL(page.url());
  expect(afterBack.searchParams.get("sectionId")).toBe(breakfastSectionId);
  expect(afterBack.searchParams.get("positionId")).toBeNull();
  await expect(page.getByText(structureCreateTitle, { exact: true })).not.toBeVisible();
});

test("characterizes structure create completion, active item, section, queue, and reload", async ({ page }) => {
  const draft = await openStructureCreateDraft(page);
  await draft.getByRole("textbox", { name: "Например, Пицца" }).fill(structureCreateTitle);
  await draft.getByLabel("Цена позиции").fill("1750");
  await draft.getByLabel("Цена позиции").blur();
  await draft.getByRole("textbox", { name: "Описание" }).fill("Описание структурно созданной позиции");
  await draft.getByRole("button", { name: "Создать", exact: true }).click();

  await expect(page.getByRole("heading", { name: structureCreateTitle })).toBeVisible();
  await expect.poll(async () => (await page.getByLabel("Цена позиции").inputValue()).replace(/\s/g, "")).toBe("1750");
  await expect(page.getByRole("textbox", { name: "Описание" })).toHaveText("Описание структурно созданной позиции");
  const createdUrl = new URL(page.url());
  expect(createdUrl.searchParams.get("sectionId")).toBeNull();
  expect(createdUrl.searchParams.get("positionId")).toBeTruthy();
  await expect(
    page.getByRole("navigation", { name: "Положение позиции в каталоге" })
      .getByRole("button", { name: "Завтраки", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).not.toBeVisible();
  await expect(page.getByRole("button", { name: "Следующая позиция в выборке" })).not.toBeVisible();

  await preserveLocalStorageOnReload(page);
  await page.reload();
  await expect(page).toHaveURL(createdUrl.toString());
  await expect(page.getByRole("heading", { name: structureCreateTitle })).toBeVisible();
  await expect.poll(async () => (await page.getByLabel("Цена позиции").inputValue()).replace(/\s/g, "")).toBe("1750");
  await expect(page.getByRole("textbox", { name: "Описание" })).toHaveText("Описание структурно созданной позиции");
  await expect(
    page.getByRole("navigation", { name: "Положение позиции в каталоге" })
      .getByRole("button", { name: "Завтраки", exact: true }),
  ).toBeVisible();
});

test("characterizes direct create cancel and current persistence behavior", async ({ page }) => {
  await openDirectCreateDraft(page);

  const createUrl = new URL(page.url());
  expect(createUrl.searchParams.get("createPosition")).toBe("1");
  expect(createUrl.searchParams.get("sectionId")).toBe(breakfastSectionId);
  await page.getByPlaceholder("Например, Пицца").fill(directCreateTitle);
  await page.getByRole("button", { name: "Отменить", exact: true }).click();
  await page.getByRole("button", { name: "Выйти без сохранения", exact: true }).click();

  // Current baseline: discarding the direct draft removes the create route,
  // but leaves its empty draft item in the legacy editor queue.
  await expect(page.getByRole("navigation", { name: "Положение позиции в каталоге" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Введите перевод…" })).toHaveValue("");
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Новая позиция" })).not.toBeVisible();
  const afterCancel = new URL(page.url());
  expect(afterCancel.searchParams.get("createPosition")).toBeNull();
  expect(afterCancel.searchParams.get("sectionId")).toBe(breakfastSectionId);
  await expect(page.getByText(directCreateTitle, { exact: true })).not.toBeVisible();
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

  await page.getByPlaceholder("Например, Пицца").fill(directCreateTitle);
  await page.getByRole("button", { name: "Создать", exact: true }).click();

  await expect(page.getByRole("heading", { name: directCreateTitle })).toBeVisible();
  await expect(page.getByRole("button", { name: "Предыдущая позиция в выборке" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Следующая позиция в выборке" })).toBeVisible();
  const completedUrl = new URL(page.url());
  expect(completedUrl.searchParams.get("createPosition")).toBeNull();
  expect(completedUrl.searchParams.get("positionId")).toBeNull();
  expect(completedUrl.searchParams.get("sectionId")).toBe(breakfastSectionId);
  await expect(
    page.getByRole("navigation", { name: "Положение позиции в каталоге" })
      .getByRole("button", { name: "Завтраки", exact: true }),
  ).toBeVisible();

  await preserveLocalStorageOnReload(page);
  await page.reload();
  await expect.poll(async () => page.evaluate((title) => {
    const stored = JSON.parse(window.localStorage.getItem("tasko.catalog.createdItems") ?? "[]") as Array<{ title?: string }>;
    return stored.some((item) => item.title === title);
  }, directCreateTitle)).toBe(true);
  // Current baseline: direct create persists the item record, but the current
  // legacy reload does not expose that created title in the visible catalog UI.
  await expect(page.getByText(directCreateTitle, { exact: true })).not.toBeVisible();
  await expect(page.getByRole("heading", { name: directCreateTitle })).not.toBeVisible();
});

test("restores complete fields for a position created through the direct flow", async ({ page }) => {
  await openDirectCreateDraft(page);
  await page.getByPlaceholder("Например, Пицца").fill("Direct persisted position");
  await page.getByLabel("Цена позиции").fill("2850");
  await page.getByLabel("Цена позиции").blur();
  await page.getByRole("textbox", { name: "Описание" }).fill("Описание direct-created позиции");
  await page.getByRole("button", { name: "Создать", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Direct persisted position" })).toBeVisible();

  const created = await page.evaluate(() => {
    const items = JSON.parse(window.localStorage.getItem("tasko.catalog.createdItems") ?? "[]") as Array<{ id?: string; title?: string }>;
    return items.find((item) => item.title === "Direct persisted position");
  });
  expect(created?.id).toBeTruthy();
  await preserveLocalStorageOnReload(page);
  await page.goto(`/?editorNav=entity&sectionId=${breakfastSectionId}&positionId=${created?.id}`);
  await expect(page.getByRole("heading", { name: "Direct persisted position" })).toBeVisible();
  await expect.poll(async () => (await page.getByLabel("Цена позиции").inputValue()).replace(/\s/g, "")).toBe("2850");
  await expect(page.getByRole("textbox", { name: "Описание" })).toHaveText("Описание direct-created позиции");
});
