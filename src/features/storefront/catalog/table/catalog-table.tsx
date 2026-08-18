import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { closestCenter, DndContext, KeyboardSensor, PointerSensor, type DragEndEvent, useSensor, useSensors } from "@dnd-kit/core";
import type { ColumnDef, ColumnSizingState, Header, Row as TableRow, Table as TanStackTable, VisibilityState } from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import { arrayMove, sortableKeyboardCoordinates, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  ArrowsOutCardinal,
  CaretDown,
  CaretRight,
  CaretUp,
  Check,
  Clock,
  Columns,
  Dot,
  DotsSixVertical,
  Eye,
  EyeSlash,
  FunnelSimple,
  Lock,
  MagnifyingGlass,
  XCircle,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { formatPrice, catalogSections, type CatalogItem } from "@/data/catalog";
import { cn } from "@/lib/utils";
import type { CatalogPriceSortDirection } from "../navigation/types";
import { countItemsByFilter, getSectionScopeIds } from "../model/selectors";
import { HYBRID_PRIMARY_FILTER_LABELS } from "../model/filter-config";
import type { OverviewFilterId } from "../model/types";
import { CatalogThumbnail } from "../ui/catalog-thumbnail";
import { CatalogTableSearch } from "../ui/catalog-table-controls";
import { CATALOG_DROPDOWN_CONTENT_CLASS, CATALOG_DROPDOWN_ITEM_CLASS } from "../ui/catalog-dropdown";
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

type MovePopoverAnchor = CatalogSectionActionAnchor;
type PriceSortDirection = CatalogPriceSortDirection;

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
    return item.unavailableDisplayMode === "comingSoon" || item.outsideScheduleMode === "comingSoon"
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
  selection: 42,
  position: 330,
  description: 280,
  weight: 90,
  kbju: 88,
  translation: 92,
  section: 160,
  price: 120,
  discount: 78,
  tags: 150,
  stickers: 140,
  upsells: 100,
  lastModified: 154,
  actions: 48,
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
  position: 280,
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
  description: true,
  weight: true,
  kbju: false,
  translation: false,
  section: false,
  price: true,
  discount: true,
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

function DropdownContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "center" | "end" }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn("z-[100002] min-w-[208px]", CATALOG_DROPDOWN_CONTENT_CLASS)}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

function DropdownActionItem({
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
      {Icon && <Icon size={15} weight="regular" className="shrink-0" />}
      {children}
    </DropdownMenu.Item>
  );
}

function ToolbarDivider() {
  return <span className="h-full w-px shrink-0 bg-[#dedbd6]" />;
}

