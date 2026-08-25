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
import type { CatalogItem } from "@/data/catalog";
import type { LanguageCode } from "@/data/languages";

export type TranslationLanguageCode = Exclude<LanguageCode, "ru">;
export type TranslationStatus = "missing" | "machine" | "translated" | "outdated";
export type TranslationCategory = "all" | "positions" | "sections" | "banners" | "about";
export type TranslationFilter = "all" | TranslationStatus;
export type TranslationJobStatus = "queued" | "running" | "completed" | "error";

export type TranslationField = {
  id: string;
  label: string;
  source: string;
  previousSource?: string;
  values: Partial<Record<TranslationLanguageCode, string>>;
};

export type TranslationMaterial = {
  id: string;
  catalogItemId?: string;
  title: string;
  typeLabel: string;
  category: Exclude<TranslationCategory, "all">;
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

function stripHtml(value: string) {
  return value
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function findItem(items: CatalogItem[], title: string) {
  return items.find((item) => item.title === title);
}

function positionMaterial(
  item: CatalogItem | undefined,
  fallbackId: string,
  displayTitle: string,
  kkStatus: TranslationStatus,
  kkTitle: string,
  kkDescription: string,
  enStatus: TranslationStatus = "translated",
): TranslationMaterial {
  const sourceTitle = item?.title ?? displayTitle;
  const description = stripHtml(item?.description ?? "");
  const fields: TranslationField[] = [
    {
      id: "title",
      label: "Название",
      source: sourceTitle,
      values: { kk: kkTitle, en: sourceTitle },
    },
  ];
  if (description) {
    fields.push({
      id: "description",
      label: "Описание",
      source: description,
      values: { kk: kkDescription, en: description },
    });
  }
  return {
    id: item?.id ?? fallbackId,
    catalogItemId: item?.id,
    title: displayTitle,
    typeLabel: "Позиция",
    category: "positions",
    statuses: { kk: kkStatus, en: enStatus, sr: "missing" },
    fields,
  };
}

function buildInitialMaterials(items: CatalogItem[]): TranslationMaterial[] {
  const caesar = findItem(items, "Цезарь с курицей");
  const tomYam = findItem(items, "Том-ям с курицей");
  const latte = findItem(items, "Латте");
  const khachapuri = findItem(items, "Хачапури по-аджарски");
  const margarita = findItem(items, "Пицца Маргарита");

  return [
    positionMaterial(
      caesar,
      "position-caesar",
      "Цезарь с курицей",
      "translated",
      "Тауық еті қосылған Цезарь",
      "Грильде пісірілген тауық төсі, салат жапырақтары, қытырлақ нан және пармезан.",
    ),
    positionMaterial(tomYam, "position-tom-yam", "Том-ям", "missing", "", ""),
    positionMaterial(
      latte,
      "position-latte",
      "Латте",
      "machine",
      "Латте",
      "Жұмсақ дәмі мен хош иісі үйлескен сүтті кофе.",
    ),
    positionMaterial(khachapuri, "position-khachapuri", "Хачапури по-аджарски", "missing", "", ""),
    positionMaterial(margarita, "position-margarita", "Пицца Маргарита", "missing", "", ""),
    {
      id: "section-burgers",
      title: "Бургеры",
      typeLabel: "Раздел",
      category: "sections",
      statuses: { kk: "translated", en: "translated", sr: "missing" },
      fields: [{ id: "title", label: "Название", source: "Бургеры", values: { kk: "Бургерлер", en: "Burgers" } }],
    },
    {
      id: "banner-autumn",
      title: "Осеннее меню",
      typeLabel: "Баннер",
      category: "banners",
      statuses: { kk: "machine", en: "translated", sr: "missing" },
      fields: [
        { id: "title", label: "Заголовок", source: "Осеннее меню", values: { kk: "Күзгі мәзір", en: "Autumn menu" } },
        { id: "subtitle", label: "Подзаголовок", source: "Сезонные блюда уже в меню", values: { kk: "Маусымдық тағамдар мәзірде", en: "Seasonal dishes are here" } },
      ],
    },
    {
      id: "banner-delivery",
      title: "Бесплатная доставка",
      typeLabel: "Баннер",
      category: "banners",
      statuses: { kk: "missing", en: "translated", sr: "missing" },
      fields: [{ id: "title", label: "Заголовок", source: "Бесплатная доставка", values: { kk: "", en: "Free delivery" } }],
    },
    {
      id: "about-venue",
      title: "О заведении",
      typeLabel: "О заведении",
      category: "about",
      sourceChangedAt: "Сегодня, 11:42",
      statuses: { kk: "outdated", en: "translated", sr: "missing" },
      fields: [{
        id: "description",
        label: "Описание",
        source: "Городское кафе с современной азиатской кухней и открытой кухней.",
        previousSource: "Городское кафе с современной азиатской кухней.",
        values: {
          kk: "Заманауи азиялық асханасы бар қалалық кафе.",
          en: "An urban cafe with modern Asian cuisine and an open kitchen.",
        },
      }],
    },
  ];
}

function nextLanguageStats(
  language: TranslationLanguage,
  previous: TranslationStatus,
  next: TranslationStatus,
) {
  if (previous === next) return language;
  let doneFields = language.doneFields;
  let missing = language.missing;
  let outdated = language.outdated;
  if (previous === "missing" && next !== "missing") {
    doneFields = Math.min(language.totalFields, doneFields + 1);
    missing = Math.max(0, missing - 1);
  }
  if (previous === "outdated" && next !== "outdated") {
    doneFields = Math.min(language.totalFields, doneFields + 1);
    outdated = Math.max(0, outdated - 1);
  }
  if (previous !== "missing" && next === "missing") {
    doneFields = Math.max(0, doneFields - 1);
    missing += 1;
  }
  if (previous !== "outdated" && next === "outdated") {
    doneFields = Math.max(0, doneFields - 1);
    outdated += 1;
  }
  return { ...language, doneFields, missing, outdated };
}

export function TranslationsProvider({ children }: { children: ReactNode }) {
  const { items } = useCatalogStore();
  const [languages, setLanguages] = useState<TranslationLanguage[]>([
    { code: "kk", label: "Қазақша", locale: "kk-KZ", published: false, doneFields: 41, totalFields: 64, missing: 23, outdated: 7, autoTranslate: false },
    { code: "en", label: "English", locale: "en-US", published: true, doneFields: 57, totalFields: 64, missing: 8, outdated: 3, autoTranslate: true },
  ]);
  const [materials, setMaterials] = useState<TranslationMaterial[]>(() => buildInitialMaterials(items));
  const [jobs, setJobs] = useState<TranslationJob[]>([]);
  const [toast, setToast] = useState<TranslationToast | null>(null);
  const [activeLanguage, setActiveLanguage] = useState<TranslationLanguageCode>("kk");
  const [activeCategory, setActiveCategory] = useState<TranslationCategory>("positions");
  const [activeMaterialId, setActiveMaterialId] = useState<string | null>(() => buildInitialMaterials(items)[0]?.id ?? null);
  const [catalogBulkRequest, setCatalogBulkRequest] = useState<string[] | null>(null);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [workspaceRequested, setWorkspaceRequested] = useState(false);
  const timersRef = useRef<number[]>([]);
  const saveTimerRef = useRef<number | null>(null);
  const caesarDescriptionRef = useRef<string | null>(null);

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
    const transitions = materials
      .filter((material) => materialIds.includes(material.id) && material.statuses[language] !== next)
      .map((material) => ({ previous: material.statuses[language], next }));
    setMaterials((current) => current.map((material) => {
      if (!materialIds.includes(material.id)) return material;
      if (material.statuses[language] === next) return material;
      return { ...material, statuses: { ...material.statuses, [language]: next } };
    }));
    if (transitions.length > 0) {
      setLanguages((current) => current.map((item) => {
        if (item.code !== language) return item;
        return transitions.reduce((result, transition) => nextLanguageStats(result, transition.previous, transition.next), item);
      }));
    }
  }, [materials]);

  const startAutoTranslate = useCallback((languageCodes: TranslationLanguageCode[], materialIds: string[], source: string) => {
    const uniqueIds = [...new Set(materialIds)].filter((id) => materials.some((material) => material.id === id));
    if (uniqueIds.length === 0 || languageCodes.length === 0) return;
    languageCodes.forEach((language, index) => {
      const id = `translation-job-${Date.now()}-${language}-${index}`;
      const job: TranslationJob = {
        id,
        language,
        source,
        materialIds: uniqueIds,
        total: uniqueIds.length,
        completed: 0,
        status: "queued",
      };
      setJobs((current) => [job, ...current]);
      const startTimer = window.setTimeout(() => {
        setJobs((current) => current.map((item) => item.id === id ? { ...item, status: "running", completed: Math.max(1, Math.floor(item.total * 0.35)) } : item));
      }, 350 + index * 80);
      const progressTimer = window.setTimeout(() => {
        setJobs((current) => current.map((item) => item.id === id ? { ...item, completed: Math.max(1, Math.floor(item.total * 0.75)) } : item));
      }, 900 + index * 100);
      const finishTimer = window.setTimeout(() => {
        setMaterials((current) => current.map((material) => {
          if (!uniqueIds.includes(material.id)) return material;
          const values = material.fields.map((field) => ({
            ...field,
            values: {
              ...field.values,
              [language]: field.values[language]?.trim() || `[${LANGUAGE_DETAILS[language].label}] ${field.source}`,
            },
          }));
          return { ...material, fields: values };
        }));
        updateMaterialStatus(uniqueIds, language, "machine");
        setJobs((current) => current.map((item) => item.id === id ? { ...item, status: "completed", completed: item.total } : item));
        showToast("Автоперевод завершён", "Посмотреть переводы", () => openWorkspace({ language }));
      }, 1550 + index * 120);
      timersRef.current.push(startTimer, progressTimer, finishTimer);
    });
    showToast(`${uniqueIds.length} материалов добавлено в очередь`, "Открыть переводы", () => openWorkspace({ language: languageCodes[0] }));
  }, [materials, openWorkspace, showToast, updateMaterialStatus]);

  const addLanguage = useCallback((language: TranslationLanguageCode, autoTranslateExisting: boolean) => {
    setLanguages((current) => {
      if (current.some((item) => item.code === language)) return current;
      return [...current, {
        code: language,
        ...LANGUAGE_DETAILS[language],
        published: false,
        doneFields: 0,
        totalFields: 64,
        missing: 64,
        outdated: 0,
        autoTranslate: false,
      }];
    });
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

  const updateField = useCallback((materialId: string, fieldId: string, language: TranslationLanguageCode, value: string) => {
    const activeMaterial = materials.find((material) => material.id === materialId);
    if (!activeMaterial) return;
    const updatedFields = activeMaterial.fields.map((field) => field.id === fieldId
      ? { ...field, values: { ...field.values, [language]: value } }
      : field);
    const previousStatus = activeMaterial.statuses[language];
    const nextStatus: TranslationStatus = updatedFields.every((field) => Boolean(field.values[language]?.trim()))
      ? "translated"
      : "missing";

    setSaveState("saving");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    setMaterials((current) => current.map((material) => {
      if (material.id !== materialId) return material;
      const fields = material.fields.map((field) => field.id === fieldId
        ? { ...field, values: { ...field.values, [language]: value } }
        : field);
      return { ...material, fields, statuses: { ...material.statuses, [language]: nextStatus } };
    }));
    if (previousStatus !== nextStatus) {
      setLanguages((current) => current.map((item) => item.code === language
        ? nextLanguageStats(item, previousStatus, nextStatus)
        : item));
    }
    saveTimerRef.current = window.setTimeout(() => {
      setSaveState("saved");
      const idleTimer = window.setTimeout(() => setSaveState("idle"), 1800);
      timersRef.current.push(idleTimer);
    }, 550);
  }, [materials]);

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
    setMaterials((current) => current.map((material) => {
      if (material.catalogItemId !== caesar.id) return material;
      return {
        ...material,
        sourceChangedAt: "Только что",
        statuses: { ...material.statuses, kk: "outdated" },
        fields: material.fields.map((field) => field.id === "description"
          ? { ...field, previousSource, source: currentDescription }
          : field),
      };
    }));
    setLanguages((current) => current.map((language) => language.code === "kk"
      ? nextLanguageStats(language, "translated", "outdated")
      : language));
    showToast("Перевод «Цезарь с курицей» требует обновления", "Открыть перевод", () => openWorkspace({ language: "kk", category: "positions", materialId: caesar.id }));
  }, [caesar?.description, caesar?.id, openWorkspace, showToast]);

  const getCatalogSummary = useCallback((item: CatalogItem) => {
    const material = materials.find((candidate) => candidate.catalogItemId === item.id);
    const activeCodes = languages.map((language) => language.code);
    if (!material) {
      return {
        filled: Math.min(item.translationFilledCount, activeCodes.length),
        total: activeCodes.length,
        outdated: false,
        tooltip: activeCodes.map((code) => `${LANGUAGE_DETAILS[code].label} — переведено`).join("\n"),
      };
    }
    const filled = activeCodes.filter((code) => material.statuses[code] !== "missing").length;
    const outdated = activeCodes.some((code) => material.statuses[code] === "outdated");
    const statusLabels: Record<TranslationStatus, string> = {
      missing: "не переведено",
      machine: "автоперевод",
      translated: "переведено",
      outdated: "требует обновления",
    };
    return {
      filled,
      total: activeCodes.length,
      outdated,
      tooltip: activeCodes.map((code) => `${LANGUAGE_DETAILS[code].label} — ${statusLabels[material.statuses[code]]}`).join("\n"),
    };
  }, [languages, materials]);

  const openCatalogBulk = useCallback((itemIds: string[]) => {
    const selectedItems = items.filter((item) => itemIds.includes(item.id));
    setMaterials((current) => {
      const known = new Set(current.map((material) => material.catalogItemId).filter(Boolean));
      const additions = selectedItems
        .filter((item) => !known.has(item.id))
        .map((item) => positionMaterial(item, item.id, item.title, "missing", "", "", "missing"));
      return additions.length > 0 ? [...current, ...additions] : current;
    });
    setCatalogBulkRequest(itemIds);
  }, [items]);

  const value = useMemo<TranslationsContextValue>(() => ({
    languages,
    materials,
    jobs,
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
    openCatalogBulk,
    closeCatalogBulk: () => setCatalogBulkRequest(null),
    addLanguage,
    removeLanguage,
    setPublished,
    setAutoTranslate,
    updateField,
    confirmMaterial,
    startAutoTranslate,
    dismissToast: () => setToast(null),
    consumeWorkspaceRequest: () => setWorkspaceRequested(false),
    getCatalogSummary,
  }), [
    activeCategory,
    activeLanguage,
    activeMaterialId,
    addLanguage,
    catalogBulkRequest,
    confirmMaterial,
    getCatalogSummary,
    jobs,
    languages,
    materials,
    openWorkspace,
    openCatalogBulk,
    removeLanguage,
    saveState,
    setAutoTranslate,
    setPublished,
    startAutoTranslate,
    toast,
    updateField,
    workspaceRequested,
  ]);

  return <TranslationsContext.Provider value={value}>{children}</TranslationsContext.Provider>;
}

export function useTranslations() {
  const context = useContext(TranslationsContext);
  if (!context) throw new Error("useTranslations must be used within TranslationsProvider");
  return context;
}

export function useTranslationsOptional() {
  return useContext(TranslationsContext);
}
