import { type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
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

function renderWorkspace(onOpenTranslations = () => {}) {
  render(
    <AboutWorkspace
      aboutTab="language-region"
      setPreviewScenario={() => {}}
      onConfigureOrderSettings={() => {}}
      seoTitle=""
      setSeoTitle={() => {}}
      seoDescription=""
      setSeoDescription={() => {}}
      onOpenTranslations={onOpenTranslations}
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

  it("keeps language management in translations and links to the workspace", async () => {
    const user = userEvent.setup();
    const onOpenTranslations = vi.fn();
    renderWorkspace(onOpenTranslations);

    expect(screen.getByText("Используется как источник для переводов")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить язык" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Действия для языка/ })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Перейти к переводам" }));
    expect(onOpenTranslations).toHaveBeenCalledTimes(1);
  });
});
