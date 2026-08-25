import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowSquareOut,
  CaretDown,
  Check,
  DotsThreeVertical,
  Eye,
  FunnelSimple,
  MagnifyingGlass,
  Plus,
  Robot,
  Sparkle,
  SpinnerGap,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tooltip } from "@/components/ui/tooltip";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  useTranslations,
  type TranslationCategory,
  type TranslationFilter,
  type TranslationLanguage,
  type TranslationLanguageCode,
  type TranslationMaterial,
  type TranslationStatus,
} from "@/contexts/translations-context";
import { cn } from "@/lib/utils";

type TranslationWorkspaceProps = {
  onOpenOriginal: (material: TranslationMaterial) => void;
};

const STATUS_META: Record<TranslationStatus, { label: string }> = {
  missing: { label: "Не переведено" },
  machine: { label: "Автоперевод" },
  translated: { label: "Переведено" },
  outdated: { label: "Требует обновления" },
};

const CATEGORY_META: Array<{ id: TranslationCategory; label: string; group: "catalog" | "online" }> = [
  { id: "positions", label: "Позиции", group: "catalog" },
  { id: "sections", label: "Разделы", group: "catalog" },
  { id: "tags", label: "Теги", group: "catalog" },
  { id: "stickers", label: "Стикеры", group: "catalog" },
  { id: "banners", label: "Баннеры", group: "online" },
  { id: "about", label: "О заведении", group: "online" },
];

const FILTER_LABELS: Record<TranslationFilter, string> = {
  all: "Все",
  missing: "Не переведено",
  outdated: "Требует обновления",
  machine: "Автоперевод",
  translated: "Переведено",
};

function progress(language: TranslationLanguage) {
  return language.totalFields === 0 ? 0 : Math.round((language.doneFields / language.totalFields) * 100);
}

function languageLabel(language: TranslationLanguageCode) {
  return language === "kk" ? "Қазақша" : language === "en" ? "English" : "Serbian";
}

function StatusIndicator({ status, translating = false }: { status: TranslationStatus; translating?: boolean }) {
  const label = translating ? "Переводится" : STATUS_META[status].label;
  if (translating) {
    return (
      <Tooltip label={label} side="top">
        <span role="img" aria-label={label} className="flex size-5 shrink-0 items-center justify-center text-indigo-600"><SpinnerGap size={13} className="animate-spin" /></span>
      </Tooltip>
    );
  }
  if (status === "translated") return null;
  if (status === "outdated") {
    return (
      <Tooltip label={label} side="top">
        <span role="img" aria-label={label} className="flex size-5 shrink-0 items-center justify-center text-amber-600"><WarningCircle size={13} weight="fill" /></span>
      </Tooltip>
    );
  }
  if (status === "machine") {
    return (
      <Tooltip label={label} side="top">
        <span role="img" aria-label={label} className="flex size-5 shrink-0 items-center justify-center text-indigo-500"><Sparkle size={12} weight="fill" /></span>
      </Tooltip>
    );
  }
  return (
    <Tooltip label={label} side="top">
      <span role="img" aria-label={label} className="flex size-5 shrink-0 items-center justify-center"><span className="size-1.5 rounded-full bg-stone-300" /></span>
    </Tooltip>
  );
}

