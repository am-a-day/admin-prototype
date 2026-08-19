import { useState, type ReactNode } from "react";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider } from "@/contexts/catalog-store-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { PublishProvider } from "@/contexts/publish-context";
import { PhoneCatalogEmpty } from "@/components/preview/phone-screens";
import {
  CatalogWorkspace,
  type CatalogPhase,
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

function CatalogHarness({ initialPhase = "has-items" }: { initialPhase?: CatalogPhase }) {
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("sections");
  const [sectionScopeId, setSectionScopeId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<CatalogViewMode>("sections");
  const [catalogPhase, setCatalogPhase] = useState<CatalogPhase>(initialPhase);
  const [routeRevision, setRouteRevision] = useState(0);
  const [routeReturnContext, setRouteReturnContext] = useState<CatalogNavigationBoundary["route"]["returnContext"]>(null);
  const params = new URLSearchParams(window.location.search);
  const navigation: CatalogNavigationBoundary = {
    route: {
      editorNav: params.get("editorNav"),
      sectionId: params.get("sectionId"),
      positionId: params.get("positionId"),
      highlightPositionId: params.get("highlightPositionId"),
      createPosition: params.get("createPosition") === "1",
      createHistoryEntry: false,
      returnContext: routeReturnContext,
      location: { url: window.location.href, state: window.history.state },
      revision: routeRevision,
    },
    replaceSection: (sectionId) => {
      const url = new URL(window.location.href);
      url.searchParams.set("sectionId", sectionId);
      url.searchParams.delete("positionId");
      window.history.replaceState(null, "", url);
      setRouteRevision((revision) => revision + 1);
    },
    replacePosition: (positionId) => {
      const url = new URL(window.location.href);
      url.searchParams.set("positionId", positionId);
      url.searchParams.delete("sectionId");
      window.history.replaceState(null, "", url);
      setRouteRevision((revision) => revision + 1);
    },
    consumeHighlightPosition: () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("highlightPositionId");
      window.history.replaceState(null, "", url);
      setRouteRevision((revision) => revision + 1);
    },
    prepareDirectCreate: (sectionId, returnContext) => {
      const url = new URL(window.location.href);
      url.searchParams.set("createPosition", "1");
      url.searchParams.delete("positionId");
      if (sectionId) url.searchParams.set("sectionId", sectionId);
      else url.searchParams.delete("sectionId");
      window.history.pushState(null, "", url);
      setRouteReturnContext(returnContext);
      setRouteRevision((revision) => revision + 1);
    },
    replaceDirectCreateDestination: (returnContext, sectionId) => {
      const url = new URL(window.location.href);
      url.searchParams.delete("createPosition");
      if (sectionId) url.searchParams.set("sectionId", sectionId);
      else url.searchParams.delete("sectionId");
      window.history.replaceState(null, "", url);
      setRouteReturnContext(returnContext);
      setRouteRevision((revision) => revision + 1);
    },
    back: vi.fn(),
  };

  return (
    <div data-position-editor-overlay-root>
      <div data-position-editor-surface>
        <CatalogWorkspace
          navigation={navigation}
          selectedDishId="669204cd-0d0d-4782-8784-27df185f169e"
          catalogPhase={catalogPhase}
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
          onAdvancePhase={setCatalogPhase}
        />
      </div>
    </div>
  );
}

function renderCatalog(initialPhase: CatalogPhase = "has-items") {
  window.localStorage.clear();
  window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  window.history.replaceState({}, "", "/storefront/catalog?editorNav=unified");
  return render(<CatalogHarness initialPhase={initialPhase} />, { wrapper: Providers });
}

async function openSectionTreeSearch(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "Открыть поиск разделов" }));
  return (await screen.findByPlaceholderText("Поиск по разделам")).closest("aside");
}

function getPositionSidePeek(name?: string) {
  return name
    ? screen.getByRole("complementary", { name })
    : screen.getByRole("complementary");
}

