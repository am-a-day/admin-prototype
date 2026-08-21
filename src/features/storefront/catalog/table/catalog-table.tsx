import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import type { ColumnDef, ColumnSizingState, Header, Row as TableRow, Table as TanStackTable, VisibilityState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { arrayMove, sortableKeyboardCoordinates, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowElbowUpRight,
  Archive,
  Asterisk,
  CaretDown,
  CaretUpDown,
  CaretRight,
  CaretUp,
  Check,
  Clock,
  Dot,
  DotsSixVertical,
  DotsThree,
  Eye,
  EyeSlash,
  FlagPennant,
  FunnelSimple,
  Layout,
  Lock,
  MagnifyingGlass,
  Minus,
  SquareSplitHorizontalIcon,
  SealPercent,
  Trash,
  X,
  XCircle,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/tooltip";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { formatPrice, catalogSections, type CatalogItem } from "@/data/catalog";
import { cn } from "@/lib/utils";
import type { CatalogPriceSortDirection } from "../navigation/types";
import { countItemsByFilter, getSectionScopeIds } from "../model/selectors";
import {
  CATALOG_TABLE_FILTER_GROUPS,
  CATALOG_TABLE_FILTER_LABELS,
  getCatalogTableFilterGroup,
  HYBRID_PRIMARY_FILTER_LABELS,
} from "../model/filter-config";
import type { OverviewFilterId } from "../model/types";
import { CATALOG_TABLE_ROW_THUMBNAIL_CLASS, CatalogThumbnail } from "../ui/catalog-thumbnail";
import { CatalogTableFilterTrigger, CatalogTableToolbarShell } from "../ui/catalog-table-controls";
import {
  CATALOG_TABLE_ACTIONS_COLUMN_WIDTH,
  CATALOG_TABLE_HEADER_STICKY_CLASS,
  CATALOG_TABLE_HEADER_SURFACE_CLASS,
  CATALOG_TABLE_ROW_HEIGHT_CLASS,
  CATALOG_TABLE_SELECTION_COLUMN_WIDTH,
} from "../ui/catalog-layout";
import { CATALOG_DROPDOWN_CONTENT_CLASS, CATALOG_DROPDOWN_ITEM_CLASS, type CatalogDropdownOutsideDismiss, type CatalogDropdownOutsideEvent } from "../ui/catalog-dropdown";
import { CatalogPositionAvailabilityMenu, type CatalogStopDisplayMode } from "../ui/catalog-context-menu";
import { DiscountBlock, calculateDiscountPercent } from "../editor/position-editor";
import { createDefaultWeeklySchedule, isWeeklyScheduleOrderable, type WeeklySchedule } from "../ui/catalog-schedule-editor";
import type { CatalogSectionActionAnchor } from "../sidebar/section-tree";
import { StructureDragHandle } from "../workspace/dnd";
import {
  getCatalogLabelText,
  resolveCatalogItemStickerId,
  resolveCatalogItemTagIds,
  useCatalogLabels,
} from "../labels/catalog-labels";
import { getLocalCatalogItemLabels, getLocalCatalogLabelText } from "../labels/local-catalog-labels";
import { USE_SHARED_TAGS_AND_STICKERS } from "../feature-flags";
import { usePositionSidePeekOverlayLayer } from "../editor/side-peek-context";
import binocularsAsset from "../ui/binoculars.svg";

type MovePopoverAnchor = CatalogSectionActionAnchor;
type PriceSortDirection = CatalogPriceSortDirection;

function CatalogContentFilterIcon({
  size = 16,
  className,
  weight: _weight,
  "aria-hidden": ariaHidden,
}: {
  size?: number;
  className?: string;
  weight?: string;
  "aria-hidden"?: boolean | "true" | "false";
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      className={className}
      aria-hidden={ariaHidden}
    >
      <circle cx="8" cy="8" r="6" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" />
      <path
        d="M10.8284 10.8284C11.5523 10.1046 12 9.1046 12 8C12 5.79086 10.2091 4 8 4V8L10.8284 10.8284Z"
        fill="currentColor"
      />
    </svg>
  );
}

function getMovePopoverAnchor(event: Event | React.MouseEvent<HTMLElement>): MovePopoverAnchor {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
}

function getPriceSortTooltip(direction: PriceSortDirection) {
  if (direction === "none") return "Сортировать по возрастанию";
  if (direction === "asc") return "Сортировать по убыванию";
  return "Сбросить сортировку";
}

function getPrimaryRowStatusLabel(item: CatalogItem) {
  if (item.status === "archive") return "В архиве";
  if (item.status === "stopped" || item.status === "coming-soon") {
    return item.unavailableDisplayMode === "comingSoon" || item.status === "coming-soon" ? "Скоро будет" : "На стопе";
  }
  if (item.scheduled) {
    const orderable = isWeeklyScheduleOrderable(
      item.weeklySchedule ?? createDefaultWeeklySchedule(),
      item.availabilityScheduleMode ?? "available",
      new Date(),
    );
    if (orderable) return "По расписанию";
    return item.outsideScheduleMode === "comingSoon"
      ? "Скоро будет"
      : "Недоступно";
  }
  return null;
}

function getDescriptionPreview(description: string) {
  return description
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

const TABLE_COLUMN_WIDTHS = {
  selection: CATALOG_TABLE_SELECTION_COLUMN_WIDTH,
  position: 231,
  description: 280,
  weight: 119,
  kbju: 88,
  translation: 92,
  section: 160,
  price: 119,
  discount: 78,
  tags: 150,
  stickers: 140,
  upsells: 100,
  lastModified: 154,
  actions: CATALOG_TABLE_ACTIONS_COLUMN_WIDTH,
} as const;

export const DEFAULT_TABLE_COLUMN_SIZING: ColumnSizingState = {
  position: TABLE_COLUMN_WIDTHS.position,
  description: TABLE_COLUMN_WIDTHS.description,
  weight: TABLE_COLUMN_WIDTHS.weight,
  kbju: TABLE_COLUMN_WIDTHS.kbju,
  translation: TABLE_COLUMN_WIDTHS.translation,
  section: TABLE_COLUMN_WIDTHS.section,
  price: TABLE_COLUMN_WIDTHS.price,
  discount: TABLE_COLUMN_WIDTHS.discount,
  tags: TABLE_COLUMN_WIDTHS.tags,
  stickers: TABLE_COLUMN_WIDTHS.stickers,
  upsells: TABLE_COLUMN_WIDTHS.upsells,
  lastModified: TABLE_COLUMN_WIDTHS.lastModified,
};

export const TABLE_COLUMN_MIN_SIZES: ColumnSizingState = {
  position: 180,
  description: 180,
  weight: 80,
  kbju: 72,
  translation: 80,
  section: 120,
  price: 100,
  discount: 72,
  tags: 120,
  stickers: 120,
  upsells: 92,
  lastModified: 128,
};

export const TABLE_COLUMN_MAX_SIZES: ColumnSizingState = {
  position: 720,
  description: 640,
  weight: 180,
  kbju: 180,
  translation: 200,
  section: 320,
  price: 220,
  discount: 160,
  tags: 320,
  stickers: 280,
  upsells: 220,
  lastModified: 260,
};

function getColumnWidthStyle(width: number) {
  return { width, minWidth: width, maxWidth: width };
}

function getTableContentDividerClass(columnId: string, visibleContentColumnIds: string[]) {
  const index = visibleContentColumnIds.indexOf(columnId);
  if (index < 0) return undefined;
  return cn(
    index > 0 && "border-l border-[#eceae7]",
    index === visibleContentColumnIds.length - 1 && "border-r border-[#eceae7]",
  );
}

const TABLE_COLUMN_RESIZE_LABELS: Record<string, string> = {
  position: "Название",
  description: "Описание",
  weight: "Вес или объём",
  kbju: "КБЖУ",
  translation: "Перевод",
  section: "Раздел",
  price: "Базовая цена",
  discount: "Скидка",
  tags: "Теги",
  stickers: "Стикеры",
  upsells: "Рекомендации",
  lastModified: "Последнее изменение",
};
export type CatalogInformationColumnId =
  | "section"
  | "description"
  | "weight"
  | "kbju"
  | "translation"
  | "price"
  | "discount"
  | "tags"
  | "stickers"
  | "upsells"
  | "lastModified";
export const CATALOG_INFORMATION_COLUMN_IDS: CatalogInformationColumnId[] = [
  "section",
  "description",
  "weight",
  "kbju",
  "translation",
  "price",
  "discount",
  "tags",
  "stickers",
  "upsells",
  "lastModified",
];
const CATALOG_INFORMATION_COLUMN_LABELS: Record<CatalogInformationColumnId, string> = {
  section: "Раздел",
  description: "Описание",
  weight: "Вес или объём",
  kbju: "КБЖУ",
  translation: "Перевод",
  price: "Базовая цена",
  discount: "Скидка",
  tags: "Теги",
  stickers: "Стикеры",
  upsells: "Рекомендации",
  lastModified: "Последнее изменение",
};
export const MANAGEABLE_TABLE_COLUMN_IDS = [
  "position",
  ...CATALOG_INFORMATION_COLUMN_IDS.filter((id) => id !== "lastModified"),
  "lastModified",
] as const;
export const DEFAULT_TABLE_COLUMN_ORDER = [
  "reorder",
  "selection",
  ...MANAGEABLE_TABLE_COLUMN_IDS,
  "actions",
] as string[];
export const DEFAULT_TABLE_COLUMN_VISIBILITY: VisibilityState = {
  position: true,
  description: false,
  weight: true,
  kbju: false,
  translation: false,
  section: false,
  price: true,
  discount: false,
  tags: false,
  stickers: false,
  upsells: false,
  lastModified: false,
};

export const CATALOG_TABLE_COLUMN_DEFS: ColumnDef<CatalogItem>[] = [
  { id: "reorder", enableHiding: false, enableResizing: false, size: 0, minSize: 0, maxSize: 0 },
  { id: "selection", enableHiding: false, enableResizing: false, size: TABLE_COLUMN_WIDTHS.selection, minSize: TABLE_COLUMN_WIDTHS.selection, maxSize: TABLE_COLUMN_WIDTHS.selection },
  { id: "position", accessorKey: "title", enableHiding: false, size: DEFAULT_TABLE_COLUMN_SIZING.position, minSize: TABLE_COLUMN_MIN_SIZES.position, maxSize: TABLE_COLUMN_MAX_SIZES.position },
  { id: "section", accessorKey: "sectionName", size: DEFAULT_TABLE_COLUMN_SIZING.section, minSize: TABLE_COLUMN_MIN_SIZES.section, maxSize: TABLE_COLUMN_MAX_SIZES.section },
  { id: "weight", accessorKey: "weightLabel", size: DEFAULT_TABLE_COLUMN_SIZING.weight, minSize: TABLE_COLUMN_MIN_SIZES.weight, maxSize: TABLE_COLUMN_MAX_SIZES.weight },
  { id: "description", accessorKey: "hasDescription", size: DEFAULT_TABLE_COLUMN_SIZING.description, minSize: TABLE_COLUMN_MIN_SIZES.description, maxSize: TABLE_COLUMN_MAX_SIZES.description },
  { id: "kbju", accessorKey: "nutritionFilledCount", size: DEFAULT_TABLE_COLUMN_SIZING.kbju, minSize: TABLE_COLUMN_MIN_SIZES.kbju, maxSize: TABLE_COLUMN_MAX_SIZES.kbju },
  { id: "translation", accessorKey: "translationFilledCount", size: DEFAULT_TABLE_COLUMN_SIZING.translation, minSize: TABLE_COLUMN_MIN_SIZES.translation, maxSize: TABLE_COLUMN_MAX_SIZES.translation },
  { id: "price", accessorKey: "price", size: DEFAULT_TABLE_COLUMN_SIZING.price, minSize: TABLE_COLUMN_MIN_SIZES.price, maxSize: TABLE_COLUMN_MAX_SIZES.price },
  { id: "discount", accessorFn: (item) => item.hasDiscount && item.priceWithSale != null ? Math.round((1 - item.priceWithSale / Math.max(item.price, 1)) * 100) : null, size: DEFAULT_TABLE_COLUMN_SIZING.discount, minSize: TABLE_COLUMN_MIN_SIZES.discount, maxSize: TABLE_COLUMN_MAX_SIZES.discount },
  { id: "tags", accessorKey: "tags", size: DEFAULT_TABLE_COLUMN_SIZING.tags, minSize: TABLE_COLUMN_MIN_SIZES.tags, maxSize: TABLE_COLUMN_MAX_SIZES.tags },
  { id: "stickers", accessorKey: "guestLabels", size: DEFAULT_TABLE_COLUMN_SIZING.stickers, minSize: TABLE_COLUMN_MIN_SIZES.stickers, maxSize: TABLE_COLUMN_MAX_SIZES.stickers },
  { id: "upsells", accessorKey: "recommendationsCount", size: DEFAULT_TABLE_COLUMN_SIZING.upsells, minSize: TABLE_COLUMN_MIN_SIZES.upsells, maxSize: TABLE_COLUMN_MAX_SIZES.upsells },
  { id: "lastModified", accessorKey: "lastModifiedAt", size: DEFAULT_TABLE_COLUMN_SIZING.lastModified, minSize: TABLE_COLUMN_MIN_SIZES.lastModified, maxSize: TABLE_COLUMN_MAX_SIZES.lastModified },
  { id: "actions", enableHiding: false, enableResizing: false, size: TABLE_COLUMN_WIDTHS.actions, minSize: TABLE_COLUMN_WIDTHS.actions, maxSize: TABLE_COLUMN_WIDTHS.actions },
];

export type CatalogLastModifiedSortDirection = "none" | "asc" | "desc";

const DEFAULT_CATALOG_LAST_MODIFIED_AT = "2026-07-06T13:03:04.781Z";
const LAST_MODIFIED_FORMATTER = new Intl.DateTimeFormat("ru-RU", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function getCatalogItemLastModifiedTimestamp(item: CatalogItem) {
  const timestamp = Date.parse(item.lastModifiedAt ?? DEFAULT_CATALOG_LAST_MODIFIED_AT);
  return Number.isFinite(timestamp) ? timestamp : Date.parse(DEFAULT_CATALOG_LAST_MODIFIED_AT);
}

export function formatCatalogItemLastModified(item: CatalogItem) {
  return LAST_MODIFIED_FORMATTER.format(new Date(getCatalogItemLastModifiedTimestamp(item)));
}

export function sortCatalogItemsByLastModified(items: CatalogItem[], direction: CatalogLastModifiedSortDirection) {
  if (direction === "none") return items;
  return [...items].sort((left, right) => {
    const difference = getCatalogItemLastModifiedTimestamp(left) - getCatalogItemLastModifiedTimestamp(right);
    return direction === "asc" ? difference : -difference;
  });
}

function getLastModifiedSortTooltip(direction: CatalogLastModifiedSortDirection) {
  if (direction === "none") return "Сортировать по возрастанию даты изменения";
  if (direction === "asc") return "Сортировать по убыванию даты изменения";
  return "Сбросить сортировку по дате изменения";
}

function getSortIcon(direction: "none" | "asc" | "desc") {
  if (direction === "asc") return <CaretUp size={11} weight="bold" />;
  if (direction === "desc") return <CaretDown size={11} weight="bold" />;
  return (
    <span className="flex flex-col items-center justify-center leading-none text-[#a8a29e]">
      <CaretUp size={8} weight="bold" />
      <CaretDown size={8} weight="bold" className="-mt-1" />
    </span>
  );
}

function getCatalogColumnLabel(columnId: string) {
  if (columnId === "position") return "Название";
  return CATALOG_INFORMATION_COLUMN_LABELS[columnId as CatalogInformationColumnId] ?? columnId;
}

export function DropdownContent({
  children,
  align = "end",
  className,
  preventOutsideDismiss = false,
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  preventOutsideDismiss?: CatalogDropdownOutsideDismiss;
}) {
  const { marker, shouldPreventOverlayDismissal } = usePositionSidePeekOverlayLayer();
  const shouldPreventOutsideDismiss = (event: CatalogDropdownOutsideEvent) => (
    (typeof preventOutsideDismiss === "function" ? preventOutsideDismiss(event) : preventOutsideDismiss)
    || shouldPreventOverlayDismissal(event)
  );
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn("z-[100002] min-w-[208px]", CATALOG_DROPDOWN_CONTENT_CLASS, className)}
        onPointerDownOutside={(event) => {
          if (shouldPreventOutsideDismiss(event)) event.preventDefault();
        }}
        onInteractOutside={(event) => {
          if (shouldPreventOutsideDismiss(event)) event.preventDefault();
        }}
      >
        {marker}
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function DropdownActionItem({
  children,
  onSelect,
  tone = "default",
  disabled = false,
  icon: Icon,
}: {
  children: ReactNode;
  onSelect: (event: Event) => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  icon?: PhosphorIcon;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        CATALOG_DROPDOWN_ITEM_CLASS,
        tone === "danger" ? "text-[#9f1239]" : "text-[#44403b]",
      )}
    >
      {Icon && <Icon size={16} weight="regular" className="shrink-0" />}
      {children}
    </DropdownMenu.Item>
  );
}

function ToolbarDropdown({
  label,
  children,
  preventOutsideDismiss = false,
  onOpenChange,
}: {
  label: string;
  children: ReactNode;
  preventOutsideDismiss?: CatalogDropdownOutsideDismiss;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <DropdownMenu.Root onOpenChange={onOpenChange}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] border border-[#e7e5e4] bg-white px-2 text-[12px] font-normal leading-4 text-[#292524] transition hover:border-[#d6d3d1] hover:bg-[#fafaf9] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20"
        >
          <span>{label}</span>
          <CaretUpDown size={13} weight="regular" className="text-[#79716b]" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent align="start" preventOutsideDismiss={preventOutsideDismiss}>{children}</DropdownContent>
    </DropdownMenu.Root>
  );
}

function SortableColumnSetting({
  id,
  visible,
  canHide,
  onToggle,
}: {
  id: string;
  visible: boolean;
  canHide: boolean;
  onToggle: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const label = getCatalogColumnLabel(id);

  return (
    <div
      ref={setNodeRef}
      data-catalog-column-setting={id}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "flex h-8 items-center gap-1 rounded-[8px] px-1 text-[13px] text-[#44403b]",
        isDragging ? "relative z-10 bg-[#f5f5f4] shadow-[0_5px_14px_rgba(41,37,36,0.12)]" : "",
      )}
    >
      <button
        type="button"
        aria-label={`Изменить порядок колонки «${label}»`}
        className="flex h-7 w-6 shrink-0 cursor-grab items-center justify-center rounded-[6px] text-[#a8a29e] outline-none hover:bg-[#f5f5f4] hover:text-[#79716b] focus-visible:ring-2 focus-visible:ring-[#292524]/10 active:cursor-grabbing"
        {...attributes}
        {...listeners}
      >
        <DotsSixVertical size={16} weight="regular" />
      </button>
      <span className="min-w-0 flex-1 truncate">{label}</span>
      <button
        type="button"
        disabled={!canHide}
        aria-label={canHide ? `${visible ? "Скрыть" : "Показать"} колонку «${label}»` : `Колонка «${label}» обязательна`}
        aria-pressed={visible}
        onClick={onToggle}
        className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[6px] text-[#79716b] outline-none transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:cursor-not-allowed disabled:text-[#c7c2bd]"
      >
        {canHide ? (visible ? <Eye size={16} weight="regular" /> : <EyeSlash size={16} weight="regular" />) : <Lock size={14} weight="regular" />}
      </button>
    </div>
  );
}

export function CatalogColumnSettingsMenu({
  table,
  onResetColumns,
}: {
  table: TanStackTable<CatalogItem>;
  onResetColumns: () => void;
}) {
  const [search, setSearch] = useState("");
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const manageableColumns = table.getAllLeafColumns().filter((column) =>
    (MANAGEABLE_TABLE_COLUMN_IDS as readonly string[]).includes(column.id),
  );
  const normalizedSearch = search.trim().toLocaleLowerCase("ru");
  const filteredColumns = normalizedSearch
    ? manageableColumns.filter((column) => getCatalogColumnLabel(column.id).toLocaleLowerCase("ru").includes(normalizedSearch))
    : manageableColumns;

  const handleDragEnd = ({ active, over }: DragEndEvent) => {
    if (!over || active.id === over.id) return;
    const managedOrder = table.getAllLeafColumns()
      .map((column) => column.id)
      .filter((id) => (MANAGEABLE_TABLE_COLUMN_IDS as readonly string[]).includes(id));
    const activeIndex = managedOrder.indexOf(String(active.id));
    const overIndex = managedOrder.indexOf(String(over.id));
    if (activeIndex < 0 || overIndex < 0) return;
    const nextOrder = arrayMove(managedOrder, activeIndex, overIndex);
    table.setColumnOrder(["reorder", "selection", ...nextOrder, "actions"]);
  };

  return (
    <DropdownMenu.Root onOpenChange={(open) => { if (!open) setSearch(""); }}>
      <Tooltip label="Настроить колонки" side="top">
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Настроить колонки"
            data-catalog-column-settings-trigger
            className="inline-flex h-7 w-[18px] shrink-0 items-center justify-center rounded-[7px] text-[#a8a29e] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <SquareSplitHorizontalIcon size={18} weight="regular" />
          </button>
        </DropdownMenu.Trigger>
      </Tooltip>
      <DropdownContent align="end">
        <div data-catalog-column-settings className="w-[296px] max-w-[calc(100vw-24px)]">
          <div className="px-1 pb-2 pt-0.5">
            <label className="flex h-8 items-center gap-1.5 rounded-[7px] bg-[#f7f6f2] px-2 text-[#a8a29e] focus-within:ring-2 focus-within:ring-[#292524]/10">
              <MagnifyingGlass size={14} className="shrink-0" />
              <Input
                size="compact"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key !== "Escape") event.stopPropagation();
                }}
                placeholder="Поиск по колонкам"
                aria-label="Поиск по колонкам"
                className="h-7 min-w-0 flex-1 border-0 bg-transparent px-0 text-[13px] focus:border-0"
              />
            </label>
          </div>
          <div className="max-h-[360px] overflow-y-auto pr-0.5 [scrollbar-width:thin]">
            <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
              <SortableContext items={filteredColumns.map((column) => column.id)} strategy={verticalListSortingStrategy}>
                {filteredColumns.map((column) => (
                  <SortableColumnSetting
                    key={column.id}
                    id={column.id}
                    visible={column.getIsVisible()}
                    canHide={column.getCanHide()}
                    onToggle={() => column.toggleVisibility(!column.getIsVisible())}
                  />
                ))}
              </SortableContext>
            </DndContext>
            {filteredColumns.length === 0 && <p className="px-2 py-3 text-[12px] text-[#a6a09b]">Колонки не найдены</p>}
          </div>
          <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
          <DropdownMenu.Item
            onSelect={onResetColumns}
            className="flex h-8 cursor-pointer select-none items-center rounded-[8px] px-2 text-[13px] font-medium text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]"
          >
            Сбросить колонки
          </DropdownMenu.Item>
        </div>
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

export function TableCheckbox({
  ariaLabel,
  checked = false,
  indeterminate = false,
  onChange,
  quiet = false,
  forceVisible = false,
  hideQuietUntilInteractive = false,
}: {
  ariaLabel: string;
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  quiet?: boolean;
  forceVisible?: boolean;
  hideQuietUntilInteractive?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
      <input
        ref={ref}
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange?.(event.target.checked)}
        aria-label={ariaLabel}
        className={cn(
          "absolute inset-0 h-4 w-4 cursor-pointer appearance-none rounded-[4.8px] border-[0.8px] border-[#a8a29e] bg-white transition duration-150 ease-out checked:border-[#4f39f6] checked:bg-[#4f39f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20",
          indeterminate && "border-[#4f39f6] bg-[#4f39f6]",
          quiet && !checked && !indeterminate && !forceVisible && !hideQuietUntilInteractive && "opacity-80 group-hover:opacity-100 group-focus-within:opacity-100",
          quiet && !checked && !indeterminate && !forceVisible && hideQuietUntilInteractive && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100",
          (!quiet || checked || indeterminate || forceVisible) && "opacity-100",
        )}
      />
      {(checked || indeterminate) && (
        <span className="pointer-events-none relative z-[1] flex items-center justify-center text-white" aria-hidden="true">
          {indeterminate ? <Minus size={13} weight="bold" /> : <Check size={13} weight="bold" />}
        </span>
      )}
    </span>
  );
}