function ProgressBar({ value }: { value: number }) {
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100"><div className="h-full rounded-full bg-[#4f39f6] transition-[width]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} /></div>;
}

type OverviewDialog =
  | { type: "publish"; language: TranslationLanguageCode }
  | { type: "delete"; language: TranslationLanguageCode }
  | { type: "settings"; language: TranslationLanguageCode }
  | null;

function LanguagesOverview({ onOpenPreview }: { onOpenPreview: (language: TranslationLanguageCode) => void }) {
  const {
    languages,
    materials,
    addLanguage,
    openWorkspace,
    removeLanguage,
    setAutoTranslate,
    setPublished,
  } = useTranslations();
  const [addOpen, setAddOpen] = useState(false);
  const [languageQuery, setLanguageQuery] = useState("");
  const [pendingLanguage, setPendingLanguage] = useState<TranslationLanguageCode | null>(null);
  const [dialog, setDialog] = useState<OverviewDialog>(null);
  const language = dialog ? languages.find((item) => item.code === dialog.language) : null;
  const serbianAvailable = !languages.some((item) => item.code === "sr")
    && ["serbian", "сербский", "sr", "srpski"].some((term) => term.includes(languageQuery.trim().toLocaleLowerCase()) || !languageQuery.trim());

  const finishAdd = (auto: boolean) => {
    if (!pendingLanguage) return;
    addLanguage(pendingLanguage, auto);
    setPendingLanguage(null);
    setLanguageQuery("");
    setAddOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#fbfbf9]">
      <div className="mx-auto w-full max-w-[1120px] px-7 py-7">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-stone-950">Переводы</h1>
            <p className="mt-1 text-[13px] text-stone-500">Управляйте языками и переводами контента онлайн-меню</p>
          </div>
          <Button size="sm" className="bg-[#4f39f6] px-3.5 hover:bg-[#4030d4]" onClick={() => setAddOpen(true)}><Plus size={15} />Добавить язык</Button>
        </div>

        <section className="mt-7">
          <div className="mb-2 text-[12px] font-medium text-stone-500">Основной язык</div>
          <div className="flex h-[58px] items-center justify-between rounded-[12px] border border-stone-200 bg-white px-4">
            <div><div className="text-[14px] font-medium text-stone-900">Русский</div><div className="mt-0.5 text-[11px] text-stone-500">ru-RU</div></div>
            <span className="rounded-[6px] bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600">Основной язык</span>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between"><div className="text-[12px] font-medium text-stone-500">Дополнительные языки</div><span className="text-[11px] tabular-nums text-stone-400">{languages.length}</span></div>
          <div className="overflow-hidden rounded-[12px] border border-stone-200 bg-white">
            <div className="grid grid-cols-[minmax(180px,1.3fr)_150px_minmax(210px,1fr)_180px_36px] items-center border-b border-stone-200 bg-stone-50/70 px-4 py-2 text-[11px] text-stone-500"><span>Язык</span><span>Статус</span><span>Прогресс</span><span /><span /></div>
            {languages.map((item) => (
              <div key={item.code} className="grid min-h-[78px] grid-cols-[minmax(180px,1.3fr)_150px_minmax(210px,1fr)_180px_36px] items-center gap-3 border-b border-stone-100 px-4 last:border-b-0">
                <div className="min-w-0"><div className="truncate text-[14px] font-medium text-stone-900">{item.label}</div><div className="mt-0.5 text-[11px] text-stone-500">{item.locale}</div></div>
                <span className={cn("w-fit rounded-[6px] px-2 py-1 text-[11px] font-medium", item.published ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600")}>{item.published ? "Опубликован" : "Не опубликован"}</span>
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]"><span className="font-medium tabular-nums text-stone-700">{progress(item)}% переведено</span><span className="truncate text-stone-400">{item.missing} не переведено · {item.outdated} требуют обновления</span></div>
                  <ProgressBar value={progress(item)} />
                </div>
                <Button size="sm" variant={item.published ? "outline" : "default"} className={cn(!item.published && "bg-[#4f39f6] hover:bg-[#4030d4]")} onClick={() => openWorkspace({ language: item.code, category: "positions" })}>{item.doneFields > 0 ? (item.published ? "Открыть" : "Продолжить перевод") : "Открыть"}</Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild><button type="button" aria-label={`Действия для ${item.label}`} className="flex size-8 items-center justify-center rounded-[8px] text-stone-500 hover:bg-stone-100 hover:text-stone-900"><DotsThreeVertical size={16} /></button></DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onSelect={() => openWorkspace({ language: item.code })}><ArrowSquareOut size={15} />Открыть переводы</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onOpenPreview(item.code)}><Eye size={15} />Предпросмотр</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDialog({ type: "settings", language: item.code })}><Robot size={15} />Настройки автоперевода</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => item.published ? setPublished(item.code, false) : setDialog({ type: "publish", language: item.code })}>{item.published ? <X size={15} /> : <Check size={15} />}{item.published ? "Снять с публикации" : "Опубликовать"}</DropdownMenuItem>
                    <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => setDialog({ type: "delete", language: item.code })}><Trash size={15} />Удалить язык</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        </section>
      </div>

      <AlertDialog open={addOpen} onOpenChange={(open) => { setAddOpen(open); if (!open) setPendingLanguage(null); }}>
        <AlertDialogContent className="max-w-[520px]">
          <AlertDialogHeader><AlertDialogTitle>Добавить язык</AlertDialogTitle><AlertDialogDescription>Основной язык — русский. Выберите один целевой язык.</AlertDialogDescription></AlertDialogHeader>
          {!pendingLanguage ? (
            <div>
              <div className="relative"><MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} /><Input autoFocus value={languageQuery} onChange={(event) => setLanguageQuery(event.target.value)} placeholder="Найти язык" className="pl-9" /></div>
              <div className="mt-2 rounded-[9px] border border-stone-200 p-1">{serbianAvailable ? <button type="button" onClick={() => setPendingLanguage("sr")} className="flex h-10 w-full items-center justify-between rounded-[7px] px-3 text-left text-[13px] hover:bg-stone-50"><span>Serbian</span><span className="text-[11px] text-stone-400">sr-RS</span></button> : <div className="px-3 py-7 text-center text-[12px] text-stone-500">Языки не найдены</div>}</div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-[9px] border border-stone-200 bg-stone-50 p-3"><div className="text-[13px] font-medium text-stone-900">Serbian</div><div className="mt-0.5 text-[11px] text-stone-500">Будет добавлен как неопубликованный язык</div></div>
              <button type="button" onClick={() => finishAdd(false)} className="w-full rounded-[9px] border border-stone-200 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"><div className="text-[13px] font-medium text-stone-900">Добавить без перевода</div><div className="mt-0.5 text-[11px] text-stone-500">0% переведено, существующий контент останется непереведённым</div></button>
              <button type="button" onClick={() => finishAdd(true)} className="w-full rounded-[9px] border border-stone-200 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40"><div className="flex items-center gap-1.5 text-[13px] font-medium text-stone-900"><Sparkle size={15} />Добавить и запустить автоперевод</div><div className="mt-0.5 text-[11px] text-stone-500">{materials.length} материалов будут переведены</div></button>
            </div>
          )}
          <AlertDialogFooter>{pendingLanguage && <Button variant="ghost" size="sm" onClick={() => setPendingLanguage(null)}>Назад</Button>}<AlertDialogCancel>Отмена</AlertDialogCancel></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog?.type === "publish"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Переведено не всё содержимое</AlertDialogTitle><AlertDialogDescription>Непереведённые и устаревшие поля будут показаны гостям на основном языке.</AlertDialogDescription></AlertDialogHeader>
          {language && <div className="grid grid-cols-3 gap-2 rounded-[9px] bg-stone-50 p-3 text-center"><div><div className="text-[15px] font-semibold tabular-nums">{progress(language)}%</div><div className="text-[10px] text-stone-500">готово</div></div><div><div className="text-[15px] font-semibold tabular-nums">{language.missing}</div><div className="text-[10px] text-stone-500">не переведено</div></div><div><div className="text-[15px] font-semibold tabular-nums">{language.outdated}</div><div className="text-[10px] text-stone-500">устарело</div></div></div>}
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => { if (dialog?.type === "publish") setPublished(dialog.language, true); setDialog(null); }}>Опубликовать язык</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog?.type === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить язык?</AlertDialogTitle><AlertDialogDescription>Все переводы для языка будут удалены. Это действие нельзя отменить.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (dialog?.type === "delete") removeLanguage(dialog.language); setDialog(null); }}>Удалить язык</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog?.type === "settings"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Настройки автоперевода</AlertDialogTitle><AlertDialogDescription>{language?.label}: управление новым и изменённым контентом.</AlertDialogDescription></AlertDialogHeader>{language && <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[9px] border border-stone-200 p-3"><span><span className="block text-[13px] font-medium">Автоматически переводить новый и изменённый контент</span><span className="mt-1 block text-[11px] leading-4 text-stone-500">Новые материалы и изменения будут переводиться автоматически.</span></span><Switch checked={language.autoTranslate} onCheckedChange={(checked) => setAutoTranslate(language.code, checked)} /></label>}<AlertDialogFooter><AlertDialogAction onClick={() => setDialog(null)}>Готово</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type TranslationLeftPanelProps = {
  language: TranslationLanguageCode;
  bulkMode: boolean;
  selected: Set<string>;
  onSelectedChange: (selected: Set<string>) => void;
  onCancelBulk: () => void;
  onTranslateSelected: () => void;
};

