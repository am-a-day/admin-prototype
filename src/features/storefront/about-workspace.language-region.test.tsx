import { type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider } from "@/contexts/catalog-store-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { PublishProvider } from "@/contexts/publish-context";
import { AboutWorkspace } from "./about-workspace";

function Providers({ children }: { children: ReactNode }) {
  return (
    <MockAuthProvider>
      <AppSettingsProvider>
        <PublishProvider>
          <CatalogStoreProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </CatalogStoreProvider>
        </PublishProvider>
      </AppSettingsProvider>
    </MockAuthProvider>
  );
}

function renderWorkspace() {
  render(
    <AboutWorkspace
      aboutTab="language-region"
      setPreviewScenario={() => {}}
      onConfigureOrderSettings={() => {}}
      seoTitle=""
      setSeoTitle={() => {}}
      seoDescription=""
      setSeoDescription={() => {}}
    />,
    { wrapper: Providers },
  );
}

describe("language and region workspace", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });

  it("renders the simplified hierarchy and updates both shadcn selects", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    expect(screen.getByRole("heading", { name: "Языки и регион" })).toBeInTheDocument();
    expect(screen.getByText("Настройки языка, отображения цен и локального времени")).toBeInTheDocument();
    expect(screen.queryByText("Региональные настройки")).not.toBeInTheDocument();

    const currencySelect = screen.getByRole("combobox", { name: "Валюта" });
    const initialCurrencyIcon = currencySelect.querySelector("svg")?.innerHTML;
    currencySelect.focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(currencySelect).toHaveTextContent("Сербский динар — RSD");
    expect(currencySelect.querySelector("svg")?.innerHTML).not.toBe(initialCurrencyIcon);

    screen.getByRole("combobox", { name: "Часовой пояс" }).focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(screen.getByRole("combobox", { name: "Часовой пояс" })).toHaveTextContent("Белград, Центральная Европа");
  });

  it("keeps adding, primary-language switching, and removal connected", async () => {
    const user = userEvent.setup();
    renderWorkspace();

    const primaryLanguageChip = screen.getByLabelText("Основной язык").parentElement;
    expect(primaryLanguageChip?.querySelector('button[aria-label^="Действия для языка"]')).toBeNull();

    await user.click(screen.getByRole("button", { name: "Действия для языка English" }));
    await user.click(screen.getByRole("menuitem", { name: "Удалить язык" }));
    await user.click(screen.getByRole("button", { name: "Добавить язык" }));
    await user.click(screen.getByRole("option", { name: /English/ }));
    await user.click(screen.getByRole("button", { name: "Добавить и перевести" }));

    const englishActions = await screen.findByRole("button", { name: "Действия для языка English" });
    await user.click(englishActions);
    await user.click(screen.getByRole("menuitem", { name: "Сделать основным" }));

    await user.click(screen.getByRole("button", { name: "Действия для языка Русский" }));
    await user.click(screen.getByRole("menuitem", { name: "Сделать основным" }));
    await user.click(screen.getByRole("button", { name: "Действия для языка English" }));
    await user.click(screen.getByRole("menuitem", { name: "Удалить язык" }));

    await waitFor(() => {
      expect(screen.queryByRole("button", { name: "Действия для языка English" })).not.toBeInTheDocument();
    });
    expect(screen.getAllByLabelText("Основной язык")).toHaveLength(1);
  });
});