function ColumnResizeHandle({ header }: { header?: Header<CatalogItem, unknown> }) {
  if (!header || !header.column.getCanResize()) return null;
  const label = TABLE_COLUMN_RESIZE_LABELS[header.column.id] ?? header.column.id;

  return (
    <button
      type="button"
      data-catalog-column-resize-handle={header.column.id}
      aria-label={`Изменить ширину колонки «${label}»`}
      onMouseDown={header.getResizeHandler()}
      onTouchStart={header.getResizeHandler()}
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "absolute right-[-4px] top-0 z-30 h-full w-2 cursor-col-resize touch-none border-0 bg-transparent p-0 outline-none",
        "after:absolute after:right-[3px] after:top-0 after:h-full after:w-px after:bg-[#a8a29e] after:opacity-0 after:transition-opacity",
        "hover:after:opacity-100 focus-visible:after:opacity-100",
        header.column.getIsResizing() && "after:opacity-100",
      )}
    />
  );
}

function AuditDot({ state, title }: { state: "filled" | "partial" | "missing"; title: string }) {
  return (
    <span className="flex items-center justify-center" title={title}>
      {state === "filled" && <Dot size={22} weight="fill" className="text-[#006045]" />}
      {state === "partial" && <span className="h-[9px] w-[9px] rounded-full border-[1.5px] border-[#006045]" />}
      {state === "missing" && <span className="text-[13px] leading-none text-[#a6a09b]">—</span>}
    </span>
  );
}

