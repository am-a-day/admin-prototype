import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/data/catalog";
import {
  getDirectChildSections,
  countItemsBySection,
  getSectionSubtreeIds,
  buildCatalogTree,
} from "./tree";
import { countItemsByFilter, getSectionScopeIds, sortItemsByPrice } from "./selectors";
import { getSortableDestinationIndex, moveId, validateCatalogTreeDrop } from "./reorder";

const item = (overrides: Partial<CatalogItem> = {}): CatalogItem => ({
  id: "item-1",
  title: "Позиция",
  sectionId: "leaf",
  sectionName: "Лист",
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
});

const sections = [
  { id: "root", parentId: null, name: "Корень", sortOrder: 0 },
  { id: "parent", parentId: "root", name: "Родитель", sortOrder: 0 },
  { id: "leaf", parentId: "parent", name: "Лист", sortOrder: 0 },
  { id: "sibling", parentId: "parent", name: "Сосед", sortOrder: 1 },
];

describe("catalog pure model parity", () => {
  it("builds parent/direct-child tree and returns a subtree", () => {
    const tree = buildCatalogTree(sections);
    expect(tree[0]?.children?.[0]?.children?.map((section) => section.id)).toEqual(["leaf", "sibling"]);
    expect(getDirectChildSections("parent", sections).map((section) => section.id)).toEqual(["leaf", "sibling"]);
    expect([...getSectionSubtreeIds("parent", sections)]).toEqual(["parent", "leaf", "sibling"]);
    expect([...countItemsBySection([item()], sections, false).entries()]).toEqual([["leaf", 1], ["parent", 1], ["root", 1]]);
  });

  it("rejects cycles and invalid mixed destinations while preserving sibling drops", () => {
    const model = { sections, items: [item()] };
    expect(validateCatalogTreeDrop(
      { kind: "section", id: "parent", parentId: "root" },
      { type: "inside", parentId: "leaf", index: 0 },
      model,
    )).toEqual({ valid: false, reason: "Раздел нельзя переместить в собственный подраздел" });
    expect(validateCatalogTreeDrop(
      { kind: "item", id: "item-1", parentId: "leaf" },
      { type: "between", parentId: "parent", index: 0 },
      model,
    )).toEqual({ valid: false, reason: "Позицию нельзя разместить рядом с подразделом" });
    expect(validateCatalogTreeDrop(
      { kind: "section", id: "sibling", parentId: "parent" },
      { type: "between", parentId: "parent", index: 0 },
      model,
    )).toEqual({ valid: true });
  });

  it("matches completeness predicates and scoped counts", () => {
    const items = [
      item({ id: "missing", sectionId: "leaf" }),
      item({ id: "complete", sectionId: "leaf", hasDescription: true, thumbnailUrl: "photo", weightLabel: "100 г", nutritionFilledCount: 4 }),
      item({ id: "other", sectionId: "sibling", hasDescription: true, thumbnailUrl: "photo" }),
    ];
    const scope = getSectionScopeIds("parent", sections);
    expect(countItemsByFilter(["quick:no-description", "quick:no-photo", "quick:no-weight"], items, scope)).toEqual({
      "quick:no-description": 1,
      "quick:no-photo": 1,
      "quick:no-weight": 2,
    });
  });

  it("sorts prices stably and keeps missing prices last", () => {
    const items = [
      item({ id: "same-a", price: 100 }),
      item({ id: "missing-price", price: 0 }),
      item({ id: "same-b", price: 100 }),
      item({ id: "cheap", price: 50 }),
    ];
    expect(sortItemsByPrice(items, "asc").map(({ id }) => id)).toEqual(["cheap", "same-a", "same-b", "missing-price"]);
    expect(sortItemsByPrice(items, "none")).toBe(items);
  });

  it("calculates before/after insertion and preserves reorder semantics", () => {
    expect(getSortableDestinationIndex(0, 2, "before")).toBe(1);
    expect(getSortableDestinationIndex(0, 2, "after")).toBe(2);
    expect(moveId(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });
});
