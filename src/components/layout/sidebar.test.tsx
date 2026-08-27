import { type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { PlanProvider } from "@/contexts/plan-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { FullSidebar } from "./sidebar";

function Providers({ children }: { children: ReactNode }) {
  return (
    <MockAuthProvider>
      <PlanProvider>
        <TooltipProvider>{children}</TooltipProvider>
      </PlanProvider>
    </MockAuthProvider>
  );
}

describe("shared sidebar", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });

  it("uses the Figma navigation order and keeps existing navigation callbacks", async () => {
    const user = userEvent.setup();
    const onNavigate = vi.fn();

    render(
      <FullSidebar
        section="storefront"
        activeTab="home"
        onNavigate={onNavigate}
        onQuickCreate={() => {}}
      />,
      { wrapper: Providers },
    );

    const navigation = screen.getByRole("navigation");
    expect(navigation).toHaveTextContent(
      "Мой ресторанНайти позициюАналитикаОнлайн-менюГлавнаяКаталогПереводыОформлениеЗаказыНастройка заказовИстория заказовБольше",
    );

    const translations = within(navigation).getByRole("button", { name: "Переводы" });
    const onlineMenuGroup = within(navigation).getByText("Онлайн-меню").parentElement?.parentElement;
    expect(onlineMenuGroup).toContainElement(translations);

    await user.click(translations);
    expect(onNavigate).toHaveBeenCalledWith("storefront", "translations");

    await user.click(within(navigation).getByRole("button", { name: "История заказов" }));
    expect(onNavigate).toHaveBeenCalledWith("management", "order-history");
  });

  it("opens the shadcn master menu and forwards actions to the shared handler", async () => {
    const user = userEvent.setup();
    const onQuickCreate = vi.fn();

    render(
      <FullSidebar
        section="storefront"
        activeTab="about"
        onNavigate={() => {}}
        onQuickCreate={onQuickCreate}
      />,
      { wrapper: Providers },
    );

    await user.click(screen.getByRole("button", { name: "Создать" }));
    const menu = screen.getByRole("menu", { name: "Создать" });

    [
      "Позицию",
      "Раздел",
      "QR-код",
      "Баннер",
      "Промокод",
      "Импорт из Google Sheets",
      "Импорт из iiko",
    ].forEach((label) => {
      expect(within(menu).getByRole("menuitem", { name: new RegExp(label) })).toBeInTheDocument();
    });

    await user.click(within(menu).getByRole("menuitem", { name: "Импорт из Google Sheets" }));
    expect(onQuickCreate).toHaveBeenCalledWith("sheets");
    expect(screen.queryByRole("menu", { name: "Создать" })).not.toBeInTheDocument();
  });

  it("opens Prototype tools from More and marks the entry as DEV", async () => {
    const user = userEvent.setup();
    const onOpenPrototypeTools = vi.fn();

    render(
      <FullSidebar
        section="storefront"
        activeTab="catalog"
        onNavigate={() => {}}
        onOpenPrototypeTools={onOpenPrototypeTools}
      />,
      { wrapper: Providers },
    );

    await user.click(screen.getByRole("button", { name: "Больше" }));
    const prototypeTools = screen.getByRole("button", { name: "Prototype tools DEV" });
    expect(prototypeTools).toBeInTheDocument();

    await user.click(prototypeTools);
    expect(onOpenPrototypeTools).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("button", { name: "Prototype tools DEV" })).not.toBeInTheDocument();
  });
});
