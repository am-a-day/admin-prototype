import { startTransition, useEffect, useMemo, useState, type KeyboardEvent, type ReactNode } from "react";
import {
  Check,
  DotsThreeVertical,
  MagnifyingGlass,
  PencilSimple,
  PlusCircle,
  Trash,
  Translate,
  X,
} from "@phosphor-icons/react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import type { CatalogItem, CatalogLanguageCode, CatalogLocalizedValue } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { useTranslationsOptional } from "@/contexts/translations-context";
import { USE_SHARED_TAGS_AND_STICKERS } from "../feature-flags";
import {
  buildCatalogLabelAssignmentPatch,
  buildCatalogLabelRemovalPatch,
  ensureCatalogLabelsFromItems,
  findCatalogLabelByName,
  getCatalogLabelText,
  getCatalogLabelUsageItems,
  resolveCatalogItemStickerId,
  resolveCatalogItemTagIds,
  useCatalogLabels,
  type CatalogLabel,
  type CatalogLabelType,
} from "./catalog-labels";
import {
  buildLocalCatalogLabelPatch,
  createLocalCatalogLabel,
  getLocalCatalogItemLabels,
  getLocalCatalogLabelText,
  normalizeLocalCatalogLabelEdit,
} from "./local-catalog-labels";
import { usePositionSidePeekOverlay } from "../editor/side-peek-context";

const NO_STICKER_VALUE = "__none__";

type LabelEditState = { id: string } | null;

function getScopeItems(item: CatalogItem, allItems: CatalogItem[]) {
  return [item, ...allItems.filter((candidate) => candidate.id !== item.id)];
}

function compactTranslations(value: Partial<CatalogLocalizedValue>): CatalogLocalizedValue {
  return {
    ru: value.ru?.trim().replace(/\s+/g, " ") ?? "",
    ...(value.kk?.trim() ? { kk: value.kk.trim() } : {}),
    ...(value.en?.trim() ? { en: value.en.trim() } : {}),
    ...(value.sr?.trim() ? { sr: value.sr.trim() } : {}),
  };
}

function positionWord(count: number, forms: [string, string, string]) {
  const mod100 = count % 100;
  const mod10 = count % 10;
  if (mod100 >= 11 && mod100 <= 14) return forms[2];
  if (mod10 === 1) return forms[0];
  if (mod10 >= 2 && mod10 <= 4) return forms[1];
  return forms[2];
}

