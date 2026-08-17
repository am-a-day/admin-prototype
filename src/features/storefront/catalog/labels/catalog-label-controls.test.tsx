import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "@/data/catalog";
import { CatalogLabelControls } from "./catalog-label-controls";

vi.mock("@/contexts/app-settings-context", () => ({
  useAppSettings: () => ({ contentLanguage: "ru" }),
}));

vi.mock("@/contexts/mock-auth-context", () => ({
  useMockAuth: () => ({
    account: {
      workspace: {
        primaryLanguage: "ru",
        languages: [
          { code: "ru", visible: true },
          { code: "en", visible: true },
          { code: "kk", visible: true },
        ],
      },
    },
  }),
}));

function item(patch: Partial<CatalogItem> = {}) {
  return {
    id: "item-1",
    tags: [],
    guestLabels: [],
    upsell: {},
    ...patch,
  } as CatalogItem;
}

describe("simple position label controls", () => {
  it("creates multiple tags inline, edits translations, and removes a tag", async () => {
    const user = userEvent.setup();
    const onPatchItem = vi.fn();
    render(<CatalogLabelControls item={item()} allItems={[]} onPatchItem={onPatchItem} />);

    await user.click(screen.getByRole("button", { name: "Добавить тег" }));
    const firstInput = screen.getByRole("textbox", { name: "Название нового тега" });
    expect(firstInput).toHaveFocus();
    await user.type(firstInput, "Острое{Enter}");
    expect(screen.getByRole("button", { name: "Редактировать тег «Острое»" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Добавить тег" }));
    await user.type(screen.getByRole("textbox", { name: "Название нового тега" }), "Халяль");
    await user.keyboard("{Enter}");
    expect(screen.getByRole("button", { name: "Редактировать тег «Халяль»" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Редактировать тег «Острое»" }));
    expect(screen.getByRole("textbox", { name: "Русский" })).toHaveValue("Острое");
    expect(screen.getByRole("textbox", { name: "English" })).toHaveValue("");
    expect(screen.getByRole("textbox", { name: "Қазақша" })).toHaveValue("");
    await user.clear(screen.getByRole("textbox", { name: "Русский" }));
    await user.type(screen.getByRole("textbox", { name: "Русский" }), "Пикантное");
    await user.tab();
    expect(screen.getByRole("button", { name: "Редактировать тег «Пикантное»" })).toBeVisible();
    await user.type(screen.getByRole("textbox", { name: "English" }), "Spicy");
    await user.tab();
    expect(onPatchItem).toHaveBeenLastCalledWith(
      expect.objectContaining({ id: "item-1" }),
      expect.objectContaining({
        upsell: expect.objectContaining({
          tags: expect.arrayContaining([expect.objectContaining({ ru: "Пикантное", en: "Spicy" })]),
        }),
      }),
    );

    await user.click(screen.getByRole("button", { name: "Удалить тег «Халяль»" }));
    expect(screen.queryByRole("button", { name: "Редактировать тег «Халяль»" })).not.toBeInTheDocument();
  });

  it("allows only one sticker and restores the add button after removal", async () => {
    const user = userEvent.setup();
    const onPatchItem = vi.fn();
    render(<CatalogLabelControls item={item()} allItems={[]} onPatchItem={onPatchItem} />);

    await user.click(screen.getByRole("button", { name: "Добавить стикер" }));
    await user.type(screen.getByRole("textbox", { name: "Название нового стикера" }), "Хит{Enter}");
    expect(screen.getByRole("button", { name: "Добавить стикер" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Редактировать стикер «Хит»" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Редактировать стикер «Хит»" }));
    await user.clear(screen.getByRole("textbox", { name: "Русский" }));
    await user.type(screen.getByRole("textbox", { name: "Русский" }), "Новинка");
    await user.tab();
    expect(screen.getByRole("button", { name: "Редактировать стикер «Новинка»" })).toBeVisible();

    await user.click(screen.getByRole("button", { name: "Убрать стикер «Новинка»" }));
    expect(screen.getByRole("button", { name: "Добавить стикер" })).toBeVisible();
  });

  it("rebinds optimistic labels when the editor switches positions", async () => {
    const user = userEvent.setup();
    const first = item({
      id: "first",
      upsell: { tags: [{ ru: "Тег первой" }] },
      tags: ["Тег первой"],
    });
    const second = item({
      id: "second",
      upsell: { tags: [{ ru: "Тег второй" }] },
      tags: ["Тег второй"],
    });
    const { rerender } = render(<CatalogLabelControls item={first} allItems={[first, second]} onPatchItem={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Добавить тег" }));
    await user.type(screen.getByRole("textbox", { name: "Название нового тега" }), "Локальный{Enter}");
    expect(screen.getByRole("button", { name: "Редактировать тег «Локальный»" })).toBeVisible();

    rerender(<CatalogLabelControls item={second} allItems={[first, second]} onPatchItem={vi.fn()} />);
    expect(screen.getByRole("button", { name: "Редактировать тег «Тег второй»" })).toBeVisible();
    expect(screen.queryByRole("button", { name: "Редактировать тег «Локальный»" })).not.toBeInTheDocument();
  });
});
