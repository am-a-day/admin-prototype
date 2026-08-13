import { renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { CatalogItem } from "@/data/catalog";
import {
  buildCatalogLabelAssignmentPatch,
  buildCatalogLabelRemovalPatch,
  createOrGetCatalogLabel,
  ensureCatalogLabelsFromItems,
  getCatalogLabelText,
  getCatalogLabelUsageItems,
  matchesCatalogItemLabelFilters,
  resolveCatalogItemStickerId,
  resolveCatalogItemTagIds,
  useCatalogLabels,
  type CatalogLabel,
} from "./catalog-labels";

const labels: CatalogLabel[] = [
  { id: "tag-hot", type: "tag", translations: { ru: "Острое", en: "Spicy" }, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "tag-halal", type: "tag", translations: { ru: "Халяль" }, createdAt: "2026-01-01T00:00:01.000Z" },
  { id: "sticker-hit", type: "sticker", translations: { ru: "Хит", en: "Hit" }, createdAt: "2026-01-01T00:00:02.000Z" },
  { id: "sticker-new", type: "sticker", translations: { ru: "Новинка" }, createdAt: "2026-01-01T00:00:03.000Z" },
];

function item(patch: Partial<CatalogItem> = {}) {
  return {
    id: "item-1",
    tags: [],
    guestLabels: [],
    upsell: {},
    ...patch,
  } as CatalogItem;
}

describe("catalog label directory", () => {
  it("does not read or subscribe to the shared directory when disabled", () => {
    const storageRead = vi.spyOn(window.localStorage, "getItem");
    const { result } = renderHook(() => useCatalogLabels(false));

    expect(result.current.labels).toEqual([]);
    expect(storageRead).not.toHaveBeenCalled();
  });

  it("treats case and repeated whitespace as the same directory value", () => {
    const result = createOrGetCatalogLabel(labels, "sticker", { ru: "  хИт  " });
    expect(result.created).toBe(false);
    expect(result.label?.id).toBe("sticker-hit");

    const spaced = createOrGetCatalogLabel(labels, "tag", { ru: "  Очень   острое " });
    const duplicate = createOrGetCatalogLabel(spaced.labels, "tag", { ru: "очень острое" });
    expect(spaced.created).toBe(true);
    expect(duplicate.created).toBe(false);
    expect(duplicate.label?.id).toBe(spaced.label?.id);
  });

  it("keeps multiple tags and replaces the single sticker without copying source text", () => {
    const source = item({ tagIds: ["tag-hot"], stickerId: "sticker-hit" });
    const withSecondTag = { ...source, ...buildCatalogLabelAssignmentPatch(source, labels, { tagIds: ["tag-hot", "tag-halal"] }) } as CatalogItem;
    const withNewSticker = { ...withSecondTag, ...buildCatalogLabelAssignmentPatch(withSecondTag, labels, { stickerId: "sticker-new" }) } as CatalogItem;

    expect(resolveCatalogItemTagIds(withNewSticker, labels)).toEqual(["tag-hot", "tag-halal"]);
    expect(resolveCatalogItemStickerId(withNewSticker, labels)).toBe("sticker-new");
    expect(withNewSticker.guestLabels).toEqual(["Новинка"]);
  });

  it("migrates legacy string assignments by resolving their shared IDs", () => {
    const legacy = item({ tags: ["острое", "Халяль"], guestLabels: ["хит"] });
    expect(resolveCatalogItemTagIds(legacy, labels)).toEqual(["tag-hot", "tag-halal"]);
    expect(resolveCatalogItemStickerId(legacy, labels)).toBe("sticker-hit");
  });

  it("uses selected translation, then primary language, then canonical Russian fallback", () => {
    expect(getCatalogLabelText(labels[0], "en", "ru")).toBe("Spicy");
    expect(getCatalogLabelText(labels[1], "en", "ru")).toBe("Халяль");
    const serbianPrimary = { ...labels[0], translations: { ru: "Острое", sr: "Ljuto" } };
    expect(getCatalogLabelText(serbianPrimary, "en", "sr")).toBe("Ljuto");
  });

  it("reflects a rename everywhere through the stable assignment ID", () => {
    const assigned = item({ tagIds: ["tag-hot"] });
    const renamed = labels.map((label) => label.id === "tag-hot" ? { ...label, translations: { ...label.translations, ru: "Пикантное" } } : label);
    const resolved = resolveCatalogItemTagIds(assigned, renamed).map((id) => getCatalogLabelText(renamed.find((label) => label.id === id), "ru"));
    expect(resolved).toEqual(["Пикантное"]);
  });

  it("applies tag and sticker filters with AND semantics, including empty assignments", () => {
    const spicyHit = item({ tagIds: ["tag-hot"], stickerId: "sticker-hit" });
    const halalWithoutSticker = item({ id: "item-2", tagIds: ["tag-halal"], stickerId: null });
    expect(matchesCatalogItemLabelFilters(spicyHit, labels, { tag: "tag-hot", sticker: "sticker-hit" })).toBe(true);
    expect(matchesCatalogItemLabelFilters(spicyHit, labels, { tag: "tag-hot", sticker: "none" })).toBe(false);
    expect(matchesCatalogItemLabelFilters(halalWithoutSticker, labels, { tag: "tag-halal", sticker: "none" })).toBe(true);
  });

  it("bulk-style tag assignment preserves unrelated tags", () => {
    const source = item({ tagIds: ["tag-hot"] });
    const patch = buildCatalogLabelAssignmentPatch(source, labels, { tagIds: [...resolveCatalogItemTagIds(source, labels), "tag-halal"] });
    expect(patch.tagIds).toEqual(["tag-hot", "tag-halal"]);
  });

  it("counts zero, one, and multiple global usages without mixing label types", () => {
    const unused = labels[1];
    const usedTag = labels[0];
    const items = [
      item({ id: "item-1", tagIds: ["tag-hot"], stickerId: "sticker-hit" }),
      item({ id: "item-2", tagIds: ["tag-hot"] }),
      item({ id: "item-3", tagIds: ["tag-hot"] }),
    ];

    expect(getCatalogLabelUsageItems(unused, items, labels)).toHaveLength(0);
    expect(getCatalogLabelUsageItems(labels[2], items, labels)).toHaveLength(1);
    expect(getCatalogLabelUsageItems(usedTag, items, labels)).toHaveLength(3);
  });

  it("builds stale-free unassignment patches for global tag and sticker deletion", () => {
    const assigned = item({ tagIds: ["tag-hot", "tag-halal"], stickerId: "sticker-hit" });
    const tagPatch = buildCatalogLabelRemovalPatch(assigned, labels[0], labels);
    const stickerPatch = buildCatalogLabelRemovalPatch(assigned, labels[2], labels);

    expect(tagPatch?.tagIds).toEqual(["tag-halal"]);
    expect(tagPatch?.tags).toEqual(["Халяль"]);
    expect(stickerPatch?.stickerId).toBeNull();
    expect(stickerPatch?.guestLabels).toEqual([]);
    expect(buildCatalogLabelRemovalPatch(assigned, labels[3], labels)).toBeNull();
  });

  it("persists legacy values imported into the shared menu directory", () => {
    window.localStorage.clear();
    ensureCatalogLabelsFromItems([item({ tags: ["Авторский тег"] })]);
    const serialized = Array.from({ length: window.localStorage.length }, (_, index) => window.localStorage.getItem(window.localStorage.key(index) ?? "")).join("\n");
    expect(serialized).toContain("Авторский тег");
  });

  it("restores item-local translations when the shared directory is enabled again", () => {
    window.localStorage.clear();
    ensureCatalogLabelsFromItems([item({
      tags: ["Острое"],
      upsell: { tags: [{ ru: "Острое", en: "Hot", kk: "Ащы" }] },
    })]);
    const serialized = Array.from(
      { length: window.localStorage.length },
      (_, index) => window.localStorage.getItem(window.localStorage.key(index) ?? ""),
    ).join("\n");
    expect(serialized).toContain('"en":"Hot"');
    expect(serialized).toContain('"kk":"Ащы"');
  });
});
