import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  CaretDown,
  Check,
  DotsThree,
  Eye,
  EyeSlash,
  MagnifyingGlass,
  Minus,
  Plus,
  SpinnerGap,
  Star,
  StarFour,
  Trash,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  type TranslationMaterial,
} from "@/contexts/translations-context";
import { LANGUAGES } from "@/data/languages";
import { PositionSaveStatus } from "@/features/storefront/catalog/editor/position-editor";
import { readCatalogJson, writeCatalogJson } from "@/features/storefront/catalog/persistence";
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
const TRANSLATIONS_SIDEBAR_DEFAULT_WIDTH = 222;
const TRANSLATIONS_SIDEBAR_MIN_WIDTH = 200;
const TRANSLATIONS_SIDEBAR_MAX_WIDTH = 420;
const AUTO_TRANSLATION_TOOLTIP = "Идёт автоматический перевод. Это может занять несколько минут. Можно закрыть страницу — перевод продолжится в фоне.";

type TranslationEntity = {
  key: string;
  material: TranslationMaterial;
  title: string;
  subtitle?: string;
  fields: TranslationField[];
};

function languageLabel(code: TranslationLanguageCode) {
  return TRANSLATION_LANGUAGE_LABELS[code];
}

function LanguageCodeBadge({ code, active = false }: { code: TranslationLanguageCode; active?: boolean }) {
  return (
    <span className={cn(
      "flex h-3 w-[18px] shrink-0 items-center justify-center rounded-[2px] text-[8px] font-bold leading-none",
      active ? "bg-[#666] text-white" : "bg-[#78716c] text-white",
    )}>
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

function FirstUseScreen() {
  const { confirmPrimaryLanguage, suggestedPrimaryLanguage } = useTranslations();
  const [language, setLanguage] = useState<TranslationLanguageCode>(suggestedPrimaryLanguage);

  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto bg-[#fbfbf9] px-6 py-10">
      <section className="w-full max-w-[430px]">
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-stone-950">Основной язык контента</h1>
        <p className="mt-2 text-[13px] leading-5 text-stone-500">Он будет использоваться как исходный для переводов.</p>
        <Select value={language} onValueChange={(value) => setLanguage(value as TranslationLanguageCode)}>
          <SelectTrigger aria-label="Основной язык контента" className="mt-5 h-10 w-full bg-white shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>{LANGUAGES.map((item) => <SelectItem key={item.code} value={item.code}>{languageLabel(item.code)}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" className="mt-4 h-9 bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => confirmPrimaryLanguage(language)}>Подтвердить</Button>
      </section>
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
  const available = LANGUAGES.filter((language) => language.code !== primaryLanguage
    && !languages.some((item) => item.code === language.code)
    && (!normalizedQuery || [language.code, language.short, language.label, languageLabel(language.code)]
      .some((value) => value.toLocaleLowerCase("ru").includes(normalizedQuery))));

  const chooseLanguage = (code: TranslationLanguageCode) => {
    const previousLanguage = activeLanguage;
    addLanguage(code, true);
    setActiveLanguage(previousLanguage);
    setOpen(false);
    setQuery("");
  };

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

function OriginalLanguagePickerContent({
  initialLanguage,
  onCancel,
  onComplete,
}: {
  initialLanguage?: TranslationLanguageCode;
  onCancel: () => void;
  onComplete: () => void;
}) {
  const { account } = useMockAuth();
  const { languages, setPrimaryLanguage } = useTranslations();
  const primaryCode = account?.workspace.primaryLanguage ?? "ru";
  const [selectedLanguage, setSelectedLanguage] = useState<TranslationLanguageCode>(initialLanguage ?? primaryCode);
  const connectedLanguages = LANGUAGES.filter((item) => item.code === primaryCode || languages.some((language) => language.code === item.code));

  useEffect(() => {
    setSelectedLanguage(initialLanguage ?? primaryCode);
  }, [initialLanguage, primaryCode]);

  return (
    <div className="w-[260px] p-1">
      <div className="px-2 pb-2 pt-1.5">
        <div className="text-[11px] leading-4 text-[#79716b]">Текущий язык оригинала</div>
        <div className="mt-1 flex items-center gap-2 text-[13px] font-medium text-[#333]">
          <LanguageCodeBadge code={primaryCode} active />
          <span>{languageLabel(primaryCode)}</span>
        </div>
      </div>
      <div className="border-t border-[#e7e5e4] p-1">
        {connectedLanguages.map((language) => {
          const selected = selectedLanguage === language.code;
          return (
            <button
              key={language.code}
              type="button"
              onClick={() => setSelectedLanguage(language.code)}
              className={cn(
                "flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-[#0c0a09] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                selected && "bg-[#f5f5f4]",
              )}
            >
              <LanguageCodeBadge code={language.code} active={selected} />
              <span className="min-w-0 flex-1 truncate">{languageLabel(language.code)}</span>
              {selected && <Check size={13} weight="bold" />}
            </button>
          );
        })}
      </div>
      {languages.length > 0 && selectedLanguage !== primaryCode && (
        <p className="mx-1 mb-1 rounded-[8px] bg-[#fff7ed] px-2 py-1.5 text-[11px] leading-4 text-[#9a3412]">
          Смена языка оригинала повлияет на существующие переводы. Проверьте их после смены.
        </p>
      )}
      <div className="flex items-center justify-end gap-1 border-t border-[#e7e5e4] px-1 pt-1">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} className="h-7 rounded-[7px] px-2 text-[12px]">Отмена</Button>
        <Button
          type="button"
          size="sm"
          disabled={selectedLanguage === primaryCode}
          onClick={() => { setPrimaryLanguage(selectedLanguage); onComplete(); }}
          className="h-7 rounded-[7px] bg-[#292524] px-2.5 text-[12px] hover:bg-[#1c1917]"
        >
          Сделать основным
        </Button>
      </div>
    </div>
  );
}

function TranslationsHeaderMenu() {
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"menu" | "original">("menu");
  const close = () => { setOpen(false); setStage("menu"); };

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setStage("menu"); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label="Действия переводов"
          className="flex size-5 shrink-0 items-center justify-center rounded-[6px] text-[#333] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <DotsThree size={20} weight="bold" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={5} className={cn("overflow-hidden rounded-[12px] p-0 shadow-md", stage === "menu" ? "w-[224px]" : "w-auto")}>
        {stage === "menu" ? (
          <div className="p-1">
            <button
              type="button"
              onClick={() => setStage("original")}
              className="flex h-7 w-full items-center rounded-[8px] px-2 text-left text-[13px] text-[#0c0a09] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              Изменить язык оригинала
            </button>
          </div>
        ) : (
          <OriginalLanguagePickerContent onCancel={() => setStage("menu")} onComplete={close} />
        )}
      </PopoverContent>
    </Popover>
  );
}

function LanguageActionsPopover({ language }: { language: TranslationLanguage }) {
  const { removeLanguage, setPublished } = useTranslations();
  const [open, setOpen] = useState(false);
  const [stage, setStage] = useState<"menu" | "original" | "delete">("menu");
  const close = () => { setOpen(false); setStage("menu"); };

  return (
    <Popover open={open} onOpenChange={(nextOpen) => { setOpen(nextOpen); if (!nextOpen) setStage("menu"); }}>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={`Действия языка «${languageLabel(language.code)}»`}
          className="absolute right-1 top-1/2 z-10 flex size-5 -translate-y-1/2 items-center justify-center rounded-[6px] text-[#333] opacity-0 transition hover:bg-white/70 focus:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 group-hover:opacity-100 group-focus-within:opacity-100 data-[state=open]:opacity-100"
        >
          <DotsThree size={20} weight="bold" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={5} className={cn("overflow-hidden rounded-[12px] p-0 shadow-md", stage === "menu" || stage === "delete" ? "w-[200px]" : "w-auto")}>
        {stage === "menu" && (
          <>
            <div className="p-1">
              <button type="button" onClick={() => setStage("original")} className="flex h-7 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-[#0c0a09] hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">
                <Star size={16} /><span>Сделать основным</span>
              </button>
            </div>
            <div className="border-t border-[#e7e5e4] p-1">
              <button type="button" onClick={() => { setPublished(language.code, !language.published); close(); }} className="flex h-7 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-[#0c0a09] hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">
                {language.published ? <Eye size={16} /> : <EyeSlash size={16} />}
                <span>{language.published ? "Скрыть из меню" : "Показать в меню"}</span>
              </button>
              <button type="button" onClick={() => setStage("delete")} className="flex h-7 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-[#c10007] hover:bg-[#fff1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c10007]/15">
                <Trash size={16} /><span>Удалить</span>
              </button>
            </div>
          </>
        )}
        {stage === "delete" && (
          <div className="p-2">
            <p className="px-1 text-[12px] leading-4 text-[#333]">Удалить язык «{languageLabel(language.code)}» и его переводы?</p>
            <div className="mt-2 flex justify-end gap-1">
              <Button type="button" variant="ghost" size="sm" onClick={() => setStage("menu")} className="h-7 rounded-[7px] px-2 text-[12px]">Отмена</Button>
              <Button type="button" variant="destructive" size="sm" onClick={() => { removeLanguage(language.code); close(); }} className="h-7 rounded-[7px] px-2 text-[12px]">Удалить</Button>
            </div>
          </div>
        )}
        {stage === "original" && (
          <OriginalLanguagePickerContent initialLanguage={language.code} onCancel={() => setStage("menu")} onComplete={close} />
        )}
      </PopoverContent>
    </Popover>
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

function languageCompleteness(materials: TranslationMaterial[], language: TranslationLanguageCode) {
  const fields = materials.flatMap((material) => material.fields).filter((field) => field.source.trim());
  return fields.length === 0 ? 0 : Math.round((fields.filter((field) => field.values[language]?.trim()).length / fields.length) * 100);
}

function entityComplete(entity: TranslationEntity, language: TranslationLanguageCode) {
  const fields = entity.fields.filter((field) => field.source.trim());
  return fields.length > 0 && fields.every((field) => field.values[language]?.trim());
}

function TranslationLanguageRow({
  item,
  materials,
  selected,
  translating,
  onLanguageChange,
}: {
  item: TranslationLanguage;
  materials: TranslationMaterial[];
  selected: boolean;
  translating: boolean;
  onLanguageChange: (language: TranslationLanguageCode) => void;
}) {
  const row = (
    <button
      type="button"
      disabled={translating}
      aria-current={selected ? "page" : undefined}
      aria-label={`${languageLabel(item.code)}${translating ? ". Идёт автоматический перевод" : `, ${languageCompleteness(materials, item.code)}%`}`}
      onClick={() => onLanguageChange(item.code)}
      className={cn(
        "flex h-[30px] w-full items-center gap-2 rounded-[8px] px-1.5 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        selected ? "bg-[#f5f5f4]" : !translating && "hover:bg-[#f5f5f4]",
        translating && "cursor-not-allowed opacity-55",
      )}
    >
      <LanguageCodeBadge code={item.code} active={selected} />
      <span className={cn("min-w-0 flex-1 truncate text-[13px] leading-[18px]", selected ? "font-medium text-[#333]" : "text-[#666]")}>{languageLabel(item.code)}</span>
      {translating ? (
        <SpinnerGap size={14} className="mr-0.5 shrink-0 animate-spin text-[#666]" aria-hidden="true" />
      ) : (
        <span className="mr-0.5 shrink-0 text-[11px] leading-[18px] tabular-nums text-[#666] transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
          {languageCompleteness(materials, item.code)}%
        </span>
      )}
    </button>
  );

  return (
    <div data-translation-language={item.code} data-translation-state={translating ? "translating" : "ready"} className="group relative">
      {translating ? (
        <Tooltip label={AUTO_TRANSLATION_TOOLTIP} side="right" contentClassName="max-w-[320px] leading-4">
          <div tabIndex={0} className="rounded-[8px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">{row}</div>
        </Tooltip>
      ) : (
        <>
          {row}
          <LanguageActionsPopover language={item} />
        </>
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
  onSelect,
}: {
  language: TranslationLanguage;
  contentType: TranslationContentType;
  entities: TranslationEntity[];
  selectedKey: string | null;
  onContentTypeChange: (type: TranslationContentType) => void;
  onLanguageChange: (language: TranslationLanguageCode) => void;
  onSelect: (entity: TranslationEntity) => void;
}) {
  const { jobs, languages, materials } = useTranslations();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const typeLabel = CONTENT_TYPES.find((item) => item.id === contentType)?.label ?? "Позиции";
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const visibleEntities = entities.filter((entity) => !normalizedQuery || [entity.title, entity.subtitle].filter(Boolean).some((value) => value!.toLocaleLowerCase("ru").includes(normalizedQuery)));

  useEffect(() => {
    if (!searchOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);
  useEffect(() => { setQuery(""); setSearchOpen(false); }, [contentType]);
  const closeSearch = () => { setQuery(""); setSearchOpen(false); };

  return (
    <aside className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden bg-white shadow-[inset_-1px_0_0_#e7e5e4]">
      <div className="shrink-0 px-2 pt-5">
        <div className="flex h-8 items-center justify-between border-b border-[#e7e5e4] px-1.5 pb-3">
          <h1 className="min-w-0 truncate text-[13px] font-normal leading-[18px] text-[#1c1917]">Переводы</h1>
          <TranslationsHeaderMenu />
        </div>
      </div>

      <div data-translations-language-block className="shrink-0 border-b border-[#e7e5e4] px-2 pb-3 pt-2">
        {languages.map((item) => (
          <TranslationLanguageRow
            key={item.code}
            item={item}
            materials={materials}
            selected={language.code === item.code}
            translating={jobs.some((job) => job.language === item.code && (job.status === "queued" || job.status === "running"))}
            onLanguageChange={onLanguageChange}
          />
        ))}
        <AddLanguagePopover>
          <button type="button" aria-label="Добавить язык" className="flex h-[30px] w-full items-center gap-2 rounded-[8px] px-2 py-1 text-left text-[13px] font-medium leading-[18px] text-[#666] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">
            <Plus size={14} /><span className="min-w-0 flex-1 truncate">Добавить</span>
          </button>
        </AddLanguagePopover>
      </div>

      <div className="flex min-h-0 flex-1 flex-col pt-2">
        <div className="shrink-0 px-2">
          <div className="flex h-7 items-center justify-between px-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Выбрать тип контента" className="flex h-[26px] min-w-0 items-center gap-1.5 rounded-[8px] bg-[#f5f5f4] px-2 text-[13px] text-[#333] transition hover:bg-[#e7e5e4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"><span className="truncate">{typeLabel}</span><CaretDown size={14} className="shrink-0 text-[#666]" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[210px]">
                {CONTENT_TYPES.map((item) => <DropdownMenuItem key={item.id} onSelect={() => onContentTypeChange(item.id)}><span className="flex size-4 items-center justify-center">{contentType === item.id && <Check size={12} weight="bold" />}</span>{item.label}</DropdownMenuItem>)}
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
          <div className="scrollbar-subtle min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-1.5 pb-3 pt-1 [scrollbar-gutter:stable]">
            {visibleEntities.map((entity) => {
              const selected = entity.key === selectedKey;
              const complete = entityComplete(entity, language.code);
              return (
                <button key={entity.key} type="button" aria-current={selected ? "page" : undefined} onClick={() => onSelect(entity)} className={cn("group flex h-8 w-full items-center gap-2 rounded-[8px] p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10", selected ? "bg-[#f5f5f4]" : "hover:bg-[#f5f5f4]")}>
                  <CatalogThumbnail kind={entity.material.kind === "section" ? "section" : "item"} className="size-5 rounded-[5px]" />
                  <span className="min-w-0 flex-1"><span className={cn("block truncate text-[13px] leading-4", selected ? "font-medium text-[#333]" : "text-[#666]")}>{entity.title}</span>{entity.subtitle && <span className="block truncate text-[10px] leading-3 text-[#666]">{entity.subtitle}</span>}</span>
                  <span role="img" aria-label={complete ? "Перевод заполнен" : "Перевод не заполнен"} className={cn("flex size-4 shrink-0 items-center justify-center", complete ? "text-[#666]" : "text-[#a8a29e]")}>{complete ? <Check size={12} weight="bold" /> : <Minus size={12} weight="bold" />}</span>
                </button>
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
  return <Tooltip label="Переведено автоматически" side="top"><span tabIndex={0} role="img" aria-label={`Переведено автоматически: ${field.label}`} className="flex size-4 items-center justify-center text-[#615fff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"><StarFour size={12} weight="fill" /></span></Tooltip>;
}

function TranslationFieldRow({ field, language, material }: { field: TranslationField; language: TranslationLanguageCode; material: TranslationMaterial }) {
  const { autoTranslateField, updateField } = useTranslations();
  const sourceFilled = Boolean(field.source.trim());
  const targetValue = sourceFilled ? field.values[language] ?? "" : "";
  const machineTranslated = Boolean(targetValue.trim()) && (field.machineTranslatedLanguages?.includes(language) ?? false);
  const isDescription = field.id === "description" || field.label.toLocaleLowerCase("ru").includes("описание");
  const translateLabel = targetValue.trim() ? "Перевести заново" : "Перевести";

  return (
    <div className="grid grid-cols-[116px_minmax(0,1fr)_minmax(0,1fr)] border-b border-[#eeeeec] last:border-b-0">
      <div className={cn("flex min-w-0 border-r border-[#eeeeec] px-3 py-3 text-[13px] text-[#44403b]", isDescription ? "min-h-[174px] items-start" : "h-12 items-center")}><span className="truncate">{field.label.replace(/^Группа · |^Опция · /, "")}</span></div>
      <div className={cn("min-w-0 border-r border-[#eeeeec] bg-[#fafaf9]", isDescription ? "p-0" : "flex h-12 items-center px-3")}>
        {isDescription
          ? <DescriptionRichTextEditor value={field.source} readOnly hideLabel label={`Оригинал: ${field.label}`} placeholder="Не заполнено" limit={300} compact className="h-full [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none" />
          : <div className="min-w-0 truncate text-[13px] leading-5 text-[#44403b]">{sourceFilled ? field.source : <span className="text-[#a8a29e]">Не заполнено</span>}</div>}
      </div>
      <div className={cn("group relative min-w-0 bg-white", isDescription ? "p-0" : "flex h-12 items-center px-1.5")}>
        {sourceFilled && (
          <Tooltip label={translateLabel} side="top" delayDuration={250}>
            <Button type="button" variant="ghost" size="icon" aria-label={`${translateLabel}: ${field.label}`} onClick={() => autoTranslateField(material.id, field.id, language)} className={cn("absolute right-3 z-10 size-[26px] rounded-[7px] bg-white/95 p-0 text-[#615fff] opacity-0 transition-opacity hover:bg-[#f5f5ff] group-hover:opacity-100 group-focus-within:opacity-100", isDescription ? "top-[42px]" : "top-[11px]")}><StarFour size={16} weight="fill" /></Button>
          </Tooltip>
        )}
        {isDescription ? (
          <DescriptionRichTextEditor value={targetValue} onChange={(value) => { if (value !== targetValue) updateField(material.id, field.id, language, value); }} hideLabel label={`${languageLabel(language)}: ${field.label}`} placeholder={sourceFilled ? "Введите перевод" : "Не заполнено в оригинале"} limit={300} compact className={cn("h-full [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none", machineTranslated && "[&>div>div:last-child]:pl-7")} />
        ) : (
          <div className="relative min-w-0 flex-1">
            {machineTranslated && <span className="absolute left-2 top-1/2 z-[1] -translate-y-1/2"><MachineIndicator field={field} /></span>}
            <Input aria-label={`${languageLabel(language)}: ${field.label}`} value={targetValue} disabled={!sourceFilled} onChange={(event) => { if (event.target.value !== targetValue) updateField(material.id, field.id, language, event.target.value); }} placeholder={sourceFilled ? "Введите перевод" : "Не заполнено в оригинале"} className={cn("h-9 rounded-[7px] border-transparent px-2.5 text-[13px] shadow-none hover:border-[#e7e5e4] focus-visible:border-[#c7c2bd] focus-visible:ring-0 disabled:bg-white disabled:opacity-100", machineTranslated && "pl-7")} />
          </div>
        )}
        {isDescription && machineTranslated && <span className="absolute left-2 top-[46px] z-[1]"><MachineIndicator field={field} /></span>}
      </div>
    </div>
  );
}

function TranslationEditor({ entity, language }: { entity: TranslationEntity | null; language: TranslationLanguage }) {
  const { items } = useCatalogStore();
  const { account } = useMockAuth();
  const { saveState } = useTranslations();
  const primaryCode = account?.workspace.primaryLanguage ?? "ru";
  const imageUrl = entity?.material.catalogItemId ? items.find((item) => item.id === entity.material.catalogItemId)?.thumbnailUrl : null;

  if (!entity) return <main className="grid min-h-0 min-w-0 flex-1 place-items-center bg-[#fafaf9] text-[13px] text-[#79716b]">Нет сущностей для перевода</main>;

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <header className="flex h-[62px] shrink-0 items-center justify-between gap-3 border-b border-[#eeeeec] px-4">
        <div className="flex min-w-0 items-center gap-1.5"><CatalogThumbnail src={imageUrl} kind={entity.material.kind === "section" ? "section" : "item"} className="size-6 rounded-[6px]" /><span className="truncate text-[13px] font-medium text-[#292524]">{entity.subtitle ? `${entity.subtitle} · ${entity.title}` : entity.title}</span></div>
        <PositionSaveStatus status={saveState} />
      </header>
      <div className="grid h-[34px] shrink-0 grid-cols-[116px_minmax(0,1fr)_minmax(0,1fr)] border-b border-[#eeeeec] text-[13px] font-medium text-[#292524]"><div className="border-r border-[#eeeeec]" /><div className="flex min-w-0 items-center truncate border-r border-[#eeeeec] px-2">Оригинал ({languageLabel(primaryCode)})</div><div className="flex min-w-0 items-center truncate px-2">{languageLabel(language.code)}</div></div>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-x-hidden overflow-y-auto bg-[#fafaf9]"><div className="bg-white">{entity.fields.map((field) => <TranslationFieldRow key={field.id} field={field} language={language.code} material={entity.material} />)}</div></div>
    </main>
  );
}

function EmptyTranslations() {
  return (
    <div className="flex min-h-0 flex-1 bg-[#fbfbf9]">
      <ResizableTranslationsSidebar>
        <aside className="flex h-full w-full min-w-0 flex-col bg-white px-2 pt-5 shadow-[inset_-1px_0_0_#e7e5e4]">
          <div className="flex h-8 items-center justify-between border-b border-[#e7e5e4] px-1.5 pb-3"><h1 className="min-w-0 truncate text-[13px] text-[#1c1917]">Переводы</h1><TranslationsHeaderMenu /></div>
          <div data-translations-language-block className="border-b border-[#e7e5e4] pb-3 pt-2">
            <AddLanguagePopover>
              <button type="button" aria-label="Добавить язык" className="flex h-[30px] w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] font-medium text-[#666] hover:bg-[#f5f5f4]"><Plus size={14} />Добавить</button>
            </AddLanguagePopover>
          </div>
        </aside>
      </ResizableTranslationsSidebar>
      <main className="grid min-h-0 min-w-0 flex-1 place-items-center px-6 py-10 text-center"><div><h2 className="text-[16px] font-semibold text-stone-900">Переводов пока нет</h2><p className="mt-1.5 text-[13px] text-stone-500">Добавьте язык, чтобы начать перевод.</p></div></main>
    </div>
  );
}

function LanguageWorkspace({ initialContentType }: { initialContentType: TranslationContentType }) {
  const { activeLanguage, activeMaterialId, languages, materials, setActiveCategory, setActiveLanguage, setActiveMaterialId } = useTranslations();
  const [contentType, setContentType] = useState<TranslationContentType>(initialContentType);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const language = languages.find((item) => item.code === activeLanguage) ?? languages[0];
  const entities = useMemo(() => entitiesForType(materials, contentType), [contentType, materials]);
  const selectedEntity = entities.find((entity) => entity.key === selectedKey) ?? null;

  useEffect(() => { if (language && language.code !== activeLanguage) setActiveLanguage(language.code); }, [activeLanguage, language, setActiveLanguage]);
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
          onContentTypeChange={(type) => { setContentType(type); setSelectedKey(null); setActiveCategory(type === "options" ? "positions" : type); }}
          onLanguageChange={setActiveLanguage}
          onSelect={(entity) => { setSelectedKey(entity.key); setActiveMaterialId(entity.material.id); }}
        />
      </ResizableTranslationsSidebar>
      <TranslationEditor entity={selectedEntity} language={language} />
    </div>
  );
}

export function TranslationsWorkspace(_props: { onOpenOriginal?: (material: TranslationMaterial) => void }) {
  const { activeCategory, consumeWorkspaceRequest, languages, primaryLanguageConfirmed, workspaceRequested } = useTranslations();
  useEffect(() => { if (workspaceRequested) consumeWorkspaceRequest(); }, [consumeWorkspaceRequest, workspaceRequested]);
  if (!primaryLanguageConfirmed) return <FirstUseScreen />;
  if (languages.length === 0) return <EmptyTranslations />;
  return <LanguageWorkspace initialContentType={workspaceRequested ? activeCategory : "positions"} />;
}
