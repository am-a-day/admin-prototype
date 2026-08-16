const configuredNamespace = import.meta.env.VITE_CATALOG_STORAGE_NAMESPACE?.trim() ?? "";
const isDesignLabLocation = typeof window !== "undefined"
  && window.location.pathname.startsWith("/__design/");
const storageNamespace = isDesignLabLocation ? "design-lab" : configuredNamespace;

export const IS_PRAGMATIC_CATALOG_PREVIEW = import.meta.env.VITE_PRAGMATIC_CATALOG_PREVIEW === "true";
export const CATALOG_STORAGE_PREFIX = storageNamespace
  ? `${storageNamespace}.catalog.`
  : "tasko.catalog.";

export function catalogStorageKey(suffix: string) {
  return `${CATALOG_STORAGE_PREFIX}${suffix}`;
}

export function previewScopedStorageKey(defaultKey: string) {
  if (!storageNamespace) return defaultKey;
  return `${storageNamespace}.${defaultKey.replace(/^tasko\./, "")}`;
}

/** Clears only the isolated namespace used by a Design Lab page before its fixture mounts. */
export function resetDesignLabStorage() {
  if (!isDesignLabLocation || typeof window === "undefined") return;
  const prefix = "design-lab.";
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
}

export function resetPragmaticCatalogPreview() {
  if (!IS_PRAGMATIC_CATALOG_PREVIEW || !configuredNamespace) return;
  const prefix = `${configuredNamespace}.`;
  const keys: string[] = [];
  for (let index = 0; index < window.localStorage.length; index += 1) {
    const key = window.localStorage.key(index);
    if (key?.startsWith(prefix)) keys.push(key);
  }
  keys.forEach((key) => window.localStorage.removeItem(key));
  window.location.reload();
}
