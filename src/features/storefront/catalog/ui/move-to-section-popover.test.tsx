import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogTreeSection } from "../model/tree";
import { MoveToSectionPopover } from "./move-to-section-popover";

const sections: CatalogTreeSection[] = [
  { id: "current", parentId: null, name: "Текущий parent", status: "active", sortOrder: 0 },
  { id: "moving", parentId: "current", name: "Перемещаемый раздел", status: "active", sortOrder: 0 },
  { id: "descendant", parentId: "moving", name: "Descendant", status: "active", sortOrder: 0 },
  { id: "sibling", parentId: "current", name: "Соседний раздел", status: "active", sortOrder: 1 },
  { id: "occupied", parentId: null, name: "Содержит позиции", status: "active", sortOrder: 1 },
  { id: "leaf", parentId: null, name: "Лист", status: "active", sortOrder: 2 },
  { id: "branch", parentId: null, name: "Ветка", status: "active", sortOrder: 3 },
  { id: "alcohol", parentId: "branch", name: "Алкоголь", status: "active", sortOrder: 0 },
  { id: "strong", parentId: "alcohol", name: "Крепкое", status: "active", sortOrder: 0 },
  { id: "whisky", parentId: "strong", name: "Виски", status: "active", sortOrder: 0 },
  { id: "dead-branch", parentId: null, name: "Без выбора внутри", status: "active", sortOrder: 4 },
  { id: "dead-child", parentId: "dead-branch", name: "Недоступный child", status: "active", sortOrder: 0 },
  { id: "archive", parentId: null, name: "Архив", status: "archive", sortOrder: 5 },
];

const occupiedIds = ["occupied", "dead-child"];
const forbiddenTargets = Object.fromEntries(occupiedIds.map((id) => [id, "Содержит позиции"]));

function renderSectionMove(overrides: Partial<ComponentProps<typeof MoveToSectionPopover>> = {}) {
  const onMove = vi.fn();
  const onClose = vi.fn();
  const result = render(
    <MoveToSectionPopover
      operation="section"
      entityIds={["moving"]}
      currentSectionIds={["current"]}
      movingSectionId="moving"
      sections={sections}
      forbiddenTargets={forbiddenTargets}
      positionOccupiedTargetIds={occupiedIds}
      anchor={{ left: 0, right: 1, top: 0, bottom: 1 }}
      onClose={onClose}
      onMove={onMove}
      {...overrides}
    />,
  );
  return { ...result, onMove, onClose };
}

describe("MoveToSectionPopover section destinations", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("shows chevrons only when a row leads to another available destination", async () => {
    const user = userEvent.setup();
    const { onMove } = renderSectionMove();
    const dialog = await screen.findByRole("dialog", { name: "Переместить раздел" });

    expect(within(dialog).getByPlaceholderText("Переместить раздел в...")).toBeInTheDocument();
    expect(within(dialog).getByText("Только разделы без позиций")).toBeInTheDocument();
    expect(within(dialog).queryByText("Содержит позиции", { exact: true })).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Перемещаемый раздел")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Descendant")).not.toBeInTheDocument();
    expect(within(dialog).queryByText("Архив")).not.toBeInTheDocument();

    const leaf = within(dialog).getByRole("menuitem", { name: "Лист" });
    const deadBranch = within(dialog).getByRole("menuitem", { name: "Без выбора внутри" });
    const branch = within(dialog).getByRole("menuitem", { name: "Ветка" });
    expect(leaf).not.toHaveAttribute("aria-haspopup");
    expect(deadBranch).not.toHaveAttribute("aria-haspopup");
    expect(branch).toHaveAttribute("aria-haspopup", "menu");

    await user.click(deadBranch);
    await waitFor(() => expect(onMove).toHaveBeenCalledWith("dead-branch", expect.objectContaining({ id: "dead-branch" })));
  });

  it("offers the parent first and keeps the recursive choice through three submenu levels", async () => {
    const user = userEvent.setup();
    renderSectionMove();
    const dialog = await screen.findByRole("dialog", { name: "Переместить раздел" });

    await user.hover(within(dialog).getByRole("menuitem", { name: "Ветка" }));
    expect(await screen.findByRole("menuitem", { name: "Переместить в «Ветка»" })).toBeInTheDocument();

    const alcohol = await screen.findByRole("menuitem", { name: "Ветка › Алкоголь" });
    expect(alcohol).toHaveAttribute("aria-haspopup", "menu");
    await user.hover(alcohol);
    expect(await screen.findByRole("menuitem", { name: "Переместить в «Алкоголь»" })).toBeInTheDocument();

    const strong = await screen.findByRole("menuitem", { name: "Ветка › Алкоголь › Крепкое" });
    expect(strong).toHaveAttribute("aria-haspopup", "menu");
    await user.hover(strong);
    expect(await screen.findByRole("menuitem", { name: "Переместить в «Крепкое»" })).toBeInTheDocument();
    expect(await screen.findByRole("menuitem", { name: "Ветка › Алкоголь › Крепкое › Виски" })).toBeInTheDocument();
  });

  it("searches all available levels and omits sections with positions", async () => {
    const user = userEvent.setup();
    renderSectionMove();
    const dialog = await screen.findByRole("dialog", { name: "Переместить раздел" });
    const search = within(dialog).getByPlaceholderText("Переместить раздел в...");

    await user.type(search, "Виски");
    expect(within(dialog).getByRole("menuitem", { name: "Ветка › Алкоголь › Крепкое › Виски" })).toBeInTheDocument();

    await user.clear(search);
    await user.type(search, "Недоступный child");
    expect(within(dialog).queryByText("Недоступный child")).not.toBeInTheDocument();
    expect(within(dialog).getByText("Разделы не найдены")).toBeInTheDocument();
  });

  it("persists dismissal of the compact section-move hint", async () => {
    const user = userEvent.setup();
    const first = renderSectionMove();
    const dialog = await screen.findByRole("dialog", { name: "Переместить раздел" });

    await user.click(within(dialog).getByRole("button", { name: "Скрыть подсказку" }));
    expect(within(dialog).queryByText("Только разделы без позиций")).not.toBeInTheDocument();

    first.unmount();
    renderSectionMove();
    const reopenedDialog = await screen.findByRole("dialog", { name: "Переместить раздел" });
    expect(within(reopenedDialog).queryByText("Только разделы без позиций")).not.toBeInTheDocument();
  });
});
