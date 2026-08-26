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
  await expect(page.getByRole("button", { name: /Автоперевести:/ }).first()).toBeVisible();

  await page.getByRole("button", { name: "Фильтр: Все" }).click();
  await expect(page.getByRole("menuitem", { name: "Все" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "На проверку" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Не переведено" })).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Переведено", exact: true })).toHaveCount(0);
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
      materialIds: ["missing-material"],
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
});
