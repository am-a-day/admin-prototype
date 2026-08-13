import { useSyncExternalStore } from "react";
import type { CatalogItem, CatalogLocalizedValue } from "@/data/catalog";
import { catalogStorageKey } from "@/lib/catalog-preview";

export type CatalogLabelType = "tag" | "sticker";
export type CatalogLabelFilterValue = "all" | "none" | string;

export type CatalogLabel = {
  id: string;
  type: CatalogLabelType;
  translations: CatalogLocalizedValue;
  createdAt: string;
};

const STORAGE_KEY = catalogStorageKey("labels.v1");
const CHANGE_EVENT = "tasko-catalog-labels-change";

export const DEFAULT_CATALOG_LABELS: CatalogLabel[] = [
  { id: "tag-spicy", type: "tag", translations: { ru: "Острое" }, createdAt: "2026-01-01T00:00:00.000Z" },
  { id: "tag-halal", type: "tag", translations: { ru: "Халяль" }, createdAt: "2026-01-01T00:00:01.000Z" },
  { id: "tag-vegetarian", type: "tag", translations: { ru: "Вегетарианское" }, createdAt: "2026-01-01T00:00:02.000Z" },
  { id: "sticker-hit", type: "sticker", translations: { ru: "Хит" }, createdAt: "2026-01-01T00:00:03.000Z" },
  { id: "sticker-new", type: "sticker", translations: { ru: "Новинка" }, createdAt: "2026-01-01T00:00:04.000Z" },
  { id: "sticker-chef", type: "sticker", translations: { ru: "Выбор шефа" }, createdAt: "2026-01-01T00:00:05.000Z" },
];

let snapshot: CatalogLabel[] | null = null;
const EMPTY_CATALOG_LABELS: CatalogLabel[] = [];
const subscribeDisabled = () => () => undefined;
const readDisabledSnapshot = () => EMPTY_CATALOG_LABELS;

export function normalizeCatalogLabelName(value: string) {
  return value.trim().replace(/\s+/g, " ").toLocaleLowerCase("ru");
}

function normalizeTranslations(value: Partial<CatalogLocalizedValue>): CatalogLocalizedValue | null {
  const ru = value.ru?.trim().replace(/\s+/g, " ") ?? "";
  if (!ru) return null;
  return {
    ru,
    ...(value.kk?.trim() ? { kk: value.kk.trim() } : {}),
    ...(value.en?.trim() ? { en: value.en.trim() } : {}),
    ...(value.sr?.trim() ? { sr: value.sr.trim() } : {}),
  };
}

function readSnapshot() {
  if (snapshot) return snapshot;
  if (typeof window === "undefined") return DEFAULT_CATALOG_LABELS;
  try {
    const stored = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "null") as CatalogLabel[] | null;
    snapshot = Array.isArray(stored) ? stored : DEFAULT_CATALOG_LABELS;
  } catch {
    snapshot = DEFAULT_CATALOG_LABELS;
  }
  return snapshot;
}

function writeSnapshot(next: CatalogLabel[]) {
  snapshot = next;
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  }
}

function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const onStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    snapshot = null;
    listener();
  };
  window.addEventListener(CHANGE_EVENT, listener);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, listener);
    window.removeEventListener("storage", onStorage);
  };
}

export function findCatalogLabelByName(labels: CatalogLabel[], type: CatalogLabelType, value: string) {
  const normalized = normalizeCatalogLabelName(value);
  return labels.find((label) => label.type === type && normalizeCatalogLabelName(label.translations.ru) === normalized) ?? null;
}

export function createOrGetCatalogLabel(
  labels: CatalogLabel[],
  type: CatalogLabelType,
  translations: Partial<CatalogLocalizedValue>,
) {
  const normalizedTranslations = normalizeTranslations(translations);
  if (!normalizedTranslations) return { labels, label: null, created: false };
  const existing = findCatalogLabelByName(labels, type, normalizedTranslations.ru);
  if (existing) return { labels, label: existing, created: false };
  const label: CatalogLabel = {
    id: `${type}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`,
    type,
    translations: normalizedTranslations,
    createdAt: new Date().toISOString(),
  };
  return { labels: [...labels, label], label, created: true };
}

export function getCatalogLabelText(label: CatalogLabel | null | undefined, language: string, primaryLanguage = "ru") {
  if (!label) return "";
  return label.translations[language as keyof CatalogLocalizedValue]?.trim()
    || label.translations[primaryLanguage as keyof CatalogLocalizedValue]?.trim()
    || label.translations.ru;
}

export function resolveCatalogItemTagIds(item: CatalogItem, labels: CatalogLabel[]) {
  if (item.tagIds) return item.tagIds.filter((id) => labels.some((label) => label.id === id && label.type === "tag"));
  return item.tags
    .map((value) => findCatalogLabelByName(labels, "tag", value)?.id)
    .filter((id): id is string => Boolean(id));
}

export function resolveCatalogItemStickerId(item: CatalogItem, labels: CatalogLabel[]) {
  if (item.stickerId && labels.some((label) => label.id === item.stickerId && label.type === "sticker")) return item.stickerId;
  return item.guestLabels[0] ? findCatalogLabelByName(labels, "sticker", item.guestLabels[0])?.id ?? null : null;
}

