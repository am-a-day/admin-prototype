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
import { banners as seedBanners, type Banner } from "@/data/mock-data";
import type { LanguageCode } from "@/data/languages";
import {
  useCatalogLabels,
  type CatalogLabel,
} from "@/features/storefront/catalog/labels/catalog-labels";

export type TranslationLanguageCode = Exclude<LanguageCode, "ru">;
export type TranslationStatus = "missing" | "machine" | "translated" | "outdated";
export type TranslationCategory = "positions" | "sections" | "tags" | "stickers" | "banners" | "about";
export type TranslationFilter = "all" | TranslationStatus;
export type TranslationJobStatus = "queued" | "running" | "completed" | "error";
export type TranslationMaterialKind = "position" | "section" | "tag" | "sticker" | "banner" | "about";
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
  workspaceRequested: boolean;
  setActiveLanguage: (language: TranslationLanguageCode) => void;
  setActiveCategory: (category: TranslationCategory) => void;
  setActiveMaterialId: (materialId: string | null) => void;
  openWorkspace: (target?: WorkspaceTarget) => void;
  openCatalogBulk: (itemIds: string[]) => void;
  closeCatalogBulk: () => void;
  addLanguage: (language: TranslationLanguageCode, autoTranslateExisting: boolean) => void;
  removeLanguage: (language: TranslationLanguageCode) => void;
  setPublished: (language: TranslationLanguageCode, published: boolean) => void;
  setAutoTranslate: (language: TranslationLanguageCode, enabled: boolean) => void;
  updateField: (materialId: string, fieldId: string, language: TranslationLanguageCode, value: string) => void;
  confirmMaterial: (materialId: string, language: TranslationLanguageCode) => void;
  startAutoTranslate: (languageCodes: TranslationLanguageCode[], materialIds: string[], source: string) => void;
  updateBanner: (id: string, patch: Partial<Banner>) => void;
  removeBanner: (id: string) => string | null;
  addBanner: (imageUrl?: string) => string;
  dismissToast: () => void;
  consumeWorkspaceRequest: () => void;
  getCatalogSummary: (item: CatalogItem) => { filled: number; total: number; outdated: boolean; tooltip: string };
};

const TranslationsContext = createContext<TranslationsContextValue | null>(null);

