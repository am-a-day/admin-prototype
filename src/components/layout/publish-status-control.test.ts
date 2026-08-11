import { createElement, type ReactNode } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it } from "vitest";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider } from "@/contexts/catalog-store-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
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
});
