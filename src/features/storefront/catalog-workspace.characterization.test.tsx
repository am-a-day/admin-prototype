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

async function openKitchenSubsectionTable(user: ReturnType<typeof userEvent.setup>) {
  const sectionTree = await openSectionTreeSearch(user);
  await user.click(within(sectionTree as HTMLElement).getByText("Кухня", { exact: true }));
  return sectionTree as HTMLElement;
}

async function createAndOpenEmptySection(user: ReturnType<typeof userEvent.setup>, name = "Пустой раздел") {
  renderCatalog("empty");
  await user.click(screen.getByRole("button", { name: "Создать раздел" }));
  const createDialog = screen.getByRole("dialog", { name: "Новый раздел" });
  await user.type(within(createDialog).getByLabelText("Название раздела"), name);
  await user.click(within(createDialog).getByRole("button", { name: "Добавить раздел" }));
  const sectionTree = await openSectionTreeSearch(user);
  await user.click(within(sectionTree as HTMLElement).getByText(name, { exact: true }));
  return sectionTree as HTMLElement;
}

async function chooseCatalogTableFilter(user: ReturnType<typeof userEvent.setup>, label: string) {
  await user.click(screen.getByRole("button", { name: /Фильтр таблицы:/ }));
  const filterMenu = screen.getByRole("menu");
  const groupLabel = ["Без фото и видео", "Без описания", "Без рекомендаций"].includes(label)
    ? "Не заполнено"
    : ["С рекомендациями", "С тегами", "Со скидкой", "Со стикером"].includes(label)
      ? "Содержит"
      : "Вид";
  await user.click(within(filterMenu).getByRole("menuitem", { name: groupLabel }));
  const submenu = screen.getAllByRole("menu").find((menu) => within(menu).queryByRole("menuitem", { name: new RegExp(label) }));
  expect(submenu).toBeDefined();
  await user.click(within(submenu as HTMLElement).getByRole("menuitem", { name: new RegExp(label) }));
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
    expect(screen.getByText("В разделе пока ничего нет", { exact: true })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Вернуться к разделам" })).not.toBeInTheDocument();

    const emptyScaffold = document.querySelector<HTMLElement>("[data-empty-section-scaffold]");
    expect(emptyScaffold?.previousElementSibling).toHaveAttribute("data-catalog-section-table-gap");
    expect(emptyScaffold?.parentElement?.querySelector(":scope > [data-catalog-table-toolbar]")).toBeNull();
    const emptyRows = [...document.querySelectorAll<HTMLElement>("[data-empty-section-row], [data-empty-section-scaffold] > [data-catalog-structure-create-row]")];
    expect(emptyRows).toHaveLength(3);
    expect(emptyRows[0]).toHaveClass("h-[34px]");
    expect(emptyRows[1]).toHaveClass("h-[38px]");
    expect(emptyRows[2]).toHaveClass("h-[38px]");
    expect([...emptyScaffold!.querySelectorAll<HTMLElement>("[data-catalog-utility-cell]")].every((cell) => cell.style.width === "60px")).toBe(true);

    const emptyCreateButton = document.querySelector("[data-empty-position-create]");
    expect(emptyCreateButton).not.toBeNull();
    expect(emptyCreateButton).toHaveTextContent("Добавить позицию");
    expect(emptyCreateButton?.parentElement?.querySelector("svg")).not.toBeNull();
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
    expect(screen.getByRole("button", { name: "Новый подраздел" })).toBeInTheDocument();
    expect(document.querySelector("[data-catalog-table-header]")).toHaveTextContent("Название");
    const subsectionSearch = screen.getByRole("textbox", { name: "Найти подраздел" });
    expect(subsectionSearch).not.toHaveFocus();
    await user.click(subsectionSearch);
    await user.type(subsectionSearch, "Зав");
    await user.click(screen.getByRole("button", { name: "Очистить найти подраздел" }));
    expect(subsectionSearch).toHaveValue("");
    expect(subsectionSearch).toHaveFocus();

    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    expect(screen.getByRole("button", { name: "Действия с разделом «Завтраки»" })).toBeInTheDocument();

    await user.click(catalogRoot as HTMLElement);
    expect(screen.getByPlaceholderText("Поиск по названию")).toBeInTheDocument();
  });

  it("matches the filled subsection table and keeps trailing scroll space after the add row", async () => {
    const user = userEvent.setup();
    renderCatalog();
    await openKitchenSubsectionTable(user);

    const header = document.querySelector("[data-catalog-table-header]");
    expect(header).toHaveTextContent("Название подраздела");
    expect(header?.firstElementChild).toHaveClass("h-[34px]");
    expect((header?.firstElementChild?.firstElementChild as HTMLElement | null)?.style.width).toBe("60px");

    const rows = [...document.querySelectorAll<HTMLElement>("[data-subsection-row]")];
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.classList.contains("h-[38px]"))).toBe(true);
    expect(rows[0]).toHaveTextContent(/\d+ позиц/);
    expect(rows[0].querySelector(".h-7.w-7")).not.toBeNull();

    const addRow = document.querySelector<HTMLElement>("[data-catalog-structure-create-row]");
    expect(addRow).toHaveTextContent("Добавить подраздел...");
    expect(addRow).toHaveClass("h-[36px]");
    expect(addRow?.querySelector<HTMLElement>("[data-catalog-utility-cell]")?.style.width).toBe("60px");
    expect(addRow?.nextElementSibling).toHaveAttribute("data-catalog-table-trailing-space");
    expect(addRow?.parentElement?.lastElementChild).toBe(addRow?.nextElementSibling);
  });

  it("creates and cancels subsections through the shared inline row", async () => {
    const user = userEvent.setup();
    renderCatalog();
    const sectionTree = await openKitchenSubsectionTable(user);

    await user.click(screen.getByRole("button", { name: "Добавить подраздел..." }));
    let input = screen.getByPlaceholderText("Название подраздела...");
    let commit = screen.getByRole("button", { name: "Создать подраздел" });
    expect(input).toHaveFocus();
    expect(commit).toBeDisabled();
    fireEvent.blur(input);
    expect(screen.getByPlaceholderText("Название подраздела...")).toBeInTheDocument();

    await user.type(input, "Черновик");
    expect(commit).toBeEnabled();
    await user.keyboard("{Escape}");
    expect(screen.queryByPlaceholderText("Название подраздела...")).not.toBeInTheDocument();
    expect(screen.queryByText("Черновик", { exact: true })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Новый подраздел" }));
    input = screen.getByPlaceholderText("Название подраздела...");
    expect(input).toHaveFocus();
    await user.type(input, "Сезонное меню");
    await user.keyboard("{Enter}");

    await waitFor(() => expect(document.querySelectorAll("[data-subsection-row]").length).toBeGreaterThan(4));
    expect(within(sectionTree).getByText("Сезонное меню", { exact: true })).toBeInTheDocument();
    let rows = [...document.querySelectorAll<HTMLElement>("[data-subsection-row]")];
    expect(rows.at(-1)).toHaveTextContent("Сезонное меню");
    let addRow = document.querySelector<HTMLElement>("[data-catalog-structure-create-row]");
    expect(addRow?.nextElementSibling).toHaveAttribute("data-catalog-table-trailing-space");
    expect(addRow?.parentElement?.lastElementChild).toBe(addRow?.nextElementSibling);

    await user.click(screen.getByRole("button", { name: "Добавить подраздел..." }));
    input = screen.getByPlaceholderText("Название подраздела...");
    await user.type(input, "Летнее меню");
    await user.click(screen.getByRole("button", { name: "Создать подраздел" }));
    expect(await screen.findAllByText("Летнее меню", { exact: true })).not.toHaveLength(0);

    await user.click(screen.getByRole("button", { name: "Добавить подраздел..." }));
    input = screen.getByPlaceholderText("Название подраздела...");
    await user.type(input, "Завтраки");
    await user.click(screen.getByRole("button", { name: "Создать подраздел" }));
    expect(input).toHaveValue("Завтраки");
    expect(input).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByText("Раздел с таким названием уже существует здесь.", { exact: true })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Отменить создание" }));
    expect(screen.queryByPlaceholderText("Название подраздела...")).not.toBeInTheDocument();

    rows = [...document.querySelectorAll<HTMLElement>("[data-subsection-row]")];
    addRow = document.querySelector<HTMLElement>("[data-catalog-structure-create-row]");
    expect(addRow?.nextElementSibling).toHaveAttribute("data-catalog-table-trailing-space");
    expect(addRow?.parentElement?.lastElementChild).toBe(addRow?.nextElementSibling);
    expect(rows.filter((row) => row.textContent?.includes("Завтраки"))).toHaveLength(1);
  });

  it("keeps the empty-section rows stable while editing and drops the draft on navigation", async () => {
    const user = userEvent.setup();
    const sectionTree = await createAndOpenEmptySection(user);

    expect(screen.getByText("В разделе пока ничего нет", { exact: true })).toBeInTheDocument();
    expect(document.querySelector("[data-empty-position-create]")).toHaveTextContent("Добавить позицию");
    expect(screen.getByRole("button", { name: "Новый подраздел" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Добавить подраздел" }));
    const input = screen.getByPlaceholderText("Название подраздела...");
    expect(input).toHaveFocus();
    expect(screen.getByText("В разделе пока ничего нет", { exact: true })).toBeInTheDocument();
    expect(document.querySelector("[data-empty-position-create]")).toHaveTextContent("Добавить позицию");
    await user.type(input, "Не сохранять");
    fireEvent.blur(input);
    expect(input).toHaveValue("Не сохранять");

    await user.click(document.querySelector("[data-catalog-tree-root]") as HTMLElement);
    expect(screen.queryByPlaceholderText("Название подраздела...")).not.toBeInTheDocument();
    expect(within(sectionTree).queryByText("Не сохранять", { exact: true })).not.toBeInTheDocument();
  });

  it("keeps a truly empty section compact when a previous section left a search query", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    await user.type(screen.getByPlaceholderText("Поиск по названию"), "несуществующая позиция");
    await user.click(within(sectionTree as HTMLElement).getByText("Повреждение имущества", { exact: true }));

    expect(document.querySelector("[data-empty-section-scaffold]")).not.toBeNull();
    expect(document.querySelector("[data-catalog-table-toolbar]")).toBeNull();
    expect(screen.getByText("В разделе пока ничего нет", { exact: true })).toBeInTheDocument();
  });

  it("opens position creation in a side peek from a leaf section", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    await user.click(document.querySelector("[data-catalog-position-create-row]") as HTMLElement);
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
    await user.click(screen.getByRole("button", { name: "Очистить найти позицию" }));
    expect(search).toHaveValue("");
    expect(search).toHaveFocus();

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
    expect(within(columnMenu).getByRole("button", { name: /Показать колонку «Описание»/ })).toBeInTheDocument();
    await user.keyboard("{Escape}");

    const rowCheckbox = screen.getByRole("checkbox", { name: `Выбрать ${firstItemTitle}` });
    await user.click(rowCheckbox);
    expect(document.querySelector("[data-catalog-selection-toolbar]")).toHaveTextContent("1 выбрано");
    expect(document.querySelector("[data-catalog-table-header]")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Переместить" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Доступность" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Ещё действия" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Фильтр таблицы:/ }));
    const contentMenu = screen.getByRole("menu");
    expect(within(contentMenu).getByRole("menuitem", { name: /В каталоге/ })).toBeInTheDocument();
    expect(within(contentMenu).getByRole("menuitem", { name: /В архиве/ })).toBeInTheDocument();
    expect(within(contentMenu).getByRole("menuitem", { name: /На стопе/ })).toBeInTheDocument();
    expect(within(contentMenu).getByRole("menuitem", { name: /По расписанию/ })).toBeInTheDocument();
    expect(within(contentMenu).queryByRole("menuitem", { name: "Статус" })).not.toBeInTheDocument();
    expect(within(contentMenu).queryByRole("menuitem", { name: "Доступность" })).not.toBeInTheDocument();
    expect(within(contentMenu).queryByRole("menuitem", { name: "Наполнение" })).not.toBeInTheDocument();
    const archivedHoverItem = within(contentMenu).getByRole("menuitem", { name: /В архиве/ });
    await user.hover(archivedHoverItem);
    expect(archivedHoverItem).toHaveAttribute("data-highlighted");
    expect(archivedHoverItem.querySelector("[data-catalog-filter-count]")).toHaveClass("group-data-[highlighted]:hidden");
    expect(archivedHoverItem.querySelector("[data-catalog-filter-hover-check]")).toHaveClass("group-data-[highlighted]:block", "opacity-30");
    const missingGroup = within(contentMenu).getByRole("menuitem", { name: "Не заполнено" });
    await user.hover(missingGroup);
    expect(missingGroup).toHaveAttribute("data-highlighted");
    await user.click(missingGroup);
    const contentSubmenu = screen.getAllByRole("menu").find((menu) => within(menu).queryByRole("menuitem", { name: /Без описания/ }));
    expect(contentSubmenu).toBeDefined();
    ["Без описания", "Без фото и видео", "Без рекомендаций"].forEach((label) => {
      expect(within(contentSubmenu as HTMLElement).getByRole("menuitem", { name: new RegExp(label) })).toBeInTheDocument();
    });
    const withoutDescription = within(contentSubmenu as HTMLElement).getByRole("menuitem", { name: /Без описания/ });
    await user.click(withoutDescription);
    const filterTrigger = screen.getByRole("button", { name: /Фильтр таблицы:/ });
    expect(filterTrigger).toHaveTextContent("Без описания");
    expect(filterTrigger).not.toHaveTextContent("Все");

    await user.click(filterTrigger);
    const selectedMissingGroup = within(screen.getByRole("menu")).getByRole("menuitem", { name: "Без описания" });
    expect(selectedMissingGroup).toHaveAttribute("data-catalog-filter-group-selected", "true");
    expect(selectedMissingGroup).toHaveClass("!bg-[#eef2ff]");
    expect(document.querySelector("[data-catalog-active-filter-dot]")).not.toBeInTheDocument();
    await user.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: /В архиве/ }));
    expect(filterTrigger).toHaveTextContent("В архиве");

    await user.click(filterTrigger);
    const openFilterMenu = screen.getByRole("menu");
    expect(within(openFilterMenu).getByRole("menuitem", { name: "В архиве" })).toHaveAttribute("aria-current", "true");
    expect(within(openFilterMenu).getByRole("menuitem", { name: "Не заполнено" })).not.toHaveAttribute("data-catalog-filter-group-selected");
    await user.click(within(openFilterMenu).getByRole("menuitem", { name: /Все позиции/ }));
    expect(filterTrigger).toHaveTextContent("Все");
  });

  it("matches the idle and focused table search header states", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const search = screen.getByRole("textbox", { name: "Найти позицию" });
    const control = document.querySelector("[data-catalog-table-search-control]");
    expect(control).toHaveClass("border-transparent");
    expect(control?.querySelector("[data-catalog-table-search-divider]")).not.toBeInTheDocument();
    expect(search).toHaveAttribute("placeholder", "Поиск по названию");

    await user.click(search);
    expect(control).toHaveClass("border-[#4f39f6]");
    expect(control?.querySelector("[data-catalog-table-search-divider]")).toBeInTheDocument();
    expect(search).toHaveAttribute("placeholder", "");

    await user.type(search, "Омлет");
    await user.click(screen.getByText("Название", { exact: true }));
    expect(search).toHaveValue("Омлет");
    expect(control).toHaveClass("border-transparent");
  });

  it("shows the universal filtered empty state for search-only results", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Позиция которой точно нет");

    const emptyState = document.querySelector("[data-catalog-filtered-empty-state]");
    expect(emptyState).toBeInTheDocument();
    expect(emptyState).toHaveTextContent("Ничего не найдено");
    expect(emptyState).toHaveTextContent("Попробуйте изменить запрос или настройки фильтров");
    expect(emptyState).toHaveTextContent("Сбросить всё");
    expect(document.querySelector("[data-catalog-table-header]")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-catalog-table-row]")).toHaveLength(0);

    const icon = document.querySelector("[data-catalog-filtered-empty-icon]");
    expect(icon).toHaveAttribute("width", "45");
    expect(icon).toHaveAttribute("height", "45");
    expect(decodeURIComponent(icon?.getAttribute("src") ?? "")).toContain("<linearGradient");
  });

  it("shows the same empty state for a zero-result filter and resets filter plus search", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));
    await chooseCatalogTableFilter(user, "Со скидкой");

    expect(document.querySelector("[data-catalog-filtered-empty-state]")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-catalog-table-row]")).toHaveLength(0);

    const search = screen.getByPlaceholderText("Поиск по названию");
    await user.type(search, "Позиция которой точно нет");
    expect(document.querySelector("[data-catalog-filtered-empty-state]")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Сбросить всё" }));

    expect(search).toHaveValue("");
    expect(screen.getByRole("button", { name: /Фильтр таблицы:/ })).toHaveTextContent("Все");
    expect(document.querySelector("[data-catalog-filtered-empty-state]")).not.toBeInTheDocument();
    expect(document.querySelectorAll("[data-catalog-table-row]")).not.toHaveLength(0);
  });

  it("opens bulk availability directly and keeps secondary actions under more", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /Выбрать (?!все)/ });
    await user.click(rowCheckboxes[0]);
    await user.click(screen.getByRole("button", { name: "Доступность" }));

    expect(screen.getByRole("menuitemradio", { name: "Доступно" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "На стопе" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Архивировать" })).not.toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Удалить" })).not.toBeInTheDocument();

    const bulkStop = screen.getByRole("menuitemradio", { name: "На стопе" });
    await user.hover(bulkStop);
    expect(document.querySelector("[data-catalog-stop-popover]")).not.toBeInTheDocument();
    await user.click(bulkStop);
    expect(bulkStop).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("menuitem", { name: "Поставить на стоп" })).not.toBeInTheDocument();
    await waitFor(() => expect(document.querySelector("[data-catalog-stop-popover]")).toBeInTheDocument());
    expect(screen.getByRole("menuitemradio", { name: "Скрывать из меню" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Как «скоро будет»" })).toBeInTheDocument();
    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    await waitFor(() => expect(document.querySelector("[data-catalog-stop-popover]")).not.toBeInTheDocument());
    expect(document.querySelector("[data-catalog-selection-toolbar]")).toHaveTextContent("1 выбрано");

    await user.click(screen.getByRole("button", { name: "Ещё действия" }));
    const moreMenu = screen.getByRole("menu");
    const setDiscountItem = within(moreMenu).getByRole("menuitem", { name: "Задать скидку" });
    expect(setDiscountItem.querySelector("svg")).toHaveAttribute("width", "16");
    expect(within(moreMenu).queryByText("Скидка", { exact: true })).not.toBeInTheDocument();
    expect(within(moreMenu).queryByRole("menuitem", { name: "Убрать скидку" })).not.toBeInTheDocument();
    expect(within(moreMenu).getByRole("menuitem", { name: "Архивировать" }).querySelector("svg")).toHaveAttribute("width", "16");
    expect(within(moreMenu).getByRole("menuitem", { name: "Удалить" }).querySelector("svg")).toHaveAttribute("width", "16");

    await user.click(setDiscountItem);
    expect(screen.queryByRole("menuitem", { name: "Задать скидку" })).not.toBeInTheDocument();
    await waitFor(() => expect(document.querySelector("[data-catalog-discount-popover]")).toBeInTheDocument());
    expect(document.querySelector("[data-catalog-bulk-modal]")).not.toBeInTheDocument();
    const discountInput = await screen.findByDisplayValue("10");
    await user.clear(discountInput);
    await user.type(discountInput, "0");
    await user.click(screen.getByRole("button", { name: "Применить" }));
    expect(screen.getByText("Скидка убрана", { exact: true })).toBeInTheDocument();
    expect(document.querySelector("[data-catalog-selection-toolbar]")).not.toBeInTheDocument();
  });

  it("leaves all bulk availability statuses unselected for mixed positions", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByRole("checkbox", { name: `Выбрать ${firstItemTitle}` }));
    await user.click(screen.getByRole("checkbox", { name: "Выбрать Омлет с сыром" }));
    await user.click(screen.getByRole("button", { name: "Доступность" }));

    expect(screen.queryByText("Смешанное состояние", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Доступно" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitemradio", { name: "На стопе" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "false");
  });

  it("opens the shared cascade schedule editor for a bulk selection", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const rowCheckboxes = screen.getAllByRole("checkbox", { name: /Выбрать (?!все)/ });
    await user.click(rowCheckboxes[0]);
    await user.click(screen.getByRole("button", { name: "Доступность" }));
    await user.click(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    const schedulePopover = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    expect(schedulePopover).toBeInTheDocument();
    expect(within(schedulePopover).getByText("Вне расписания", { exact: true })).toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Отмена" })).not.toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();

    await user.click(within(schedulePopover).getByRole("button", { name: "Режим вне расписания" }));
    await user.click(screen.getByRole("menuitemradio", { name: /^Показывать как «скоро будет»$/ }));
    expect(within(schedulePopover).getByText("Как «скоро будет»", { exact: true })).toBeInTheDocument();

    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    expect(document.querySelector("[data-catalog-schedule-popover]")).toBeInTheDocument();
    expect(screen.getByText("Расписание применено к выбранным позициям", { exact: true })).toBeInTheDocument();

    await user.click(within(schedulePopover).getByRole("button", { name: "Закрыть расписание" }));
    await waitFor(() => expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument());
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toBeInTheDocument();
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
    expect(breakfastCheckbox.closest("[role=button]")).toHaveClass("bg-[#f1f4ff]");
    expect(document.querySelector("[data-catalog-table-header]")).not.toBeInTheDocument();
    expect(document.querySelector("[data-subsection-bulk-toolbar]")).toHaveTextContent("1 выбрано");

    const bakeryCheckbox = screen.getByRole("checkbox", { name: "Выбрать подраздел Выпечка" });
    await user.click(bakeryCheckbox);
    expect(document.querySelector("[data-subsection-bulk-toolbar]")).toHaveTextContent("2 выбрано");

    const selectAll = screen.getByRole("checkbox", { name: "Выбрать все подразделы" });
    await user.click(selectAll);
    screen.getAllByRole("checkbox", { name: /Выбрать подраздел / }).forEach((checkbox) => expect(checkbox).toBeChecked());
    await user.click(selectAll);
    expect(breakfastCheckbox).not.toBeChecked();
    expect(bakeryCheckbox).not.toBeChecked();
    expect(document.querySelector("[data-catalog-table-header]")).toBeInTheDocument();
  });

  it("keeps the leaf table header sticky and rows reorderable", async () => {
    const user = userEvent.setup();
    renderCatalog();

    const sectionTree = await openSectionTreeSearch(user);
    expect(sectionTree).not.toBeNull();
    await user.click(within(sectionTree as HTMLElement).getByText("Завтраки", { exact: true }));

    const card = document.querySelector("[data-catalog-items-card]");
    expect(card).not.toBeNull();
    expect(card).toHaveClass("-mx-6", "w-[calc(100%+3rem)]", "flex-1", "bg-[#f7f7f7]");
    expect(document.querySelector("[data-catalog-results-scroll]")).not.toHaveClass("pb-10");
    const localHeader = document.querySelector("[data-catalog-local-header]");
    expect(localHeader).toBeNull();
    const toolbar = document.querySelector("[data-catalog-table-toolbar]");
    expect(toolbar).not.toBeNull();
    expect(toolbar).toHaveClass("sticky", "top-0", "bg-white");
    expect(within(toolbar as HTMLElement).getByText("Все", { exact: true })).toBeInTheDocument();
    expect(within(toolbar as HTMLElement).getByPlaceholderText("Поиск по названию")).toBeInTheDocument();
    const tableHeader = document.querySelector("[data-catalog-table-header]");
    expect(tableHeader).toHaveClass("sticky", "top-[38px]", "bg-[#fafaf9]");
    expect(within(tableHeader as HTMLElement).getByText("Название", { exact: true })).toBeInTheDocument();
    expect((tableHeader?.firstElementChild?.firstElementChild?.firstElementChild as HTMLElement | null)?.style.width).toBe("60px");
    expect(within(tableHeader as HTMLElement).queryByPlaceholderText("Поиск по названию")).not.toBeInTheDocument();
    const tableBody = document.querySelector("[data-catalog-table-body]");
    expect(tableBody).not.toBeNull();
    expect(tableBody).toHaveClass("w-full", "bg-[#f5f5f4]");
    expect(document.querySelector("[data-catalog-table-header] [data-catalog-table-actions]")).toHaveClass("sticky", "right-0");
    expect(document.querySelector("[data-catalog-table-row] [data-catalog-table-actions]")).toHaveClass("sticky", "right-0");
    const positionCreateRow = document.querySelector<HTMLElement>("[data-catalog-position-create-row]");
    expect(positionCreateRow).toHaveTextContent("Добавить позицию");
    expect(positionCreateRow).toHaveClass("h-[36px]");
    expect((positionCreateRow?.firstElementChild as HTMLElement | null)?.style.width).toBe("60px");
    expect(positionCreateRow?.querySelector('[data-catalog-table-content-cell="position"]')).toHaveClass("pl-[8px]");
    expect(positionCreateRow?.querySelector('[data-catalog-table-actions]')).toBeEmptyDOMElement();
    expect(positionCreateRow?.nextElementSibling).toHaveAttribute("data-catalog-table-trailing-space");
    expect(positionCreateRow?.nextElementSibling).toHaveClass("bg-[#f5f5f4]");

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

  it("pins the cascade schedule editor until an explicit mode change", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    const sidePeek = getPositionSidePeek(firstItemTitle);
    await user.click(within(sidePeek).getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` }));
    await user.hover(screen.getByRole("menuitem", { name: "Доступно" }));
    expect(screen.getByRole("menuitem", { name: "Переименовать" })).toBeInTheDocument();
    const scheduleMode = screen.getByRole("menuitemradio", { name: "По расписанию" });
    await user.hover(scheduleMode);
    expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Доступно" })).toHaveAttribute("aria-checked", "true");

    await user.click(scheduleMode);
    const schedulePopover = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    expect(schedulePopover).toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("menuitem", { name: "Включить расписание" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitem", { name: "По расписанию" })).toBeInTheDocument();

    const neutralSurface = document.querySelector('input[placeholder="Поиск по названию"]') as HTMLElement;
    fireEvent.pointerDown(neutralSurface);
    fireEvent.click(neutralSurface);
    expect(document.querySelector("[data-catalog-schedule-popover]")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Переименовать" })).toBeInTheDocument();

    await user.hover(screen.getByRole("menuitemradio", { name: "Доступно" }));
    await user.hover(screen.getByRole("menuitemradio", { name: "На стопе" }));
    expect(document.querySelector("[data-catalog-schedule-popover]")).toBeInTheDocument();
    expect(screen.queryByText("Отображение в меню", { exact: true })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("menuitemradio", { name: "Доступно" }));
    await waitFor(() => expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument());
    expect(screen.getByRole("menuitem", { name: "Доступно" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Доступно" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitem", { name: "Переименовать" })).toBeInTheDocument();
  });

  it("autosaves cascade schedule changes and closes from its explicit x", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    const actions = () => within(getPositionSidePeek(firstItemTitle)).getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` });

    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступно" }));
    await user.click(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    const schedulePopover = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    expect(within(schedulePopover).queryByRole("menuitem", { name: "Включить расписание" })).not.toBeInTheDocument();
    await user.click(within(schedulePopover).getByRole("button", { name: "Режим вне расписания" }));
    await user.click(screen.getByRole("menuitemradio", { name: /^Показывать как «скоро будет»$/ }));

    expect(within(schedulePopover).getByText("Как «скоро будет»", { exact: true })).toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Отмена" })).not.toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Сохранить" })).not.toBeInTheDocument();
    expect(within(schedulePopover).getByText("Расписание доступности", { exact: true })).toBeInTheDocument();
    expect(within(schedulePopover).getByRole("button", { name: "Закрыть расписание" })).toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Убрать расписание" })).not.toBeInTheDocument();

    await user.click(within(schedulePopover).getByRole("button", { name: "Закрыть расписание" }));
    await waitFor(() => expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument());
    expect(screen.getByRole("menuitem", { name: "По расписанию" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "true");

    await user.click(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    expect(document.querySelector("[data-catalog-schedule-popover]")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument());
    expect(screen.getByRole("menuitem", { name: "По расписанию" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "true");
  });

  it("applies stop on click and opens stop display settings", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    const actions = () => within(getPositionSidePeek(firstItemTitle)).getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` });

    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступно" }));
    expect(screen.getByRole("menuitemradio", { name: "Доступно" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "На стопе" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "false");

    const stop = screen.getByRole("menuitemradio", { name: "На стопе" });
    await user.hover(stop);
    expect(document.querySelector("[data-catalog-stop-popover]")).not.toBeInTheDocument();
    expect(stop).toHaveAttribute("aria-checked", "false");

    await user.click(stop);
    expect(stop).toHaveAttribute("aria-checked", "true");
    expect(document.querySelector("[data-catalog-stop-popover]")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Поставить на стоп" })).not.toBeInTheDocument();
    expect(screen.getByText("Отображение в меню", { exact: true })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Скрывать из меню" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitem", { name: "Переименовать" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemradio", { name: "Как «скоро будет»" }));
    expect(screen.getByRole("menuitemradio", { name: "Как «скоро будет»" })).toHaveAttribute("aria-checked", "true");
    expect(document.querySelector("[data-position-availability-status]")).toHaveTextContent("Скоро будет");

    fireEvent.pointerDown(document.body);
    fireEvent.click(document.body);
    await waitFor(() => expect(document.querySelector("[data-catalog-stop-popover]")).not.toBeInTheDocument());
    expect(document.querySelector("[data-position-availability-status]")).toHaveTextContent("Скоро будет");
  });

  it("opens the existing schedule editor as the third cascade level", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    await user.click(within(getPositionSidePeek(firstItemTitle)).getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` }));
    await user.click(screen.getByRole("menuitem", { name: "Доступно" }));

    await user.hover(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument();

    await user.click(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    const schedulePopover = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    expect(schedulePopover).toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("menuitem", { name: "Включить расписание" })).not.toBeInTheDocument();
    expect(within(schedulePopover).getByText("Вне расписания", { exact: true })).toBeInTheDocument();
    expect(within(schedulePopover).getByText("Скрывать", { exact: true })).toBeInTheDocument();
    expect(schedulePopover.querySelector("[data-weekly-schedule-id]")).not.toHaveAttribute("aria-disabled", "true");
    expect(screen.queryByRole("button", { name: "Назад к Доступности" })).not.toBeInTheDocument();
    expect(within(schedulePopover).getByText("Расписание доступности", { exact: true })).toBeInTheDocument();
    expect(within(schedulePopover).getByRole("button", { name: "Закрыть расписание" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitem", { name: "По расписанию" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Переименовать" })).toBeInTheDocument();
  });

  it("switches availability modes from the cascade level", async () => {
    const user = userEvent.setup();
    renderCatalog();

    await user.type(screen.getByPlaceholderText("Поиск по названию"), "Омлет");
    await user.click(screen.getByText(firstItemTitle, { exact: true }));
    const actions = () => within(getPositionSidePeek(firstItemTitle)).getByRole("button", { name: `Действия с позицией «${firstItemTitle}»` });

    await user.click(actions());
    await user.click(screen.getByRole("menuitem", { name: "Доступно" }));
    const stop = screen.getByRole("menuitemradio", { name: "На стопе" });
    await user.hover(stop);
    expect(document.querySelector("[data-catalog-stop-popover]")).not.toBeInTheDocument();
    await user.click(stop);
    await waitFor(() => expect(document.querySelector("[data-catalog-stop-popover]")).toBeInTheDocument());
    expect(stop).toHaveAttribute("aria-checked", "true");
    expect(screen.queryByRole("menuitem", { name: "Поставить на стоп" })).not.toBeInTheDocument();

    await user.hover(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "На стопе" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "false");
    expect(screen.getByRole("menuitem", { name: "На стопе" })).toBeInTheDocument();

    await user.click(screen.getByRole("menuitemradio", { name: "По расписанию" }));
    const schedulePopover = document.querySelector("[data-catalog-schedule-popover]") as HTMLElement;
    expect(schedulePopover).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("menuitem", { name: "По расписанию" })).toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("menuitem", { name: "Включить расписание" })).not.toBeInTheDocument();
    expect(within(schedulePopover).queryByRole("button", { name: "Убрать расписание" })).not.toBeInTheDocument();

    await user.click(within(schedulePopover).getByRole("button", { name: "Закрыть расписание" }));
    await waitFor(() => expect(document.querySelector("[data-catalog-schedule-popover]")).not.toBeInTheDocument());
    await user.click(screen.getByRole("menuitemradio", { name: "Доступно" }));
    expect(document.querySelector("[data-position-editor-surface]")).toBeInTheDocument();
    expect(document.querySelector("[data-position-availability-status]")).toHaveTextContent("Доступно");
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
    ["Основное", "Доступность", "Допродажа", "Опции", "Вид"].forEach((label) => {
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
    expect(within(tableMenu).getByRole("menuitem", { name: "Доступно" })).toBeInTheDocument();
    expect(within(tableMenu).queryByRole("menuitem", { name: "Поставить на стоп" })).not.toBeInTheDocument();
    expect(within(tableMenu).queryByRole("menuitem", { name: "Добавить расписание" })).not.toBeInTheDocument();
    expect(within(tableMenu).queryByRole("menuitem", { name: "Когда недоступно" })).not.toBeInTheDocument();
    await user.click(within(tableMenu).getByRole("menuitem", { name: "Доступно" }));
    expect(screen.getByRole("menuitemradio", { name: "Доступно" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "На стопе" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "По расписанию" })).toBeInTheDocument();
    expect(screen.queryByRole("menuitemradio", { name: "Скрывать из меню" })).not.toBeInTheDocument();
    const stop = screen.getByRole("menuitemradio", { name: "На стопе" });
    await user.hover(stop);
    expect(document.querySelector("[data-catalog-stop-popover]")).not.toBeInTheDocument();
    await user.click(stop);
    expect(stop).toHaveAttribute("aria-checked", "true");
    expect(document.querySelector("[data-catalog-stop-popover]")).toBeInTheDocument();
    expect(screen.queryByRole("menuitem", { name: "Поставить на стоп" })).not.toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Скрывать из меню" })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: "Как «скоро будет»" })).toBeInTheDocument();
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
