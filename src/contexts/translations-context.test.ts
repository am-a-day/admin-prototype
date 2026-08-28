import { describe, expect, it } from "vitest";
import type { MockWorkspace } from "@/contexts/mock-auth-context";
import {
  buildTranslationMaterials,
  summarizeCatalogPositionTranslations,
  summarizeLanguageProgress,
  type TranslationMaterial,
} from "@/contexts/translations-context";
import type { CatalogItem } from "@/data/catalog";
import type { Banner } from "@/data/mock-data";

function createItem(overrides: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: "item-1",
    title: "Паста",
    description: "",
    optionsCount: 0,
    modifiersCount: 0,
    ...overrides,
  } as CatalogItem;
}

describe("translation material structure", () => {
  it("keeps fixed position fields and does not infer options from audit counters", () => {
    const [position] = buildTranslationMaterials([
      createItem({ optionsCount: 4, modifiersCount: 3 }),
    ], [], [], [], undefined);

    expect(position.fields.map((field) => field.id)).toEqual(["title", "description"]);
    expect(position.fields[1]).toMatchObject({ source: "", values: { kk: "", en: "", sr: "" } });
  });

  it("nests one or multiple real option groups inside their position", () => {
    const [position] = buildTranslationMaterials([createItem({
      optionGroups: [{
        id: "size",
        name: "Размер",
        expanded: true,
        required: true,
        selection: "single",
        pricing: "total",
        variants: [
          { id: "small", name: "Маленькая", price: "0" },
          { id: "large", name: "Большая", price: "1200" },
        ],
      }, {
        id: "extras",
        name: "Добавки",
        expanded: true,
        required: false,
        selection: "multiple",
        pricing: "surcharge",
        variants: [{ id: "cheese", name: "Сыр", price: "300" }],
      }],
    })], [], [], [], undefined);

    expect(position.fields.map((field) => field.id)).toEqual([
      "title",
      "description",
      "option-group:size",
      "option:size:small",
      "option:size:large",
      "option-group:extras",
      "option:extras:cheese",
    ]);
    expect(position.fields.filter((field) => field.kind === "option-group")).toHaveLength(2);
    expect(position.category).toBe("positions");
  });

  it("translates only guest-facing banner content and local banner tags", () => {
    const banner: Banner = {
      id: "banner-1",
      title: "Внутреннее название",
      subtitle: "Доставка бесплатно",
      tags: [{
        id: "tag-1",
        type: "accent",
        texts: { ru: "Только сегодня", kz: "Тек бүгін", en: "Today only" },
      }],
      accent: "from-indigo-700 to-sky-400",
      visible: true,
      link: "",
    };

    const [material] = buildTranslationMaterials([], [], [], [banner], undefined);

    expect(material.title).toBe("Внутреннее название");
    expect(material.fields.map((field) => field.id)).toEqual(["subtitle", "tag:tag-1"]);
    expect(material.fields.some((field) => field.source === banner.title)).toBe(false);
    expect(material.fields[1]).toMatchObject({ kind: "banner-tag", values: { kk: "Тек бүгін" } });
  });

  it("uses the real fixed fields from the venue profile", () => {
    const workspace = {
      name: "Tasko Cafe",
      description: "",
      localizedNames: {},
      localizedAddresses: {},
      localizedDescriptions: {},
    } as unknown as MockWorkspace;

    const [material] = buildTranslationMaterials([], [], [], [], workspace);

    expect(material.fields.map((field) => field.id)).toEqual(["name", "address", "description"]);
    expect(material.fields[1].source).not.toBe("");
    expect(material.fields[2]).toMatchObject({ source: "", values: { kk: "", en: "", sr: "" } });
  });

  it("uses the selected primary language as the source while preserving Russian values", () => {
    const workspace = {
      primaryLanguage: "en",
      name: "Tasko Cafe",
      localizedNames: { ru: "Кафе Tasko", en: "Tasko Cafe" },
      localizedAddresses: {},
      localizedDescriptions: {},
    } as unknown as MockWorkspace;

    const [position] = buildTranslationMaterials([createItem({
      title: "Паста",
      titleTranslations: { ru: "Паста", en: "Pasta" },
    })], [], [], [], workspace);

    expect(position.fields[0]).toMatchObject({
      source: "Pasta",
      values: { ru: "Паста", en: "Pasta" },
    });
  });

  it("exposes the active local tags and sticker in the central translation materials", () => {
    const materials = buildTranslationMaterials([createItem({
      title: "Паста",
      tags: ["Острое", "Халяль"],
      guestLabels: ["Хит"],
      upsell: {
        tags: [
          { ru: "Острое", en: "Spicy" },
          { ru: "Халяль", kk: "Халал" },
        ],
        sticker: { ru: "Хит", en: "Popular" },
      },
    })], [], [], [], undefined);

    const spicy = materials.find((material) => material.category === "tags" && material.title === "Острое");
    const halal = materials.find((material) => material.category === "tags" && material.title === "Халяль");
    const sticker = materials.find((material) => material.category === "stickers" && material.title === "Хит");

    expect(spicy).toMatchObject({
      ownerItemIds: ["item-1"],
      category: "tags",
      fields: [{ id: "name", values: { en: "Spicy" } }],
    });
    expect(halal).toMatchObject({
      ownerItemIds: ["item-1"],
      fields: [{ id: "name", values: { kk: "Халал" } }],
    });
    expect(sticker).toMatchObject({
      ownerItemIds: ["item-1"],
      category: "stickers",
      fields: [{ id: "name", values: { en: "Popular" } }],
    });
  });
});