export function getCatalogLabelUsageItems(label: CatalogLabel, items: CatalogItem[], labels: CatalogLabel[]) {
  return items.filter((item) => label.type === "tag"
    ? resolveCatalogItemTagIds(item, labels).includes(label.id)
    : resolveCatalogItemStickerId(item, labels) === label.id);
}

export function buildCatalogLabelRemovalPatch(
  item: CatalogItem,
  label: CatalogLabel,
  labels: CatalogLabel[],
): Partial<CatalogItem> | null {
  if (label.type === "tag") {
    const tagIds = resolveCatalogItemTagIds(item, labels);
    if (!tagIds.includes(label.id)) return null;
    return buildCatalogLabelAssignmentPatch(item, labels, { tagIds: tagIds.filter((id) => id !== label.id) });
  }
  if (resolveCatalogItemStickerId(item, labels) !== label.id) return null;
  return buildCatalogLabelAssignmentPatch(item, labels, { stickerId: null });
}

export function matchesCatalogItemLabelFilters(
  item: CatalogItem,
  labels: CatalogLabel[],
  filters: { tag?: CatalogLabelFilterValue | null; sticker?: CatalogLabelFilterValue | null },
) {
  const tagIds = resolveCatalogItemTagIds(item, labels);
  const stickerId = resolveCatalogItemStickerId(item, labels);
  const matchesTag = !filters.tag || filters.tag === "all" || (filters.tag === "none" ? tagIds.length === 0 : tagIds.includes(filters.tag));
  const matchesSticker = !filters.sticker || filters.sticker === "all" || (filters.sticker === "none" ? !stickerId : stickerId === filters.sticker);
  return matchesTag && matchesSticker;
}

export function buildCatalogLabelAssignmentPatch(
  item: CatalogItem,
  labels: CatalogLabel[],
  assignment: { tagIds?: string[]; stickerId?: string | null },
): Partial<CatalogItem> {
  const tagIds = assignment.tagIds ?? resolveCatalogItemTagIds(item, labels);
  const stickerId = assignment.stickerId === undefined ? resolveCatalogItemStickerId(item, labels) : assignment.stickerId;
  const tags = tagIds.map((id) => labels.find((label) => label.id === id)?.translations.ru).filter((value): value is string => Boolean(value));
  const sticker = labels.find((label) => label.id === stickerId) ?? null;
  return {
    tagIds,
    stickerId,
    tags,
    guestLabels: sticker ? [sticker.translations.ru] : [],
    upsell: {
      ...(item.upsell ?? {}),
      tags: tagIds.map((id) => labels.find((label) => label.id === id)?.translations).filter((value): value is CatalogLocalizedValue => Boolean(value)),
      sticker: sticker?.translations ?? null,
    },
  };
}

export function ensureCatalogLabelsFromItems(items: CatalogItem[]) {
  let next = readSnapshot();
  let changed = false;
  const add = (type: CatalogLabelType, translations: Partial<CatalogLocalizedValue>) => {
    const result = createOrGetCatalogLabel(next, type, translations);
    if (result.created) {
      next = result.labels;
      changed = true;
      return;
    }
    if (!result.label) return;
    const normalized = normalizeTranslations(translations);
    if (!normalized) return;
    const merged = normalizeTranslations({ ...result.label.translations, ...normalized });
    if (!merged || JSON.stringify(merged) === JSON.stringify(result.label.translations)) return;
    next = next.map((label) => label.id === result.label?.id ? { ...label, translations: merged } : label);
    changed = true;
  };

  items.forEach((item) => {
    // Canonical per-item translations must win when the shared directory is
    // switched back on; legacy display strings only fill missing entries.
    item.upsell?.tags?.forEach((translations) => add("tag", translations));
    if (item.upsell?.sticker) add("sticker", item.upsell.sticker);
    item.tags.forEach((value) => {
      if (!findCatalogLabelByName(next, "tag", value)) add("tag", { ru: value });
    });
    item.guestLabels.forEach((value) => {
      if (!findCatalogLabelByName(next, "sticker", value)) add("sticker", { ru: value });
    });
  });

  if (changed) writeSnapshot(next);
  return next;
}

export function useCatalogLabels(enabled = true) {
  const labels = useSyncExternalStore(
    enabled ? subscribe : subscribeDisabled,
    enabled ? readSnapshot : readDisabledSnapshot,
    enabled ? () => DEFAULT_CATALOG_LABELS : readDisabledSnapshot,
  );
  return {
    labels,
    create(type: CatalogLabelType, translations: Partial<CatalogLocalizedValue>) {
      const result = createOrGetCatalogLabel(readSnapshot(), type, translations);
      if (result.created) writeSnapshot(result.labels);
      return result.label;
    },
    update(id: string, translations: Partial<CatalogLocalizedValue>) {
      const normalized = normalizeTranslations(translations);
      if (!normalized) return false;
      const current = readSnapshot();
      const target = current.find((label) => label.id === id);
      if (!target) return false;
      const duplicate = current.some((label) => label.id !== id && label.type === target.type && normalizeCatalogLabelName(label.translations.ru) === normalizeCatalogLabelName(normalized.ru));
      if (duplicate) return false;
      writeSnapshot(current.map((label) => label.id === id ? { ...label, translations: normalized } : label));
      return true;
    },
    remove(id: string) {
      writeSnapshot(readSnapshot().filter((label) => label.id !== id));
    },
  };
}
