import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });
});

test("manages menu languages with compact chips", async ({ page }) => {
  await page.goto("/storefront/about/language-region");

  await expect(page.getByRole("heading", { name: "Языки в меню" })).toBeVisible();
  await page.getByRole("button", { name: "О языках в меню" }).hover();
  await expect(page.getByRole("tooltip")).toContainText(
    "Основной язык используется по умолчанию",
  );

  const chips = page.locator("[data-language-chip]");
  await expect(chips.first()).toHaveAttribute("data-language-chip", "ru");
  await expect(chips.first().getByLabel("Основной язык")).toBeVisible();
  await chips.first().getByRole("button", { name: "Действия для языка Русский" }).click();
  await expect(page.getByText("Основной язык", { exact: true }).last()).toBeVisible();
  await expect(page.getByRole("menuitem", { name: "Удалить язык" })).toHaveCount(0);
  await page.keyboard.press("Escape");

  const englishChip = page.locator('[data-language-chip="en"]');
  await englishChip.getByRole("button", { name: "Действия для языка English" }).click();
  await page.getByRole("menuitem", { name: "Сделать основным" }).click();
  await expect(chips.first()).toHaveAttribute("data-language-chip", "en");

  const russianChip = page.locator('[data-language-chip="ru"]');
  await russianChip.getByRole("button", { name: "Действия для языка Русский" }).click();
  await page.getByRole("menuitem", { name: "Сделать основным" }).click();
  await expect(chips.first()).toHaveAttribute("data-language-chip", "ru");

  await englishChip.getByRole("button", { name: "Действия для языка English" }).click();
  await page.getByRole("menuitem", { name: "Удалить язык" }).click();
  await expect(englishChip).toHaveCount(0);

  await page.getByRole("button", { name: "Добавить язык" }).click();
  await expect(page.getByRole("option", { name: /English/ })).toBeVisible();
  await expect(page.getByRole("option", { name: /Русский/ })).toHaveCount(0);
  await page.getByRole("textbox", { name: "Поиск языка" }).fill("eng");
  await page.getByRole("option", { name: /English/ }).click();

  const confirmation = page.getByRole("dialog", { name: "Добавить English?" });
  await expect(confirmation).toContainText("Добавить English?");
  await expect(confirmation).toContainText(
    "Существующий контент меню будет автоматически переведён на новый язык.",
  );
  await confirmation.getByRole("button", { name: "Добавить и перевести" }).click();

  const translatedEnglishChip = page.locator('[data-language-chip="en"]');
  await expect(translatedEnglishChip).toContainText("Переводим…");
  await expect(translatedEnglishChip).not.toContainText("Переводим…", { timeout: 3_000 });

  await expect(page.getByText("Региональные настройки", { exact: true })).toBeVisible();
  await expect(page.getByText("Валюта", { exact: true })).toBeVisible();
  await expect(page.getByText("Часовой пояс", { exact: true })).toBeVisible();
});