function LabelRowActions({
  label,
  usageCount,
  onRename,
  onTranslations,
  onDelete,
  onOpenChange,
}: {
  label: CatalogLabel;
  usageCount: number;
  onRename: () => void;
  onTranslations: () => void;
  onDelete: () => void;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <DropdownMenu onOpenChange={onOpenChange}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Действия «${label.translations.ru}»`}
          onClick={(event) => event.stopPropagation()}
          onPointerDown={(event) => event.stopPropagation()}
          className="flex size-7 shrink-0 items-center justify-center rounded-[7px] text-stone-400 opacity-0 outline-none transition hover:bg-stone-100 hover:text-stone-600 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-stone-400/20 group-hover/label:opacity-100 group-focus-within/label:opacity-100 data-[state=open]:opacity-100"
        >
          <DotsThreeVertical size={15} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" onClick={(event) => event.stopPropagation()}>
        <DropdownMenuLabel>Используется в {usageCount} {positionWord(usageCount, ["позиции", "позициях", "позициях"])}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onRename}><PencilSimple size={15} />Переименовать</DropdownMenuItem>
        <DropdownMenuItem onSelect={onTranslations}><Translate size={15} />Открыть в переводах</DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive"><Trash size={15} />Удалить</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function LabelDeleteDialog({
  label,
  usageItems,
  onCancel,
  onDelete,
}: {
  label: CatalogLabel | null;
  usageItems: CatalogItem[];
  onCancel: () => void;
  onDelete: () => void;
}) {
  usePositionSidePeekOverlay(Boolean(label), onCancel);
  if (!label) return null;
  const kind = label.type === "tag" ? "тег" : "стикер";
  const visibleItems = usageItems.slice(0, 5);
  const restCount = Math.max(0, usageItems.length - visibleItems.length);

  return (
    <AlertDialog open onOpenChange={(open) => { if (!open) onCancel(); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Удалить {kind} «{label.translations.ru}»?</AlertDialogTitle>
          <AlertDialogDescription>
            {label.type === "tag" ? "Тег" : "Стикер"} используется в {usageItems.length} {positionWord(usageItems.length, ["позиции", "позициях", "позициях"])}. После удаления он будет снят со всех этих позиций.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="rounded-[9px] bg-stone-50 px-3 py-2 text-[13px] text-stone-600">
          {visibleItems.map((item) => <div key={item.id} className="truncate py-0.5">{item.title}</div>)}
          {restCount > 0 && <div className="pt-1 text-stone-500">И ещё {restCount} {positionWord(restCount, ["позиция", "позиции", "позиций"])}</div>}
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onCancel}>Отмена</AlertDialogCancel>
          <AlertDialogAction onClick={onDelete} className="bg-destructive text-white hover:bg-destructive/90">
            Удалить {kind}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

function CatalogLabelPicker({
  type,
  item,
  allItems,
  selectedTagIds,
  selectedStickerId,
  onAssign,
  onPatchItem,
  children,
}: {
  type: CatalogLabelType;
  item: CatalogItem;
  allItems: CatalogItem[];
  selectedTagIds: string[];
  selectedStickerId: string | null;
  onAssign: (assignment: { tagIds?: string[]; stickerId?: string | null }, labels?: CatalogLabel[]) => void;
  onPatchItem: (item: CatalogItem, patch: Partial<CatalogItem>) => void;
  children: ReactNode;
}) {
  const { contentLanguage } = useAppSettings();
  const { account } = useMockAuth();
  const translations = useTranslationsOptional();
  const primaryLanguage = account?.workspace.primaryLanguage ?? "ru";
  const directory = useCatalogLabels();
  const scopeItems = getScopeItems(item, allItems);
  const usageCountByLabelId = useMemo(() => {
    const counts = new Map<string, number>();
    allItems.forEach((candidate) => {
      resolveCatalogItemTagIds(candidate, directory.labels).forEach((id) => {
        counts.set(id, (counts.get(id) ?? 0) + 1);
      });
      const candidateStickerId = resolveCatalogItemStickerId(candidate, directory.labels);
      if (candidateStickerId) counts.set(candidateStickerId, (counts.get(candidateStickerId) ?? 0) + 1);
    });
    return counts;
  }, [allItems, directory.labels]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<LabelEditState>(null);
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [renameDraft, setRenameDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CatalogLabel | null>(null);
  usePositionSidePeekOverlay(open, () => setOpen(false));
  const normalizedQuery = query.trim().replace(/\s+/g, " ");
  const filtered = directory.labels
    .filter((label) => label.type === type && (!normalizedQuery || Object.values(label.translations).some((value) => value.toLocaleLowerCase("ru").includes(normalizedQuery.toLocaleLowerCase("ru")))))
    .sort((left, right) => Number(type === "tag" ? selectedTagIds.includes(right.id) : selectedStickerId === right.id) - Number(type === "tag" ? selectedTagIds.includes(left.id) : selectedStickerId === left.id));
  const exact = normalizedQuery ? findCatalogLabelByName(directory.labels, type, normalizedQuery) : null;

  const assign = (label: CatalogLabel | null) => {
    if (type === "tag" && label) {
      const tagIds = selectedTagIds.includes(label.id) ? selectedTagIds.filter((id) => id !== label.id) : [...selectedTagIds, label.id];
      onAssign({ tagIds });
      return;
    }
    onAssign({ stickerId: label?.id ?? null });
  };

  const create = () => {
    if (!normalizedQuery) return;
    const label = directory.create(type, { ru: normalizedQuery, [primaryLanguage]: normalizedQuery });
    if (!label) return;
    const nextLabels = directory.labels.some((candidate) => candidate.id === label.id) ? directory.labels : [...directory.labels, label];
    if (type === "tag") onAssign({ tagIds: [...new Set([...selectedTagIds, label.id])] }, nextLabels);
    else onAssign({ stickerId: label.id }, nextLabels);
    setQuery("");
  };

  const updateLabel = (label: CatalogLabel, translations: CatalogLocalizedValue) => {
    const nextTranslations = compactTranslations(translations);
    if (!nextTranslations.ru || !directory.update(label.id, nextTranslations)) return false;
    const nextLabels = directory.labels.map((candidate) => candidate.id === label.id ? { ...candidate, translations: nextTranslations } : candidate);
    getCatalogLabelUsageItems(label, scopeItems, directory.labels).forEach((assignedItem) => {
      onPatchItem(assignedItem, buildCatalogLabelAssignmentPatch(assignedItem, nextLabels, {}));
    });
    return true;
  };

  const commitRename = (label: CatalogLabel) => {
    const nextName = renameDraft.trim().replace(/\s+/g, " ");
    if (!nextName) { setEditing(null); return; }
    if (updateLabel(label, { ...label.translations, ru: nextName })) setEditing(null);
  };

  const removeLabel = (label: CatalogLabel) => {
    scopeItems.forEach((assignedItem) => {
      const patch = buildCatalogLabelRemovalPatch(assignedItem, label, directory.labels);
      if (patch) onPatchItem(assignedItem, patch);
    });
    directory.remove(label.id);
    setPendingDelete(null);
    if (editing?.id === label.id) setEditing(null);
  };

  const requestDelete = (label: CatalogLabel) => {
    const usage = getCatalogLabelUsageItems(label, scopeItems, directory.labels);
    if (usage.length === 0) removeLabel(label);
    else setPendingDelete(label);
  };

  const onSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); }
    if (event.key === "Enter") {
      event.preventDefault();
      if (exact) assign(exact);
      else if (filtered[0]) assign(filtered[0]);
      else create();
    }
  };

  const renderLabelRow = (label: CatalogLabel) => {
    const selected = type === "tag" ? selectedTagIds.includes(label.id) : selectedStickerId === label.id;
    const isRenaming = editing?.id === label.id;
    const usageCount = usageCountByLabelId.get(label.id) ?? 0;
    const toggle = () => assign(label);
    return (
      <div key={label.id} className="group/label">
        <div
          role="button"
          tabIndex={0}
          aria-pressed={selected}
          onClick={toggle}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") { event.preventDefault(); toggle(); }
          }}
          className="flex h-9 w-full cursor-default items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-stone-700 outline-none hover:bg-stone-100 focus-visible:bg-stone-100"
        >
          {type === "tag" ? (
            <Checkbox
              checked={selected}
              aria-label={`${selected ? "Снять" : "Назначить"} тег «${label.translations.ru}»`}
              onClick={(event) => event.stopPropagation()}
              onCheckedChange={toggle}
            />
          ) : (
            <RadioGroupItem
              value={label.id}
              aria-label={`Выбрать стикер «${label.translations.ru}»`}
              onClick={(event) => event.stopPropagation()}
            />
          )}
          {isRenaming ? (
            <Input
              size="compact"
              autoFocus
              value={renameDraft}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setRenameDraft(event.target.value)}
              onBlur={(event) => { if (event.currentTarget.dataset.cancelled !== "true") commitRename(label); }}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === "Enter") { event.preventDefault(); event.currentTarget.blur(); }
                if (event.key === "Escape") { event.preventDefault(); event.currentTarget.dataset.cancelled = "true"; setEditing(null); }
              }}
              className="h-7 min-w-0 flex-1 rounded-[6px] border-stone-300 bg-white focus:border-stone-500"
            />
          ) : (
            <span className="min-w-0 flex-1 truncate">{getCatalogLabelText(label, contentLanguage, primaryLanguage)}</span>
          )}
          {!isRenaming && (
            <LabelRowActions
              label={label}
              usageCount={usageCount}
              onRename={() => { setRenameDraft(label.translations.ru); setEditing({ id: label.id }); }}
              onTranslations={() => translations?.openWorkspace({
                category: type === "tag" ? "tags" : "stickers",
                materialId: label.id,
              })}
              onDelete={() => requestDelete(label)}
              onOpenChange={(next) => {
                if (next) setContextMenuOpen(true);
                else window.setTimeout(() => setContextMenuOpen(false), 120);
              }}
            />
          )}
        </div>
      </div>
    );
  };

  const pendingUsageItems = pendingDelete ? getCatalogLabelUsageItems(pendingDelete, scopeItems, directory.labels) : [];

  return (
    <>
      <Popover open={open} onOpenChange={(next) => {
        if (!next && contextMenuOpen) return;
        setOpen(next);
        if (!next) { setQuery(""); setEditing(null); }
      }}>
        <PopoverTrigger asChild>{children}</PopoverTrigger>
        <PopoverContent
          align="start"
          sideOffset={6}
          onInteractOutside={(event) => {
            if (event.target instanceof Element && event.target.closest('[role="menu"]')) event.preventDefault();
          }}
          className="z-[100008] w-[336px] rounded-[13px] border-stone-200 p-0 shadow-[0_14px_40px_rgba(41,37,36,0.16)]"
        >
          <div className="px-3 pb-2 pt-3">
            <h3 className="text-[13px] font-semibold text-stone-800">{type === "tag" ? "Теги" : "Стикер"}</h3>
            <div className="mt-2 flex h-8 items-center gap-2 rounded-[8px] bg-stone-100 px-2.5">
              <MagnifyingGlass size={14} className="shrink-0 text-stone-400" />
              <Input
                size="compact"
                autoFocus
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={onSearchKeyDown}
                placeholder={type === "tag" ? "Найти или создать тег" : "Найти или создать стикер"}
                className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-stone-800 shadow-none placeholder:text-stone-400 focus:border-0"
              />
            </div>
          </div>
          <div className="max-h-[264px] overflow-y-auto px-2 pb-2">
            {type === "sticker" ? (
              <RadioGroup value={selectedStickerId ?? NO_STICKER_VALUE} onValueChange={(value) => assign(value === NO_STICKER_VALUE ? null : directory.labels.find((label) => label.id === value) ?? null)} className="gap-0">
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => assign(null)}
                  onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); assign(null); } }}
                  className="flex h-9 w-full cursor-default items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-stone-600 outline-none hover:bg-stone-100 focus-visible:bg-stone-100"
                >
                  <RadioGroupItem value={NO_STICKER_VALUE} aria-label="Без стикера" onClick={(event) => event.stopPropagation()} />
                  <span>Без стикера</span>
                </div>
                {filtered.map(renderLabelRow)}
              </RadioGroup>
            ) : filtered.map(renderLabelRow)}
            {normalizedQuery && !exact && (
              <button type="button" onClick={create} className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] font-medium text-stone-600 hover:bg-stone-100">
                <PlusCircle size={15} />Создать «{normalizedQuery}»
              </button>
            )}
          </div>
        </PopoverContent>
      </Popover>
      <LabelDeleteDialog
        label={pendingDelete}
        usageItems={pendingUsageItems}
        onCancel={() => setPendingDelete(null)}
        onDelete={() => { if (pendingDelete) removeLabel(pendingDelete); }}
      />
    </>
  );
}

function LocalLabelInlineInput({
  type,
  onCommit,
  onCancel,
}: {
  type: CatalogLabelType;
  onCommit: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const commit = () => {
    const next = value.trim().replace(/\s+/g, " ");
    if (next) onCommit(next);
    else onCancel();
  };

  return (
    <div className="inline-flex h-[26px] max-w-[190px] items-center rounded-full bg-[#f5f5f4] pl-2 pr-1">
      <Input
        size="compact"
        autoFocus
        data-local-label-input={type}
        aria-label={type === "tag" ? "Название нового тега" : "Название нового стикера"}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            event.preventDefault();
            commit();
          }
          if (event.key === "Escape") {
            event.preventDefault();
            onCancel();
          }
        }}
        className="h-[18px] w-[132px] border-0 bg-transparent p-0 text-[12px] text-stone-700 shadow-none focus:border-0 focus:ring-0"
      />
      <button
        type="button"
        aria-label={type === "tag" ? "Сохранить новый тег" : "Сохранить новый стикер"}
        onClick={commit}
        className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#e7e5e4] text-[#57534d] transition hover:bg-[#d6d3d1] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-stone-400/40"
      >
        <Check size={10} weight="bold" />
      </button>
    </div>
  );
}

function LocalLabelEditPopover({
  type,
  value,
  primaryLanguage,
  onChange,
  onRemove,
  initialOpen = false,
}: {
  type: CatalogLabelType;
  value: CatalogLocalizedValue;
  primaryLanguage: CatalogLanguageCode;
  onChange: (value: CatalogLocalizedValue) => void;
  onRemove: () => void;
  /** Used only by deterministic Design Lab captures of the existing edit popover. */
  initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const [draft, setDraft] = useState<Partial<CatalogLocalizedValue>>(value);
  const [editBase, setEditBase] = useState<CatalogLocalizedValue>(value);
  usePositionSidePeekOverlay(open, () => setOpen(false));
  const displayText = getLocalCatalogLabelText(value, primaryLanguage, primaryLanguage);

  const commitPrimaryLanguage = () => {
    const normalized = normalizeLocalCatalogLabelEdit(editBase, draft, primaryLanguage, primaryLanguage);
    if (!normalized || !draft[primaryLanguage]?.trim()) {
      setDraft(editBase);
      return;
    }
    onChange(normalized);
  };

  return (
    <Popover open={open} onOpenChange={(next) => {
      setOpen(next);
      if (next) {
        setDraft(value);
        setEditBase(value);
      } else {
        setDraft(value);
        setEditBase(value);
      }
    }}>
      <span
        data-local-label-chip={type}
        className="inline-flex h-[26px] max-w-[190px] items-center rounded-full bg-[#f5f5f4] pl-2 pr-1 text-[12px] text-stone-600 transition hover:bg-[#eceae7]"
      >
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Редактировать ${type === "tag" ? "тег" : "стикер"} «${displayText}»`}
            className="min-w-0 truncate py-1 pl-0 pr-1 text-left outline-none focus-visible:underline focus-visible:ring-2 focus-visible:ring-stone-400/30"
          >
            {displayText}
          </button>
        </PopoverTrigger>
        <button
          type="button"
          aria-label={`${type === "tag" ? "Удалить тег" : "Убрать стикер"} «${displayText}»`}
          onClick={(event) => {
            event.stopPropagation();
            onRemove();
          }}
          className="flex size-4 shrink-0 items-center justify-center rounded-full bg-[#e7e5e4] text-stone-500 outline-none transition hover:bg-stone-300 hover:text-stone-800 focus-visible:ring-2 focus-visible:ring-stone-400/30"
        >
          <X size={11} weight="bold" />
        </button>
      </span>
      <PopoverContent
        align="start"
        sideOffset={6}
        className="z-[100008] w-[288px] rounded-[12px] border-stone-200 p-3 shadow-[0_14px_40px_rgba(41,37,36,0.16)]"
      >
        <label className="block text-[12px] font-medium text-stone-600">
          <span className="mb-1 block">Название</span>
          <Input
            size="compact"
            autoFocus
            value={draft[primaryLanguage] ?? ""}
            onChange={(event) => {
              const nextDraft = { ...draft, [primaryLanguage]: event.target.value };
              setDraft(nextDraft);
              const normalized = normalizeLocalCatalogLabelEdit(editBase, nextDraft, primaryLanguage, primaryLanguage);
              if (normalized) onChange(normalized);
            }}
            onBlur={commitPrimaryLanguage}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                event.currentTarget.blur();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                setDraft(editBase);
                onChange(editBase);
                setOpen(false);
              }
            }}
            className="h-8 rounded-[7px] border-stone-200 bg-white text-stone-700 shadow-sm placeholder:text-stone-400 focus:border-stone-400"
          />
        </label>
      </PopoverContent>
    </Popover>
  );
}

