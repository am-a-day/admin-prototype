import type { CatalogItem } from "@/data/catalog";
import { catalogStorageKey } from "@/lib/catalog-preview";

export const CATALOG_CREATED_ITEMS_EVENT = "tasko-catalog-created-items-change";

export const CATALOG_PERSISTENCE_KEYS = {
  statusOverrides: catalogStorageKey("statusOverrides"),
  scheduleOverrides: catalogStorageKey("scheduleOverrides"),
  itemSectionOverrides: catalogStorageKey("itemSectionOverrides"),
  positionOrderBySection: catalogStorageKey("positionOrderBySection"),
  createdItems: catalogStorageKey("createdItems"),
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
