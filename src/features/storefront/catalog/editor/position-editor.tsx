import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Asterisk, ArrowLeft, ArrowUUpLeft, CalendarDots, CaretDoubleRight, CaretDown, CaretRight, Check, CheckCircle, Clock, DotsThree, DotsThreeVertical, DotsSixVertical, ImageBroken, Lock, LockLaminated, MagnifyingGlass, MinusCircle, Play, Plus, PlusCircle, Prohibit, ShootingStar, SpinnerGap, Trash, X, XCircle } from "@phosphor-icons/react";
import { UtensilsCrossed } from "lucide-react";
import { TranslatableField } from "@/components/workspace/translatable-field";
import { DescriptionRichTextEditor } from "@/components/workspace/description-rich-text-editor";
import { Button } from "@/components/ui/button";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { Tooltip } from "@/components/ui/tooltip";
import type { CatalogSaveStatus } from "@/contexts/catalog-store-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import {
  catalogSections,
  formatPrice,
  type CatalogItem,
  type CatalogNutrition,
  type CatalogOptionGroup,
  type CatalogOptionVariant,
  type CatalogScheduleDay,
  type CatalogScheduleDayKey,
  type CatalogTranslations,
  type CatalogWeeklySchedule,
} from "@/data/catalog";
import { cn } from "@/lib/utils";
import { catalogStorageKey } from "@/lib/catalog-preview";
import { CATALOG_RECOMMENDATION_LIMIT, buildAutomaticRecommendations, resolveRecommendationIds, resolveRecommendationSource, type CatalogItemUpsellState, type CatalogLocalizedValue, type CatalogRecommendationSource } from "@/lib/catalog-upsell";
import type { CatalogAvailabilityMode } from "../model/tree";
import {
  CatalogContextMenuContent,
  type CatalogMenuAvailability,
  type CatalogPositionAvailabilityMenuProps,
  type CatalogStopDisplayMode,
} from "../ui/catalog-context-menu";
import {
  CatalogWeeklyScheduleEditor,
  CatalogSchedulePopover,
  createDefaultWeeklySchedule,
  isWeeklyScheduleOrderable,
  type AvailabilityScheduleMode,
} from "../ui/catalog-schedule-editor";
import { DropdownActionItem, DropdownContent } from "../ui/catalog-dropdown";
import { getMovePopoverAnchor, type MovePopoverAnchor } from "../ui/move-anchor";
import { DND_TRANSITION, restrictTableSortToVerticalAxis, usePrefersReducedMotion } from "../workspace/dnd";
import { descriptionHasContent, type EditorFocusAnchor, type EditorTab } from "./editor-queue";
import { WorkspaceLocalTabs } from "./editor-tabs";
import { readLegacyCatalogTitleTranslations } from "../persistence";
import { readJsonRecord } from "../storage";
import { usePositionSidePeek, usePositionSidePeekOverlay, usePositionSidePeekOverlayLayer } from "./side-peek-context";
import { usePositionEditorFixture } from "./position-editor-fixture-context";
import { CatalogLabelControls } from "../labels/catalog-label-controls";

export { createDefaultWeeklySchedule, createEmptyWeeklySchedule, isWeeklyScheduleValid } from "../ui/catalog-schedule-editor";

type AvailabilityMode = CatalogAvailabilityMode;
const VIDEO_LIMIT_TOTAL = 10;
const VIDEO_LIMIT_USED = 6;
const VIDEO_PACKAGE_CONNECTED = true;
export type PositionEditorMode = "create" | "create-modal" | "edit";
export type UnavailableDisplayMode = "hidden" | "comingSoon";
export type OutsideScheduleMode = "hidden" | "comingSoon";
export type ScheduleDayKey = CatalogScheduleDayKey;
export type DaySchedule = CatalogScheduleDay;
export type WeeklySchedule = CatalogWeeklySchedule;
type LocalizedValue = CatalogLocalizedValue;

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
function PositionSaveStatus({
  status,
  onRetry,
}: {
  status: CatalogSaveStatus;
  onRetry?: () => void;
}) {
  return (
    <div
      data-position-save-status
      data-save-status={status}
      role={status === "error" ? "alert" : status === "idle" ? undefined : "status"}
      aria-live={status === "idle" ? undefined : "polite"}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap text-[12px] text-[#79716b]",
        status === "idle" && "hidden",
        status === "error" && "text-[#c10007]",
      )}
    >
      {status === "saving" && (
        <>
          <SpinnerGap size={14} className="shrink-0 animate-spin" aria-hidden="true" />
          <span>Сохранение…</span>
        </>
      )}
      {status === "saved" && (
        <>
          <CheckCircle size={14} weight="fill" className="shrink-0 text-[#56826a]" aria-hidden="true" />
          <span>Сохранено</span>
        </>
      )}
      {status === "error" && (
        <Tooltip label="Не удалось сохранить — повторить" side="bottom" delayDuration={250}>
          <button
            type="button"
            onClick={onRetry}
            aria-label="Не удалось сохранить. Повторить"
            className="flex h-8 items-center gap-1 rounded-lg px-1.5 font-medium transition hover:bg-[#fff1f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c10007]/15"
          >
            <XCircle size={14} weight="fill" aria-hidden="true" />
            <span>Повторить</span>
          </button>
        </Tooltip>
      )}
    </div>
  );
}

const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: "basic", label: "Основное" },
  { id: "promo", label: "Рекомендации" },
  { id: "options", label: "Опции" },
  { id: "availability", label: "Доступность" },
  { id: "display", label: "Вид" },
];
const editorTabByItem = new Map<string, EditorTab>();

type PositionOptionSelection = "single" | "multiple";
type PositionOptionPricing = "total" | "surcharge";
type PositionOptionVariant = CatalogOptionVariant;
type PositionOptionGroup = CatalogOptionGroup;

const CATALOG_POSITION_OPTIONS_STORAGE_KEY = catalogStorageKey("positionOptionGroups");

