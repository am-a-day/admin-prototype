import { describe, expect, it } from "vitest";
import {
  CATALOG_TABLE_FILTER_GROUPS,
  CATALOG_TABLE_FILTER_LABELS,
  normalizeCatalogTableActiveFilter,
  updateCatalogTableActiveFilter,
} from "./filter-config";

describe("catalog table active filter", () => {
  it("matches the current primary and nested filter structure", () => {
    expect(CATALOG_TABLE_FILTER_GROUPS).toEqual([
      { key: "primary", label: "Позиции", ids: ["status:active", "status:archived", "status:stop", "status:schedule"] },
      { key: "missing", label: "Не заполнено", ids: ["quick:no-photo", "quick:no-translation", "quick:no-description", "quick:no-recommendations", "quick:no-kbju"] },
      { key: "contains", label: "Содержит", ids: ["quick:with-recommendations", "quick:with-tags", "quick:discount", "quick:with-labels"] },
      { key: "view", label: "Вид", ids: ["display:full", "display:no-price", "display:no-button", "display:no-price-only"] },
    ]);
  });

  it("replaces a selected value with one from another category", () => {
    expect(updateCatalogTableActiveFilter("quick:no-description", "status:archived")).toBe("status:archived");
  });

  it("uses concise nested filter labels", () => {
    expect(CATALOG_TABLE_FILTER_LABELS).toMatchObject({
      "quick:no-kbju": "Без КБЖУ",
      "quick:no-translation": "Есть непереведённые",
      "quick:with-recommendations": "Рекомендации",
      "quick:with-tags": "Теги",
      "quick:discount": "Скидка",
      "quick:with-labels": "Стикеры",
      "display:no-price": "Кнопка и цена",
      "display:no-button": "Кнопка",
      "display:no-price-only": "Цена",
    });
  });

  it("replaces a selected value inside the same category", () => {
    expect(updateCatalogTableActiveFilter("quick:no-photo", "quick:no-description")).toBe("quick:no-description");
  });

  it("clears the current value through all positions", () => {
    expect(updateCatalogTableActiveFilter("status:active", "quick:all")).toBeNull();
  });

  it("restores only the last value from legacy multi-filter state", () => {
    expect(normalizeCatalogTableActiveFilter([
      "status:active",
      "quick:no-photo",
      "status:archived",
      "display:full",
      "display:no-button",
    ])).toBe("display:no-button");
  });
});
