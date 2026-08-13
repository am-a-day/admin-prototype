import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/data/catalog";
import {
  buildLocalCatalogLabelPatch,
  createLocalCatalogLabel,
  getLocalCatalogItemLabels,
  getLocalCatalogLabelText,
  normalizeLocalCatalogLabel,
  normalizeLocalCatalogLabelEdit,
} from "./local-catalog-labels";

function item(patch: Partial<CatalogItem> = {}) {
  return {
    id: "item-1",
    tags: [],
    guestLabels: [],
    upsell: {},
    ...patch,
  } as CatalogItem;
}

describe("position-local catalog labels", () => {
  it("normalizes names and falls back to the menu primary language", () => {
    const tag = normalizeLocalCatalogLabel({ ru: "  Острое  ", en: "  Spicy " });
    expect(tag).toEqual({ ru: "Острое", en: "Spicy" });
    expect(getLocalCatalogLabelText(tag, "en", "ru")).toBe("Spicy");
    expect(getLocalCatalogLabelText(tag, "kk", "ru")).toBe("Острое");

    const serbian = createLocalCatalogLabel(" Ljuto ", "sr");
    expect(serbian).toEqual({ ru: "Ljuto", sr: "Ljuto" });
    expect(getLocalCatalogLabelText(serbian, "en", "sr")).toBe("Ljuto");

    expect(normalizeLocalCatalogLabelEdit(
      { ru: "Spicy", en: "Spicy" },
      { ru: "Spicy", en: "Hot" },
      "en",
      "en",
    )).toEqual({ ru: "Hot", en: "Hot" });
  });

  it("writes only the current position and removes stale shared references", () => {
    const source = item({
      id: "first",
      tagIds: ["shared-hot"],
      stickerId: "shared-hit",
      upsell: { recommendationIds: ["second"], keywords: [{ ru: "острый" }] },
    });
    const patch = buildLocalCatalogLabelPatch(source, {
      tags: [{ ru: "Острое", en: "Spicy" }, { ru: "Халяль" }],
      sticker: { ru: "Хит", en: "Hit" },
    });

    expect(patch.tagIds).toBeUndefined();
    expect(patch.stickerId).toBeUndefined();
    expect(patch.tags).toEqual(["Острое", "Халяль"]);
    expect(patch.guestLabels).toEqual(["Хит"]);
    expect(patch.upsell).toMatchObject({
      recommendationIds: ["second"],
      keywords: [{ ru: "острый" }],
      tags: [{ ru: "Острое", en: "Spicy" }, { ru: "Халяль" }],
      sticker: { ru: "Хит", en: "Hit" },
    });

    const untouched = item({ id: "second", tags: ["Свой тег"] });
    expect(getLocalCatalogItemLabels(untouched).tags).toEqual([{ ru: "Свой тег" }]);
  });

  it("treats local translations as canonical and supports removing the sticker", () => {
    const source = item({
      tags: ["Старое"],
      guestLabels: ["Старый стикер"],
      upsell: {
        tags: [{ ru: "Новое", kk: "Жаңа" }],
        sticker: { ru: "Хит", en: "Hit" },
      },
    });

    expect(getLocalCatalogItemLabels(source)).toEqual({
      tags: [{ ru: "Новое", kk: "Жаңа" }],
      sticker: { ru: "Хит", en: "Hit" },
    });
    const patch = buildLocalCatalogLabelPatch(source, {
      tags: [{ ru: "Новое", kk: "Жаңа" }],
      sticker: null,
    });
    expect(patch.guestLabels).toEqual([]);
    expect(patch.upsell?.sticker).toBeNull();
  });
});
