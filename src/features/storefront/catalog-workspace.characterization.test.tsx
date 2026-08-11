import { useState, type ReactNode } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
    expect(screen.getByText("В разделе пока нет позиций", { exact: true })).toBeInTheDocument();
    expect(screen.getByText("Добавьте первую позицию или создайте подраздел.", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Вернуться к разделам" })).not.toBeInTheDocument();
    expect(document.querySelector("[data-position-create-button]")).not.toBeInTheDocument();

    const emptyCreateButton = document.querySelector("[data-empty-position-create]");
    expect(emptyCreateButton).not.toBeNull();
    expect(emptyCreateButton).toHaveTextContent("Добавить позицию");
    expect(emptyCreateButton?.querySelector("svg")).not.toBeNull();
    expect(document.querySelector("[data-empty-subsection-create]")).toHaveTextContent("Добавить подраздел");

    await user.click(emptyCreateButton as HTMLElement);
    const positionDialog = screen.getByRole("dialog", { name: "Новая позиция" });
    const creationHeader = positionDialog.querySelector("[data-position-create-header]");
    const creationFooter = positionDialog.querySelector("[data-position-create-footer]");
    expect(creationHeader).not.toBeNull();
    expect(creationFooter).not.toBeNull();
    expect(within(creationHeader as HTMLElement).getByText("Новая позиция", { exact: true })).toBeInTheDocument();
    expect(within(creationHeader as HTMLElement).getAllByRole("button")).toHaveLength(1);
    expect(within(creationHeader as HTMLElement).getByRole("button", { name: "Закрыть" })).toBeInTheDocument();
    expect(within(positionDialog).getByRole("button", { name: "Добавить в: Первый раздел" })).toBeInTheDocument();
    const titleInput = within(positionDialog).getByLabelText("Название позиции");
    expect(titleInput).toHaveFocus();
    expect(within(positionDialog).queryByRole("button", { name: "Создать" })).not.toBeInTheDocument();
    expect(within(positionDialog).queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
    const createPositionButton = within(creationFooter as HTMLElement).getByRole("button", { name: "Создать позицию" });
    expect(createPositionButton).toBeDisabled();
    await user.type(titleInput, "Первая позиция");
    expect(within(creationHeader as HTMLElement).getByText("Новая позиция", { exact: true })).toBeInTheDocument();
    expect(createPositionButton).toBeEnabled();
    expect(screen.getByText("В разделе пока нет позиций", { exact: true })).toBeInTheDocument();
    await user.type(within(positionDialog).getByLabelText("Цена позиции"), "1500");
    await user.type(within(positionDialog).getByLabelText("Объем позиции"), "250");
    await user.click(createPositionButton);

    const editDialog = await screen.findByRole("dialog", { name: "Первая позиция" });
    expect(editDialog.querySelector("[data-position-create-header]")).not.toBeInTheDocument();
    expect(editDialog.querySelector("[data-position-create-footer]")).not.toBeInTheDocument();
    expect(within(editDialog).queryByRole("button", { name: "Создать позицию" })).not.toBeInTheDocument();
    expect(within(editDialog).getByRole("button", { name: "Предыдущая позиция" })).toBeDisabled();
    expect(within(editDialog).getByRole("button", { name: "Следующая позиция" })).toBeDisabled();
    await user.click(within(editDialog).getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Первая позиция" })).not.toBeInTheDocument());
    expect(screen.queryByText("В разделе пока нет позиций", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByText("Первая позиция", { exact: true })).toBeInTheDocument();
    expect(screen.queryByText("Основное", { exact: true })).not.toBeInTheDocument();
    await waitFor(() => expect(document.querySelector("[data-position-create-button]")).not.toBeNull());
    expect(document.querySelector("[data-position-create-button]")).toHaveTextContent("Добавить позицию");
    expect(document.querySelector("[data-subsection-create-button]")).toHaveTextContent("Добавить подраздел");
    expect(document.querySelector("[data-inline-position-create]")).not.toBeInTheDocument();

    await user.click(screen.getByText("Первая позиция", { exact: true }));
    const reopenedDialog = await screen.findByRole("dialog", { name: "Первая позиция" });
    expect(within(reopenedDialog).getByText("Основное", { exact: true })).toBeInTheDocument();
    const editorOverlay = document.querySelector("[data-position-editor-overlay]");
    expect(editorOverlay).not.toBeNull();
    expect(editorOverlay?.parentElement).toHaveAttribute("data-position-editor-surface");
    expect(editorOverlay).toHaveClass("bg-black/20");
    expect(editorOverlay?.className).not.toContain("backdrop-blur");
    expect(document.querySelectorAll("[data-catalog-table-row]").length).toBeGreaterThan(0);
    expect(document.querySelector("[data-catalog-tree-root]")?.contains(editorOverlay)).toBe(false);
    await user.click(within(reopenedDialog).getByRole("button", { name: "Закрыть" }));
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Первая позиция" })).not.toBeInTheDocument());
    expect(screen.getByText("Первая позиция", { exact: true })).toBeInTheDocument();
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

  it("uses the same editor-in-modal creation flow from root and the section toolbar", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const rootCreate = document.querySelector("[data-position-create-button]");
    expect(rootCreate).not.toBeNull();
    const rowCountBeforeEmptyCreate = document.querySelectorAll("[data-catalog-table-row]").length;
    await user.click(rootCreate as HTMLElement);
    let dialog = screen.getByRole("dialog", { name: "Новая позиция" });
    expect(within(dialog).getByRole("button", { name: "Добавить в: Выберите раздел" })).toBeInTheDocument();
    expect(within(dialog).getByText("Основное", { exact: true })).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Создать" })).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Добавить в: Выберите раздел" }));
    await user.type(screen.getByLabelText("Поиск по разделам"), "Завтраки");
    await user.click(screen.getByRole("menuitem", { name: "Завтраки" }));
    expect(within(dialog).getByRole("button", { name: "Добавить в: Завтраки" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Закрыть" }));
    expect(screen.queryByText("Название позиции", { exact: true })).not.toBeInTheDocument();
    expect(document.querySelectorAll("[data-catalog-table-row]")).toHaveLength(rowCountBeforeEmptyCreate);

    const sectionTree = await openSectionTreeSearch(user);
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    await user.click(document.querySelector("[data-position-create-button]") as HTMLElement);
    dialog = screen.getByRole("dialog", { name: "Новая позиция" });
    expect(within(dialog).getByRole("button", { name: "Добавить в: Завтраки" })).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Закрыть" }));

    expect(document.querySelector("[data-inline-position-create]")).not.toBeInTheDocument();
  });

  it("routes a direct create entry to the editor canvas modal", () => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
    window.history.replaceState({}, "", "/storefront/catalog?editorNav=unified&createPosition=1");
    render(<CatalogHarness />, { wrapper: Providers });

    expect(screen.getByRole("dialog", { name: "Новая позиция" })).toBeInTheDocument();
    expect(document.querySelector("[data-position-editor-header]")).toBeNull();
    expect(document.querySelector("[data-position-create-canvas]")).not.toBeNull();
    expect(screen.getByText("Основное", { exact: true })).toBeInTheDocument();
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

  it("shows the local positions heading, sticky table header, and row-body reorder affordance in a leaf", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
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

    const sectionTree = await openSectionTreeSearch(user);
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
    expect(within(createDialog).getByRole("button", { name: "Добавить в: Кухня" })).toBeInTheDocument();
    expect(within(createDialog).queryByText("Расположение", { exact: true })).not.toBeInTheDocument();
    await user.type(within(createDialog).getByLabelText("Название раздела"), "Сезонное меню");
    await user.click(within(createDialog).getByRole("button", { name: "Добавить раздел" }));
    expect((await screen.findAllByText("Сезонное меню", { exact: true })).length).toBeGreaterThan(0);

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
    await user.click(screen.getByRole("button", { name: "Добавить расписание" }));

    expect(screen.getByRole("menuitem", { name: "Снять со стопа" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Расписание" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Снять со стопа" }));
    await user.click(screen.getByRole("button", { name: "Действия с разделом «Завтраки»" }));
    expect(screen.getByRole("menuitem", { name: "Расписание" })).toBeInTheDocument();
  });

  it("opens an item from the table and returns to the same table context", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const search = screen.getByPlaceholderText("Поиск по названию");
    await user.type(search, "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));

    expect(screen.getByText("Основное", { exact: true })).toBeInTheDocument();
    await user.click(within(screen.getByRole("dialog", { name: firstItemTitle })).getByRole("button", { name: "Закрыть" }));

    expect(screen.getByPlaceholderText("Поиск по названию")).toHaveValue("Омлет");
    expect(screen.getByText(firstItemTitle, { exact: true })).toBeInTheDocument();
  });

  it("switches to a sibling inside a section without rebuilding the focused editor", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    await user.click(screen.getByText(firstItemTitle, { exact: true }));

    const initialDialog = screen.getByRole("dialog", { name: firstItemTitle });
    const nextButton = within(initialDialog).getByRole("button", { name: "Следующая позиция" });
    expect(nextButton).toBeEnabled();
    await user.click(nextButton);

    await waitFor(() => expect(screen.getByRole("dialog")).not.toHaveAccessibleName(firstItemTitle));
    const siblingDialog = screen.getByRole("dialog");
    expect(within(siblingDialog).getByRole("button", { name: "Предыдущая позиция" })).toBeEnabled();
    await user.click(within(siblingDialog).getByRole("button", { name: "Закрыть" }));

    expect(screen.getAllByText("Завтраки", { exact: true }).length).toBeGreaterThan(0);
    expect(screen.getByPlaceholderText("Поиск по названию")).toBeInTheDocument();
  });

  it("manages availability from the header while keeping schedule under a manual stop", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));

    const header = document.querySelector("[data-position-editor-header]");
    expect(header).not.toBeNull();
    expect(header).toHaveClass("grid", "grid-cols-[minmax(0,1fr)_auto]");
    expect(document.querySelector("[data-position-title-region]")).toHaveClass("min-w-0", "flex-1");
    expect(screen.getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` })).not.toHaveClass("max-w-[280px]");
    expect(screen.queryByRole("button", { name: "Доступность" })).not.toBeInTheDocument();
    ["Основное", "Допродажа", "Опции", "Отображение"].forEach((label) => {
      expect(screen.getByRole("button", { name: new RegExp(`^${label}`) })).toBeInTheDocument();
    });

    await user.click(within(header as HTMLElement).getByRole("button", { name: "Доступно" }));
    expect(screen.getByRole("menuitem", { name: "Поставить на стоп" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Добавить расписание" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Когда недоступно" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Поставить на стоп" }));
    expect(within(header as HTMLElement).getByRole("button", { name: "На стопе" })).toBeInTheDocument();

    await user.click(within(header as HTMLElement).getByRole("button", { name: "На стопе" }));
    expect(screen.getByRole("menuitem", { name: "Снять со стопа" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Добавить расписание" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Снять со стопа" }));
    expect(within(header as HTMLElement).getByRole("button", { name: "Доступно" })).toBeInTheDocument();

    await user.click(within(header as HTMLElement).getByRole("button", { name: "Доступно" }));
    await user.click(screen.getByRole("menuitem", { name: "Добавить расписание" }));
    expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeNull();
    expect(screen.getByRole("button", { name: "Когда доступно" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByRole("button", { name: "Удалить расписание" })).not.toBeInTheDocument();
    expect(screen.getByText("Пятница", { exact: true })).toBeInTheDocument();
    expect(screen.getAllByText("Понедельник", { exact: true })).toHaveLength(1);

    const dayLabels = ["Воскресенье", "Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота"];
    const dayKeys = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];
    const currentDayLabel = dayLabels[new Date().getDay()];
    const currentDayKey = dayKeys[new Date().getDay()];
    const currentDayRow = document.querySelector(`[data-schedule-day="${currentDayKey}"]`);
    expect(currentDayRow).not.toBeNull();

    await user.click(screen.getByRole("button", { name: `${currentDayLabel}: режим расписания` }));
    await user.click(screen.getByRole("menuitemradio", { name: "По часам" }));
    expect(within(currentDayRow as HTMLElement).getByLabelText(`${currentDayLabel}: начало интервала`)).toBeInTheDocument();
    expect(within(currentDayRow as HTMLElement).getByLabelText(`${currentDayLabel}: конец интервала`)).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: "По часам" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `${currentDayLabel}: режим расписания` }));
    expect(screen.getByRole("menuitem", { name: "Применить ко всем" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Применить ко всем" }));
    document.querySelectorAll("[data-schedule-day]").forEach((dayRow) => {
      expect(dayRow).toHaveAttribute("data-day-mode", "custom");
    });
    expect(within(document.querySelector('[data-schedule-day="tuesday"]') as HTMLElement).getByLabelText("Вторник: начало интервала")).toHaveValue("09:00");

    await user.click(screen.getByRole("button", { name: `${currentDayLabel}: режим расписания` }));
    await user.click(screen.getByRole("menuitemradio", { name: "Весь день" }));
    expect(within(currentDayRow as HTMLElement).queryByLabelText(`${currentDayLabel}: начало интервала`)).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: `${currentDayLabel}: режим расписания` }));
    await user.click(screen.getByRole("menuitemradio", { name: "Недоступно" }));
    expect(currentDayRow).toHaveAttribute("data-day-mode", "unavailable");
    expect(within(currentDayRow as HTMLElement).queryByLabelText(`${currentDayLabel}: начало интервала`)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Добавить расписание" }));
    expect(within(header as HTMLElement).getByRole("button", { name: "Недоступно" })).toBeInTheDocument();

    await user.click(within(header as HTMLElement).getByRole("button", { name: "Недоступно" }));
    await user.click(screen.getByRole("menuitem", { name: "Расписание" }));
    expect(document.querySelector(`[data-schedule-day="${currentDayKey}"]`)).toHaveAttribute("data-day-mode", "unavailable");
    expect(screen.getByRole("button", { name: "Сохранить" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Удалить расписание" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Когда недоступно" }));
    expect(screen.getByRole("button", { name: "Когда недоступно" })).toHaveAttribute("aria-pressed", "true");
    await user.click(screen.getByRole("button", { name: "Сохранить" }));

    await user.click(within(header as HTMLElement).getByRole("button", { name: "Недоступно" }));
    await user.click(screen.getByRole("menuitem", { name: "Поставить на стоп" }));
    expect(within(header as HTMLElement).getByRole("button", { name: "На стопе" })).toBeInTheDocument();
    await user.click(within(header as HTMLElement).getByRole("button", { name: "На стопе" }));
    expect(screen.getByRole("menuitem", { name: "Расписание" })).toBeInTheDocument();
    await user.click(screen.getByRole("menuitem", { name: "Когда недоступно" }));
    await user.click(screen.getByRole("menuitemradio", { name: /Показывать «Скоро будет»/ }));

    await user.click(within(header as HTMLElement).getByRole("button", { name: "На стопе" }));
    await user.click(screen.getByRole("menuitem", { name: "Когда недоступно" }));
    expect(screen.getByRole("menuitemradio", { name: /Показывать «Скоро будет»/ })).toHaveAttribute("aria-checked", "true");
    await user.click(screen.getByRole("menuitemradio", { name: /Скрывать позицию/ }));

    await user.click(within(header as HTMLElement).getByRole("button", { name: "На стопе" }));
    await user.click(screen.getByRole("menuitem", { name: "Снять со стопа" }));
    expect(within(header as HTMLElement).getByRole("button", { name: "Недоступно" })).toBeInTheDocument();

    await user.click(within(screen.getByRole("dialog", { name: firstItemTitle })).getByRole("button", { name: "Закрыть" }));
    const scheduledTableRow = screen.getByText(firstItemTitle, { exact: true }).closest("[data-catalog-table-row]");
    expect(scheduledTableRow).not.toBeNull();
    expect(within(scheduledTableRow as HTMLElement).getByText("Недоступно", { exact: true })).toBeInTheDocument();

    await user.click(scheduledTableRow as HTMLElement);
    const deleteScheduleHeader = document.querySelector("[data-position-editor-header]");
    expect(deleteScheduleHeader).not.toBeNull();
    await user.click(within(deleteScheduleHeader as HTMLElement).getByRole("button", { name: "Недоступно" }));
    await user.click(screen.getByRole("menuitem", { name: "Расписание" }));
    await user.click(screen.getByRole("button", { name: "Удалить расписание" }));
    expect(within(deleteScheduleHeader as HTMLElement).getByRole("button", { name: "Доступно" })).toBeInTheDocument();

    await user.click(within(deleteScheduleHeader as HTMLElement).getByRole("button", { name: "Доступно" }));
    expect(screen.getByRole("menuitem", { name: "Добавить расписание" })).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog", { name: firstItemTitle })).getByRole("button", { name: "Закрыть" }));
    const tableRowWithoutSchedule = screen.getByText(firstItemTitle, { exact: true }).closest("[data-catalog-table-row]");
    expect(tableRowWithoutSchedule).not.toBeNull();
    expect(within(tableRowWithoutSchedule as HTMLElement).queryByText("Недоступно", { exact: true })).not.toBeInTheDocument();
    expect(within(tableRowWithoutSchedule as HTMLElement).queryByText("По расписанию", { exact: true })).not.toBeInTheDocument();
  });

  it("uses the same availability actions in the editor and table more-menus", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    await user.click(screen.getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` }));

    const editorMenu = screen.getByRole("menu");
    ["Переименовать", "Переместить", "Создать копию", "Архивировать", "Удалить"].forEach((label) => {
      expect(within(editorMenu).getByRole("menuitem", { name: label })).toBeInTheDocument();
    });
    ["Поставить на стоп", "Добавить расписание", "Когда недоступно"].forEach((label) => {
      expect(within(editorMenu).getByRole("menuitem", { name: label })).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");
    await user.click(within(screen.getByRole("dialog", { name: firstItemTitle })).getByRole("button", { name: "Закрыть" }));
    await user.click(screen.getByRole("button", { name: `Действия для ${firstItemTitle}` }));
    const tableMenu = screen.getByRole("menu");
    expect(within(tableMenu).getByRole("menuitem", { name: "Поставить на стоп" })).toBeInTheDocument();
    expect(within(tableMenu).getByRole("menuitem", { name: "Добавить расписание" })).toBeInTheDocument();
    expect(within(tableMenu).getByRole("menuitem", { name: "Когда недоступно" })).toBeInTheDocument();

    await user.click(within(tableMenu).getByRole("menuitem", { name: "Поставить на стоп" }));
    const tableRow = screen.getByText(firstItemTitle, { exact: true }).closest("[data-catalog-table-row]");
    expect(tableRow).not.toBeNull();
    expect(within(tableRow as HTMLElement).getByText("На стопе", { exact: true })).toBeInTheDocument();

    await user.click(tableRow as HTMLElement);
    const syncedHeader = document.querySelector("[data-position-editor-header]");
    expect(syncedHeader).not.toBeNull();
    expect(within(syncedHeader as HTMLElement).getByRole("button", { name: "На стопе" })).toBeInTheDocument();
    await user.click(within(syncedHeader as HTMLElement).getByRole("button", { name: "На стопе" }));
    await user.click(screen.getByRole("menuitem", { name: "Когда недоступно" }));
    await user.click(screen.getByRole("menuitemradio", { name: /Показывать «Скоро будет»/ }));
    expect(within(syncedHeader as HTMLElement).getByRole("button", { name: "На стопе" })).toBeInTheDocument();

    await user.click(within(screen.getByRole("dialog", { name: firstItemTitle })).getByRole("button", { name: "Закрыть" }));
    const updatedTableRow = screen.getByText(firstItemTitle, { exact: true }).closest("[data-catalog-table-row]");
    expect(updatedTableRow).not.toBeNull();
    expect(within(updatedTableRow as HTMLElement).getByText("Скоро будет", { exact: true })).toBeInTheDocument();

    await user.click(updatedTableRow as HTMLElement);
    const resumedHeader = document.querySelector("[data-position-editor-header]");
    expect(resumedHeader).not.toBeNull();
    await user.click(within(resumedHeader as HTMLElement).getByRole("button", { name: "На стопе" }));
    await user.click(screen.getByRole("menuitem", { name: "Снять со стопа" }));
    expect(within(resumedHeader as HTMLElement).getByRole("button", { name: "Доступно" })).toBeInTheDocument();
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
