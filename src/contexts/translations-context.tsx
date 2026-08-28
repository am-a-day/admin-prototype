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
import { translationService } from "@/lib/translation/translation-service";

export type TranslationLanguageCode = LanguageCode;
export type TranslationStatus = "missing" | "machine" | "translated" | "outdated";
export type TranslationCategory = "positions" | "sections" | "tags" | "stickers" | "banners" | "about" | "interface";
export type TranslationFilter = "all" | "review" | "missing";
export type TranslationJobStatus = "idle" | "running" | "stopped" | "completed" | "completed_with_errors";
export type TranslationJobFieldStatus = "pending" | "running" | "completed" | "error";
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
  successful?: number;
  failed?: number;
  status: TranslationJobStatus;
  publishAfterComplete?: boolean;
  publicationMode?: "preserve" | "publish" | "review";
  fieldIdsByMaterial?: Record<string, string[]>;
  reviewFieldIdsByMaterial?: Record<string, string[]>;
  preserveManualTranslations?: boolean;
  fieldProgress?: Array<{
    id: string;
    materialId: string;
    fieldId: string;
    status: TranslationJobFieldStatus;
    error?: string;
  }>;
  startedAt: number;
  finishesAt: number;
};

export type FieldTranslationState = {
  status: "idle" | "loading" | "error";
  error?: string;
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
  stopTranslationJob: (jobId: string) => void;
  retryTranslationJob: (jobId: string) => void;
  setAutoTranslate: (language: TranslationLanguageCode, enabled: boolean) => void;
  updateField: (materialId: string, fieldId: string, language: TranslationLanguageCode, value: string, origin?: "manual" | "machine") => void;
  confirmMaterial: (materialId: string, language: TranslationLanguageCode) => void;
  confirmField: (materialId: string, fieldId: string, language: TranslationLanguageCode) => void;
  startAutoTranslate: (languageCodes: TranslationLanguageCode[], materialIds: string[], source: string, publishAfterComplete?: boolean) => void;
  autoTranslateField: (materialId: string, fieldId: string, language: TranslationLanguageCode) => Promise<void>;
  getFieldTranslationState: (materialId: string, fieldId: string, language: TranslationLanguageCode) => FieldTranslationState;
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

const PRIMARY_LANGUAGE_TOAST_LABELS: Record<TranslationLanguageCode, string> = {
  ru: "русский",
  kk: "казахский",
  en: "английский",
  zh: "китайский",
  fr: "французский",
  es: "испанский",
  sr: "сербский",
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
const TRANSLATION_PUBLICATION_FLUSH_DELAY_MS = 160;

function fieldTranslationStateKey(
  materialId: string,
  fieldId: string,
  language: TranslationLanguageCode,
) {
  return `${materialId}:${fieldId}:${language}`;
}

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
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((stored): TranslationJob[] => {
      if (!stored || typeof stored !== "object") return [];
      const job = stored as Partial<TranslationJob> & { status?: string };
      if (
        typeof job.id !== "string"
        || !TRANSLATION_LANGUAGE_CODES.includes(job.language as TranslationLanguageCode)
        || !Array.isArray(job.materialIds)
      ) return [];

      const storedFieldProgress = Array.isArray(job.fieldProgress) ? job.fieldProgress : null;
      const fieldProgress = storedFieldProgress?.flatMap((storedField) => {
        if (
          !storedField
          || typeof storedField.id !== "string"
          || typeof storedField.materialId !== "string"
          || typeof storedField.fieldId !== "string"
        ) return [];
        const rawStatus = String(storedField.status);
        if (!["queued", "pending", "running", "completed", "error"].includes(rawStatus)) return [];
        const status: TranslationJobFieldStatus = rawStatus === "queued" || rawStatus === "pending" || rawStatus === "running"
          ? "pending"
          : rawStatus === "completed"
            ? "completed"
            : rawStatus === "error"
              ? "error"
              : "pending";
        return [{
          id: storedField.id,
          materialId: storedField.materialId,
          fieldId: storedField.fieldId,
          status,
          ...(typeof storedField.error === "string" ? { error: storedField.error } : {}),
        }];
      });
      const storedStatus = String(job.status);
      const recognizedStatus: TranslationJobStatus | null = storedStatus === "queued"
        ? "idle"
        : storedStatus === "error"
          ? "completed_with_errors"
          : ["idle", "running", "stopped", "completed", "completed_with_errors"].includes(storedStatus)
            ? storedStatus as TranslationJobStatus
            : null;
      const restorable = Array.isArray(fieldProgress) && fieldProgress.length === storedFieldProgress?.length;
      const status = recognizedStatus && restorable
        ? recognizedStatus
        : "stopped";
      const successful = fieldProgress?.filter((field) => field.status === "completed").length ?? 0;
      const failed = fieldProgress?.filter((field) => field.status === "error").length ?? 0;

      return [{
        ...job,
        id: job.id,
        language: job.language as TranslationLanguageCode,
        source: typeof job.source === "string" ? job.source : "Автоперевод",
        materialIds: job.materialIds.filter((id): id is string => typeof id === "string"),
        total: fieldProgress?.length ?? 0,
        completed: successful,
        successful,
        failed,
        status,
        fieldProgress: fieldProgress ?? undefined,
        startedAt: typeof job.startedAt === "number" ? job.startedAt : Date.now(),
        finishesAt: typeof job.finishesAt === "number" ? job.finishesAt : Date.now(),
      }];
    });
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
  const { items, sections, updateItem, updateSection } = useCatalogStore();
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
  const [fieldTranslationStates, setFieldTranslationStates] = useState<Record<string, FieldTranslationState>>({});
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
  const lifecycleVersionRef = useRef(0);
  const materialsRef = useRef(materials);
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
  const catalogItemsRef = useRef(items);
  const catalogSectionsRef = useRef(sections);
  const workspaceRef = useRef<MockWorkspace | undefined>(account?.workspace);

  materialsRef.current = materials;
  catalogItemsRef.current = items;
  catalogSectionsRef.current = sections;
  workspaceRef.current = account?.workspace;

  const commitCatalogItemPatch = useCallback((
    id: string,
    createPatch: (item: CatalogItem) => Partial<CatalogItem>,
  ) => {
    const item = catalogItemsRef.current.find((candidate) => candidate.id === id);
    if (!item) return;
    const patch = createPatch(item);
    catalogItemsRef.current = catalogItemsRef.current.map((candidate) => (
      candidate.id === id ? { ...candidate, ...patch } : candidate
    ));
    updateItem(id, patch);
  }, [updateItem]);

  const commitSectionPatch = useCallback((
    id: string,
    createPatch: (section: CatalogSection) => Partial<CatalogSection>,
  ) => {
    const section = catalogSectionsRef.current.find((candidate) => candidate.id === id);
    if (!section) return;
    const patch = createPatch(section);
    catalogSectionsRef.current = catalogSectionsRef.current.map((candidate) => (
      candidate.id === id ? { ...candidate, ...patch } : candidate
    ));
    updateSection(id, patch);
  }, [updateSection]);

  const commitWorkspacePatch = useCallback((
    createPatch: (workspace: MockWorkspace) => Partial<MockWorkspace>,
  ) => {
    const workspace = workspaceRef.current;
    if (!workspace) return;
    const patch = createPatch(workspace);
    workspaceRef.current = { ...workspace, ...patch };
    updateWorkspace(patch);
  }, [updateWorkspace]);

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

  useEffect(() => {
    lifecycleVersionRef.current += 1;
    const mountedVersion = lifecycleVersionRef.current;
    return () => {
      if (lifecycleVersionRef.current === mountedVersion) lifecycleVersionRef.current += 1;
      timersRef.current.forEach((timer) => window.clearTimeout(timer));
      timersRef.current = [];
      scheduledJobIdsRef.current.clear();
      if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    };
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
    if (preserveManualTranslations && reviewFieldIdsByMaterial) {
      let reviewStateChanged = false;
      const reviewMaterialIds = new Set(uniqueIds);
      const reviewedMaterials = materialsRef.current.map((material) => {
        const reviewFieldIds = reviewFieldIdsByMaterial[material.id];
        if (!reviewMaterialIds.has(material.id) || !reviewFieldIds?.length) return material;
        let materialChanged = false;
        const fields = material.fields.map((field) => {
          if (!reviewFieldIds.includes(field.id)) return field;
          const reviewLanguages = new Set(field.reviewLanguages ?? []);
          languageCodes.forEach((language) => {
            if (field.manuallyEditedLanguages?.includes(language)) reviewLanguages.add(language);
          });
          if (reviewLanguages.size === (field.reviewLanguages?.length ?? 0)) return field;
          materialChanged = true;
          const reviewedField = { ...field, reviewLanguages: [...reviewLanguages] };
          persistFieldMetadata(account?.id, material.id, reviewedField);
          return reviewedField;
        });
        if (!materialChanged) return material;
        reviewStateChanged = true;
        const statuses = { ...material.statuses };
        languageCodes.forEach((language) => {
          statuses[language] = translationStatusForFields(fields, language);
        });
        return { ...material, fields, statuses, sourceChangedAt: new Date().toISOString() };
      });
      if (reviewStateChanged) {
        materialsRef.current = reviewedMaterials;
        setMaterials(reviewedMaterials);
      }
    }
    const additions = languageCodes.flatMap((language, index): TranslationJob[] => {
      const fieldProgress = uniqueIds.flatMap((materialId) => {
        const material = materialsRef.current.find((candidate) => candidate.id === materialId);
        if (!material) return [];
        const requestedFieldIds = fieldIdsByMaterial?.[materialId];
        return material.fields
          .filter((field) => field.source.trim())
          .filter((field) => !requestedFieldIds || requestedFieldIds.includes(field.id))
          .filter((field) => !(preserveManualTranslations && field.manuallyEditedLanguages?.includes(language)))
          .map((field) => ({
            id: `${materialId}:${field.id}:${language}`,
            materialId,
            fieldId: field.id,
            status: "pending" as const,
          }));
      });
      if (fieldProgress.length === 0) return [];
      return [{
        id: `translation-job-${startedAt}-${language}-${index}`,
        language,
        source,
        materialIds: uniqueIds,
        total: fieldProgress.length,
        completed: 0,
        successful: 0,
        failed: 0,
        status: "idle",
        publishAfterComplete,
        publicationMode,
        fieldIdsByMaterial,
        reviewFieldIdsByMaterial,
        preserveManualTranslations,
        fieldProgress,
        startedAt,
        finishesAt: startedAt,
      }];
    });
    if (additions.length === 0) return;
    setJobs((current) => [...additions, ...current]);
    showToast("Перевод запущен. Можно закрыть админку — процесс продолжится в фоне.");
  }, [account?.id, showToast]);

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

  const stopTranslationJob = useCallback((jobId: string) => {
    cancelledJobIdsRef.current.add(jobId);
    setJobs((current) => current.map((job) => job.id === jobId && (job.status === "idle" || job.status === "running")
      ? { ...job, status: "stopped", finishesAt: Date.now() }
      : job));
    showToast("Перевод остановлен. Уже переведённые поля сохранены.");
  }, [showToast]);

  const retryTranslationJob = useCallback((jobId: string) => {
    const currentJob = jobs.find((job) => job.id === jobId);
    if (!currentJob || currentJob.fieldProgress?.some((field) => field.status === "running")) return;
    const startedAt = Date.now();
    scheduledJobIdsRef.current.delete(jobId);
    cancelledJobIdsRef.current.delete(jobId);
    setJobs((current) => current.map((job) => {
      if (job.id !== jobId) return job;
      const fieldProgress = job.fieldProgress?.map((field) => field.status === "error"
        ? { ...field, status: "pending" as const, error: undefined }
        : field);
      const successful = fieldProgress?.filter((field) => field.status === "completed").length ?? 0;
      return {
        ...job,
        completed: successful,
        successful,
        failed: 0,
        status: "idle",
        fieldProgress,
        startedAt,
        finishesAt: startedAt,
      };
    }));
    showToast("Перевод продолжен");
  }, [jobs, showToast]);

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
      showToast(`Основной язык изменён на ${PRIMARY_LANGUAGE_TOAST_LABELS[language]}`);
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
    showToast(`Основной язык изменён на ${PRIMARY_LANGUAGE_TOAST_LABELS[language]}`);
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

  const persistTranslatedMaterial = useCallback((
    material: TranslationMaterial,
    language: TranslationLanguageCode,
    translatedFields: TranslationField[],
  ) => {
    const valueFor = (fieldId: string) => translatedFields.find((field) => field.id === fieldId)?.values[language] ?? "";

    if (material.kind === "position") {
      commitCatalogItemPatch(material.entityId, (item) => buildPositionTranslationPatch(item, language, translatedFields));
      return;
    }

    if (material.kind === "section") {
      const section = catalogSectionsRef.current.find((candidate) => candidate.id === material.entityId);
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
        commitSectionPatch(section.id, (currentSection) => ({
          nameTranslations: {
            ...currentSection.nameTranslations,
            ru: currentSection.name,
            [language]: valueFor("name"),
          },
        }));
      }
      return;
    }

    if (material.kind === "tag" || material.kind === "sticker") {
      const ownerItemIds = material.ownerItemIds ?? (material.ownerItemId ? [material.ownerItemId] : []);
      if (ownerItemIds.length > 0) {
        ownerItemIds.forEach((itemId) => {
          commitCatalogItemPatch(itemId, (item) => buildLocalLabelTranslationPatch(
            item,
            material,
            language,
            account?.workspace.primaryLanguage ?? "ru",
            (fieldId, currentValue) => valueFor(fieldId) || currentValue,
          ));
        });
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

    if (material.kind === "about") {
      commitWorkspacePatch((workspace) => ({
        localizedNames: {
          ...workspace.localizedNames,
          ru: workspace.name,
          [language]: valueFor("name"),
        },
        localizedAddresses: {
          ...workspace.localizedAddresses,
          ru: workspace.address ?? DEFAULT_WORKSPACE_ADDRESS,
          [language]: valueFor("address"),
        },
        localizedDescriptions: {
          ...workspace.localizedDescriptions,
          ru: workspace.description ?? "",
          [language]: valueFor("description"),
        },
      }));
    }
  }, [account?.id, account?.workspace.primaryLanguage, commitCatalogItemPatch, commitSectionPatch, commitWorkspacePatch, labelDirectory]);

  persistTranslatedMaterialRef.current = persistTranslatedMaterial;

  const applyBatchTranslationResult = useCallback((
    job: TranslationJob,
    materialId: string,
    fieldId: string,
    translatedText: string,
  ) => {
    const material = materialsRef.current.find((candidate) => candidate.id === materialId);
    if (!material) throw new Error("Материал больше не существует");
    const shouldReview = job.reviewFieldIdsByMaterial?.[materialId]?.includes(fieldId) ?? false;
    const fields = material.fields.map((field) => {
      if (field.id !== fieldId) return field;
      const manuallyEditedLanguages = new Set(field.manuallyEditedLanguages ?? []);
      const machineTranslatedLanguages = new Set(field.machineTranslatedLanguages ?? []);
      const reviewLanguages = new Set(field.reviewLanguages ?? []);
      manuallyEditedLanguages.delete(job.language);
      machineTranslatedLanguages.add(job.language);
      if (shouldReview) reviewLanguages.add(job.language);
      else reviewLanguages.delete(job.language);
      return {
        ...field,
        manuallyEditedLanguages: [...manuallyEditedLanguages],
        machineTranslatedLanguages: [...machineTranslatedLanguages],
        reviewLanguages: [...reviewLanguages],
        values: { ...field.values, [job.language]: translatedText },
      };
    });
    const translatedMaterial = {
      ...material,
      sourceChangedAt: shouldReview ? new Date().toISOString() : material.sourceChangedAt,
      fields,
      statuses: {
        ...material.statuses,
        [job.language]: translationStatusForFields(fields, job.language),
      },
    };
    const nextMaterials = materialsRef.current.map((candidate) => (
      candidate.id === materialId ? translatedMaterial : candidate
    ));
    materialsRef.current = nextMaterials;
    setMaterials(nextMaterials);
    const updatedField = fields.find((field) => field.id === fieldId);
    if (updatedField) persistFieldMetadata(account?.id, materialId, updatedField);
    persistTranslatedMaterialRef.current(translatedMaterial, job.language, fields);
  }, [account?.id]);

  const runTranslationJob = useCallback(async (job: TranslationJob) => {
    if (cancelledJobIdsRef.current.has(job.id)) return;
    const lifecycleVersion = lifecycleVersionRef.current;
    const lifecycleExpired = () => lifecycleVersionRef.current !== lifecycleVersion;
    const sourceLanguage = primaryLanguageRef.current ?? "ru";
    let fieldProgress = job.fieldProgress ?? job.materialIds.flatMap((materialId) => {
      const material = materialsRef.current.find((candidate) => candidate.id === materialId);
      if (!material) return [];
      const requestedFieldIds = job.fieldIdsByMaterial?.[materialId];
      return material.fields
        .filter((field) => field.source.trim())
        .filter((field) => !requestedFieldIds || requestedFieldIds.includes(field.id))
        .filter((field) => !(job.preserveManualTranslations && field.manuallyEditedLanguages?.includes(job.language)))
        .map((field) => ({
          id: `${materialId}:${field.id}:${job.language}`,
          materialId,
          fieldId: field.id,
          status: "pending" as const,
        }));
    });
    const pendingFields = fieldProgress.filter((field) => field.status === "pending");
    let successful = fieldProgress.filter((field) => field.status === "completed").length;
    let failed = fieldProgress.filter((field) => field.status === "error").length;
    let runSuccessful = 0;
    let runFailed = 0;
    const operationStartedAt = performance.now();

    setJobs((current) => current.map((candidate) => candidate.id === job.id
      ? {
          ...candidate,
          total: fieldProgress.length,
          completed: successful,
          successful,
          failed,
          status: "running",
          fieldProgress,
        }
      : candidate));
    console.info(`[translation] batch ${job.id} started`, {
      requests: pendingFields.length,
      sourceLanguage,
      targetLanguage: job.language,
    });

    const updateProgress = (
      progressId: string,
      status: TranslationJobFieldStatus,
      error?: string,
    ) => {
      fieldProgress = fieldProgress.map((field) => field.id === progressId
        ? { ...field, status, error }
        : field);
      setJobs((current) => current.map((candidate) => candidate.id === job.id
        ? {
            ...candidate,
            completed: fieldProgress.filter((field) => field.status === "completed").length,
            successful,
            failed,
            status: cancelledJobIdsRef.current.has(job.id) ? "stopped" : "running",
            fieldProgress,
            finishesAt: Date.now(),
          }
        : candidate));
    };

    let nextFieldIndex = 0;
    const runWorker = async () => {
      while (nextFieldIndex < pendingFields.length) {
        const progress = pendingFields[nextFieldIndex++];
        if (!progress || lifecycleExpired() || cancelledJobIdsRef.current.has(job.id)) return;
        updateProgress(progress.id, "running");
        const material = materialsRef.current.find((candidate) => candidate.id === progress.materialId);
        const field = material?.fields.find((candidate) => candidate.id === progress.fieldId);
        try {
          if (!field?.source.trim()) throw new Error("Исходный текст больше не доступен");
          if (field.manuallyEditedLanguages?.includes(job.language)) {
            successful += 1;
            runSuccessful += 1;
            updateProgress(progress.id, "completed");
            continue;
          }
          const requestedSource = field.source;
          const result = await translationService.translateText({
            text: requestedSource,
            sourceLanguage,
            targetLanguage: job.language,
          });
          if (lifecycleExpired()) return;
          const currentField = materialsRef.current
            .find((candidate) => candidate.id === progress.materialId)
            ?.fields.find((candidate) => candidate.id === progress.fieldId);
          const manuallyEditedNow = currentField?.manuallyEditedLanguages?.includes(job.language) ?? false;
          if (
            currentField?.source !== requestedSource
            || manuallyEditedNow
          ) {
            successful += 1;
            runSuccessful += 1;
            updateProgress(progress.id, "completed");
            continue;
          }
          applyBatchTranslationResult(job, progress.materialId, progress.fieldId, result.translatedText);
          successful += 1;
          runSuccessful += 1;
          updateProgress(progress.id, "completed");
        } catch (error) {
          const message = error instanceof Error ? error.message : "Не удалось перевести поле";
          failed += 1;
          runFailed += 1;
          updateProgress(progress.id, "error", message);
        }
      }
    };

    await Promise.all(Array.from(
      { length: Math.min(3, pendingFields.length) },
      () => runWorker(),
    ));
    if (lifecycleExpired()) return;
    if (cancelledJobIdsRef.current.has(job.id)) {
      console.info(`[translation] batch ${job.id} stopped after ${Math.round(performance.now() - operationStartedAt)}ms`, {
        requests: runSuccessful + runFailed,
        successful: runSuccessful,
        failed: runFailed,
      });
      return;
    }

    const translatedMaterialIds = new Set(fieldProgress
      .filter((field) => field.status === "completed")
      .map((field) => field.materialId));
    translatedMaterialIds.forEach((materialId) => {
      const material = materialsRef.current.find((candidate) => candidate.id === materialId);
      if (material) persistTranslatedMaterialRef.current(material, job.language, material.fields);
    });
    if (translatedMaterialIds.size > 0) setWorkspaceLanguageHasContent(job.language, true);

    const status: TranslationJobStatus = failed > 0 ? "completed_with_errors" : "completed";
    const completed = fieldProgress.filter((field) => field.status === "completed").length;
    setJobs((current) => current.map((candidate) => candidate.id === job.id
      ? { ...candidate, completed, successful, failed, status, fieldProgress, finishesAt: Date.now() }
      : candidate));

    if (status === "completed") {
      if (job.publicationMode === "publish") {
        await new Promise((resolve) => window.setTimeout(resolve, TRANSLATION_PUBLICATION_FLUSH_DELAY_MS));
        if (cancelledJobIdsRef.current.has(job.id)) return;
        setLanguages((current) => current.map((item) =>
          item.code === job.language ? { ...item, published: true } : item));
        setWorkspaceLanguageVisibility(job.language, true);
      } else if (job.publicationMode === "review") {
        setLanguages((current) => current.map((item) =>
          item.code === job.language ? { ...item, published: false } : item));
        setWorkspaceLanguageVisibility(job.language, false);
      }
      showToast(
        `${successful} полей переведено`,
        "Посмотреть переводы",
        () => openWorkspace({ language: job.language }),
      );
    } else {
      showToast(`Переведено ${successful} из ${fieldProgress.length} полей. Ошибок: ${failed}.`);
    }
    console.info(`[translation] batch ${job.id} finished in ${Math.round(performance.now() - operationStartedAt)}ms`, {
      requests: pendingFields.length,
      successful: runSuccessful,
      failed: runFailed,
    });
  }, [applyBatchTranslationResult, openWorkspace, setWorkspaceLanguageHasContent, setWorkspaceLanguageVisibility, showToast]);

  useEffect(() => {
    jobs.forEach((job) => {
      if ((job.status !== "idle" && job.status !== "running") || scheduledJobIdsRef.current.has(job.id)) return;
      scheduledJobIdsRef.current.add(job.id);
      void runTranslationJob(job);
    });
  }, [jobs, runTranslationJob]);

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
    const activeMaterial = materialsRef.current.find((material) => material.id === materialId);
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
    const updatedMaterial = {
      ...activeMaterial,
      fields: updatedFields,
      statuses: { ...activeMaterial.statuses, [language]: nextStatus },
    };
    const nextMaterials = materialsRef.current.map((material) => material.id === materialId
      ? updatedMaterial
      : material);
    materialsRef.current = nextMaterials;
    setMaterials(nextMaterials);
    persistTranslatedMaterialRef.current(updatedMaterial, language, updatedFields);
    if (origin === "manual") {
      const stateKey = fieldTranslationStateKey(materialId, fieldId, language);
      setFieldTranslationStates((current) => {
        if (!current[stateKey]) return current;
        const next = { ...current };
        delete next[stateKey];
        return next;
      });
    }
    saveTimerRef.current = window.setTimeout(() => {
      setSaveState("saved");
      const idleTimer = window.setTimeout(() => setSaveState("idle"), 1800);
      timersRef.current.push(idleTimer);
    }, 500);
  }, [account?.id]);

  const autoTranslateField = useCallback(async (materialId: string, fieldId: string, language: TranslationLanguageCode) => {
    const material = materialsRef.current.find((candidate) => candidate.id === materialId);
    const field = material?.fields.find((candidate) => candidate.id === fieldId);
    if (!field?.source.trim()) return;
    const stateKey = fieldTranslationStateKey(materialId, fieldId, language);
    const operationStartedAt = performance.now();
    setFieldTranslationStates((current) => ({ ...current, [stateKey]: { status: "loading" } }));
    try {
      const result = await translationService.translateText({
        text: field.source,
        sourceLanguage: account?.workspace.primaryLanguage ?? "ru",
        targetLanguage: language,
      });
      updateField(materialId, fieldId, language, result.translatedText, "machine");
      setFieldTranslationStates((current) => {
        const next = { ...current };
        delete next[stateKey];
        return next;
      });
      showToast("Поле переведено автоматически");
      console.info(`[translation] field ${stateKey} finished in ${Math.round(performance.now() - operationStartedAt)}ms`, {
        requests: 1,
        successful: 1,
        failed: 0,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Не удалось перевести поле";
      setFieldTranslationStates((current) => ({
        ...current,
        [stateKey]: { status: "error", error: message },
      }));
      console.info(`[translation] field ${stateKey} finished in ${Math.round(performance.now() - operationStartedAt)}ms`, {
        requests: 1,
        successful: 0,
        failed: 1,
      });
    }
  }, [account?.workspace.primaryLanguage, showToast, updateField]);

  const getFieldTranslationState = useCallback((
    materialId: string,
    fieldId: string,
    language: TranslationLanguageCode,
  ): FieldTranslationState => fieldTranslationStates[fieldTranslationStateKey(materialId, fieldId, language)]
    ?? { status: "idle" }, [fieldTranslationStates]);

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
    stopTranslationJob,
    retryTranslationJob,
    setAutoTranslate,
    updateField,
    confirmMaterial,
    confirmField,
    startAutoTranslate,
    autoTranslateField,
    getFieldTranslationState,
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
    getFieldTranslationState,
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
    stopTranslationJob,
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
