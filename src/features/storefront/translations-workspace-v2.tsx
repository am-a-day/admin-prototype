import { useEffect, useMemo, useRef, useState } from "react";
import { CaretDown, CaretRight, Check, MagnifyingGlass, Minus, Plus, Sparkle, X } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { getLanguage, LANGUAGES } from "@/data/languages";
import { CatalogThumbnail } from "@/features/storefront/catalog/ui/catalog-thumbnail";
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

type TranslationEntity = {
  key: string;
  material: TranslationMaterial;
  title: string;
  subtitle?: string;
  fields: TranslationField[];
};

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
          <SelectContent>{LANGUAGES.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
        <Button type="button" className="mt-4 h-9 bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => confirmPrimaryLanguage(language)}>Подтвердить</Button>
      </section>
    </div>
  );
}

function AddLanguageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { account } = useMockAuth();
  const { addLanguage, languages } = useTranslations();
  const [query, setQuery] = useState("");
  const primaryLanguage = account?.workspace.primaryLanguage ?? "ru";
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const available = LANGUAGES.filter((language) => language.code !== primaryLanguage
    && !languages.some((item) => item.code === language.code)
    && (!normalizedQuery || [language.code, language.label, language.short].some((value) => value.toLocaleLowerCase().includes(normalizedQuery))));

  return (
    <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) setQuery(""); }}>
      <DialogContent className="pointer-events-auto max-w-[440px]">
        <DialogHeader><DialogTitle>Добавить язык</DialogTitle><DialogDescription>Выберите язык перевода.</DialogDescription></DialogHeader>
        <Input autoFocus aria-label="Поиск языка" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти язык" />
        <div className="max-h-64 overflow-y-auto rounded-[9px] border border-stone-200 p-1">
          {available.map((language) => (
            <Button key={language.code} type="button" variant="ghost" onClick={() => { addLanguage(language.code, true); onOpenChange(false); }} className="h-9 w-full justify-between rounded-[7px] px-3 text-[13px] font-normal">
              <span>{language.label}</span><span className="text-[11px] text-stone-400">{language.short}</span>
            </Button>
          ))}
          {available.length === 0 && <div className="px-3 py-6 text-center text-[12px] text-stone-500">Языки не найдены</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PrimaryLanguagePopover() {
  const { account } = useMockAuth();
  const { languages, setPrimaryLanguage } = useTranslations();
  const [open, setOpen] = useState(false);
  const primaryCode = account?.workspace.primaryLanguage ?? "ru";
  const primary = getLanguage(primaryCode);
  const available = LANGUAGES.filter((item) => item.code === primaryCode || languages.some((language) => language.code === item.code));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" aria-label="Выбрать основной язык" className="flex h-8 w-full items-center gap-2 rounded-[8px] p-1.5 text-left transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">
          <span className="flex h-3 w-[18px] shrink-0 items-center justify-center rounded-[2px] bg-[#e7e5e4] text-[8px] font-semibold text-[#79716b]">★</span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#79716b]">Основной язык</span>
          <span className="text-[11px] font-medium uppercase text-[#79716b]">{primary.short}</span>
          <CaretRight size={11} weight="bold" className="text-[#a8a29e]" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={5} className="w-[236px] rounded-[10px] border-[#e7e5e4] p-1.5 shadow-lg">
        <div className="px-2 pb-1.5 pt-1 text-[11px] leading-4 text-[#79716b]">Исходный язык для всех переводов</div>
        {available.map((language) => (
          <button key={language.code} type="button" onClick={() => { if (language.code !== primaryCode) setPrimaryLanguage(language.code); setOpen(false); }} className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left text-[13px] text-[#44403b] hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">
            <span className="w-6 text-[10px] font-semibold text-[#a8a29e]">{language.short}</span>
            <span className="min-w-0 flex-1 truncate">{language.label}</span>
            {language.code === primaryCode && <Check size={13} weight="bold" />}
          </button>
        ))}
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

function TranslationSidebar({
  language,
  contentType,
  entities,
  selectedKey,
  onAddLanguage,
  onContentTypeChange,
  onLanguageChange,
  onSelect,
}: {
  language: TranslationLanguage;
  contentType: TranslationContentType;
  entities: TranslationEntity[];
  selectedKey: string | null;
  onAddLanguage: () => void;
  onContentTypeChange: (type: TranslationContentType) => void;
  onLanguageChange: (language: TranslationLanguageCode) => void;
  onSelect: (entity: TranslationEntity) => void;
}) {
  const { languages, materials } = useTranslations();
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const typeLabel = CONTENT_TYPES.find((item) => item.id === contentType)?.label ?? "Позиции";
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const visibleEntities = entities.filter((entity) => !normalizedQuery || [entity.title, entity.subtitle].filter(Boolean).some((value) => value!.toLocaleLowerCase("ru").includes(normalizedQuery)));

  useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);
  useEffect(() => { setQuery(""); setSearchOpen(false); }, [contentType]);
  const closeSearch = () => { setQuery(""); setSearchOpen(false); };

  return (
    <aside className="flex min-h-0 w-[222px] shrink-0 flex-col overflow-hidden border-r border-[#e7e5e4] bg-white">
      <div className="shrink-0 border-b border-[#e7e5e4] px-2 pb-1.5 pt-5">
        <h1 className="px-1.5 text-[13px] font-normal leading-[18px] text-[#1c1917]">Переводы</h1>
        <div className="mt-1"><PrimaryLanguagePopover /></div>
        <div className="mt-0.5">
          {languages.map((item) => {
            const details = getLanguage(item.code);
            const selected = language.code === item.code;
            return (
              <button key={item.code} type="button" aria-current={selected ? "page" : undefined} onClick={() => onLanguageChange(item.code)} className={cn("flex h-8 w-full items-center gap-2 rounded-[8px] p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10", selected ? "bg-[#f5f5f4]" : "hover:bg-[#f5f5f4]")}>
                <span className={cn("flex h-3 w-[18px] shrink-0 items-center justify-center rounded-[2px] text-[8px] font-semibold", selected ? "bg-[#d6d3d1] text-[#57534d]" : "bg-[#e7e5e4] text-[#79716b]")}>{details.short}</span>
                <span className={cn("min-w-0 flex-1 truncate text-[13px]", selected ? "font-medium text-[#292524]" : "text-[#79716b]")}>{details.label}</span>
                <span className="shrink-0 text-[10px] tabular-nums text-[#a8a29e]">{languageCompleteness(materials, item.code)}%</span>
              </button>
            );
          })}
          <button type="button" onClick={onAddLanguage} className="flex h-8 w-full items-center gap-2 rounded-[8px] p-1.5 text-left text-[13px] text-[#79716b] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"><Plus size={13} className="ml-0.5" />Добавить</button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col pt-2">
        <div className="shrink-0 px-2">
          <div className="flex h-7 items-center justify-between px-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" aria-label="Выбрать тип контента" className="flex min-w-0 items-center gap-1.5 rounded-[6px] text-[13px] text-[#1c1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"><span className="truncate">{typeLabel}</span><CaretDown size={10} weight="fill" className="text-[#79716b]" /></button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-[210px]">
                {CONTENT_TYPES.map((item) => <DropdownMenuItem key={item.id} onSelect={() => onContentTypeChange(item.id)}><span className="flex size-4 items-center justify-center">{contentType === item.id && <Check size={12} weight="bold" />}</span>{item.label}</DropdownMenuItem>)}
              </DropdownMenuContent>
            </DropdownMenu>
            {contentType !== "about" && <Tooltip label="Поиск" side="top" delayDuration={250}><Button type="button" variant="ghost" size="icon" aria-label="Открыть поиск" onClick={() => setSearchOpen(true)} className={cn("size-5 rounded-[6px] text-[#79716b]", searchOpen && "bg-[#f5f5f4] text-[#292524]")}><MagnifyingGlass size={14} /></Button></Tooltip>}
          </div>
          {searchOpen && contentType !== "about" && (
            <div className="flex h-9 items-center gap-1.5 border-b border-[#e7e5e4] px-1">
              <Input ref={searchInputRef} size="compact" autoFocus aria-label={`Поиск: ${typeLabel}`} value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }} placeholder="Найти..." className="h-7 min-w-0 flex-1 rounded-[7px] border-[#4f39f6] px-2 text-[13px] focus-visible:ring-0" />
              <button type="button" aria-label="Закрыть поиск" onClick={closeSearch} className="flex size-5 shrink-0 items-center justify-center rounded-[6px] text-[#79716b] hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"><X size={14} /></button>
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
                  <span className="min-w-0 flex-1"><span className={cn("block truncate text-[13px] leading-4", selected ? "font-medium text-[#292524]" : "text-[#79716b]")}>{entity.title}</span>{entity.subtitle && <span className="block truncate text-[10px] leading-3 text-[#a8a29e]">{entity.subtitle}</span>}</span>
                  <span role="img" aria-label={complete ? "Перевод заполнен" : "Перевод не заполнен"} className={cn("flex size-4 shrink-0 items-center justify-center", complete ? "text-[#57534d]" : "text-[#a8a29e]")}>{complete ? <Check size={12} weight="bold" /> : <Minus size={12} weight="bold" />}</span>
                </button>
              );
            })}
            {visibleEntities.length === 0 && <p className="px-2 py-2 text-[13px] leading-4 text-[#78716c]">Ничего не найдено</p>}
          </div>
        )}
      </div>
    </aside>
  );
}