function TranslationLeftPanel({ language, bulkMode, selected, onSelectedChange, onCancelBulk, onTranslateSelected }: TranslationLeftPanelProps) {
  const { activeCategory, activeMaterialId, jobs, materials, setActiveCategory, setActiveMaterialId } = useTranslations();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TranslationFilter>("all");
  const categoryMaterials = useMemo(() => materials.filter((material) => material.category === activeCategory), [activeCategory, materials]);
  const filtered = useMemo(() => categoryMaterials.filter((material) => {
    if (filter !== "all" && material.statuses[language] !== filter) return false;
    return material.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }), [categoryMaterials, filter, language, query]);
  const translatingIds = useMemo(() => new Set(jobs.filter((job) => job.language === language && (job.status === "queued" || job.status === "running")).flatMap((job) => job.materialIds)), [jobs, language]);
  const category = CATEGORY_META.find((item) => item.id === activeCategory)!;

  useEffect(() => {
    if (activeMaterialId && filtered.some((material) => material.id === activeMaterialId)) return;
    setActiveMaterialId(filtered[0]?.id ?? null);
  }, [activeMaterialId, filtered, setActiveMaterialId]);

  const toggleSelected = (materialId: string) => {
    const next = new Set(selected);
    if (next.has(materialId)) next.delete(materialId);
    else next.add(materialId);
    onSelectedChange(next);
  };

  return (
    <aside className="flex min-h-0 w-[292px] shrink-0 flex-col border-r border-[#e7e5e4] bg-white">
      <div className="space-y-1.5 border-b border-[#e7e5e4] p-2.5">
        <Select value={activeCategory} onValueChange={(value) => { setActiveCategory(value as TranslationCategory); onSelectedChange(new Set()); onCancelBulk(); }}>
          <SelectTrigger className="h-8 w-full border-[#e7e5e4] text-[13px] font-medium shadow-none"><span className="min-w-0 truncate">{category.label}<span className="font-normal tabular-nums text-stone-400"> · {categoryMaterials.length}</span></span></SelectTrigger>
          <SelectContent>
            <SelectGroup><div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-stone-400">Каталог</div>{CATEGORY_META.filter((item) => item.group === "catalog").map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectGroup>
            <SelectGroup><div className="mt-1 border-t border-stone-100 px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-stone-400">Онлайн-меню</div>{CATEGORY_META.filter((item) => item.group === "online").map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectGroup>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1"><MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" /><Input size="compact" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" className="pl-8" /></div>
          <DropdownMenu>
            <Tooltip label={`Фильтр: ${FILTER_LABELS[filter]}`} side="top">
              <DropdownMenuTrigger asChild><button type="button" aria-label={`Фильтр: ${FILTER_LABELS[filter]}`} className={cn("relative flex size-[30px] shrink-0 items-center justify-center rounded-[8px] border border-[#e7e5e4] text-stone-500 transition hover:bg-stone-50 hover:text-stone-800", filter !== "all" && "border-indigo-200 bg-indigo-50/60 text-indigo-700")}><FunnelSimple size={14} />{filter !== "all" && <span className="absolute right-1 top-1 size-1.5 rounded-full bg-indigo-500" />}</button></DropdownMenuTrigger>
            </Tooltip>
            <DropdownMenuContent align="end" className="w-52">
              {(Object.keys(FILTER_LABELS) as TranslationFilter[]).map((value) => <DropdownMenuItem key={value} onSelect={() => setFilter(value)}><span className="flex size-4 items-center justify-center">{filter === value && <Check size={12} weight="bold" />}</span>{FILTER_LABELS[value]}</DropdownMenuItem>)}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {bulkMode && <div className="flex h-10 shrink-0 items-center gap-2 border-b border-[#e7e5e4] bg-indigo-50/50 px-3"><span className="text-[11px] font-medium text-stone-700">Выбрано {selected.size}</span><Button size="sm" disabled={selected.size === 0} className="ml-auto h-7 bg-[#4f39f6] px-2 text-[11px] hover:bg-[#4030d4]" onClick={onTranslateSelected}>Перевести</Button><Button size="sm" variant="ghost" className="h-7 px-2 text-[11px]" onClick={onCancelBulk}>Отмена</Button></div>}

      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.map((material) => (
          <div key={material.id} className={cn("flex h-[42px] items-center gap-1.5 border-b border-stone-100/80 px-2.5 transition hover:bg-[#fafaf9] focus-within:bg-[#f4f3ff]", activeMaterialId === material.id && !bulkMode && "bg-[#f4f3ff] hover:bg-[#f4f3ff]")}>
            {bulkMode && <Checkbox checked={selected.has(material.id)} onCheckedChange={() => toggleSelected(material.id)} aria-label={`Выбрать ${material.title}`} />}
            <button type="button" onClick={() => bulkMode ? toggleSelected(material.id) : setActiveMaterialId(material.id)} className="flex min-w-0 flex-1 items-center gap-1.5 text-left outline-none">
              <span className={cn("min-w-0 flex-1 truncate text-[13px] text-[#292524]", activeMaterialId === material.id && !bulkMode ? "font-medium" : "font-normal")}>{material.title}</span>
              <StatusIndicator status={material.statuses[language]} translating={translatingIds.has(material.id)} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && <div className="px-5 py-12 text-center"><div className="text-[12px] font-medium text-stone-600">{categoryMaterials.length === 0 ? `В разделе «${category.label}» пока нет данных` : "Материалы не найдены"}</div><div className="mt-1 text-[11px] leading-4 text-stone-400">{categoryMaterials.length === 0 ? "Здесь появятся реальные сущности после их создания в админке." : "Измените поиск или фильтр состояния."}</div></div>}
      </div>
    </aside>
  );
}

function TranslationEditor({ language, onOpenOriginal }: { language: TranslationLanguageCode; onOpenOriginal: (material: TranslationMaterial) => void }) {
  const { activeMaterialId, confirmMaterial, materials, saveState, updateField } = useTranslations();
  const material = materials.find((item) => item.id === activeMaterialId) ?? null;
  if (!material) return <div className="grid min-w-0 flex-1 place-items-center bg-white text-[12px] text-stone-500">Выберите материал слева</div>;
  const status = material.statuses[language];
  return (
    <section className="flex min-w-[520px] flex-1 flex-col overflow-hidden bg-white">
      <div className="flex h-[50px] shrink-0 items-center justify-between gap-4 border-b border-[#e7e5e4] px-4">
        <div className="min-w-0 truncate text-[15px] font-semibold text-[#292524]">{material.title}</div>
        <div className="flex shrink-0 items-center gap-2">
          {saveState !== "idle" && <span className={cn("text-[11px]", saveState === "error" ? "text-red-600" : "text-stone-500")}>{saveState === "saving" ? "Сохранение…" : saveState === "saved" ? "Сохранено" : "Ошибка сохранения"}</span>}
          {status === "machine" && <Button size="sm" className="h-7 px-2.5 text-[11px] bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => confirmMaterial(material.id, language)}><Check size={13} />Подтвердить</Button>}
          <Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] font-medium text-stone-500 hover:text-stone-900" onClick={() => onOpenOriginal(material)}>Открыть оригинал<ArrowSquareOut size={12} /></Button>
        </div>
      </div>

      {status === "outdated" && <div className="flex items-start gap-2 border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-[12px] leading-5 text-amber-900"><WarningCircle size={16} className="mt-0.5 shrink-0" /><div><span className="font-medium">Оригинал изменился после перевода.</span><span className="ml-1 text-amber-800/80">Старый перевод сохранён — обновите его в правой колонке.</span></div></div>}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid h-9 grid-cols-[128px_minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] font-medium text-stone-500">
          <div className="px-3">Поле</div><div className="px-3">Русский — основной</div><div className="border-l border-[#e7e5e4] px-3">{languageLabel(language)}</div>
        </div>
        {material.fields.map((field, index) => {
          const hasSource = Boolean(field.source.trim());
          const multiline = field.id === "description" || field.source.length > 90;
          const showOptionsHeader = field.kind === "option-group"
            && !material.fields.slice(0, index).some((candidate) => candidate.kind === "option-group");
          return (
            <Fragment key={field.id}>
              {showOptionsHeader && <div className="grid h-8 grid-cols-[128px_minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-[#e7e5e4] bg-stone-50/80 text-[10px] font-semibold uppercase tracking-[0.06em] text-stone-400"><div className="px-3">Опции</div><div /><div className="border-l border-[#e7e5e4]" /></div>}
              <div className={cn(
                "grid min-h-[50px] grid-cols-[128px_minmax(0,1fr)_minmax(0,1fr)] border-b border-[#e7e5e4]",
                field.kind === "option-group" && "bg-stone-50/50",
              )}>
                <div className={cn(
                  "px-3 py-3 text-[11px] font-medium text-stone-400",
                  field.kind === "option-group" && "text-stone-500",
                  field.kind === "option" && "pl-6 font-normal",
                )}>{field.label}</div>
                <div className="bg-[#fafaf9]/45 px-3 py-2.5 text-[13px] leading-5 text-stone-600">
                  {status === "outdated" && field.previousSource && <div className="mb-2 border-b border-stone-200 pb-2 text-[10px] text-stone-400"><span className="font-medium">Предыдущий оригинал:</span> {field.previousSource}</div>}
                  {hasSource ? field.source : <span className="text-stone-400">Не заполнено</span>}
                </div>
                <div className="border-l border-[#e7e5e4] px-1.5 py-1.5">
                  {multiline ? (
                    <Textarea
                      value={hasSource ? field.values[language] ?? "" : ""}
                      disabled={!hasSource}
                      onChange={(event) => updateField(material.id, field.id, language, event.target.value)}
                      placeholder={hasSource ? "Введите перевод" : "Сначала заполните оригинал"}
                      className="h-[68px] min-h-[68px] resize-none rounded-[6px] border-transparent px-2 py-1.5 text-[13px] leading-5 shadow-none transition-colors hover:border-[#e7e5e4] focus-visible:border-[#c7c2bd] focus-visible:ring-2 focus-visible:ring-indigo-500/10 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-stone-400 disabled:opacity-100 disabled:hover:border-transparent"
                    />
                  ) : (
                    <Input
                      value={hasSource ? field.values[language] ?? "" : ""}
                      disabled={!hasSource}
                      onChange={(event) => updateField(material.id, field.id, language, event.target.value)}
                      placeholder={hasSource ? "Введите перевод" : "Сначала заполните оригинал"}
                      className="h-9 rounded-[6px] border-transparent px-2 text-[13px] shadow-none transition-colors hover:border-[#e7e5e4] focus:border-[#c7c2bd] focus-visible:ring-2 focus-visible:ring-indigo-500/10 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-transparent disabled:text-stone-400 disabled:opacity-100 disabled:hover:border-transparent"
                    />
                  )}
                </div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

function LanguageWorkspace({ onBack, onOpenOriginal }: { onBack: () => void; onOpenOriginal: (material: TranslationMaterial) => void }) {
  const {
    activeCategory,
    activeLanguage,
    activeMaterialId,
    jobs,
    languages,
    materials,
    setActiveLanguage,
    startAutoTranslate,
  } = useTranslations();
  const [bulkMode, setBulkMode] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingAutoTranslate, setPendingAutoTranslate] = useState<{ materialIds: string[]; source: string } | null>(null);
  const language = languages.find((item) => item.code === activeLanguage) ?? languages[0];
  if (!language) return null;
  const currentMaterial = materials.find((material) => material.id === activeMaterialId) ?? null;
  const categoryMaterials = materials.filter((material) => material.category === activeCategory);
  const missingMaterials = categoryMaterials.filter((material) => material.statuses[language.code] === "missing");
  const missingOrOutdatedMaterials = categoryMaterials.filter((material) => material.statuses[language.code] === "missing" || material.statuses[language.code] === "outdated");
  const activeJob = jobs.find((job) => job.language === language.code && (job.status === "queued" || job.status === "running"));
  const cancelBulk = () => { setBulkMode(false); setSelected(new Set()); };
  const confirmMassTranslation = (materialIds: string[], source: string) => {
    if (materialIds.length === 0) return;
    setPendingAutoTranslate({ materialIds, source });
  };
  const translateSelected = () => confirmMassTranslation([...selected], "Выбранные материалы");

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex h-[58px] shrink-0 items-center justify-between gap-5 border-b border-[#e7e5e4] bg-white px-4">
        <div className="flex min-w-0 items-center gap-3">
          <button type="button" onClick={onBack} className="flex h-7 shrink-0 items-center gap-1 rounded-[7px] px-1.5 text-[11px] text-stone-500 transition hover:bg-stone-50 hover:text-stone-900"><ArrowLeft size={12} />Переводы</button>
          <span className="h-7 w-px shrink-0 bg-stone-200" />
          <div className="min-w-0">
            <div className="flex h-7 items-center gap-1"><span className="text-[14px] font-semibold text-stone-800">Русский</span><span className="text-stone-300">→</span><Select value={language.code} onValueChange={(value) => setActiveLanguage(value as TranslationLanguageCode)}><SelectTrigger className="h-7 w-[132px] border-0 px-1.5 text-[14px] font-semibold shadow-none"><SelectValue /></SelectTrigger><SelectContent>{languages.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select></div>
            <div className="text-[11px] tabular-nums text-stone-400">{progress(language)}% переведено · {language.outdated > 0 ? `${language.outdated} ${language.outdated === 1 ? "требует" : "требуют"} обновления` : `${language.missing} осталось`}</div>
          </div>
        </div>
        <div className="flex shrink-0 items-center">
          <DropdownMenu>
            <DropdownMenuTrigger asChild><Button variant="outline" size="sm"><Sparkle size={15} />Автоперевод<CaretDown size={12} /></Button></DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-64">
              <DropdownMenuItem disabled={!currentMaterial} onSelect={() => currentMaterial && startAutoTranslate([language.code], [currentMaterial.id], "Текущий материал")}><Robot size={15} />Перевести текущий материал</DropdownMenuItem>
              <DropdownMenuItem disabled={missingMaterials.length === 0} onSelect={() => confirmMassTranslation(missingMaterials.map((material) => material.id), "Непереведённые материалы")}><Sparkle size={15} />Перевести все непереведённые</DropdownMenuItem>
              <DropdownMenuItem disabled={missingOrOutdatedMaterials.length === 0} onSelect={() => confirmMassTranslation(missingOrOutdatedMaterials.map((material) => material.id), "Не переведённые и устаревшие")}><WarningCircle size={15} />Не переведённые + требуют обновления</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={() => { setBulkMode(true); setSelected(new Set()); }}><Check size={15} />Выбрать материалы</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {activeJob && <div className="relative flex h-9 shrink-0 items-center gap-2 overflow-hidden border-b border-indigo-100 bg-indigo-50/60 px-4 text-[11px] text-indigo-800"><SpinnerGap size={14} className="animate-spin" /><span className="font-medium">{activeJob.status === "queued" ? `Готовим перевод ${activeJob.total} материалов…` : `Переведено ${activeJob.completed} из ${activeJob.total}`}</span><span className="text-indigo-600">{activeJob.source}</span><div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-100"><div className="h-full bg-indigo-500 transition-[width]" style={{ width: `${activeJob.total ? (activeJob.completed / activeJob.total) * 100 : 0}%` }} /></div></div>}

      <div className="flex min-h-0 flex-1"><TranslationLeftPanel language={language.code} bulkMode={bulkMode} selected={selected} onSelectedChange={setSelected} onCancelBulk={cancelBulk} onTranslateSelected={translateSelected} /><TranslationEditor language={language.code} onOpenOriginal={onOpenOriginal} /></div>

      <AlertDialog open={pendingAutoTranslate !== null} onOpenChange={(open) => !open && setPendingAutoTranslate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Запустить автоперевод?</AlertDialogTitle><AlertDialogDescription>Будет переведено {pendingAutoTranslate?.materialIds.length ?? 0} материалов. После запуска можно продолжить работу.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => { if (pendingAutoTranslate) startAutoTranslate([language.code], pendingAutoTranslate.materialIds, pendingAutoTranslate.source); setPendingAutoTranslate(null); cancelBulk(); }}>Перевести</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

function TranslationPreview({ language, onBack }: { language: TranslationLanguageCode; onBack: () => void }) {
  const { materials } = useTranslations();
  const [previewLanguage, setPreviewLanguage] = useState<"ru" | TranslationLanguageCode>(language);
  const positions = materials.filter((material) => material.category === "positions").slice(0, 4);
  const getValue = (material: TranslationMaterial, fieldId: string) => {
    const field = material.fields.find((item) => item.id === fieldId) ?? material.fields[0];
    if (!field) return "";
    if (previewLanguage === "ru") return field.source;
    const status = material.statuses[previewLanguage];
    return status === "missing" || status === "outdated" ? field.source : field.values[previewLanguage] || field.source;
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-stone-100 p-5">
      <div className="mx-auto flex w-full max-w-[980px] items-center justify-between"><Button variant="outline" size="sm" onClick={onBack}><ArrowLeft size={14} />Вернуться к языкам</Button><Select value={previewLanguage} onValueChange={(value) => setPreviewLanguage(value as "ru" | TranslationLanguageCode)}><SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ru">Русский</SelectItem><SelectItem value={language}>{languageLabel(language)}</SelectItem></SelectContent></Select></div>
      <div className="mx-auto mt-4 w-full max-w-[980px] overflow-hidden rounded-[18px] border border-stone-200 bg-[#fffdf8] shadow-sm"><div className="flex items-center justify-between border-b border-stone-200 px-6 py-4"><div><div className="text-[17px] font-semibold text-stone-950">Kimchi Astana</div><div className="text-[11px] text-stone-500">Предпросмотр онлайн-меню</div></div><span className="rounded-full bg-white px-3 py-1 text-[11px] text-stone-600 shadow-sm">{previewLanguage === "ru" ? "Русский" : languageLabel(previewLanguage)}</span></div><div className="p-6"><div className="mb-3 text-[18px] font-semibold text-stone-900">Популярное</div><div className="grid grid-cols-2 gap-3">{positions.map((material) => <div key={material.id} className="rounded-[14px] border border-stone-200 bg-white p-4"><div className="text-[14px] font-semibold text-stone-900">{getValue(material, "title")}</div><div className="mt-1 line-clamp-3 text-[12px] leading-5 text-stone-500">{getValue(material, "description")}</div>{previewLanguage !== "ru" && (material.statuses[previewLanguage] === "missing" || material.statuses[previewLanguage] === "outdated") && <div className="mt-2 text-[10px] text-amber-700">Показан основной язык</div>}</div>)}</div></div></div>
    </div>
  );
}

export function TranslationsWorkspace({ onOpenOriginal }: TranslationWorkspaceProps) {
  const { activeLanguage, consumeWorkspaceRequest, languages, setActiveLanguage, workspaceRequested } = useTranslations();
  const [view, setView] = useState<"overview" | "workspace" | "preview">(() => workspaceRequested ? "workspace" : "overview");
  useEffect(() => {
    if (workspaceRequested) consumeWorkspaceRequest();
    const open = () => { setView("workspace"); consumeWorkspaceRequest(); };
    window.addEventListener("tasko:open-translations", open);
    return () => window.removeEventListener("tasko:open-translations", open);
  }, [consumeWorkspaceRequest, workspaceRequested]);
  if (view === "preview") return <TranslationPreview language={activeLanguage} onBack={() => setView("overview")} />;
  if (view === "workspace" && languages.some((item) => item.code === activeLanguage)) return <LanguageWorkspace onBack={() => setView("overview")} onOpenOriginal={onOpenOriginal} />;
  return <LanguagesOverview onOpenPreview={(language) => { setActiveLanguage(language); setView("preview"); }} />;
}

export function TranslationOverlays() {
  const {
    catalogBulkRequest,
    closeCatalogBulk,
    languages: translationLanguages,
    materials,
    openWorkspace,
    startAutoTranslate,
    toast,
    dismissToast,
  } = useTranslations();
  const [selectedLanguages, setSelectedLanguages] = useState<Set<TranslationLanguageCode>>(new Set(["kk"]));
  const [scope, setScope] = useState("missing-outdated");
  const selectedMaterials = materials.filter((material) => material.kind === "position" && material.catalogItemId && catalogBulkRequest?.includes(material.catalogItemId));
  return (
    <>
      <AlertDialog open={catalogBulkRequest !== null} onOpenChange={(open) => !open && closeCatalogBulk()}>
        <AlertDialogContent className="max-w-[500px]">
          <AlertDialogHeader><AlertDialogTitle>Перевести выбранные позиции</AlertDialogTitle><AlertDialogDescription>{catalogBulkRequest?.length ?? 0} позиций. Выберите один или несколько целевых языков.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">{translationLanguages.map((language) => <label key={language.code} className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-stone-200 p-2.5 text-[12px]"><Checkbox checked={selectedLanguages.has(language.code)} onCheckedChange={(checked) => setSelectedLanguages((current) => { const next = new Set(current); if (checked) next.add(language.code); else next.delete(language.code); return next; })} />{language.label}</label>)}</div>
            <RadioGroup value={scope} onValueChange={setScope} className="gap-1"><label className="flex cursor-pointer items-center gap-2 rounded-[7px] p-2 text-[12px] hover:bg-stone-50"><RadioGroupItem value="missing" />Только отсутствующие переводы</label><label className="flex cursor-pointer items-center gap-2 rounded-[7px] p-2 text-[12px] hover:bg-stone-50"><RadioGroupItem value="missing-outdated" />Отсутствующие и устаревшие</label><label className="flex cursor-pointer items-center gap-2 rounded-[7px] p-2 text-[12px] hover:bg-stone-50"><RadioGroupItem value="all" />Перевести заново</label></RadioGroup>
          </div>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction disabled={selectedLanguages.size === 0} className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => { selectedLanguages.forEach((language) => { const materialIds = selectedMaterials.filter((material) => scope === "all" || material.statuses[language] === "missing" || (scope === "missing-outdated" && material.statuses[language] === "outdated")).map((material) => material.id); startAutoTranslate([language], materialIds, "Каталог · массовый выбор"); }); closeCatalogBulk(); }}>Перевести</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {toast && <div className="fixed bottom-5 left-1/2 z-[100050] flex -translate-x-1/2 items-center gap-3 rounded-[10px] bg-stone-900 px-3.5 py-2.5 text-[12px] font-medium text-white shadow-xl"><span>{toast.message}</span>{toast.actionLabel && <button type="button" onClick={() => { if (toast.onAction) toast.onAction(); else openWorkspace(); dismissToast(); }} className="font-semibold text-indigo-200 hover:text-white">{toast.actionLabel}</button>}<button type="button" aria-label="Закрыть" onClick={dismissToast} className="text-white/60 hover:text-white"><X size={14} /></button></div>}
    </>
  );
}