const LANGUAGE_DETAILS: Record<TranslationLanguageCode, Pick<TranslationLanguage, "label" | "locale">> = {
  kk: { label: "Қазақша", locale: "kk-KZ" },
  en: { label: "English", locale: "en-US" },
  sr: { label: "Serbian", locale: "sr-RS" },
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

const TRANSLATION_LANGUAGE_CODES: TranslationLanguageCode[] = ["kk", "en", "sr"];

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function seededStatus(title: string, index: number, language: TranslationLanguageCode): TranslationStatus {
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
  return index % 9 === 0 ? "missing" : "translated";
}

function fallbackTarget(source: string, language: TranslationLanguageCode, status: TranslationStatus) {
  if (status === "missing") return "";
  const prefix = language === "kk" ? "Қазақша" : language === "en" ? "English" : "Serbian";
  return `[${prefix}] ${source}`;
}

function materialStatuses(
  title: string,
  index: number,
  valuesByLanguage?: Partial<Record<TranslationLanguageCode, string[]>>,
): Record<TranslationLanguageCode, TranslationStatus> {
  const allFilled = (values: string[] | undefined) => Boolean(values?.length)
    && values!.every((value) => Boolean(value.trim()));
  return {
    kk: allFilled(valuesByLanguage?.kk) ? "translated" : seededStatus(title, index, "kk"),
    en: allFilled(valuesByLanguage?.en) ? "translated" : seededStatus(title, index, "en"),
    sr: allFilled(valuesByLanguage?.sr) ? "translated" : "missing",
  };
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

function positionMaterial(item: CatalogItem, index: number): TranslationMaterial {
  const description = stripHtml(item.description);
  const translatedValues = (translations?: CatalogTranslations, seededKey?: "title" | "description") => Object.fromEntries(
    TRANSLATION_LANGUAGE_CODES.map((language) => [
      language,
      translations?.[language] || (seededKey ? SEEDED_TRANSLATIONS[item.title]?.[language]?.[seededKey] : "") || "",
    ]),
  );
  const rawFields: TranslationField[] = [{
    id: "title",
    label: "Название",
    source: item.title,
    values: translatedValues(item.titleTranslations, "title"),
  }, {
    id: "description",
    label: "Описание",
    source: description,
    values: translatedValues(item.descriptionTranslations, "description"),
  }, ...(item.optionGroups ?? []).flatMap((group) => [{
    id: `option-group:${group.id}`,
    label: `Группа · ${group.name || "Без названия"}`,
    source: group.name,
    kind: "option-group" as const,
    optionGroupId: group.id,
    values: translatedValues(group.nameTranslations),
  }, ...group.variants.map((variant) => ({
    id: `option:${group.id}:${variant.id}`,
    label: `Опция · ${variant.name || "Без названия"}`,
    source: variant.name,
    kind: "option" as const,
    optionGroupId: group.id,
    optionVariantId: variant.id,
    values: translatedValues(variant.nameTranslations),
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

function sectionMaterial(section: CatalogSection, index: number): TranslationMaterial {
  const rawFields: TranslationField[] = [{
    id: "name",
    label: "Название",
    source: section.name,
    values: Object.fromEntries(TRANSLATION_LANGUAGE_CODES.map((language) => [language, section.nameTranslations?.[language] ?? ""])),
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

function labelMaterial(label: CatalogLabel, index: number): TranslationMaterial {
  const source = label.translations.ru;
  const seed = LABEL_TRANSLATIONS[source] ?? {};
  const { fields, statuses } = resolveMaterialFields(source, index, [{
    id: "name",
    label: "Название",
    source,
    values: {
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

function bannerMaterial(banner: Banner, index: number): TranslationMaterial {
  const rawFields: TranslationField[] = [{
    id: "subtitle",
    label: "Надпись на баннере",
    source: banner.subtitle,
    values: Object.fromEntries(TRANSLATION_LANGUAGE_CODES.map((language) => [
      language,
      banner.subtitleTranslations?.[language] ?? "",
    ])),
  }, ...banner.tags.map((tag) => ({
    id: `tag:${tag.id}`,
    label: `Тег · ${tag.texts.ru || "Без текста"}`,
    source: tag.texts.ru,
    kind: "banner-tag" as const,
    bannerTagId: tag.id,
    values: {
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
  const positionMaterials = items.map(positionMaterial);
  const sectionMaterials = sections.map(sectionMaterial);
  const labelMaterials = labels.map(labelMaterial);
  const bannerMaterials = banners.map(bannerMaterial);
  const aboutMaterials: TranslationMaterial[] = workspace ? (() => {
    const aboutName = workspace.name?.trim() ?? "";
    const address = workspace.address ?? DEFAULT_WORKSPACE_ADDRESS;
    const description = workspace.description ?? "";
    const { fields, statuses } = resolveMaterialFields("О заведении", 0, [{
      id: "name",
      label: "Название заведения",
      source: aboutName,
      values: {
        kk: workspace?.localizedNames?.kk ?? "",
        en: workspace?.localizedNames?.en ?? "",
        sr: workspace?.localizedNames?.sr ?? "",
      },
    }, {
      id: "address",
      label: "Адрес",
      source: address,
      values: {
        kk: workspace.localizedAddresses?.kk ?? "",
        en: workspace.localizedAddresses?.en ?? "",
        sr: workspace.localizedAddresses?.sr ?? "",
      },
    }, {
      id: "description",
      label: "Описание",
      source: description,
      values: {
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
  return [...positionMaterials, ...sectionMaterials, ...labelMaterials, ...bannerMaterials, ...aboutMaterials];
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
    const hasFieldLevelHistory = fields.some((field) => Boolean(field.previousSource?.trim()));
    fields.forEach((field, index) => {
      totalFields += 1;
      const isOutdated = material.statuses[language] === "outdated"
        && (hasFieldLevelHistory ? Boolean(field.previousSource?.trim()) : index === 0);
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
            previousSource: previousField.previousSource,
            values: field.source.trim() ? { ...field.values, ...previousField.values } : {},
          }
          : field;
      }),
    };
  });
}

export function TranslationsProvider({ children }: { children: ReactNode }) {
  const { items, sections, updateItem, updateSection } = useCatalogStore();
  const { account, updateWorkspace } = useMockAuth();
  const labelDirectory = useCatalogLabels(true);
  const [banners, setBanners] = useState<Banner[]>(seedBanners);
  const realMaterials = useMemo(
    () => buildTranslationMaterials(items, sections, labelDirectory.labels, banners, account?.workspace),
    [account?.workspace, banners, items, labelDirectory.labels, sections],
  );
  const [languages, setLanguages] = useState<TranslationLanguage[]>([
    { code: "kk", label: "Қазақша", locale: "kk-KZ", published: false, doneFields: 41, totalFields: 64, missing: 23, outdated: 7, autoTranslate: false },
    { code: "en", label: "English", locale: "en-US", published: true, doneFields: 57, totalFields: 64, missing: 8, outdated: 3, autoTranslate: true },
  ]);
  const [materials, setMaterials] = useState<TranslationMaterial[]>(realMaterials);
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [toast, setToast] = useState<TranslationToast | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<TranslationLanguageCode>("kk");
  const [activeCategory, setActiveCategory] = useState<TranslationCategory>("positions");
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(() => realMaterials.find((material) => material.category === "positions")?.id ?? null);
  const [catalogBulkRequest, setCatalogBulkRequest] = useState<string[] | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [workspaceRequested, setWorkspaceRequested] = useState(false);
  const timersRef = useRef<number[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const caesarDescriptionRef = useRef<string | null>(null);

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
  }, []);

  const updateMaterialStatus = useCallback((materialIds: string[], language: TranslationLanguageCode, next: TranslationStatus) => {
    setMaterials((current) => current.map((material) => materialIds.includes(material.id)
      ? { ...material, statuses: { ...material.statuses, [language]: next } }
      : material));
  }, []);

  const startAutoTranslate = useCallback((languageCodes: TranslationLanguageCode[], materialIds: string[], source: string) => {
    const uniqueIds = [...new Set(materialIds)].filter((id) => materials.some((material) => material.id === id));
    if (uniqueIds.length === 0 || languageCodes.length === 0) return;
    languageCodes.forEach((language, index) => {
      const id = `translation-job-${Date.now()}-${language}-${index}`;
      const job: TranslationJob = { id, language, source, materialIds: uniqueIds, total: uniqueIds.length, completed: 0, status: "queued" };
      setJobs((current) => [job, ...current]);
      const startTimer = window.setTimeout(() => {
        setJobs((current) => current.map((item) => item.id === id ? { ...item, status: "running", completed: Math.max(1, Math.floor(item.total * 0.35)) } : item));
      }, 300 + index * 80);
      const progressTimer = window.setTimeout(() => {
        setJobs((current) => current.map((item) => item.id === id ? { ...item, completed: Math.max(1, Math.floor(item.total * 0.75)) } : item));
      }, 850 + index * 100);
      const finishTimer = window.setTimeout(() => {
        setMaterials((current) => current.map((material) => {
          if (!uniqueIds.includes(material.id)) return material;
          return {
            ...material,
            fields: material.fields.map((field) => ({
              ...field,
              values: {
                ...field.values,
                [language]: field.source.trim()
                  ? field.values[language]?.trim() || fallbackTarget(field.source, language, "machine")
                  : "",
              },
            })),
          };
        }));
        updateMaterialStatus(uniqueIds, language, "machine");
        setJobs((current) => current.map((item) => item.id === id ? { ...item, status: "completed", completed: item.total } : item));
        showToast(`${uniqueIds.length} материалов переведено`, "Посмотреть переводы", () => openWorkspace({ language }));
      }, 1500 + index * 120);
      timersRef.current.push(startTimer, progressTimer, finishTimer);
    });
    showToast(`${uniqueIds.length} материалов переводятся`);
  }, [materials, openWorkspace, showToast, updateMaterialStatus]);

  const addLanguage = useCallback((language: TranslationLanguageCode, autoTranslateExisting: boolean) => {
    setLanguages((current) => current.some((item) => item.code === language) ? current : [...current, {
      code: language,
      ...LANGUAGE_DETAILS[language],
      published: false,
      doneFields: 0,
      totalFields: 0,
      missing: 0,
      outdated: 0,
      autoTranslate: false,
    }]);
    showToast(`${LANGUAGE_DETAILS[language].label} добавлен`);
    if (autoTranslateExisting) {
      const timer = window.setTimeout(() => startAutoTranslate([language], materials.map((material) => material.id), "Новый язык"), 0);
      timersRef.current.push(timer);
    }
  }, [materials, showToast, startAutoTranslate]);

  const removeLanguage = useCallback((language: TranslationLanguageCode) => {
    setLanguages((current) => current.filter((item) => item.code !== language));
    if (activeLanguage === language) setActiveLanguage("kk");
    showToast(`${LANGUAGE_DETAILS[language].label} удалён`);
  }, [activeLanguage, showToast]);

  const setPublished = useCallback((language: TranslationLanguageCode, published: boolean) => {
    setLanguages((current) => current.map((item) => item.code === language ? { ...item, published } : item));
    showToast(published ? "Язык опубликован" : "Язык снят с публикации");
  }, [showToast]);

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
      if (section) updateSection(section.id, { nameTranslations: { ...section.nameTranslations, ru: section.name, [language]: value } });
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
  }, [account?.workspace, items, labelDirectory, sections, updateItem, updateSection, updateWorkspace]);

  const updateField = useCallback((materialId: string, fieldId: string, language: TranslationLanguageCode, value: string) => {
    const activeMaterial = materials.find((material) => material.id === materialId);
    if (!activeMaterial) return;
    const updatedFields = activeMaterial.fields.map((field) => field.id === fieldId ? { ...field, values: { ...field.values, [language]: value } } : field);
    const translatableFields = updatedFields.filter((field) => field.source.trim());
    const nextStatus: TranslationStatus = translatableFields.length > 0
      && translatableFields.every((field) => Boolean(field.values[language]?.trim()))
      ? "translated"
      : "missing";
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
  }, [materials, persistField]);

  const confirmMaterial = useCallback((materialId: string, language: TranslationLanguageCode) => {
    updateMaterialStatus([materialId], language, "translated");
    setSaveState("saved");
    showToast("Перевод подтверждён");
  }, [showToast, updateMaterialStatus]);

  const caesar = items.find((item) => item.title === "Цезарь с курицей");
  useEffect(() => {
    if (!caesar) return;
    const currentDescription = stripHtml(caesar.description);
    if (caesarDescriptionRef.current === null) {
      caesarDescriptionRef.current = currentDescription;
      return;
    }
    if (currentDescription === caesarDescriptionRef.current) return;
    const previousSource = caesarDescriptionRef.current;
    caesarDescriptionRef.current = currentDescription;
    setMaterials((current) => current.map((material) => material.id !== caesar.id ? material : {
      ...material,
      sourceChangedAt: "Только что",
      statuses: { ...material.statuses, kk: "outdated" },
      fields: material.fields.map((field) => field.id === "description" ? { ...field, previousSource, source: currentDescription } : field),
    }));
    showToast("Перевод «Цезарь с курицей» требует обновления", "Открыть перевод", () => openWorkspace({ language: "kk", category: "positions", materialId: caesar.id }));
  }, [caesar, openWorkspace, showToast]);

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
    workspaceRequested,
    setActiveLanguage,
    setActiveCategory,
    setActiveMaterialId,
    openWorkspace,
    openCatalogBulk: setCatalogBulkRequest,
    closeCatalogBulk: () => setCatalogBulkRequest(null),
    addLanguage,
    removeLanguage,
    setPublished,
    setAutoTranslate,
    updateField,
    confirmMaterial,
    startAutoTranslate,
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
    banners,
    catalogBulkRequest,
    confirmMaterial,
    getCatalogSummary,
    jobs,
    languages,
    materials,
    openWorkspace,
    removeBanner,
    removeLanguage,
    saveState,
    setAutoTranslate,
    setPublished,
    startAutoTranslate,
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
