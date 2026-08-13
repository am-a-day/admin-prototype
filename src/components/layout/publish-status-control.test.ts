import { createElement, useEffect, useRef, type ReactNode } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider } from "@/contexts/catalog-store-context";
import { MockAuthProvider, useMockAuth } from "@/contexts/mock-auth-context";
import { PublishProvider } from "@/contexts/publish-context";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PublishStatusControl, formatRelativePublishTime, splitWebsiteAddress } from "./publish-status-control";

function Providers({ children }: { children: ReactNode }) {
  return createElement(
    MockAuthProvider,
    null,
    createElement(
      AppSettingsProvider,
      null,
      createElement(
        PublishProvider,
        null,
        createElement(CatalogStoreProvider, null, createElement(TooltipProvider, null, children)),
      ),
    ),
  );
}

function FirstPublishControl() {
  const { account, verifyCode } = useMockAuth();
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    verifyCode("+77000000001", "phone", "123456", { registrationLanguage: "ru" });
  }, [verifyCode]);

  if (account?.workspace.publishedSnapshot) return null;
  return createElement(PublishStatusControl, { onNavigate: () => {}, catalogHasVisibleItems: true });
}

describe("publish status helpers", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });

  it("formats the publication time as a live relative value", () => {
    const now = new Date("2026-08-11T12:00:00Z").getTime();

    expect(formatRelativePublishTime(now - 20_000, now)).toBe("только что");
    expect(formatRelativePublishTime(now - 5 * 60_000, now)).toBe("5 минут назад");
    expect(formatRelativePublishTime(now - 60 * 60_000, now)).toBe("1 час назад");
    expect(formatRelativePublishTime(now - 24 * 60 * 60_000, now)).toBe("вчера");
  });

  it("keeps the product domain static while separating the editable slug", () => {
    expect(splitWebsiteAddress("kimchi.tsqr.me", "tasko.menu/m/demo")).toEqual({
      slug: "kimchi",
      domain: ".tsqr.me",
    });
  });

  it("disables publication and explains why while the catalog has no positions", async () => {
    const user = userEvent.setup();
    render(
      createElement(PublishStatusControl, {
        onNavigate: () => {},
        catalogHasVisibleItems: false,
      }),
      { wrapper: Providers },
    );

    const trigger = screen.getByRole("button", { name: /Опубликовать меню|Опубликовать изменения|Опубликовано/ });
    expect(trigger).toBeDisabled();
    await user.hover(trigger.parentElement as HTMLElement);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Добавьте хотя бы одну позицию, чтобы опубликовать меню");
  });

  it("enables publication after the first position appears", () => {
    render(
      createElement(PublishStatusControl, {
        onNavigate: () => {},
        catalogHasVisibleItems: true,
      }),
      { wrapper: Providers },
    );

    expect(screen.getByRole("button", { name: /Опубликовать меню|Опубликовать изменения|Опубликовано/ })).toBeEnabled();
  });

  it("validates the first-publication address on blur and while correcting it", async () => {
    const user = userEvent.setup();
    render(createElement(FirstPublishControl), { wrapper: Providers });

    await user.click(await screen.findByRole("button", { name: "Опубликовать меню" }));
    expect(screen.getByRole("combobox", { name: "Тип заведения" })).toHaveTextContent("Ресторан или кафе");
    await user.click(screen.getByRole("button", { name: "Продолжить" }));

    expect(screen.getByRole("heading", { name: "Веб-адрес меню" })).toBeInTheDocument();
    expect(screen.getByText("Меню будет доступно по этому адресу")).toBeInTheDocument();
    expect(screen.queryByText(/Латинские буквы, цифры и дефис · минимум/)).not.toBeInTheDocument();

    const address = screen.getByRole("textbox", { name: "Веб-адрес меню" });
    await user.clear(address);
    await user.type(address, "ab");
    await user.tab();
    expect(screen.getByRole("alert")).toHaveTextContent("Минимум 3 символа");
    expect(screen.queryByText("Меню будет доступно по этому адресу")).not.toBeInTheDocument();

    await user.clear(address);
    await user.type(address, "demo");
    expect(screen.getByRole("alert")).toHaveTextContent("Адрес уже занят. Попробуйте другой");

    await user.clear(address);
    await user.type(address, "free-cafe");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByText("Меню будет доступно по этому адресу")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Продолжить" }));
    expect(screen.getByRole("heading", { name: "Как к вам обращаться?" })).toBeInTheDocument();
    expect(screen.queryByText("Эти данные нужны для связи с вами.")).not.toBeInTheDocument();

    const dialog = screen.getByRole("dialog");
    const publishButton = within(dialog).getByRole("button", { name: "Опубликовать меню" });
    expect(publishButton).toBeDisabled();
    await user.type(within(dialog).getByLabelText("Имя"), "Айдана");
    await user.type(within(dialog).getByLabelText("Фамилия"), "Садыкова");
    expect(publishButton).toBeEnabled();

    await user.click(within(dialog).getByRole("button", { name: "Назад" }));
    expect(screen.getByRole("textbox", { name: "Веб-адрес меню" })).toHaveValue("free-cafe");
  });
});
