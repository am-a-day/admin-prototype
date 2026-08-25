import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowSquareOut,
  Check,
  DotsThreeVertical,
  Eye,
  ListChecks,
  MagnifyingGlass,
  Plus,
  Robot,
  Sparkle,
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
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
import { Tooltip } from "@/components/ui/tooltip";
import {
  useTranslations,
  type TranslationCategory,
  type TranslationFilter,
  type TranslationJobStatus,
  type TranslationLanguage,
  type TranslationLanguageCode,
  type TranslationMaterial,
  type TranslationStatus,
} from "@/contexts/translations-context";
import { cn } from "@/lib/utils";

type TranslationWorkspaceProps = {
  onOpenCatalogItem: (itemId: string) => void;
};

const STATUS_META: Record<TranslationStatus, { label: string; className: string }> = {
  missing: { label: "Не переведено", className: "bg-stone-100 text-stone-600" },
  machine: { label: "Автоперевод", className: "bg-indigo-50 text-indigo-700" },
  translated: { label: "Переведено", className: "bg-emerald-50 text-emerald-700" },
  outdated: { label: "Требует обновления", className: "bg-amber-50 text-amber-800" },
};

const CATEGORY_META: Array<{ id: TranslationCategory; label: string }> = [
  { id: "all", label: "Весь контент" },
  { id: "positions", label: "Позиции" },
  { id: "sections", label: "Разделы" },
  { id: "banners", label: "Баннеры" },
  { id: "about", label: "О заведении" },
];

const FILTER_LABELS: Record<TranslationFilter, string> = {
  all: "Все",
  missing: "Не переведено",
  outdated: "Требует обновления",
  machine: "Автоперевод",
  translated: "Переведено",
};

const JOB_STATUS_LABELS: Record<TranslationJobStatus, string> = {
  queued: "В очереди",
  running: "Выполняется",
  completed: "Завершено",
  error: "Ошибка",
};

function progress(language: TranslationLanguage) {
  return language.totalFields === 0 ? 0 : Math.round((language.doneFields / language.totalFields) * 100);
}

