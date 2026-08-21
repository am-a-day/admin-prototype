import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/data/catalog";
import { CATALOG_TABLE_FILTER_GROUPS } from "./filter-config";
import { countItemsByFilter } from "./selectors";

function item(overrides: Partial<CatalogItem>): CatalogItem {
  return {
    id: "item",
    title: "Позиция",
    sectionId: "section",
    sectionName: "Раздел",
    thumbnailUrl: null,
    price: 100,
    priceWithSale: null,
    status: "active",
    scheduled: false,
    guestLabels: [],
    tags: [],
    optionsCount: 0,
    modifiersCount: 0,
    recommendationsCount: 0,
    displayMode: "full",
    description: "",
    hasDescription: false,
    weightLabel: null,
    nutritionFilledCount: 0,
    translationFilledCount: 0,
    translationTotalCount: 1,
    hasDiscount: false,
    ...overrides,
  };
}

describe("catalog table filter counts", () => {
  it("derives every visible counter from catalog items and preserves zeroes", () => {
    const items = [
      item({ id: "available" }),
      item({
        id: "scheduled",
        thumbnailUrl: "/photo.webp",
        scheduled: true,
        recommendationsCount: 2,
        hasDescription: true,
        tags: ["tag"],
        hasDiscount: true,
        displayMode: "no-button",
      }),
      item({ id: "stopped", status: "stopped", displayMode: "no-price" }),
      item({ id: "archived", status: "archive", thumbnailUrl: "/archive.webp" }),
    ];
    const filterIds = CATALOG_TABLE_FILTER_GROUPS.flatMap((group) => group.ids);

    const counts = countItemsByFilter(filterIds, items, null);

    expect(counts).toMatchObject({
      "status:active": 2,
      "status:archived": 1,
      "status:stop": 1,
      "status:schedule": 1,
      "quick:no-photo": 2,
      "quick:no-description": 3,
      "quick:no-recommendations": 3,
      "quick:with-recommendations": 1,
      "quick:with-tags": 1,
      "quick:discount": 1,
      "quick:with-labels": 0,
      "display:full": 2,
      "display:no-price": 1,
      "display:no-button": 1,
      "display:no-price-only": 1,
    });
    expect(Object.prototype.hasOwnProperty.call(counts, "quick:with-labels")).toBe(true);
  });
});
