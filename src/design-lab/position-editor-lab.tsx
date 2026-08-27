import { useMemo, useState } from "react";
import { CatalogWorkspace } from "@/features/storefront/catalog";
import type {
  CatalogCreateNavigationGuard,
  CatalogNavigationBoundary,
  CatalogReturnContext,
  CatalogTab,
  CatalogViewMode,
  OverviewFilterId,
} from "@/features/storefront/catalog";
import type { PositionEditorDesignFixture } from "./fixtures/position-editor";

export function PositionEditorDesignLab({ fixture }: { fixture: PositionEditorDesignFixture }) {
  const [positionId, setPositionId] = useState<string | null>(fixture.selectedItemId);
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("overview");
  const [viewMode, setViewMode] = useState<CatalogViewMode>("quick:all");
  const [sectionScopeId, setSectionScopeId] = useState<string | null>(null);
  const [stopListFilterId, setStopListFilterId] = useState<OverviewFilterId>("quick:all");
  const [stopListSectionScopeId, setStopListSectionScopeId] = useState<string | null>(null);

  const navigation = useMemo<CatalogNavigationBoundary>(() => ({
    route: {
      editorNav: "unified",
      sectionId: fixture.sections[0]?.id ?? null,
      positionId,
      highlightPositionId: null,
      createPosition: false,
      createHistoryEntry: false,
      returnContext: null,
      location: { url: window.location.href, state: window.history.state },
      revision: 0,
    },
    replaceSection: () => {},
    replacePosition: setPositionId,
    consumeHighlightPosition: () => {},
    prepareDirectCreate: (_sectionId: string | null, _returnContext: CatalogReturnContext) => {},
    replaceDirectCreateDestination: (_returnContext: CatalogReturnContext, _sectionId: string | null) => {},
    back: () => setPositionId(null),
  }), [fixture.sections, positionId]);

  return (
    <main
      aria-label={`Design Lab · Position Editor · ${fixture.scenario}`}
      data-design-lab-scenario={fixture.scenario}
      className="flex h-dvh w-dvw overflow-hidden"
    >
      <CatalogWorkspace
        navigation={navigation}
        selectedDishId=""
        catalogPhase="has-items"
        catalogTab={catalogTab}
        stopListActive={false}
        viewMode={viewMode}
        sectionScopeId={sectionScopeId}
        stopListFilterId={stopListFilterId}
        stopListSectionScopeId={stopListSectionScopeId}
        resetSignal={0}
        onOverviewFilterChange={setViewMode}
        onViewModeChange={setViewMode}
        onSectionScopeChange={setSectionScopeId}
        onStopListFilterChange={setStopListFilterId}
        onStopListSectionScopeChange={setStopListSectionScopeId}
        onOpenStopList={() => {}}
        onExitStopList={() => {}}
        onCatalogTabChange={setCatalogTab}
        onRegisterCreateNavigationGuard={(_guard: CatalogCreateNavigationGuard | null) => {}}
        onAdvancePhase={() => {}}
      />
    </main>
  );
}
