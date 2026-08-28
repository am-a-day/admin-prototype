import type { CatalogViewMode, OverviewFilterId } from "./types";

export type CatalogTableFilterGroupKey = "primary" | "missing" | "contains" | "view";

export const CATALOG_TABLE_FILTER_GROUPS: ReadonlyArray<{
  key: CatalogTableFilterGroupKey;
  label: string;
  ids: readonly OverviewFilterId[];
}> = [
  { key: "primary", label: "Позиции", ids: ["status:active", "status:archived", "status:stop", "status:schedule"] },
  {
    key: "missing",
    label: "Не заполнено",
    ids: ["quick:no-photo", "quick:no-translation", "quick:no-description", "quick:no-recommendations", "quick:no-kbju"],
  },
  { key: "contains", label: "Содержит", ids: ["quick:with-recommendations", "quick:with-tags", "quick:discount", "quick:with-labels"] },
  { key: "view", label: "Вид", ids: ["display:full", "display:no-price", "display:no-button", "display:no-price-only"] },
];

export const CATALOG_TABLE_FILTER_LABELS: Partial<Record<OverviewFilterId, string>> = {
  "availability:available": "Доступно",
  "status:active": "В каталоге",
  "status:archived": "В архиве",
  "status:stop": "На стопе",
  "status:schedule": "По расписанию",
  "quick:no-photo": "Без фото и видео",
  "quick:no-description": "Без описания",
  "quick:no-recommendations": "Без рекомендаций",
  "quick:no-kbju": "Без КБЖУ",
  "quick:no-translation": "Есть непереведённые",
  "quick:with-recommendations": "Рекомендации",
  "quick:with-tags": "Теги",
  "quick:discount": "Скидка",
  "quick:with-labels": "Стикеры",
  "display:full": "Полный вид",
  "display:no-price": "Кнопка и цена",
  "display:no-button": "Кнопка",
  "display:no-price-only": "Цена",
};

export function getCatalogTableFilterGroup(id: OverviewFilterId): CatalogTableFilterGroupKey | null {
  if (id === "status:soon" || id === "availability:available") return "primary";
  if (["quick:no-weight", "quick:no-kbju", "quick:no-translation"].includes(id)) return "missing";
  if (id === "quick:with-options") return "contains";
  return CATALOG_TABLE_FILTER_GROUPS.find((group) => group.ids.includes(id))?.key ?? null;
}

export function updateCatalogTableActiveFilter(
  current: OverviewFilterId | null,
  id: OverviewFilterId,
  active = true,
): OverviewFilterId | null {
  if (id === "quick:all") return null;
  if (!active) return current === id ? null : current;
  return id;
}

export function normalizeCatalogTableActiveFilter(ids: OverviewFilterId[]): OverviewFilterId | null {
  for (let index = ids.length - 1; index >= 0; index -= 1) {
    if (ids[index] !== "quick:all") return ids[index];
  }
  return null;
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
  "availability:available": "Доступно",
  "quick:all": "Все позиции",
  "status:stop": "На стопе",
  "status:archived": "В архиве",
  "quick:no-description": "Без описания",
  "quick:no-photo": "Без фото",
  "quick:no-weight": "Без веса",
  "quick:no-kbju": "Без КБЖУ",
  "quick:no-translation": "Есть непереведённые",
  "quick:discount": "Скидка",
  "quick:with-tags": "Теги",
  "quick:with-labels": "Стикеры",
  "quick:with-options": "С опциями",
  "quick:with-recommendations": "Рекомендации",
  "quick:no-recommendations": "Без рекомендаций",
  "display:full": "Полный вид",
  "display:no-button": "Кнопка",
  "display:no-price-only": "Цена",
  "display:no-price": "Кнопка и цена",
  "status:active": "Активные",
  "status:soon": "Скоро будут",
  "status:schedule": "По расписанию",
};

const FILTER_PANEL_TITLES: Record<OverviewFilterId, string> = {
  "availability:available": "Доступные позиции",
  "quick:all": "Все позиции",
  "quick:no-description": "Позиции без описания",
  "quick:no-photo": "Позиции без фото",
  "quick:no-weight": "Позиции без граммовки",
  "quick:no-kbju": "Позиции без КБЖУ",
  "quick:no-translation": "Позиции с непереведёнными полями",
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
