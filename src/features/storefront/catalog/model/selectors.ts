import type { CatalogItem } from "@/data/catalog";
import type { OverviewFilterId } from "./types";
import type { CatalogPriceSortDirection } from "../navigation/types";

export const CATALOG_FILTER_PREDICATES: Record<OverviewFilterId, (item: CatalogItem) => boolean> = {
  "quick:all": () => true,
  "quick:no-description": (item) => !item.hasDescription,
  "quick:no-photo": (item) => !item.thumbnailUrl,
  "quick:no-weight": (item) => !item.weightLabel,
  "quick:no-kbju": (item) => item.nutritionFilledCount === 0,
  "quick:no-translation": (item) => item.translationFilledCount < item.translationTotalCount,
  "quick:discount": (item) => item.hasDiscount,
  "quick:with-tags": (item) => item.tags.length > 0,
  "quick:with-labels": (item) => item.guestLabels.length > 0,
  "quick:with-options": (item) => item.optionsCount > 0,
  "quick:with-recommendations": (item) => item.recommendationsCount > 0,
  "quick:no-recommendations": (item) => item.recommendationsCount === 0,
  "display:full": (item) => item.displayMode === "full",
  "display:no-button": (item) => item.displayMode === "no-button",
  "display:no-price": (item) => item.displayMode === "no-price",
  "status:active": (item) => item.status === "active",
  "status:archived": (item) => item.status === "archive",
  "status:stop": (item) => item.status === "stopped",
  "status:soon": (item) => item.status === "coming-soon",
  "status:schedule": (item) => item.scheduled,
};

export function getOverviewItems(filterId: OverviewFilterId, items: CatalogItem[]) {
  return items.filter(CATALOG_FILTER_PREDICATES[filterId]);
}

export function getCombinedOverviewItems(
  filterId: OverviewFilterId,
  items: CatalogItem[],
  mandatoryFilterId?: OverviewFilterId,
) {
  const mandatoryItems = mandatoryFilterId ? getOverviewItems(mandatoryFilterId, items) : items;
  return getOverviewItems(filterId, mandatoryItems);
}

export function countItemsByFilter(
  filterIds: OverviewFilterId[],
  items: CatalogItem[],
  scopeIds: Set<string> | null,
  mandatoryFilterId?: OverviewFilterId,
) {
  const counts = Object.fromEntries(filterIds.map((id) => [id, 0])) as Record<OverviewFilterId, number>;
  getCombinedOverviewItems("quick:all", items, mandatoryFilterId).forEach((item) => {
    if (scopeIds && !scopeIds.has(item.sectionId)) return;
    filterIds.forEach((id) => {
      if (CATALOG_FILTER_PREDICATES[id](item)) counts[id] += 1;
    });
  });
  return counts;
}

export function getSectionScopeIds(sectionId: string | null, sections: Array<{ id: string; parentId: string | null | undefined }>) {
  if (!sectionId) return null;
  const ids = new Set<string>([sectionId]);
  let added = true;
  while (added) {
    added = false;
    sections.forEach((section) => {
      if (!section.parentId || !ids.has(section.parentId) || ids.has(section.id)) return;
      ids.add(section.id);
      added = true;
    });
  }
  return ids;
}

export function getDisplayedPrice(item: CatalogItem) {
  if (item.price === 0 && item.priceWithSale == null) return null;
  return item.hasDiscount && item.priceWithSale != null ? item.priceWithSale : item.price;
}

export function sortItemsByPrice<T extends CatalogItem>(items: T[], direction: CatalogPriceSortDirection): T[] {
  if (direction === "none") return items;
  return items
    .map((item, index) => ({ item, index, price: getDisplayedPrice(item) }))
    .sort((left, right) => {
      if (left.price == null && right.price == null) return left.index - right.index;
      if (left.price == null) return 1;
      if (right.price == null) return -1;
      const diff = direction === "asc" ? left.price - right.price : right.price - left.price;
      return diff || left.index - right.index;
    })
    .map(({ item }) => item);
}
