import { CATALOG_STORAGE_PREFIX, catalogStorageKey } from "@/lib/catalog-preview";

export type CatalogDataScenario = "empty" | "demo" | "client";

export const CATALOG_DATA_SCENARIO_STORAGE_KEY = "tasko.prototype.catalogDataScenario.v1";

export function readCatalogDataScenario(): CatalogDataScenario {
  if (typeof window === "undefined") return "client";
  const stored = window.localStorage.getItem(CATALOG_DATA_SCENARIO_STORAGE_KEY);
  return stored === "empty" || stored === "demo" || stored === "client" ? stored : "client";
}

export function writeCatalogDataScenario(scenario: CatalogDataScenario) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(CATALOG_DATA_SCENARIO_STORAGE_KEY, scenario);
}

export function resetCatalogDataScenario(scenario = readCatalogDataScenario()) {
  if (typeof window === "undefined") return;
  const catalogKeys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(CATALOG_STORAGE_PREFIX)) catalogKeys.push(key);
  }
  catalogKeys.forEach((key) => window.localStorage.removeItem(key));
  window.localStorage.setItem(catalogStorageKey("phase"), scenario === "empty" ? "empty" : "has-items");
}

export function selectCatalogDataScenario(scenario: CatalogDataScenario) {
  writeCatalogDataScenario(scenario);
  resetCatalogDataScenario(scenario);
}