function LocalCatalogLabelControls({
  item,
  onPatchItem,
  initialCreatingType,
  initialEditingType,
}: {
  item: CatalogItem;
  onPatchItem: (item: CatalogItem, patch: Partial<CatalogItem>) => void;
  initialCreatingType?: CatalogLabelType;
  initialEditingType?: CatalogLabelType;
}) {
  const { account } = useMockAuth();
  const primaryLanguage = (account?.workspace.primaryLanguage ?? "ru") as CatalogLanguageCode;
  const itemLabels = getLocalCatalogItemLabels(item, primaryLanguage);
  const itemLabelsKey = JSON.stringify(itemLabels);
  const [optimistic, setOptimistic] = useState(() => ({ itemId: item.id, ...itemLabels }));
  const [creatingType, setCreatingType] = useState<CatalogLabelType | null>(initialCreatingType ?? null);

  useEffect(() => {
    setOptimistic({ itemId: item.id, ...itemLabels });
    setCreatingType(initialCreatingType ?? null);
  }, [initialCreatingType, item.id, itemLabelsKey]);

  const labels = optimistic.itemId === item.id ? optimistic : { itemId: item.id, ...itemLabels };
  const apply = (next: { tags: CatalogLocalizedValue[]; sticker: CatalogLocalizedValue | null }) => {
    setOptimistic({ itemId: item.id, ...next });
    const patch = buildLocalCatalogLabelPatch(item, next, primaryLanguage);
    startTransition(() => onPatchItem(item, patch));
  };

  const renderCard = (type: CatalogLabelType) => {
    const values = type === "tag" ? labels.tags : labels.sticker ? [labels.sticker] : [];
    const hasValues = values.length > 0 || creatingType === type;
    const addDisabled = creatingType === type || (type === "sticker" && values.length > 0);
    return (
      <div data-local-label-section={type} className="w-full">
        <div className="mb-1.5 px-1">
          <span className="inline-flex border-b border-dashed border-[#a8a29e] px-0.5 pb-0.5 text-[13px] font-normal leading-5 text-[#292524]">
            {type === "tag" ? "Теги" : "Стикер"}
          </span>
        </div>
        <div
          data-local-label-card={type}
          className="overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white"
        >
          {hasValues && (
            <div className="flex min-h-[41px] flex-wrap items-center gap-1.5 px-3 py-2">
              {values.map((value, index) => (
                <LocalLabelEditPopover
                  key={`${type}-${index}`}
                  type={type}
                  value={value}
                  primaryLanguage={primaryLanguage}
                  onChange={(nextValue) => apply(type === "tag"
                    ? { tags: labels.tags.map((tag, tagIndex) => tagIndex === index ? nextValue : tag), sticker: labels.sticker }
                    : { tags: labels.tags, sticker: nextValue })}
                  onRemove={() => apply(type === "tag"
                    ? { tags: labels.tags.filter((_, tagIndex) => tagIndex !== index), sticker: labels.sticker }
                    : { tags: labels.tags, sticker: null })}
                  initialOpen={initialEditingType === type && index === 0}
                />
              ))}
              {creatingType === type && (
                <LocalLabelInlineInput
                  type={type}
                  onCancel={() => setCreatingType(null)}
                  onCommit={(name) => {
                    const created = createLocalCatalogLabel(name, primaryLanguage);
                    setCreatingType(null);
                    if (!created) return;
                    apply(type === "tag"
                      ? { tags: [...labels.tags, created], sticker: labels.sticker }
                      : { tags: labels.tags, sticker: created });
                  }}
                />
              )}
            </div>
          )}
          <button
            type="button"
            disabled={addDisabled}
            aria-label={type === "tag" ? "Добавить тег" : "Добавить стикер"}
            onClick={() => setCreatingType(type)}
            className={cn(
              "flex h-9 w-full items-center gap-2 px-3 text-left text-[12px] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-stone-400/30",
              hasValues && "border-t border-[#e7e5e4]",
              addDisabled
                ? "cursor-not-allowed text-[#a8a29e]"
                : "text-[#79716b] hover:bg-[#f8f7f4] hover:text-[#44403b]",
            )}
          >
            <PlusCircle size={16} />
            <span>{type === "tag" ? "Добавить тег" : "Добавить стикер"}</span>
          </button>
        </div>
      </div>
    );
  };

  return <>{renderCard("sticker")}{renderCard("tag")}</>;
}

