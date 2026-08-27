import { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
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

  it("switches target languages and opens the shared original-language popover", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    renderWorkspace({ sections: [section], items: [item] });

    expect(screen.getByRole("heading", { name: "Переводы" })).toBeInTheDocument();
    expect(screen.getByText("Оригинал (Русский)")).toBeInTheDocument();
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
    await waitFor(() => expect(screen.getByText("Оригинал (Английский)")).toBeInTheDocument());
  });

  it("deletes, adds, translates, hides, shows, and promotes a language from compact popovers", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const { container } = renderWorkspace({ sections: [section], items: [item] });

    await user.click(screen.getByRole("button", { name: "Действия языка «Английский»" }));
    let languageMenu = screen.getByRole("dialog");
    expect(within(languageMenu).getByRole("button", { name: "Сделать основным" })).toBeInTheDocument();
    expect(within(languageMenu).getByRole("button", { name: "Скрыть из меню" })).toBeInTheDocument();
    expect(within(languageMenu).getByRole("button", { name: "Удалить" })).toHaveClass("text-[#c10007]");

    await user.click(within(languageMenu).getByRole("button", { name: "Удалить" }));
    expect(within(languageMenu).getByText(/Удалить язык «Английский»/)).toBeInTheDocument();
    await user.click(within(languageMenu).getByRole("button", { name: "Удалить" }));
    await waitFor(() => expect(screen.queryByRole("button", { name: "Действия языка «Английский»" })).not.toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    const addPopover = screen.getByRole("dialog");
    const languageSearch = within(addPopover).getByRole("textbox", { name: "Поиск языка" });
    await user.type(languageSearch, "англ");
    expect(within(addPopover).queryByText("Казахский")).not.toBeInTheDocument();
    await user.click(within(addPopover).getByRole("button", { name: /Английский/ }));

    await waitFor(() => expect(container.querySelector('[data-translation-language="en"]')).toHaveAttribute("data-translation-state", "translating"));
    expect(screen.getByRole("button", { name: /Английский\. Идёт автоматический перевод/ })).toBeDisabled();
    expect(screen.queryByRole("button", { name: "Действия языка «Английский»" })).not.toBeInTheDocument();

    await waitFor(
      () => expect(container.querySelector('[data-translation-language="en"]')).toHaveAttribute("data-translation-state", "ready"),
      { timeout: 3500 },
    );
    const actions = screen.getByRole("button", { name: "Действия языка «Английский»" });
    await user.click(actions);
    languageMenu = screen.getByRole("dialog");
    await user.click(within(languageMenu).getByRole("button", { name: "Скрыть из меню" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());

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
    await waitFor(() => expect(screen.getByText("Оригинал (Английский)")).toBeInTheDocument());
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
    expect(resizer).toHaveAttribute("aria-valuenow", "222");
    fireEvent.keyDown(resizer, { key: "ArrowRight" });
    expect(resizer).toHaveAttribute("aria-valuenow", "224");
    expect(screen.getByRole("button", { name: "Выбрать тип контента" })).toHaveClass("bg-[#f5f5f4]", "hover:bg-[#e7e5e4]");
  });

  it("translates fields independently and clears the AI indicator after manual editing", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    const { container } = renderWorkspace({ sections: [section], items: [{ ...item, description: "Сытное блюдо на завтрак", hasDescription: true }] });

    const titleInput = screen.getByRole("textbox", { name: "Казахский: Название" });
    const titleAction = screen.getByRole("button", { name: /Перевести заново: Название|Перевести: Название/ });
    expect(titleAction).toHaveTextContent("");
    expect(titleAction.querySelector("svg")).toBeInTheDocument();
    await user.click(titleAction);
    expect(await screen.findByRole("img", { name: "Переведено автоматически: Название" })).toBeInTheDocument();

    fireEvent.focus(titleInput);
    expect(screen.getByRole("img", { name: "Переведено автоматически: Название" })).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: "Қолмен өзгертілген атау" } });
    await waitFor(() => expect(screen.queryByRole("img", { name: "Переведено автоматически: Название" })).not.toBeInTheDocument());
    await waitFor(() => expect(container.querySelector("[data-position-save-status]")).toHaveAttribute("data-save-status", "saved"));

    const descriptionAction = screen.getByRole("button", { name: /Перевести заново: Описание|Перевести: Описание/ });
    await user.click(descriptionAction);
    expect(screen.getByRole("textbox", { name: "Казахский: Описание" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Переведено автоматически: Описание" })).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: "" } });
    await waitFor(() => expect(screen.getByRole("img", { name: "Перевод не заполнен" })).toBeInTheDocument());
  });
});
