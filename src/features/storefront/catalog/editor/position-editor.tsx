import { useEffect, useRef, useState, type ChangeEvent, type CSSProperties, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type KeyboardCoordinateGetter,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Asterisk, ArrowsOutCardinal, ArrowCounterClockwise, ArrowLeft, CaretDown, CaretRight, CheckCircle, DotsThree, DotsThreeVertical, DotsSixVertical, ImageBroken, Lock, MagnifyingGlass, Play, Plus, PlusCircle, Prohibit, Trash, XCircle } from "@phosphor-icons/react";
import { TranslatableField } from "@/components/workspace/translatable-field";
import { DescriptionRichTextEditor } from "@/components/workspace/description-rich-text-editor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import { catalogSections, type CatalogItem } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { catalogStorageKey } from "@/lib/catalog-preview";
import { CATALOG_RECOMMENDATION_LIMIT, buildAutomaticRecommendations, resolveRecommendationIds, resolveRecommendationSource, type CatalogItemUpsellState, type CatalogLocalizedValue, type CatalogRecommendationSource } from "@/lib/catalog-upsell";
import type { CatalogAvailabilityMode } from "../model/tree";
import { getItemSearchText } from "../model/selectors";
import { CatalogActionButton } from "../ui/catalog-action-button";
import { CatalogMoreButton } from "../ui/catalog-more-button";
import { DropdownActionItem, DropdownContent } from "../ui/catalog-dropdown";
import { getMovePopoverAnchor, type MovePopoverAnchor } from "../ui/move-anchor";
import { DND_TRANSITION, restrictTableSortToVerticalAxis, usePrefersReducedMotion } from "../workspace/dnd";
import { descriptionHasContent, type EditorFocusAnchor, type EditorTab } from "./editor-queue";
import { WorkspaceLocalTabs } from "./editor-tabs";
import { readJsonRecord, writeJsonRecord } from "../storage";

type AvailabilityMode = CatalogAvailabilityMode;
const VIDEO_LIMIT_TOTAL = 10;
const VIDEO_LIMIT_USED = 6;
const VIDEO_PACKAGE_CONNECTED = true;
/** Группы и варианты живут в одном DndContext, но никогда не конкурируют за
 * одну drop-цель: сортировка вариантов также ограничена своей группой. */
const optionCollisionDetection: CollisionDetection = (args) => {
  const kind = args.active.data.current?.kind;
  const groupId = args.active.data.current?.groupId;
  const droppableContainers = args.droppableContainers.filter((container) => {
    const data = container.data.current;
    if (kind === "option-group") return data?.kind === "option-group";
    return data?.kind === "option-variant" && data?.groupId === groupId;
  });
  return closestCenter({ ...args, droppableContainers });
};

const optionKeyboardCoordinates: KeyboardCoordinateGetter = (event, args) => {
  const activeData = args.context.active?.data.current;
  const kind = activeData?.kind;
  const groupId = activeData?.groupId;
  const originalContainers = args.context.droppableContainers;
  const enabledContainers = originalContainers.getEnabled().filter((container) => {
    const data = container.data.current;
    if (kind === "option-group") return data?.kind === "option-group";
    return data?.kind === "option-variant" && data?.groupId === groupId;
  });
  const filteredContainers = {
    get: originalContainers.get.bind(originalContainers),
    getEnabled: () => enabledContainers,
  } as unknown as typeof originalContainers;

  return sortableKeyboardCoordinates(event, {
    ...args,
    context: { ...args.context, droppableContainers: filteredContainers },
  });
};


export type PositionEditorMode = "create" | "edit";
export type UnavailableDisplayMode = "hidden" | "comingSoon";
export type OutsideScheduleMode = "hidden" | "comingSoon";
export type ScheduleDayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
export type DaySchedule =
  | { mode: "allDay" }
  | { mode: "unavailable" }
  | { mode: "custom"; intervals: Array<{ start: string; end: string }> };
export type WeeklySchedule = Record<ScheduleDayKey, DaySchedule>;
export type PreviousAvailabilityState = {
  status: CatalogItem["status"];
  scheduled: boolean;
};
type LocalizedValue = CatalogLocalizedValue;

const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: "basic", label: "Основное" },
  { id: "promo", label: "Допродажа" },
  { id: "options", label: "Опции" },
  { id: "availability", label: "Доступность" },
  { id: "display", label: "Отображение" },
];
const editorTabByItem = new Map<string, EditorTab>();

type PositionOptionSelection = "single" | "multiple";
type PositionOptionPricing = "total" | "surcharge";
type PositionOptionVariant = {
  id: string;
  name: string;
  price: string;
};
type PositionOptionGroup = {
  id: string;
  name: string;
  expanded: boolean;
  required: boolean;
  selection: PositionOptionSelection;
  pricing: PositionOptionPricing;
  variants: PositionOptionVariant[];
};

const CATALOG_POSITION_OPTIONS_STORAGE_KEY = catalogStorageKey("positionOptionGroups");

function createOptionEntityId(prefix: "group" | "variant") {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function createOptionGroup(name = ""): PositionOptionGroup {
  return {
    id: createOptionEntityId("group"),
    name,
    expanded: true,
    required: false,
    selection: "single",
    pricing: "total",
    variants: [],
  };
}

function seedOptionGroups(count: number): PositionOptionGroup[] {
  const names = ["Размер", "Добавки", "Соус", "Степень прожарки"];
  return Array.from({ length: count }, (_, index) => ({
    ...createOptionGroup(names[index] ?? `Группа ${index + 1}`),
    expanded: index === 0,
  }));
}
const LOCALIZED_VALUE_PLACEHOLDERS: Record<LanguageCode, string> = {
  ru: "Например, Хит",
  kk: "Мысалы, Хит",
  en: "For example, Hit",
  sr: "Na primer, Hit",
};

type MediaKind = "photo" | "video";
type MediaEntry = {
  id: string;
  kind: MediaKind;
  fileName?: string;
  previewUrl?: string;
  coverMode?: "auto" | "custom";
};
function getStringField(value: unknown, key: LanguageCode) {
  if (!value || typeof value !== "object") return "";
  const field = (value as Partial<Record<LanguageCode, unknown>>)[key];
  return typeof field === "string" ? field : "";
}

function normalizeLocalizedValue(value: Partial<Record<LanguageCode, string>>): LocalizedValue | null {
  const trimmed: Partial<Record<LanguageCode, string>> = {};
  LANGUAGES.forEach((language) => {
    const text = value[language.code]?.trim();
    if (text) trimmed[language.code] = text;
  });
  const primary = trimmed.ru || trimmed.kk || trimmed.en;
  if (!primary) return null;
  return {
    ru: trimmed.ru || primary,
    ...(trimmed.kk ? { kk: trimmed.kk } : {}),
    ...(trimmed.en ? { en: trimmed.en } : {}),
  };
}

function normalizeLocalizedValues(values: Array<Partial<Record<LanguageCode, string>>>) {
  const seen = new Set<string>();
  const normalized: LocalizedValue[] = [];
  values.forEach((value) => {
    const next = normalizeLocalizedValue(value);
    if (!next) return;
    const key = next.ru.toLowerCase();
    if (seen.has(key)) return;
    seen.add(key);
    normalized.push(next);
  });
  return normalized;
}

export function getLocalizedValueLabel(value: LocalizedValue | null | undefined, language: LanguageCode) {
  if (!value) return null;
  return value[language]?.trim() || value.ru.trim() || value.kk?.trim() || value.en?.trim() || null;
}

export function getLocalizedValueFromUnknown(value: unknown, fallback: string | null = null) {
  if (value === null) return null;
  if (value === undefined) return fallback ? normalizeLocalizedValue({ ru: fallback }) : null;
  const normalized = normalizeLocalizedValue({
    ru: getStringField(value, "ru"),
    kk: getStringField(value, "kk"),
    en: getStringField(value, "en"),
  });
  return normalized ?? (fallback ? normalizeLocalizedValue({ ru: fallback }) : null);
}

export function getLocalizedValuesFromUnknown(value: unknown, fallback: string[] = []) {
  if (value === undefined) return normalizeLocalizedValues(fallback.map((text) => ({ ru: text })));
  if (Array.isArray(value)) {
    return normalizeLocalizedValues(
      value.map((entry) => {
        if (typeof entry === "string") return { ru: entry };
        return {
          ru: getStringField(entry, "ru"),
          kk: getStringField(entry, "kk"),
          en: getStringField(entry, "en"),
        };
      }),
    );
  }
  if (value && typeof value === "object") {
    const legacy = value as Partial<Record<LanguageCode, unknown>>;
    const lists = LANGUAGES.map((language) => ({
      code: language.code,
      values: Array.isArray(legacy[language.code]) ? legacy[language.code] as unknown[] : [],
    }));
    const length = Math.max(0, ...lists.map((entry) => entry.values.length));
    return normalizeLocalizedValues(
      Array.from({ length }, (_, index) => ({
        ru: typeof lists[0].values[index] === "string" ? lists[0].values[index] as string : "",
        kk: typeof lists[1].values[index] === "string" ? lists[1].values[index] as string : "",
        en: typeof lists[2].values[index] === "string" ? lists[2].values[index] as string : "",
      })),
    );
  }
  return [];
}

export function getLocalizedValueLabels(values: LocalizedValue[], language: LanguageCode) {
  return values
    .map((value) => getLocalizedValueLabel(value, language))
    .filter((value): value is string => Boolean(value));
}


function MediaTile({
  item,
  entry,
  index,
  onDragStart,
  onDragOver,
  onDrop,
  onRemove,
  onReplace,
}: {
  item: CatalogItem;
  entry: MediaEntry;
  index: number;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDrop: (index: number) => void;
  onRemove: () => void;
  onReplace: () => void;
}) {
  const isVideo = entry.kind === "video";

  return (
    <div
      draggable
      onDragStart={(event) => {
        event.dataTransfer.effectAllowed = "move";
        onDragStart(index);
      }}
      onDragOver={(event) => {
        event.preventDefault();
        onDragOver(index);
      }}
      onDrop={(event) => {
        event.preventDefault();
        onDrop(index);
      }}
      className={cn(
        "group relative shrink-0 cursor-grab overflow-hidden rounded-xl border bg-[#f5f5f4] active:cursor-grabbing",
        "border-zinc-200",
        "h-16 w-16",
      )}
    >
      {isVideo ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
          <Play size={17} weight="fill" className="text-[#57534d]" />
          <span className="max-w-full truncate px-2 text-center text-[10px] leading-tight text-[#79716b]">
            {entry.fileName ?? "video-dish.mp4"}
          </span>
        </div>
      ) : entry.previewUrl ? (
        <img src={entry.previewUrl} alt="" className="h-full w-full object-cover" />
      ) : item.thumbnailUrl ? (
        <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="flex h-full w-full items-center justify-center">
          <ImageBroken size={18} className="text-[#a6a09b]" />
        </div>
      )}

      <span className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-[#79716b] opacity-0 shadow-sm transition group-hover:opacity-100">
        <DotsSixVertical size={15} />
      </span>

      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-[#57534d] opacity-0 shadow-sm transition hover:text-[#292524] group-hover:opacity-100 data-[state=open]:opacity-100"
            aria-label="Действия с медиа"
          >
            <DotsThreeVertical size={16} weight="bold" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownContent align="start">
          <DropdownActionItem onSelect={onReplace}>{isVideo ? "Заменить видео" : "Заменить фото"}</DropdownActionItem>
          {isVideo && <DropdownActionItem onSelect={onReplace}>Поменять обложку</DropdownActionItem>}
          <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
          <DropdownActionItem tone="danger" onSelect={onRemove}>Удалить</DropdownActionItem>
        </DropdownContent>
      </DropdownMenu.Root>
    </div>
  );
}

function BasicMediaStrip({
  item,
  media,
  onAddPhotoFile,
  onAddVideoFile,
  onReorder,
  onRemove,
}: {
  item: CatalogItem;
  media: MediaEntry[];
  onAddPhotoFile: (file: File) => void;
  onAddVideoFile: (file: File) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
}) {
  const [notice, setNotice] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const hasVideo = media.some((entry) => entry.kind === "video");
  const limitReached = VIDEO_LIMIT_USED >= VIDEO_LIMIT_TOTAL;
  const canAddVideo = VIDEO_PACKAGE_CONNECTED && !hasVideo && !limitReached;

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const openPhotoPicker = () => photoInputRef.current?.click();
  const openVideoPicker = () => {
    if (!VIDEO_PACKAGE_CONNECTED) return setNotice("Видео доступно в пакете");
    if (hasVideo) return setNotice("У позиции уже есть видео");
    if (limitReached) return setNotice(`Лимит ${VIDEO_LIMIT_TOTAL} из ${VIDEO_LIMIT_TOTAL}`);
    videoInputRef.current?.click();
  };
  const handlePhotoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) onAddPhotoFile(file);
  };
  const handleVideoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (file) onAddVideoFile(file);
  };
  const handleDrop = (toIndex: number) => {
    if (dragIndex == null || dragIndex === toIndex) {
      setDragIndex(null);
      return;
    }
    onReorder(dragIndex, toIndex);
    setDragIndex(null);
  };

  return (
    <div>
      <input ref={photoInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFileChange} />
      <input ref={videoInputRef} type="file" accept="video/mp4,video/quicktime,video/webm,video/*" className="hidden" onChange={handleVideoFileChange} />

      <div className="mb-1.5 text-[13px] leading-5 text-[#303030]">Медиа</div>
      <div className="flex flex-wrap items-start gap-2">
        {media.map((entry, index) => (
          <MediaTile
            key={entry.id}
            item={item}
            entry={entry}
            index={index}
            onDragStart={setDragIndex}
            onDragOver={() => {}}
            onDrop={handleDrop}
            onRemove={() => onRemove(entry.id)}
            onReplace={() => {
              if (entry.kind === "video") {
                setNotice("Замена видео будет подключена позже");
                return;
              }
              openPhotoPicker();
            }}
          />
        ))}

        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl border border-dashed border-[#d6d3d1] text-[#79716b] transition hover:border-[#a8a29e] hover:bg-[#fafaf9] hover:text-[#292524]"
            >
              <Plus size={18} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownContent align="start">
            <DropdownActionItem onSelect={openPhotoPicker}>Добавить фото</DropdownActionItem>
            <DropdownActionItem onSelect={openVideoPicker}>
              <span className={cn("flex w-full items-center justify-between gap-3", !canAddVideo && "text-[#a8a29e]")}>
                <span>Добавить видео</span>
                {!VIDEO_PACKAGE_CONNECTED ? <Lock size={13} /> : <span className="text-[11px] text-[#a8a29e]">{VIDEO_LIMIT_USED}/{VIDEO_LIMIT_TOTAL}</span>}
              </span>
            </DropdownActionItem>
            <div className="px-2 py-1 text-[11px] text-[#a8a29e]">
              {limitReached && !hasVideo ? "Лимит 10 из 10" : `${VIDEO_LIMIT_USED} из ${VIDEO_LIMIT_TOTAL} активных позиций`}
            </div>
          </DropdownContent>
        </DropdownMenu.Root>
      </div>

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-[100003] -translate-x-1/2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">
          {notice}
        </div>
      )}
    </div>
  );
}

