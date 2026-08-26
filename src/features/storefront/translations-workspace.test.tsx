import { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider, useCatalogStore } from "@/contexts/catalog-store-context";
import { MockAuthProvider, useMockAuth } from "@/contexts/mock-auth-context";
import { TranslationsProvider } from "@/contexts/translations-context";
import { TranslationOverlays, TranslationsWorkspace } from "./translations-workspace";

const PRIMARY_CONFIRMED_KEY = "tasko.translations.primary-language-confirmed.v1.seed-owner";
const JOBS_KEY = "tasko.translations.jobs.v1.seed-owner";

function Providers({ children }: { children: ReactNode }) {
  return (
    <MockAuthProvider>
      <AppSettingsProvider>
        <CatalogStoreProvider>
          <TranslationsProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </TranslationsProvider>
        </CatalogStoreProvider>
      </AppSettingsProvider>
    </MockAuthProvider>
  );
}

function WorkspaceStateProbe() {
  const { account } = useMockAuth();
  return (
    <output data-testid="workspace-state">
      {JSON.stringify({
        primaryLanguage: account?.workspace.primaryLanguage,
        languages: account?.workspace.languages,
        publishedLanguages: account?.workspace.publishedSnapshot?.publishedLanguages,
        publishedCatalog: account?.workspace.publishedSnapshot?.catalogSnapshot,
      })}
    </output>
  );
}

function CatalogStateProbe() {
  const { items, updateItem } = useCatalogStore();
  return (
    <>
      <button type="button" onClick={() => items[0] && updateItem(items[0].id, { title: "Изменённый источник" })}>Изменить исходник</button>
      <output data-testid="catalog-translation">{JSON.stringify(items[0]?.titleTranslations ?? {})}</output>
    </>
  );
}

function renderWorkspace({ confirmed = true }: { confirmed?: boolean } = {}) {
  if (confirmed) window.localStorage.setItem(PRIMARY_CONFIRMED_KEY, "true");
  return render(
    <>
      <TranslationsWorkspace onOpenOriginal={() => {}} />
      <TranslationOverlays />
      <WorkspaceStateProbe />
      <CatalogStateProbe />
    </>,
    { wrapper: Providers },
  );
}

function workspaceState() {
  return JSON.parse(screen.getByTestId("workspace-state").textContent ?? "{}") as {
    primaryLanguage: string;
    languages: Array<{ code: string; status: string; visible: boolean }>;
    publishedLanguages: string[];
    publishedCatalog: Record<string, string>;
  };
}

async function addSerbian(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Добавить язык" }));
  const picker = screen.getByRole("dialog", { name: "Добавить язык" });
  await user.click(within(picker).getByRole("button", { name: /Srpski/ }));
}