export function TableHeaderRow({
  checked,
  indeterminate,
  onSelectAll,
  priceSort,
  onPriceSortChange,
  lastModifiedSort,
  onLastModifiedSortChange,
  table,
  offsetForLocalHeader = false,
  horizontalScrollLeft = 0,
}: {
  checked: boolean;
  indeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
  priceSort: PriceSortDirection;
  onPriceSortChange: () => void;
  lastModifiedSort: CatalogLastModifiedSortDirection;
  onLastModifiedSortChange: () => void;
  table: TanStackTable<CatalogItem>;
  offsetForLocalHeader?: boolean;
  horizontalScrollLeft?: number;
}) {
  const priceSortTooltip = getPriceSortTooltip(priceSort);
  const visibleColumns = table.getVisibleLeafColumns().filter((column) => column.id !== "reorder");
  const tableWidth = visibleColumns.reduce((total, column) => total + column.getSize(), 0);
  const visibleContentColumnIds = visibleColumns
    .filter((column) => column.id !== "selection" && column.id !== "actions")
    .map((column) => column.id);
  const actionColumn = visibleColumns.find((column) => column.id === "actions");

  return (
    <div
      className={cn(CATALOG_TABLE_HEADER_STICKY_CLASS, offsetForLocalHeader && "top-[76px]")}
      data-catalog-table-header
    >
      <div className={CATALOG_TABLE_HEADER_SURFACE_CLASS}>
        <div
          className="flex h-full w-full shrink-0 items-center"
          style={{ minWidth: tableWidth, transform: `translateX(-${horizontalScrollLeft}px)` }}
        >
        {visibleColumns.filter((column) => column.id !== "actions").map((column) => {
          if (!column.getIsVisible()) return null;
          const header = table.getFlatHeaders().find((candidate) => candidate.column.id === column.id);
          const dividerClass = getTableContentDividerClass(column.id, visibleContentColumnIds);
          if (column.id === "selection") {
            return (
              <span key={column.id} style={getColumnWidthStyle(column.getSize())} className="flex h-full shrink-0 items-center justify-center">
                <TableCheckbox
                  ariaLabel="Выбрать все видимые позиции"
                  checked={checked}
                  indeterminate={indeterminate}
                  onChange={onSelectAll}
                />
              </span>
            );
          }
          if (column.id === "position") {
            return (
              <span key={column.id} data-catalog-table-content-cell={column.id} style={getColumnWidthStyle(column.getSize())} className={cn("relative flex h-full shrink-0 items-center truncate pl-[6px] pr-[3px] text-[13px] font-medium leading-5 text-[#939393]", dividerClass)}>
                Название
                <ColumnResizeHandle header={header} />
              </span>
            );
          }
          if (column.id === "description") {
            return (
              <span key={column.id} data-catalog-table-content-cell={column.id} style={getColumnWidthStyle(column.getSize())} className={cn("relative flex h-full shrink-0 items-center px-3 text-[12px] font-medium leading-5 text-[#a6a09b]", dividerClass)}>
                {CATALOG_INFORMATION_COLUMN_LABELS.description}
                <ColumnResizeHandle header={header} />
              </span>
            );
          }
          if (column.id === "discount") {
            return (
              <span key={column.id} data-catalog-table-content-cell={column.id} style={getColumnWidthStyle(column.getSize())} className={cn("relative flex h-full shrink-0 items-center justify-end px-2 text-[12px] font-medium leading-5 text-[#a6a09b]", dividerClass)}>
                {CATALOG_INFORMATION_COLUMN_LABELS.discount}
                <ColumnResizeHandle header={header} />
              </span>
            );
          }
          if (column.id === "price") {
            return (
              <span key={column.id} data-catalog-table-content-cell={column.id} style={getColumnWidthStyle(column.getSize())} className={cn("relative flex h-full shrink-0", dividerClass)}>
                <Tooltip label={priceSortTooltip} side="top">
                  <button
                    type="button"
                    onClick={onPriceSortChange}
                    aria-label={priceSortTooltip}
                    className={cn(
                      "flex h-full w-full items-center justify-start pl-[6px] pr-[3px] text-[13px] font-medium leading-5 transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                      priceSort === "none" ? "text-[#939393]" : "text-[#57534d]",
                    )}
                  >
                    <span>Базовая цена</span>
                    <span className="ml-1 flex h-4 w-3 shrink-0 items-center justify-center" aria-hidden="true">
                      {getSortIcon(priceSort)}
                    </span>
                  </button>
                </Tooltip>
                <ColumnResizeHandle header={header} />
              </span>
            );
          }
          if (column.id === "lastModified") {
            const lastModifiedSortTooltip = getLastModifiedSortTooltip(lastModifiedSort);
            return (
              <span key={column.id} data-catalog-table-content-cell={column.id} style={getColumnWidthStyle(column.getSize())} className={cn("relative flex h-full shrink-0", dividerClass)}>
                <Tooltip label={lastModifiedSortTooltip} side="top">
                  <button
                    type="button"
                    onClick={onLastModifiedSortChange}
                    aria-label={lastModifiedSortTooltip}
                    className={cn(
                      "flex h-full w-full items-center justify-end gap-1 px-2 text-right text-[13px] font-medium leading-5 transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                      lastModifiedSort === "none" ? "text-[#a6a09b]" : "text-[#57534d]",
                    )}
                  >
                    <span className="truncate">Последнее изменение</span>
                    <span className="flex h-4 w-3 shrink-0 items-center justify-center" aria-hidden="true">
                      {getSortIcon(lastModifiedSort)}
                    </span>
                  </button>
                </Tooltip>
                <ColumnResizeHandle header={header} />
              </span>
            );
          }
          return (
            <span key={column.id} data-catalog-table-content-cell={column.id} style={getColumnWidthStyle(column.getSize())} className={cn("relative flex h-full shrink-0 items-center justify-start pl-[6px] pr-[3px] text-[13px] font-medium leading-5 text-[#939393]", dividerClass)}>
              {column.id === "weight" ? "Вес" : CATALOG_INFORMATION_COLUMN_LABELS[column.id as CatalogInformationColumnId]}
              <ColumnResizeHandle header={header} />
            </span>
          );
        })}
        <span data-catalog-table-filler aria-hidden="true" className="h-full min-w-0 flex-1" />
        {actionColumn && (
          <span
            data-catalog-table-actions
            aria-hidden="true"
            style={getColumnWidthStyle(actionColumn.getSize())}
            className="sticky right-0 z-[1] flex h-full shrink-0 items-center justify-center bg-[#fafaf9]"
          />
        )}
        </div>
      </div>
    </div>
  );
}

export function CatalogTableToolbar({
  query,
  onQueryChange,
  activeFilterId,
  mandatoryFilterId,
  sectionScopeId,
  items,
  table,
  onResetColumns,
  tagCategoryActive = false,
  stickerCategoryActive = false,
  onTagCategoryChange,
  onStickerCategoryChange,
  onActiveFilterChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  activeFilterId: OverviewFilterId | null;
  mandatoryFilterId?: OverviewFilterId;
  sectionScopeId: string | null;
  items: CatalogItem[];
  table: TanStackTable<CatalogItem>;
  onResetColumns: () => void;
  tagCategoryActive?: boolean;
  stickerCategoryActive?: boolean;
  onTagCategoryChange?: (active: boolean) => void;
  onStickerCategoryChange?: (active: boolean) => void;
  onActiveFilterChange: (id: OverviewFilterId, active: boolean) => void;
}) {
  return (
    <CatalogTableToolbarShell
      value={query}
      onValueChange={onQueryChange}
      ariaLabel="Найти позицию"
      filter={(
        <CatalogTableFilterBar
          activeFilterId={activeFilterId}
          mandatoryFilterId={mandatoryFilterId}
          sectionScopeId={sectionScopeId}
          items={items}
          table={table}
          onResetColumns={onResetColumns}
          onActiveFilterChange={onActiveFilterChange}
          headerActionsOnly
          tagCategoryActive={tagCategoryActive}
          stickerCategoryActive={stickerCategoryActive}
          onTagCategoryChange={onTagCategoryChange}
          onStickerCategoryChange={onStickerCategoryChange}
        />
      )}
      endContent={<CatalogColumnSettingsMenu table={table} onResetColumns={onResetColumns} />}
    />
  );
}

export function CatalogFilteredEmptyState({ onReset }: { onReset: () => void }) {
  return (
    <div
      data-catalog-filtered-empty-state
      className="relative min-h-[470px] border-b border-[#e7e5e4]"
    >
      <div className="absolute left-1/2 top-[162px] flex w-full max-w-[757px] -translate-x-1/2 flex-col items-center justify-center gap-[13px] rounded-[10px] px-[24px] py-[8px]">
        <div className="flex w-full flex-col items-center justify-center gap-[8px]">
          <img
            src={binocularsAsset}
            alt=""
            width={45}
            height={45}
            data-catalog-filtered-empty-icon
            className="block size-[45px]"
          />
          <p className="text-center text-[16px] font-medium leading-[1.4] text-[#1c1917]">
            Ничего не найдено
          </p>
          <p className="w-[224.27px] text-center text-[14px] font-normal leading-[1.4] text-[#79716b]">
            Попробуйте изменить запрос или настройки фильтров
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onReset}
          className="h-[32px] rounded-[10px] border-[#e7e5e4] bg-white px-[10px] py-[10px] text-[14px] font-medium leading-normal text-[#292524] hover:bg-[#fafaf9]"
        >
          Сбросить всё
        </Button>
      </div>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  const isStop = label === "На стопе";
  const isBlue = label === "С расписанием" || label === "По расписанию" || label === "Скоро будет";
  const isUnavailable = label === "Недоступно";
  const isSlate = label === "В архиве" || label === "Скрыта";

  return (
    <span
      className={cn(
        "flex h-4 items-center justify-center gap-0.5 rounded-[4px]",
        isStop && "bg-[#ffedd4] pl-[3px] pr-1.5",
        isBlue && "bg-[#dbeafe] pl-[3px] pr-1.5",
        isUnavailable && "bg-[#fef3c7] pl-[3px] pr-1.5",
        isSlate && "bg-[#f1f5f9] px-1.5",
        !isStop && !isBlue && !isUnavailable && !isSlate && "bg-[#f5f5f4] px-1.5",
      )}
    >
      {isStop && <Lock size={12} weight="fill" className="shrink-0 text-[#f54900]" />}
      {isBlue && <Clock size={12} weight="fill" className="shrink-0 text-[#2b7fff]" />}
      {isUnavailable && <Clock size={12} weight="fill" className="shrink-0 text-[#a16207]" />}
      <span
        className={cn(
          "whitespace-nowrap text-[11px] font-semibold leading-5",
          isStop ? "text-[#ca3500]" : isBlue ? "text-[#2b7fff]" : isUnavailable ? "text-[#a16207]" : isSlate ? "text-[#62748e]" : "text-[#57534d]",
        )}
      >
        {label}
      </span>
    </span>
  );
}
type AuditDishRowProps = {
  row: TableRow<CatalogItem>;
  onAction: (item: CatalogItem, action: string, anchor?: MovePopoverAnchor, schedule?: WeeklySchedule) => void;
  selected: boolean;
  selectionMode: boolean;
  onSelectedChange: (id: string, selected: boolean) => void;
  renderActions?: (item: CatalogItem, onAction: (action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => void) => ReactNode;
  compositionMode?: boolean;
  highlighted?: boolean;
  active?: boolean;
  reorderEnabled?: boolean;
};

function SharedAuditDishRow(props: AuditDishRowProps) {
  const item = props.row.original;
  const { contentLanguage } = useAppSettings();
  const { account } = useMockAuth();
  const primaryLanguage = account?.workspace.primaryLanguage ?? "ru";
  const { labels } = useCatalogLabels();
  const resolvedTags = resolveCatalogItemTagIds(item, labels)
    .map((id) => getCatalogLabelText(labels.find((label) => label.id === id), contentLanguage, primaryLanguage))
    .filter(Boolean);
  const resolvedSticker = getCatalogLabelText(
    labels.find((label) => label.id === resolveCatalogItemStickerId(item, labels)),
    contentLanguage,
    primaryLanguage,
  );
  return <AuditDishRowContent {...props} resolvedTags={resolvedTags} resolvedSticker={resolvedSticker} />;
}

function LocalAuditDishRow(props: AuditDishRowProps) {
  const item = props.row.original;
  const { contentLanguage } = useAppSettings();
  const { account } = useMockAuth();
  const primaryLanguage = account?.workspace.primaryLanguage ?? "ru";
  const labels = getLocalCatalogItemLabels(item, primaryLanguage);
  return (
    <AuditDishRowContent
      {...props}
      resolvedTags={labels.tags.map((tag) => getLocalCatalogLabelText(tag, contentLanguage, primaryLanguage))}
      resolvedSticker={getLocalCatalogLabelText(labels.sticker, contentLanguage, primaryLanguage)}
    />
  );
}

function AuditDishRow(props: AuditDishRowProps) {
  return USE_SHARED_TAGS_AND_STICKERS
    ? <SharedAuditDishRow {...props} />
    : <LocalAuditDishRow {...props} />;
}

function AuditDishRowContent({
  row,
  onAction,
  selected,
  selectionMode,
  onSelectedChange,
  renderActions,
  compositionMode,
  highlighted,
  active,
  reorderEnabled = false,
  resolvedTags,
  resolvedSticker,
}: AuditDishRowProps & { resolvedTags: string[]; resolvedSticker: string }) {
  const item = row.original;
  const itemTitle = item.title || "Новая позиция";
  const reducedMotion = usePrefersReducedMotion();
  const {
    attributes: reorderAttributes,
    listeners: reorderListeners,
    setNodeRef: setSortableNodeRef,
    setActivatorNodeRef: setReorderHandleRef,
    transform: reorderTransform,
    transition: reorderTransition,
    isDragging: isReordering,
  } = useSortable({ id: item.id, disabled: !reorderEnabled });
  // В составе раздела: обычный клик по основной зоне открывает позицию во
  // вкладке «Позиции»; в активном режиме мультивыбора — переключает выделение.
  const primaryClick = () => {
    if (compositionMode) {
      if (selectionMode) onSelectedChange(item.id, !selected);
      else onAction(item, "Редактировать в Позициях");
      return;
    }
    onAction(item, "Открыть позицию");
  };
  const kbjuState =
    item.nutritionFilledCount === 4 ? "filled" : item.nutritionFilledCount > 0 ? "partial" : "missing";
  const discountPercent = item.hasDiscount && item.priceWithSale != null
    ? Math.round((1 - item.priceWithSale / Math.max(item.price, 1)) * 100)
    : null;
  const primaryStatusLabel = getPrimaryRowStatusLabel(item);
  const visibleCells = row.getVisibleCells().filter((cell) => cell.column.getIsVisible());
  const visibleContentColumnIds = visibleCells
    .filter((cell) => cell.column.id !== "reorder" && cell.column.id !== "selection" && cell.column.id !== "actions")
    .map((cell) => cell.column.id);
  const actionCell = visibleCells.find((cell) => cell.column.id === "actions");
  const rowWidth = visibleCells.reduce((total, cell) => total + cell.column.getSize(), 0);

  return (
    <div
      ref={setSortableNodeRef}
      data-catalog-table-row={item.id}
      data-row-reorder-enabled={reorderEnabled || undefined}
      aria-roledescription={reorderEnabled ? "sortable" : undefined}
      data-reordering={isReordering || undefined}
      data-active-position={active ? "true" : undefined}
      aria-current={active ? "true" : undefined}
      style={{
        transform: CSS.Transform.toString(reorderTransform),
        transition: reducedMotion ? undefined : reorderTransition,
        zIndex: isReordering ? 2 : undefined,
        minWidth: rowWidth,
      }}
      role="button"
      tabIndex={0}
      onClick={primaryClick}
      onKeyDown={(event) => {
        if ((event.target as HTMLElement | null)?.closest("[data-catalog-dnd-handle]")) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          primaryClick();
        }
      }}
      className={cn(
        "group relative flex w-full cursor-pointer items-center overflow-visible border-b border-[#e5e7eb] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
        CATALOG_TABLE_ROW_HEIGHT_CLASS,
        selected ? "bg-[#f1f4ff] hover:bg-[#f1f4ff]" : "bg-white hover:bg-[#fafaf9]",
        highlighted && !active && "bg-[#fff7d6] shadow-[inset_0_0_0_1px_rgba(168,117,0,0.18)]",
        active && "bg-[#f1f1ea] shadow-[inset_3px_0_0_#57534d] hover:bg-[#ecece6]",
        isReordering && "relative cursor-grabbing bg-white shadow-[0_8px_24px_rgba(41,37,36,0.14)]",
      )}
    >
      {visibleCells.filter((cell) => cell.column.id !== "actions").map((cell) => {
        const dividerClass = getTableContentDividerClass(cell.column.id, visibleContentColumnIds);
        switch (cell.column.id) {
          case "reorder":
            return (
              <StructureDragHandle
                key={cell.id}
                ref={setReorderHandleRef}
                canDrag={reorderEnabled}
                ariaLabel={`Изменить порядок позиции ${item.title}`}
                dragProps={{ ...reorderAttributes, ...reorderListeners }}
                disabledTooltip="Очистите поиск, чтобы изменить порядок"
              />
            );
          case "selection":
            return (
              <span
                key={cell.id}
                data-no-dnd
                style={getColumnWidthStyle(cell.column.getSize())}
                className="flex h-full shrink-0 items-center justify-center"
                onClick={(event) => event.stopPropagation()}
                onKeyDown={(event) => event.stopPropagation()}
              >
                <TableCheckbox
                  ariaLabel={`Выбрать ${item.title}`}
                  checked={selected}
                  forceVisible={selectionMode}
                  onChange={(checked) => onSelectedChange(item.id, checked)}
                />
              </span>
            );
          case "position":
            return (
              <div key={cell.id} data-catalog-table-content-cell={cell.column.id} style={getColumnWidthStyle(cell.column.getSize())} className={cn("flex h-full shrink-0 items-center gap-[7px] pl-[6px] pr-[12px]", dividerClass)}>
                <CatalogThumbnail src={item.thumbnailUrl} kind="item" className={CATALOG_TABLE_ROW_THUMBNAIL_CLASS} />
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span data-catalog-position-title className="block min-w-0 flex-1 truncate text-left text-[13px] font-normal leading-4 text-[#44403b] transition-colors group-hover:text-[#292524] group-hover:underline group-hover:decoration-[#d6d3d1] group-hover:underline-offset-2">
                    {itemTitle}
                  </span>
                  {primaryStatusLabel && <StatusBadge label={primaryStatusLabel} />}
                </div>
              </div>
            );
          case "description":
            return (
              <span key={cell.id} data-catalog-table-content-cell={cell.column.id} style={getColumnWidthStyle(cell.column.getSize())} className={cn("flex h-full min-w-0 shrink-0 items-center px-3 text-[13px] font-normal leading-5 text-[#57534d]", dividerClass)} title={getDescriptionPreview(item.description) || undefined}>
                <span className={cn("min-w-0 truncate whitespace-nowrap", !getDescriptionPreview(item.description) && "text-[#a6a09b]")}>{getDescriptionPreview(item.description) || "—"}</span>
              </span>
            );
          case "weight":
            return (
              <span key={cell.id} data-catalog-table-content-cell={cell.column.id} style={getColumnWidthStyle(cell.column.getSize())} className={cn("flex h-full shrink-0 items-center pl-[6px] pr-[12px] text-[13px] font-normal leading-5 text-[#44403b]", dividerClass)} title={item.weightLabel ? `Граммовка: ${item.weightLabel}` : "Нет граммовки"}>
                {item.weightLabel ? <span className="truncate whitespace-nowrap">{item.weightLabel}</span> : <span className="text-[#a6a09b]">—</span>}
              </span>
            );
          case "kbju":
            return (
              <span key={cell.id} data-catalog-table-content-cell={cell.column.id} style={getColumnWidthStyle(cell.column.getSize())} className={cn("flex h-full shrink-0 items-center justify-center px-3", dividerClass)}>
                <AuditDot state={kbjuState} title={kbjuState === "missing" ? "Нет КБЖУ" : kbjuState === "partial" ? `КБЖУ заполнено частично (${item.nutritionFilledCount} из 4)` : "КБЖУ (на 100 г) заполнено"} />
              </span>
            );
          case "translation":
            return (
              <span key={cell.id} data-catalog-table-content-cell={cell.column.id} style={getColumnWidthStyle(cell.column.getSize())} className={cn("flex h-full shrink-0 items-center justify-center px-3 text-[13px] leading-5 text-[#292524]", dividerClass)} title={`Перевод: ${item.translationFilledCount} из ${item.translationTotalCount} языков`}>
                {item.translationFilledCount}/{item.translationTotalCount}
              </span>
            );
          case "section":
            return (
              <span key={cell.id} data-catalog-table-content-cell={cell.column.id} style={getColumnWidthStyle(cell.column.getSize())} className={cn("flex h-full shrink-0 items-center px-2", dividerClass)}>
                <button
                  type="button"
                  data-no-dnd
                  title={`Открыть раздел «${item.sectionName}»`}
                  onClick={(event) => { event.stopPropagation(); onAction(item, "Открыть в разделе"); }}
                  onKeyDown={(event) => event.stopPropagation()}
                  className="min-w-0 truncate rounded-[5px] px-1 py-0.5 text-left text-[12px] text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  {item.sectionName}
                </button>
              </span>
            );
          case "tags": {
            const [firstTag, ...otherTags] = resolvedTags;
            return (
              <span
                key={cell.id}
                data-catalog-table-content-cell={cell.column.id}
                style={getColumnWidthStyle(cell.column.getSize())}
                className={cn("flex h-full min-w-0 shrink-0 items-center gap-1 px-2 text-[12px] leading-5 text-[#57534d]", dividerClass)}
                title={resolvedTags.length > 0 ? resolvedTags.join(", ") : "Теги не назначены"}
              >
                {firstTag ? (
                  <>
                    <span className="min-w-0 truncate whitespace-nowrap">{firstTag}</span>
                    {otherTags.length > 0 && <span className="shrink-0 tabular-nums text-[#a6a09b]">+{otherTags.length}</span>}
                  </>
                ) : <span className="text-[#a6a09b]">—</span>}
              </span>
            );
          }
          case "stickers": {
            const firstSticker = resolvedSticker;
            return (
              <span
                key={cell.id}
                data-catalog-table-content-cell={cell.column.id}
                style={getColumnWidthStyle(cell.column.getSize())}
                className={cn("flex h-full min-w-0 shrink-0 items-center gap-1 px-2 text-[12px] leading-5 text-[#57534d]", dividerClass)}
                title={firstSticker || "Стикеры не назначены"}
              >
                {firstSticker ? (
                  <span className="min-w-0 truncate whitespace-nowrap">{firstSticker}</span>
                ) : <span className="text-[#a6a09b]">—</span>}
              </span>
            );
          }
          case "upsells":
            return (
              <span
                key={cell.id}
                data-catalog-table-content-cell={cell.column.id}
                style={getColumnWidthStyle(cell.column.getSize())}
                className={cn("flex h-full shrink-0 items-center justify-center px-2 text-[13px] leading-5 tabular-nums text-[#292524]", dividerClass)}
                title={`Настроено рекомендаций: ${item.recommendationsCount}`}
              >
                {item.recommendationsCount}
              </span>
            );
          case "price":
            return (
              <span key={cell.id} data-catalog-table-content-cell={cell.column.id} style={getColumnWidthStyle(cell.column.getSize())} className={cn("flex h-full shrink-0 items-center pl-[6px] pr-[12px] text-[13px] font-normal leading-5 text-[#44403b]", dividerClass)}>
                {item.price === 0 ? <span className="text-[#a6a09b]" title="Цена не указана">—</span> : <span className="whitespace-nowrap">{formatPrice(item.price)}</span>}
              </span>
            );
          case "discount":
            return (
              <span key={cell.id} data-catalog-table-content-cell={cell.column.id} style={getColumnWidthStyle(cell.column.getSize())} className={cn("flex h-full shrink-0 items-center justify-end px-2 text-[13px] font-normal leading-5 text-[#44403b]", dividerClass)}>
                {discountPercent == null ? <span className="text-[#a6a09b]">—</span> : <span className="whitespace-nowrap tabular-nums">−{discountPercent}%</span>}
              </span>
            );
          case "lastModified":
            return (
              <span
                key={cell.id}
                data-catalog-table-content-cell={cell.column.id}
                style={getColumnWidthStyle(cell.column.getSize())}
                className={cn("flex h-full shrink-0 items-center justify-end px-2 text-[12px] leading-5 tabular-nums text-[#79716b]", dividerClass)}
                title={`Последнее изменение: ${formatCatalogItemLastModified(item)}`}
              >
                <span className="truncate whitespace-nowrap">{formatCatalogItemLastModified(item)}</span>
              </span>
            );
          default:
            return null;
        }
      })}
      <span data-catalog-table-filler aria-hidden="true" className="h-full min-w-0 flex-1" />
      {actionCell && (
        <span
          data-catalog-table-actions
          data-no-dnd
          style={getColumnWidthStyle(actionCell.column.getSize())}
          className="sticky right-0 z-[1] flex h-full shrink-0 items-center justify-center bg-inherit"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          {renderActions?.(item, (action, anchor, schedule) => onAction(item, action, anchor, schedule))}
        </span>
      )}
    </div>
  );
}
const AUDIT_ROW_HEIGHT = 38;
function useVirtualScrollMargin(
  scrollParentRef: RefObject<HTMLDivElement | null>,
  listRef: RefObject<HTMLDivElement | null>,
  deps: readonly unknown[],
) {
  const [scrollMargin, setScrollMargin] = useState(0);

  useEffect(() => {
    const update = () => {
      const scrollElement = scrollParentRef.current;
      const listElement = listRef.current;
      if (!scrollElement || !listElement) return;
      const scrollRect = scrollElement.getBoundingClientRect();
      const listRect = listElement.getBoundingClientRect();
      setScrollMargin(listRect.top - scrollRect.top + scrollElement.scrollTop);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return scrollMargin;
}

export function VirtualizedAuditRows({
  rows,
  selectedIds,
  selectionMode,
  scrollParentRef,
  onSelectedChange,
  onAction,
  renderActions,
  compositionMode,
  highlightItemId,
  activeItemId,
  reorderEnabled = false,
}: {
  rows: TableRow<CatalogItem>[];
  selectedIds: Set<string>;
  selectionMode: boolean;
  scrollParentRef: RefObject<HTMLDivElement | null>;
  onSelectedChange: (id: string, selected: boolean) => void;
  onAction: (item: CatalogItem, action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => void;
  renderActions?: (item: CatalogItem, onAction: (action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => void) => ReactNode;
  compositionMode?: boolean;
  highlightItemId?: string | null;
  activeItemId?: string | null;
  reorderEnabled?: boolean;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollMargin = useVirtualScrollMargin(scrollParentRef, listRef, [rows.length, selectionMode]);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => AUDIT_ROW_HEIGHT,
    getItemKey: (index) => rows[index]?.id ?? index,
    overscan: 8,
    scrollMargin,
  });

  return (
    <div
      ref={listRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const row = rows[virtualRow.index];
        if (!row) return null;
        const item = row.original;
        return (
          <div
            key={virtualRow.key}
            className="absolute left-0 top-0 w-full"
            style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
          >
            <AuditDishRow
              row={row}
              selected={selectedIds.has(item.id)}
              selectionMode={selectionMode}
              onSelectedChange={onSelectedChange}
              onAction={onAction}
              renderActions={renderActions}
              compositionMode={compositionMode}
              highlighted={highlightItemId != null && item.id === highlightItemId}
              active={activeItemId != null && item.id === activeItemId}
              reorderEnabled={reorderEnabled}
            />
          </div>
        );
      })}
    </div>
  );
}

export function SelectionToolbar({
  checked,
  indeterminate,
  onSelectAll,
  count,
  onClearSelection,
  hasStopped,
  hasSchedule,
  availabilityMixed,
  weeklySchedule,
  stopDisplayMode,
  outsideScheduleMode,
  onStopDisplayModeChange,
  onStopActivate,
  onRemoveStop,
  onScheduleChange,
  discountItem,
  onApplyDiscount,
  onMove,
  onOpenDelete,
  onArchive,
  onRestoreArchive,
  hasArchivedItems,
  hasNonArchivedItems,
  labelActions,
}: {
  checked: boolean;
  indeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
  count: number;
  onClearSelection: () => void;
  hasStopped: boolean;
  hasSchedule: boolean;
  availabilityMixed: boolean;
  weeklySchedule: WeeklySchedule;
  stopDisplayMode: CatalogStopDisplayMode;
  outsideScheduleMode: CatalogStopDisplayMode;
  onStopDisplayModeChange: (mode: CatalogStopDisplayMode) => void;
  onStopActivate: () => void;
  onRemoveStop: () => void;
  onScheduleChange: (schedule: WeeklySchedule, outsideScheduleMode: CatalogStopDisplayMode) => void;
  discountItem: CatalogItem | null;
  onApplyDiscount: (percent: number) => void;
  onMove: (anchor: MovePopoverAnchor) => void;
  onOpenDelete: () => void;
  onArchive: () => void;
  onRestoreArchive: () => void;
  hasArchivedItems: boolean;
  hasNonArchivedItems: boolean;
  labelActions?: ReactNode;
}) {
  const [scheduleEditorPinned, setScheduleEditorPinned] = useState(false);
  const [stopEditorPinned, setStopEditorPinned] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);

  return (
    <CatalogSelectionToolbar
      checked={checked}
      indeterminate={indeterminate}
      onSelectAll={onSelectAll}
      count={count}
      onClearSelection={onClearSelection}
    >
      <span className="flex shrink-0 items-center gap-[6px]">
          <button
            type="button"
            onClick={(event) => onMove(getMovePopoverAnchor(event))}
            className="inline-flex h-[26px] shrink-0 items-center gap-[6px] whitespace-nowrap rounded-[8px] border border-[#e7e5e4] bg-white pl-[6px] pr-2 text-[12px] font-normal leading-4 text-[#292524] transition hover:border-[#d6d3d1] hover:bg-[#fafaf9] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20"
          >
            <ArrowElbowUpRight size={16} weight="regular" className="-scale-y-100 rotate-180" />
            Переместить
          </button>
          <ToolbarDropdown
            label="Доступность"
            preventOutsideDismiss={(event) => (
              scheduleEditorPinned
              || (stopEditorPinned
                && event.target instanceof Element
                && Boolean(event.target.closest("[data-catalog-stop-popover]")))
            )}
            onOpenChange={(open) => {
              if (!open) {
                setScheduleEditorPinned(false);
                setStopEditorPinned(false);
              }
            }}
          >
            <CatalogPositionAvailabilityMenu
              scheduleId="bulk-items"
              manualStopped={hasStopped}
              hasSchedule={hasSchedule}
              mixed={availabilityMixed}
              direct
              weeklySchedule={weeklySchedule}
              stopDisplayMode={stopDisplayMode}
              outsideScheduleMode={outsideScheduleMode}
              onManualStopChange={(stopped) => {
                if (stopped) onStopActivate();
                else onRemoveStop();
              }}
              onScheduleChange={onScheduleChange}
              onStopDisplayModeChange={onStopDisplayModeChange}
              onScheduleEditorPinnedChange={setScheduleEditorPinned}
              onStopEditorPinnedChange={setStopEditorPinned}
            />
          </ToolbarDropdown>
          <Popover
            open={discountOpen}
            onOpenChange={setDiscountOpen}
            modal={false}
          >
            <PopoverAnchor asChild>
              <span className="inline-flex shrink-0">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      aria-label="Ещё действия"
                      className="inline-flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-[8px] border border-[#e7e5e4] bg-white text-[#57534d] transition hover:border-[#d6d3d1] hover:bg-[#fafaf9] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20"
                    >
                      <DotsThree size={16} weight="regular" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownContent align="start">
                    <DropdownActionItem
                      icon={SealPercent}
                      onSelect={() => window.setTimeout(() => setDiscountOpen(true), 50)}
                    >
                      Задать скидку
                    </DropdownActionItem>
                    {labelActions && (
                      <>
                        <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                        <div className="flex h-8 items-center">{labelActions}</div>
                      </>
                    )}
                    <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                    {hasNonArchivedItems && <DropdownActionItem icon={Archive} onSelect={onArchive}>Архивировать</DropdownActionItem>}
                    {hasArchivedItems && <DropdownActionItem onSelect={onRestoreArchive}>Вернуть из архива</DropdownActionItem>}
                    <DropdownActionItem icon={Trash} onSelect={onOpenDelete} tone="danger">Удалить</DropdownActionItem>
                  </DropdownContent>
                </DropdownMenu.Root>
              </span>
            </PopoverAnchor>
            {discountItem && (
              <BulkDiscountPopover
                item={discountItem}
                count={count}
                onClose={() => setDiscountOpen(false)}
                onApply={onApplyDiscount}
              />
            )}
          </Popover>
      </span>
    </CatalogSelectionToolbar>
  );
}

function BulkDiscountPopover({
  item,
  count,
  onClose,
  onApply,
}: {
  item: CatalogItem;
  count: number;
  onClose: () => void;
  onApply: (percent: number) => void;
}) {
  const initialPercent = item.hasDiscount && item.price > 0 && item.priceWithSale != null
    ? calculateDiscountPercent(item.price, item.priceWithSale)
    : 10;
  const [percent, setPercent] = useState(initialPercent);

  useEffect(() => {
    setPercent(item.hasDiscount && item.price > 0 && item.priceWithSale != null
      ? calculateDiscountPercent(item.price, item.priceWithSale)
      : 10);
  }, [item.id, item.hasDiscount, item.price, item.priceWithSale]);

  return (
    <PopoverContent
      data-catalog-discount-popover
      side="bottom"
      align="end"
      sideOffset={8}
      collisionPadding={12}
      className="z-[100005] w-[360px] p-3"
    >
      <div className="mb-2 text-[12px] leading-4 text-[#79716b]">
        Для {count} {count === 1 ? "позиции" : "позиций"}
      </div>
      <DiscountBlock
        item={item}
        basePrice={item.price}
        autofocusKey={1}
        onChange={(priceWithSale) => {
          if (item.price <= 0 || priceWithSale == null) {
            setPercent(0);
            return;
          }
          setPercent(Math.max(0, Math.min(99, calculateDiscountPercent(item.price, priceWithSale))));
        }}
        onRemove={() => setPercent(0)}
      />
      <div className="mt-3 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="h-8 rounded-[8px] px-3 text-[13px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524]"
        >
          Отмена
        </button>
        <button
          type="button"
          onClick={() => {
            onApply(percent);
            onClose();
          }}
          className="h-8 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]"
        >
          Применить
        </button>
      </div>
    </PopoverContent>
  );
}

export function CatalogSelectionToolbar({
  checked,
  indeterminate,
  onSelectAll,
  count,
  onClearSelection,
  children,
  selectAllAriaLabel = "Выбрать все видимые позиции",
  dataAttribute = "catalog",
}: {
  checked: boolean;
  indeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
  count: number;
  onClearSelection: () => void;
  children: ReactNode;
  selectAllAriaLabel?: string;
  dataAttribute?: "catalog" | "subsection";
}) {
  return (
    <div
      data-catalog-selection-toolbar={dataAttribute === "catalog" ? "" : undefined}
      data-subsection-bulk-toolbar={dataAttribute === "subsection" ? "" : undefined}
      className="flex h-[38px] w-full min-w-[320px] items-center overflow-x-auto overflow-y-hidden border-b border-[#e7e5e4] bg-[#fafaf9] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      <span style={{ width: CATALOG_TABLE_SELECTION_COLUMN_WIDTH }} className="flex h-full shrink-0 items-center justify-center border-b border-[#e7e5e4] bg-[#fafaf9]">
        <TableCheckbox
          ariaLabel={selectAllAriaLabel}
          checked={checked}
          indeterminate={indeterminate}
          onChange={onSelectAll}
        />
      </span>
      <div className="flex h-full min-w-max shrink-0 items-center gap-3 border-b border-[#e7e5e4] bg-[#fafaf9] px-[3px]">
        <span className="flex shrink-0 items-center gap-[6px] text-[13px] font-normal leading-5 text-[#292524]">
          <span>{count} выбрано</span>
          <button
            type="button"
            aria-label="Снять выделение"
            onClick={onClearSelection}
            className="inline-flex size-[13px] items-center justify-center rounded-[3px] text-[#79716b] transition hover:bg-white hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20"
          >
            <X size={13} weight="regular" />
          </button>
        </span>
        <span className="flex shrink-0 items-center gap-[6px]">{children}</span>
      </div>
    </div>
  );
}
export function CatalogTableFilterBar({
  activeFilterId,
  mandatoryFilterId,
  sectionScopeId,
  items,
  onActiveFilterChange,
  table,
  onResetColumns,
  simple = false,
  headerActionsOnly = false,
}: {
  activeFilterId: OverviewFilterId | null;
  mandatoryFilterId?: OverviewFilterId;
  sectionScopeId: string | null;
  items: CatalogItem[];
  onActiveFilterChange: (id: OverviewFilterId, active: boolean) => void;
  table: TanStackTable<CatalogItem>;
  onResetColumns: () => void;
  simple?: boolean;
  headerActionsOnly?: boolean;
  tagCategoryActive?: boolean;
  stickerCategoryActive?: boolean;
  onTagCategoryChange?: (active: boolean) => void;
  onStickerCategoryChange?: (active: boolean) => void;
}) {
  const [filterMenuOpen, setFilterMenuOpen] = useState(false);
  const [openFilterGroup, setOpenFilterGroup] = useState<string | null>(null);
  const scopeIds = useMemo(() => getSectionScopeIds(sectionScopeId, catalogSections), [sectionScopeId]);
  const countByFilter = (id: OverviewFilterId) => countItemsByFilter([id], items, scopeIds, mandatoryFilterId)[id] ?? 0;
  const filterGroups = CATALOG_TABLE_FILTER_GROUPS
    .map((group) => ({
      ...group,
      icon: {
        status: FlagPennant,
        availability: Clock,
        content: CatalogContentFilterIcon,
        view: Layout,
      }[group.key],
      ids: group.ids.filter((id) => id !== mandatoryFilterId),
    }))
    .filter((group) => group.ids.length > 0);
  const pinnedQuickFilterIds = useMemo(() => {
    const ordered: OverviewFilterId[] = [
      "quick:no-description",
      "status:stop",
      "status:archived",
      "quick:no-photo",
      "quick:no-weight",
    ];
    return ordered.filter((id) => id !== mandatoryFilterId && activeFilterId !== id);
  }, [activeFilterId, mandatoryFilterId]);
  const informationColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());

  if (headerActionsOnly) {
    const selectFilter = (id: OverviewFilterId) => {
      setFilterMenuOpen(false);
      setOpenFilterGroup(null);
      onActiveFilterChange(id, true);
    };
    const allPositionsSelected = activeFilterId == null;
    const activeGroup = activeFilterId ? getCatalogTableFilterGroup(activeFilterId) : null;
    const triggerLabel = activeFilterId
      ? CATALOG_TABLE_FILTER_LABELS[activeFilterId] ?? HYBRID_PRIMARY_FILTER_LABELS[activeFilterId]
      : "Все";
    const menuItemClass = "flex h-7 w-full cursor-pointer select-none items-center gap-2 rounded-[7px] px-2 text-[13px] font-normal leading-4 text-[#44403b] outline-none transition-colors data-[highlighted]:bg-[#f5f5f4] data-[state=open]:rounded-[8px] data-[state=open]:bg-[#f5f5f4]";
    const submenuClass = "z-[100003] w-[200px] min-w-[200px] overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white p-0 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)] outline-none";
    const renderSubmenuItem = (id: OverviewFilterId) => {
      const selected = activeFilterId === id;
      return (
        <DropdownMenu.Item
          key={id}
          data-catalog-filter-item={id}
          aria-current={selected ? "true" : undefined}
          onSelect={() => selectFilter(id)}
          className={cn(menuItemClass, selected && "rounded-[8px] bg-[#f5f5f4] text-[#1c1917]")}
        >
          <span className="min-w-0 flex-1 truncate">{CATALOG_TABLE_FILTER_LABELS[id] ?? HYBRID_PRIMARY_FILTER_LABELS[id]}</span>
          {selected ? (
            <Check size={16} weight="regular" className="ml-auto shrink-0 text-[#292524]" aria-hidden="true" />
          ) : (
            <span className="ml-auto shrink-0 tabular-nums text-[12px] leading-4 text-[#a6a09b]">{countByFilter(id)}</span>
          )}
        </DropdownMenu.Item>
      );
    };
    const filterMenu = (
      <div className="w-full min-w-0" data-catalog-filter-menu>
        <div className="border-b border-[#e7e5e4] bg-white p-1">
          <DropdownMenu.Item
            onSelect={() => selectFilter("quick:all")}
            data-catalog-filter-item="quick:all"
            aria-current={allPositionsSelected ? "true" : undefined}
            className={cn(
              menuItemClass,
              allPositionsSelected ? "rounded-[8px] bg-[#f5f5f4] text-[#1c1917]" : "text-[#5a5a5c]",
            )}
          >
            <Asterisk size={16} weight="regular" className="shrink-0 text-[#292524]" aria-hidden="true" />
            <span className="min-w-0 flex-1 truncate">Все позиции</span>
            {allPositionsSelected && <Check size={16} weight="regular" className="ml-auto shrink-0 text-[#292524]" aria-hidden="true" />}
          </DropdownMenu.Item>
        </div>
        <div className="bg-white p-1">
          {filterGroups.map((group) => {
            const Icon = group.icon;
            const groupActive = activeGroup === group.key;
            const firstSectionIds = group.key === "content" ? group.ids.slice(0, 3) : group.ids;
            const secondSectionIds = group.key === "content" ? group.ids.slice(3) : [];
            return (
              <DropdownMenu.Sub
                key={group.label}
                open={openFilterGroup === group.label}
                onOpenChange={(open) => setOpenFilterGroup(open ? group.label : null)}
              >
                <DropdownMenu.SubTrigger
                  data-catalog-filter-group={group.key}
                  className={menuItemClass}
                >
                  <Icon size={16} weight="regular" className="shrink-0 text-[#292524]" aria-hidden="true" />
                  <span className="min-w-0 flex-1 truncate">{group.label}</span>
                  {groupActive && <Dot size={16} weight="fill" data-catalog-active-filter-dot className="ml-auto shrink-0 text-[#0c0a09]" aria-hidden="true" />}
                  <CaretRight size={14} weight="regular" className={cn("shrink-0 text-[#a6a09b]", !groupActive && "ml-auto")} aria-hidden="true" />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    data-catalog-filter-submenu={group.key}
                    sideOffset={4}
                    alignOffset={-4}
                    collisionPadding={12}
                    className={submenuClass}
                  >
                    <div className={cn("p-1", secondSectionIds.length > 0 && "border-b border-[#e7e5e4]")}>
                      {firstSectionIds.map(renderSubmenuItem)}
                    </div>
                    {secondSectionIds.length > 0 && <div className="p-1">{secondSectionIds.map(renderSubmenuItem)}</div>}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            );
          })}
        </div>
      </div>
    );
    return (
      <DropdownMenu.Root
        open={filterMenuOpen}
        onOpenChange={(open) => {
          setFilterMenuOpen(open);
          if (!open) setOpenFilterGroup(null);
        }}
      >
        <DropdownMenu.Trigger asChild>
          <CatalogTableFilterTrigger label={triggerLabel} ariaLabel={`Фильтр таблицы: ${triggerLabel}`} />
        </DropdownMenu.Trigger>
        <DropdownContent
          align="start"
          className="w-[200px] min-w-[200px] overflow-hidden rounded-[12px] border-[#e7e5e4] p-0 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)]"
        >
          {filterMenu}
        </DropdownContent>
      </DropdownMenu.Root>
    );
  }
  if (false && headerActionsOnly) {
    return (
      <div className="flex shrink-0 items-center gap-2.5" data-catalog-view-actions>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              aria-label="Настроить колонки"
              className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[7px] px-1.5 text-[13px] font-normal leading-4 text-[#57534d] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              <SquareSplitHorizontalIcon size={16} weight="regular" />
              <span>Колонки</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownContent align="end">
            <DropdownMenu.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-[#a6a09b]">Информационные колонки</DropdownMenu.Label>
            {informationColumns.map((column) => (
              <DropdownMenu.CheckboxItem
                key={column.id}
                checked={column.getIsVisible()}
                onCheckedChange={(checked) => column.toggleVisibility(checked === true)}
                onSelect={(event) => event.preventDefault()}
                className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2.5 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
              >
                <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-[4px] border border-[#d6d3d1] bg-white">
                  <DropdownMenu.ItemIndicator><Check size={12} weight="bold" /></DropdownMenu.ItemIndicator>
                </span>
                {CATALOG_INFORMATION_COLUMN_LABELS[column.id as CatalogInformationColumnId]}
              </DropdownMenu.CheckboxItem>
            ))}
            <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
            <DropdownMenu.Item
              onSelect={onResetColumns}
              className="flex h-8 cursor-pointer select-none items-center rounded-[8px] px-2.5 text-[13px] font-medium text-[#57534d] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
            >
              Сбросить колонки
            </DropdownMenu.Item>
          </DropdownContent>
        </DropdownMenu.Root>
        <DropdownMenu.Root open={filterMenuOpen} onOpenChange={setFilterMenuOpen}>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="inline-flex h-6 shrink-0 items-center gap-1.5 rounded-[7px] px-1 text-[13px] font-normal leading-4 text-[#57534d] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              <FunnelSimple size={16} weight="regular" />
              <span>Фильтры</span>
            </button>
          </DropdownMenu.Trigger>
          <DropdownContent align="end">
            <div className="max-h-[380px] min-w-[280px] overflow-y-auto">
              <DropdownMenu.RadioGroup
                value={activeFilterId ?? ""}
                onValueChange={(value) => onActiveFilterChange(value as OverviewFilterId, true)}
              >
                {filterGroups.map((group, groupIndex) => (
                  <div key={group.label}>
                    {groupIndex > 0 && <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />}
                    <DropdownMenu.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-[#a6a09b]">{group.label}</DropdownMenu.Label>
                    {group.ids.map((id) => (
                      <DropdownMenu.RadioItem
                        key={id}
                        value={id}
                        className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-normal text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#d6d3d1] bg-white">
                          <DropdownMenu.ItemIndicator><span className="block h-2 w-2 rounded-full bg-[#57534d]" /></DropdownMenu.ItemIndicator>
                        </span>
                        <span className="min-w-0 flex-1 truncate">{HYBRID_PRIMARY_FILTER_LABELS[id]}</span>
                        <span className="shrink-0 text-[12px] tabular-nums text-[#a6a09b]">{countByFilter(id)}</span>
                      </DropdownMenu.RadioItem>
                    ))}
                  </div>
                ))}
              </DropdownMenu.RadioGroup>
            </div>
          </DropdownContent>
        </DropdownMenu.Root>
      </div>
    );
  }

  return (
    <div className="flex min-w-0 items-center gap-1" data-catalog-quick-filters>
      <DropdownMenu.Root open={filterMenuOpen} onOpenChange={setFilterMenuOpen}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="inline-flex h-[30px] shrink-0 items-center gap-1 rounded-[8px] border border-[#e7e5e4] bg-white px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <FunnelSimple size={14} />
            <span>Фильтры</span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownContent align="start">
          <div className="max-h-[380px] min-w-[280px] overflow-y-auto">
            <DropdownMenu.RadioGroup
              value={activeFilterId ?? ""}
              onValueChange={(value) => onActiveFilterChange(value as OverviewFilterId, true)}
            >
              {filterGroups.map((group, groupIndex) => (
                <div key={group.label}>
                  {groupIndex > 0 && <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />}
                  <DropdownMenu.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-[#a6a09b]">{group.label}</DropdownMenu.Label>
                  {group.ids.map((id) => (
                    <DropdownMenu.RadioItem
                      key={id}
                      value={id}
                      className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-normal text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                    >
                      <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-[#d6d3d1] bg-white">
                        <DropdownMenu.ItemIndicator><span className="block h-2 w-2 rounded-full bg-[#57534d]" /></DropdownMenu.ItemIndicator>
                      </span>
                      <span className="min-w-0 flex-1 truncate">{HYBRID_PRIMARY_FILTER_LABELS[id]}</span>
                      <span className="shrink-0 text-[12px] font-normal tabular-nums text-[#a6a09b]">{countByFilter(id)}</span>
                    </DropdownMenu.RadioItem>
                  ))}
                </div>
              ))}
            </DropdownMenu.RadioGroup>
          </div>
        </DropdownContent>
      </DropdownMenu.Root>
      {!simple && <><div className="flex min-w-0 flex-1 items-center gap-1 overflow-hidden">
          {(activeFilterId ? [activeFilterId] : []).map((id) => {
            return (
              <div
                key={id}
                className="inline-flex h-[30px] shrink-0 items-center rounded-[8px] bg-[#f1f1ea] text-[12px] font-normal text-[#57534d] transition hover:bg-[#ecece5]"
              >
                <button
                  type="button"
                  onClick={() => setFilterMenuOpen(true)}
                  className="inline-flex h-full items-center gap-1.5 rounded-l-[8px] pl-2 pr-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <span>{HYBRID_PRIMARY_FILTER_LABELS[id]}</span>
                  <span className="tabular-nums text-[#a6a09b]">{countByFilter(id)}</span>
                </button>
                <button
                  type="button"
                  aria-label={`Удалить фильтр «${HYBRID_PRIMARY_FILTER_LABELS[id]}»`}
                  onClick={() => onActiveFilterChange(id, false)}
                  className="mr-1.5 flex h-4 w-4 items-center justify-center rounded-full text-[#a6a09b] transition hover:text-[#57534d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <XCircle size={14} weight="fill" />
                </button>
              </div>
            );
          })}
          <div className="min-w-0 flex-1 overflow-hidden" data-inactive-quick-filters>
            <div className="flex w-max items-center gap-0.5">
              {pinnedQuickFilterIds.map((id) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => onActiveFilterChange(id, true)}
                  className="inline-flex h-[30px] shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-normal text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#44403b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <span>{HYBRID_PRIMARY_FILTER_LABELS[id]}</span>
                  <span className="tabular-nums text-[#a6a09b]">{countByFilter(id)}</span>
                </button>
              ))}
            </div>
          </div>
      </div>
      <CatalogColumnSettingsMenu table={table} onResetColumns={onResetColumns} />
      </>}
    </div>
  );
}