function createOptionEntityId(prefix: "group" | "variant") {
  return `${prefix}-${typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function createOptionGroup(name = "Новая опция"): PositionOptionGroup {
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
type MediaKind = "photo" | "video";
type MediaEntry = {
  id: string;
  kind: MediaKind;
  fileName?: string;
  previewUrl?: string;
  coverMode?: "auto" | "custom";
};
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
        "h-[60px] w-[60px]",
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
        <DropdownContent align="end">
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
              className="flex h-[60px] w-[60px] shrink-0 items-center justify-center rounded-[10px] border border-dashed border-[#d6d3d1] text-[#79716b] transition hover:border-[#a8a29e] hover:bg-[#fafaf9] hover:text-[#292524]"
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
  kbjuOpen,
  kbjuAutofocusKey,
  onDiscountChange,
  onWeightUnitChange,
  onBasePriceChange,
  onBasePriceBlur,
  onAddDiscount,
  onRemoveDiscount,
  onAddKbju,
  onNutritionChange,
  onRemoveKbju,
  onAddPhotoFile,
  onAddVideoFile,
  onReorderMedia,
  onRemoveMedia,
  onDescriptionChange,
  autoFocusName = false,
  hideName = false,
  nameError,
  namePlaceholder = "Введите перевод…",
  nameResetKey,
  onNameChange,
  onWeightChange,
  onTitleChange,
  onTitleTranslationsChange,
}: {
  item: CatalogItem;
  media: MediaEntry[];
  basePriceText: string;
  basePrice: number | null;
  weightUnit: string;
  discountOpen: boolean;
  discountAutofocusKey: number;
  kbjuOpen: boolean;
  kbjuAutofocusKey: number;
  onDiscountChange: (priceWithSale: number | null) => void;
  onWeightUnitChange: (unit: string) => void;
  onBasePriceChange: (value: string) => void;
  onBasePriceBlur: () => void;
  onAddDiscount: () => void;
  onRemoveDiscount: () => void;
  onAddKbju: () => void;
  onNutritionChange: (values: CatalogNutrition) => void;
  onRemoveKbju: () => void;
  onAddPhotoFile: (file: File) => void;
  onAddVideoFile: (file: File) => void;
  onReorderMedia: (fromIndex: number, toIndex: number) => void;
  onRemoveMedia: (id: string) => void;
  onDescriptionChange?: (value: string) => void;
  autoFocusName?: boolean;
  hideName?: boolean;
  nameError?: string;
  namePlaceholder?: string;
  nameResetKey?: string;
  onNameChange?: (value: string) => void;
  onWeightChange?: (value: string, unit: string) => void;
  onTitleChange?: (value: string) => void;
  onTitleTranslationsChange?: (translations: CatalogTranslations) => void;
}) {
  const { account } = useMockAuth();
  const [initialWeightValue, initialWeightUnit] = item.weightLabel
    ? [item.weightLabel.replace(/[^\d.,]/g, "").trim(), item.weightLabel.replace(/[\d.,\s]/g, "").trim() || "г"]
    : ["", "г"];
  const [weightText, setWeightText] = useState(initialWeightValue ? formatPlainNumber(parseMoneyInput(initialWeightValue) ?? 0) : "");

  useEffect(() => {
    setWeightText(initialWeightValue ? formatPlainNumber(parseMoneyInput(initialWeightValue) ?? 0) : "");
  }, [item.id, initialWeightUnit, initialWeightValue]);

  const inlineInputClass =
    "min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]";
  const initialTranslations = item.titleTranslations
    ?? readLegacyCatalogTitleTranslations(account?.id, item.id)
    ?? { ru: item.title };
  const nameField = !hideName ? (
    <div>
      <TranslatableField
        label="Название"
        initialTranslations={initialTranslations}
        plain
        autoFocus={autoFocusName}
        inputAriaLabel="Название позиции"
        resetKey={nameResetKey}
        persist={false}
        placeholder={namePlaceholder}
        onValueChange={onNameChange}
        onChange={(translations) => {
          onTitleChange?.(translations.ru ?? item.title);
          onTitleTranslationsChange?.(translations);
        }}
      />
      {nameError && <p role="alert" className="mt-1.5 text-[12px] leading-4 text-[#c10007]">{nameError}</p>}
    </div>
  ) : null;

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

      {nameField}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="min-w-0">
          <EditorField
            label="Цена"
          >
            <input aria-label="Цена позиции" value={basePriceText} onChange={(event) => onBasePriceChange(event.target.value)} onBlur={onBasePriceBlur} placeholder="0" className={inlineInputClass} />
            <span className="shrink-0 text-[13px] text-[#a6a09b]">₸</span>
          </EditorField>
        </div>

        <div data-weight-editor-anchor>
          <EditorField label="Объем">
            <input
              aria-label="Объем позиции"
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

      <div data-discount-editor-anchor>
        {discountOpen ? (
          <DiscountBlock
            item={item}
            basePrice={basePrice}
            autofocusKey={discountAutofocusKey}
            onChange={onDiscountChange}
            onRemove={onRemoveDiscount}
          />
        ) : (
          <OptionalPropertyAddBlock label="Скидка" actionLabel="Добавить скидку" onAdd={onAddDiscount} />
        )}
      </div>

      <div data-description-editor-anchor>
        <DescriptionRichTextEditor
          key={`desc-${item.id}`}
          initialValue={item.description}
          placeholder="Кратко опишите состав, вкус или способ подачи"
          onChange={onDescriptionChange}
          limit={DESCRIPTION_LIMIT}
          compact
        />
      </div>

      <div data-kbju-editor-anchor>
        {kbjuOpen ? (
          <KbjuBlock
            weightUnit={weightUnit}
            initialValues={item.nutrition}
            autofocusKey={kbjuAutofocusKey}
            onChange={onNutritionChange}
            onRemove={onRemoveKbju}
          />
        ) : (
          <OptionalPropertyAddBlock label="КБЖУ" actionLabel="Добавить КБЖУ" onAdd={onAddKbju} />
        )}
      </div>
    </div>
  );
}

// ── Скидка и КБЖУ — опциональные настройки формы ─────────────────────────────

function OptionalPropertyAddBlock({
  label,
  actionLabel,
  onAdd,
}: {
  label: string;
  actionLabel: string;
  onAdd: () => void;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="h-5 text-[13px] leading-5 text-[#292524]">{label}</div>
      <button
        type="button"
        aria-label={actionLabel}
        onClick={onAdd}
        className="flex h-9 w-full items-center gap-2 rounded-[8px] border border-[#e7e5e4] px-[13px] py-[9px] text-left text-[12px] leading-[18px] text-[#292524] transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      >
        <PlusCircle size={16} className="shrink-0" aria-hidden="true" />
        <span>{actionLabel}</span>
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
        "flex h-9 w-full items-center justify-between gap-2 rounded-[8px] border border-[#e5e5e5] bg-white px-3 py-1 shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition focus-within:border-[#c7c2bd]",
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
  onChange,
  onRemove,
}: {
  item: CatalogItem;
  basePrice: number | null;
  autofocusKey: number;
  onChange: (priceWithSale: number | null) => void;
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
  const badgePercent = percentValue ?? 0;
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
    const nextFinalPrice = calculateDiscountedPrice(basePrice, percent);
    setFinalPriceText(formatMoneyInput(nextFinalPrice));
    onChange(nextFinalPrice);
  };

  const handleFinalPriceChange = (value: string) => {
    if (!isNumericDraft(value)) return;
    discountSourceRef.current = "finalPrice";
    setDiscountSource("finalPrice");
    setFinalPriceText(value);
    const finalPrice = parseMoneyInput(value);
    if (baseMissing || finalPrice == null || finalPrice < 0 || finalPrice > basePrice) return;
    setPercentText(formatDiscountPercent(calculateDiscountPercent(basePrice, finalPrice)));
    onChange(finalPrice);
  };

  const normalizePercentOnBlur = () => {
    const percent = parseMoneyInput(percentText);
    if (percent == null) return;
    const normalized = Math.min(100, Math.max(0, percent));
    discountSourceRef.current = "percent";
    setPercentText(formatDiscountPercent(normalized));
    if (!baseMissing) {
      const nextFinalPrice = calculateDiscountedPrice(basePrice, normalized);
      setFinalPriceText(formatMoneyInput(nextFinalPrice));
      onChange(nextFinalPrice);
    }
  };

  const normalizeFinalPriceOnBlur = () => {
    const finalPrice = parseMoneyInput(finalPriceText);
    if (finalPrice == null || baseMissing) return;
    if (finalPrice < 0) {
      setFinalPriceText("0");
      setPercentText("100");
      discountSourceRef.current = "finalPrice";
      onChange(0);
    } else if (finalPrice <= basePrice) {
      onChange(finalPrice);
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
    <div className="flex flex-col gap-1.5" data-discount-editor-block>
      <div className="flex h-5 items-center gap-1.5">
        <div className="text-[13px] leading-5 text-[#292524]">Скидка</div>
        <div
          data-discount-badge
          className="inline-flex h-[14px] items-center justify-center rounded-[5px] bg-[#615fff] px-[10px] text-[10px] font-semibold leading-5 text-white"
        >
          −{formatDiscountPercent(badgePercent)}%
        </div>
      </div>
      <div className="rounded-[12px] border border-[#e7e5e4] bg-white p-px">
        <div className="px-3 py-2">
          <div className="grid grid-cols-2 gap-2">
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
          </div>
          {baseMissing ? (
            <div className="mt-2 text-[12px] leading-4 text-[#79716b]">Сначала укажите основную цену</div>
          ) : finalPriceError ? (
            <div className="mt-2 text-[12px] leading-4 text-[#b42318]">{finalPriceError}</div>
          ) : percentError ? (
            <div className="mt-2 text-[12px] leading-4 text-[#b42318]">{percentError}</div>
          ) : null}
        </div>
        <div className="border-t border-[#e7e5e4]">
          <button
            type="button"
            onClick={removeDiscount}
            className="flex h-[35px] w-full items-center gap-2 px-3 text-[12px] leading-[18px] text-[#57534d] transition hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10"
          >
            <MinusCircle size={16} aria-hidden="true" />
            Убрать скидку
          </button>
        </div>
      </div>
    </div>
  );
}

type NutritionBase = "100g" | "100ml" | "portion";
type NutritionKey = keyof CatalogNutrition;

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

const EMPTY_NUTRITION: CatalogNutrition = {
  calories: "",
  protein: "",
  fat: "",
  carbs: "",
};

function KbjuBlock({
  weightUnit,
  initialValues,
  autofocusKey,
  onChange,
  onRemove,
}: {
  weightUnit: string;
  initialValues?: CatalogNutrition;
  autofocusKey: number;
  onChange: (values: CatalogNutrition) => void;
  onRemove: () => void;
}) {
  const [values, setValues] = useState<CatalogNutrition>(() => initialValues ?? EMPTY_NUTRITION);

  useEffect(() => {
    setValues(initialValues ?? EMPTY_NUTRITION);
  }, [initialValues]);

  const updateValue = (key: NutritionKey, value: string) => {
    const next = { ...values, [key]: value };
    setValues(next);
    onChange(next);
  };

  const clearValues = () => {
    setValues(EMPTY_NUTRITION);
    onChange(EMPTY_NUTRITION);
  };

  const base = getAutoNutritionBase(weightUnit);
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
    clearValues();
    onRemove();
  };

  return (
    <div className="@container flex flex-col gap-1.5" data-kbju-editor-block>
      <div className="h-5 text-[13px] leading-5 text-[#292524]">КБЖУ</div>
      <div className="rounded-[12px] border border-[#e7e5e4] bg-white p-px">
        <div className="px-3 py-2">
          <div className="grid grid-cols-4 gap-2.5">
          {NUTRITION_FIELDS.map((field) => (
            <label key={field.key} className="min-w-0">
              <div className="mb-1.5 whitespace-nowrap text-[11px] leading-5 tracking-[-0.35px] text-[#79716b] @[400px]:break-words @[400px]:text-[13px] @[400px]:tracking-normal">{field.label}</div>
              <div className="flex h-[30px] items-center gap-1 rounded-[8px] border border-[#e5e5e5] bg-white px-2 shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition focus-within:border-[#c7c2bd]">
                <Input
                  size="compact"
                  type="text"
                  inputMode="decimal"
                  autoFocus={autofocusKey > 0 && field.key === "calories"}
                  value={values[field.key]}
                  onChange={(event) => {
                    const next = event.target.value;
                    if (!isNumericDraft(next)) return;
                    updateValue(field.key, next);
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
        <div className="border-t border-[#e7e5e4]">
          <button
            type="button"
            onClick={removeNutrition}
            className="flex h-[35px] w-full items-center gap-2 px-3 text-[12px] leading-[18px] text-[#57534d] transition hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10"
          >
            <MinusCircle size={16} aria-hidden="true" />
            Убрать КБЖУ
          </button>
        </div>
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

function ItemSelectorPopover({
  open,
  currentItem,
  items,
  selectedIds,
  onOpenChange,
  onToggle,
  children,
}: {
  open: boolean;
  currentItem: CatalogItem;
  items: CatalogItem[];
  selectedIds: string[];
  onOpenChange: (open: boolean) => void;
  onToggle: (id: string, checked: boolean) => void;
  children: ReactNode;
}) {
  const [query, setQuery] = useState("");
  const [sectionFilterId, setSectionFilterId] = useState<string | null>(null);
  const { marker, shouldPreventOverlayDismissal } = usePositionSidePeekOverlayLayer();
  usePositionSidePeekOverlay(open, () => onOpenChange(false));
  const selectedSet = new Set(selectedIds);
  const normalizedQuery = query.trim().toLowerCase();
  const baseItems = items.filter((candidate) =>
    candidate.id !== currentItem.id &&
    (candidate.status !== "archive" || selectedSet.has(candidate.id))
  );
  const sectionOrder = new Map(catalogSections.map((section, index) => [section.id, index]));
  const sectionOptions = Array.from(
    new Map(baseItems.map((candidate) => [candidate.sectionId, { id: candidate.sectionId, name: candidate.sectionName }])).values(),
  ).sort((a, b) => (sectionOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (sectionOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER) || a.name.localeCompare(b.name, "ru"));
  const selectedSection = sectionOptions.find((section) => section.id === sectionFilterId) ?? null;
  const visibleItems = baseItems
    .filter((candidate) => !sectionFilterId || candidate.sectionId === sectionFilterId)
    .filter((candidate) => !normalizedQuery || candidate.title.toLocaleLowerCase("ru").includes(normalizedQuery))
    .slice(0, 120);
  const atLimit = selectedIds.length >= CATALOG_RECOMMENDATION_LIMIT;

  useEffect(() => {
    if (open) return;
    setQuery("");
    setSectionFilterId(null);
  }, [open]);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{children}</PopoverTrigger>
      <PopoverContent
        data-recommendation-picker
        align="end"
        sideOffset={6}
        collisionPadding={12}
        className="w-[372px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[13px] p-3 shadow-[0_18px_42px_rgba(41,37,36,0.14)]"
      >
        <div className="flex h-8 items-center justify-between gap-2.5">
          <label className="relative block h-8 min-w-0 flex-1">
            <MagnifyingGlass size={14} className="pointer-events-none absolute left-2 top-1/2 z-10 -translate-y-1/2 text-[#79716b]" />
            <Input
              size="compact"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Найти позицию..."
              aria-label="Найти позицию"
              className="h-8 w-full border-transparent bg-[#f5f5f4] pl-7 pr-2 text-[13px] focus:border-[#d6d3d1]"
            />
          </label>
          <DropdownMenu.Root modal={false}>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    aria-label="Фильтр по разделу"
                    className="flex h-8 w-[135px] shrink-0 items-center gap-1.5 rounded-full bg-[#f5f5f4] px-2 text-[12px] text-[#292524] transition hover:bg-[#eceae7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                  >
                    <span className="flex size-5 shrink-0 items-center justify-center rounded-[5px] bg-white text-[#79716b]">
                      <Asterisk size={13} weight="bold" />
                    </span>
                    <span className="min-w-0 flex-1 truncate text-left">{selectedSection?.name ?? "Все разделы"}</span>
                    <CaretDown size={14} className="shrink-0 text-[#79716b]" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    data-recommendation-section-menu
                    align="end"
                    sideOffset={6}
                    className="z-[100006] max-h-[280px] min-w-[220px] overflow-y-auto rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
                    onPointerDownOutside={(event) => {
                      if (shouldPreventOverlayDismissal(event)) event.preventDefault();
                    }}
                    onInteractOutside={(event) => {
                      if (shouldPreventOverlayDismissal(event)) event.preventDefault();
                    }}
                  >
                    {marker}
                    <DropdownActionItem onSelect={() => setSectionFilterId(null)}>Все разделы</DropdownActionItem>
                    {sectionOptions.map((section) => (
                      <DropdownActionItem key={section.id} onSelect={() => setSectionFilterId(section.id)}>
                        <span className="min-w-0 truncate">{section.name}</span>
                      </DropdownActionItem>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <div
          data-recommendation-picker-list
          role="group"
          aria-label="Позиции для рекомендации"
          className="mt-2 max-h-[304px] overflow-y-auto overscroll-contain"
        >
          {visibleItems.map((candidate) => {
            const checked = selectedSet.has(candidate.id);
            const disabled = !checked && atLimit;
            return (
              <label
                key={candidate.id}
                data-recommendation-picker-row
                className={cn(
                  "flex h-[38px] w-full items-center gap-[7px] rounded-[8px] px-2 text-left transition",
                  disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-[#f5f5f4]",
                )}
              >
                <input
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  aria-label={`Рекомендовать «${candidate.title}»`}
                  onChange={(event) => onToggle(candidate.id, event.target.checked)}
                  className="size-4 shrink-0 rounded-[5px] border-[#d6d3d1] accent-[#292524]"
                />
                <CatalogThumb item={candidate} size={20} />
                <span className="min-w-0 flex-1 truncate text-[13px] leading-4 text-[#79716b]" title={candidate.title}>
                  {candidate.title}
                </span>
              </label>
            );
          })}
          {visibleItems.length === 0 && (
            <div className="px-3 py-6 text-center text-[13px] text-[#79716b]">Подходящие позиции не найдены</div>
          )}
        </div>
      </PopoverContent>
    </Popover>
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
      {...attributes}
      {...listeners}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: reducedMotion ? undefined : transition,
        zIndex: isDragging ? 2 : undefined,
      }}
      className={cn(
        "group relative flex h-9 items-center gap-2 rounded-[8px] transition-colors hover:bg-[#f8f7f4]",
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
  initialSelectorOpen = false,
  showRecommendationRemoveAction = false,
}: {
  item: CatalogItem;
  allItems: CatalogItem[];
  upsell: CatalogItemUpsellState;
  onChange: (next: CatalogItemUpsellState) => void;
  onManualAdd?: (ids: string[], reciprocal: boolean) => void;
  onGenerate?: (mode: "supplement" | "regenerate") => void;
  isReciprocal?: (recommendationId: string) => boolean;
  generationBusy?: boolean;
  initialSelectorOpen?: boolean;
  /** Used only by deterministic Design Lab captures of the existing row action. */
  showRecommendationRemoveAction?: boolean;
}) {
  const [selectorOpen, setSelectorOpen] = useState(initialSelectorOpen);
  const [regenerateConfirmOpen, setRegenerateConfirmOpen] = useState(false);
  usePositionSidePeekOverlay(regenerateConfirmOpen, () => setRegenerateConfirmOpen(false));
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
    const additions = ids
      .filter((id) => id !== item.id && !recommendationIds.includes(id))
      .slice(0, Math.max(0, CATALOG_RECOMMENDATION_LIMIT - recommendationIds.length));
    setRecommendationIds(
      [...recommendationIds, ...additions],
      { ...recommendationSources, ...Object.fromEntries(additions.map((id) => [id, "manual" as const])) },
    );
  };
  const toggleManualRecommendation = (id: string, checked: boolean) => {
    if (checked) {
      addManually([id], false);
      return;
    }
    setRecommendationIds(recommendationIds.filter((recommendationId) => recommendationId !== id));
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
  return (
    <>
      <div data-upsell-card="recommendations" className="w-full">
        <div className="mb-1.5 px-1">
          <h3 className="inline-flex border-b border-dashed border-[#a8a29e] px-0.5 pb-0.5 text-[13px] font-normal leading-5 text-[#292524]">Рекомендации</h3>
        </div>
        <div className="overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white">
        {recommendations.length > 0 ? (
          <DndContext
            sensors={recommendationSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictTableSortToVerticalAxis]}
            onDragEnd={handleRecommendationDragEnd}
          >
            <SortableContext items={recommendationIds} strategy={verticalListSortingStrategy}>
              <div className="space-y-1 border-b border-[#e7e5e4] px-3 py-2">
                {recommendations.map((recommended) => (
                  <SortableRecommendationRow key={recommended.id} id={recommended.id}>
                    {() => (
                      <>
                        <CatalogThumb item={recommended} size={20} />
                        <span className="min-w-0 flex-1 truncate text-[13px] leading-4 text-[#292524]">{recommended.title}</span>
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
                            data-recommendation-remove-action={showRecommendationRemoveAction ? "true" : undefined}
                            onClick={() => setRecommendationIds(recommendationIds.filter((id) => id !== recommended.id))}
                            className="flex size-6 shrink-0 items-center justify-center rounded-full text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#dc2626] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                          >
                            <X size={15} />
                          </button>
                        </Tooltip>
                      </>
                    )}
                  </SortableRecommendationRow>
                ))}
              </div>
            </SortableContext>
          </DndContext>
        ) : null}
        <div>
          <div className="flex items-center">
            <button
              type="button"
              disabled={generationBusy || recommendations.length >= CATALOG_RECOMMENDATION_LIMIT}
              onClick={() => generate("supplement")}
              className="flex h-9 min-w-0 flex-1 items-center gap-2 px-3 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f8f7f4] disabled:cursor-not-allowed disabled:text-[#a8a29e] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10"
            >
              <ShootingStar size={16} className="shrink-0" />
              <span className="truncate">{generationBusy ? "Подбираем…" : "Подобрать для этой позиции"}</span>
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
          <ItemSelectorPopover
            open={selectorOpen}
            currentItem={item}
            items={allItems}
            selectedIds={recommendationIds}
            onOpenChange={setSelectorOpen}
            onToggle={toggleManualRecommendation}
          >
            <button
              type="button"
              aria-label="Добавить вручную"
              className="flex h-9 w-full items-center gap-2 border-t border-[#eceae7] px-3 text-[12px] font-medium text-[#79716b] transition hover:bg-[#f8f7f4] hover:text-[#44403b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10"
            >
              <Plus size={16} />
              Добавить вручную
            </button>
          </ItemSelectorPopover>
        </div>
        </div>
      </div>
      {regenerateConfirmOpen && createPortal(
        <div
          className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/20 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Подобрать рекомендуемые позиции заново"
          onKeyDown={(event) => {
            if (event.key !== "Escape") return;
            event.preventDefault();
            event.stopPropagation();
            setRegenerateConfirmOpen(false);
          }}
        >
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

export function PromoTab({
  item,
  allItems,
  onItemChange,
  initialLabelCreatingType,
  initialLabelEditingType,
}: {
  item: CatalogItem;
  allItems: CatalogItem[];
  onItemChange: (item: CatalogItem, patch: Partial<CatalogItem>) => void;
  initialLabelCreatingType?: "tag" | "sticker";
  initialLabelEditingType?: "tag" | "sticker";
}) {
  return (
    <div data-upsell-stack className="flex flex-col gap-3">
      <CatalogLabelControls
        item={item}
        allItems={allItems}
        onPatchItem={onItemChange}
        initialCreatingType={initialLabelCreatingType}
        initialEditingType={initialLabelEditingType}
      />
    </div>
  );
}

function PositionAvailabilityStatus({
  item,
  menuProps,
  compact = false,
}: {
  item: CatalogItem;
  menuProps: CatalogPositionAvailabilityMenuProps;
  compact?: boolean;
}) {
  const effective = getEffectiveAvailability(item, new Date(), {
    unavailableDisplayMode: menuProps.stopDisplayMode,
    outsideScheduleMode: menuProps.outsideScheduleMode,
    weeklySchedule: menuProps.weeklySchedule,
    scheduleMode: "available",
  });
  const state = item.status === "archive"
    ? "archive"
    : menuProps.manualStopped
      ? (item.status === "coming-soon" || menuProps.stopDisplayMode === "comingSoon" ? "coming-soon" : "stopped")
      : menuProps.hasSchedule
        ? effective.orderable
          ? "schedule"
          : effective.badge === "Скоро будет"
            ? "coming-soon"
            : "unavailable"
        : effective.orderable
          ? "available"
          : effective.badge === "Скоро будет"
            ? "coming-soon"
            : "unavailable";
  const label = state === "archive"
    ? "В архиве"
    : state === "stopped"
      ? "На стопе"
      : state === "coming-soon"
        ? "Скоро будет"
      : state === "schedule"
        ? "По расписанию"
        : state === "unavailable"
          ? "Недоступно"
          : "Доступно";
  const Icon = state === "archive" ? XCircle : state === "stopped" ? Prohibit : state === "available" ? CheckCircle : Clock;

  if (compact) {
    return (
      <span
        role="status"
        data-position-availability-status={state}
        className={cn(
          "inline-flex h-5 shrink-0 items-center rounded-[4px] px-1.5 text-[11px] font-semibold leading-5",
          state === "archive" && "bg-[#f1f5f9] text-[#475569]",
          state === "stopped" && "bg-[#ffedd4] text-[#9a3412]",
          state === "coming-soon" && "bg-[#dbeafe] text-[#1d4ed8]",
          state === "schedule" && "bg-[#dbeafe] text-[#1d4ed8]",
          state === "unavailable" && "bg-[#fef3c7] text-[#854d0e]",
          state === "available" && "bg-[#eef7f1] text-[#3f6b52]",
        )}
      >
        {label}
      </span>
    );
  }

  return (
    <div
      role="status"
      data-position-availability-status={state}
      className={cn(
        "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#e7e5e4] bg-white px-2.5 text-[13px] font-medium text-[#292524]",
        state === "stopped" && "border-[#fde68a] bg-[#fffbeb]",
        state === "coming-soon" && "border-[#bfdbfe] bg-[#eff6ff] text-[#1d4ed8]",
        state === "archive" && "bg-[#f5f5f4] text-[#57534d]",
      )}
    >
      <Icon size={16} className={cn(
        "shrink-0",
        state === "stopped" ? "text-[#a16207]" : state === "coming-soon" ? "text-[#1d4ed8]" : "text-[#57534d]",
      )} />
      <span>{label}</span>
    </div>
  );
}

export function PositionAvailabilityControl({
  item,
  menuProps,
  busy,
  statusOnly = false,
}: {
  item: CatalogItem;
  menuProps: CatalogPositionAvailabilityMenuProps;
  busy: boolean;
  statusOnly?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<"main" | "schedule" | "stop">("main");
  usePositionSidePeekOverlay(open, () => setOpen(false));
  useEffect(() => {
    if (!open) setView("main");
  }, [open]);
  if (statusOnly) return <PositionAvailabilityStatus item={item} menuProps={menuProps} />;
  const effective = getEffectiveAvailability(item, new Date(), {
    unavailableDisplayMode: menuProps.stopDisplayMode,
    outsideScheduleMode: menuProps.outsideScheduleMode,
    weeklySchedule: menuProps.weeklySchedule,
    scheduleMode: "available",
  });
  const state = item.status === "archive"
    ? "archive"
    : menuProps.manualStopped
      ? "stopped"
      : menuProps.hasSchedule
        ? "schedule"
        : effective.orderable
          ? "available"
          : "unavailable";
  const label = state === "archive"
    ? "В архиве"
    : state === "stopped"
      ? "На стопе"
      : state === "schedule"
        ? "По расписанию"
        : state === "unavailable"
          ? "Недоступно"
          : "Доступно";
  const Icon = state === "archive" ? XCircle : state === "stopped" ? Prohibit : state === "available" ? CheckCircle : Clock;

  if (state === "archive") {
    return (
      <div
        role="status"
        data-position-availability-status="archive"
        className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#e7e5e4] bg-[#f5f5f4] px-2.5 text-[13px] font-medium text-[#57534d]"
      >
        <Icon size={16} className="shrink-0" />
        <span>{label}</span>
      </div>
    );
  }

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setView("main");
      }}
    >
      <PopoverTrigger asChild>
        <button
          type="button"
          data-position-availability-trigger
          disabled={busy}
          className={cn(
            "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#e7e5e4] bg-white px-2.5 text-[13px] font-medium text-[#292524] shadow-sm transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:cursor-not-allowed disabled:opacity-50",
            state === "stopped" && "border-[#fde68a] bg-[#fffbeb] hover:bg-[#fef3c7]",
          )}
        >
          <Icon size={16} className={cn("shrink-0", state === "stopped" ? "text-[#a16207]" : "text-[#57534d]")} />
          <span>{label}</span>
          <CaretDown size={13} weight="bold" className="shrink-0 text-[#79716b]" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="bottom"
        align="end"
        sideOffset={4}
        collisionPadding={12}
        className={cn(
          "z-[100005] p-1",
          view === "schedule" ? "w-auto border-0 bg-transparent p-0 shadow-none" : "w-[230px] rounded-[10px]",
        )}
      >
        {view === "main" && (
          <div className="space-y-0.5" role="menu" aria-label="Доступность позиции">
            <button
              type="button"
              role="menuitem"
              onClick={() => setView("stop")}
              className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-[#44403b] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              <Prohibit size={15} />
              <span className="min-w-0 flex-1 truncate">{menuProps.manualStopped ? "Позиция на стопе" : "Поставить на стоп"}</span>
              <CaretRight size={13} weight="bold" className="text-[#a8a29e]" />
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => setView("schedule")}
              className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-[#44403b] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              <Clock size={15} />
              <span className="min-w-0 flex-1 truncate">{menuProps.hasSchedule ? "Расписание" : "Добавить расписание"}</span>
              <CaretRight size={13} weight="bold" className="text-[#a8a29e]" />
            </button>
          </div>
        )}
        {view === "schedule" && (
          <CatalogSchedulePopover
            scheduleId={menuProps.scheduleId}
            hasSchedule={menuProps.hasSchedule}
            initialSchedule={menuProps.weeklySchedule}
            initialOutsideScheduleMode={menuProps.outsideScheduleMode}
            onChange={(schedule, outsideScheduleMode) => {
              menuProps.onScheduleChange(schedule, outsideScheduleMode);
            }}
            onDelete={() => {
              menuProps.onScheduleDelete();
              setOpen(false);
            }}
          />
        )}
        {view === "stop" && (
          <div>
            <button
              type="button"
              onClick={() => setView("main")}
              className="mb-1 flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] font-medium text-[#44403b] hover:bg-[#f5f5f4]"
            >
              <ArrowLeft size={14} weight="bold" />
              {menuProps.manualStopped ? "Позиция на стопе" : "Поставить на стоп"}
            </button>
            {([
              { value: "hidden", label: "Скрывать из меню" },
              { value: "comingSoon", label: "Показывать как “скоро будет”" },
            ] as const).map((option) => (
              <button
                key={option.value}
                type="button"
                role="menuitemradio"
                aria-checked={menuProps.stopDisplayMode === option.value}
                onClick={() => {
                  menuProps.onStopDisplayModeChange(option.value);
                  if (!menuProps.manualStopped) menuProps.onManualStopChange(true);
                  setView("main");
                }}
                className="flex min-h-8 w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] text-[#44403b] hover:bg-[#f5f5f4]"
              >
                <span className="min-w-0 flex-1">{option.label}</span>
                {menuProps.stopDisplayMode === option.value && <Check size={14} weight="bold" />}
              </button>
            ))}
            {menuProps.manualStopped && (
              <>
                <div className="my-1 h-px bg-[#e7e5e4]" />
                <button
                  type="button"
                  onClick={() => {
                    menuProps.onManualStopChange(false);
                    setOpen(false);
                  }}
                  className="flex h-8 w-full items-center gap-2 rounded-lg px-2 text-left text-[13px] text-[#44403b] hover:bg-[#f5f5f4]"
                >
                  <ArrowUUpLeft size={15} />
                  Убрать со стопа
                </button>
              </>
            )}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}

type ItemBaseAvailabilityMode = Exclude<AvailabilityMode, "unavailable">;

export function isItemStopOverrideActive(item: CatalogItem) {
  return item.status === "stopped" || item.status === "coming-soon";
}

export function getItemBaseAvailabilityMode(item: CatalogItem): ItemBaseAvailabilityMode {
  return item.scheduled ? "schedule" : "always";
}

export function getEffectiveAvailability(
  item: CatalogItem,
  now: Date,
  settings: {
    unavailableDisplayMode: UnavailableDisplayMode;
    outsideScheduleMode: OutsideScheduleMode;
    weeklySchedule: WeeklySchedule;
    scheduleMode?: AvailabilityScheduleMode;
  },
) {
  if (item.status === "archive") return { visible: false, orderable: false, badge: "В архиве" as const };
  if (isItemStopOverrideActive(item)) {
    return {
      visible: settings.unavailableDisplayMode === "comingSoon",
      orderable: false,
      badge: settings.unavailableDisplayMode === "comingSoon" ? ("Скоро будет" as const) : null,
    };
  }
  if (getItemBaseAvailabilityMode(item) === "always") return { visible: true, orderable: true, badge: null };

  const orderable = isWeeklyScheduleOrderable(
    settings.weeklySchedule,
    settings.scheduleMode ?? "available",
    now,
  );
  return orderable
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
                  <div className="mt-4">
                    <CatalogWeeklyScheduleEditor
                      scheduleId={scheduleId}
                      weeklySchedule={weeklySchedule}
                      onWeeklyScheduleChange={onWeeklyScheduleChange}
                    />
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
          title: "Доступно",
          description: "Раздел виден гостям и доступен для заказа в любое время",
        },
        {
          id: "unavailable",
          title: "На стопе",
          description: "Раздел остаётся видимым гостям, но позиции нельзя заказать",
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

function PositionCardDisplayConfigurator({
  item,
  displayMode,
  onChange,
}: {
  item: CatalogItem;
  displayMode: DisplayModeOption;
  onChange: (mode: DisplayModeOption) => void;
}) {
  const showPrice = displayMode !== "no-price";
  const showAddButton = displayMode === "full";

  return (
    <section
      data-position-display-configurator
      aria-label="Настройки отображения карточки"
      className="grid grid-cols-[128px_minmax(0,1fr)] overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white"
    >
      <div className="flex min-h-[148px] items-center justify-center border-r border-[#e7e5e4] bg-[#f5f5f4] p-2.5">
        <div
          data-position-card-preview
          className="w-full overflow-hidden rounded-[10px] bg-white p-1.5 shadow-[0_1px_4px_rgba(41,37,36,0.1)]"
        >
          <div className="relative aspect-[4/3] overflow-hidden rounded-[8px] bg-zinc-100">
            {item.thumbnailUrl ? (
              <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <UtensilsCrossed size={28} className="text-zinc-300" aria-hidden="true" />
              </div>
            )}
            {showAddButton && (
              <span
                data-position-card-preview-add
                className="absolute bottom-1.5 right-1.5 flex size-6 items-center justify-center rounded-full bg-[#292524] text-white shadow-sm"
                aria-hidden="true"
              >
                <Plus size={13} weight="bold" />
              </span>
            )}
          </div>
          <div className="px-0.5 pb-0.5 pt-1.5">
            <div className="line-clamp-2 min-h-7 text-[11px] font-semibold leading-[14px] text-[#292524]">
              {item.title}
            </div>
            {showPrice && (
              <div data-position-card-preview-price className="mt-1 text-[11px] font-semibold leading-4 text-[#292524]">
                {formatPrice(item.priceWithSale ?? item.price)}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex min-w-0 flex-col justify-center px-3">
        <div className="flex min-h-12 items-center justify-between gap-3 border-b border-[#e7e5e4]">
          <span className="min-w-0 text-[13px] leading-5 text-[#292524]">Показывать цену</span>
          <Switch
            checked={showPrice}
            aria-label="Показывать цену"
            onCheckedChange={(checked) => onChange(checked ? "no-button" : "no-price")}
          />
        </div>
        <div className="flex min-h-12 items-center justify-between gap-3">
          <span className={cn("min-w-0 text-[13px] leading-5", showPrice ? "text-[#292524]" : "text-[#a8a29e]")}>Кнопка «Добавить»</span>
          <Switch
            checked={showAddButton}
            disabled={!showPrice}
            aria-label="Показывать кнопку «Добавить»"
            onCheckedChange={(checked) => onChange(checked ? "full" : "no-button")}
          />
        </div>
      </div>
    </section>
  );
}

function DisplayTab({ item, editMode, onChange }: { item: CatalogItem; editMode: boolean; onChange: (mode: DisplayModeOption) => void }) {
  const [displayMode, setDisplayMode] = useState<DisplayModeOption>(item.displayMode);

  useEffect(() => {
    setDisplayMode(item.displayMode);
  }, [item.id, item.displayMode]);

  const handleChange = (nextDisplayMode: DisplayModeOption) => {
    setDisplayMode(nextDisplayMode);
    onChange(nextDisplayMode);
  };

  if (editMode) {
    return <PositionCardDisplayConfigurator item={item} displayMode={displayMode} onChange={handleChange} />;
  }

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
              onSelect={() => handleChange(option.id)}
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

type OptionsPopoverTab = "variants" | "settings";

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
    <div className="flex shrink-0 items-center overflow-hidden rounded-[8px] border border-[#e7e5e4] bg-[#f5f5f4]">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => onChange(option.value)}
          className={cn(
            "flex h-[26px] min-w-[90px] items-center justify-center rounded-[7px] px-2.5 text-[13px] transition",
            value === option.value
              ? "bg-white font-normal text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
              : "text-[#79716b] hover:text-[#44403b]",
          )}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function OptionVariantRow({
  variant,
  currency,
  transient,
  autoFocus,
  onPatch,
  onNameBlur,
  onDelete,
}: {
  variant: PositionOptionVariant;
  currency: string;
  transient: boolean;
  autoFocus: boolean;
  onPatch: (patch: Partial<PositionOptionVariant>) => void;
  onNameBlur: () => void;
  onDelete: () => void;
}) {
  return (
    <div className="flex h-9 w-full items-center gap-1.5">
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
      <div className="relative h-9 w-[128px] shrink-0">
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
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[13px] text-[#666]">
          {currency}
        </span>
      </div>
      <Tooltip label="Удалить вариант" side="top">
        <button
          type="button"
          aria-label="Удалить вариант"
          onClick={onDelete}
          className="flex size-4 shrink-0 items-center justify-center rounded-full text-[#79716b] transition hover:text-[#c10007] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <X size={16} />
        </button>
      </Tooltip>
    </div>
  );
}

function SortableOptionVariantRow({
  variant,
  currency,
  transient,
  autoFocus,
  onPatch,
  onNameBlur,
  onDelete,
}: {
  variant: PositionOptionVariant;
  currency: string;
  transient: boolean;
  autoFocus: boolean;
  onPatch: (patch: Partial<PositionOptionVariant>) => void;
  onNameBlur: () => void;
  onDelete: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: variant.id,
    transition: DND_TRANSITION,
  });

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition: reducedMotion ? undefined : transition,
        zIndex: isDragging ? 2 : undefined,
      }}
      className={cn(
        "flex h-9 w-full items-center gap-1.5",
        isDragging && "relative rounded-[8px] bg-white opacity-80 shadow-[0_8px_24px_rgba(41,37,36,0.12)]",
      )}
    >
      <button
        ref={setActivatorNodeRef}
        type="button"
        aria-label={`Перетащить вариант «${variant.name || "Новый вариант"}»`}
        {...attributes}
        {...listeners}
        className="flex size-4 shrink-0 touch-none cursor-grab items-center justify-center rounded-[4px] text-[#79716b] transition hover:bg-[#f5f5f4] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      >
        <DotsSixVertical size={16} />
      </button>
      <div className="min-w-0 flex-1">
        <OptionVariantRow
          variant={variant}
          currency={currency}
          transient={transient}
          autoFocus={autoFocus}
          onPatch={onPatch}
          onNameBlur={onNameBlur}
          onDelete={onDelete}
        />
      </div>
    </div>
  );
}

function OptionGroupPopoverContent({
  group,
  currency,
  open,
  defaultTab,
  transientVariantIds,
  focusedVariantId,
  autoFocusName,
  onOpenChange,
  onPatch,
  onCreateVariant,
  onPatchVariant,
  onVariantNameBlur,
  onDeleteVariant,
  onReorderVariants,
  onDelete,
}: {
  group: PositionOptionGroup;
  currency: string;
  open: boolean;
  defaultTab: OptionsPopoverTab;
  transientVariantIds: Set<string>;
  focusedVariantId: string | null;
  autoFocusName: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch: (patch: Partial<PositionOptionGroup>) => void;
  onCreateVariant: (name: string) => void;
  onPatchVariant: (id: string, patch: Partial<PositionOptionVariant>) => void;
  onVariantNameBlur: (id: string) => void;
  onDeleteVariant: (id: string) => void;
  onReorderVariants: (variants: PositionOptionVariant[]) => void;
  onDelete: () => void;
}) {
  const [activeTab, setActiveTab] = useState<OptionsPopoverTab>(defaultTab);
  const [pendingVariantDraft, setPendingVariantDraft] = useState<string | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  usePositionSidePeekOverlay(open, () => onOpenChange(false));

  useEffect(() => {
    if (open) {
      setActiveTab(defaultTab);
      setPendingVariantDraft(null);
    } else {
      setPendingVariantDraft(null);
    }
  }, [defaultTab, open]);

  useEffect(() => {
    if (!open || !autoFocusName) return;
    nameInputRef.current?.focus();
    nameInputRef.current?.select();
  }, [autoFocusName, open]);

  const variantSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const lastVariantOverId = useRef<string | null>(null);
  const handleVariantDragEnd = ({ active, over }: DragEndEvent) => {
    const overId = over && active.id !== over.id ? String(over.id) : lastVariantOverId.current;
    lastVariantOverId.current = null;
    if (!overId || active.id === overId) return;
    const fromIndex = group.variants.findIndex((variant) => variant.id === String(active.id));
    const toIndex = group.variants.findIndex((variant) => variant.id === overId);
    if (fromIndex < 0 || toIndex < 0) return;
    onReorderVariants(arrayMove(group.variants, fromIndex, toIndex));
  };

  const handlePendingVariantChange = (value: string) => {
    setPendingVariantDraft(value);
    if (!value.trim()) return;
    setPendingVariantDraft(null);
    onCreateVariant(value);
  };

  const handlePendingVariantBlur = () => {
    if (!pendingVariantDraft?.trim()) setPendingVariantDraft(null);
  };

  return (
    <PopoverContent
      data-option-popover
      align="end"
      sideOffset={6}
      collisionPadding={12}
      onPointerDownOutside={() => onOpenChange(false)}
      className="flex max-h-[min(640px,calc(100vh-24px))] w-[334px] flex-col gap-4 overflow-hidden rounded-[12px] border-[#e7e5e4] p-[13px] shadow-[0_18px_42px_rgba(41,37,36,0.14)]"
    >
      <div className="shrink-0 space-y-1.5">
        <label className="block text-[13px] font-medium leading-5 text-[#44403b]" htmlFor={`option-group-name-${group.id}`}>
          Название опции
        </label>
        <Input
          id={`option-group-name-${group.id}`}
          ref={nameInputRef}
          autoFocus={autoFocusName}
          onFocus={(event) => {
            if (autoFocusName) event.currentTarget.select();
          }}
          value={group.name}
          onChange={(event) => onPatch({ name: event.target.value })}
          placeholder="Например, Размер"
          aria-label="Название опции"
          className="h-9 rounded-[8px] border-[#e5e5e5] bg-white px-3 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.1)] focus:border-[#a8a29e]"
        />
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-0.5">
        <div className="space-y-2">
          <div className="flex items-center" role="tablist" aria-label="Настройки опции">
            {([
              { id: "variants", label: "Варианты" },
              { id: "settings", label: "Настройки" },
            ] as const).map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex h-[26px] items-center rounded-[7px] px-2.5 text-[12px] transition",
                  activeTab === tab.id
                    ? "border border-[#e7e5e4] bg-white text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.05)]"
                    : "text-[#79716b] hover:text-[#44403b]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === "settings" ? (
            <div className="space-y-0">
              <div className="flex min-h-9 items-center justify-between gap-6 py-2">
                <Tooltip label="Гость должен выбрать хотя бы один вариант из этой группы" side="top">
                  <span className="cursor-help border-b border-dashed border-[#79716b] text-[13px] leading-5 text-[#57534d]">Обязательный выбор</span>
                </Tooltip>
                <Switch
                  checked={group.required}
                  onCheckedChange={(checked) => onPatch({ required: checked })}
                  aria-label="Обязательный выбор"
                  className="data-[state=checked]:bg-[#44403b]"
                />
              </div>
              <div className="flex min-h-9 items-center justify-between gap-4 py-2">
                <Tooltip
                  label="Один вариант ограничивает выбор одним значением; несколько позволяет выбрать несколько"
                  side="top"
                  contentClassName="max-w-[240px] whitespace-normal"
                >
                  <span className="cursor-help border-b border-dashed border-[#79716b] text-[13px] leading-5 text-[#57534d]">Можно выбрать</span>
                </Tooltip>
                <OptionSegment<PositionOptionSelection>
                  value={group.selection}
                  options={[{ value: "single", label: "Один" }, { value: "multiple", label: "Несколько" }]}
                  onChange={(selection) => onPatch({ selection })}
                />
              </div>
              <div className="flex min-h-9 items-center justify-between gap-4 py-2">
                <Tooltip label="Итоговая заменяет цену позиции, доплата прибавляется к ней" side="top">
                  <span className="cursor-help border-b border-dashed border-[#79716b] text-[13px] leading-5 text-[#57534d]">Цена вариантов</span>
                </Tooltip>
                <OptionSegment<PositionOptionPricing>
                  value={group.pricing}
                  options={[{ value: "total", label: "Итоговая" }, { value: "surcharge", label: "Доплата" }]}
                  onChange={(pricing) => onPatch({ pricing })}
                />
              </div>
            </div>
          ) : (
            <DndContext
              sensors={variantSensors}
              collisionDetection={closestCenter}
              modifiers={[restrictTableSortToVerticalAxis]}
              onDragStart={() => {
                lastVariantOverId.current = null;
              }}
              onDragOver={({ active, over }) => {
                if (over && active.id !== over.id) lastVariantOverId.current = String(over.id);
              }}
              onDragCancel={() => {
                lastVariantOverId.current = null;
              }}
              onDragEnd={handleVariantDragEnd}
            >
              <SortableContext items={group.variants.map((variant) => variant.id)} strategy={verticalListSortingStrategy}>
                <div data-option-variants-list className="max-h-[260px] space-y-1.5 overflow-y-auto pr-0.5">
                  {group.variants.map((variant) => (
                    <SortableOptionVariantRow
                      key={variant.id}
                      variant={variant}
                      currency={currency}
                      transient={transientVariantIds.has(variant.id)}
                      autoFocus={focusedVariantId === variant.id}
                      onPatch={(patch) => onPatchVariant(variant.id, patch)}
                      onNameBlur={() => onVariantNameBlur(variant.id)}
                      onDelete={() => onDeleteVariant(variant.id)}
                    />
                  ))}
                  {pendingVariantDraft === null ? (
                    <button
                      type="button"
                      aria-label={group.variants.length === 0 ? "Добавить вариант" : "Добавить еще вариант"}
                      onClick={() => setPendingVariantDraft("")}
                      className={cn(
                        "flex h-9 min-w-0 items-center rounded-[8px] border border-[#e5e5e5] bg-white px-3 text-left text-[13px] text-[#79716b] shadow-[0_1px_2px_rgba(0,0,0,0.08)] transition hover:border-[#a8a29e] focus:border-[#a8a29e] focus:outline-none focus:ring-0",
                        group.variants.length === 0 ? "w-full" : "ml-[22px] w-[calc(100%-22px)]",
                      )}
                    >
                      {group.variants.length === 0 ? "Добавить вариант" : "Добавить еще вариант"}
                    </button>
                  ) : (
                    <Input
                      autoFocus
                      value={pendingVariantDraft}
                      aria-label="Название варианта"
                      placeholder={group.variants.length === 0 ? "Добавить вариант" : "Добавить еще вариант"}
                      onChange={(event) => handlePendingVariantChange(event.target.value)}
                      onBlur={handlePendingVariantBlur}
                      onKeyDown={(event) => {
                        if (event.key === "Escape" && !pendingVariantDraft.trim()) setPendingVariantDraft(null);
                      }}
                      className={cn(
                        "h-9 rounded-[8px] border-[#e5e5e5] bg-white px-3 text-[13px] text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.08)] focus:border-[#a8a29e] focus:outline-none focus:ring-0",
                        group.variants.length === 0 ? "w-full" : "ml-[22px] w-[calc(100%-22px)]",
                      )}
                    />
                  )}
                </div>
              </SortableContext>
            </DndContext>
          )}
        </div>
      </div>

      <div className="-mx-[13px] -mb-[13px] flex h-[35px] shrink-0 items-center border-t border-[#e7e5e4] px-3">
        <button
          type="button"
          onClick={onDelete}
          className="inline-flex h-full items-center gap-2 text-[12px] font-normal text-[#e7000b] transition hover:text-[#b90008] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#e7000b]/20"
        >
          <Trash size={16} aria-hidden="true" />
          Удалить опцию
        </button>
      </div>
    </PopoverContent>
  );
}

function SortableOptionGroupRow({
  group,
  currency,
  open,
  defaultTab,
  transientVariantIds,
  focusedVariantId,
  autoFocusName,
  onOpenChange,
  onPatch,
  onCreateVariant,
  onPatchVariant,
  onVariantNameBlur,
  onDeleteVariant,
  onReorderVariants,
  onDelete,
}: {
  group: PositionOptionGroup;
  currency: string;
  open: boolean;
  defaultTab: OptionsPopoverTab;
  transientVariantIds: Set<string>;
  focusedVariantId: string | null;
  autoFocusName: boolean;
  onOpenChange: (open: boolean) => void;
  onPatch: (patch: Partial<PositionOptionGroup>) => void;
  onCreateVariant: (name: string) => void;
  onPatchVariant: (id: string, patch: Partial<PositionOptionVariant>) => void;
  onVariantNameBlur: (id: string) => void;
  onDeleteVariant: (id: string) => void;
  onReorderVariants: (variants: PositionOptionVariant[]) => void;
  onDelete: () => void;
}) {
  const reducedMotion = usePrefersReducedMotion();
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: group.id,
    transition: DND_TRANSITION,
  });
  const displayName = group.name || "Новая опция";
  const previewVariants = group.variants.slice(0, 4);
  const extraVariants = Math.max(0, group.variants.length - previewVariants.length);

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <div
        ref={setNodeRef}
        style={{
          transform: CSS.Transform.toString(transform),
          transition: reducedMotion ? undefined : transition,
          zIndex: isDragging ? 2 : undefined,
        }}
        className={cn(
          "flex min-h-[55px] w-full items-center gap-2 border-b border-[#e7e5e4] px-3 last:border-b-0",
          isDragging && "relative rounded-[8px] bg-white opacity-80 shadow-[0_8px_24px_rgba(41,37,36,0.12)]",
        )}
        data-option-group-row
      >
        <button
          ref={setActivatorNodeRef}
          type="button"
          aria-label={`Перетащить опцию «${displayName}»`}
          {...attributes}
          {...listeners}
          className="flex size-4 shrink-0 touch-none cursor-grab items-center justify-center rounded-[4px] text-[#79716b] transition hover:bg-[#f5f5f4] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <DotsSixVertical size={16} />
        </button>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Редактировать группу «${displayName}»`}
            className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] leading-4 text-[#292524]">{displayName}</span>
              <span className="mt-1 flex min-w-0 gap-1 overflow-hidden">
                {previewVariants.map((variant) => (
                  <span key={variant.id} className="max-w-[92px] shrink-0 truncate rounded-[5px] bg-[#f5f5f4] px-1.5 py-0.5 text-[11px] leading-4 text-[#79716b]">
                    {variant.name || "Без названия"}
                  </span>
                ))}
                {extraVariants > 0 && <span className="shrink-0 rounded-[5px] bg-[#f5f5f4] px-1.5 py-0.5 text-[11px] leading-4 text-[#79716b]">+{extraVariants}</span>}
              </span>
            </span>
            <CaretRight size={16} className="shrink-0 text-[#a8a29e]" />
          </button>
        </PopoverTrigger>
      </div>
      <OptionGroupPopoverContent
        group={group}
        currency={currency}
        open={open}
        defaultTab={defaultTab}
        transientVariantIds={transientVariantIds}
        focusedVariantId={focusedVariantId}
        autoFocusName={autoFocusName}
        onOpenChange={onOpenChange}
        onPatch={onPatch}
        onCreateVariant={onCreateVariant}
        onPatchVariant={onPatchVariant}
        onVariantNameBlur={onVariantNameBlur}
        onDeleteVariant={onDeleteVariant}
        onReorderVariants={onReorderVariants}
        onDelete={onDelete}
      />
    </Popover>
  );
}

