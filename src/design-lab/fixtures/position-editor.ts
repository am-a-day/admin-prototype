import type { CatalogAutosaveState } from "@/contexts/catalog-store-context";
import type { CatalogItem, CatalogSection } from "@/data/catalog";

export const POSITION_EDITOR_DESIGN_SCENARIOS = [
  "default",
  "discount-kbju",
  "recommendations",
  "recommendations/default",
  "recommendations/picker",
  "recommendations/selected",
  "recommendations/added",
  "recommendations/tag-create",
  "recommendations/tag-assigned",
  "recommendations/tag-edit",
  "recommendations/sticker-create",
  "recommendations/sticker-assigned",
  "recommendations/sticker-edit",
  "position-actions",
  "saving",
  "validation",
  "long-content",
] as const;

export type PositionEditorDesignScenario = (typeof POSITION_EDITOR_DESIGN_SCENARIOS)[number];

export type PositionEditorDesignFixture = {
  scenario: PositionEditorDesignScenario;
  selectedItemId: string;
  sections: CatalogSection[];
  items: CatalogItem[];
  autosaveByItem?: Record<string, CatalogAutosaveState>;
  validationMessage?: string;
  positionActionsOpen?: boolean;
  promo?: {
    recommendationPickerOpen?: boolean;
    creatingLabelType?: "tag" | "sticker";
    editingLabelType?: "tag" | "sticker";
    showRecommendationRemoveAction?: boolean;
  };
};

const DESIGN_SECTION: CatalogSection = {
  id: "design-lab-main",
  parentId: null,
  name: "Основное меню",
  imageUrl: null,
  sortOrder: 0,
};

const DESIGN_ITEM_ID = "design-lab-position";

function createBaseItem(patch: Partial<CatalogItem> = {}): CatalogItem {
  return {
    id: DESIGN_ITEM_ID,
    title: "Томлёная говядина с овощами",
    titleTranslations: { ru: "Томлёная говядина с овощами" },
    sectionId: DESIGN_SECTION.id,
    sectionName: DESIGN_SECTION.name,
    thumbnailUrl: null,
    price: 4290,
    priceWithSale: null,
    status: "active",
    scheduled: false,
    guestLabels: [],
    tags: [],
    optionsCount: 0,
    modifiersCount: 0,
    recommendationsCount: 0,
    displayMode: "full",
    description: "Нежная говядина, томлённая с сезонными овощами и ароматными специями.",
    hasDescription: true,
    weightLabel: "320 г",
    nutritionFilledCount: 0,
    translationFilledCount: 0,
    translationTotalCount: 2,
    hasDiscount: false,
    ...patch,
  };
}

function createSupportingItem(
  id = "design-lab-supporting-position",
  title = "Зелёный салат",
): CatalogItem {
  return createBaseItem({
    id,
    title,
    titleTranslations: { ru: title },
    price: 2190,
    description: "",
    hasDescription: false,
    weightLabel: null,
  });
}

function createLongContent() {
  return [
    "Говяжья грудинка длительного томления с сезонными овощами, пряным соусом и хрустящим луком",
    "Готовим блюдо медленно, чтобы мясо осталось особенно нежным. Подаём с запечённой морковью, картофелем, сельдереем и насыщенным соусом на основе собственного бульона.",
    "Состав и подача могут незначительно меняться в зависимости от сезона. Пожалуйста, сообщите команде ресторана об аллергиях и пищевых ограничениях перед заказом.",
    "Блюдо подходит для плотного обеда или ужина и хорошо сочетается с овощным салатом и безалкогольным напитком.",
  ].join("\n\n");
}

export function isPositionEditorDesignScenario(
  value: string | null | undefined,
): value is PositionEditorDesignScenario {
  return POSITION_EDITOR_DESIGN_SCENARIOS.some((scenario) => scenario === value);
}

