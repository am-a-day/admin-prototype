import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useCatalogStore } from "@/contexts/catalog-store-context";
import {
  DEFAULT_WORKSPACE_ADDRESS,
  useMockAuth,
  type MockWorkspace,
} from "@/contexts/mock-auth-context";
import type { CatalogItem, CatalogLocalizedValue, CatalogSection, CatalogTranslations } from "@/data/catalog";
import { DEFAULT_RECOMMENDATION_TEXTS, banners as seedBanners, type Banner } from "@/data/mock-data";
import type { LanguageCode } from "@/data/languages";
import { getLanguage } from "@/data/languages";
import { useAppSettings } from "@/contexts/app-settings-context";
import {
  useCatalogLabels,
  type CatalogLabel,
} from "@/features/storefront/catalog/labels/catalog-labels";
import { USE_SHARED_TAGS_AND_STICKERS } from "@/features/storefront/catalog/feature-flags";
import {
  buildLocalCatalogLabelPatch,
  getLocalCatalogItemLabels,
  getLocalCatalogLabelText,
} from "@/features/storefront/catalog/labels/local-catalog-labels";

export type TranslationLanguageCode = LanguageCode;
export type TranslationStatus = "missing" | "machine" | "translated" | "outdated";
export type TranslationCategory = "positions" | "sections" | "tags" | "stickers" | "banners" | "about" | "interface";
export type TranslationFilter = "all" | "review" | "missing";
export type TranslationJobStatus = "queued" | "running" | "completed" | "error";
export type TranslationMaterialKind = "position" | "section" | "tag" | "sticker" | "banner" | "about" | "interface";
export type TranslationFieldKind = "standard" | "option-group" | "option" | "banner-tag";

export type TranslationField = {
  id: string;
  label: string;
  source: string;
  previousSource?: string;
  kind?: TranslationFieldKind;
  optionGroupId?: string;
  optionVariantId?: string;
  bannerTagId?: string;
  values: Partial<Record<TranslationLanguageCode, string>>;
  manuallyEditedLanguages?: TranslationLanguageCode[];
  machineTranslatedLanguages?: TranslationLanguageCode[];
  reviewLanguages?: TranslationLanguageCode[];
};

export type TranslationMaterial = {
  id: string;
  entityId: string;
  ownerItemId?: string;
  ownerItemIds?: string[];
  localLabelSource?: string;
  catalogItemId?: string;
  title: string;
  typeLabel: string;
  kind: TranslationMaterialKind;
  category: TranslationCategory;
  sourceChangedAt?: string;
  statuses: Record<TranslationLanguageCode, TranslationStatus>;
  fields: TranslationField[];
};

export type TranslationLanguage = {
  code: TranslationLanguageCode;
  label: string;
  locale: string;
  published: boolean;
  doneFields: number;
  totalFields: number;
  missing: number;
  outdated: number;
  autoTranslate: boolean;
};

export type CatalogPositionLanguageProgress = {
  code: TranslationLanguageCode;
  label: string;
  filled: number;
  total: number;
  outdated: boolean;
  tooltip: string;
};

export type TranslationJob = {
  id: string;
  language: TranslationLanguageCode;
  source: string;
  materialIds: string[];
  total: number;
  completed: number;
  status: TranslationJobStatus;
  publishAfterComplete?: boolean;
  publicationMode?: "preserve" | "publish" | "review";
  fieldIdsByMaterial?: Record<string, string[]>;
  reviewFieldIdsByMaterial?: Record<string, string[]>;
  preserveManualTranslations?: boolean;
  startedAt: number;
  finishesAt: number;
};

export type TranslationToast = {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
};

type WorkspaceTarget = {
  language?: TranslationLanguageCode;
  category?: TranslationCategory;
  materialId?: string;
};

type TranslationsContextValue = {
  languages: TranslationLanguage[];
  materials: TranslationMaterial[];
  jobs: TranslationJob[];
  banners: Banner[];
  toast: TranslationToast | null;
  activeLanguage: TranslationLanguageCode;
  activeCategory: TranslationCategory;
  activeMaterialId: string | null;
  catalogBulkRequest: string[] | null;
  saveState: "idle" | "saving" | "saved" | "error";
  primaryLanguageConfirmed: boolean;
  suggestedPrimaryLanguage: TranslationLanguageCode;
  workspaceRequested: boolean;
  setActiveLanguage: (language: TranslationLanguageCode) => void;
  setActiveCategory: (category: TranslationCategory) => void;
  setActiveMaterialId: (materialId: string | null) => void;
  openWorkspace: (target?: WorkspaceTarget) => void;
  openCatalogBulk: (itemIds: string[]) => void;
  closeCatalogBulk: () => void;
  addLanguage: (language: TranslationLanguageCode, publishAfterComplete: boolean) => void;
  confirmPrimaryLanguage: (language: TranslationLanguageCode) => void;
  removeLanguage: (language: TranslationLanguageCode) => void;
  setPrimaryLanguage: (language: TranslationLanguageCode) => void;
  setPublished: (language: TranslationLanguageCode, published: boolean) => void;
  setJobPublishAfterComplete: (jobId: string, enabled: boolean) => void;
  retryTranslationJob: (jobId: string) => void;
  setAutoTranslate: (language: TranslationLanguageCode, enabled: boolean) => void;
  updateField: (materialId: string, fieldId: string, language: TranslationLanguageCode, value: string, origin?: "manual" | "machine") => void;
  confirmMaterial: (materialId: string, language: TranslationLanguageCode) => void;
  confirmField: (materialId: string, fieldId: string, language: TranslationLanguageCode) => void;
  startAutoTranslate: (languageCodes: TranslationLanguageCode[], materialIds: string[], source: string, publishAfterComplete?: boolean) => void;
  autoTranslateField: (materialId: string, fieldId: string, language: TranslationLanguageCode) => void;
  updateBanner: (id: string, patch: Partial<Banner>) => void;
  removeBanner: (id: string) => string | null;
  addBanner: (imageUrl?: string) => string;
  dismissToast: () => void;
  consumeWorkspaceRequest: () => void;
  getCatalogSummary: (item: CatalogItem) => { languages: CatalogPositionLanguageProgress[] };
};

const TranslationsContext = createContext<TranslationsContextValue | null>(null);

const LANGUAGE_DETAILS: Record<TranslationLanguageCode, Pick<TranslationLanguage, "label" | "locale">> = {
  ru: { label: "Русский", locale: "ru-RU" },
  kk: { label: "Қазақша", locale: "kk-KZ" },
  en: { label: "English", locale: "en-US" },
  zh: { label: "中文", locale: "zh-CN" },
  fr: { label: "Français", locale: "fr-FR" },
  es: { label: "Español", locale: "es-ES" },
  sr: { label: "Srpski", locale: "sr-RS" },
};

const SEEDED_TRANSLATIONS: Record<string, Partial<Record<TranslationLanguageCode, Record<string, string>>>> = {
  "Цезарь с курицей": {
    kk: {
      title: "Тауық еті қосылған Цезарь",
      description: "Грильде пісірілген тауық төсі, салат жапырақтары, қытырлақ нан және пармезан.",
    },
    en: { title: "Chicken Caesar", description: "Grilled chicken breast, romaine, parmesan and Caesar dressing." },
  },
  Латте: {
    kk: { title: "Латте", description: "Жұмсақ дәмі мен хош иісі үйлескен сүтті кофе." },
    en: { title: "Latte", description: "Milk coffee with a smooth taste and aroma." },
  },
};

const LABEL_TRANSLATIONS: Record<string, Partial<Record<TranslationLanguageCode, string>>> = {
  Острое: { kk: "Ащы", en: "Spicy" },
  Халяль: { kk: "Халал", en: "Halal" },
  Вегетарианское: { kk: "Вегетариандық", en: "Vegetarian" },
  Хит: { kk: "Хит", en: "Popular" },
  Новинка: { kk: "Жаңа", en: "New" },
  "Выбор шефа": { kk: "Шеф таңдауы", en: "Chef’s choice" },
};

const TRANSLATION_LANGUAGE_CODES: TranslationLanguageCode[] = ["ru", "kk", "en", "zh", "fr", "es", "sr"];
const TRANSLATION_JOBS_STORAGE_PREFIX = "tasko.translations.jobs.v1";
const TRANSLATION_SECTIONS_STORAGE_PREFIX = "tasko.translations.sections.v1";
const TRANSLATION_BANNERS_STORAGE_PREFIX = "tasko.translations.banners.v1";
const TRANSLATION_MANUAL_FIELDS_STORAGE_PREFIX = "tasko.translations.manual-fields.v1";
const TRANSLATION_FIELD_METADATA_STORAGE_PREFIX = "tasko.translations.field-metadata.v1";
const TRANSLATION_SOURCE_SNAPSHOT_STORAGE_PREFIX = "tasko.translations.source-snapshot.v1";
const TRANSLATION_PRIMARY_CONFIRMED_STORAGE_PREFIX = "tasko.translations.primary-language-confirmed.v1";
const TRANSLATION_ACTIVE_LANGUAGE_STORAGE_PREFIX = "tasko.translations.active-language.v1";

function readPrimaryLanguageConfirmed(accountId: string | undefined) {
  if (!accountId || typeof window === "undefined") return false;
  return window.localStorage.getItem(`${TRANSLATION_PRIMARY_CONFIRMED_STORAGE_PREFIX}.${accountId}`) === "true";
}