// Поле макета редактора: подпись сверху, контент в белой рамке h-9.
function EditorField({ label, rightSlot, children }: { label: string; rightSlot?: ReactNode; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <div className="mb-1.5 flex min-h-5 flex-wrap items-center gap-x-2 gap-y-0.5">
        <div className="min-w-0 flex-1 text-[13px] leading-5 text-[#303030]">{label}</div>
        {rightSlot}
      </div>
      <div className="flex h-9 w-full items-center gap-2 rounded-[8px] border border-[#e5e5e5] bg-white px-3 shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition focus-within:border-[#c7c2bd]">
        {children}
      </div>
    </div>
  );
}

const WEIGHT_UNITS = ["г", "кг", "мл", "л", "шт"];

type DiscountSource = "percent" | "finalPrice";

function parseMoneyInput(value: string): number | null {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  if (normalized === "") return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function formatMoneyInput(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(Math.round(value));
}

function formatPlainNumber(value: number): string {
  return new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 3 }).format(value);
}

function formatDiscountPercent(value: number): string {
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : String(rounded).replace(".", ",");
}

function calculateDiscountedPrice(basePrice: number, percent: number): number {
  return Math.round(basePrice * (1 - percent / 100));
}

function calculateDiscountPercent(basePrice: number, discountedPrice: number): number {
  if (basePrice <= 0) return 0;
  return ((basePrice - discountedPrice) / basePrice) * 100;
}

function isNumericDraft(value: string): boolean {
  return value === "" || /^\d*(?:[.,]\d*)?$/.test(value);
}

function isFormattedNumericDraft(value: string): boolean {
  return value === "" || /^[\d\s]*(?:[.,]\d*)?$/.test(value);
}

const DESCRIPTION_LIMIT = 300;

function BasicTab({
  item,
  media,
  basePriceText,
  basePrice,
  weightUnit,
  discountOpen,
  discountAutofocusKey,
  onWeightUnitChange,
  onBasePriceChange,
  onBasePriceBlur,
  onAddDiscount,
  onRemoveDiscount,
  onAddPhotoFile,
  onAddVideoFile,
  onReorderMedia,
  onRemoveMedia,
  onDescriptionChange,
  autoFocusName = false,
  namePlaceholder = "Введите перевод…",
  onNameChange,
  onWeightChange,
  onTitleChange,
}: {
  item: CatalogItem;
  media: MediaEntry[];
  basePriceText: string;
  basePrice: number | null;
  weightUnit: string;
  discountOpen: boolean;
  discountAutofocusKey: number;
  onWeightUnitChange: (unit: string) => void;
  onBasePriceChange: (value: string) => void;
  onBasePriceBlur: () => void;
  onAddDiscount: () => void;
  onRemoveDiscount: () => void;
  onAddPhotoFile: (file: File) => void;
  onAddVideoFile: (file: File) => void;
  onReorderMedia: (fromIndex: number, toIndex: number) => void;
  onRemoveMedia: (id: string) => void;
  onDescriptionChange?: (value: string) => void;
  autoFocusName?: boolean;
  namePlaceholder?: string;
  onNameChange?: (value: string) => void;
  onWeightChange?: (value: string, unit: string) => void;
  onTitleChange?: (value: string) => void;
}) {
  const [initialWeightValue, initialWeightUnit] = item.weightLabel
    ? [item.weightLabel.replace(/[^\d.,]/g, "").trim(), item.weightLabel.replace(/[\d.,\s]/g, "").trim() || "г"]
    : ["", "г"];
  const [weightText, setWeightText] = useState(initialWeightValue ? formatPlainNumber(parseMoneyInput(initialWeightValue) ?? 0) : "");

  useEffect(() => {
    setWeightText(initialWeightValue ? formatPlainNumber(parseMoneyInput(initialWeightValue) ?? 0) : "");
  }, [item.id, initialWeightUnit, initialWeightValue]);

  const inlineInputClass =
    "min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]";

  return (
    <div className="space-y-3">
      <div data-media-editor-anchor>
        <BasicMediaStrip
          item={item}
          media={media}
          onAddPhotoFile={onAddPhotoFile}
          onAddVideoFile={onAddVideoFile}
          onReorder={onReorderMedia}
          onRemove={onRemoveMedia}
        />
      </div>

      <TranslatableField
        key={`name-${item.id}`}
        label="Название"
        initialTranslations={{ ru: item.title }}
        storageKey={autoFocusName ? undefined : `item-name-${item.id}`}
        showTranslationMeta={false}
        plain
        autoFocus={autoFocusName}
        persist={!autoFocusName}
        placeholder={namePlaceholder}
        onValueChange={onNameChange}
        onChange={(translations) => onTitleChange?.(translations.ru ?? item.title)}
      />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <EditorField label="Цена">
            <input value={basePriceText} onChange={(event) => onBasePriceChange(event.target.value)} onBlur={onBasePriceBlur} placeholder="0" className={inlineInputClass} />
            <span className="shrink-0 text-[13px] text-[#a6a09b]">₸</span>
          </EditorField>
          {!discountOpen && (
            <button
              type="button"
              onClick={onAddDiscount}
              className="mt-1.5 inline-flex h-5 items-center gap-1 rounded-[6px] px-0.5 text-[12px] font-medium leading-5 text-[#79716b] transition hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              <PlusCircle size={14} className="text-[#a8a29e]" />
              Добавить скидку
            </button>
          )}
        </div>

        <div data-weight-editor-anchor>
          <EditorField label="Объем">
            <input
              value={weightText}
              onChange={(event) => {
                if (isFormattedNumericDraft(event.target.value)) {
                  setWeightText(event.target.value);
                  onWeightChange?.(event.target.value, weightUnit);
                }
              }}
              onBlur={() => {
                const value = parseMoneyInput(weightText);
                if (value != null) setWeightText(formatPlainNumber(value));
                onWeightChange?.(weightText, weightUnit);
              }}
              placeholder="—"
              className={inlineInputClass}
            />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" className="flex shrink-0 items-center gap-1.5 rounded-[6px] text-[13px] text-[#666] transition hover:text-[#292524]">
                  {weightUnit}
                  <CaretDown size={13} className="text-[#a8a29e]" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownContent align="end">
                {WEIGHT_UNITS.map((u) => (
                  <DropdownActionItem key={u} onSelect={() => onWeightUnitChange(u)}>{u}</DropdownActionItem>
                ))}
              </DropdownContent>
            </DropdownMenu.Root>
          </EditorField>
        </div>
      </div>

      {discountOpen && (
        <DiscountBlock
          item={item}
          basePrice={basePrice}
          autofocusKey={discountAutofocusKey}
          onRemove={onRemoveDiscount}
        />
      )}

      <div data-description-editor-anchor>
        <DescriptionRichTextEditor
        key={`desc-${item.id}`}
        initialValue={item.description}
        placeholder="Кратко опишите состав, вкус или способ подачи"
          onChange={onDescriptionChange}
          limit={DESCRIPTION_LIMIT}
        />
      </div>
    </div>
  );
}

// ── Скидка и КБЖУ — опциональные блоки под карточкой (паттерн «Ещё») ──────────

function EditorBlockHeader({
  label,
  meta,
  onRemove,
  removeLabel,
}: {
  label: string;
  meta?: ReactNode;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="mb-1.5 flex h-7 items-center">
      <div className="flex min-w-0 items-center gap-1.5">
        <div className="text-[13px] font-medium leading-[18px] text-[#303030]">{label}</div>
        {meta && <div className="truncate text-[12px] leading-5 text-[#79716b]">{meta}</div>}
      </div>
      <div className="flex-1" />
      <button
        type="button"
        title={removeLabel}
        aria-label={removeLabel}
        onClick={onRemove}
        className="ml-1 flex h-7 w-7 items-center justify-center rounded-[8px] text-[#a8a29e] opacity-0 transition hover:bg-[#fef2f2] hover:text-[#dc2626] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 group-hover:opacity-100 group-focus-within:opacity-100"
      >
        <Trash size={15} />
      </button>
    </div>
  );
}

function DiscountInputField({
  label,
  value,
  suffix,
  onChange,
  onBlur,
  onStep,
  disabled,
  autoFocus,
}: {
  label: string;
  value: string;
  suffix: string;
  onChange: (value: string) => void;
  onBlur?: () => void;
  onStep?: (direction: 1 | -1, large: boolean) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <label className="min-w-0">
      <div className="mb-1 text-[13px] leading-5 text-[#79716b]">{label}</div>
      <div className={cn(
        "flex h-[30px] w-full items-center gap-2 rounded-[8px] border border-[#e5e5e5] bg-white px-2 shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition focus-within:border-[#c7c2bd]",
        disabled && "bg-[#fafaf9] text-[#a8a29e]",
      )}>
        <Input
          size="compact"
          type="text"
          inputMode="decimal"
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => {
            if (!onStep || (event.key !== "ArrowUp" && event.key !== "ArrowDown")) return;
            event.preventDefault();
            onStep(event.key === "ArrowUp" ? 1 : -1, event.shiftKey);
          }}
          onBlur={onBlur}
          disabled={disabled}
          placeholder="0"
          className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none disabled:text-[#a8a29e]"
        />
        <span className="shrink-0 text-[13px] text-[#a6a09b]">{suffix}</span>
      </div>
    </label>
  );
}

function DiscountBlock({
  item,
  basePrice,
  autofocusKey,
  onRemove,
}: {
  item: CatalogItem;
  basePrice: number | null;
  autofocusKey: number;
  onRemove: () => void;
}) {
  const initialFinalPrice = item.priceWithSale ?? (item.price > 0 ? calculateDiscountedPrice(item.price, 10) : null);
  const initialPercent =
    item.price > 0 && initialFinalPrice != null
      ? calculateDiscountPercent(item.price, initialFinalPrice)
      : 10;
  const [, setDiscountSource] = useState<DiscountSource | null>("percent");
  const discountSourceRef = useRef<DiscountSource | null>("percent");
  const [percentText, setPercentText] = useState(formatDiscountPercent(initialPercent));
  const [finalPriceText, setFinalPriceText] = useState(initialFinalPrice == null ? "" : formatMoneyInput(initialFinalPrice));

  useEffect(() => {
    const nextFinalPrice = item.priceWithSale ?? (item.price > 0 ? calculateDiscountedPrice(item.price, 10) : null);
    const nextPercent =
      item.price > 0 && nextFinalPrice != null
        ? calculateDiscountPercent(item.price, nextFinalPrice)
        : 10;
    discountSourceRef.current = "percent";
    setDiscountSource("percent");
    setPercentText(formatDiscountPercent(nextPercent));
    setFinalPriceText(nextFinalPrice == null ? "" : formatMoneyInput(nextFinalPrice));
  }, [item.id, item.price, item.priceWithSale]);

  useEffect(() => {
    if (!basePrice || basePrice <= 0) return;
    if (discountSourceRef.current === "percent") {
      const percent = parseMoneyInput(percentText);
      if (percent == null || percent < 0 || percent > 100) return;
      setFinalPriceText(formatMoneyInput(calculateDiscountedPrice(basePrice, percent)));
      return;
    }
    if (discountSourceRef.current === "finalPrice") {
      const finalPrice = parseMoneyInput(finalPriceText);
      if (finalPrice == null || finalPrice < 0) return;
      setPercentText(formatDiscountPercent(calculateDiscountPercent(basePrice, finalPrice)));
    }
  }, [basePrice, percentText, finalPriceText]);

  const baseMissing = !basePrice || basePrice <= 0;
  const percentValue = parseMoneyInput(percentText);
  const finalPriceValue = parseMoneyInput(finalPriceText);
  const percentError = percentText !== "" && percentValue != null && percentValue > 100
    ? "Скидка не может быть больше 100%"
    : "";
  const finalPriceError =
    !baseMissing && finalPriceText !== "" && finalPriceValue != null && finalPriceValue > basePrice
      ? "Цена после скидки не может быть выше основной цены"
      : "";

  const handlePercentChange = (value: string) => {
    if (!isNumericDraft(value)) return;
    discountSourceRef.current = "percent";
    setDiscountSource("percent");
    setPercentText(value);
    const percent = parseMoneyInput(value);
    if (baseMissing || percent == null || percent < 0 || percent > 100) return;
    setFinalPriceText(formatMoneyInput(calculateDiscountedPrice(basePrice, percent)));
  };

  const handleFinalPriceChange = (value: string) => {
    if (!isNumericDraft(value)) return;
    discountSourceRef.current = "finalPrice";
    setDiscountSource("finalPrice");
    setFinalPriceText(value);
    const finalPrice = parseMoneyInput(value);
    if (baseMissing || finalPrice == null || finalPrice < 0 || finalPrice > basePrice) return;
    setPercentText(formatDiscountPercent(calculateDiscountPercent(basePrice, finalPrice)));
  };

  const normalizePercentOnBlur = () => {
    const percent = parseMoneyInput(percentText);
    if (percent == null) return;
    const normalized = Math.min(100, Math.max(0, percent));
    discountSourceRef.current = "percent";
    setPercentText(formatDiscountPercent(normalized));
    if (!baseMissing) setFinalPriceText(formatMoneyInput(calculateDiscountedPrice(basePrice, normalized)));
  };

  const normalizeFinalPriceOnBlur = () => {
    const finalPrice = parseMoneyInput(finalPriceText);
    if (finalPrice == null || baseMissing) return;
    if (finalPrice < 0) {
      setFinalPriceText("0");
      setPercentText("100");
      discountSourceRef.current = "finalPrice";
    }
  };

  const stepPercent = (direction: 1 | -1, large: boolean) => {
    const current = parseMoneyInput(percentText) ?? 0;
    const next = Math.min(100, Math.max(0, current + direction * (large ? 5 : 1)));
    handlePercentChange(formatDiscountPercent(next));
  };

  const stepFinalPrice = (direction: 1 | -1, large: boolean) => {
    const current = parseMoneyInput(finalPriceText) ?? 0;
    const step = large ? 1000 : 100;
    const max = basePrice && basePrice > 0 ? basePrice : Number.POSITIVE_INFINITY;
    const next = Math.min(max, Math.max(0, current + direction * step));
    handleFinalPriceChange(formatMoneyInput(next));
  };

  const removeDiscount = () => {
    discountSourceRef.current = null;
    setDiscountSource(null);
    setPercentText("");
    setFinalPriceText("");
    onRemove();
  };

  return (
    <div className="relative pt-1.5">
      <div className="pointer-events-none absolute -top-0.5 left-[24%] hidden h-0 w-0 border-x-[7px] border-b-[7px] border-x-transparent border-b-[#f5f5f4] sm:block" />
      <div className="rounded-[10px] bg-[#f5f5f4]/90 px-3 pb-3 pt-2">
        <div className="grid items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_28px]">
          <DiscountInputField
            label="Размер скидки"
            value={percentText}
            suffix="%"
            onChange={handlePercentChange}
            onBlur={normalizePercentOnBlur}
            onStep={stepPercent}
            disabled={baseMissing}
            autoFocus={autofocusKey > 0}
          />
          <DiscountInputField
            label="Цена после скидки"
            value={finalPriceText}
            suffix="₸"
            onChange={handleFinalPriceChange}
            onBlur={normalizeFinalPriceOnBlur}
            onStep={stepFinalPrice}
            disabled={baseMissing}
          />
          <Tooltip label="Убрать скидку" side="top">
            <button
              type="button"
              aria-label="Убрать скидку"
              onClick={removeDiscount}
              className="flex h-[30px] w-[30px] items-center justify-center rounded-[8px] text-[#a8a29e] transition hover:bg-white hover:text-[#57534d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 sm:mb-0"
            >
              <XCircle size={16} />
            </button>
          </Tooltip>
        </div>
        {baseMissing ? (
          <div className="mt-2 text-[12px] leading-4 text-[#79716b]">Сначала укажите основную цену</div>
        ) : finalPriceError ? (
          <div className="mt-2 text-[12px] leading-4 text-[#b42318]">{finalPriceError}</div>
        ) : percentError ? (
          <div className="mt-2 text-[12px] leading-4 text-[#b42318]">{percentError}</div>
        ) : null}
      </div>
    </div>
  );
}

type NutritionBase = "100g" | "100ml" | "portion";
type NutritionKey = "calories" | "protein" | "fat" | "carbs";

const NUTRITION_BASE_LABELS: Record<NutritionBase, string> = {
  "100g": "На 100 г",
  "100ml": "На 100 мл",
  portion: "На позицию",
};

const NUTRITION_FIELDS: { key: NutritionKey; label: string; suffix: string }[] = [
  { key: "calories", label: "Калорийность", suffix: "ккал" },
  { key: "protein", label: "Белки", suffix: "г" },
  { key: "fat", label: "Жиры", suffix: "г" },
  { key: "carbs", label: "Углеводы", suffix: "г" },
];

function getAutoNutritionBase(unit: string): NutritionBase {
  const normalized = unit.trim().toLowerCase();
  if (normalized === "г" || normalized === "кг") return "100g";
  if (normalized === "мл" || normalized === "л") return "100ml";
  return "portion";
}

function KbjuBlock({ weightUnit, onRemove }: { weightUnit: string; onRemove: () => void }) {
  const [values, setValues] = useState<Record<NutritionKey, string>>({
    calories: "",
    protein: "",
    fat: "",
    carbs: "",
  });

  const base = getAutoNutritionBase(weightUnit);
  const hasValues = Object.values(values).some((value) => value.trim() !== "");
  const calories = parseMoneyInput(values.calories);
  const protein = parseMoneyInput(values.protein);
  const fat = parseMoneyInput(values.fat);
  const carbs = parseMoneyInput(values.carbs);
  const macroSum = (protein ?? 0) + (fat ?? 0) + (carbs ?? 0);
  const warning =
    calories != null && calories > 1200
      ? "Проверьте значение — оно выглядит слишком высоким"
      : base === "100g" && macroSum > 100
        ? "Проверьте значение — сумма БЖУ больше 100 г"
        : "";

  const removeNutrition = () => {
    if (hasValues && !window.confirm("Удалить заполненное КБЖУ?")) return;
    setValues({ calories: "", protein: "", fat: "", carbs: "" });
    onRemove();
  };

  return (
    <div className="group">
      <EditorBlockHeader
        label="КБЖУ"
        meta={NUTRITION_BASE_LABELS[base]}
        removeLabel="Удалить КБЖУ"
        onRemove={removeNutrition}
      />
      <div className="rounded-[13px] border border-[#e7e5e4] bg-white px-4 py-3 shadow-[0_1px_2px_rgba(12,12,13,0.05)]">
        <div className="grid grid-cols-1 gap-2 min-[460px]:grid-cols-2 lg:grid-cols-4">
          {NUTRITION_FIELDS.map((field) => (
            <label key={field.key} className="min-w-0">
              <div className="mb-1.5 text-[13px] leading-5 text-[#303030]">{field.label}</div>
              <div className="flex h-[30px] items-center gap-1 rounded-[8px] border border-[#e5e5e5] bg-white px-2 shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition focus-within:border-[#c7c2bd]">
                <Input
                  size="compact"
                  type="text"
                  inputMode="decimal"
                  value={values[field.key]}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!isNumericDraft(next)) return;
                    setValues((current) => ({ ...current, [field.key]: next }));
                  }}
                  placeholder="0"
                  className="h-auto min-w-0 flex-1 border-0 bg-transparent p-0 shadow-none"
                />
                <span className="shrink-0 text-[12px] text-[#a6a09b]">{field.suffix}</span>
              </div>
            </label>
          ))}
        </div>
        {warning && <div className="mt-2 text-[12px] leading-5 text-[#b45309]">{warning}</div>}
      </div>
    </div>
  );
}