function SharedCatalogLabelControls({
  item,
  allItems,
  onPatchItem,
}: {
  item: CatalogItem;
  allItems: CatalogItem[];
  onPatchItem: (item: CatalogItem, patch: Partial<CatalogItem>) => void;
}) {
  const { contentLanguage } = useAppSettings();
  const { account } = useMockAuth();
  const primaryLanguage = account?.workspace.primaryLanguage ?? "ru";
  const directory = useCatalogLabels();
  const catalogItemIds = useMemo(() => allItems.map((candidate) => candidate.id).join("|"), [allItems]);
  useEffect(() => {
    ensureCatalogLabelsFromItems(getScopeItems(item, allItems));
  }, [catalogItemIds]);
  const resolvedTagIds = resolveCatalogItemTagIds(item, directory.labels);
  const resolvedStickerId = resolveCatalogItemStickerId(item, directory.labels);
  const resolvedTagIdsKey = resolvedTagIds.join("|");
  const [optimisticAssignment, setOptimisticAssignment] = useState(() => ({
    itemId: item.id,
    tagIds: resolvedTagIds,
    stickerId: resolvedStickerId,
  }));

  useEffect(() => {
    setOptimisticAssignment({ itemId: item.id, tagIds: resolvedTagIds, stickerId: resolvedStickerId });
  }, [item.id, resolvedStickerId, resolvedTagIdsKey]);

  const tagIds = optimisticAssignment.itemId === item.id ? optimisticAssignment.tagIds : resolvedTagIds;
  const stickerId = optimisticAssignment.itemId === item.id ? optimisticAssignment.stickerId : resolvedStickerId;

  const assign = (assignment: { tagIds?: string[]; stickerId?: string | null }, labels = directory.labels) => {
    const nextTagIds = assignment.tagIds ?? tagIds;
    const nextStickerId = assignment.stickerId === undefined ? stickerId : assignment.stickerId;
    setOptimisticAssignment({ itemId: item.id, tagIds: nextTagIds, stickerId: nextStickerId });
    const patch = buildCatalogLabelAssignmentPatch(item, labels, {
      tagIds: nextTagIds,
      stickerId: nextStickerId,
    });
    startTransition(() => onPatchItem(item, patch));
  };

  const unassign = (type: CatalogLabelType, labelId: string) => {
    assign(type === "tag" ? { tagIds: tagIds.filter((id) => id !== labelId) } : { stickerId: null });
  };

  const renderCard = (type: CatalogLabelType) => {
    const labels = type === "tag"
      ? tagIds.map((id) => directory.labels.find((label) => label.id === id)).filter((label): label is CatalogLabel => Boolean(label))
      : [directory.labels.find((label) => label.id === stickerId)].filter((label): label is CatalogLabel => Boolean(label));
    return (
      <div className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-left shadow-sm">
        <span className="shrink-0 text-[13px] font-medium text-stone-800">{type === "tag" ? "Теги" : "Стикер"}</span>
        <div className="flex min-w-0 flex-1 flex-wrap items-center justify-end gap-1.5">
          {labels.map((label) => (
            <span
              key={label.id}
              className="group/chip relative max-w-[170px] rounded-[6px] bg-[#f1f1ea] py-1 pl-2 pr-6 text-left text-[12px] text-stone-600 transition hover:bg-stone-200"
            >
              <span className="block truncate">{getCatalogLabelText(label, contentLanguage, primaryLanguage)}</span>
              <button
                type="button"
                aria-label={`${type === "tag" ? "Снять тег" : "Убрать стикер"} «${getCatalogLabelText(label, contentLanguage, primaryLanguage)}»`}
                onClick={() => unassign(type, label.id)}
                className="absolute right-1 top-1/2 flex size-4 -translate-y-1/2 items-center justify-center rounded-[4px] opacity-0 outline-none transition-opacity hover:bg-stone-300 focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-stone-400/30 group-hover/chip:opacity-100"
              >
                <X size={11} weight="bold" />
              </button>
            </span>
          ))}
          <CatalogLabelPicker
            type={type}
            item={item}
            allItems={allItems}
            selectedTagIds={tagIds}
            selectedStickerId={stickerId}
            onAssign={assign}
            onPatchItem={onPatchItem}
          >
            <button type="button" aria-label={type === "tag" ? "Добавить тег" : "Добавить стикер"} className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-stone-500 hover:bg-stone-100 hover:text-stone-800">
              <PlusCircle size={16} />
            </button>
          </CatalogLabelPicker>
        </div>
      </div>
    );
  };
  return <>{renderCard("sticker")}{renderCard("tag")}</>;
}

