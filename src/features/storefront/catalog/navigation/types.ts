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
