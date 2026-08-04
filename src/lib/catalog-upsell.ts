import type { CatalogItem } from "@/data/catalog";
import { catalogStorageKey } from "@/lib/catalog-preview";

export type CatalogLocalizedValue = {
  ru: string;
  kk?: string;
  en?: string;
  sr?: string;
};

export type CatalogItemUpsellState = {
  recommendationIds?: string[];
  sticker?: CatalogLocalizedValue | null;
  tags?: CatalogLocalizedValue[];
  keywords?: CatalogLocalizedValue[];
};

export type CatalogUpsellStateByItem = Record<string, CatalogItemUpsellState>;

export const CATALOG_UPSELL_STORAGE_KEY = catalogStorageKey("upsellByItem");
export const CATALOG_UPSELL_CHANGE_EVENT = "tasko:catalog-upsell-change";

export function readCatalogUpsellState(): CatalogUpsellStateByItem {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(CATALOG_UPSELL_STORAGE_KEY);
    return raw ? JSON.parse(raw) as CatalogUpsellStateByItem : {};
  } catch {
    return {};
  }
}

export function writeCatalogUpsellState(value: CatalogUpsellStateByItem) {
  window.localStorage.setItem(CATALOG_UPSELL_STORAGE_KEY, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent(CATALOG_UPSELL_CHANGE_EVENT, { detail: value }));
}

export function buildDefaultRecommendationIds(item: CatalogItem, items: CatalogItem[]) {
  if (item.recommendationsCount <= 0) return [];
  return items
    .filter((candidate) => candidate.id !== item.id && candidate.status !== "archive")
    .slice(0, item.recommendationsCount)
    .map((candidate) => candidate.id);
}

export function resolveRecommendationIds(
  item: CatalogItem,
  items: CatalogItem[],
  state?: CatalogItemUpsellState,
) {
  return state?.recommendationIds ?? buildDefaultRecommendationIds(item, items);
}
