import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "@/data/catalog";
import { TooltipProvider } from "@/components/ui/tooltip";
import type { CatalogTreeSection } from "../model/tree";
import { CatalogTreeThumbnail, UnifiedCatalogTreePanel } from "./section-tree";

function catalogItem(id: string, sectionId: string): CatalogItem {
  return {
    id,
    title: id,
    sectionId,
    sectionName: sectionId,
    thumbnailUrl: null,
    price: 0,
    priceWithSale: null,
    status: "active",
    scheduled: false,
    guestLabels: [],
    tags: [],
    optionsCount: 0,
    modifiersCount: 0,
    recommendationsCount: 0,
    displayMode: "full",
    description: "",
    hasDescription: false,
    weightLabel: null,
    nutritionFilledCount: 0,
    translationFilledCount: 0,
    translationTotalCount: 0,
    hasDiscount: false,
  };
}

function renderTree(sections: CatalogTreeSection[], items: CatalogItem[], includeArchived = false) {
  return render(
    <TooltipProvider>
      <UnifiedCatalogTreePanel
        sections={sections}
        items={items}
        allPositionsSelected={false}
        selectedSectionId={null}
        sectionEditingEnabled
        includeArchived={includeArchived}
        onSelectSection={vi.fn()}
        onSelectAllPositions={vi.fn()}
        onStartCreateSection={vi.fn()}
        onCreateSection={vi.fn()}
        onCancelCreateSection={vi.fn()}
        draftParentId={undefined}
        renamingSectionId={null}
        onStartRenameSection={vi.fn()}
        onRenameSection={vi.fn()}
        onCancelRenameSection={vi.fn()}
        onSectionAction={vi.fn()}
        renderSectionActions={() => null}
        onCollapseSections={vi.fn()}
        onReorderSections={vi.fn()}
      />
    </TooltipProvider>,
  );
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("CatalogTreeThumbnail", () => {
  it("uses the same stone background for section images and placeholders", () => {
    const { container, rerender } = render(<CatalogTreeThumbnail src="/section.webp" />);

    expect(container.querySelector("[data-catalog-tree-thumbnail] > span")).toHaveClass("bg-stone-100");
    expect(container.querySelector('img[src="/section.webp"]')).toBeInTheDocument();

    rerender(<CatalogTreeThumbnail />);

    expect(container.querySelector("[data-catalog-tree-thumbnail] > span")).toHaveClass("bg-stone-100");
  });

  it("keeps the selected thumbnail frame on the same stone background", () => {
    const { container } = render(<CatalogTreeThumbnail src="/section.webp" selected />);

    expect(container.querySelector("[data-catalog-tree-thumbnail]")).toHaveClass("bg-stone-100");
  });
});

describe("UnifiedCatalogTreePanel section metadata", () => {
  it("replaces counts with stopped and scheduled status icons and keeps the count in the tooltip", async () => {
    const sections: CatalogTreeSection[] = [
      { id: "available-0", name: "Доступный 0", availabilityMode: "always", children: [] },
      { id: "available", name: "Доступный", availabilityMode: "always", children: [] },
      { id: "available-13", name: "Доступный 13", availabilityMode: "always", children: [] },
      { id: "available-241", name: "Доступный 241", availabilityMode: "always", children: [] },
      { id: "stopped", name: "На стопе", availabilityMode: "unavailable", children: [] },
      { id: "scheduled", name: "По расписанию", availabilityMode: "schedule", children: [] },
    ];
    const items = [
      ...Array.from({ length: 6 }, (_, index) => catalogItem(`available-${index}`, "available")),
      ...Array.from({ length: 13 }, (_, index) => catalogItem(`available-13-${index}`, "available-13")),
      ...Array.from({ length: 241 }, (_, index) => catalogItem(`available-241-${index}`, "available-241")),
      ...Array.from({ length: 21 }, (_, index) => catalogItem(`stopped-${index}`, "stopped")),
      ...Array.from({ length: 12 }, (_, index) => catalogItem(`scheduled-${index}`, "scheduled")),
    ];

    renderTree(sections, items);

    const availableRow = screen.getByRole("button", { name: "Раздел Доступный" });
    const stoppedRow = screen.getByRole("button", { name: "Раздел На стопе" });
    const scheduledRow = screen.getByRole("button", { name: "Раздел По расписанию" });

    expect(within(screen.getByRole("button", { name: "Раздел Доступный 0" })).getByText("0")).toBeInTheDocument();
    expect(within(availableRow).getByText("6")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Раздел Доступный 13" })).getByText("13")).toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Раздел Доступный 241" })).getByText("241")).toBeInTheDocument();
    expect(within(availableRow).queryByLabelText(/На стопе/)).not.toBeInTheDocument();
    const stoppedStatus = within(stoppedRow).getByLabelText("На стопе · 21 позиция");
    const stoppedMetadata = stoppedStatus.closest("[data-catalog-section-metadata]");
    expect(stoppedStatus).toHaveAttribute("tabindex", "0");
    expect(stoppedStatus).toHaveClass("size-5");
    expect(stoppedMetadata).toHaveClass("col-start-3", "size-5", "justify-center");
    expect(stoppedStatus.querySelector("svg")).toHaveAttribute("width", "12");
    expect(stoppedRow).toHaveAttribute("title", "На стопе · 21 позиция");
    expect(within(stoppedRow).queryByText("21")).not.toBeInTheDocument();
    expect(within(scheduledRow).getByLabelText("По расписанию · 12 позиций")).toBeInTheDocument();
    expect(within(scheduledRow).queryByText("12")).not.toBeInTheDocument();

    stoppedStatus.focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("На стопе · 21 позиция");
  });

  it("uses fixed add, more, and metadata slots for the header, root rows, and nested rows", async () => {
    const sections: CatalogTreeSection[] = [
      {
        id: "root",
        name: "Очень длинное название корневого раздела",
        children: [
          { id: "nested", parentId: "root", name: "Вложенный раздел", children: [] },
        ],
      },
    ];
    const items = [catalogItem("nested-item", "nested")];

    renderTree(sections, items);

    const headerGrid = document.querySelector('[data-catalog-section-action-grid="header"]');
    const rootRow = screen.getByRole("button", { name: "Раздел Очень длинное название корневого раздела" });
    const nestedRow = screen.getByRole("button", { name: "Раздел Вложенный раздел" });
    const rootLeft = rootRow.querySelector("[data-catalog-section-left-content]");
    const nestedLeft = nestedRow.querySelector("[data-catalog-section-left-content]");
    const rootSlots = rootRow.querySelector("[data-catalog-section-right-slots]");
    const nestedSlots = nestedRow.querySelector("[data-catalog-section-right-slots]");
    const nestedActions = nestedRow.querySelector("[data-catalog-section-hover-actions]");
    const nestedMetadata = nestedRow.querySelector("[data-catalog-section-metadata]");
    const nestedCount = nestedRow.querySelector("[data-catalog-section-count]");
    const nestedList = document.querySelector('[data-section-parent-id="root"]');
    const scrollport = document.querySelector(".scrollbar-subtle");
    const headerActions = within(headerGrid as HTMLElement).getAllByRole("button");

    expect(headerGrid).toHaveClass("grid", "w-[72px]", "grid-cols-[20px_20px_20px]", "gap-1.5");
    expect(headerActions.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Добавить раздел",
      "Открыть поиск разделов",
    ]);
    expect(headerActions.map((button) => button.querySelector("svg")?.getAttribute("width"))).toEqual(["14", "14"]);
    expect(rootSlots).toHaveClass("grid", "w-[72px]", "grid-cols-[20px_20px_20px]", "gap-1.5");
    expect(nestedSlots).toHaveClass("grid", "w-[72px]", "grid-cols-[20px_20px_20px]", "gap-1.5");
    expect(nestedActions).toHaveClass("w-[46px]", "grid-cols-[20px_20px]", "col-span-2");
    expect(nestedMetadata).toHaveClass("col-start-3", "size-5", "justify-center");
    expect(nestedMetadata).not.toHaveClass("group-hover:opacity-0");
    expect(nestedCount).toHaveClass("w-full", "text-right", "tabular-nums");
    expect(scrollport).toHaveClass("[scrollbar-gutter:stable]");
    expect(headerGrid?.closest(".scrollbar-subtle")).toBe(scrollport);
    expect(rootSlots?.closest(".scrollbar-subtle")).toBe(scrollport);
    expect(nestedSlots?.closest(".scrollbar-subtle")).toBe(scrollport);
    expect(rootLeft).toHaveStyle({ paddingLeft: "0px" });
    expect(nestedLeft).toHaveStyle({ paddingLeft: "20px" });
    expect(rootLeft?.nextElementSibling).toBe(rootSlots);
    expect(nestedLeft?.nextElementSibling).toBe(nestedSlots);
    expect(rootSlots?.parentElement).toBe(rootRow);
    expect(nestedSlots?.parentElement).toBe(nestedRow);
    expect(nestedList).not.toHaveClass("pl-5");
    expect(rootRow.querySelector("[data-section-title]")).toHaveClass("min-w-0", "flex-1", "truncate");

    const disabledAdd = within(nestedRow).getByRole("button", { name: "Добавить подраздел в раздел Вложенный раздел" });
    const more = within(nestedRow).getByRole("button", { name: "Действия с разделом Вложенный раздел" });
    expect(disabledAdd).toBeDisabled();
    expect(disabledAdd).toHaveClass("size-5");
    expect(disabledAdd.querySelector("svg")).toHaveAttribute("width", "14");
    expect(more).toHaveClass("size-5");
    expect(more.querySelector("svg")).toHaveAttribute("width", "16");

    const disabledAddTooltipTrigger = within(nestedRow).getByLabelText("Нельзя добавить подраздел: в разделе уже есть позиции");
    expect(disabledAddTooltipTrigger).toHaveAttribute("tabindex", "0");
    disabledAddTooltipTrigger.focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Нельзя добавить подраздел: в разделе уже есть позиции");
  });

  it("keeps archived sections hidden until enabled and shows Archive instead of their count", async () => {
    const user = userEvent.setup();
    const sections: CatalogTreeSection[] = [
      {
        id: "root",
        name: "Корневой раздел",
        children: [
          { id: "active", parentId: "root", name: "Активный", status: "active", children: [] },
          { id: "archive", parentId: "root", name: "Архивный", status: "archive", children: [] },
        ],
      },
    ];
    const items = Array.from({ length: 13 }, (_, index) => ({
      ...catalogItem(`archive-${index}`, "archive"),
      status: "archive" as const,
    }));

    renderTree(sections, items, true);

    expect(screen.queryByRole("button", { name: "Раздел Архивный" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Настройки разделов" }));
    await user.click(screen.getByRole("menuitemcheckbox", { name: "Показывать архивные" }));

    const archivedRow = screen.getByRole("button", { name: "Раздел Архивный" });
    expect(archivedRow).toHaveAttribute("data-archived-section", "true");
    const archivedStatus = within(archivedRow).getByLabelText("В архиве · 13 позиций");
    expect(archivedStatus.closest("[data-catalog-section-metadata]")).toHaveClass("col-start-3", "size-5", "justify-center");
    expect(archivedStatus.querySelector("svg")).toHaveAttribute("width", "12");
    expect(within(archivedRow).queryByText("13")).not.toBeInTheDocument();

    archivedStatus.focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("В архиве · 13 позиций");
  });
});
