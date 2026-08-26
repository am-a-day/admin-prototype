import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowSquareOut,
  Check,
  DotsThreeVertical,
  FunnelSimple,
  MagnifyingGlass,
  Plus,
  Sparkle,
  SpinnerGap,
  Trash,
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
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
import { useMockAuth } from "@/contexts/mock-auth-context";
import {
  useTranslations,
  type TranslationCategory,
  type TranslationFilter,
  type TranslationLanguage,
  type TranslationLanguageCode,
  type TranslationMaterial,
} from "@/contexts/translations-context";
import { getLanguage, LANGUAGES } from "@/data/languages";
import { cn } from "@/lib/utils";

type TranslationWorkspaceProps = {
  onOpenOriginal: (material: TranslationMaterial) => void;
};

const CATEGORY_META: Array<{ id: TranslationCategory; label: string; group: "main" | "catalog" | "other" }> = [
  { id: "about", label: "О заведении", group: "main" },
  { id: "interface", label: "Заголовки и кнопки", group: "main" },
  { id: "positions", label: "Позиции", group: "catalog" },
  { id: "sections", label: "Разделы", group: "catalog" },
  { id: "banners", label: "Баннеры", group: "other" },
  { id: "tags", label: "Теги", group: "other" },
  { id: "stickers", label: "Стикеры", group: "other" },
];

const FILTER_LABELS: Record<TranslationFilter, string> = {
  all: "Все",
  missing: "Не переведено",
  translated: "Переведено",
};

const LOCALES: Record<TranslationLanguageCode, string> = {
  ru: "ru-RU",
  kk: "kk-KZ",
  en: "en-US",
  zh: "zh-CN",
  fr: "fr-FR",
  es: "es-ES",
  sr: "sr-RS",
};