export function CatalogLabelControls(props: {
  item: CatalogItem;
  allItems: CatalogItem[];
  onPatchItem: (item: CatalogItem, patch: Partial<CatalogItem>) => void;
  /** Used only by deterministic Design Lab captures of the active local-label UI. */
  initialCreatingType?: CatalogLabelType;
  /** Used only by deterministic Design Lab captures of the active local-label edit popover. */
  initialEditingType?: CatalogLabelType;
}) {
  return USE_SHARED_TAGS_AND_STICKERS
    ? <SharedCatalogLabelControls {...props} />
    : <LocalCatalogLabelControls
      item={props.item}
      onPatchItem={props.onPatchItem}
      initialCreatingType={props.initialCreatingType}
      initialEditingType={props.initialEditingType}
    />;
}

export function CatalogBulkLabelPicker({
  type,
  items,
  onPatchItem,
}: {
  type: CatalogLabelType;
  items: CatalogItem[];
  onPatchItem: (item: CatalogItem, patch: Partial<CatalogItem>) => void;
}) {
  const directory = useCatalogLabels();
  const { contentLanguage } = useAppSettings();
  const { account } = useMockAuth();
  const primaryLanguage = account?.workspace.primaryLanguage ?? "ru";
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const labels = directory.labels.filter((label) => label.type === type && (!query.trim() || Object.values(label.translations).some((value) => value.toLocaleLowerCase("ru").includes(query.trim().toLocaleLowerCase("ru")))));
  const exact = query.trim() ? findCatalogLabelByName(directory.labels, type, query) : null;
  const tagPresence = (id: string) => items.filter((item) => resolveCatalogItemTagIds(item, directory.labels).includes(id)).length;
  const commonSticker = items.length > 0 && items.every((item) => resolveCatalogItemStickerId(item, directory.labels) === resolveCatalogItemStickerId(items[0], directory.labels))
    ? resolveCatalogItemStickerId(items[0], directory.labels)
    : undefined;
  const apply = (label: CatalogLabel | null) => {
    items.forEach((targetItem) => {
      if (type === "tag" && label) {
        const ids = resolveCatalogItemTagIds(targetItem, directory.labels);
        const allHave = tagPresence(label.id) === items.length;
        const tagIds = allHave ? ids.filter((id) => id !== label.id) : [...new Set([...ids, label.id])];
        onPatchItem(targetItem, buildCatalogLabelAssignmentPatch(targetItem, directory.labels, { tagIds }));
      } else {
        onPatchItem(targetItem, buildCatalogLabelAssignmentPatch(targetItem, directory.labels, { stickerId: label?.id ?? null }));
      }
    });
    if (type === "sticker") setOpen(false);
  };
  const create = () => {
    const label = directory.create(type, { ru: query, [primaryLanguage]: query });
    if (!label) return;
    const nextLabels = directory.labels.some((candidate) => candidate.id === label.id) ? directory.labels : [...directory.labels, label];
    items.forEach((targetItem) => {
      const patch = type === "tag"
        ? buildCatalogLabelAssignmentPatch(targetItem, nextLabels, { tagIds: [...new Set([...resolveCatalogItemTagIds(targetItem, nextLabels), label.id])] })
        : buildCatalogLabelAssignmentPatch(targetItem, nextLabels, { stickerId: label.id });
      onPatchItem(targetItem, patch);
    });
    setQuery("");
    if (type === "sticker") setOpen(false);
  };
  return (
    <Popover open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <PopoverTrigger asChild>
        <button type="button" className="flex h-full shrink-0 items-center px-2.5 text-[13px] font-medium text-stone-600 transition hover:bg-white/70 hover:text-stone-800">{type === "tag" ? "Теги" : "Стикер"}</button>
      </PopoverTrigger>
      <PopoverContent align="start" sideOffset={6} className="z-[100008] w-[336px] rounded-[13px] border-stone-200 p-0 shadow-[0_14px_40px_rgba(41,37,36,0.16)]">
        <div className="px-3 pb-2 pt-3">
          <h3 className="text-[13px] font-semibold text-stone-800">{type === "tag" ? "Теги" : "Стикер"}</h3>
          <div className="mt-2 flex h-8 items-center gap-2 rounded-[8px] bg-stone-100 px-2.5">
            <MagnifyingGlass size={14} className="text-stone-400" />
            <Input size="compact" autoFocus value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); setOpen(false); } if (event.key === "Enter") { event.preventDefault(); labels[0] ? apply(labels[0]) : create(); } }} placeholder={type === "tag" ? "Найти или создать тег" : "Найти или создать стикер"} className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 shadow-none placeholder:text-stone-400 focus:border-0" />
          </div>
        </div>
        <div className="max-h-[240px] overflow-y-auto px-2 pb-2">
          {type === "sticker" ? (
            <RadioGroup value={commonSticker ?? ""} onValueChange={(value) => apply(value === NO_STICKER_VALUE ? null : directory.labels.find((label) => label.id === value) ?? null)} className="gap-0">
              <label className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[13px] hover:bg-stone-100"><RadioGroupItem value={NO_STICKER_VALUE} />Без стикера</label>
              {labels.map((label) => <label key={label.id} className="flex h-9 w-full cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[13px] hover:bg-stone-100"><RadioGroupItem value={label.id} /><span className="truncate">{getCatalogLabelText(label, contentLanguage, primaryLanguage)}</span></label>)}
            </RadioGroup>
          ) : labels.map((label) => {
            const presence = tagPresence(label.id);
            const checked = presence === items.length;
            return (
              <button key={label.id} type="button" onClick={() => apply(label)} className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] hover:bg-stone-100">
                <Checkbox checked={checked ? true : presence > 0 ? "indeterminate" : false} tabIndex={-1} />
                <span className="truncate">{getCatalogLabelText(label, contentLanguage, primaryLanguage)}</span>
              </button>
            );
          })}
          {query.trim() && !exact && <button type="button" onClick={create} className="flex h-9 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] font-medium hover:bg-stone-100"><PlusCircle size={15} />Создать «{query.trim()}»</button>}
        </div>
      </PopoverContent>
    </Popover>
  );
}