function ToolbarDropdown({ label, children }: { label: string; children: ReactNode }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-full items-center gap-1 px-2.5 text-[13px] font-medium text-[#57534d] transition hover:bg-white/70 hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <span>{label}</span>
          <CaretDown size={12} weight="bold" className="text-[#a6a09b]" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent align="start">{children}</DropdownContent>
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
            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <Columns size={17} weight="regular" />
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
          "absolute inset-0 h-4 w-4 cursor-pointer appearance-none rounded-[4.8px] border-[0.8px] border-stone-300 bg-white transition duration-150 ease-out checked:border-[#79716b] checked:bg-[#79716b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
          indeterminate && "border-[#79716b] bg-[#79716b]",
          quiet && !checked && !indeterminate && !forceVisible && !hideQuietUntilInteractive && "opacity-80 group-hover:opacity-100 group-focus-within:opacity-100",
          quiet && !checked && !indeterminate && !forceVisible && hideQuietUntilInteractive && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100",
          (!quiet || checked || indeterminate || forceVisible) && "opacity-100",
        )}
      />
      {(checked || indeterminate) && (
        <span className="pointer-events-none relative z-[1] flex items-center justify-center text-white" aria-hidden="true">
          {indeterminate ? <span className="h-px w-2 rounded-full bg-current" /> : <Check size={11} weight="bold" />}
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
  query,
  onQueryChange,
  hideSearch = false,
  checked,
  indeterminate,
  onSelectAll,
  priceSort,
  onPriceSortChange,
  lastModifiedSort,
  onLastModifiedSortChange,
  table,
  onResetColumns,
  offsetForLocalHeader = false,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  hideSearch?: boolean;
  checked: boolean;
  indeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
  priceSort: PriceSortDirection;
  onPriceSortChange: () => void;
  lastModifiedSort: CatalogLastModifiedSortDirection;
  onLastModifiedSortChange: () => void;
  table: TanStackTable<CatalogItem>;
  onResetColumns: () => void;
  offsetForLocalHeader?: boolean;
}) {
  const priceSortTooltip = getPriceSortTooltip(priceSort);

  return (
    <div
      className={cn("sticky z-10 bg-white", offsetForLocalHeader ? "top-11" : "top-0")}
      data-catalog-table-header
    >
      <div className="flex h-[38px] items-center">
        {table.getVisibleLeafColumns().map((column) => {
          if (!column.getIsVisible()) return null;
          if (column.id === "reorder") return null;
          const header = table.getFlatHeaders().find((candidate) => candidate.column.id === column.id);
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
            return hideSearch ? (
              <span key={column.id} style={getColumnWidthStyle(column.getSize())} className="relative flex h-full shrink-0 items-center truncate pr-3 text-[12px] font-medium leading-5 text-[#a6a09b]">
                Позиция
                <ColumnResizeHandle header={header} />
              </span>
            ) : (
              <div key={column.id} style={getColumnWidthStyle(column.getSize())} className="relative h-full shrink-0">
                <CatalogTableSearch
                  value={query}
                  onValueChange={onQueryChange}
                  ariaLabel="Найти позицию"
                  className="h-7 w-full max-w-full"
                />
                <ColumnResizeHandle header={header} />
              </div>
            );
          }
          if (column.id === "description") {
            return (
              <span key={column.id} style={getColumnWidthStyle(column.getSize())} className="relative flex h-full shrink-0 items-center px-3 text-[12px] font-medium leading-5 text-[#a6a09b]">
                {CATALOG_INFORMATION_COLUMN_LABELS.description}
                <ColumnResizeHandle header={header} />
              </span>
            );
          }
          if (column.id === "discount") {
            return (
              <span key={column.id} style={getColumnWidthStyle(column.getSize())} className="relative flex h-full shrink-0 items-center justify-end px-2 text-[12px] font-medium leading-5 text-[#a6a09b]">
                {CATALOG_INFORMATION_COLUMN_LABELS.discount}
                <ColumnResizeHandle header={header} />
              </span>
            );
          }
          if (column.id === "price") {
            return (
              <span key={column.id} style={getColumnWidthStyle(column.getSize())} className="relative flex h-[38px] shrink-0">
                <Tooltip label={priceSortTooltip} side="top">
                  <button
                    type="button"
                    onClick={onPriceSortChange}
                    aria-label={priceSortTooltip}
                    className={cn(
                      "flex h-[38px] w-full items-center justify-end px-2 text-[12px] font-medium leading-5 transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                      priceSort === "none" ? "text-[#a6a09b]" : "text-[#57534d]",
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
              <span key={column.id} style={getColumnWidthStyle(column.getSize())} className="relative flex h-[38px] shrink-0">
                <Tooltip label={lastModifiedSortTooltip} side="top">
                  <button
                    type="button"
                    onClick={onLastModifiedSortChange}
                    aria-label={lastModifiedSortTooltip}
                    className={cn(
                      "flex h-[38px] w-full items-center justify-end gap-1 px-2 text-right text-[12px] font-medium leading-5 transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
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
          if (column.id === "actions") {
            return (
              <span key={column.id} style={getColumnWidthStyle(column.getSize())} className="flex h-[38px] shrink-0 items-center justify-center">
                <CatalogColumnSettingsMenu table={table} onResetColumns={onResetColumns} />
              </span>
            );
          }
          return (
            <span key={column.id} style={getColumnWidthStyle(column.getSize())} className="relative flex h-full shrink-0 items-center justify-center px-2 text-[12px] font-medium leading-5 text-[#a6a09b]">
              {column.id === "weight" ? "Вес" : CATALOG_INFORMATION_COLUMN_LABELS[column.id as CatalogInformationColumnId]}
              <ColumnResizeHandle header={header} />
            </span>
          );
        })}
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
        "group relative flex h-[38px] cursor-pointer items-center overflow-visible border-b border-[#e5e7eb] transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
        selected ? "bg-[#f7f6f2]" : "bg-white",
        highlighted && !active && "bg-[#fff7d6] shadow-[inset_0_0_0_1px_rgba(168,117,0,0.18)]",
        active && "bg-[#f1f1ea] shadow-[inset_3px_0_0_#57534d] hover:bg-[#ecece6]",
        isReordering && "relative cursor-grabbing bg-white shadow-[0_8px_24px_rgba(41,37,36,0.14)]",
      )}
    >
      {row.getVisibleCells().map((cell) => {
        if (!cell.column.getIsVisible()) return null;
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
              <div key={cell.id} style={getColumnWidthStyle(cell.column.getSize())} className="flex shrink-0 items-center gap-[7px] pr-3">
                <CatalogThumbnail src={item.thumbnailUrl} kind="item" className="h-5 w-5 rounded-[3px]" />
                <div className="flex min-w-0 flex-1 items-center gap-1.5">
                  <span data-catalog-position-title className="block min-w-0 flex-1 truncate text-left text-[13px] font-normal leading-4 text-[#57534d] transition-colors group-hover:text-[#292524] group-hover:underline group-hover:decoration-[#d6d3d1] group-hover:underline-offset-2">
                    {itemTitle}
                  </span>
                  {primaryStatusLabel && <StatusBadge label={primaryStatusLabel} />}
                </div>
              </div>
            );
          case "description":
            return (
              <span key={cell.id} style={getColumnWidthStyle(cell.column.getSize())} className="flex min-w-0 shrink-0 items-center px-3 text-[13px] font-normal leading-5 text-[#57534d]" title={getDescriptionPreview(item.description) || undefined}>
                <span className={cn("min-w-0 truncate whitespace-nowrap", !getDescriptionPreview(item.description) && "text-[#a6a09b]")}>{getDescriptionPreview(item.description) || "—"}</span>
              </span>
            );
          case "weight":
            return (
              <span key={cell.id} style={getColumnWidthStyle(cell.column.getSize())} className="flex shrink-0 items-center justify-center px-2 text-[13px] font-normal leading-5 text-[#79716b]" title={item.weightLabel ? `Граммовка: ${item.weightLabel}` : "Нет граммовки"}>
                {item.weightLabel ? <span className="truncate whitespace-nowrap">{item.weightLabel}</span> : <span className="text-[#a6a09b]">—</span>}
              </span>
            );
          case "kbju":
            return (
              <span key={cell.id} style={getColumnWidthStyle(cell.column.getSize())} className="flex shrink-0 items-center justify-center px-3">
                <AuditDot state={kbjuState} title={kbjuState === "missing" ? "Нет КБЖУ" : kbjuState === "partial" ? `КБЖУ заполнено частично (${item.nutritionFilledCount} из 4)` : "КБЖУ (на 100 г) заполнено"} />
              </span>
            );
          case "translation":
            return (
              <span key={cell.id} style={getColumnWidthStyle(cell.column.getSize())} className="flex shrink-0 items-center justify-center px-3 text-[13px] leading-5 text-[#292524]" title={`Перевод: ${item.translationFilledCount} из ${item.translationTotalCount} языков`}>
                {item.translationFilledCount}/{item.translationTotalCount}
              </span>
            );
          case "section":
            return (
              <span key={cell.id} style={getColumnWidthStyle(cell.column.getSize())} className="flex shrink-0 items-center px-2">
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
                style={getColumnWidthStyle(cell.column.getSize())}
                className="flex min-w-0 shrink-0 items-center gap-1 px-2 text-[12px] leading-5 text-[#57534d]"
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
                style={getColumnWidthStyle(cell.column.getSize())}
                className="flex min-w-0 shrink-0 items-center gap-1 px-2 text-[12px] leading-5 text-[#57534d]"
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
                style={getColumnWidthStyle(cell.column.getSize())}
                className="flex shrink-0 items-center justify-center px-2 text-[13px] leading-5 tabular-nums text-[#292524]"
                title={`Настроено рекомендаций: ${item.recommendationsCount}`}
              >
                {item.recommendationsCount}
              </span>
            );
          case "price":
            return (
              <span key={cell.id} style={getColumnWidthStyle(cell.column.getSize())} className="flex shrink-0 items-center justify-end px-2 text-[13px] font-normal leading-5 text-[#44403b]">
                {item.price === 0 ? <span className="text-[#a6a09b]" title="Цена не указана">—</span> : <span className="whitespace-nowrap">{formatPrice(item.price)}</span>}
              </span>
            );
          case "discount":
            return (
              <span key={cell.id} style={getColumnWidthStyle(cell.column.getSize())} className="flex shrink-0 items-center justify-end px-2 text-[13px] font-normal leading-5 text-[#44403b]">
                {discountPercent == null ? <span className="text-[#a6a09b]">—</span> : <span className="whitespace-nowrap tabular-nums">−{discountPercent}%</span>}
              </span>
            );
          case "lastModified":
            return (
              <span
                key={cell.id}
                style={getColumnWidthStyle(cell.column.getSize())}
                className="flex shrink-0 items-center justify-end px-2 text-[12px] leading-5 tabular-nums text-[#79716b]"
                title={`Последнее изменение: ${formatCatalogItemLastModified(item)}`}
              >
                <span className="truncate whitespace-nowrap">{formatCatalogItemLastModified(item)}</span>
              </span>
            );
          case "actions":
            return (
              <span key={cell.id} data-no-dnd style={getColumnWidthStyle(cell.column.getSize())} className="flex shrink-0 items-center justify-center" onClick={(event) => event.stopPropagation()} onKeyDown={(event) => event.stopPropagation()}>
                {renderActions?.(item, (action, anchor, schedule) => onAction(item, action, anchor, schedule))}
              </span>
            );
          default:
            return null;
        }
      })}
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
  count,
  onClear,
  onSetStatus,
  onSetAvailability,
  onClearDiscount,
  onOpenSchedule,
  onOpenDiscount,
  onMove,
  onOpenPlaceholder,
  onOpenDelete,
  labelActions,
}: {
  count: number;
  onClear: () => void;
  onSetStatus: (status: CatalogItem["status"]) => void;
  onSetAvailability: (selection: "available" | "stop-soon" | "stop-hidden") => void;
  onClearDiscount: () => void;
  onOpenSchedule: () => void;
  onOpenDiscount: () => void;
  onMove: (anchor: MovePopoverAnchor) => void;
  onOpenPlaceholder: (title: string, text: string) => void;
  onOpenDelete: () => void;
  labelActions?: ReactNode;
}) {
  const toolbarRef = useRef<HTMLDivElement | null>(null);
  const [layout, setLayout] = useState<"full" | "medium" | "compact" | "minimal">("full");

  useEffect(() => {
    const toolbar = toolbarRef.current;
    if (!toolbar || typeof ResizeObserver === "undefined") return;
    const updateLayout = (width: number) => {
      setLayout(width >= 600 ? "full" : width >= 500 ? "medium" : width >= 330 ? "compact" : "minimal");
    };
    updateLayout(toolbar.getBoundingClientRect().width);
    const observer = new ResizeObserver(([entry]) => updateLayout(entry.contentRect.width));
    observer.observe(toolbar);
    return () => observer.disconnect();
  }, []);

  const showAvailability = layout === "full" || layout === "medium";
  const showMove = layout !== "minimal";
  const showDiscount = layout === "full";

  return (
    <div
      ref={toolbarRef}
      data-catalog-selection-toolbar
      data-toolbar-layout={layout}
      className="flex h-8 w-full min-w-0 items-center overflow-hidden rounded-[8px] bg-[#f7f6f2]"
    >
      <span className="shrink-0 px-2.5 text-[13px] font-medium tabular-nums text-[#292524]">
        Выбрано: <span className="font-semibold">{count}</span>
      </span>
      {showAvailability && (
        <>
          <ToolbarDivider />
          <ToolbarDropdown label="Доступность">
            <DropdownActionItem onSelect={() => onSetAvailability("available")}>Доступно</DropdownActionItem>
            <DropdownMenu.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-[#a6a09b]">На стопе</DropdownMenu.Label>
            <DropdownActionItem onSelect={() => onSetAvailability("stop-soon")}>Показывать «Скоро будет»</DropdownActionItem>
            <DropdownActionItem onSelect={() => onSetAvailability("stop-hidden")}>Скрыть</DropdownActionItem>
            <DropdownActionItem onSelect={onOpenSchedule}>По расписанию…</DropdownActionItem>
          </ToolbarDropdown>
        </>
      )}
      {showMove && (
        <>
          <ToolbarDivider />
          <button
            type="button"
            onClick={(event) => onMove(getMovePopoverAnchor(event))}
            className="flex h-full shrink-0 items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] font-medium text-[#57534d] transition hover:bg-white/70 hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <ArrowsOutCardinal size={14} />
            Переместить
          </button>
        </>
      )}
      {showDiscount && (
        <>
          <ToolbarDivider />
          <ToolbarDropdown label="Скидка">
            <DropdownActionItem onSelect={onOpenDiscount}>Задать скидку</DropdownActionItem>
            <DropdownActionItem onSelect={onClearDiscount}>Убрать скидку</DropdownActionItem>
          </ToolbarDropdown>
        </>
      )}
      {labelActions && <><ToolbarDivider />{labelActions}</>}
      <span className="min-w-0 flex-1" />
      <ToolbarDivider />
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Ещё действия"
            className="flex h-full w-8 shrink-0 items-center justify-center text-[18px] leading-none text-[#57534d] transition hover:bg-white/70 hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            ⋯
          </button>
        </DropdownMenu.Trigger>
        <DropdownContent align="end">
          {!showAvailability && (
            <>
              <DropdownMenu.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-[#a6a09b]">Доступность</DropdownMenu.Label>
              <DropdownActionItem onSelect={() => onSetAvailability("available")}>Доступно</DropdownActionItem>
              <DropdownActionItem onSelect={() => onSetAvailability("stop-soon")}>Показывать «Скоро будет»</DropdownActionItem>
              <DropdownActionItem onSelect={() => onSetAvailability("stop-hidden")}>Скрыть</DropdownActionItem>
              <DropdownActionItem onSelect={onOpenSchedule}>По расписанию…</DropdownActionItem>
              <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
            </>
          )}
          {!showMove && (
            <>
              <DropdownActionItem onSelect={(event) => onMove(getMovePopoverAnchor(event))}>Переместить</DropdownActionItem>
              <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
            </>
          )}
          {!showDiscount && (
            <>
              <DropdownMenu.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-[#a6a09b]">Скидка</DropdownMenu.Label>
              <DropdownActionItem onSelect={onOpenDiscount}>Задать скидку</DropdownActionItem>
              <DropdownActionItem onSelect={onClearDiscount}>Убрать скидку</DropdownActionItem>
              <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
            </>
          )}
          <DropdownActionItem onSelect={() => onOpenPlaceholder("Дублировать", "Дублирование будет добавлено позже")}>Дублировать</DropdownActionItem>
          <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
          <DropdownActionItem onSelect={() => onSetStatus("archive")} tone="danger">Архивировать</DropdownActionItem>
          <DropdownActionItem onSelect={onOpenDelete} tone="danger">Удалить</DropdownActionItem>
        </DropdownContent>
      </DropdownMenu.Root>
      <ToolbarDivider />
      <button
        type="button"
        onClick={onClear}
        aria-label="Снять выбор"
        className="flex h-full w-8 shrink-0 items-center justify-center text-[17px] leading-none text-[#79716b] transition hover:bg-white/70 hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      >
        ×
      </button>
    </div>
  );
}
export function CatalogTableFilterBar({
  activeFilterIds,
  mandatoryFilterId,
  sectionScopeId,
  items,
  onActiveFilterChange,
  table,
  onResetColumns,
  simple = false,
  headerActionsOnly = false,
  tagCategoryActive = false,
  stickerCategoryActive = false,
}: {
  activeFilterIds: OverviewFilterId[];
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
  const filterGroups = [
    { label: "Статус", ids: ["status:active", "status:archived"] },
    { label: "Доступность", ids: ["status:stop", "status:schedule"] },
    {
      label: "Заполненность",
      ids: ["quick:no-photo", "quick:no-weight", "quick:no-description", "quick:no-kbju", "quick:no-translation", "quick:no-recommendations"],
    },
    { label: "Возможности", ids: ["quick:discount", "quick:with-labels", "quick:with-tags"] },
    { label: "Отображение", ids: ["display:full", "display:no-button", "display:no-price-only", "display:no-price"] },
  ].map((group) => ({
    ...group,
    ids: group.ids.filter(
      (id): id is OverviewFilterId => id !== "sections" && id !== "quick:all" && id !== mandatoryFilterId,
    ),
  })).filter((group) => group.ids.length > 0);
  const pinnedQuickFilterIds = useMemo(() => {
    const ordered: OverviewFilterId[] = [
      "quick:no-description",
      "status:stop",
      "status:archived",
      "quick:no-photo",
      "quick:no-weight",
    ];
    return ordered.filter((id) => id !== mandatoryFilterId && !activeFilterIds.includes(id));
  }, [activeFilterIds, mandatoryFilterId]);
  const informationColumns = table.getAllLeafColumns().filter((column) => column.getCanHide());

  if (headerActionsOnly) {
    const activeCount = activeFilterIds.length + Number(tagCategoryActive) + Number(stickerCategoryActive);
    const selectFilter = (id: OverviewFilterId) => {
      setFilterMenuOpen(false);
      setOpenFilterGroup(null);
      onActiveFilterChange(id, true);
    };
    return (
      <DropdownMenu.Root
        open={filterMenuOpen}
        onOpenChange={(open) => {
          setFilterMenuOpen(open);
          if (!open) setOpenFilterGroup(null);
        }}
      >
        <DropdownMenu.Trigger asChild>
          <button type="button" className="inline-flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-medium leading-4 text-[#57534d] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">
            <FunnelSimple size={14} />
            <span>Фильтры</span>
            {activeCount > 0 && <span className="rounded-[4px] bg-[#efefea] px-1 text-[11px] tabular-nums text-[#57534d]">{activeCount}</span>}
            <CaretDown size={12} />
          </button>
        </DropdownMenu.Trigger>
        <DropdownContent align="start">
          <div className="min-w-[176px]">
            {filterGroups.map((group) => (
              <DropdownMenu.Sub
                key={group.label}
                open={openFilterGroup === group.label}
                onOpenChange={(open) => setOpenFilterGroup(open ? group.label : null)}
              >
                <DropdownMenu.SubTrigger
                  onClick={() => setOpenFilterGroup(group.label)}
                  className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-normal text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                >
                  <span className="min-w-0 flex-1 truncate">{group.label}</span>
                  <CaretRight size={14} weight="bold" className="shrink-0 text-[#a8a29e]" />
                </DropdownMenu.SubTrigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.SubContent
                    sideOffset={5}
                    alignOffset={-5}
                    collisionPadding={12}
                    className="z-[100003] min-w-[228px] rounded-[10px] border border-[#e7e5e4] bg-white p-1 shadow-[0_12px_28px_rgba(41,37,36,0.12)] outline-none"
                  >
                    {group.ids.map((id) => (
                      <DropdownMenu.Item
                        key={id}
                        onSelect={() => selectFilter(id)}
                        className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-normal text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                      >
                        <span className="min-w-0 flex-1 truncate">{id === "quick:with-labels" ? "Со стикером" : HYBRID_PRIMARY_FILTER_LABELS[id]}</span>
                        <span className="shrink-0 text-[12px] tabular-nums text-[#a6a09b]">{countByFilter(id)}</span>
                        {activeFilterIds.includes(id) && <Check size={13} weight="bold" className="shrink-0 text-[#57534d]" />}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.SubContent>
                </DropdownMenu.Portal>
              </DropdownMenu.Sub>
            ))}
          </div>
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
              <Columns size={16} weight="regular" />
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
                value={activeFilterIds[0] ?? ""}
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
            {simple && activeFilterIds.length > 0 && <span className="text-[#a6a09b]">{activeFilterIds.length}</span>}
          </button>
        </DropdownMenu.Trigger>
        <DropdownContent align="start">
          <div className="max-h-[380px] min-w-[280px] overflow-y-auto">
            <DropdownMenu.RadioGroup
              value={activeFilterIds[0] ?? ""}
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
          {activeFilterIds.map((id) => {
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
