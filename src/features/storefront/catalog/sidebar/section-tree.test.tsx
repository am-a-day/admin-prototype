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

function treePanel(
  sections: CatalogTreeSection[],
  items: CatalogItem[],
  includeArchived = false,
  selectedSectionId: string | null = null,
) {
  return (
    <TooltipProvider>
      <UnifiedCatalogTreePanel
        sections={sections}
        items={items}
        allPositionsSelected={false}
        allPositionsCount={items.length}
        stopListActive={false}
        stopListCount={55}
        selectedSectionId={selectedSectionId}
        sectionEditingEnabled
        includeArchived={includeArchived}
        onSelectSection={vi.fn()}
        onSelectAllPositions={vi.fn()}
        onSelectStopList={vi.fn()}
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
    </TooltipProvider>
  );
}

function renderTree(sections: CatalogTreeSection[], items: CatalogItem[], includeArchived = false) {
  return render(treePanel(sections, items, includeArchived));
}

beforeEach(() => {
  window.localStorage.clear();
});

describe("CatalogTreeThumbnail", () => {
  it("uses the same stone-200 background for section images and placeholders", () => {
    const { container, rerender } = render(<CatalogTreeThumbnail src="/section.webp" />);

    expect(container.querySelector("[data-catalog-tree-thumbnail] > span")).toHaveClass("bg-stone-200");
    expect(container.querySelector('img[src="/section.webp"]')).toBeInTheDocument();

    rerender(<CatalogTreeThumbnail />);

    expect(container.querySelector("[data-catalog-tree-thumbnail] > span")).toHaveClass("bg-stone-200");
  });

  it("keeps the selected thumbnail frame on the same stone background", () => {
    const { container } = render(<CatalogTreeThumbnail src="/section.webp" selected />);

    expect(container.querySelector("[data-catalog-tree-thumbnail]")).toHaveClass("bg-stone-200");
  });
});