function MachineIndicator({ field }: { field: TranslationField }) {
  return <Tooltip label="Переведено автоматически" side="top"><span tabIndex={0} role="img" aria-label={`Переведено автоматически: ${field.label}`} className="flex size-4 items-center justify-center text-[#615fff] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200"><Sparkle size={11} weight="fill" /></span></Tooltip>;
}

function TranslationFieldRow({ field, language, material }: { field: TranslationField; language: TranslationLanguageCode; material: TranslationMaterial }) {
  const { autoTranslateField, updateField } = useTranslations();
  const sourceFilled = Boolean(field.source.trim());
  const targetValue = sourceFilled ? field.values[language] ?? "" : "";
  const machineTranslated = Boolean(targetValue.trim()) && (field.machineTranslatedLanguages?.includes(language) ?? false);
  const isDescription = field.id === "description" || field.label.toLocaleLowerCase("ru").includes("описание");
  const translateLabel = targetValue.trim() ? "Перевести заново" : "Перевести";

  return (
    <div className="grid grid-cols-[82px_minmax(0,1fr)_minmax(0,1fr)] border-b border-[#eeeeec] last:border-b-0">
      <div className={cn("flex min-w-0 border-r border-[#eeeeec] px-2 py-3 text-[13px] text-[#44403b]", isDescription ? "min-h-[174px] items-start" : "h-12 items-center")}><span className="truncate">{field.label.replace(/^Группа · |^Опция · /, "")}</span></div>
      <div className={cn("min-w-0 border-r border-[#eeeeec] bg-[#fafaf9]", isDescription ? "p-0" : "flex h-12 items-center px-3")}>
        {isDescription
          ? <DescriptionRichTextEditor value={field.source} readOnly hideLabel label={`Оригинал: ${field.label}`} placeholder="Не заполнено" limit={300} compact className="h-full [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none" />
          : <div className="min-w-0 truncate text-[13px] leading-5 text-[#44403b]">{sourceFilled ? field.source : <span className="text-[#a8a29e]">Не заполнено</span>}</div>}
      </div>
      <div className={cn("group relative min-w-0 bg-white", isDescription ? "p-0" : "flex h-12 items-center px-1.5")}>
        {sourceFilled && <Button type="button" variant="ghost" aria-label={`${translateLabel}: ${field.label}`} onClick={() => autoTranslateField(material.id, field.id, language)} className={cn("absolute right-2 z-10 h-6 rounded-[6px] bg-white/95 px-1.5 text-[10px] font-medium text-[#615fff] opacity-0 shadow-sm transition-opacity hover:bg-[#f5f5ff] group-hover:opacity-100 group-focus-within:opacity-100", isDescription ? "top-9" : "top-3")}><Sparkle size={11} weight="fill" />{translateLabel}</Button>}
        {isDescription ? (
          <DescriptionRichTextEditor value={targetValue} onChange={(value) => updateField(material.id, field.id, language, value)} hideLabel label={`${getLanguage(language).label}: ${field.label}`} placeholder={sourceFilled ? "Введите перевод" : "Не заполнено в оригинале"} limit={300} compact className={cn("h-full [&>div]:h-full [&>div]:rounded-none [&>div]:border-0 [&>div]:shadow-none", machineTranslated && "[&>div>div:last-child]:pl-7")} />
        ) : (
          <div className="relative min-w-0 flex-1">
            {machineTranslated && <span className="absolute left-2 top-1/2 z-[1] -translate-y-1/2"><MachineIndicator field={field} /></span>}
            <Input aria-label={`${getLanguage(language).label}: ${field.label}`} value={targetValue} disabled={!sourceFilled} onChange={(event) => updateField(material.id, field.id, language, event.target.value)} placeholder={sourceFilled ? "Введите перевод" : "Не заполнено в оригинале"} className={cn("h-9 rounded-[7px] border-transparent px-2.5 text-[13px] shadow-none hover:border-[#e7e5e4] focus-visible:border-[#c7c2bd] focus-visible:ring-0 disabled:bg-white disabled:opacity-100", machineTranslated && "pl-7")} />
          </div>
        )}
        {isDescription && machineTranslated && <span className="absolute left-2 top-10 z-[1]"><MachineIndicator field={field} /></span>}
      </div>
    </div>
  );
}

