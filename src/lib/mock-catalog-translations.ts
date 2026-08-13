import type { CatalogLanguageCode, CatalogTranslations } from "@/data/catalog";

/**
 * Prototype translation boundary. Until a real translation service exists,
 * copy the source title into every enabled language so downstream language
 * switching and persistence use the same shape as translated content.
 */
export function buildMockCatalogTitleTranslations(
  title: string,
  primaryLanguage: CatalogLanguageCode,
  languages: CatalogLanguageCode[],
  existing: CatalogTranslations = {},
): CatalogTranslations {
  const source = existing[primaryLanguage]?.trim()
    || existing.ru?.trim()
    || title.trim();
  return Object.fromEntries(
    [primaryLanguage, ...languages]
      .filter((code, index, values) => values.indexOf(code) === index)
      .map((code) => [code, existing[code]?.trim() || source]),
  ) as CatalogTranslations;
}

export function getCatalogTitleForLanguage(
  title: string,
  translations: CatalogTranslations | undefined,
  language: CatalogLanguageCode,
  primaryLanguage: CatalogLanguageCode,
) {
  return translations?.[language]?.trim()
    || translations?.[primaryLanguage]?.trim()
    || title;
}