function OptionsTab({
  item,
  onSavedGroupsChange,
  onGroupsChange,
}: {
  item: CatalogItem;
  onSavedGroupsChange: (count: number) => void;
  onGroupsChange: (groups: PositionOptionGroup[]) => void;
}) {
  const { account } = useMockAuth();
  const currency = account?.workspace.currency ?? "KZT";
  const [groups, setGroups] = useState<PositionOptionGroup[]>(() => {
    const stored = readJsonRecord<Record<string, PositionOptionGroup[]>>(CATALOG_POSITION_OPTIONS_STORAGE_KEY, {});
    return item.optionGroups ?? (Array.isArray(stored[item.id]) ? stored[item.id] : seedOptionGroups(item.optionsCount));
  });
  const [openGroupId, setOpenGroupId] = useState<string | null>(null);
  const [openTab, setOpenTab] = useState<OptionsPopoverTab>("variants");
  const [newGroupId, setNewGroupId] = useState<string | null>(null);
  const [transientVariantIds, setTransientVariantIds] = useState<Set<string>>(() => new Set());
  const [focusedVariantId, setFocusedVariantId] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<PositionOptionGroup | null>(null);
  usePositionSidePeekOverlay(Boolean(pendingDelete), () => setPendingDelete(null));

  useEffect(() => {
    const stored = readJsonRecord<Record<string, PositionOptionGroup[]>>(CATALOG_POSITION_OPTIONS_STORAGE_KEY, {});
    setGroups(item.optionGroups ?? (Array.isArray(stored[item.id]) ? stored[item.id] : seedOptionGroups(item.optionsCount)));
    setOpenGroupId(null);
    setOpenTab("variants");
    setNewGroupId(null);
    setTransientVariantIds(new Set());
    setFocusedVariantId(null);
    setPendingDelete(null);
  }, [item.id]);

  const commitGroups = (next: PositionOptionGroup[]) => {
    setGroups(next);
    onGroupsChange(next);
    onSavedGroupsChange(next.length);
  };

  const patchGroup = (groupId: string, patch: Partial<PositionOptionGroup>) => {
    commitGroups(groups.map((group) => group.id === groupId ? { ...group, ...patch } : group));
  };

  const updateGroup = (groupId: string, updater: (group: PositionOptionGroup) => PositionOptionGroup) => {
    commitGroups(groups.map((group) => group.id === groupId ? updater(group) : group));
  };

  const createVariant = (groupId: string, name: string) => {
    const id = createOptionEntityId("variant");
    setFocusedVariantId(id);
    updateGroup(groupId, (group) => ({
      ...group,
      variants: [...group.variants, { id, name, price: "0" }],
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
    setFocusedVariantId((current) => current === variantId ? null : current);
  };

  const handleVariantNameBlur = (groupId: string, variantId: string) => {
    setFocusedVariantId((current) => current === variantId ? null : current);
    if (!transientVariantIds.has(variantId)) return;
    const group = groups.find((candidate) => candidate.id === groupId);
    const variant = group?.variants.find((candidate) => candidate.id === variantId);
    if (!variant?.name.trim()) {
      deleteVariant(groupId, variantId);
      return;
    }
    setTransientVariantIds((current) => {
      const next = new Set(current);
      next.delete(variantId);
      return next;
    });
  };

  const closeGroup = (groupId: string) => {
    const group = groups.find((candidate) => candidate.id === groupId);
    if (group) {
      const transientIds = new Set(transientVariantIds);
      const cleanedVariants = group.variants.filter((variant) => !transientIds.has(variant.id) || variant.name.trim());
      if (cleanedVariants.length !== group.variants.length) {
        commitGroups(groups.map((candidate) => candidate.id === groupId ? { ...candidate, variants: cleanedVariants } : candidate));
      }
      const groupVariantIds = new Set(group.variants.map((variant) => variant.id));
      setTransientVariantIds((current) => new Set([...current].filter((id) => !groupVariantIds.has(id))));
    }
    setOpenGroupId((current) => current === groupId ? null : current);
    setNewGroupId((current) => current === groupId ? null : current);
    setFocusedVariantId(null);
  };

  const requestDelete = (group: PositionOptionGroup) => {
    closeGroup(group.id);
    if (group.variants.length > 0) {
      setPendingDelete(group);
      return;
    }
    commitGroups(groups.filter((candidate) => candidate.id !== group.id));
  };

  const deletePendingGroup = () => {
    if (!pendingDelete) return;
    commitGroups(groups.filter((candidate) => candidate.id !== pendingDelete.id));
    setPendingDelete(null);
  };

  const handleGroupDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const fromIndex = groups.findIndex((group) => group.id === String(active.id));
    const toIndex = groups.findIndex((group) => group.id === String(over.id));
    if (fromIndex < 0 || toIndex < 0) return;
    commitGroups(arrayMove(groups, fromIndex, toIndex));
  };

  const startDraft = () => {
    const next = createOptionGroup();
    commitGroups([...groups, next]);
    setOpenTab("settings");
    setNewGroupId(next.id);
    setOpenGroupId(next.id);
  };
  const groupSensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  return (
    <>
      <div data-options-editor className="w-full">
        <div className="overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white">
          <DndContext
            sensors={groupSensors}
            collisionDetection={closestCenter}
            modifiers={[restrictTableSortToVerticalAxis]}
            onDragEnd={handleGroupDragEnd}
          >
            <SortableContext items={groups.map((group) => group.id)} strategy={verticalListSortingStrategy}>
              {groups.map((group) => (
                <SortableOptionGroupRow
                  key={group.id}
                  group={group}
                  currency={currency}
                  open={openGroupId === group.id}
                  defaultTab={openTab}
                  transientVariantIds={transientVariantIds}
                  focusedVariantId={focusedVariantId}
                  autoFocusName={newGroupId === group.id}
                  onOpenChange={(open) => {
                    if (open) {
                      setOpenGroupId(group.id);
                      setOpenTab("variants");
                      setNewGroupId(null);
                    } else {
                      closeGroup(group.id);
                    }
                  }}
                  onPatch={(patch) => patchGroup(group.id, patch)}
                  onCreateVariant={(name) => createVariant(group.id, name)}
                  onPatchVariant={(variantId, patch) => patchVariant(group.id, variantId, patch)}
                  onVariantNameBlur={(variantId) => handleVariantNameBlur(group.id, variantId)}
                  onDeleteVariant={(variantId) => deleteVariant(group.id, variantId)}
                  onReorderVariants={(variants) => updateGroup(group.id, (candidate) => ({ ...candidate, variants }))}
                  onDelete={() => requestDelete(group)}
                />
              ))}
            </SortableContext>
          </DndContext>
          <button
            type="button"
            aria-label="Добавить опцию"
            onClick={startDraft}
            className="flex h-9 w-full items-center gap-2 px-3 text-[12px] font-medium text-[#292524] transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10"
          >
            <Plus size={16} />
            Добавить опцию
          </button>
        </div>
      </div>

      <AlertDialog open={Boolean(pendingDelete)} onOpenChange={(open) => { if (!open) setPendingDelete(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить опцию «{pendingDelete?.name || "Новая опция"}»?</AlertDialogTitle>
            <AlertDialogDescription>Опция и все её варианты будут удалены.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={deletePendingGroup} className="bg-[#c10007] text-white hover:bg-[#a00006]">Удалить</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

const POSITION_AVAILABILITY_OPTIONS = [
  { id: "always", label: "Доступно", Icon: CheckCircle },
  { id: "unavailable", label: "На стопе", Icon: LockLaminated },
  { id: "schedule", label: "По расписанию", Icon: CalendarDots },
] as const satisfies Array<{ id: AvailabilityMode; label: string; Icon: typeof CheckCircle }>;

function PositionAvailabilitySegmented({
  itemId,
  mode,
  disabled = false,
  onChange,
}: {
  itemId: string;
  mode: AvailabilityMode;
  disabled?: boolean;
  onChange: (mode: AvailabilityMode) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Доступность позиции"
      aria-disabled={disabled || undefined}
      className="grid h-7 grid-cols-[0.92fr_0.92fr_1.25fr] gap-0.5 overflow-hidden rounded-[8px] border border-[#e7e5e4] bg-[#f5f5f4] p-0.5"
      data-position-availability-segmented={itemId}
    >
      {POSITION_AVAILABILITY_OPTIONS.map(({ id, label, Icon }) => {
        const selected = mode === id;
        return (
          <button
            key={id}
            type="button"
            role="radio"
            aria-checked={selected}
            disabled={disabled}
            onClick={() => onChange(id)}
            className={cn(
              "flex min-w-0 items-center justify-center gap-1 rounded-[7px] px-1 text-[13px] leading-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:cursor-not-allowed",
              disabled
                ? "text-[#a8a29e]"
                : selected
                  ? "bg-white text-[#292524] shadow-[0_1px_1px_rgba(0,0,0,0.05)]"
                  : "text-[#79716b] hover:text-[#292524]",
            )}
          >
            <Icon size={14} weight="regular" className="shrink-0" aria-hidden="true" />
            <span className="truncate">{label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PositionAvailabilityDisplayGroup({
  ariaLabel,
  value,
  onChange,
}: {
  ariaLabel: string;
  value: "hidden" | "comingSoon";
  onChange: (value: "hidden" | "comingSoon") => void;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className="overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white">
      {([
        { id: "hidden", label: "Скрывать из меню" },
        { id: "comingSoon", label: "Показывать без возможности заказа" },
      ] as const).map((option, index) => {
        const selected = value === option.id;
        return (
          <button
            key={option.id}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.id)}
            className={cn(
              "flex h-[35px] w-full items-center gap-2 px-3 text-left text-[13px] leading-[18px] text-[#292524] transition hover:bg-[#fafaf9] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
              index > 0 && "border-t border-[#e7e5e4]",
            )}
          >
            <span className={cn(
              "flex size-4 shrink-0 items-center justify-center rounded-full border bg-white",
              selected ? "border-[#292524]" : "border-[#d6d3d1]",
            )}>
              {selected && <span className="size-2 rounded-full bg-[#292524]" />}
            </span>
            <span className="min-w-0 truncate">{option.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function PositionAvailabilityTab({
  item,
  editMode,
  onRestoreItem,
  unavailableDisplayMode,
  outsideScheduleMode,
  weeklySchedule,
  onModeChange,
  onUnavailableDisplayModeChange,
  onOutsideScheduleModeChange,
  onWeeklyScheduleChange,
}: {
  item: CatalogItem;
  editMode: boolean;
  onRestoreItem: (item: CatalogItem) => void;
  unavailableDisplayMode: UnavailableDisplayMode;
  outsideScheduleMode: OutsideScheduleMode;
  weeklySchedule: WeeklySchedule;
  onModeChange: (mode: AvailabilityMode) => void;
  onUnavailableDisplayModeChange: (mode: UnavailableDisplayMode) => void;
  onOutsideScheduleModeChange: (mode: OutsideScheduleMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
}) {
  const mode: AvailabilityMode = item.status === "archive"
    ? item.archivedAvailabilityMode ?? (item.scheduled ? "schedule" : "always")
    : isItemStopOverrideActive(item)
      ? "unavailable"
      : item.scheduled
        ? "schedule"
        : "always";

  if (editMode) {
    const isArchived = item.status === "archive";
    const displayMode = mode === "schedule" ? outsideScheduleMode : unavailableDisplayMode;

    return (
      <div className="space-y-3 px-4 pb-6 pt-2" data-position-availability-content={mode}>
        {isArchived && (
          <section
            aria-label="Архивная позиция"
            className="rounded-[14px] bg-[#f5f5f4] px-3.5 py-3"
          >
            <h3 className="text-[13px] font-semibold leading-[18px] text-[#292524]">Эти настройки недоступны для архивной позиции</h3>
            <p className="mt-1.5 max-w-[345px] text-[13px] leading-[18px] text-[#79716b]">Позиция в архиве. Чтобы изменить настройки доступности, верните ее из архива</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onRestoreItem(item)}
              className="mt-2 h-7 rounded-[9px] border-[#e7e5e4] bg-white px-2 text-[12px] font-normal text-[#79716b] hover:bg-[#fafaf9] hover:text-[#292524] focus-visible:ring-[#292524]/10"
            >
              <ArrowUUpLeft size={16} aria-hidden="true" />
              Вернуть из архива
            </Button>
          </section>
        )}

        <PositionAvailabilitySegmented
          itemId={item.id}
          mode={mode}
          disabled={isArchived}
          onChange={onModeChange}
        />

        {!isArchived && mode === "unavailable" && (
          <section aria-label="Отображение в меню" className="space-y-1.5">
            <h3 className="px-1.5 text-[13px] font-normal leading-5 text-[#0a0a0a]">Отображение в меню</h3>
            <PositionAvailabilityDisplayGroup
              ariaLabel="Отображение в меню"
              value={displayMode}
              onChange={onUnavailableDisplayModeChange}
            />
          </section>
        )}

        {!isArchived && mode === "schedule" && (
          <>
            <section aria-label="Расписание доступности" className="space-y-1.5">
              <h3 className="px-1.5 text-[13px] font-normal leading-5 text-[#0a0a0a]">Расписание доступности</h3>
              <CatalogWeeklyScheduleEditor
                scheduleId={`item-${item.id}`}
                weeklySchedule={weeklySchedule}
                onWeeklyScheduleChange={onWeeklyScheduleChange}
                variant="availability"
              />
            </section>
            <section aria-label="Отображение вне расписания" className="space-y-1.5">
              <h3 className="px-1.5 text-[13px] font-normal leading-5 text-[#0a0a0a]">Отображение вне расписания</h3>
              <PositionAvailabilityDisplayGroup
                ariaLabel="Отображение вне расписания"
                value={outsideScheduleMode}
                onChange={onOutsideScheduleModeChange}
              />
            </section>
          </>
        )}
      </div>
    );
  }

  return (
    <AvailabilityEditor
      mode={mode}
      options={[
        {
          id: "always",
          title: "Доступно",
          description: "Позиция видна гостям и доступна для заказа в любое время",
          disabled: item.status === "archive",
        },
        {
          id: "unavailable",
          title: "На стопе",
          description: "Позицию нельзя заказать, а её отображение настраивается ниже",
          disabled: item.status === "archive",
        },
        {
          id: "schedule",
          title: "По расписанию",
          description: "Позиция доступна для заказа только в указанные дни и часы",
          disabled: item.status === "archive",
        },
      ]}
      ariaLabel="Доступность позиции"
      scheduleId={`item-${item.id}`}
      unavailableDisplayMode={unavailableDisplayMode}
      outsideScheduleMode={outsideScheduleMode}
      weeklySchedule={weeklySchedule}
      onModeChange={onModeChange}
      onUnavailableDisplayModeChange={onUnavailableDisplayModeChange}
      onOutsideScheduleModeChange={onOutsideScheduleModeChange}
      onWeeklyScheduleChange={onWeeklyScheduleChange}
      unavailableNested={{
        label: "В меню:",
        hiddenText: "Позиция будет скрыта из меню, пока находится на стопе",
        comingSoonText: "Гости увидят позицию с пометкой «Скоро будет», но не смогут заказать",
      }}
      scheduleNested={{
        label: "Вне расписания:",
        hiddenText: "Позиция не будет отображаться в меню вне расписания",
        comingSoonText: "Гости увидят позицию, но не смогут заказать её до начала расписания",
      }}
    />
  );
}

function PositionEditorBody({
  activeTab,
  onTabChange,
  basicContent,
  promoContent,
  optionsContent,
  displayContent,
  availabilityContent,
}: {
  activeTab: EditorTab;
  onTabChange: (tab: EditorTab) => void;
  basicContent: ReactNode;
  promoContent: ReactNode;
  optionsContent: ReactNode;
  displayContent: ReactNode;
  availabilityContent: ReactNode;
}) {
  const activeContent = activeTab === "basic"
    ? <div data-editor-form-card className="bg-white pb-4 pt-4">{basicContent}</div>
    : activeTab === "promo"
      ? promoContent
      : activeTab === "options"
        ? optionsContent
        : activeTab === "display"
          ? displayContent
          : availabilityContent;

  return (
    <div data-position-editor-body>
      <WorkspaceLocalTabs
        tabs={EDITOR_TABS}
        value={activeTab}
        onValueChange={onTabChange}
      />
      <div className="pt-2">{activeContent}</div>
    </div>
  );
}

export function PositionEditor({
  item,
  mode = "edit",
  allItems,
  upsell,
  onUpsellChange,
  onArchiveItem,
  onRestoreItem,
  onMoveItem,
  onSetAvailabilityMode,
  unavailableDisplayMode,
  outsideScheduleMode,
  weeklySchedule,
  onUnavailableDisplayModeChange,
  onOutsideScheduleModeChange,
  onWeeklyScheduleChange,
  onRequestPermanentDelete,
  onDuplicateItem,
  headerMeta,
  autosaveStatus = "idle",
  onRetrySave,
  onDescriptionChange,
  onMediaAdded,
  onDraftChange,
  onCommitDraftName,
  onCreatePosition,
  onBackCreate,
  onBackEdit,
  detailPane = false,
  createCommitted = false,
  onCancelCreate,
  createDisabled = false,
  createSubmitting = false,
  creationDestination,
  creationFooter,
  onItemChange,
  forcedEditorTab,
  focusAnchor,
  forceBasicTabOnItemChange = false,
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
  onSetAvailabilityMode: (item: CatalogItem, mode: AvailabilityMode) => void;
  unavailableDisplayMode: UnavailableDisplayMode;
  outsideScheduleMode: OutsideScheduleMode;
  weeklySchedule: WeeklySchedule;
  onUnavailableDisplayModeChange: (mode: UnavailableDisplayMode) => void;
  onOutsideScheduleModeChange: (mode: OutsideScheduleMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  onRequestPermanentDelete: (item: CatalogItem) => void;
  onDuplicateItem?: (item: CatalogItem) => void;
  headerMeta?: ReactNode;
  autosaveStatus?: CatalogSaveStatus;
  onRetrySave?: () => void;
  onDescriptionChange?: (item: CatalogItem, value: string) => void;
  onMediaAdded?: (item: CatalogItem, previewUrl: string) => void;
  onDraftChange?: (patch: Partial<CatalogItem>) => void;
  onCommitDraftName?: (name: string) => void;
  onCreatePosition?: () => void;
  onBackCreate?: () => void;
  onBackEdit?: () => void;
  detailPane?: boolean;
  createCommitted?: boolean;
  onCancelCreate?: () => void;
  createDisabled?: boolean;
  createSubmitting?: boolean;
  creationDestination?: ReactNode;
  creationFooter?: ReactNode;
  onItemChange?: (item: CatalogItem, patch: Partial<CatalogItem>) => void;
  forcedEditorTab?: EditorTab;
  focusAnchor?: EditorFocusAnchor;
  forceBasicTabOnItemChange?: boolean;
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
  const [kbjuAutofocusKey, setKbjuAutofocusKey] = useState(0);
  const [titleEditing, setTitleEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState(item.title);
  const [positionActionsOpen, setPositionActionsOpen] = useState(false);
  const [positionScheduleEditorPinned, setPositionScheduleEditorPinned] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const activeTabRef = useRef(activeTab);
  const mountedItemRef = useRef(false);
  const [createNameError, setCreateNameError] = useState("");
  const sidePeek = usePositionSidePeek();
  const fixture = usePositionEditorFixture();

  const creationCanvas = mode === "create-modal";
  const creationPane = detailPane && mode === "create";
  const sidePeekActionsEnabled = mode === "edit" || createCommitted;
  const recommendationsDesignFixture = typeof window !== "undefined"
    && window.location.pathname.startsWith("/__design/position-editor/recommendations");
  const nextForcedTab = recommendationsDesignFixture
    ? "promo"
    : forcedEditorTab ?? (mode !== "edit" || forceBasicTabOnItemChange ? "basic" : undefined);

  useEffect(() => {
    const nextTab = mountedItemRef.current
      ? forceBasicTabOnItemChange
        ? "basic"
        : editorTabByItem.get(item.id) ?? activeTabRef.current
      : nextForcedTab ?? editorTabByItem.get(item.id) ?? "basic";
    mountedItemRef.current = true;
    activeTabRef.current = nextTab;
    setActiveTab(nextTab);
    setMedia(getInitialMedia(item));
    setBasePriceText(item.price ? formatMoneyInput(item.price) : "");
    setWeightUnit(item.weightLabel?.replace(/[\d.,\s]/g, "").trim() || "г");
    setDiscountOpen(item.hasDiscount);
    setDiscountAutofocusKey(0);
    setKbjuOpen(item.nutritionFilledCount > 0);
    setKbjuAutofocusKey(0);
    setTitleEditing(false);
    setTitleDraft(item.title);
    setCreateNameError("");
  }, [item.id, nextForcedTab]);

  useEffect(() => {
    if (!titleEditing) setTitleDraft(item.title);
  }, [item.title, titleEditing]);

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
    activeTabRef.current = tab;
    setActiveTab(tab);
  };

  const focusCreateName = () => {
    selectEditorTab("basic");
    window.setTimeout(() => {
      editorScrollRef.current
        ?.querySelector<HTMLInputElement>('input[aria-label="Название позиции"]')
        ?.focus();
    }, 0);
  };

  const requestCreatePosition = () => {
    if (mode !== "edit" && !item.title.trim()) {
      setCreateNameError("Введите название");
      focusCreateName();
      return;
    }
    setCreateNameError("");
    onCreatePosition?.();
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
  const manualStopped = isItemStopOverrideActive(item);
  const positionAvailabilityMenuProps: CatalogPositionAvailabilityMenuProps = {
    scheduleId: `item-${item.id}`,
    manualStopped,
    hasSchedule: item.scheduled,
    weeklySchedule,
    stopDisplayMode: unavailableDisplayMode,
    outsideScheduleMode,
    onManualStopChange: (stopped) => {
      onSetAvailabilityMode(item, stopped ? "unavailable" : "always");
    },
    onScheduleChange: (schedule, nextOutsideScheduleMode) => {
      const patch = {
        status: "active",
        weeklySchedule: schedule,
        scheduled: true,
        availabilityScheduleMode: "available",
        outsideScheduleMode: nextOutsideScheduleMode,
      } satisfies Partial<CatalogItem>;
      if (onItemChange) onItemChange(item, patch);
      else if (onDraftChange) onDraftChange(patch);
      else {
        onWeeklyScheduleChange(schedule);
        onSetAvailabilityMode(item, "schedule");
      }
    },
    onScheduleDelete: () => {
      const patch = {
        status: "active",
        scheduled: false,
        weeklySchedule: undefined,
        availabilityScheduleMode: undefined,
        outsideScheduleMode: undefined,
      } satisfies Partial<CatalogItem>;
      if (onItemChange) onItemChange(item, patch);
      else if (onDraftChange) onDraftChange(patch);
      else onSetAvailabilityMode(item, "always");
    },
    onStopDisplayModeChange: (displayMode) => {
      const patch = { unavailableDisplayMode: displayMode } satisfies Partial<CatalogItem>;
      if (onItemChange) onItemChange(item, patch);
      else if (onDraftChange) onDraftChange(patch);
      else onUnavailableDisplayModeChange(displayMode);
    },
    onScheduleEditorPinnedChange: setPositionScheduleEditorPinned,
    onMenuClose: () => setPositionActionsOpen(false),
  };

  const startTitleEditing = () => {
    setTitleDraft(item.title);
    setTitleEditing(true);
    window.setTimeout(() => {
      titleInputRef.current?.focus();
      titleInputRef.current?.select();
    }, 0);
  };

  const commitTitle = () => {
    const nextTitle = titleDraft.trim();
    if (nextTitle && nextTitle !== item.title) onItemChange?.(item, { title: nextTitle });
    setTitleEditing(false);
  };

  const renderPositionActionsMenu = (trigger: ReactNode) => {
    const availability: CatalogMenuAvailability = item.status === "stopped" || item.status === "coming-soon"
      ? "stopped"
      : item.scheduled
        ? "scheduled"
        : "available";
    const stopDisplayMode: CatalogStopDisplayMode = unavailableDisplayMode ?? (item.status === "coming-soon" ? "comingSoon" : "hidden");
    return (
      <DropdownMenu.Root
        open={fixture?.positionActionsOpen ? true : positionActionsOpen}
        onOpenChange={(nextOpen) => {
          setPositionActionsOpen(nextOpen);
          if (!nextOpen) setPositionScheduleEditorPinned(false);
        }}
      >
        <DropdownMenu.Trigger asChild>{trigger}</DropdownMenu.Trigger>
        <DropdownContent align="start" preventOutsideDismiss={positionScheduleEditorPinned}>
          <CatalogContextMenuContent
            entity="item"
            showAvailability
            scheduleId={`item-${item.id}`}
            availability={availability}
            stopDisplayMode={stopDisplayMode}
            outsideScheduleMode={outsideScheduleMode}
            weeklySchedule={weeklySchedule}
            archiveDisabled={isArchived}
            onRename={startTitleEditing}
            onMove={(event) => onMoveItem(item, getMovePopoverAnchor(event))}
            onDuplicate={onDuplicateItem ? () => onDuplicateItem(item) : undefined}
            onAvailabilityChange={(value) => {
              if (value === "available") onSetAvailabilityMode(item, "always");
              if (value === "scheduled") onSetAvailabilityMode(item, "schedule");
            }}
            onStopDisplayModeChange={(value) => {
              onUnavailableDisplayModeChange(value);
              onSetAvailabilityMode(item, "unavailable");
            }}
            onOutsideScheduleModeChange={onOutsideScheduleModeChange}
            onWeeklyScheduleChange={onWeeklyScheduleChange}
            onResetSchedule={() => {
              onSetAvailabilityMode(item, "always");
              onUnavailableDisplayModeChange("hidden");
              onOutsideScheduleModeChange("hidden");
              onWeeklyScheduleChange(createDefaultWeeklySchedule());
            }}
            onArchive={() => onArchiveItem(item)}
            onDelete={() => onRequestPermanentDelete(item)}
            positionAvailability={positionAvailabilityMenuProps}
          />
        </DropdownContent>
      </DropdownMenu.Root>
    );
  };

  const positionActions = (
    <div className="flex shrink-0 items-center gap-1 whitespace-nowrap">
      <PositionSaveStatus status={autosaveStatus} onRetry={onRetrySave} />
      {renderPositionActionsMenu(
        <button
          type="button"
          aria-label={`Действия с позицией «${item.title || "Новая позиция"}»`}
          data-position-actions-trigger
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#57534d] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <DotsThree size={18} weight="bold" />
        </button>,
      )}
      {onBackEdit && (
        <Tooltip label="Закрыть" side="bottom" delayDuration={250}>
          <button
            type="button"
            onClick={onBackEdit}
            aria-label="Закрыть"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#57534d] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <X size={17} />
          </button>
        </Tooltip>
      )}
    </div>
  );

  const closeSidePeek = sidePeek?.requestClose ?? (creationPane ? onBackCreate : onBackEdit);
  const detailPaneControls = (
    <div data-position-editor-controls className="flex h-8 shrink-0 items-center gap-0">
      {closeSidePeek && (
        <Tooltip label="Свернуть редактор" side="bottom" delayDuration={250}>
          <button
            type="button"
            onClick={closeSidePeek}
            aria-label="Свернуть редактор"
            data-position-editor-collapse
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-[#57534d] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <CaretDoubleRight size={16} weight="bold" aria-hidden="true" />
          </button>
        </Tooltip>
      )}
    </div>
  );

  const positionNavigation = headerMeta ? (
    <div data-position-editor-navigation>
      {headerMeta}
    </div>
  ) : null;

  const positionHeaderStatus = sidePeekActionsEnabled ? (
    <PositionAvailabilityStatus
      item={item}
      menuProps={positionAvailabilityMenuProps}
      compact
    />
  ) : null;

  return (
    <>
      <div
        data-position-create-canvas={creationCanvas || undefined}
        data-position-detail-pane={detailPane || undefined}
        data-position-create-pane-content={creationPane || undefined}
        data-position-editor-validation={fixture?.nameError ? "invalid" : undefined}
        className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", creationCanvas && "bg-white")}
      >
      {creationCanvas && (
        <div
          data-position-create-header
          className="flex min-h-[52px] w-full shrink-0 items-center gap-3 border-b border-[#efede9] px-5 py-2.5 sm:px-6"
        >
          <h2 className="min-w-0 flex-1 truncate text-[14px] font-semibold text-[#292524]">
            Новая позиция
          </h2>
          <Tooltip label="Закрыть" side="bottom" delayDuration={250}>
            <button
              type="button"
              onClick={onBackCreate}
              aria-label="Закрыть"
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              <X size={17} />
            </button>
          </Tooltip>
        </div>
      )}
      <div
        ref={editorScrollRef}
        className={cn(
          "min-h-0 min-w-0 flex-1 overflow-y-auto scrollbar-none",
          creationCanvas ? "bg-white" : detailPane ? "bg-white" : "p-4 pt-0",
        )}
      >
        <div className={cn(
          creationCanvas
            ? "mx-auto w-full max-w-[620px] px-5 pb-8 pt-4 sm:px-0"
            : detailPane
              ? "w-full px-4 pb-6"
              : "ml-9 w-[454px] pb-6 max-[511px]:ml-4 max-[511px]:w-[calc(100%-32px)]",
        )}>
          {detailPane ? (
            <div
              data-position-editor-header
              data-position-create-pane-header={creationPane || undefined}
              className="group/side-peek-header relative sticky top-0 z-30 -mx-4 flex h-14 min-w-0 items-center justify-between gap-3 border-b border-[#f5f5f4] bg-white px-4"
            >
              <div data-position-title-region className="flex min-w-0 flex-1 items-center gap-2">
                {titleEditing ? (
                  <div className="flex min-w-0 flex-1 items-center rounded-[8px] bg-white px-2 ring-1 ring-[#c7c2bd]">
                    <input
                      ref={titleInputRef}
                      value={titleDraft}
                      aria-label="Название позиции"
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitTitle();
                        if (event.key === "Escape") {
                          setTitleEditing(false);
                          setTitleDraft(item.title);
                        }
                      }}
                      onBlur={commitTitle}
                      className="min-w-0 flex-1 bg-transparent text-[14px] font-semibold leading-7 text-[#292524] outline-none"
                    />
                  </div>
                ) : renderPositionActionsMenu(
                  <button
                    type="button"
                    disabled={!sidePeekActionsEnabled}
                    aria-label={sidePeekActionsEnabled
                      ? `Действия с позицией «${item.title || "Новая позиция"}»`
                      : "Действия станут доступны после создания позиции"}
                    data-position-title-actions-trigger
                    className="flex min-w-0 flex-1 items-center gap-1 rounded-[7px] px-1.5 py-1 text-left text-[#292524] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:cursor-default disabled:hover:bg-transparent"
                  >
                    <span className="min-w-0 truncate text-[14px] font-semibold leading-5" title={item.title || "Новая позиция"}>
                      {item.title || "Новая позиция"}
                    </span>
                    <CaretDown size={13} weight="bold" className="shrink-0 text-[#79716b]" aria-hidden="true" />
                  </button>,
                )}
                {positionHeaderStatus}
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <div className={cn(
                  "transition-opacity duration-150",
                  headerMeta && "group-hover/side-peek-header:pointer-events-none group-hover/side-peek-header:opacity-0 group-focus-within/side-peek-header:pointer-events-none group-focus-within/side-peek-header:opacity-0",
                )}>
                  <PositionSaveStatus status={autosaveStatus} onRetry={onRetrySave} />
                </div>
                {detailPaneControls}
              </div>
              {positionNavigation}
            </div>
          ) : creationCanvas ? (
            creationDestination ? <div className="pb-3">{creationDestination}</div> : null
          ) : mode === "create" ? (
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
                  onClick={requestCreatePosition}
                  disabled={createDisabled || createSubmitting}
                  aria-busy={createSubmitting}
                  className="gap-1.5 bg-indigo-600 px-2.5 font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 focus-visible:ring-indigo-600/25"
                >
                  {createSubmitting && <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/45 border-t-white" />}
                  {createSubmitting ? "Создание…" : "Создать"}
                </Button>
              </div>
            </div>
          ) : (
            <div
              data-position-editor-header
              className="group/editor-header relative grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-center gap-3 pb-1 pt-3"
            >
              <div data-position-title-region className="flex min-w-0 flex-1 items-center gap-2 text-[14px] font-medium leading-7 text-[#292524]">
                {titleEditing ? (
                  <div className="flex min-w-0 flex-1 items-center rounded-lg bg-white px-2 ring-1 ring-[#c7c2bd]">
                    <input
                      ref={titleInputRef}
                      value={titleDraft}
                      aria-label="Название позиции"
                      onChange={(event) => setTitleDraft(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") commitTitle();
                        if (event.key === "Escape") {
                          setTitleEditing(false);
                          setTitleDraft(item.title);
                        }
                      }}
                      onBlur={commitTitle}
                      className="min-w-0 flex-1 bg-transparent text-[14px] font-medium leading-7 text-[#292524] outline-none"
                    />
                  </div>
                ) : (
                  <div className="min-w-0 flex-1 px-1">
                    <h2 className="truncate text-[14px] font-semibold leading-[18px] text-[#292524]" title={item.title || "Новая позиция"}>
                      {item.title || "Новая позиция"}
                    </h2>
                    <div className="mt-0.5 truncate text-[11px] font-normal leading-4 text-[#8a8179]" title={item.sectionName}>
                      {item.sectionName}
                    </div>
                  </div>
                )}
                {positionHeaderStatus}
              </div>
              {positionActions}
              {positionNavigation}
            </div>
          )}

          <PositionEditorBody
            activeTab={activeTab}
            onTabChange={selectEditorTab}
            basicContent={(
              <BasicTab
                item={item}
                media={media}
                basePriceText={basePriceText}
                basePrice={basePrice}
                weightUnit={weightUnit}
                discountOpen={discountOpen}
                discountAutofocusKey={discountAutofocusKey}
                kbjuOpen={kbjuOpen}
                kbjuAutofocusKey={kbjuAutofocusKey}
                onDiscountChange={(priceWithSale) => onDraftChange?.({ hasDiscount: true, priceWithSale })}
                onWeightUnitChange={(unit) => {
                  setWeightUnit(unit);
                  onDraftChange?.({ weightLabel: item.weightLabel ? item.weightLabel.replace(/[A-Za-zА-Яа-я]+$/, unit) : null });
                }}
                onBasePriceChange={updateBasePrice}
                onBasePriceBlur={formatBasePrice}
                onAddDiscount={addDiscount}
                onRemoveDiscount={removeDiscount}
                onAddKbju={() => {
                  setKbjuOpen(true);
                  setKbjuAutofocusKey((value) => value + 1);
                  onDraftChange?.({});
                }}
                onNutritionChange={(nutrition) => {
                  onDraftChange?.({ nutrition, nutritionFilledCount: Object.values(nutrition).filter((value) => value.trim() !== "").length });
                }}
                onRemoveKbju={() => {
                  setKbjuOpen(false);
                  setKbjuAutofocusKey(0);
                  onDraftChange?.({ nutrition: undefined, nutritionFilledCount: 0 });
                }}
                onAddPhotoFile={addPhotoFile}
                onAddVideoFile={addVideoFile}
                onReorderMedia={reorderMedia}
                onRemoveMedia={removeMedia}
                onDescriptionChange={(value) => {
                  onDescriptionChange?.(item, value);
                  onDraftChange?.({ description: value, hasDescription: descriptionHasContent(value) });
                }}
                autoFocusName={mode !== "edit"}
                hideName={false}
                nameError={fixture?.nameError ?? (mode !== "edit" ? createNameError : undefined)}
                namePlaceholder={mode !== "edit" ? "Название позиции" : "Введите перевод…"}
                nameResetKey={mode === "edit" ? item.id : "active-create-session"}
                onNameChange={(value) => {
                  if (value.trim()) setCreateNameError("");
                  onDraftChange?.({ title: value });
                  if (mode === "create" && value.trim()) onCommitDraftName?.(value);
                }}
                onWeightChange={(value, unit) => {
                  const parsed = parseMoneyInput(value);
                  onDraftChange?.({ weightLabel: parsed == null ? null : `${formatPlainNumber(parsed)} ${unit}` });
                }}
                onTitleChange={(value) => onItemChange?.(item, { title: value })}
                onTitleTranslationsChange={(titleTranslations) => onItemChange?.(item, {
                  title: titleTranslations.ru ?? item.title,
                  titleTranslations,
                })}
              />
            )}
            promoContent={(
              <div className="space-y-3">
                <PromoRecommendationsCard
                  item={item}
                  allItems={allItems}
                  upsell={upsell}
                  onChange={onUpsellChange}
                  initialSelectorOpen={fixture?.promo?.recommendationPickerOpen}
                  showRecommendationRemoveAction={fixture?.promo?.showRecommendationRemoveAction}
                />
                <PromoTab
                  item={item}
                  allItems={allItems}
                  onItemChange={(target, nextPatch) => onItemChange?.(target, nextPatch)}
                  initialLabelCreatingType={fixture?.promo?.creatingLabelType}
                  initialLabelEditingType={fixture?.promo?.editingLabelType}
                />
              </div>
            )}
            optionsContent={(
              <OptionsTab
                item={item}
                onSavedGroupsChange={(count) => {
                  if (mode !== "edit") onDraftChange?.({ optionsCount: count });
                  else onItemChange?.(item, { optionsCount: count });
                }}
                onGroupsChange={(optionGroups) => {
                  if (mode !== "edit") onDraftChange?.({ optionGroups });
                  else onItemChange?.(item, { optionGroups });
                }}
              />
            )}
            displayContent={<DisplayTab item={item} editMode={mode === "edit"} onChange={(displayMode) => onItemChange?.(item, { displayMode })} />}
            availabilityContent={(
              <PositionAvailabilityTab
                item={item}
                editMode={mode === "edit"}
                onRestoreItem={onRestoreItem}
                unavailableDisplayMode={unavailableDisplayMode}
                outsideScheduleMode={outsideScheduleMode}
                weeklySchedule={weeklySchedule}
                onModeChange={(availabilityMode) => onSetAvailabilityMode(item, availabilityMode)}
                onUnavailableDisplayModeChange={onUnavailableDisplayModeChange}
                onOutsideScheduleModeChange={onOutsideScheduleModeChange}
                onWeeklyScheduleChange={onWeeklyScheduleChange}
              />
            )}
          />
        </div>
      </div>
      {creationCanvas && (
        <div
          data-position-create-footer
          className="flex w-full shrink-0 justify-end gap-2 border-t border-[#e7e5e4] bg-white px-5 py-3 sm:px-6"
        >
          {creationFooter ?? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onCancelCreate ?? onBackCreate}
                disabled={createSubmitting}
                className="h-8 rounded-lg border-[#e7e5e4] bg-white px-3 text-[12px] font-medium text-[#79716b] hover:bg-[#f5f5f4] hover:text-[#292524]"
              >
                Отмена
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={requestCreatePosition}
                disabled={createDisabled || createSubmitting}
                aria-busy={createSubmitting}
                className="h-8 rounded-lg bg-[#4f39f6] px-3 text-[12px] font-medium text-white hover:bg-[#4030d4]"
              >
                {createSubmitting ? "Добавление…" : "Добавить позицию"}
              </Button>
            </>
          )}
        </div>
      )}
      </div>
    </>
  );
}