function TranslationEditor({ entity, language }: { entity: TranslationEntity | null; language: TranslationLanguage }) {
  const { items } = useCatalogStore();
  const { account } = useMockAuth();
  const { saveState } = useTranslations();
  const primary = getLanguage(account?.workspace.primaryLanguage ?? "ru");
  const imageUrl = entity?.material.catalogItemId ? items.find((item) => item.id === entity.material.catalogItemId)?.thumbnailUrl : null;

  if (!entity) return <main className="grid min-h-0 min-w-0 flex-1 place-items-center bg-[#fafaf9] text-[13px] text-[#79716b]">Нет сущностей для перевода</main>;

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <header className="flex h-[44px] shrink-0 items-center justify-between gap-3 border-b border-[#eeeeec] px-3">
        <div className="flex min-w-0 items-center gap-2"><CatalogThumbnail src={imageUrl} kind={entity.material.kind === "section" ? "section" : "item"} className="size-5 rounded-[5px]" /><span className="truncate text-[13px] font-medium text-[#292524]">{entity.subtitle ? `${entity.subtitle} · ${entity.title}` : entity.title}</span></div>
        {saveState !== "idle" && <span className="shrink-0 text-[10px] text-[#a8a29e]">{saveState === "saving" ? "Сохранение…" : saveState === "saved" ? "Сохранено" : "Ошибка сохранения"}</span>}
      </header>
      <div className="grid h-[34px] shrink-0 grid-cols-[82px_minmax(0,1fr)_minmax(0,1fr)] border-b border-[#eeeeec] text-[13px] font-medium text-[#292524]"><div className="border-r border-[#eeeeec]" /><div className="flex items-center border-r border-[#eeeeec] px-2">Оригинал ({primary.label})</div><div className="flex items-center px-2">{getLanguage(language.code).label}</div></div>
      <div className="scrollbar-subtle min-h-0 flex-1 overflow-y-auto bg-[#fafaf9]"><div className="bg-white">{entity.fields.map((field) => <TranslationFieldRow key={field.id} field={field} language={language.code} material={entity.material} />)}</div></div>
    </main>
  );
}