function readActiveTranslationLanguage(accountId: string | undefined): TranslationLanguageCode {
  if (!accountId || typeof window === "undefined") return "kk";
  const stored = window.localStorage.getItem(`${TRANSLATION_ACTIVE_LANGUAGE_STORAGE_PREFIX}.${accountId}`);
  return TRANSLATION_LANGUAGE_CODES.includes(stored as TranslationLanguageCode)
    ? stored as TranslationLanguageCode
    : "kk";
}

function detectContentLanguage(
  workspace: MockWorkspace | undefined,
  items: CatalogItem[],
  sections: CatalogSection[],
): TranslationLanguageCode {
  const sample = [
    workspace?.name,
    workspace?.description,
    ...sections.slice(0, 12).map((section) => section.name),
    ...items.slice(0, 24).flatMap((item) => [item.title, stripHtml(item.description)]),
  ].filter(Boolean).join(" ");
  const countMatches = (pattern: RegExp) => (sample.match(pattern) ?? []).length;
  const counts: Partial<Record<TranslationLanguageCode, number>> = {
    zh: countMatches(/[\u3400-\u9fff]/g),
    kk: countMatches(/[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/g) * 12,
    ru: countMatches(/[а-яёА-ЯЁ]/g),
    sr: (countMatches(/[čćžšđČĆŽŠĐ]/g) + countMatches(/[јљњћђџЈЉЊЋЂЏ]/g)) * 12,
    fr: countMatches(/[àâçéèêëîïôûùüÿœæÀÂÇÉÈÊËÎÏÔÛÙÜŸŒÆ]/g) * 12
      + countMatches(/\b(le|la|les|des|une|avec|pour|restaurant)\b/gi) * 4,
    es: countMatches(/[áéíóúüñ¿¡ÁÉÍÓÚÜÑ]/g) * 12
      + countMatches(/\b(el|los|las|una|con|para|restaurante)\b/gi) * 4,
    en: countMatches(/[a-zA-Z]/g),
  };
  const detected = (Object.entries(counts) as Array<[TranslationLanguageCode, number]>)
    .sort((left, right) => right[1] - left[1])[0];
  return detected && detected[1] > 0 ? detected[0] : workspace?.primaryLanguage ?? "ru";
}

function readStoredTranslationJobs(accountId: string | undefined): TranslationJob[] {
  if (!accountId || typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(`${TRANSLATION_JOBS_STORAGE_PREFIX}.${accountId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as TranslationJob[];
    return parsed.filter((job) => job?.id && job?.language && Array.isArray(job.materialIds));
  } catch {
    return [];
  }
}

function readStoredBanners(accountId: string | undefined): Banner[] {
  if (!accountId || typeof window === "undefined") return seedBanners;
  try {
    const raw = window.localStorage.getItem(`${TRANSLATION_BANNERS_STORAGE_PREFIX}.${accountId}`);
    return raw ? JSON.parse(raw) as Banner[] : seedBanners;
  } catch {
    return seedBanners;
  }
}

function readStoredSectionTranslations(accountId: string | undefined) {
  if (!accountId || typeof window === "undefined") {
    return {} as Record<string, Partial<Record<TranslationLanguageCode, string>>>;
  }
  try {
    const raw = window.localStorage.getItem(`${TRANSLATION_SECTIONS_STORAGE_PREFIX}.${accountId}`);
    return raw
      ? JSON.parse(raw) as Record<string, Partial<Record<TranslationLanguageCode, string>>>
      : {};
  } catch {
    return {};
  }
}

function applyStoredSectionTranslations(
  materials: TranslationMaterial[],
  accountId: string | undefined,
) {
  const stored = readStoredSectionTranslations(accountId);
  return materials.map((material) => {
    if (material.kind !== "section" || !stored[material.entityId]) return material;
    const values = stored[material.entityId];
    return {
      ...material,
      fields: material.fields.map((field) => ({
        ...field,
        values: { ...field.values, ...values },
      })),
      statuses: {
        ...material.statuses,
        ...Object.fromEntries(Object.entries(values).map(([language, value]) => [
          language,
          value?.trim() ? "machine" : material.statuses[language as TranslationLanguageCode],
        ])),
      },
    };
  });
}

function readStoredManualFields(accountId: string | undefined) {
  if (!accountId || typeof window === "undefined") {
    return {} as Record<string, TranslationLanguageCode[]>;
  }
  try {
    const raw = window.localStorage.getItem(`${TRANSLATION_MANUAL_FIELDS_STORAGE_PREFIX}.${accountId}`);
    return raw ? JSON.parse(raw) as Record<string, TranslationLanguageCode[]> : {};
  } catch {
    return {};
  }
}

type StoredFieldMetadata = Record<string, {
  manuallyEditedLanguages?: TranslationLanguageCode[];
  machineTranslatedLanguages?: TranslationLanguageCode[];
  reviewLanguages?: TranslationLanguageCode[];
}>;

function readStoredFieldMetadata(accountId: string | undefined): StoredFieldMetadata {
  if (!accountId || typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(`${TRANSLATION_FIELD_METADATA_STORAGE_PREFIX}.${accountId}`);
    return raw ? JSON.parse(raw) as StoredFieldMetadata : {};
  } catch {
    return {};
  }
}

function persistFieldMetadata(
  accountId: string | undefined,
  materialId: string,
  field: TranslationField,
) {
  if (!accountId || typeof window === "undefined") return;
  const stored = readStoredFieldMetadata(accountId);
  window.localStorage.setItem(
    `${TRANSLATION_FIELD_METADATA_STORAGE_PREFIX}.${accountId}`,
    JSON.stringify({
      ...stored,
      [`${materialId}:${field.id}`]: {
        manuallyEditedLanguages: field.manuallyEditedLanguages ?? [],
        machineTranslatedLanguages: field.machineTranslatedLanguages ?? [],
        reviewLanguages: field.reviewLanguages ?? [],
      },
    }),
  );
}

function applyStoredFieldMetadata(materials: TranslationMaterial[], accountId: string | undefined) {
  const stored = readStoredFieldMetadata(accountId);
  const legacyManualFields = readStoredManualFields(accountId);
  return materials.map((material) => ({
    ...material,
    fields: material.fields.map((field) => {
      const metadata = stored[`${material.id}:${field.id}`];
      return {
        ...field,
        manuallyEditedLanguages: metadata?.manuallyEditedLanguages
          ?? legacyManualFields[`${material.id}:${field.id}`]
          ?? field.manuallyEditedLanguages,
        machineTranslatedLanguages: metadata?.machineTranslatedLanguages
          ?? field.machineTranslatedLanguages,
        reviewLanguages: metadata?.reviewLanguages ?? field.reviewLanguages,
      };
    }),
  }));
}

function readStoredSourceSnapshot(
  accountId: string | undefined,
  fallback: Map<string, string>,
) {
  if (!accountId || typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(`${TRANSLATION_SOURCE_SNAPSHOT_STORAGE_PREFIX}.${accountId}`);
    return raw ? new Map(Object.entries(JSON.parse(raw) as Record<string, string>)) : fallback;
  } catch {
    return fallback;
  }
}

function persistSourceSnapshot(accountId: string | undefined, snapshot: Map<string, string>) {
  if (!accountId || typeof window === "undefined") return;
  window.localStorage.setItem(
    `${TRANSLATION_SOURCE_SNAPSHOT_STORAGE_PREFIX}.${accountId}`,
    JSON.stringify(Object.fromEntries(snapshot)),
  );
}

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function seededStatus(title: string, index: number, language: TranslationLanguageCode): TranslationStatus {
  if (language === "ru") return "translated";
  if (language === "sr") return "missing";
  if (language === "kk") {
    if (title === "Цезарь с курицей") return "translated";
    if (title.toLocaleLowerCase().startsWith("том-ям")) return "missing";
    if (title === "Латте") return "machine";
    if (/bbq/i.test(title)) return "outdated";
    const bucket = index % 10;
    if (bucket === 0) return "machine";
    if (bucket < 7) return "translated";
    return "missing";
  }
  if (language === "en") return index % 9 === 0 ? "missing" : "translated";
  return index % 12 === 0 ? "machine" : "translated";
}

function fallbackTarget(source: string, language: TranslationLanguageCode, status: TranslationStatus) {
  if (status === "missing") return "";
  if (language === "ru") return source;
  const prefix = LANGUAGE_DETAILS[language].label;
  return `[${prefix}] ${source}`;
}

function materialStatuses(
  title: string,
  index: number,
  valuesByLanguage?: Partial<Record<TranslationLanguageCode, string[]>>,
): Record<TranslationLanguageCode, TranslationStatus> {
  const allFilled = (values: string[] | undefined) => Boolean(values?.length)
    && values!.every((value) => Boolean(value.trim()));
  return Object.fromEntries(TRANSLATION_LANGUAGE_CODES.map((language) => [
    language,
    language === "ru" || allFilled(valuesByLanguage?.[language])
      ? "translated"
      : seededStatus(title, index, language),
  ])) as Record<TranslationLanguageCode, TranslationStatus>;
}

function resolveMaterialFields(title: string, index: number, rawFields: TranslationField[]) {
  const filledSourceFields = rawFields.filter((field) => field.source.trim());
  const statuses = materialStatuses(title, index, Object.fromEntries(
    TRANSLATION_LANGUAGE_CODES.map((language) => [
      language,
      filledSourceFields.map((field) => field.values[language] ?? ""),
    ]),
  ));
  const fields = rawFields.map((field) => ({
    ...field,
    values: Object.fromEntries(TRANSLATION_LANGUAGE_CODES.map((language) => [
      language,
      field.source.trim()
        ? field.values[language]?.trim() || fallbackTarget(field.source, language, statuses[language])
        : "",
    ])),
  }));
  return { fields, statuses };
}

function localizedSource(
  baseValue: string,
  translations: Partial<Record<TranslationLanguageCode, string>> | undefined,
  primaryLanguage: TranslationLanguageCode,
) {
  return primaryLanguage === "ru"
    ? baseValue
    : translations?.[primaryLanguage]?.trim() || baseValue;
}

function positionMaterial(
  item: CatalogItem,
  index: number,
  primaryLanguage: TranslationLanguageCode,
): TranslationMaterial {
  const description = stripHtml(item.description);
  const translatedValues = (
    baseValue: string,
    translations?: CatalogTranslations,
    seededKey?: "title" | "description",
  ) => Object.fromEntries(
    TRANSLATION_LANGUAGE_CODES.map((language) => [
      language,
      language === "ru"
        ? baseValue
        : translations?.[language] || (seededKey ? SEEDED_TRANSLATIONS[item.title]?.[language]?.[seededKey] : "") || "",
    ]),
  );
  const rawFields: TranslationField[] = [{
    id: "title",
    label: "Название",
    source: localizedSource(item.title, item.titleTranslations, primaryLanguage),
    values: translatedValues(item.title, item.titleTranslations, "title"),
  }, {
    id: "description",
    label: "Описание",
    source: localizedSource(description, item.descriptionTranslations, primaryLanguage),
    values: translatedValues(description, item.descriptionTranslations, "description"),
  }, ...(item.optionGroups ?? []).flatMap((group) => [{
    id: `option-group:${group.id}`,
    label: `Группа · ${group.name || "Без названия"}`,
    source: localizedSource(group.name, group.nameTranslations, primaryLanguage),
    kind: "option-group" as const,
    optionGroupId: group.id,
    values: translatedValues(group.name, group.nameTranslations),
  }, ...group.variants.map((variant) => ({
    id: `option:${group.id}:${variant.id}`,
    label: `Опция · ${variant.name || "Без названия"}`,
    source: localizedSource(variant.name, variant.nameTranslations, primaryLanguage),
    kind: "option" as const,
    optionGroupId: group.id,
    optionVariantId: variant.id,
    values: translatedValues(variant.name, variant.nameTranslations),
  }))])];
  const { fields, statuses } = resolveMaterialFields(item.title, index, rawFields);
  return {
    id: item.id,
    entityId: item.id,
    catalogItemId: item.id,
    title: item.title,
    typeLabel: "Позиция",
    kind: "position",
    category: "positions",
    statuses,
    fields,
  };
}

function sectionMaterial(section: CatalogSection, index: number, primaryLanguage: TranslationLanguageCode): TranslationMaterial {
  const rawFields: TranslationField[] = [{
    id: "name",
    label: "Название",
    source: localizedSource(section.name, section.nameTranslations, primaryLanguage),
    values: Object.fromEntries(TRANSLATION_LANGUAGE_CODES.map((language) => [
      language,
      language === "ru" ? section.name : section.nameTranslations?.[language] ?? "",
    ])),
  }];
  const { fields, statuses } = resolveMaterialFields(section.name, index, rawFields);
  return {
    id: `section:${section.id}`,
    entityId: section.id,
    title: section.name,
    typeLabel: section.parentId ? "Подраздел" : "Раздел",
    kind: "section",
    category: "sections",
    statuses,
    fields,
  };
}

function labelMaterial(label: CatalogLabel, index: number, primaryLanguage: TranslationLanguageCode): TranslationMaterial {
  const russianSource = label.translations.ru;
  const source = localizedSource(russianSource, label.translations, primaryLanguage);
  const seed = LABEL_TRANSLATIONS[russianSource] ?? {};
  const { fields, statuses } = resolveMaterialFields(source, index, [{
    id: "name",
    label: "Название",
    source,
    values: {
      ru: russianSource,
      kk: label.translations.kk ?? seed.kk ?? "",
      en: label.translations.en ?? seed.en ?? "",
      sr: label.translations.sr ?? seed.sr ?? "",
    },
  }]);
  return {
    id: label.id,
    entityId: label.id,
    title: source,
    typeLabel: label.type === "tag" ? "Тег" : "Стикер",
    kind: label.type,
    category: label.type === "tag" ? "tags" : "stickers",
    statuses,
    fields,
  };
}

function localLabelValues(value: CatalogLocalizedValue) {
  return Object.fromEntries(TRANSLATION_LANGUAGE_CODES.map((language) => [
    language,
    value[language] ?? "",
  ]));
}

function localLabelMaterials(
  items: CatalogItem[],
  primaryLanguage: TranslationLanguageCode,
): TranslationMaterial[] {
  type LocalLabelGroup = {
    type: "tag" | "sticker";
    source: string;
    value: CatalogLocalizedValue;
    ownerItemIds: string[];
  };
  const groups = new Map<string, LocalLabelGroup>();
  const register = (type: LocalLabelGroup["type"], value: CatalogLocalizedValue, itemId: string) => {
    const source = getLocalCatalogLabelText(value, primaryLanguage, primaryLanguage);
    const key = `${type}:${source.toLocaleLowerCase("ru")}`;
    const existing = groups.get(key);
    if (existing) {
      if (!existing.ownerItemIds.includes(itemId)) existing.ownerItemIds.push(itemId);
      TRANSLATION_LANGUAGE_CODES.forEach((language) => {
        if (!existing.value[language] && value[language]) existing.value[language] = value[language];
      });
      return;
    }
    groups.set(key, { type, source, value: { ...value }, ownerItemIds: [itemId] });
  };
  items.forEach((item) => {
    const labels = getLocalCatalogItemLabels(item, primaryLanguage);
    labels.tags.forEach((tag) => register("tag", tag, item.id));
    if (labels.sticker) register("sticker", labels.sticker, item.id);
  });
  return [...groups.values()].map((group, index) => {
    const id = `local-${group.type}:${encodeURIComponent(group.source.toLocaleLowerCase("ru"))}`;
    const { fields, statuses } = resolveMaterialFields(group.source, index, [{
      id: "name",
      label: "Название",
      source: group.source,
      values: localLabelValues(group.value),
    }]);
    return {
      id,
      entityId: id,
      ownerItemIds: group.ownerItemIds,
      localLabelSource: group.source,
      title: group.source,
      typeLabel: group.type === "tag" ? "Тег" : "Стикер",
      kind: group.type,
      category: group.type === "tag" ? "tags" : "stickers",
      statuses,
      fields,
    };
  });
}

function buildLocalLabelTranslationPatch(
  item: CatalogItem,
  material: TranslationMaterial,
  language: TranslationLanguageCode,
  primaryLanguage: TranslationLanguageCode,
  resolveValue: (fieldId: string, currentValue: string) => string,
) {
  const labels = getLocalCatalogItemLabels(item, primaryLanguage);
  const translateValue = (value: CatalogLocalizedValue, fieldId: string): CatalogLocalizedValue => ({
    ...value,
    [language]: resolveValue(fieldId, value[language] ?? ""),
  });
  if (material.kind === "tag") {
    return buildLocalCatalogLabelPatch(item, {
      tags: labels.tags.map((tag) => (
        getLocalCatalogLabelText(tag, primaryLanguage, primaryLanguage) === material.localLabelSource
          ? translateValue(tag, "name")
          : tag
      )),
      sticker: labels.sticker,
    }, primaryLanguage);
  }
  return buildLocalCatalogLabelPatch(item, {
    tags: labels.tags,
    sticker: labels.sticker
      && getLocalCatalogLabelText(labels.sticker, primaryLanguage, primaryLanguage) === material.localLabelSource
      ? translateValue(labels.sticker, "name")
      : labels.sticker,
  }, primaryLanguage);
}

function buildPositionTranslationPatch(
  item: CatalogItem,
  language: TranslationLanguageCode,
  translatedFields: TranslationField[],
): Partial<CatalogItem> {
  const valueFor = (fieldId: string) => translatedFields.find((field) => field.id === fieldId)?.values[language] ?? "";
  return {
    titleTranslations: { ...item.titleTranslations, ru: item.title, [language]: valueFor("title") },
    descriptionTranslations: {
      ...item.descriptionTranslations,
      ru: stripHtml(item.description),
      [language]: valueFor("description"),
    },
    optionGroups: (item.optionGroups ?? []).map((group) => ({
      ...group,
      nameTranslations: {
        ...group.nameTranslations,
        ru: group.name,
        [language]: valueFor(`option-group:${group.id}`),
      },
      variants: group.variants.map((variant) => ({
        ...variant,
        nameTranslations: {
          ...variant.nameTranslations,
          ru: variant.name,
          [language]: valueFor(`option:${group.id}:${variant.id}`),
        },
      })),
    })),
  };
}

function bannerMaterial(banner: Banner, index: number, primaryLanguage: TranslationLanguageCode): TranslationMaterial {
  const rawFields: TranslationField[] = [{
    id: "subtitle",
    label: "Надпись на баннере",
    source: localizedSource(banner.subtitle, banner.subtitleTranslations, primaryLanguage),
    values: Object.fromEntries(TRANSLATION_LANGUAGE_CODES.map((language) => [
      language,
      language === "ru" ? banner.subtitle : banner.subtitleTranslations?.[language] ?? "",
    ])),
  }, ...banner.tags.map((tag) => ({
    id: `tag:${tag.id}`,
    label: `Тег · ${tag.texts.ru || "Без текста"}`,
    source: localizedSource(tag.texts.ru, {
      kk: tag.texts.kz,
      en: tag.texts.en,
      sr: tag.texts.sr,
    }, primaryLanguage),
    kind: "banner-tag" as const,
    bannerTagId: tag.id,
    values: {
      ru: tag.texts.ru,
      kk: tag.texts.kz,
      en: tag.texts.en,
      sr: tag.texts.sr ?? "",
    },
  }))];
  const { fields, statuses } = resolveMaterialFields(banner.title, index, rawFields);
  return {
    id: `banner:${banner.id}`,
    entityId: banner.id,
    title: banner.title,
    typeLabel: "Баннер",
    kind: "banner",
    category: "banners",
    statuses,
    fields,
  };
}

export function buildTranslationMaterials(
  items: CatalogItem[],
  sections: CatalogSection[],
  labels: CatalogLabel[],
  banners: Banner[],
  workspace: MockWorkspace | undefined,
) {
  const primaryLanguage = workspace?.primaryLanguage ?? "ru";
  const positionMaterials = items.map((item, index) => positionMaterial(item, index, primaryLanguage));
  const sectionMaterials = sections.map((section, index) => sectionMaterial(section, index, primaryLanguage));
  const labelMaterials = USE_SHARED_TAGS_AND_STICKERS
    ? labels.map((label, index) => labelMaterial(label, index, primaryLanguage))
    : localLabelMaterials(items, primaryLanguage);
  const bannerMaterials = banners.map((banner, index) => bannerMaterial(banner, index, primaryLanguage));
  const aboutMaterials: TranslationMaterial[] = workspace ? (() => {
    const aboutName = workspace.name?.trim() ?? "";
    const address = workspace.address ?? DEFAULT_WORKSPACE_ADDRESS;
    const description = workspace.description ?? "";
    const { fields, statuses } = resolveMaterialFields("О заведении", 0, [{
      id: "name",
      label: "Название заведения",
      source: localizedSource(aboutName, workspace.localizedNames, primaryLanguage),
      values: {
        ru: aboutName,
        kk: workspace?.localizedNames?.kk ?? "",
        en: workspace?.localizedNames?.en ?? "",
        sr: workspace?.localizedNames?.sr ?? "",
      },
    }, {
      id: "address",
      label: "Адрес",
      source: localizedSource(address, workspace.localizedAddresses, primaryLanguage),
      values: {
        ru: address,
        kk: workspace.localizedAddresses?.kk ?? "",
        en: workspace.localizedAddresses?.en ?? "",
        sr: workspace.localizedAddresses?.sr ?? "",
      },
    }, {
      id: "description",
      label: "Описание",
      source: localizedSource(description, workspace.localizedDescriptions, primaryLanguage),
      values: {
        ru: description,
        kk: workspace.localizedDescriptions?.kk ?? "",
        en: workspace.localizedDescriptions?.en ?? "",
        sr: workspace.localizedDescriptions?.sr ?? "",
      },
    }]);
    return [{
      id: "about:venue",
      entityId: "venue",
      title: "О заведении",
      typeLabel: "Страница",
      kind: "about" as const,
      category: "about" as const,
      statuses,
      fields,
    }];
  })() : [];
  const interfaceSource = DEFAULT_RECOMMENDATION_TEXTS;
  const interfaceValue = (source: string) => Object.fromEntries(
    TRANSLATION_LANGUAGE_CODES.map((language) => [
      language,
      language === "ru" ? source : fallbackTarget(source, language, "machine"),
    ]),
  );
  const resolvedInterface = resolveMaterialFields("Заголовки и кнопки", 0, [
    { id: "home", label: "Главная", source: localizedSource(interfaceSource.home, interfaceValue(interfaceSource.home), primaryLanguage), values: interfaceValue(interfaceSource.home) },
    { id: "dish", label: "Карточка позиции", source: localizedSource(interfaceSource.dish, interfaceValue(interfaceSource.dish), primaryLanguage), values: interfaceValue(interfaceSource.dish) },
    { id: "cart", label: "Корзина", source: localizedSource(interfaceSource.cart, interfaceValue(interfaceSource.cart), primaryLanguage), values: interfaceValue(interfaceSource.cart) },
  ]);
  const interfaceMaterials: TranslationMaterial[] = [{
    id: "interface:recommendations",
    entityId: "recommendations",
    title: "Заголовки и кнопки",
    typeLabel: "Интерфейс",
    kind: "interface",
    category: "interface",
    statuses: resolvedInterface.statuses,
    fields: resolvedInterface.fields,
  }];
  return [...positionMaterials, ...sectionMaterials, ...labelMaterials, ...bannerMaterials, ...aboutMaterials, ...interfaceMaterials];
}

function translationStatusForFields(
  fields: TranslationField[],
  language: TranslationLanguageCode,
): TranslationStatus {
  const translatable = fields.filter((field) => field.source.trim());
  if (translatable.some((field) => field.reviewLanguages?.includes(language))) return "outdated";
  if (translatable.some((field) => !field.values[language]?.trim())) return "missing";
  return translatable.some((field) => !field.manuallyEditedLanguages?.includes(language)) ? "machine" : "translated";
}

export function summarizeLanguageProgress(
  materials: TranslationMaterial[],
  language: TranslationLanguageCode,
) {
  let totalFields = 0;
  let doneFields = 0;
  let missing = 0;
  let outdated = 0;

  materials.forEach((material) => {
    const fields = material.fields.filter((field) => field.source.trim());
    fields.forEach((field) => {
      totalFields += 1;
      const isOutdated = field.reviewLanguages?.includes(language) ?? false;
      if (isOutdated) outdated += 1;
      else if (field.values[language]?.trim()) doneFields += 1;
      else missing += 1;
    });
  });

  return { totalFields, doneFields, missing, outdated };
}

export function summarizeCatalogPositionTranslations(
  material: Pick<TranslationMaterial, "fields">,
  languageCodes: TranslationLanguageCode[],
): CatalogPositionLanguageProgress[] {
  const fields = material.fields.filter((field) => (
    (field.id === "title" || field.id === "description") && field.source.trim()
  ));

  return languageCodes.map((code) => {
    const missingFields = fields.filter((field) => !field.values[code]?.trim());
    const outdatedFields = fields.filter((field) => (
      Boolean(field.values[code]?.trim()) && field.reviewLanguages?.includes(code)
    ));
    const filled = fields.length - missingFields.length - outdatedFields.length;
    const detailLines = [
      missingFields.length > 0
        ? `Не переведено: ${missingFields.map((field) => field.label.toLocaleLowerCase("ru")).join(", ")}`
        : null,
      outdatedFields.length > 0
        ? `Требует обновления: ${outdatedFields.map((field) => field.label.toLocaleLowerCase("ru")).join(", ")}`
        : null,
    ].filter((line): line is string => Boolean(line));

    return {
      code,
      label: LANGUAGE_DETAILS[code].label,
      filled,
      total: fields.length,
      outdated: outdatedFields.length > 0,
      tooltip: fields.length === 0
        ? "Нет заполненных полей оригинала"
        : detailLines.length > 0
          ? detailLines.join("\n")
          : "Все поля переведены",
    };
  });
}

function mergeRealMaterials(current: TranslationMaterial[], fresh: TranslationMaterial[]) {
  const currentById = new Map(current.map((material) => [material.id, material]));
  return fresh.map((material) => {
    const previous = currentById.get(material.id);
    if (!previous) return material;
    const previousFields = new Map(previous.fields.map((field) => [field.id, field]));
    return {
      ...material,
      statuses: previous.statuses,
      sourceChangedAt: previous.sourceChangedAt,
      fields: material.fields.map((field) => {
        const previousField = previousFields.get(field.id);
        return previousField
          ? {
            ...field,
            previousSource: previousField.source !== field.source
              ? previousField.source
              : previousField.previousSource,
            values: field.source.trim() ? { ...field.values, ...previousField.values } : {},
            manuallyEditedLanguages: previousField.manuallyEditedLanguages
              ?? field.manuallyEditedLanguages,
            machineTranslatedLanguages: previousField.machineTranslatedLanguages
              ?? field.machineTranslatedLanguages,
            reviewLanguages: previousField.reviewLanguages ?? field.reviewLanguages,
          }
          : field;
      }),
    };
  });
}

export function TranslationsProvider({ children }: { children: ReactNode }) {
  const { items, sections, updateItem, updateItems, updateSection } = useCatalogStore();
  const {
    account,
    addWorkspaceLanguage,
    removeWorkspaceLanguage,
    setWorkspaceLanguageHasContent,
    setWorkspaceLanguageVisibility,
    updateWorkspace,
  } = useMockAuth();
  const { setContentLanguage } = useAppSettings();
  const labelDirectory = useCatalogLabels(true);
  const [banners, setBanners] = useState<Banner[]>(() => readStoredBanners(account?.id));
  const realMaterials = useMemo(
    () => applyStoredFieldMetadata(
      applyStoredSectionTranslations(
        buildTranslationMaterials(items, sections, labelDirectory.labels, banners, account?.workspace),
        account?.id,
      ),
      account?.id,
    ),
    [account?.id, account?.workspace, banners, items, labelDirectory.labels, sections],
  );
  const [languages, setLanguages] = useState<TranslationLanguage[]>(() => (
    account?.workspace.languages
      .filter(({ code }) => code !== account.workspace.primaryLanguage)
      .map(({ code, visible }) => ({
        code,
        ...LANGUAGE_DETAILS[code],
        published: visible,
        doneFields: 0,
        totalFields: 0,
        missing: 0,
        outdated: 0,
        autoTranslate: true,
      })) ?? []
  ));
  const [materials, setMaterials] = useState<TranslationMaterial[]>(realMaterials);
  const [jobs, setJobs] = useState<TranslationJob[]>(() => readStoredTranslationJobs(account?.id));
  const [toast, setToast] = useState<TranslationToast | null>(null);
  const [activeLanguage, setActiveLanguageState] = useState<TranslationLanguageCode>(() => readActiveTranslationLanguage(account?.id));
  const [activeCategory, setActiveCategory] = useState<TranslationCategory>("about");
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(() => realMaterials.find((material) => material.category === "about")?.id ?? null);
  const [catalogBulkRequest, setCatalogBulkRequest] = useState<string[] | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [primaryLanguageConfirmed, setPrimaryLanguageConfirmed] = useState(() => readPrimaryLanguageConfirmed(account?.id));
  const suggestedPrimaryLanguage = useMemo(
    () => detectContentLanguage(account?.workspace, items, sections),
    [account?.workspace, items, sections],
  );
  const [workspaceRequested, setWorkspaceRequested] = useState(false);
  const timersRef = useRef<number[]>([]);
  const scheduledJobIdsRef = useRef(new Set<string>());
  const cancelledJobIdsRef = useRef(new Set<string>());
  const materialsRef = useRef(materials);
  const jobsRef = useRef(jobs);
  const catalogItemsRef = useRef(items);
  catalogItemsRef.current = items;
  const persistTranslatedMaterialRef = useRef<(
    material: TranslationMaterial,
    language: TranslationLanguageCode,
    fields: TranslationField[],
  ) => void>(() => {});
  const saveTimerRef = useRef<number | null>(null);
  const sourceSnapshotRef = useRef(readStoredSourceSnapshot(
    account?.id,
    new Map(realMaterials.flatMap((material) => material.fields.map((field) => [`${material.id}:${field.id}`, field.source]))),
  ));
  const primaryLanguageRef = useRef(account?.workspace.primaryLanguage);

  materialsRef.current = materials;
  jobsRef.current = jobs;

  const setActiveLanguage = useCallback((language: TranslationLanguageCode) => {
    setActiveLanguageState(language);
    if (account?.id) {
      window.localStorage.setItem(`${TRANSLATION_ACTIVE_LANGUAGE_STORAGE_PREFIX}.${account.id}`, language);
    }
  }, [account?.id]);

  useEffect(() => {
    setPrimaryLanguageConfirmed(readPrimaryLanguageConfirmed(account?.id));
    setActiveLanguageState(readActiveTranslationLanguage(account?.id));
  }, [account?.id]);

  useEffect(() => {
    if (!account) return;
    const targetLanguages = account.workspace.languages.filter(({ code }) => code !== account.workspace.primaryLanguage);
    setLanguages((current) => targetLanguages.map(({ code, visible }) => {
      const existing = current.find((language) => language.code === code);
      return existing
        ? { ...existing, published: visible, autoTranslate: true }
        : { code, ...LANGUAGE_DETAILS[code], published: visible, doneFields: 0, totalFields: 0, missing: 0, outdated: 0, autoTranslate: true };
    }));
  }, [account?.workspace.languages, account?.workspace.primaryLanguage]);

  useEffect(() => {
    setMaterials((current) => mergeRealMaterials(current, realMaterials));
  }, [realMaterials]);

  useEffect(() => {
    setLanguages((current) => current.map((language) => {
      const { totalFields, doneFields, missing, outdated } = summarizeLanguageProgress(materials, language.code);
      if (
        language.totalFields === totalFields
        && language.doneFields === doneFields
        && language.missing === missing
        && language.outdated === outdated
      ) return language;
      return { ...language, totalFields, doneFields, missing, outdated };
    }));
  }, [materials]);

  useEffect(() => {
    if (!account?.id) return;
    window.localStorage.setItem(
      `${TRANSLATION_JOBS_STORAGE_PREFIX}.${account.id}`,
      JSON.stringify(jobs.slice(0, 20)),
    );
  }, [account?.id, jobs]);

  useEffect(() => {
    if (!account?.id) return;
    window.localStorage.setItem(
      `${TRANSLATION_BANNERS_STORAGE_PREFIX}.${account.id}`,
      JSON.stringify(banners),
    );
  }, [account?.id, banners]);

  useEffect(() => () => {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    scheduledJobIdsRef.current.clear();
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
  }, []);

  const showToast = useCallback((message: string, actionLabel?: string, onAction?: () => void) => {
    setToast({ id: Date.now(), message, actionLabel, onAction });
  }, []);

  const openWorkspace = useCallback((target: WorkspaceTarget = {}) => {
    if (target.language) setActiveLanguage(target.language);
    if (target.category) setActiveCategory(target.category);
    if (target.materialId) setActiveMaterialId(target.materialId);
    setWorkspaceRequested(true);
    window.dispatchEvent(new CustomEvent("tasko:open-translations"));
  }, [setActiveLanguage]);

  const openCatalogBulk = useCallback((itemIds: string[]) => {
    setCatalogBulkRequest(itemIds);
    openWorkspace({ category: "positions" });
  }, [openWorkspace]);

  const startAutoTranslate = useCallback((
    languageCodes: TranslationLanguageCode[],
    materialIds: string[],
    source: string,
    publishAfterComplete = false,
    publicationMode: TranslationJob["publicationMode"] = "preserve",
    fieldIdsByMaterial?: Record<string, string[]>,
    preserveManualTranslations = false,
    reviewFieldIdsByMaterial?: Record<string, string[]>,
  ) => {
    const uniqueIds = [...new Set(materialIds)].filter((id) => materialsRef.current.some((material) => material.id === id));
    if (uniqueIds.length === 0 || languageCodes.length === 0) return;
    const startedAt = Date.now();
    setJobs((current) => {
      const mergeFieldMaps = (
        previous: Record<string, string[]> | undefined,
        incoming: Record<string, string[]> | undefined,
      ) => Object.fromEntries([...new Set([
        ...Object.keys(previous ?? {}),
        ...Object.keys(incoming ?? {}),
      ])].map((materialId) => [
        materialId,
        [...new Set([...(previous?.[materialId] ?? []), ...(incoming?.[materialId] ?? [])])],
      ]));
      let next = current;
      const additions: TranslationJob[] = [];
      languageCodes.forEach((language, index) => {
        const activeJob = next.find((job) =>
          job.language === language && (job.status === "queued" || job.status === "running"));
        if (activeJob) {
          const mergedMaterialIds = [...new Set([...activeJob.materialIds, ...uniqueIds])];
          next = next.map((job) => job.id === activeJob.id
            ? {
                ...job,
                source,
                materialIds: mergedMaterialIds,
                total: mergedMaterialIds.length,
                fieldIdsByMaterial: job.fieldIdsByMaterial === undefined
                  ? undefined
                  : mergeFieldMaps(job.fieldIdsByMaterial, fieldIdsByMaterial),
                reviewFieldIdsByMaterial: mergeFieldMaps(job.reviewFieldIdsByMaterial, reviewFieldIdsByMaterial),
                preserveManualTranslations: job.preserveManualTranslations || preserveManualTranslations,
              }
            : job);
          return;
        }
        const durationMs = source === "Новый язык" ? 40_000 : 1_500;
        additions.push({
          id: `translation-job-${startedAt}-${language}-${index}`,
          language,
          source,
          materialIds: uniqueIds,
          total: uniqueIds.length,
          completed: 0,
          status: "queued",
          publishAfterComplete,
          publicationMode,
          fieldIdsByMaterial,
          reviewFieldIdsByMaterial,
          preserveManualTranslations,
          startedAt,
          finishesAt: startedAt + durationMs + index * 120,
        });
      });
      return additions.length ? [...additions, ...next] : next;
    });
    showToast("Перевод запущен. Можно закрыть админку — процесс продолжится в фоне.");
  }, [showToast]);

  const addLanguage = useCallback((language: TranslationLanguageCode, publishAfterComplete: boolean) => {
    addWorkspaceLanguage(language);
    setActiveLanguage(language);
    setLanguages((current) => current.some((item) => item.code === language) ? current : [...current, {
      code: language,
      ...LANGUAGE_DETAILS[language],
      published: false,
      doneFields: 0,
      totalFields: 0,
      missing: 0,
      outdated: 0,
      autoTranslate: true,
    }]);
    const timer = window.setTimeout(() => startAutoTranslate(
      [language],
      materials.map((material) => material.id),
      "Новый язык",
      publishAfterComplete,
      publishAfterComplete ? "publish" : "review",
      undefined,
      true,
    ), 0);
    timersRef.current.push(timer);
  }, [addWorkspaceLanguage, materials, setActiveLanguage, startAutoTranslate]);

  const removeLanguage = useCallback((language: TranslationLanguageCode) => {
    setJobs((current) => {
      current.filter((job) => job.language === language).forEach((job) => {
        cancelledJobIdsRef.current.add(job.id);
      });
      return current.filter((job) => job.language !== language);
    });
    removeWorkspaceLanguage(language);
    setLanguages((current) => {
      const next = current.filter((item) => item.code !== language);
      if (activeLanguage === language) {
        setActiveLanguage(next[0]?.code ?? account?.workspace.primaryLanguage ?? "ru");
      }
      return next;
    });
    showToast(`${LANGUAGE_DETAILS[language].label} удалён`);
  }, [account?.workspace.primaryLanguage, activeLanguage, removeWorkspaceLanguage, setActiveLanguage, showToast]);

  const setPublished = useCallback((language: TranslationLanguageCode, published: boolean) => {
    setLanguages((current) => current.map((item) => item.code === language ? { ...item, published } : item));
    setWorkspaceLanguageVisibility(language, published);
    showToast(published ? "Язык опубликован" : "Язык переведён в черновик");
  }, [setWorkspaceLanguageVisibility, showToast]);

  const setJobPublishAfterComplete = useCallback((jobId: string, enabled: boolean) => {
    setJobs((current) => current.map((job) => job.id === jobId
      ? {
          ...job,
          publishAfterComplete: enabled,
          publicationMode: enabled ? "publish" : "review",
        }
      : job));
  }, []);

  const retryTranslationJob = useCallback((jobId: string) => {
    const startedAt = Date.now();
    scheduledJobIdsRef.current.delete(jobId);
    cancelledJobIdsRef.current.delete(jobId);
    setJobs((current) => current.map((job) => job.id === jobId
      ? {
          ...job,
          completed: 0,
          status: "queued",
          startedAt,
          finishesAt: startedAt + 1500,
        }
      : job));
    showToast("Повторный перевод запущен");
  }, [showToast]);

  const setPrimaryLanguage = useCallback((language: TranslationLanguageCode) => {
    if (!account || language === account.workspace.primaryLanguage) return;
    const hasTargetLanguages = account.workspace.languages.some(({ code }) => code !== account.workspace.primaryLanguage);
    if (!hasTargetLanguages) {
      const nextLanguages = [{ code: language, status: "ready" as const, visible: true }];
      updateWorkspace({
        primaryLanguage: language,
        languages: nextLanguages,
        localizedNames: {
          ...account.workspace.localizedNames,
          [language]: account.workspace.localizedNames[language] ?? account.workspace.name,
        },
        publishedSnapshot: account.workspace.publishedSnapshot
          ? {
              ...account.workspace.publishedSnapshot,
              version: account.workspace.publishedSnapshot.version + 1,
              publishedAt: Date.now(),
              publishedLanguages: [language],
            }
          : null,
      });
      setContentLanguage(language);
      showToast(`${getLanguage(language).label} теперь основной язык`);
      return;
    }
    if (!account.workspace.languages.some((item) => item.code === language)) return;
    const nextLanguages = account.workspace.languages.map((item) => item.code === language
      ? { ...item, status: "ready" as const, visible: true }
      : item);
    updateWorkspace({
      primaryLanguage: language,
      languages: nextLanguages,
      publishedSnapshot: account.workspace.publishedSnapshot
        ? {
            ...account.workspace.publishedSnapshot,
            version: account.workspace.publishedSnapshot.version + 1,
            publishedAt: Date.now(),
            publishedLanguages: [
              language,
              ...nextLanguages
                .filter(({ code, status, visible }) =>
                  code !== language && status === "ready" && visible)
                .map(({ code }) => code),
            ],
          }
        : null,
    });
    setContentLanguage(language);
    showToast(`${getLanguage(language).label} теперь основной язык`);
  }, [account, setContentLanguage, showToast, updateWorkspace]);

  const confirmPrimaryLanguage = useCallback((language: TranslationLanguageCode) => {
    if (!account) return;
    const hasTargetLanguages = account.workspace.languages.some(({ code }) => code !== account.workspace.primaryLanguage);
    if (language !== account.workspace.primaryLanguage) {
      if (hasTargetLanguages) {
        setPrimaryLanguage(language);
      } else {
        updateWorkspace({
          primaryLanguage: language,
          languages: [{ code: language, status: "ready", visible: true }],
          localizedNames: {
            ...account.workspace.localizedNames,
            [language]: account.workspace.localizedNames[language] ?? account.workspace.name,
          },
        });
        setContentLanguage(language);
      }
    }
    window.localStorage.setItem(`${TRANSLATION_PRIMARY_CONFIRMED_STORAGE_PREFIX}.${account.id}`, "true");
    setPrimaryLanguageConfirmed(true);
  }, [account, setContentLanguage, setPrimaryLanguage, updateWorkspace]);

  const setAutoTranslate = useCallback((language: TranslationLanguageCode, enabled: boolean) => {
    setLanguages((current) => current.map((item) => item.code === language ? { ...item, autoTranslate: enabled } : item));
  }, []);

  const persistField = useCallback((material: TranslationMaterial, fieldId: string, language: TranslationLanguageCode, value: string) => {
    if (material.kind === "position") {
      const item = items.find((candidate) => candidate.id === material.entityId);
      if (!item) return;
      const field = material.fields.find((candidate) => candidate.id === fieldId);
      if (field?.kind === "option-group" && field.optionGroupId) {
        updateItem(item.id, {
          optionGroups: (item.optionGroups ?? []).map((group) => group.id === field.optionGroupId
            ? { ...group, nameTranslations: { ...group.nameTranslations, ru: group.name, [language]: value } }
            : group),
        });
        return;
      }
      if (field?.kind === "option" && field.optionGroupId && field.optionVariantId) {
        updateItem(item.id, {
          optionGroups: (item.optionGroups ?? []).map((group) => group.id === field.optionGroupId
            ? {
              ...group,
              variants: group.variants.map((variant) => variant.id === field.optionVariantId
                ? { ...variant, nameTranslations: { ...variant.nameTranslations, ru: variant.name, [language]: value } }
                : variant),
            }
            : group),
        });
        return;
      }
      if (fieldId === "title") updateItem(item.id, { titleTranslations: { ...item.titleTranslations, ru: item.title, [language]: value } });
      if (fieldId === "description") updateItem(item.id, { descriptionTranslations: { ...item.descriptionTranslations, ru: stripHtml(item.description), [language]: value } });
      return;
    }
    if (material.kind === "section") {
      const section = sections.find((candidate) => candidate.id === material.entityId);
      if (section) {
        if (account?.id) {
          const stored = readStoredSectionTranslations(account.id);
          window.localStorage.setItem(
            `${TRANSLATION_SECTIONS_STORAGE_PREFIX}.${account.id}`,
            JSON.stringify({
              ...stored,
              [section.id]: { ...stored[section.id], [language]: value },
            }),
          );
        }
        updateSection(section.id, { nameTranslations: { ...section.nameTranslations, ru: section.name, [language]: value } });
      }
      return;
    }
    if (material.kind === "tag" || material.kind === "sticker") {
      const ownerItemIds = material.ownerItemIds ?? (material.ownerItemId ? [material.ownerItemId] : []);
      if (ownerItemIds.length > 0) {
        const patches = Object.fromEntries(ownerItemIds.flatMap((itemId) => {
          const item = items.find((candidate) => candidate.id === itemId);
          return item ? [[item.id, buildLocalLabelTranslationPatch(
            item,
            material,
            language,
            account?.workspace.primaryLanguage ?? "ru",
            (candidateFieldId, currentValue) => candidateFieldId === fieldId ? value : currentValue,
          )] as const] : [];
        }));
        updateItems(patches);
        return;
      }
      const label = labelDirectory.labels.find((candidate) => candidate.id === material.entityId);
      if (label) labelDirectory.update(label.id, { ...label.translations, [language]: value });
      return;
    }
    if (material.kind === "banner") {
      const field = material.fields.find((candidate) => candidate.id === fieldId);
      setBanners((current) => current.map((banner) => {
        if (banner.id !== material.entityId) return banner;
        if (field?.kind === "banner-tag" && field.bannerTagId) {
          const tagLanguage = language === "kk" ? "kz" : language;
          return {
            ...banner,
            tags: banner.tags.map((tag) => tag.id === field.bannerTagId
              ? { ...tag, texts: { ...tag.texts, [tagLanguage]: value } }
              : tag),
          };
        }
        return { ...banner, subtitleTranslations: { ...banner.subtitleTranslations, ru: banner.subtitle, [language]: value } };
      }));
      return;
    }
    if (material.kind === "about" && account?.workspace) {
      if (fieldId === "name") {
        updateWorkspace({ localizedNames: { ...account.workspace.localizedNames, ru: account.workspace.name, [language]: value } });
      } else if (fieldId === "address") {
        updateWorkspace({
          localizedAddresses: {
            ...account.workspace.localizedAddresses,
            ru: account.workspace.address ?? DEFAULT_WORKSPACE_ADDRESS,
            [language]: value,
          },
        });
      } else if (fieldId === "description") {
        updateWorkspace({
          localizedDescriptions: {
            ...account.workspace.localizedDescriptions,
            ru: account.workspace.description ?? "",
            [language]: value,
          },
        });
      }
    }
  }, [account?.id, account?.workspace, items, labelDirectory, sections, updateItem, updateItems, updateSection, updateWorkspace]);

  const persistTranslatedMaterial = useCallback((
    material: TranslationMaterial,
    language: TranslationLanguageCode,
    translatedFields: TranslationField[],
  ) => {
    const valueFor = (fieldId: string) => translatedFields.find((field) => field.id === fieldId)?.values[language] ?? "";

    if (material.kind === "position") {
      const item = items.find((candidate) => candidate.id === material.entityId);
      if (!item) return;
      updateItem(item.id, buildPositionTranslationPatch(item, language, translatedFields));
      return;
    }

    if (material.kind === "section") {
      const section = sections.find((candidate) => candidate.id === material.entityId);
      if (section) {
        if (account?.id) {
          const stored = readStoredSectionTranslations(account.id);
          window.localStorage.setItem(
            `${TRANSLATION_SECTIONS_STORAGE_PREFIX}.${account.id}`,
            JSON.stringify({
              ...stored,
              [section.id]: {
                ...stored[section.id],
                [language]: valueFor("name"),
              },
            }),
          );
        }
        updateSection(section.id, {
          nameTranslations: {
            ...section.nameTranslations,
            ru: section.name,
            [language]: valueFor("name"),
          },
        });
      }
      return;
    }

    if (material.kind === "tag" || material.kind === "sticker") {
      const ownerItemIds = material.ownerItemIds ?? (material.ownerItemId ? [material.ownerItemId] : []);
      if (ownerItemIds.length > 0) {
        const patches = Object.fromEntries(ownerItemIds.flatMap((itemId) => {
          const item = items.find((candidate) => candidate.id === itemId);
          return item ? [[item.id, buildLocalLabelTranslationPatch(
            item,
            material,
            language,
            account?.workspace.primaryLanguage ?? "ru",
            (fieldId, currentValue) => valueFor(fieldId) || currentValue,
          )] as const] : [];
        }));
        updateItems(patches);
        return;
      }
      const label = labelDirectory.labels.find((candidate) => candidate.id === material.entityId);
      if (label) labelDirectory.update(label.id, { ...label.translations, [language]: valueFor("name") });
      return;
    }

    if (material.kind === "banner") {
      setBanners((current) => current.map((banner) => {
        if (banner.id !== material.entityId) return banner;
        const tags = banner.tags.map((tag) => {
          const tagLanguage = language === "kk" ? "kz" : language;
          return {
            ...tag,
            texts: {
              ...tag.texts,
              [tagLanguage]: valueFor(`tag:${tag.id}`),
            },
          };
        });
        return {
          ...banner,
          subtitleTranslations: {
            ...banner.subtitleTranslations,
            ru: banner.subtitle,
            [language]: valueFor("subtitle"),
          },
          tags,
        };
      }));
      return;
    }

    if (material.kind === "about" && account?.workspace) {
      updateWorkspace({
        localizedNames: {
          ...account.workspace.localizedNames,
          ru: account.workspace.name,
          [language]: valueFor("name"),
        },
        localizedAddresses: {
          ...account.workspace.localizedAddresses,
          ru: account.workspace.address ?? DEFAULT_WORKSPACE_ADDRESS,
          [language]: valueFor("address"),
        },
        localizedDescriptions: {
          ...account.workspace.localizedDescriptions,
          ru: account.workspace.description ?? "",
          [language]: valueFor("description"),
        },
      });
    }
  }, [account?.id, account?.workspace, items, labelDirectory, sections, updateItem, updateItems, updateSection, updateWorkspace]);

  persistTranslatedMaterialRef.current = persistTranslatedMaterial;

  const completeTranslationJob = useCallback((job: TranslationJob) => {
    if (cancelledJobIdsRef.current.has(job.id)) return;
    const jobIds = new Set(job.materialIds);
    const translatedMaterials: TranslationMaterial[] = [];
    const failedFieldIdsByMaterial: Record<string, string[]> = {};
    const nextMaterials = materialsRef.current.map((material) => {
      if (!jobIds.has(material.id)) return material;
      const targetFieldIds = job.fieldIdsByMaterial?.[material.id];
      if (targetFieldIds) {
        const knownFieldIds = new Set(material.fields.map((field) => field.id));
        const missingFieldIds = targetFieldIds.filter((fieldId) => !knownFieldIds.has(fieldId));
        if (missingFieldIds.length > 0) failedFieldIdsByMaterial[material.id] = missingFieldIds;
      }
      let preservedManualTranslation = false;
      const fields = material.fields.map((field) => {
        if (targetFieldIds && !targetFieldIds.includes(field.id)) return field;
        const shouldPreserve = job.preserveManualTranslations
          && field.manuallyEditedLanguages?.includes(job.language);
        const shouldReview = job.reviewFieldIdsByMaterial?.[material.id]?.includes(field.id) ?? false;
        const reviewLanguages = new Set(field.reviewLanguages ?? []);
        if (shouldReview) reviewLanguages.add(job.language);
        else reviewLanguages.delete(job.language);
        if (shouldPreserve) {
          preservedManualTranslation = true;
          return { ...field, reviewLanguages: [...reviewLanguages] };
        }
        const manuallyEditedLanguages = new Set(field.manuallyEditedLanguages ?? []);
        const machineTranslatedLanguages = new Set(field.machineTranslatedLanguages ?? []);
        manuallyEditedLanguages.delete(job.language);
        machineTranslatedLanguages.add(job.language);
        return {
          ...field,
          manuallyEditedLanguages: [...manuallyEditedLanguages],
          machineTranslatedLanguages: [...machineTranslatedLanguages],
          reviewLanguages: [...reviewLanguages],
          values: {
            ...field.values,
            [job.language]: field.source.trim()
              ? fallbackTarget(field.source, job.language, "machine")
              : "",
          },
        };
      });
      const translated = {
        ...material,
        sourceChangedAt: job.reviewFieldIdsByMaterial?.[material.id]?.length || preservedManualTranslation
          ? new Date().toISOString()
          : undefined,
        fields,
        statuses: {
          ...material.statuses,
          [job.language]: translationStatusForFields(fields, job.language),
        },
      };
      translatedMaterials.push(translated);
      return translated;
    });

    const translatedCatalogItems = new Map<string, CatalogItem>();
    translatedMaterials.forEach((material) => {
      const ownerItemIds = material.ownerItemIds ?? (material.ownerItemId ? [material.ownerItemId] : []);
      if (material.kind === "position") {
        const item = translatedCatalogItems.get(material.entityId)
          ?? catalogItemsRef.current.find((candidate) => candidate.id === material.entityId);
        if (item) {
          translatedCatalogItems.set(material.entityId, {
            ...item,
            ...buildPositionTranslationPatch(item, job.language, material.fields),
          });
        }
      } else if ((material.kind === "tag" || material.kind === "sticker") && ownerItemIds.length > 0) {
        const valuesByField = new Map(material.fields.map((field) => [field.id, field.values[job.language] ?? ""]));
        ownerItemIds.forEach((itemId) => {
          const item = translatedCatalogItems.get(itemId)
            ?? catalogItemsRef.current.find((candidate) => candidate.id === itemId);
          if (!item) return;
          const patch = buildLocalLabelTranslationPatch(
            item,
            material,
            job.language,
            account?.workspace.primaryLanguage ?? "ru",
            (fieldId, currentValue) => valuesByField.get(fieldId) || currentValue,
          );
          translatedCatalogItems.set(itemId, { ...item, ...patch });
        });
      } else {
        persistTranslatedMaterialRef.current(material, job.language, material.fields);
      }
      material.fields.forEach((field) => persistFieldMetadata(account?.id, material.id, field));
    });
    if (translatedCatalogItems.size > 0) {
      catalogItemsRef.current = catalogItemsRef.current.map((item) => (
        translatedCatalogItems.get(item.id) ?? item
      ));
      updateItems(Object.fromEntries(translatedCatalogItems));
    }
    materialsRef.current = nextMaterials;
    setMaterials(nextMaterials);
    if (translatedMaterials.length > 0) setWorkspaceLanguageHasContent(job.language, true);
    const translatedIds = new Set(translatedMaterials.map((material) => material.id));
    const failedMaterialIds = [...new Set([
      ...job.materialIds.filter((materialId) => !translatedIds.has(materialId)),
      ...Object.keys(failedFieldIdsByMaterial),
    ])];
    if (failedMaterialIds.length > 0) {
      setJobs((current) => current.map((item) => item.id === job.id
        ? {
            ...item,
            materialIds: failedMaterialIds,
            fieldIdsByMaterial: Object.keys(failedFieldIdsByMaterial).length > 0
              ? failedFieldIdsByMaterial
              : item.fieldIdsByMaterial,
            total: failedMaterialIds.length,
            completed: 0,
            status: "error",
          }
        : item));
      showToast("Не удалось перевести часть текстов. Можно повторить только их.");
      return;
    }
    const markCompleted = () => setJobs((current) => current.map((item) => item.id === job.id
      ? { ...item, status: "completed", completed: item.total }
      : item));

    if (job.publicationMode === "publish") {
      setLanguages((current) => current.map((item) =>
        item.code === job.language ? { ...item, published: true } : item));
      const publishTimer = window.setTimeout(
        () => {
          if (cancelledJobIdsRef.current.has(job.id)) return;
          setWorkspaceLanguageVisibility(job.language, true);
          markCompleted();
        },
        250,
      );
      timersRef.current.push(publishTimer);
    } else if (job.publicationMode === "review") {
      setLanguages((current) => current.map((item) =>
        item.code === job.language ? { ...item, published: false } : item));
      setWorkspaceLanguageVisibility(job.language, false);
      markCompleted();
    } else {
      markCompleted();
    }
    showToast(
      `${translatedMaterials.length} материалов переведено`,
      "Посмотреть переводы",
      () => openWorkspace({ language: job.language }),
    );
  }, [account?.id, account?.workspace.primaryLanguage, openWorkspace, setWorkspaceLanguageHasContent, setWorkspaceLanguageVisibility, showToast, updateItems]);

  useEffect(() => {
    jobs.forEach((job) => {
      if (job.status === "completed" || job.status === "error" || scheduledJobIdsRef.current.has(job.id)) return;
      scheduledJobIdsRef.current.add(job.id);
      const now = Date.now();
      const startedAt = job.startedAt || now;
      const finishesAt = job.finishesAt || startedAt + 1500;
      const startTimer = window.setTimeout(() => {
        setJobs((current) => current.map((item) => item.id === job.id
          ? { ...item, status: "running", completed: 0 }
          : item));
      }, Math.max(0, startedAt + 300 - now));
      const finishTimer = window.setTimeout(
        () => {
          const latestJob = jobsRef.current.find((candidate) => candidate.id === job.id) ?? job;
          try {
            completeTranslationJob(latestJob);
          } catch {
            setJobs((current) => current.map((item) => item.id === job.id
              ? { ...item, status: "error", completed: 0 }
              : item));
            showToast("Не удалось перевести часть текстов. Можно повторить только их.");
          }
        },
        Math.max(0, finishesAt - now),
      );
      timersRef.current.push(startTimer, finishTimer);
    });
  }, [completeTranslationJob, jobs, showToast]);

  useEffect(() => {
    const primaryLanguage = account?.workspace.primaryLanguage;
    const currentSources = new Map(
      realMaterials.flatMap((material) => material.fields.map((field) => [`${material.id}:${field.id}`, field.source])),
    );
    if (primaryLanguageRef.current !== primaryLanguage) {
      primaryLanguageRef.current = primaryLanguage;
      sourceSnapshotRef.current = currentSources;
      persistSourceSnapshot(account?.id, currentSources);
      return;
    }
    const changedFieldsByMaterial: Record<string, string[]> = {};
    const newFieldsByMaterial: Record<string, string[]> = {};
    realMaterials.forEach((material) => {
      material.fields.forEach((field) => {
        if (!field.source.trim()) return;
        const previous = sourceSnapshotRef.current.get(`${material.id}:${field.id}`);
        if (previous === undefined) {
          newFieldsByMaterial[material.id] = [...(newFieldsByMaterial[material.id] ?? []), field.id];
        } else if (previous !== field.source) {
          changedFieldsByMaterial[material.id] = [...(changedFieldsByMaterial[material.id] ?? []), field.id];
        }
      });
    });
    const fieldIdsByMaterial = Object.fromEntries(
      [...new Set([...Object.keys(newFieldsByMaterial), ...Object.keys(changedFieldsByMaterial)])]
        .map((materialId) => [
          materialId,
          [...(newFieldsByMaterial[materialId] ?? []), ...(changedFieldsByMaterial[materialId] ?? [])],
        ]),
    );
    const changedMaterialIds = Object.keys(fieldIdsByMaterial);
    sourceSnapshotRef.current = currentSources;
    persistSourceSnapshot(account?.id, currentSources);
    if (changedMaterialIds.length > 0) {
      const timer = window.setTimeout(() => startAutoTranslate(
          languages.map(({ code }) => code),
          changedMaterialIds,
          Object.keys(changedFieldsByMaterial).length > 0 ? "Обновлённый исходный текст" : "Новый текст",
          false,
          "preserve",
          fieldIdsByMaterial,
          true,
          changedFieldsByMaterial,
        ), 0);
      timersRef.current.push(timer);
    }
  }, [account?.id, account?.workspace.primaryLanguage, languages, realMaterials, startAutoTranslate]);

  const updateField = useCallback((materialId: string, fieldId: string, language: TranslationLanguageCode, value: string, origin: "manual" | "machine" = "manual") => {
    const activeMaterial = materials.find((material) => material.id === materialId);
    if (!activeMaterial) return;
    const updatedFields = activeMaterial.fields.map((field) => {
      if (field.id !== fieldId) return field;
      const manuallyEditedLanguages = new Set(field.manuallyEditedLanguages ?? []);
      const machineTranslatedLanguages = new Set(field.machineTranslatedLanguages ?? []);
      const reviewLanguages = new Set(field.reviewLanguages ?? []);
      if (origin === "manual") {
        manuallyEditedLanguages.add(language);
        machineTranslatedLanguages.delete(language);
      } else {
        manuallyEditedLanguages.delete(language);
        machineTranslatedLanguages.add(language);
      }
      reviewLanguages.delete(language);
      return {
        ...field,
        values: { ...field.values, [language]: value },
        manuallyEditedLanguages: [...manuallyEditedLanguages],
        machineTranslatedLanguages: [...machineTranslatedLanguages],
        reviewLanguages: [...reviewLanguages],
      };
    });
    const updatedField = updatedFields.find((field) => field.id === fieldId);
    if (updatedField) persistFieldMetadata(account?.id, materialId, updatedField);
    const nextStatus = translationStatusForFields(updatedFields, language);
    setSaveState("saving");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setMaterials((current) => current.map((material) => material.id === materialId
      ? { ...material, fields: updatedFields, statuses: { ...material.statuses, [language]: nextStatus } }
      : material));
    persistField(activeMaterial, fieldId, language, value);
    saveTimerRef.current = window.setTimeout(() => {
      setSaveState("saved");
      const idleTimer = window.setTimeout(() => setSaveState("idle"), 1800);
      timersRef.current.push(idleTimer);
    }, 500);
  }, [account?.id, materials, persistField]);

  const autoTranslateField = useCallback((materialId: string, fieldId: string, language: TranslationLanguageCode) => {
    const material = materials.find((candidate) => candidate.id === materialId);
    const field = material?.fields.find((candidate) => candidate.id === fieldId);
    if (!field?.source.trim()) return;
    updateField(materialId, fieldId, language, fallbackTarget(field.source, language, "machine"), "machine");
    showToast("Поле переведено автоматически");
  }, [materials, showToast, updateField]);

  const confirmMaterial = useCallback((materialId: string, language: TranslationLanguageCode) => {
    setMaterials((current) => current.map((material) => {
      if (material.id !== materialId) return material;
      const fields = material.fields.map((field) => ({
        ...field,
        reviewLanguages: field.reviewLanguages?.filter((code) => code !== language),
      }));
      fields.forEach((field) => persistFieldMetadata(account?.id, material.id, field));
      return { ...material, fields, statuses: { ...material.statuses, [language]: translationStatusForFields(fields, language) } };
    }));
    setSaveState("saved");
    showToast("Перевод подтверждён");
  }, [account?.id, showToast]);

  const confirmField = useCallback((materialId: string, fieldId: string, language: TranslationLanguageCode) => {
    setMaterials((current) => current.map((material) => {
      if (material.id !== materialId) return material;
      const fields = material.fields.map((field) => field.id === fieldId
        ? { ...field, reviewLanguages: field.reviewLanguages?.filter((code) => code !== language) }
        : field);
      const confirmedField = fields.find((field) => field.id === fieldId);
      if (confirmedField) persistFieldMetadata(account?.id, material.id, confirmedField);
      return { ...material, fields, statuses: { ...material.statuses, [language]: translationStatusForFields(fields, language) } };
    }));
    setSaveState("saved");
    showToast("Перевод проверен");
  }, [account?.id, showToast]);

  const getCatalogSummary = useCallback((item: CatalogItem) => {
    const material = materials.find((candidate) => candidate.catalogItemId === item.id && candidate.kind === "position");
    const activeCodes = languages.map((language) => language.code);
    const fallbackMaterial: Pick<TranslationMaterial, "fields"> = {
      fields: [{
        id: "title",
        label: "Название",
        source: item.title,
        values: item.titleTranslations ?? {},
      }, {
        id: "description",
        label: "Описание",
        source: stripHtml(item.description),
        values: item.descriptionTranslations ?? {},
      }],
    };
    return {
      languages: summarizeCatalogPositionTranslations(material ?? fallbackMaterial, activeCodes),
    };
  }, [languages, materials]);

  const updateBanner = useCallback((id: string, patch: Partial<Banner>) => {
    setBanners((current) => current.map((banner) => banner.id === id ? { ...banner, ...patch } : banner));
  }, []);
  const removeBanner = useCallback((id: string) => {
    const next = banners.filter((banner) => banner.id !== id);
    setBanners(next);
    return next[0]?.id ?? null;
  }, [banners]);
  const addBanner = useCallback((imageUrl?: string) => {
    const id = `hero-${Date.now()}`;
    setBanners((current) => [...current, {
      id,
      title: "Новый баннер",
      subtitle: "Заголовок баннера",
      tags: [],
      accent: "from-indigo-700 via-blue-500 to-sky-400",
      visible: true,
      link: "",
      ...(imageUrl ? { image: imageUrl } : {}),
    }]);
    return id;
  }, []);

  const value = useMemo<TranslationsContextValue>(() => ({
    languages,
    materials,
    jobs,
    banners,
    toast,
    activeLanguage,
    activeCategory,
    activeMaterialId,
    catalogBulkRequest,
    saveState,
    primaryLanguageConfirmed,
    suggestedPrimaryLanguage,
    workspaceRequested,
    setActiveLanguage,
    setActiveCategory,
    setActiveMaterialId,
    openWorkspace,
    openCatalogBulk,
    closeCatalogBulk: () => setCatalogBulkRequest(null),
    addLanguage,
    confirmPrimaryLanguage,
    removeLanguage,
    setPrimaryLanguage,
    setPublished,
    setJobPublishAfterComplete,
    retryTranslationJob,
    setAutoTranslate,
    updateField,
    confirmMaterial,
    confirmField,
    startAutoTranslate,
    autoTranslateField,
    updateBanner,
    removeBanner,
    addBanner,
    dismissToast: () => setToast(null),
    consumeWorkspaceRequest: () => setWorkspaceRequested(false),
    getCatalogSummary,
  }), [
    activeCategory,
    activeLanguage,
    activeMaterialId,
    addBanner,
    addLanguage,
    autoTranslateField,
    banners,
    catalogBulkRequest,
    confirmField,
    confirmMaterial,
    confirmPrimaryLanguage,
    getCatalogSummary,
    jobs,
    languages,
    materials,
    openCatalogBulk,
    openWorkspace,
    primaryLanguageConfirmed,
    removeBanner,
    removeLanguage,
    retryTranslationJob,
    saveState,
    setAutoTranslate,
    setPrimaryLanguage,
    setPublished,
    setJobPublishAfterComplete,
    startAutoTranslate,
    suggestedPrimaryLanguage,
    toast,
    updateBanner,
    updateField,
    workspaceRequested,
  ]);

  return <TranslationsContext.Provider value={value}>{children}</TranslationsContext.Provider>;
}

export function useTranslations() {
  const value = useContext(TranslationsContext);
  if (!value) throw new Error("useTranslations must be used within TranslationsProvider");
  return value;
}

export function useTranslationsOptional() {
  return useContext(TranslationsContext);
}
