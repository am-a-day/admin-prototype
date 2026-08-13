import type {
  CatalogItem,
  CatalogLanguageCode,
  CatalogLocalizedValue,
} from "@/data/catalog";

const LANGUAGE_CODES: CatalogLanguageCode[] = ["ru", "kk", "en", "sr"];

function compactText(value: string | null | undefined) {
  return value?.trim().replace(/\s+/g, " ") ?? "";
}

export function normalizeLocalCatalogLabel(
  value: Partial<CatalogLocalizedValue>,
  primaryLanguage: CatalogLanguageCode = "ru",
): CatalogLocalizedValue | null {
  const translations = Object.fromEntries(
    LANGUAGE_CODES
      .map((code) => [code, compactText(value[code])] as const)
      .filter(([, text]) => Boolean(text)),
  ) as Partial<CatalogLocalizedValue>;
  const primaryText = translations[primaryLanguage]
    || translations.ru
    || LANGUAGE_CODES.map((code) => translations[code]).find(Boolean)
    || "";
  if (!primaryText) return null;
  return {
    ru: translations.ru || primaryText,
    ...(translations.kk ? { kk: translations.kk } : {}),
    ...(translations.en ? { en: translations.en } : {}),
    ...(translations.sr ? { sr: translations.sr } : {}),
  };
}

export function getLocalCatalogLabelText(
  value: CatalogLocalizedValue | null | undefined,
  language: CatalogLanguageCode,
  primaryLanguage: CatalogLanguageCode = "ru",
) {
  if (!value) return "";
  return compactText(value[language])
    || compactText(value[primaryLanguage])
    || compactText(value.ru)
    || LANGUAGE_CODES.map((code) => compactText(value[code])).find(Boolean)
    || "";
}

export function normalizeLocalCatalogLabelEdit(
  previous: CatalogLocalizedValue,
  draft: Partial<CatalogLocalizedValue>,
  editedLanguage: CatalogLanguageCode,
  primaryLanguage: CatalogLanguageCode = "ru",
) {
  const nextDraft = editedLanguage === primaryLanguage
    && primaryLanguage !== "ru"
    && draft.ru === previous[primaryLanguage]
    ? { ...draft, ru: draft[primaryLanguage] }
    : draft;
  return normalizeLocalCatalogLabel(nextDraft, primaryLanguage);
}

function localTagsFromItem(item: CatalogItem) {
  if (item.upsell?.tags !== undefined) return item.upsell.tags;
  return item.tags.map((text) => ({ ru: text }));
}

function localStickerFromItem(item: CatalogItem) {
  if (item.upsell?.sticker !== undefined) return item.upsell.sticker;
  return item.guestLabels[0] ? { ru: item.guestLabels[0] } : null;
}

export function getLocalCatalogItemLabels(
  item: CatalogItem,
  primaryLanguage: CatalogLanguageCode = "ru",
) {
  return {
    tags: localTagsFromItem(item)
      .map((value) => normalizeLocalCatalogLabel(value, primaryLanguage))
      .filter((value): value is CatalogLocalizedValue => Boolean(value)),
    sticker: normalizeLocalCatalogLabel(localStickerFromItem(item) ?? {}, primaryLanguage),
  };
}

export function buildLocalCatalogLabelPatch(
  item: CatalogItem,
  labels: { tags: CatalogLocalizedValue[]; sticker: CatalogLocalizedValue | null },
  primaryLanguage: CatalogLanguageCode = "ru",
): Partial<CatalogItem> {
  const tags = labels.tags
    .map((value) => normalizeLocalCatalogLabel(value, primaryLanguage))
    .filter((value): value is CatalogLocalizedValue => Boolean(value));
  const sticker = normalizeLocalCatalogLabel(labels.sticker ?? {}, primaryLanguage);
  return {
    // Local edits intentionally stop referencing the shared directory. If the
    // flag is enabled later, its legacy migration resolves these names again.
    tagIds: undefined,
    stickerId: undefined,
    tags: tags.map((value) => getLocalCatalogLabelText(value, primaryLanguage, primaryLanguage)),
    guestLabels: sticker
      ? [getLocalCatalogLabelText(sticker, primaryLanguage, primaryLanguage)]
      : [],
    upsell: {
      ...(item.upsell ?? {}),
      tags,
      sticker,
    },
  };
}

export function createLocalCatalogLabel(
  name: string,
  primaryLanguage: CatalogLanguageCode = "ru",
) {
  return normalizeLocalCatalogLabel({
    ru: name,
    [primaryLanguage]: name,
  }, primaryLanguage);
}
