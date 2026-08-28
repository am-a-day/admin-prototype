import { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider, type CatalogStoreInitialData } from "@/contexts/catalog-store-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { TranslationsProvider, useTranslations, type TranslationMaterial } from "@/contexts/translations-context";
import { catalogItems, catalogSections } from "@/data/catalog";
import { TranslationsWorkspace } from "./translations-workspace-v2";

function ToastProbe() {
  const { toast } = useTranslations();
  return toast ? <div role="status">{toast.message}</div> : null;
}

function TranslationTestControls() {
  const { materials, startAutoTranslate } = useTranslations();
  return (
    <button
      type="button"
      onClick={() => startAutoTranslate(["sr"], materials.map((material) => material.id), "Повторный запуск")}
    >
      Тест: обычный автоперевод на сербский
    </button>
  );
}

function Providers({ children, initialData }: { children: ReactNode; initialData?: CatalogStoreInitialData }) {
  return (
    <MockAuthProvider>
      <AppSettingsProvider>
        <CatalogStoreProvider initialData={initialData}>
          <TranslationsProvider>
            <TooltipProvider>
              {children}
              <ToastProbe />
              <TranslationTestControls />
            </TooltipProvider>
          </TranslationsProvider>
        </CatalogStoreProvider>
      </AppSettingsProvider>
    </MockAuthProvider>
  );
}

function renderWorkspace(initialData?: CatalogStoreInitialData, onOpenOriginal?: (material: TranslationMaterial) => void) {
  return render(<TranslationsWorkspace onOpenOriginal={onOpenOriginal} />, { wrapper: ({ children }) => <Providers initialData={initialData}>{children}</Providers> });
}

