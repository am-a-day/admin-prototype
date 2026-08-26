import { expect, test, type Page } from "@playwright/test";

const PRIMARY_CONFIRMED_KEY = "tasko.translations.primary-language-confirmed.v1.seed-owner";
const JOBS_KEY = "tasko.translations.jobs.v1.seed-owner";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(({ primaryConfirmedKey }) => {
    if (!window.sessionStorage.getItem("tasko.e2e.initialized")) {
      window.localStorage.clear();
      window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
      window.localStorage.setItem(primaryConfirmedKey, "true");
      window.sessionStorage.setItem("tasko.e2e.initialized", "true");
    }
  }, { primaryConfirmedKey: PRIMARY_CONFIRMED_KEY });
});

async function openTranslations(page: Page) {
  await page.goto("/storefront/translations");
  await expect(page.getByRole("heading", { name: "Переводы" })).toBeVisible();
}

test("uses translations as the only entry point and confirms content language on first use", async ({ page }) => {
  await page.addInitScript(({ primaryConfirmedKey }) => {
    window.localStorage.removeItem(primaryConfirmedKey);
  }, { primaryConfirmedKey: PRIMARY_CONFIRMED_KEY });

  await page.goto("/storefront/about/language-region");
  await expect(page.getByRole("heading", { name: "Языки в меню" })).toHaveCount(0);

  await page.goto("/storefront/translations");
  await expect(page.getByRole("heading", { name: "Основной язык контента" })).toBeVisible();
  await expect(page.getByText(/будет использоваться как исходный/)).toBeVisible();
  await page.getByRole("combobox", { name: "Основной язык контента" }).click();
  await page.getByRole("option", { name: "English" }).click();
  await expect(page.getByRole("combobox", { name: "Основной язык контента" })).toContainText("English");
  await page.getByRole("combobox", { name: "Основной язык контента" }).click();
  await page.getByRole("option", { name: "Русский" }).click();
  await page.getByRole("button", { name: "Подтвердить" }).click();

  await expect(page.getByRole("heading", { name: "Переводы" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Переводы" }).first()).toBeVisible();
  await expect(page.getByText("Русский · оригинал")).toBeVisible();
  await expect(page.getByText("Қазақша · перевод")).toBeVisible();
  await expect(page.getByRole("button", { name: "English", exact: true })).toBeVisible();
});

test("adds, restores, publishes and drafts a language without fake progress", async ({ page }) => {
  test.setTimeout(25_000);
  await openTranslations(page);
  await page.getByRole("button", { name: "Добавить язык" }).click();
  await page.getByRole("dialog", { name: "Добавить язык" }).getByRole("button", { name: /Srpski/ }).click();

  await expect(page.getByText("Переводим на Srpski")).toBeVisible();
  await expect(page.getByText(/Можно закрыть админку/).first()).toBeVisible();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(page.getByText(/\d+%/)).toHaveCount(0);

  await page.reload();
  await expect(page.getByRole("button", { name: /^Srpski/ }).first()).toBeVisible();
  await expect(page.getByText("Переводим на Srpski")).toHaveCount(0, { timeout: 12_000 });
  await page.getByRole("button", { name: "Действия для Srpski" }).click();
  await page.getByRole("menuitem", { name: "Сделать черновиком" }).click();
  await expect(page.getByRole("alertdialog")).toContainText("исчезнет из гостевого онлайн-меню");
  await page.getByRole("alertdialog").getByRole("button", { name: "Сделать черновиком" }).click();
  await expect(page.getByRole("button", { name: /^Srpski/ }).first()).toContainText("Черновик");

  await page.getByRole("button", { name: "Действия для Srpski" }).click();
  await page.getByRole("menuitem", { name: "Опубликовать" }).click();
  await expect(page.getByRole("button", { name: /^Srpski/ }).first()).not.toContainText("Черновик");
});

test("keeps the editor focused on content, filters and per-field actions", async ({ page }) => {
  await openTranslations(page);
  await expect(page.getByRole("combobox", { name: "Раздел контента" })).toBeVisible();
  await expect(page.getByRole("textbox", { name: "Найти текст" })).toBeVisible();
  await expect(page.getByText("Не заполнено в оригинале")).toBeVisible();
  const automaticAction = page.getByRole("button", { name: /Автоперевести:/ }).first();
  await expect(automaticAction).toBeVisible();
  await automaticAction.click();
  const automaticOrigin = page.getByRole("img", { name: /Переведено автоматически:/ }).first();
  await expect(automaticOrigin).toBeVisible();
  await page.getByRole("textbox", { name: "Введите перевод" }).first().fill("Қолмен түзетілді");
  await expect(automaticOrigin).toHaveCount(0);

  await page.getByRole("button", { name: "Фильтр: Все" }).click();
  await expect(page.getByRole("menuitem", { name: "Все" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "На проверку" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Не переведено" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Переведено", exact: true })).toHaveCount(0);
});

test("preserves a manual field, marks a changed source for review and confirms it", async ({ page }) => {
  test.setTimeout(25_000);
  await openTranslations(page);
  await page.getByRole("button", { name: "English", exact: true }).click();
  await page.getByRole("combobox", { name: "Раздел контента" }).click();
  await page.getByRole("option", { name: "Позиции и разделы" }).click();
  const manualTarget = page.getByRole("textbox", { name: "Введите перевод" }).first();
  await manualTarget.fill("Manual English title");

  await page.getByRole("button", { name: /Открыть оригинал:/ }).first().click();
  const sourceTitle = page.getByRole("textbox", { name: "Название позиции" }).first();
  await expect(sourceTitle).toBeVisible();
  await sourceTitle.fill("Изменённый источник E2E");
  await sourceTitle.press("Tab");
  await page.getByRole("button", { name: "Переводы" }).first().click();

  await expect(page.getByText("На проверку").first()).toBeVisible({ timeout: 8_000 });
  await expect(page.getByRole("textbox", { name: "Введите перевод" }).first()).toHaveValue("Manual English title");
  await page.getByRole("button", { name: "Проверено" }).first().click();
  await expect(page.getByText("На проверку")).toHaveCount(0);
});

test("warns on primary-language changes and exposes a recoverable failed subset", async ({ page }) => {
  const now = Date.now();
  await page.addInitScript(({ jobsKey, job }) => {
    window.localStorage.setItem(jobsKey, JSON.stringify([job]));
  }, {
    jobsKey: JOBS_KEY,
    job: {
      id: "failed-kk",
      language: "kk",
      source: "Обновлённый исходный текст",
      materialIds: ["about:venue"],
      fieldIdsByMaterial: { "about:venue": ["new-field-that-is-not-ready"] },
      total: 1,
      completed: 0,
      status: "error",
      publicationMode: "preserve",
      startedAt: now,
      finishesAt: now,
    },
  });
  await openTranslations(page);

  await expect(page.getByText("Не удалось перевести часть текстов")).toBeVisible();
  await expect(page.getByText(/только элементы из этого задания/)).toBeVisible();
  await page.getByRole("button", { name: "Повторить" }).click();
  await expect(page.getByText("Переводим на Қазақша")).toBeVisible();
  await expect(page.getByText("Не удалось перевести часть текстов", { exact: true })).toBeVisible({ timeout: 5_000 });
  const retrySubset = await page.evaluate(({ jobsKey }) => {
    const jobs = JSON.parse(window.localStorage.getItem(jobsKey) ?? "[]") as Array<{ materialIds: string[]; fieldIdsByMaterial?: Record<string, string[]> }>;
    return jobs[0];
  }, { jobsKey: JOBS_KEY });
  expect(retrySubset).toMatchObject({
    materialIds: ["about:venue"],
    fieldIdsByMaterial: { "about:venue": ["new-field-that-is-not-ready"] },
  });

  await page.getByRole("button", { name: "Настройки переводов" }).click();
  await page.getByRole("menuitem", { name: "Изменить основной язык" }).click();
  await page.getByRole("combobox", { name: "Новый основной язык" }).click();
  await page.getByRole("option", { name: "English" }).click();
  await expect(page.getByText(/повлияет на все существующие переводы/)).toBeVisible();
});

test("shows the calm empty state after the last target language is removed", async ({ page }) => {
  test.setTimeout(25_000);
  await openTranslations(page);
  for (const language of ["Қазақша", "English", "中文", "Français", "Español"]) {
    await page.getByRole("button", { name: `Действия для ${language}` }).click();
    await page.getByRole("menuitem", { name: "Удалить язык" }).click();
    await page.getByRole("alertdialog").getByRole("button", { name: "Удалить язык" }).click();
  }
  await expect(page.getByRole("heading", { name: "Переводов пока нет" })).toBeVisible();
  await expect(page.getByText("Добавьте язык, чтобы перевести контент ресторана.")).toBeVisible();

  await page.getByRole("button", { name: "Настройки переводов" }).click();
  await page.getByRole("menuitem", { name: "Изменить основной язык" }).click();
  await page.getByRole("combobox", { name: "Новый основной язык" }).click();
  await page.getByRole("option", { name: "English" }).click();
  await page.getByRole("button", { name: "Изменить язык" }).click();
  await expect(page.getByText(/Основной язык:/)).toContainText("English");
});

test("keeps a new language in draft when auto-publication is disabled", async ({ page }) => {
  await openTranslations(page);
  await page.getByRole("button", { name: "Добавить язык" }).click();
  await page.getByRole("dialog", { name: "Добавить язык" }).getByRole("button", { name: /Srpski/ }).click();
  await page.getByRole("checkbox").click();

  await expect(page.getByText("Переводим на Srpski")).toHaveCount(0, { timeout: 8_000 });
  await expect(page.getByRole("button", { name: /^Srpski/ }).first()).toContainText("Черновик");
  await page.getByRole("button", { name: "Действия для Srpski" }).click();
  await expect(page.getByRole("menuitem", { name: "Опубликовать" })).toBeVisible();
});
