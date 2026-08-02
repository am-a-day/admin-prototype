const configuredNamespace = import.meta.env.VITE_CATALOG_STORAGE_NAMESPACE?.trim() ?? "";

export const IS_PRAGMATIC_CATALOG_PREVIEW = import.meta.env.VITE_PRAGMATIC_CATALOG_PREVIEW === "true";
export const CATALOG_STORAGE_PREFIX = configuredNamespace
  ? `${configuredNamespace}.catalog.`
  : "tasko.catalog.";

export function catalogStorageKey(suffix: string) {
  return `${CATALOG_STORAGE_PREFIX}${suffix}`;
}

export function previewScopedStorageKey(defaultKey: string) {
  if (!configuredNamespace) return defaultKey;
  return `${configuredNamespace}.${defaultKey.replace(/^tasko\./, "")}`;
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