export function CatalogThumb({ item, size = 30 }: { item: CatalogItem; size?: number }) {
  return (
    <span
      className="flex shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[#f5f5f4]"
      style={{ width: size, height: size }}
    >
      {item.thumbnailUrl ? (
        <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
      ) : (
        <ImageBroken size={size <= 24 ? 13 : 16} className="text-[#a8a29e]" />
      )}
    </span>
  );
}

function PromoChip({
  children,
  onClick,
  onRemove,
  removeLabel,
}: {
  children: ReactNode;
  onClick?: () => void;
  onRemove?: () => void;
  removeLabel?: string;
}) {
  return (
    <span className="group/chip inline-flex h-[22px] max-w-[190px] items-center rounded-[6px] bg-[#f5f5f4] pl-2 pr-1 text-[12px] font-medium leading-[22px] text-[#292524]">
      <button
        type="button"
        onClick={onClick}
        className="min-w-0 truncate rounded-[4px] text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      >
        {children}
      </button>
      {onRemove && (
        <Tooltip label={removeLabel ?? "Удалить"} side="top">
          <button
            type="button"
            aria-label={removeLabel ?? "Удалить"}
            onClick={(event) => {
              event.stopPropagation();
              onRemove();
            }}
            className="ml-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[#a8a29e] opacity-0 transition hover:text-[#dc2626] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 group-hover/chip:opacity-100"
          >
            <XCircle size={13} />
          </button>
        </Tooltip>
      )}
    </span>
  );
}

function PromoLabel({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Tooltip label={tooltip} side="top">
      <span className="cursor-default border-b border-dotted border-[#a8a29e] text-[13px] font-medium leading-5 text-[#292524]">
        {label}
      </span>
    </Tooltip>
  );
}

