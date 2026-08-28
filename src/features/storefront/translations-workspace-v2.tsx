import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  CaretDown,
  Check,
  CircleDashed,
  DotsThreeVertical,
  MagnifyingGlass,
  Plus,
  SpinnerGap,
  StarFour,
  StopCircle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { DescriptionRichTextEditor } from "@/components/workspace/description-rich-text-editor";
import { useCatalogStore } from "@/contexts/catalog-store-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import {
  useTranslations,
  type TranslationCategory,
  type TranslationField,
  type TranslationLanguage,
  type TranslationLanguageCode,
  type TranslationJob,
  type TranslationMaterial,
} from "@/contexts/translations-context";
import { LANGUAGES } from "@/data/languages";
import { PositionSaveStatus } from "@/features/storefront/catalog/editor/position-editor";
import { readCatalogJson, writeCatalogJson } from "@/features/storefront/catalog/persistence";
import { DeleteConfirmationDialog } from "@/features/storefront/catalog/ui/delete-confirmation-dialog";
import { CatalogThumbnail } from "@/features/storefront/catalog/ui/catalog-thumbnail";
import { catalogStorageKey } from "@/lib/catalog-preview";
import { cn } from "@/lib/utils";

type TranslationContentType = TranslationCategory | "options";

const CONTENT_TYPES: Array<{ id: TranslationContentType; label: string }> = [
  { id: "positions", label: "Позиции" },
  { id: "options", label: "Опции" },
  { id: "sections", label: "Разделы" },
  { id: "tags", label: "Теги" },
  { id: "stickers", label: "Стикеры" },
  { id: "banners", label: "Баннеры" },
  { id: "about", label: "О заведении" },
  { id: "interface", label: "Заголовки и кнопки" },
];

const TRANSLATION_LANGUAGE_LABELS: Record<TranslationLanguageCode, string> = {
  ru: "Русский",
  kk: "Казахский",
  en: "Английский",
  zh: "Китайский",
  fr: "Французский",
  es: "Испанский",
  sr: "Сербский",
};

const TRANSLATION_LANGUAGE_DELETE_LABELS: Record<TranslationLanguageCode, string> = {
  ru: "русский",
  kk: "казахский",
  en: "английский",
  zh: "китайский",
  fr: "французский",
  es: "испанский",
  sr: "сербский",
};

const TRANSLATION_LANGUAGE_BADGES: Record<TranslationLanguageCode, string> = {
  ru: "RU",
  kk: "KK",
  en: "EN",
  zh: "CN",
  fr: "FR",
  es: "ES",
  sr: "SR",
};

const TRANSLATIONS_SIDEBAR_WIDTH_STORAGE_KEY = catalogStorageKey("translations.sidebarWidth.v1");
const TRANSLATIONS_SIDEBAR_DEFAULT_WIDTH = 230;
const TRANSLATIONS_SIDEBAR_MIN_WIDTH = 200;
const TRANSLATIONS_SIDEBAR_MAX_WIDTH = 420;
const TRANSLATIONS_HISTORY_STATE_KEY = "taskoTranslationsView";

type TranslationsViewState = {
  language: TranslationLanguageCode;
  contentType: TranslationContentType;
  selectedKey: string | null;
  query: string;
  searchOpen: boolean;
  scrollTop: number;
};

type TranslationEntity = {
  key: string;
  material: TranslationMaterial;
  title: string;
  subtitle?: string;
  fields: TranslationField[];
};

function readTranslationsViewState(): TranslationsViewState | null {
  if (typeof window === "undefined" || !window.history.state || typeof window.history.state !== "object") return null;
  const candidate = (window.history.state as Record<string, unknown>)[TRANSLATIONS_HISTORY_STATE_KEY] as Partial<TranslationsViewState> | undefined;
  if (!candidate
    || !Object.hasOwn(TRANSLATION_LANGUAGE_LABELS, candidate.language ?? "")
    || !CONTENT_TYPES.some((item) => item.id === candidate.contentType)) return null;
  return {
    language: candidate.language as TranslationLanguageCode,
    contentType: candidate.contentType as TranslationContentType,
    selectedKey: typeof candidate.selectedKey === "string" ? candidate.selectedKey : null,
    query: typeof candidate.query === "string" ? candidate.query : "",
    searchOpen: candidate.searchOpen === true,
    scrollTop: typeof candidate.scrollTop === "number" && Number.isFinite(candidate.scrollTop) ? Math.max(0, candidate.scrollTop) : 0,
  };
}

function writeTranslationsViewState(viewState: TranslationsViewState) {
  if (typeof window === "undefined") return;
  const currentState = window.history.state && typeof window.history.state === "object" ? window.history.state : {};
  window.history.replaceState({ ...currentState, [TRANSLATIONS_HISTORY_STATE_KEY]: viewState }, "", window.location.href);
}

function languageLabel(code: TranslationLanguageCode) {
  return TRANSLATION_LANGUAGE_LABELS[code];
}

function LanguageCodeBadge({ code }: { code: TranslationLanguageCode }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-[#e7e5e4] bg-white text-[9px] font-semibold leading-none text-[#292524]">
      {TRANSLATION_LANGUAGE_BADGES[code]}
    </span>
  );
}

function clampTranslationsSidebarWidth(width: number) {
  return Math.max(TRANSLATIONS_SIDEBAR_MIN_WIDTH, Math.min(TRANSLATIONS_SIDEBAR_MAX_WIDTH, width));
}

function readTranslationsSidebarWidth() {
  const storedWidth = readCatalogJson<number>(
    TRANSLATIONS_SIDEBAR_WIDTH_STORAGE_KEY,
    TRANSLATIONS_SIDEBAR_DEFAULT_WIDTH,
  );
  return Number.isFinite(storedWidth)
    ? clampTranslationsSidebarWidth(storedWidth)
    : TRANSLATIONS_SIDEBAR_DEFAULT_WIDTH;
}

