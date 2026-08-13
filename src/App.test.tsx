import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import App from "./App";

describe("App providers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.history.replaceState({}, "", "/");
  });

  it("renders the authenticated shell for a new account with an empty catalog", async () => {
    const user = userEvent.setup();
    render(<App />);

    const phone = screen.getByRole("textbox", { name: "Номер телефона" });
    await user.clear(phone);
    await user.type(phone, "+77001234567");
    await user.click(screen.getByRole("button", { name: "Другие способы входа" }));
    await user.click(screen.getByRole("button", { name: "Продолжить по SMS" }));
    await user.type(await screen.findByRole("textbox", { name: "Одноразовый код" }), "123456");

    expect(
      await screen.findByRole("button", {
        name: /Опубликовать меню|Опубликовать изменения|Опубликовано/,
      }),
    ).toBeDisabled();
  });
});
