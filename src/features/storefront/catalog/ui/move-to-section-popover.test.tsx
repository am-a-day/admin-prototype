import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CatalogTreeSection } from "../model/tree";
import { MoveToSectionPopover } from "./move-to-section-popover";

const sections: CatalogTreeSection[] = [
  { id: "current", parentId: null, name: "Текущий parent", status: "active" },
  { id: "moving", parentId: "current", name: "Перемещаемый раздел", status: "active" },
  { id: "descendant", parentId: "moving", name: "Descendant", status: "active" },
  { id: "occupied-a", parentId: null, name: "Занятый A", status: "active" },
  { id: "occupied-b", parentId: null, name: "Занятый B", status: "active" },
  { id: "occupied-archive", parentId: null, name: "Занятый архивный", status: "archive" },
  { id: "available", parentId: null, name: "Доступный", status: "active" },
];

const positionOccupiedTargetIds = [
  "current",
  "moving",
  "descendant",
  "occupied-a",
  "occupied-b",
  "occupied-archive",
];

describe("MoveToSectionPopover section destinations", () => {
  it("counts only otherwise eligible sections that contain positions", async () => {
    const user = userEvent.setup();
    render(
      <TooltipProvider>
        <MoveToSectionPopover
          operation="section"
          entityIds={["moving"]}
          currentSectionIds={["current"]}
          movingSectionId="moving"
          sections={sections}
          forbiddenTargets={Object.fromEntries(positionOccupiedTargetIds.map((id) => [id, "Содержит позиции"]))}
          positionOccupiedTargetIds={positionOccupiedTargetIds}
          anchor={{ left: 0, right: 1, top: 0, bottom: 1 }}
          onClose={vi.fn()}
          onMove={vi.fn()}
        />
      </TooltipProvider>,
    );

    const dialog = await screen.findByRole("dialog", { name: "Переместить раздел" });
    expect(within(dialog).getByRole("button", { name: "Содержат позиции · 2" })).toBeInTheDocument();
    expect(within(dialog).queryByRole("menuitem", { name: "Занятый A" })).not.toBeInTheDocument();

    await user.type(within(dialog).getByPlaceholderText("Найти раздел..."), "Занятый A");
    const unavailableResult = within(dialog).getByText("Занятый A", { exact: true }).closest("[data-move-unavailable-search-result]");
    expect(unavailableResult).toHaveTextContent("Содержит позиции");
  });
});
