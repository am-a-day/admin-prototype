import { type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
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

  it("removes the language and region entry point from restaurant tabs", () => {
    render(<AboutTabs value="info" onChange={() => {}} />);

    expect(screen.queryByRole("button", { name: "Язык и регион" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Профиль" })).toBeInTheDocument();
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
});
