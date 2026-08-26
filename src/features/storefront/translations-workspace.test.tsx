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

function renderWorkspace() {
  return render(<><TranslationsWorkspace onOpenOriginal={() => {}} /><TranslationOverlays /><WorkspaceStateProbe /><CatalogStateProbe /></>, { wrapper: Providers });
}

function workspaceState() {
  return JSON.parse(screen.getByTestId("workspace-state").textContent ?? "{}") as {
    languages: Array<{ code: string; status: string; visible: boolean }>;
    publishedLanguages: string[];
    publishedCatalog: Record<string, string>;
  };
}

describe("translations workspace", () => {
  beforeEach(() => {
    document.body.removeAttribute("style");
    document.body.removeAttribute("data-scroll-locked");
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });

  it("shows the primary language with five additional languages and no permanent publication badges", () => {
    renderWorkspace();

    expect(screen.getByText("Русский")).toBeInTheDocument();
    expect(screen.getByText("Основной")).toBeInTheDocument();
    ["Қазақша", "English", "中文", "Français", "Español"].forEach((language) => {
      expect(screen.getByText(language)).toBeInTheDocument();
    });
    expect(screen.queryByText("Опубликован")).not.toBeInTheDocument();
    expect(screen.queryByText("Не опубликован")).not.toBeInTheDocument();
  });

  it("always starts translation when a language is added and offers publish or review", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    const picker = screen.getByRole("dialog", { name: "Добавить язык" });
    fireEvent.click(within(picker).getByRole("button", { name: /Srpski/ }));

    expect(screen.getByText(/Мы автоматически переведём существующий контент/)).toBeInTheDocument();
    expect(screen.getByText(/продолжится, даже если закрыть админку/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Перевести и опубликовать" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Перевести для проверки" })).toBeInTheDocument();
    expect(screen.queryByText("Добавить без перевода")).not.toBeInTheDocument();
    expect(screen.queryByText("Настройки автоперевода")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Перевести для проверки" }));
    expect(await screen.findByText("Перевод запущен. Можно закрыть админку — процесс продолжится в фоне.")).toBeInTheDocument();
    expect(await screen.findByText(/Переводим…/)).toBeInTheDocument();
    expect(await screen.findByText("Srpski")).toBeInTheDocument();
  });

  it("finishes review translations as ready but unpublished", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Добавить язык" })).getByRole("button", { name: /Srpski/ }));
    fireEvent.click(screen.getByRole("button", { name: "Перевести для проверки" }));

    await waitFor(() => {
      const state = workspaceState();
      expect(state.languages.find(({ code }) => code === "sr")).toMatchObject({ status: "ready", visible: false });
      expect(state.publishedLanguages).not.toContain("sr");
      expect(JSON.parse(screen.getByTestId("catalog-translation").textContent ?? "{}").sr).toMatch(/^\[Srpski\]/);
    }, { timeout: 3000 });
  });

  it("publishes an added language only after translation completes", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Добавить язык" })).getByRole("button", { name: /Srpski/ }));
    fireEvent.click(screen.getByRole("button", { name: "Перевести и опубликовать" }));

    await waitFor(() => {
      const state = workspaceState();
      expect(state.languages.find(({ code }) => code === "sr")).toMatchObject({ status: "ready", visible: true });
      expect(state.publishedLanguages).toContain("sr");
      expect(Object.values(state.publishedCatalog).join("\n")).toContain("[Srpski]");
    }, { timeout: 3000 });
  });

  it("restores pending auto-publication if the admin closes in the final publish window", async () => {
    const user = userEvent.setup();
    const view = renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Добавить язык" })).getByRole("button", { name: /Srpski/ }));
    fireEvent.click(screen.getByRole("button", { name: "Перевести и опубликовать" }));
    await waitFor(() => {
      expect(workspaceState().languages.find(({ code }) => code === "sr")).toMatchObject({ status: "ready", visible: false });
    }, { timeout: 3000 });
    view.unmount();

    renderWorkspace();
    await waitFor(() => {
      expect(workspaceState().languages.find(({ code }) => code === "sr")).toMatchObject({ status: "ready", visible: true });
      expect(workspaceState().publishedLanguages).toContain("sr");
    }, { timeout: 3000 });
  }, 10_000);

  it("restores an in-flight background translation after remounting", async () => {
    const user = userEvent.setup();
    const view = renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Добавить язык" })).getByRole("button", { name: /Srpski/ }));
    fireEvent.click(screen.getByRole("button", { name: "Перевести для проверки" }));
    expect(await screen.findByText(/Переводим…/)).toBeInTheDocument();
    view.unmount();

    await new Promise((resolve) => window.setTimeout(resolve, 1600));
    renderWorkspace();
    await waitFor(() => {
      expect(workspaceState().languages.find(({ code }) => code === "sr")).toMatchObject({ status: "ready", visible: false });
    }, { timeout: 3000 });
  });

  it("cancels an active background job when its language is deleted", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    fireEvent.click(within(screen.getByRole("dialog", { name: "Добавить язык" })).getByRole("button", { name: /Srpski/ }));
    fireEvent.click(screen.getByRole("button", { name: "Перевести для проверки" }));
    expect(await screen.findByText(/Переводим…/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Действия для Srpski" }));
    await user.click(screen.getByRole("menuitem", { name: "Удалить язык" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить язык" }));
    await new Promise((resolve) => window.setTimeout(resolve, 1700));

    expect(workspaceState().languages.some(({ code }) => code === "sr")).toBe(false);
    expect(JSON.parse(screen.getByTestId("catalog-translation").textContent ?? "{}").sr).toBeUndefined();
  });

  it("automatically refreshes translations when any source field changes", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Изменить исходник" }));
    expect(await screen.findByText(/Перевод запущен/)).toBeInTheDocument();
    await waitFor(() => {
      const translations = JSON.parse(screen.getByTestId("catalog-translation").textContent ?? "{}") as Record<string, string>;
      expect(translations.en).toBe("[English] Изменённый источник");
    }, { timeout: 3500 });
  });

  it("does not silently overwrite a manually edited translation after a source change", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getAllByRole("button", { name: "Открыть" })[0]);
    const titleTranslation = screen.getAllByPlaceholderText("Введите перевод")[0];
    await user.click(screen.getAllByRole("button", { name: "Автоперевести" })[0]);
    await user.type(titleTranslation, " — исправлено вручную");
    const manuallyEditedValue = (titleTranslation as HTMLInputElement).value;
    expect(manuallyEditedValue).toMatch(/^\[English\]/);
    await user.click(screen.getByRole("button", { name: "Изменить исходник" }));
    expect(await screen.findByText(/Перевод запущен/)).toBeInTheDocument();

    await new Promise((resolve) => window.setTimeout(resolve, 1900));
    const translations = JSON.parse(screen.getByTestId("catalog-translation").textContent ?? "{}") as Record<string, string>;
    expect(translations.en).toBe(manuallyEditedValue);
  }, 10_000);

  it("changes the primary language only after explaining its effect", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Действия для English" }));
    await user.click(screen.getByRole("menuitem", { name: "Сделать основным" }));
    const confirmation = screen.getByRole("alertdialog", { name: /Сделать English основным языком/ });
    expect(within(confirmation).getByText("Этот язык станет исходным для последующих автоматических переводов.")).toBeInTheDocument();
    fireEvent.click(within(confirmation).getByRole("button", { name: "Сделать основным" }));

    expect(screen.getByText("English").closest("section")).toHaveTextContent("Основной");
    expect(screen.getByText("Русский")).toBeInTheDocument();
  });

  it("updates the published snapshot when a language is unpublished or deleted", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getByRole("button", { name: "Действия для English" }));
    await user.click(screen.getByRole("menuitem", { name: "Снять с публикации" }));
    await waitFor(() => expect(workspaceState().publishedLanguages).not.toContain("en"));

    await user.click(screen.getByRole("button", { name: "Действия для English" }));
    await user.click(screen.getByRole("menuitem", { name: "Удалить язык" }));
    fireEvent.click(screen.getByRole("button", { name: "Удалить язык" }));
    await waitFor(() => {
      expect(workspaceState().languages.some(({ code }) => code === "en")).toBe(false);
      expect(workspaceState().publishedLanguages).not.toContain("en");
    });
  });

  it("keeps only three editor filters and exposes auto-translate on each field", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    await user.click(screen.getAllByRole("button", { name: /Открыть/ })[0]);
    await user.click(screen.getByRole("button", { name: "Фильтр: Все" }));
    const menu = screen.getByRole("menu");

    expect(within(menu).getByRole("menuitem", { name: "Все" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Не переведено" })).toBeInTheDocument();
    expect(within(menu).getByRole("menuitem", { name: "Переведено" })).toBeInTheDocument();
    expect(within(menu).queryByText("Требует обновления")).not.toBeInTheDocument();
    expect(within(menu).queryByText("Автоперевод")).not.toBeInTheDocument();

    await user.keyboard("{Escape}");
    expect(screen.getAllByRole("button", { name: "Автоперевести" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("button", { name: /Перевести все/ })).not.toBeInTheDocument();
  });
});
