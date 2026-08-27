import { type ReactNode } from "react";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider, type CatalogStoreInitialData } from "@/contexts/catalog-store-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { TranslationsProvider } from "@/contexts/translations-context";
import { catalogItems, catalogSections } from "@/data/catalog";
import { TranslationsWorkspace } from "./translations-workspace-v2";

const PRIMARY_CONFIRMED_KEY = "tasko.translations.primary-language-confirmed.v1.seed-owner";

function Providers({ children, initialData }: { children: ReactNode; initialData?: CatalogStoreInitialData }) {
  return (
    <MockAuthProvider>
      <AppSettingsProvider>
        <CatalogStoreProvider initialData={initialData}>
          <TranslationsProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </TranslationsProvider>
        </CatalogStoreProvider>
      </AppSettingsProvider>
    </MockAuthProvider>
  );
}

function renderWorkspace(initialData?: CatalogStoreInitialData) {
  window.localStorage.setItem(PRIMARY_CONFIRMED_KEY, "true");
  return render(<TranslationsWorkspace />, { wrapper: ({ children }) => <Providers initialData={initialData}>{children}</Providers> });
}

describe("translations workspace v2", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("switches target languages and opens the shared original-language popover", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    renderWorkspace({ sections: [section], items: [item] });

    expect(screen.getByRole("heading", { name: "Переводы" })).toBeInTheDocument();
    expect(screen.getByText("Русский (оригинал)")).toBeInTheDocument();
    expect(screen.getAllByText("Казахский").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /^Английский, / }));
    expect(screen.getByText("Английский", { selector: "div" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Действия переводов" }));
    const menu = screen.getByRole("dialog");
    expect(within(menu).getAllByRole("button")).toHaveLength(1);
    await user.click(within(menu).getByRole("button", { name: "Изменить язык оригинала" }));
    expect(within(menu).getByText("Текущий язык оригинала")).toBeInTheDocument();
    await user.click(within(menu).getByRole("button", { name: /Английский/ }));
    expect(within(menu).getByText(/Смена языка оригинала повлияет/)).toBeInTheDocument();
    await user.click(within(menu).getByRole("button", { name: "Сделать основным" }));
    await waitFor(() => expect(screen.getByText("Английский (оригинал)")).toBeInTheDocument());
  });

  it("deletes, hides, shows, and promotes languages from compact popovers", async () => {
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
    expect(within(languageMenu).getByText("Скрыть «Английский» из меню?")).toBeInTheDocument();
    expect(within(languageMenu).getByText("Гости больше не смогут выбрать этот язык. Все переводы сохранятся.")).toBeInTheDocument();
    await user.click(within(languageMenu).getByRole("button", { name: "Скрыть" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(within(container.querySelector('[data-translation-language="en"]') as HTMLElement).getByRole("img", { name: "Скрыт из меню" })).toBeInTheDocument();

    await user.click(actions);
    languageMenu = screen.getByRole("dialog");
    expect(within(languageMenu).getByRole("button", { name: "Показать в меню" })).toBeInTheDocument();
    await user.click(within(languageMenu).getByRole("button", { name: "Показать в меню" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

    await user.click(actions);
    languageMenu = screen.getByRole("dialog");
    await user.click(within(languageMenu).getByRole("button", { name: "Сделать основным" }));
    expect(within(languageMenu).getByText("Текущий язык оригинала")).toBeInTheDocument();
    await user.click(within(languageMenu).getByRole("button", { name: "Сделать основным" }));
    await waitFor(() => expect(screen.getByText("Английский (оригинал)")).toBeInTheDocument());
  });

  it("keeps a newly added language translating for at least 40 seconds", async () => {
    vi.useFakeTimers();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const { container } = renderWorkspace({ sections: [section], items: [item] });

    fireEvent.click(screen.getByRole("button", { name: "Действия языка «Английский»" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Удалить" }));
    await act(async () => {
      fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Удалить" }));
      await Promise.resolve();
    });

    fireEvent.click(screen.getByRole("button", { name: "Добавить язык" }));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /Английский/ }));
    await act(async () => { await vi.advanceTimersByTimeAsync(0); });

    expect(container.querySelector('[data-translation-language="en"]')).toHaveAttribute("data-translation-state", "translating");
    expect(screen.getByRole("button", { name: /Английский\. Идёт автоматический перевод/ })).toBeDisabled();
    expect(screen.getByText("Можно закрыть эту страницу — перевод продолжится в фоне")).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: "Опубликовать после перевода" })).toBeChecked();
    expect(screen.getByRole("button", { name: "Добавить язык" })).toBeDisabled();
    expect(container.querySelector('[data-translation-language="kk"]')).not.toHaveTextContent("%");
    expect(screen.getByRole("textbox", { name: "Казахский: Название" })).toBeEnabled();

    await act(async () => { await vi.advanceTimersByTimeAsync(39_900); });
    expect(container.querySelector('[data-translation-language="en"]')).toHaveAttribute("data-translation-state", "translating");

    await act(async () => { await vi.advanceTimersByTimeAsync(400); });
    expect(container.querySelector('[data-translation-language="en"]')).toHaveAttribute("data-translation-state", "ready");
    expect(screen.queryByText("Можно закрыть эту страницу — перевод продолжится в фоне")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Добавить язык" })).toBeEnabled();
    expect(container.querySelector('[data-translation-language="kk"]')).toHaveTextContent("%");
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
});
