import type { OverviewFilterId } from "../model/types";

export type CatalogSectionEditorTab = "composition" | "basic" | "availability";

export type CatalogPriceSortDirection = "none" | "asc" | "desc";

export type CatalogReturnContext =
  | {
      tab: "sections";
      sectionId: string | null;
      sectionEditorTab?: CatalogSectionEditorTab;
      treeQuery?: string;
      treeExpanded?: Record<string, boolean>;
      treeScrollTop?: number;
      compositionQuery?: string;
      workspaceScrollTop?: number;
    }
  | {
      tab: "overview";
      filterId: OverviewFilterId;
      sectionScopeId: string | null;
      tableQuery: string;
      panelQuery: string;
      sort: CatalogPriceSortDirection;
      scrollTop: number;
    };

export type CatalogCreateNavigationGuard = {
  request: (continueNavigation: () => void) => void;
  requestBack: (continueNavigation: () => void) => void;
  location: { url: string; state: unknown };
};

export type CatalogBrowserRoute = {
  editorNav: string | null;
  sectionId: string | null;
  positionId: string | null;
  highlightPositionId: string | null;
  createPosition: boolean;
  createHistoryEntry: boolean;
  returnContext: CatalogReturnContext | null;
  location: { url: string; state: unknown };
  revision: number;
};

export type CatalogNavigationBoundary = {
  route: CatalogBrowserRoute;
  replaceSection: (sectionId: string) => void;
  replacePosition: (positionId: string) => void;
  consumeHighlightPosition: () => void;
  prepareDirectCreate: (sectionId: string | null, returnContext: CatalogReturnContext) => void;
  replaceDirectCreateDestination: (
    returnContext: CatalogReturnContext,
    sectionId: string | null,
  ) => void;
  back: () => void;
};
