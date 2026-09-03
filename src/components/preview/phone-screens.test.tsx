import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PhoneBottomNav } from "./phone-screens";

describe("PhoneBottomNav", () => {
  it("keeps the staff call button enabled by default", () => {
    render(<PhoneBottomNav active="home" onSelect={() => {}} />);

    expect(screen.getByRole("button", { name: "Позвать сотрудника" })).toBeInTheDocument();
  });

  it("hides only the staff call button when disabled", () => {
    render(<PhoneBottomNav active="home" waiterEnabled={false} onSelect={() => {}} />);

    expect(screen.queryByRole("button", { name: "Позвать сотрудника" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Корзина" })).toBeInTheDocument();
  });
});