function ItemSelectorDialog({
  currentItem,
  items,
  selectedIds,
  onAdd,
  onClose,
}: {
  currentItem: CatalogItem;
  items: CatalogItem[];
  selectedIds: string[];
  onAdd: (ids: string[], reciprocal: boolean) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sectionFilterId, setSectionFilterId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
  const [reciprocal, setReciprocal] = useState(false);
  const selectedSet = new Set(selectedIds);
  const normalizedQuery = query.trim().toLowerCase();
  const baseItems = items.filter((candidate) =>
    candidate.id !== currentItem.id &&
    candidate.status !== "archive" &&
    !selectedSet.has(candidate.id)
  );
  const sectionOrder = new Map(catalogSections.map((section, index) => [section.id, index]));
  const sectionOptions = Array.from(
    new Map(baseItems.map((candidate) => [candidate.sectionId, { id: candidate.sectionId, name: candidate.sectionName }])).values(),
  ).sort((a, b) => (sectionOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (sectionOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, "ru"));
  const selectedSection = sectionOptions.find((section) => section.id === sectionFilterId) ?? null;
  const visibleItems = baseItems
    .filter((candidate) => !sectionFilterId || candidate.sectionId === sectionFilterId)
    .filter((candidate) => !normalizedQuery || getItemSearchText(candidate).includes(normalizedQuery))
    .slice(0, 120);
  const groupedItems = Array.from(
    visibleItems.reduce((groups, candidate) => {
      const existing = groups.get(candidate.sectionId);
      if (existing) {
        existing.items.push(candidate);
      } else {
        groups.set(candidate.sectionId, {
          id: candidate.sectionId,
          name: candidate.sectionName,
          items: [candidate],
        });
      }
      return groups;
    }, new Map<string, { id: string; name: string; items: CatalogItem[] }>()),
  ).map(([, group]) => group);
  const checkedCount = checkedIds.length;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const toggle = (id: string) => {
    setCheckedIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  };
  const submit = () => {
    const next = checkedIds.filter((id) => id !== currentItem.id && !selectedSet.has(id));
    if (next.length === 0) return;
    onAdd(next, reciprocal);
    onClose();
  };

  return (
    createPortal(
      <div className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true" aria-label="Добавить рекомендуемые позиции">
        <div className="flex max-h-[82vh] w-full max-w-[420px] flex-col overflow-hidden rounded-[14px] border border-[#e7e5e4] bg-white shadow-[0_24px_64px_rgba(41,37,36,0.18)]">
          <div className="shrink-0 border-b border-[#eceae7] px-4 py-3">
            <div className="text-[14px] font-medium text-[#292524]">Добавить рекомендуемые позиции</div>
            <div className="mt-3 flex items-center gap-2">
              <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-[9px] border border-[#e7e5e4] bg-white px-2.5 text-[#a8a29e]">
                <MagnifyingGlass size={15} />
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  autoFocus
                  placeholder="Найти позицию"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
                />
              </label>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    aria-label="Фильтр по разделу"
                    className="flex h-9 max-w-[150px] shrink-0 items-center gap-1.5 rounded-[9px] border border-[#e7e5e4] bg-white px-2.5 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f8f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                  >
                    <span className="min-w-0 truncate">{selectedSection?.name ?? "Всё меню"}</span>
                    <CaretDown size={13} className="shrink-0 text-[#a8a29e]" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-[100006] max-h-[280px] min-w-[220px] overflow-y-auto rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
                  >
                    <DropdownActionItem onSelect={() => setSectionFilterId(null)}>Всё меню</DropdownActionItem>
                    {sectionOptions.map((section) => (
                      <DropdownActionItem key={section.id} onSelect={() => setSectionFilterId(section.id)}>
                        <span className="min-w-0 truncate">{section.name}</span>
                      </DropdownActionItem>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          </div>
          <div className="min-h-[220px] flex-1 overflow-y-auto px-2 py-2">
            {groupedItems.map((group) => (
              <div key={group.id} className="py-1">
                <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-[0.06em] text-[#a8a29e]">{group.name}</div>
                {group.items.map((candidate) => {
                  const checked = checkedIds.includes(candidate.id);
                  const statusText = candidate.status === "stopped"
                    ? "На стопе"
                    : candidate.status === "coming-soon"
                      ? "Скоро будет"
                      : candidate.scheduled
                        ? "По расписанию"
                        : "";
                  return (
                    <button
                      key={candidate.id}
                      type="button"
                      onClick={() => toggle(candidate.id)}
                      className={cn(
                        "flex h-[52px] w-full items-center gap-2 rounded-[10px] px-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                        checked ? "bg-[#f5f5f4]" : "hover:bg-[#fafaf9]",
                      )}
                    >
                      <CatalogThumb item={candidate} size={32} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13px] font-medium leading-4 text-[#292524]">{candidate.title}</span>
                        <span className="block truncate text-[12px] leading-4 text-[#79716b]">
                          {statusText ? `${candidate.sectionName} · ${statusText}` : candidate.sectionName}
                        </span>
                      </span>
                      <span
                        aria-hidden="true"
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] border transition",
                          checked ? "border-[#292524] bg-[#292524] text-white" : "border-[#d6d3d1] bg-white text-transparent",
                        )}
                      >
                        <CheckCircle size={14} weight="fill" />
                      </span>
                    </button>
                  );
                })}
              </div>
            ))}
            {visibleItems.length === 0 && (
              <div className="px-3 py-6 text-center text-[13px] text-[#79716b]">Подходящие позиции не найдены</div>
            )}
          </div>
          <div className="shrink-0 border-t border-[#eceae7] px-4 py-3">
            <label className="flex cursor-pointer items-start gap-2.5 rounded-[8px] py-1 text-[13px] text-[#44403b]">
              <input
                type="checkbox"
                checked={reciprocal}
                onChange={(event) => setReciprocal(event.target.checked)}
                className="mt-0.5 h-4 w-4 shrink-0 rounded-[4px] border border-[#d6d3d1] accent-[#292524]"
              />
              <span>
                <span className="block font-medium">Рекомендовать позиции друг друга</span>
                <span className="mt-0.5 block text-[12px] leading-4 text-[#79716b]">Создаст две независимые связи, порядок каждой настраивается отдельно.</span>
              </span>
            </label>
            <div className="mt-3 flex items-center gap-2">
              <div className="min-w-0 flex-1 text-[13px] text-[#79716b]">Выбрано: {checkedCount}</div>
              <button type="button" onClick={onClose} className="h-8 rounded-[8px] px-3 text-[13px] text-[#79716b] transition hover:bg-[#f5f5f4]">
                Отмена
              </button>
              <button
                type="button"
                disabled={checkedCount === 0}
                onClick={submit}
                className="h-8 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b] disabled:cursor-not-allowed disabled:bg-[#d6d3d1]"
              >
                {checkedCount === 0 ? "Добавить" : `Добавить ${checkedCount}`}
              </button>
            </div>
          </div>
        </div>
      </div>,
      document.body,
    )
  );
}

function LocalizedValueInputs({
  value,
  onChange,
  autoFocus = false,
}: {
  value: Partial<Record<LanguageCode, string>>;
  onChange: (next: Partial<Record<LanguageCode, string>>) => void;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-2">
      {LANGUAGES.map((language, index) => (
        <label key={language.code} className="block">
          <span className="mb-1 block text-[12px] leading-4 text-[#79716b]">{language.label}</span>
          <input
            value={value[language.code] ?? ""}
            onChange={(event) => onChange({ ...value, [language.code]: event.target.value })}
            autoFocus={autoFocus && index === 0}
            placeholder={LOCALIZED_VALUE_PLACEHOLDERS[language.code]}
            className="h-9 w-full rounded-[9px] border border-[#e7e5e4] bg-white px-2.5 text-[13px] text-[#292524] outline-none transition placeholder:text-[#a8a29e] focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5"
          />
        </label>
      ))}
    </div>
  );
}

function LocalizedValueDialog({
  title,
  description,
  value,
  deleteLabel,
  onSave,
  onDelete,
  onClose,
}: {
  title: string;
  description: string;
  value: LocalizedValue | null;
  deleteLabel?: string;
  onSave: (value: LocalizedValue | null) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const [draft, setDraft] = useState<Partial<Record<LanguageCode, string>>>(value ?? { ru: "" });

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const submit = () => {
    onSave(normalizeLocalizedValue(draft));
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="flex max-h-[82vh] w-full max-w-[420px] flex-col overflow-hidden rounded-[14px] border border-[#e7e5e4] bg-white shadow-[0_24px_64px_rgba(41,37,36,0.18)]">
        <div className="border-b border-[#eceae7] px-4 py-3">
          <div className="text-[14px] font-medium text-[#292524]">{title}</div>
          <div className="mt-0.5 text-[12px] leading-4 text-[#79716b]">{description}</div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          <LocalizedValueInputs value={draft} onChange={setDraft} autoFocus />
        </div>
        <div className="flex shrink-0 justify-between gap-2 border-t border-[#eceae7] px-4 py-3">
          {onDelete ? (
            <button
              type="button"
              onClick={() => {
                onDelete();
                onClose();
              }}
              className="h-8 rounded-[8px] px-3 text-[13px] text-[#dc2626] transition hover:bg-[#fef2f2]"
            >
              {deleteLabel ?? "Удалить"}
            </button>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="h-8 rounded-[8px] px-3 text-[13px] text-[#79716b] transition hover:bg-[#f5f5f4]">
              Отмена
            </button>
            <button type="button" onClick={submit} className="h-8 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]">
              Сохранить
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function PromoCompactCard({
  label,
  tooltip,
  cardName,
  children,
}: {
  label: string;
  tooltip: string;
  cardName: "sticker" | "tags" | "keywords";
  children: ReactNode;
}) {
  return (
    <div
      data-upsell-card={cardName}
      className="flex min-h-12 w-full items-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-left shadow-sm transition hover:bg-[#fdfdfc] focus-within:ring-2 focus-within:ring-[#292524]/10"
    >
      <span className="shrink-0">
        <PromoLabel label={label} tooltip={tooltip} />
      </span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">{children}</div>
    </div>
  );
}

function PromoAddButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <Tooltip label={label} side="top">
      <button
        type="button"
        aria-label={label}
        onClick={onClick}
        className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-[6px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      >
        <PlusCircle size={16} />
      </button>
    </Tooltip>
  );
}

function SortableRecommendationRow({
  id,
  children,
}: {
  id: string;
  children: (args: {
    setActivatorNodeRef: (element: HTMLElement | null) => void;
    dragProps: Record<string, unknown>;
    isDragging: boolean;
  }) => ReactNode;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id, transition: DND_TRANSITION });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: reducedMotion ? undefined : transition,
        zIndex: isDragging ? 2 : undefined,
      }}
      className={cn(
        "group relative flex h-[30px] items-center gap-2 rounded-[8px] transition-colors hover:bg-[#f8f7f4]",
        isDragging && "cursor-grabbing bg-white opacity-80 shadow-[0_8px_24px_rgba(41,37,36,0.12)]",
      )}
    >
      {children({
        setActivatorNodeRef,
        dragProps: { ...attributes, ...listeners },
        isDragging,
      })}
    </div>
  );
}

export function PromoRecommendationsCard({
  item,
  allItems,
  upsell,
  onChange,
  onManualAdd,
  onGenerate,
  isReciprocal,
  generationBusy = false,
}: {
  item: CatalogItem;
  allItems: CatalogItem[];
  upsell: CatalogItemUpsellState;
  onChange: (next: CatalogItemUpsellState) => void;
  onManualAdd?: (ids: string[], reciprocal: boolean) => void;
  onGenerate?: (mode: "supplement" | "regenerate") => void;
  isReciprocal?: (recommendationId: string) => boolean;
  generationBusy?: boolean;
}) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
  const recommendationSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const recommendationIds = resolveRecommendationIds(item, allItems, upsell);
  const recommendations = recommendationIds
    .map((id) => allItems.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is CatalogItem => Boolean(candidate));
  const recommendationSources = Object.fromEntries(
    recommendationIds.map((id) => [id, resolveRecommendationSource(upsell, id)]),
  ) as Record<string, CatalogRecommendationSource>;
  const automaticCount = recommendationIds.filter((id) => recommendationSources[id] === "automatic").length;
  const setRecommendationIds = (
    ids: string[],
    sources: Record<string, CatalogRecommendationSource> = recommendationSources,
  ) => onChange({
    ...upsell,
    recommendationIds: ids,
    recommendationSources: Object.fromEntries(ids.map((id) => [id, sources[id] ?? "manual"])),
  });
  const handleRecommendationDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const fromIndex = recommendationIds.indexOf(String(active.id));
    const toIndex = recommendationIds.indexOf(String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;
    setRecommendationIds(arrayMove(recommendationIds, fromIndex, toIndex));
  };
  const addManually = (ids: string[], reciprocal: boolean) => {
    if (onManualAdd) {
      onManualAdd(ids, reciprocal);
      return;
    }
    const additions = ids.filter((id) => id !== item.id && !recommendationIds.includes(id));
    setRecommendationIds(
      [...recommendationIds, ...additions],
      { ...recommendationSources, ...Object.fromEntries(additions.map((id) => [id, "manual" as const])) },
    );
  };
  const generate = (mode: "supplement" | "regenerate") => {
    if (onGenerate) {
      onGenerate(mode);
      return;
    }
    const baseIds = mode === "regenerate"
      ? recommendationIds.filter((id) => recommendationSources[id] === "manual")
      : recommendationIds;
    const additions = buildAutomaticRecommendations(item, allItems, baseIds);
    setRecommendationIds(
      [...baseIds, ...additions.map((entry) => entry.id)],
      {
        ...Object.fromEntries(baseIds.map((id) => [id, recommendationSources[id] ?? "manual"])),
        ...Object.fromEntries(additions.map((entry) => [entry.id, "automatic" as const])),
      },
    );
  };
  const localActionLabel = recommendations.length === 0
    ? "Подобрать для этой позиции"
    : "Дополнить автоматически";

  return (
    <>
      <div data-upsell-card="recommendations" className="overflow-hidden rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
        <div className="flex items-start justify-between gap-3 px-4 pb-2 pt-4">
          <div>
            <h3 className="text-[13px] font-medium leading-5 text-[#292524]">Рекомендуемые позиции</h3>
            <p className="text-[13px] leading-5 text-[#79716b]">показываются гостю при открытии позиции</p>
          </div>
          <span className="shrink-0 rounded-full bg-[#f5f5f4] px-2 py-1 text-[11px] tabular-nums text-[#79716b]">
            {recommendations.length} из {CATALOG_RECOMMENDATION_LIMIT}
          </span>
        </div>
        {recommendations.length > 0 ? (
          <DndContext
            sensors={recommendationSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictTableSortToVerticalAxis]}
            onDragEnd={handleRecommendationDragEnd}
          >
            <SortableContext items={recommendationIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-2 px-4 pb-3">
                {recommendations.map((recommended) => (
                  <SortableRecommendationRow key={recommended.id} id={recommended.id}>
                    {({ setActivatorNodeRef, dragProps }) => (
                      <>
                        <Tooltip label="Изменить порядок" side="top">
                          <button
                            ref={setActivatorNodeRef}
                            type="button"
                            aria-label={`Изменить порядок рекомендации «${recommended.title}»`}
                            {...dragProps}
                            className="flex h-[30px] w-5 shrink-0 touch-none cursor-grab items-center justify-center rounded-[6px] text-[#a8a29e] transition hover:bg-[#f5f5f4] hover:text-[#57534d] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                          >
                            <DotsSixVertical size={16} />
                          </button>
                        </Tooltip>
                        <CatalogThumb item={recommended} size={30} />
                        <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-4 text-[#292524]">{recommended.title}</span>
                        <span className={cn(
                          "shrink-0 rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium",
                          recommendationSources[recommended.id] === "automatic"
                            ? "bg-[#f0fdf4] text-[#15803d]"
                            : "bg-[#f5f5f4] text-[#79716b]",
                        )}>
                          {recommendationSources[recommended.id] === "automatic" ? "Автоматически" : "Вручную"}
                        </span>
                        {isReciprocal?.(recommended.id) && (
                          <Tooltip label="Эти позиции рекомендуются друг у друга" side="top">
                            <span className="shrink-0 cursor-default rounded-[5px] bg-[#eef2ff] px-1.5 py-0.5 text-[10px] font-medium text-[#4f46e5]">
                              ↔ Взаимная
                            </span>
                          </Tooltip>
                        )}
                        <Tooltip label="Удалить рекомендацию" side="top">
                          <button
                            type="button"
                            aria-label={`Удалить рекомендацию «${recommended.title}»`}
                            onClick={() => setRecommendationIds(recommendationIds.filter((id) => id !== recommended.id))}
                            className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-[#a8a29e] opacity-0 transition hover:bg-[#f5f5f4] hover:text-[#dc2626] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 group-hover:opacity-100"
                          >
                            <XCircle size={18} />
                          </button>
                        </Tooltip>
                      </>
                    )}
                  </SortableRecommendationRow>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : (
          <div className="px-4 pb-4 pt-1">
            <div className="rounded-[10px] border border-dashed border-[#e7e5e4] bg-[#fafaf9] px-4 py-5 text-center">
              <p className="text-[13px] font-medium text-[#57534d]">Рекомендуемые позиции не настроены</p>
              <p className="mt-1 text-[12px] leading-4 text-[#8a8179]">Добавьте позиции вручную или запустите подбор только для этой позиции.</p>
            </div>
          </div>
        )}
        <div className="border-t border-[#eceae7]">
          <div className="flex items-center">
            <button
              type="button"
              disabled={generationBusy || recommendations.length >= CATALOG_RECOMMENDATION_LIMIT}
              onClick={() => generate("supplement")}
              className="flex h-10 min-w-0 flex-1 items-center gap-2 px-4 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f8f7f4] disabled:cursor-not-allowed disabled:text-[#a8a29e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10"
            >
              <Asterisk size={15} weight="bold" className="shrink-0" />
              <span className="truncate">{generationBusy ? "Подбираем…" : localActionLabel}</span>
            </button>
            {automaticCount > 0 && (
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    aria-label="Дополнительные действия"
                    className="mr-2 flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                  >
                    <DotsThree size={17} weight="bold" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownContent align="end">
                  <DropdownMenu.Item
                    onSelect={() => setRegenerateConfirmOpen(true)}
                    className="flex h-8 cursor-pointer select-none items-center rounded-[8px] px-2.5 text-[13px] text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                  >
                    Подобрать заново
                  </DropdownMenu.Item>
                </DropdownContent>
              </DropdownMenu.Root>
            )}
          </div>
          <button
            type="button"
            disabled={recommendations.length >= CATALOG_RECOMMENDATION_LIMIT}
            onClick={() => setSelectorOpen(true)}
            className="flex h-10 w-full items-center gap-2 border-t border-[#eceae7] px-4 text-[12px] font-medium text-[#79716b] transition hover:bg-[#f8f7f4] hover:text-[#44403b] disabled:cursor-not-allowed disabled:text-[#a8a29e] disabled:hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10"
          >
            <PlusCircle size={16} />
            Добавить рекомендацию вручную
          </button>
        </div>
      </div>

      {selectorOpen && (
        <ItemSelectorDialog
          currentItem={item}
          items={allItems}
          selectedIds={recommendationIds}
          onAdd={addManually}
          onClose={() => setSelectorOpen(false)}
        />
      )}
      {regenerateConfirmOpen && createPortal(
        <div className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true" aria-label="Подобрать рекомендуемые позиции заново">
          <div className="w-full max-w-[400px] rounded-[14px] border border-[#e7e5e4] bg-white shadow-[0_24px_64px_rgba(41,37,36,0.18)]">
            <div className="px-4 py-4">
              <h3 className="text-[14px] font-medium text-[#292524]">Подобрать заново?</h3>
              <p className="mt-2 text-[13px] leading-5 text-[#79716b]">
                Автоматически созданные связи этой позиции будут заменены. Добавленные вручную рекомендации сохранятся.
              </p>
            </div>
            <div className="flex justify-end gap-2 border-t border-[#eceae7] px-4 py-3">
              <button type="button" onClick={() => setRegenerateConfirmOpen(false)} className="h-8 rounded-[8px] px-3 text-[13px] text-[#79716b] transition hover:bg-[#f5f5f4]">Отмена</button>
              <button
                type="button"
                onClick={() => {
                  setRegenerateConfirmOpen(false);
                  generate("regenerate");
                }}
                className="h-8 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]"
              >
                Подобрать заново
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

type PromoLocalizedDialogState =
  | { kind: "sticker"; index: 0 | null }
  | { kind: "tags" | "keywords"; index: number | null };

export function PromoTab({
  item,
  upsell,
  onChange,
}: {
  item: CatalogItem;
  upsell: CatalogItemUpsellState;
  onChange: (next: CatalogItemUpsellState) => void;
}) {
  const { contentLanguage } = useAppSettings();
  const [localizedDialog, setLocalizedDialog] = useState<PromoLocalizedDialogState | null>(null);
  const stickerValue = getLocalizedValueFromUnknown(upsell.sticker, item.guestLabels[0] ?? null);
  const tagValues = getLocalizedValuesFromUnknown(upsell.tags, item.tags);
  const keywordValues = getLocalizedValuesFromUnknown(upsell.keywords, []);
  const sticker = getLocalizedValueLabel(stickerValue, contentLanguage);

  const patch = (next: CatalogItemUpsellState) => onChange(next);
  const updateLocalizedList = (key: "tags" | "keywords", values: LocalizedValue[]) => {
    patch({ ...upsell, [key]: normalizeLocalizedValues(values) });
  };
  const updateSticker = (value: LocalizedValue | null) => {
    patch({ ...upsell, sticker: value });
  };
  const saveLocalizedDialogValue = (value: LocalizedValue | null) => {
    if (!localizedDialog) return;
    if (localizedDialog.kind === "sticker") {
      updateSticker(value);
      return;
    }

    const currentValues = localizedDialog.kind === "tags" ? tagValues : keywordValues;
    const nextValues = localizedDialog.index == null
      ? value ? [...currentValues, value] : currentValues
      : value
        ? currentValues.map((entry, index) => index === localizedDialog.index ? value : entry)
        : currentValues.filter((_, index) => index !== localizedDialog.index);
    updateLocalizedList(localizedDialog.kind, nextValues);
  };
  const deleteLocalizedDialogValue = () => {
    if (!localizedDialog) return;
    if (localizedDialog.kind === "sticker") {
      updateSticker(null);
      return;
    }
    if (localizedDialog.index == null) return;
    const currentValues = localizedDialog.kind === "tags" ? tagValues : keywordValues;
    updateLocalizedList(localizedDialog.kind, currentValues.filter((_, index) => index !== localizedDialog.index));
  };
  const dialogValue = localizedDialog?.kind === "sticker"
    ? localizedDialog.index === 0 ? stickerValue : null
    : localizedDialog?.kind === "tags"
      ? localizedDialog.index == null ? null : tagValues[localizedDialog.index] ?? null
      : localizedDialog?.kind === "keywords"
        ? localizedDialog.index == null ? null : keywordValues[localizedDialog.index] ?? null
        : null;
  const dialogTitle = localizedDialog?.kind === "sticker"
    ? "Стикер"
    : localizedDialog?.kind === "tags"
      ? "Тег"
      : "Ключевое слово";
  const dialogDescription = localizedDialog?.kind === "sticker"
    ? "Заполните значение для нужных языков"
    : localizedDialog?.kind === "tags"
      ? "Помогает гостю понять особенности и состав позиции"
      : "Используется для поиска позиции в онлайн-меню";
  const dialogDeleteLabel = localizedDialog?.kind === "sticker"
    ? "Убрать"
    : localizedDialog?.kind === "tags"
      ? "Удалить тег"
      : "Удалить ключевое слово";

  return (
    <>
      <div data-upsell-stack className="flex flex-col gap-2">
        <PromoCompactCard cardName="sticker" label="Стикер" tooltip="Короткая метка, которая выделяет позицию в меню">
          {sticker && (
            <PromoChip
              onClick={() => setLocalizedDialog({ kind: "sticker", index: 0 })}
              onRemove={() => updateSticker(null)}
              removeLabel="Убрать стикер"
            >
              {sticker}
            </PromoChip>
          )}
          <PromoAddButton label="Добавить стикер" onClick={() => setLocalizedDialog({ kind: "sticker", index: null })} />
        </PromoCompactCard>

        <PromoCompactCard cardName="tags" label="Теги" tooltip="Помогают гостю понять особенности и состав позиции">
          {tagValues.map((tag, index) => {
            const label = getLocalizedValueLabel(tag, contentLanguage);
            if (!label) return null;
            return (
              <PromoChip
                key={`${tag.ru}-${index}`}
                onClick={() => setLocalizedDialog({ kind: "tags", index })}
                onRemove={() => updateLocalizedList("tags", tagValues.filter((_, valueIndex) => valueIndex !== index))}
                removeLabel="Удалить тег"
              >
                {label}
              </PromoChip>
            );
          })}
          <PromoAddButton label="Добавить тег" onClick={() => setLocalizedDialog({ kind: "tags", index: null })} />
        </PromoCompactCard>

        <PromoCompactCard cardName="keywords" label="Ключевые слова" tooltip="Используются для поиска позиции в онлайн-меню">
          {keywordValues.map((keyword, index) => {
            const label = getLocalizedValueLabel(keyword, contentLanguage);
            if (!label) return null;
            return (
              <PromoChip
                key={`${keyword.ru}-${index}`}
                onClick={() => setLocalizedDialog({ kind: "keywords", index })}
                onRemove={() => updateLocalizedList("keywords", keywordValues.filter((_, valueIndex) => valueIndex !== index))}
                removeLabel="Удалить ключевое слово"
              >
                {label}
              </PromoChip>
            );
          })}
          <PromoAddButton label="Добавить ключевое слово" onClick={() => setLocalizedDialog({ kind: "keywords", index: null })} />
        </PromoCompactCard>
      </div>

      {localizedDialog && (
        <LocalizedValueDialog
          title={dialogTitle}
          description={dialogDescription}
          value={dialogValue}
          deleteLabel={dialogDeleteLabel}
          onSave={saveLocalizedDialogValue}
          onDelete={localizedDialog.index == null ? undefined : deleteLocalizedDialogValue}
          onClose={() => setLocalizedDialog(null)}
        />
      )}
    </>
  );
}

function StopQuickActionButton({
  item,
  busy,
  onToggleStop,
}: {
  item: CatalogItem;
  busy: boolean;
  onToggleStop: (item: CatalogItem) => void;
}) {
  if (item.status !== "active" && item.status !== "stopped") return null;
  const stopped = item.status === "stopped";
  const label = stopped ? "Снять со стопа" : "Поставить на стоп";

  return (
    <CatalogActionButton
      icon={stopped ? ArrowCounterClockwise : Prohibit}
      onClick={() => onToggleStop(item)}
      disabled={busy}
      loading={busy}
      tooltipLabel={label}
      ariaLabel={label}
    >
      {label}
    </CatalogActionButton>
  );
}

function getAvailabilityMode(item: CatalogItem): AvailabilityMode {
  if (item.status === "stopped") return "unavailable";
  if (item.scheduled) return "schedule";
  return "always";
}

const DAY_LABELS: { key: ScheduleDayKey; label: string }[] = [
  { key: "monday", label: "Понедельник" },
  { key: "tuesday", label: "Вторник" },
  { key: "wednesday", label: "Среда" },
  { key: "thursday", label: "Четверг" },
  { key: "friday", label: "Пятница" },
  { key: "saturday", label: "Суббота" },
  { key: "sunday", label: "Воскресенье" },
];

const JS_DAY_TO_SCHEDULE_KEY: Record<number, ScheduleDayKey> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

export function createDefaultWeeklySchedule(): WeeklySchedule {
  return {
    monday: { mode: "custom", intervals: [{ start: "09:00", end: "18:00" }] },
    tuesday: { mode: "allDay" },
    wednesday: { mode: "unavailable" },
    thursday: { mode: "allDay" },
    friday: { mode: "unavailable" },
    saturday: { mode: "allDay" },
    sunday: { mode: "allDay" },
  };
}

function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

function validateDaySchedule(day: DaySchedule): string[] {
  if (day.mode !== "custom") return [];
  const errors: string[] = [];
  const intervals = day.intervals;
  const normalized = intervals.map((interval) => ({
    start: timeToMinutes(interval.start),
    end: timeToMinutes(interval.end),
  }));

  normalized.forEach((interval) => {
    if (interval.start == null || interval.end == null) {
      errors.push("Укажите время");
    } else if (interval.start >= interval.end) {
      errors.push("Время начала должно быть раньше времени окончания");
    }
  });

  const valid = normalized
    .filter((interval): interval is { start: number; end: number } => interval.start != null && interval.end != null && interval.start < interval.end)
    .sort((a, b) => a.start - b.start);
  for (let index = 1; index < valid.length; index += 1) {
    if (valid[index - 1].end > valid[index].start) {
      errors.push("Интервалы не должны пересекаться");
      break;
    }
  }

  return Array.from(new Set(errors));
}

export function isWeeklyScheduleValid(schedule: WeeklySchedule) {
  return DAY_LABELS.every((day) => validateDaySchedule(schedule[day.key]).length === 0);
}

export function getEffectiveAvailability(
  item: CatalogItem,
  now: Date,
  settings: {
    unavailableDisplayMode: UnavailableDisplayMode;
    outsideScheduleMode: OutsideScheduleMode;
    weeklySchedule: WeeklySchedule;
  },
) {
  if (item.status === "archive") return { visible: false, orderable: false, badge: "В архиве" as const };
  if (getAvailabilityMode(item) === "unavailable") {
    return {
      visible: settings.unavailableDisplayMode === "comingSoon",
      orderable: false,
      badge: settings.unavailableDisplayMode === "comingSoon" ? ("Скоро будет" as const) : null,
    };
  }
  if (getAvailabilityMode(item) === "always") return { visible: true, orderable: true, badge: null };

  const day = settings.weeklySchedule[JS_DAY_TO_SCHEDULE_KEY[now.getDay()]];
  if (day.mode === "allDay") return { visible: true, orderable: true, badge: null };
  if (day.mode === "unavailable") {
    return {
      visible: settings.outsideScheduleMode === "comingSoon",
      orderable: false,
      badge: settings.outsideScheduleMode === "comingSoon" ? ("Скоро будет" as const) : null,
    };
  }
  const minute = now.getHours() * 60 + now.getMinutes();
  const inside = day.intervals.some((interval) => {
    const start = timeToMinutes(interval.start);
    const end = timeToMinutes(interval.end);
    return start != null && end != null && start < end && minute >= start && minute < end;
  });
  return inside
    ? { visible: true, orderable: true, badge: null }
    : {
        visible: settings.outsideScheduleMode === "comingSoon",
        orderable: false,
        badge: settings.outsideScheduleMode === "comingSoon" ? ("Скоро будет" as const) : null,
      };
}

type AvailabilityOption = {
  id: AvailabilityMode;
  title: string;
  description: string;
  disabled?: boolean;
};

type AvailabilityNestedDisplayCopy = {
  label: string;
  hiddenText: string;
  comingSoonText: string;
};

function AvailabilityEditor({
  mode,
  options,
  ariaLabel,
  scheduleId,
  unavailableDisplayMode,
  outsideScheduleMode,
  weeklySchedule,
  onModeChange,
  onUnavailableDisplayModeChange,
  onOutsideScheduleModeChange,
  onWeeklyScheduleChange,
  unavailableNested,
  scheduleNested,
}: {
  mode: AvailabilityMode;
  options: AvailabilityOption[];
  ariaLabel: string;
  scheduleId: string;
  unavailableDisplayMode?: UnavailableDisplayMode;
  outsideScheduleMode: OutsideScheduleMode;
  weeklySchedule: WeeklySchedule;
  onModeChange: (mode: AvailabilityMode) => void;
  onUnavailableDisplayModeChange?: (mode: UnavailableDisplayMode) => void;
  onOutsideScheduleModeChange: (mode: OutsideScheduleMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  unavailableNested?: AvailabilityNestedDisplayCopy;
  scheduleNested: AvailabilityNestedDisplayCopy;
}) {
  const updateDay = (dayKey: ScheduleDayKey, day: DaySchedule) => {
    onWeeklyScheduleChange({ ...weeklySchedule, [dayKey]: day });
  };

  const renderSegmented = <T extends string,>(
    value: T,
    onChange: (next: T) => void,
    options: { id: T; label: string }[],
    ariaLabel: string,
  ) => (
    <div role="group" aria-label={ariaLabel} className="inline-flex h-7 rounded-[8px] bg-[#f5f5f4] p-0.5">
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          onClick={() => onChange(option.id)}
          className={cn(
            "rounded-[7px] px-2.5 text-[12px] font-medium leading-5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
            value === option.id ? "bg-white text-[#292524] shadow-sm" : "text-[#79716b] hover:text-[#292524]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );

  const renderNestedDisplay = (
    label: string,
    value: UnavailableDisplayMode | OutsideScheduleMode,
    onChange: (next: "hidden" | "comingSoon") => void,
    hiddenText: string,
    comingSoonText: string,
  ) => (
    <div className="ml-[9px] border-l border-[#e7e5e4] py-2 pl-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[13px] leading-5 text-[#79716b]">{label}</span>
        {renderSegmented(value, onChange, [
          { id: "hidden", label: "Скрыто" },
          { id: "comingSoon", label: "Скоро будет" },
        ], label)}
      </div>
      <div className="mt-2 text-[13px] leading-5 text-[#57534d]">
        {value === "hidden" ? hiddenText : comingSoonText}
      </div>
    </div>
  );

  const renderDayRow = (dayKey: ScheduleDayKey, label: string) => {
    const day = weeklySchedule[dayKey];
    const errors = validateDaySchedule(day);
    const muted = day.mode === "unavailable";
    const setMode = (nextMode: DaySchedule["mode"]) => {
      if (nextMode === "custom") {
        updateDay(dayKey, day.mode === "custom" ? day : { mode: "custom", intervals: [{ start: "09:00", end: "18:00" }] });
      } else {
        updateDay(dayKey, { mode: nextMode });
      }
    };
    const intervals = day.mode === "custom" ? day.intervals : [];

    return (
      <div key={dayKey} className={cn("border-b border-[#eceae7] last:border-b-0", muted && "text-[#a8a29e]")}>
        <div className="flex min-h-[46px] flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2">
          <div className={cn("w-[112px] shrink-0 text-[13px] font-medium leading-5", muted ? "text-[#a8a29e]" : "text-[#44403b]")}>
            {label}
          </div>
          <div className="min-w-[190px] flex-1">
            {day.mode === "allDay" && <div className="text-[13px] leading-5 text-[#79716b]">Круглосуточно</div>}
            {day.mode === "unavailable" && <div className="text-[13px] leading-5 text-[#a8a29e]">Недоступно</div>}
            {day.mode === "custom" && (
              <div className="space-y-1.5">
                {intervals.map((interval, index) => {
                  const errorId = `${scheduleId}-${dayKey}-${index}-time-error`;
                  const intervalErrors = validateDaySchedule({ mode: "custom", intervals: [interval] });
                  return (
                    <div key={index} className="flex flex-wrap items-center gap-2">
                      <input
                        type="time"
                        value={interval.start}
                        aria-label={`${label}: начало интервала ${index + 1}`}
                        aria-describedby={intervalErrors.length > 0 ? errorId : undefined}
                        onChange={(event) => {
                          const nextIntervals = intervals.map((current, currentIndex) =>
                            currentIndex === index ? { ...current, start: event.target.value } : current,
                          );
                          updateDay(dayKey, { mode: "custom", intervals: nextIntervals });
                        }}
                        className="h-[30px] rounded-[8px] border border-[#e5e5e5] bg-white px-2 text-[13px] text-[#292524] outline-none transition focus:border-[#c7c2bd]"
                      />
                      <span className="text-[13px] text-[#a8a29e]">—</span>
                      <input
                        type="time"
                        value={interval.end}
                        aria-label={`${label}: конец интервала ${index + 1}`}
                        aria-describedby={intervalErrors.length > 0 ? errorId : undefined}
                        onChange={(event) => {
                          const nextIntervals = intervals.map((current, currentIndex) =>
                            currentIndex === index ? { ...current, end: event.target.value } : current,
                          );
                          updateDay(dayKey, { mode: "custom", intervals: nextIntervals });
                        }}
                        className="h-[30px] rounded-[8px] border border-[#e5e5e5] bg-white px-2 text-[13px] text-[#292524] outline-none transition focus:border-[#c7c2bd]"
                      />
                      {index > 0 && (
                        <button
                          type="button"
                          aria-label={`${label}: удалить интервал ${index + 1}`}
                          onClick={() => updateDay(dayKey, { mode: "custom", intervals: intervals.filter((_, currentIndex) => currentIndex !== index) })}
                          className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[#a8a29e] transition hover:bg-[#fef2f2] hover:text-[#dc2626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                        >
                          <Trash size={14} />
                        </button>
                      )}
                      {intervalErrors.length > 0 && <div id={errorId} className="basis-full text-[12px] leading-4 text-[#b42318]">{intervalErrors[0]}</div>}
                    </div>
                  );
                })}
                <button
                  type="button"
                  onClick={() => updateDay(dayKey, { mode: "custom", intervals: [...intervals, { start: "17:00", end: "22:00" }] })}
                  className="inline-flex h-7 items-center gap-1 rounded-[7px] px-1.5 text-[12px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <PlusCircle size={13} />
                  Добавить интервал
                </button>
              </div>
            )}
          </div>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="ml-auto flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                aria-label={`${label}: режим доступности`}
              >
                {day.mode === "allDay" ? "Круглосуточно" : day.mode === "custom" ? "Свое время" : "Недоступно"}
                <CaretDown size={12} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownContent align="end">
              <DropdownActionItem onSelect={() => setMode("allDay")}>Круглосуточно</DropdownActionItem>
              <DropdownActionItem onSelect={() => setMode("custom")}>Свое время</DropdownActionItem>
              <DropdownActionItem onSelect={() => setMode("unavailable")}>Недоступно</DropdownActionItem>
            </DropdownContent>
          </DropdownMenu.Root>
        </div>
        {errors.length > 0 && day.mode === "custom" && (
          <div className="px-3 pb-2 pl-[128px] text-[12px] leading-4 text-[#b42318]">{errors[0]}</div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div
        role="radiogroup"
        aria-label={ariaLabel}
        className="overflow-hidden rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_1px_2px_rgba(12,12,13,0.05)]"
      >
        {options.map((option) => {
          const selected = option.id === mode;
          return (
            <div key={option.id} className="border-b border-[#eceae7] last:border-b-0">
              <button
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => onModeChange(option.id)}
                disabled={option.disabled}
                className="flex w-full items-start gap-4 p-4 text-left transition hover:bg-[#fbfbf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10 disabled:pointer-events-none disabled:opacity-60"
              >
                <span className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border",
                  selected ? "border-[#292524] bg-[#292524]" : "border-[#d6d3d1] bg-white",
                )}>
                  {selected && <span className="h-2 w-2 rounded-full bg-white" />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[13px] font-medium leading-5 text-[#292524]">{option.title}</span>
                  <span className="mt-0.5 block text-[13px] leading-5 text-[#79716b]">{option.description}</span>
                </span>
              </button>
              {option.id === "unavailable" && selected && unavailableNested && unavailableDisplayMode && onUnavailableDisplayModeChange && (
                <div className="px-4 pb-4">
                  {renderNestedDisplay(
                    unavailableNested.label,
                    unavailableDisplayMode,
                    onUnavailableDisplayModeChange,
                    unavailableNested.hiddenText,
                    unavailableNested.comingSoonText,
                  )}
                </div>
              )}
              {option.id === "schedule" && selected && (
                <div className="px-4 pb-4">
                  {renderNestedDisplay(
                    scheduleNested.label,
                    outsideScheduleMode,
                    onOutsideScheduleModeChange,
                    scheduleNested.hiddenText,
                    scheduleNested.comingSoonText,
                  )}
                  <div className="mt-4 overflow-hidden rounded-[10px] border border-[#e7e5e4] bg-white">
                    {DAY_LABELS.map((day) => renderDayRow(day.key, day.label))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AvailabilityTab({
  item,
  stopBusy,
  onSetAvailabilityMode,
  unavailableDisplayMode,
  outsideScheduleMode,
  weeklySchedule,
  onUnavailableDisplayModeChange,
  onOutsideScheduleModeChange,
  onWeeklyScheduleChange,
}: {
  item: CatalogItem;
  stopBusy: boolean;
  onSetAvailabilityMode: (item: CatalogItem, mode: AvailabilityMode) => void;
  unavailableDisplayMode: UnavailableDisplayMode;
  outsideScheduleMode: OutsideScheduleMode;
  weeklySchedule: WeeklySchedule;
  onUnavailableDisplayModeChange: (mode: UnavailableDisplayMode) => void;
  onOutsideScheduleModeChange: (mode: OutsideScheduleMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
}) {
  return (
    <AvailabilityEditor
      mode={getAvailabilityMode(item)}
      options={[
        {
          id: "always",
          title: "Можно заказать",
          description: "Доступно для заказа в любое время",
        },
        {
          id: "unavailable",
          title: "Нельзя заказать",
          description: "Гости не смогут добавить позицию в заказ",
          disabled: stopBusy,
        },
        {
          id: "schedule",
          title: "По расписанию",
          description: "Доступно только в указанные дни и часы",
        },
      ]}
      ariaLabel="Доступность позиции"
      scheduleId={item.id}
      unavailableDisplayMode={unavailableDisplayMode}
      outsideScheduleMode={outsideScheduleMode}
      weeklySchedule={weeklySchedule}
      onModeChange={(mode) => onSetAvailabilityMode(item, mode)}
      onUnavailableDisplayModeChange={onUnavailableDisplayModeChange}
      onOutsideScheduleModeChange={onOutsideScheduleModeChange}
      onWeeklyScheduleChange={onWeeklyScheduleChange}
      unavailableNested={{
        label: "В меню:",
        hiddenText: "Позиция не будет отображаться в меню, пока недоступна",
        comingSoonText: "Позиция останется в меню с отметкой «Скоро будет»",
      }}
      scheduleNested={{
        label: "Вне расписания:",
        hiddenText: "Позиция не будет отображаться в меню вне расписания",
        comingSoonText: "Позиция останется в меню с отметкой «Скоро будет» вне расписания",
      }}
    />
  );
}

export function SectionAvailabilityTab({
  sectionId,
  mode,
  outsideScheduleMode,
  weeklySchedule,
  onModeChange,
  onOutsideScheduleModeChange,
  onWeeklyScheduleChange,
}: {
  sectionId: string;
  mode: AvailabilityMode;
  outsideScheduleMode: OutsideScheduleMode;
  weeklySchedule: WeeklySchedule;
  onModeChange: (mode: AvailabilityMode) => void;
  onOutsideScheduleModeChange: (mode: OutsideScheduleMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
}) {
  return (
    <AvailabilityEditor
      mode={mode}
      options={[
        {
          id: "always",
          title: "Показывать всегда",
          description: "Раздел отображается в меню в любое время",
        },
        {
          id: "unavailable",
          title: "На стопе",
          description: "Раздел остаётся на витрине, но позиции нельзя заказать",
        },
        {
          id: "schedule",
          title: "По расписанию",
          description: "Раздел отображается только в указанные дни и часы",
        },
      ]}
      ariaLabel="Доступность раздела"
      scheduleId={`section-${sectionId}`}
      outsideScheduleMode={outsideScheduleMode}
      weeklySchedule={weeklySchedule}
      onModeChange={onModeChange}
      onOutsideScheduleModeChange={onOutsideScheduleModeChange}
      onWeeklyScheduleChange={onWeeklyScheduleChange}
      scheduleNested={{
        label: "Вне расписания:",
        hiddenText: "Раздел не будет отображаться в меню вне расписания",
        comingSoonText: "Гости увидят раздел, но не смогут открыть доступные для заказа позиции до начала расписания",
      }}
    />
  );
}

type DisplayModeOption = CatalogItem["displayMode"];

const DISPLAY_MODE_OPTIONS: { id: DisplayModeOption; title: string; text: string }[] = [
  { id: "full", title: "Полное", text: "Фото, цена и кнопка заказа" },
  { id: "no-button", title: "Без кнопки", text: "Цена видна, заказ скрыт" },
  { id: "no-price", title: "Без цены и кнопки", text: "Только описание позиции" },
];

function DisplayModePreview({ item, mode }: { item: CatalogItem; mode: DisplayModeOption }) {
  return (
    <div className="rounded-[10px] border border-[#e7e5e4] bg-white p-2">
      <div className="flex gap-2">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[8px] bg-[#f5f5f4]">
          {item.thumbnailUrl ? (
            <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <ImageBroken size={15} className="text-[#bc4a08]" />
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="h-2.5 w-4/5 rounded-full bg-[#292524]" />
          <div className="mt-1.5 h-2 w-full rounded-full bg-[#e7e5e4]" />
          <div className="mt-1 h-2 w-2/3 rounded-full bg-[#e7e5e4]" />
          {mode !== "no-price" && (
            <div className="mt-2 h-2.5 w-12 rounded-full bg-[#44403b]" />
          )}
        </div>
      </div>
      {mode === "full" && (
        <div className="mt-2 h-6 rounded-[7px] bg-[#292524]" />
      )}
      {mode === "no-button" && (
        <div className="mt-2 h-6 rounded-[7px] border border-dashed border-[#d6d3d1]" />
      )}
    </div>
  );
}

function DisplayModeCard({
  item,
  option,
  selected,
  onSelect,
}: {
  item: CatalogItem;
  option: (typeof DISPLAY_MODE_OPTIONS)[number];
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-[12px] border p-2 text-left transition",
        selected ? "border-[#292524] bg-white shadow-[0_0_0_1px_#292524]" : "border-[#e7e5e4] bg-[#fafaf9] hover:bg-white",
      )}
    >
      <DisplayModePreview item={item} mode={option.id} />
      <div className="mt-2 flex items-start justify-between gap-2">
        <div>
          <div className="text-[13px] font-semibold leading-5 text-[#292524]">{option.title}</div>
          <div className="text-[11px] leading-4 text-[#79716b]">{option.text}</div>
        </div>
        {selected && <CheckCircle size={15} className="mt-0.5 shrink-0 text-[#2563eb]" />}
      </div>
    </button>
  );
}

function DisplayTab({ item }: { item: CatalogItem }) {
  const [displayMode, setDisplayMode] = useState<DisplayModeOption>(item.displayMode);

  useEffect(() => {
    setDisplayMode(item.displayMode);
  }, [item.id, item.displayMode]);

  return (
    <div className="space-y-6">
      <section>
        <div className="mb-3">
          <h3 className="text-[14px] font-semibold leading-5 text-[#292524]">Вид позиции</h3>
          <p className="mt-1 text-[13px] leading-5 text-[#79716b]">Выберите, какие элементы показывать в карточке позиции.</p>
        </div>
        <div className="grid grid-cols-3 gap-3">
          {DISPLAY_MODE_OPTIONS.map((option) => (
            <DisplayModeCard
              key={option.id}
              item={item}
              option={option}
              selected={displayMode === option.id}
              onSelect={() => setDisplayMode(option.id)}
            />
          ))}
        </div>
        <p className="mt-3 text-[12px] text-[#a8a29e]">Фото и видео позиции — в блоке «Медиа» таба «Основное».</p>
      </section>

    </div>
  );
}

function getInitialMedia(item: CatalogItem): MediaEntry[] {
  return item.thumbnailUrl ? [{ id: "photo-1", kind: "photo" }] : [];
}

type OptionGroupCardProps = {
  group: PositionOptionGroup;
  currency: string;
  draft?: boolean;
  dragHandle?: ReactNode;
  transientVariantIds: Set<string>;
  focusedVariantId: string | null;
  nameInputRef?: RefObject<HTMLInputElement | null>;
  onPatch: (patch: Partial<PositionOptionGroup>) => void;
  onDuplicate?: () => void;
  onDelete?: () => void;
  onBeginVariant: (value: string) => void;
  onPatchVariant: (id: string, patch: Partial<PositionOptionVariant>) => void;
  onVariantNameBlur: (id: string) => void;
  onDeleteVariant: (id: string) => void;
};

function OptionSegment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex shrink-0 items-center rounded-[9px] bg-[#fafaf9] p-0.5">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex h-7 min-w-[84px] items-center justify-center rounded-[7px] px-2.5 text-[13px] transition",
            value === option.value
              ? "bg-[#f1f1ee] font-medium text-[#292524] shadow-[0_1px_2px_rgba(41,37,36,0.06)]"
              : "text-[#79716b] hover:text-[#44403b]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function SortableOptionVariantRow({
  groupId,
  variant,
  currency,
  transient,
  autoFocus,
  onPatch,
  onNameBlur,
  onDelete,
}: {
  groupId: string;
  variant: PositionOptionVariant;
  currency: string;
  transient: boolean;
  autoFocus: boolean;
  onPatch: (patch: Partial<PositionOptionVariant>) => void;
  onNameBlur: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `option-variant:${variant.id}`,
    data: { kind: "option-variant", groupId, variant },
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.35 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="flex min-h-9 w-full items-center gap-1.5">
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Перетащить вариант «${variant.name || "без названия"}»`}
        className="flex h-9 w-5 shrink-0 cursor-grab touch-none items-center justify-center rounded-[6px] text-[#a8a29e] transition hover:bg-[#f5f5f4] hover:text-[#57534d] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={15} />
      </button>
      <input
        autoFocus={autoFocus}
        value={variant.name}
        onChange={(event) => onPatch({ name: event.target.value })}
        onBlur={onNameBlur}
        aria-label="Название варианта"
        aria-invalid={!transient && !variant.name.trim()}
        className={cn(
          "h-9 min-w-0 flex-1 rounded-[8px] border bg-white px-3 text-[13px] text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.08)] outline-none transition placeholder:text-[#a8a29e] focus:border-[#a8a29e]",
          !transient && !variant.name.trim() ? "border-[#fda4af]" : "border-[#e5e5e5]",
        )}
      />
      <div className="relative h-9 w-[142px] shrink-0">
        <input
          value={variant.price}
          inputMode="decimal"
          aria-label="Стоимость варианта"
          onChange={(event) => {
            if (isFormattedNumericDraft(event.target.value)) onPatch({ price: event.target.value });
          }}
          onBlur={() => {
            const value = parseMoneyInput(variant.price);
            onPatch({ price: value == null ? "0" : formatMoneyInput(value) });
          }}
          className="h-9 w-full rounded-[8px] border border-[#e5e5e5] bg-white pl-3 pr-[52px] text-[13px] text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.08)] outline-none transition focus:border-[#a8a29e]"
        />
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-[#79716b]">
          {currency}
        </span>
      </div>
      <Tooltip label="Удалить вариант" side="top">
        <button
          type="button"
          aria-label="Удалить вариант"
          onClick={onDelete}
          className="flex h-9 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#a8a29e] transition hover:bg-[#fff1f2] hover:text-[#e11d48] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <XCircle size={17} />
        </button>
      </Tooltip>
    </div>
  );
}

function OptionGroupCard({
  group,
  currency,
  draft = false,
  dragHandle,
  transientVariantIds,
  focusedVariantId,
  nameInputRef,
  onPatch,
  onDuplicate,
  onDelete,
  onBeginVariant,
  onPatchVariant,
  onVariantNameBlur,
  onDeleteVariant,
}: OptionGroupCardProps) {
  return (
    <div className={cn("overflow-hidden bg-white", draft && "border-y border-[#e7e5e4]")}>
      <div className={cn("flex min-h-12 items-center gap-2 border-b border-[#f5f5f4] px-3", group.expanded && "bg-[#fbfbfa]")}>
        {dragHandle ?? <span className="w-6 shrink-0" />}
        <button
          type="button"
          onClick={() => onPatch({ expanded: !group.expanded })}
          aria-label={group.expanded ? "Свернуть группу" : "Раскрыть группу"}
          className="flex h-8 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] transition hover:bg-[#f1f1ee] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          {group.expanded ? <CaretDown size={15} /> : <CaretRight size={15} />}
        </button>
        <button
          type="button"
          onClick={() => onPatch({ expanded: !group.expanded })}
          className="flex min-w-0 flex-1 items-center gap-1.5 self-stretch text-left focus-visible:outline-none"
        >
          <span className="truncate text-[14px] font-medium text-[#44403b]">{group.name || "Новая группа"}</span>
          <span className="flex h-[17px] min-w-[21px] shrink-0 items-center justify-center rounded-[3px] bg-[#f1f1ee] px-1 text-[11px] tabular-nums text-[#79716b]">
            {group.variants.length}
          </span>
          {draft && <span className="ml-1 text-[11px] font-normal text-[#a8a29e]">Черновик</span>}
        </button>
        {!draft && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={`Действия с группой «${group.name}»`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f1f1ee] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
              >
                <DotsThreeVertical size={18} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownContent align="end">
              <DropdownActionItem onSelect={() => onDuplicate?.()}>Дублировать группу</DropdownActionItem>
              <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
              <DropdownActionItem tone="danger" onSelect={() => onDelete?.()}>Удалить группу</DropdownActionItem>
            </DropdownContent>
          </DropdownMenu.Root>
        )}
      </div>

      {group.expanded && (
        <div className="px-4 pb-3 pt-3">
          <div className="space-y-1.5">
            <label className="block text-[13px] leading-5 text-[#292524]" htmlFor={`option-group-name-${group.id}`}>
              Название группы
            </label>
            <input
              ref={nameInputRef}
              id={`option-group-name-${group.id}`}
              value={group.name}
              onChange={(event) => onPatch({ name: event.target.value })}
              placeholder="Например, Размер"
              className="h-9 w-full rounded-[8px] border border-[#e5e5e5] bg-white px-3 text-[13px] text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.08)] outline-none transition placeholder:text-[#a8a29e] focus:border-[#a8a29e]"
            />
          </div>

          <div className="mt-4 space-y-1.5">
            <div className="text-[13px] leading-5 text-[#292524]">Варианты</div>
            <div className="space-y-1.5">
              <SortableContext
                items={group.variants.map((variant) => `option-variant:${variant.id}`)}
                strategy={verticalListSortingStrategy}
              >
                {group.variants.map((variant) => (
                  <SortableOptionVariantRow
                    key={variant.id}
                    groupId={group.id}
                    variant={variant}
                    currency={currency}
                    transient={transientVariantIds.has(variant.id)}
                    autoFocus={focusedVariantId === variant.id}
                    onPatch={(patch) => onPatchVariant(variant.id, patch)}
                    onNameBlur={() => onVariantNameBlur(variant.id)}
                    onDelete={() => onDeleteVariant(variant.id)}
                  />
                ))}
              </SortableContext>
              <div className="pl-[26px] pr-[35px]">
                <input
                  value=""
                  onChange={(event) => {
                    if (event.target.value) onBeginVariant(event.target.value);
                  }}
                  placeholder="Добавить ещё вариант"
                  aria-label="Добавить ещё вариант"
                  className="h-9 w-full rounded-[8px] border border-[#e5e5e5] bg-white px-3 text-[13px] text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.08)] outline-none transition placeholder:text-[#79716b] focus:border-[#a8a29e]"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 border-t border-[#f1f1ee]">
            <div className="py-2.5 text-[12px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">Правила выбора</div>
            <div className="flex min-h-[46px] items-center justify-between gap-6 border-t border-[#f5f5f4]">
              <span className="text-[13px] text-[#292524]">Гость должен выбрать вариант</span>
              <Switch
                checked={group.required}
                onCheckedChange={(checked) => onPatch({ required: checked })}
                aria-label="Гость должен выбрать вариант"
                className="data-[state=checked]:bg-[#44403b]"
              />
            </div>
            <div className="flex min-h-[52px] items-center justify-between gap-6 border-t border-[#f5f5f4]">
              <span className="text-[13px] text-[#292524]">Можно выбрать</span>
              <OptionSegment<PositionOptionSelection>
                value={group.selection}
                options={[{ value: "single", label: "Один" }, { value: "multiple", label: "Несколько" }]}
                onChange={(selection) => onPatch({ selection })}
              />
            </div>
          </div>

          <div className="border-t border-[#f1f1ee]">
            <div className="py-2.5 text-[12px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">Расчёт цены</div>
            <div className="flex min-h-[58px] items-center justify-between gap-6 border-t border-[#f5f5f4]">
              <div className="min-w-0">
                <div className="text-[13px] text-[#292524]">Как учитывать цену</div>
                <div className="mt-0.5 text-[11px] leading-4 text-[#79716b]">
                  {group.pricing === "total" ? "Итоговая заменяет цену позиции" : "Доплата прибавляется к цене позиции"}
                </div>
              </div>
              <OptionSegment<PositionOptionPricing>
                value={group.pricing}
                options={[{ value: "total", label: "Итоговая" }, { value: "surcharge", label: "Доплата" }]}
                onChange={(pricing) => onPatch({ pricing })}
              />
            </div>
          </div>

          {!draft && group.variants.length === 0 && (
            <p className="mt-2 rounded-[8px] bg-[#fafaf9] px-3 py-2 text-[12px] leading-5 text-[#79716b]">
              Добавьте хотя бы один вариант, чтобы группа появилась на витрине.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function SortableOptionGroupCard(props: Omit<OptionGroupCardProps, "dragHandle">) {
  const { group } = props;
  const { attributes, listeners, setActivatorNodeRef, setNodeRef, transform, transition, isDragging } = useSortable({
    id: `option-group:${group.id}`,
    data: { kind: "option-group", group },
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.3 : 1,
    zIndex: isDragging ? 2 : undefined,
  };
  const handle = (
    <button
      ref={setActivatorNodeRef}
      type="button"
      aria-label={`Перетащить группу «${group.name}»`}
      className="flex h-8 w-6 shrink-0 cursor-grab touch-none items-center justify-center rounded-[6px] text-[#a8a29e] transition hover:bg-[#f1f1ee] hover:text-[#57534d] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      {...attributes}
      {...listeners}
    >
      <DotsSixVertical size={16} />
    </button>
  );
  return (
    <div ref={setNodeRef} style={style} className="relative border-b border-[#e7e5e4] last:border-b-0">
      <OptionGroupCard {...props} dragHandle={handle} />
    </div>
  );
}

function OptionsTab({
  item,
  onSavedGroupsChange,
}: {
  item: CatalogItem;
  onSavedGroupsChange: (count: number) => void;
}) {
  const { account } = useMockAuth();
  const currency = account?.workspace.currency ?? "KZT";
  const [groups, setGroups] = useState<PositionOptionGroup[]>(() => {
    const stored = readJsonRecord<Record<string, PositionOptionGroup[]>>(CATALOG_POSITION_OPTIONS_STORAGE_KEY, {});
    return Array.isArray(stored[item.id]) ? stored[item.id] : seedOptionGroups(item.optionsCount);
  });
  const [draft, setDraft] = useState<PositionOptionGroup | null>(null);
  const [activeDrag, setActiveDrag] = useState<{ kind: "option-group"; group: PositionOptionGroup } | { kind: "option-variant"; variant: PositionOptionVariant } | null>(null);
  const [transientVariantIds, setTransientVariantIds] = useState<Set<string>>(() => new Set());
  const [focusedVariantId, setFocusedVariantId] = useState<string | null>(null);
  const draftRef = useRef<HTMLDivElement | null>(null);
  const draftNameRef = useRef<HTMLInputElement | null>(null);
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: optionKeyboardCoordinates }),
  );

  useEffect(() => {
    const stored = readJsonRecord<Record<string, PositionOptionGroup[]>>(CATALOG_POSITION_OPTIONS_STORAGE_KEY, {});
    setGroups(Array.isArray(stored[item.id]) ? stored[item.id] : seedOptionGroups(item.optionsCount));
    setDraft(null);
    setTransientVariantIds(new Set());
    setFocusedVariantId(null);
  }, [item.id]);

  const commitGroups = (next: PositionOptionGroup[]) => {
    setGroups(next);
    const stored = readJsonRecord<Record<string, PositionOptionGroup[]>>(CATALOG_POSITION_OPTIONS_STORAGE_KEY, {});
    writeJsonRecord(CATALOG_POSITION_OPTIONS_STORAGE_KEY, { ...stored, [item.id]: next });
    onSavedGroupsChange(next.length);
  };

  const patchGroup = (groupId: string, patch: Partial<PositionOptionGroup>) => {
    commitGroups(groups.map((group) => group.id === groupId ? { ...group, ...patch } : group));
  };
  const patchDraft = (patch: Partial<PositionOptionGroup>) => setDraft((current) => current ? { ...current, ...patch } : current);

  const updateGroup = (groupId: string, updater: (group: PositionOptionGroup) => PositionOptionGroup) => {
    if (draft?.id === groupId) {
      setDraft((current) => current ? updater(current) : current);
      return;
    }
    commitGroups(groups.map((group) => group.id === groupId ? updater(group) : group));
  };

  const beginVariant = (groupId: string, value: string) => {
    const id = createOptionEntityId("variant");
    setTransientVariantIds((current) => new Set(current).add(id));
    setFocusedVariantId(id);
    updateGroup(groupId, (group) => ({
      ...group,
      variants: [...group.variants, { id, name: value, price: "0" }],
    }));
  };
  const patchVariant = (groupId: string, variantId: string, patch: Partial<PositionOptionVariant>) => {
    updateGroup(groupId, (group) => ({
      ...group,
      variants: group.variants.map((variant) => variant.id === variantId ? { ...variant, ...patch } : variant),
    }));
  };
  const deleteVariant = (groupId: string, variantId: string) => {
    updateGroup(groupId, (group) => ({ ...group, variants: group.variants.filter((variant) => variant.id !== variantId) }));
    setTransientVariantIds((current) => {
      const next = new Set(current);
      next.delete(variantId);
      return next;
    });
  };
  const handleVariantNameBlur = (groupId: string, variantId: string) => {
    setFocusedVariantId((current) => current === variantId ? null : current);
    if (!transientVariantIds.has(variantId)) return;
    const group = draft?.id === groupId ? draft : groups.find((candidate) => candidate.id === groupId);
    const variant = group?.variants.find((candidate) => candidate.id === variantId);
    if (!variant?.name.trim()) deleteVariant(groupId, variantId);
    else {
      setTransientVariantIds((current) => {
        const next = new Set(current);
        next.delete(variantId);
        return next;
      });
    }
  };

  const groupProps = (group: PositionOptionGroup): Omit<OptionGroupCardProps, "dragHandle"> => ({
    group,
    currency,
    transientVariantIds,
    focusedVariantId,
    onPatch: (patch) => patchGroup(group.id, patch),
    onDuplicate: () => {
      const index = groups.findIndex((candidate) => candidate.id === group.id);
      const copy: PositionOptionGroup = {
        ...group,
        id: createOptionEntityId("group"),
        name: `${group.name} — копия`,
        variants: group.variants.map((variant) => ({ ...variant, id: createOptionEntityId("variant") })),
      };
      const next = [...groups];
      next.splice(index + 1, 0, copy);
      commitGroups(next);
    },
    onDelete: () => {
      if (group.variants.length > 0 && !window.confirm(`Удалить группу «${group.name}» и все её варианты?`)) return;
      commitGroups(groups.filter((candidate) => candidate.id !== group.id));
    },
    onBeginVariant: (value) => beginVariant(group.id, value),
    onPatchVariant: (variantId, patch) => patchVariant(group.id, variantId, patch),
    onVariantNameBlur: (variantId) => handleVariantNameBlur(group.id, variantId),
    onDeleteVariant: (variantId) => deleteVariant(group.id, variantId),
  });

  const startDraft = () => {
    const next = createOptionGroup();
    setDraft(next);
    window.setTimeout(() => {
      draftRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      draftNameRef.current?.focus();
    }, 0);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={optionCollisionDetection}
      onDragStart={({ active }) => {
        const data = active.data.current;
        if (data?.kind === "option-group") setActiveDrag({ kind: "option-group", group: data.group as PositionOptionGroup });
        if (data?.kind === "option-variant") setActiveDrag({ kind: "option-variant", variant: data.variant as PositionOptionVariant });
      }}
      onDragCancel={() => setActiveDrag(null)}
      onDragEnd={({ active, over }) => {
        setActiveDrag(null);
        if (!over || active.id === over.id) return;
        const activeData = active.data.current;
        const overData = over.data.current;
        if (activeData?.kind === "option-group" && overData?.kind === "option-group") {
          const oldIndex = groups.findIndex((group) => `option-group:${group.id}` === active.id);
          const newIndex = groups.findIndex((group) => `option-group:${group.id}` === over.id);
          if (oldIndex >= 0 && newIndex >= 0) commitGroups(arrayMove(groups, oldIndex, newIndex));
          return;
        }
        if (activeData?.kind === "option-variant" && overData?.kind === "option-variant" && activeData.groupId === overData.groupId) {
          const groupId = String(activeData.groupId);
          updateGroup(groupId, (group) => {
            const oldIndex = group.variants.findIndex((variant) => `option-variant:${variant.id}` === active.id);
            const newIndex = group.variants.findIndex((variant) => `option-variant:${variant.id}` === over.id);
            return oldIndex >= 0 && newIndex >= 0 ? { ...group, variants: arrayMove(group.variants, oldIndex, newIndex) } : group;
          });
        }
      }}
    >
      <div className="overflow-hidden rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
        {groups.length === 0 && !draft && (
          <div className="px-4 py-8 text-center">
            <div className="text-[14px] font-medium text-[#44403b]">Групп опций пока нет</div>
            <p className="mt-1 text-[12px] leading-5 text-[#79716b]">Создайте группу, чтобы добавить размеры, соусы или другие варианты.</p>
          </div>
        )}
        <SortableContext items={groups.map((group) => `option-group:${group.id}`)} strategy={verticalListSortingStrategy}>
          {groups.map((group) => <SortableOptionGroupCard key={group.id} {...groupProps(group)} />)}
        </SortableContext>

        {draft && (
          <div ref={draftRef}>
            <OptionGroupCard
              group={draft}
              currency={currency}
              draft
              transientVariantIds={transientVariantIds}
              focusedVariantId={focusedVariantId}
              nameInputRef={draftNameRef}
              onPatch={patchDraft}
              onBeginVariant={(value) => beginVariant(draft.id, value)}
              onPatchVariant={(variantId, patch) => patchVariant(draft.id, variantId, patch)}
              onVariantNameBlur={(variantId) => handleVariantNameBlur(draft.id, variantId)}
              onDeleteVariant={(variantId) => deleteVariant(draft.id, variantId)}
            />
            <div className="flex items-center gap-2 border-b border-[#e7e5e4] px-4 py-3">
              <Button
                type="button"
                size="sm"
                disabled={!draft.name.trim()}
                onClick={() => {
                  commitGroups([...groups, { ...draft, name: draft.name.trim() }]);
                  setDraft(null);
                  setTransientVariantIds((current) => {
                    const next = new Set(current);
                    draft.variants.forEach((variant) => next.delete(variant.id));
                    return next;
                  });
                }}
                className="bg-[#292524] text-white hover:bg-[#44403b]"
              >
                Создать группу
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setTransientVariantIds((current) => {
                    const next = new Set(current);
                    draft.variants.forEach((variant) => next.delete(variant.id));
                    return next;
                  });
                  setDraft(null);
                }}
                className="text-[#57534d] hover:bg-[#f5f5f4]"
              >
                Отмена
              </Button>
            </div>
          </div>
        )}

        <button
          type="button"
          disabled={Boolean(draft)}
          onClick={startDraft}
          className="flex h-11 w-full items-center gap-1.5 px-4 text-[12px] font-medium text-[#79716b] transition hover:bg-[#fafaf9] hover:text-[#44403b] disabled:cursor-not-allowed disabled:opacity-45"
        >
          <PlusCircle size={16} />
          Добавить группу опций
        </button>
      </div>

      <DragOverlay dropAnimation={DND_TRANSITION}>
        {activeDrag?.kind === "option-group" ? (
          <div className="w-[520px] max-w-[70vw] overflow-hidden rounded-[12px] border border-[#d6d3d1] bg-white shadow-[0_16px_44px_rgba(41,37,36,0.18)]">
            <div className="flex h-12 items-center gap-2 px-3 text-[14px] font-medium text-[#44403b]">
              <DotsSixVertical size={16} className="text-[#a8a29e]" />
              <span className="truncate">{activeDrag.group.name}</span>
              <span className="rounded-[3px] bg-[#f1f1ee] px-1 text-[11px] text-[#79716b]">{activeDrag.group.variants.length}</span>
            </div>
          </div>
        ) : activeDrag?.kind === "option-variant" ? (
          <div className="flex h-9 w-[420px] max-w-[65vw] items-center gap-2 rounded-[9px] border border-[#d6d3d1] bg-white px-3 text-[13px] text-[#44403b] shadow-[0_12px_32px_rgba(41,37,36,0.16)]">
            <DotsSixVertical size={15} className="text-[#a8a29e]" />
            <span className="truncate">{activeDrag.variant.name || "Вариант"}</span>
          </div>
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}

export function PositionEditor({
  item,
  mode = "edit",
  allItems,
  upsell,
  onUpsellChange,
  stopBusy,
  onArchiveItem,
  onRestoreItem,
  onMoveItem,
  onToggleStop,
  onSetAvailabilityMode,
  unavailableDisplayMode,
  outsideScheduleMode,
  weeklySchedule,
  onUnavailableDisplayModeChange,
  onOutsideScheduleModeChange,
  onWeeklyScheduleChange,
  onRequestPermanentDelete,
  breadcrumb,
  headerMeta,
  onDescriptionChange,
  onMediaAdded,
  onDraftChange,
  onCreatePosition,
  onBackCreate,
  onBackEdit,
  onCancelCreate,
  createDisabled = false,
  createSubmitting = false,
  onItemChange,
  forcedEditorTab,
  focusAnchor,
  forceBasicTabOnItemChange = false,
  showStopQuickAction = true,
}: {
  item: CatalogItem;
  mode?: PositionEditorMode;
  allItems: CatalogItem[];
  upsell: CatalogItemUpsellState;
  onUpsellChange: (next: CatalogItemUpsellState) => void;
  stopBusy: boolean;
  onArchiveItem: (item: CatalogItem) => void;
  onRestoreItem: (item: CatalogItem) => void;
  onMoveItem: (item: CatalogItem, anchor: MovePopoverAnchor) => void;
  onToggleStop: (item: CatalogItem) => void;
  onSetAvailabilityMode: (item: CatalogItem, mode: AvailabilityMode) => void;
  unavailableDisplayMode: UnavailableDisplayMode;
  outsideScheduleMode: OutsideScheduleMode;
  weeklySchedule: WeeklySchedule;
  onUnavailableDisplayModeChange: (mode: UnavailableDisplayMode) => void;
  onOutsideScheduleModeChange: (mode: OutsideScheduleMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  onRequestPermanentDelete: (item: CatalogItem) => void;
  breadcrumb?: ReactNode;
  headerMeta?: ReactNode;
  onDescriptionChange?: (item: CatalogItem, value: string) => void;
  onMediaAdded?: (item: CatalogItem, previewUrl: string) => void;
  onDraftChange?: (patch: Partial<CatalogItem>) => void;
  onCreatePosition?: () => void;
  onBackCreate?: () => void;
  onBackEdit?: () => void;
  onCancelCreate?: () => void;
  createDisabled?: boolean;
  createSubmitting?: boolean;
  onItemChange?: (item: CatalogItem, patch: Partial<CatalogItem>) => void;
  forcedEditorTab?: EditorTab;
  focusAnchor?: EditorFocusAnchor;
  forceBasicTabOnItemChange?: boolean;
  showStopQuickAction?: boolean;
}) {
  const [activeTab, setActiveTab] = useState<EditorTab>(() => editorTabByItem.get(item.id) ?? "basic");
  const editorScrollRef = useRef<HTMLDivElement | null>(null);
  const [media, setMedia] = useState<MediaEntry[]>(() => getInitialMedia(item));
  const [basePriceText, setBasePriceText] = useState(item.price ? formatMoneyInput(item.price) : "");
  const initialEditorWeightUnit = item.weightLabel?.replace(/[\d.,\s]/g, "").trim() || "г";
  const [weightUnit, setWeightUnit] = useState(initialEditorWeightUnit);
  const [discountOpen, setDiscountOpen] = useState(item.hasDiscount);
  const [discountAutofocusKey, setDiscountAutofocusKey] = useState(0);
  const [kbjuOpen, setKbjuOpen] = useState(item.nutritionFilledCount > 0);

  const nextForcedTab = forcedEditorTab ?? (mode === "create" || forceBasicTabOnItemChange ? "basic" : undefined);

  useEffect(() => {
    setActiveTab(nextForcedTab ?? editorTabByItem.get(item.id) ?? "basic");
    setMedia(getInitialMedia(item));
    setBasePriceText(item.price ? formatMoneyInput(item.price) : "");
    setWeightUnit(item.weightLabel?.replace(/[\d.,\s]/g, "").trim() || "г");
    setDiscountOpen(item.hasDiscount);
    setDiscountAutofocusKey(0);
    setKbjuOpen(item.nutritionFilledCount > 0);
  }, [item.id, nextForcedTab]);

  useEffect(() => {
    if (!focusAnchor) return;
    const timeout = window.setTimeout(() => {
      editorScrollRef.current
        ?.querySelector(`[data-${focusAnchor}-editor-anchor]`)
        ?.scrollIntoView({ block: "nearest" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [focusAnchor, item.id]);

  const selectEditorTab = (tab: EditorTab) => {
    editorTabByItem.set(item.id, tab);
    setActiveTab(tab);
  };

  const addPhotoFile = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setMedia((m) => [...m, { id: `photo-${Date.now()}`, kind: "photo", fileName: file.name, previewUrl }]);
    onMediaAdded?.(item, previewUrl);
    onDraftChange?.({ thumbnailUrl: item.thumbnailUrl ?? previewUrl });
  };
  const addVideoFile = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setMedia((m) => [
      {
        id: `video-${Date.now()}`,
        kind: "video",
        fileName: file.name || "video-dish.mp4",
        previewUrl,
        coverMode: "auto",
      },
      ...m.filter((entry) => entry.kind !== "video"),
    ]);
    onMediaAdded?.(item, previewUrl);
    onDraftChange?.({ thumbnailUrl: item.thumbnailUrl ?? previewUrl });
  };
  const reorderMedia = (fromIndex: number, toIndex: number) => {
    setMedia((current) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
    onDraftChange?.({});
  };
  const removeMedia = (id: string) => {
    setMedia((m) => m.filter((x) => x.id !== id));
    onDraftChange?.({ thumbnailUrl: null });
  };
  const updateBasePrice = (value: string) => {
    if (!isFormattedNumericDraft(value)) return;
    setBasePriceText(value);
    onDraftChange?.({ price: parseMoneyInput(value) ?? 0 });
  };
  const formatBasePrice = () => {
    const value = parseMoneyInput(basePriceText);
    if (value != null) {
      setBasePriceText(formatMoneyInput(value));
      onItemChange?.(item, { price: value });
    }
  };
  const addDiscount = () => {
    setDiscountOpen(true);
    setDiscountAutofocusKey((value) => value + 1);
    onDraftChange?.({ hasDiscount: true });
  };
  const removeDiscount = () => {
    setDiscountOpen(false);
    setDiscountAutofocusKey(0);
    onDraftChange?.({ hasDiscount: false, priceWithSale: null });
  };
  const basePrice = parseMoneyInput(basePriceText);
  const isArchived = item.status === "archive";

  const addRowClass =
    "flex h-8 items-center gap-1.5 rounded-[8px] px-1.5 text-[13px] text-[#44403b] transition hover:bg-[#f5f5f4]";

  const positionActions = (
    <div className="ml-auto flex shrink-0 items-center gap-2">
      {headerMeta}
      {showStopQuickAction && <StopQuickActionButton item={item} busy={stopBusy} onToggleStop={onToggleStop} />}
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <CatalogMoreButton ariaLabel="Действия с позицией" title="Действия с позицией" />
        </DropdownMenu.Trigger>
        <DropdownContent align="end">
          {isArchived ? (
            <>
              <DropdownActionItem onSelect={() => onRestoreItem(item)}>Восстановить из архива</DropdownActionItem>
              <DropdownActionItem icon={ArrowsOutCardinal} onSelect={(event) => onMoveItem(item, getMovePopoverAnchor(event))}>Переместить в раздел…</DropdownActionItem>
              <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
              <DropdownActionItem tone="danger" onSelect={() => onRequestPermanentDelete(item)}>
                Удалить навсегда
              </DropdownActionItem>
            </>
          ) : (
            <>
              {(item.status === "active" || item.status === "stopped") && (
                <DropdownActionItem disabled={stopBusy} onSelect={() => onToggleStop(item)}>
                  {item.status === "stopped" ? "Вернуть в продажу" : "Поставить на стоп"}
                </DropdownActionItem>
              )}
              <DropdownActionItem icon={ArrowsOutCardinal} onSelect={(event) => onMoveItem(item, getMovePopoverAnchor(event))}>Переместить в раздел…</DropdownActionItem>
              <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
              <DropdownActionItem onSelect={() => onArchiveItem(item)}>Архивировать</DropdownActionItem>
            </>
          )}
        </DropdownContent>
      </DropdownMenu.Root>
    </div>
  );

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div ref={editorScrollRef} className="min-w-0 flex-1 overflow-y-auto p-6 pt-0">
        <div className="mx-auto w-full max-w-[800px]">
          {mode === "create" ? (
            <div className="sticky top-0 z-20 flex min-w-0 items-center gap-2 bg-[#fbfbf9] pb-2 pt-6 max-[1100px]:gap-1">
              <Tooltip label="Назад" side="bottom" delayDuration={250}>
                <button
                  type="button"
                  onClick={onBackCreate}
                  disabled={createSubmitting}
                  aria-label="Назад"
                  className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#57534d] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:cursor-not-allowed disabled:opacity-50 max-[1100px]:w-7"
                >
                  <ArrowLeft size={17} weight="bold" />
                </button>
              </Tooltip>
              <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden max-[1100px]:min-w-[102px] max-[1100px]:gap-1">
                <h2 className="shrink-0 whitespace-nowrap text-[14px] font-medium leading-5 text-[#292524] max-[1100px]:text-[11px]">
                  Новая позиция
                </h2>
                {breadcrumb}
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={onCancelCreate}
                  disabled={createSubmitting}
                  className="px-2.5 font-medium text-[#79716b] hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:ring-[#292524]/10"
                >
                  Отменить
                </Button>
                <Button
                  type="button"
                  variant="default"
                  size="sm"
                  onClick={onCreatePosition}
                  disabled={createDisabled || createSubmitting}
                  aria-busy={createSubmitting}
                  className="gap-1.5 bg-indigo-600 px-2.5 font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 focus-visible:ring-indigo-600/25"
                >
                  {createSubmitting && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/45 border-t-white" />}
                  {createSubmitting ? "Создание…" : "Создать"}
                </Button>
              </div>
            </div>
          ) : breadcrumb ? (
            // «Позиции»: одна строка — breadcrumb вместо отдельного крупного заголовка позиции.
            <div className="flex items-center gap-2 pb-2 pt-5">
              {onBackEdit && (
                <Tooltip label="Назад" side="bottom" delayDuration={250}>
                  <button
                    type="button"
                    onClick={onBackEdit}
                    aria-label="Назад"
                    className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#57534d] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                  >
                    <ArrowLeft size={17} weight="bold" />
                  </button>
                </Tooltip>
              )}
              <div className="min-w-0 flex-1 overflow-hidden">{breadcrumb}</div>
              {positionActions}
            </div>
          ) : (
            <div className="flex items-center gap-2 pb-2 pt-6">
              <h2 className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] font-medium leading-7 text-[#292524]">
                <span className="truncate">{item.title || "Новая позиция"}</span>
                {isArchived && (
                  <span className="ml-1 shrink-0 rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-[#79716b]">
                    В архиве
                  </span>
                )}
                {item.status === "stopped" && !isArchived && (
                  <span className="ml-1 shrink-0 rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-[#79716b]">
                    На стопе
                  </span>
                )}
              </h2>
              {positionActions}
            </div>
          )}

          <WorkspaceLocalTabs
            tabs={EDITOR_TABS.map((tab) => ({
              ...tab,
              ...(tab.id === "options" ? { count: item.optionsCount } : {}),
            }))}
            value={activeTab}
            onValueChange={selectEditorTab}
          />

          <div className="pt-3">
            {activeTab === "basic" ? (
              <div data-editor-form-card className="rounded-[13px] border border-[#e7e5e4] bg-white px-4 pb-4 pt-5 shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
                  <BasicTab
                    item={item}
                    media={media}
                    basePriceText={basePriceText}
                    basePrice={basePrice}
                    weightUnit={weightUnit}
                    discountOpen={discountOpen}
                    discountAutofocusKey={discountAutofocusKey}
                    onWeightUnitChange={(unit) => {
                      setWeightUnit(unit);
                      onDraftChange?.({ weightLabel: item.weightLabel ? item.weightLabel.replace(/[A-Za-zА-Яа-я]+$/, unit) : null });
                    }}
                    onBasePriceChange={updateBasePrice}
                    onBasePriceBlur={formatBasePrice}
                    onAddDiscount={addDiscount}
                    onRemoveDiscount={removeDiscount}
                    onAddPhotoFile={addPhotoFile}
                    onAddVideoFile={addVideoFile}
                    onReorderMedia={reorderMedia}
                    onRemoveMedia={removeMedia}
                    onDescriptionChange={(value) => {
                      onDescriptionChange?.(item, value);
                      onDraftChange?.({ description: value, hasDescription: descriptionHasContent(value) });
                    }}
                    autoFocusName={mode === "create"}
                    namePlaceholder={mode === "create" ? "Например, Пицца" : "Введите перевод…"}
                    onNameChange={(value) => onDraftChange?.({ title: value })}
                    onWeightChange={(value, unit) => {
                      const parsed = parseMoneyInput(value);
                      onDraftChange?.({ weightLabel: parsed == null ? null : `${formatPlainNumber(parsed)} ${unit}` });
                    }}
                    onTitleChange={(value) => onItemChange?.(item, { title: value })}
                  />
              </div>
            ) : activeTab === "promo" ? (
              <div className="space-y-2">
                <PromoRecommendationsCard
                  item={item}
                  allItems={allItems}
                  upsell={upsell}
                  onChange={onUpsellChange}
                />
                <PromoTab
                  item={item}
                  upsell={upsell}
                  onChange={onUpsellChange}
                />
              </div>
            ) : activeTab === "options" ? (
              <OptionsTab
                item={item}
                onSavedGroupsChange={(count) => {
                  if (mode === "create") onDraftChange?.({ optionsCount: count });
                  else onItemChange?.(item, { optionsCount: count });
                }}
              />
            ) : (
              <div className="rounded-[13px] border border-[#e7e5e4] bg-white px-4 pb-4 pt-5 shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
                {activeTab === "availability" && (
                  <AvailabilityTab
                    item={item}
                    stopBusy={stopBusy}
                    onSetAvailabilityMode={onSetAvailabilityMode}
                    unavailableDisplayMode={unavailableDisplayMode}
                    outsideScheduleMode={outsideScheduleMode}
                    weeklySchedule={weeklySchedule}
                    onUnavailableDisplayModeChange={onUnavailableDisplayModeChange}
                    onOutsideScheduleModeChange={onOutsideScheduleModeChange}
                    onWeeklyScheduleChange={onWeeklyScheduleChange}
                  />
                )}
                {activeTab === "display" && <DisplayTab item={item} />}
              </div>
            )}
          </div>

          {/* Опциональные блоки и «Ещё» — вне карточки, только для «Основного» */}
          {activeTab === "basic" && (
            <div className="mt-4 space-y-4">
              <div data-kbju-editor-anchor>
                {kbjuOpen && <KbjuBlock weightUnit={weightUnit} onRemove={() => { setKbjuOpen(false); onDraftChange?.({}); }} />}
                {!kbjuOpen && (
                  <div className="px-1.5 pt-1">
                    <div className="flex flex-col items-start">
                      <button type="button" className={addRowClass} onClick={() => { setKbjuOpen(true); onDraftChange?.({}); }}>
                        <PlusCircle size={16} className="text-[#a8a29e]" />
                        Добавить КБЖУ
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
