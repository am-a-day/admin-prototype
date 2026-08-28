import { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider, type CatalogStoreInitialData } from "@/contexts/catalog-store-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { TranslationsProvider, useTranslations, type TranslationMaterial } from "@/contexts/translations-context";
import { catalogItems, catalogSections, type CatalogItem } from "@/data/catalog";
import { TranslationsWorkspace } from "./translations-workspace-v2";

function ToastProbe() {
  const { toast } = useTranslations();
  return toast ? <div role="status">{toast.message}</div> : null;
}

function TranslationTestControls() {
  const { materials, startAutoTranslate, translateMissingFields } = useTranslations();
  return (
    <>
      <button
        type="button"
        onClick={() => startAutoTranslate(["sr"], materials.map((material) => material.id), "Повторный запуск")}
      >
        Тест: обычный автоперевод на сербский
      </button>
      <button
        type="button"
        onClick={() => {
          translateMissingFields("sr");
          translateMissingFields("sr");
        }}
      >
        Тест: дважды перевести недостающие на сербский
      </button>
      <button
        type="button"
        onClick={() => startAutoTranslate(
          ["en"],
          materials.filter((material) => material.kind === "position").map((material) => material.id),
          "Тестовая массовая проверка",
        )}
      >
        Тест: массовый перевод позиций на английский
      </button>
    </>
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

  it("keeps the language row hovered while More has its own hover and does not change selection", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const { container } = renderWorkspace({ sections: [section], items: [item] });

    const kazakh = screen.getByRole("button", { name: "Казахский. Скрыт" });
    await user.click(kazakh);
    expect(kazakh).toHaveAttribute("aria-current", "page");

    const english = screen.getByRole("button", { name: "Английский" });
    const englishRow = container.querySelector('[data-translation-language="en"]') as HTMLElement;
    const more = within(englishRow).getByRole("button", { name: "Действия языка «Английский»" });
    expect(englishRow).toHaveClass("rounded-[8px]", "overflow-hidden");
    expect(english).toHaveClass("group-hover:bg-[#f5f5f4]", "group-focus-within:bg-[#f5f5f4]");
    expect(more).toHaveClass("size-5", "hover:bg-[#e7e5e4]", "focus-visible:bg-[#e7e5e4]", "focus-visible:ring-2");
    expect(more.querySelector("svg")).toBeInTheDocument();

    await user.hover(more);
    await waitFor(() => expect(more).toHaveAttribute("aria-describedby"));
    await user.unhover(more);

    await user.click(more);
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(kazakh).toHaveAttribute("aria-current", "page");
    expect(english).not.toHaveAttribute("aria-current");
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(kazakh).toHaveAttribute("aria-current", "page");

    fireEvent.focus(more);
    await waitFor(() => expect(more).toHaveAttribute("aria-describedby"));
  });

  it("changes the original language only from the Figma-matched language menu", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    renderWorkspace({ sections: [section], items: [item] });

    expect(screen.getByRole("heading", { name: "Переводы" })).toBeInTheDocument();
    expect(screen.getByText("Русский · оригинал")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Действия переводов" })).not.toBeInTheDocument();
    expect(screen.queryByText(/Основной язык/)).not.toBeInTheDocument();
    expect(screen.getAllByText("Казахский").length).toBeGreaterThan(0);
    const kazakhTitleBefore = screen.getByRole("textbox", { name: "Казахский: Название" }).getAttribute("value");

    await user.click(screen.getByRole("button", { name: "Английский" }));
    expect(screen.getByText("Английский", { selector: "div" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Действия языка «Английский»" }));
    const menu = screen.getByRole("dialog");
    expect(menu).toHaveClass("w-[221px]", "rounded-[12px]", "p-0");
    const makeOriginal = within(menu).getByRole("button", { name: "Сделать оригиналом" });
    expect(makeOriginal).toHaveClass("min-h-7", "px-2", "py-1.5", "text-[13px]");
    expect(makeOriginal.querySelector("svg")).not.toBeInTheDocument();
    await user.click(makeOriginal);
    await waitFor(() => expect(screen.getByText("Английский · оригинал")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Английский теперь язык оригинала");
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
    expect(languageMenu).toHaveClass("w-[221px]", "rounded-[12px]", "p-0");
    expect(within(languageMenu).getByRole("button", { name: "Сделать оригиналом" })).toBeInTheDocument();
    expect(within(languageMenu).getByRole("checkbox", { name: "Показывать в меню" })).toBeChecked();
    const deleteAction = within(languageMenu).getByRole("button", { name: "Удалить" });
    expect(deleteAction).toHaveClass("text-[#c10007]");
    expect(deleteAction.querySelector("svg")).not.toBeInTheDocument();

    await user.click(deleteAction);
    const deleteDialog = screen.getByRole("alertdialog", { name: "Удалить «Испанский»?" });
    expect(deleteDialog).toHaveAttribute("data-delete-confirmation-kind", "language");
    expect(within(deleteDialog).getByText("Все переводы на испанский будут удалены.")).toBeInTheDocument();
    await user.click(within(deleteDialog).getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Действия языка «Испанский»" })).not.toBeInTheDocument());

    const actions = screen.getByRole("button", { name: "Действия языка «Английский»" });
    await user.click(actions);
    languageMenu = screen.getByRole("dialog");
    expect(within(languageMenu).getByRole("checkbox", { name: "Показывать в меню" })).toBeChecked();
    await user.click(within(languageMenu).getByRole("checkbox", { name: "Показывать в меню" }));
    let hideDialog = screen.getByRole("dialog", { name: "Скрыть «Английский» из меню?" });
    expect(hideDialog).toHaveAttribute("aria-modal", "true");
    expect(hideDialog).toHaveClass("max-w-[343px]", "rounded-[16px]", "p-0");
    expect(within(hideDialog).getByText("Гости не смогут выбрать этот язык. Все переводы сохранятся.")).toBeInTheDocument();
    expect(within(hideDialog).getByRole("button", { name: "Отмена" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Скрыть «Английский» из меню?" })).not.toBeInTheDocument());

    await user.click(actions);
    expect(within(screen.getByRole("dialog")).getByRole("checkbox", { name: "Показывать в меню" })).toBeChecked();
    await user.click(within(screen.getByRole("dialog")).getByRole("checkbox", { name: "Показывать в меню" }));
    hideDialog = screen.getByRole("dialog", { name: "Скрыть «Английский» из меню?" });
    await user.click(within(hideDialog).getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Скрыть «Английский» из меню?" })).not.toBeInTheDocument());

    await user.click(actions);
    await user.click(within(screen.getByRole("dialog")).getByRole("checkbox", { name: "Показывать в меню" }));
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
    expect(within(languageMenu).getByRole("checkbox", { name: "Показывать в меню" })).not.toBeChecked();
    await user.click(within(languageMenu).getByRole("checkbox", { name: "Показывать в меню" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(hiddenRow).not.toHaveTextContent("Скрыт");

    await user.click(actions);
    languageMenu = screen.getByRole("dialog");
    await user.click(within(languageMenu).getByRole("button", { name: "Сделать оригиналом" }));
    await waitFor(() => expect(screen.getByText("Английский · оригинал")).toBeInTheDocument());
    expect(screen.getByRole("status")).toHaveTextContent("Английский теперь язык оригинала");
  });

  it("shows real field progress while a newly added language is translated", async () => {
    const user = userEvent.setup();
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
    expect(languageButton).toHaveClass("group-hover:bg-[#f5f5f4]", "group-focus-within:bg-[#f5f5f4]");
    expect(container.querySelector("[data-translation-job-details]")).toHaveTextContent(/Переведено 0 из \d+ полей/);
    expect(container.querySelector("[data-translation-progress-shimmer]")).toHaveTextContent(/0 из \d+ полей/);
    expect(screen.getByText("Можно закрыть эту страницу — перевод продолжится в фоне")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Опубликовать после перевода" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Добавить язык" })).toBeEnabled();
    expect(container.querySelector('[data-translation-language="kk"]')).not.toHaveTextContent("%");
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toBeEnabled();
    fireEvent.click(languageButton);
    expect(languageButton).toHaveAttribute("aria-current", "page");
    expect(screen.getByText("Английский", { selector: "div" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Английский: Название" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Выбрать тип контента" }));
    await user.click(screen.getByRole("menuitem", { name: "Разделы" }));
    expect(screen.getByRole("button", { name: "Выбрать тип контента" })).toHaveTextContent("Разделы");
    expect(languageButton).toHaveAttribute("aria-current", "page");
    expect(container.querySelector('[data-translation-language="en"]')).toHaveAttribute("data-translation-state", "translating");
    expect(container.querySelector("[data-translation-progress-shimmer]")).toHaveTextContent(/0 из \d+ полей/);

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
    fireEvent.click(screen.getByRole("button", { name: "Действия языка «Сербский»" }));
    const languageMenu = screen.getByRole("dialog");
    const translateMissing = within(languageMenu).getByRole("button", { name: "Перевести недостающие" });
    expect(translateMissing.querySelector("svg")).toBeInTheDocument();
    fireEvent.click(translateMissing);
    fireEvent.click(screen.getByRole("button", { name: "Тест: дважды перевести недостающие на сербский" }));
    await waitFor(() => expect(serbianRow).toHaveAttribute("data-translation-state", "translating"));
    await waitFor(() => expect(serbianRow).toHaveAttribute("data-translation-state", "ready"));
    expect(requestCount - requestsBeforeRestart).toBe(total - 1);
    expect(screen.queryByRole("button", { name: "Продолжить" })).not.toBeInTheDocument();
  });

  it("purges a deleted language across reload and starts its translation from scratch when added again", async () => {
    type PendingRequest = {
      text: string;
      resolve: (response: Response) => void;
    };
    const responseFor = (translatedText: string) => new Response(JSON.stringify({
      translatedText,
      provider: "mymemory",
      upstreamRequestCount: 1,
      durationMs: 10,
      artificialDelayMs: 0,
    }), { status: 200, headers: { "content-type": "application/json" } });
    let phase: "initial" | "readded" = "initial";
    let initialRequestCompleted = false;
    const readdedRequests: PendingRequest[] = [];
    vi.mocked(fetch).mockImplementation((_input, init) => {
      const body = JSON.parse(String(init?.body ?? "{}")) as { text: string };
      if (phase === "initial") {
        if (!initialRequestCompleted) {
          initialRequestCompleted = true;
          return Promise.resolve(responseFor(`[old-sr] ${body.text}`));
        }
        return new Promise<Response>(() => undefined);
      }
      return new Promise<Response>((resolve) => {
        readdedRequests.push({ text: body.text, resolve });
      });
    });

    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const firstRender = renderWorkspace({ sections: [section], items: [item] });

    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Сербский/ }));
    const firstSerbianRow = await waitFor(() => {
      const row = firstRender.container.querySelector('[data-translation-language="sr"]');
      expect(row).toBeInTheDocument();
      return row as HTMLElement;
    });
    await user.click(within(firstSerbianRow).getByRole("button", { name: /Сербский/ }));
    const serbianTitle = await screen.findByRole("textbox", { name: "Сербский: Название" });
    await waitFor(() => expect(serbianTitle).toHaveValue(`[old-sr] ${item.title}`));
    await waitFor(() => {
      const records = JSON.parse(window.localStorage.getItem("tasko.catalog.itemRecords") ?? "{}") as Record<string, { titleTranslations?: { sr?: string } }>;
      expect(records[item.id]?.titleTranslations?.sr).toBe(`[old-sr] ${item.title}`);
    });

    await user.click(screen.getByRole("button", { name: "Остановить перевод" }));
    await user.click(screen.getByRole("button", { name: "Действия языка «Сербский»" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Удалить" }));
    const deleteDialog = screen.getByRole("alertdialog", { name: "Удалить «Сербский»?" });
    expect(within(deleteDialog).getByText("Все переводы на сербский будут удалены.")).toBeInTheDocument();
    await user.click(within(deleteDialog).getByRole("button", { name: "Удалить" }));

    await waitFor(() => expect(screen.queryByRole("button", { name: "Действия языка «Сербский»" })).not.toBeInTheDocument());
    await waitFor(() => {
      const records = JSON.parse(window.localStorage.getItem("tasko.catalog.itemRecords") ?? "{}") as Record<string, { titleTranslations?: { sr?: string } }>;
      expect(records[item.id]?.titleTranslations?.sr).toBeUndefined();
    });
    const storedJobs = JSON.parse(window.localStorage.getItem("tasko.translations.jobs.v1.seed-owner") ?? "[]") as Array<{ language: string }>;
    expect(storedJobs.some((job) => job.language === "sr")).toBe(false);
    expect(window.localStorage.getItem("tasko.translations.field-metadata.v1.seed-owner") ?? "").not.toContain('"sr"');
    const storedAuth = JSON.parse(window.localStorage.getItem("tasko.mockAuth.v1") ?? "{}") as {
      accounts?: Record<string, { workspace?: { languages?: Array<{ code: string }> } }>;
    };
    expect(storedAuth.accounts?.["seed-owner"]?.workspace?.languages?.some(({ code }) => code === "sr")).toBe(false);

    firstRender.unmount();
    phase = "readded";
    const secondRender = renderWorkspace({ sections: [section], items: [item] });
    expect(secondRender.container.querySelector('[data-translation-language="sr"]')).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    const addDialog = screen.getByRole("dialog");
    expect(within(addDialog).getByRole("button", { name: /Сербский/ })).toBeInTheDocument();
    await user.click(within(addDialog).getByRole("button", { name: /Сербский/ }));

    await waitFor(() => expect(secondRender.container.querySelector('[data-translation-language="sr"]')).toHaveAttribute("data-translation-state", "translating"));
    const secondSerbianRow = secondRender.container.querySelector('[data-translation-language="sr"]') as HTMLElement;
    await user.click(within(secondSerbianRow).getByRole("button", { name: /Сербский/ }));
    expect(screen.getByRole("textbox", { name: "Сербский: Название" })).toHaveValue("");
    expect(secondRender.container.querySelector("[data-translation-progress-shimmer]")).toHaveTextContent(/0 из \d+ полей/);
    expect(screen.getByRole("button", { name: "Остановить перевод" })).toBeEnabled();
    await waitFor(() => expect(readdedRequests.length).toBeGreaterThan(0));
    const titleRequest = readdedRequests.find((request) => request.text === item.title);
    expect(titleRequest).toBeDefined();
    titleRequest?.resolve(responseFor(`[new-sr] ${item.title}`));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Сербский: Название" })).toHaveValue(`[new-sr] ${item.title}`));
    expect(secondRender.container.querySelector("[data-translation-progress-shimmer]")).toHaveTextContent(/1 из \d+ полей/);
    expect(secondRender.container).not.toHaveTextContent(`[old-sr] ${item.title}`);
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

  it("matches the compact entity selector and preserves language, search, and scroll while switching", async () => {
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

    const typeTrigger = screen.getByRole("button", { name: "Выбрать тип контента" });
    const activeLanguage = screen.getByRole("button", { name: "Казахский. Скрыт" });
    expect(activeLanguage).toHaveAttribute("aria-current", "page");

    await user.click(typeTrigger);
    let typeMenu = screen.getByRole("menu");
    expect(typeMenu).toHaveClass("w-[170px]", "min-w-[128px]", "rounded-[12px]", "p-1");
    const typeItems = within(typeMenu).getAllByRole("menuitem");
    expect(typeItems.map((menuItem) => menuItem.textContent)).toEqual([
      "Позиции",
      "Опции",
      "Разделы",
      "Теги",
      "Стикеры",
      "Баннеры",
      "О заведении",
      "Заголовки и кнопки",
    ]);
    const positionsItem = within(typeMenu).getByRole("menuitem", { name: "Позиции" });
    const tagsItem = within(typeMenu).getByRole("menuitem", { name: "Теги" });
    expect(positionsItem).toHaveClass("h-7", "rounded-[8px]", "bg-[#f5f5f4]", "text-[#333]");
    expect(positionsItem.querySelector("svg")).toBeInTheDocument();
    expect(tagsItem.querySelector("svg")).not.toBeInTheDocument();
    await user.hover(tagsItem);
    expect(tagsItem).toHaveAttribute("data-highlighted");
    expect(tagsItem).toHaveClass("data-[highlighted]:bg-[#f5f5f4]", "data-[highlighted]:text-[#333]");
    expect(typeTrigger).toHaveTextContent("Позиции");
    expect(tagsItem.querySelector("svg")).not.toBeInTheDocument();
    expect(positionsItem.querySelector("svg")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();

    await user.click(typeTrigger);
    await screen.findByRole("menu");
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(typeTrigger).toHaveTextContent("Опции");
    expect(screen.getAllByText("Острота").length).toBeGreaterThan(0);
    expect(screen.getAllByText(item.title).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: "Открыть поиск" }));
    const search = screen.getByRole("textbox", { name: "Поиск: Опции" });
    await user.type(search, "нет такого варианта");
    expect(screen.getByText("Ничего не найдено")).toBeInTheDocument();
    const entityList = document.querySelector("[data-translations-entity-list]") as HTMLElement;
    entityList.scrollTop = 18;

    await user.click(typeTrigger);
    typeMenu = screen.getByRole("menu");
    await user.click(within(typeMenu).getByRole("menuitem", { name: "Разделы" }));
    expect(typeTrigger).toHaveTextContent("Разделы");
    expect(screen.getByRole("textbox", { name: "Поиск: Разделы" })).toHaveValue("нет такого варианта");
    expect(entityList.scrollTop).toBe(18);
    expect(activeLanguage).toHaveAttribute("aria-current", "page");
    expect(within(screen.getByRole("main")).getAllByText(section.name).length).toBeGreaterThan(0);

    await user.click(screen.getByRole("textbox", { name: "Поиск: Разделы" }));
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("textbox", { name: "Поиск: Разделы" })).not.toBeInTheDocument();

    const resizer = screen.getByRole("separator", { name: "Изменить ширину панели переводов" });
    expect(resizer).toHaveAttribute("aria-valuenow", "230");
    fireEvent.keyDown(resizer, { key: "ArrowRight" });
    expect(resizer).toHaveAttribute("aria-valuenow", "232");
    expect(typeTrigger).toHaveClass("bg-[#f5f5f4]", "hover:bg-[#e7e5e4]");
  });

  it("switches languages after restoring history without losing the selected position or search", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    window.history.replaceState({
      taskoTranslationsView: {
        language: "kk",
        contentType: "positions",
        selectedKey: item.id,
        query: item.title,
        searchOpen: true,
        scrollTop: 18,
      },
    }, "", "/storefront/translations");
    const workspace = renderWorkspace({ sections: [section], items: [item] });

    const kazakh = screen.getByRole("button", { name: "Казахский. Скрыт" });
    expect(kazakh).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Английский" }));
    expect(screen.getByRole("button", { name: "Английский" })).toHaveAttribute("aria-current", "page");
    expect(kazakh).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("textbox", { name: "Английский: Название" })).toBeInTheDocument();
    expect(screen.getByRole("textbox", { name: "Поиск: Позиции" })).toHaveValue(item.title);
    expect(screen.getByRole("button", { name: `Выбрать позицию «${item.title}»` })).toHaveAttribute("aria-current", "page");
    expect((workspace.container.querySelector("[data-translations-entity-list]") as HTMLElement).scrollTop).toBe(18);

    await user.click(kazakh);
    expect(kazakh).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toBeInTheDocument();
  });

  it("keeps row clicks inside translations and opens the position directly from either catalog arrow", async () => {
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

    expect(screen.queryByRole("button", { name: `Действия позиции «${item.title}»` })).not.toBeInTheDocument();
    const catalogActions = screen.getAllByRole("button", { name: `Открыть «${item.title}» в каталоге` });
    expect(catalogActions).toHaveLength(2);
    await user.hover(catalogActions[0]);
    expect(await screen.findByRole("tooltip", { name: "Открыть в каталоге" })).toBeInTheDocument();
    await user.unhover(catalogActions[0]);
    await user.click(catalogActions[0]);
    expect(onOpenOriginal).toHaveBeenCalledWith(expect.objectContaining({ catalogItemId: item.id }));
    expect(window.location.href).toBe(routeBefore);
    expect(window.history.state.taskoTranslationsView).toMatchObject({
      language: "en",
      contentType: "positions",
      query: item.title,
      searchOpen: true,
      scrollTop: 18,
    });

    onOpenOriginal.mockClear();
    await user.click(catalogActions[1]);
    expect(onOpenOriginal).toHaveBeenCalledWith(expect.objectContaining({ catalogItemId: item.id }));

    workspace.unmount();
    const restored = renderWorkspace({ sections: [section], items: [item] }, onOpenOriginal);
    expect(screen.getByRole("textbox", { name: "Поиск: Позиции" })).toHaveValue(item.title);
    expect(screen.getByRole("button", { name: "Английский" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: `Выбрать позицию «${item.title}»` })).toHaveAttribute("aria-current", "page");
    expect((restored.container.querySelector("[data-translations-entity-list]") as HTMLElement).scrollTop).toBe(18);
  });

  it("keeps entity status and catalog actions in one fixed trailing slot", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    window.localStorage.setItem("tasko.translations.reset-languages.v1.seed-owner", JSON.stringify(["kk"]));
    const shortItem = {
      ...item,
      id: "status-slot-short",
      title: "Короткая тестовая позиция 48271",
      description: "",
      hasDescription: false,
      titleTranslations: {},
      descriptionTranslations: {},
      optionGroups: [],
    };
    const longItem = {
      ...item,
      id: "status-slot-long",
      title: "Очень длинное название позиции, которое обязательно должно обрезаться",
      description: "",
      hasDescription: false,
      titleTranslations: {},
      descriptionTranslations: {},
      optionGroups: [],
    };
    const onOpenOriginal = vi.fn();
    renderWorkspace({ sections: [section], items: [shortItem, longItem] }, onOpenOriginal);

    const shortButton = screen.getByRole("button", { name: `Выбрать позицию «${shortItem.title}»` });
    const longButton = screen.getByRole("button", { name: `Выбрать позицию «${longItem.title}»` });
    const shortRow = shortButton.closest("[data-translation-entity-row]") as HTMLElement;
    const longRow = longButton.closest("[data-translation-entity-row]") as HTMLElement;

    expect(shortRow).toHaveClass("bg-[#f5f5f4]");
    expect(longRow).toHaveClass("hover:bg-[#f5f5f4]", "focus-within:bg-[#f5f5f4]");
    expect(shortButton).not.toHaveClass("pr-7");
    expect(longButton).not.toHaveClass("pr-7");
    expect(within(longRow).getByText(longItem.title)).toHaveClass("truncate");

    [shortRow, longRow].forEach((row) => {
      expect(row.querySelector("[data-translation-entity-content]")).toHaveClass("min-w-0", "flex-1");
      const slot = row.querySelector("[data-translation-entity-slot]") as HTMLElement;
      expect(slot).toHaveClass("size-5", "shrink-0", "items-center", "justify-center");
      const status = within(slot).getByRole("img", { name: "Перевод не заполнен" });
      expect(status).toHaveClass("size-5", "group-hover/entity:opacity-0", "group-focus-within/entity:opacity-0");
      expect(status.querySelector("svg")).toHaveAttribute("width", "14");
      expect(status.querySelector("svg")).toHaveAttribute("height", "14");
      const action = within(row).getByRole("button", { name: /Открыть .* в каталоге/ });
      expect(action).toHaveClass("right-1", "size-5", "hover:bg-[#e7e5e4]", "group-hover/entity:opacity-100");
      expect(action.querySelector("svg")).toHaveAttribute("width", "14");
      expect(action.querySelector("svg")).toHaveAttribute("height", "14");
    });

    const longAction = within(longRow).getByRole("button", { name: `Открыть «${longItem.title}» в каталоге` });
    await user.hover(longAction);
    expect(await screen.findByRole("tooltip", { name: "Открыть в каталоге" })).toBeInTheDocument();
    await user.click(longAction);
    expect(onOpenOriginal).toHaveBeenCalledWith(expect.objectContaining({ catalogItemId: longItem.id }));
    expect(shortButton).not.toHaveAttribute("aria-current");
    expect(longButton).toHaveAttribute("aria-current", "page");

    const longTranslation = screen.getByRole("textbox", { name: "Казахский: Название" });
    await user.clear(longTranslation);
    await user.type(longTranslation, "Ұзын атауы бар позиция");
    await waitFor(() => expect(within(longRow).queryByRole("img", { name: "Перевод не заполнен" })).not.toBeInTheDocument());
    expect(longRow.querySelector("[data-translation-entity-slot]")).toBeEmptyDOMElement();
  });

  it("isolates field values and AI state by entity, field, and language across reload", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    window.localStorage.setItem("tasko.translations.reset-languages.v1.seed-owner", JSON.stringify(["kk", "en"]));
    const positionA: CatalogItem = {
      ...item,
      id: "translation-state-a",
      title: "Позиция A",
      description: "Оригинальное описание A",
      hasDescription: true,
      titleTranslations: {},
      descriptionTranslations: {},
      optionGroups: [],
    };
    const positionB: CatalogItem = {
      ...item,
      id: "translation-state-b",
      title: "Позиция B",
      description: "Оригинальное описание B",
      hasDescription: true,
      titleTranslations: {},
      descriptionTranslations: {},
      optionGroups: [],
    };
    const setDescription = (language: "Казахский" | "Английский", value: string) => {
      const editor = screen.getByRole("textbox", { name: `${language}: Описание` });
      fireEvent.input(editor, { target: { innerHTML: value ? `<p>${value}</p>` : "" } });
      return editor;
    };

    const firstRender = renderWorkspace({ sections: [section], items: [positionA, positionB] });
    const rowA = screen.getByRole("button", { name: "Выбрать позицию «Позиция A»" });
    const rowB = screen.getByRole("button", { name: "Выбрать позицию «Позиция B»" });
    expect(rowA).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("button", { name: "Перевести: Название" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Перевести: Описание" })).toBeInTheDocument();

    const titleA = screen.getByRole("textbox", { name: "Казахский: Название" });
    await user.type(titleA, "Атауы A");
    const descriptionA = setDescription("Казахский", "Описание A");
    expect(descriptionA).toHaveTextContent("Описание A");
    expect(descriptionA.closest("[data-translation-field-row]")).toHaveAttribute(
      "data-translation-field-key",
      "position:translation-state-a:kk:description",
    );
    expect(screen.queryByRole("button", { name: "Перевести автоматически: Название" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Перевести автоматически: Описание" })).not.toBeInTheDocument();

    await user.click(rowB);
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toHaveValue("");
    const emptyDescriptionB = screen.getByRole("textbox", { name: "Казахский: Описание" });
    expect(emptyDescriptionB).toBeEmptyDOMElement();
    expect(emptyDescriptionB.closest("[data-translation-field-row]")).toHaveAttribute(
      "data-translation-field-key",
      "position:translation-state-b:kk:description",
    );
    await user.type(screen.getByRole("textbox", { name: "Казахский: Название" }), "Атауы B");
    setDescription("Казахский", "Описание B");

    await user.click(rowA);
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toHaveValue("Атауы A");
    expect(screen.getByRole("textbox", { name: "Казахский: Описание" })).toHaveTextContent("Описание A");

    await user.click(screen.getByRole("button", { name: "Английский" }));
    expect(screen.getByRole("textbox", { name: "Английский: Название" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Английский: Описание" })).toBeEmptyDOMElement();
    expect(screen.getByRole("button", { name: "Перевести: Название" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Перевести: Описание" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Казахский. Скрыт" }));
    setDescription("Казахский", "");
    const aiDescription = screen.getByRole("button", { name: "Перевести: Описание" });
    await user.click(aiDescription);
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Казахский: Описание" })).toHaveTextContent("[kk] Оригинальное описание A"));

    await user.click(rowB);
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toHaveValue("Атауы B");
    expect(screen.getByRole("textbox", { name: "Казахский: Описание" })).toHaveTextContent("Описание B");
    await user.click(rowA);
    expect(screen.getByRole("textbox", { name: "Казахский: Описание" })).toHaveTextContent("[kk] Оригинальное описание A");

    await waitFor(() => {
      const records = JSON.parse(window.localStorage.getItem("tasko.catalog.itemRecords") ?? "{}") as Record<string, CatalogItem>;
      expect(records[positionA.id]?.titleTranslations?.kk).toBe("Атауы A");
      expect(records[positionA.id]?.descriptionTranslations?.kk).toContain("[kk] Оригинальное описание A");
      expect(records[positionB.id]?.titleTranslations?.kk).toBe("Атауы B");
      expect(records[positionB.id]?.descriptionTranslations?.kk).toContain("Описание B");
    });

    const persistedItems = JSON.parse(window.localStorage.getItem("tasko.catalog.itemRecords") ?? "{}") as Record<string, CatalogItem>;
    firstRender.unmount();
    renderWorkspace({ sections: [section], items: [persistedItems[positionA.id], persistedItems[positionB.id]] });
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toHaveValue("Атауы A");
    expect(screen.getByRole("textbox", { name: "Казахский: Описание" })).toHaveTextContent("[kk] Оригинальное описание A");
    await user.click(screen.getByRole("button", { name: "Выбрать позицию «Позиция B»" }));
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toHaveValue("Атауы B");
    expect(screen.getByRole("textbox", { name: "Казахский: Описание" })).toHaveTextContent("Описание B");

    await user.click(screen.getByRole("button", { name: "Английский" }));
    expect(screen.getAllByRole("img", { name: "Перевод не заполнен" })).toHaveLength(2);
    expect(screen.getByRole("button", { name: "Перевести: Название" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Перевести: Описание" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Тест: массовый перевод позиций на английский" }));
    await waitFor(() => expect(screen.getByRole("textbox", { name: "Английский: Название" })).toHaveValue("[en] Позиция B"));
    expect(screen.getByRole("textbox", { name: "Английский: Описание" })).toHaveTextContent("[en] Оригинальное описание B");
    await user.click(screen.getByRole("button", { name: "Выбрать позицию «Позиция A»" }));
    expect(screen.getByRole("textbox", { name: "Английский: Название" })).toHaveValue("[en] Позиция A");
    expect(screen.getByRole("textbox", { name: "Английский: Описание" })).toHaveTextContent("[en] Оригинальное описание A");
    expect(screen.queryByRole("img", { name: "Перевод не заполнен" })).not.toBeInTheDocument();

    await waitFor(() => {
      const records = JSON.parse(window.localStorage.getItem("tasko.catalog.itemRecords") ?? "{}") as Record<string, CatalogItem>;
      expect(records[positionA.id]?.descriptionTranslations?.en).toContain("[en] Оригинальное описание A");
      expect(records[positionB.id]?.descriptionTranslations?.en).toContain("[en] Оригинальное описание B");
    });
  });

  it("translates fields independently and clears the AI indicator after manual editing", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    window.localStorage.setItem("tasko.translations.reset-languages.v1.seed-owner", JSON.stringify(["kk"]));
    const { container } = renderWorkspace({
      sections: [section],
      items: [{
        ...item,
        description: "Сытное блюдо на завтрак",
        hasDescription: true,
        titleTranslations: {},
        descriptionTranslations: {},
      }],
    });

    expect(container.querySelector("[data-translations-sidebar]")).toHaveClass("border-r", "border-stone-200");
    expect(container.querySelector("[data-translations-table-gap]")).toHaveClass("h-1.5");
    expect(container.querySelector("[data-translations-table-header]")).toHaveClass("bg-white");
    expect(container.querySelector("[data-translations-table-body]")).toHaveClass("bg-[#f5f5f4]");
    expect(container.querySelector("[data-translations-table]")).toHaveClass("border-b", "border-stone-200");
    expect(container.querySelector("[data-translations-original-background]")).not.toBeInTheDocument();
    expect(container.querySelector("[data-translations-target-background]")).not.toBeInTheDocument();

    const fieldRows = Array.from(container.querySelectorAll("[data-translation-field-row]"));
    expect(fieldRows).toHaveLength(2);
    fieldRows.forEach((row) => {
      expect(row.querySelector("[data-translation-field-label]")).toHaveClass("bg-white");
      expect(row.querySelector("[data-translation-source-field]")).toHaveClass("bg-[#fafaf9]");
      expect(row.querySelector("[data-translation-target-field]")).toHaveClass("bg-white");
    });

    const originalDescription = screen.getByRole("textbox", { name: "Оригинал: Описание" });
    expect(originalDescription.parentElement?.parentElement).toHaveClass("[&>div]:bg-transparent", "[&>div>div]:bg-transparent");

    const titleInput = screen.getByRole("textbox", { name: "Казахский: Название" });
    expect(titleInput).toHaveClass("border-0", "rounded-none", "focus:bg-transparent", "focus-visible:border-0");
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
    expect(screen.queryByRole("button", { name: "Перевести автоматически: Название" })).not.toBeInTheDocument();
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
    window.localStorage.setItem("tasko.translations.reset-languages.v1.seed-owner", JSON.stringify(["kk"]));
    renderWorkspace({
      sections: [section],
      items: [{
        ...item,
        description,
        hasDescription: true,
        titleTranslations: {},
        descriptionTranslations: {},
      }],
    });

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