function ResizableTranslationsSidebar({ children }: { children: ReactNode }) {
  const [width, setWidth] = useState(readTranslationsSidebarWidth);
  const [resizing, setResizing] = useState(false);
  const widthRef = useRef(width);
  const resizeSessionRef = useRef<{ pointerId: number; startX: number; startWidth: number } | null>(null);

  const updateWidth = useCallback((nextWidth: number) => {
    const clampedWidth = clampTranslationsSidebarWidth(nextWidth);
    widthRef.current = clampedWidth;
    setWidth(clampedWidth);
  }, []);

  const finishResize = useCallback((element?: HTMLElement, pointerId?: number) => {
    if (element && pointerId !== undefined && element.hasPointerCapture(pointerId)) {
      element.releasePointerCapture(pointerId);
    }
    resizeSessionRef.current = null;
    setResizing(false);
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
    writeCatalogJson(TRANSLATIONS_SIDEBAR_WIDTH_STORAGE_KEY, Math.round(widthRef.current));
  }, []);

  useEffect(() => () => {
    if (!resizeSessionRef.current) return;
    document.body.style.cursor = "";
    document.body.style.userSelect = "";
  }, []);

  return (
    <div
      data-translations-sidebar-shell
      data-translations-sidebar-resizing={resizing ? "true" : undefined}
      style={{ width }}
      className="relative flex h-full shrink-0 overflow-visible"
    >
      {children}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Изменить ширину панели переводов"
        aria-valuemin={TRANSLATIONS_SIDEBAR_MIN_WIDTH}
        aria-valuemax={TRANSLATIONS_SIDEBAR_MAX_WIDTH}
        aria-valuenow={Math.round(width)}
        tabIndex={0}
        data-translations-sidebar-resize-handle
        onPointerDown={(event) => {
          if (event.button !== 0) return;
          event.currentTarget.setPointerCapture(event.pointerId);
          resizeSessionRef.current = {
            pointerId: event.pointerId,
            startX: event.clientX,
            startWidth: widthRef.current,
          };
          setResizing(true);
          document.body.style.cursor = "col-resize";
          document.body.style.userSelect = "none";
        }}
        onPointerMove={(event) => {
          const session = resizeSessionRef.current;
          if (!session || session.pointerId !== event.pointerId) return;
          updateWidth(session.startWidth + event.clientX - session.startX);
        }}
        onPointerUp={(event) => finishResize(event.currentTarget, event.pointerId)}
        onPointerCancel={(event) => finishResize(event.currentTarget, event.pointerId)}
        onKeyDown={(event) => {
          if (event.key !== "ArrowLeft" && event.key !== "ArrowRight") return;
          event.preventDefault();
          const direction = event.key === "ArrowRight" ? 1 : -1;
          const step = event.shiftKey ? 20 : 2;
          const nextWidth = clampTranslationsSidebarWidth(widthRef.current + direction * step);
          updateWidth(nextWidth);
          writeCatalogJson(TRANSLATIONS_SIDEBAR_WIDTH_STORAGE_KEY, Math.round(nextWidth));
        }}
        className="group/sidebar-resize absolute inset-y-0 right-[-5px] z-50 w-[10px] cursor-col-resize touch-none outline-none"
      >
        <span className="absolute inset-y-0 left-[4px] w-px bg-[#a8a29e] opacity-0 transition-opacity duration-150 group-hover/sidebar-resize:opacity-40 group-focus/sidebar-resize:opacity-50" />
      </div>
    </div>
  );
}

function AddLanguagePopover({ children }: { children: ReactNode }) {
  const { account } = useMockAuth();
  const { activeLanguage, addLanguage, languages, setActiveLanguage } = useTranslations();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const primaryLanguage = account?.workspace.primaryLanguage ?? "ru";
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const addableLanguages = LANGUAGES.filter((language) => language.code !== primaryLanguage
    && !languages.some((item) => item.code === language.code));
  const available = addableLanguages.filter((language) => (
    !normalizedQuery || [language.code, language.short, language.label, languageLabel(language.code)]
      .some((value) => value.toLocaleLowerCase("ru").includes(normalizedQuery))
  ));

  const chooseLanguage = (code: TranslationLanguageCode) => {
    const previousLanguage = activeLanguage;
    addLanguage(code, true);
    setActiveLanguage(previousLanguage);
    setOpen(false);
    setQuery("");
  };

  if (addableLanguages.length === 0) return null;

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setQuery(""); }}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent align="start" sideOffset={5} className="w-[200px] overflow-hidden rounded-[12px] p-0 shadow-md">
        <div className="border-b border-[#e7e5e4] p-1">
          <div className="relative">
            <MagnifyingGlass size={16} className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 text-[#0c0a09]" />
            <Input
              autoFocus
              size="compact"
              aria-label="Поиск языка"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск"
              className="h-7 rounded-[8px] border-0 bg-[#e7e5e4] py-1.5 pl-8 pr-2 text-[13px] text-[#0c0a09] shadow-none placeholder:text-[#0c0a09] focus-visible:ring-0"
            />
          </div>
        </div>
        <div className="max-h-[280px] overflow-y-auto p-1">
          {available.map((language) => (
            <button
              key={language.code}
              type="button"
              onClick={() => chooseLanguage(language.code)}
              className="flex h-7 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-[#0c0a09] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              <LanguageCodeBadge code={language.code} />
              <span className="min-w-0 flex-1 truncate">{languageLabel(language.code)}</span>
            </button>
          ))}
          {available.length === 0 && <div className="px-2 py-4 text-center text-[12px] text-[#666]">Языки не найдены</div>}
        </div>
      </PopoverContent>
    </Popover>
  );
}