describe("translation field progress", () => {
  it("summarizes each added language using only a position's filled title and description", () => {
    const material = {
      fields: [{
        id: "title",
        label: "Название",
        source: "Паста",
        values: { kk: "Паста", en: "Pasta" },
      }, {
        id: "description",
        label: "Описание",
        source: "С томатами",
        values: { kk: "Қызанақпен", en: "" },
      }, {
        id: "option:size:large",
        label: "Опция · Большая",
        source: "Большая",
        kind: "option",
        values: { kk: "", en: "" },
      }],
    } as TranslationMaterial;

    expect(summarizeCatalogPositionTranslations(material, ["kk", "en", "sr"])).toEqual([{
      code: "kk",
      label: "Қазақша",
      filled: 2,
      total: 2,
      outdated: false,
      tooltip: "Все поля переведены",
    }, {
      code: "en",
      label: "English",
      filled: 1,
      total: 2,
      outdated: false,
      tooltip: "Не переведено: описание",
    }, {
      code: "sr",
      label: "Srpski",
      filled: 0,
      total: 2,
      outdated: false,
      tooltip: "Не переведено: название, описание",
    }]);
  });

  it("does not include an empty original description in position progress", () => {
    const material = {
      fields: [{
        id: "title",
        label: "Название",
        source: "Паста",
        values: { en: "Pasta" },
      }, {
        id: "description",
        label: "Описание",
        source: "",
        values: { en: "" },
      }],
    } as TranslationMaterial;

    expect(summarizeCatalogPositionTranslations(material, ["en"])[0]).toMatchObject({
      filled: 1,
      total: 1,
      tooltip: "Все поля переведены",
    });
  });

  it("excludes empty source fields from the total", () => {
    const material = {
      statuses: { kk: "missing", en: "missing", sr: "missing" },
      fields: [{ id: "title", source: "Паста", values: { kk: "Паста" } }, {
        id: "description",
        source: "",
        values: { kk: "" },
      }],
    } as TranslationMaterial;

    expect(summarizeLanguageProgress([material], "kk")).toEqual({
      totalFields: 1,
      doneFields: 1,
      missing: 0,
      outdated: 0,
    });
  });

  it("counts review metadata per field instead of treating it as a language-wide status", () => {
    const material = {
      statuses: { kk: "outdated", en: "translated", sr: "missing" },
      fields: [{
        id: "title",
        source: "Паста",
        values: { kk: "Паста" },
        reviewLanguages: ["kk"],
      }, {
        id: "description",
        source: "С томатами",
        values: { kk: "Қызанақпен" },
      }],
    } as TranslationMaterial;

    expect(summarizeLanguageProgress([material], "kk")).toEqual({
      totalFields: 2,
      doneFields: 1,
      missing: 0,
      outdated: 1,
    });
  });
});
