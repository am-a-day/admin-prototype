import { Fragment, useEffect, useMemo, useState } from "react";
import {
  ArrowClockwise,
  ArrowRight,
  ArrowSquareOut,
  Check,
  DotsThree,
  FunnelSimple,
  MagnifyingGlass,
  Plus,
  Sparkle,
  SpinnerGap,
  Trash,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  type TranslationField,
  type TranslationFilter,
  type TranslationJob,
  type TranslationLanguage,
  type TranslationLanguageCode,
  type TranslationMaterial,
} from "@/contexts/translations-context";
import { getLanguage, LANGUAGES } from "@/data/languages";
import { cn } from "@/lib/utils";

type TranslationWorkspaceProps = {
  onOpenOriginal: (material: TranslationMaterial) => void;
};

type ContentView = "about" | "catalog" | "banners" | "interface" | "other";

const CONTENT_VIEWS: Array<{ id: ContentView; label: string }> = [
  { id: "about", label: "О заведении" },
  { id: "catalog", label: "Позиции и разделы" },
  { id: "banners", label: "Баннеры" },
  { id: "interface", label: "Заголовки и кнопки" },
  { id: "other", label: "Другой контент" },
];

const FILTER_LABELS: Record<TranslationFilter, string> = {
  all: "Все",
  review: "На проверку",
  missing: "Не переведено",
};

function contentViewForCategory(category: TranslationCategory): ContentView {
  if (category === "positions" || category === "sections") return "catalog";
  if (category === "tags" || category === "stickers") return "other";
  return category;
}

function materialMatchesView(material: TranslationMaterial, view: ContentView) {
  if (view === "catalog") return material.category === "positions" || material.category === "sections";
  if (view === "other") return material.category === "tags" || material.category === "stickers";
  return material.category === view;
}

function latestLanguageJob(jobs: TranslationJob[], language: TranslationLanguageCode) {
  return jobs
    .filter((job) => job.language === language)
    .sort((left, right) => right.startedAt - left.startedAt)[0] ?? null;
}

function AddLanguageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { account } = useMockAuth();
  const { addLanguage, languages } = useTranslations();
  const [query, setQuery] = useState("");
  const primaryLanguage = account?.workspace.primaryLanguage ?? "ru";
  const availableLanguages = LANGUAGES.filter((language) => {
    if (language.code === primaryLanguage || languages.some((item) => item.code === language.code)) return false;
    const normalizedQuery = query.trim().toLocaleLowerCase();
    return !normalizedQuery || [language.code, language.label, language.short]
      .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
  });

  const chooseLanguage = (language: TranslationLanguageCode) => {
    addLanguage(language, true);
    setQuery("");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => {
      onOpenChange(nextOpen);
      if (!nextOpen) setQuery("");
    }}>
      <DialogContent className="pointer-events-auto max-w-[460px]">
        <DialogHeader>
          <DialogTitle>Добавить язык</DialogTitle>
          <DialogDescription>Перевод начнётся сразу после выбора языка.</DialogDescription>
        </DialogHeader>
        <div>
          <div className="relative">
            <MagnifyingGlass className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" size={15} />
            <Input
              autoFocus
              aria-label="Поиск языка"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти язык"
              className="pl-9"
            />
          </div>
          <div className="mt-2 max-h-64 overflow-y-auto rounded-[9px] border border-stone-200 p-1">
            {availableLanguages.map((language) => (
              <Button
                key={language.code}
                type="button"
                variant="ghost"
                onClick={() => chooseLanguage(language.code)}
                className="h-10 w-full justify-between rounded-[7px] px-3 text-left text-[13px] font-normal"
              >
                <span>{language.label}</span>
                <span className="text-[11px] text-stone-400">{language.short}</span>
              </Button>
            ))}
            {availableLanguages.length === 0 && (
              <div className="px-3 py-7 text-center text-[12px] text-stone-500">Языки не найдены</div>
            )}
          </div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" size="sm">Отмена</Button></DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FirstUseScreen() {
  const { confirmPrimaryLanguage, suggestedPrimaryLanguage } = useTranslations();
  const [language, setLanguage] = useState<TranslationLanguageCode>(suggestedPrimaryLanguage);

  useEffect(() => setLanguage(suggestedPrimaryLanguage), [suggestedPrimaryLanguage]);

  return (
    <div className="grid min-h-0 flex-1 place-items-center overflow-y-auto bg-[#fbfbf9] px-6 py-10">
      <section className="w-full max-w-[430px]" aria-labelledby="primary-language-title">
        <div className="text-[12px] font-medium text-indigo-600">Первый вход</div>
        <h1 id="primary-language-title" className="mt-2 text-[22px] font-semibold tracking-[-0.02em] text-stone-950">
          Основной язык контента
        </h1>
        <p className="mt-2 text-[13px] leading-5 text-stone-500">
          На этом языке заполнен ваш ресторан. Он будет использоваться как исходный для переводов.
        </p>
        <label className="mt-6 block text-[12px] font-medium text-stone-700">
          Язык
          <Select value={language} onValueChange={(value) => setLanguage(value as TranslationLanguageCode)}>
            <SelectTrigger aria-label="Основной язык контента" className="mt-1.5 h-10 w-full bg-white shadow-none">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {LANGUAGES.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </label>
        <Button
          type="button"
          className="mt-4 h-9 bg-[#4f39f6] px-4 hover:bg-[#4030d4]"
          onClick={() => confirmPrimaryLanguage(language)}
        >
          Подтвердить
        </Button>
      </section>
    </div>
  );
}

function PrimaryLanguageDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { account } = useMockAuth();
  const { languages, setPrimaryLanguage } = useTranslations();
  const primaryLanguage = account?.workspace.primaryLanguage ?? "ru";
  const [language, setLanguage] = useState<TranslationLanguageCode>(primaryLanguage);
  const availablePrimaryLanguages = languages.length === 0
    ? LANGUAGES
    : LANGUAGES.filter((item) =>
        item.code === primaryLanguage || languages.some((languageItem) => languageItem.code === item.code));

  useEffect(() => {
    if (open) setLanguage(primaryLanguage);
  }, [open, primaryLanguage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="pointer-events-auto max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Изменить основной язык</DialogTitle>
          <DialogDescription>Он станет исходным языком для новых и обновлённых переводов.</DialogDescription>
        </DialogHeader>
        <Select value={language} onValueChange={(value) => setLanguage(value as TranslationLanguageCode)}>
          <SelectTrigger aria-label="Новый основной язык" className="h-9 shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent className="z-[100022]">{availablePrimaryLanguages.map((item) => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
        {languages.length > 0 && language !== primaryLanguage && (
          <div className="flex gap-2 rounded-[9px] bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-900">
            <WarningCircle size={16} className="mt-0.5 shrink-0" />
            Смена исходного языка повлияет на все существующие переводы. Тексты не удалятся, но их направление изменится.
          </div>
        )}
        <DialogFooter>
          <DialogClose asChild><Button variant="outline" size="sm">Отмена</Button></DialogClose>
          <Button
            type="button"
            size="sm"
            disabled={language === primaryLanguage}
            className="bg-[#4f39f6] hover:bg-[#4030d4]"
            onClick={() => {
              setPrimaryLanguage(language);
              onOpenChange(false);
            }}
          >
            Изменить язык
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function WorkspaceHeading({ onChangePrimary }: { onChangePrimary: () => void }) {
  const { account } = useMockAuth();
  const primary = getLanguage(account?.workspace.primaryLanguage ?? "ru");
  return (
    <div className="border-b border-[#e7e5e4] px-3 py-3">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-[17px] font-semibold tracking-[-0.01em] text-stone-950">Переводы</h1>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="ghost" size="icon" aria-label="Настройки переводов" className="size-7 rounded-[7px] text-stone-500">
              <DotsThree size={16} weight="bold" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuItem onSelect={() => window.setTimeout(onChangePrimary, 0)}>Изменить основной язык</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="mt-1 text-[11px] text-stone-500">Основной язык: <span className="font-medium text-stone-700">{primary.label}</span></div>
    </div>
  );
}

type LanguageDialog = { type: "draft" | "delete"; language: TranslationLanguageCode } | null;

function LanguageRail({ onAddLanguage }: { onAddLanguage: () => void }) {
  const {
    activeLanguage,
    jobs,
    languages,
    removeLanguage,
    setActiveLanguage,
    setPublished,
  } = useTranslations();
  const [dialog, setDialog] = useState<LanguageDialog>(null);
  const [primaryOpen, setPrimaryOpen] = useState(false);
  const dialogLanguage = dialog ? languages.find((language) => language.code === dialog.language) : null;

  return (
    <aside className="flex min-h-0 w-[224px] shrink-0 flex-col border-r border-[#e7e5e4] bg-white">
      <WorkspaceHeading onChangePrimary={() => setPrimaryOpen(true)} />
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        {languages.map((language) => {
          const latestJob = latestLanguageJob(jobs, language.code);
          const translating = latestJob?.status === "queued" || latestJob?.status === "running";
          const failed = latestJob?.status === "error";
          return (
            <div
              key={language.code}
              className={cn(
                "group mb-0.5 flex min-h-10 items-center rounded-[8px] pr-1 transition-colors",
                activeLanguage === language.code ? "bg-indigo-50" : "hover:bg-[#fafaf9]",
              )}
            >
              <Button
                type="button"
                variant="ghost"
                onClick={() => setActiveLanguage(language.code)}
                className="h-auto min-w-0 flex-1 flex-col items-start gap-0 rounded-[8px] bg-transparent px-2 py-1.5 text-left font-normal whitespace-normal hover:bg-transparent focus-visible:ring-inset focus-visible:ring-indigo-300"
              >
                <span className={cn("block truncate text-[13px] text-stone-800", activeLanguage === language.code && "font-medium text-indigo-950")}>{language.label}</span>
                {(translating || failed || !language.published) && (
                  <span className={cn("mt-0.5 block truncate text-[10px] text-stone-400", failed && "text-rose-600", translating && "text-indigo-600")}>
                    {translating ? "Переводим…" : failed ? "Не удалось перевести" : "Черновик"}
                  </span>
                )}
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon" aria-label={`Действия для ${language.label}`} className="size-7 shrink-0 rounded-[7px] text-stone-400 opacity-0 group-hover:opacity-100 data-[state=open]:opacity-100 focus-visible:opacity-100">
                    <DotsThree size={15} weight="bold" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" side="right" className="w-52">
                  {language.published ? (
                    <DropdownMenuItem onSelect={() => setDialog({ type: "draft", language: language.code })}>Сделать черновиком</DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onSelect={() => setPublished(language.code, true)}>Опубликовать</DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-red-600 focus:text-red-700" onSelect={() => setDialog({ type: "delete", language: language.code })}>
                    <Trash size={15} />Удалить язык
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
      <div className="border-t border-[#e7e5e4] p-2">
        <Button type="button" variant="ghost" onClick={onAddLanguage} className="h-8 w-full justify-start rounded-[8px] px-2 text-[12px] font-medium text-indigo-600 hover:bg-indigo-50">
          <Plus size={14} weight="bold" />Добавить язык
        </Button>
      </div>

      <PrimaryLanguageDialog open={primaryOpen} onOpenChange={setPrimaryOpen} />
      <AlertDialog open={dialog?.type === "draft"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Сделать {dialogLanguage?.label} черновиком?</AlertDialogTitle>
            <AlertDialogDescription>Язык исчезнет из гостевого онлайн-меню. Существующие переводы сохранятся, и вы сможете продолжить работу с ними.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => {
              if (dialog?.type === "draft") setPublished(dialog.language, false);
              setDialog(null);
            }}>Сделать черновиком</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={dialog?.type === "delete"} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить {dialogLanguage?.label}?</AlertDialogTitle>
            <AlertDialogDescription>Переводы этого языка будут удалены. Это действие нельзя отменить.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction className="bg-red-600 hover:bg-red-700" onClick={() => {
              if (dialog?.type === "delete") removeLanguage(dialog.language);
              setDialog(null);
            }}>Удалить язык</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </aside>
  );
}

function TranslationJobNotice({ job, language }: { job: TranslationJob; language: TranslationLanguage }) {
  const { retryTranslationJob, setJobPublishAfterComplete } = useTranslations();
  if (job.status === "error") {
    return (
      <div className="flex shrink-0 items-center gap-3 border-b border-rose-100 bg-rose-50/70 px-4 py-3 text-rose-950">
        <WarningCircle size={17} className="shrink-0 text-rose-600" />
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-semibold">Не удалось перевести часть текстов</div>
          <div className="mt-0.5 text-[11px] leading-4 text-rose-700">Повторим только элементы из этого задания.</div>
        </div>
        <Button type="button" size="sm" variant="outline" onClick={() => retryTranslationJob(job.id)} className="h-7 bg-white px-2.5 text-[11px]">
          <ArrowClockwise size={13} />Повторить
        </Button>
      </div>
    );
  }
  if (job.status !== "queued" && job.status !== "running") return null;
  const publishAfterComplete = job.publicationMode === "publish" || job.publishAfterComplete === true;
  return (
    <div className="shrink-0 border-b border-indigo-100 bg-indigo-50/65 px-4 py-3">
      <div className="flex gap-2.5">
        <SpinnerGap size={17} className="mt-0.5 shrink-0 animate-spin text-indigo-600" />
        <div className="min-w-0">
          <div className="text-[12px] font-semibold text-indigo-950">Переводим на {language.label}</div>
          <p className="mt-0.5 text-[11px] leading-4 text-indigo-700">Можно закрыть админку — перевод продолжится в фоне. Новые и изменённые тексты также будут переводиться автоматически.</p>
          <label className="mt-2 flex cursor-pointer items-center gap-2 text-[11px] font-medium text-indigo-950">
            <Checkbox
              checked={publishAfterComplete}
              onCheckedChange={(checked) => setJobPublishAfterComplete(job.id, checked === true)}
              className="border-indigo-300 data-[state=checked]:border-indigo-600 data-[state=checked]:bg-indigo-600"
            />
            Опубликовать после завершения перевода
          </label>
        </div>
      </div>
    </div>
  );
}

function fieldMatchesFilter(field: TranslationField, language: TranslationLanguageCode, filter: TranslationFilter) {
  if (filter === "review") return field.reviewLanguages?.includes(language) ?? false;
  if (filter === "missing") return Boolean(field.source.trim()) && !field.values[language]?.trim();
  return true;
}

function TranslationFieldRow({
  field,
  language,
  material,
}: {
  field: TranslationField;
  language: TranslationLanguageCode;
  material: TranslationMaterial;
}) {
  const { autoTranslateField, confirmField, updateField } = useTranslations();
  const sourceFilled = Boolean(field.source.trim());
  const targetValue = sourceFilled ? field.values[language] ?? "" : "";
  const needsReview = field.reviewLanguages?.includes(language) ?? false;
  const missing = sourceFilled && !targetValue.trim();
  const machineTranslated = Boolean(targetValue.trim()) && (field.machineTranslatedLanguages?.includes(language) ?? false);
  const multiline = field.id === "description" || field.source.length > 90 || targetValue.length > 90;
  const editorClassName = "rounded-[7px] border-[#e7e5e4] bg-white px-2.5 text-[13px] leading-5 shadow-none focus-visible:border-indigo-300 focus-visible:ring-indigo-100 disabled:bg-stone-50 disabled:opacity-100";

  return (
    <div className={cn("grid grid-cols-2 border-b border-[#e7e5e4] last:border-b-0", field.kind === "option-group" && "bg-stone-50/45")}>
      <div className="min-w-0 px-4 py-3">
        <div className={cn("text-[10px] font-medium text-stone-400", field.kind === "option" && "pl-3")}>{field.label}</div>
        <div className={cn("mt-1 whitespace-pre-wrap text-[13px] leading-5 text-stone-700", field.kind === "option" && "pl-3")}>
          {sourceFilled ? field.source : <span className="text-stone-400">Не заполнено в оригинале</span>}
        </div>
      </div>
      <div className="min-w-0 border-l border-[#e7e5e4] px-3 py-2.5">
        <div className="mb-1.5 flex min-h-6 items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {needsReview && (
              <Tooltip label="Оригинал изменился, перевод автоматически обновлён, но желательно проверить результат." side="top">
                <Badge tabIndex={0} variant="secondary" className="border-0 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-800">На проверку</Badge>
              </Tooltip>
            )}
            {missing && <span className="text-[10px] font-medium text-stone-400">Не переведено</span>}
            {machineTranslated && (
              <Tooltip label="Переведено автоматически" side="top">
                <span tabIndex={0} role="img" aria-label={`Переведено автоматически: ${field.label}`} className="flex size-5 items-center justify-center rounded-[5px] text-indigo-500 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-200">
                  <Sparkle size={12} weight="fill" />
                </span>
              </Tooltip>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            {needsReview && (
              <Button type="button" variant="ghost" onClick={() => confirmField(material.id, field.id, language)} className="h-6 rounded-[6px] px-1.5 text-[10px] font-medium text-stone-600 hover:bg-stone-100">
                <Check size={12} weight="bold" />Проверено
              </Button>
            )}
            <Tooltip label="Автоперевести только это поле" side="top">
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={`Автоперевести: ${field.label}`}
                disabled={!sourceFilled}
                onClick={() => autoTranslateField(material.id, field.id, language)}
                className="size-6 rounded-[6px] text-stone-400 hover:bg-indigo-50 hover:text-indigo-600 disabled:hidden"
              >
                <Sparkle size={12} />
              </Button>
            </Tooltip>
          </div>
        </div>
        {multiline ? (
          <Textarea
            value={targetValue}
            disabled={!sourceFilled}
            onChange={(event) => updateField(material.id, field.id, language, event.target.value)}
            placeholder={sourceFilled ? "Введите перевод" : "Не заполнено в оригинале"}
            className={cn("h-[72px] min-h-[72px] resize-y py-1.5", editorClassName)}
          />
        ) : (
          <Input
            value={targetValue}
            disabled={!sourceFilled}
            onChange={(event) => updateField(material.id, field.id, language, event.target.value)}
            placeholder={sourceFilled ? "Введите перевод" : "Не заполнено в оригинале"}
            className={cn("h-8", editorClassName)}
          />
        )}
      </div>
    </div>
  );
}

function TranslationContent({ language, onOpenOriginal }: { language: TranslationLanguage; onOpenOriginal: (material: TranslationMaterial) => void }) {
  const { account } = useMockAuth();
  const {
    activeCategory,
    activeMaterialId,
    jobs,
    materials,
    saveState,
    setActiveCategory,
  } = useTranslations();
  const [view, setView] = useState<ContentView>(() => contentViewForCategory(activeCategory));
  const [filter, setFilter] = useState<TranslationFilter>("all");
  const [query, setQuery] = useState("");
  const [visibleLimit, setVisibleLimit] = useState(12);
  const primary = getLanguage(account?.workspace.primaryLanguage ?? "ru");
  const latestJob = latestLanguageJob(jobs, language.code);

  useEffect(() => setView(contentViewForCategory(activeCategory)), [activeCategory]);
  useEffect(() => setVisibleLimit(12), [filter, query]);
  useEffect(() => {
    if (!activeMaterialId) return;
    setFilter("all");
    setQuery("");
    setVisibleLimit(12);
  }, [activeMaterialId]);

  const visibleMaterials = useMemo(() => {
    const matching = materials
      .filter((material) => materialMatchesView(material, view))
      .map((material) => ({
        ...material,
        fields: material.fields.filter((field) => {
          if (!fieldMatchesFilter(field, language.code, filter)) return false;
          if (filter === "all" && view !== "about" && !field.source.trim()) return false;
          const normalizedQuery = query.trim().toLocaleLowerCase();
          return !normalizedQuery || [material.title, field.label, field.source, field.values[language.code] ?? ""]
            .some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
        }),
      }))
      .filter((material) => material.fields.length > 0);
    if (!activeMaterialId) return matching;
    return matching.sort((left, right) => Number(right.id === activeMaterialId) - Number(left.id === activeMaterialId));
  }, [activeMaterialId, filter, language.code, materials, query, view]);

  const changeView = (nextView: ContentView) => {
    setView(nextView);
    setVisibleLimit(12);
    const category: TranslationCategory = nextView === "catalog"
      ? "positions"
      : nextView === "other"
        ? "tags"
        : nextView;
    setActiveCategory(category);
  };

  return (
    <main className="flex min-h-0 min-w-0 flex-1 flex-col bg-white">
      <div className="flex h-[52px] shrink-0 items-center justify-between gap-4 border-b border-[#e7e5e4] px-4">
        <div className="flex min-w-0 items-center gap-2 text-[14px] font-semibold text-stone-800">
          <span className="truncate">{primary.label}</span>
          <ArrowRight size={14} className="shrink-0 text-stone-300" />
          <span className="truncate">{language.label}</span>
        </div>
        {saveState !== "idle" && (
          <span className="shrink-0 text-[11px] text-stone-500">
            {saveState === "saving" ? "Сохранение…" : saveState === "saved" ? "Сохранено" : "Ошибка сохранения"}
          </span>
        )}
      </div>
      {latestJob && <TranslationJobNotice job={latestJob} language={language} />}
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-[#e7e5e4] px-3 py-2">
        <Select value={view} onValueChange={(value) => changeView(value as ContentView)}>
          <SelectTrigger aria-label="Раздел контента" className="h-8 w-[210px] border-[#e7e5e4] text-[12px] font-medium shadow-none"><SelectValue /></SelectTrigger>
          <SelectContent>{CONTENT_VIEWS.map((item) => <SelectItem key={item.id} value={item.id}>{item.label}</SelectItem>)}</SelectContent>
        </Select>
        <div className="relative min-w-[180px] flex-1">
          <MagnifyingGlass size={14} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-stone-400" />
          <Input size="compact" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти текст" className="pl-8" />
        </div>
        <DropdownMenu>
          <Tooltip label={`Фильтр: ${FILTER_LABELS[filter]}`} side="top">
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="ghost" size="icon" aria-label={`Фильтр: ${FILTER_LABELS[filter]}`} className={cn("size-[30px] rounded-[8px] border border-[#e7e5e4] text-stone-500", filter !== "all" && "border-indigo-200 bg-indigo-50 text-indigo-700")}>
                <FunnelSimple size={14} />
              </Button>
            </DropdownMenuTrigger>
          </Tooltip>
          <DropdownMenuContent align="end" className="w-48">
            {(Object.keys(FILTER_LABELS) as TranslationFilter[]).map((value) => (
              <DropdownMenuItem key={value} onSelect={() => setFilter(value)}>
                <span className="flex size-4 items-center justify-center">{filter === value && <Check size={12} weight="bold" />}</span>
                {FILTER_LABELS[value]}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div className="grid h-9 shrink-0 grid-cols-2 border-b border-[#e7e5e4] bg-[#fafaf9] text-[11px] font-medium text-stone-500">
        <div className="flex items-center px-4">{primary.label} · оригинал</div>
        <div className="flex items-center border-l border-[#e7e5e4] px-3">{language.label} · перевод</div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {visibleMaterials.slice(0, visibleLimit).map((material) => (
          <section
            key={material.id}
            aria-label={`${material.typeLabel}: ${material.title}`}
            data-active-translation-material={material.id === activeMaterialId ? "true" : undefined}
            className={cn(material.id === activeMaterialId && "ring-1 ring-inset ring-indigo-200")}
          >
            <div className="sticky top-0 z-[1] flex h-9 items-center justify-between gap-3 border-b border-[#e7e5e4] bg-white/95 px-4 backdrop-blur-sm">
              <div className="min-w-0 truncate text-[12px] font-semibold text-stone-800">{material.title}<span className="ml-2 font-normal text-stone-400">{material.typeLabel}</span></div>
              <Tooltip label="Открыть оригинал" side="left">
                <Button type="button" variant="ghost" size="icon" aria-label={`Открыть оригинал: ${material.title}`} onClick={() => onOpenOriginal(material)} className="size-6 rounded-[6px] text-stone-400 hover:text-stone-700">
                  <ArrowSquareOut size={12} />
                </Button>
              </Tooltip>
            </div>
            {material.fields.map((field) => (
              <Fragment key={field.id}>
                {field.kind === "option-group" && (
                  <div className="border-b border-[#e7e5e4] bg-stone-50 px-4 py-1.5 text-[10px] font-semibold uppercase tracking-[0.06em] text-stone-400">Опции позиции</div>
                )}
                <TranslationFieldRow field={field} language={language.code} material={material} />
              </Fragment>
            ))}
          </section>
        ))}
        {visibleMaterials.length === 0 && (
          <div className="grid min-h-52 place-items-center px-5 text-center text-[12px] text-stone-500">
            Нет текстов, подходящих под этот фильтр.
          </div>
        )}
        {visibleMaterials.length > visibleLimit && (
          <div className="flex justify-center border-t border-[#e7e5e4] px-4 py-3">
            <Button type="button" variant="outline" size="sm" onClick={() => setVisibleLimit((current) => current + 12)}>
              Показать ещё
            </Button>
          </div>
        )}
      </div>
    </main>
  );
}

function EmptyTranslations() {
  const [addOpen, setAddOpen] = useState(false);
  const [primaryOpen, setPrimaryOpen] = useState(false);
  return (
    <div className="flex min-h-0 flex-1 bg-[#fbfbf9]">
      <aside className="w-[224px] shrink-0 border-r border-[#e7e5e4] bg-white">
        <WorkspaceHeading onChangePrimary={() => setPrimaryOpen(true)} />
      </aside>
      <main className="grid min-h-0 min-w-0 flex-1 place-items-center px-6 py-10">
        <div className="max-w-[360px] text-center">
          <h2 className="text-[18px] font-semibold text-stone-900">Переводов пока нет</h2>
          <p className="mt-1.5 text-[13px] text-stone-500">Добавьте язык, чтобы перевести контент ресторана.</p>
          <Button type="button" size="sm" onClick={() => setAddOpen(true)} className="mt-4 bg-[#4f39f6] hover:bg-[#4030d4]"><Plus size={14} />Добавить язык</Button>
        </div>
      </main>
      <AddLanguageDialog open={addOpen} onOpenChange={setAddOpen} />
      <PrimaryLanguageDialog open={primaryOpen} onOpenChange={setPrimaryOpen} />
    </div>
  );
}

function LanguageWorkspace({ onOpenOriginal }: { onOpenOriginal: (material: TranslationMaterial) => void }) {
  const { activeLanguage, languages, setActiveLanguage } = useTranslations();
  const [addOpen, setAddOpen] = useState(false);
  const language = languages.find((item) => item.code === activeLanguage) ?? languages[0];

  useEffect(() => {
    if (language && language.code !== activeLanguage) setActiveLanguage(language.code);
  }, [activeLanguage, language, setActiveLanguage]);

  if (!language) return null;
  return (
    <div className="flex min-h-0 flex-1 bg-white">
      <LanguageRail onAddLanguage={() => setAddOpen(true)} />
      <TranslationContent language={language} onOpenOriginal={onOpenOriginal} />
      <AddLanguageDialog open={addOpen} onOpenChange={setAddOpen} />
    </div>
  );
}

export function TranslationsWorkspace({ onOpenOriginal }: TranslationWorkspaceProps) {
  const {
    consumeWorkspaceRequest,
    languages,
    primaryLanguageConfirmed,
    workspaceRequested,
  } = useTranslations();

  useEffect(() => {
    if (workspaceRequested) consumeWorkspaceRequest();
  }, [consumeWorkspaceRequest, workspaceRequested]);

  if (!primaryLanguageConfirmed) return <FirstUseScreen />;
  if (languages.length === 0) return <EmptyTranslations />;
  return <LanguageWorkspace onOpenOriginal={onOpenOriginal} />;
}

export function TranslationOverlays() {
  const { catalogBulkRequest, closeCatalogBulk, dismissToast, languages, materials, openWorkspace, startAutoTranslate, toast } = useTranslations();
  const [selectedLanguages, setSelectedLanguages] = useState<Set<TranslationLanguageCode>>(new Set());
  const selectedMaterials = materials.filter((material) => material.kind === "position" && material.catalogItemId && catalogBulkRequest?.includes(material.catalogItemId));
  return (
    <>
      <AlertDialog open={catalogBulkRequest !== null} onOpenChange={(nextOpen) => !nextOpen && closeCatalogBulk()}>
        <AlertDialogContent className="max-w-[500px]">
          <AlertDialogHeader>
            <AlertDialogTitle>Перевести выбранные позиции</AlertDialogTitle>
            <AlertDialogDescription>{catalogBulkRequest?.length ?? 0} позиций. Выберите целевые языки.</AlertDialogDescription>
          </AlertDialogHeader>
          <div className="grid grid-cols-2 gap-2">
            {languages.map((language) => (
              <label key={language.code} className="flex cursor-pointer items-center gap-2 rounded-[8px] border border-stone-200 p-2.5 text-[12px]">
                <Checkbox checked={selectedLanguages.has(language.code)} onCheckedChange={(checked) => setSelectedLanguages((current) => {
                  const next = new Set(current);
                  if (checked) next.add(language.code);
                  else next.delete(language.code);
                  return next;
                })} />
                {language.label}
              </label>
            ))}
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction disabled={selectedLanguages.size === 0} className="bg-[#4f39f6] hover:bg-[#4030d4]" onClick={() => {
              selectedLanguages.forEach((language) => startAutoTranslate([language], selectedMaterials.map((material) => material.id), "Выбранные позиции"));
              closeCatalogBulk();
            }}>Перевести</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {toast && (
        <div role="status" className="fixed bottom-5 left-1/2 z-[100050] flex -translate-x-1/2 items-center gap-3 rounded-[10px] bg-stone-900 px-3.5 py-2.5 text-[12px] font-medium text-white shadow-xl">
          <span>{toast.message}</span>
          {toast.actionLabel && (
            <Button type="button" variant="ghost" onClick={() => {
              if (toast.onAction) toast.onAction();
              else openWorkspace();
              dismissToast();
            }} className="h-auto p-0 font-semibold text-indigo-200 hover:bg-transparent hover:text-white">{toast.actionLabel}</Button>
          )}
          <Button type="button" variant="ghost" size="icon" aria-label="Закрыть" onClick={dismissToast} className="size-6 text-white/60 hover:bg-white/10 hover:text-white"><X size={14} /></Button>
        </div>
      )}
    </>
  );
}
