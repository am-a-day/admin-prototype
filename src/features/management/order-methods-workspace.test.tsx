import { type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { OrderMethodsWorkspace } from "./order-methods-workspace";

function Providers({ children }: { children: ReactNode }) {
  return (
    <MockAuthProvider>
      <AppSettingsProvider persistence={false}>{children}</AppSettingsProvider>
    </MockAuthProvider>
  );
}

describe("OrderMethodsWorkspace", () => {
  it("shows the enabled staff call setting below the dine-in order method", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <OrderMethodsWorkspace onChange={onChange} onOpenReceiving={() => {}} />,
      { wrapper: Providers },
    );

    expect(screen.getByText("Вызов сотрудника")).toBeInTheDocument();
    expect(screen.getByText("Гости смогут позвать сотрудника из онлайн-меню")).toBeInTheDocument();
    const toggle = screen.getByRole("switch", { name: "Выключить вызов сотрудника" });
    expect(toggle).toHaveAttribute("data-state", "checked");

    await user.click(toggle);

    expect(screen.getByRole("switch", { name: "Включить вызов сотрудника" })).toHaveAttribute("data-state", "unchecked");
    expect(onChange).toHaveBeenCalledTimes(1);
  });
});
