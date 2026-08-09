import type { CatalogItem } from "@/data/catalog";
import { catalogStorageKey } from "@/lib/catalog-preview";
import { readCatalogJson, writeCatalogJson } from "@/features/storefront/catalog/persistence";

export type CatalogLocalizedValue = {
  ru: string;
  kk?: string;
  en?: string;
  sr?: string;
};

export type CatalogRecommendationSource = "manual" | "automatic";

export type CatalogItemUpsellState = {
  recommendationIds?: string[];
  recommendationSources?: Record<string, CatalogRecommendationSource>;
  sticker?: CatalogLocalizedValue | null;
  tags?: CatalogLocalizedValue[];
  keywords?: CatalogLocalizedValue[];
};

export type CatalogUpsellStateByItem = Record<string, CatalogItemUpsellState>;

export const CATALOG_UPSELL_STORAGE_KEY = catalogStorageKey("upsellByItem");
export const CATALOG_UPSELL_CHANGE_EVENT = "tasko:catalog-upsell-change";
export const CATALOG_RECOMMENDATION_LIMIT = 12;

export type GeneratedRecommendation = {
  id: string;
  reciprocal: boolean;
};

export function readCatalogUpsellState(): CatalogUpsellStateByItem {
  return readCatalogJson<CatalogUpsellStateByItem>(CATALOG_UPSELL_STORAGE_KEY, {});
}

export function writeCatalogUpsellState(value: CatalogUpsellStateByItem) {
  writeCatalogJson(CATALOG_UPSELL_STORAGE_KEY, value);
  if (typeof window !== "undefined") window.dispatchEvent(new CustomEvent(CATALOG_UPSELL_CHANGE_EVENT, { detail: value }));
}

export function buildDefaultRecommendationIds(item: CatalogItem, items: CatalogItem[]) {
  if (item.recommendationsCount <= 0) return [];
  return items
    .filter((candidate) => candidate.id !== item.id && candidate.status === "active")
    .slice(0, item.recommendationsCount)
    .map((candidate) => candidate.id);
}

export function resolveRecommendationIds(
  item: CatalogItem,
  items: CatalogItem[],
  state?: CatalogItemUpsellState,
) {
  return state?.recommendationIds ?? buildDefaultRecommendationIds(item, items);
}

export function resolveRecommendationSource(
  state: CatalogItemUpsellState | undefined,
  recommendationId: string,
): CatalogRecommendationSource {
  return state?.recommendationSources?.[recommendationId]
    ?? (state?.recommendationIds ? "manual" : "automatic");
}

type RecommendationKind = "drink" | "main" | "sauce" | "addon" | "packaging";

function getRecommendationKind(item: CatalogItem): RecommendationKind {
  const text = `${item.title} ${item.sectionName}`.toLocaleLowerCase("ru");
  if (/(упаков|контейнер|прибор|пакет|короб)/.test(text)) return "packaging";
  if (/(соус|кетчуп|майонез|сметан|горчиц|тартар)/.test(text)) return "sauce";
  if (/(гарнир|картоф.*фри|добавк|хлеб|леп[её]ш|рис\b|пюре)/.test(text)) return "addon";
  if (/(напит|кофе|чай|сок|кола|coca|pepsi|пепси|спрайт|sprite|фанта|fanta|вода|лимонад|коктейл|вино|пиво|виски|ром|текил|джин|водк)/.test(text)) return "drink";
  return "main";
}

function stablePairHash(firstId: string, secondId: string) {
  return [...[firstId, secondId].sort().join("")]
    .reduce((hash, character) => (hash * 31 + character.charCodeAt(0)) % 997, 0);
}

function shouldCreateReciprocalRecommendation(first: CatalogItem, second: CatalogItem) {
  const firstKind = getRecommendationKind(first);
  const secondKind = getRecommendationKind(second);
  if (!([firstKind, secondKind].includes("drink") && [firstKind, secondKind].includes("main"))) return false;
  const pairText = `${first.title} ${second.title}`.toLocaleLowerCase("ru");
  if (/картоф.*фри/.test(pairText) && /(кола|coca)/.test(pairText)) return true;
  return stablePairHash(first.id, second.id) % 3 === 0;
}

export function buildAutomaticRecommendations(
  item: CatalogItem,
  items: CatalogItem[],
  existingIds: string[] = [],
  limit = CATALOG_RECOMMENDATION_LIMIT,
): GeneratedRecommendation[] {
  if (item.status !== "active") return [];
  const sourceKind = getRecommendationKind(item);
  if (sourceKind === "sauce" || sourceKind === "addon" || sourceKind === "packaging") return [];

  const existing = new Set(existingIds);
  const priorityBySource: Record<"drink" | "main", Record<RecommendationKind, number>> = {
    main: { drink: 0, sauce: 1, addon: 2, main: 3, packaging: 4 },
    drink: { main: 0, drink: 4, sauce: 4, addon: 4, packaging: 4 },
  };

  return items
    .map((candidate, index) => ({ candidate, index, kind: getRecommendationKind(candidate) }))
    .filter(({ candidate, kind }) => (
      candidate.id !== item.id
      && candidate.status === "active"
      && !existing.has(candidate.id)
      && (sourceKind !== "drink" || kind === "main")
      && (sourceKind === "main" || (kind !== "sauce" && kind !== "addon" && kind !== "packaging"))
    ))
    .sort((first, second) => (
      priorityBySource[sourceKind][first.kind] - priorityBySource[sourceKind][second.kind]
      || Number(first.candidate.sectionId !== item.sectionId) - Number(second.candidate.sectionId !== item.sectionId)
      || first.index - second.index
    ))
    .slice(0, Math.max(0, limit - existing.size))
    .map(({ candidate }) => ({
      id: candidate.id,
      reciprocal: shouldCreateReciprocalRecommendation(item, candidate),
    }));
}
