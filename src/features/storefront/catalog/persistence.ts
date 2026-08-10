import type { CatalogItem, CatalogSection, CatalogTranslations } from "@/data/catalog";
import { catalogStorageKey } from "@/lib/catalog-preview";
import type { CatalogTreeSection } from "./model/tree";

export const CATALOG_CREATED_ITEMS_EVENT = "tasko-catalog-created-items-change";

export const CATALOG_PERSISTENCE_KEYS = {
  statusOverrides: catalogStorageKey("statusOverrides"),
  scheduleOverrides: catalogStorageKey("scheduleOverrides"),
  itemSectionOverrides: catalogStorageKey("itemSectionOverrides"),
  positionOrderBySection: catalogStorageKey("positionOrderBySection"),
  createdItems: catalogStorageKey("createdItems"),
  createdSections: catalogStorageKey("createdSections"),
  itemRecords: catalogStorageKey("itemRecords"),
} as const;

export function readCatalogJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

export function writeCatalogJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // local prototype state is best-effort; UI should keep working without storage.
  }
}

export function removeCatalogValue(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key);
}

export type CatalogPersistedItemRecord = Partial<CatalogItem> & { id: string };

function isPersistedCatalogItemRecord(value: unknown): value is CatalogPersistedItemRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value) && typeof (value as { id?: unknown }).id === "string");
}

/**
 * Canonical item-record boundary. Older per-concern keys are still read by the
 * store as compatibility inputs, but all new editor values are written here.
 */
export function readCatalogItemRecords(): Record<string, CatalogPersistedItemRecord> {
  const value = readCatalogJson<unknown>(CATALOG_PERSISTENCE_KEYS.itemRecords, {});
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, item]) => isPersistedCatalogItemRecord(item)),
  ) as Record<string, CatalogPersistedItemRecord>;
}

export function writeCatalogItemRecords(items: CatalogItem[]) {
  const records = Object.fromEntries(items.map((item) => {
    // Browser object URLs are session-only previews, not durable media records.
    const thumbnailUrl = item.thumbnailUrl?.startsWith("blob:") ? null : item.thumbnailUrl;
    return [item.id, { ...item, thumbnailUrl }];
  }));
  writeCatalogJson<Record<string, CatalogItem>>(CATALOG_PERSISTENCE_KEYS.itemRecords, records);
}

export function readLegacyCatalogTitleTranslations(accountId: string | null | undefined, itemId: string): CatalogTranslations | null {
  if (typeof window === "undefined" || !accountId) return null;
  try {
    const raw = window.localStorage.getItem(`tasko.catalog.translations.${accountId}.item-name-${itemId}`);
    if (!raw) return null;
    const value = JSON.parse(raw) as unknown;
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    return value as CatalogTranslations;
  } catch {
    return null;
  }
}

export function readCreatedCatalogItems() {
  const value = readCatalogJson<unknown>(CATALOG_PERSISTENCE_KEYS.createdItems, []);
  return Array.isArray(value) ? value as CatalogItem[] : [];
}

export function writeCreatedCatalogItems(items: CatalogItem[]) {
  writeCatalogJson(CATALOG_PERSISTENCE_KEYS.createdItems, items);
  if (typeof window !== "undefined") window.dispatchEvent(new Event(CATALOG_CREATED_ITEMS_EVENT));
}

export function removeCreatedCatalogItems(ids: Iterable<string>) {
  const removedIds = new Set(ids);
  writeCreatedCatalogItems(readCreatedCatalogItems().filter((item) => !removedIds.has(item.id)));
}

export type CatalogPersistedSection = CatalogSection & { emoji?: string };

function isPersistedCatalogSection(value: unknown): value is CatalogPersistedSection {
  if (!value || typeof value !== "object") return false;
  const section = value as Record<string, unknown>;
  return typeof section.id === "string"
    && typeof section.name === "string"
    && (section.parentId === null || typeof section.parentId === "string")
    && (section.imageUrl === null || typeof section.imageUrl === "string")
    && (section.sortOrder === undefined || typeof section.sortOrder === "number");
}

export function readCreatedCatalogSections() {
  const value = readCatalogJson<unknown>(CATALOG_PERSISTENCE_KEYS.createdSections, []);
  return Array.isArray(value) ? value.filter(isPersistedCatalogSection) : [];
}

export function writeCreatedCatalogSections(sections: CatalogTreeSection[]) {
  writeCatalogJson<CatalogPersistedSection[]>(CATALOG_PERSISTENCE_KEYS.createdSections, sections.map((section) => ({
    id: section.id,
    parentId: section.parentId ?? null,
    name: section.name,
    ...(section.nameTranslations ? { nameTranslations: section.nameTranslations } : {}),
    imageUrl: section.imageUrl ?? null,
    sortOrder: section.sortOrder ?? 0,
    ...(section.emoji ? { emoji: section.emoji } : {}),
  })));
}
