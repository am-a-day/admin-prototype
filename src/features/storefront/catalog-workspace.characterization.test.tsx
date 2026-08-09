import { useState, type ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider } from "@/contexts/catalog-store-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { PublishProvider } from "@/contexts/publish-context";
import {
  CatalogWorkspace,
  type CatalogNavigationBoundary,
  type CatalogTab,
  type CatalogViewMode,
} from "@/features/storefront/catalog";

const firstItemTitle = "Омлет с томатами и сыром";

function Providers({ children }: { children: ReactNode }) {
  return (
    <MockAuthProvider>
      <AppSettingsProvider>
        <PublishProvider>
          <CatalogStoreProvider>{children}</CatalogStoreProvider>
        </PublishProvider>
      </AppSettingsProvider>
    </MockAuthProvider>
  );
}

function CatalogHarness() {
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("sections");
  const [sectionScopeId, setSectionScopeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CatalogViewMode>("sections");
  const params = new URLSearchParams(window.location.search);
  const navigation: CatalogNavigationBoundary = {
    route: {
      editorNav: params.get("editorNav"),
      sectionId: params.get("sectionId"),
      positionId: params.get("positionId"),
      highlightPositionId: params.get("highlightPositionId"),
      createPosition: params.get("createPosition") === "1",
      createHistoryEntry: false,
      returnContext: null,
      location: { url: window.location.href, state: window.history.state },
      revision: 0,
    },
    replaceSection: vi.fn(),
    replacePosition: vi.fn(),
    consumeHighlightPosition: vi.fn(),
    prepareDirectCreate: vi.fn(),
    replaceDirectCreateDestination: vi.fn(),
    back: vi.fn(),
  };

  return (
    <CatalogWorkspace
      navigation={navigation}
      selectedDishId="669204cd-0d0d-4782-8784-27df185f169e"
      catalogPhase="has-items"
      catalogTab={catalogTab}
      stopListActive={false}
      viewMode={viewMode}
      sectionScopeId={sectionScopeId}
      stopListFilterId="quick:all"
      stopListSectionScopeId={null}
      resetSignal={0}
      onOverviewFilterChange={setViewMode}
      onViewModeChange={setViewMode}
      onSectionScopeChange={setSectionScopeId}
      onStopListFilterChange={() => {}}
      onStopListSectionScopeChange={() => {}}
      onCatalogTabChange={setCatalogTab}
      onRegisterCreateNavigationGuard={vi.fn()}
      onAdvancePhase={() => {}}
    />
  );
}

function renderCatalog() {
  window.localStorage.clear();
  window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  window.history.replaceState({}, "", "/storefront/catalog?editorNav=unified");
  return render(<CatalogHarness />, { wrapper: Providers });
}

describe("catalog observable behavior baseline", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("opens a parent section, a leaf section, and all positions", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const allPositions = screen.getByRole("button", { name: /Все позиции/ });
    expect(allPositions).toBeInTheDocument();
    const sectionTree = screen.getByPlaceholderText("Поиск по разделам").closest("aside");
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Кухня", { exact: true }));
    expect(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true })).toBeInTheDocument();

    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    expect(screen.getByRole("button", { name: "Действия с разделом «Завтраки»" })).toBeInTheDocument();

    await user.click(allPositions);
    expect(screen.getByPlaceholderText("Поиск по названию")).toBeInTheDocument();
  });

  it("keeps table search, completeness filter, sorting, columns, and selection observable", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const search = screen.getByPlaceholderText("Поиск по названию");
    await user.type(search, firstItemTitle);
    expect(screen.getByText(firstItemTitle, { exact: true })).toBeInTheDocument();

    const neutralPriceSort = screen.getByRole("button", { name: "Сортировать по возрастанию" });
    expect(neutralPriceSort.querySelectorAll("svg").length).toBeGreaterThan(0);
    await user.click(neutralPriceSort);
    const ascendingPriceSort = screen.getByRole("button", { name: "Сортировать по убыванию" });
    expect(ascendingPriceSort.querySelector("svg")).not.toBeNull();
    await user.click(ascendingPriceSort);
    await user.click(screen.getByRole("button", { name: "Сбросить сортировку" }));
    expect(screen.getByRole("button", { name: "Сортировать по возрастанию" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Настроить колонки" }));
    const columnMenu = screen.getByRole("menu");
    expect(within(columnMenu).getByText("Описание")).toBeInTheDocument();
    await user.click(within(columnMenu).getByText("Описание"));
    await user.keyboard("{Escape}");

    const rowCheckbox = screen.getAllByRole("checkbox", { name: /Выбрать / })[0];
    expect(rowCheckbox).toBeDefined();
    await user.click(rowCheckbox);
    expect(document.querySelector("[data-catalog-selection-toolbar]")).toHaveTextContent("Выбрано: 1");

    await user.click(screen.getByRole("button", { name: /Заполненность/ }));
    const completenessMenu = screen.getByRole("menu");
    ["Все позиции", "Без описания", "Без фото", "Без веса", "Без КБЖУ", "Без перевода"].forEach((label) => {
      expect(within(completenessMenu).getByRole("menuitemradio", { name: new RegExp(label) })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("menuitemradio", { name: /Без описания/ }));
    expect(screen.getByRole("button", { name: /Без описания/ })).toBeInTheDocument();
  });

  it("keeps subsection rows dense and supports one, many, and select-all selection", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = screen.getByPlaceholderText("Поиск по разделам").closest("aside");
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Кухня", { exact: true }));

    expect(screen.queryByRole("button", { name: /К позициям/ })).not.toBeInTheDocument();
    const breakfastCheckbox = screen.getByRole("checkbox", { name: "Выбрать подраздел Завтраки" });
    expect(breakfastCheckbox.closest("[role=button]")).toHaveClass("h-[38px]");
    await user.click(breakfastCheckbox);
    expect(screen.getByText("1 выбрано", { exact: true })).toBeInTheDocument();

    const bakeryCheckbox = screen.getByRole("checkbox", { name: "Выбрать подраздел Выпечка" });
    await user.click(bakeryCheckbox);
    expect(screen.getByText("2 выбрано", { exact: true })).toBeInTheDocument();

    const selectAll = screen.getByRole("checkbox", { name: "Выбрать все подразделы" });
    await user.click(selectAll);
    screen.getAllByRole("checkbox", { name: /Выбрать подраздел / }).forEach((checkbox) => expect(checkbox).toBeChecked());
    await user.click(selectAll);
    expect(breakfastCheckbox).not.toBeChecked();
    expect(bakeryCheckbox).not.toBeChecked();
  });

  it("shows the local positions heading, sticky table header, and row-body reorder affordance in a leaf", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = screen.getByPlaceholderText("Поиск по разделам").closest("aside");
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));

    const card = document.querySelector("[data-catalog-items-card]");
    expect(card).not.toBeNull();
    expect(within(card as HTMLElement).getByText("Позиции", { exact: true })).toBeInTheDocument();
    const localHeader = document.querySelector("[data-catalog-local-header]");
    expect(localHeader).toHaveClass("sticky", "top-0", "bg-white");
    const tableHeader = document.querySelector("[data-catalog-table-header]");
    expect(tableHeader).toHaveClass("sticky", "top-11", "bg-white");
    expect(tableHeader?.parentElement?.parentElement).not.toHaveClass("overflow-x-auto");

    const reorderableRow = document.querySelector("[data-row-reorder-enabled=true]");
    expect(reorderableRow).not.toBeNull();
    expect(reorderableRow).toHaveAttribute("aria-roledescription", "sortable");
  });

  it("uses the section-title chevron, creates a subsection from the workspace, and keeps schedule settings singular", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = screen.getByPlaceholderText("Поиск по разделам").closest("aside");
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Кухня", { exact: true }));

    const sectionMenuTrigger = screen.getByRole("button", { name: "Действия с разделом «Кухня»" });
    expect(sectionMenuTrigger.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Действия с разделом" })).not.toBeInTheDocument();
    await user.click(sectionMenuTrigger);
    expect(screen.queryByRole("menuitem", { name: "Добавить подраздел" })).not.toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(screen.getByRole("button", { name: "Добавить подраздел" }));
    const createDialog = screen.getByRole("dialog", { name: "Новый раздел" });
    expect(within(createDialog).getByRole("button", { name: "Расположение: Кухня" })).toBeInTheDocument();
    await user.type(within(createDialog).getByLabelText("Название раздела"), "Сезонное меню");
    await user.click(within(createDialog).getByRole("button", { name: "Добавить раздел" }));
    expect((await screen.findAllByText("Сезонное меню", { exact: true })).length).toBeGreaterThan(0);

    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    await user.click(screen.getByRole("button", { name: "Действия с разделом «Завтраки»" }));
    expect(screen.queryByRole("menuitem", { name: /Настроить расписание/ })).not.toBeInTheDocument();
    const availabilitySubmenu = screen.getByRole("menuitem", { name: "Ограничения доступности" });
    await user.hover(availabilitySubmenu);
    await user.click(await screen.findByRole("menuitemradio", { name: "По расписанию" }));
    expect(await screen.findByRole("radiogroup", { name: "Доступность раздела" })).toBeInTheDocument();
  });

  it("opens an item from the table and returns to the same table context", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const search = screen.getByPlaceholderText("Поиск по названию");
    await user.type(search, "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));

    expect(screen.getByText("Основное", { exact: true })).toBeInTheDocument();
    const backButton = screen.getByRole("button", { name: /^Все позиции$/ });
    await user.click(backButton);

    expect(screen.getByPlaceholderText("Поиск по названию")).toHaveValue("Омлет");
    expect(screen.getByText(firstItemTitle, { exact: true })).toBeInTheDocument();
  });

  it("does not expose table reorder controls for all positions", () => {
    renderCatalog();

    expect(screen.queryByRole("button", { name: /Изменить порядок позиции/ })).not.toBeInTheDocument();
  });

  it("exposes leaf reorder controls and keeps explicit move destination observable", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = screen.getByPlaceholderText("Поиск по разделам").closest("aside");
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));

    expect((await screen.findAllByRole("button", { name: /Изменить порядок позиции/ })).length).toBeGreaterThan(1);

    await user.click(screen.getAllByRole("button", { name: /Действия для/ })[0]);
    await user.click(screen.getByRole("menuitem", { name: "Переместить в раздел…" }));
    const moveDialog = screen.getByRole("dialog", { name: "Переместить в раздел" });
    expect(within(moveDialog).getByPlaceholderText("Найти раздел")).toBeInTheDocument();
    expect(moveDialog.querySelector("img")).toBeNull();
    expect(within(moveDialog).getByText("Кухня / Выпечка", { exact: true })).toBeInTheDocument();
    await user.click(within(moveDialog).getByRole("button", { name: /^Выпечка$/ }));

    await waitFor(() => {
      expect(screen.getByText("Позиция перемещена в «Выпечка»", { exact: true })).toBeInTheDocument();
    });
  });

  it("retains the catalog table context after a remount", async () => {
    const user = userEvent.setup();
    const view = renderCatalog();
    const search = screen.getByPlaceholderText("Поиск по названию");
    await user.type(search, "Омлет");
    expect(search).toHaveValue("Омлет");
    await user.click(screen.getByRole("button", { name: "Сортировать по возрастанию" }));

    view.unmount();
    render(<CatalogHarness />, { wrapper: Providers });

    expect(screen.getByRole("button", { name: "Сортировать по убыванию" })).toBeInTheDocument();
  });
});
