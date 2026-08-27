import { render, screen, waitFor } from "@testing-library/react";
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

  it("keeps stop-list and section selection mutually exclusive", async () => {
    const user = userEvent.setup();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
    window.history.replaceState({}, "", "/storefront/catalog");
    render(<App />);

    const stopListEntry = () => screen.getByRole("button", { name: /Стоп-лист \d+/ });
    const allPositionsEntry = () => document.querySelector<HTMLElement>("[data-catalog-tree-root]")!;
    const sectionRow = (name: string) => screen.getByRole("button", { name: `Раздел ${name}` });
    const assertExclusiveView = async (expected: "all" | "stop-list" | string) => {
      await waitFor(() => {
        const navigationEntries = [
          allPositionsEntry(),
          stopListEntry(),
          ...document.querySelectorAll<HTMLElement>("[data-tree-section-id]"),
        ];
        const activeEntries = navigationEntries.filter((entry) => entry.classList.contains("bg-[#f5f5f4]"));
        expect(activeEntries).toHaveLength(1);
        if (expected === "all") expect(activeEntries[0]).toBe(allPositionsEntry());
        else if (expected === "stop-list") expect(activeEntries[0]).toBe(stopListEntry());
        else expect(activeEntries[0]).toBe(sectionRow(expected));
      });

      const sectionId = new URLSearchParams(window.location.search).get("sectionId");
      if (expected === "all" || expected === "stop-list") expect(sectionId).toBeNull();
      else expect(sectionId).toBe(sectionRow(expected).getAttribute("data-tree-section-id"));
    };

    await screen.findByRole("button", { name: /Стоп-лист \d+/ });
    await assertExclusiveView("all");

    // Все позиции → Стоп-лист → root-раздел → Стоп-лист.
    await user.click(stopListEntry());
    await assertExclusiveView("stop-list");
    await user.click(sectionRow("Кухня"));
    await assertExclusiveView("Кухня");
    expect(document.querySelector("[data-catalog-workspace-table-header]")).toHaveTextContent("Кухня");

    await user.click(stopListEntry());
    await assertExclusiveView("stop-list");
    expect(document.querySelector("[data-catalog-workspace-table-header]")).toHaveTextContent("Стоп-лист");

    // Стоп-лист → подраздел → Стоп-лист → Все позиции.
    if (!screen.queryByRole("button", { name: "Раздел Выпечка" })) {
      await user.click(screen.getByRole("button", { name: "Раскрыть раздел Кухня" }));
    }
    await user.click(sectionRow("Выпечка"));
    await assertExclusiveView("Выпечка");
    await user.click(stopListEntry());
    await assertExclusiveView("stop-list");
    await user.click(allPositionsEntry());
    await assertExclusiveView("all");
    expect(document.querySelector("[data-catalog-overview-header-trigger]")).toHaveTextContent("Все позиции");

    // Раздел A → Раздел B.
    await user.click(sectionRow("Кухня"));
    await assertExclusiveView("Кухня");
    await user.click(sectionRow("Выпечка"));
    await assertExclusiveView("Выпечка");

    // Стоп-лист → Раздел → Стоп-лист → Все позиции.
    await user.click(stopListEntry());
    await assertExclusiveView("stop-list");
    await user.click(sectionRow("Кухня"));
    await assertExclusiveView("Кухня");
    await user.click(stopListEntry());
    await assertExclusiveView("stop-list");
    await user.click(allPositionsEntry());
    await assertExclusiveView("all");
  }, 30_000);
});