export function getPositionEditorDesignScenario(pathname: string): PositionEditorDesignScenario | null {
  const match = pathname.match(/^\/__design\/position-editor\/(.+?)\/?$/);
  const scenario = match?.[1];
  return isPositionEditorDesignScenario(scenario) ? scenario : null;
}

export function getPositionEditorDesignFixture(
  scenario: PositionEditorDesignScenario,
): PositionEditorDesignFixture {
  const base = createBaseItem();
  const fixture: PositionEditorDesignFixture = {
    scenario,
    selectedItemId: DESIGN_ITEM_ID,
    sections: [{ ...DESIGN_SECTION }],
    items: [
      base,
      createSupportingItem(),
      createSupportingItem("design-lab-supporting-drink", "Ягодный морс"),
      createSupportingItem("design-lab-supporting-dessert", "Медовик"),
    ],
  };

  if (scenario === "discount-kbju") {
    fixture.items[0] = createBaseItem({
      price: 4290,
      priceWithSale: 3490,
      hasDiscount: true,
      nutritionFilledCount: 4,
      nutrition: {
        calories: "486",
        protein: "32",
        fat: "29",
        carbs: "24",
      },
    });
  }

  if (scenario === "saving") {
    fixture.autosaveByItem = {
      [DESIGN_ITEM_ID]: { status: "saving", revision: 1, savedAt: null },
    };
  }

  if (scenario === "validation") {
    fixture.items[0] = createBaseItem({
      title: "",
      titleTranslations: { ru: "" },
    });
    fixture.validationMessage = "Введите название позиции";
  }

  if (scenario === "long-content") {
    fixture.items[0] = createBaseItem({
      title: "Говяжья грудинка длительного томления с сезонными овощами, пряным соусом и хрустящим луком",
      titleTranslations: {
        ru: "Говяжья грудинка длительного томления с сезонными овощами, пряным соусом и хрустящим луком",
      },
      description: createLongContent(),
      hasDescription: true,
    });
  }

  if (scenario === "recommendations/picker") {
    fixture.promo = { recommendationPickerOpen: true };
  }

  if (scenario === "recommendations/selected") {
    fixture.items[0] = createBaseItem({
      recommendationsCount: 1,
      upsell: {
        recommendationIds: ["design-lab-supporting-position"],
        recommendationSources: { "design-lab-supporting-position": "manual" },
      },
    });
    fixture.promo = { recommendationPickerOpen: true };
  }

  if (scenario === "recommendations/added") {
    fixture.items[0] = createBaseItem({
      recommendationsCount: 1,
      upsell: {
        recommendationIds: ["design-lab-supporting-position"],
        recommendationSources: { "design-lab-supporting-position": "manual" },
      },
    });
    fixture.promo = { showRecommendationRemoveAction: true };
  }

  if (scenario === "recommendations/tag-create") {
    fixture.promo = { creatingLabelType: "tag" };
  }

  if (scenario === "recommendations/tag-assigned") {
    fixture.items[0] = createBaseItem({
      tags: ["Острое"],
      upsell: { tags: [{ ru: "Острое" }] },
    });
  }

  if (scenario === "recommendations/tag-edit") {
    fixture.items[0] = createBaseItem({
      tags: ["Острое"],
      upsell: { tags: [{ ru: "Острое" }] },
    });
    fixture.promo = { editingLabelType: "tag" };
  }

  if (scenario === "recommendations/sticker-create") {
    fixture.promo = { creatingLabelType: "sticker" };
  }

  if (scenario === "recommendations/sticker-assigned") {
    fixture.items[0] = createBaseItem({
      guestLabels: ["Хит"],
      upsell: { sticker: { ru: "Хит" } },
    });
  }

  if (scenario === "recommendations/sticker-edit") {
    fixture.items[0] = createBaseItem({
      guestLabels: ["Хит"],
      upsell: { sticker: { ru: "Хит" } },
    });
    fixture.promo = { editingLabelType: "sticker" };
  }

  if (scenario === "position-actions") {
    fixture.positionActionsOpen = true;
  }

  return fixture;
}
