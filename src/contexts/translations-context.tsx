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
import type { CatalogItem, CatalogSection, CatalogTranslations } from "@/data/catalog";
import { DEFAULT_RECOMMENDATION_TEXTS, banners as seedBanners, type Banner } from "@/data/mock-data";
import type { LanguageCode } from "@/data/languages";
import { getLanguage } from "@/data/languages";
import { useAppSettings } from "@/contexts/app-settings-context";
import {
  useCatalogLabels,
  type CatalogLabel,
} from "@/features/storefront/catalog/labels/catalog-labels";

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
  reviewLanguages?: TranslationLanguageCode[];
};

export type TranslationMaterial = {
  id: string;
  entityId: string;
  ownerItemId?: string;
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
  getCatalogSummary: (item: CatalogItem) => { filled: number; total: number; outdated: boolean; tooltip: string };
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
  const counts: Partial<Record<TranslationLanguageCode, number>> = {
    zh: (sample.match(/[\u3400-\u9fff]/g) ?? []).length,
    kk: (sample.match(/[әғқңөұүһіӘҒҚҢӨҰҮҺІ]/g) ?? []).length,
    ru: (sample.match(/[а-яёА-ЯЁ]/g) ?? []).length,
    sr: (sample.match(/[čćžšđČĆŽŠĐ]/g) ?? []).length,
    en: (sample.match(/[a-zA-Z]/g) ?? []).length,
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

function applyStoredManualFields(materials: TranslationMaterial[], accountId: string | undefined) {
  const stored = readStoredManualFields(accountId);
  return materials.map((material) => ({
    ...material,
    fields: material.fields.map((field) => ({
      ...field,
      manuallyEditedLanguages: stored[`${material.id}:${field.id}`] ?? field.manuallyEditedLanguages,
    })),
  }));
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
  const labelMaterials = labels.map((label, index) => labelMaterial(label, index, primaryLanguage));
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
    () => applyStoredManualFields(
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
  const persistTranslatedMaterialRef = useRef<(
    material: TranslationMaterial,
    language: TranslationLanguageCode,
    fields: TranslationField[],
  ) => void>(() => {});
  const saveTimerRef = useRef<number | null>(null);
  const sourceSnapshotRef = useRef(new Map(
    realMaterials.flatMap((material) => material.fields.map((field) => [`${material.id}:${field.id}`, field.source])),
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
      const activeLanguages = new Set(current
        .filter((job) => job.status === "queued" || job.status === "running")
        .map((job) => job.language));
      const additions = languageCodes
        .filter((language) => !activeLanguages.has(language))
        .map((language, index): TranslationJob => ({
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
          finishesAt: startedAt + 1500 + index * 120,
        }));
      return additions.length ? [...additions, ...current] : current;
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
    setLanguages((current) => current.filter((item) => item.code !== language));
    if (activeLanguage === language) setActiveLanguage("kk");
    showToast(`${LANGUAGE_DETAILS[language].label} удалён`);
  }, [activeLanguage, removeWorkspaceLanguage, setActiveLanguage, showToast]);

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
    const previousPrimary = account.workspace.primaryLanguage;
    const workspaceLanguages = account.workspace.languages.some((item) => item.code === language)
      ? account.workspace.languages.map((item) => item.code === language ? { ...item, status: "ready" as const, visible: true } : item)
      : [...account.workspace.languages, { code: language, status: "ready" as const, visible: true }];
    updateWorkspace({
      primaryLanguage: language,
      languages: workspaceLanguages,
      localizedNames: {
        ...account.workspace.localizedNames,
        [language]: account.workspace.localizedNames[language] ?? account.workspace.name,
      },
      publishedSnapshot: account.workspace.publishedSnapshot
        ? {
            ...account.workspace.publishedSnapshot,
            version: account.workspace.publishedSnapshot.version + 1,
            publishedAt: Date.now(),
            publishedLanguages: workspaceLanguages
              .filter(({ code, status, visible }) =>
                code === language || (status === "ready" && visible))
              .map(({ code }) => code),
          }
        : null,
    });
    setLanguages((current) => {
      const withoutNextPrimary = current.filter((item) => item.code !== language);
      return withoutNextPrimary.some((item) => item.code === previousPrimary)
        ? withoutNextPrimary
        : [...withoutNextPrimary, {
          code: previousPrimary,
          ...LANGUAGE_DETAILS[previousPrimary],
          published: true,
          doneFields: 0,
          totalFields: 0,
          missing: 0,
          outdated: 0,
          autoTranslate: true,
        }];
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
  }, [account?.id, account?.workspace, items, labelDirectory, sections, updateItem, updateSection, updateWorkspace]);

  const persistTranslatedMaterial = useCallback((
    material: TranslationMaterial,
    language: TranslationLanguageCode,
    translatedFields: TranslationField[],
  ) => {
    const valueFor = (fieldId: string) => translatedFields.find((field) => field.id === fieldId)?.values[language] ?? "";

    if (material.kind === "position") {
      const item = items.find((candidate) => candidate.id === material.entityId);
      if (!item) return;
      const title = valueFor("title");
      const description = valueFor("description");
      const optionGroups = (item.optionGroups ?? []).map((group) => ({
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
      }));
      updateItem(item.id, {
        titleTranslations: { ...item.titleTranslations, ru: item.title, [language]: title },
        descriptionTranslations: {
          ...item.descriptionTranslations,
          ru: stripHtml(item.description),
          [language]: description,
        },
        optionGroups,
      });
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
  }, [account?.id, account?.workspace, items, labelDirectory, sections, updateItem, updateSection, updateWorkspace]);

  persistTranslatedMaterialRef.current = persistTranslatedMaterial;

  const completeTranslationJob = useCallback((job: TranslationJob) => {
    if (cancelledJobIdsRef.current.has(job.id)) return;
    const jobIds = new Set(job.materialIds);
    const translatedMaterials: TranslationMaterial[] = [];
    const nextMaterials = materialsRef.current.map((material) => {
      if (!jobIds.has(material.id)) return material;
      const targetFieldIds = job.fieldIdsByMaterial?.[material.id];
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
        manuallyEditedLanguages.delete(job.language);
        return {
          ...field,
          manuallyEditedLanguages: [...manuallyEditedLanguages],
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

    translatedMaterials.forEach((material) => {
      persistTranslatedMaterialRef.current(material, job.language, material.fields);
    });
    materialsRef.current = nextMaterials;
    setMaterials(nextMaterials);
    setWorkspaceLanguageHasContent(job.language, true);
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
  }, [openWorkspace, setWorkspaceLanguageHasContent, setWorkspaceLanguageVisibility, showToast]);

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
          completeTranslationJob(latestJob);
        },
        Math.max(0, finishesAt - now),
      );
      timersRef.current.push(startTimer, finishTimer);
    });
  }, [completeTranslationJob, jobs]);

  useEffect(() => {
    const primaryLanguage = account?.workspace.primaryLanguage;
    const currentSources = new Map(
      realMaterials.flatMap((material) => material.fields.map((field) => [`${material.id}:${field.id}`, field.source])),
    );
    if (primaryLanguageRef.current !== primaryLanguage) {
      primaryLanguageRef.current = primaryLanguage;
      sourceSnapshotRef.current = currentSources;
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
  }, [account?.workspace.primaryLanguage, languages, realMaterials, startAutoTranslate]);

  const updateField = useCallback((materialId: string, fieldId: string, language: TranslationLanguageCode, value: string, origin: "manual" | "machine" = "manual") => {
    const activeMaterial = materials.find((material) => material.id === materialId);
    if (!activeMaterial) return;
    const updatedFields = activeMaterial.fields.map((field) => {
      if (field.id !== fieldId) return field;
      const manuallyEditedLanguages = new Set(field.manuallyEditedLanguages ?? []);
      const reviewLanguages = new Set(field.reviewLanguages ?? []);
      if (origin === "manual") manuallyEditedLanguages.add(language);
      else manuallyEditedLanguages.delete(language);
      reviewLanguages.delete(language);
      return {
        ...field,
        values: { ...field.values, [language]: value },
        manuallyEditedLanguages: [...manuallyEditedLanguages],
        reviewLanguages: [...reviewLanguages],
      };
    });
    if (account?.id) {
      const stored = readStoredManualFields(account.id);
      const storageKey = `${materialId}:${fieldId}`;
      const manuallyEditedLanguages = new Set(stored[storageKey] ?? []);
      if (origin === "manual") manuallyEditedLanguages.add(language);
      else manuallyEditedLanguages.delete(language);
      window.localStorage.setItem(
        `${TRANSLATION_MANUAL_FIELDS_STORAGE_PREFIX}.${account.id}`,
        JSON.stringify({ ...stored, [storageKey]: [...manuallyEditedLanguages] }),
      );
    }
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
      return { ...material, fields, statuses: { ...material.statuses, [language]: translationStatusForFields(fields, language) } };
    }));
    setSaveState("saved");
    showToast("Перевод подтверждён");
  }, [showToast]);

  const confirmField = useCallback((materialId: string, fieldId: string, language: TranslationLanguageCode) => {
    setMaterials((current) => current.map((material) => {
      if (material.id !== materialId) return material;
      const fields = material.fields.map((field) => field.id === fieldId
        ? { ...field, reviewLanguages: field.reviewLanguages?.filter((code) => code !== language) }
        : field);
      return { ...material, fields, statuses: { ...material.statuses, [language]: translationStatusForFields(fields, language) } };
    }));
    setSaveState("saved");
    showToast("Перевод проверен");
  }, [showToast]);

  const getCatalogSummary = useCallback((item: CatalogItem) => {
    const material = materials.find((candidate) => candidate.catalogItemId === item.id && candidate.kind === "position");
    const activeCodes = languages.map((language) => language.code);
    if (!material) return { filled: 0, total: activeCodes.length, outdated: false, tooltip: "Переводы ещё не созданы" };
    const filled = activeCodes.filter((code) => material.statuses[code] !== "missing").length;
    const outdated = activeCodes.some((code) => material.statuses[code] === "outdated");
    const statusLabels: Record<TranslationStatus, string> = { missing: "не переведено", machine: "автоперевод", translated: "переведено", outdated: "требует обновления" };
    return {
      filled,
      total: activeCodes.length,
      outdated,
      tooltip: activeCodes.map((code) => `${LANGUAGE_DETAILS[code].label} — ${statusLabels[material.statuses[code]]}`).join("\n"),
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
    openCatalogBulk: setCatalogBulkRequest,
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