describe("translations workspace", () => {
  beforeEach(() => {
    document.body.removeAttribute("style");
    document.body.removeAttribute("data-scroll-locked");
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });

  it("confirms the detected content language only on first entry and lets the user change it", async () => {
    const user = userEvent.setup();
    renderWorkspace({ confirmed: false });

    expect(screen.getByRole("heading", { name: "Основной язык контента" })).toBeInTheDocument();
    expect(screen.getByText(/будет использоваться как исходный/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("combobox", { name: "Основной язык контента" }));
    fireEvent.click(screen.getByRole("option", { name: "English" }));
    await user.click(screen.getByRole("button", { name: "Подтвердить" }));

    await waitFor(() => expect(workspaceState().primaryLanguage).toBe("en"));
    expect(screen.getByText(/Основной язык:/)).toHaveTextContent("English");
    expect(screen.queryByRole("heading", { name: "Основной язык контента" })).not.toBeInTheDocument();
  });

  it("opens directly in the workspace with five target languages and source beside target", () => {
    renderWorkspace();

    ["Қазақша", "English", "中文", "Français", "Español"].forEach((language) => {
      expect(screen.getAllByText(language).length).toBeGreaterThan(0);
    });
    expect(screen.getByText("Русский · оригинал")).toBeInTheDocument();
    expect(screen.getByText("Қазақша · перевод")).toBeInTheDocument();
    expect(screen.queryByText("Опубликован")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Открыть" })).not.toBeInTheDocument();
  });

  it("adds a language in one step, starts translation immediately, and defaults to auto-publication", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await addSerbian(user);

    expect(await screen.findByText("Переводим на Srpski")).toBeInTheDocument();
    expect(screen.getAllByText(/Можно закрыть админку/).length).toBeGreaterThan(0);
    expect(screen.getByRole("checkbox")).toBeChecked();
    expect(screen.queryByRole("button", { name: "Перевести и опубликовать" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Перевести для проверки" })).not.toBeInTheDocument();
    expect(screen.queryByText(/\d+%/)).not.toBeInTheDocument();
  });

  it("keeps the language as a draft when auto-publication is disabled", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await addSerbian(user);

    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("checkbox")).not.toBeChecked();

    await waitFor(() => {
      expect(workspaceState().languages.find(({ code }) => code === "sr")).toMatchObject({ status: "ready", visible: false });
      expect(workspaceState().publishedLanguages).not.toContain("sr");
    }, { timeout: 3500 });
    expect(screen.getAllByText("Черновик").length).toBeGreaterThan(0);
  });

  it("publishes an added language after the background translation completes", async () => {
    const user = userEvent.setup();
    renderWorkspace();
    await addSerbian(user);

    await waitFor(() => {
      expect(workspaceState().languages.find(({ code }) => code === "sr")).toMatchObject({ status: "ready", visible: true });
      expect(workspaceState().publishedLanguages).toContain("sr");
      expect(Object.values(workspaceState().publishedCatalog).join("\n")).toContain("[Srpski]");
    }, { timeout: 3500 });
  });

  it("restores an in-flight background translation after remounting", async () => {
    const user = userEvent.setup();
    const view = renderWorkspace();
    await addSerbian(user);
    expect(await screen.findByText("Переводим на Srpski")).toBeInTheDocument();
    view.unmount();

    renderWorkspace();
    expect(await screen.findByText("Переводим на Srpski")).toBeInTheDocument();
    await waitFor(() => expect(workspaceState().publishedLanguages).toContain("sr"), { timeout: 3500 });
  });

  it("moves a published language to draft with confirmation and publishes it again from More", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Действия для English" }));
    await user.click(screen.getByRole("menuitem", { name: "Сделать черновиком" }));
    const confirmation = screen.getByRole("alertdialog", { name: /Сделать English черновиком/ });
    expect(within(confirmation).getByText(/исчезнет из гостевого онлайн-меню/)).toBeInTheDocument();
    await user.click(within(confirmation).getByRole("button", { name: "Сделать черновиком" }));
    await waitFor(() => expect(workspaceState().publishedLanguages).not.toContain("en"));

    await user.click(screen.getByRole("button", { name: "Действия для English" }));
    await user.click(screen.getByRole("menuitem", { name: "Опубликовать" }));
    await waitFor(() => expect(workspaceState().publishedLanguages).toContain("en"));
  });

  it("preserves a manual translation, marks the changed source for review, and lets the user confirm it", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "English" }));
    fireEvent.click(screen.getByRole("combobox", { name: "Раздел контента" }));
    fireEvent.click(screen.getByRole("option", { name: "Позиции и разделы" }));
    const titleTranslation = screen.getAllByPlaceholderText("Введите перевод")[0] as HTMLInputElement;
    fireEvent.change(titleTranslation, { target: { value: "Manual translation" } });
    await user.click(screen.getByRole("button", { name: "Изменить исходник" }));

    await waitFor(() => expect(screen.getAllByText("На проверку").length).toBeGreaterThan(0), { timeout: 3500 });
    expect(JSON.parse(screen.getByTestId("catalog-translation").textContent ?? "{}").en).toBe("Manual translation");
    await user.click(screen.getAllByRole("button", { name: "Проверено" })[0]);
    await waitFor(() => expect(screen.queryByText("На проверку")).not.toBeInTheDocument());
  }, 10_000);

  it("shows automatic origin as metadata and keeps only the useful filters", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect(screen.getAllByRole("img", { name: /Переведено автоматически/ }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /Автоперевести:/ }).length).toBeGreaterThan(0);
    await user.click(screen.getByRole("button", { name: "Фильтр: Все" }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Все" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "На проверку" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Не переведено" })).toBeInTheDocument();
    expect(within(menu).queryByText("Переведено")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Перевести все/ })).not.toBeInTheDocument();
  });

  it("warns before changing the source language after targets exist", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Настройки переводов" }));
    await user.click(screen.getByRole("menuitem", { name: "Изменить основной язык" }));
    fireEvent.click(await screen.findByRole("combobox", { name: "Новый основной язык" }));
    fireEvent.click(screen.getByRole("option", { name: "English" }));
    expect(screen.getByText(/повлияет на все существующие переводы/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Изменить язык" }));

    await waitFor(() => expect(workspaceState().primaryLanguage).toBe("en"));
    expect(screen.getByText(/Основной язык:/)).toHaveTextContent("English");
  });

  it("shows a recoverable error state and retries only the failed job", async () => {
    const user = userEvent.setup();
    const now = Date.now();
    window.localStorage.setItem(PRIMARY_CONFIRMED_KEY, "true");
    window.localStorage.setItem(JOBS_KEY, JSON.stringify([{
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
    }]));
    renderWorkspace();

    expect(screen.getByText("Не удалось перевести часть текстов")).toBeInTheDocument();
    expect(screen.getByText(/только элементы из этого задания/)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Повторить" }));
    expect(await screen.findByText("Повторный перевод запущен")).toBeInTheDocument();
  });

  it("shows the empty state after the last target language is removed", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    for (const language of ["Қазақша", "English", "中文", "Français", "Español"]) {
      await user.click(screen.getByRole("button", { name: `Действия для ${language}` }));
      await user.click(screen.getByRole("menuitem", { name: "Удалить язык" }));
      await user.click(screen.getByRole("button", { name: "Удалить язык" }));
    }

    expect(await screen.findByRole("heading", { name: "Переводов пока нет" })).toBeInTheDocument();
    expect(screen.getByText("Добавьте язык, чтобы перевести контент ресторана.")).toBeInTheDocument();
  });
});
