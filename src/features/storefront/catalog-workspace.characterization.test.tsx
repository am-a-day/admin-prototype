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

  return (
    <CatalogWorkspace
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

    await user.click(screen.getByRole("button", { name: "Сортировать по возрастанию" }));
    expect(screen.getByRole("button", { name: "Сортировать по убыванию" })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Настроить колонки" }));
    const columnMenu = screen.getByRole("menu");
    expect(within(columnMenu).getByText("Описание")).toBeInTheDocument();
    await user.click(within(columnMenu).getByText("Описание"));
    await user.keyboard("{Escape}");

    const rowCheckbox = screen.getAllByRole("checkbox", { name: /Выбрать / })[0];
    expect(rowCheckbox).toBeDefined();
    await user.click(rowCheckbox);
    expect(screen.getByText("1 выбрана", { exact: true })).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Заполненность/ }));
    await user.click(screen.getByRole("menuitemradio", { name: /Без описания/ }));
    expect(screen.getByRole("button", { name: /Без описания/ })).toBeInTheDocument();
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