describe("UnifiedCatalogTreePanel section metadata", () => {
  it("hides section counts and keeps stopped and scheduled totals in status tooltips", async () => {
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

    expect(within(screen.getByRole("button", { name: "Раздел Доступный 0" })).queryByText("0")).not.toBeInTheDocument();
    expect(within(availableRow).queryByText("6")).not.toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Раздел Доступный 13" })).queryByText("13")).not.toBeInTheDocument();
    expect(within(screen.getByRole("button", { name: "Раздел Доступный 241" })).queryByText("241")).not.toBeInTheDocument();
    expect(within(availableRow).queryByLabelText(/На стопе/)).not.toBeInTheDocument();
    const stoppedStatus = within(stoppedRow).getByLabelText("На стопе · 21 позиция");
    const stoppedMetadata = stoppedStatus.closest("[data-catalog-section-metadata]");
    expect(stoppedStatus).toHaveAttribute("tabindex", "0");
    expect(stoppedStatus).toHaveClass("size-5");
    expect(stoppedMetadata).toHaveClass("absolute", "right-0.5", "size-5", "justify-center", "group-hover:opacity-0");
    expect(stoppedStatus.querySelector("svg")).toHaveAttribute("width", "12");
    expect(stoppedRow).toHaveAttribute("title", "На стопе · 21 позиция");
    expect(within(stoppedRow).queryByText("21")).not.toBeInTheDocument();
    expect(within(scheduledRow).getByLabelText("По расписанию · 12 позиций")).toBeInTheDocument();
    expect(within(scheduledRow).queryByText("12")).not.toBeInTheDocument();

    stoppedStatus.focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("На стопе · 21 позиция");
  });

  it("anchors independent hover actions to the row edge while indentation only affects left content", async () => {
    const sections: CatalogTreeSection[] = [
      {
        id: "root",
        name: "Очень длинное название корневого раздела",
        children: [
          {
            id: "nested",
            parentId: "root",
            name: "Вложенный раздел",
            children: [
              { id: "deep", parentId: "nested", name: "Глубокий раздел", children: [] },
            ],
          },
        ],
      },
    ];
    const items = [catalogItem("deep-item", "deep")];

    render(treePanel(sections, items, false, "deep"));

    const headerGrid = document.querySelector('[data-catalog-section-action-grid="header"]');
    const rootRow = screen.getByRole("button", { name: "Раздел Очень длинное название корневого раздела" });
    const nestedRow = screen.getByRole("button", { name: "Раздел Вложенный раздел" });
    const deepRow = await screen.findByRole("button", { name: "Раздел Глубокий раздел" });
    const rootLeft = rootRow.querySelector("[data-catalog-section-left-content]");
    const nestedLeft = nestedRow.querySelector("[data-catalog-section-left-content]");
    const deepLeft = deepRow.querySelector("[data-catalog-section-left-content]");
    const rootAdd = rootRow.querySelector("[data-catalog-section-add-action]");
    const rootMore = within(rootRow).getByRole("button", { name: "Действия с разделом Очень длинное название корневого раздела" });
    const nestedAdd = nestedRow.querySelector("[data-catalog-section-add-action]");
    const nestedMore = within(nestedRow).getByRole("button", { name: "Действия с разделом Вложенный раздел" });
    const deepAdd = deepRow.querySelector("[data-catalog-section-add-action]");
    const deepMore = within(deepRow).getByRole("button", { name: "Действия с разделом Глубокий раздел" });
    const nestedMetadata = nestedRow.querySelector("[data-catalog-section-metadata]");
    const nestedCount = nestedRow.querySelector("[data-catalog-section-count]");
    const nestedList = document.querySelector('[data-section-parent-id="root"]');
    const scrollport = document.querySelector(".scrollbar-subtle");
    const headerActions = within(headerGrid as HTMLElement).getAllByRole("button");

    expect(headerGrid).toHaveClass("flex", "w-[46px]", "gap-1.5");
    expect(headerActions.map((button) => button.getAttribute("aria-label"))).toEqual([
      "Добавить раздел",
      "Открыть поиск разделов",
    ]);
    expect(headerActions.map((button) => button.querySelector("svg")?.getAttribute("width"))).toEqual(["14", "14"]);
    expect(rootAdd).toHaveClass("absolute", "right-7");
    expect(rootMore).toHaveClass("absolute", "right-0.5");
    expect(nestedAdd).toHaveClass("absolute", "right-7");
    expect(nestedMore).toHaveClass("absolute", "right-0.5");
    expect(deepAdd).toHaveClass("absolute", "right-7");
    expect(deepMore).toHaveClass("absolute", "right-0.5");
    expect(nestedMetadata).not.toBeInTheDocument();
    expect(nestedCount).not.toBeInTheDocument();
    expect(document.querySelector("[data-catalog-section-right-slots]")).not.toBeInTheDocument();
    expect(scrollport).toHaveClass("[scrollbar-gutter:stable]");
    expect(headerGrid?.closest(".scrollbar-subtle")).toBe(scrollport);
    expect(rootMore.closest(".scrollbar-subtle")).toBe(scrollport);
    expect(nestedMore.closest(".scrollbar-subtle")).toBe(scrollport);
    expect(rootLeft).toHaveStyle({ paddingLeft: "0px" });
    expect(nestedLeft).toHaveStyle({ paddingLeft: "20px" });
    expect(deepLeft).toHaveStyle({ paddingLeft: "40px" });
    expect(rootLeft).toHaveClass("pr-[52px]");
    expect(nestedLeft).toHaveClass("pr-[52px]");
    expect(rootAdd?.parentElement).toBe(rootRow);
    expect(rootMore.parentElement).toBe(rootRow);
    expect(nestedAdd?.parentElement).toBe(nestedRow);
    expect(nestedMore.parentElement).toBe(nestedRow);
    expect(nestedList).not.toHaveClass("pl-5");
    expect(rootRow.querySelector("[data-section-title]")).toHaveClass("min-w-0", "flex-1", "truncate");

    const nestedEnabledAdd = within(nestedRow).getByRole("button", { name: "Добавить подраздел в раздел Вложенный раздел" });
    const disabledAdd = within(deepRow).getByRole("button", { name: "Добавить подраздел в раздел Глубокий раздел" });
    const more = within(deepRow).getByRole("button", { name: "Действия с разделом Глубокий раздел" });
    expect(nestedEnabledAdd).toBeEnabled();
    expect(disabledAdd).toBeDisabled();
    expect(disabledAdd).toHaveClass("size-5");
    expect(disabledAdd.querySelector("svg")).toHaveAttribute("width", "14");
    expect(nestedAdd).toHaveClass("group-hover:opacity-100");
    expect(nestedAdd?.className).toBe(rootAdd?.className);
    expect(deepAdd?.className).toBe(rootAdd?.className);
    expect(more).toHaveClass("size-5");
    expect(more.querySelector("svg")).toHaveAttribute("width", "16");
    expect(screen.getByRole("button", { name: "Все позиции 1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Стоп-лист 55" })).toBeInTheDocument();

    const disabledAddTooltipTrigger = within(deepRow).getByLabelText("Нельзя добавить подраздел: в разделе уже есть позиции");
    expect(disabledAddTooltipTrigger).toHaveAttribute("tabindex", "0");
    disabledAddTooltipTrigger.focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Нельзя добавить подраздел: в разделе уже есть позиции");
  });

  it("does not pin More or its action background while its menu is open", async () => {
    const user = userEvent.setup();
    const sections: CatalogTreeSection[] = [
      { id: "first", name: "Первый раздел", children: [] },
      { id: "second", name: "Второй раздел", children: [] },
    ];
    render(treePanel(sections, [], false, "first"));
    const firstRow = screen.getByRole("button", { name: "Раздел Первый раздел" });
    const firstMore = within(firstRow).getByRole("button", { name: "Действия с разделом Первый раздел" });

    await user.click(firstMore);

    expect(firstMore).toHaveAttribute("data-state", "open");
    expect(firstMore).toHaveClass("opacity-0", "group-hover:opacity-100", "hover:bg-[#e7e5e4]");
    expect(firstMore).not.toHaveClass("opacity-100", "bg-[#f5f5f4]");
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
    expect(archivedStatus.closest("[data-catalog-section-metadata]")).toHaveClass("absolute", "right-0.5", "size-5", "justify-center", "group-hover:opacity-0");
    expect(archivedStatus.querySelector("svg")).toHaveAttribute("width", "12");
    expect(within(archivedRow).queryByText("13")).not.toBeInTheDocument();

    archivedStatus.focus();
    expect(await screen.findByRole("tooltip")).toHaveTextContent("В архиве · 13 позиций");
  });
});