describe("translations workspace v2", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/storefront/translations");
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
    vi.stubGlobal("fetch", vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { text?: string; targetLanguage?: string };
      return new Response(JSON.stringify({
        translatedText: `[${body.targetLanguage}] ${body.text}`,
        provider: "mymemory",
        upstreamRequestCount: 1,
        durationMs: 10,
        artificialDelayMs: 0,
      }), { status: 200, headers: { "content-type": "application/json" } });
    }));
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("opens the translations workspace immediately on first visit", () => {
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const { container } = renderWorkspace({ sections: [section], items: [item] });

    expect(screen.getByRole("heading", { name: "Переводы" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Основной язык контента" })).not.toBeInTheDocument();
    const addLanguage = screen.getByRole("button", { name: "Добавить язык" });
    expect(addLanguage).toHaveTextContent("Добавить...");
    expect(addLanguage).toHaveClass("h-7", "pl-1", "pr-2", "font-normal", "text-[#999]");
    expect(addLanguage.querySelector("[data-translation-add-language-icon]")).toHaveClass("size-5", "rounded-[4px]", "border-[#e7e5e4]");
    expect(container).not.toHaveTextContent(/\d+%/);
  });

  it("hides Add when every supported language is connected and restores it after deletion", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    renderWorkspace({ sections: [section], items: [item] });

    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    expect(within(screen.getByRole("dialog")).queryByRole("button", { name: /Казахский/ })).not.toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Сербский/ }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Добавить язык" })).not.toBeInTheDocument());
    expect(screen.queryByText("Все языки добавлены")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Действия языка «Сербский»" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Удалить" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(screen.getByRole("button", { name: "Добавить язык" })).toBeInTheDocument());
  });

  it("changes the primary language directly from the Figma-matched popover", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    renderWorkspace({ sections: [section], items: [item] });

    expect(screen.getByRole("heading", { name: "Переводы" })).toBeInTheDocument();
    expect(screen.getByText("Русский (оригинал)")).toBeInTheDocument();
    expect(screen.getAllByText("Казахский").length).toBeGreaterThan(0);
    const kazakhTitleBefore = screen.getByRole("textbox", { name: "Казахский: Название" }).getAttribute("value");

    await user.click(screen.getByRole("button", { name: "Английский" }));
    expect(screen.getByText("Английский", { selector: "div" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Действия переводов" }));
    const menu = screen.getByRole("dialog");
    expect(within(menu).getAllByRole("button")).toHaveLength(1);
    await user.click(within(menu).getByRole("button", { name: "Изменить основной язык" }));
    expect(within(menu).getAllByText("Русский")).toHaveLength(1);
    expect(within(menu).getByText("основной")).toBeInTheDocument();
    expect(within(menu).getByText("С этого языка создаются переводы на остальные")).toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "Русский" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "Сделать основным" })).not.toBeInTheDocument();
    expect(within(menu).queryByRole("button", { name: "Отмена" })).not.toBeInTheDocument();
    const englishOption = within(menu).getByRole("button", { name: "Английский" });
    expect(englishOption).toHaveClass("hover:bg-[#f5f5f4]");
    expect(englishOption).not.toHaveClass("bg-[#f5f5f4]");
    expect(englishOption.querySelector("svg")).not.toBeInTheDocument();
    await user.click(englishOption);
    await waitFor(() => expect(screen.getByText("Английский (оригинал)")).toBeInTheDocument());
    expect(screen.queryByText("С этого языка создаются переводы на остальные")).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent("Основной язык изменён на английский");
    await user.click(screen.getByRole("button", { name: "Казахский. Скрыт" }));
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toHaveValue(kazakhTitleBefore ?? "");
  });

  it("deletes, hides in a modal, keeps hidden languages editable, and publishes them again", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const { container } = renderWorkspace({ sections: [section], items: [item] });

    await user.click(screen.getByRole("button", { name: "Действия языка «Испанский»" }));
    let languageMenu = screen.getByRole("dialog");
    expect(within(languageMenu).getByRole("button", { name: "Сделать основным" })).toBeInTheDocument();
    expect(within(languageMenu).getByRole("button", { name: "Скрыть из меню" })).toBeInTheDocument();
    expect(within(languageMenu).getByRole("button", { name: "Удалить" })).toHaveClass("text-[#c10007]");

    await user.click(within(languageMenu).getByRole("button", { name: "Удалить" }));
    const deleteDialog = screen.getByRole("alertdialog", { name: "Удалить язык «Испанский»?" });
    expect(deleteDialog).toHaveAttribute("data-delete-confirmation-kind", "language");
    expect(within(deleteDialog).getByText("Все переводы на этот язык будут удалены. Это действие нельзя отменить.")).toBeInTheDocument();
    await user.click(within(deleteDialog).getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Действия языка «Испанский»" })).not.toBeInTheDocument());

    const actions = screen.getByRole("button", { name: "Действия языка «Английский»" });
    await user.click(actions);
    languageMenu = screen.getByRole("dialog");
    await user.click(within(languageMenu).getByRole("button", { name: "Скрыть из меню" }));
    let hideDialog = screen.getByRole("dialog", { name: "Скрыть «Английский» из меню?" });
    expect(hideDialog).toHaveAttribute("aria-modal", "true");
    expect(hideDialog).toHaveClass("max-w-[343px]", "rounded-[16px]", "p-0");
    expect(within(hideDialog).getByText("Гости не смогут выбрать этот язык. Все переводы сохранятся.")).toBeInTheDocument();
    expect(within(hideDialog).getByRole("button", { name: "Отмена" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Скрыть «Английский» из меню?" })).not.toBeInTheDocument());

    await user.click(actions);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Скрыть из меню" }));
    hideDialog = screen.getByRole("dialog", { name: "Скрыть «Английский» из меню?" });
    await user.click(within(hideDialog).getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Скрыть «Английский» из меню?" })).not.toBeInTheDocument());

    await user.click(actions);
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Скрыть из меню" }));
    hideDialog = screen.getByRole("dialog", { name: "Скрыть «Английский» из меню?" });
    await user.click(within(hideDialog).getByRole("button", { name: "Скрыть" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Скрыть «Английский» из меню?" })).not.toBeInTheDocument());
    const hiddenRow = container.querySelector('[data-translation-language="en"]') as HTMLElement;
    expect(hiddenRow).toHaveTextContent("Скрыт");
    expect(within(hiddenRow).getByText("Английский")).toHaveClass("text-[#666]");
    expect(within(hiddenRow).getByRole("button", { name: "Английский. Скрыт" })).toBeEnabled();
    await user.click(within(hiddenRow).getByRole("button", { name: "Английский. Скрыт" }));
    expect(screen.getByRole("textbox", { name: "Английский: Название" })).toBeEnabled();

    await user.click(actions);
    languageMenu = screen.getByRole("dialog");
    expect(within(languageMenu).getByRole("button", { name: "Показать в меню" })).toBeInTheDocument();
    await user.click(within(languageMenu).getByRole("button", { name: "Показать в меню" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(hiddenRow).not.toHaveTextContent("Скрыт");

    await user.click(actions);
    languageMenu = screen.getByRole("dialog");
    await user.click(within(languageMenu).getByRole("button", { name: "Сделать основным" }));
    await waitFor(() => expect(screen.getByText("Английский (оригинал)")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Основной язык изменён на английский");
  });

  it("shows real field progress while a newly added language is translated", async () => {
    let releaseRequests = () => {};
    const requestsGate = new Promise<void>((resolve) => { releaseRequests = resolve; });
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      await requestsGate;
      const body = JSON.parse(String(init?.body ?? "{}")) as { text?: string; targetLanguage?: string };
      return new Response(JSON.stringify({
        translatedText: `[${body.targetLanguage}] ${body.text}`,
        provider: "mymemory",
        upstreamRequestCount: 1,
        durationMs: 10,
        artificialDelayMs: 0,
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const { container } = renderWorkspace({ sections: [section], items: [item] });

    fireEvent.click(screen.getByRole("button", { name: "Действия языка «Английский»" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Удалить" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Удалить" }));

    fireEvent.click(screen.getByRole("button", { name: "Добавить язык" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Английский/ }));

    await waitFor(() => expect(container.querySelector('[data-translation-language="en"]')).toHaveAttribute("data-translation-state", "translating"));
    const languageButton = screen.getByRole("button", { name: /Английский\. Переведено 0 из \d+ полей/ });
    expect(languageButton).toBeEnabled();
    expect(container.querySelector("[data-translation-job-details]")).toHaveTextContent(/Переведено 0 из \d+ полей/);
    expect(container.querySelector("[data-translation-progress-shimmer]")).toHaveTextContent(/0 из \d+ полей/);
    expect(screen.getByText("Можно закрыть эту страницу — перевод продолжится в фоне")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Опубликовать после перевода" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Добавить язык" })).toBeEnabled();
    expect(container.querySelector('[data-translation-language="kk"]')).not.toHaveTextContent("%");
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toBeEnabled();
    fireEvent.click(languageButton);
    expect(screen.getByText("Английский", { selector: "div" })).toBeInTheDocument();

    releaseRequests();
    await waitFor(() => expect(container.querySelector('[data-translation-language="en"]')).toHaveAttribute("data-translation-state", "ready"));
    expect(screen.queryByText("Можно закрыть эту страницу — перевод продолжится в фоне")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Добавить язык" })).toBeEnabled();
  });

  it("ends the current job on Stop and translates only missing fields on the next ordinary run", async () => {
    let releaseRequests = () => {};
    let holdRequests = true;
    let requestCount = 0;
    const requestsGate = new Promise<void>((resolve) => { releaseRequests = resolve; });
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      requestCount += 1;
      if (requestCount > 1 && holdRequests) await requestsGate;
      const body = JSON.parse(String(init?.body ?? "{}")) as { text?: string; targetLanguage?: string };
      return new Response(JSON.stringify({
        translatedText: `[${body.targetLanguage}] ${body.text}`,
        provider: "mymemory",
        upstreamRequestCount: 1,
        durationMs: 10,
        artificialDelayMs: 0,
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const { container } = renderWorkspace({ sections: [section], items: [item] });

    fireEvent.click(screen.getByRole("button", { name: "Добавить язык" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Сербский/ }));

    const jobDetails = await waitFor(() => {
      const details = container.querySelector("[data-translation-job-details]");
      expect(details).toHaveTextContent(/Переведено 1 из \d+ полей/);
      return details as HTMLElement;
    });
    const total = Number(jobDetails.textContent?.match(/1 из (\d+)/)?.[1]);
    expect(total).toBeGreaterThan(1);
    const requestsAtStop = requestCount;
    fireEvent.click(screen.getByRole("button", { name: "Остановить перевод" }));
    const serbianRow = container.querySelector('[data-translation-language="sr"]') as HTMLElement;
    expect(serbianRow).toHaveAttribute("data-translation-state", "ready");
    expect(serbianRow).toHaveTextContent("Скрыт");
    expect(serbianRow).not.toHaveTextContent("%");
    expect(container.querySelector("[data-translation-job-details]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-translation-progress-shimmer]")).not.toBeInTheDocument();
    expect(screen.queryByText("Можно закрыть эту страницу — перевод продолжится в фоне")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Продолжить" })).not.toBeInTheDocument();
    expect(screen.getByRole("status")).toHaveTextContent(`Перевод остановлен. Переведено 1 из ${total} полей`);

    holdRequests = false;
    releaseRequests();
    await waitFor(() => expect(requestCount).toBe(requestsAtStop));
    expect(serbianRow).toHaveAttribute("data-translation-state", "ready");
    expect(screen.getByRole("status")).toHaveTextContent(`Перевод остановлен. Переведено 1 из ${total} полей`);

    const requestsBeforeRestart = requestCount;
    fireEvent.click(screen.getByRole("button", { name: "Тест: обычный автоперевод на сербский" }));
    await waitFor(() => expect(serbianRow).toHaveAttribute("data-translation-state", "translating"));
    await waitFor(() => expect(serbianRow).toHaveAttribute("data-translation-state", "ready"));
    expect(requestCount - requestsBeforeRestart).toBe(total - 1);
    expect(screen.queryByRole("button", { name: "Продолжить" })).not.toBeInTheDocument();
  });

  it("restores a running job and requests only fields that were not completed", async () => {
    const item = catalogItems.find((candidate) => candidate.description.trim()) ?? catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    window.localStorage.setItem("tasko.translations.jobs.v1.seed-owner", JSON.stringify([{
      id: "restored-job",
      language: "en",
      source: "Новый язык",
      materialIds: [item.id],
      total: 2,
      completed: 1,
      successful: 1,
      failed: 0,
      status: "running",
      publishAfterComplete: false,
      publicationMode: "review",
      fieldIdsByMaterial: { [item.id]: ["title", "description"] },
      fieldProgress: [
        { id: `${item.id}:title:en`, materialId: item.id, fieldId: "title", status: "completed" },
        { id: `${item.id}:description:en`, materialId: item.id, fieldId: "description", status: "running" },
      ],
      startedAt: Date.now() - 1_000,
      finishesAt: Date.now() - 500,
    }]));

    renderWorkspace({ sections: [section], items: [item] });

    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(1));
    const request = JSON.parse(String(vi.mocked(fetch).mock.calls[0]?.[1]?.body ?? "{}")) as { text?: string };
    expect(request.text).toBeTruthy();
    expect(request.text).not.toBe(item.title);
    await waitFor(() => {
      const stored = JSON.parse(window.localStorage.getItem("tasko.translations.jobs.v1.seed-owner") ?? "[]") as Array<{ status: string; completed: number }>;
      expect(stored[0]).toMatchObject({ status: "completed", completed: 2 });
    });
  });

  it("continues a batch after one field fails and reports the partial result", async () => {
    let requestIndex = 0;
    vi.mocked(fetch).mockImplementation(async (_input, init) => {
      requestIndex += 1;
      if (requestIndex === 1) {
        return new Response(JSON.stringify({ error: "MyMemory unavailable" }), {
          status: 502,
          headers: { "content-type": "application/json" },
        });
      }
      const body = JSON.parse(String(init?.body ?? "{}")) as { text?: string; targetLanguage?: string };
      return new Response(JSON.stringify({
        translatedText: `[${body.targetLanguage}] ${body.text}`,
        provider: "mymemory",
        upstreamRequestCount: 1,
        durationMs: 10,
        artificialDelayMs: 0,
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const { container } = renderWorkspace({ sections: [section], items: [item] });

    fireEvent.click(screen.getByRole("button", { name: "Действия языка «Английский»" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Удалить" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Удалить" }));
    fireEvent.click(screen.getByRole("button", { name: "Добавить язык" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Английский/ }));

    await waitFor(() => expect(container.querySelector('[data-translation-language="en"]')).toHaveAttribute("data-translation-state", "error"));
    expect(requestIndex).toBeGreaterThan(1);
    expect(screen.getByText(/Не переведено: 1 из \d+ полей/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Повторить" })).toBeEnabled();
  });

  it("switches entity types, keeps options separate, and searches only the current list", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    renderWorkspace({
      sections: [section],
      items: [{
        ...item,
        optionGroups: [{
          id: "spice",
          name: "Острота",
          expanded: true,
          required: false,
          selection: "single",
          pricing: "surcharge",
          variants: [{ id: "mild", name: "Неостро", price: "0" }],
        }],
      }],
    });

    await user.click(screen.getByRole("button", { name: "Выбрать тип контента" }));
    await user.click(screen.getByRole("menuitem", { name: /Опции/ }));
    expect(screen.getAllByText("Острота").length).toBeGreaterThan(0);
    expect(screen.getAllByText(item.title).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Открыть поиск" }));
    const search = screen.getByRole("textbox", { name: "Поиск: Опции" });
    await user.type(search, "нет такого варианта");
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    fireEvent.keyDown(search, { key: "Escape" });
    expect(screen.queryByRole("textbox", { name: "Поиск: Опции" })).not.toBeInTheDocument();

    const resizer = screen.getByRole("separator", { name: "Изменить ширину панели переводов" });
    expect(resizer).toHaveAttribute("aria-valuenow", "230");
    fireEvent.keyDown(resizer, { key: "ArrowRight" });
    expect(resizer).toHaveAttribute("aria-valuenow", "232");
    expect(screen.getByRole("button", { name: "Выбрать тип контента" })).toHaveClass("bg-[#f5f5f4]", "hover:bg-[#e7e5e4]");
  });

  it("keeps row clicks inside translations and restores context after opening the position in catalog", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    window.history.replaceState({ translations: true }, "", "/storefront/translations");
    const onOpenOriginal = vi.fn();
    const workspace = renderWorkspace({ sections: [section], items: [item] }, onOpenOriginal);

    await user.click(screen.getByRole("button", { name: "Английский" }));
    await user.click(screen.getByRole("button", { name: "Открыть поиск" }));
    const search = screen.getByRole("textbox", { name: "Поиск: Позиции" });
    await user.type(search, item.title);
    const entityList = workspace.container.querySelector("[data-translations-entity-list]") as HTMLElement;
    entityList.scrollTop = 18;
    const routeBefore = window.location.href;

    const positionRow = screen.getByRole("button", { name: `Выбрать позицию «${item.title}»` });
    await user.click(positionRow);
    expect(positionRow).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("textbox", { name: "Английский: Название" })).toBeInTheDocument();
    expect(screen.queryByRole("complementary", { name: item.title })).not.toBeInTheDocument();
    expect(window.location.href).toBe(routeBefore);
    expect(onOpenOriginal).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: `Действия позиции «${item.title}»` }));
    await user.click(screen.getByRole("menuitem", { name: "Открыть в каталоге" }));
    expect(onOpenOriginal).toHaveBeenCalledWith(expect.objectContaining({ catalogItemId: item.id }));
    expect(window.location.href).toBe(routeBefore);
    expect(window.history.state.taskoTranslationsView).toMatchObject({
      language: "en",
      contentType: "positions",
      query: item.title,
      searchOpen: true,
      scrollTop: 18,
    });

    workspace.unmount();
    const restored = renderWorkspace({ sections: [section], items: [item] }, onOpenOriginal);
    expect(screen.getByRole("textbox", { name: "Поиск: Позиции" })).toHaveValue(item.title);
    expect(screen.getByRole("button", { name: "Английский" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: `Выбрать позицию «${item.title}»` })).toHaveAttribute("aria-current", "page");
    expect((restored.container.querySelector("[data-translations-entity-list]") as HTMLElement).scrollTop).toBe(18);
  });

  it("translates fields independently and clears the AI indicator after manual editing", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const { container } = renderWorkspace({ sections: [section], items: [{ ...item, description: "Сытное блюдо на завтрак", hasDescription: true }] });

    expect(container.querySelector("[data-translations-sidebar]")).toHaveClass("border-r", "border-stone-200");
    expect(container.querySelector("[data-translations-table-gap]")).toHaveClass("h-1.5");

    const titleInput = screen.getByRole("textbox", { name: "Казахский: Название" });
    expect(titleInput).toHaveClass("border-0", "rounded-none", "focus-visible:border-0");
    const titleAction = screen.getByRole("button", { name: /Перевести автоматически: Название|Перевести: Название/ });
    expect(titleAction).toHaveClass("size-[26px]", "rounded-[8px]", "bg-stone-200", "text-stone-900");
    expect(titleAction).toHaveTextContent("");
    expect(titleAction.querySelector("svg")).toBeInTheDocument();
    await user.click(titleAction);
    expect(await screen.findByRole("img", { name: "Переведено автоматически: Название" })).toHaveClass("text-stone-600");
    expect(screen.queryByRole("button", { name: /Перевести автоматически: Название|Перевести: Название/ })).not.toBeInTheDocument();

    fireEvent.focus(titleInput);
    expect(screen.getByRole("img", { name: "Переведено автоматически: Название" })).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: "Қолмен өзгертілген атау" } });
    await waitFor(() => expect(screen.queryByRole("img", { name: "Переведено автоматически: Название" })).not.toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Перевести автоматически: Название" })).toBeInTheDocument();
    await waitFor(() => expect(container.querySelector("[data-position-save-status]")).toHaveAttribute("data-save-status", "saved"));

    const descriptionAction = screen.getByRole("button", { name: /Перевести автоматически: Описание|Перевести: Описание/ });
    await user.click(descriptionAction);
    expect(screen.getByRole("textbox", { name: "Казахский: Описание" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Переведено автоматически: Описание" })).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: "" } });
    await waitFor(() => expect(screen.getByRole("img", { name: "Перевод не заполнен" })).toBeInTheDocument());
    expect(screen.queryByRole("img", { name: "Перевод заполнен" })).not.toBeInTheDocument();
  });

  it("keeps manual AI loaders and errors local to each field", async () => {
    const pending = new Map<string, { resolve: (response: Response) => void; reject: (error: Error) => void }>();
    vi.mocked(fetch).mockImplementation((_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { text: string };
      return new Promise<Response>((resolve, reject) => pending.set(body.text, { resolve, reject }));
    });
    const user = userEvent.setup();
    const item = catalogItems[0];
    const description = "Сытное блюдо на завтрак";
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    renderWorkspace({ sections: [section], items: [{ ...item, description, hasDescription: true }] });

    await user.click(screen.getByRole("button", { name: /Перевести автоматически: Название|Перевести: Название/ }));
    await user.click(screen.getByRole("button", { name: /Перевести автоматически: Описание|Перевести: Описание/ }));

    expect(screen.getByRole("button", { name: "Перевод выполняется: Название" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Перевод выполняется: Описание" })).toBeDisabled();

    pending.get(item.title)?.resolve(new Response(JSON.stringify({
      translatedText: "Translated title",
      provider: "mymemory",
      upstreamRequestCount: 1,
      durationMs: 10,
      artificialDelayMs: 0,
    }), { status: 200, headers: { "content-type": "application/json" } }));
    await waitFor(() => expect(screen.getByRole("img", { name: "Переведено автоматически: Название" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Перевод выполняется: Описание" })).toBeDisabled();

    pending.get(description)?.reject(new Error("MyMemory unavailable"));
    await waitFor(() => expect(screen.getByRole("alert", { name: "Ошибка перевода: Описание" })).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Перевести автоматически: Описание|Перевести: Описание/ })).toBeEnabled();
  });
});
