import { expect, test } from "@playwright/test";

const JOBS_KEY = "tasko.translations.jobs.v1.seed-owner";

test("ends a translation job on Stop and restores the ordinary language row", async ({ page }, testInfo) => {
  test.setTimeout(30_000);
  const now = Date.now();
  await page.addInitScript(({ jobsKey, startedAt }) => {
    if (!window.sessionStorage.getItem("tasko.translation-job-e2e")) {
      window.localStorage.clear();
      window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
      window.localStorage.setItem("tasko.translations.primary-language-confirmed.v1.seed-owner", "true");
      window.localStorage.setItem(jobsKey, JSON.stringify([{
        id: "translation-background-e2e",
        language: "en",
        source: "Автоперевод",
        materialIds: ["about:venue", "interface:recommendations"],
        total: 5,
        completed: 1,
        successful: 1,
        failed: 0,
        status: "running",
        publishAfterComplete: true,
        publicationMode: "publish",
        fieldProgress: [
          { id: "about:venue:name:en", materialId: "about:venue", fieldId: "name", status: "completed" },
          { id: "about:venue:address:en", materialId: "about:venue", fieldId: "address", status: "pending" },
          { id: "interface:recommendations:home:en", materialId: "interface:recommendations", fieldId: "home", status: "pending" },
          { id: "interface:recommendations:dish:en", materialId: "interface:recommendations", fieldId: "dish", status: "pending" },
          { id: "interface:recommendations:cart:en", materialId: "interface:recommendations", fieldId: "cart", status: "pending" },
        ],
        startedAt,
        finishesAt: startedAt,
      }]));
      window.sessionStorage.setItem("tasko.translation-job-e2e", "true");
    }
  }, { jobsKey: JOBS_KEY, startedAt: now });

  let firstRelease = () => {};
  let requestCount = 0;
  const firstGate = new Promise<void>((resolve) => { firstRelease = resolve; });
  await page.route("**/api/translate", async (route) => {
    requestCount += 1;
    await firstGate;
    const body = route.request().postDataJSON() as { text?: string; targetLanguage?: string };
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        translatedText: `[${body.targetLanguage}] ${body.text}`,
        provider: "mymemory",
        upstreamRequestCount: 1,
        durationMs: 10,
        artificialDelayMs: 0,
      }),
    });
  });

  await page.goto("/storefront/translations");
  await expect.poll(() => requestCount).toBeGreaterThanOrEqual(3);
  const englishRow = page.locator('[data-translation-language="en"]');
  await expect(englishRow).toHaveAttribute("data-translation-state", "translating");
  await expect(page.getByRole("button", { name: /Английский\. Переведено 1 из 5 полей/ })).toBeEnabled();
  await expect(page.getByText("Можно закрыть эту страницу — перевод продолжится в фоне")).toBeVisible();
  await expect(page.getByRole("button", { name: "Добавить язык" })).toBeEnabled();
  const progressShimmer = page.locator("[data-translation-progress-shimmer]");
  await expect(progressShimmer).toHaveText("1 из 5 полей");
  await expect.poll(() => progressShimmer.evaluate((element) => (
    window.getComputedStyle(element, "::after").animationName
  ))).toBe("translation-progress-shimmer");
  const progressBounds = await progressShimmer.boundingBox();
  await page.waitForTimeout(900);
  expect(await progressShimmer.boundingBox()).toEqual(progressBounds);

  await page.emulateMedia({ reducedMotion: "reduce" });
  await expect.poll(() => progressShimmer.evaluate((element) => (
    window.getComputedStyle(element, "::after").display
  ))).toBe("none");
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await expect.poll(() => progressShimmer.evaluate((element) => (
    window.getComputedStyle(element, "::after").animationName
  ))).toBe("translation-progress-shimmer");

  await page.getByRole("button", { name: /^Казахский/ }).click();
  await page.getByRole("button", { name: /Английский\. Переведено 1 из 5 полей/ }).click();
  await page.getByRole("button", { name: "Выбрать тип контента" }).click();
  await expect(page.getByRole("menuitem", { name: /Позиции \d+%/ })).toBeVisible();
  const aboutType = page.getByRole("menuitem", { name: /О заведении \d+%/ });
  await expect(aboutType).toBeVisible();
  await aboutType.click();
  await expect(page.getByRole("textbox", { name: "Английский: Название заведения" })).toBeEnabled();
  await expect(page.getByRole("textbox", { name: "Английский: Адрес" })).toBeDisabled();
  await page.getByRole("button", { name: "Выбрать тип контента" }).click();
  await page.getByRole("menuitem", { name: /Позиции \d+%/ }).click();
  await page.getByRole("button", { name: "Открыть поиск" }).click();
  await page.getByRole("textbox", { name: "Поиск: Позиции" }).fill("Омлет");
  await expect(page.getByRole("button", { name: /Омлет/ }).first()).toBeVisible();
  await page.getByRole("button", { name: "Закрыть поиск" }).click();
  await page.getByRole("button", { name: "Добавить язык" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");

  await englishRow.hover();
  const stopButton = page.getByRole("button", { name: "Остановить перевод" });
  await stopButton.hover();
  await expect(page.getByRole("tooltip")).toHaveText("Остановить перевод");
  await page.screenshot({ path: testInfo.outputPath("active-stop-hover.png") });
  const requestsAtStop = requestCount;
  await stopButton.click();
  await expect(englishRow).toHaveAttribute("data-translation-state", "ready");
  await expect(progressShimmer).toHaveCount(0);
  await expect(page.getByText("Можно закрыть эту страницу — перевод продолжится в фоне")).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Продолжить" })).toHaveCount(0);
  await expect(page.locator("[data-translation-job-details]")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Английский, \d+%/ })).toBeEnabled();
  await expect(page.getByText("Перевод остановлен. Переведено 1 из 5 полей")).toBeVisible();

  firstRelease();
  await page.waitForTimeout(200);
  expect(requestCount).toBe(requestsAtStop);
  await expect(englishRow).toHaveAttribute("data-translation-state", "ready");
  await expect(page.getByText("Перевод остановлен. Переведено 1 из 5 полей")).toBeVisible();

  await page.reload();
  await expect(englishRow).toHaveAttribute("data-translation-state", "ready");
  await expect(page.getByRole("button", { name: "Продолжить" })).toHaveCount(0);
  await expect(page.locator("[data-translation-job-details]")).toHaveCount(0);
  const storedJob = await page.evaluate((jobsKey) => JSON.parse(window.localStorage.getItem(jobsKey) ?? "[]")[0], JOBS_KEY) as {
    status: string;
    completed: number;
    failed: number;
    fieldProgress: Array<{ status: string }>;
  };
  expect(storedJob).toMatchObject({ status: "stopped", completed: 1, failed: 0 });
  expect(storedJob.fieldProgress.filter((field) => field.status === "completed")).toHaveLength(1);
  expect(storedJob.fieldProgress.every((field) => field.status === "completed" || field.status === "pending")).toBe(true);
});