describe("catalog observable behavior baseline", () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  it("keeps the empty preview neutral until the first section exists", () => {
    render(<PhoneCatalogEmpty restaurantName="Тестовое меню" />);

    expect(screen.getByText("Здесь появятся позиции вашего меню", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Добавить позицию" })).not.toBeInTheDocument();
  });

  it("progresses from catalog onboarding to a real empty section without reload", async () => {
    const user = userEvent.setup();
    renderCatalog("empty");

    expect(screen.getByText("Начните создавать меню", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Создайте первый раздел и добавьте в него позиции или импортируйте готовый каталог.", { exact: true })).toBeInTheDocument();
    expect(document.querySelector("[data-catalog-tree-root]")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Поиск по разделам")).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("Поиск по названию")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Импортировать" }));
    expect(screen.getByRole("menuitem", { name: "Импортировать из iiko" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Импортировать из Google Таблиц" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Импортировать из iiko" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Создать раздел" }));
    const createDialog = screen.getByRole("dialog", { name: "Новый раздел" });
    await user.type(within(createDialog).getByLabelText("Название раздела"), "Первый раздел");
    await user.click(within(createDialog).getByRole("button", { name: "Добавить раздел" }));

    await user.click(screen.getByRole("button", { name: "Открыть поиск разделов" }));
    expect(await screen.findByPlaceholderText("Поиск по разделам")).toBeInTheDocument();
    expect(screen.queryByText("Начните создавать меню", { exact: true })).not.toBeInTheDocument();
    expect(document.querySelector("[data-catalog-tree-root]")).toHaveTextContent("Все позиции");
    expect(document.querySelector("[data-inline-section-create]")).not.toBeInTheDocument();
    const sectionTree = (await screen.findByPlaceholderText("Поиск по разделам")).closest("aside");
    await user.click(within(sectionTree as HTMLElement).getByText("Первый раздел", { exact: true }));
    expect(document.querySelector("[data-empty-section-scaffold]")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Вернуться к разделам" })).not.toBeInTheDocument();

    const emptyCreateButton = document.querySelector("[data-empty-position-create]");
    expect(emptyCreateButton).not.toBeNull();
    expect(emptyCreateButton).toHaveTextContent("Добавить позицию");
    expect(emptyCreateButton?.querySelector("svg")).not.toBeNull();
    expect(document.querySelector("[data-empty-subsection-create]")).toHaveTextContent("Добавить подраздел");

    await user.click(emptyCreateButton as HTMLElement);
    const positionSidePeek = await screen.findByRole("complementary", { name: "Новая позиция" });
    expect(positionSidePeek).toHaveAttribute("data-position-create-pane", "true");
    expect(positionSidePeek.querySelector("[data-position-editor-body]")).not.toBeNull();
    expect(positionSidePeek.querySelector("[data-position-editor-header]")).not.toBeNull();
    const titleInput = within(positionSidePeek).getByLabelText("Название позиции");
    expect(titleInput).toHaveFocus();
    await user.click(within(positionSidePeek).getByRole("button", { name: "Свернуть редактор" }));
    await waitFor(() => expect(screen.queryByRole("complementary", { name: "Новая позиция" })).not.toBeInTheDocument());
    expect(document.querySelector("[data-empty-section-scaffold]")).not.toBeNull();
  });

  it("opens a parent section, a leaf section, and all positions", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const catalogRoot = document.querySelector("[data-catalog-tree-root]");
    expect(catalogRoot).not.toBeNull();
    expect(catalogRoot).toHaveTextContent("Все позиции");
    expect(within(catalogRoot as HTMLElement).queryByRole("button", { name: /Действия/ })).not.toBeInTheDocument();
    const sectionTree = await openSectionTreeSearch(user);
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Кухня", { exact: true }));
    expect(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true })).toBeInTheDocument();

    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    expect(screen.getByRole("button", { name: "Действия с разделом «Завтраки»" })).toBeInTheDocument();

    await user.click(catalogRoot as HTMLElement);
    expect(screen.getByPlaceholderText("Поиск по названию")).toBeInTheDocument();
  });

  it("opens position creation in a side peek from a leaf section", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    await user.click(screen.getByRole("button", { name: "Добавить позицию" }));
    const sidePeek = await screen.findByRole("complementary", { name: "Новая позиция" });
    expect(sidePeek).toHaveAttribute("data-position-create-pane", "true");
    await user.click(within(sidePeek).getByRole("button", { name: "Свернуть редактор" }));

    expect(document.querySelector("[data-inline-position-create]")).not.toBeInTheDocument();
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
    expect(within(columnMenu).getByRole("button", { name: /Скрыть колонку «Описание»/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    const rowCheckbox = screen.getAllByRole("checkbox", { name: /Выбрать / })[0];
    expect(rowCheckbox).toBeDefined();
    await user.click(rowCheckbox);
    expect(document.querySelector("[data-catalog-selection-toolbar]")).toHaveTextContent("1 выбрано");
    expect(document.querySelector("[data-catalog-table-header]")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Переместить" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Доступность" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ещё действия" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Фильтры/ }));
    const completenessMenu = screen.getByRole("menu");
    await user.click(within(completenessMenu).getByRole("menuitem", { name: "Заполненность" }));
    const completenessSubmenu = screen.getAllByRole("menu").find((menu) => within(menu).queryByRole("menuitem", { name: /Без описания/ }));
    expect(completenessSubmenu).toBeDefined();
    ["Без описания", "Без фото", "Без веса", "Без КБЖУ", "Без перевода"].forEach((label) => {
      expect(within(completenessSubmenu as HTMLElement).getByRole("menuitem", { name: new RegExp(label) })).toBeInTheDocument();
    });
    const withoutDescription = within(completenessSubmenu as HTMLElement).getByRole("menuitem", { name: /Без описания/ });
    await user.click(withoutDescription);
    expect(screen.getByRole("button", { name: /Фильтры/ })).toHaveTextContent("1");
  });

  it("keeps bulk availability independent and nests secondary actions under more", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /Выбрать (?!все)/ });
    await user.click(rowCheckboxes[0]);
    await user.click(screen.getByRole("button", { name: "Доступность" }));

    expect(screen.getByRole("menuitem", { name: "Поставить на стоп" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Добавить расписание" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Архивировать" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Удалить" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitem", { name: "Поставить на стоп" }));
    expect(screen.getByRole("menuitemradio", { name: "Скрывать из меню" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Показывать как “скоро будет”" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);

    await user.click(screen.getByRole("button", { name: "Ещё действия" }));
    expect(screen.getByRole("menuitem", { name: "Задать скидку" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Архивировать" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Удалить" })).toBeInTheDocument();
  });

  it("applies a schedule to a bulk selection and exposes schedule removal", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /Выбрать (?!все)/ });
    await user.click(rowCheckboxes[0]);
    await user.click(screen.getByRole("button", { name: "Доступность" }));
    await user.click(screen.getByRole("menuitem", { name: "Добавить расписание" }));
    const schedulePopover = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    expect(schedulePopover).toBeInTheDocument();
    expect(within(schedulePopover).getByText("Вне расписания", { exact: true })).toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Отмена" })).not.toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();

    await user.click(within(schedulePopover).getByRole("button", { name: "Режим вне расписания" }));
    await user.click(screen.getByRole("menuitemradio", { name: /^Показывать как “скоро будет”$/ }));
    expect(within(schedulePopover).getByText("Показывать", { exact: true })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    await waitFor(() => expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument());
    expect(screen.getByText("Расписание применено к выбранным позициям", { exact: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Доступность" }));
    await user.click(screen.getByRole("menuitem", { name: "Изменить расписание" }));
    const reopenedSchedulePopover = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    await user.click(within(reopenedSchedulePopover).getByRole("button", { name: "Убрать расписание" }));
    await waitFor(() => expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument());
    expect(screen.getByRole("menuitem", { name: "Добавить расписание" })).toBeInTheDocument();
  });

  it("keeps subsection rows dense and supports one, many, and select-all selection", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Кухня", { exact: true }));

    expect(screen.queryByRole("button", { name: /К позициям/ })).not.toBeInTheDocument();
    const breakfastCheckbox = screen.getByRole("checkbox", { name: "Выбрать подраздел Завтраки" });
    expect(breakfastCheckbox.closest("[role=button]")).toHaveClass("h-[38px]");
    await user.click(breakfastCheckbox);
    expect(document.querySelector("[data-subsection-bulk-toolbar]")).toHaveTextContent("Выбрано: 1");

    const bakeryCheckbox = screen.getByRole("checkbox", { name: "Выбрать подраздел Выпечка" });
    await user.click(bakeryCheckbox);
    expect(document.querySelector("[data-subsection-bulk-toolbar]")).toHaveTextContent("Выбрано: 2");

    const selectAll = screen.getByRole("checkbox", { name: "Выбрать все подразделы" });
    await user.click(selectAll);
    screen.getAllByRole("checkbox", { name: /Выбрать подраздел / }).forEach((checkbox) => expect(checkbox).toBeChecked());
    await user.click(selectAll);
    expect(breakfastCheckbox).not.toBeChecked();
    expect(bakeryCheckbox).not.toBeChecked();
  });

  it("keeps the leaf table header sticky and rows reorderable", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));

    const card = document.querySelector("[data-catalog-items-card]");
    expect(card).not.toBeNull();
    const localHeader = document.querySelector("[data-catalog-local-header]");
    expect(localHeader).toBeNull();
    const toolbar = document.querySelector("[data-catalog-table-toolbar]");
    expect(toolbar).not.toBeNull();
    expect(toolbar).toHaveClass("sticky", "top-0", "bg-white");
    expect(within(toolbar as HTMLElement).getByText("Все", { exact: true })).toBeInTheDocument();
    expect(within(toolbar as HTMLElement).getByPlaceholderText("Поиск по названию")).toBeInTheDocument();
    const tableHeader = document.querySelector("[data-catalog-table-header]");
    expect(tableHeader).toHaveClass("sticky", "top-[39px]", "bg-[#fafaf9]");
    expect(within(tableHeader as HTMLElement).getByText("Название", { exact: true })).toBeInTheDocument();
    expect(within(tableHeader as HTMLElement).queryByPlaceholderText("Поиск по названию")).not.toBeInTheDocument();
    expect(document.querySelector("[data-catalog-table-horizontal-scroll]")).not.toBeNull();

    const reorderableRow = document.querySelector("[data-row-reorder-enabled=true]");
    expect(reorderableRow).not.toBeNull();
    expect(reorderableRow).toHaveAttribute("aria-roledescription", "sortable");
  });

  it("uses the section-title chevron and keeps schedule settings singular", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Кухня", { exact: true }));

    const sectionMenuTrigger = screen.getByRole("button", { name: "Действия с разделом «Кухня»" });
    expect(sectionMenuTrigger.querySelector("svg")).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Действия с разделом" })).not.toBeInTheDocument();
    await user.click(sectionMenuTrigger);
    expect(screen.getByRole("menuitem", { name: "Добавить подраздел" })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    await user.click(screen.getByRole("button", { name: "Действия с разделом «Завтраки»" }));
    expect(screen.queryByRole("menuitem", { name: "Настройки раздела" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Переименовать" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Поменять иконку" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Поставить на стоп" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Добавить расписание" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Поставить на стоп" }));
    await user.click(screen.getByRole("button", { name: "Действия с разделом «Завтраки»" }));
    expect(screen.getByRole("menuitem", { name: "Снять со стопа" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Добавить расписание" }));
    expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeNull();
    expect(screen.getByText("Вне расписания", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Отмена" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
  });

  it("opens an item from the table and returns to the same table context", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const search = screen.getByPlaceholderText("Поиск по названию");
    await user.type(search, "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));

    expect(screen.getByText("Основное", { exact: true })).toBeInTheDocument();
    await user.click(within(getPositionSidePeek(firstItemTitle)).getByRole("button", { name: "Свернуть редактор" }));

    expect(screen.getByPlaceholderText("Поиск по названию")).toHaveValue("Омлет");
    expect(screen.getAllByText(firstItemTitle, { exact: true }).length).toBeGreaterThan(0);
  });

  it("closes a portal overlay before closing the side peek", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    const sidePeek = getPositionSidePeek(firstItemTitle);

    await user.click(within(sidePeek).getByRole("button", { name: /Опции/ }));
    await user.click(within(sidePeek).getByRole("button", { name: /^Добавить опцию$/ }));
    expect(screen.getByRole("tab", { name: /^Настройки$/ })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByRole("tab", { name: /^Настройки$/ })).not.toBeInTheDocument(),
    );
    expect(getPositionSidePeek(firstItemTitle)).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("complementary", { name: firstItemTitle })).not.toBeInTheDocument());
  });

  it("keeps the position side peek open when the schedule popover is dismissed outside", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    const sidePeek = getPositionSidePeek(firstItemTitle);

    await user.click(within(sidePeek).getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` }));
    await user.click(screen.getByRole("menuitem", { name: "Доступность" }));
    await user.click(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    expect(document.querySelector("[data-catalog-schedule-popover]")).toBeInTheDocument();

    const neutralSurface = document.querySelector('input[placeholder="Поиск по названию"]') as HTMLElement;
    fireEvent.pointerDown(neutralSurface);
    fireEvent.click(neutralSurface);
    await waitFor(() => expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument());
    expect(getPositionSidePeek(firstItemTitle)).toBeInTheDocument();
    await user.click(within(getPositionSidePeek(firstItemTitle)).getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` }));
    await user.click(screen.getByRole("menuitem", { name: "Доступность" }));
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "true");
  });

  it("autosaves schedule changes and keeps the saved schedule after reopening the menu", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    const actions = () => within(getPositionSidePeek(firstItemTitle)).getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` });

    await user.click(actions());
    const availabilityTrigger = screen.getByRole("menuitem", { name: "Доступность" });
    await user.hover(availabilityTrigger);
    await waitFor(() => expect(screen.getByRole("menuitemradio", { name: "Доступно" })).toBeInTheDocument());
    await user.keyboard("{Escape}");
    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступность" }));
    await user.click(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    const schedulePopover = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    await user.click(within(schedulePopover).getByRole("button", { name: "Режим вне расписания" }));
    await user.click(screen.getByRole("menuitemradio", { name: /^Показывать как “скоро будет”$/ }));
    expect(within(schedulePopover).getByText("Показывать", { exact: true })).toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Отмена" })).not.toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();

    await user.click(within(schedulePopover).getByRole("button", { name: "Назад к Доступности" }));
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    const scheduleAfterBack = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    expect(within(scheduleAfterBack).getByText("Показывать", { exact: true })).toBeInTheDocument();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument());
    expect(getPositionSidePeek(firstItemTitle)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByRole("complementary", { name: firstItemTitle })).not.toBeInTheDocument());
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступность" }));
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    const reopenedSchedulePopover = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    expect(within(reopenedSchedulePopover).getByText("Показывать", { exact: true })).toBeInTheDocument();
    expect(within(reopenedSchedulePopover).getByRole("button", { name: "Назад к Доступности" })).toBeInTheDocument();
    expect(within(reopenedSchedulePopover).getByRole("button", { name: "Закрыть меню" })).toBeInTheDocument();
    expect(within(reopenedSchedulePopover).queryByRole("button", { name: "Убрать расписание" })).not.toBeInTheDocument();
    await user.click(within(reopenedSchedulePopover).getByRole("button", { name: "Назад к Доступности" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Доступно" }));
    expect(document.querySelector("[data-position-availability-status]")).toHaveTextContent("Доступно");
  });

  it("shows all availability modes and keeps stop settings open", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    const actions = () => within(getPositionSidePeek(firstItemTitle)).getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` });

    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступность" }));
    expect(screen.getByRole("menuitemradio", { name: "Доступно" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "На стопе" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitemradio", { name: "Доступно" }).querySelector("svg")).toBeNull();
    expect(screen.getByRole("menuitemradio", { name: "На стопе" }).querySelector("svg")).not.toBeNull();
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" }).querySelector("svg")).not.toBeNull();

    await user.click(screen.getByRole("menuitemradio", { name: "На стопе" }));
    expect(screen.getByRole("button", { name: "Назад к Доступности" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Назад к Доступности" })).toHaveTextContent("Отображение в меню");
    expect(screen.getByRole("menuitemradio", { name: "Скрывать из меню" })).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("menuitemradio", { name: "Доступно" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Переключить на расписание" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Убрать со стопа" })).not.toBeInTheDocument();

    const comingSoonOption = screen.getByRole("menuitemradio", { name: "Показывать как “скоро будет”" });
    await user.click(comingSoonOption);
    expect(comingSoonOption).toHaveAttribute("aria-checked", "true");
    expect(document.querySelector("[data-position-availability-status]")).toHaveTextContent("Скоро будет");
    await user.click(screen.getByRole("menuitemradio", { name: "Скрывать из меню" }));
    expect(screen.getByRole("menuitemradio", { name: "Скрывать из меню" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "Показывать как “скоро будет”" })).toHaveAttribute("aria-checked", "false");
    expect(document.querySelector("[data-position-availability-status]")).toHaveTextContent("На стопе");

    await user.click(screen.getByRole("button", { name: "Назад к Доступности" }));
    await user.click(screen.getByRole("menuitemradio", { name: "На стопе" }));
    expect(screen.getByRole("button", { name: "Назад к Доступности" })).toHaveTextContent("Отображение в меню");

    await user.keyboard("{Escape}");
    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступность" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Доступно" }));
    expect(document.querySelector("[data-position-availability-status]")).toHaveTextContent("Доступно");
  });

  it("switches availability modes directly from the shared mode list", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    const actions = () => within(getPositionSidePeek(firstItemTitle)).getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` });

    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступность" }));
    await user.click(screen.getByRole("menuitemradio", { name: "На стопе" }));
    await user.keyboard("{Escape}");

    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступность" }));
    expect(screen.getByRole("menuitemradio", { name: "На стопе" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "По расписанию" }));

    const schedulePopover = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    expect(within(schedulePopover).getByRole("button", { name: "Назад к Доступности" })).toBeInTheDocument();
    expect(within(schedulePopover).getByRole("button", { name: "Закрыть меню" })).toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Убрать расписание" })).not.toBeInTheDocument();
    await user.click(within(schedulePopover).getByRole("button", { name: "Режим вне расписания" }));
    await user.click(screen.getByRole("menuitemradio", { name: /^Показывать как “скоро будет”$/ }));

    await user.keyboard("{Escape}");
    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступность" }));
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: "На стопе" }));
    expect(screen.getByRole("menuitemradio", { name: "Скрывать из меню" })).toHaveAttribute("aria-checked", "true");
    await user.keyboard("{Escape}");

    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступность" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Доступно" }));
    await waitFor(() => expect(document.querySelector("[data-position-availability-status]")).toHaveTextContent("Доступно"));
  });

  it("exposes sibling navigation controls inside the focused editor", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    await user.click(screen.getByText(firstItemTitle, { exact: true }));

    const initialSidePeek = getPositionSidePeek(firstItemTitle);
    const nextButton = within(initialSidePeek).getByRole("button", { name: "Следующая позиция в выборке" });
    expect(nextButton).toBeEnabled();
    expect(within(initialSidePeek).getByRole("button", { name: "Предыдущая позиция в выборке" })).toBeDisabled();
    await user.click(within(initialSidePeek).getByRole("button", { name: "Свернуть редактор" }));

    expect(screen.getAllByText("Завтраки", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("Поиск по названию")).toBeInTheDocument();
  });

  it("manages availability through the editor tab", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));

    const header = document.querySelector("[data-position-editor-header]");
    expect(header).not.toBeNull();
    expect(header).toHaveClass("flex");
    expect(document.querySelector("[data-position-title-region]")).toHaveClass("min-w-0", "flex-1");
    expect(header?.querySelector("[data-position-availability-status]")).toHaveTextContent("Доступно");
    ["Основное", "Рекомендации", "Опции", "Доступность", "Вид"].forEach((label) => {
      expect(screen.getByRole("button", { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("button", { name: "Доступность" }));
    const availability = screen.getByRole("radiogroup", { name: "Доступность позиции" });
    expect(within(availability).getByRole("radio", { name: "Доступно" })).toBeChecked();
    await user.click(within(availability).getByRole("radio", { name: "На стопе" }));
    expect(within(availability).getByRole("radio", { name: "На стопе" })).toBeChecked();
    expect(header?.querySelector("[data-position-availability-status]")).toHaveTextContent("На стопе");
    const stopDisplay = screen.getByRole("radiogroup", { name: "Отображение в меню" });
    expect(within(stopDisplay).getByRole("radio", { name: "Скрывать из меню" })).toBeChecked();
    expect(within(stopDisplay).getByRole("radio", { name: "Показывать без возможности заказа" })).toBeInTheDocument();
  });

  it("keeps table actions available after collapsing the editor", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    await user.click(screen.getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` }));

    const editorMenu = screen.getByRole("menu");
    ["Переименовать", "Переместить", "Создать копию", "Архивировать", "Удалить"].forEach((label) => {
      expect(within(editorMenu).getByRole("menuitem", { name: label })).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");
    await user.click(within(getPositionSidePeek(firstItemTitle)).getByRole("button", { name: "Свернуть редактор" }));
    await waitFor(() => expect(screen.queryByRole("complementary", { name: firstItemTitle })).not.toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: `Действия для ${firstItemTitle}` }));
    const tableMenu = screen.getByRole("menu");
    expect(within(tableMenu).getByRole("menuitem", { name: "Доступность" })).toBeInTheDocument();
    expect(within(tableMenu).queryByRole("menuitem", { name: "Поставить на стоп" })).not.toBeInTheDocument();
    expect(within(tableMenu).queryByRole("menuitem", { name: "Добавить расписание" })).not.toBeInTheDocument();
    expect(within(tableMenu).queryByRole("menuitem", { name: "Когда недоступно" })).not.toBeInTheDocument();
    await user.click(within(tableMenu).getByRole("menuitem", { name: "Доступность" }));
    expect(screen.getByRole("menuitemradio", { name: "Доступно" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "На стопе" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: "Скрывать из меню" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("menuitemradio", { name: "На стопе" }));
    expect(screen.getByRole("menuitemradio", { name: "Скрывать из меню" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Показывать как “скоро будет”" })).toBeInTheDocument();
  });

  it("does not expose table reorder controls for all positions", () => {
    renderCatalog();

    expect(screen.queryByRole("button", { name: /Изменить порядок позиции/ })).not.toBeInTheDocument();
  });

  it("exposes leaf reorder controls and keeps explicit move destination observable", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));

    expect((await screen.findAllByRole("button", { name: /Изменить порядок позиции/ })).length).toBeGreaterThan(1);

    await user.click(screen.getAllByRole("button", { name: /Действия для/ })[0]);
    await user.click(screen.getByRole("menuitem", { name: "Переместить" }));
    const moveDialog = screen.getByRole("dialog", { name: "Переместить в раздел" });
    expect(within(moveDialog).getByPlaceholderText("Найти раздел...")).toBeInTheDocument();
    expect(moveDialog.querySelector("img")).not.toBeNull();
    expect(within(moveDialog).getByText("Кухня / Выпечка", { exact: true })).toBeInTheDocument();
    await user.click(within(moveDialog).getByRole("button", { name: "Кухня / Выпечка" }));

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
