import type { CatalogViewMode, OverviewFilterId } from "./types";

export type CatalogTableFilterGroupKey = "status" | "availability" | "content" | "view";

export const CATALOG_TABLE_FILTER_GROUPS: ReadonlyArray<{
  key: CatalogTableFilterGroupKey;
  label: string;
  ids: readonly OverviewFilterId[];
}> = [
  { key: "status", label: "Статус", ids: ["status:active", "status:archived"] },
  { key: "availability", label: "Доступность", ids: ["status:stop", "status:schedule"] },
  {
    key: "content",
    label: "Наполнение",
    ids: [
      "quick:no-photo",
      "quick:no-description",
      "quick:no-recommendations",
      "quick:with-recommendations",
      "quick:with-tags",
      "quick:discount",
      "quick:with-labels",
    ],
  },
  { key: "view", label: "Вид", ids: ["display:full", "display:no-price", "display:no-button", "display:no-price-only"] },
];

export const CATALOG_TABLE_FILTER_LABELS: Partial<Record<OverviewFilterId, string>> = {
  "quick:no-photo": "Без фото и видео",
  "quick:no-description": "Без описания",
  "quick:no-recommendations": "Без рекомендаций",
  "quick:with-recommendations": "С рекомендациями",
  "quick:with-tags": "С тегами",
  "quick:discount": "Со скидкой",
  "quick:with-labels": "Со стикером",
  "display:full": "Полный вид",
  "display:no-price": "Без кнопки и цены",
  "display:no-button": "Без кнопки",
  "display:no-price-only": "Без цены",
};

export function getCatalogTableFilterGroup(id: OverviewFilterId): CatalogTableFilterGroupKey | null {
  if (id === "status:soon") return "availability";
  if (["quick:no-weight", "quick:no-kbju", "quick:no-translation", "quick:with-options"].includes(id)) return "content";
  return CATALOG_TABLE_FILTER_GROUPS.find((group) => group.ids.includes(id))?.key ?? null;
}

export function updateCatalogTableFilterIds(
  current: OverviewFilterId[],
  id: OverviewFilterId,
  active = true,
): OverviewFilterId[] {
  if (id === "quick:all") return [];
  if (!active) return current.filter((currentId) => currentId !== id);

  const group = getCatalogTableFilterGroup(id);
  const withoutGroup = current.filter((currentId) => (
    group ? getCatalogTableFilterGroup(currentId) !== group : currentId !== id
  ));
  return [...withoutGroup, id];
}

export function normalizeCatalogTableFilterIds(ids: OverviewFilterId[]): OverviewFilterId[] {
  return ids.reduce<OverviewFilterId[]>((current, id) => updateCatalogTableFilterIds(current, id), []);
}

export const CATALOG_VIEW_MODE_GROUPS: { label: string; ids: CatalogViewMode[] }[] = [
  { label: "Вид", ids: ["sections"] },
  { label: "Статус", ids: ["status:active", "status:archived"] },
  { label: "Доступность", ids: ["status:stop", "status:soon", "status:schedule"] },
  { label: "Заполненность", ids: ["quick:no-description", "quick:no-photo", "quick:no-weight", "quick:no-kbju", "quick:no-translation"] },
  { label: "Возможности", ids: ["quick:no-recommendations", "quick:with-recommendations", "quick:discount", "quick:with-labels", "quick:with-tags"] },
  { label: "Отображение", ids: ["quick:with-options", "display:full", "display:no-button", "display:no-price"] },
];

export const HYBRID_PRIMARY_FILTER_IDS: OverviewFilterId[] = [
  "quick:all",
  "status:stop",
  "status:archived",
  "quick:no-description",
  "quick:no-photo",
  "quick:no-weight",
];

export const HYBRID_PRIMARY_FILTER_LABELS: Record<OverviewFilterId, string> = {
  "quick:all": "Все позиции",
  "status:stop": "На стопе",
  "status:archived": "В архиве",
  "quick:no-description": "Без описания",
  "quick:no-photo": "Без фото",
  "quick:no-weight": "Без веса",
  "quick:no-kbju": "Без КБЖУ",
  "quick:no-translation": "Без перевода",
  "quick:discount": "Со скидкой",
  "quick:with-tags": "С тегами",
  "quick:with-labels": "Со стикерами",
  "quick:with-options": "С опциями",
  "quick:with-recommendations": "С рекомендациями",
  "quick:no-recommendations": "Без рекомендаций",
  "display:full": "Полный вид",
  "display:no-button": "Без кнопки",
  "display:no-price-only": "Без цены",
  "display:no-price": "Без кнопки и цены",
  "status:active": "Активные",
  "status:soon": "Скоро будут",
  "status:schedule": "По расписанию",
};

const FILTER_PANEL_TITLES: Record<OverviewFilterId, string> = {
  "quick:all": "Все позиции",
  "quick:no-description": "Позиции без описания",
  "quick:no-photo": "Позиции без фото",
  "quick:no-weight": "Позиции без граммовки",
  "quick:no-kbju": "Позиции без КБЖУ",
  "quick:no-translation": "Позиции без перевода",
  "quick:discount": "Позиции со скидкой",
  "quick:with-options": "Позиции с опциями",
  "quick:with-labels": "Позиции со стикерами",
  "quick:with-tags": "Позиции с тегами",
  "quick:with-recommendations": "Позиции с рекомендациями",
  "quick:no-recommendations": "Позиции без рекомендаций",
  "display:full": "Позиции в полном виде",
  "display:no-button": "Позиции без кнопки",
  "display:no-price-only": "Позиции без цены",
  "display:no-price": "Позиции без кнопки и цены",
  "status:active": "Активные позиции",
  "status:archived": "Позиции в архиве",
  "status:stop": "Позиции на стопе",
  "status:soon": "Позиции скоро будут",
  "status:schedule": "Позиции по расписанию",
};

export function getFilterPanelTitle(filterId: OverviewFilterId) {
  return FILTER_PANEL_TITLES[filterId];
}
