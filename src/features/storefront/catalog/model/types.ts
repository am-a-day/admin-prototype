export type CatalogPhase = "empty" | "has-sections" | "has-items";

export type CatalogTab = "sections" | "overview" | "upsell";

export type CatalogPrimaryTab = "sections" | "overview" | "upsell" | "stop-list";

export type OverviewFilterId =
  | "quick:all"
  | "quick:no-description"
  | "quick:no-photo"
  | "quick:no-weight"
  | "quick:no-kbju"
  | "quick:no-translation"
  | "quick:discount"
  | "quick:with-tags"
  | "quick:with-labels"
  | "quick:with-options"
  | "quick:with-recommendations"
  | "quick:no-recommendations"
  | "display:full"
  | "display:no-button"
  | "display:no-price-only"
  | "display:no-price"
  | "status:active"
  | "status:archived"
  | "status:stop"
  | "status:soon"
  | "status:schedule";

export type CatalogViewMode = "sections" | OverviewFilterId;