function progress(language: TranslationLanguage) {
  return language.totalFields === 0 ? 0 : Math.round((language.doneFields / language.totalFields) * 100);
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-stone-100">
      <div className="h-full rounded-full bg-[#4f39f6] transition-[width]" style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

type OverviewDialog =
  | { type: "primary"; language: TranslationLanguageCode }
  | { type: "delete"; language: TranslationLanguageCode }
  | null;

function LanguagesOverview() {
  const { account } = useMockAuth();
  const {
    addLanguage,
    jobs,
    languages,
    openWorkspace,
    removeLanguage,
    setPrimaryLanguage,
    setPublished,
  } = useTranslations();
  const primaryCode = account?.workspace.primaryLanguage ?? "ru";
  const primary = getLanguage(primaryCode);
  const additionalLanguages = languages.filter(({ code }) => code !== primaryCode);
  const [addOpen, setAddOpen] = useState(false);
  const [languageQuery, setLanguageQuery] = useState("");
  const [pendingLanguage, setPendingLanguage] = useState<TranslationLanguageCode | null>(null);
  const [dialog, setDialog] = useState<OverviewDialog>(null);
  const availableLanguages = LANGUAGES.filter(({ code, label, short }) => {
    if (code === primaryCode || additionalLanguages.some((language) => language.code === code)) return false;
    const query = languageQuery.trim().toLocaleLowerCase();
    return !query || [code, label, short].some((value) => value.toLocaleLowerCase().includes(query));
  });
  const dialogLanguage = dialog ? getLanguage(dialog.language) : null;

  const finishAdd = (publishAfterComplete: boolean) => {
    if (!pendingLanguage) return;
    addLanguage(pendingLanguage, publishAfterComplete);
    setPendingLanguage(null);
    setLanguageQuery("");
    setAddOpen(false);
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-[#fbfbf9]">
      <div className="mx-auto w-full max-w-[1040px] px-7 py-7">
        <div className="flex items-start justify-between gap-6">
          <div>
            <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-stone-950">Переводы</h1>
            <p className="mt-1 text-[13px] text-stone-500">Языки всего контента, который видят гости</p>
          </div>
          <Button size="sm" className="bg-[#4f39f6] px-3.5 hover:bg-[#4030d4]" onClick={() => setAddOpen(true)}><Plus size={15} />Добавить язык</Button>
        </div>

        <section className="mt-7" aria-labelledby="primary-language-heading">
          <div id="primary-language-heading" className="mb-2 text-[12px] font-medium text-stone-500">Основной язык</div>
          <div className="flex h-[58px] items-center justify-between rounded-[12px] border border-stone-200 bg-white px-4">
            <div><div className="text-[14px] font-medium text-stone-900">{primary.label}</div><div className="mt-0.5 text-[11px] text-stone-500">{LOCALES[primaryCode]}</div></div>
            <span className="text-[11px] font-medium text-stone-500">Основной</span>
          </div>
        </section>

        <section className="mt-6" aria-labelledby="additional-languages-heading">
          <div className="mb-2 flex items-center justify-between"><div id="additional-languages-heading" className="text-[12px] font-medium text-stone-500">Дополнительные языки</div><span className="text-[11px] tabular-nums text-stone-400">{additionalLanguages.length}</span></div>
          <div className="overflow-hidden rounded-[12px] border border-stone-200 bg-white">
            {additionalLanguages.map((item) => {
              const activeJob = jobs.find((job) => job.language === item.code && (job.status === "queued" || job.status === "running"));
              const jobProgress = activeJob ? Math.round((activeJob.completed / Math.max(1, activeJob.total)) * 100) : null;
              const readyToPublish = !item.published && !activeJob && item.doneFields > 0;
              return (
                <div key={item.code} className="grid min-h-[68px] grid-cols-[minmax(170px,1fr)_minmax(220px,1.2fr)_150px_36px] items-center gap-4 border-b border-stone-100 px-4 last:border-b-0">
                  <div className="min-w-0"><div className="truncate text-[14px] font-medium text-stone-900">{item.label}</div><div className="mt-0.5 text-[11px] text-stone-500">{item.locale}</div></div>
                  <div className="min-w-0">
                    {activeJob ? (
                      <><div className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium text-indigo-700"><SpinnerGap size={13} className="animate-spin" />Переводим… {jobProgress}%</div><ProgressBar value={jobProgress ?? 0} /></>
                    ) : readyToPublish ? (
                      <span className="text-[12px] font-medium text-amber-700">Готов к публикации</span>
                    ) : progress(item) < 100 ? (
                      <><div className="mb-1.5 text-[11px] tabular-nums text-stone-500">{progress(item)}% переведено</div><ProgressBar value={progress(item)} /></>
                    ) : null}
                  </div>
                  {readyToPublish ? (
                    <Button size="sm" className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => setPublished(item.code, true)}>Опубликовать</Button>
                  ) : (
                    <Button size="sm" variant="outline" onClick={() => openWorkspace({ language: item.code })}>Открыть</Button>
                  )}
                  <DropdownMenu>
                  <DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={`Действия для ${item.label}`} className="size-8 rounded-[8px] text-stone-500 hover:bg-stone-100 hover:text-stone-900"><DotsThreeVertical size={16} /></Button></DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                      <DropdownMenuItem onSelect={() => openWorkspace({ language: item.code })}><ArrowSquareOut size={15} />Открыть переводы</DropdownMenuItem>
                      <DropdownMenuItem onSelect={() => setDialog({ type: "primary", language: item.code })}><Check size={15} />Сделать основным</DropdownMenuItem>
                      {item.published && <DropdownMenuItem onSelect={() => setPublished(item.code, false)}><X size={15} />Снять с публикации</DropdownMenuItem>}
                      <DropdownMenuSeparator />
                      <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => setDialog({ type: "delete", language: item.code })}><Trash size={15} />Удалить язык</DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <Dialog open={addOpen} onOpenChange={(nextOpen) => { setAddOpen(nextOpen); if (!nextOpen) { setPendingLanguage(null); setLanguageQuery(""); } }}>
        <DialogContent className="pointer-events-auto max-w-[520px]">
          <DialogHeader><DialogTitle>Добавить язык</DialogTitle><DialogDescription>{pendingLanguage ? `Вы выбрали ${getLanguage(pendingLanguage).label}` : "Выберите язык для гостевого контента"}</DialogDescription></DialogHeader>
          {!pendingLanguage ? (
            <div>
              <div className="relative"><MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} /><Input autoFocus aria-label="Поиск языка" value={languageQuery} onChange={(event) => setLanguageQuery(event.target.value)} placeholder="Найти язык" className="pl-9" /></div>
              <div className="mt-2 max-h-60 overflow-y-auto rounded-[9px] border border-stone-200 p-1">
                {availableLanguages.map((language) => <Button key={language.code} type="button" variant="ghost" onClick={() => setPendingLanguage(language.code)} className="h-10 w-full justify-between rounded-[7px] px-3 text-left text-[13px] font-normal"><span>{language.label}</span><span className="text-[11px] text-stone-400">{LOCALES[language.code]}</span></Button>)}
                {availableLanguages.length === 0 && <div className="px-3 py-7 text-center text-[12px] text-stone-500">Языки не найдены</div>}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-[13px] leading-5 text-stone-600">Мы автоматически переведём существующий контент на выбранный язык. Новые и изменённые тексты также будут переводиться автоматически. Перевод может занять несколько минут и продолжится, даже если закрыть админку.</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button type="button" aria-label="Перевести для проверки" variant="outline" className="h-auto min-h-16 items-start justify-start whitespace-normal px-3 py-2.5 text-left" onClick={() => finishAdd(false)}><span><span className="block text-[13px] font-semibold">Перевести для проверки</span><span className="mt-1 block text-[11px] font-normal leading-4 text-stone-500">Опубликовать позже после проверки</span></span></Button>
                <Button type="button" aria-label="Перевести и опубликовать" className="h-auto min-h-16 items-start justify-start whitespace-normal bg-[#4f39f6] px-3 py-2.5 text-left hover:bg-[#4030d4]" onClick={() => finishAdd(true)}><span><span className="block text-[13px] font-semibold">Перевести и опубликовать</span><span className="mt-1 block text-[11px] font-normal leading-4 text-white/75">Открыть гостям после завершения</span></span></Button>
              </div>
            </div>
          )}
          <DialogFooter>{pendingLanguage && <Button variant="ghost" size="sm" onClick={() => setPendingLanguage(null)}>Назад</Button>}<DialogClose asChild><Button variant="outline" size="sm">Отмена</Button></DialogClose></DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={dialog?.type === "primary"} onOpenChange={(nextOpen) => !nextOpen && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader><AlertDialogTitle>Сделать {dialogLanguage?.label} основным языком?</AlertDialogTitle><AlertDialogDescription>Этот язык станет исходным для последующих автоматических переводов.</AlertDialogDescription></AlertDialogHeader>
          <AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => { if (dialog?.type === "primary") setPrimaryLanguage(dialog.language); setDialog(null); }}>Сделать основным</AlertDialogAction></AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={dialog?.type === "delete"} onOpenChange={(nextOpen) => !nextOpen && setDialog(null)}>
        <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Удалить {dialogLanguage?.label}?</AlertDialogTitle><AlertDialogDescription>Переводы этого языка будут удалены.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => { if (dialog?.type === "delete") removeLanguage(dialog.language); setDialog(null); }}>Удалить язык</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TranslationLeftPanel({ language }: { language: TranslationLanguageCode }) {
  const { activeCategory, activeMaterialId, materials, setActiveCategory, setActiveMaterialId } = useTranslations();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<TranslationFilter>("all");
  const categoryMaterials = useMemo(() => materials.filter((material) => material.category === activeCategory), [activeCategory, materials]);
  const filtered = useMemo(() => categoryMaterials.filter((material) => {
    const status = material.statuses[language];
    if (filter === "missing" && status !== "missing") return false;
    if (filter === "translated" && status === "missing") return false;
    return material.title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
  }), [categoryMaterials, filter, language, query]);
  const category = CATEGORY_META.find((item) => item.id === activeCategory) ?? CATEGORY_META[0];

  useEffect(() => {
    if (activeMaterialId && filtered.some((material) => material.id === activeMaterialId)) return;
    setActiveMaterialId(filtered[0]?.id ?? null);
  }, [activeMaterialId, filtered, setActiveMaterialId]);

  return (
    <aside className="flex min-h-0 w-[292px] shrink-0 flex-col border-r border-[#e7e5e4] bg-white">
      <div className="space-y-1.5 border-b border-[#e7e5e4] p-2.5">
        <Select value={activeCategory} onValueChange={(value) => setActiveCategory(value as TranslationCategory)}>
          <SelectTrigger className="h-8 w-full border-[#e7e5e4] text-[13px] font-medium shadow-none"><span className="min-w-0 truncate">{category.label}<span className="font-normal tabular-nums text-stone-400"> · {categoryMaterials.length}</span></span></SelectTrigger>
          <SelectContent>
            <SelectGroup>{CATEGORY_META.filter((item) => item.group === "main").map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectGroup>
            <SelectGroup><div className="mt-1 border-t border-stone-100 px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-stone-400">Каталог</div>{CATEGORY_META.filter((item) => item.group === "catalog").map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectGroup>
            <SelectGroup><div className="mt-1 border-t border-stone-100 px-2 pb-1 pt-2 text-[10px] font-medium uppercase tracking-wide text-stone-400">Остальной контент</div>{CATEGORY_META.filter((item) => item.group === "other").map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectGroup>
          </SelectContent>
        </Select>
        <div className="flex items-center gap-1.5">
          <div className="relative min-w-0 flex-1"><MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" /><Input size="compact" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск" className="pl-8" /></div>
          <DropdownMenu>
            <Tooltip label={`Фильтр: ${FILTER_LABELS[filter]}`} side="top"><DropdownMenuTrigger asChild><Button type="button" variant="ghost" size="icon" aria-label={`Фильтр: ${FILTER_LABELS[filter]}`} className={cn("relative size-[30px] shrink-0 rounded-[8px] border border-[#e7e5e4] text-stone-500 hover:bg-stone-50", filter !== "all" && "border-indigo-200 bg-indigo-50/60 text-indigo-700")}><FunnelSimple size={14} /></Button></DropdownMenuTrigger></Tooltip>
            <DropdownMenuContent align="end" className="w-48">{(Object.keys(FILTER_LABELS) as TranslationFilter[]).map((value) => <DropdownMenuItem key={value} onSelect={() => setFilter(value)}><span className="flex size-4 items-center justify-center">{filter === value && <Check size={12} weight="bold" />}</span>{FILTER_LABELS[value]}</DropdownMenuItem>)}</DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {filtered.map((material) => <Button key={material.id} type="button" variant="ghost" onClick={() => setActiveMaterialId(material.id)} className={cn("h-[42px] w-full justify-start rounded-none border-b border-stone-100/80 px-3 text-left text-[13px] font-normal text-[#292524] hover:bg-[#fafaf9]", activeMaterialId === material.id && "bg-[#f4f3ff] font-medium hover:bg-[#f4f3ff]")}><span className="min-w-0 flex-1 truncate">{material.title}</span>{material.statuses[language] === "missing" && <span aria-label="Не переведено" className="size-1.5 rounded-full bg-stone-300" />}</Button>)}
        {filtered.length === 0 && <div className="px-5 py-12 text-center text-[12px] text-stone-500">Материалы не найдены</div>}
      </div>
    </aside>
  );
}

function TranslationEditor({ language, onOpenOriginal }: { language: TranslationLanguageCode; onOpenOriginal: (material: TranslationMaterial) => void }) {
  const { activeMaterialId, autoTranslateField, materials, saveState, updateField } = useTranslations();
  const { account } = useMockAuth();
  const material = materials.find((item) => item.id === activeMaterialId) ?? null;
  if (!material) return <div className="grid min-w-0 flex-1 place-items-center bg-white text-[12px] text-stone-500">Выберите материал слева</div>;
  const primaryCode = account?.workspace.primaryLanguage ?? "ru";
  return (
    <section className="flex min-w-[520px] flex-1 flex-col overflow-hidden bg-white">
      <div className="flex h-[50px] shrink-0 items-center justify-between gap-4 border-b border-[#e7e5e4] px-4">
        <div className="min-w-0 truncate text-[15px] font-semibold text-[#292524]">{material.title}</div>
        <div className="flex shrink-0 items-center gap-2">{saveState !== "idle" && <span className="text-[11px] text-stone-500">{saveState === "saving" ? "Сохранение…" : saveState === "saved" ? "Сохранено" : "Ошибка сохранения"}</span>}<Button size="sm" variant="ghost" className="h-7 px-2 text-[11px] font-medium text-stone-500 hover:text-stone-900" onClick={() => onOpenOriginal(material)}>Открыть оригинал<ArrowSquareOut size={12} /></Button></div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="grid h-9 grid-cols-[128px_minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] font-medium text-stone-500"><div className="px-3">Поле</div><div className="px-3">{getLanguage(primaryCode).label} — основной</div><div className="border-l border-[#e7e5e4] px-3">{getLanguage(language).label}</div></div>
        {material.fields.map((field, index) => {
          const hasSource = Boolean(field.source.trim());
          const multiline = field.id === "description" || field.source.length > 90;
          const showOptionsHeader = field.kind === "option-group" && !material.fields.slice(0, index).some((candidate) => candidate.kind === "option-group");
          const editor = multiline ? (
            <Textarea value={hasSource ? field.values[language] ?? "" : ""} disabled={!hasSource} onChange={(event) => updateField(material.id, field.id, language, event.target.value)} placeholder={hasSource ? "Введите перевод" : "Не заполнено в оригинале"} className="h-[68px] min-h-[68px] resize-none rounded-[6px] border-[#e7e5e4] px-2 py-1.5 text-[13px] leading-5 shadow-none disabled:bg-stone-50 disabled:opacity-100" />
          ) : (
            <Input value={hasSource ? field.values[language] ?? "" : ""} disabled={!hasSource} onChange={(event) => updateField(material.id, field.id, language, event.target.value)} placeholder={hasSource ? "Введите перевод" : "Не заполнено в оригинале"} className="h-9 rounded-[6px] border-[#e7e5e4] px-2 text-[13px] shadow-none disabled:bg-stone-50 disabled:opacity-100" />
          );
          return (
            <Fragment key={field.id}>
              {showOptionsHeader && <div className="grid h-8 grid-cols-[128px_minmax(0,1fr)_minmax(0,1fr)] items-center border-b border-[#e7e5e4] bg-stone-50/80 text-[10px] font-semibold uppercase tracking-[0.06em] text-stone-400"><div className="px-3">Опции</div><div /><div className="border-l border-[#e7e5e4]" /></div>}
              <div className={cn("grid min-h-[70px] grid-cols-[128px_minmax(0,1fr)_minmax(0,1fr)] border-b border-[#e7e5e4]", field.kind === "option-group" && "bg-stone-50/50")}>
                <div className={cn("px-3 py-3 text-[11px] font-medium text-stone-400", field.kind === "option" && "pl-6 font-normal")}>{field.label}</div>
                <div className="bg-[#fafaf9]/45 px-3 py-3 text-[13px] leading-5 text-stone-600">{hasSource ? field.source : <span className="text-stone-400">Не заполнено в оригинале</span>}</div>
                <div className="border-l border-[#e7e5e4] px-2 py-2"><div className="mb-1 flex justify-end"><Button type="button" variant="ghost" aria-label="Автоперевести" disabled={!hasSource} onClick={() => autoTranslateField(material.id, field.id, language)} className="h-6 rounded-[6px] px-1.5 text-[11px] font-medium text-indigo-600 hover:bg-indigo-50 disabled:hidden"><Sparkle size={12} />Автоперевести</Button></div>{editor}</div>
              </div>
            </Fragment>
          );
        })}
      </div>
    </section>
  );
}

function LanguageWorkspace({ onBack, onOpenOriginal }: { onBack: () => void; onOpenOriginal: (material: TranslationMaterial) => void }) {
  const { account } = useMockAuth();
  const { activeLanguage, jobs, languages, setActiveLanguage } = useTranslations();
  const availableLanguages = languages.filter(({ code }) => code !== account?.workspace.primaryLanguage);
  const language = availableLanguages.find((item) => item.code === activeLanguage) ?? availableLanguages[0];
  useEffect(() => { if (language && language.code !== activeLanguage) setActiveLanguage(language.code); }, [activeLanguage, language, setActiveLanguage]);
  if (!language) return null;
  const activeJob = jobs.find((job) => job.language === language.code && (job.status === "queued" || job.status === "running"));
  const jobProgress = activeJob ? Math.round((activeJob.completed / Math.max(1, activeJob.total)) * 100) : 0;
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-white">
      <header className="flex h-[58px] shrink-0 items-center gap-3 border-b border-[#e7e5e4] bg-white px-4">
        <Button type="button" variant="ghost" onClick={onBack} className="h-7 shrink-0 gap-1 rounded-[7px] px-1.5 text-[11px] font-normal text-stone-500 hover:bg-stone-50 hover:text-stone-900"><ArrowLeft size={12} />Переводы</Button>
        <span className="h-7 w-px bg-stone-200" />
        <div className="flex items-center gap-1 text-[14px] font-semibold text-stone-800"><span>{getLanguage(account?.workspace.primaryLanguage ?? "ru").label}</span><span className="text-stone-300">→</span><Select value={language.code} onValueChange={(value) => setActiveLanguage(value as TranslationLanguageCode)}><SelectTrigger className="h-7 w-[140px] border-0 px-1.5 text-[14px] font-semibold shadow-none"><SelectValue /></SelectTrigger><SelectContent>{availableLanguages.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent></Select></div>
      </header>
      {activeJob && <div className="relative flex h-10 shrink-0 items-center gap-2 overflow-hidden border-b border-indigo-100 bg-indigo-50/60 px-4 text-[11px] text-indigo-800"><SpinnerGap size={14} className="animate-spin" /><span className="font-medium">Переводим… {jobProgress}%</span><span className="text-indigo-600">Можно закрыть админку — процесс продолжится в фоне.</span><div className="absolute inset-x-0 bottom-0 h-0.5 bg-indigo-100"><div className="h-full bg-indigo-500 transition-[width]" style={{ width: `${jobProgress}%` }} /></div></div>}
      <div className="flex min-h-0 flex-1"><TranslationLeftPanel language={language.code} /><TranslationEditor language={language.code} onOpenOriginal={onOpenOriginal} /></div>
    </div>
  );
}

export function TranslationsWorkspace({ onOpenOriginal }: TranslationWorkspaceProps) {
  const { activeLanguage, consumeWorkspaceRequest, languages, workspaceRequested } = useTranslations();
  const [view, setView] = useState<"overview" | "workspace">(() => workspaceRequested ? "workspace" : "overview");
  useEffect(() => {
    if (workspaceRequested) consumeWorkspaceRequest();
    const open = () => { setView("workspace"); consumeWorkspaceRequest(); };
    window.addEventListener("tasko:open-translations", open);
    return () => window.removeEventListener("tasko:open-translations", open);
  }, [consumeWorkspaceRequest, workspaceRequested]);
  if (view === "workspace" && languages.some((item) => item.code === activeLanguage)) return <LanguageWorkspace onBack={() => setView("overview")} onOpenOriginal={onOpenOriginal} />;
  return <LanguagesOverview />;
}

export function TranslationOverlays() {
  const { catalogBulkRequest, closeCatalogBulk, dismissToast, languages, materials, openWorkspace, startAutoTranslate, toast } = useTranslations();
  const [selectedLanguages, setSelectedLanguages] = useState<Set<TranslationLanguageCode>>(new Set());
  const selectedMaterials = materials.filter((material) => material.kind === "position" && material.catalogItemId && catalogBulkRequest?.includes(material.catalogItemId));
  return (
    <>
      <AlertDialog open={catalogBulkRequest !== null} onOpenChange={(nextOpen) => !nextOpen && closeCatalogBulk()}>
        <AlertDialogContent className="max-w-[500px]"><AlertDialogHeader><AlertDialogTitle>Перевести выбранные позиции</AlertDialogTitle><AlertDialogDescription>{catalogBulkRequest?.length ?? 0} позиций. Выберите целевые языки.</AlertDialogDescription></AlertDialogHeader><div className="grid grid-cols-2 gap-2">{languages.map((language) => <label key={language.code} className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-stone-200 p-2.5 text-[12px]"><Checkbox checked={selectedLanguages.has(language.code)} onCheckedChange={(checked) => setSelectedLanguages((current) => { const next = new Set(current); if (checked) next.add(language.code); else next.delete(language.code); return next; })} />{language.label}</label>)}</div><AlertDialogFooter><AlertDialogCancel>Отмена</AlertDialogCancel><AlertDialogAction disabled={selectedLanguages.size === 0} className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => { selectedLanguages.forEach((language) => startAutoTranslate([language], selectedMaterials.map((material) => material.id), "Выбранные позиции")); closeCatalogBulk(); }}>Перевести</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
      </AlertDialog>
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[100050] flex -translate-x-1/2 items-center gap-3 rounded-[10px] bg-stone-900 px-3.5 py-2.5 text-[12px] font-medium text-white shadow-xl"><span>{toast.message}</span>{toast.actionLabel && <Button type="button" variant="ghost" onClick={() => { if (toast.onAction) toast.onAction(); else openWorkspace(); dismissToast(); }} className="h-auto p-0 font-semibold text-indigo-200 hover:bg-transparent hover:text-white">{toast.actionLabel}</Button>}<Button type="button" variant="ghost" size="icon" aria-label="Закрыть" onClick={dismissToast} className="size-6 text-white/60 hover:bg-white/10 hover:text-white"><X size={14} /></Button></div>}
    </>
  );
}