function EmptyTranslations() {
  const [addOpen, setAddOpen] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 bg-[#fbfbf9]">
      <aside className="w-[222px] shrink-0 border-r border-[#e7e5e4] bg-white px-2 pb-2 pt-5"><h1 className="px-1.5 text-[13px] text-[#1c1917]">Переводы</h1><div className="mt-1"><PrimaryLanguagePopover /></div><button type="button" onClick={() => setAddOpen(true)} className="mt-0.5 flex h-8 w-full items-center gap-2 rounded-[8px] p-1.5 text-left text-[13px] text-[#79716b] hover:bg-[#f5f5f4]"><Plus size={13} />Добавить</button></aside>
      <main className="grid min-h-0 min-w-0 flex-1 place-items-center px-6 py-10 text-center"><div><h2 className="text-[16px] font-semibold text-stone-900">Переводов пока нет</h2><p className="mt-1.5 text-[13px] text-stone-500">Добавьте язык, чтобы начать перевод.</p></div></main>
      <AddLanguageDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

function LanguageWorkspace({ initialContentType }: { initialContentType: TranslationContentType }) {
  const { activeLanguage, activeMaterialId, languages, materials, setActiveCategory, setActiveLanguage, setActiveMaterialId } = useTranslations();
  const [addOpen, setAddOpen] = useState(false);
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
      <TranslationSidebar
        language={language}
        contentType={contentType}
        entities={entities}
        selectedKey={selectedKey}
        onAddLanguage={() => setAddOpen(true)}
        onContentTypeChange={(type) => { setContentType(type); setSelectedKey(null); setActiveCategory(type === "options" ? "positions" : type); }}
        onLanguageChange={setActiveLanguage}
        onSelect={(entity) => { setSelectedKey(entity.key); setActiveMaterialId(entity.material.id); }}
      />
      <TranslationEditor entity={selectedEntity} language={language} />
      <AddLanguageDialog open={addOpen} onOpenChange={setAddOpen} />
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
