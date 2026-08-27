import { type ReactNode } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
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

  it("switches target languages and opens the primary-language popover", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    renderWorkspace({ sections: [section], items: [item] });

    expect(screen.getByRole("heading", { name: "Переводы" })).toBeInTheDocument();
    expect(screen.getByText("Оригинал (Русский)")).toBeInTheDocument();
    expect(screen.getAllByText("Қазақша").length).toBeGreaterThan(0);

    await user.click(screen.getByRole("button", { name: /English/ }));
    expect(screen.getByText("English", { selector: "div" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Выбрать основной язык" }));
    expect(screen.getByText("Исходный язык для всех переводов")).toBeInTheDocument();
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
  });

  it("translates fields independently and clears the AI indicator after manual editing", async () => {
    const user = userEvent.setup();
    const item = catalogItems[0];
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId) ?? catalogSections[0];
    renderWorkspace({ sections: [section], items: [{ ...item, description: "Сытное блюдо на завтрак", hasDescription: true }] });

    const titleInput = screen.getByRole("textbox", { name: "Қазақша: Название" });
    await user.click(screen.getByRole("button", { name: /Перевести заново: Название|Перевести: Название/ }));
    expect(await screen.findByRole("img", { name: "Переведено автоматически: Название" })).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: "Қолмен өзгертілген атау" } });
    await waitFor(() => expect(screen.queryByRole("img", { name: "Переведено автоматически: Название" })).not.toBeInTheDocument());

    const descriptionAction = screen.getByRole("button", { name: /Перевести заново: Описание|Перевести: Описание/ });
    await user.click(descriptionAction);
    expect(screen.getByRole("textbox", { name: "Қазақша: Описание" })).toBeInTheDocument();
    expect(await screen.findByRole("img", { name: "Переведено автоматически: Описание" })).toBeInTheDocument();

    fireEvent.change(titleInput, { target: { value: "" } });
    await waitFor(() => expect(screen.getByRole("img", { name: "Перевод не заполнен" })).toBeInTheDocument());
  });
});
