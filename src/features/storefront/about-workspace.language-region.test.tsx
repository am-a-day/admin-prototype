import { type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider } from "@/contexts/catalog-store-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { PublishProvider } from "@/contexts/publish-context";
import { AboutTabs, AboutWorkspace } from "./about-workspace";

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

describe("restaurant profile information architecture", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });

  it("restores the language and region entry point as a peer restaurant tab", () => {
    render(<AboutTabs value="info" onChange={() => {}} />);

    expect(screen.getByRole("tab", { name: "Язык и регион" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Профиль" })).toBeInTheDocument();
  });

  it("does not move currency, timezone or language management into Profile", () => {
    render(
      <AboutWorkspace
        aboutTab="info"
        onAboutTabChange={() => {}}
        setPreviewScenario={() => {}}
        onConfigureOrderSettings={() => {}}
        seoTitle=""
        setSeoTitle={() => {}}
        seoDescription=""
        setSeoDescription={() => {}}
      />,
      { wrapper: Providers },
    );

    expect(screen.queryByRole("combobox", { name: "Валюта" })).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox", { name: "Часовой пояс" })).not.toBeInTheDocument();
    expect(screen.queryByText("Основной язык")).not.toBeInTheDocument();
  });

  it("keeps currency and timezone settings on the dedicated tab", async () => {
    const user = userEvent.setup();
    render(
      <AboutWorkspace
        aboutTab="language-region"
        onAboutTabChange={() => {}}
        setPreviewScenario={() => {}}
        onConfigureOrderSettings={() => {}}
        seoTitle=""
        setSeoTitle={() => {}}
        seoDescription=""
        setSeoDescription={() => {}}
      />,
      { wrapper: Providers },
    );

    expect(screen.getByRole("heading", { name: "Язык и регион" })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Валюта" })).toHaveTextContent("Казахстанский тенге — KZT");
    expect(screen.getByRole("combobox", { name: "Часовой пояс" })).toHaveTextContent("Казахстан, UTC+5");

    screen.getByRole("combobox", { name: "Валюта" }).focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(screen.getByRole("combobox", { name: "Валюта" })).toHaveTextContent("Сербский динар — RSD");

    screen.getByRole("combobox", { name: "Часовой пояс" }).focus();
    await user.keyboard("{ArrowDown}{ArrowDown}{Enter}");
    expect(screen.getByRole("combobox", { name: "Часовой пояс" })).toHaveTextContent("Белград, Центральная Европа");
  });
});