function StatusBadge({ status }: { status: TranslationStatus }) {
  const meta = STATUS_META[status];
  return (
    <span className={cn("inline-flex h-5 items-center rounded-[6px] px-1.5 text-[11px] font-medium", meta.className)}>
      {meta.label}
    </span>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
      <div className="h-full rounded-full bg-[#4f39f6] transition-[width]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function QueuePopover() {
  const { jobs, openWorkspace } = useTranslations();
  const active = jobs.find((job) => job.status === "running" || job.status === "queued");
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="relative font-medium">
          <ListChecks size={15} />
          {active ? `Переводим ${active.completed} из ${active.total}` : "Очередь"}
          {active && <span className="absolute -right-1 -top-1 size-2 rounded-full bg-indigo-500" />}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-[360px] p-0">
        <div className="flex items-center justify-between border-b border-stone-200 px-3 py-2.5">
          <div>
            <div className="text-[13px] font-semibold text-stone-900">Очередь переводов</div>
            <div className="text-[11px] text-stone-500">Можно продолжать работу во время перевода</div>
          </div>
          <span className="text-[11px] tabular-nums text-stone-500">{jobs.length} задач</span>
        </div>
        <div className="max-h-72 overflow-y-auto p-2">
          {jobs.length === 0 ? (
            <div className="px-3 py-8 text-center text-[12px] text-stone-500">В очереди пока нет задач</div>
          ) : jobs.map((job) => (
            <button
              key={job.id}
              type="button"
              onClick={() => openWorkspace({ language: job.language })}
              className="block w-full rounded-[8px] px-2.5 py-2 text-left transition hover:bg-stone-50"
            >
              <div className="flex items-center justify-between gap-2 text-[12px]">
                <span className="font-medium text-stone-800">
                  {job.language === "kk" ? "Қазақша" : job.language === "en" ? "English" : "Serbian"}
                </span>
                <span className={cn("text-[11px]", job.status === "error" ? "text-red-600" : "text-stone-500")}>
                  {JOB_STATUS_LABELS[job.status]}
                </span>
              </div>
              <div className="mt-0.5 text-[11px] text-stone-500">{job.source} · {job.total} материалов</div>
              <div className="mt-2"><ProgressBar value={job.total ? (job.completed / job.total) * 100 : 0} /></div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

type OverviewDialog =
  | { type: "publish"; language: TranslationLanguageCode }
  | { type: "delete"; language: TranslationLanguageCode }
  | { type: "settings"; language: TranslationLanguageCode }
  | null;

function LanguagesOverview({ onOpenPreview }: { onOpenPreview: (language: TranslationLanguageCode) => void }) {
  const {
    languages,
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
          <div className="flex items-center gap-2">
            <QueuePopover />
            <Button size="sm" className="bg-[#4f39f6] px-3.5 hover:bg-[#4030d4]" onClick={() => setAddOpen(true)}>
              <Plus size={15} />
              Добавить язык
            </Button>
          </div>
        </div>

        <section className="mt-7">
          <div className="mb-2 text-[12px] font-medium text-stone-500">Основной язык</div>
          <div className="flex h-[58px] items-center justify-between rounded-[12px] border border-stone-200 bg-white px-4">
            <div>
              <div className="text-[14px] font-medium text-stone-900">Русский</div>
              <div className="mt-0.5 text-[11px] text-stone-500">ru-RU</div>
            </div>
            <span className="rounded-[6px] bg-stone-100 px-2 py-1 text-[11px] font-medium text-stone-600">Основной язык</span>
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-2 flex items-center justify-between">
            <div className="text-[12px] font-medium text-stone-500">Дополнительные языки</div>
            <span className="text-[11px] tabular-nums text-stone-400">{languages.length}</span>
          </div>
          <div className="overflow-hidden rounded-[12px] border border-stone-200 bg-white">
            <div className="grid grid-cols-[minmax(180px,1.3fr)_150px_minmax(210px,1fr)_180px_36px] items-center border-b border-stone-200 bg-stone-50/70 px-4 py-2 text-[11px] text-stone-500">
              <span>Язык</span><span>Статус</span><span>Прогресс</span><span /><span />
            </div>
            {languages.map((item) => (
              <div key={item.code} className="grid min-h-[78px] grid-cols-[minmax(180px,1.3fr)_150px_minmax(210px,1fr)_180px_36px] items-center gap-3 border-b border-stone-100 px-4 last:border-b-0">
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-medium text-stone-900">{item.label}</div>
                  <div className="mt-0.5 text-[11px] text-stone-500">{item.locale}</div>
                </div>
                <span className={cn(
                  "w-fit rounded-[6px] px-2 py-1 text-[11px] font-medium",
                  item.published ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600",
                )}>
                  {item.published ? "Опубликован" : "Не опубликован"}
                </span>
                <div className="min-w-0">
                  <div className="mb-1.5 flex items-center justify-between gap-3 text-[11px]">
                    <span className="font-medium tabular-nums text-stone-700">{progress(item)}% переведено</span>
                    <span className="truncate text-stone-400">{item.missing} не переведено · {item.outdated} требуют обновления</span>
                  </div>
                  <ProgressBar value={progress(item)} />
                </div>
                <Button
                  size="sm"
                  variant={item.published ? "outline" : "default"}
                  className={cn(!item.published && "bg-[#4f39f6] hover:bg-[#4030d4]")}
                  onClick={() => openWorkspace({ language: item.code, category: "positions" })}
                >
                  {item.doneFields > 0 ? (item.published ? "Открыть" : "Продолжить перевод") : "Открыть"}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button type="button" aria-label={`Действия для ${item.label}`} className="flex size-8 items-center justify-center rounded-[8px] text-stone-500 hover:bg-stone-100 hover:text-stone-900">
                      <DotsThreeVertical size={16} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <DropdownMenuItem onSelect={() => openWorkspace({ language: item.code })}><ArrowSquareOut size={15} />Открыть переводы</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => onOpenPreview(item.code)}><Eye size={15} />Предпросмотр</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => setDialog({ type: "settings", language: item.code })}><Robot size={15} />Настройки автоперевода</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={() => item.published ? setPublished(item.code, false) : setDialog({ type: "publish", language: item.code })}>
                      {item.published ? <X size={15} /> : <Check size={15} />}{item.published ? "Снять с публикации" : "Опубликовать"}
                    </DropdownMenuItem>
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
          <AlertDialogHeader>
            <AlertDialogTitle>Добавить язык</AlertDialogTitle>
            <AlertDialogDescription>Основной язык — русский. Выберите один целевой язык.</AlertDialogDescription>
          </AlertDialogHeader>
          {!pendingLanguage ? (
            <div>
              <div className="relative">
                <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
                <Input autoFocus value={languageQuery} onChange={(event) => setLanguageQuery(event.target.value)} placeholder="Найти язык" className="pl-9" />
              </div>
              <div className="mt-2 rounded-[9px] border border-stone-200 p-1">
                {serbianAvailable ? (
                  <button type="button" onClick={() => setPendingLanguage("sr")} className="flex h-10 w-full items-center justify-between rounded-[7px] px-3 text-left text-[13px] hover:bg-stone-50">
                    <span>Serbian</span><span className="text-[11px] text-stone-400">sr-RS</span>
                  </button>
                ) : (
                  <div className="px-3 py-7 text-center text-[12px] text-stone-500">Языки не найдены</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="rounded-[9px] border border-stone-200 bg-stone-50 p-3">
                <div className="text-[13px] font-medium text-stone-900">Serbian</div>
                <div className="mt-0.5 text-[11px] text-stone-500">Будет добавлен как неопубликованный язык</div>
              </div>
              <button type="button" onClick={() => finishAdd(false)} className="w-full rounded-[9px] border border-stone-200 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40">
                <div className="text-[13px] font-medium text-stone-900">Добавить без перевода</div>
                <div className="mt-0.5 text-[11px] text-stone-500">0% переведено, существующий контент останется непереведённым</div>
              </button>
              <button type="button" onClick={() => finishAdd(true)} className="w-full rounded-[9px] border border-stone-200 px-3 py-3 text-left transition hover:border-indigo-200 hover:bg-indigo-50/40">
                <div className="flex items-center gap-1.5 text-[13px] font-medium text-stone-900"><Sparkle size={15} />Добавить и запустить автоперевод</div>
                <div className="mt-0.5 text-[11px] text-stone-500">9 материалов будут добавлены в очередь</div>
              </button>
            </div>
          )}
          <AlertDialogFooter>
            {pendingLanguage && <Button variant="ghost" size="sm" onClick={() => setPendingLanguage(null)}>Назад</Button>}
            <AlertDialogCancel>Отмена</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog?.type === "publish"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Переведено не всё содержимое</AlertDialogTitle>
            <AlertDialogDescription>Непереведённые и устаревшие поля будут показаны гостям на основном языке.</AlertDialogDescription>
          </AlertDialogHeader>
          {language && (
            <div className="grid grid-cols-3 gap-2 rounded-[9px] bg-stone-50 p-3 text-center">
              <div><div className="text-[15px] font-semibold tabular-nums">{progress(language)}%</div><div className="text-[10px] text-stone-500">готово</div></div>
              <div><div className="text-[15px] font-semibold tabular-nums">{language.missing}</div><div className="text-[10px] text-stone-500">не переведено</div></div>
              <div><div className="text-[15px] font-semibold tabular-nums">{language.outdated}</div><div className="text-[10px] text-stone-500">устарело</div></div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => { if (dialog?.type === "publish") setPublished(dialog.language, true); setDialog(null); }}>Опубликовать язык</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog?.type === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить язык?</AlertDialogTitle>
            <AlertDialogDescription>Все переводы для языка будут удалены. Это действие нельзя отменить.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (dialog?.type === "delete") removeLanguage(dialog.language); setDialog(null); }}>Удалить язык</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog?.type === "settings"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Настройки автоперевода</AlertDialogTitle>
            <AlertDialogDescription>{language?.label}: управление новым и изменённым контентом.</AlertDialogDescription>
          </AlertDialogHeader>
          {language && (
            <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[9px] border border-stone-200 p-3">
              <span><span className="block text-[13px] font-medium">Автоматически переводить новый и изменённый контент</span><span className="mt-1 block text-[11px] leading-4 text-stone-500">Новые материалы и обновления будут попадать в очередь.</span></span>
              <Switch checked={language.autoTranslate} onCheckedChange={(checked) => setAutoTranslate(language.code, checked)} />
            </label>
          )}
          <AlertDialogFooter><AlertDialogAction onClick={() => setDialog(null)}>Готово</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CategoryNav({ language }: { language: TranslationLanguageCode }) {
  const { activeCategory, materials, setActiveCategory, startAutoTranslate } = useTranslations();
  return (
    <aside className="flex min-h-0 w-[196px] shrink-0 flex-col border-r border-stone-200 bg-stone-50/50 p-2">
      <div className="px-2 pb-2 pt-1 text-[11px] font-medium uppercase tracking-wide text-stone-400">Категории</div>
      <nav className="space-y-0.5">
        {CATEGORY_META.map((category) => {
          const categoryMaterials = category.id === "all" ? materials : materials.filter((material) => material.category === category.id);
          const issues = categoryMaterials.filter((material) => material.statuses[language] === "missing" || material.statuses[language] === "outdated").length;
          const translated = categoryMaterials.filter((material) => material.statuses[language] !== "missing").length;
          const percentage = categoryMaterials.length ? Math.round((translated / categoryMaterials.length) * 100) : 100;
          return (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={cn(
                "flex h-9 w-full items-center justify-between rounded-[8px] px-2 text-left text-[12px] transition",
                activeCategory === category.id ? "bg-white font-medium text-stone-900 shadow-sm" : "text-stone-600 hover:bg-white/70 hover:text-stone-900",
              )}
            >
              <span>{category.label}</span>
              <span className={cn("text-[10px] tabular-nums", issues ? "text-amber-700" : "text-stone-400")}>{issues ? `${issues} проблем` : `${percentage}%`}</span>
            </button>
          );
        })}
      </nav>
      <div className="mt-auto border-t border-stone-200 pt-2">
        <button
          type="button"
          onClick={() => {
            const ids = (activeCategory === "all" ? materials : materials.filter((material) => material.category === activeCategory)).map((material) => material.id);
            startAutoTranslate([language], ids, CATEGORY_META.find((item) => item.id === activeCategory)?.label ?? "Категория");
          }}
          className="flex h-8 w-full items-center gap-1.5 rounded-[8px] px-2 text-left text-[11px] font-medium text-stone-600 transition hover:bg-white hover:text-stone-900"
        >
          <Robot size={14} />Перевести категорию
        </button>
      </div>
    </aside>
  );
}

function MaterialList({ language }: { language: TranslationLanguageCode }) {
  const { activeCategory, activeMaterialId, materials, setActiveMaterialId, startAutoTranslate } = useTranslations();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TranslationFilter>("all");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkOpen, setBulkOpen] = useState(false);
  const filtered = useMemo(() => materials.filter((material) => {
    if (activeCategory !== "all" && material.category !== activeCategory) return false;
    if (filter !== "all" && material.statuses[language] !== filter) return false;
    return material.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }), [activeCategory, filter, language, materials, query]);

  useEffect(() => {
    if (activeMaterialId && filtered.some((material) => material.id === activeMaterialId)) return;
    setActiveMaterialId(filtered[0]?.id ?? null);
  }, [activeMaterialId, filtered, setActiveMaterialId]);

  return (
    <section className="flex min-h-0 w-[330px] shrink-0 flex-col border-r border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-3">
        <div className="relative">
          <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input size="compact" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск материалов" className="pl-8" />
        </div>
        <div className="mt-2 flex items-center gap-2">
          <Select value={filter} onValueChange={(value) => setFilter(value as TranslationFilter)}>
            <SelectTrigger className="h-8 flex-1 shadow-none"><SelectValue /></SelectTrigger>
            <SelectContent>{(Object.keys(FILTER_LABELS) as TranslationFilter[]).map((value) => <SelectItem key={value} value={value}>{FILTER_LABELS[value]}</SelectItem>)}</SelectContent>
          </Select>
          <span className="shrink-0 text-[11px] tabular-nums text-stone-400">{filtered.length}</span>
        </div>
      </div>
      {selected.size > 0 && (
        <div className="flex h-10 shrink-0 items-center gap-2 border-b border-stone-200 bg-indigo-50/50 px-3">
          <span className="text-[11px] font-medium text-stone-700">{selected.size} выбрано</span>
          <Button size="sm" className="ml-auto h-7 bg-[#4f39f6] px-2 text-[11px] hover:bg-[#4030d4]" onClick={() => setBulkOpen(true)}><Robot size={13} />Перевести автоматически</Button>
          <Tooltip label="Снять выделение"><button type="button" aria-label="Снять выделение" onClick={() => setSelected(new Set())} className="flex size-7 items-center justify-center rounded-[7px] text-stone-500 hover:bg-white"><X size={14} /></button></Tooltip>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.map((material) => (
          <div
            key={material.id}
            className={cn("flex w-full gap-2 border-b border-stone-100 px-3 py-3 transition hover:bg-stone-50", activeMaterialId === material.id && "bg-[#f4f3ff] hover:bg-[#f4f3ff]")}
          >
            <span onClick={(event) => event.stopPropagation()} className="pt-0.5"><Checkbox checked={selected.has(material.id)} onCheckedChange={(checked) => setSelected((current) => { const next = new Set(current); if (checked) next.add(material.id); else next.delete(material.id); return next; })} aria-label={`Выбрать ${material.title}`} /></span>
            <button type="button" onClick={() => setActiveMaterialId(material.id)} className="min-w-0 flex-1 text-left">
              <span className="block truncate text-[13px] font-medium text-stone-900">{material.title}</span>
              <span className="mt-1 flex items-center gap-1.5"><StatusBadge status={material.statuses[language]} />{activeCategory === "all" && <span className="text-[10px] text-stone-400">{material.typeLabel}</span>}</span>
              {material.sourceChangedAt && material.statuses[language] === "outdated" && <span className="mt-1 block text-[10px] text-stone-400">Оригинал изменён: {material.sourceChangedAt}</span>}
            </button>
          </div>
        ))}
        {filtered.length === 0 && <div className="px-5 py-12 text-center text-[12px] text-stone-500">Материалы не найдены</div>}
      </div>

      <AlertDialog open={bulkOpen} onOpenChange={setBulkOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Перевести выбранные материалы?</AlertDialogTitle><AlertDialogDescription>{selected.size} материалов будут добавлены в фоновую очередь. Пустые исходные поля не обрабатываются.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => { startAutoTranslate([language], [...selected], "Выбранные материалы"); setBulkOpen(false); }}>Добавить в очередь</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}

function MaterialEditor({ language, onOpenCatalogItem }: { language: TranslationLanguageCode; onOpenCatalogItem: (itemId: string) => void }) {
  const { activeMaterialId, confirmMaterial, materials, saveState, startAutoTranslate, updateField } = useTranslations();
  const material = materials.find((item) => item.id === activeMaterialId) ?? null;
  if (!material) return <div className="grid min-w-0 flex-1 place-items-center bg-stone-50 text-[12px] text-stone-500">Выберите материал</div>;
  const status = material.statuses[language];
  return (
    <section className="flex min-w-[430px] flex-1 flex-col overflow-hidden bg-stone-50/40">
      <div className="flex min-h-[58px] shrink-0 items-center justify-between gap-4 border-b border-stone-200 bg-white px-4">
        <div className="min-w-0">
          <div className="truncate text-[14px] font-semibold text-stone-900">{material.title}</div>
          <div className="mt-1 flex items-center gap-2"><StatusBadge status={status} /><span className="text-[10px] text-stone-400">{material.typeLabel}</span></div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {saveState !== "idle" && <span className={cn("text-[11px]", saveState === "error" ? "text-red-600" : "text-stone-500")}>{saveState === "saving" ? "Сохранение…" : saveState === "saved" ? "Сохранено" : "Ошибка сохранения"}</span>}
          <Button size="sm" variant="outline" onClick={() => startAutoTranslate([language], [material.id], "Один материал")}><Robot size={14} />Перевести автоматически</Button>
          {material.catalogItemId && <Button size="sm" variant="ghost" onClick={() => onOpenCatalogItem(material.catalogItemId!)}><ArrowSquareOut size={14} />Открыть в каталоге</Button>}
        </div>
      </div>
      {status === "outdated" && (
        <div className="mx-4 mt-4 flex items-start gap-2 rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-900">
          <WarningCircle size={16} className="mt-0.5 shrink-0" />
          <div className="min-w-0 flex-1"><div className="font-medium">Оригинал изменился после перевода</div><div className="text-amber-800/80">Старый перевод сохранён. Обновите его вручную или автоматически.</div></div>
          <Button size="sm" className="h-7 bg-amber-800 px-2 text-[11px] hover:bg-amber-900" onClick={() => startAutoTranslate([language], [material.id], "Обновление перевода")}>Обновить перевод</Button>
        </div>
      )}
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-3 pb-2 text-[11px] font-medium text-stone-500">
          <div>Русский — основной</div>
          <div>{language === "kk" ? "Қазақша" : language === "en" ? "English" : "Serbian"}</div>
        </div>
        <div className="space-y-3">
          {material.fields.map((field) => {
            const multiline = field.id === "description" || field.source.length > 100;
            return (
              <div key={field.id} className="rounded-[10px] border border-stone-200 bg-white p-3">
                <div className="mb-2 text-[11px] font-medium text-stone-500">{field.label}</div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="min-h-10 rounded-[8px] border border-stone-200 bg-stone-50 px-3 py-2 text-[12px] leading-5 text-stone-600">
                    {status === "outdated" && field.previousSource && <div className="mb-2 border-b border-stone-200 pb-2 text-[10px] text-stone-400"><span className="font-medium">Предыдущий оригинал:</span> {field.previousSource}</div>}
                    {field.source}
                  </div>
                  {multiline ? (
                    <Textarea value={field.values[language] ?? ""} onChange={(event) => updateField(material.id, field.id, language, event.target.value)} placeholder="Введите перевод" className="min-h-[92px] resize-y text-[12px] leading-5" />
                  ) : (
                    <Input value={field.values[language] ?? ""} onChange={(event) => updateField(material.id, field.id, language, event.target.value)} placeholder="Введите перевод" className="h-10 text-[12px]" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {status === "machine" && (
          <div className="mt-4 flex items-center justify-between rounded-[9px] border border-indigo-200 bg-indigo-50 px-3 py-2.5">
            <div className="text-[12px] text-indigo-900"><span className="font-medium">Машинный перевод</span><span className="ml-1 text-indigo-700">Проверьте текст или примите без изменений.</span></div>
            <Button size="sm" className="h-8 bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => confirmMaterial(material.id, language)}><Check size={14} />Подтвердить перевод</Button>
          </div>
        )}
      </div>
    </section>
  );
}

function LanguageWorkspace({ onBack, onPreview, onOpenCatalogItem }: { onBack: () => void; onPreview: () => void; onOpenCatalogItem: (itemId: string) => void }) {
  const {
    activeLanguage,
    languages,
    materials,
    setActiveLanguage,
    setAutoTranslate,
    setPublished,
    startAutoTranslate,
  } = useTranslations();
  const [publishOpen, setPublishOpen] = useState(false);
  const [autoOpen, setAutoOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [autoScope, setAutoScope] = useState("missing-outdated");
  const language = languages.find((item) => item.code === activeLanguage) ?? languages[0];
  if (!language) return null;
  const eligible = materials.filter((material) => autoScope === "all" || material.statuses[language.code] === "missing" || (autoScope === "missing-outdated" && material.statuses[language.code] === "outdated"));
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="shrink-0 border-b border-stone-200 bg-white px-4 py-3">
        <div className="flex items-start justify-between gap-5">
          <div className="min-w-0">
            <button type="button" onClick={onBack} className="mb-1 flex items-center gap-1 text-[11px] text-stone-500 hover:text-stone-900"><ArrowLeft size={12} />Переводы</button>
            <div className="flex items-center gap-2">
              <span className="text-[13px] font-medium text-stone-500">Русский</span><span className="text-stone-300">→</span>
              <Select value={language.code} onValueChange={(value) => setActiveLanguage(value as TranslationLanguageCode)}>
                <SelectTrigger className="h-8 w-[156px] border-0 px-2 text-[14px] font-semibold shadow-none"><SelectValue /></SelectTrigger>
                <SelectContent>{languages.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent>
              </Select>
              <span className={cn("rounded-[6px] px-2 py-1 text-[10px] font-medium", language.published ? "bg-emerald-50 text-emerald-700" : "bg-stone-100 text-stone-600")}>{language.published ? "Опубликован" : "Не опубликован"}</span>
            </div>
            <div className="mt-1.5 flex items-center gap-3 text-[11px] text-stone-500"><span className="font-medium tabular-nums text-stone-700">{progress(language)}% переведено</span><span>{language.missing} не переведено</span><span>{language.outdated} требуют обновления</span></div>
          </div>
          <div className="flex shrink-0 items-center gap-2 pt-1">
            <QueuePopover />
            <Button variant="outline" size="sm" onClick={onPreview}><Eye size={15} />Предпросмотр</Button>
            <Button variant="outline" size="sm" onClick={() => setAutoOpen(true)}><Sparkle size={15} />Автоперевод</Button>
            {!language.published && <Button size="sm" className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => setPublishOpen(true)}>Опубликовать</Button>}
            <DropdownMenu><DropdownMenuTrigger asChild><button type="button" aria-label="Другие действия" className="flex size-8 items-center justify-center rounded-[8px] border border-stone-200 text-stone-500 hover:bg-stone-50"><DotsThreeVertical size={16} /></button></DropdownMenuTrigger><DropdownMenuContent align="end">{language.published && <DropdownMenuItem onSelect={() => setPublished(language.code, false)}><X size={14} />Снять с публикации</DropdownMenuItem>}<DropdownMenuItem onSelect={() => setSettingsOpen(true)}><Robot size={14} />Настройки автоперевода</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
          </div>
        </div>
      </header>
      <div className="flex min-h-0 flex-1"><CategoryNav language={language.code} /><MaterialList language={language.code} /><MaterialEditor language={language.code} onOpenCatalogItem={onOpenCatalogItem} /></div>

      <AlertDialog open={publishOpen} onOpenChange={setPublishOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Переведено не всё содержимое</AlertDialogTitle><AlertDialogDescription>Непереведённые и устаревшие поля будут показаны гостям на основном языке.</AlertDialogDescription></AlertDialogHeader><div className="grid grid-cols-3 gap-2 rounded-[9px] bg-stone-50 p-3 text-center"><div><div className="font-semibold tabular-nums">{progress(language)}%</div><div className="text-[10px] text-stone-500">готово</div></div><div><div className="font-semibold tabular-nums">{language.missing}</div><div className="text-[10px] text-stone-500">не переведено</div></div><div><div className="font-semibold tabular-nums">{language.outdated}</div><div className="text-[10px] text-stone-500">устарело</div></div></div><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => { setPublished(language.code, true); setPublishOpen(false); }}>Опубликовать язык</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AlertDialog open={autoOpen} onOpenChange={setAutoOpen}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Автоперевод {language.label}</AlertDialogTitle><AlertDialogDescription>Выберите область. Пустые поля оригинала не будут обрабатываться.</AlertDialogDescription></AlertDialogHeader><RadioGroup value={autoScope} onValueChange={setAutoScope} className="gap-1"><label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] p-2 hover:bg-stone-50"><RadioGroupItem value="missing" className="mt-0.5" /><span><span className="block text-[13px] font-medium">Только непереведённое</span><span className="text-[11px] text-stone-500">{materials.filter((material) => material.statuses[language.code] === "missing").length} материалов</span></span></label><label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] p-2 hover:bg-stone-50"><RadioGroupItem value="missing-outdated" className="mt-0.5" /><span><span className="block text-[13px] font-medium">Непереведённое и требующее обновления</span><span className="text-[11px] text-stone-500">Рекомендуемый вариант</span></span></label><label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] p-2 hover:bg-stone-50"><RadioGroupItem value="all" className="mt-0.5" /><span><span className="block text-[13px] font-medium">Весь контент заново</span><span className="text-[11px] text-stone-500">Заменит существующие переводы машинными</span></span></label></RadioGroup><div className="rounded-[8px] bg-stone-50 px-3 py-2 text-[11px] text-stone-600">Будет обработано: <span className="font-medium tabular-nums">{eligible.reduce((total, material) => total + material.fields.length, 0)} полей</span></div><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => { startAutoTranslate([language.code], eligible.map((material) => material.id), "Весь язык"); setAutoOpen(false); }}>Добавить в очередь</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>

      <AlertDialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Настройки автоперевода</AlertDialogTitle><AlertDialogDescription>{language.label}: управление новым и изменённым контентом.</AlertDialogDescription></AlertDialogHeader>
          <label className="flex cursor-pointer items-start justify-between gap-4 rounded-[9px] border border-stone-200 p-3">
            <span><span className="block text-[13px] font-medium">Автоматически переводить новый и изменённый контент</span><span className="mt-1 block text-[11px] leading-4 text-stone-500">Новые материалы и обновления будут попадать в очередь.</span></span>
            <Switch checked={language.autoTranslate} onCheckedChange={(checked) => setAutoTranslate(language.code, checked)} />
          </label>
          <AlertDialogFooter><AlertDialogAction onClick={() => setSettingsOpen(false)}>Готово</AlertDialogAction></AlertDialogFooter>
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
      <div className="mx-auto flex w-full max-w-[980px] items-center justify-between"><Button variant="outline" size="sm" onClick={onBack}><ArrowLeft size={14} />Вернуться в редактор</Button><Select value={previewLanguage} onValueChange={(value) => setPreviewLanguage(value as "ru" | TranslationLanguageCode)}><SelectTrigger className="h-8 w-[160px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="ru">Русский</SelectItem><SelectItem value={language}>{language === "kk" ? "Қазақша" : language === "en" ? "English" : "Serbian"}</SelectItem></SelectContent></Select></div>
      <div className="mx-auto mt-4 w-full max-w-[980px] overflow-hidden rounded-[18px] border border-stone-200 bg-[#fffdf8] shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-200 px-6 py-4"><div><div className="text-[17px] font-semibold text-stone-950">Kimchi Astana</div><div className="text-[11px] text-stone-500">Предпросмотр онлайн-меню</div></div><span className="rounded-full bg-white px-3 py-1 text-[11px] text-stone-600 shadow-sm">{previewLanguage === "ru" ? "Русский" : previewLanguage === "kk" ? "Қазақша" : previewLanguage === "en" ? "English" : "Serbian"}</span></div>
        <div className="p-6"><div className="mb-3 text-[18px] font-semibold text-stone-900">Популярное</div><div className="grid grid-cols-2 gap-3">{positions.map((material) => <div key={material.id} className="rounded-[14px] border border-stone-200 bg-white p-4"><div className="text-[14px] font-semibold text-stone-900">{getValue(material, "title")}</div><div className="mt-1 line-clamp-3 text-[12px] leading-5 text-stone-500">{getValue(material, "description")}</div>{previewLanguage !== "ru" && (material.statuses[previewLanguage] === "missing" || material.statuses[previewLanguage] === "outdated") && <div className="mt-2 text-[10px] text-amber-700">Показан основной язык</div>}</div>)}</div></div>
      </div>
    </div>
  );
}

export function TranslationsWorkspace({ onOpenCatalogItem }: TranslationWorkspaceProps) {
  const { activeLanguage, consumeWorkspaceRequest, languages, setActiveLanguage, workspaceRequested } = useTranslations();
  const [view, setView] = useState<"overview" | "workspace" | "preview">(() => workspaceRequested ? "workspace" : "overview");

  useEffect(() => {
    if (workspaceRequested) consumeWorkspaceRequest();
    const open = () => {
      setView("workspace");
      consumeWorkspaceRequest();
    };
    window.addEventListener("tasko:open-translations", open);
    return () => window.removeEventListener("tasko:open-translations", open);
  }, [consumeWorkspaceRequest, workspaceRequested]);

  if (view === "preview") return <TranslationPreview language={activeLanguage} onBack={() => setView("workspace")} />;
  if (view === "workspace" && languages.some((item) => item.code === activeLanguage)) {
    return <LanguageWorkspace onBack={() => setView("overview")} onPreview={() => setView("preview")} onOpenCatalogItem={onOpenCatalogItem} />;
  }
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
  const selectedMaterials = materials.filter((material) => material.catalogItemId && catalogBulkRequest?.includes(material.catalogItemId));
  return (
    <>
      <AlertDialog open={catalogBulkRequest !== null} onOpenChange={(open) => !open && closeCatalogBulk()}>
        <AlertDialogContent className="max-w-[500px]">
          <AlertDialogHeader><AlertDialogTitle>Перевести выбранные позиции</AlertDialogTitle><AlertDialogDescription>{catalogBulkRequest?.length ?? 0} позиций. Выберите один или несколько целевых языков.</AlertDialogDescription></AlertDialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">{translationLanguages.map((language) => <label key={language.code} className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-stone-200 p-2.5 text-[12px]"><Checkbox checked={selectedLanguages.has(language.code)} onCheckedChange={(checked) => setSelectedLanguages((current) => { const next = new Set(current); if (checked) next.add(language.code); else next.delete(language.code); return next; })} />{language.label}</label>)}</div>
            <RadioGroup value={scope} onValueChange={setScope} className="gap-1"><label className="flex cursor-pointer items-center gap-2 rounded-[7px] p-2 text-[12px] hover:bg-stone-50"><RadioGroupItem value="missing" />Только отсутствующие переводы</label><label className="flex cursor-pointer items-center gap-2 rounded-[7px] p-2 text-[12px] hover:bg-stone-50"><RadioGroupItem value="missing-outdated" />Отсутствующие и устаревшие</label><label className="flex cursor-pointer items-center gap-2 rounded-[7px] p-2 text-[12px] hover:bg-stone-50"><RadioGroupItem value="all" />Перевести заново</label></RadioGroup>
          </div>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction disabled={selectedLanguages.size === 0} className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => { selectedLanguages.forEach((language) => { const materialIds = selectedMaterials.filter((material) => scope === "all" || material.statuses[language] === "missing" || (scope === "missing-outdated" && material.statuses[language] === "outdated")).map((material) => material.id); startAutoTranslate([language], materialIds, "Каталог · массовый выбор"); }); closeCatalogBulk(); }}>Добавить в очередь</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {toast && (
        <div className="fixed bottom-5 left-1/2 z-[100050] flex -translate-x-1/2 items-center gap-3 rounded-[10px] bg-stone-900 px-3.5 py-2.5 text-[12px] font-medium text-white shadow-xl">
          <span>{toast.message}</span>
          {toast.actionLabel && <button type="button" onClick={() => { if (toast.onAction) toast.onAction(); else openWorkspace(); dismissToast(); }} className="font-semibold text-indigo-200 hover:text-white">{toast.actionLabel}</button>}
          <button type="button" aria-label="Закрыть" onClick={dismissToast} className="text-white/60 hover:text-white"><X size={14} /></button>
        </div>
      )}
    </>
  );
}