function LanguageActionsPopover({ language }: { language: TranslationLanguage }) {
  const { account } = useMockAuth();
  const {
    jobs,
    materials,
    removeLanguage,
    setPrimaryLanguage,
    setPublished,
    translateMissingFields,
  } = useTranslations();
  const [open, setOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [hideDialogOpen, setHideDialogOpen] = useState(false);
  const close = () => setOpen(false);
  const isOriginal = language.code === (account?.workspace.primaryLanguage ?? "ru");
  const hasActiveJob = jobs.some((job) => (
    job.language === language.code && (job.status === "idle" || job.status === "running")
  ));
  const missingFieldCount = useMemo(() => materials.reduce((count, material) => (
    count + material.fields.filter((field) => (
      field.source.trim() && !field.values[language.code]?.trim()
    )).length
  ), 0), [language.code, materials]);
  const canTranslateMissing = missingFieldCount > 0 && !hasActiveJob;
  const hasTranslationActions = !isOriginal || canTranslateMissing;
  const actionClassName = "flex min-h-7 w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px] font-normal leading-4 text-[#0c0a09] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10";

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <Tooltip label="Действия" side="top">
          <PopoverTrigger asChild>
            <button
              type="button"
              aria-label={`Действия языка «${languageLabel(language.code)}»`}
              onClick={(event) => event.stopPropagation()}
              className="absolute right-1 top-1/2 z-10 flex size-5 -translate-y-1/2 items-center justify-center rounded-[6px] text-[#333] opacity-0 transition hover:bg-[#e7e5e4] focus:opacity-100 focus-visible:bg-[#e7e5e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:bg-[#e7e5e4] data-[state=open]:opacity-100"
            >
              <DotsThreeVertical size={14} weight="regular" />
            </button>
          </PopoverTrigger>
        </Tooltip>
        <PopoverContent
          align="end"
          sideOffset={5}
          className="w-[221px] min-w-[128px] overflow-hidden rounded-[12px] border border-[#e7e5e4] p-0 shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]"
        >
          {hasTranslationActions && (
            <div className="p-1">
              {!isOriginal && (
                <button type="button" onClick={() => { setPrimaryLanguage(language.code); close(); }} className={actionClassName}>
                  <span className="min-w-0 flex-1 truncate">Сделать оригиналом</span>
                </button>
              )}
              {canTranslateMissing && (
                <button type="button" onClick={() => { close(); translateMissingFields(language.code); }} className={actionClassName}>
                  <span className="min-w-0 flex-1 truncate">Перевести недостающие</span>
                  <StarFour size={16} className="shrink-0 text-[#0c0a09]" aria-hidden="true" />
                </button>
              )}
            </div>
          )}
          <div className={cn("p-1", hasTranslationActions && "border-t border-[#e7e5e4]")}>
            <label className={cn(actionClassName, "cursor-pointer")}>
              <span className="min-w-0 flex-1 truncate">Показывать в меню</span>
              <Checkbox
                checked={language.published}
                aria-label="Показывать в меню"
                onCheckedChange={(checked) => {
                  if (checked === false && language.published) {
                    close();
                    setHideDialogOpen(true);
                    return;
                  }
                  if (checked === true && !language.published) {
                    setPublished(language.code, true);
                    close();
                  }
                }}
                className="size-4 shrink-0 rounded-[5px] border-[#d6d3d1] data-[state=checked]:border-[#4f39f6] data-[state=checked]:bg-[#4f39f6]"
              />
            </label>
          </div>
          <div className="border-t border-[#e7e5e4] p-1">
            <button
              type="button"
              onClick={() => { close(); setDeleteDialogOpen(true); }}
              className={cn(actionClassName, "text-[#c10007] hover:bg-[#fff1f2] focus-visible:ring-[#c10007]/15")}
            >
              <span className="min-w-0 flex-1 truncate">Удалить</span>
            </button>
          </div>
        </PopoverContent>
      </Popover>
      <Dialog open={hideDialogOpen} onOpenChange={setHideDialogOpen}>
        <DialogContent
          aria-modal="true"
          onOpenAutoFocus={(event) => {
            event.preventDefault();
            (event.currentTarget as HTMLElement | null)?.focus();
          }}
          className="max-w-[343px] gap-0 overflow-hidden rounded-[16px] border-[#e4e4e7] bg-[#fefefc] p-0 shadow-[0_10px_15px_-3px_rgba(0,0,0,0.1),0_4px_6px_-2px_rgba(0,0,0,0.05)]"
        >
          <div className="border-b border-[#e7e5e4] p-4 pr-12">
            <DialogTitle className="text-[14px] font-semibold leading-normal tracking-[-0.35px] text-[#333]">
              Скрыть «{languageLabel(language.code)}» из меню?
            </DialogTitle>
          </div>
          <DialogDescription className="px-4 py-3 text-[13px] leading-5 text-[#666]">
            Гости не смогут выбрать этот язык. Все переводы сохранятся.
          </DialogDescription>
          <DialogFooter className="flex-row gap-2 border-t border-[#e7e5e4] p-2">
            <DialogClose asChild>
              <Button type="button" variant="outline" className="h-7 flex-1 rounded-[8px] border-[#e4e4e7] bg-white px-2.5 text-[13px] font-medium text-[#333] shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#fafaf9]">
                Отмена
              </Button>
            </DialogClose>
            <Button
              type="button"
              onClick={() => {
                setPublished(language.code, false);
                setHideDialogOpen(false);
              }}
              className="h-7 flex-1 rounded-[8px] bg-[#4f39f6] px-2.5 text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)] hover:bg-[#4030d4]"
            >
              Скрыть
            </Button>
          </DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Закрыть" className="absolute right-2 top-2 size-[30px] rounded-[8px] text-[#333] hover:bg-[#f5f5f4]">
              <X size={16} />
            </Button>
          </DialogClose>
        </DialogContent>
      </Dialog>
      <DeleteConfirmationDialog
        kind="language"
        open={deleteDialogOpen}
        title={`Удалить «${languageLabel(language.code)}»?`}
        description={`Все переводы на ${TRANSLATION_LANGUAGE_DELETE_LABELS[language.code]} будут удалены.`}
        confirmLabel="Удалить"
        onOpenChange={setDeleteDialogOpen}
        onConfirm={() => removeLanguage(language.code)}
      />
    </>
  );
}

function entitiesForType(materials: TranslationMaterial[], type: TranslationContentType): TranslationEntity[] {
  if (type !== "options") {
    return materials.filter((material) => material.category === type).map((material) => ({
      key: material.id,
      material,
      title: material.title,
      fields: type === "positions" ? material.fields.filter((field) => field.kind !== "option-group" && field.kind !== "option") : material.fields,
    }));
  }

  return materials.flatMap((material) => material.category !== "positions" ? [] : material.fields
    .filter((field) => field.kind === "option-group" && field.optionGroupId)
    .map((groupField) => ({
      key: `${material.id}:${groupField.optionGroupId}`,
      material,
      title: groupField.source || groupField.label.replace(/^Группа · /, ""),
      subtitle: material.title,
      fields: material.fields.filter((field) => field.optionGroupId === groupField.optionGroupId),
    })));
}

function entityComplete(entity: TranslationEntity, language: TranslationLanguageCode) {
  const fields = entity.fields.filter((field) => field.source.trim());
  return fields.length > 0 && fields.every((field) => field.values[language]?.trim());
}

function entityBatchState(entity: TranslationEntity, job: TranslationJob | undefined) {
  if (!job?.fieldProgress) return null;
  const fieldIds = new Set(entity.fields.map((field) => field.id));
  const progress = job.fieldProgress.filter((field) => (
    field.materialId === entity.material.id && fieldIds.has(field.fieldId)
  ));
  if (progress.length === 0) return null;
  if (progress.some((field) => field.status === "running")) return "running" as const;
  if (
    (job.status === "idle" || job.status === "running")
    && progress.some((field) => field.status !== "pending")
    && progress.some((field) => field.status === "pending")
  ) return "running" as const;
  if (progress.some((field) => field.status === "error")) return "error" as const;
  if (progress.every((field) => field.status === "completed")) return "completed" as const;
  return "pending" as const;
}

function OpenInCatalogButton({
  entity,
  onOpenCatalog,
  revealClassName,
}: {
  entity: TranslationEntity;
  onOpenCatalog: (entity: TranslationEntity) => void;
  revealClassName: string;
}) {
  return (
    <Tooltip label="Открыть в каталоге" side="top" delayDuration={250}>
      <button
        type="button"
        aria-label={`Открыть «${entity.title}» в каталоге`}
        onClick={() => onOpenCatalog(entity)}
        className={cn(
          "absolute right-1 top-1/2 flex size-5 -translate-y-1/2 items-center justify-center rounded-[6px] text-[#333] opacity-0 transition hover:bg-white/70 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
          revealClassName,
        )}
      >
        <ArrowUpRight size={14} weight="bold" />
      </button>
    </Tooltip>
  );
}

function TranslationLanguageRow({
  item,
  selected,
  job,
  onLanguageChange,
}: {
  item: TranslationLanguage;
  selected: boolean;
  job?: TranslationJob;
  onLanguageChange: (language: TranslationLanguageCode) => void;
}) {
  const { retryTranslationJob, setJobPublishAfterComplete, stopTranslationJob } = useTranslations();
  const translating = job?.status === "idle" || job?.status === "running";
  const failed = job?.status === "completed_with_errors";
  const row = (
    <button
      type="button"
      aria-current={selected ? "page" : undefined}
      aria-label={`${languageLabel(item.code)}${translating ? job?.status === "idle" ? ". Перевод ожидает запуска" : `. Переведено ${job?.completed ?? 0} из ${job?.total ?? 0} полей` : failed ? ". Перевод завершён с ошибками" : !item.published ? ". Скрыт" : ""}`}
      onClick={() => onLanguageChange(item.code)}
      className={cn(
        "flex h-7 w-full items-center gap-2 rounded-[8px] px-1 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        selected ? "bg-[#f5f5f4]" : "group-hover:bg-[#f5f5f4] group-focus-within:bg-[#f5f5f4]",
      )}
    >
      <LanguageCodeBadge code={item.code} />
      <span className={cn("min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]", selected && item.published ? "text-[#333]" : "text-[#666]")}>{languageLabel(item.code)}</span>
      {translating ? (
        <span className="mr-0.5 size-4 shrink-0" aria-hidden="true" />
      ) : !failed && !item.published && (
        <span className="mr-0.5 shrink-0 whitespace-nowrap text-[10px] leading-[18px] text-[#999] transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">Скрыт</span>
      )}
    </button>
  );

  return (
    <div data-translation-language={item.code} data-translation-state={translating ? "translating" : failed ? "error" : "ready"} className="group relative overflow-hidden rounded-[8px]">
      {row}
      {translating && job && (
        <Tooltip label="Остановить перевод" side="top" delayDuration={250}>
          <button
            type="button"
            aria-label="Остановить перевод"
            onClick={() => stopTranslationJob(job.id)}
            className="group/stop absolute right-1 top-1 flex size-5 items-center justify-center rounded-[6px] text-[#666] transition hover:bg-white/70 hover:text-[#333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <SpinnerGap size={16} className="animate-spin group-hover:hidden group-focus/stop:hidden" aria-hidden="true" />
            <StopCircle size={18} weight="fill" className="hidden group-hover:block group-focus/stop:block" aria-hidden="true" />
          </button>
        </Tooltip>
      )}
      {!translating && <LanguageActionsPopover language={item} />}
      {job && (
        <div data-translation-job-details className="w-full">
          {failed ? (
            <div className="flex items-center justify-between gap-2 px-1.5 pb-2 pt-1 text-[12px] leading-4 text-[#78716c]">
              <span>Не переведено: {job.failed ?? 0} из {job.total} полей</span>
              <Button type="button" variant="ghost" size="sm" onClick={() => retryTranslationJob(job.id)} className="h-7 shrink-0 rounded-[7px] px-2 text-[12px] text-[#292524]">Повторить</Button>
            </div>
          ) : (
            <>
              <p className="px-1.5 py-0.5 text-[12px] leading-[18px] text-[#78716c]">
                {job.status === "idle" ? "Ожидание запуска" : job.status === "running" ? (
                  <>
                    Переведено{" "}
                    <span
                      data-translation-progress-shimmer={`${job.completed} из ${job.total} полей`}
                    >
                      {job.completed} из {job.total} полей
                    </span>
                  </>
                ) : `Переведено ${job.completed} из ${job.total} полей`}
              </p>
              <p className="px-1.5 py-0.5 text-[11px] leading-4 text-[#a8a29e]">Можно закрыть эту страницу — перевод продолжится в фоне</p>
              <label className="flex cursor-pointer items-center gap-[7px] px-1.5 py-2 text-[12px] font-medium text-[#666]">
                <Checkbox
                  checked={job.publishAfterComplete ?? false}
                  onCheckedChange={(checked) => setJobPublishAfterComplete(job.id, checked === true)}
                  aria-label="Опубликовать после перевода"
                  className="size-3.5 border-[#4f39f6] data-[state=checked]:border-[#4f39f6] data-[state=checked]:bg-[#4f39f6]"
                />
                <span>Опубликовать после перевода</span>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function TranslationSidebar({
  language,
  contentType,
  entities,
  selectedKey,
  onContentTypeChange,
  onLanguageChange,
  onOpenCatalog,
  openCatalogActionRef,
  onSelect,
  initialQuery,
  initialSearchOpen,
  initialScrollTop,
}: {
  language: TranslationLanguage;
  contentType: TranslationContentType;
  entities: TranslationEntity[];
  selectedKey: string | null;
  onContentTypeChange: (type: TranslationContentType) => void;
  onLanguageChange: (language: TranslationLanguageCode) => void;
  onOpenCatalog: (material: TranslationMaterial) => void;
  openCatalogActionRef: { current: (entity: TranslationEntity) => void };
  onSelect: (entity: TranslationEntity) => void;
  initialQuery: string;
  initialSearchOpen: boolean;
  initialScrollTop: number;
}) {
  const { jobs, languages } = useTranslations();
  const [searchOpen, setSearchOpen] = useState(initialSearchOpen);
  const [query, setQuery] = useState(initialQuery);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const entityListRef = useRef<HTMLDivElement | null>(null);
  const restoredScrollRef = useRef(false);
  const typeLabel = CONTENT_TYPES.find((item) => item.id === contentType)?.label ?? "Позиции";
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const visibleEntities = entities.filter((entity) => !normalizedQuery || [entity.title, entity.subtitle].filter(Boolean).some((value) => value!.toLocaleLowerCase("ru").includes(normalizedQuery)));
  const visibleTranslationJobs = jobs.filter((job) => (
    job.status === "idle" || job.status === "running" || job.status === "completed_with_errors"
  ));
  const selectedLanguageJob = visibleTranslationJobs.find((job) => job.language === language.code);

  useEffect(() => {
    if (!searchOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);
  useLayoutEffect(() => {
    if (restoredScrollRef.current || !entityListRef.current) return;
    entityListRef.current.scrollTop = initialScrollTop;
    restoredScrollRef.current = true;
  }, [initialScrollTop, visibleEntities.length]);
  const closeSearch = () => { setQuery(""); setSearchOpen(false); };
  const openCatalog = useCallback((entity: TranslationEntity) => {
    onSelect(entity);
    writeTranslationsViewState({
      language: language.code,
      contentType,
      selectedKey: entity.key,
      query,
      searchOpen,
      scrollTop: entityListRef.current?.scrollTop ?? 0,
    });
    onOpenCatalog(entity.material);
  }, [contentType, language.code, onOpenCatalog, onSelect, query, searchOpen]);
  useLayoutEffect(() => {
    openCatalogActionRef.current = openCatalog;
  }, [openCatalog, openCatalogActionRef]);

  return (
    <aside data-translations-sidebar className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden border-r border-stone-200 bg-[#f5f5f4]">
      <div className="flex h-[48px] shrink-0 items-end border-b border-[#e7e5e4] bg-white pb-3 pl-[11px] pr-[10px]">
        <div className="flex w-full items-center justify-between">
          <h1 className="min-w-0 truncate text-[13px] font-normal leading-[18px] text-[#1c1917]">Переводы</h1>
        </div>
      </div>

      <div data-translations-language-block className="flex shrink-0 flex-col gap-1 bg-white px-1.5 pb-1 pt-2">
        {languages.map((item) => {
          const languageJob = visibleTranslationJobs.find((job) => job.language === item.code);
          return (
            <TranslationLanguageRow
              key={item.code}
              item={item}
              selected={language.code === item.code}
              job={languageJob}
              onLanguageChange={onLanguageChange}
            />
          );
        })}
        <AddLanguagePopover>
          <button data-translation-add-language type="button" aria-label="Добавить язык" className="flex h-7 w-full items-center gap-2 rounded-[8px] py-1 pl-1 pr-2 text-left text-[13px] font-normal leading-[18px] text-[#999] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">
            <span data-translation-add-language-icon className="flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-[#e7e5e4]"><Plus size={14} /></span>
            <span className="min-w-0 flex-1 truncate">Добавить...</span>
          </button>
        </AddLanguagePopover>
      </div>

      <div className="flex min-h-0 flex-1 flex-col border-t border-[#e7e5e4] bg-white pt-2">
        <div className="shrink-0 px-2.5">
          <div className="flex h-7 items-center justify-between">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Выбрать тип контента" className="flex h-[26px] min-w-0 items-center gap-1.5 rounded-[8px] bg-[#f5f5f4] px-2 text-[13px] text-[#333] transition hover:bg-[#e7e5e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"><span className="truncate">{typeLabel}</span><CaretDown size={14} className="shrink-0 text-[#666]" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="w-[170px] min-w-[128px] rounded-[12px] border-[#e7e5e4] p-1 text-[#666] shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-2px_rgba(0,0,0,0.1)]"
              >
                {CONTENT_TYPES.map((item) => {
                  const selected = contentType === item.id;
                  return (
                    <DropdownMenuItem
                      key={item.id}
                      onSelect={() => onContentTypeChange(item.id)}
                      className={cn(
                        "h-7 cursor-pointer rounded-[8px] px-2 py-1.5 text-[13px] font-normal leading-4 text-[#666] data-[highlighted]:bg-[#f5f5f4] data-[highlighted]:text-[#333]",
                        selected && "bg-[#f5f5f4] text-[#333]",
                      )}
                    >
                      <span className="min-w-0 flex-1 truncate">{item.label}</span>
                      {selected && <Check size={16} weight="regular" className="shrink-0" aria-hidden="true" />}
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
            {contentType !== "about" && <Tooltip label="Поиск" side="top" delayDuration={250}><Button type="button" variant="ghost" size="icon" aria-label="Открыть поиск" aria-expanded={searchOpen} onClick={() => { if (searchOpen) searchInputRef.current?.focus(); else setSearchOpen(true); }} className={cn("size-5 rounded-[6px] text-[#666] hover:bg-[#f5f5f4] hover:text-[#333]", searchOpen && "bg-[#f5f5f4] text-[#333]")}><MagnifyingGlass size={14} /></Button></Tooltip>}
          </div>
          {searchOpen && contentType !== "about" && (
            <div className="flex h-9 items-center gap-1.5 border-b border-[#e7e5e4] px-1">
              <Input ref={searchInputRef} size="compact" autoFocus aria-label={`Поиск: ${typeLabel}`} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }} placeholder="Найти..." className="h-7 min-w-0 flex-1 rounded-[7px] border-[#4f39f6] px-2 text-[13px] text-[#333] placeholder:text-[#a8a29e] focus-visible:ring-0" />
              <Tooltip label="Закрыть поиск" side="top" delayDuration={250}>
                <button type="button" aria-label="Закрыть поиск" onClick={closeSearch} className="flex size-5 shrink-0 items-center justify-center rounded-[6px] text-[#666] hover:bg-[#f5f5f4] hover:text-[#333] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"><X size={14} /></button>
              </Tooltip>
            </div>
          )}
        </div>

        {contentType !== "about" && (
          <div ref={entityListRef} data-translations-entity-list className="scrollbar-subtle flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto overscroll-contain px-1.5 pb-3 pt-0.5 [scrollbar-gutter:stable]">
            {visibleEntities.map((entity) => {
              const selected = entity.key === selectedKey;
              const complete = entityComplete(entity, language.code);
              const batchState = entityBatchState(entity, selectedLanguageJob);
              const positionActions = contentType === "positions" && Boolean(entity.material.catalogItemId);
              return (
                <div key={entity.key} className="group/entity relative">
                  <button type="button" aria-label={contentType === "positions" ? `Выбрать позицию «${entity.title}»` : undefined} aria-current={selected ? "page" : undefined} onClick={() => onSelect(entity)} className={cn("flex h-7 w-full items-center gap-2 rounded-[8px] p-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10", positionActions && "pr-7", selected ? "bg-[#f5f5f4]" : "hover:bg-[#f5f5f4]")}>
                    <CatalogThumbnail kind={entity.material.kind === "section" ? "section" : "item"} className="size-5 rounded-[5px]" />
                    <span className="min-w-0 flex-1"><span className={cn("block truncate text-[13px] leading-4", selected ? "font-medium text-[#333]" : "text-[#666]")}>{entity.title}</span>{entity.subtitle && <span className="block truncate text-[10px] leading-3 text-[#666]">{entity.subtitle}</span>}</span>
                    {batchState === "running" ? (
                      <span role="img" aria-label="Сущность переводится" className={cn("flex size-4 shrink-0 items-center justify-center text-[#78716c]", positionActions && "transition-opacity group-hover/entity:opacity-0 group-focus-within/entity:opacity-0")}><SpinnerGap size={14} className="animate-spin" /></span>
                    ) : batchState === "error" ? (
                      <span role="img" aria-label="Ошибка перевода сущности" className={cn("flex size-4 shrink-0 items-center justify-center text-[#78716c]", positionActions && "transition-opacity group-hover/entity:opacity-0 group-focus-within/entity:opacity-0")}><WarningCircle size={14} /></span>
                    ) : !complete && batchState !== "pending" && (
                      <span role="img" aria-label="Перевод не заполнен" className={cn("flex size-4 shrink-0 items-center justify-center text-[#78716c]", positionActions && "transition-opacity group-hover/entity:opacity-0 group-focus-within/entity:opacity-0")}><CircleDashed size={14} /></span>
                    )}
                  </button>
                  {positionActions && (
                    <OpenInCatalogButton
                      entity={entity}
                      onOpenCatalog={openCatalog}
                      revealClassName="group-hover/entity:opacity-100 group-focus-within/entity:opacity-100"
                    />
                  )}
                </div>
              );
            })}
            {visibleEntities.length === 0 && <p className="px-2 py-2 text-[13px] leading-4 text-[#666]">Ничего не найдено</p>}
          </div>
        )}
      </div>
    </aside>
  );
}

function MachineIndicator({ field }: { field: TranslationField }) {
  return <Tooltip label="Переведено автоматически" side="top"><span tabIndex={0} role="img" aria-label={`Переведено автоматически: ${field.label}`} className="flex size-4 items-center justify-center text-stone-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-300"><StarFour size={12} /></span></Tooltip>;
}

function TranslationFieldRow({ field, language, material }: { field: TranslationField; language: TranslationLanguageCode; material: TranslationMaterial }) {
  const { autoTranslateField, getFieldTranslationState, jobs, updateField } = useTranslations();
  const sourceFilled = Boolean(field.source.trim());
  const targetValue = sourceFilled ? field.values[language] ?? "" : "";
  const machineTranslated = Boolean(targetValue.trim()) && (field.machineTranslatedLanguages?.includes(language) ?? false);
  const isDescription = field.id === "description" || field.label.toLocaleLowerCase("ru").includes("описание");
  const translateLabel = targetValue.trim() ? "Перевести автоматически" : "Перевести";
  const translationState = getFieldTranslationState(material.id, field.id, language);
  const translating = translationState.status === "loading";
  const translationFailed = translationState.status === "error";
  const batchTranslating = jobs.some((job) => (
    job.language === language
    && job.fieldProgress?.some((progress) => (
      progress.materialId === material.id
      && progress.fieldId === field.id
      && progress.status === "running"
    ))
  ));

  return (
    <div data-translation-field-row className="grid grid-cols-[116px_minmax(0,1fr)_minmax(0,1fr)] border-b border-[#eeeeec] last:border-b-0">
      <div data-translation-field-label className={cn("flex min-w-0 border-r border-[#eeeeec] px-3 py-3 text-[13px] text-[#44403b]", isDescription ? "min-h-[174px] items-start" : "h-12 items-center")}><span className="truncate">{field.label.replace(/^Группа · |^Опция · /, "")}</span></div>
      <div data-translation-source-field className={cn("min-w-0 border-r border-[#eeeeec]", isDescription ? "p-0" : "flex h-12 items-center px-3")}>
        {isDescription
          ? <DescriptionRichTextEditor value={field.source} readOnly hideLabel label={`Оригинал: ${field.label}`} placeholder="Не заполнено" limit={300} compact className="h-full [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:bg-transparent [&>div]:shadow-none [&>div>div]:bg-transparent" />
          : <div className="min-w-0 truncate text-[13px] leading-5 text-[#44403b]">{sourceFilled ? field.source : <span className="text-[#a8a29e]">Не заполнено</span>}</div>}
      </div>
      <div data-translation-target-field className={cn("group relative min-w-0", isDescription ? "p-0" : "flex h-12 items-center px-1.5")}>
        {sourceFilled && (!machineTranslated || translating || translationFailed) && (
          <Tooltip label={translating ? "Перевод выполняется" : translateLabel} side="top" delayDuration={250}>
            <Button
              data-ai-translate-action
              type="button"
              variant="ghost"
              size="icon"
              disabled={translating || batchTranslating}
              aria-label={`${translating ? "Перевод выполняется" : translateLabel}: ${field.label}`}
              onClick={() => { void autoTranslateField(material.id, field.id, language); }}
              className={cn(
                "absolute right-3 z-10 size-[26px] rounded-[8px] bg-stone-200 p-0 text-stone-900 opacity-0 transition-[color,background-color,opacity] hover:bg-stone-300 hover:text-stone-950 disabled:cursor-wait disabled:opacity-100 group-hover:opacity-100 group-focus-within:opacity-100",
                (translating || translationFailed) && "opacity-100",
                isDescription ? "top-[42px]" : "top-[11px]",
              )}
            >
              {translating ? <SpinnerGap size={16} className="animate-spin" /> : <StarFour size={16} />}
            </Button>
          </Tooltip>
        )}
        {translationFailed && (
          <Tooltip label={translationState.error || "Не удалось перевести поле"} side="top" delayDuration={150}>
            <span
              role="alert"
              aria-label={`Ошибка перевода: ${field.label}`}
              className={cn(
                "absolute right-[43px] z-10 flex size-5 items-center justify-center text-rose-600",
                isDescription ? "top-[45px]" : "top-[14px]",
              )}
            >
              <WarningCircle size={14} weight="fill" />
            </span>
          </Tooltip>
        )}
        {isDescription ? (
          <DescriptionRichTextEditor value={targetValue} readOnly={batchTranslating} onChange={(value) => { if (value !== targetValue) updateField(material.id, field.id, language, value); }} hideLabel label={`${languageLabel(language)}: ${field.label}`} placeholder={sourceFilled ? "Введите перевод" : "Не заполнено в оригинале"} limit={300} compact className={cn("h-full [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none", machineTranslated && "[&>div>div:last-child]:pl-7")} />
        ) : (
          <div className="relative min-w-0 flex-1">
            {machineTranslated && <span className="absolute left-2 top-1/2 z-[1] -translate-y-1/2"><MachineIndicator field={field} /></span>}
            <Input aria-label={`${languageLabel(language)}: ${field.label}`} value={targetValue} disabled={!sourceFilled || batchTranslating} onChange={(event) => { if (event.target.value !== targetValue) updateField(material.id, field.id, language, event.target.value); }} placeholder={sourceFilled ? "Введите перевод" : "Не заполнено в оригинале"} className={cn("h-9 rounded-none border-0 bg-transparent px-2.5 text-[13px] shadow-none outline-none hover:border-0 focus:border-0 focus:bg-transparent focus-visible:border-0 focus-visible:outline-none focus-visible:ring-0 disabled:bg-white disabled:opacity-100", machineTranslated && "pl-7")} />
          </div>
        )}
        {isDescription && machineTranslated && <span className="absolute left-2 top-[46px] z-[1]"><MachineIndicator field={field} /></span>}
      </div>
    </div>
  );
}

function TranslationEditor({ entity, language, onOpenCatalog }: {
  entity: TranslationEntity | null;
  language: TranslationLanguage;
  onOpenCatalog: (entity: TranslationEntity) => void;
}) {
  const { items } = useCatalogStore();
  const { account } = useMockAuth();
  const { saveState } = useTranslations();
  const primaryCode = account?.workspace.primaryLanguage ?? "ru";
  const imageUrl = entity?.material.catalogItemId ? items.find((item) => item.id === entity.material.catalogItemId)?.thumbnailUrl : null;
  const canOpenCatalog = entity?.material.kind === "position" && Boolean(entity.material.catalogItemId);

  if (!entity) return <main className="grid min-h-0 min-w-0 flex-1 place-items-center bg-[#fafaf9] text-[13px] text-[#79716b]">Нет сущностей для перевода</main>;

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#f5f5f4]">
      <header className="flex h-[49px] shrink-0 items-center justify-between gap-3 bg-white px-4">
        <div className={cn("group/editor-title relative flex min-w-0 items-center gap-1.5", canOpenCatalog && "pr-7")}>
          <CatalogThumbnail src={imageUrl} kind={entity.material.kind === "section" ? "section" : "item"} className="size-6 rounded-[6px]" />
          <span className="truncate text-[13px] font-medium text-[#292524]">{entity.subtitle ? `${entity.subtitle} · ${entity.title}` : entity.title}</span>
          {canOpenCatalog && (
            <OpenInCatalogButton
              entity={entity}
              onOpenCatalog={onOpenCatalog}
              revealClassName="right-0 group-hover/editor-title:opacity-100 group-focus-within/editor-title:opacity-100"
            />
          )}
        </div>
        <PositionSaveStatus status={saveState} />
      </header>
      <div data-translations-table-gap aria-hidden="true" className="h-1.5 shrink-0 bg-[#f5f5f4]" />
      <div data-translations-table-header className="grid h-[34px] shrink-0 grid-cols-[116px_minmax(0,1fr)_minmax(0,1fr)] border-b border-[#eeeeec] bg-white text-[13px] font-medium text-[#292524]"><div className="border-r border-[#eeeeec]" /><div className="flex min-w-0 items-center truncate border-r border-[#eeeeec] px-1.5">{languageLabel(primaryCode)} · оригинал</div><div className="flex min-w-0 items-center truncate px-1.5">{languageLabel(language.code)}</div></div>
      <div data-translations-table-body className="scrollbar-subtle min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-white">
        <div className="grid min-h-full grid-cols-[116px_minmax(0,1fr)_minmax(0,1fr)]">
          <div data-translations-original-background aria-hidden="true" className="pointer-events-none col-span-2 col-start-1 row-start-1 bg-[#fafaf9]" />
          <div data-translations-target-background aria-hidden="true" className="pointer-events-none col-start-3 row-start-1 bg-white" />
          <div className="relative col-span-3 col-start-1 row-start-1 min-w-0 self-start">
            {entity.fields.map((field) => <TranslationFieldRow key={field.id} field={field} language={language.code} material={entity.material} />)}
          </div>
        </div>
      </div>
    </main>
  );
}

function EmptyTranslations() {
  return (
    <div className="flex min-h-0 flex-1 bg-[#fbfbf9]">
      <ResizableTranslationsSidebar>
        <aside data-translations-sidebar className="flex h-full w-full min-w-0 flex-col border-r border-stone-200 bg-[#f5f5f4]">
          <div className="flex h-[48px] items-end border-b border-[#e7e5e4] bg-white pb-3 pl-[11px] pr-[10px]"><h1 className="min-w-0 truncate text-[13px] text-[#1c1917]">Переводы</h1></div>
          <div data-translations-language-block className="flex flex-col gap-1 bg-white px-1.5 pb-1 pt-2">
            <AddLanguagePopover>
              <button data-translation-add-language type="button" aria-label="Добавить язык" className="flex h-7 w-full items-center gap-2 rounded-[8px] py-1 pl-1 pr-2 text-left text-[13px] font-normal leading-[18px] text-[#999] hover:bg-[#f5f5f4]">
                <span data-translation-add-language-icon className="flex size-5 shrink-0 items-center justify-center rounded-[4px] border border-[#e7e5e4]"><Plus size={14} /></span>
                <span>Добавить...</span>
              </button>
            </AddLanguagePopover>
          </div>
        </aside>
      </ResizableTranslationsSidebar>
      <main className="grid min-h-0 min-w-0 flex-1 place-items-center px-6 py-10 text-center"><div><h2 className="text-[16px] font-semibold text-stone-900">Переводов пока нет</h2><p className="mt-1.5 text-[13px] text-stone-500">Добавьте язык, чтобы начать перевод.</p></div></main>
    </div>
  );
}

function LanguageWorkspace({
  initialContentType,
  initialViewState,
  onOpenOriginal,
}: {
  initialContentType: TranslationContentType;
  initialViewState: TranslationsViewState | null;
  onOpenOriginal: (material: TranslationMaterial) => void;
}) {
  const { activeLanguage, activeMaterialId, languages, materials, setActiveCategory, setActiveLanguage, setActiveMaterialId } = useTranslations();
  const [contentType, setContentType] = useState<TranslationContentType>(initialContentType);
  const [selectedKey, setSelectedKey] = useState<string | null>(initialViewState?.selectedKey ?? null);
  const initialLanguageRef = useRef<TranslationLanguageCode | null>(initialViewState && languages.some((item) => item.code === initialViewState.language)
    ? initialViewState.language
    : null);
  const openCatalogActionRef = useRef<(entity: TranslationEntity) => void>((entity) => onOpenOriginal(entity.material));
  const languageCode = initialLanguageRef.current ?? activeLanguage;
  const language = languages.find((item) => item.code === languageCode) ?? languages[0];
  const entities = useMemo(() => entitiesForType(materials, contentType), [contentType, materials]);
  const selectedEntity = entities.find((entity) => entity.key === selectedKey) ?? null;

  useEffect(() => {
    const initialLanguage = initialLanguageRef.current;
    initialLanguageRef.current = null;
    if (initialLanguage && initialLanguage !== activeLanguage) setActiveLanguage(initialLanguage);
  }, [activeLanguage, setActiveLanguage]);
  useEffect(() => {
    const requested = activeMaterialId ? entities.find((entity) => entity.material.id === activeMaterialId) : null;
    const next = requested ?? entities[0] ?? null;
    setSelectedKey((current) => entities.some((entity) => entity.key === current) ? current : next?.key ?? null);
    if (next && next.material.id !== activeMaterialId) setActiveMaterialId(next.material.id);
  }, [activeMaterialId, entities, setActiveMaterialId]);

  if (!language) return null;

  return (
    <div className="flex min-h-0 flex-1 bg-white">
      <ResizableTranslationsSidebar>
        <TranslationSidebar
          language={language}
          contentType={contentType}
          entities={entities}
          selectedKey={selectedKey}
          initialQuery={initialViewState?.query ?? ""}
          initialSearchOpen={initialViewState?.searchOpen ?? false}
          initialScrollTop={initialViewState?.scrollTop ?? 0}
          onContentTypeChange={(type) => { setContentType(type); setSelectedKey(null); setActiveCategory(type === "options" ? "positions" : type); }}
          onLanguageChange={setActiveLanguage}
          onOpenCatalog={onOpenOriginal}
          openCatalogActionRef={openCatalogActionRef}
          onSelect={(entity) => { setSelectedKey(entity.key); setActiveMaterialId(entity.material.id); }}
        />
      </ResizableTranslationsSidebar>
      <TranslationEditor entity={selectedEntity} language={language} onOpenCatalog={(entity) => openCatalogActionRef.current(entity)} />
    </div>
  );
}

export function TranslationsWorkspace({ onOpenOriginal = () => {} }: { onOpenOriginal?: (material: TranslationMaterial) => void }) {
  const { activeCategory, consumeWorkspaceRequest, languages, workspaceRequested } = useTranslations();
  const initialViewState = useMemo(readTranslationsViewState, []);
  useEffect(() => { if (workspaceRequested) consumeWorkspaceRequest(); }, [consumeWorkspaceRequest, workspaceRequested]);
  if (languages.length === 0) return <EmptyTranslations />;
  return (
    <LanguageWorkspace
      initialContentType={initialViewState?.contentType ?? (workspaceRequested ? activeCategory : "positions")}
      initialViewState={initialViewState}
      onOpenOriginal={onOpenOriginal}
    />
  );
}
