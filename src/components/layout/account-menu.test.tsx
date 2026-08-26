import { type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { PlanProvider } from "@/contexts/plan-context";
import { PublishProvider } from "@/contexts/publish-context";
import { OrgMenu } from "./account-menu";

function Providers({ children }: { children: ReactNode }) {
  return (
    <MockAuthProvider>
      <AppSettingsProvider>
        <PlanProvider>
          <PublishProvider>
            <TooltipProvider>{children}</TooltipProvider>
          </PublishProvider>
        </PlanProvider>
      </AppSettingsProvider>
    </MockAuthProvider>
  );
}

function renderMenu() {
  return render(<OrgMenu variant="text" onNavigate={vi.fn()} />, { wrapper: Providers });
}

describe("restaurant menu", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });

  it("uses the compact Figma root and combines restaurant with the active location", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Мой ресторан 7470 · ул. Абая 10" }));
    const menu = screen.getByRole("dialog", { name: "Настройки ресторана" });

    expect(within(menu).getByRole("button", { name: /Мой ресторан 7470/ })).toBeInTheDocument();
    expect(within(menu).getByRole("link", { name: /aura\.tsqr\.me/ })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Сотрудники" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "Валюта и часовой пояс" })).toBeInTheDocument();
    expect(within(menu).queryByText("Ваши точки")).not.toBeInTheDocument();
    expect(within(menu).queryByText("Добавить точку")).not.toBeInTheDocument();
    expect(within(menu).queryByText("LITE")).not.toBeInTheDocument();
    expect(within(menu).queryByText("ULTRA")).not.toBeInTheDocument();
  });

  it("moves keyboard focus into the opened restaurant popover", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.tab();
    expect(screen.getByRole("button", { name: "Мой ресторан 7470 · ул. Абая 10" })).toHaveFocus();
    await user.keyboard("{Enter}");

    expect(screen.getByRole("button", { name: /Мой ресторан 7470 START/ })).toHaveFocus();
  });

  it("restores the current location after remounting", async () => {
    const user = userEvent.setup();
    const view = renderMenu();

    await user.click(screen.getByRole("button", { name: "Мой ресторан 7470 · ул. Абая 10" }));
    await user.click(screen.getByRole("button", { name: /Мой ресторан 7470 START/ }));
    await user.click(screen.getByRole("button", { name: "ул. Туран 37" }));
    view.unmount();
    renderMenu();

    expect(screen.getByRole("button", { name: "Мой ресторан 7470 · ул. Туран 37" })).toBeInTheDocument();
  });

  it("keeps locations, staff limits and regional settings inside their submenus", async () => {
    const user = userEvent.setup();
    renderMenu();

    await user.click(screen.getByRole("button", { name: "Мой ресторан 7470 · ул. Абая 10" }));
    const menu = screen.getByRole("dialog", { name: "Настройки ресторана" });
    await user.click(within(menu).getByRole("button", { name: /Мой ресторан 7470/ }));

    expect(screen.getByRole("heading", { name: "Точки ресторана" })).toBeInTheDocument();
    expect(within(menu).getByRole("button", { name: "ул. Абая 10" })).toHaveAttribute("aria-pressed", "true");
    expect(within(menu).getByRole("button", { name: "ул. Туран 37" })).toBeInTheDocument();
    expect(screen.getByText(/Добавление точек доступно на тарифе Ultra/)).toBeInTheDocument();

    await user.click(within(menu).getByRole("button", { name: "ул. Туран 37" }));
    expect(screen.getByRole("button", { name: "Мой ресторан 7470 · ул. Туран 37" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Назад" }));
    expect(within(menu).getByRole("link", { name: /aura-turan\.tsqr\.me/ })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Сотрудники" }));
    expect(screen.getByRole("heading", { name: "Сотрудники" })).toBeInTheDocument();
    expect(screen.getByText("Амадей Щербаков")).toBeInTheDocument();
    expect(screen.getByText(/Приглашение сотрудников доступно на тарифе Lite/)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Назад" }));
    await user.click(screen.getByRole("button", { name: "Валюта и часовой пояс" }));
    expect(screen.getByRole("combobox", { name: "Валюта" })).toHaveTextContent("Казахстанский тенге — KZT");
    expect(screen.getByRole("combobox", { name: "Часовой пояс" })).toHaveTextContent("Казахстан, UTC+5");
  });
});
