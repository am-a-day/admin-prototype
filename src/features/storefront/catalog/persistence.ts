import type { CatalogItem, CatalogSection } from "@/data/catalog";
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
    imageUrl: section.imageUrl ?? null,
    sortOrder: section.sortOrder ?? 0,
    ...(section.emoji ? { emoji: section.emoji } : {}),
  })));
}
