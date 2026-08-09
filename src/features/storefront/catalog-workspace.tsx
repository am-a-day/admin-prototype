import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent, type KeyboardEvent as ReactKeyboardEvent, type ReactNode, type RefObject } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  getCoreRowModel,
  useReactTable,
  type Updater,
  type VisibilityState,
} from "@tanstack/react-table";
import { useVirtualizer } from "@tanstack/react-virtual";
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragMoveEvent,
  type DragOverEvent,
  type DragStartEvent,
  type Modifier,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import {
  Archive,
  Asterisk,
  ArrowsOut,
  ArrowsOutCardinal,
  ArrowCounterClockwise,
  ArrowLeft,
  CaretDown,
  CaretRight,
  Check,
  CameraSlash,
  Clock,
  DotsThree,
  DotsThreeVertical,
  DotsSixVertical,
  Eye,
  EyeSlash,
  ForkKnife,
  FunnelSimple,
  GearSix,
  ImageBroken,
  List,
  MagnifyingGlass,
  PencilSimple,
  Plus,
  PlusCircle,
  Prohibit,
  ShoppingCartSimple,
  Sparkle,
  StopCircle,
  TextTSlash,
  Trash,
  X,
  XCircle,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { useAppSettings } from "@/contexts/app-settings-context";
import { usePublish } from "@/contexts/publish-context";
import type { Category } from "@/data/mock-data";
import { buildSectionTree, catalogItems, catalogSections, formatPrice } from "@/data/catalog";
import type { CatalogItem, CatalogSection, CatalogSectionNode } from "@/data/catalog";
import { useCatalogStore } from "@/contexts/catalog-store-context";
import { cn } from "@/lib/utils";
import { catalogStorageKey } from "@/lib/catalog-preview";
import {
  CATALOG_RECOMMENDATION_LIMIT,
  buildAutomaticRecommendations,
  resolveRecommendationIds,
  resolveRecommendationSource,
  type CatalogItemUpsellState,
  type CatalogUpsellStateByItem,
} from "@/lib/catalog-upsell";
import type {
  CatalogPhase,
  CatalogPrimaryTab,
  CatalogTab,
  CatalogViewMode,
  OverviewFilterId,
} from "./catalog/model/types";
import type {
  CatalogCreateNavigationGuard,
  CatalogNavigationBoundary,
  CatalogPriceSortDirection,
  CatalogReturnContext,
  CatalogSectionEditorTab,
} from "./catalog/navigation/types";
import {
  CATALOG_FILTER_PREDICATES as FILTER_PREDICATES,
  countItemsByFilter,
  getCombinedOverviewItems,
  getItemSearchText,
  getOverviewItems,
  getSectionScopeIds,
  sortItemsByPrice,
} from "./catalog/model/selectors";
import {
  moveCatalogIdToIndex,
  reorderCatalogIds,
  validateCatalogSiblingReorder,
} from "./catalog/model/mutations";
import {
  CATALOG_VIEW_MODE_GROUPS,
  HYBRID_PRIMARY_FILTER_IDS,
  HYBRID_PRIMARY_FILTER_LABELS,
  getFilterPanelTitle,
} from "./catalog/model/filter-config";
import {
  buildCatalogTree as buildLocalSectionTree,
  filterSectionTree,
  flattenCatalogTree as flattenSections,
  getParentAvailability,
  getSectionSubtreeIds,
  getSectionTreeDepth,
  type CatalogAvailabilityMode,
  type CatalogTreeSection,
} from "./catalog/model/tree";
import {
  cloneStringArrayRecord,
  orderItemsByPositionOrder,
  orderSectionItems,
} from "./catalog/model/reorder";
import {
  CatalogTreeThumbnail,
  UnifiedCatalogTreePanel,
} from "./catalog/sidebar/section-tree";
import { CatalogActionButton } from "./catalog/ui/catalog-action-button";
import { CatalogThumbnail } from "./catalog/ui/catalog-thumbnail";
import {
  CatalogDndRow,
  catalogDndId,
  DND_TRANSITION,
  parseCatalogDndId,
  restrictTableSortToVerticalAxis,
  StructureDragHandle,
  type CatalogActiveDrag,
  type CatalogDndKind,
  type CatalogDndSurface,
  type CatalogDropTarget,
  type CatalogDropZone,
  usePrefersReducedMotion,
} from "./catalog/workspace/dnd";
import { SubsectionList } from "./catalog/workspace/subsections";
import {
  CATALOG_TABLE_COLUMN_DEFS,
  CATALOG_INFORMATION_COLUMN_IDS,
  DEFAULT_TABLE_COLUMN_VISIBILITY,
  CatalogTableFilterBar,
  SelectionToolbar,
  TableCheckbox,
  TableHeaderRow,
  VirtualizedAuditRows,
} from "./catalog/table/catalog-table";
import { descriptionHasContent, getQueueEditorContext, isRepairQueueFilter } from "./catalog/editor/editor-queue";
import { useEditorSession } from "./catalog/editor/editor-session";
import { useCreateSession } from "./catalog/editor/create-session";
import { WorkspaceLocalTabs } from "./catalog/editor/editor-tabs";
import {
  readCatalogJson as readJsonRecord,
  readCreatedCatalogItems,
  removeCreatedCatalogItems,
  removeCatalogValue,
  writeCatalogJson as writeJsonRecord,
  writeCreatedCatalogItems,
} from "./catalog/persistence";
import { DropdownActionItem, DropdownContent } from "./catalog/ui/catalog-dropdown";
import { getMovePopoverAnchor, type MovePopoverAnchor } from "./catalog/ui/move-anchor";
import { MoveToSectionPopover } from "./catalog/ui/move-to-section-popover";
import type { MoveOperation } from "./catalog/ui/move-to-section-popover";
import { getCatalogSectionPathFromSections, type CatalogSectionCrumb } from "./catalog/model/section-path";
import {
  PositionEditor,
  CatalogThumb,
  PromoRecommendationsCard,
  SectionAvailabilityTab,
  createDefaultWeeklySchedule,
  getLocalizedValueFromUnknown,
  getLocalizedValueLabel,
  getLocalizedValueLabels,
  getLocalizedValuesFromUnknown,
  isWeeklyScheduleValid,
} from "./catalog/editor/position-editor";
import { DescriptionQueueComplete } from "./catalog/editor/description-queue-complete";
import type {
  PositionEditorMode,
  OutsideScheduleMode,
  PreviousAvailabilityState,
  WeeklySchedule,
} from "./catalog/editor/position-editor";
import { PositionEditorHost } from "./catalog/editor/position-editor-host";
import type {
  DescriptionAuditQueueSnapshot,
  DescriptionAuditQueueState,
  OpenPositionIntent,
} from "./catalog/editor/position-editor-host";

export type {
  CatalogPhase,
  CatalogPrimaryTab,
  CatalogTab,
  CatalogViewMode,
  OverviewFilterId,
} from "./catalog/model/types";
export type {
  CatalogCreateNavigationGuard,
  CatalogReturnContext,
} from "./catalog/navigation/types";

type SectionEditorTab = CatalogSectionEditorTab;
type PriceSortDirection = CatalogPriceSortDirection;
type TreeSection = CatalogTreeSection;
type AvailabilityMode = CatalogAvailabilityMode;

type CatalogDropIntentState = {
  targetId: string | null;
  pendingIntent: CatalogDropZone | null;
  activeIntent: CatalogDropZone | null;
  insideStartedAt: number | null;
  invalidReason?: string;
};

type CatalogPointerPosition = { x: number; y: number };
type CatalogTargetRect = { top: number; height: number };

const EMPTY_DROP_INTENT: CatalogDropIntentState = {
  targetId: null,
  pendingIntent: null,
  activeIntent: null,
  insideStartedAt: null,
};
const CATALOG_INSIDE_DELAY_MS = 300;
const CATALOG_INVALID_HINT_DELAY_MS = 500;
const CATALOG_INVALID_DROP_HOLD_MS = 1800;
const CATALOG_DROP_HYSTERESIS_PX = 5;

/** Единая геометрия section drop-зон: 25% / 50% / 25%. */
function getDropIntent(pointer: CatalogPointerPosition, targetRect: CatalogTargetRect): CatalogDropZone {
  const height = Math.max(targetRect.height, 1);
  const relativeY = (pointer.y - targetRect.top) / height;
  if (relativeY < 0.25) return "before";
  if (relativeY > 0.75) return "after";
  return "inside";
}

/** PointerSensor, который не начинает drag с интерактивных элементов строки
 * (стрелка раскрытия, +, меню, чекбокс) — они помечены атрибутом data-no-dnd. */
class CatalogPointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) => {
        if (nativeEvent.button !== 0) return false;
        const target = nativeEvent.target as HTMLElement | null;
        if (target?.closest("[data-no-dnd]")) return false;
        return true;
      },
    },
  ];
}

/** Смещает DragOverlay на фиксированный отступ от курсора (~10–12px), чтобы
 * не закрывать курсор и не совпадать с оригинальной (приглушённой) строкой. */
const overlayCursorOffset: Modifier = ({ transform }) => ({ ...transform, x: transform.x + 12, y: transform.y + 10 });

/** Во время pointer-drag целью остаётся строка непосредственно под курсором.
 * closestCenter нужен как fallback для клавиатуры и промежутков между строками. */
const catalogCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  return pointerCollisions.length > 0 ? pointerCollisions : closestCenter(args);
};

function CatalogDragOverlayRow({ drag }: { drag: NonNullable<CatalogActiveDrag> }) {
  return (
    <div className="flex h-8 w-[235px] cursor-grabbing items-center gap-2 opacity-75">
      <CatalogTreeThumbnail src={drag.imageUrl} />
      <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#44403b]">{drag.title}</span>
    </div>
  );
}

type CatalogTreeMoveSnapshot = {
  positionOrderBySection: Record<string, string[]>;
  sectionOrderByParent: Record<string, string[]>;
  itemSectionOverrides: Record<string, string>;
  sectionParentOverrides: Record<string, string | null>;
  lastItemBySection: Record<string, string>;
};

type CatalogTreeMoveUndoState = {
  message: string;
  snapshot: CatalogTreeMoveSnapshot;
} | null;

const CATALOG_TABS: { id: CatalogPrimaryTab; label: string }[] = [
  { id: "sections", label: "Каталог" },
  { id: "upsell", label: "Допродажи" },
  { id: "stop-list", label: "Стоп-лист" },
];

function createRealPositionId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  return `position-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

const CREATED_SECTION: Category = {
  id: "created-section",
  name: "Мой раздел",
  emoji: "🍽️",
  photo: "from-blue-100 to-blue-200",
};
export function CatalogTabs({
  value,
  onChange,
}: {
  value: CatalogPrimaryTab;
  onChange: (tab: CatalogPrimaryTab) => void;
}) {
  const { items } = useCatalogStore();
  const stopCount = items.filter((item) => item.status === "stopped").length;
  return (
    <div role="tablist" aria-label="Разделы каталога" className="inline-flex items-center gap-0.5 rounded-lg bg-[#f5f5f4] p-0.5">
      {CATALOG_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          role="tab"
          aria-selected={value === t.id}
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[12px] transition",
            value === t.id
              ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]"
              : "text-[#79716b] hover:text-zinc-700",
          )}
        >
          <span>{t.label}</span>
          {t.id === "stop-list" && (
            <span className={cn(
              "ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium",
              value === t.id ? "bg-[#f5f5f4] text-[#57534d]" : "bg-white/70 text-[#a6a09b]",
            )}>
              {stopCount}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

type CatalogWorkspaceProps = {
  navigation: CatalogNavigationBoundary;
  selectedDishId: string;
  catalogPhase: CatalogPhase;
  catalogTab: CatalogTab;
  stopListActive: boolean;
  viewMode: CatalogViewMode;
  sectionScopeId: string | null;
  stopListFilterId: OverviewFilterId;
  stopListSectionScopeId: string | null;
  resetSignal: number;
  onOverviewFilterChange: (id: OverviewFilterId) => void;
  onViewModeChange: (mode: CatalogViewMode) => void;
  onSectionScopeChange: (id: string | null) => void;
  onStopListFilterChange: (id: OverviewFilterId) => void;
  onStopListSectionScopeChange: (id: string | null) => void;
  onCatalogTabChange: (tab: CatalogTab) => void;
  onRegisterCreateNavigationGuard: (guard: CatalogCreateNavigationGuard | null) => void;
  onAdvancePhase: (next: "has-sections" | "has-items") => void;
};

type SectionStatus = "active" | "archive";
type SectionVisibility = "visible" | "hidden";
type SectionDraftOverride = {
  name?: string;
  imageUrl?: string | null;
};
type PanelRow = {
  id: string;
  label: string;
  count?: number;
  icon?: string;
  imageUrl?: string | null;
  accent?: boolean;
};

function getSectionStatusMeta(section: Pick<TreeSection, "status" | "visibility" | "availabilityMode">) {
  if (section.status === "archive") {
    return { label: "В архиве", className: "bg-[#f1f1ea] text-[#79716b]" };
  }
  if (section.visibility === "hidden") {
    return { label: "Скрыт", className: "bg-[#fff1f0] text-[#9f3a31]" };
  }
  if (section.availabilityMode === "unavailable") {
    return { label: "На стопе", className: "bg-[#fff7e6] text-[#9a6700]" };
  }
  if (section.availabilityMode === "schedule") {
    return { label: "По расписанию", className: "bg-[#fff7e6] text-[#9a6700]" };
  }
  return { label: "На витрине", className: "bg-[#edf8f0] text-[#287a42]" };
}

function getSectionTreeStatusLabel(section: Pick<TreeSection, "status" | "visibility" | "availabilityMode">) {
  if (section.status === "archive") return "В архиве";
  if (section.visibility === "hidden") return "Скрыт";
  if (section.availabilityMode === "unavailable") return "На стопе";
  if (section.availabilityMode === "schedule") return "По расписанию";
  return null;
}

const SECTIONS_WITH_ITEMS = catalogSections.filter((section) =>
  catalogItems.some((item) => item.sectionId === section.id),
);
type AuditChip = {
  label: string;
  tone: "stop" | "status" | "archived" | "problem";
};
type OverviewFilterMeta = {
  label: string;
  emptyTitle: string;
  emptyText: string;
  countText: (count: number) => string;
};
const OVERVIEW_FILTER_META: Record<OverviewFilterId, OverviewFilterMeta> = {
  "quick:all": {
    label: "Все позиции",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")}`,
    emptyTitle: "В меню пока нет позиций",
    emptyText: "Добавленные позиции появятся здесь общим списком.",
  },
  "quick:no-description": {
    label: "Без описания",
    countText: (count) => `${count} ${plural(count, "позиция требует", "позиции требуют", "позиций требуют")} описание`,
    emptyTitle: "Нет позиций без описания",
    emptyText: "Все позиции уже с описаниями.",
  },
  "quick:no-photo": {
    label: "Без фото",
    countText: (count) => `${count} ${plural(count, "позиция требует", "позиции требуют", "позиций требуют")} фото`,
    emptyTitle: "Нет позиций без фото",
    emptyText: "Все позиции уже с фотографиями.",
  },
  "quick:no-weight": {
    label: "Без веса",
    countText: (count) => `${count} ${plural(count, "позиция требует", "позиции требуют", "позиций требуют")} вес`,
    emptyTitle: "Нет позиций без веса",
    emptyText: "У всех позиций указана граммовка или объём.",
  },
  "quick:no-kbju": {
    label: "Без КБЖУ",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} без данных КБЖУ`,
    emptyTitle: "Нет позиций без КБЖУ",
    emptyText: "У всех позиций заполнены данные КБЖУ.",
  },
  "quick:no-translation": {
    label: "Без перевода",
    countText: (count) => `${count} ${plural(count, "позиция требует", "позиции требуют", "позиций требуют")} перевод`,
    emptyTitle: "Нет позиций без перевода",
    emptyText: "У всех позиций заполнены переводы.",
  },
  "quick:discount": {
    label: "Со скидкой",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} со скидкой`,
    emptyTitle: "Нет позиций со скидкой",
    emptyText: "Позиции со скидкой появятся здесь.",
  },
  "quick:with-tags": {
    label: "С тегами",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} с тегами`,
    emptyTitle: "Нет позиций с тегами",
    emptyText: "Позиции с тегами появятся здесь.",
  },
  "quick:with-labels": {
    label: "Со стикерами",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} со стикерами`,
    emptyTitle: "Нет позиций со стикерами",
    emptyText: "Позиции со стикерами появятся здесь.",
  },
  "quick:with-options": {
    label: "С опциями",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} с опциями`,
    emptyTitle: "Нет позиций с опциями",
    emptyText: "Позиции с опциями появятся здесь.",
  },
  "quick:with-recommendations": {
    label: "С рекомендациями",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} с рекомендациями`,
    emptyTitle: "Нет позиций с рекомендациями",
    emptyText: "Позиции с рекомендациями появятся здесь.",
  },
  "quick:no-recommendations": {
    label: "Без рекомендаций",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} без рекомендаций`,
    emptyTitle: "Нет позиций без рекомендаций",
    emptyText: "У всех позиций настроены рекомендации.",
  },
  "display:full": {
    label: "Полный вид",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} с кнопкой и ценой`,
    emptyTitle: "Нет позиций с полным видом",
    emptyText: "Позиции с кнопкой заказа и ценой появятся здесь.",
  },
  "display:no-button": {
    label: "Без кнопки",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} без кнопки заказа`,
    emptyTitle: "Нет позиций без кнопки",
    emptyText: "Позиции, где скрыта кнопка заказа, появятся здесь.",
  },
  "display:no-price": {
    label: "Без кнопки и цены",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} без кнопки и цены`,
    emptyTitle: "Нет позиций без кнопки и цены",
    emptyText: "Позиции, где скрыты кнопка заказа и цена, появятся здесь.",
  },
  "status:active": {
    label: "Активные",
    countText: (count) => `${count} ${plural(count, "позиция доступна", "позиции доступны", "позиций доступны")} гостям`,
    emptyTitle: "Нет активных позиций",
    emptyText: "Активные позиции появятся здесь.",
  },
  "status:archived": {
    label: "В архиве",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} в архиве`,
    emptyTitle: "Нет позиций в архиве",
    emptyText: "Архивные позиции появятся здесь.",
  },
  "status:stop": {
    label: "На стопе",
    countText: (count) => `${count} ${plural(count, "позиция временно недоступна", "позиции временно недоступны", "позиций временно недоступны")}`,
    emptyTitle: "Нет позиций на стопе",
    emptyText: "Все позиции сейчас доступны для гостей.",
  },
  "status:soon": {
    label: "Скоро будет",
    countText: (count) => `${count} ${plural(count, "позиция скоро будет доступна", "позиции скоро будут доступны", "позиций скоро будут доступны")}`,
    emptyTitle: "Нет позиций со статусом «Скоро будут»",
    emptyText: "Позиции с будущей доступностью появятся здесь.",
  },
  "status:schedule": {
    label: "По расписанию",
    countText: (count) => `${count} ${plural(count, "позиция доступна", "позиции доступны", "позиций доступны")} по расписанию`,
    emptyTitle: "Нет позиций по расписанию",
    emptyText: "Позиции с расписанием доступности появятся здесь.",
  },
};

function plural(count: number, one: string, few: string, many: string) {
  const abs = Math.abs(count);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return one;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
}

type AuditQueueFilterId = OverviewFilterId;
type StructureReturnContext = Extract<CatalogReturnContext, { tab: "sections" }>;

function getCatalogSectionPath(sectionId: string | null): CatalogSectionCrumb[] {
  return getCatalogSectionPathFromSections(sectionId, catalogSections);
}

type PositionsWorkspaceMode = "legacy" | "editor-first";
type EditorFirstPositionsView = "editor" | "table";
type EditorFirstPositionsState = {
  view: EditorFirstPositionsView;
  filterId: OverviewFilterId;
  sectionScopeId: string | null;
  query: string;
  sort: PriceSortDirection;
  tableScrollTop: number;
  panelScrollTop: number;
  currentId: string | null;
  queue: DescriptionAuditQueueState | null;
};

const EDITOR_FIRST_POSITIONS_STORAGE_KEY = catalogStorageKey("positionsWorkspace.editorFirst.v1");
const OVERVIEW_WORKSPACE_CONTEXT_STORAGE_KEY = catalogStorageKey("overviewWorkspace.context.v1");
const STOP_LIST_WORKSPACE_CONTEXT_STORAGE_KEY = catalogStorageKey("stopList.workspaceContext.v1");
const STOP_LIST_UNIFIED_SCOPE_STORAGE_KEY = catalogStorageKey("stopList.unifiedWorkspace.scope");
const STOP_LIST_TREE_QUERY_STORAGE_KEY = catalogStorageKey("stopList.treeQuery");
const STOP_LIST_TREE_EXPANDED_STORAGE_KEY = catalogStorageKey("stopList.treeExpanded");
const STOP_LIST_TREE_SCROLL_STORAGE_KEY = catalogStorageKey("stopList.treeScrollTop");

type OverviewWorkspaceContext = {
  panelQuery: string;
  priceSort: PriceSortDirection;
  scrollTop: number;
  sectionScopeId: string | null;
};

function readOverviewWorkspaceContext(storageKey = OVERVIEW_WORKSPACE_CONTEXT_STORAGE_KEY): OverviewWorkspaceContext {
  const stored = readJsonRecord<Partial<OverviewWorkspaceContext>>(storageKey, {});
  return {
    panelQuery: typeof stored.panelQuery === "string" ? stored.panelQuery : "",
    priceSort: stored.priceSort === "asc" || stored.priceSort === "desc" ? stored.priceSort : "none",
    scrollTop: typeof stored.scrollTop === "number" ? stored.scrollTop : 0,
    sectionScopeId: typeof stored.sectionScopeId === "string" ? stored.sectionScopeId : null,
  };
}

function readEditorFirstPositionsState(): EditorFirstPositionsState {
  const stored = readJsonRecord<Partial<EditorFirstPositionsState>>(EDITOR_FIRST_POSITIONS_STORAGE_KEY, {});
  const filterId = stored.filterId && Object.prototype.hasOwnProperty.call(FILTER_PREDICATES, stored.filterId)
    ? stored.filterId
    : "quick:all";
  return {
    view: stored.view === "table" ? "table" : "editor",
    filterId,
    sectionScopeId: typeof stored.sectionScopeId === "string" ? stored.sectionScopeId : null,
    query: typeof stored.query === "string" ? stored.query : "",
    sort: stored.sort === "asc" || stored.sort === "desc" ? stored.sort : "none",
    tableScrollTop: typeof stored.tableScrollTop === "number" ? stored.tableScrollTop : 0,
    panelScrollTop: typeof stored.panelScrollTop === "number" ? stored.panelScrollTop : 0,
    currentId: typeof stored.currentId === "string" ? stored.currentId : null,
    queue: stored.queue && typeof stored.queue === "object" ? stored.queue : null,
  };
}

function restoreEditorFirstQueue(
  stored: EditorFirstPositionsState,
  items: CatalogItem[],
): DescriptionAuditQueueState | null {
  const queue = stored.queue;
  const currentId = queue?.currentId ?? stored.currentId;
  if (!queue || !currentId || !items.some((item) => item.id === currentId)) return null;
  const existingIds = new Set(items.map((item) => item.id));
  return {
    snapshot: {
      ...queue.snapshot,
      itemIds: queue.snapshot.itemIds.filter((id) => existingIds.has(id)),
    },
    currentId,
  };
}
/** Запрос на открытие позиции во вкладке «Позиции» из вкладки «Разделы». */
type PendingOpen = {
  id: string;
  item?: CatalogItem;
  section?: {
    sectionId: string;
    sectionName: string;
    positionIds: string[];
    sectionPath?: CatalogSectionCrumb[];
    returnContext?: StructureReturnContext;
  };
  mode?: PositionEditorMode;
  returnContext?: CatalogReturnContext;
};

function readDirectCreatePendingOpen(route: CatalogNavigationBoundary["route"]): PendingOpen | null {
  if (!route.createPosition) return null;
  const sectionId = route.sectionId;
  const section = sectionId ? catalogSections.find((candidate) => candidate.id === sectionId) ?? null : null;
  const draft = makeDraftItem(section);
  const returnContext = route.returnContext ?? {
    tab: "overview" as const,
    filterId: "quick:all" as const,
    sectionScopeId: section?.id ?? null,
    tableQuery: "",
    panelQuery: "",
    sort: "none" as const,
    scrollTop: 0,
  };
  return {
    id: draft.id,
    item: draft,
    mode: "create",
    returnContext,
    section: section ? {
      sectionId: section.id,
      sectionName: section.name,
      positionIds: catalogItems.filter((item) => item.sectionId === section.id).map((item) => item.id),
      sectionPath: getCatalogSectionPath(section.id),
    } : undefined,
  };
}
function getNextPriceSort(direction: PriceSortDirection): PriceSortDirection {
  if (direction === "none") return "asc";
  if (direction === "asc") return "desc";
  return "none";
}

function getQueueItemIds(
  filterId: AuditQueueFilterId,
  items: CatalogItem[],
  query: string,
  sectionScopeId: string | null,
  priceSort: PriceSortDirection = "none",
  mandatoryFilterId?: OverviewFilterId,
) {
  const normalizedQuery = query.trim().toLowerCase();
  const scopeIds = getSectionScopeIds(sectionScopeId, catalogSections);
  const filtered = getCombinedOverviewItems(filterId, items, mandatoryFilterId)
    .filter((item) => !scopeIds || scopeIds.has(item.sectionId))
    .filter((item) =>
      !normalizedQuery || [item.title, item.sectionName].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  return sortItemsByPrice(orderItemsByStoredPositionOrder(filtered), priceSort).map((item) => item.id);
}

function CatalogSidePanel({
  title,
  children,
  actionLabel,
  selectedSectionName,
  onCreateAction,
}: {
  title: string;
  children: ReactNode;
  actionLabel?: string;
  selectedSectionName?: string | null;
  onCreateAction?: (action: string) => void;
}) {
  return (
    <aside className="w-[250px] shrink-0 overflow-y-auto border-r border-[#e7e5e4] bg-[#fbfbf9] px-2 pt-4">
      <div className="mb-4 flex items-center px-2">
        <h2 className="min-w-0 flex-1 text-[14px] font-normal leading-[1.4] text-[#292524]">{title}</h2>
        {actionLabel && onCreateAction && (
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="inline-flex h-7 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-medium text-[#292524] transition hover:bg-[#f1f1ea] hover:text-[#57534d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                aria-label={actionLabel}
                title={actionLabel}
              >
                <Plus size={14} />
                Добавить
              </button>
            </DropdownMenu.Trigger>
            <DropdownContent align="end">
              {selectedSectionName ? (
                <>
                  <DropdownActionItem onSelect={() => onCreateAction(`Добавить позицию в «${selectedSectionName}»`)}>
                    <>Добавить позицию в «{selectedSectionName}»</>
                  </DropdownActionItem>
                  <DropdownActionItem onSelect={() => onCreateAction("Добавить подраздел")}>Добавить подраздел</DropdownActionItem>
                  <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                </>
              ) : (
                <DropdownActionItem onSelect={() => onCreateAction("Добавить позицию")}>Добавить позицию</DropdownActionItem>
              )}
              <DropdownActionItem onSelect={() => onCreateAction("Добавить раздел")}>Добавить раздел</DropdownActionItem>
            </DropdownContent>
          </DropdownMenu.Root>
        )}
        {actionLabel && !onCreateAction && (
          <button
            type="button"
            className="flex h-4 w-[84px] items-center justify-end text-[#292524] transition hover:text-[#57534d]"
            aria-label={actionLabel}
            title={actionLabel}
          >
            <Plus size={16} />
          </button>
        )}
      </div>
      {children}
    </aside>
  );
}

function CatalogTreePanel({
  sections,
  archivedSections = [],
  selectedId: controlledId,
  archiveOpen = false,
  onSelectSection,
  onArchiveOpenChange,
  onRestoreSection,
  onDeleteArchivedSection,
  onCreateAction,
}: {
  sections: TreeSection[];
  archivedSections?: TreeSection[];
  selectedId?: string | null;
  archiveOpen?: boolean;
  onSelectSection?: (id: string) => void;
  onArchiveOpenChange?: (open: boolean) => void;
  onRestoreSection?: (section: TreeSection) => void;
  onDeleteArchivedSection?: (section: TreeSection) => void;
  onCreateAction?: (action: string) => void;
}) {
  const tree = sections;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [tree[0]?.id ?? ""]: true });
  const [internalId, setInternalId] = useState<string | null>(tree[0]?.id ?? null);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);
  const selectedId = controlledId !== undefined ? controlledId : internalId;
  const archivedFlat = flattenSections(archivedSections);
  const selectSection = (id: string) => {
    if (onSelectSection) onSelectSection(id);
    else setInternalId(id);
  };

  useEffect(() => {
    if (!archiveOpen || !selectedId || !archivedFlat.some((section) => section.id === selectedId)) return;
    const timeout = window.setTimeout(() => selectedRowRef.current?.scrollIntoView({ block: "nearest" }), 0);
    return () => window.clearTimeout(timeout);
  }, [archiveOpen, archivedFlat.length, selectedId]);

  const renderSectionRow = (section: TreeSection, depth = 0, archived = false) => {
    const hasChildren = Boolean(section.children?.length);
    const isExpanded = expanded[section.id] ?? true;
    const isSelected = section.id === selectedId;

    return (
      <div key={section.id}>
        <div
          ref={isSelected ? selectedRowRef : undefined}
          role="button"
          tabIndex={0}
          onClick={() => selectSection(section.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              selectSection(section.id);
            }
          }}
          className={cn(
            "group relative flex h-8 items-center rounded-xl border text-[13px] leading-[18px] transition",
            isSelected &&
              "rounded-lg border-[#e7e5e4] bg-white text-[#292524] shadow-[0_0_2px_rgba(0,0,0,0.09)]",
            !isSelected && (archived
              ? "border-transparent text-[#8a8179] hover:bg-[#f1f1ea]"
              : "border-transparent text-[#79716b] hover:bg-[#f1f1ea]"),
          )}
          style={{ paddingLeft: 6 + depth * 10, paddingRight: 8 }}
        >
          <DotsSixVertical
            size={12}
            className="absolute -left-1.5 shrink-0 text-[#a8a29e] opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100"
          />
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              if (hasChildren) {
                setExpanded((value) => ({ ...value, [section.id]: !isExpanded }));
              }
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className={cn(
              "relative mr-2 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-[#e6e6db] text-[12px] text-[#57534d] transition",
              hasChildren ? "hover:bg-[#d8d8cd]" : "pointer-events-none",
              isSelected && "border border-[#4f39f6] bg-white p-[2px]",
            )}
            aria-label={isExpanded ? "Свернуть раздел" : "Развернуть раздел"}
          >
            <span className={cn("flex h-full w-full items-center justify-center overflow-hidden transition", hasChildren && "group-hover:opacity-0")}>
              {section.imageUrl ? (
                <img src={section.imageUrl} alt="" loading="lazy" className="h-full w-full rounded-[4px] object-cover" />
              ) : (
                section.emoji ?? "🍽️"
              )}
            </span>
            {hasChildren && (
              <CaretRight
                size={12}
                className={cn(
                  "absolute opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100",
                  isExpanded && "rotate-90",
                )}
              />
            )}
          </button>
          <span className="min-w-0 flex-1 truncate text-left font-medium">
            {section.name}
          </span>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onCreateAction?.(`Добавить позицию в «${section.name}»`);
            }}
            onKeyDown={(event) => event.stopPropagation()}
            className={cn(
              "ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#79716b] opacity-0 transition hover:bg-[#e6e6db] hover:text-[#292524] group-hover:opacity-100 group-focus-within:opacity-100",
              archived && "hidden",
            )}
            aria-label={`Добавить позицию в ${section.name}`}
            title="Добавить позицию"
          >
            <Plus size={14} />
          </button>
          {archived && (
            <span className="relative ml-1 flex h-6 w-6 shrink-0 items-center justify-end">
              <Tooltip label="В архиве" side="top" delayDuration={200}>
                <Archive
                  size={14}
                  className="text-[#a8a29e] transition group-hover:opacity-0 group-focus-within:opacity-0"
                />
              </Tooltip>
              <Tooltip label="Восстановить из архива" side="top" delayDuration={200}>
                <button
                  type="button"
                  aria-label="Восстановить из архива"
                  onClick={(event) => {
                    event.stopPropagation();
                    onRestoreSection?.(section);
                  }}
                  className="absolute right-0 flex h-6 w-6 items-center justify-center rounded-[7px] text-[#79716b] opacity-0 transition hover:bg-[#efefeb] hover:text-[#292524] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <ArrowCounterClockwise size={13} />
                </button>
              </Tooltip>
            </span>
          )}
          {archived && (
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={`Действия с разделом ${section.name}`}
                  onClick={(event) => event.stopPropagation()}
                  className="ml-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] opacity-0 transition hover:bg-[#efefeb] hover:text-[#292524] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 group-hover:opacity-100 group-focus-within:opacity-100"
                >
                  <DotsThreeVertical size={15} weight="bold" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownContent align="end">
                <DropdownActionItem onSelect={() => onRestoreSection?.(section)}>Восстановить из архива</DropdownActionItem>
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                <DropdownActionItem tone="danger" onSelect={() => onDeleteArchivedSection?.(section)}>
                  Удалить навсегда
                </DropdownActionItem>
              </DropdownContent>
            </DropdownMenu.Root>
          )}
        </div>
        {hasChildren && isExpanded && (
          <div className="space-y-1 pl-2 pt-1">
            {section.children?.map((child) => renderSectionRow(child, depth + 1, archived))}
          </div>
        )}
      </div>
    );
  };

  const selectedSectionName = findTreeSectionName(tree, selectedId) ?? findTreeSectionName(archivedSections, selectedId);

  return (
    <CatalogSidePanel
      title="Разделы"
      actionLabel="Добавить"
      selectedSectionName={selectedSectionName}
      onCreateAction={onCreateAction}
    >
      <div className="flex min-h-0 flex-col">
        <div className="space-y-1">{tree.map((section) => renderSectionRow(section))}</div>
        {archivedFlat.length > 0 && (
          <div className="mt-3 border-t border-[#eceae7] pt-2">
            <button
              type="button"
              onClick={() => onArchiveOpenChange?.(!archiveOpen)}
              className="flex h-7 w-full items-center rounded-[8px] px-1.5 text-left text-[12px] font-medium leading-5 text-[#a8a29e] transition hover:bg-[#f7f6f2] hover:text-[#79716b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              <span className="min-w-0 flex-1 truncate">Архивные разделы · {archivedFlat.length}</span>
              <CaretRight size={13} className={cn("shrink-0 transition", archiveOpen && "rotate-90")} />
            </button>
            {archiveOpen && (
              <div className="mt-1.5 space-y-1">
                {archivedSections.map((section) => renderSectionRow(section, 0, true))}
              </div>
            )}
          </div>
        )}
      </div>
    </CatalogSidePanel>
  );
}

function findTreeSectionName(sections: TreeSection[], id?: string | null): string | null {
  if (!id) return null;
  for (const section of sections) {
    if (section.id === id) return section.name;
    const childName = findTreeSectionName(section.children ?? [], id);
    if (childName) return childName;
  }
  return null;
}

type SectionDeleteSummary = {
  positionCount: number;
  subsectionCount: number;
};

type SectionCreationResult = boolean | string | void;

function getPositionCreateRestriction(sectionId: string, sections: TreeSection[]): string | null {
  const section = sections.find((candidate) => candidate.id === sectionId);
  return section?.status === "archive" ? "Архивный раздел нельзя изменять" : null;
}

function SectionParentPicker({
  sections,
  allItems,
  value,
  onChange,
}: {
  sections: TreeSection[];
  allItems: CatalogItem[];
  value: string | null;
  onChange: (parentId: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selected = value ? sections.find((section) => section.id === value) ?? null : null;
  const availableSections = sections.filter((section) => getParentAvailability(section, allItems, sections).available);
  const unavailableSections = sections.filter((section) => !getParentAvailability(section, allItems, sections).available);
  const selectedLabel = selected?.name ?? "Каталог";

  const renderSectionItem = (section: TreeSection, disabled: boolean) => {
    const availability = getParentAvailability(section, allItems, sections);
    const isSelected = value === section.id;
    const unavailable = !availability.available;
    return (
      <DropdownMenu.Item
        key={section.id}
        disabled={disabled}
        onSelect={() => onChange(section.id)}
        style={{ paddingLeft: 8 + getSectionTreeDepth(section.id, sections) * 16 }}
        className={cn(
          "flex min-h-10 select-none items-center gap-2 rounded-[8px] pr-2 text-left outline-none transition",
          disabled
            ? "cursor-not-allowed opacity-55"
            : "cursor-pointer data-[highlighted]:bg-[#f5f5f4]",
          isSelected && !disabled && "bg-[#f3f3ed]",
        )}
      >
        <CatalogThumbnail src={section.imageUrl} kind="section" className="h-6 w-6 rounded-[6px]" />
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[13px] font-medium", disabled ? "text-[#8a8179]" : "text-[#44403b]")}>{section.name}</span>
          {unavailable && (
            <span className="mt-0.5 block truncate text-[11px] font-normal leading-4 text-[#a8a29e]">{availability.label}</span>
          )}
        </span>
        {isSelected && !disabled && <Check size={14} className="shrink-0 text-[#57534d]" />}
      </DropdownMenu.Item>
    );
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          id="catalog-create-section-parent"
          aria-label={`Расположение: ${selectedLabel}`}
          aria-expanded={open}
          className="mt-1.5 flex h-9 w-full items-center gap-2 rounded-[8px] border border-[#e5e5e5] bg-white px-2.5 text-left text-[13px] text-[#292524] outline-none transition hover:border-[#d6d3d1] focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/10"
        >
          <CatalogThumbnail src={selected?.imageUrl} kind="section" className="h-5 w-5 rounded-[5px]" />
          <span className="min-w-0 flex-1 truncate">{selectedLabel}</span>
          <CaretDown size={13} weight="bold" className="shrink-0 text-[#a8a29e]" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-[100002] max-h-[min(420px,calc(100vh-32px))] w-[min(380px,calc(100vw-32px))] overflow-y-auto rounded-[12px] border border-[#e7e5e4] bg-white p-1.5 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
        >
          <DropdownMenu.Label className="px-2 pb-1 pt-1 text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">Доступно</DropdownMenu.Label>
          <DropdownMenu.Item
            onSelect={() => onChange(null)}
            className={cn(
              "flex h-9 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]",
              value === null && "bg-[#f3f3ed]",
            )}
          >
            <CatalogThumbnail kind="section" className="h-6 w-6 rounded-[6px]" />
            <span className="min-w-0 flex-1">Каталог</span>
            {value === null && <Check size={14} className="shrink-0 text-[#57534d]" />}
          </DropdownMenu.Item>
          {availableSections.length > 0 && (
            <div className="mt-1 border-t border-[#f0efec] pt-1">
              {availableSections.map((section) => renderSectionItem(section, false))}
            </div>
          )}
          {unavailableSections.length > 0 && (
            <div className="mt-1 border-t border-[#f0efec] pt-1">
              <DropdownMenu.Label className="px-2 pb-1 pt-1 text-[11px] font-medium text-[#a8a29e]">Недоступно для подраздела</DropdownMenu.Label>
              {unavailableSections.map((section) => renderSectionItem(section, true))}
            </div>
          )}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function CreateSectionDialog({
  sections = [],
  allItems = [],
  initialParentId = null,
  returnFocusRef,
  onCreate,
  onCancel,
}: {
  sections?: TreeSection[];
  allItems?: CatalogItem[];
  initialParentId?: string | null;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
  onCreate: (name: string, parentId: string | null) => SectionCreationResult;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [parentId, setParentId] = useState<string | null>(initialParentId);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const flatSections = flattenSections(sections);
  const selectedParent = parentId ? flatSections.find((section) => section.id === parentId) ?? null : null;
  const selectedParentAvailability = selectedParent ? getParentAvailability(selectedParent, allItems, sections) : null;
  const parentError = parentId && !selectedParent
    ? "Выбранный родитель больше недоступен"
    : selectedParentAvailability && !selectedParentAvailability.available
      ? selectedParentAvailability.label
      : null;
  const canSubmit = Boolean(name.trim()) && !parentError && !submitting;

  useEffect(() => {
    const timeouts = [0, 120, 360].map((delay) => window.setTimeout(() => inputRef.current?.focus(), delay));
    return () => timeouts.forEach((timeout) => window.clearTimeout(timeout));
  }, []);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (!submitting) {
        onCancel();
        window.setTimeout(() => returnFocusRef?.current?.focus(), 0);
      }
      return;
    }
    if (event.key === "Enter" && (event.target as HTMLElement).tagName === "SELECT") {
      event.stopPropagation();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const handleSubmit = () => {
    const nextName = name.trim();
    if (!nextName || parentError || submitting) return;
    setSubmitting(true);
    const result = onCreate(nextName, parentId);
    if (typeof result === "string") {
      setError(result);
      setSubmitting(false);
      return;
    }
    if (result === false) setSubmitting(false);
  };

  const handleCancel = () => {
    if (submitting) return;
    onCancel();
    window.setTimeout(() => returnFocusRef?.current?.focus(), 0);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="catalog-create-section-title"
        aria-describedby="catalog-create-section-description"
        onKeyDown={handleDialogKeyDown}
        className="w-full max-w-[420px] rounded-[14px] border border-[#e7e5e4] bg-white p-5 shadow-[0_20px_60px_rgba(41,37,36,0.18)] outline-none"
      >
        <h2 id="catalog-create-section-title" className="text-[16px] font-semibold leading-6 text-[#292524]">Новый раздел</h2>
        <p id="catalog-create-section-description" className="sr-only">Создание раздела каталога</p>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            handleSubmit();
          }}
        >
          <div className="mt-4">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="catalog-create-section-name" className="text-[13px] font-medium text-[#44403b]">Название раздела</label>
              <span className="text-[11px] tabular-nums text-[#a8a29e]">{name.length} / 25</span>
            </div>
            <Input
              ref={inputRef}
              id="catalog-create-section-name"
              autoFocus
              value={name}
              maxLength={25}
              onChange={(event) => {
                setName(event.target.value.slice(0, 25));
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="Например, Горячие блюда"
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "catalog-create-section-error" : undefined}
              size="compact"
              className="mt-1.5"
            />
          </div>
          <div className="mt-4">
            <label htmlFor="catalog-create-section-parent" className="block text-[13px] font-medium text-[#44403b]">Расположение</label>
            <SectionParentPicker
              sections={flatSections}
              allItems={allItems}
              value={parentId}
              onChange={(nextParentId) => {
                setParentId(nextParentId);
                setError("");
              }}
            />
            {parentError && <p className="mt-1.5 text-[12px] leading-4 text-[#9f1239]">{parentError}</p>}
            {error && <p id="catalog-create-section-error" className="mt-1.5 text-[12px] leading-4 text-[#9f1239]">{error}</p>}
          </div>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={handleCancel}
              disabled={submitting}
              className="h-8 rounded-[8px] px-3 text-[13px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Отмена
            </button>
            <button
              type="submit"
              disabled={!canSubmit}
              className="h-8 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b] disabled:cursor-not-allowed disabled:opacity-40"
            >
              {submitting ? "Добавление…" : "Добавить раздел"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body,
  );
}

function CatalogEmptyState({ onCreateSection }: { onCreateSection: () => void }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-white p-8">
      <div className="mx-auto flex w-full max-w-[760px] flex-1 items-center">
        <div className="w-full rounded-[12px] border border-dashed border-[#e7e5e4] bg-[#fafaf9] p-6">
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-[17px]">
              <ForkKnife size={45} weight="fill" className="text-[#44403b]" />
              <div className="flex flex-col gap-4">
                <p className="text-[16px] font-medium leading-[1.4] text-[#44403b]">Каталог пока пуст</p>
                <p className="max-w-[600px] text-[14px] leading-[1.4] text-[#79716b]">
                  Создайте первый раздел, чтобы начать добавлять позиции.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={onCreateSection}
              className="inline-flex h-[32px] self-start items-center justify-center rounded-[10px] bg-[#4f39f6] px-[10px] text-[14px] font-medium text-white transition hover:bg-[#4030d4]"
            >
              Создать раздел
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

function SectionEmptyState({ sectionName, onAddItem }: { sectionName: string; onAddItem?: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-8">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <h2 className="text-[18px] font-semibold text-[#292524]">{sectionName}</h2>
        <div className="rounded-[12px] border border-dashed border-[#e7e5e4] bg-[#fafaf9] p-6">
          <div className="flex flex-col gap-3">
            <p className="text-[16px] font-medium leading-[1.4] text-[#44403b]">В этом разделе пока нет позиций</p>
            <p className="text-[14px] leading-[1.4] text-[#79716b]">
              Добавьте первую позицию, чтобы она появилась на витрине.
            </p>
            {onAddItem && (
              <button
                type="button"
                onClick={onAddItem}
                className="mt-1 inline-flex h-8 self-start items-center gap-1.5 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]"
              >
                <Plus size={14} />
                Добавить позицию
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function FilterPanelRow({
  row,
  selected,
  disabled = false,
  onClick,
}: {
  row: PanelRow;
  selected?: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  const icon = getHybridFilterIcon(row.id as OverviewFilterId);
  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      onClick={disabled ? undefined : onClick}
      onKeyDown={(event) => {
        if (disabled) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onClick();
        }
      }}
      className={cn(
        "flex h-[30px] w-full cursor-pointer items-center gap-2 border px-2 pl-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        selected
          ? "rounded-[8px] border-[#e7e5e4] bg-white shadow-[0_0_2px_rgba(0,0,0,0.09)]"
          : "rounded-[8px] border-transparent hover:bg-[#f0f0ea]",
      )}
    >
      <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#57534d]">
        {icon}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] font-normal leading-[18px]",
          selected ? "text-[#1c1917]" : "text-[#44403b]",
        )}
      >
        {row.label}
      </span>
      {row.count != null && (
        <span className={cn(
          "shrink-0 text-[12px] font-normal leading-[19.2px] tabular-nums",
          selected ? "text-[#292524]" : "text-[rgba(90,90,92,0.8)]",
        )}>
          {row.count}
        </span>
      )}
    </div>
  );
}

function getHybridFilterIcon(id: OverviewFilterId) {
  if (id === "quick:all") return <Asterisk size={16} />;
  if (id === "status:stop") return <StopCircle size={16} />;
  if (id === "status:archived") return <Archive size={16} />;
  if (id === "quick:no-description") return <TextTSlash size={16} />;
  if (id === "quick:no-photo") return <CameraSlash size={16} />;
  return <FunnelSimple size={16} weight="regular" />;
}

// ── Empty catalog: skeleton + left panel (phase-aware) ────────────────────────

function EmptyCatalog({
  sections,
  onAddItem,
}: {
  sections: TreeSection[];
  onAddItem: () => void;
}) {
  const [feedback, setFeedback] = useState("");

  const showPlaceholderFeedback = (message: string) => {
    setFeedback(message);
  };

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <CatalogTreePanel
          sections={sections}
          onCreateAction={(action) => showPlaceholderFeedback(`${action}: placeholder`)}
        />
        <SectionEmptyState
          sectionName={sections[0]?.name ?? "Раздел"}
          onAddItem={onAddItem}
        />
        {feedback && (
          <div className="fixed bottom-5 left-1/2 z-[100003] -translate-x-1/2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">
            {feedback}
          </div>
        )}
      </div>
    </main>
  );
}

// ── Normal populated workspace ────────────────────────────────────────────────

// ── Position editor: back → summary header → tabs ─────────────────────────────

const ACTIVE_POSITION_LIMIT = 600;
const CATALOG_PREVIOUS_AVAILABILITY_STORAGE_KEY = catalogStorageKey("previousAvailability");
const CATALOG_SECTION_STATUS_STORAGE_KEY = catalogStorageKey("sectionStatusOverrides");
const CATALOG_SECTION_VISIBILITY_STORAGE_KEY = catalogStorageKey("sectionVisibilityOverrides");
const CATALOG_SECTION_DRAFT_STORAGE_KEY = catalogStorageKey("sectionDraftOverrides");
const CATALOG_SECTION_AVAILABILITY_STORAGE_KEY = catalogStorageKey("sectionAvailabilityMode");
const CATALOG_SECTION_OUTSIDE_SCHEDULE_STORAGE_KEY = catalogStorageKey("sectionOutsideSchedule");
const CATALOG_SECTION_WEEKLY_SCHEDULE_STORAGE_KEY = catalogStorageKey("sectionWeeklySchedule");
const CATALOG_POSITION_ORDER_STORAGE_KEY = catalogStorageKey("positionOrderBySection");
const CATALOG_SECTION_ORDER_STORAGE_KEY = catalogStorageKey("sectionOrderByParent");
const CATALOG_SECTION_PARENT_STORAGE_KEY = catalogStorageKey("sectionParentOverrides");
const CATALOG_RECENT_POSITION_STORAGE_KEY = catalogStorageKey("recentPositionIds");
const CATALOG_ACTIVE_SECTION_STORAGE_KEY = catalogStorageKey("sections.activeSectionId");
const CATALOG_SECTION_EDITOR_TAB_STORAGE_KEY = catalogStorageKey("sections.editorTab");
const CATALOG_SECTION_TABLE_QUERY_STORAGE_KEY = catalogStorageKey("sections.tableQuery");
const CATALOG_SECTION_TABLE_PRICE_SORT_STORAGE_KEY = catalogStorageKey("sections.tablePriceSort");
const CATALOG_SECTION_EDITOR_SCROLL_STORAGE_KEY = catalogStorageKey("sections.editorScrollTop");
const CATALOG_SECTION_HIGHLIGHT_ITEM_STORAGE_KEY = catalogStorageKey("sections.highlightItemId");
const CATALOG_SECTION_TREE_QUERY_STORAGE_KEY = catalogStorageKey("sections.treeQuery");
const CATALOG_SECTION_TREE_EXPANDED_STORAGE_KEY = catalogStorageKey("sections.treeExpanded");
const CATALOG_SECTION_TREE_SCROLL_STORAGE_KEY = catalogStorageKey("sections.treeScrollTop");
const CATALOG_SECTION_TREE_CONTENT_STORAGE_KEY = catalogStorageKey("sections.treeContent");
const CATALOG_UNIFIED_SCOPE_STORAGE_KEY = catalogStorageKey("unifiedWorkspace.scope");
type CatalogTreeContentMode = "sections-and-positions" | "sections-only";

function readCatalogTreeContentMode(): CatalogTreeContentMode {
  return readJsonRecord<CatalogTreeContentMode>(
    CATALOG_SECTION_TREE_CONTENT_STORAGE_KEY,
    "sections-and-positions",
  ) === "sections-only"
    ? "sections-only"
    : "sections-and-positions";
}
const CATALOG_RECENT_POSITION_LIMIT = 5;
/** Unfilled audit fields (routed to «Основное»). */
function buildPositionProblems(item: CatalogItem): string[] {
  const problems: string[] = [];
  if (!item.weightLabel) problems.push("Нет веса");
  if (item.nutritionFilledCount === 0) problems.push("Нет КБЖУ");
  if (item.translationFilledCount < item.translationTotalCount) problems.push("Нет перевода");
  if (!item.hasDescription) problems.push("Нет описания");
  return problems;
}

function EditorPositionEmptyState({
  sectionName,
  itemCount,
  onAddItem,
  onSectionSettings,
}: {
  sectionName: string;
  itemCount: number;
  onAddItem: () => void;
  onSectionSettings: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center p-8">
      <div className="w-full max-w-[360px] rounded-[12px] border border-[#e7e5e4] bg-white px-5 py-4 shadow-[0_2px_8px_rgba(41,37,36,0.05)]">
        <h2 className="truncate text-[15px] font-semibold text-[#292524]">{sectionName}</h2>
        <p className="mt-0.5 text-[12px] text-[#a8a29e]">
          {itemCount} {plural(itemCount, "позиция", "позиции", "позиций")}
        </p>
        <p className="mt-3 text-[13px] leading-5 text-[#57534d]">Выберите позицию слева, чтобы открыть редактор.</p>
        <div className="mt-4 flex items-center gap-2">
          {itemCount === 0 && (
            <button
              type="button"
              onClick={onAddItem}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]"
            >
              <Plus size={14} />
              Добавить позицию
            </button>
          )}
          <button
            type="button"
            onClick={onSectionSettings}
            className="inline-flex h-8 items-center rounded-[8px] border border-[#e7e5e4] bg-white px-3 text-[13px] font-medium text-[#57534d] transition hover:bg-[#fafaf9] hover:text-[#292524]"
          >
            Настройки раздела
          </button>
        </div>
      </div>
    </div>
  );
}

function SectionItemRow({
  item,
  selected,
  onSelectedChange,
  onOpen,
}: {
  item: CatalogItem;
  selected: boolean;
  onSelectedChange: (id: string, selected: boolean) => void;
  onOpen: () => void;
}) {
  const statusChips = getStatusChips(item);
  const problems = buildPositionProblems(item);
  const salePrice = item.hasDiscount && item.priceWithSale != null ? item.priceWithSale : null;
  const statusMeta = statusChips
    .filter((chip) => ["В архиве", "На стопе", "Скоро будет", "С расписанием"].includes(chip.label))
    .map((chip) => chip.label === "С расписанием" ? "По расписанию" : chip.label);
  const metaText = statusMeta[0] ?? (problems.length > 0
    ? `${problems.length} ${plural(problems.length, "поле", "поля", "полей")} не заполнены`
    : "");

  return (
    <div
      className={cn(
        "group flex w-full items-center gap-3 px-3 py-2.5 transition hover:bg-[#fafaf9]",
        selected && "bg-[#f7f6f2]",
      )}
    >
      <TableCheckbox
        ariaLabel={`Выбрать ${item.title}`}
        checked={selected}
        onChange={(checked) => onSelectedChange(item.id, checked)}
      />
      <span
        className={cn(
          "flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[6px]",
          item.thumbnailUrl ? "bg-[#f5f5f4]" : "bg-[#faf0e6]",
        )}
      >
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <ImageBroken size={14} className="text-[#bc4a08]" />
        )}
      </span>
      <button type="button" onClick={onOpen} className="flex min-w-0 flex-1 flex-col gap-1 text-left">
        <span className="truncate text-[13px] leading-none text-[#292524]">{item.title}</span>
        {metaText && <span className="truncate text-[11px] leading-5 text-[#a8a29e]">{metaText}</span>}
      </button>
      <span className="shrink-0 text-right text-[13px] leading-5 text-[#292524]">
        {item.price === 0 && salePrice == null ? (
          <span className="text-[#a6a09b]">—</span>
        ) : (
          formatPrice(salePrice ?? item.price)
        )}
      </span>
    </div>
  );
}

function SectionItemList({
  section,
  items,
  selectedIds,
  feedback,
  onSelectedChange,
  onSelectAll,
  onClearSelection,
  onSectionAction,
  onBulkAction,
  onOpenItem,
}: {
  section: { name: string; imageUrl?: string | null; status?: SectionStatus } | null;
  items: CatalogItem[];
  selectedIds: Set<string>;
  feedback: string;
  onSelectedChange: (id: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
  onClearSelection: () => void;
  onSectionAction: (action: string, anchor?: MovePopoverAnchor) => void;
  onBulkAction: (action: string, anchor?: MovePopoverAnchor) => void;
  onOpenItem: (id: string) => void;
}) {
  const sectionName = section?.name ?? "Раздел";
  const isArchivedSection = section?.status === "archive";
  const selectedCount = selectedIds.size;
  const allSelected = items.length > 0 && items.every((item) => selectedIds.has(item.id));
  const someSelected = items.some((item) => selectedIds.has(item.id));

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-6">
      <div className="mx-auto w-full max-w-3xl">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#f5f5f4] text-[18px]">
              {section?.imageUrl ? (
                <img src={section.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <List size={20} className="text-[#57534d]" />
              )}
            </span>
            <div className="min-w-0">
              <h2 className="flex min-w-0 items-center gap-2 text-[20px] font-semibold leading-6 text-[#292524]">
                <span className="truncate">{sectionName}</span>
                {isArchivedSection && (
                  <span className="shrink-0 rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-[#79716b]">
                    В архиве
                  </span>
                )}
              </h2>
              <p className="mt-1 text-[13px] text-[#a8a29e]">
                {items.length} {plural(items.length, "позиция", "позиции", "позиций")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {!isArchivedSection && (
              <button
                type="button"
                onClick={() => onSectionAction("Добавить позицию")}
                className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]"
              >
                <Plus size={14} />
                Добавить позицию
              </button>
            )}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#e7e5e4] bg-white px-3 text-[13px] font-medium text-[#57534d] transition hover:bg-[#fafaf9] hover:text-[#292524]"
                >
                  Изменить раздел
                  <CaretDown size={12} weight="bold" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownContent align="end">
                {isArchivedSection ? (
                  <DropdownActionItem onSelect={() => onSectionAction("Восстановить из архива")}>Восстановить из архива</DropdownActionItem>
                ) : (
                  <>
                    {["Переименовать", "Поменять иконку", "Настроить доступность", "Переместить"].map((action) => (
                      <DropdownActionItem key={action} icon={action === "Переместить" ? ArrowsOutCardinal : undefined} onSelect={(event) => onSectionAction(action, action === "Переместить" ? getMovePopoverAnchor(event) : undefined)}>{action === "Переместить" ? "Переместить…" : action}</DropdownActionItem>
                    ))}
                  </>
                )}
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                {isArchivedSection ? (
                  <DropdownActionItem onSelect={() => onSectionAction("Удалить навсегда")} tone="danger">
                    Удалить навсегда
                  </DropdownActionItem>
                ) : (
                  <>
                    <DropdownActionItem onSelect={() => onSectionAction("Архивировать")} tone="danger">
                      Архивировать
                    </DropdownActionItem>
                    <DropdownActionItem onSelect={() => onSectionAction("Удалить раздел")} tone="danger">
                      Удалить раздел
                    </DropdownActionItem>
                  </>
                )}
              </DropdownContent>
            </DropdownMenu.Root>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="Ещё"
                  className="flex h-8 w-8 items-center justify-center rounded-[8px] border border-[#e7e5e4] bg-white text-[#79716b] transition hover:bg-[#fafaf9] hover:text-[#292524]"
                >
                  <DotsThreeVertical size={18} weight="bold" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownContent align="end">
                {isArchivedSection ? (
                  <DropdownActionItem onSelect={() => onSectionAction("Восстановить из архива")}>Восстановить из архива</DropdownActionItem>
                ) : (
                  <>
                    <DropdownActionItem onSelect={() => onSectionAction("Переименовать")}>Переименовать</DropdownActionItem>
                    <DropdownActionItem onSelect={() => onSectionAction("Поменять иконку")}>Поменять иконку</DropdownActionItem>
                    <DropdownActionItem onSelect={() => onSectionAction("Настроить доступность")}>Настроить доступность</DropdownActionItem>
                    <DropdownActionItem icon={ArrowsOutCardinal} onSelect={(event) => onSectionAction("Переместить", getMovePopoverAnchor(event))}>Переместить…</DropdownActionItem>
                  </>
                )}
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                {isArchivedSection ? (
                  <DropdownActionItem onSelect={() => onSectionAction("Удалить навсегда")} tone="danger">Удалить навсегда</DropdownActionItem>
                ) : (
                  <>
                    <DropdownActionItem onSelect={() => onSectionAction("Архивировать")} tone="danger">Архивировать</DropdownActionItem>
                    <DropdownActionItem onSelect={() => onSectionAction("Удалить раздел")} tone="danger">Удалить раздел</DropdownActionItem>
                  </>
                )}
              </DropdownContent>
            </DropdownMenu.Root>
          </div>
        </div>
        {selectedCount > 0 && (
          <SectionBulkToolbar
            count={selectedCount}
            checked={allSelected}
            indeterminate={!allSelected && someSelected}
            onSelectAll={onSelectAll}
            onClear={onClearSelection}
            onAction={onBulkAction}
          />
        )}
        {items.length === 0 ? (
          <div className="mt-4 rounded-[12px] border border-dashed border-[#e7e5e4] bg-[#fafaf9] p-6">
            <div className="flex flex-col gap-3">
              <p className="text-[16px] font-medium leading-[1.4] text-[#44403b]">В этом разделе пока нет позиций</p>
              <p className="text-[14px] leading-[1.4] text-[#79716b]">
                Добавьте первую позицию, чтобы она появилась на витрине.
              </p>
              <button
                type="button"
                onClick={() => onSectionAction("Добавить позицию")}
                className="mt-1 inline-flex h-8 self-start items-center gap-1.5 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]"
              >
                <Plus size={14} />
                Добавить позицию
              </button>
            </div>
          </div>
        ) : (
          <div className="mt-4 divide-y divide-[#f0efe9] overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white">
            {items.map((item) => (
              <SectionItemRow
                key={item.id}
                item={item}
                selected={selectedIds.has(item.id)}
                onSelectedChange={onSelectedChange}
                onOpen={() => onOpenItem(item.id)}
              />
            ))}
          </div>
        )}
        {feedback && (
          <div className="fixed bottom-5 left-1/2 z-[100003] -translate-x-1/2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">
            {feedback}
          </div>
        )}
      </div>
    </div>
  );
}

function SectionBulkToolbar({
  count,
  checked,
  indeterminate,
  flush = false,
  onSelectAll,
  onClear,
  onAction,
}: {
  count: number;
  checked: boolean;
  indeterminate: boolean;
  flush?: boolean;
  onSelectAll: (selected: boolean) => void;
  onClear: () => void;
  onAction: (action: string, anchor?: MovePopoverAnchor) => void;
}) {
  return (
    <div className={cn("flex h-8 w-fit items-center overflow-hidden rounded-[8px] border border-[#d8d5d0] bg-[#f7f6f2] shadow-[0_4px_14px_rgba(41,37,36,0.08)]", !flush && "mt-4")}>
      <TableCheckbox
        ariaLabel="Выбрать все позиции раздела"
        checked={checked}
        indeterminate={indeterminate}
        onChange={onSelectAll}
      />
      <button
        type="button"
        onClick={onClear}
        className="flex h-full items-center px-2.5 text-[13px] font-medium text-[#2563eb] transition hover:bg-white/70"
      >
        {count} {plural(count, "выбрана", "выбраны", "выбрано")}
      </button>
      <ToolbarDivider />
      <ToolbarDropdown label="Статус">
        <DropdownActionItem onSelect={() => onAction("В меню")}>В меню</DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction("В архив")} tone="danger">В архив</DropdownActionItem>
      </ToolbarDropdown>
      <ToolbarDivider />
      <ToolbarDropdown label="Доступность">
        <DropdownActionItem onSelect={() => onAction("Поставить на стоп")}>Поставить на стоп</DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction("Убрать со стопа")}>Убрать со стопа</DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction("Скоро будет")}>Скоро будет</DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction("По расписанию")}>По расписанию</DropdownActionItem>
      </ToolbarDropdown>
      <ToolbarDivider />
      <button
        type="button"
        onClick={(event) => onAction("Переместить в раздел", getMovePopoverAnchor(event))}
        className="flex h-full items-center gap-1.5 whitespace-nowrap px-2.5 text-[13px] font-medium text-[#57534d] transition hover:bg-white/70 hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      >
        <ArrowsOutCardinal size={14} />
        Переместить в раздел…
      </button>
      <ToolbarDivider />
      <ToolbarDropdown label="Скидка">
        <DropdownActionItem onSelect={() => onAction("Задать скидку")}>Задать скидку</DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction("Убрать скидку")}>Убрать скидку</DropdownActionItem>
      </ToolbarDropdown>
      <ToolbarDivider />
      <ToolbarDropdown label="Ещё">
        <DropdownActionItem onSelect={() => onAction("Добавить тег")}>Добавить тег</DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction("Дублировать")}>Дублировать</DropdownActionItem>
        <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
        <DropdownActionItem onSelect={() => onAction("Архивировать")} tone="danger">Архивировать</DropdownActionItem>
      </ToolbarDropdown>
      <ToolbarDivider />
      <button
        type="button"
        onClick={onClear}
        aria-label="Снять выбор"
        className="flex h-full w-8 items-center justify-center text-[17px] leading-none text-[#79716b] transition hover:bg-white/70 hover:text-[#292524]"
      >
        ×
      </button>
    </div>
  );
}

function orderItemsByStoredPositionOrder(items: CatalogItem[]) {
  const orders = readJsonRecord<Record<string, string[]>>(CATALOG_POSITION_ORDER_STORAGE_KEY, {});
  return orderItemsByPositionOrder(items, orders);
}

function SectionEditor({
  section,
  childSections,
  compositionItems,
  compositionQuery,
  scrollTop,
  activeTab,
  availabilityMode,
  outsideScheduleMode,
  weeklySchedule,
  onTabChange,
  onNameChange,
  onImageChange,
  onAvailabilityModeChange,
  onOutsideScheduleModeChange,
  onWeeklyScheduleChange,
  onAddPosition,
  onOpenInPositions,
  onSelectChildSection,
  onChildSectionAction,
  positionCreateDisabledReason,
  subsectionCreateDisabledReason,
  onCompositionQueryChange,
  onScrollTopChange,
  onArchive,
  onRestore,
  onAction,
  onItemAction,
  dropTarget,
  dragActiveRef,
  highlightItemId,
  showOpenInPositions = true,
  forcePositionsLabel = false,
  compositionCountOverride,
  allowPositionCreation = true,
  hideNavigationTabs = false,
}: {
  section: TreeSection;
  childSections: Array<{ section: TreeSection; itemCount: number }>;
  compositionItems: CatalogItem[];
  compositionQuery: string;
  scrollTop: number;
  activeTab: SectionEditorTab;
  availabilityMode: AvailabilityMode;
  outsideScheduleMode: OutsideScheduleMode;
  weeklySchedule: WeeklySchedule;
  onTabChange: (tab: SectionEditorTab) => void;
  onNameChange: (name: string) => void;
  onImageChange: (imageUrl: string | null) => void;
  onAvailabilityModeChange: (mode: AvailabilityMode) => void;
  onOutsideScheduleModeChange: (mode: OutsideScheduleMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  onAddPosition: () => void;
  onOpenInPositions: () => void;
  onSelectChildSection: (id: string) => void;
  onChildSectionAction: (section: TreeSection, action: string, anchor?: MovePopoverAnchor) => void;
  positionCreateDisabledReason?: string | null;
  subsectionCreateDisabledReason?: string | null;
  onCompositionQueryChange: (value: string) => void;
  onScrollTopChange: (value: number) => void;
  onArchive: () => void;
  onRestore: () => void;
  onAction: (action: string, anchor?: MovePopoverAnchor) => void;
  onItemAction: (item: CatalogItem, action: string, anchor?: MovePopoverAnchor) => void;
  dropTarget: CatalogDropTarget;
  dragActiveRef: RefObject<boolean>;
  highlightItemId?: string | null;
  showOpenInPositions?: boolean;
  forcePositionsLabel?: boolean;
  compositionCountOverride?: number;
  allowPositionCreation?: boolean;
  hideNavigationTabs?: boolean;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const archived = section.status === "archive";
  const status = getSectionStatusMeta(section);
  const hasChildSections = childSections.length > 0;
  const [selectedSubsectionIds, setSelectedSubsectionIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    setSelectedSubsectionIds((current) => {
      const availableIds = new Set(childSections.map(({ section: child }) => child.id));
      const next = new Set([...current].filter((id) => availableIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [childSections]);

  useEffect(() => {
    setSelectedSubsectionIds(new Set());
  }, [section.id]);

  const handleImageFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") onImageChange(reader.result);
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <input
        ref={imageInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleImageFile}
      />
      <div
        ref={scrollContainerRef}
        onScroll={(event) => onScrollTopChange(event.currentTarget.scrollTop)}
        className="min-w-0 flex-1 overflow-y-auto overflow-x-auto p-6 pt-0"
      >
        <div className="mx-auto w-full min-w-0 max-w-[800px]">
          <div className="flex items-center gap-2 pb-2 pt-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Tooltip label={section.imageUrl ? "Изменить иконку" : "Добавить иконку"} side="top">
                <button
                  type="button"
                  aria-label={section.imageUrl ? "Изменить иконку" : "Добавить иконку"}
                  onClick={() => imageInputRef.current?.click()}
                  className="group/section-icon relative flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-[#e6e6db] text-[#a8a29e] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/15 focus-visible:ring-offset-1"
                >
                  {section.imageUrl ? (
                    <img src={section.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageBroken size={14} />
                  )}
                  <span className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[#292524]/45 text-white opacity-0 transition-opacity duration-150 group-hover/section-icon:opacity-100 group-focus-visible/section-icon:opacity-100">
                    <PencilSimple size={12} weight="bold" />
                  </span>
                </button>
              </Tooltip>
              <h2 className="min-w-0 truncate text-[14px] font-medium leading-7 text-[#292524]">{section.name}</h2>
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    aria-label={`Действия с разделом «${section.name}»`}
                    className="flex h-7 w-6 shrink-0 items-center justify-center rounded-[7px] text-[#57534d] transition hover:bg-[#f1f1ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                  >
                    <CaretDown size={13} />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownContent align="start">
                  <SectionActionMenuContent
                    section={section}
                    allowPositionCreation={allowPositionCreation}
                    showSettingsEntry={hideNavigationTabs}
                    onAction={onAction}
                  />
                </DropdownContent>
              </DropdownMenu.Root>
              {getSectionTreeStatusLabel(section) && (
                <span className={cn("shrink-0 rounded-[5px] px-1.5 py-0.5 text-[11px] font-medium", status.className)}>{status.label}</span>
              )}
            </div>
            {allowPositionCreation && <CatalogActionButton
              onClick={onAddPosition}
              disabled={archived}
              disabledReason={archived ? "Архивный раздел нельзя изменять" : positionCreateDisabledReason}
              ariaLabel="Добавить позицию"
              dataPositionCreateButton
            >
              Добавить позицию
            </CatalogActionButton>}
          </div>
          <div>
            <div data-editor-tabs>
              {hideNavigationTabs ? activeTab === "composition" ? null : (
                <div className="flex h-9 items-center border-b border-[#e7e5e4]">
                  <button type="button" onClick={() => onTabChange("composition")} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"><ArrowLeft size={14} /> К позициям</button>
                </div>
              ) : (
                <WorkspaceLocalTabs
                  tabs={[
                    {
                      id: "composition",
                      label: forcePositionsLabel ? "Позиции" : hasChildSections ? "Подразделы" : "Позиции",
                      count: compositionCountOverride ?? (hasChildSections ? childSections.length : compositionItems.length),
                    },
                    { id: "basic", label: "Настройка раздела" },
                    { id: "availability", label: "Доступность" },
                  ]}
                  value={activeTab}
                  onValueChange={onTabChange}
                  endAction={showOpenInPositions ? (
                    <button
                    type="button"
                    onClick={onOpenInPositions}
                    className="inline-flex h-8 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] px-2 text-[12px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#44403b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                  >
                    <ArrowsOut size={14} weight="regular" />
                    Открыть в таблице
                    </button>
                  ) : undefined}
                />
              )}
              <div className="pt-3">
            {activeTab === "composition" ? (
            hasChildSections ? (
              <section className="overflow-hidden rounded-[13px] border border-[#e7e5e4] bg-white px-3 py-1 shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
                <SubsectionList
                  parentSectionId={section.id}
                  childSections={childSections}
                  dropTarget={dropTarget}
                  dragActiveRef={dragActiveRef}
                  selectedIds={selectedSubsectionIds}
                  onSelectedChange={(id, selected) => setSelectedSubsectionIds((current) => {
                    const next = new Set(current);
                    if (selected) next.add(id);
                    else next.delete(id);
                    return next;
                  })}
                  onSelectAll={(selected) => setSelectedSubsectionIds(
                    selected ? new Set(childSections.map(({ section: child }) => child.id)) : new Set(),
                  )}
                  onClearSelection={() => setSelectedSubsectionIds(new Set())}
                  headerAction={(
                    <Tooltip label={subsectionCreateDisabledReason ?? ""} side="top" disabled={!subsectionCreateDisabledReason}>
                      <span data-no-dnd>
                        <button
                          type="button"
                          disabled={Boolean(subsectionCreateDisabledReason)}
                          onClick={() => onAction("Добавить подраздел")}
                          className="inline-flex h-7 items-center gap-1 rounded-[7px] px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4] hover:text-[#292524] disabled:cursor-not-allowed disabled:text-[#a8a29e]"
                        >
                          <Plus size={13} />
                          Добавить подраздел
                        </button>
                      </span>
                    </Tooltip>
                  )}
                  onSelect={onSelectChildSection}
                  onAction={onChildSectionAction}
                  renderActions={(subsection, onAction) => (
                    <SectionActionMenuContent section={subsection} onAction={onAction} />
                  )}
                />
              </section>
            ) : (
              <section className="overflow-hidden rounded-[13px] border border-[#e7e5e4] bg-white px-3 pb-3 shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
                {compositionItems.length === 0 && !compositionQuery.trim() ? (
                  <div className="py-1">
                    <div className="rounded-[10px] border border-dashed border-[#e7e5e4] bg-[#fafaf9] px-4 py-5">
                      <p className="text-[13px] font-medium text-[#44403b]">В этом разделе пока нет позиций</p>
                      <p className="mt-1 text-[12px] leading-4 text-[#79716b]">Создайте новую позицию — она откроется здесь в полном редакторе и будет привязана к этому разделу.</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <CatalogActionButton
                          onClick={onAddPosition}
                          disabledReason={positionCreateDisabledReason}
                          ariaLabel="Добавить позицию"
                          dataPositionCreateButton
                        >
                          Добавить позицию
                        </CatalogActionButton>
                        {childSections.length === 0 && (
                          <Tooltip label={subsectionCreateDisabledReason ?? ""} side="top" disabled={!subsectionCreateDisabledReason}>
                            <span>
                              <button
                                type="button"
                                disabled={Boolean(subsectionCreateDisabledReason)}
                                onClick={() => onAction("Добавить подраздел")}
                                className="inline-flex h-8 items-center rounded-[8px] border border-[#e7e5e4] bg-white px-3 text-[12px] font-medium text-[#57534d] transition hover:bg-[#fafaf9] hover:text-[#292524] disabled:cursor-not-allowed disabled:text-[#a8a29e]"
                              >
                                Добавить подраздел
                              </button>
                            </span>
                          </Tooltip>
                        )}
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="sticky top-0 z-10 flex min-h-9 items-center gap-2 border-b border-[#e7e5e4] bg-white pb-2 pt-2">
                      <div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-[7px] border border-[#e7e5e4] px-[7px]">
                        <MagnifyingGlass size={14} className="shrink-0 text-[#a6a09b]" />
                        <input
                          value={compositionQuery}
                          onChange={(event) => onCompositionQueryChange(event.target.value)}
                          placeholder="Найти позицию в разделе..."
                          className="min-w-0 flex-1 bg-transparent text-[13px] leading-4 text-[#292524] outline-none placeholder:text-[#79716b]"
                        />
                      </div>
                    </div>
                    <div className="pt-2">
                      {compositionItems.length > 0 ? (
                        <SectionCompositionList
                          sectionId={section.id}
                          items={compositionItems}
                          onItemAction={onItemAction}
                          reorderEnabled={!compositionQuery.trim()}
                          highlightItemId={highlightItemId}
                          dropTarget={dropTarget}
                          dragActiveRef={dragActiveRef}
                        />
                      ) : (
                        <div className="py-8 text-center text-[13px] leading-5 text-[#79716b]">
                          По поиску ничего не найдено
                        </div>
                      )}
                    </div>
                  </>
                )}
              </section>
            )
            ) : activeTab === "basic" ? (
            <section className="overflow-hidden rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
              <div className="divide-y divide-[#f0efe9]">
                <label className="grid gap-3 px-4 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <span className="text-[13px] font-medium text-[#44403b]">Название</span>
                  <input
                    value={section.name}
                    onChange={(event) => onNameChange(event.target.value)}
                    className="h-9 w-full rounded-[9px] border border-[#e7e5e4] bg-white px-3 text-[13px] text-[#292524] shadow-[0_1px_2px_rgba(12,12,13,0.04)] outline-none transition focus:border-[#a8a29e] focus:ring-2 focus:ring-[#292524]/5"
                  />
                </label>

                <div className="grid gap-3 px-4 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <div className="text-[13px] font-medium text-[#44403b]">Иконка раздела</div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#f1f1ea] text-[#a8a29e]">
                      {section.imageUrl ? <img src={section.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageBroken size={18} />}
                    </span>
                    <button
                      type="button"
                      onClick={() => imageInputRef.current?.click()}
                      className="inline-flex h-8 items-center rounded-[8px] border border-[#e7e5e4] bg-white px-3 text-[13px] font-medium text-[#57534d] transition hover:bg-[#fafaf9] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                    >
                      {section.imageUrl ? "Заменить" : "Добавить"}
                    </button>
                  </div>
                </div>

                <div className="grid gap-3 px-4 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <div>
                    <div className="text-[13px] font-medium text-[#9f3a31]">Опасная зона</div>
                    <div className="mt-0.5 text-[12px] leading-4 text-[#a8a29e]">Архивирование и удаление раздела</div>
                  </div>
                <div>
                  <div className="text-[12px] leading-5 text-[#79716b]">
                    {archived ? "Раздел находится в архиве и не показывается гостям." : "Архивный раздел не показывается гостям и остается доступен для восстановления."}
                  </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <button type="button" onClick={archived ? onRestore : onArchive} className={cn("h-8 rounded-[8px] border px-3 text-[12px] font-medium transition", archived ? "border-[#d8d5d0] text-[#57534d] hover:bg-[#f5f5f4]" : "border-[#e7c6c2] text-[#9f3a31] hover:bg-[#fff7f6]")}>
                        {archived ? "Восстановить раздел" : "Архивировать раздел"}
                      </button>
                      <button type="button" onClick={() => onAction(archived ? "Удалить навсегда" : "Удалить раздел")} className="h-8 rounded-[8px] border border-[#e7c6c2] px-3 text-[12px] font-medium text-[#9f3a31] transition hover:bg-[#fff7f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f3a31]/20">
                        {archived ? "Удалить навсегда" : "Удалить раздел"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </section>
            ) : (
            <section className="p-0">
              <SectionAvailabilityTab
                sectionId={section.id}
                mode={availabilityMode}
                outsideScheduleMode={outsideScheduleMode}
                weeklySchedule={weeklySchedule}
                onModeChange={onAvailabilityModeChange}
                onOutsideScheduleModeChange={onOutsideScheduleModeChange}
                onWeeklyScheduleChange={onWeeklyScheduleChange}
              />
            </section>
            )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function UnifiedCatalogSelectionState() {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center p-8">
      <div className="max-w-[320px] text-center">
        <h2 className="text-[14px] font-semibold text-[#292524]">Выберите позицию</h2>
        <p className="mt-1 text-[13px] leading-5 text-[#79716b]">Раскройте раздел слева и откройте позицию для редактирования.</p>
      </div>
    </div>
  );
}

function UnifiedSectionTableHeader({
  section,
  itemCount,
  onAction,
  allowPositionCreation = true,
}: {
  section: TreeSection;
  itemCount: number;
  onAction: (action: string, anchor?: MovePopoverAnchor) => void;
  allowPositionCreation?: boolean;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label={`Действия с разделом «${section.name}»`}
          className="group flex min-w-0 items-center gap-1.5 rounded-[8px] text-left transition hover:bg-[#f1f1ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#e6e6db] text-[#a8a29e]">
            {section.imageUrl ? <img src={section.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageBroken size={13} />}
          </span>
          <span className="min-w-0 truncate text-[14px] font-medium leading-5 text-[#292524]">{section.name}</span>
          <span className="flex h-[17px] min-w-6 shrink-0 items-center justify-center rounded-[5px] bg-[#f3f3ed] px-1 text-[12px] font-medium leading-4 tabular-nums text-[#79716b]">
            {itemCount}
          </span>
          <CaretDown size={14} className="shrink-0 text-[#57534d]" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent align="start">
        <SectionActionMenuContent
          section={section}
          allowPositionCreation={allowPositionCreation}
          showSettingsEntry
          onAction={onAction}
        />
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

function SectionPositionNav({
  sectionId,
  sectionName,
  sections,
  allItems,
  items,
  archiveOpen,
  selectedItemId,
  onBackToSections,
  onSelectSection,
  onSelectItem,
  onAddPosition,
  onSectionAction,
  onArchiveOpenChange,
  onRestoreItem,
  onToggleStop,
  onReorderItems,
  stopBusyIds,
}: {
  sectionId: string | null;
  sectionName: string;
  sections: TreeSection[];
  allItems: CatalogItem[];
  items: CatalogItem[];
  archiveOpen: boolean;
  selectedItemId: string | null;
  onBackToSections: () => void;
  onSelectSection: (id: string) => void;
  onSelectItem: (id: string) => void;
  onAddPosition: () => void;
  onOpenOverview: () => void;
  onSectionAction: (action: string, anchor?: MovePopoverAnchor) => void;
  onArchiveOpenChange: (open: boolean) => void;
  onRestoreItem: (item: CatalogItem) => void;
  onToggleStop: (item: CatalogItem) => void;
  onReorderItems: (draggedId: string, targetId: string) => void;
  stopBusyIds: Set<string>;
}) {
  const [sectionQuery, setSectionQuery] = useState("");
  const [positionQuery, setPositionQuery] = useState("");
  const [draggedItemId, setDraggedItemId] = useState<string | null>(null);
  const [dragOverItemId, setDragOverItemId] = useState<string | null>(null);
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const visibleSections = filterSectionTree(sections, sectionQuery);
  const flatSections = flattenSections(sections);
  const activeSection = flatSections.find((section) => section.id === sectionId) ?? null;
  const activeItems = items.filter((item) => item.status !== "archive");
  const archivedItems = items.filter((item) => item.status === "archive");
  const normalizedPositionQuery = positionQuery.trim().toLowerCase();
  const visibleActiveItems = activeItems.filter((item) => item.title.toLowerCase().includes(normalizedPositionQuery));
  const visibleArchivedItems = archivedItems.filter((item) => item.title.toLowerCase().includes(normalizedPositionQuery));

  useEffect(() => {
    if (!selectedItemId) return;
    const timeout = window.setTimeout(() => {
      selectedRowRef.current?.scrollIntoView({ block: "nearest" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [archiveOpen, selectedItemId, activeItems.length, archivedItems.length]);

  const renderPositionRow = (item: CatalogItem, archived = false) => {
    const active = item.id === selectedItemId;
    const stopped = item.status === "stopped";
    const canToggleStop = !archived && (item.status === "active" || item.status === "stopped");
    const stopBusy = stopBusyIds.has(item.id);
    const stopActionLabel = stopped ? "Вернуть в продажу" : "Поставить на стоп";
    const isDragTarget = !archived && dragOverItemId === item.id && draggedItemId !== item.id;
    return (
      <div
        key={item.id}
        onDragOver={(event) => {
          if (archived || !draggedItemId || draggedItemId === item.id) return;
          event.preventDefault();
          event.dataTransfer.dropEffect = "move";
          setDragOverItemId(item.id);
        }}
        onDrop={(event) => {
          event.preventDefault();
          if (draggedItemId && draggedItemId !== item.id) onReorderItems(draggedItemId, item.id);
          setDraggedItemId(null);
          setDragOverItemId(null);
        }}
        className={cn(
          "group relative flex h-8 w-full items-center rounded-[8px] border text-left transition",
          active
            ? "border-[#e7e5e4] bg-white shadow-[0_2px_6px_rgba(41,37,36,0.13)]"
            : "border-transparent hover:bg-[#f7f6f2]",
          isDragTarget && "border-[#c7c2ff] bg-[#f5f3ff]",
        )}
      >
        {!archived && (
          <span
            draggable
            role="button"
            tabIndex={0}
            aria-label={`Изменить порядок позиции ${item.title}`}
            onDragStart={(event) => {
              event.dataTransfer.effectAllowed = "move";
              event.dataTransfer.setData("text/plain", item.id);
              setDraggedItemId(item.id);
            }}
            onDragEnd={() => {
              setDraggedItemId(null);
              setDragOverItemId(null);
            }}
            className="flex h-full w-5 shrink-0 cursor-grab items-center justify-center text-[#a8a29e] opacity-0 transition hover:text-[#57534d] group-hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none active:cursor-grabbing"
          >
            <DotsSixVertical size={13} />
          </span>
        )}
        <button
          ref={active ? selectedRowRef : undefined}
          type="button"
          onClick={() => onSelectItem(item.id)}
          className={cn(
            "flex h-full min-w-0 flex-1 items-center gap-2 rounded-[8px] pr-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
            archived && "pl-1.5",
          )}
        >
        <span
          className={cn(
            "flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#e9e9df]",
            active && "border border-[#6d5dfc] bg-white p-[2px]",
          )}
        >
          {item.thumbnailUrl ? (
            <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full rounded-[4px] object-cover" />
          ) : (
            <span className="h-full w-full rounded-[6px] bg-[#e9e9df]" />
          )}
        </span>
        <span
          className={cn(
            "min-w-0 flex-1 truncate text-[13px] leading-5",
            active ? "font-semibold text-[#292524]" : archived ? "font-medium text-[#8a8179]" : "font-medium text-[#79716b]",
          )}
        >
          {item.title}
        </span>
        {stopped && (
          <span className="relative flex h-6 w-9 shrink-0 items-center justify-end">
            <span
              title="Временно недоступно"
              className="inline-flex h-5 items-center rounded-[5px] bg-[#f1f1ea] px-1.5 text-[10px] font-medium leading-4 text-[#79716b] transition group-hover:opacity-0 group-focus-within:opacity-0"
            >
              Стоп
            </span>
            <Tooltip label={stopActionLabel} side="top" delayDuration={200}>
              <button
                type="button"
                aria-label={stopActionLabel}
                disabled={stopBusy}
                onClick={(event) => {
                  event.stopPropagation();
                  onToggleStop(item);
                }}
                className="absolute right-0 flex h-6 w-6 items-center justify-center rounded-[7px] text-[#79716b] opacity-0 transition hover:bg-[#efefeb] hover:text-[#292524] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:pointer-events-none disabled:opacity-50 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                {stopBusy ? <span className="h-3 w-3 animate-spin rounded-full border border-[#a8a29e] border-t-transparent" /> : <ArrowCounterClockwise size={13} />}
              </button>
            </Tooltip>
          </span>
        )}
        {canToggleStop && !stopped && (
          <Tooltip label={stopActionLabel} side="top" delayDuration={200}>
            <button
              type="button"
              aria-label={stopActionLabel}
              disabled={stopBusy}
              onClick={(event) => {
                event.stopPropagation();
                onToggleStop(item);
              }}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] opacity-0 transition hover:bg-[#efefeb] hover:text-[#292524] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:pointer-events-none disabled:opacity-50 group-hover:opacity-100 group-focus-within:opacity-100"
            >
              {stopBusy ? <span className="h-3 w-3 animate-spin rounded-full border border-[#a8a29e] border-t-transparent" /> : <Prohibit size={13} />}
            </button>
          </Tooltip>
        )}
        {archived && (
          <span title="В архиве" className="relative flex h-6 w-6 shrink-0 items-center justify-end">
            <Archive
              size={14}
              className="text-[#a8a29e] transition group-hover:opacity-0 group-focus-within:opacity-0"
            />
            <Tooltip label="Восстановить из архива" side="top" delayDuration={200}>
              <button
                type="button"
                aria-label="Восстановить из архива"
                onClick={(event) => {
                  event.stopPropagation();
                  onRestoreItem(item);
                }}
                className="absolute right-0 flex h-6 w-6 items-center justify-center rounded-[7px] text-[#79716b] opacity-0 transition hover:bg-[#efefeb] hover:text-[#292524] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 group-hover:opacity-100 group-focus-within:opacity-100"
              >
                <ArrowCounterClockwise size={13} />
              </button>
            </Tooltip>
          </span>
        )}
        </button>
      </div>
    );
  };

  const renderSectionOption = (section: TreeSection, depth = 0): ReactNode => {
    const active = section.id === sectionId;
    const count = allItems.filter((item) => item.sectionId === section.id && item.status !== "archive").length;
    return (
      <div key={section.id}>
        <DropdownMenu.Item
          onSelect={() => onSelectSection(section.id)}
          className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg pr-2 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
          style={{ paddingLeft: 8 + depth * 16 }}
        >
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#a8a29e]">
            {section.children?.length ? <CaretRight size={12} /> : null}
          </span>
          <span className={cn("min-w-0 flex-1 truncate", active && "font-semibold text-[#292524]")}>{section.name}</span>
          <span className="shrink-0 text-[12px] text-[#a8a29e]">{count}</span>
          <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[12px] text-[#2563eb]">{active ? "✓" : ""}</span>
        </DropdownMenu.Item>
        {section.children?.map((child) => renderSectionOption(child, depth + 1))}
      </div>
    );
  };

  return (
    <aside className="flex w-[250px] shrink-0 flex-col overflow-hidden border-r border-[#e7e5e4] bg-[#fbfbf9]">
      <div className="shrink-0 border-b border-[#e7e5e4] px-4 pb-4 pt-4">
        <button
          type="button"
          onClick={onBackToSections}
          className="mb-3 flex h-8 w-full items-center gap-2 rounded-[8px] px-1 text-left text-[13px] font-normal leading-5 text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524]"
        >
          <ArrowLeft size={14} />
          Всё меню
        </button>
        <div className="flex items-center gap-1">
          <DropdownMenu.Root onOpenChange={(open) => !open && setSectionQuery("")}>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[10px] bg-[#f6f6f1] px-2 text-left text-[#292524] transition hover:bg-[#efefe8]"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-white text-[12px] shadow-[0_1px_2px_rgba(0,0,0,0.08)]">
                  {activeSection?.imageUrl ? (
                    <img src={activeSection.imageUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ForkKnife size={12} weight="fill" className="text-[#57534d]" />
                  )}
                </span>
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold leading-5">{sectionName}</span>
                <CaretDown size={14} weight="bold" className="shrink-0 text-black" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={6}
                className="z-[100002] w-[300px] rounded-[12px] border border-[#e7e5e4] bg-white p-2 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
              >
                <label className="mb-2 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-white px-2 text-[#a8a29e] focus-within:border-[#a8a29e]">
                  <MagnifyingGlass size={14} />
                  <input
                    value={sectionQuery}
                    onChange={(event) => setSectionQuery(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder="Найти раздел"
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
                  />
                </label>
                <div className="max-h-[360px] overflow-y-auto overscroll-contain">
                  {visibleSections.map((section) => renderSectionOption(section))}
                  {visibleSections.length === 0 && (
                    <div className="px-2 py-3 text-[13px] text-[#79716b]">Разделы не найдены</div>
                  )}
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label={`Действия с разделом ${sectionName}`}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#efefe8] hover:text-[#292524]"
              >
                <DotsThreeVertical size={17} weight="bold" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownContent align="end">
              {activeSection ? (
                <SectionActionMenuContent
                  section={activeSection}
                  onAction={(action, anchor) => {
                    if (action === "Добавить позицию") onAddPosition();
                    else onSectionAction(action, anchor);
                  }}
                />
              ) : null}
            </DropdownContent>
          </DropdownMenu.Root>
        </div>
        <button
          type="button"
          onClick={onAddPosition}
          className="mt-3 flex h-8 min-w-0 items-center gap-2 rounded-[8px] px-1 text-left text-[13px] font-normal leading-5 text-[#44403b] transition hover:bg-[#f1f1ea] hover:text-[#292524]"
        >
          <PlusCircle size={16} />
          Добавить позицию
        </button>
        <label className="mt-2 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-white px-2 text-[#a8a29e] focus-within:border-[#a8a29e]">
          <MagnifyingGlass size={14} />
          <input
            value={positionQuery}
            onChange={(event) => setPositionQuery(event.target.value)}
            placeholder="Найти позицию"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
          />
          {positionQuery && (
            <button
              type="button"
              onClick={() => setPositionQuery("")}
              aria-label="Очистить поиск позиций"
              className="flex h-5 w-5 items-center justify-center rounded-[6px] text-[#a8a29e] hover:bg-[#f5f5f4] hover:text-[#57534d]"
            >
              <XCircle size={13} />
            </button>
          )}
        </label>
      </div>
      <div
        ref={listScrollRef}
        onDragOver={(event) => {
          if (!draggedItemId || !listScrollRef.current) return;
          const bounds = listScrollRef.current.getBoundingClientRect();
          const edge = 40;
          if (event.clientY < bounds.top + edge) listScrollRef.current.scrollTop -= 10;
          else if (event.clientY > bounds.bottom - edge) listScrollRef.current.scrollTop += 10;
        }}
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-4 pt-3"
      >
        {visibleActiveItems.length === 0 && visibleArchivedItems.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#e7e5e4] bg-white/60 px-3 py-4 text-[13px] leading-5 text-[#79716b]">
            {normalizedPositionQuery ? "Подходящие позиции не найдены" : "В разделе пока нет позиций"}
          </div>
        ) : (
          <div className="space-y-1.5">
            {visibleActiveItems.map((item) => renderPositionRow(item))}
            {visibleArchivedItems.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onArchiveOpenChange(!archiveOpen)}
                  className="flex h-7 w-full items-center rounded-[8px] px-1.5 text-left text-[12px] font-medium leading-5 text-[#a8a29e] transition hover:bg-[#f7f6f2] hover:text-[#79716b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <span className="min-w-0 flex-1 truncate">Архивные · {visibleArchivedItems.length}</span>
                  <CaretRight size={13} className={cn("shrink-0 transition", archiveOpen && "rotate-90")} />
                </button>
                {archiveOpen && (
                  <div className="mt-1.5 space-y-1.5">
                    {visibleArchivedItems.map((item) => renderPositionRow(item, true))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

let draftSeq = 0;
function makeDraftItem(section: { id: string; name: string } | null): CatalogItem {
  draftSeq += 1;
  return {
    id: `draft-${Date.now()}-${draftSeq}`,
    title: "",
    sectionId: section?.id ?? "no-section",
    sectionName: section?.name ?? "Без раздела",
    thumbnailUrl: null,
    price: 0,
    priceWithSale: null,
    status: "active",
    scheduled: false,
    guestLabels: [],
    tags: [],
    optionsCount: 0,
    modifiersCount: 0,
    recommendationsCount: 0,
    displayMode: "full",
    description: "",
    hasDescription: false,
    weightLabel: null,
    nutritionFilledCount: 0,
    translationFilledCount: 0,
    translationTotalCount: 2,
    hasDiscount: false,
  };
}

type StructurePositionDraft = {
  item: CatalogItem;
  targetSectionId: string;
  returnSectionId: string | null;
  returnItemId: string | null;
  returnEditing: boolean;
};

function CreatePositionDialog({
  sections,
  initialSectionId,
  onCancel,
  onContinue,
}: {
  sections: TreeSection[];
  initialSectionId: string | null;
  onCancel: () => void;
  onContinue: (title: string, sectionId: string) => void;
}) {
  const leafSections = sections.filter((section) => section.status !== "archive" && !sections.some((candidate) => candidate.parentId === section.id));
  const [title, setTitle] = useState("");
  const [sectionId, setSectionId] = useState(initialSectionId ?? leafSections[0]?.id ?? "");
  const selectedSection = leafSections.find((section) => section.id === sectionId);
  useEffect(() => {
    if (!selectedSection && leafSections[0]) setSectionId(leafSections[0].id);
  }, [leafSections, selectedSection]);
  return createPortal(
    <div className="fixed inset-0 z-[100004] flex items-start justify-center bg-black/20 px-4 pt-[18vh]" role="dialog" aria-modal="true" aria-label="Новая позиция">
      <div className="w-full max-w-[360px] overflow-hidden rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_18px_42px_rgba(41,37,36,0.16)]">
        <div className="border-b border-[#eceae7] px-4 py-3"><h2 className="text-[14px] font-medium text-[#292524]">Новая позиция</h2></div>
        <div className="space-y-3 px-4 py-4">
          <label className="block"><span className="mb-1 block text-[12px] font-medium text-[#57534d]">Название</span><input autoFocus value={title} onChange={(event) => setTitle(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && title.trim() && selectedSection) onContinue(title, selectedSection.id); }} className="h-8 w-full rounded-[8px] border border-[#e7e5e4] px-2.5 text-[13px] text-[#292524] outline-none focus:border-[#a8a09b]" /></label>
          <label className="block"><span className="mb-1 block text-[12px] font-medium text-[#57534d]">Раздел</span><select value={sectionId} onChange={(event) => setSectionId(event.target.value)} className="h-8 w-full rounded-[8px] border border-[#e7e5e4] bg-white px-2.5 text-[13px] text-[#292524] outline-none focus:border-[#a8a09b]"><option value="" disabled>Выберите раздел</option>{leafSections.map((section) => <option key={section.id} value={section.id}>{section.name}</option>)}</select></label>
        </div>
        <div className="flex justify-end gap-2 border-t border-[#eceae7] px-4 py-3"><button type="button" onClick={onCancel} className="h-7 rounded-[8px] px-2.5 text-[12px] text-[#79716b] hover:bg-[#f5f5f4]">Отмена</button><button type="button" disabled={!title.trim() || !selectedSection} onClick={() => selectedSection && onContinue(title, selectedSection.id)} className="h-7 rounded-[8px] bg-[#292524] px-3 text-[12px] font-medium text-white disabled:cursor-not-allowed disabled:bg-[#d6d3d1]">Создать</button></div>
      </div>
    </div>,
    document.body,
  );
}

function getLinkedEntitiesCount(item: CatalogItem) {
  return item.recommendationsCount + item.optionsCount + item.modifiersCount;
}

function PermanentDeleteDialog({
  item,
  onCancel,
  onConfirm,
}: {
  item: CatalogItem;
  onCancel: () => void;
  onConfirm: (item: CatalogItem) => void;
}) {
  const linkedCount = getLinkedEntitiesCount(item);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel]);

  return createPortal(
    <div className="fixed inset-0 z-[100003] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="permanent-delete-title"
        className="w-full max-w-[380px] rounded-[16px] border border-[#e7e5e4] bg-white p-5 shadow-[0_24px_80px_rgba(41,37,36,0.22)]"
      >
        <h2 id="permanent-delete-title" className="text-[16px] font-semibold leading-6 text-[#292524]">
          Удалить позицию навсегда?
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-[#79716b]">
          Позицию нельзя будет восстановить. Она будет удалена из архива, рекомендаций и связанных настроек.
        </p>
        {linkedCount > 0 && (
          <p className="mt-2 text-[13px] leading-5 text-[#79716b]">
            Связанные настройки: {linkedCount}. Они будут очищены вместе с позицией.
          </p>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-[9px] px-3 text-[13px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={() => onConfirm(item)}
            className="h-8 rounded-[9px] bg-[#9f1239] px-3 text-[13px] font-medium text-white transition hover:bg-[#881337] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f1239]/20"
          >
            Удалить навсегда
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function CreateDiscardDialog({
  onContinue,
  onDiscard,
}: {
  onContinue: () => void;
  onDiscard: () => void;
}) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(
    typeof document !== "undefined" && document.activeElement instanceof HTMLElement ? document.activeElement : null,
  );

  useEffect(() => {
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.querySelector<HTMLElement>("[data-create-discard-continue]")?.focus();
    }, 0);
    return () => {
      window.clearTimeout(focusTimer);
      window.setTimeout(() => {
        const target = returnFocusRef.current;
        if (target?.isConnected) target.focus();
      }, 0);
    };
  }, []);

  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onContinue();
      return;
    }
    if (event.key !== "Tab") return;
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex='-1'])",
    );
    if (!focusable?.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget) onContinue();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-discard-title"
        aria-describedby="create-discard-description"
        onKeyDown={handleDialogKeyDown}
        onClick={(event) => event.stopPropagation()}
        className="w-[calc(100vw-32px)] max-w-[520px] rounded-[16px] border border-[#e7e5e4] bg-white p-5 shadow-[0_24px_80px_rgba(41,37,36,0.22)] outline-none"
      >
        <h2 id="create-discard-title" className="text-[16px] font-semibold leading-6 text-[#292524]">
          Выйти без сохранения?
        </h2>
        <p id="create-discard-description" className="mt-2 text-[13px] leading-5 text-[#79716b]">
          Изменения в новой позиции будут потеряны.
        </p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onDiscard}
            className="h-9 w-full whitespace-nowrap rounded-[10px] border-[#e7c6c2] bg-white px-3.5 text-[14px] font-medium text-[#9f3a31] hover:border-[#d7aaa4] hover:bg-[#fff7f6] hover:text-[#8f2f28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f3a31]/20 sm:w-auto"
          >
            Выйти без сохранения
          </Button>
          <Button
            type="button"
            variant="default"
            size="sm"
            data-create-discard-continue
            autoFocus
            onClick={onContinue}
            className="h-9 w-full min-w-0 whitespace-nowrap rounded-[10px] bg-indigo-600 px-3.5 text-[14px] font-medium text-white hover:bg-indigo-700 active:bg-indigo-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600/25 sm:w-auto"
          >
            Продолжить редактирование
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

type SectionDeleteDialogState = {
  section: TreeSection;
  archived: boolean;
  summary: SectionDeleteSummary;
};

function SectionDeleteDialog({
  state,
  onCancel,
  onArchive,
  onConfirm,
}: {
  state: SectionDeleteDialogState;
  onCancel: () => void;
  onArchive: (section: TreeSection) => void | Promise<void>;
  onConfirm: (section: TreeSection) => void | Promise<void>;
}) {
  const [pendingAction, setPendingAction] = useState<"archive" | "delete" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [failedAction, setFailedAction] = useState<"archive" | "delete" | null>(null);
  const dialogRef = useRef<HTMLDivElement | null>(null);
  const hasContents = state.summary.positionCount > 0 || state.summary.subsectionCount > 0;
  const title = state.archived
    ? `Удалить раздел «${state.section.name}» навсегда?`
    : `Удалить раздел «${state.section.name}»?`;
  const description = hasContents
    ? `В разделе и его подразделах ${state.summary.positionCount} ${plural(state.summary.positionCount, "позиция", "позиции", "позиций")} и ${state.summary.subsectionCount} ${plural(state.summary.subsectionCount, "подраздел", "подраздела", "подразделов")}. После удаления восстановить их будет нельзя.`
    : "Восстановить раздел после удаления не получится.";

  const runAction = async (action: "archive" | "delete") => {
    if (pendingAction) return;
    setPendingAction(action);
    setError(null);
    setFailedAction(null);
    try {
      await Promise.resolve(action === "archive" ? onArchive(state.section) : onConfirm(state.section));
    } catch (cause) {
      setFailedAction(action);
      setError(cause instanceof Error ? cause.message : "Не удалось выполнить действие. Попробуйте ещё раз.");
    } finally {
      setPendingAction(null);
    }
  };

  useEffect(() => {
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !pendingAction) onCancel();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onCancel, pendingAction]);

  return createPortal(
    <div
      className="fixed inset-0 z-[100003] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]"
      onClick={(event) => {
        if (event.target === event.currentTarget && !pendingAction) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="section-delete-title"
        tabIndex={-1}
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-[560px] rounded-[16px] border border-[#e7e5e4] bg-white p-5 shadow-[0_24px_80px_rgba(41,37,36,0.22)] outline-none"
      >
        <h2 id="section-delete-title" className="text-[16px] font-semibold leading-6 text-[#292524]">
          {title}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-[#79716b]">
          {description}
        </p>
        {hasContents && !state.archived && (
          <div className="mt-4 rounded-[10px] border border-[#e7e5e4] bg-[#fafaf9] px-3 py-2.5 text-[12px] leading-5 text-[#57534d]">
            Безопаснее сначала архивировать раздел: содержимое останется доступно для восстановления.
          </div>
        )}
        {error && (
          <div className="mt-3 flex items-center justify-between gap-3 text-[12px] leading-5 text-[#9f3a31]">
            <p role="alert">{error}</p>
            {failedAction && (
              <button
                type="button"
                onClick={() => void runAction(failedAction)}
                className="shrink-0 rounded-[7px] px-2 py-1 font-medium text-[#9f3a31] transition hover:bg-[#fff7f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f3a31]/20"
              >
                Повторить
              </button>
            )}
          </div>
        )}
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={Boolean(pendingAction)}
            className="h-9 rounded-[9px] px-3 text-[13px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Отмена
          </button>
          {hasContents && !state.archived && (
            <button
              type="button"
              onClick={() => void runAction("archive")}
              disabled={Boolean(pendingAction)}
              className="h-9 rounded-[9px] border border-[#d8d5d0] bg-white px-3 text-[13px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {pendingAction === "archive" ? "Архивирование…" : "Архивировать"}
            </button>
          )}
          <button
            type="button"
            onClick={() => void runAction("delete")}
            disabled={Boolean(pendingAction)}
            className="h-9 rounded-[9px] bg-[#9f1239] px-3 text-[13px] font-medium text-white transition hover:bg-[#881337] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f1239]/20 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pendingAction === "delete" ? "Удаление…" : state.archived || hasContents ? "Удалить навсегда" : "Удалить"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

function readSectionEditorTab() {
  const tab = readJsonRecord<SectionEditorTab>(CATALOG_SECTION_EDITOR_TAB_STORAGE_KEY, "composition");
  return tab === "composition" || tab === "basic" || tab === "availability" ? tab : "composition";
}

function readSectionPriceSort() {
  const sort = readJsonRecord<PriceSortDirection>(CATALOG_SECTION_TABLE_PRICE_SORT_STORAGE_KEY, "none");
  return sort === "asc" || sort === "desc" || sort === "none" ? sort : "none";
}

function normalizeRecentPositionIds(value: unknown, items: CatalogItem[]) {
  if (!Array.isArray(value)) return [];
  const validIds = new Set(items.map((item) => item.id));
  const result: string[] = [];
  value.forEach((id) => {
    if (typeof id !== "string" || !validIds.has(id) || result.includes(id)) return;
    result.push(id);
  });
  return result.slice(0, CATALOG_RECENT_POSITION_LIMIT);
}

function readRecentPositionIds(items: CatalogItem[]) {
  return normalizeRecentPositionIds(
    readJsonRecord<unknown>(CATALOG_RECENT_POSITION_STORAGE_KEY, []),
    items,
  );
}

function promoteRecentPositionId(ids: string[], id: string) {
  return [id, ...ids.filter((candidate) => candidate !== id)].slice(0, CATALOG_RECENT_POSITION_LIMIT);
}

function writeRecentPositionId(id: string, items: CatalogItem[]) {
  const validIds = new Set(items.map((item) => item.id));
  if (!validIds.has(id)) return;
  writeJsonRecord(CATALOG_RECENT_POSITION_STORAGE_KEY, promoteRecentPositionId(readRecentPositionIds(items), id));
}

function PopulatedWorkspace({
  navigation,
  sections,
  createdItems,
  filterId,
  scopeSectionId,
  query,
  resetSignal,
  initialSelectedItemId,
  initialHighlightItemId,
  initialSelectedSectionId,
  initialReturnContext,
  pendingOpen,
  tableOpenSignal,
  onFilterChange,
  onQueryChange,
  onScopeChange,
  onOpenSectionInOverview,
  onRegisterCreateNavigationGuard,
  onPendingOpenHandled,
  onCreateClosed,
  mandatoryFilterId,
  titleOverride,
  allowPositionCreation = true,
  workspaceKind = "catalog",
}: {
  navigation: CatalogNavigationBoundary;
  sections: TreeSection[];
  createdItems: CatalogItem[];
  filterId: OverviewFilterId;
  scopeSectionId: string | null;
  query: string;
  resetSignal: number;
  initialSelectedItemId: string | null;
  initialHighlightItemId?: string | null;
  /** Раздел, выбранный в «Позициях» на момент перехода сюда. Приоритетнее последнего
   * состояния дерева, но не выше прямой ссылки на раздел (?sectionId=). */
  initialSelectedSectionId: string | null;
  initialReturnContext?: StructureReturnContext | null;
  pendingOpen?: PendingOpen | null;
  tableOpenSignal: number;
  onFilterChange: (id: OverviewFilterId) => void;
  onQueryChange: (value: string) => void;
  onScopeChange: (id: string | null) => void;
  onOpenSectionInOverview: (sectionId: string) => void;
  onRegisterCreateNavigationGuard: (guard: CatalogCreateNavigationGuard | null) => void;
  onPendingOpenHandled?: () => void;
  onCreateClosed?: () => void;
  mandatoryFilterId?: OverviewFilterId;
  titleOverride?: string;
  allowPositionCreation?: boolean;
  workspaceKind?: "catalog" | "stop-list";
}) {
  const { contentLanguage } = useAppSettings();
  const { registerChange } = usePublish();
  const {
    items: catalogStoreItems,
    itemOrderBySection: positionOrderBySection,
    activeEditorItemId,
    setActiveEditorItemId,
    upsellByItem,
    revision: catalogRevision,
    mutations: catalogMutations,
  } = useCatalogStore();
  const {
    createItem: createCatalogItem,
    deleteItem: deleteCatalogItem,
    deleteItems: deleteCatalogItems,
    moveItem: moveCatalogItem,
    moveItems: moveCatalogItems,
    setItemStatus: setCatalogItemStatus,
    reorderItems: reorderCatalogItems,
    replaceItemOrder: replaceCatalogItemOrder,
  } = catalogMutations;
  const sourceCatalogItems = catalogStoreItems;
  void createdItems;
  const preferredSectionId =
    catalogSections.find((section) => section.name === "Горячие блюда")?.id ??
    SECTIONS_WITH_ITEMS[0]?.id ??
    catalogSections[0]?.id ??
    null;
  const preferredSectionItems = sourceCatalogItems.filter((item) => item.sectionId === preferredSectionId);
  const preferredItemId =
    sourceCatalogItems.find((item) => item.sectionId === preferredSectionId && item.title.includes("Пицца"))?.id ??
    preferredSectionItems[2]?.id ??
    preferredSectionItems[0]?.id ??
    null;
  const editorNavParam = navigation.route.editorNav;
  const editorNavMode: "entity" | "unified" | "section" | "legacy" = editorNavParam === "legacy"
    ? "legacy"
    : editorNavParam === "section"
      ? "section"
      : editorNavParam === "entity"
        ? "entity"
        : "unified";
  const directPositionId = navigation.route.positionId;
  const directHighlightItemId = navigation.route.highlightPositionId;
  const directSectionId = navigation.route.sectionId;
  const directItem = directPositionId ? sourceCatalogItems.find((item) => item.id === directPositionId) ?? null : null;
  const directSection = directSectionId ? catalogSections.find((candidate) => candidate.id === directSectionId) ?? null : null;
  const retainedItem = initialSelectedItemId ? sourceCatalogItems.find((item) => item.id === initialSelectedItemId) ?? null : null;
  const unifiedScopeStorageKey = workspaceKind === "stop-list"
    ? STOP_LIST_UNIFIED_SCOPE_STORAGE_KEY
    : CATALOG_UNIFIED_SCOPE_STORAGE_KEY;
  const overviewContextStorageKey = workspaceKind === "stop-list"
    ? STOP_LIST_WORKSPACE_CONTEXT_STORAGE_KEY
    : OVERVIEW_WORKSPACE_CONTEXT_STORAGE_KEY;
  const treeStorageKeys = workspaceKind === "stop-list"
    ? {
        expanded: STOP_LIST_TREE_EXPANDED_STORAGE_KEY,
        query: STOP_LIST_TREE_QUERY_STORAGE_KEY,
        scroll: STOP_LIST_TREE_SCROLL_STORAGE_KEY,
      }
    : undefined;
  const storedUnifiedScope = readJsonRecord<string | "__all">(unifiedScopeStorageKey, "__all");
  const storedUnifiedSectionId = storedUnifiedScope !== "__all"
    && catalogSections.some((section) => section.id === storedUnifiedScope)
    ? storedUnifiedScope
    : null;
  const firstSectionId = directSection?.id
    ?? (initialSelectedSectionId && catalogSections.some((section) => section.id === initialSelectedSectionId) ? initialSelectedSectionId : null)
    ?? (scopeSectionId && catalogSections.some((section) => section.id === scopeSectionId) ? scopeSectionId : null)
    ?? storedUnifiedSectionId;
  const firstItemId = editorNavMode === "entity" || editorNavMode === "unified"
    ? activeEditorItemId ?? retainedItem?.id ?? directItem?.id ?? null
    : preferredItemId;
  const editorNavExperiment = editorNavMode !== "legacy";
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(firstSectionId);
  const [globalTableScopeId, setGlobalTableScopeId] = useState<string | null>(() =>
    firstSectionId === null ? scopeSectionId : null,
  );
  const [selectedItemId, setSelectedItemId] = useState<string | null>(firstItemId);
  const [editorSource, setEditorSource] = useState<"tree" | "table" | "breadcrumb" | null>(null);
  const [unifiedTableOpenSignal, setUnifiedTableOpenSignal] = useState(0);
  const [treeContentMode] = useState<CatalogTreeContentMode>(() => readCatalogTreeContentMode());
  // Явный режим: обзор раздела ↔ редактор позиции. Раньше режим выводился из
  // selectedItem != null, из-за чего смена раздела (обнулявшая позицию) выкидывала
  // из редактора и ломала пустой раздел в editor mode.
  const [editing, setEditing] = useState(editorNavMode === "section" ? false : Boolean(firstItemId));
  const structureCreateSession = useCreateSession();
  const structurePositionDraft: StructurePositionDraft | null = structureCreateSession.mode === "structure"
    && structureCreateSession.draft
    && structureCreateSession.context?.targetSectionId
    ? {
        item: structureCreateSession.draft,
        targetSectionId: structureCreateSession.context.targetSectionId,
        returnSectionId: structureCreateSession.context.returnSectionId ?? null,
        returnItemId: structureCreateSession.context.returnItemId ?? null,
        returnEditing: structureCreateSession.context.returnEditing ?? false,
      }
    : null;
  const structureCreateSubmitting = structureCreateSession.submitting;
  const [sectionOrderByParent, setSectionOrderByParent] = useState<Record<string, string[]>>(() =>
    readJsonRecord<Record<string, string[]>>(CATALOG_SECTION_ORDER_STORAGE_KEY, {}),
  );
  const [sectionParentOverrides, setSectionParentOverrides] = useState<Record<string, string | null>>(() =>
    readJsonRecord<Record<string, string | null>>(CATALOG_SECTION_PARENT_STORAGE_KEY, {}),
  );
  // Последняя открытая позиция в каждом разделе за сессию (для правила 2.1).
  const [lastItemBySection, setLastItemBySection] = useState<Record<string, string>>({});
  const [extraSections, setExtraSections] = useState<TreeSection[]>([]);
  const [sectionCreationDialog, setSectionCreationDialog] = useState<{ parentId: string | null } | null>(null);
  const [positionCreationDialog, setPositionCreationDialog] = useState<{ initialSectionId: string | null } | null>(null);
  const [, setRevealSectionId] = useState<string | null>(initialSelectedSectionId);
  const createSectionButtonRef = useRef<HTMLButtonElement | null>(null);
  // Подсветка исходной позиции после возврата из вкладки «Позиции».
  const [highlightItemId, setHighlightItemId] = useState<string | null>(() =>
    initialHighlightItemId
    ?? directHighlightItemId
    ?? readJsonRecord<string | null>(CATALOG_SECTION_HIGHLIGHT_ITEM_STORAGE_KEY, null)
    ?? initialSelectedItemId,
  );
  useEffect(() => {
    if (initialHighlightItemId) setHighlightItemId(initialHighlightItemId);
  }, [initialHighlightItemId]);
  useEffect(() => {
    if (!directHighlightItemId) return;
    setHighlightItemId(directHighlightItemId);
    navigation.consumeHighlightPosition();
  }, [directHighlightItemId, navigation]);
  useEffect(() => {
    removeCatalogValue(CATALOG_SECTION_HIGHLIGHT_ITEM_STORAGE_KEY);
  }, []);
  useEffect(() => {
    if (!highlightItemId) return;
    const timer = window.setTimeout(() => setHighlightItemId(null), 6000);
    return () => window.clearTimeout(timer);
  }, [highlightItemId]);
  const [previousAvailabilityByItem, setPreviousAvailabilityByItem] = useState<Record<string, PreviousAvailabilityState>>(() =>
    readJsonRecord<Record<string, PreviousAvailabilityState>>(CATALOG_PREVIOUS_AVAILABILITY_STORAGE_KEY, {}),
  );
  const [sectionStatusOverrides, setSectionStatusOverrides] = useState<Record<string, SectionStatus>>(() =>
    readJsonRecord<Record<string, SectionStatus>>(CATALOG_SECTION_STATUS_STORAGE_KEY, {}),
  );
  const [sectionVisibilityBySection, setSectionVisibilityBySection] = useState<Record<string, SectionVisibility>>(() =>
    readJsonRecord<Record<string, SectionVisibility>>(CATALOG_SECTION_VISIBILITY_STORAGE_KEY, {}),
  );
  const [sectionDraftOverrides, setSectionDraftOverrides] = useState<Record<string, SectionDraftOverride>>(() =>
    readJsonRecord<Record<string, SectionDraftOverride>>(CATALOG_SECTION_DRAFT_STORAGE_KEY, {}),
  );
  const [sectionAvailabilityBySection, setSectionAvailabilityBySection] = useState<Record<string, AvailabilityMode>>(() =>
    readJsonRecord<Record<string, AvailabilityMode>>(CATALOG_SECTION_AVAILABILITY_STORAGE_KEY, {}),
  );
  const [sectionOutsideScheduleBySection, setSectionOutsideScheduleBySection] = useState<Record<string, OutsideScheduleMode>>(() =>
    readJsonRecord<Record<string, OutsideScheduleMode>>(CATALOG_SECTION_OUTSIDE_SCHEDULE_STORAGE_KEY, {}),
  );
  const [sectionWeeklyScheduleBySection, setSectionWeeklyScheduleBySection] = useState<Record<string, WeeklySchedule>>(() =>
    readJsonRecord<Record<string, WeeklySchedule>>(CATALOG_SECTION_WEEKLY_SCHEDULE_STORAGE_KEY, {}),
  );
  const [deletedSectionIds, setDeletedSectionIds] = useState<Set<string>>(new Set());
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<CatalogItem | null>(null);
  const [pendingSectionDelete, setPendingSectionDelete] = useState<SectionDeleteDialogState | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [sectionArchiveOpen, setSectionArchiveOpen] = useState(false);
  const [sectionEditorTab, setSectionEditorTab] = useState<SectionEditorTab>(() =>
    initialReturnContext?.sectionEditorTab ?? readSectionEditorTab(),
  );
  const [sectionTableQuery, setSectionTableQuery] = useState(() =>
    initialReturnContext?.compositionQuery ?? readJsonRecord<string>(CATALOG_SECTION_TABLE_QUERY_STORAGE_KEY, ""),
  );
  const [sectionTablePriceSort, setSectionTablePriceSort] = useState<PriceSortDirection>(() => readSectionPriceSort());
  const [sectionEditorScrollTop, setSectionEditorScrollTop] = useState(() =>
    initialReturnContext?.workspaceScrollTop ?? readJsonRecord<number>(CATALOG_SECTION_EDITOR_SCROLL_STORAGE_KEY, 0),
  );
  const [stopBusyIds, setStopBusyIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState("");
  const [moveRequest, setMoveRequest] = useState<{
    operation: MoveOperation;
    entityIds: string[];
    currentSectionIds: string[];
    movingSectionId?: string;
    anchor: MovePopoverAnchor;
  } | null>(null);
  const [treeMoveUndo, setTreeMoveUndo] = useState<CatalogTreeMoveUndoState>(null);
  const previousResetSignalRef = useRef(resetSignal);

  useEffect(() => {
    if (!initialReturnContext) return;
    if (initialReturnContext.sectionEditorTab) setSectionEditorTab(initialReturnContext.sectionEditorTab);
    if (initialReturnContext.compositionQuery !== undefined) setSectionTableQuery(initialReturnContext.compositionQuery);
    if (initialReturnContext.workspaceScrollTop !== undefined) setSectionEditorScrollTop(initialReturnContext.workspaceScrollTop);
  }, [initialReturnContext]);

  const allSections = [...catalogSections, ...extraSections]
    .filter((section) => !deletedSectionIds.has(section.id))
    .map<TreeSection>((section) => {
      const parentId = Object.prototype.hasOwnProperty.call(sectionParentOverrides, section.id)
        ? sectionParentOverrides[section.id]
        : section.parentId;
      const storedOrder = sectionOrderByParent[parentId ?? "__root__"];
      const storedIndex = storedOrder?.indexOf(section.id) ?? -1;
      return {
        ...section,
        ...sectionDraftOverrides[section.id],
        parentId,
        status: sectionStatusOverrides[section.id] ?? "active",
        visibility: sectionVisibilityBySection[section.id] ?? "visible",
        availabilityMode: sectionAvailabilityBySection[section.id] ?? "always",
        sortOrder: storedIndex >= 0 ? storedIndex : 10_000 + (section.sortOrder ?? 0),
      };
    });
  const allSectionTree = buildLocalSectionTree(allSections);
  const activeSectionTree = buildLocalSectionTree(allSections.filter((candidate) => candidate.status !== "archive"));
  const archivedSectionTree = buildLocalSectionTree(allSections.filter((candidate) => candidate.status === "archive"));
  const activeSections = allSections.filter((candidate) => candidate.status !== "archive");
  void sections;

  const baseItems = catalogStoreItems;
  const allItems = baseItems.map((item) => {
      const upsell = upsellByItem[item.id];
      const recommendationIds = resolveRecommendationIds(
        item,
        baseItems,
        upsell,
      );
      const sticker = getLocalizedValueLabel(
        getLocalizedValueFromUnknown(upsell?.sticker, item.guestLabels[0] ?? null),
        contentLanguage,
      );
      const tags = getLocalizedValueLabels(
        getLocalizedValuesFromUnknown(upsell?.tags, item.tags),
        contentLanguage,
      );
      return {
        ...item,
        guestLabels: sticker ? [sticker] : [],
        tags,
        recommendationsCount: recommendationIds.length,
      };
    });
  const itemSectionOverrides = Object.fromEntries(allItems.map((item) => [item.id, item.sectionId]));
  const setPositionOrderBySection = (
    update: Record<string, string[]> | ((current: Record<string, string[]>) => Record<string, string[]>),
  ) => replaceCatalogItemOrder(typeof update === "function" ? update(positionOrderBySection) : update);
  const section = allSections.find((s) => s.id === selectedSectionId) ?? null;
  const sectionItems = orderSectionItems(
    allItems.filter((item) => item.sectionId === selectedSectionId),
    selectedSectionId ? positionOrderBySection[selectedSectionId] : undefined,
  );
  const activeSectionItems = sectionItems.filter((item) => item.status !== "archive");
  const selectedItem = selectedItemId
    ? allItems.find((item) => item.id === selectedItemId) ?? null
    : null;
  const sectionTableBaseItems = selectedSectionId
    ? allItems.filter((item) => item.sectionId === selectedSectionId)
    : [];
  const normalizedSectionTableQuery = sectionTableQuery.trim().toLowerCase();
  const sectionTableSearchedItems = normalizedSectionTableQuery
    ? sectionTableBaseItems.filter((item) =>
        [item.title, item.sectionName].some((value) => value.toLowerCase().includes(normalizedSectionTableQuery)),
      )
    : sectionTableBaseItems;
  // В компактном составе порядок задаётся вручную (drag) через positionOrderBySection;
  // price-sort остаётся только запасным путём, если он когда-либо будет включён.
  const sectionTableItems = sectionTablePriceSort === "none"
    ? orderSectionItems(sectionTableSearchedItems, selectedSectionId ? positionOrderBySection[selectedSectionId] : undefined)
    : sortItemsByPrice(sectionTableSearchedItems, sectionTablePriceSort);
  const directChildSections = section
    ? allSections
        .filter((candidate) => (candidate.parentId ?? null) === section.id)
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.name.localeCompare(right.name, "ru"))
        .map((child) => ({
          section: child,
          itemCount: allItems.filter((item) => item.sectionId === child.id && item.status !== "archive").length,
        }))
    : [];

  const openSectionCreation = (parentId: string | null = null) => {
    const parent = parentId ? allSections.find((candidate) => candidate.id === parentId) ?? null : null;
    if (parentId && !parent) {
      setFeedback("Родительский раздел не найден");
      return;
    }
    if (parent) {
      const availability = getParentAvailability(parent, allItems, allSections);
      if (!availability.available) {
        setFeedback(availability.label);
        return;
      }
    }
    setSectionCreationDialog({ parentId });
  };

  const closeSectionCreation = () => {
    setSectionCreationDialog(null);
    window.setTimeout(() => createSectionButtonRef.current?.focus(), 0);
  };

  const createSectionFromDialog = (name: string, parentId: string | null): SectionCreationResult => {
    const parent = parentId ? allSections.find((candidate) => candidate.id === parentId) ?? null : null;
    if (parentId && !parent) return "Родительский раздел не найден. Обновите список и повторите попытку.";
    if (parent) {
      const availability = getParentAvailability(parent, allItems, allSections);
      if (!availability.available) return availability.label;
    }
    const normalizedName = name.trim();
    const duplicate = allSections.some((candidate) =>
      (candidate.parentId ?? null) === (parent?.id ?? null)
      && candidate.name.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase(),
    );
    if (duplicate) return "Раздел с таким названием уже существует здесь.";

    const id = `draft-section-${Date.now()}-${extraSections.length + 1}`;
    const created: TreeSection = {
      id,
      parentId: parent?.id ?? null,
      name: normalizedName,
      imageUrl: null,
      emoji: "🍽️",
      sortOrder: 100_000 + extraSections.length,
      status: "active",
    };
    setExtraSections((current) => [...current, created]);
    setSectionOrderByParent((current) => ({
      ...current,
      [parent?.id ?? "__root__"]: [
        ...(current[parent?.id ?? "__root__"] ?? []),
        id,
      ],
    }));
    setSelectedSectionId(id);
    setSelectedItemId(null);
    setEditing(false);
    setSectionEditorTab("composition");
    setRevealSectionId(id);
    closeSectionCreation();
    registerChange("catalog");
    setFeedback("Раздел создан");
    return true;
  };

  const handleTreeSelectSection = (id: string) => {
    openSectionEditor(id);
  };

  const rememberItem = (id: string) => {
    const it = allItems.find((i) => i.id === id);
    if (it) setLastItemBySection((prev) => ({ ...prev, [it.sectionId]: id }));
    writeRecentPositionId(id, allItems);
  };

  useEffect(() => {
    if (selectedSectionId === null) return;
    if (selectedSectionId && allSections.some((candidate) => candidate.id === selectedSectionId)) return;
    setSelectedSectionId(null);
    onScopeChange(null);
    setSelectedItemId(null);
    setEditing(false);
  }, [allSections, onScopeChange, selectedSectionId]);

  useEffect(() => {
    if (!selectedSectionId) return;
    writeJsonRecord(CATALOG_ACTIVE_SECTION_STORAGE_KEY, selectedSectionId);
  }, [selectedSectionId]);

  useEffect(() => {
    writeJsonRecord(unifiedScopeStorageKey, selectedSectionId ?? "__all");
    // В глобальном режиме scope таблицы живёт отдельно от выбранного узла дерева:
    // dropdown «Все разделы» может сузить список, не возвращая выбор в левое дерево.
    if (selectedSectionId !== null && scopeSectionId !== selectedSectionId) onScopeChange(selectedSectionId);
  }, [onScopeChange, scopeSectionId, selectedSectionId, unifiedScopeStorageKey]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_TREE_CONTENT_STORAGE_KEY, treeContentMode);
  }, [treeContentMode]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_EDITOR_TAB_STORAGE_KEY, sectionEditorTab);
  }, [sectionEditorTab]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_TABLE_QUERY_STORAGE_KEY, sectionTableQuery);
  }, [sectionTableQuery]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_TABLE_PRICE_SORT_STORAGE_KEY, sectionTablePriceSort);
  }, [sectionTablePriceSort]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_EDITOR_SCROLL_STORAGE_KEY, sectionEditorScrollTop);
  }, [sectionEditorScrollTop]);

  useEffect(() => {
    if (previousResetSignalRef.current === resetSignal) return;
    previousResetSignalRef.current = resetSignal;
    setSectionTableQuery("");
    setSectionTablePriceSort("none");
    setSelectedIds(new Set());
    setSelectedItemId(null);
    setEditing(false);
    setSectionEditorTab("composition");
    setSectionEditorScrollTop(0);
  }, [resetSignal]);

  // Правило 1: клик по разделу в дереве — только обзор, редактор не открываем.
  const selectSectionOverview = (id: string) => {
    setSelectedSectionId(id);
    setSelectedIds(new Set());
    setSectionEditorTab("composition");
    setSectionEditorScrollTop(0);
  };

  const openSectionEditor = (id: string) => {
    setUnifiedTableOpenSignal((signal) => signal + 1);
    setSelectedSectionId(id);
    onScopeChange(id);
    setSelectedItemId(null);
    setEditorSource(null);
    setActiveEditorItemId(null);
    setSelectedIds(new Set());
    setEditing(false);
    setSectionEditorTab("composition");
    setSectionEditorScrollTop(0);
    if (editorNavMode === "entity") {
      navigation.replaceSection(id);
    }
  };

  // Открыть позицию (из обзора или sibling-навигации) → войти в editor mode.
  const openItem = (id: string) => {
    const targetItem = allItems.find((item) => item.id === id);
    if (targetItem) setSelectedSectionId(targetItem.sectionId);
    setSelectedItemId(id);
    setEditorSource("tree");
    setActiveEditorItemId(id);
    setEditing(true);
    rememberItem(id);
    if (editorNavMode === "entity") {
      navigation.replacePosition(id);
    }
  };
  const openItemFromEditorBreadcrumb = (id: string) => {
    if (!allItems.some((item) => item.id === id)) return;
    setSelectedItemId(id);
    setEditorSource("breadcrumb");
    setActiveEditorItemId(id);
    setEditing(true);
    rememberItem(id);
  };
  // В эксперименте раздел открывает список слева, но не выбирает позицию за пользователя.
  const selectSectionInEditor = (id: string) => {
    setSelectedSectionId(id);
    setSelectedIds(new Set());
    setSectionEditorTab("composition");
    setSectionEditorScrollTop(0);
    const items = allItems.filter((item) => item.sectionId === id);
    const remembered = lastItemBySection[id];
    const nextId = remembered && items.some((item) => item.id === remembered) ? remembered : null;
    setSelectedItemId(nextId);
    setEditing(true);
  };

  const openSectionOverview = () => {
    setSelectedItemId(null);
    setEditorSource(null);
    setActiveEditorItemId(null);
    setEditing(false);
    setSelectedIds(new Set());
  };

  const selectAllPositions = () => {
    if (structurePositionDraft) {
      setFeedback("Завершите создание или нажмите «Отменить»");
      return;
    }
    setSelectedSectionId(null);
    setGlobalTableScopeId(null);
    setUnifiedTableOpenSignal((signal) => signal + 1);
    setSelectedItemId(null);
    setEditorSource(null);
    setActiveEditorItemId(null);
    setSelectedIds(new Set());
    setSectionEditorTab("composition");
    onScopeChange(null);
    onFilterChange("quick:all");
  };

  const reorderItemsInSection = (sectionId: string, draggedId: string, targetId: string) => {
    const ids = orderSectionItems(
      allItems.filter((item) => item.sectionId === sectionId && item.status !== "archive"),
      positionOrderBySection[sectionId],
    ).map((item) => item.id);
    const nextIds = moveCatalogIdToIndex(ids, draggedId, targetId);
    if (nextIds.every((id, index) => id === ids[index])) return;
    reorderCatalogItems(sectionId, nextIds);
    setFeedback("Порядок позиций изменён");
  };

  const reorderCompositionItems = (
    containerId: string,
    draggedId: string,
    targetId: string,
    zone: Exclude<CatalogDropZone, "inside">,
  ) => {
    const ids = sectionTableItems.map((item) => item.id);
    const nextIds = reorderCatalogIds(ids, draggedId, targetId, zone);
    reorderCatalogItems(containerId, nextIds);
  };

  const reorderTreeItem = (
    draggedId: string,
    targetItemId: string,
    mode: "before" | "after",
  ) => {
    const dragged = allItems.find((item) => item.id === draggedId);
    if (!dragged) return;
    const sourceSectionId = dragged.sectionId;
    const ids = orderSectionItems(
      allItems.filter((item) => item.sectionId === sourceSectionId),
      positionOrderBySection[sourceSectionId],
    ).map((item) => item.id);
    reorderCatalogItems(sourceSectionId, reorderCatalogIds(ids, draggedId, targetItemId, mode));
  };

  const moveTreeSection = (
    draggedId: string,
    targetParentId: string | null,
    targetSectionId: string | null,
    mode: "before" | "after" | "inside",
    announce = true,
  ) => {
    const dragged = allSections.find((section) => section.id === draggedId);
    if (!dragged || targetParentId === draggedId) return;
    const draggedNode = flattenSections(buildLocalSectionTree(allSections)).find((section) => section.id === draggedId);
    const descendants = new Set(flattenSections(draggedNode?.children ?? []).map((section) => section.id));
    if (targetParentId && descendants.has(targetParentId)) return;
    const sourceParentId = dragged.parentId ?? null;
    setSectionOrderByParent((current) => {
      const getIds = (parentId: string | null, excludeDragged = false) => allSections
        .filter((section) => (section.parentId ?? null) === parentId && (!excludeDragged || section.id !== draggedId))
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
        .map((section) => section.id);

      if (sourceParentId === targetParentId) {
        if (!targetSectionId || mode === "inside") return current;
        const ids = getIds(sourceParentId);
        return {
          ...current,
          [sourceParentId ?? "__root__"]: reorderCatalogIds(ids, draggedId, targetSectionId, mode),
        };
      }

      const sourceIds = getIds(sourceParentId, true);
      const targetIds = getIds(targetParentId, true);
      const targetIndex = targetSectionId ? targetIds.indexOf(targetSectionId) : -1;
      const insertionIndex = targetIndex < 0 ? targetIds.length : mode === "after" ? targetIndex + 1 : targetIndex;
      targetIds.splice(insertionIndex, 0, draggedId);
      const targetKey = targetParentId ?? "__root__";
      const next = { ...current, [sourceParentId ?? "__root__"]: sourceIds, [targetKey]: targetIds };
      return next;
    });
    if (sourceParentId !== targetParentId) {
      setSectionParentOverrides((current) => ({ ...current, [draggedId]: targetParentId }));
    }
    if (announce) {
      registerChange("catalog");
      setFeedback(sourceParentId === targetParentId ? "Порядок разделов изменён" : "Раздел перемещён");
    }
  };

  const captureTreeMoveSnapshot = (): CatalogTreeMoveSnapshot => ({
    positionOrderBySection: cloneStringArrayRecord(positionOrderBySection),
    sectionOrderByParent: cloneStringArrayRecord(sectionOrderByParent),
    itemSectionOverrides: { ...itemSectionOverrides },
    sectionParentOverrides: { ...sectionParentOverrides },
    lastItemBySection: { ...lastItemBySection },
  });

  const restoreTreeMoveSnapshot = (snapshot: CatalogTreeMoveSnapshot) => {
    setPositionOrderBySection(cloneStringArrayRecord(snapshot.positionOrderBySection));
    setSectionOrderByParent(cloneStringArrayRecord(snapshot.sectionOrderByParent));
    Object.entries(snapshot.itemSectionOverrides).forEach(([itemId, sectionId]) => {
      const sectionName = allSections.find((candidate) => candidate.id === sectionId)?.name;
      moveCatalogItem(itemId, sectionId, { sectionName });
    });
    setSectionParentOverrides({ ...snapshot.sectionParentOverrides });
    setLastItemBySection({ ...snapshot.lastItemBySection });
  };

  const offerTreeMoveUndo = (message: string, snapshot: CatalogTreeMoveSnapshot) => {
    setFeedback("");
    setTreeMoveUndo({ message, snapshot });
  };

  const undoLastTreeMove = () => {
    if (!treeMoveUndo) return;
    restoreTreeMoveSnapshot(treeMoveUndo.snapshot);
    setTreeMoveUndo(null);
    registerChange("catalog");
  };

  // dnd-kit остаётся только для плоского состава выбранного раздела.
  const [activeDrag, setActiveDrag] = useState<CatalogActiveDrag>(null);
  const [dropTarget, setDropTarget] = useState<CatalogDropTarget>(null);
  const [, setDropIntentState] = useState<CatalogDropIntentState>(EMPTY_DROP_INTENT);
  const [, setInvalidNestingHintVisible] = useState(false);
  const dropTargetRef = useRef<CatalogDropTarget>(null);
  const dropIntentStateRef = useRef<CatalogDropIntentState>(EMPTY_DROP_INTENT);
  const pendingDropTargetRef = useRef<CatalogDropTarget>(null);
  const stableInsideTargetRef = useRef<{
    target: NonNullable<CatalogDropTarget>;
    rect: CatalogTargetRect;
  } | null>(null);
  const dndPointerStartRef = useRef<CatalogPointerPosition | null>(null);
  const dndPointerCurrentRef = useRef<CatalogPointerPosition | null>(null);
  const insideActivationTimerRef = useRef<number | null>(null);
  const invalidHintTimerRef = useRef<number | null>(null);
  const invalidDropHoldTimerRef = useRef<number | null>(null);
  const invalidZoneContinuousRef = useRef(false);
  const invalidDropHeldRef = useRef(false);
  const dndSourceRef = useRef<{
    kind: CatalogDndKind;
    id: string;
    surface: CatalogDndSurface;
    containerId: string | null;
    actualParentId: string | null;
  } | null>(null);
  // Синхронный флаг активного drag — блокирует клик по строке без задержки re-render.
  const dragActiveRef = useRef(false);
  const dndReducedMotion = usePrefersReducedMotion();
  const dndSensors = useSensors(
    useSensor(CatalogPointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const updateDropIntentState = (next: CatalogDropIntentState) => {
    dropIntentStateRef.current = next;
    setDropIntentState(next);
  };
  const updateDropTarget = (next: CatalogDropTarget) => {
    dropTargetRef.current = next;
    setDropTarget(next);
  };
  const clearInsideActivationTimer = () => {
    if (insideActivationTimerRef.current != null) {
      window.clearTimeout(insideActivationTimerRef.current);
      insideActivationTimerRef.current = null;
    }
  };
  const setInvalidZonePresence = (present: boolean) => {
    if (invalidDropHeldRef.current) return;
    if (present) {
      if (invalidZoneContinuousRef.current) return;
      invalidZoneContinuousRef.current = true;
      invalidHintTimerRef.current = window.setTimeout(() => {
        invalidHintTimerRef.current = null;
        if (invalidZoneContinuousRef.current && !invalidDropHeldRef.current) {
          setInvalidNestingHintVisible(true);
        }
      }, CATALOG_INVALID_HINT_DELAY_MS);
      return;
    }
    invalidZoneContinuousRef.current = false;
    if (invalidHintTimerRef.current != null) {
      window.clearTimeout(invalidHintTimerRef.current);
      invalidHintTimerRef.current = null;
    }
    setInvalidNestingHintVisible(false);
  };
  const holdInvalidDropHint = () => {
    invalidZoneContinuousRef.current = false;
    if (invalidHintTimerRef.current != null) {
      window.clearTimeout(invalidHintTimerRef.current);
      invalidHintTimerRef.current = null;
    }
    if (invalidDropHoldTimerRef.current != null) window.clearTimeout(invalidDropHoldTimerRef.current);
    invalidDropHeldRef.current = true;
    setInvalidNestingHintVisible(true);
    invalidDropHoldTimerRef.current = window.setTimeout(() => {
      invalidDropHoldTimerRef.current = null;
      invalidDropHeldRef.current = false;
      setInvalidNestingHintVisible(false);
    }, CATALOG_INVALID_DROP_HOLD_MS);
  };

  useEffect(() => () => {
    clearInsideActivationTimer();
    if (invalidHintTimerRef.current != null) window.clearTimeout(invalidHintTimerRef.current);
    if (invalidDropHoldTimerRef.current != null) window.clearTimeout(invalidDropHoldTimerRef.current);
  }, []);

  useEffect(() => {
    const rememberPointer = (event: PointerEvent) => {
      if (!dragActiveRef.current) return;
      dndPointerCurrentRef.current = { x: event.clientX, y: event.clientY };
    };
    window.addEventListener("pointermove", rememberPointer, { passive: true });
    return () => window.removeEventListener("pointermove", rememberPointer);
  }, []);

  const isDropValid = (
    activeKind: CatalogDndKind,
    activeId: string,
    overKind: CatalogDndKind,
    overId: string,
    overContainerId: string | null,
    zone: CatalogDropZone,
  ): { valid: boolean; reason?: string } => {
    if (zone === "inside") {
      return { valid: false, reason: "Для переноса в другой раздел используйте «Переместить»" };
    }
    const activeParentId = activeKind === "section"
      ? allSections.find((section) => section.id === activeId)?.parentId ?? null
      : allItems.find((item) => item.id === activeId)?.sectionId ?? null;
    const targetParentId = overKind === "section"
      ? allSections.find((section) => section.id === overId)?.parentId ?? overContainerId
      : allItems.find((item) => item.id === overId)?.sectionId ?? overContainerId;
    return validateCatalogSiblingReorder(
      { kind: activeKind, id: activeId, parentId: activeParentId },
      { kind: overKind, id: overId, parentId: targetParentId },
    );
  };

  type CatalogDndData = { kind: CatalogDndKind; containerId: string | null; surface: CatalogDndSurface };

  const handleDndDragStart = (event: DragStartEvent) => {
    dragActiveRef.current = true;
    const data = event.active.data.current as CatalogDndData | undefined;
    if (!data) return;
    const realId = parseCatalogDndId(event.active.id);
    const actualParentId = data.kind === "section"
      ? allSections.find((candidate) => candidate.id === realId)?.parentId ?? null
      : allItems.find((candidate) => candidate.id === realId)?.sectionId ?? data.containerId;
    dndSourceRef.current = {
      kind: data.kind,
      id: realId,
      surface: data.surface,
      containerId: data.containerId,
      actualParentId,
    };
    const activatorEvent = event.activatorEvent;
    if (activatorEvent instanceof MouseEvent || activatorEvent instanceof PointerEvent) {
      dndPointerStartRef.current = { x: activatorEvent.clientX, y: activatorEvent.clientY };
    } else if (
      typeof TouchEvent !== "undefined"
      && activatorEvent instanceof TouchEvent
      && activatorEvent.touches[0]
    ) {
      dndPointerStartRef.current = {
        x: activatorEvent.touches[0].clientX,
        y: activatorEvent.touches[0].clientY,
      };
    } else {
      dndPointerStartRef.current = null;
    }
    dndPointerCurrentRef.current = dndPointerStartRef.current;
    clearInsideActivationTimer();
    updateDropIntentState(EMPTY_DROP_INTENT);
    updateDropTarget(null);
    setInvalidZonePresence(false);
    if (data.kind === "section") {
      const found = allSections.find((candidate) => candidate.id === realId);
      setActiveDrag(found ? { kind: "section", id: realId, title: found.name, imageUrl: found.imageUrl ?? null } : null);
    } else {
      const found = allItems.find((candidate) => candidate.id === realId);
      setActiveDrag(found ? { kind: "item", id: realId, title: found.title, imageUrl: found.thumbnailUrl ?? null } : null);
    }
  };
  const resolveDndTarget = (event: DragMoveEvent | DragOverEvent): CatalogDropTarget => {
    const { active, over } = event;
    const activeData = active.data.current as CatalogDndData | undefined;
    const overData = over?.data.current as CatalogDndData | undefined;
    if (!activeData) return null;

    const activeRealId = parseCatalogDndId(active.id);
    const translated = active.rect.current.translated;
    if (!dndPointerCurrentRef.current && (!translated || !over)) return null;
    const pointer = dndPointerCurrentRef.current
      ? dndPointerCurrentRef.current
      : {
          x: translated!.left + translated!.width / 2,
          y: translated!.top + translated!.height / 2,
        };

    const previousIntent = dropIntentStateRef.current;
    const stableInsideTarget = stableInsideTargetRef.current;
    if (
      previousIntent.pendingIntent === "inside"
      && stableInsideTarget
      && stableInsideTarget.target.id === previousIntent.targetId
    ) {
      let stableIntent = getDropIntent(pointer, stableInsideTarget.rect);
      if (previousIntent.activeIntent === "inside" && stableIntent !== "inside") {
        const insideTop = stableInsideTarget.rect.top + stableInsideTarget.rect.height * 0.25;
        const insideBottom = stableInsideTarget.rect.top + stableInsideTarget.rect.height * 0.75;
        if (
          pointer.y >= insideTop - CATALOG_DROP_HYSTERESIS_PX
          && pointer.y <= insideBottom + CATALOG_DROP_HYSTERESIS_PX
        ) stableIntent = "inside";
      }
      // Sortable transforms могут на мгновение отдать соседний `over`. Пока
      // курсор остаётся в центральной зоне исходного layout-rect, цель не меняем.
      if (stableIntent === "inside") {
        const stableTarget = stableInsideTarget.target;
        const { valid, reason } = isDropValid(
          activeData.kind,
          activeRealId,
          stableTarget.kind,
          stableTarget.id,
          stableTarget.containerId,
          "inside",
        );
        return { ...stableTarget, zone: "inside", valid, reason, insideActive: previousIntent.activeIntent === "inside" };
      }
    }

    if (!over || !overData) return null;
    const overRealId = parseCatalogDndId(over.id);
    if (activeRealId === overRealId) return null;

    // over.rect — измеренный layout-rect строки, а не transform-положение overlay.
    // После подтверждения inside расширяем центральную зону на 5px с обеих сторон.
    const isCompositionSectionReorder = activeData.kind === "section"
      && activeData.surface === "composition"
      && overData.kind === "section"
      && overData.surface === "composition";
    let zone = isCompositionSectionReorder
      ? pointer.y < over.rect.top + over.rect.height / 2 ? "before" as const : "after" as const
      : overData.kind === "section"
        ? getDropIntent(pointer, over.rect)
        : pointer.y < over.rect.top + over.rect.height / 2 ? "before" as const : "after" as const;
    if (
      !isCompositionSectionReorder
      &&
      overData.kind === "section"
      && previousIntent.targetId === overRealId
      && previousIntent.activeIntent === "inside"
      && zone !== "inside"
    ) {
      const insideTop = over.rect.top + over.rect.height * 0.25;
      const insideBottom = over.rect.top + over.rect.height * 0.75;
      if (
        pointer.y >= insideTop - CATALOG_DROP_HYSTERESIS_PX
        && pointer.y <= insideBottom + CATALOG_DROP_HYSTERESIS_PX
      ) {
        zone = "inside";
      }
    }

    const { valid, reason } = isDropValid(
      activeData.kind,
      activeRealId,
      overData.kind,
      overRealId,
      overData.containerId,
      zone,
    );
    const nextTarget = {
      kind: overData.kind,
      surface: overData.surface,
      id: overRealId,
      containerId: overData.containerId,
      zone,
      valid,
      reason,
      insideActive: false,
    };
    if (zone === "inside") {
      stableInsideTargetRef.current = {
        target: nextTarget,
        rect: { top: over.rect.top, height: over.rect.height },
      };
    }
    return nextTarget;
  };

  const applyResolvedDndTarget = (event: DragMoveEvent | DragOverEvent) => {
    if (!dragActiveRef.current) return;
    const target = resolveDndTarget(event);
    if (!target) {
      clearInsideActivationTimer();
      pendingDropTargetRef.current = null;
      stableInsideTargetRef.current = null;
      updateDropIntentState(EMPTY_DROP_INTENT);
      updateDropTarget(null);
      setInvalidZonePresence(false);
      return;
    }

    const previous = dropIntentStateRef.current;
    if (target.zone !== "inside") {
      clearInsideActivationTimer();
      pendingDropTargetRef.current = target;
      stableInsideTargetRef.current = null;
      updateDropIntentState({
        targetId: target.id,
        pendingIntent: target.zone,
        activeIntent: target.zone,
        insideStartedAt: null,
        invalidReason: target.reason,
      });
      updateDropTarget(target);
      setInvalidZonePresence(false);
      return;
    }

    const samePendingInside = previous.targetId === target.id && previous.pendingIntent === "inside";
    const insideStartedAt = samePendingInside && previous.insideStartedAt != null
      ? previous.insideStartedAt
      : Date.now();
    const insideActive = samePendingInside && previous.activeIntent === "inside";
    const nextTarget = { ...target, insideActive };
    pendingDropTargetRef.current = nextTarget;
    updateDropIntentState({
      targetId: target.id,
      pendingIntent: "inside",
      activeIntent: insideActive ? "inside" : null,
      insideStartedAt,
      invalidReason: target.reason,
    });
    updateDropTarget(nextTarget);
    setInvalidZonePresence(!target.valid && target.reason === "В этом разделе уже есть позиции");

    if (insideActive) return;
    if (samePendingInside && insideActivationTimerRef.current != null) return;

    clearInsideActivationTimer();
    const remainingDelay = Math.max(0, CATALOG_INSIDE_DELAY_MS - (Date.now() - insideStartedAt));
    insideActivationTimerRef.current = window.setTimeout(() => {
      insideActivationTimerRef.current = null;
      const currentIntent = dropIntentStateRef.current;
      const pendingTarget = pendingDropTargetRef.current;
      if (
        currentIntent.targetId !== target.id
        || currentIntent.pendingIntent !== "inside"
        || !pendingTarget
        || pendingTarget.id !== target.id
      ) return;
      const activeTarget = { ...pendingTarget, insideActive: true };
      pendingDropTargetRef.current = activeTarget;
      updateDropIntentState({ ...currentIntent, activeIntent: "inside" });
      updateDropTarget(activeTarget);
    }, remainingDelay);
  };

  const handleDndDragMove = (event: DragMoveEvent) => applyResolvedDndTarget(event);
  const handleDndDragOver = (event: DragOverEvent) => applyResolvedDndTarget(event);

  const clearDndState = () => {
    dragActiveRef.current = false;
    clearInsideActivationTimer();
    setActiveDrag(null);
    updateDropTarget(null);
    updateDropIntentState(EMPTY_DROP_INTENT);
    pendingDropTargetRef.current = null;
    stableInsideTargetRef.current = null;
    dndPointerStartRef.current = null;
    dndPointerCurrentRef.current = null;
    dndSourceRef.current = null;
    setInvalidZonePresence(false);
  };

  const handleDndDragEnd = (event: DragEndEvent) => {
    // KeyboardSensor может завершить перенос без промежуточного pointer-based
    // onDragMove. В этом случае последняя `over`-цель из DragEnd — канонический
    // fallback, иначе keyboard DnD активируется, но не сохраняет новый порядок.
    const target = dropTargetRef.current ?? resolveDndTarget(event as unknown as DragMoveEvent);
    const intent = dropIntentStateRef.current;
    const source = dndSourceRef.current;
    const insideConfirmed = target?.zone !== "inside" || intent.activeIntent === "inside";
    if (!target?.valid || !source || !insideConfirmed) {
      if (
        target?.zone === "inside"
        && target.reason === "В этом разделе уже есть позиции"
      ) holdInvalidDropHint();
      clearDndState();
      return;
    }

    if (source.kind === "section") {
      if (target.kind !== "section" || target.zone === "inside") {
        clearDndState();
        return;
      }
      if (
        source.surface === "composition"
        && target.surface === "composition"
        && source.containerId
      ) {
        const sourceIndex = directChildSections.findIndex(({ section: child }) => child.id === source.id);
        const targetIndex = directChildSections.findIndex(({ section: child }) => child.id === target.id);
        const keyboardZone = event.activatorEvent instanceof KeyboardEvent && sourceIndex >= 0 && targetIndex >= 0
          ? targetIndex > sourceIndex ? "after" : "before"
          : target.zone;
        moveTreeSection(source.id, source.containerId, target.id, keyboardZone, false);
        registerChange("catalog");
        setFeedback("Порядок подразделов изменён");
        clearDndState();
        return;
      }
      moveTreeSection(
        source.id,
        source.actualParentId,
        target.id,
        target.zone,
        false,
      );
      registerChange("catalog");
      setFeedback("Порядок разделов изменён");
    } else {
      if (
        source.surface === "composition"
        && target.surface === "composition"
        && target.kind === "item"
        && target.zone !== "inside"
        && source.containerId
      ) {
        const sourceIndex = sectionTableItems.findIndex((item) => item.id === source.id);
        const targetIndex = sectionTableItems.findIndex((item) => item.id === target.id);
        const keyboardZone = event.activatorEvent instanceof KeyboardEvent && sourceIndex >= 0 && targetIndex >= 0
          ? targetIndex > sourceIndex ? "after" : "before"
          : target.zone;
        reorderCompositionItems(source.containerId, source.id, target.id, keyboardZone);
        registerChange("catalog");
        setFeedback("Порядок позиций изменён");
        clearDndState();
        return;
      }
      if (target.kind !== "item" || !source.actualParentId || target.zone === "inside") {
        clearDndState();
        return;
      }
      reorderTreeItem(source.id, target.id, target.zone);
      setLastItemBySection((current) => ({ ...current, [source.actualParentId!]: source.id }));
      registerChange("catalog");
      setFeedback("Порядок позиций изменён");
    }
    clearDndState();
  };
  const handleDndDragCancel = () => {
    invalidDropHeldRef.current = false;
    if (invalidDropHoldTimerRef.current != null) {
      window.clearTimeout(invalidDropHoldTimerRef.current);
      invalidDropHoldTimerRef.current = null;
    }
    clearDndState();
  };

  const cancelStructurePositionCreation = () => {
    const pendingDraft = structurePositionDraft;
    if (!pendingDraft) return;
    structureCreateSession.cancel();

    const returnItem = pendingDraft.returnItemId
      ? allItems.find((item) => item.id === pendingDraft.returnItemId) ?? null
      : null;
    if (returnItem) {
      setSelectedSectionId(returnItem.sectionId);
      setSelectedItemId(returnItem.id);
      setEditorSource("tree");
      setActiveEditorItemId(returnItem.id);
      setEditing(true);
      if (editorNavMode === "entity") {
        navigation.replacePosition(returnItem.id);
      }
      return;
    }

    const returnSectionId = pendingDraft.returnSectionId
      && allSections.some((candidate) => candidate.id === pendingDraft.returnSectionId)
      ? pendingDraft.returnSectionId
      : pendingDraft.targetSectionId;
    setSelectedSectionId(returnSectionId);
    setSelectedItemId(null);
    setEditorSource(null);
    setActiveEditorItemId(null);
    setEditing(pendingDraft.returnEditing && editorNavMode !== "entity");
    if (editorNavMode === "entity") {
      navigation.replaceSection(returnSectionId);
    }
  };

  const createStructurePosition = async () => {
    if (!structurePositionDraft || structureCreateSubmitting) return;
    const normalizedTitle = structurePositionDraft.item.title.trim();
    if (!normalizedTitle) {
      setFeedback("Укажите название позиции");
      return;
    }

    structureCreateSession.setSubmitting(true);
    await new Promise((resolve) => window.setTimeout(resolve, 250));
    const createdItem: CatalogItem = {
      ...structurePositionDraft.item,
      id: createRealPositionId(),
      title: normalizedTitle,
      price: structurePositionDraft.item.price || 0,
      hasDescription: descriptionHasContent(structurePositionDraft.item.description),
      translationFilledCount: 1,
    };
    writeCreatedCatalogItems([
      createdItem,
      ...readCreatedCatalogItems().filter((item) => item.id !== createdItem.id),
    ]);
    const nextPositionOrder = {
      ...positionOrderBySection,
      [createdItem.sectionId]: [
        createdItem.id,
        ...(positionOrderBySection[createdItem.sectionId] ?? allItems
          .filter((item) => item.sectionId === createdItem.sectionId)
          .map((item) => item.id))
          .filter((id) => id !== createdItem.id),
      ],
    };
    createCatalogItem(createdItem, { order: nextPositionOrder });
    structureCreateSession.complete(createdItem.id);
    setSelectedSectionId(createdItem.sectionId);
    setSelectedItemId(createdItem.id);
    setEditorSource("tree");
    setActiveEditorItemId(createdItem.id);
    setEditing(true);
    setLastItemBySection((current) => ({ ...current, [createdItem.sectionId]: createdItem.id }));
    writeRecentPositionId(createdItem.id, [...allItems, createdItem]);
    registerChange("catalog");
    if (editorNavMode === "entity") {
      navigation.replacePosition(createdItem.id);
    }
    setFeedback("Позиция создана в выбранном разделе");
  };

  // «Добавить позицию» открывает локальный черновик. В каталог он попадёт
  // только после явного подтверждения в шапке редактора.
  const addPositionToSection = (sectionId: string, initialTitle = "") => {
    const targetSection = allSections.find((candidate) => candidate.id === sectionId) ?? null;
    if (!targetSection) return;
    if (structurePositionDraft) {
      setFeedback("Завершите создание или нажмите «Отменить»");
      return;
    }
    const restriction = getPositionCreateRestriction(sectionId, allSections);
    if (restriction) {
      setFeedback(restriction);
      return;
    }
    const draft = { ...makeDraftItem(targetSection), title: initialTitle };
    structureCreateSession.begin({
      mode: "structure",
      draft,
      context: {
        targetSectionId: sectionId,
        returnSectionId: selectedSectionId,
        returnItemId: selectedItemId,
        returnEditing: editing,
      },
    });
    setSelectedSectionId(sectionId);
    setSelectedItemId(null);
    setActiveEditorItemId(null);
    setEditing(true);
    // Radix закрывает контекстное меню после onSelect; повторяем выбор на
    // следующем кадре, чтобы завершающий клик по строке раздела не закрыл редактор.
    window.requestAnimationFrame(() => {
      setSelectedSectionId(sectionId);
      setSelectedItemId(null);
      setActiveEditorItemId(null);
      setEditing(true);
    });
  };
  const openCreatePositionDialog = (initialSectionId: string | null) => {
    const isLeaf = initialSectionId && !allSections.some((candidate) => candidate.parentId === initialSectionId);
    setPositionCreationDialog({ initialSectionId: isLeaf ? initialSectionId : null });
  };
  const addPosition = () => {
    if (selectedSectionId) openCreatePositionDialog(selectedSectionId);
    else openCreatePositionDialog(null);
  };
  const setItemSelected = (id: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const setAllSectionSelected = (selected: boolean) => {
    setSelectedIds(selected ? new Set(activeSectionItems.map((item) => item.id)) : new Set());
  };
  const showPlaceholderFeedback = (message: string) => {
    setFeedback(message);
  };

  useEffect(() => {
    writeJsonRecord(CATALOG_PREVIOUS_AVAILABILITY_STORAGE_KEY, previousAvailabilityByItem);
  }, [previousAvailabilityByItem]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_STATUS_STORAGE_KEY, sectionStatusOverrides);
  }, [sectionStatusOverrides]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_VISIBILITY_STORAGE_KEY, sectionVisibilityBySection);
  }, [sectionVisibilityBySection]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_DRAFT_STORAGE_KEY, sectionDraftOverrides);
  }, [sectionDraftOverrides]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_AVAILABILITY_STORAGE_KEY, sectionAvailabilityBySection);
  }, [sectionAvailabilityBySection]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_OUTSIDE_SCHEDULE_STORAGE_KEY, sectionOutsideScheduleBySection);
  }, [sectionOutsideScheduleBySection]);

  useEffect(() => {
    const validSchedules = Object.fromEntries(
      Object.entries(sectionWeeklyScheduleBySection).filter(([, schedule]) => isWeeklyScheduleValid(schedule)),
    );
    writeJsonRecord(CATALOG_SECTION_WEEKLY_SCHEDULE_STORAGE_KEY, validSchedules);
  }, [sectionWeeklyScheduleBySection]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_ORDER_STORAGE_KEY, sectionOrderByParent);
  }, [sectionOrderByParent]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_PARENT_STORAGE_KEY, sectionParentOverrides);
  }, [sectionParentOverrides]);

  const updateSectionDraft = (sectionId: string, patch: SectionDraftOverride) => {
    setSectionDraftOverrides((current) => ({
      ...current,
      [sectionId]: { ...current[sectionId], ...patch },
    }));
    registerChange("catalog");
  };

  const archiveSection = (target: TreeSection | null = section) => {
    if (!target) return;
    const subtreeIds = getSectionSubtreeIds(target.id, allSections);
    setSectionStatusOverrides((prev) => {
      const next = { ...prev };
      subtreeIds.forEach((id) => {
        next[id] = "archive";
      });
      return next;
    });
    setSelectedIds(new Set());
    setSectionArchiveOpen(true);
    const selectionInSubtree = Boolean(selectedSectionId && subtreeIds.has(selectedSectionId));
    if (editorNavMode === "unified" && selectionInSubtree) {
      const replacement = activeSections.find((candidate) => !subtreeIds.has(candidate.id)) ?? null;
      setSelectedSectionId(replacement?.id ?? null);
      setSelectedItemId(null);
      setEditing(false);
    } else {
      setSelectedSectionId(target.id);
    }
    if (editorNavMode === "entity" || (editorNavMode === "unified" && selectedItem && subtreeIds.has(selectedItem.sectionId))) {
      setSelectedItemId(null);
      setEditing(false);
    }
    registerChange("catalog");
    setFeedback("Раздел перенесён в архив");
  };

  const restoreSection = (target: TreeSection) => {
    const subtreeIds = getSectionSubtreeIds(target.id, allSections);
    if (target.parentId) {
      const parent = allSections.find((candidate) => candidate.id === target.parentId);
      if (parent?.status === "archive" && !subtreeIds.has(parent.id)) {
        setFeedback("Сначала восстановите родительский раздел");
        return;
      }
    }
    setSectionStatusOverrides((prev) => {
      const next = { ...prev };
      subtreeIds.forEach((id) => {
        next[id] = "active";
      });
      return next;
    });
    setSelectedSectionId(target.id);
    if (editorNavMode === "entity") setSelectedItemId(null);
    registerChange("catalog");
    setFeedback("Раздел восстановлен");
  };

  const requestSectionDelete = (target: TreeSection) => {
    const subtreeIds = getSectionSubtreeIds(target.id, allSections);
    const positionCount = allItems.filter((item) => subtreeIds.has(item.sectionId)).length;
    setPendingSectionDelete({
      section: target,
      archived: target.status === "archive",
      summary: {
        positionCount,
        subsectionCount: Math.max(0, subtreeIds.size - 1),
      },
    });
  };

  const confirmDeleteSection = (target: TreeSection) => {
    const subtreeIds = getSectionSubtreeIds(target.id, allSections);
    const deletedItemIdSet = new Set(
      allItems.filter((item) => subtreeIds.has(item.sectionId)).map((item) => item.id),
    );
    setDeletedSectionIds((prev) => new Set([...prev, ...subtreeIds]));
    deleteCatalogItems(deletedItemIdSet);
    writeCreatedCatalogItems(readCreatedCatalogItems().filter((item) => !deletedItemIdSet.has(item.id)));
    setSectionStatusOverrides((prev) => {
      const next = { ...prev };
      subtreeIds.forEach((id) => delete next[id]);
      return next;
    });
    setSectionDraftOverrides((prev) => {
      const next = { ...prev };
      subtreeIds.forEach((id) => delete next[id]);
      return next;
    });
    setSectionParentOverrides((prev) => {
      const next = { ...prev };
      subtreeIds.forEach((id) => delete next[id]);
      return next;
    });
    setSectionOrderByParent((prev) => Object.fromEntries(
      Object.entries(prev).map(([parentId, ids]) => [parentId, ids.filter((id) => !subtreeIds.has(id))]),
    ));
    setPendingSectionDelete(null);
    const selectionWasDeleted = Boolean(selectedSectionId && subtreeIds.has(selectedSectionId));
    const itemWasDeleted = Boolean(selectedItemId && deletedItemIdSet.has(selectedItemId));
    if (selectionWasDeleted || itemWasDeleted) {
      const replacement = activeSections.find((candidate) => !subtreeIds.has(candidate.id)) ?? null;
      setSelectedSectionId(replacement?.id ?? null);
      setSelectedItemId(null);
      setEditing(false);
    }
    setSelectedIds(new Set());
    registerChange("catalog");
    setFeedback("Раздел удалён навсегда");
  };

  const requestDeleteArchivedSection = requestSectionDelete;

  const openSectionAvailability = (target: TreeSection) => {
    openSectionEditor(target.id);
    setSectionEditorTab("availability");
  };

  const setSectionVisibility = (target: TreeSection, visible: boolean) => {
    setSectionVisibilityBySection((current) => ({
      ...current,
      [target.id]: visible ? "visible" : "hidden",
    }));
    registerChange("catalog");
    setFeedback(visible ? "Раздел снова показывается на витрине" : "Раздел скрыт с витрины");
  };

  const setSectionAvailability = (target: TreeSection, mode: AvailabilityMode) => {
    setSectionAvailabilityBySection((current) => ({ ...current, [target.id]: mode }));
    registerChange("catalog");
    const savedSchedule = sectionWeeklyScheduleBySection[target.id];
    if (mode === "schedule") {
      openSectionAvailability(target);
      setFeedback(!savedSchedule || !isWeeklyScheduleValid(savedSchedule)
        ? "Настройте расписание для раздела"
        : "Раздел доступен по расписанию");
      return;
    }
    setFeedback(mode === "always" ? "Раздел доступен для заказа" : "Раздел поставлен на стоп");
  };

  const handleSectionAction = (action: string, anchor?: MovePopoverAnchor) => {
    if (action === "Добавить позицию") {
      addPosition();
      return;
    }
    if (action === "Добавить подраздел") {
      if (selectedSectionId) openSectionCreation(selectedSectionId);
      return;
    }
    if (action === "Переместить" || action === "Переместить раздел") {
      if (section && anchor) {
        setMoveRequest({
          operation: "section",
          entityIds: [section.id],
          currentSectionIds: [section.parentId ?? "__root__"],
          movingSectionId: section.id,
          anchor,
        });
      }
      return;
    }
    if (action === "Настроить доступность") {
      if (section) openSectionAvailability(section);
      return;
    }
    if (action === "Скрыть с витрины" || action === "Показать на витрине" || action === "Показывать на витрине") {
      if (section) setSectionVisibility(section, action !== "Скрыть с витрины");
      return;
    }
    if (action === "availability:settings") {
      if (section) openSectionAvailability(section);
      return;
    }
    if (action.startsWith("availability:")) {
      const mode = action.slice("availability:".length);
      if (section && (mode === "always" || mode === "unavailable" || mode === "schedule")) {
        setSectionAvailability(section, mode);
      }
      return;
    }
    if (action === "Архивировать" || action === "Архивировать раздел") {
      archiveSection();
      return;
    }
    if (action === "Восстановить из архива" && section) {
      restoreSection(section);
      return;
    }
    if ((action === "Удалить навсегда" || action === "Удалить раздел") && section) {
      requestSectionDelete(section);
      return;
    }
    showPlaceholderFeedback(`${action}: placeholder`);
  };

  const handleUnifiedSectionAction = (target: TreeSection, action: string, anchor?: MovePopoverAnchor) => {
    if (action === "Добавить позицию") {
      addPositionToSection(target.id);
      return;
    }
    if (action === "Добавить подраздел") {
      openSectionCreation(target.id);
      return;
    }
    if (action === "Настроить раздел" || action === "Изменить раздел") {
      openSectionEditor(target.id);
      setSectionEditorTab("basic");
      return;
    }
    if (action === "Настроить доступность") {
      openSectionAvailability(target);
      return;
    }
    if (action === "Скрыть с витрины" || action === "Показать на витрине" || action === "Показывать на витрине") {
      setSectionVisibility(target, action !== "Скрыть с витрины");
      return;
    }
    if (action === "availability:settings") {
      openSectionAvailability(target);
      return;
    }
    if (action.startsWith("availability:")) {
      const mode = action.slice("availability:".length);
      if (mode === "always" || mode === "unavailable" || mode === "schedule") {
        setSectionAvailability(target, mode);
      }
      return;
    }
    if (action === "Переместить" || action === "Переместить раздел") {
      if (anchor) {
        setMoveRequest({
          operation: "section",
          entityIds: [target.id],
          currentSectionIds: [target.parentId ?? "__root__"],
          movingSectionId: target.id,
          anchor,
        });
      }
      return;
    }
    if (action === "Архивировать" || action === "Архивировать раздел") {
      archiveSection(target);
      return;
    }
    if (action === "Восстановить раздел" || action === "Восстановить из архива") {
      restoreSection(target);
      return;
    }
    if (action === "Удалить раздел" || action === "Удалить навсегда") {
      requestSectionDelete(target);
      return;
    }
    showPlaceholderFeedback(`${action}: placeholder`);
  };

  const restoreItem = (item: CatalogItem) => {
    const activeCount = allItems.filter((candidate) => candidate.status !== "archive" && candidate.id !== item.id).length;
    if (activeCount >= ACTIVE_POSITION_LIMIT) {
      setFeedback("Нельзя восстановить позицию: достигнут лимит тарифа");
      return;
    }
    setCatalogItemStatus(item.id, "active");
    setFeedback("Позиция восстановлена");
  };

  const toggleStopItem = (item: CatalogItem) => {
    if ((item.status !== "active" && item.status !== "stopped") || stopBusyIds.has(item.id)) return;
    setStopBusyIds((current) => new Set(current).add(item.id));
    window.setTimeout(() => {
      if (item.status === "stopped") {
        const previous = previousAvailabilityByItem[item.id] ?? { status: "active", scheduled: false };
        setCatalogItemStatus(item.id, previous.status, previous.scheduled);
        setPreviousAvailabilityByItem((prev) => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
        setFeedback("Позиция снова доступна для заказа");
      } else {
        setPreviousAvailabilityByItem((prev) => ({
          ...prev,
          [item.id]: { status: item.status, scheduled: item.scheduled },
        }));
        setCatalogItemStatus(item.id, "stopped", false);
        setFeedback("Позиция поставлена на стоп");
      }
      setStopBusyIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, 250);
  };
  const requestPermanentDelete = (item: CatalogItem) => {
    if (item.status !== "archive") return;
    setPendingPermanentDelete(item);
  };
  const confirmPermanentDelete = (item: CatalogItem) => {
    deleteCatalogItem(item.id);
    setPendingPermanentDelete(null);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    setLastItemBySection((current) => {
      const next = { ...current };
      if (next[item.sectionId] === item.id) delete next[item.sectionId];
      return next;
    });
    const replacement = allItems.find((candidate) =>
      candidate.id !== item.id &&
      candidate.sectionId === item.sectionId &&
      candidate.status !== "archive"
    );
    setSelectedItemId(replacement?.id ?? null);
    setFeedback("Позиция удалена навсегда");
  };
  const handleBulkAction = (action: string, anchor?: MovePopoverAnchor) => {
    const selectedCount = selectedIds.size;
    const selectedLabel = `${selectedCount} ${plural(selectedCount, "позиция", "позиции", "позиций")}`;
    const setSelectedStatus = (status: CatalogItem["status"], message: string) => {
      selectedIds.forEach((id) => setCatalogItemStatus(id, status));
      setFeedback(message);
      setSelectedIds(new Set());
    };

    if (action === "Переместить в раздел" && anchor) {
      const ids = [...selectedIds];
      setMoveRequest({
        operation: "bulk",
        entityIds: ids,
        currentSectionIds: ids.map((id) => allItems.find((item) => item.id === id)?.sectionId).filter((id): id is string => Boolean(id)),
        anchor,
      });
      return;
    }

    if (action === "В меню" || action === "Убрать со стопа") {
      setSelectedStatus("active", `${selectedLabel} возвращены в меню`);
      selectedIds.forEach((id) => {
        const item = allItems.find((candidate) => candidate.id === id);
        if (item) setCatalogItemStatus(id, "active", false);
      });
      return;
    }
    if (action === "В архив" || action === "Архивировать") {
      setSelectedStatus("archive", `${selectedLabel} перенесены в архив`);
      setArchiveOpen(true);
      return;
    }
    if (action === "Поставить на стоп") {
      setSelectedStatus("stopped", `${selectedLabel} поставлены на стоп`);
      return;
    }
    if (action === "Скоро будет") {
      setSelectedStatus("coming-soon", `${selectedLabel} отмечены как скоро доступные`);
      return;
    }
    if (action === "По расписанию") {
      selectedIds.forEach((id) => setCatalogItemStatus(id, "active", true));
      setFeedback(`${selectedLabel} доступны по расписанию`);
      setSelectedIds(new Set());
      return;
    }
    showPlaceholderFeedback(`${action}: ${selectedLabel}`);
  };

  const moveForbiddenTargets = useMemo(() => {
    if (moveRequest?.operation !== "section") return {};
    return Object.fromEntries(allSections.flatMap((target) => {
      if (allItems.some((item) => item.sectionId === target.id)) {
        return [[target.id, "Нельзя переместить раздел в раздел с позициями"]];
      }
      return [];
    }));
  }, [allItems, allSections, moveRequest?.operation]);

  const performMoveRequest = async (targetSectionId: string | null) => {
    if (!moveRequest) return;
    const snapshot = captureTreeMoveSnapshot();
    try {
      if (moveRequest.operation === "section") {
        const movingSectionId = moveRequest.movingSectionId;
        if (!movingSectionId) return;
        moveTreeSection(movingSectionId, targetSectionId, null, "inside", false);
        await new Promise<void>((resolve) => window.setTimeout(resolve, 350));
        registerChange("catalog");
        const destinationName = targetSectionId
          ? allSections.find((candidate) => candidate.id === targetSectionId)?.name ?? "выбранный раздел"
          : null;
        offerTreeMoveUndo(
          destinationName ? `Раздел перемещён в «${destinationName}»` : "Раздел перемещён в корень каталога",
          snapshot,
        );
        setSelectedSectionId(movingSectionId);
        return;
      }

      if (!targetSectionId) return;
      const destination = allSections.find((candidate) => candidate.id === targetSectionId);
      if (!destination) return;
      const targets = moveRequest.entityIds
        .map((id) => allItems.find((item) => item.id === id))
        .filter((item): item is CatalogItem => item != null && item.sectionId !== targetSectionId);
      moveCatalogItems(targets.map((target) => target.id), targetSectionId, { sectionName: destination.name });
      await new Promise<void>((resolve) => window.setTimeout(resolve, 350));
      registerChange("catalog");
      const count = moveRequest.entityIds.length;
      offerTreeMoveUndo(
        moveRequest.operation === "bulk"
          ? `${count} ${plural(count, "позиция перемещена", "позиции перемещены", "позиций перемещено")} в «${destination.name}»`
          : `Позиция перемещена в «${destination.name}»`,
        snapshot,
      );
      if (moveRequest.operation === "bulk") setSelectedIds(new Set());
    } catch (error) {
      restoreTreeMoveSnapshot(snapshot);
      throw error;
    }
  };

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    if (!treeMoveUndo) return;
    const timeout = window.setTimeout(() => setTreeMoveUndo(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [treeMoveUndo]);

  const openSectionFromEditorBreadcrumb = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    onScopeChange(sectionId);
    setSelectedItemId(null);
    setEditorSource(null);
    setActiveEditorItemId(null);
    setSelectedIds(new Set());
    setEditing(false);
    setSectionEditorTab("composition");
  };

  const revealSectionFromEditorBreadcrumb = (sectionId: string) => {
    openSectionFromEditorBreadcrumb(sectionId);
    setRevealSectionId(null);
    window.requestAnimationFrame(() => setRevealSectionId(sectionId));
  };

  const renderPositionEditor = (item: CatalogItem) => {
    const orderedIds = orderSectionItems(
      allItems.filter((candidate) => candidate.sectionId === item.sectionId),
      positionOrderBySection[item.sectionId],
    ).map((candidate) => candidate.id);
    const structureIntent: OpenPositionIntent = {
      origin: "structure",
      currentId: item.id,
      orderedIds: orderedIds.includes(item.id) ? orderedIds : [...orderedIds, item.id],
      sectionId: item.sectionId,
      returnContext: { label: `Назад в раздел “${item.sectionName}”` },
      revision: catalogRevision,
    };
    return (
      <PositionEditorHost
        intent={structureIntent}
        onCurrentIdChange={openItem}
        onClose={() => {
          setHighlightItemId(item.id);
          setSelectedItemId(null);
          setEditorSource(null);
          setActiveEditorItemId(null);
          setEditing(false);
        }}
        onFeedback={setFeedback}
        onRequestPermanentDelete={requestPermanentDelete}
        structureSections={allSections}
        positionOrderBySection={positionOrderBySection}
        onOpenStructuralItem={openItemFromEditorBreadcrumb}
        onOpenStructuralSection={openSectionFromEditorBreadcrumb}
        onRevealStructuralSection={revealSectionFromEditorBreadcrumb}
      />
    );
  };

  const renderStructurePositionCreation = () => {
    if (!structurePositionDraft) return null;
    const updateDraft = (patch: Partial<CatalogItem>) => {
      structureCreateSession.updateDraft(patch);
    };
    const draftItem = structurePositionDraft.item;
    return (
      <div data-structure-position-draft className="flex min-w-0 flex-1 overflow-hidden">
        <PositionEditor
          item={draftItem}
          mode="create"
          allItems={allItems}
          upsell={{}}
          onUpsellChange={() => {}}
          stopBusy={false}
          onArchiveItem={() => {}}
          onRestoreItem={() => {}}
          onMoveItem={() => {}}
          onToggleStop={() => updateDraft({ status: draftItem.status === "stopped" ? "active" : "stopped" })}
          onSetAvailabilityMode={(_item, mode) => updateDraft({
            status: mode === "unavailable" ? "stopped" : "active",
            scheduled: mode === "schedule",
          })}
          unavailableDisplayMode="hidden"
          outsideScheduleMode="hidden"
          weeklySchedule={createDefaultWeeklySchedule()}
          onUnavailableDisplayModeChange={() => {}}
          onOutsideScheduleModeChange={() => {}}
          onWeeklyScheduleChange={() => {}}
          onRequestPermanentDelete={() => {}}
          onDraftChange={updateDraft}
          onItemChange={(_item, patch) => updateDraft(patch)}
          onCreatePosition={createStructurePosition}
          onBackCreate={cancelStructurePositionCreation}
          onCancelCreate={cancelStructurePositionCreation}
          createDisabled={!draftItem.title.trim()}
          createSubmitting={structureCreateSubmitting}
          breadcrumb={(
            <>
              <span className="shrink-0 text-[13px] text-[#d6d3d1]" aria-hidden="true">·</span>
              <span
                className="min-w-0 truncate text-[13px] font-normal leading-5 text-[#79716b] max-[1100px]:text-[11px]"
                title={draftItem.sectionName}
              >
                {draftItem.sectionName}
              </span>
            </>
          )}
        />
      </div>
    );
  };

  const handleOverviewActiveItemChange = useCallback((id: string | null) => {
    setSelectedItemId(id);
    setEditorSource(id ? "table" : null);
  }, []);

  const handleUnifiedTableScopeChange = (id: string | null) => {
    if (selectedSectionId === null) {
      setGlobalTableScopeId(id);
      setSelectedIds(new Set());
      onScopeChange(id);
      return;
    }
    setSelectedSectionId(id);
    setSelectedItemId(null);
    setEditorSource(null);
    setActiveEditorItemId(null);
    setSelectedIds(new Set());
    setSectionEditorTab("composition");
    setSectionEditorScrollTop(0);
    onScopeChange(id);
  };

  const restoreUnifiedStructureContext = (context: StructureReturnContext, openItemId: string | null) => {
    if (context.sectionEditorTab) setSectionEditorTab(context.sectionEditorTab);
    if (context.treeQuery !== undefined) writeJsonRecord(treeStorageKeys?.query ?? CATALOG_SECTION_TREE_QUERY_STORAGE_KEY, context.treeQuery);
    if (context.treeExpanded) writeJsonRecord(treeStorageKeys?.expanded ?? CATALOG_SECTION_TREE_EXPANDED_STORAGE_KEY, context.treeExpanded);
    if (context.treeScrollTop !== undefined) writeJsonRecord(treeStorageKeys?.scroll ?? CATALOG_SECTION_TREE_SCROLL_STORAGE_KEY, context.treeScrollTop);
    setSelectedSectionId(context.sectionId);
    setSelectedItemId(openItemId);
    setEditorSource(openItemId ? "tree" : null);
    onScopeChange(context.sectionId);
  };

  const scopedItemCount = selectedSectionId
    ? getQueueItemIds(filterId, allItems, query, selectedSectionId, "none", mandatoryFilterId).length
    : getQueueItemIds(filterId, allItems, query, null, "none", mandatoryFilterId).length;
  const subsectionDisabledReason = section ? (() => {
    const availability = getParentAvailability(section, allItems, allSections);
    return availability.available ? null : availability.label;
  })() : null;
  const tableHeader = section ? (
    <UnifiedSectionTableHeader
      section={section}
      itemCount={allItems.filter((item) => item.sectionId === section.id && item.status !== "archive").length}
      onAction={(action, anchor) => handleUnifiedSectionAction(section, action, anchor)}
      allowPositionCreation={allowPositionCreation && directChildSections.length === 0}
    />
  ) : null;

  const unifiedOverviewWorkspace = (
    <OverviewWorkspace
      navigation={navigation}
      filterId={filterId}
      createdItems={createdItems}
      onFilterChange={onFilterChange}
      sectionScopeId={selectedSectionId ?? globalTableScopeId}
      onSectionScopeChange={handleUnifiedTableScopeChange}
      query={query}
      onQueryChange={onQueryChange}
      onReturnToSections={() => onFilterChange("quick:all")}
      onRestoreStructureContext={restoreUnifiedStructureContext}
      onOpenSectionInSections={(sectionId, highlightedItemId = null) => {
        handleUnifiedTableScopeChange(sectionId);
        setHighlightItemId(highlightedItemId);
      }}
      onRegisterCreateNavigationGuard={onRegisterCreateNavigationGuard}
      pendingOpen={pendingOpen}
      onPendingOpenHandled={onPendingOpenHandled}
      onCreateClosed={onCreateClosed}
      tableOpenSignal={tableOpenSignal + unifiedTableOpenSignal}
      positionsWorkspaceMode="legacy"
      embedded
      tableHeader={tableHeader}
      onAddPosition={() => openCreatePositionDialog(section?.id ?? scopeSectionId)}
      positionCreateDisabledReason={section?.status === "archive" || directChildSections.length > 0 ? "Выберите конечный раздел" : null}
      allowPositionCreation={allowPositionCreation && (!section || (section.status !== "archive" && directChildSections.length === 0))}
      onActiveItemChange={handleOverviewActiveItemChange}
      structureSections={allSections}
      structuralPositionOrderBySection={positionOrderBySection}
      mandatoryFilterId={mandatoryFilterId}
      titleOverride={titleOverride}
      overviewContextStorageKey={overviewContextStorageKey}
      onOpenStructuralItem={openItemFromEditorBreadcrumb}
      onOpenStructuralSection={openSectionFromEditorBreadcrumb}
      onRevealStructuralSection={revealSectionFromEditorBreadcrumb}
    />
  );

  const renderUnifiedSectionSettings = () => section ? (
    <SectionEditor
      section={section}
      childSections={directChildSections}
      highlightItemId={highlightItemId}
      compositionItems={sectionTableItems}
      compositionQuery={sectionTableQuery}
      scrollTop={sectionEditorScrollTop}
      activeTab={sectionEditorTab}
      availabilityMode={sectionAvailabilityBySection[section.id] ?? "always"}
      outsideScheduleMode={sectionOutsideScheduleBySection[section.id] ?? "hidden"}
      weeklySchedule={sectionWeeklyScheduleBySection[section.id] ?? createDefaultWeeklySchedule()}
      onTabChange={setSectionEditorTab}
      onNameChange={(name) => updateSectionDraft(section.id, { name })}
      onImageChange={(imageUrl) => updateSectionDraft(section.id, { imageUrl })}
      onAvailabilityModeChange={(mode) => {
        setSectionAvailabilityBySection((current) => ({ ...current, [section.id]: mode }));
        registerChange("catalog");
      }}
      onOutsideScheduleModeChange={(mode) => {
        setSectionOutsideScheduleBySection((current) => ({ ...current, [section.id]: mode }));
        registerChange("catalog");
      }}
      onWeeklyScheduleChange={(schedule) => {
        setSectionWeeklyScheduleBySection((current) => ({ ...current, [section.id]: schedule }));
        registerChange("catalog");
      }}
      onAddPosition={() => addPositionToSection(section.id)}
      onOpenInPositions={() => {}}
      onSelectChildSection={handleTreeSelectSection}
      onChildSectionAction={handleUnifiedSectionAction}
      positionCreateDisabledReason={getPositionCreateRestriction(section.id, allSections)}
      subsectionCreateDisabledReason={subsectionDisabledReason}
      onCompositionQueryChange={setSectionTableQuery}
      dropTarget={dropTarget}
      dragActiveRef={dragActiveRef}
      onScrollTopChange={setSectionEditorScrollTop}
      onArchive={() => archiveSection(section)}
      onRestore={() => restoreSection(section)}
      onAction={(action, anchor) => handleUnifiedSectionAction(section, action, anchor)}
      onItemAction={(item, action, anchor) => {
        if (action === "Редактировать в Позициях" || action === "Открыть позицию" || action === "Редактировать") openItem(item.id);
        else if (action === "Переместить в раздел" && anchor) setMoveRequest({ operation: "position", entityIds: [item.id], currentSectionIds: [item.sectionId], anchor });
      }}
      showOpenInPositions={false}
      forcePositionsLabel
      compositionCountOverride={scopedItemCount}
      allowPositionCreation={allowPositionCreation && directChildSections.length === 0}
      hideNavigationTabs
    />
  ) : unifiedOverviewWorkspace;

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbf9]">
      <div className="flex min-h-0 flex-1">
        {editorNavMode === "entity" || editorNavMode === "unified" ? (
          <UnifiedCatalogTreePanel
            sections={editorNavMode === "entity" || editorNavMode === "unified" ? allSectionTree : activeSectionTree}
            items={allItems}
            allPositionsSelected={selectedSectionId === null}
            selectedSectionId={selectedSectionId}
            sectionEditingEnabled
            includeArchived={editorNavMode === "entity" || editorNavMode === "unified"}
            onSelectSection={structurePositionDraft
              ? () => setFeedback("Завершите создание или нажмите «Отменить»")
              : handleTreeSelectSection}
              onSelectAllPositions={selectAllPositions}
            onCreateSection={() => openSectionCreation()}
            createSectionButtonRef={createSectionButtonRef}
            onSectionAction={handleUnifiedSectionAction}
            renderSectionActions={(section, options, onAction) => (
              <SectionActionMenuContent
                section={section}
                allowPositionCreation={options.allowPositionCreation}
                onAction={onAction}
              />
            )}
            getSectionPath={getSectionFullPath}
            positionCreationEnabled={allowPositionCreation}
          />
        ) : editing ? (
          <SectionPositionNav
            sectionId={selectedSectionId}
            sectionName={section?.name ?? selectedItem?.sectionName ?? "Раздел"}
            sections={activeSectionTree}
            allItems={allItems}
            items={sectionItems}
            archiveOpen={archiveOpen}
            selectedItemId={selectedItemId}
            onBackToSections={() => {
              setSelectedItemId(null);
              setEditing(false);
            }}
            onSelectSection={selectSectionInEditor}
            onSelectItem={openItem}
            onAddPosition={addPosition}
            onOpenOverview={openSectionOverview}
            onSectionAction={handleSectionAction}
            onArchiveOpenChange={setArchiveOpen}
            onRestoreItem={restoreItem}
            onToggleStop={toggleStopItem}
            onReorderItems={(draggedId, targetId) => {
              if (selectedSectionId) reorderItemsInSection(selectedSectionId, draggedId, targetId);
            }}
            stopBusyIds={stopBusyIds}
          />
        ) : (
          <CatalogTreePanel
            sections={activeSectionTree}
            archivedSections={archivedSectionTree}
            selectedId={selectedSectionId}
            archiveOpen={sectionArchiveOpen}
            onSelectSection={editorNavMode === "section" ? selectSectionInEditor : selectSectionOverview}
            onArchiveOpenChange={setSectionArchiveOpen}
            onRestoreSection={restoreSection}
            onDeleteArchivedSection={requestDeleteArchivedSection}
            onCreateAction={(action) => showPlaceholderFeedback(`${action}: placeholder`)}
          />
        )}
        <DndContext
          sensors={dndSensors}
          collisionDetection={catalogCollisionDetection}
          autoScroll
          onDragStart={handleDndDragStart}
          onDragMove={handleDndDragMove}
          onDragOver={handleDndDragOver}
          onDragEnd={handleDndDragEnd}
          onDragCancel={handleDndDragCancel}
        >
        {structurePositionDraft ? (
          renderStructurePositionCreation()
        ) : editorNavMode === "entity" ? (
          selectedItem ? (
            renderPositionEditor(selectedItem)
          ) : section ? (
            <SectionEditor
              section={section}
              childSections={directChildSections}
              highlightItemId={highlightItemId}
              compositionItems={sectionTableItems}
              compositionQuery={sectionTableQuery}
              scrollTop={sectionEditorScrollTop}
              activeTab={sectionEditorTab}
              availabilityMode={sectionAvailabilityBySection[section.id] ?? "always"}
              outsideScheduleMode={sectionOutsideScheduleBySection[section.id] ?? "hidden"}
              weeklySchedule={sectionWeeklyScheduleBySection[section.id] ?? createDefaultWeeklySchedule()}
              onTabChange={setSectionEditorTab}
              onNameChange={(name) => updateSectionDraft(section.id, { name })}
              onImageChange={(imageUrl) => updateSectionDraft(section.id, { imageUrl })}
              onAvailabilityModeChange={(mode) => {
                setSectionAvailabilityBySection((current) => ({ ...current, [section.id]: mode }));
                registerChange("catalog");
              }}
              onOutsideScheduleModeChange={(mode) => {
                setSectionOutsideScheduleBySection((current) => ({ ...current, [section.id]: mode }));
                registerChange("catalog");
              }}
              onWeeklyScheduleChange={(schedule) => {
                setSectionWeeklyScheduleBySection((current) => ({ ...current, [section.id]: schedule }));
                registerChange("catalog");
              }}
              onAddPosition={() => addPositionToSection(section.id)}
              onOpenInPositions={() => onOpenSectionInOverview(section.id)}
              onSelectChildSection={handleTreeSelectSection}
              onChildSectionAction={handleUnifiedSectionAction}
              positionCreateDisabledReason={getPositionCreateRestriction(section.id, allSections)}
              subsectionCreateDisabledReason={(() => {
                const availability = getParentAvailability(section, allItems, allSections);
                return availability.available ? null : availability.label;
              })()}
              onCompositionQueryChange={(value) => {
                setSectionTableQuery(value);
              }}
              dropTarget={dropTarget}
              dragActiveRef={dragActiveRef}
              onScrollTopChange={setSectionEditorScrollTop}
              onArchive={() => archiveSection(section)}
              onRestore={() => restoreSection(section)}
              onAction={(action, anchor) => handleUnifiedSectionAction(section, action, anchor)}
                onItemAction={(item, action, anchor) => {
                  if (action === "Редактировать в Позициях" || action === "Открыть позицию" || action === "Редактировать") {
                    openItem(item.id);
                  return;
                }
                if (action === "Переместить в раздел" && anchor) setMoveRequest({ operation: "position", entityIds: [item.id], currentSectionIds: [item.sectionId], anchor });
              }}
            />
          ) : (
            <UnifiedCatalogSelectionState />
          )
        ) : editorNavMode === "unified" ? (
          (editorSource === "tree" || editorSource === "breadcrumb") && selectedItem
            ? renderPositionEditor(selectedItem)
          : section && (directChildSections.length > 0 || sectionEditorTab !== "composition")
              ? renderUnifiedSectionSettings()
              : unifiedOverviewWorkspace
        ) : editing ? (
          selectedItem ? (
            renderPositionEditor(selectedItem)
          ) : editorNavExperiment ? (
            <EditorPositionEmptyState
              sectionName={section?.name ?? "Раздел"}
              itemCount={activeSectionItems.length}
              onAddItem={addPosition}
              onSectionSettings={() => handleSectionAction("Изменить раздел")}
            />
          ) : (
            <SectionEmptyState sectionName={section?.name ?? "Раздел"} onAddItem={addPosition} />
          )
        ) : (
            <SectionItemList
            section={section}
            items={activeSectionItems}
            selectedIds={selectedIds}
            feedback={feedback}
            onSelectedChange={setItemSelected}
            onSelectAll={setAllSectionSelected}
            onClearSelection={() => setSelectedIds(new Set())}
            onSectionAction={handleSectionAction}
            onBulkAction={handleBulkAction}
            onOpenItem={openItem}
          />
        )}
        <DragOverlay dropAnimation={dndReducedMotion ? null : DND_TRANSITION} modifiers={[overlayCursorOffset]}>
          {activeDrag ? <CatalogDragOverlayRow drag={activeDrag} /> : null}
        </DragOverlay>
        </DndContext>
        {moveRequest && (
          <MoveToSectionPopover
            operation={moveRequest.operation}
            entityIds={moveRequest.entityIds}
            currentSectionIds={moveRequest.currentSectionIds}
            movingSectionId={moveRequest.movingSectionId}
            sections={allSections}
            forbiddenTargets={moveForbiddenTargets}
            anchor={moveRequest.anchor}
            onClose={() => setMoveRequest(null)}
            onMove={performMoveRequest}
            onError={() => setFeedback("Не удалось переместить. Попробуйте ещё раз")}
          />
        )}
        {selectedItem?.status === "archive" && (
          <div className="pointer-events-none fixed bottom-5 right-8 z-[100001] rounded-[10px] border border-[#e7e5e4] bg-white px-3 py-2 text-[13px] font-medium text-[#79716b] shadow-[0_12px_36px_rgba(41,37,36,0.12)]">
            Архивные позиции не отображаются в меню
          </div>
        )}
        {(editorNavMode === "entity" || editorNavMode === "unified" || editing) && treeMoveUndo && (
          <div className="fixed bottom-5 left-1/2 z-[100003] flex -translate-x-1/2 items-center gap-2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">
            <span>{treeMoveUndo.message}</span>
            <span aria-hidden="true" className="text-white/45">·</span>
            <button
              type="button"
              onClick={undoLastTreeMove}
              className="rounded-[5px] font-semibold text-[#c9c2ff] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
            >
              Отменить
            </button>
          </div>
        )}
        {(editorNavMode === "entity" || editorNavMode === "unified" || editing) && !treeMoveUndo && feedback && (
          <div className="fixed bottom-5 left-1/2 z-[100003] -translate-x-1/2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">
            {feedback}
          </div>
        )}
        {pendingPermanentDelete && (
          <PermanentDeleteDialog
            item={pendingPermanentDelete}
            onCancel={() => setPendingPermanentDelete(null)}
            onConfirm={confirmPermanentDelete}
          />
        )}
        {pendingSectionDelete && (
          <SectionDeleteDialog
            state={pendingSectionDelete}
            onCancel={() => setPendingSectionDelete(null)}
            onArchive={async (target) => {
              await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
              archiveSection(target);
              setPendingSectionDelete(null);
            }}
            onConfirm={async (target) => {
              await new Promise<void>((resolve) => window.requestAnimationFrame(() => resolve()));
              confirmDeleteSection(target);
            }}
          />
        )}
        {sectionCreationDialog && (
          <CreateSectionDialog
            sections={activeSectionTree}
            allItems={allItems}
            initialParentId={sectionCreationDialog.parentId}
            returnFocusRef={createSectionButtonRef}
            onCreate={createSectionFromDialog}
            onCancel={closeSectionCreation}
          />
        )}
        {positionCreationDialog && (
          <CreatePositionDialog
            sections={allSections}
            initialSectionId={positionCreationDialog.initialSectionId}
            onCancel={() => setPositionCreationDialog(null)}
            onContinue={(title, sectionId) => {
              setPositionCreationDialog(null);
              addPositionToSection(sectionId, title.trim());
            }}
          />
        )}
      </div>
    </main>
  );
}

function getStatusChips(item: CatalogItem): AuditChip[] {
  const chips: AuditChip[] = [];
  if (item.status === "stopped") chips.push({ label: "На стопе", tone: "stop" });
  if (item.status === "archive") chips.push({ label: "В архиве", tone: "archived" });
  if (item.status === "coming-soon") chips.push({ label: "Скоро будет", tone: "status" });
  if (item.scheduled) chips.push({ label: "С расписанием", tone: "status" });
  if (item.displayMode === "no-button") chips.push({ label: "Без кнопки", tone: "status" });
  if (item.displayMode === "no-price") chips.push({ label: "Без кнопки и цены", tone: "status" });
  return chips;
}

const CATALOG_TABLE_COLUMNS_STORAGE_KEY = catalogStorageKey("unifiedWorkspace.tableColumns.v2");
function readTableColumnVisibility(): VisibilityState {
  const stored = readJsonRecord<VisibilityState>(CATALOG_TABLE_COLUMNS_STORAGE_KEY, {});
  const next = { ...DEFAULT_TABLE_COLUMN_VISIBILITY };
  CATALOG_INFORMATION_COLUMN_IDS.forEach((columnId) => {
    if (typeof stored[columnId] === "boolean") next[columnId] = stored[columnId];
  });
  next.position = true;
  return next;
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

function SectionVisibilityMenuItem({
  visible,
  onChange,
}: {
  visible: boolean;
  onChange: (visible: boolean) => void;
}) {
  return (
    <DropdownMenu.CheckboxItem
      checked={visible}
      onCheckedChange={(checked) => onChange(checked === true)}
      className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
    >
      {visible ? <Eye size={15} weight="regular" className="shrink-0" /> : <EyeSlash size={15} weight="regular" className="shrink-0" />}
      <span className="min-w-0 flex-1">Показывать на витрине</span>
      <DropdownMenu.ItemIndicator className="ml-auto flex shrink-0 items-center text-[#57534d]">
        <Check size={14} weight="bold" />
      </DropdownMenu.ItemIndicator>
    </DropdownMenu.CheckboxItem>
  );
}

function SectionAvailabilitySubmenu({
  mode,
  onAction,
}: {
  mode: AvailabilityMode;
  onAction: (action: string) => void;
}) {
  const options: Array<{ value: AvailabilityMode; label: string }> = [
    { value: "unavailable", label: "На стопе" },
    { value: "schedule", label: "По расписанию" },
  ];
  return (
    <>
      <DropdownMenu.Item
        onSelect={() => onAction("availability:always")}
        className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
      >
        <ShoppingCartSimple size={15} weight="regular" className="shrink-0" />
        <span className="min-w-0 flex-1">Доступен для заказа</span>
        {mode === "always" && <Check size={14} weight="bold" className="shrink-0 text-[#57534d]" />}
      </DropdownMenu.Item>
      <DropdownMenu.Sub>
        <DropdownMenu.SubTrigger className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]">
          <Clock size={15} weight="regular" className="shrink-0" />
          <span className="min-w-0 flex-1">Ограничения доступности</span>
          <CaretRight size={13} className="shrink-0 text-[#a8a29e]" />
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent
            sideOffset={6}
            alignOffset={-4}
            className="z-[100003] min-w-[190px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
          >
            <DropdownMenu.RadioGroup value={mode} onValueChange={(value) => onAction(`availability:${value}`)}>
              {options.map((option) => (
                <DropdownMenu.RadioItem
                  key={option.value}
                  value={option.value}
                  className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                    <DropdownMenu.ItemIndicator><Check size={14} weight="bold" /></DropdownMenu.ItemIndicator>
                  </span>
                  {option.label}
                </DropdownMenu.RadioItem>
              ))}
            </DropdownMenu.RadioGroup>
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    </>
  );
}

function SectionActionMenuContent({
  section,
  allowPositionCreation = true,
  showSettingsEntry = false,
  onAction,
}: {
  section: TreeSection;
  allowPositionCreation?: boolean;
  showSettingsEntry?: boolean;
  onAction: (action: string, anchor?: MovePopoverAnchor) => void;
}) {
  if (section.status === "archive") {
    return (
      <>
        {showSettingsEntry && <><DropdownActionItem icon={GearSix} onSelect={() => onAction("Настроить раздел")}>Настройки раздела</DropdownActionItem><DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" /></>}
        <DropdownActionItem icon={ArrowCounterClockwise} onSelect={() => onAction("Восстановить раздел")}>Восстановить раздел</DropdownActionItem>
        <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
        <DropdownActionItem icon={Trash} tone="danger" onSelect={() => onAction("Удалить навсегда")}>Удалить навсегда</DropdownActionItem>
      </>
    );
  }
  return (
    <>
      {showSettingsEntry && <><DropdownActionItem icon={GearSix} onSelect={() => onAction("Настроить раздел")}>Настройки раздела</DropdownActionItem><DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" /></>}
      {allowPositionCreation && <DropdownActionItem icon={Plus} onSelect={() => onAction("Добавить позицию")}>Добавить позицию</DropdownActionItem>}
      {allowPositionCreation && <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />}
      <DropdownActionItem icon={ArrowsOutCardinal} onSelect={(event) => onAction("Переместить раздел", getMovePopoverAnchor(event))}>Переместить…</DropdownActionItem>
      <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
      <SectionVisibilityMenuItem
        visible={section.visibility !== "hidden"}
        onChange={(visible) => onAction(visible ? "Показывать на витрине" : "Скрыть с витрины")}
      />
      <SectionAvailabilitySubmenu mode={section.availabilityMode ?? "always"} onAction={onAction} />
      <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
      <DropdownActionItem icon={Archive} onSelect={() => onAction("Архивировать раздел")}>Архивировать раздел</DropdownActionItem>
      <DropdownActionItem icon={Trash} tone="danger" onSelect={() => onAction("Удалить раздел")}>Удалить раздел</DropdownActionItem>
    </>
  );
}

function AuditRowActionsMenu({ item, onAction, compositionMode }: { item: CatalogItem; onAction: (action: string, anchor?: MovePopoverAnchor) => void; compositionMode?: boolean }) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#57534d] transition hover:bg-[#efefea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          aria-label={`Действия для ${item.title}`}
        >
          <DotsThreeVertical size={18} weight="bold" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent>
        {compositionMode ? (
          <DropdownActionItem icon={ArrowsOutCardinal} onSelect={(event) => onAction("Переместить в раздел", getMovePopoverAnchor(event))}>Переместить в раздел…</DropdownActionItem>
        ) : (
          <>
            <DropdownActionItem onSelect={() => onAction("Открыть позицию")}>Открыть позицию</DropdownActionItem>
            <DropdownActionItem onSelect={() => onAction("Открыть в разделе")}>Открыть в разделе</DropdownActionItem>
            <DropdownActionItem onSelect={() => onAction("Редактировать")}>Редактировать</DropdownActionItem>
            <DropdownActionItem icon={ArrowsOutCardinal} onSelect={(event) => onAction("Переместить в раздел", getMovePopoverAnchor(event))}>Переместить в раздел…</DropdownActionItem>
          </>
        )}
        {!compositionMode && (
          <>
            <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
            <DropdownActionItem onSelect={() => onAction(item.status === "stopped" ? "Убрать со стопа" : "На стоп")}>
              {item.status === "stopped" ? "Убрать со стопа" : "На стоп"}
            </DropdownActionItem>
            <DropdownActionItem
              onSelect={() => onAction(item.status === "archive" ? "Восстановить" : "В архив")}
              tone={item.status === "archive" ? "default" : "danger"}
            >
              {item.status === "archive" ? "Восстановить" : "В архив"}
            </DropdownActionItem>
            <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
            <DropdownActionItem onSelect={() => onAction("Задать скидку")}>Задать скидку</DropdownActionItem>
            <DropdownActionItem onSelect={() => onAction("Управлять рекомендациями")}>
              Управлять рекомендациями
            </DropdownActionItem>
          </>
        )}
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

function getCompositionRowStatusLabel(item: CatalogItem) {
  if (item.status === "archive") return "В архиве";
  if (item.status === "stopped") return "На стопе";
  if (item.scheduled) return "По расписанию";
  if (item.status === "coming-soon") return "Скрыта";
  return null;
}

function getCompositionRowStatusClassName(item: CatalogItem) {
  if (item.status === "archive") return "bg-[#e7e5e4] text-[#78716c]";
  if (item.status === "stopped") return "bg-[#ffedd4] text-[#c2410c]";
  if (item.scheduled) return "bg-[#fef3c7] text-[#a16207]";
  if (item.status === "coming-soon") return "bg-[#f1f1ea] text-[#79716b]";
  return "";
}

function CompositionRow({
  item,
  sectionId,
  canDrag,
  highlightItemId,
  dropTarget,
  dragActiveRef,
  onItemAction,
}: {
  item: CatalogItem;
  sectionId: string;
  canDrag: boolean;
  highlightItemId?: string | null;
  dropTarget: CatalogDropTarget;
  dragActiveRef: RefObject<boolean>;
  onItemAction: (item: CatalogItem, action: string, anchor?: MovePopoverAnchor) => void;
}) {
  const status = getCompositionRowStatusLabel(item);
  const archived = item.status === "archive";
  const salePrice = item.hasDiscount && item.priceWithSale != null ? item.priceWithSale : null;
  const isDropHere = dropTarget?.kind === "item" && dropTarget.id === item.id;

  return (
    <CatalogDndRow kind="item" id={item.id} containerId={sectionId} surface="composition" disabled={!canDrag}>
      {({ setNodeRef, setActivatorNodeRef, dragProps, rowDragProps, isDragging, style }) => (
        <div
          ref={setNodeRef}
          {...rowDragProps}
          data-composition-row={item.id}
          style={style}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (dragActiveRef.current) return;
            onItemAction(item, "Открыть позицию");
          }}
          onKeyDown={(event) => {
            if ((event.target as HTMLElement | null)?.closest("[data-composition-dnd-handle]")) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onItemAction(item, "Открыть позицию");
          }}
          className={cn(
            "group relative flex h-11 min-h-11 max-h-11 cursor-pointer items-center gap-1 overflow-hidden border-b border-[#f0efe9] pl-0.5 pr-1 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
            "hover:bg-[#faf9f7]",
            highlightItemId != null && item.id === highlightItemId && "bg-[#fff7d6]",
            isDragging && "opacity-0",
            isDropHere && !dropTarget?.valid && "cursor-not-allowed",
          )}
        >
          <StructureDragHandle
            ref={setActivatorNodeRef}
            canDrag={canDrag}
            ariaLabel={`Изменить порядок позиции ${item.title}`}
            dragProps={dragProps}
            disabledTooltip="Очистите поиск, чтобы изменить порядок"
          />
          <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <CatalogThumbnail src={item.thumbnailUrl} kind="item" className="h-6 w-6 rounded-[6px]" />
            <span
              data-composition-title
              className={cn(
                "min-w-0 flex-1 truncate whitespace-nowrap text-[13px] leading-5 transition-colors group-hover:text-[#1c1917] group-hover:underline group-hover:decoration-[#d6d3d1] group-hover:underline-offset-2",
                archived ? "text-[#8a8179]" : "text-[#292524]",
              )}
              title={item.title}
            >
              {item.title}
            </span>
            {item.weightLabel && (
              <span data-composition-weight className="shrink-0 whitespace-nowrap text-[11px] leading-4 text-[#79716b]">
                {item.weightLabel}
              </span>
            )}
            {status && (
              <span data-composition-status className={cn(
                "inline-flex h-4 shrink-0 items-center whitespace-nowrap rounded-[4px] px-1.5 text-[10px] font-medium leading-4",
                getCompositionRowStatusClassName(item),
              )}>
                {status}
              </span>
            )}
          </div>
          <div className="flex shrink-0 items-center justify-end gap-2 tabular-nums">
            {salePrice != null && (
              <span data-composition-old-price className="whitespace-nowrap text-[12px] font-normal leading-4 text-[#a8a29e] line-through">
                {formatPrice(item.price)}
              </span>
            )}
            <span data-composition-current-price className="min-w-[68px] whitespace-nowrap text-right text-[13px] font-normal leading-5 text-[#79716b]">
              {formatPrice(salePrice ?? item.price)}
            </span>
          </div>
          <span
            data-no-dnd
            data-composition-more
            className="flex w-8 shrink-0 items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <AuditRowActionsMenu item={item} onAction={(action, anchor) => onItemAction(item, action, anchor)} compositionMode />
          </span>
        </div>
      )}
    </CatalogDndRow>
  );
}

function SectionCompositionList({
  sectionId,
  items,
  reorderEnabled,
  highlightItemId,
  dropTarget,
  dragActiveRef,
  onItemAction,
}: {
  sectionId: string;
  items: CatalogItem[];
  reorderEnabled: boolean;
  highlightItemId?: string | null;
  dropTarget: CatalogDropTarget;
  dragActiveRef: RefObject<boolean>;
  onItemAction: (item: CatalogItem, action: string, anchor?: MovePopoverAnchor) => void;
}) {
  return (
    <SortableContext
      items={items.map((item) => catalogDndId("item", item.id))}
      strategy={verticalListSortingStrategy}
    >
      <div className="flex flex-col py-1">
        {items.map((item) => (
          <CompositionRow
            key={item.id}
            item={item}
            sectionId={sectionId}
            canDrag={reorderEnabled}
            highlightItemId={highlightItemId}
            dropTarget={dropTarget}
            dragActiveRef={dragActiveRef}
            onItemAction={onItemAction}
          />
        ))}
      </div>
    </SortableContext>
  );
}

type BulkDialog =
  | { type: "schedule" }
  | { type: "discount" }
  | { type: "placeholder"; title: string; text: string }
  | { type: "delete" };

function BulkDialogModal({
  dialog,
  count,
  onClose,
  onApplyDiscount,
  onConfirmDelete,
}: {
  dialog: BulkDialog;
  count: number;
  onClose: () => void;
  onApplyDiscount: (percent: number) => void;
  onConfirmDelete: () => void;
}) {
  const [discount, setDiscount] = useState("10");

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const title =
    dialog.type === "schedule"
      ? "Расписание доступности"
      : dialog.type === "discount"
        ? "Задать скидку"
        : dialog.type === "delete"
          ? `Удалить ${count} ${plural(count, "позицию", "позиции", "позиций")}?`
          : dialog.title;
  const text =
    dialog.type === "schedule"
      ? "Здесь должен быть виджет расписания"
      : dialog.type === "discount"
        ? `Для ${count} ${plural(count, "позиции", "позиций", "позиций")}`
        : dialog.type === "delete"
          ? "Для прототипа это действие можно отменить только перезагрузкой данных."
          : dialog.text;

  return createPortal(
    <div className="fixed inset-0 z-[100003] flex items-center justify-center bg-black/20 backdrop-blur-[1px]">
      <div className="w-[360px] rounded-[16px] border border-[#e7e5e4] bg-white p-4 shadow-[0_24px_64px_rgba(41,37,36,0.22)]">
        <h2 className="text-[15px] font-medium text-[#292524]">{title}</h2>
        <p className="mt-2 text-[13px] leading-5 text-[#79716b]">{text}</p>
        {dialog.type === "schedule" && (
          <p className="mt-1 text-[12px] leading-4 text-[#a8a29e]">
            Позже используем тот же виджет, что в окне позиции.
          </p>
        )}
        {dialog.type === "discount" && (
          <label className="mt-4 block">
            <span className="text-[12px] font-medium text-[#79716b]">Процент скидки</span>
            <input
              value={discount}
              onChange={(event) => setDiscount(event.target.value.replace(/[^\d]/g, "").slice(0, 2))}
              autoFocus
              className="mt-1 h-9 w-full rounded-[10px] border border-[#e7e5e4] px-3 text-[14px] text-[#292524] outline-none focus:ring-2 focus:ring-[#292524]/10"
            />
          </label>
        )}
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-8 rounded-[10px] px-3 text-[13px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524]"
          >
            {dialog.type === "schedule" || dialog.type === "placeholder" ? "Закрыть" : "Отмена"}
          </button>
          {dialog.type === "discount" && (
            <button
              type="button"
              onClick={() => onApplyDiscount(Number(discount) || 0)}
              className="h-8 rounded-[10px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]"
            >
              Применить
            </button>
          )}
          {dialog.type === "delete" && (
            <button
              type="button"
              onClick={onConfirmDelete}
              className="h-8 rounded-[10px] bg-[#9f1239] px-3 text-[13px] font-medium text-white transition hover:bg-[#881337]"
            >
              Удалить
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function SelectionFeedback({ message }: { message: string }) {
  return (
    <div className="fixed bottom-4 right-4 z-[100002] rounded-[12px] border border-[#e7e5e4] bg-white px-3 py-2 text-[13px] font-medium text-[#57534d] shadow-[0_14px_42px_rgba(41,37,36,0.14)]">
      {message}
    </div>
  );
}

function OverviewStatusBar({
  filterId,
  titleOverride,
  count,
}: {
  filterId: OverviewFilterId;
  titleOverride?: string;
  count?: number;
}) {
  return (
    <div className="flex min-h-[24px] min-w-0 items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium leading-[17px] text-[#292524]">
          {titleOverride ?? getFilterPanelTitle(filterId)}
          {count != null && <span className="ml-1 text-[#79716b]">{count}</span>}
        </div>
      </div>
    </div>
  );
}

const QUEUE_ROW_HEIGHT = 36;

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

function DescriptionQueueRow({
  item,
  selected,
  onClick,
}: {
  item: CatalogItem;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${item.title} · ${item.sectionName}`}
      className={cn(
        "group flex h-8 w-full items-center gap-2 rounded-[8px] py-1.5 pl-1 pr-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        selected ? "bg-[#f3f3ed]" : "hover:bg-[#f0f0ea]",
      )}
    >
      <CatalogThumbnail src={item.thumbnailUrl} kind="item" className="h-5 w-5 rounded-[5.5px]" />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]",
          selected ? "text-[#292524]" : "text-[#79716b]",
        )}
      >
        {item.title}
      </span>
    </button>
  );
}

function VirtualizedDescriptionQueueRows({
  items,
  selectedItemId,
  scrollParentRef,
  onSelectItem,
  scrollSelectedToTop,
  stickyOffset = 0,
}: {
  items: CatalogItem[];
  selectedItemId: string | null;
  scrollParentRef: RefObject<HTMLDivElement | null>;
  onSelectItem: (item: CatalogItem) => void;
  /** Один раз при монтировании прокрутить так, чтобы выбранная строка стала первой
   * видимой под закреплённой областью (переход «Разделы → позиция»). */
  scrollSelectedToTop?: boolean;
  /** Высота закреплённой области (шапка + активный фильтр), которую нужно обойти. */
  stickyOffset?: number;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const scrollMargin = useVirtualScrollMargin(scrollParentRef, listRef, [items.length, selectedItemId]);
  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollParentRef.current,
    estimateSize: () => QUEUE_ROW_HEIGHT,
    getItemKey: (index) => items[index]?.id ?? index,
    overscan: 6,
    scrollMargin,
  });

  useEffect(() => {
    if (!scrollSelectedToTop || !selectedItemId) return;
    const index = items.findIndex((item) => item.id === selectedItemId);
    if (index < 0) return;
    // Двойной rAF даёт scrollMargin-эффекту (измерение реального DOM) успеть
    // отработать до финальной коррекции под высоту закреплённой области.
    requestAnimationFrame(() => {
      virtualizer.scrollToIndex(index, { align: "start" });
      requestAnimationFrame(() => {
        const el = scrollParentRef.current;
        if (el) el.scrollTop = Math.max(0, el.scrollTop - stickyOffset);
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      ref={listRef}
      className="relative w-full"
      style={{ height: virtualizer.getTotalSize() }}
    >
      {virtualizer.getVirtualItems().map((virtualRow) => {
        const item = items[virtualRow.index];
        if (!item) return null;
        return (
          <div
            key={virtualRow.key}
            className="absolute left-0 top-0 w-full"
            style={{ height: virtualRow.size, transform: `translateY(${virtualRow.start - scrollMargin}px)` }}
          >
            <DescriptionQueueRow
              item={item}
              selected={item.id === selectedItemId}
              onClick={() => onSelectItem(item)}
            />
          </div>
        );
      })}
    </div>
  );
}

function getSectionFullPath(sectionId: string) {
  const names: string[] = [];
  let current = catalogSections.find((section) => section.id === sectionId) ?? null;
  while (current) {
    names.unshift(current.name);
    current = current.parentId ? catalogSections.find((section) => section.id === current?.parentId) ?? null : null;
  }
  return names.join(" / ");
}

function CatalogScopeSelect({
  value,
  onChange,
  onReset,
  allOptionLabel,
  compact = false,
}: {
  value: string | null;
  onChange: (id: string | null) => void;
  onReset: () => void;
  allOptionLabel?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = catalogSections.find((section) => section.id === value) ?? null;
  const canReset = value !== null;
  const selectedLabel = selected?.name ?? allOptionLabel ?? "Выбрать раздел";
  const normalizedQuery = query.trim().toLowerCase();
  const sectionTree = useMemo(() => buildSectionTree(catalogSections), []);
  // Счётчик раздела включает позиции всех его подразделов (как в дереве «Разделов»).
  const sectionCounts = useMemo(() => {
    const counts = new Map<string, number>();
    const parentById = new Map(catalogSections.map((section) => [section.id, section.parentId]));
    [...catalogItems, ...readCreatedCatalogItems()].forEach((item) => {
      let current: string | null = item.sectionId;
      const seen = new Set<string>();
      while (current && !seen.has(current)) {
        seen.add(current);
        counts.set(current, (counts.get(current) ?? 0) + 1);
        current = parentById.get(current) ?? null;
      }
    });
    return counts;
  }, []);
  const searchResults = normalizedQuery
    ? catalogSections.filter((section) => getSectionFullPath(section.id).toLowerCase().includes(normalizedQuery))
    : [];

  const renderRow = (section: CatalogSection, depth: number, parentName?: string) => {
    const isSelected = value === section.id;
    return (
      <DropdownMenu.Item
        key={section.id}
        onSelect={() => onChange(section.id)}
        onClick={() => onChange(section.id)}
        title={parentName ? `${parentName} / ${section.name}` : section.name}
        style={{ paddingLeft: 8 + depth * 16 }}
        className={cn(
          "flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] pr-2 text-[13px] font-medium outline-none transition data-[highlighted]:bg-[#f5f5f4]",
          isSelected && "bg-[#f3f3ed]",
        )}
      >
        <CatalogTreeThumbnail src={section.imageUrl} selected={isSelected} />
        <span className={cn("min-w-0 flex-1 truncate", isSelected ? "text-[#292524]" : "text-[#44403b]")}>
          {section.name}
          {parentName && <span className="ml-1 font-normal text-[11px] text-[#a8a29e]">· {parentName}</span>}
        </span>
        <span className="shrink-0 text-[11px] tabular-nums text-[#a8a29e]">{sectionCounts.get(section.id) ?? 0}</span>
        {isSelected && <Check size={13} className="shrink-0 text-[#57534d]" />}
      </DropdownMenu.Item>
    );
  };
  const renderNode = (node: CatalogSectionNode, depth = 0): ReactNode => (
    <div key={node.id}>
      {renderRow(node, depth)}
      {node.children.map((child) => renderNode(child, depth + 1))}
    </div>
  );

  return (
    <DropdownMenu.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <div className={cn("flex w-full min-w-0 items-center overflow-hidden transition hover:bg-[#eae9e2] focus-within:ring-2 focus-within:ring-[#292524]/10", compact ? "h-6 max-w-[320px] rounded-[28px] bg-[#f5f5f4] py-0.5 pl-0.5 pr-1.5" : "h-9 rounded-[8px] bg-[#f0f0ea] py-1.5 pl-1 pr-1.5")}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={selected || allOptionLabel ? `Выбран раздел: ${selectedLabel}` : "Выбрать раздел"}
            className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none"
          >
            <span className={cn("flex shrink-0 items-center justify-center overflow-hidden text-[#57534d]", compact ? "h-5 w-5 rounded-[5px] bg-white" : "h-5 w-5 rounded-[5px] bg-white")}>
              {selected?.imageUrl ? <img src={selected.imageUrl} alt="" className="h-full w-full object-cover" /> : <List size={14} />}
            </span>
            <span className={cn("min-w-0 flex-1 truncate font-normal text-[#44403b]", compact ? "text-[12px] leading-4" : "text-[13px] leading-[18px]")}>
              {selectedLabel}
            </span>
          </button>
        </DropdownMenu.Trigger>
        <button
          type="button"
          aria-label="Открыть список разделов"
          aria-expanded={open}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            setOpen((current) => !current);
          }}
          className={cn("flex shrink-0 items-center justify-center rounded-[4px] bg-[#efefeb] text-[#57534d] transition hover:bg-white/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10", compact ? "h-[14px] w-[14px]" : "h-[14px] w-5")}
        >
          <CaretDown size={12} weight="bold" />
        </button>
      </div>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className="z-[100002] w-[310px] rounded-[12px] border border-[#e7e5e4] bg-white p-2 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none">
          <label className="mb-2 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] px-2 text-[#a8a29e] focus-within:border-[#a8a29e]">
            <MagnifyingGlass size={14} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.stopPropagation()} placeholder="Найти раздел" autoFocus className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]" />
          </label>
          <div className="max-h-[360px] overflow-y-auto">
            {allOptionLabel ? (
              <>
                <DropdownMenu.Item
                  onSelect={onReset}
                  onClick={onReset}
                  className={cn(
                    "flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]",
                    value === null && "bg-[#f3f3ed]",
                  )}
                >
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-[#f5f5f4] text-[#57534d]">
                    <List size={14} />
                  </span>
                  <span className="min-w-0 flex-1 truncate">{allOptionLabel}</span>
                  {value === null && <Check size={13} className="shrink-0 text-[#57534d]" />}
                </DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
              </>
            ) : canReset && (
              <>
                <DropdownActionItem onSelect={onReset}>Показать всё меню</DropdownActionItem>
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
              </>
            )}
            {normalizedQuery ? (
              <>
                {searchResults.map((section) =>
                  renderRow(section, 0, catalogSections.find((candidate) => candidate.id === section.parentId)?.name),
                )}
                {searchResults.length === 0 && <div className="px-2 py-3 text-[13px] text-[#79716b]">Разделы не найдены</div>}
              </>
            ) : (
              sectionTree.map((node) => renderNode(node))
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function UnifiedFlatCatalogPanel({
  filterId,
  scopeSectionId,
  allItems,
  items,
  selectedItemId,
  onShowTable,
  listQuery = "",
  onListQueryChange,
  scrollSelectedToTop,
  listScrollTop,
  onListScrollTopChange,
  onFilterChange,
  onSectionScopeChange,
  onSelectItem,
  onCreatePosition,
}: {
  filterId: OverviewFilterId;
  scopeSectionId: string | null;
  allItems: CatalogItem[];
  items: CatalogItem[];
  selectedItemId: string | null;
  /** В редакторе повторный клик по активному фильтру возвращает таблицу выборки. */
  onShowTable?: () => void;
  /** Локальный поиск внутри текущего раздела/фильтра — не трогает scope/фильтр/таблицу. */
  listQuery?: string;
  onListQueryChange?: (value: string) => void;
  /** Один раз проскроллить список так, чтобы выбранная строка стала первой видимой
   * под закреплённой областью (переход «Разделы → позиция»). */
  scrollSelectedToTop?: boolean;
  listScrollTop?: number;
  onListScrollTopChange?: (value: number) => void;
  onFilterChange: (id: OverviewFilterId) => void;
  onSectionScopeChange: (id: string | null) => void;
  onSelectItem: (item: CatalogItem) => void;
  onCreatePosition?: () => void;
}) {
  const listScrollRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const previousSelectionRef = useRef({ filterId, scopeSectionId });
  const [searchOpen, setSearchOpen] = useState(() => Boolean(listQuery.trim()));
  const scope = useMemo(() => catalogSections.find((section) => section.id === scopeSectionId) ?? null, [scopeSectionId]);
  const scopeIds = useMemo(() => getSectionScopeIds(scopeSectionId, catalogSections), [scopeSectionId]);
  const allFilterIds = useMemo(
    () => Array.from(new Set([
      ...HYBRID_PRIMARY_FILTER_IDS,
      ...CATALOG_VIEW_MODE_GROUPS.flatMap((group) => group.ids),
    ])).filter((id): id is OverviewFilterId => id !== "sections"),
    [],
  );
  const secondaryFilterIds = useMemo(
    () => allFilterIds.filter((id) => !HYBRID_PRIMARY_FILTER_IDS.includes(id)),
    [allFilterIds],
  );
  const filterCounts = useMemo(
    () => countItemsByFilter(allFilterIds, allItems, scopeIds),
    [allFilterIds, allItems, scopeIds],
  );
  const countByFilter = (id: OverviewFilterId) => filterCounts[id] ?? 0;
  const [addedFilterIds, setAddedFilterIds] = useState<OverviewFilterId[]>(() =>
    secondaryFilterIds.includes(filterId) ? [filterId] : [],
  );
  const emptyText = scope
    ? `В разделе «${scope.name}» нет позиций: ${HYBRID_PRIMARY_FILTER_LABELS[filterId].toLowerCase()}`
    : OVERVIEW_FILTER_META[filterId].emptyTitle;
  const closeSearch = () => {
    onListQueryChange?.("");
    setSearchOpen(false);
  };
  const toggleSearch = () => {
    if (searchOpen) closeSearch();
    else setSearchOpen(true);
  };
  const openFilter = (id: OverviewFilterId) => {
    if (id === "quick:all") setAddedFilterIds([]);
    if (id === filterId && onShowTable) {
      onShowTable();
      return;
    }
    onFilterChange(id);
  };
  const addFilter = (id: OverviewFilterId) => {
    setAddedFilterIds((current) => current.includes(id) ? current : [...current, id]);
    onFilterChange(id);
  };

  useEffect(() => {
    const previous = previousSelectionRef.current;
    const selectionChanged = previous.filterId !== filterId || previous.scopeSectionId !== scopeSectionId;
    if (selectionChanged) {
      onListQueryChange?.("");
      setSearchOpen(false);
    }
    previousSelectionRef.current = { filterId, scopeSectionId };
  }, [filterId, onListQueryChange, scopeSectionId]);

  useEffect(() => {
    if (filterId === "quick:all") {
      setAddedFilterIds([]);
      return;
    }
    if (!secondaryFilterIds.includes(filterId)) return;
    setAddedFilterIds((current) => current.includes(filterId) ? current : [...current, filterId]);
  }, [filterId, secondaryFilterIds]);

  useEffect(() => {
    if (!searchOpen) return;
    requestAnimationFrame(() => searchInputRef.current?.focus());
  }, [searchOpen]);

  useEffect(() => {
    if (listScrollTop == null || !listScrollRef.current) return;
    listScrollRef.current.scrollTop = listScrollTop;
    // Восстановление нужно при первом входе в эксперимент; дальнейший scroll
    // остаётся живым, потому что левая панель не размонтируется между видами.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moreFilterGroups = CATALOG_VIEW_MODE_GROUPS.map((group) => ({
    ...group,
    ids: group.ids.filter(
      (id): id is OverviewFilterId =>
        id !== "sections"
        && secondaryFilterIds.includes(id as OverviewFilterId)
        && !addedFilterIds.includes(id),
    ),
  })).filter((group) => group.ids.length > 0);

  return (
    <aside className="flex w-[251px] shrink-0 flex-col overflow-hidden border-r border-[#e7e5e4] bg-[#fbfbf9] pt-3">
      <div className="shrink-0 px-2 pb-5">
        <CatalogScopeSelect value={scopeSectionId} onChange={onSectionScopeChange} onReset={() => onSectionScopeChange(null)} />
        <div className="mt-3 flex flex-col gap-0.5">
          {HYBRID_PRIMARY_FILTER_IDS.map((id) => (
            <FilterPanelRow
              key={id}
              row={{ id, label: HYBRID_PRIMARY_FILTER_LABELS[id], count: countByFilter(id) }}
              selected={filterId === id}
              onClick={() => openFilter(id)}
            />
          ))}
          {addedFilterIds.map((id) => (
            <FilterPanelRow
              key={id}
              row={{ id, label: HYBRID_PRIMARY_FILTER_LABELS[id], count: countByFilter(id) }}
              selected={filterId === id}
              onClick={() => openFilter(id)}
            />
          ))}
          <div className="flex flex-col">
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex h-[30px] w-full items-center gap-2 rounded-[8px] px-2 pl-1.5 text-left transition hover:bg-[#f0f0ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <span className="flex h-4 w-4 shrink-0 items-center justify-center text-[#57534d]">
                    <DotsThree size={16} />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[13px] font-normal leading-[18px] text-[#44403b]">
                    Ещё
                  </span>
                </button>
              </DropdownMenu.Trigger>
              <DropdownContent align="start">
                <div className="max-h-[360px] overflow-y-auto">
                  {moreFilterGroups.map((group, groupIndex) => (
                    <div key={group.label}>
                      {groupIndex > 0 && <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />}
                      <DropdownMenu.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-[#a6a09b]">{group.label}</DropdownMenu.Label>
                      {group.ids.map((id) => (
                        <DropdownMenu.Item
                          key={id}
                          onSelect={() => addFilter(id)}
                          className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                        >
                          <FunnelSimple size={16} weight="regular" className="shrink-0 text-[#57534d]" />
                          <span className="min-w-0 flex-1 truncate">{HYBRID_PRIMARY_FILTER_LABELS[id]}</span>
                          <span className="shrink-0 text-[12px] font-normal tabular-nums text-[#a6a09b]">{countByFilter(id)}</span>
                        </DropdownMenu.Item>
                      ))}
                    </div>
                  ))}
                </div>
              </DropdownContent>
            </DropdownMenu.Root>
          </div>
        </div>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-2 pb-3">
        <div className="flex h-[18px] shrink-0 items-center justify-between pl-1 pr-1.5">
          <span className="min-w-0 flex-1 truncate text-[13px] font-normal leading-[18px] text-[#292524]">
            {HYBRID_PRIMARY_FILTER_LABELS[filterId]}
          </span>
          <div className="flex shrink-0 items-center gap-0.5">
            {onCreatePosition && (
              <Tooltip label="Добавить позицию" side="top" delayDuration={250}>
                <button
                  type="button"
                  onClick={onCreatePosition}
                  aria-label="Добавить позицию"
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[#57534d] transition hover:bg-[#f0f0ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <Plus size={15} weight="bold" />
                </button>
              </Tooltip>
            )}
            {onListQueryChange && (
              <button
                type="button"
                onClick={toggleSearch}
                aria-label={searchOpen ? "Закрыть поиск по позициям" : "Открыть поиск по позициям"}
                aria-expanded={searchOpen}
                className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[6px] text-[#57534d] transition hover:bg-[#f0f0ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
              >
                {searchOpen ? <X size={16} /> : <MagnifyingGlass size={16} />}
              </button>
            )}
          </div>
        </div>
        <div
          className={cn(
            "grid shrink-0 transition-[grid-template-rows,opacity] duration-[180ms] ease-out motion-reduce:transition-none",
            searchOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
          )}
        >
          <div className="overflow-hidden">
            <label className="mt-2 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-white px-2 text-[#a8a29e] focus-within:border-[#a8a29e]">
              <MagnifyingGlass size={14} />
              <input
                ref={searchInputRef}
                value={listQuery}
                onChange={(event) => onListQueryChange?.(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") {
                    event.preventDefault();
                    closeSearch();
                  }
                }}
                placeholder="Найти позицию"
                className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
              />
            </label>
          </div>
        </div>
        <div
          ref={listScrollRef}
          onScroll={(event) => onListScrollTopChange?.(event.currentTarget.scrollTop)}
          className="mt-3 min-h-0 flex-1 overflow-y-auto"
        >
          {items.length > 0 && (
            <VirtualizedDescriptionQueueRows
              items={items}
              selectedItemId={selectedItemId}
              scrollParentRef={listScrollRef}
              onSelectItem={onSelectItem}
              scrollSelectedToTop={scrollSelectedToTop}
            />
          )}
          {items.length === 0 && (
            <div className="px-1 py-2">
              <p className="text-[12px] leading-5 text-[#79716b]">
                {listQuery.trim() ? "По вашему запросу ничего не найдено" : emptyText}
              </p>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function PositionEditorBreadcrumb({
  filterId,
  sectionName,
  positionTitle,
  onOpenSection,
  onOpenFilter,
}: {
  filterId: OverviewFilterId;
  sectionName: string;
  positionTitle: string;
  onOpenSection: () => void;
  onOpenFilter: () => void;
}) {
  const crumbButton = "min-w-0 truncate rounded-[6px] px-1 py-0.5 text-[13px] font-medium text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10";
  return (
    <nav aria-label="Навигация по позициям" className="flex min-w-0 items-center gap-1.5">
      <button type="button" onClick={onOpenSection} title={sectionName} className={cn(crumbButton, "shrink-0")}>{sectionName}</button>
      {filterId !== "quick:all" && (
        <>
          <span className="shrink-0 text-[13px] text-[#d6d3d1]" aria-hidden="true">/</span>
          <button type="button" onClick={onOpenFilter} className={crumbButton}>{HYBRID_PRIMARY_FILTER_LABELS[filterId]}</button>
        </>
      )}
      <span className="shrink-0 text-[13px] text-[#d6d3d1]" aria-hidden="true">/</span>
      <span className="min-w-0 flex-1 truncate px-1 text-[13px] font-medium text-[#292524]" title={positionTitle}>{positionTitle}</span>
    </nav>
  );
}

function CreatePositionSectionLink({
  sectionPath,
  onOpenSection,
}: {
  sectionPath: CatalogSectionCrumb[];
  onOpenSection: (sectionId: string) => void;
}) {
  const section = sectionPath.at(-1);
  if (!section) return null;
  const fullPath = ["По разделам", ...sectionPath.map((candidate) => candidate.name)].join(" / ");
  return (
    <>
      <span className="shrink-0 text-[13px] text-[#d6d3d1]" aria-hidden="true">·</span>
      <Tooltip label={fullPath} side="bottom" delayDuration={300}>
        <button
          type="button"
          onClick={() => onOpenSection(section.id)}
          className="min-w-0 truncate rounded-[5px] px-0.5 text-left text-[13px] font-normal leading-5 text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 max-[1100px]:text-[11px]"
        >
          {section.name}
        </button>
      </Tooltip>
    </>
  );
}

function initialItemsWithPending(
  pendingOpen: PendingOpen | null | undefined,
  sourceItems: CatalogItem[],
): CatalogItem[] {
  if (
    pendingOpen?.item
    && pendingOpen.mode !== "create"
    && !sourceItems.some((candidate) => candidate.id === pendingOpen.item!.id)
  ) {
    return [...sourceItems, pendingOpen.item];
  }
  return sourceItems;
}

function buildSectionQueueFromPending(pendingOpen: PendingOpen, items: CatalogItem[]): DescriptionAuditQueueState | null {
  const target = pendingOpen.mode === "create"
    ? pendingOpen.item
    : items.find((candidate) => candidate.id === pendingOpen.id);
  if (!target) return null;
  const section = pendingOpen.section;
  const baseIds = section
    ? getQueueItemIds("quick:all", items, "", section.sectionId, "none")
    : getQueueItemIds("quick:all", items, "", null, "none");
  const itemIds = section && !baseIds.includes(target.id) ? [...baseIds, target.id] : baseIds;
  const overviewReturn = pendingOpen.returnContext?.tab === "overview" ? pendingOpen.returnContext : null;
  return {
    snapshot: {
      itemIds,
      // Переход из раздела = обычная выборка «Все позиции · <раздел>» (scope = раздел),
      // без отдельного визуального режима. Возврат в раздел живёт в return context.
      filterId: overviewReturn?.filterId ?? "quick:all",
      entryFilterId: overviewReturn?.filterId ?? "quick:all",
      query: overviewReturn?.panelQuery ?? "",
      returnPanelQuery: overviewReturn?.panelQuery ?? "",
      tableQuery: overviewReturn?.tableQuery ?? "",
      sectionScopeId: overviewReturn?.sectionScopeId ?? (section ? section.sectionId : null),
      scrollTop: overviewReturn?.scrollTop ?? 0,
      entryItemId: target.id,
      sort: overviewReturn?.sort ?? "none",
      entryFromSection: pendingOpen.returnContext?.tab === "sections",
      returnContext: pendingOpen.returnContext,
      sectionPath: pendingOpen.section?.sectionPath ?? getCatalogSectionPath(target.sectionId),
    },
    currentId: target.id,
  };
}

function PositionsWorkspaceViewSwitcher({
  value,
  onChange,
}: {
  value: EditorFirstPositionsView;
  onChange: (view: EditorFirstPositionsView) => void;
}) {
  return (
    <div className="flex h-11 shrink-0 items-center border-b border-[#e7e5e4] bg-[#fbfbf9] px-5">
      <div
        role="group"
        aria-label="Представление позиций"
        className="inline-flex items-center gap-0.5 rounded-[9px] bg-[#efefea] p-0.5"
      >
        {(["editor", "table"] as const).map((view) => (
          <button
            key={view}
            type="button"
            onClick={() => onChange(view)}
            aria-pressed={value === view}
            className={cn(
              "h-7 rounded-[7px] px-2.5 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
              value === view
                ? "bg-white text-[#292524] shadow-sm"
                : "text-[#79716b] hover:text-[#44403b]",
            )}
          >
            {view === "editor" ? "Редактор" : "Таблица"}
          </button>
        ))}
      </div>
    </div>
  );
}

function EditorFirstPositionEmptyState() {
  return (
    <div className="flex min-h-0 flex-1 items-center justify-center px-8 py-10">
      <div className="max-w-[360px] text-center">
        <h2 className="text-[16px] font-medium leading-6 text-[#292524]">Выберите позицию слева</h2>
        <p className="mt-2 text-[13px] leading-5 text-[#79716b]">
          Выберите позицию из списка, чтобы открыть редактор.
        </p>
      </div>
    </div>
  );
}

function OverviewWorkspace({
  navigation,
  filterId,
  createdItems,
  onFilterChange,
  sectionScopeId,
  onSectionScopeChange,
  query,
  onQueryChange,
  onReturnToSections,
  onRestoreStructureContext,
  onOpenSectionInSections,
  onRegisterCreateNavigationGuard,
  onCreateClosed,
  pendingOpen,
  onPendingOpenHandled,
  tableOpenSignal,
  positionsWorkspaceMode,
  embedded = false,
  tableHeader,
  onAddPosition,
  positionCreateDisabledReason,
  allowPositionCreation = true,
  onActiveItemChange,
  structureSections,
  structuralPositionOrderBySection,
  onOpenStructuralItem,
  onOpenStructuralSection,
  onRevealStructuralSection,
  mandatoryFilterId,
  titleOverride,
  overviewContextStorageKey = OVERVIEW_WORKSPACE_CONTEXT_STORAGE_KEY,
}: {
  navigation: CatalogNavigationBoundary;
  filterId: OverviewFilterId;
  createdItems: CatalogItem[];
  onFilterChange: (id: OverviewFilterId) => void;
  sectionScopeId: string | null;
  onSectionScopeChange: (id: string | null) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onReturnToSections: (openItemId: string | null) => void;
  onRestoreStructureContext: (context: StructureReturnContext, openItemId: string | null) => void;
  onOpenSectionInSections: (sectionId: string | null, highlightedItemId?: string | null) => void;
  onRegisterCreateNavigationGuard: (guard: CatalogCreateNavigationGuard | null) => void;
  onCreateClosed?: () => void;
  pendingOpen?: PendingOpen | null;
  onPendingOpenHandled?: () => void;
  tableOpenSignal: number;
  positionsWorkspaceMode: PositionsWorkspaceMode;
  embedded?: boolean;
  tableHeader?: ReactNode;
  onAddPosition?: () => void;
  positionCreateDisabledReason?: string | null;
  allowPositionCreation?: boolean;
  onActiveItemChange?: (id: string | null) => void;
  structureSections?: TreeSection[];
  structuralPositionOrderBySection?: Record<string, string[]>;
  onOpenStructuralItem?: (id: string) => void;
  onOpenStructuralSection?: (id: string) => void;
  onRevealStructuralSection?: (id: string) => void;
  mandatoryFilterId?: OverviewFilterId;
  titleOverride?: string;
  overviewContextStorageKey?: string;
}) {
  const { registerChange } = usePublish();
  const editorFirstEnabled = positionsWorkspaceMode === "editor-first";
  const {
    items,
    itemOrderBySection,
    setActiveEditorItemId,
    revision: catalogRevision,
    mutations: catalogMutations,
  } = useCatalogStore();
  const {
    createItem: addItem,
    updateItem,
    deleteItem,
    deleteItems,
    moveItem,
    setItemStatus,
    reorderItems,
    replaceItemOrder,
  } = catalogMutations;
  const [initialEditorFirstState] = useState<EditorFirstPositionsState>(() => readEditorFirstPositionsState());
  const [initialOverviewContext] = useState<OverviewWorkspaceContext>(() => readOverviewWorkspaceContext(overviewContextStorageKey));
  const activeFiltersStorageKey = `${overviewContextStorageKey}.activeFilters.v2`;
  const [activeFilterIds, setActiveFilterIds] = useState<OverviewFilterId[]>(() => {
    const stored = readJsonRecord<unknown>(activeFiltersStorageKey, []);
    const restored = Array.isArray(stored)
      ? stored.filter((id): id is OverviewFilterId =>
          typeof id === "string"
          && id !== "quick:all"
          && id !== mandatoryFilterId
          && Object.prototype.hasOwnProperty.call(FILTER_PREDICATES, id),
        )
      : [];
    if (restored.length > 0) return [restored.at(-1)!];
    return filterId !== "quick:all" && filterId !== mandatoryFilterId ? [filterId] : [];
  });
  const initialWorkspaceItems = initialItemsWithPending(pendingOpen, items);
  const restoredEditorFirstQueue = editorFirstEnabled && !pendingOpen
    ? restoreEditorFirstQueue(initialEditorFirstState, initialWorkspaceItems)
    : null;
  // Открытие из «Разделов» обрабатывается атомарно на маунте: сразу строим items и
  // очередь-редактор из pendingOpen — без гонок setState, чтобы повторный переход
  // всегда открывал редактор, а не таблицу последнего фильтра.
  const initialEditorSessionQueue = pendingOpen
    ? buildSectionQueueFromPending(pendingOpen, initialWorkspaceItems)
    : restoredEditorFirstQueue;
  void createdItems;
  const {
    queue,
    setQueue,
    activePositionId,
    setActivePositionId,
    view: editorFirstView,
    setView: setEditorFirstView,
  } = useEditorSession({
    queue: initialEditorSessionQueue,
    activePositionId: pendingOpen?.id ?? restoredEditorFirstQueue?.currentId ?? null,
    view: pendingOpen ? "editor" : initialEditorFirstState.view,
  });
  const [editorFirstFilterId, setEditorFirstFilterId] = useState<OverviewFilterId>(initialEditorFirstState.filterId);
  const [editorFirstSectionScopeId, setEditorFirstSectionScopeId] = useState<string | null>(
    pendingOpen?.section?.sectionId ?? initialEditorFirstState.sectionScopeId,
  );
  const [editorFirstQuery, setEditorFirstQuery] = useState(initialEditorFirstState.query);
  const [editorFirstPriceSort, setEditorFirstPriceSort] = useState<PriceSortDirection>(initialEditorFirstState.sort);
  const [editorFirstTableScrollTop, setEditorFirstTableScrollTop] = useState(initialEditorFirstState.tableScrollTop);
  const [editorFirstPanelScrollTop, setEditorFirstPanelScrollTop] = useState(initialEditorFirstState.panelScrollTop);
  const directCreateSession = useCreateSession(
    pendingOpen?.mode === "create" && pendingOpen.item
      ? {
          mode: "direct",
          draft: pendingOpen.item,
          context: { targetSectionId: pendingOpen.section?.sectionId ?? pendingOpen.item.sectionId },
          dirty: false,
          submitting: false,
          completedItemId: null,
        }
      : undefined,
  );
  const {
    creationItemId,
    draftItem,
    dirty: draftDirty,
    submitting: createSubmitting,
    updateDraft,
    setDirty: setDraftDirty,
    setSubmitting: setCreateSubmitting,
    begin: beginDirectCreate,
    complete: completeDirectCreate,
    cancel: cancelDirectCreate,
  } = directCreateSession;
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const pendingCreateNavigationRef = useRef<(() => void) | null>(null);
  const [panelQuery, setPanelQuery] = useState(initialOverviewContext.panelQuery);
  const pendingHandledRef = useRef(false);
  const [queueUpsellByItem, setQueueUpsellByItem] = useState<CatalogUpsellStateByItem>({});
  const [priceSort, setPriceSort] = useState<PriceSortDirection>(initialOverviewContext.priceSort);
  const [overviewScrollTop, setOverviewScrollTop] = useState(initialOverviewContext.scrollTop);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [recentPositionIds, setRecentPositionIds] = useState<string[]>(() => readRecentPositionIds(items));
  const [bulkDialog, setBulkDialog] = useState<BulkDialog | null>(null);
  const [feedback, setFeedback] = useState("");
  const [moveRequest, setMoveRequest] = useState<{ operation: "position" | "bulk"; itemIds: string[]; anchor: MovePopoverAnchor } | null>(null);
  const [moveUndo, setMoveUndo] = useState<{ previous: Array<{ id: string; sectionId: string; sectionName: string }>; message: string } | null>(null);
  const [columnVisibility, setColumnVisibility] = useState<VisibilityState>(readTableColumnVisibility);
  const tableReorderSensors = useSensors(
    useSensor(CatalogPointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const handleColumnVisibilityChange = useCallback((updater: Updater<VisibilityState>) => {
    setColumnVisibility((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      return { ...next, position: true };
    });
  }, []);
  // Подсветка последней открытой позиции после возврата из редактора к таблице.
  const [tableHighlightId, setTableHighlightId] = useState<string | null>(null);
  const suppressActiveItemChangeRef = useRef(false);
  useEffect(() => {
    if (suppressActiveItemChangeRef.current) {
      suppressActiveItemChangeRef.current = false;
      return;
    }
    onActiveItemChange?.(queue?.currentId ?? null);
  }, [onActiveItemChange, queue?.currentId]);
  useEffect(() => {
    if (!tableHighlightId) return;
    const timer = window.setTimeout(() => setTableHighlightId(null), 2600);
    return () => window.clearTimeout(timer);
  }, [tableHighlightId]);
  useEffect(() => {
    writeJsonRecord(CATALOG_TABLE_COLUMNS_STORAGE_KEY, columnVisibility);
  }, [columnVisibility]);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const restoreScrollTopRef = useRef<number | null>(null);

  useEffect(() => {
    if (!moveUndo) return;
    const timeout = window.setTimeout(() => setMoveUndo(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [moveUndo]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = initialOverviewContext.scrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
  }, [initialOverviewContext.scrollTop]);
  const workspaceFilterId = editorFirstEnabled ? editorFirstFilterId : filterId;
  const workspaceSectionScopeId = editorFirstEnabled ? editorFirstSectionScopeId : sectionScopeId;
  const workspaceQuery = editorFirstEnabled ? editorFirstQuery : query;
  const workspacePriceSort = editorFirstEnabled ? editorFirstPriceSort : priceSort;
  const workspacePanelQuery = editorFirstEnabled ? editorFirstQuery : panelQuery;
  useEffect(() => {
    writeJsonRecord(overviewContextStorageKey, {
      panelQuery,
      priceSort,
      scrollTop: overviewScrollTop,
      sectionScopeId: workspaceSectionScopeId,
    });
  }, [overviewContextStorageKey, overviewScrollTop, panelQuery, priceSort, workspaceSectionScopeId]);
  useEffect(() => {
    writeJsonRecord(activeFiltersStorageKey, activeFilterIds);
  }, [activeFilterIds, activeFiltersStorageKey]);
  const setWorkspaceFilterId = (id: OverviewFilterId) => {
    if (editorFirstEnabled) setEditorFirstFilterId(id);
    else onFilterChange(id);
  };
  const setWorkspaceSectionScopeId = (id: string | null) => {
    if (editorFirstEnabled) setEditorFirstSectionScopeId(id);
    else onSectionScopeChange(id);
  };
  const setWorkspaceQuery = (value: string) => {
    if (editorFirstEnabled) setEditorFirstQuery(value);
    else onQueryChange(value);
  };
  const setWorkspacePriceSort = (value: PriceSortDirection | ((current: PriceSortDirection) => PriceSortDirection)) => {
    if (editorFirstEnabled) setEditorFirstPriceSort(value);
    else setPriceSort(value);
  };
  const setWorkspaceActiveFilter = (id: OverviewFilterId, active: boolean) => {
    const next = id === "quick:all"
      ? []
      : active
        ? [id]
        : activeFilterIds[0] === id
          ? []
          : activeFilterIds;
    setActiveFilterIds(next);
    setWorkspaceFilterId(next[0] ?? "quick:all");
    setSelectedIds(new Set());
  };
  const scopeSection = useMemo(
    () => catalogSections.find((section) => section.id === workspaceSectionScopeId) ?? null,
    [workspaceSectionScopeId],
  );
  const scopeIds = useMemo(() => getSectionScopeIds(workspaceSectionScopeId, catalogSections), [workspaceSectionScopeId]);
  const filtered = useMemo(() => {
    const baseItems = mandatoryFilterId ? getOverviewItems(mandatoryFilterId, items) : items;
    const nextItems = activeFilterIds[0] ? getOverviewItems(activeFilterIds[0], baseItems) : baseItems;
    return nextItems.filter((item) => !scopeIds || scopeIds.has(item.sectionId));
  }, [activeFilterIds, items, mandatoryFilterId, scopeIds]);
  const scopeTotalCount = useMemo(
    () => items.filter((item) => !scopeIds || scopeIds.has(item.sectionId)).length,
    [items, scopeIds],
  );
  const normalizedQuery = useMemo(() => workspaceQuery.trim().toLowerCase(), [workspaceQuery]);
  const searched = useMemo(
    () => normalizedQuery
      ? filtered.filter((item) =>
          [item.title, item.sectionName].some((value) => value.toLowerCase().includes(normalizedQuery)),
        )
      : filtered,
    [filtered, normalizedQuery],
  );
  const manuallyOrdered = useMemo(
    () => orderItemsByPositionOrder(searched, itemOrderBySection),
    [itemOrderBySection, searched],
  );
  const visible = useMemo(
    () => sortItemsByPrice(manuallyOrdered, workspacePriceSort),
    [manuallyOrdered, workspacePriceSort],
  );
  const scopeIsLeafSection = Boolean(
    scopeSection
    && !(structureSections ?? catalogSections).some((candidate) => candidate.parentId === scopeSection.id),
  );
  const canReorderTable = Boolean(
    tableHeader
    && embedded
    && !mandatoryFilterId
    && scopeSection
    && scopeIsLeafSection
    && activeFilterIds.length === 0
    && workspaceQuery.trim() === ""
    && workspacePriceSort === "none"
    && visible.length > 1
    && visible.every((item) => item.sectionId === scopeSection.id),
  );
  const catalogTable = useReactTable({
    data: visible,
    columns: CATALOG_TABLE_COLUMN_DEFS,
    state: { columnVisibility: { ...columnVisibility, reorder: canReorderTable } },
    onColumnVisibilityChange: handleColumnVisibilityChange,
    getCoreRowModel: getCoreRowModel(),
    getRowId: (item) => item.id,
  });
  const normalizedPanelQuery = useMemo(() => workspacePanelQuery.trim().toLowerCase(), [workspacePanelQuery]);
  const panelItems = useMemo(
    () => normalizedPanelQuery
      ? filtered.filter((item) =>
          [item.title, item.sectionName].some((value) => value.toLowerCase().includes(normalizedPanelQuery)),
        )
      : filtered,
    [filtered, normalizedPanelQuery],
  );
  const activeDisplayFilterId = activeFilterIds[0] ?? mandatoryFilterId ?? "quick:all";
  const activeSelectionLabel = HYBRID_PRIMARY_FILTER_LABELS[activeDisplayFilterId];
  const statusMeta = OVERVIEW_FILTER_META[activeDisplayFilterId];
  const visibleIds = useMemo(() => visible.map((item) => item.id), [visible]);
  const visibleIdKey = useMemo(() => visibleIds.join("|"), [visibleIds]);
  const allVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id)),
    [selectedIds, visibleIds],
  );
  const someVisibleSelected = useMemo(() => visibleIds.some((id) => selectedIds.has(id)), [selectedIds, visibleIds]);

  const handleTableReorder = (event: DragEndEvent) => {
    if (!canReorderTable || !scopeSection || !event.over || event.active.id === event.over.id) return;
    const previousIds = [...visibleIds];
    const nextIds = moveCatalogIdToIndex(previousIds, String(event.active.id), String(event.over.id));
    if (nextIds.every((id, index) => id === previousIds[index])) return;
    const previousOrder = cloneStringArrayRecord(itemOrderBySection);
    try {
      reorderItems(scopeSection.id, nextIds);
      registerChange("catalog");
      showFeedback("Порядок позиций изменён");
    } catch {
      replaceItemOrder(previousOrder);
      showFeedback("Не удалось изменить порядок. Исходный порядок восстановлен.");
    }
  };

  const resetFilter = () => {
    setWorkspaceQuery("");
    setActiveFilterIds([]);
    setWorkspaceFilterId("quick:all");
    setSelectedIds(new Set());
    onReturnToSections(null);
  };
  const clearSearch = () => {
    setWorkspaceQuery("");
  };
  const handlePriceSortChange = () => {
    setWorkspacePriceSort((current) => getNextPriceSort(current));
  };
  const emptyTitle = activeFilterIds.length > 0
    ? statusMeta.emptyTitle
    : titleOverride ?? statusMeta.emptyTitle;
  const emptyText = scopeSection
    ? `В разделе «${scopeSection.name}» нет позиций: ${OVERVIEW_FILTER_META[activeDisplayFilterId].label.toLowerCase()}`
    : statusMeta.emptyText;

  const clearSelection = () => setSelectedIds(new Set());
  const showFeedback = (message: string) => {
    setFeedback(message);
  };
  const isCreateDraftOpen = creationItemId !== null && draftItem !== null;
  const completeCreateNavigation = (action: () => void) => {
    setDiscardDialogOpen(false);
    cancelDirectCreate();
    pendingCreateNavigationRef.current = null;
    onCreateClosed?.();
    action();
  };
  const requestCreateNavigation = (action: () => void) => {
    if (!isCreateDraftOpen) {
      action();
      return;
    }
    if (!draftDirty) {
      completeCreateNavigation(action);
      return;
    }
    pendingCreateNavigationRef.current = action;
    setDiscardDialogOpen(true);
  };
  const discardCreateDraft = () => {
    const action = pendingCreateNavigationRef.current;
    if (action) completeCreateNavigation(action);
  };
  const rememberOpenedPosition = (id: string) => {
    setRecentPositionIds((current) => promoteRecentPositionId(normalizeRecentPositionIds(current, items), id));
  };
  // Контекстный список всегда соответствует текущей выборке (Недавние удалены).
  const getPanelItems = (_nextFilterId: OverviewFilterId, sourceItems: CatalogItem[]) => sourceItems;
  const handleQueryChange = (value: string) => {
    clearSelection();
    setWorkspaceQuery(value);
    if (queue) {
      if (editorFirstEnabled) rebrowseQuery(value);
      else setQueue(null);
    }
  };
  const setItemSelected = (id: string, selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (selected) next.add(id);
      else next.delete(id);
      return next;
    });
  };
  const setVisibleSelected = (selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      visibleIds.forEach((id) => {
        if (selected) next.add(id);
        else next.delete(id);
      });
      return next;
    });
  };
  const updateItems = (ids: Set<string>, update: (item: CatalogItem) => CatalogItem, clear = false) => {
    items.forEach((item) => {
      if (!ids.has(item.id)) return;
      updateItem(item.id, update(item));
    });
    if (clear) clearSelection();
  };
  const updateSelectedItems = (update: (item: CatalogItem) => CatalogItem, message: string) => {
    updateItems(selectedIds, update, true);
    showFeedback(message);
  };
  const setSelectedStatus = (status: CatalogItem["status"]) => {
    const label = status === "archive" ? "Позиции перенесены в архив" : status === "stopped" ? "Позиции поставлены на стоп" : status === "coming-soon" ? "Позиции отмечены как скоро доступные" : "Позиции возвращены в меню";
    updateSelectedItems((item) => ({ ...item, status }), label);
  };
  const setSelectedAvailable = () => {
    updateSelectedItems((item) => ({ ...item, status: "active", scheduled: false }), "Позиции всегда доступны");
  };
  const applySelectedDiscount = (percent: number) => {
    const clamped = Math.max(0, Math.min(99, percent));
    updateSelectedItems((item) => ({
      ...item,
      hasDiscount: clamped > 0,
      priceWithSale: clamped > 0 ? Math.round(item.price * (100 - clamped) / 100) : null,
    }), clamped > 0 ? "Скидка применена" : "Скидка убрана");
    setBulkDialog(null);
  };
  const clearSelectedDiscount = () => {
    updateSelectedItems((item) => ({ ...item, hasDiscount: false, priceWithSale: null }), "Скидка убрана");
  };
  const deleteSelectedItems = () => {
    const selectedCreatedIds = new Set(readCreatedCatalogItems().filter((item) => selectedIds.has(item.id)).map((item) => item.id));
    if (selectedCreatedIds.size > 0) {
      removeCreatedCatalogItems(selectedCreatedIds);
    }
    deleteItems(selectedIds);
    setBulkDialog(null);
    clearSelection();
    showFeedback("Позиции удалены из прототипа");
  };
  const buildQueueSnapshot = (
    nextFilterId: AuditQueueFilterId,
    entryItemId: string,
    snapshotQuery = workspacePanelQuery,
    snapshotSectionScopeId = workspaceSectionScopeId,
    scrollTop = scrollContainerRef.current?.scrollTop ?? 0,
    snapshotPriceSort = workspacePriceSort,
    explicitItemIds?: string[],
  ): DescriptionAuditQueueSnapshot => ({
    itemIds: explicitItemIds ?? getQueueItemIds(nextFilterId, items, snapshotQuery, snapshotSectionScopeId, snapshotPriceSort, mandatoryFilterId),
    filterId: nextFilterId,
    entryFilterId: mandatoryFilterId ?? nextFilterId,
    filterLabel: activeSelectionLabel || undefined,
    query: snapshotQuery,
    returnPanelQuery: workspacePanelQuery,
    tableQuery: workspaceQuery,
    sectionScopeId: snapshotSectionScopeId,
    scrollTop,
    entryItemId,
    sort: snapshotPriceSort,
    entryFromSection: false,
  });
  const startDescriptionQueue = (item: CatalogItem, nextFilterId: AuditQueueFilterId) => {
    rememberOpenedPosition(item.id);
    const nextSnapshot = buildQueueSnapshot(
      nextFilterId,
      item.id,
      workspacePanelQuery,
      workspaceSectionScopeId,
      scrollContainerRef.current?.scrollTop ?? 0,
      workspacePriceSort,
      (editorFirstEnabled ? visible : panelItems).map((candidate) => candidate.id),
    );
    const currentId = nextSnapshot.itemIds.includes(item.id) ? item.id : nextSnapshot.itemIds[0] ?? null;
    setSelectedIds(new Set());
    setActivePositionId(currentId);
    setQueue({
      snapshot: { ...nextSnapshot, entryItemId: currentId ?? item.id },
      currentId,
    });
    if (editorFirstEnabled) setEditorFirstView("editor");
  };
  const startTableQueue = (item: CatalogItem, nextFilterId: AuditQueueFilterId) => {
    rememberOpenedPosition(item.id);
    const nextSnapshot = buildQueueSnapshot(
      nextFilterId,
      item.id,
      workspaceQuery,
      workspaceSectionScopeId,
      scrollContainerRef.current?.scrollTop ?? 0,
      workspacePriceSort,
      visibleIds,
    );
    setSelectedIds(new Set());
    setActivePositionId(item.id);
    setQueue({ snapshot: nextSnapshot, currentId: item.id });
    if (editorFirstEnabled) setEditorFirstView("editor");
  };
  useEffect(() => {
    if (!pendingOpen) pendingHandledRef.current = false;
  }, [pendingOpen]);
  // Первый переход строится атомарно в useState. Повторный приход той же create-страницы
  // через browser Forward восстанавливает очередь здесь, без перезагрузки приложения.
  useEffect(() => {
    if (!pendingOpen || pendingHandledRef.current) return;
    pendingHandledRef.current = true;
    const nextItems = initialItemsWithPending(pendingOpen, items);
    const nextQueue = buildSectionQueueFromPending(pendingOpen, nextItems);
    if (pendingOpen.item && !items.some((item) => item.id === pendingOpen.item?.id)) {
      addItem(pendingOpen.item);
    }
    setQueue(nextQueue);
    setActivePositionId(pendingOpen.id);
    if (editorFirstEnabled) {
      setEditorFirstView("editor");
      setEditorFirstFilterId(nextQueue?.snapshot.filterId ?? "quick:all");
      setEditorFirstSectionScopeId(nextQueue?.snapshot.sectionScopeId ?? pendingOpen.section?.sectionId ?? null);
      setEditorFirstQuery(nextQueue?.snapshot.query ?? "");
      setEditorFirstPriceSort(nextQueue?.snapshot.sort ?? "none");
    }
    if (pendingOpen.mode === "create" && pendingOpen.item) {
      beginDirectCreate({
        mode: "direct",
        draft: pendingOpen.item,
        context: { targetSectionId: pendingOpen.section?.sectionId ?? pendingOpen.item.sectionId },
        dirty: false,
      });
    } else {
      cancelDirectCreate();
    }
    rememberOpenedPosition(pendingOpen.id);
    onPendingOpenHandled?.();
    // pendingOpen is an atomic hand-off that must be consumed only once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingOpen]);
  const prepareRowAction = (item: CatalogItem, action: string, anchor?: MovePopoverAnchor) => {
    if (action === "Переместить в раздел" && anchor) {
      setMoveRequest({ operation: "position", itemIds: [item.id], anchor });
      return;
    }
    if (action === "Открыть в разделе") {
      onOpenSectionInSections(item.sectionId, item.id);
      return;
    }
    if (action === "Открыть позицию") {
      startTableQueue(item, workspaceFilterId);
      return;
    }
    const ids = new Set([item.id]);
    if (action === "На стоп") updateItems(ids, (current) => ({ ...current, status: "stopped" }));
    if (action === "Убрать со стопа" || action === "Восстановить") updateItems(ids, (current) => ({ ...current, status: "active" }));
    if (action === "В архив") updateItems(ids, (current) => ({ ...current, status: "archive" }));
    if (action === "Задать скидку") {
      updateItems(ids, (current) => ({ ...current, hasDiscount: true, priceWithSale: Math.round(current.price * 0.9) }));
    }
  };
  // Открыть таблицу текущей выборки: сохранить filter/scope, восстановить scroll,
  // подсветить последнюю открытую позицию.
  const returnToOverviewNow = () => {
    if (queue) {
      setWorkspaceFilterId(queue.snapshot.filterId);
      setWorkspaceQuery(editorFirstEnabled ? queue.snapshot.query : queue.snapshot.tableQuery);
      if (!editorFirstEnabled) setPanelQuery(queue.snapshot.returnPanelQuery ?? queue.snapshot.query);
      setWorkspaceSectionScopeId(queue.snapshot.sectionScopeId);
      setWorkspacePriceSort(queue.snapshot.sort);
      restoreScrollTopRef.current = queue.snapshot.scrollTop;
      setTableHighlightId(queue.currentId);
    }
    if (editorFirstEnabled) setEditorFirstView("table");
    else setQueue(null);
    setActiveEditorItemId(null);
    setBulkDialog(null);
    clearSelection();
  };
  const restoreCreateReturnContextNow = () => {
    const returnContext = queue?.snapshot.returnContext;
    if (returnContext?.tab === "sections") {
      setQueue(null);
      onRestoreStructureContext(returnContext, queue?.currentId ?? null);
      return;
    }
    if (returnContext?.tab === "overview") {
      setWorkspaceFilterId(returnContext.filterId);
      setWorkspaceQuery(editorFirstEnabled ? returnContext.panelQuery : returnContext.tableQuery);
      if (!editorFirstEnabled) setPanelQuery(returnContext.panelQuery);
      setWorkspaceSectionScopeId(returnContext.sectionScopeId);
      setWorkspacePriceSort(returnContext.sort);
      restoreScrollTopRef.current = returnContext.scrollTop;
      setQueue(null);
      if (editorFirstEnabled) setEditorFirstView("editor");
      setBulkDialog(null);
      clearSelection();
      return;
    }
    returnToOverviewNow();
  };
  const requestCreateBackNavigation = (continueNavigation: () => void) => {
    requestCreateNavigation(() => {
      restoreCreateReturnContextNow();
      continueNavigation();
    });
  };
  const backFromCreateDraft = () => {
    requestCreateBackNavigation(() => {
      if (navigation.route.createHistoryEntry) {
        navigation.back();
        return;
      }
      const fallbackSectionId = draftItem?.sectionId && draftItem.sectionId !== "no-section" ? draftItem.sectionId : null;
      navigation.replaceDirectCreateDestination({
        tab: "overview",
        filterId: "quick:all",
        sectionScopeId: fallbackSectionId,
        tableQuery: "",
        panelQuery: "",
        sort: "none",
        scrollTop: 0,
      }, fallbackSectionId);
    });
  };
  const openCreateSectionNow = (sectionId: string | null) => {
    const destination: CatalogReturnContext = { tab: "sections", sectionId };
    navigation.replaceDirectCreateDestination(destination, sectionId);
    onOpenSectionInSections(sectionId);
  };
  const openCreateSection = (sectionId: string | null) => {
    requestCreateNavigation(() => {
      openCreateSectionNow(sectionId);
    });
  };
  const cancelCreateDraft = () => {
    const sectionId = draftItem?.sectionId && draftItem.sectionId !== "no-section" ? draftItem.sectionId : null;
    requestCreateNavigation(() => openCreateSectionNow(sectionId));
  };
  useEffect(() => {
    if (!isCreateDraftOpen) {
      onRegisterCreateNavigationGuard(null);
      return;
    }
    onRegisterCreateNavigationGuard({
      request: requestCreateNavigation,
      requestBack: requestCreateBackNavigation,
      location: navigation.route.location,
    });
    return () => onRegisterCreateNavigationGuard(null);
  }, [draftDirty, isCreateDraftOpen, onRegisterCreateNavigationGuard, queue]);
  useEffect(() => {
    if (!isCreateDraftOpen || !draftDirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [draftDirty, isCreateDraftOpen]);
  const returnToOverview = () => requestCreateNavigation(returnToOverviewNow);
  const returnToOrigin = () => {
    const returnContext = queue?.snapshot.returnContext;
    if (returnContext?.tab === "sections") {
      const openItemId = queue?.currentId ?? null;
      setQueue(null);
      setBulkDialog(null);
      clearSelection();
      onRestoreStructureContext(returnContext, openItemId);
      return;
    }
    returnToOverviewNow();
  };
  // «Раздел» в breadcrumb: таблица всех позиций раздела, фильтр снимается.
  // Новая таблица монтируется с чистым scroll — restoreScrollTopRef не нужен.
  const openSectionTableNow = (targetSectionId: string) => {
    if (queue) setTableHighlightId(queue.currentId);
    if (!editorFirstEnabled) setQueue(null);
    setBulkDialog(null);
    clearSelection();
    setWorkspaceQuery("");
    if (!editorFirstEnabled) setPanelQuery("");
    setWorkspacePriceSort("none");
    setActiveFilterIds([]);
    setWorkspaceFilterId("quick:all");
    setWorkspaceSectionScopeId(targetSectionId);
    if (editorFirstEnabled) setEditorFirstView("table");
  };
  const openSectionTable = (targetSectionId: string) => requestCreateNavigation(() => openSectionTableNow(targetSectionId));
  const tableOpenSignalReadyRef = useRef(tableOpenSignal);
  useEffect(() => {
    if (tableOpenSignalReadyRef.current === tableOpenSignal) return;
    tableOpenSignalReadyRef.current = tableOpenSignal;
    setQueue(null);
    setBulkDialog(null);
    clearSelection();
    if (embedded) {
      setActivePositionId(null);
      return;
    }
    if (editorFirstEnabled) {
      setEditorFirstView("table");
      setEditorFirstSectionScopeId(sectionScopeId);
      setEditorFirstFilterId("quick:all");
      setEditorFirstQuery("");
      setEditorFirstPriceSort("none");
    } else {
      setPanelQuery("");
      setPriceSort("none");
    }
    setActiveFilterIds([]);
    setActivePositionId(null);
  }, [editorFirstEnabled, embedded, sectionScopeId, tableOpenSignal]);
  // Пока редактор открыт, смена фильтра/scope меняет ТОЛЬКО browse (список слева),
  // не закрывая редактор. Пересобираем очередь, сохраняя currentId (activePositionId);
  // если позиция не входит в новую выборку — строка просто не будет выделена.
  const rebrowse = (nextFilterId: OverviewFilterId, nextScopeId: string | null) => {
    setQueue((current) => {
      if (!current) return current;
      const itemIds = getQueueItemIds(nextFilterId, items, "", nextScopeId, current.snapshot.sort, mandatoryFilterId);
      return {
        ...current,
        snapshot: {
          ...current.snapshot,
          itemIds,
          filterId: nextFilterId,
          sectionScopeId: nextScopeId,
          query: "",
          returnPanelQuery: "",
        },
      };
    });
  };
  // Поиск «Найти позицию» в редакторе: ищет только внутри текущего раздела/фильтра,
  // не меняет их и не закрывает редактор (в отличие от handleQueryChange для таблицы).
  const rebrowseQuery = (nextQuery: string) => {
    setQueue((current) => {
      if (!current) return current;
      const itemIds = getQueueItemIds(current.snapshot.filterId, items, nextQuery, current.snapshot.sectionScopeId, current.snapshot.sort, mandatoryFilterId);
      return { ...current, snapshot: { ...current.snapshot, itemIds, query: nextQuery } };
    });
  };
  const openPanelFilterNow = (id: OverviewFilterId) => {
    const leavingDraft = queue?.currentId === creationItemId;
    setBulkDialog(null);
    clearSelection();
    setWorkspaceQuery("");
    if (!editorFirstEnabled) setPanelQuery("");
    setActiveFilterIds(id === "quick:all" || id === mandatoryFilterId ? [] : [id]);
    setWorkspaceFilterId(id);
    if (leavingDraft) setQueue(null);
    else if (queue) rebrowse(id, queue.snapshot.sectionScopeId);
  };
  const openPanelFilter = (id: OverviewFilterId) => {
    if (isCreateDraftOpen && id !== queue?.snapshot.filterId) {
      requestCreateNavigation(() => openPanelFilterNow(id));
      return;
    }
    openPanelFilterNow(id);
  };
  const openPanelSectionScopeNow = (id: string | null) => {
    const leavingDraft = queue?.currentId === creationItemId;
    setBulkDialog(null);
    clearSelection();
    setWorkspaceQuery("");
    if (!editorFirstEnabled) setPanelQuery("");
    setWorkspaceSectionScopeId(id);
    if (leavingDraft) setQueue(null);
    else if (queue) rebrowse(queue.snapshot.filterId, id);
  };
  const openPanelSectionScope = (id: string | null) => {
    if (isCreateDraftOpen && id !== queue?.snapshot.sectionScopeId) {
      requestCreateNavigation(() => openPanelSectionScopeNow(id));
      return;
    }
    openPanelSectionScopeNow(id);
  };
  const selectQueueItem = (id: string) => {
    rememberOpenedPosition(id);
    setActivePositionId(id);
    setQueue((current) => current ? { ...current, currentId: id } : current);
    if (editorFirstEnabled) setEditorFirstView("editor");
  };
  const openStructuralItemFromQueue = (id: string) => {
    suppressActiveItemChangeRef.current = true;
    setQueue(null);
    setActivePositionId(null);
    onOpenStructuralItem?.(id);
  };
  const openStructuralSectionFromQueue = (id: string) => {
    suppressActiveItemChangeRef.current = true;
    setQueue(null);
    setActivePositionId(null);
    onOpenStructuralSection?.(id);
  };
  const revealStructuralSectionFromQueue = (id: string) => {
    suppressActiveItemChangeRef.current = true;
    setQueue(null);
    setActivePositionId(null);
    onRevealStructuralSection?.(id);
  };
  const createPosition = async () => {
    if (!draftItem || createSubmitting || !draftItem.title.trim()) return;
    setCreateSubmitting(true);
    try {
      // Прототип имитирует сетевой запрос, чтобы состояние loading и защита от
      // повторной отправки были такими же, как у реального create API.
      await new Promise((resolve) => window.setTimeout(resolve, 350));
      const createdItem: CatalogItem = {
        ...draftItem,
        id: createRealPositionId(),
        title: draftItem.title.trim(),
        price: draftItem.price || 0,
        sectionName: draftItem.sectionName,
        hasDescription: descriptionHasContent(draftItem.description),
        translationFilledCount: draftItem.title.trim() ? 1 : 0,
      };
      const persistedItems = readCreatedCatalogItems();
      writeCreatedCatalogItems([...persistedItems, createdItem]);
      if (draftItem.id !== createdItem.id) deleteItem(draftItem.id);
      addItem(createdItem, { preserveLegacyOrderPersistence: true });
      setQueue((current) => current ? {
        ...current,
        currentId: createdItem.id,
        snapshot: {
          ...current.snapshot,
          itemIds: [createdItem.id, ...current.snapshot.itemIds.filter((id) => id !== createdItem.id)],
          entryItemId: createdItem.id,
        },
      } : current);
      setActivePositionId(createdItem.id);
      completeDirectCreate(createdItem.id);
      onCreateClosed?.();
      navigation.replaceDirectCreateDestination(
        queue?.snapshot.returnContext ?? {
          tab: "overview",
          filterId: "quick:all",
          sectionScopeId: createdItem.sectionId,
          tableQuery: "",
          panelQuery: "",
          sort: "none",
          scrollTop: 0,
        },
        createdItem.sectionId,
      );
      setRecentPositionIds((current) => promoteRecentPositionId(normalizeRecentPositionIds(current, [...items, createdItem]), createdItem.id));
      registerChange("catalog");
      showFeedback("Позиция создана");
    } catch {
      showFeedback("Не удалось создать позицию. Введённые данные сохранены в форме.");
    } finally {
      setCreateSubmitting(false);
    }
  };
  const setQueueAvailabilityMode = (item: CatalogItem, mode: AvailabilityMode) => {
    if (item.status === "archive") return;
    setItemStatus(item.id, mode === "unavailable" ? "stopped" : "active", mode === "schedule");
    registerChange("catalog");
  };
  const setCreateAvailabilityMode = (_item: CatalogItem, mode: AvailabilityMode) => {
    updateDraft({ status: mode === "unavailable" ? "stopped" : "active", scheduled: mode === "schedule" });
  };
  const toggleCreateStop = () => {
    updateDraft({ status: draftItem?.status === "stopped" ? "active" : "stopped" });
  };
  const toggleQueueStop = (item: CatalogItem) => {
    setItemStatus(item.id, item.status === "stopped" ? "active" : "stopped");
    registerChange("catalog");
  };
  const archiveQueueItem = (item: CatalogItem) => {
    setItemStatus(item.id, "archive");
    showFeedback("Позиция перенесена в архив");
  };
  const restoreQueueItem = (item: CatalogItem) => {
    setItemStatus(item.id, "active");
    showFeedback("Позиция восстановлена");
  };
  useEffect(() => {
    clearSelection();
  }, [workspaceFilterId]);

  useEffect(() => {
    clearSelection();
    if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = 0;
  }, [workspaceSectionScopeId]);

  useEffect(() => {
    const visibleIdSet = new Set(visibleIds);
    setSelectedIds((current) => {
      const next = new Set([...current].filter((id) => visibleIdSet.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [visibleIdKey]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (isCreateDraftOpen) {
          event.preventDefault();
          cancelCreateDraft();
          return;
        }
        clearSelection();
        setBulkDialog(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [cancelCreateDraft, isCreateDraftOpen]);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    setRecentPositionIds((current) => {
      const next = normalizeRecentPositionIds(current, items);
      return next.join("|") === current.join("|") ? current : next;
    });
  }, [items]);

  useEffect(() => {
    writeJsonRecord(CATALOG_RECENT_POSITION_STORAGE_KEY, recentPositionIds);
  }, [recentPositionIds]);

  useEffect(() => {
    if ((!editorFirstEnabled && queue) || (editorFirstEnabled && editorFirstView !== "table") || restoreScrollTopRef.current == null) return;
    const scrollTop = restoreScrollTopRef.current;
    restoreScrollTopRef.current = null;
    window.requestAnimationFrame(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollTop;
    });
  }, [editorFirstEnabled, editorFirstView, queue, workspaceFilterId, workspaceQuery, workspaceSectionScopeId]);

  useEffect(() => {
    if (!editorFirstEnabled || editorFirstView !== "table") return;
    const frame = window.requestAnimationFrame(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = editorFirstTableScrollTop;
    });
    return () => window.cancelAnimationFrame(frame);
    // Read the saved value only when the table is mounted. Depending on the live
    // value here would continually move the viewport back while the user scrolls.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editorFirstEnabled, editorFirstView]);

  useEffect(() => {
    if (!editorFirstEnabled) return;
    writeJsonRecord(EDITOR_FIRST_POSITIONS_STORAGE_KEY, {
      view: editorFirstView,
      filterId: editorFirstFilterId,
      sectionScopeId: editorFirstSectionScopeId,
      query: editorFirstQuery,
      sort: editorFirstPriceSort,
      tableScrollTop: editorFirstTableScrollTop,
      panelScrollTop: editorFirstPanelScrollTop,
      currentId: queue?.currentId ?? activePositionId,
      queue: creationItemId ? null : queue,
    });
  }, [
    activePositionId,
    creationItemId,
    editorFirstEnabled,
    editorFirstFilterId,
    editorFirstPanelScrollTop,
    editorFirstPriceSort,
    editorFirstQuery,
    editorFirstSectionScopeId,
    editorFirstTableScrollTop,
    editorFirstView,
    queue,
  ]);

  const queueCurrentItem = queue?.currentId
    ? queue.currentId === creationItemId
      ? draftItem
      : items.find((item) => item.id === queue.currentId) ?? null
    : null;
  const queueIsCreating = Boolean(queueCurrentItem && creationItemId === queueCurrentItem.id && draftItem);
  const itemsById = new Map(items.map((item) => [item.id, item]));
  // Очередь — снимок таблицы в момент открытия. Изменение позиции не должно
  // перестраивать порядок или выбрасывать её из навигации активного аудита.
  const queueOrderedItemIds = queue
    ? queue.snapshot.itemIds.filter((id) => itemsById.has(id))
    : [];
  const queuePanelItems = queueOrderedItemIds
    .map((id) => itemsById.get(id))
    .filter((item): item is CatalogItem => Boolean(item));
  const queuePanelItemsWithDraft = queueIsCreating && draftItem
    ? [{ ...draftItem, title: draftItem.title.trim() || "Новая позиция" }, ...queuePanelItems]
    : queuePanelItems;

  if (queue && (!editorFirstEnabled || editorFirstView === "editor")) {
    const repairMode = isRepairQueueFilter(queue.snapshot.filterId);
    const currentItem = queueCurrentItem;
    const isCreating = queueIsCreating;
    const editorContext = getQueueEditorContext(queue.snapshot.entryFilterId);
    // Раздел для breadcrumb: текущий scope выборки, а если позиция открыта без scope —
    // родной раздел позиции (у каждой позиции ровно один раздел).
    const breadcrumbSectionId = queue.snapshot.sectionScopeId ?? currentItem?.sectionId ?? null;
    const breadcrumbSectionName = queue.snapshot.sectionScopeId
      ? catalogSections.find((section) => section.id === queue.snapshot.sectionScopeId)?.name ?? "Все разделы"
      : currentItem?.sectionName ?? "Все разделы";
    const editorIntent: OpenPositionIntent | null = currentItem && !isCreating ? {
      origin: "positions",
      currentId: currentItem.id,
      orderedIds: queueOrderedItemIds,
      sectionId: queue.snapshot.sectionScopeId ?? undefined,
      snapshot: queue.snapshot,
      returnContext: {
        label: `Назад к результатам · ${queue.snapshot.filterLabel ?? HYBRID_PRIMARY_FILTER_LABELS[queue.snapshot.filterId]} · ${Math.max(1, queueOrderedItemIds.indexOf(currentItem.id) + 1)} из ${queueOrderedItemIds.length}`,
      },
      revision: catalogRevision,
    } : null;
    return (
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbf9]">
        <div className="flex min-h-0 flex-1">
          {!embedded && <UnifiedFlatCatalogPanel
            filterId={editorFirstEnabled ? workspaceFilterId : queue.snapshot.filterId}
            scopeSectionId={editorFirstEnabled ? workspaceSectionScopeId : queue.snapshot.sectionScopeId}
            allItems={items}
            items={getPanelItems(queue.snapshot.filterId, queuePanelItemsWithDraft)}
            selectedItemId={queue.currentId}
            onShowTable={editorFirstEnabled ? returnToOverview : returnToOrigin}
            listQuery={editorFirstEnabled ? workspaceQuery : queue.snapshot.query}
            onListQueryChange={(value) => {
              if (editorFirstEnabled) setEditorFirstQuery(value);
              rebrowseQuery(value);
            }}
            scrollSelectedToTop={queue.snapshot.entryFromSection}
            listScrollTop={editorFirstEnabled ? editorFirstPanelScrollTop : undefined}
            onListScrollTopChange={editorFirstEnabled ? setEditorFirstPanelScrollTop : undefined}
            onFilterChange={openPanelFilter}
            onSectionScopeChange={openPanelSectionScope}
            onSelectItem={(item) => requestCreateNavigation(() => selectQueueItem(item.id))}
          />}
          <div className={editorFirstEnabled ? "flex min-w-0 flex-1 flex-col overflow-hidden" : "contents"}>
          {editorFirstEnabled && (
            <PositionsWorkspaceViewSwitcher
              value={editorFirstView}
              onChange={(view) => {
                if (view === "table") returnToOverview();
                else setEditorFirstView("editor");
              }}
            />
          )}
          {isCreating && currentItem ? (
            <PositionEditor
              item={currentItem}
              mode={isCreating ? "create" : "edit"}
              allItems={items}
              upsell={queueUpsellByItem[currentItem.id] ?? {}}
              onUpsellChange={(next) => {
                setQueueUpsellByItem((current) => ({ ...current, [currentItem.id]: next }));
                if (isCreating) setDraftDirty(true);
              }}
              stopBusy={false}
              onArchiveItem={archiveQueueItem}
              onRestoreItem={restoreQueueItem}
              onMoveItem={(targetItem) => showFeedback(`Переместить «${targetItem.title}»: placeholder`)}
              onToggleStop={isCreating ? toggleCreateStop : toggleQueueStop}
              onSetAvailabilityMode={isCreating ? setCreateAvailabilityMode : setQueueAvailabilityMode}
              unavailableDisplayMode="hidden"
              outsideScheduleMode="hidden"
              weeklySchedule={createDefaultWeeklySchedule()}
              onUnavailableDisplayModeChange={() => {}}
              onOutsideScheduleModeChange={() => {}}
              onWeeklyScheduleChange={() => {}}
              onRequestPermanentDelete={() => {}}
              forcedEditorTab={editorContext.tab}
              focusAnchor={editorContext.anchor}
              showStopQuickAction={!repairMode}
              onDraftChange={isCreating ? updateDraft : undefined}
              onCreatePosition={isCreating ? createPosition : undefined}
              onBackCreate={isCreating ? backFromCreateDraft : undefined}
              onBackEdit={!isCreating && queue.snapshot.returnContext?.tab === "sections" ? returnToOrigin : undefined}
              onCancelCreate={isCreating ? cancelCreateDraft : undefined}
              createDisabled={isCreating ? !draftItem?.title.trim() : false}
              createSubmitting={isCreating ? createSubmitting : false}
              breadcrumb={
                isCreating ? (
                  <CreatePositionSectionLink
                    sectionPath={queue.snapshot.sectionPath ?? getCatalogSectionPath(currentItem.sectionId)}
                    onOpenSection={(sectionId) => openCreateSection(sectionId)}
                  />
                ) : (
                  <PositionEditorBreadcrumb
                    filterId={queue.snapshot.filterId}
                    sectionName={breadcrumbSectionName}
                    positionTitle={currentItem.title || "Новая позиция"}
                    onOpenSection={() => breadcrumbSectionId && openSectionTable(breadcrumbSectionId)}
                    onOpenFilter={returnToOverview}
                  />
                )
              }
            />
          ) : editorIntent ? (
            <PositionEditorHost
              intent={editorIntent}
              onCurrentIdChange={selectQueueItem}
              onClose={returnToOrigin}
              onFeedback={showFeedback}
              structureSections={structureSections}
              positionOrderBySection={structuralPositionOrderBySection}
              onOpenStructuralItem={openStructuralItemFromQueue}
              onOpenStructuralSection={openStructuralSectionFromQueue}
              onRevealStructuralSection={revealStructuralSectionFromQueue}
              onRevealItem={(item) => {
                setActiveFilterIds([]);
                setWorkspaceFilterId("quick:all");
                setWorkspaceSectionScopeId(item.sectionId);
                setWorkspaceQuery("");
                if (!editorFirstEnabled) setPanelQuery("");
                rebrowse("quick:all", item.sectionId);
              }}
            />
          ) : (
            <DescriptionQueueComplete filterId={queue.snapshot.filterId} onBack={returnToOverview} />
          )}
          </div>
          {feedback && <SelectionFeedback message={feedback} />}
          {discardDialogOpen && (
            <CreateDiscardDialog
              onContinue={() => {
                setDiscardDialogOpen(false);
                pendingCreateNavigationRef.current = null;
              }}
              onDiscard={discardCreateDraft}
            />
          )}
        </div>
      </main>
    );
  }

  if (editorFirstEnabled && editorFirstView === "editor") {
    return (
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbf9]">
        <div className="flex min-h-0 flex-1">
          {!embedded && <UnifiedFlatCatalogPanel
            filterId={workspaceFilterId}
            scopeSectionId={workspaceSectionScopeId}
            allItems={items}
            items={visible}
            selectedItemId={null}
            onShowTable={() => setEditorFirstView("table")}
            listQuery={workspaceQuery}
            onListQueryChange={setEditorFirstQuery}
            listScrollTop={editorFirstPanelScrollTop}
            onListScrollTopChange={setEditorFirstPanelScrollTop}
            onFilterChange={openPanelFilter}
            onSectionScopeChange={openPanelSectionScope}
            onSelectItem={(item) => startDescriptionQueue(item, workspaceFilterId)}
          />}
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <PositionsWorkspaceViewSwitcher value={editorFirstView} onChange={setEditorFirstView} />
            <EditorFirstPositionEmptyState />
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbf9]">
      <div className="flex min-h-0 flex-1">
        {!embedded && <UnifiedFlatCatalogPanel
          filterId={workspaceFilterId}
          scopeSectionId={workspaceSectionScopeId}
          allItems={items}
          items={editorFirstEnabled
            ? queue ? queuePanelItemsWithDraft : visible
            : getPanelItems(filterId, panelItems)}
          selectedItemId={queue?.currentId ?? activePositionId}
          listQuery={workspacePanelQuery}
          onListQueryChange={editorFirstEnabled ? handleQueryChange : setPanelQuery}
          listScrollTop={editorFirstEnabled ? editorFirstPanelScrollTop : undefined}
          onListScrollTopChange={editorFirstEnabled ? setEditorFirstPanelScrollTop : undefined}
          onFilterChange={openPanelFilter}
          onSectionScopeChange={openPanelSectionScope}
          onSelectItem={(item) => startDescriptionQueue(item, workspaceFilterId)}
        />}
        <div className={editorFirstEnabled ? "flex min-w-0 flex-1 flex-col overflow-hidden" : "contents"}>
        {editorFirstEnabled && (
          <PositionsWorkspaceViewSwitcher
            value={editorFirstView}
            onChange={(view) => {
              if (view === "editor") setEditorFirstView("editor");
            }}
          />
        )}
        <div
          ref={scrollContainerRef}
          data-catalog-results-scroll
          onScroll={(event) => {
            if (editorFirstEnabled) setEditorFirstTableScrollTop(event.currentTarget.scrollTop);
            else setOverviewScrollTop(event.currentTarget.scrollTop);
          }}
          className={cn(
            "min-w-0 flex-1 overflow-y-auto overflow-x-hidden pb-10",
            embedded ? "px-1.5" : "px-6",
          )}
        >
          <div className={cn(
            "mx-auto w-full min-w-0",
            catalogTable.getColumn("section")?.getIsVisible() ? "max-w-[920px]" : "max-w-[800px]",
          )}>
            {tableHeader ? (
              <div className="flex w-full items-center justify-between gap-3 px-1.5 pt-[18px]">
                {tableHeader}
                <CatalogTableFilterBar
                  activeFilterIds={activeFilterIds}
                  mandatoryFilterId={mandatoryFilterId}
                  sectionScopeId={workspaceSectionScopeId}
                  items={items}
                  table={catalogTable}
                  onResetColumns={() => setColumnVisibility({ ...DEFAULT_TABLE_COLUMN_VISIBILITY })}
                  onActiveFilterChange={setWorkspaceActiveFilter}
                  headerActionsOnly
                />
              </div>
            ) : (
              <div className="flex w-full items-center justify-between gap-3 px-1.5 pt-[18px]">
                <OverviewStatusBar filterId={workspaceFilterId} titleOverride={titleOverride} count={scopeTotalCount} />
                <CatalogTableFilterBar
                  activeFilterIds={activeFilterIds}
                  mandatoryFilterId={mandatoryFilterId}
                  sectionScopeId={workspaceSectionScopeId}
                  items={items}
                  table={catalogTable}
                  onResetColumns={() => setColumnVisibility({ ...DEFAULT_TABLE_COLUMN_VISIBILITY })}
                  onActiveFilterChange={setWorkspaceActiveFilter}
                  headerActionsOnly
                />
              </div>
            )}
            <div className={cn(
              "mt-3 min-w-0 overflow-hidden rounded-[13px] border border-[#e7e5e4] bg-white pb-1 pt-0.5 shadow-[0_1px_4px_rgba(12,12,13,0.05)]",
            )} data-catalog-items-card>
              {embedded && (
                <div className="flex min-w-0 items-center justify-between gap-3 px-3 py-2">
                  {!tableHeader ? (
                    <CatalogScopeSelect
                      value={workspaceSectionScopeId}
                      onChange={setWorkspaceSectionScopeId}
                      onReset={() => setWorkspaceSectionScopeId(null)}
                      allOptionLabel="Все разделы"
                      compact
                    />
                  ) : <span className="min-w-0 flex-1 text-[13px] font-medium text-[#44403b]">Позиции</span>}
                  {onAddPosition && allowPositionCreation && (
                    <Tooltip label={positionCreateDisabledReason ?? ""} side="top" disabled={!positionCreateDisabledReason}>
                      <span className="shrink-0">
                        <button
                          type="button"
                          onClick={onAddPosition}
                          disabled={Boolean(positionCreateDisabledReason)}
                          data-position-create-button
                          className="inline-flex h-7 items-center justify-center gap-1 rounded-[9px] border border-[#e7e5e4] bg-white pl-1 pr-2 text-[12px] font-normal leading-[17px] text-[#292524] transition hover:bg-[#fafaf9] disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                        >
                          <PlusCircle size={16} weight="regular" />
                          <span>Новая позиция</span>
                        </button>
                      </span>
                    </Tooltip>
                  )}
                  </div>
              )}
              {visible.length === 0 ? (
                <div className="p-6">
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-[16px] font-medium leading-[1.4] text-[#44403b]">
                        {activeFilterIds.length > 0 && !workspaceQuery.trim() ? "По текущим фильтрам ничего не найдено" : emptyTitle}
                      </p>
                      <p className="mt-2 text-[14px] leading-[1.4] text-[#79716b]">
                        {activeFilterIds.length > 0 && !workspaceQuery.trim() ? "Измените условия фильтрации или сбросьте фильтры." : emptyText}
                      </p>
                    </div>
                    {workspaceQuery.trim() ? (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="inline-flex h-[32px] items-center justify-center self-start rounded-[10px] border border-[#e7e5e4] bg-white px-[10px] text-[13px] font-medium text-[#57534d] transition hover:bg-[#fafaf9]"
                      >
                        Очистить поиск
                      </button>
                    ) : activeFilterIds.length > 0 ? (
                      <button
                        type="button"
                        onClick={resetFilter}
                        className="inline-flex h-[32px] items-center justify-center self-start rounded-[10px] border border-[#e7e5e4] bg-white px-[10px] text-[13px] font-medium text-[#57534d] transition hover:bg-[#fafaf9]"
                      >
                        Сбросить фильтры
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={resetFilter}
                        className="inline-flex h-[32px] items-center justify-center self-start rounded-[10px] border border-[#e7e5e4] bg-white px-[10px] text-[13px] font-medium text-[#57534d] transition hover:bg-[#fafaf9]"
                      >
                        Вернуться к разделам
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="[scrollbar-width:thin]">
                  <div className="w-full min-w-0">
                  <TableHeaderRow
                      query={workspaceQuery}
                      onQueryChange={handleQueryChange}
                      hideSearch={editorFirstEnabled}
                      checked={allVisibleSelected}
                      indeterminate={!allVisibleSelected && someVisibleSelected}
                      onSelectAll={setVisibleSelected}
                      priceSort={workspacePriceSort}
                      onPriceSortChange={handlePriceSortChange}
                      table={catalogTable}
                      onResetColumns={() => setColumnVisibility({ ...DEFAULT_TABLE_COLUMN_VISIBILITY })}
                    />
                  <div>
                    {selectedIds.size > 0 && (
                      <div className="sticky top-[58px] z-[9] flex items-center bg-white py-1">
                        <SelectionToolbar
                          count={selectedIds.size}
                          checked={allVisibleSelected}
                          indeterminate={!allVisibleSelected && someVisibleSelected}
                          onSelectAll={setVisibleSelected}
                          onClear={clearSelection}
                          onSetStatus={setSelectedStatus}
                          onSetAvailable={setSelectedAvailable}
                          onClearDiscount={clearSelectedDiscount}
                          onOpenSchedule={() => setBulkDialog({ type: "schedule" })}
                          onOpenDiscount={() => setBulkDialog({ type: "discount" })}
                          onMove={(anchor) => setMoveRequest({ operation: "bulk", itemIds: [...selectedIds], anchor })}
                          onOpenPlaceholder={(title, text) => setBulkDialog({ type: "placeholder", title, text })}
                          onOpenDelete={() => setBulkDialog({ type: "delete" })}
                        />
                      </div>
                    )}
                    <DndContext
                      sensors={tableReorderSensors}
                      collisionDetection={closestCenter}
                      modifiers={[restrictTableSortToVerticalAxis]}
                      onDragEnd={handleTableReorder}
                    >
                      <SortableContext items={visibleIds} strategy={verticalListSortingStrategy}>
                        <VirtualizedAuditRows
                            rows={catalogTable.getRowModel().rows}
                            selectedIds={selectedIds}
                            selectionMode={selectedIds.size > 0}
                            scrollParentRef={scrollContainerRef}
                            onSelectedChange={setItemSelected}
                            onAction={prepareRowAction}
                            renderActions={(item, onAction) => <AuditRowActionsMenu item={item} onAction={onAction} />}
                            highlightItemId={tableHighlightId}
                            reorderEnabled={canReorderTable}
                          />
                      </SortableContext>
                    </DndContext>
                  </div>
                  {bulkDialog && (
                    <BulkDialogModal
                      dialog={bulkDialog}
                      count={selectedIds.size}
                      onClose={() => setBulkDialog(null)}
                      onApplyDiscount={applySelectedDiscount}
                      onConfirmDelete={deleteSelectedItems}
                    />
                  )}
                  {feedback && <SelectionFeedback message={feedback} />}
                  {moveRequest && (
                    <MoveToSectionPopover
                      operation={moveRequest.operation}
                      entityIds={moveRequest.itemIds}
                      currentSectionIds={moveRequest.itemIds.map((id) => items.find((item) => item.id === id)?.sectionId).filter((id): id is string => Boolean(id))}
                      sections={structureSections ?? catalogSections}
                      anchor={moveRequest.anchor}
                      onClose={() => setMoveRequest(null)}
                      onMove={async (targetSectionId) => {
                        if (!targetSectionId) return;
                        const destination = (structureSections ?? catalogSections).find((section) => section.id === targetSectionId);
                        if (!destination) return;
                        const targets = moveRequest.itemIds
                          .map((id) => items.find((item) => item.id === id))
                          .filter((item): item is CatalogItem => item != null && item.sectionId !== targetSectionId);
                        const previous = targets.map((target) => ({ id: target.id, sectionId: target.sectionId, sectionName: target.sectionName }));
                        targets.forEach((target) => moveItem(target.id, targetSectionId, { sectionName: destination.name }));
                        try {
                          await new Promise<void>((resolve) => window.setTimeout(resolve, 350));
                          registerChange("catalog");
                          const message = moveRequest.operation === "bulk"
                            ? `${moveRequest.itemIds.length} ${plural(moveRequest.itemIds.length, "позиция перемещена", "позиции перемещены", "позиций перемещено")} в «${destination.name}»`
                            : `Позиция перемещена в «${destination.name}»`;
                          setMoveUndo({ previous, message });
                          if (moveRequest.operation === "bulk") clearSelection();
                        } catch (error) {
                          previous.forEach((entry) => moveItem(entry.id, entry.sectionId, { sectionName: entry.sectionName }));
                          throw error;
                        }
                      }}
                      onError={() => showFeedback("Не удалось переместить. Попробуйте ещё раз")}
                    />
                  )}
                  {moveUndo && (
                    <div className="fixed bottom-5 left-1/2 z-[100006] flex -translate-x-1/2 items-center gap-2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">
                      <span>{moveUndo.message}</span>
                      <span aria-hidden="true" className="text-white/45">·</span>
                      <button
                        type="button"
                        onClick={() => {
                          moveUndo.previous.forEach((entry) => moveItem(entry.id, entry.sectionId, { sectionName: entry.sectionName }));
                          setMoveUndo(null);
                          registerChange("catalog");
                        }}
                        className="rounded-[5px] font-semibold text-[#c9c2ff] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
                      >
                        Отменить
                      </button>
                    </div>
                  )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
        </div>
      </div>
    </main>
  );
}

const CATALOG_RECIPROCAL_HINT_STORAGE_KEY = catalogStorageKey("recommendations.reciprocalHintDismissed.v1");

function materializeRecommendationState(
  item: CatalogItem,
  items: CatalogItem[],
  state: CatalogItemUpsellState | undefined,
): CatalogItemUpsellState {
  const recommendationIds = resolveRecommendationIds(item, items, state);
  return {
    ...(state ?? {}),
    recommendationIds,
    recommendationSources: Object.fromEntries(
      recommendationIds.map((id) => [id, resolveRecommendationSource(state, id)]),
    ),
  };
}

function addManualRecommendationLinks(
  stateByItem: CatalogUpsellStateByItem,
  sourceItem: CatalogItem,
  targetIds: string[],
  reciprocal: boolean,
  items: CatalogItem[],
) {
  const next = { ...stateByItem };
  const sourceState = materializeRecommendationState(sourceItem, items, next[sourceItem.id]);
  const sourceIds = [...(sourceState.recommendationIds ?? [])];
  const sourceSources = { ...(sourceState.recommendationSources ?? {}) };
  const addedIds: string[] = [];

  targetIds.forEach((targetId) => {
    if (targetId === sourceItem.id || sourceIds.includes(targetId) || sourceIds.length >= CATALOG_RECOMMENDATION_LIMIT) return;
    if (reciprocal) {
      const targetItem = items.find((candidate) => candidate.id === targetId);
      if (!targetItem) return;
      const targetState = materializeRecommendationState(targetItem, items, next[targetId]);
      const targetRecommendationIds = targetState.recommendationIds ?? [];
      if (!targetRecommendationIds.includes(sourceItem.id) && targetRecommendationIds.length >= CATALOG_RECOMMENDATION_LIMIT) return;
    }
    sourceIds.push(targetId);
    addedIds.push(targetId);
    sourceSources[targetId] = "manual";
  });
  next[sourceItem.id] = { ...sourceState, recommendationIds: sourceIds, recommendationSources: sourceSources };

  if (!reciprocal) return { state: next, addedCount: addedIds.length, reciprocalCount: 0 };
  let reciprocalCount = 0;
  addedIds.forEach((targetId) => {
    const targetItem = items.find((candidate) => candidate.id === targetId);
    if (!targetItem) return;
    const targetState = materializeRecommendationState(targetItem, items, next[targetId]);
    const targetRecommendationIds = [...(targetState.recommendationIds ?? [])];
    if (targetRecommendationIds.includes(sourceItem.id)) {
      reciprocalCount += 1;
      return;
    }
    if (targetRecommendationIds.length >= CATALOG_RECOMMENDATION_LIMIT) return;
    targetRecommendationIds.push(sourceItem.id);
    next[targetId] = {
      ...targetState,
      recommendationIds: targetRecommendationIds,
      recommendationSources: { ...(targetState.recommendationSources ?? {}), [sourceItem.id]: "manual" },
    };
    reciprocalCount += 1;
  });
  return { state: next, addedCount: addedIds.length, reciprocalCount };
}

function generateRecommendationLinks(
  stateByItem: CatalogUpsellStateByItem,
  sourceItem: CatalogItem,
  items: CatalogItem[],
  mode: "supplement" | "regenerate",
) {
  const next = { ...stateByItem };
  const sourceState = materializeRecommendationState(sourceItem, items, next[sourceItem.id]);
  const currentIds = sourceState.recommendationIds ?? [];
  const currentSources = sourceState.recommendationSources ?? {};
  const baseIds = mode === "regenerate"
    ? currentIds.filter((id) => currentSources[id] === "manual")
    : currentIds;
  const additions = buildAutomaticRecommendations(sourceItem, items, baseIds);
  const nextSourceIds = [...baseIds, ...additions.map((entry) => entry.id)];
  next[sourceItem.id] = {
    ...sourceState,
    recommendationIds: nextSourceIds,
    recommendationSources: {
      ...Object.fromEntries(baseIds.map((id) => [id, currentSources[id] ?? "manual"])),
      ...Object.fromEntries(additions.map((entry) => [entry.id, "automatic" as const])),
    },
  };

  additions.filter((entry) => entry.reciprocal).forEach((entry) => {
    const targetItem = items.find((candidate) => candidate.id === entry.id);
    if (!targetItem) return;
    const targetState = materializeRecommendationState(targetItem, items, next[targetItem.id]);
    const targetIds = targetState.recommendationIds ?? [];
    if (targetIds.includes(sourceItem.id) || targetIds.length >= CATALOG_RECOMMENDATION_LIMIT) return;
    next[targetItem.id] = {
      ...targetState,
      recommendationIds: [...targetIds, sourceItem.id],
      recommendationSources: { ...(targetState.recommendationSources ?? {}), [sourceItem.id]: "automatic" },
    };
  });

  return { state: next, addedCount: additions.length };
}

type BulkRecommendationRunState = {
  stage: "setup" | "running" | "done";
  targetIds: string[];
  processed: number;
  updated: number;
  skipped: number;
};

export function RecommendationsContextWorkspace({
  selectedDishId,
  setSelectedDishId,
  setUpsellSurface,
  setUpsellFocused,
}: {
  selectedDishId?: string;
  setSelectedDishId?: (id: string) => void;
  setUpsellSurface?: (surface: "home" | "dish" | "cart") => void;
  setUpsellFocused?: (focused: boolean) => void;
} = {}) {
  const { items, setActiveEditorItemId, upsellByItem, setUpsellByItem } = useCatalogStore();
  const { registerChange } = usePublish();
  const [sectionScopeId, setSectionScopeId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedItemId, setSelectedItemId] = useState<string | null>(() => {
    return items.find((item) => item.id === selectedDishId)?.id
      ?? items.find((item) => item.status === "active" && resolveRecommendationIds(item, items, upsellByItem[item.id]).length === 0)?.id
      ?? items.find((item) => item.status === "active")?.id
      ?? items[0]?.id
      ?? null;
  });
  const [hintDismissed, setHintDismissed] = useState(() =>
    readJsonRecord<boolean>(CATALOG_RECIPROCAL_HINT_STORAGE_KEY, false),
  );
  const [bulkOpen, setBulkOpen] = useState(false);
  const [bulkScope, setBulkScope] = useState<"all" | "section">("all");
  const [bulkRun, setBulkRun] = useState<BulkRecommendationRunState>({
    stage: "setup",
    targetIds: [],
    processed: 0,
    updated: 0,
    skipped: 0,
  });
  const [feedback, setFeedback] = useState("");
  const scopeIds = useMemo(() => getSectionScopeIds(sectionScopeId, catalogSections), [sectionScopeId]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const visibleItems = useMemo(() => items.filter((item) => (
    (!scopeIds || scopeIds.has(item.sectionId))
    && (!normalizedQuery || getItemSearchText(item).includes(normalizedQuery))
  )), [items, normalizedQuery, scopeIds]);
  const selectedItem = items.find((item) => item.id === selectedItemId) ?? null;
  const selectedSection = catalogSections.find((section) => section.id === sectionScopeId) ?? null;

  const getBulkTargetIds = useCallback((scope: "all" | "section") => {
    const targetScopeIds = scope === "section" ? getSectionScopeIds(sectionScopeId, catalogSections) : null;
    return items
      .filter((item) => item.status === "active")
      .filter((item) => !targetScopeIds || targetScopeIds.has(item.sectionId))
      .filter((item) => resolveRecommendationIds(item, items, upsellByItem[item.id]).length === 0)
      .map((item) => item.id);
  }, [items, sectionScopeId, upsellByItem]);
  const allBulkCount = getBulkTargetIds("all").length;
  const sectionBulkCount = sectionScopeId ? getBulkTargetIds("section").length : 0;

  useEffect(() => {
    if (!selectedItem) {
      setActiveEditorItemId(null);
      setUpsellFocused?.(false);
      return;
    }
    setSelectedDishId?.(selectedItem.id);
    setActiveEditorItemId(selectedItem.id);
    setUpsellSurface?.("dish");
    setUpsellFocused?.(true);
    return () => {
      setActiveEditorItemId(null);
      setUpsellFocused?.(false);
    };
  }, [selectedItem?.id, setActiveEditorItemId, setSelectedDishId, setUpsellFocused, setUpsellSurface]);

  useEffect(() => {
    if (selectedItemId && visibleItems.some((item) => item.id === selectedItemId)) return;
    setSelectedItemId(visibleItems[0]?.id ?? null);
  }, [selectedItemId, visibleItems]);

  useEffect(() => {
    if (!feedback) return;
    const timer = window.setTimeout(() => setFeedback(""), 2400);
    return () => window.clearTimeout(timer);
  }, [feedback]);

  useEffect(() => {
    if (!bulkOpen || bulkRun.stage !== "running") return;
    const chunkIds = bulkRun.targetIds.slice(bulkRun.processed, bulkRun.processed + 8);
    if (chunkIds.length === 0) {
      setBulkRun((current) => ({ ...current, stage: "done" }));
      return;
    }
    const timer = window.setTimeout(() => {
      let nextState = upsellByItem;
      let updated = 0;
      let skipped = 0;
      chunkIds.forEach((id) => {
        const item = items.find((candidate) => candidate.id === id);
        if (!item) {
          skipped += 1;
          return;
        }
        const result = generateRecommendationLinks(nextState, item, items, "supplement");
        nextState = result.state;
        if (result.addedCount > 0) updated += 1;
        else skipped += 1;
      });
      setUpsellByItem(nextState);
      setBulkRun((current) => {
        const processed = current.processed + chunkIds.length;
        return {
          ...current,
          stage: processed >= current.targetIds.length ? "done" : "running",
          processed,
          updated: current.updated + updated,
          skipped: current.skipped + skipped,
        };
      });
    }, 70);
    return () => window.clearTimeout(timer);
  }, [bulkOpen, bulkRun, items, upsellByItem]);

  const openBulkDialog = () => {
    setBulkScope(sectionScopeId ? "section" : "all");
    setBulkRun({ stage: "setup", targetIds: [], processed: 0, updated: 0, skipped: 0 });
    setBulkOpen(true);
  };
  const startBulkGeneration = () => {
    const targetIds = getBulkTargetIds(bulkScope);
    setBulkRun({
      stage: targetIds.length > 0 ? "running" : "done",
      targetIds,
      processed: 0,
      updated: 0,
      skipped: 0,
    });
    if (targetIds.length > 0) registerChange("catalog");
  };
  const updateSelectedState = (next: CatalogItemUpsellState) => {
    if (!selectedItem) return;
    setUpsellByItem((current) => ({ ...current, [selectedItem.id]: next }));
    registerChange("catalog");
  };
  const addManualLinks = (ids: string[], reciprocal: boolean) => {
    if (!selectedItem) return;
    const result = addManualRecommendationLinks(upsellByItem, selectedItem, ids, reciprocal, items);
    setUpsellByItem(result.state);
    registerChange("catalog");
    setFeedback(
      result.addedCount === 0
        ? reciprocal
          ? "Не удалось создать взаимную связь: достигнут лимит рекомендаций"
          : "Выбранные позиции уже добавлены"
        : reciprocal && result.reciprocalCount === result.addedCount
          ? "Добавлены две независимые взаимные связи"
          : "Рекомендуемые позиции добавлены",
    );
  };
  const generateForSelected = (mode: "supplement" | "regenerate") => {
    if (!selectedItem) return;
    const result = generateRecommendationLinks(upsellByItem, selectedItem, items, mode);
    setUpsellByItem(result.state);
    registerChange("catalog");
    setFeedback(result.addedCount > 0 ? `Добавлено автоматически: ${result.addedCount}` : "Подходящих позиций для дополнения нет");
  };
  const isSelectedLinkReciprocal = (targetId: string) => {
    if (!selectedItem) return false;
    const targetItem = items.find((item) => item.id === targetId);
    if (!targetItem) return false;
    return resolveRecommendationIds(targetItem, items, upsellByItem[targetId]).includes(selectedItem.id);
  };
  const bulkProgress = bulkRun.targetIds.length > 0
    ? Math.round((bulkRun.processed / bulkRun.targetIds.length) * 100)
    : 100;

  return (
    <TooltipProvider>
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <aside className="flex w-[251px] shrink-0 flex-col overflow-hidden border-r border-[#e7e5e4] bg-[#fbfbf9]">
          <div className="border-b border-[#e7e5e4] px-3 pb-3 pt-4">
            <h2 className="px-1 text-[14px] font-medium leading-5 text-[#292524]">Допродажи</h2>
            <div className="mt-3">
              <CatalogScopeSelect
                value={sectionScopeId}
                onChange={setSectionScopeId}
                onReset={() => setSectionScopeId(null)}
                allOptionLabel="Все разделы"
              />
            </div>
            <button
              type="button"
              onClick={openBulkDialog}
              className="mt-2 flex h-[30px] w-full items-center gap-1.5 rounded-[8px] px-2 text-left text-[12px] font-normal text-[#57534d] transition hover:bg-[#f1f1ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              <Sparkle size={14} weight="fill" className="shrink-0" />
              <span className="min-w-0 flex-1 whitespace-nowrap">Заполнить ненастроенные</span>
              <CaretRight size={12} className="shrink-0 text-[#a6a09b]" />
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col">
            <div className="flex items-center justify-between px-4 pb-2 pt-3">
              <span className="text-[13px] font-medium text-[#44403b]">Позиции</span>
              <span className="text-[11px] tabular-nums text-[#a6a09b]">{visibleItems.length}</span>
            </div>
            <label className="mx-3 mb-2 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-white px-2.5">
              <MagnifyingGlass size={14} className="shrink-0 text-[#a6a09b]" />
              <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Найти позицию" className="min-w-0 flex-1 bg-transparent text-[12px] text-[#292524] outline-none placeholder:text-[#a6a09b]" />
            </label>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
              {visibleItems.map((item) => {
                const count = resolveRecommendationIds(item, items, upsellByItem[item.id]).length;
                const selected = item.id === selectedItemId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setSelectedItemId(item.id)}
                    className={cn(
                      "group flex h-8 w-full items-center gap-2 rounded-[8px] py-1.5 pl-1 pr-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                      selected ? "bg-[#f3f3ed]" : "hover:bg-[#f0f0ea]",
                    )}
                  >
                    <CatalogThumbnail src={item.thumbnailUrl} kind="item" className="h-5 w-5 rounded-[5.5px]" />
                    <span className={cn("min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]", selected ? "text-[#292524]" : "text-[#79716b]")}>{item.title}</span>
                    <span className="shrink-0 text-[11px] tabular-nums text-[#a6a09b]">{count || "—"}</span>
                  </button>
                );
              })}
              {visibleItems.length === 0 && <div className="px-2 py-6 text-center text-[12px] text-[#79716b]">Позиции не найдены</div>}
            </div>
          </div>
        </aside>

        <section className="min-w-0 flex-1 overflow-y-auto bg-[#fbfbf9] px-6 pb-10 pt-4">
          <div className="mx-auto w-full max-w-[680px]">
            {selectedItem ? (
              <>
                <div className="mb-3 flex items-center gap-2">
                  <CatalogThumb item={selectedItem} size={30} />
                  <div className="min-w-0 flex-1">
                    <h2 className="truncate text-[14px] font-medium text-[#292524]">{selectedItem.title}</h2>
                    <p className="truncate text-[12px] text-[#79716b]">{selectedItem.sectionName}</p>
                  </div>
                </div>
                {!hintDismissed && (
                  <div className="mb-3 rounded-[13px] bg-[#f5f5f4] px-4 py-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[14px] font-semibold leading-5 text-[#292524]">Рекомендации могут быть взаимными</h3>
                        <p className="mt-1 text-[13px] leading-[1.35] text-[#79716b]">При добавлении позиции можно включить взаимную рекомендацию. Тогда позиции будут рекомендоваться друг у друга. Порядок для каждой позиции настраивается отдельно.</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setHintDismissed(true);
                          writeJsonRecord(CATALOG_RECIPROCAL_HINT_STORAGE_KEY, true);
                        }}
                        className="shrink-0 rounded-full bg-black/[0.04] px-2 py-1 text-[12px] text-[#79716b] transition hover:bg-black/[0.07] hover:text-[#44403b]"
                      >
                        Скрыть
                      </button>
                    </div>
                  </div>
                )}
                <PromoRecommendationsCard
                  item={selectedItem}
                  allItems={items}
                  upsell={upsellByItem[selectedItem.id] ?? {}}
                  onChange={updateSelectedState}
                  onManualAdd={addManualLinks}
                  onGenerate={generateForSelected}
                  isReciprocal={isSelectedLinkReciprocal}
                />
              </>
            ) : (
              <div className="rounded-[13px] border border-dashed border-[#e7e5e4] bg-white p-6 text-center text-[13px] text-[#79716b]">Выберите позицию слева</div>
            )}
          </div>
        </section>
      </div>

      {bulkOpen && createPortal(
        <div className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/20 px-4" role="dialog" aria-modal="true" aria-label="Заполнить ненастроенные позиции">
          <div className="w-full max-w-[460px] overflow-hidden rounded-[14px] border border-[#e7e5e4] bg-white shadow-[0_24px_64px_rgba(41,37,36,0.18)]">
            <div className="border-b border-[#eceae7] px-4 py-3">
              <h3 className="text-[14px] font-medium text-[#292524]">Заполнить ненастроенные</h3>
              <p className="mt-1 text-[12px] leading-4 text-[#79716b]">Существующие ручные и автоматические рекомендации не изменятся.</p>
            </div>
            {bulkRun.stage === "setup" ? (
              <div className="px-4 py-4">
                <p className="mb-3 text-[13px] font-medium text-[#44403b]">Выберите охват</p>
                <label className={cn("flex cursor-pointer items-start gap-3 rounded-[10px] border p-3", bulkScope === "all" ? "border-[#a8a29e] bg-[#fafaf9]" : "border-[#e7e5e4]")}>
                  <input type="radio" name="bulk-scope" checked={bulkScope === "all"} onChange={() => setBulkScope("all")} className="mt-0.5 h-4 w-4 accent-[#292524]" />
                  <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-[#292524]">Все ненастроенные активные позиции каталога</span><span className="mt-1 block text-[12px] text-[#79716b]">Будет обработано: {allBulkCount}</span></span>
                </label>
                <label className={cn("mt-2 flex items-start gap-3 rounded-[10px] border p-3", sectionScopeId ? "cursor-pointer" : "cursor-not-allowed opacity-50", bulkScope === "section" && sectionScopeId ? "border-[#a8a29e] bg-[#fafaf9]" : "border-[#e7e5e4]")}>
                  <input type="radio" name="bulk-scope" checked={bulkScope === "section"} disabled={!sectionScopeId} onChange={() => setBulkScope("section")} className="mt-0.5 h-4 w-4 accent-[#292524]" />
                  <span className="min-w-0 flex-1"><span className="block text-[13px] font-medium text-[#292524]">Ненастроенные позиции выбранного раздела и подразделов</span><span className="mt-1 block text-[12px] text-[#79716b]">{selectedSection ? `${selectedSection.name}: ${sectionBulkCount}` : "Сначала выберите раздел в левой панели"}</span></span>
                </label>
              </div>
            ) : (
              <div className="px-4 py-5">
                <div className="flex items-center justify-between text-[13px] text-[#44403b]"><span>{bulkRun.stage === "running" ? "Заполняем позиции…" : "Готово"}</span><span className="tabular-nums text-[#79716b]">{bulkRun.processed} из {bulkRun.targetIds.length}</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-[#eceae7]"><div className="h-full rounded-full bg-[#57534d] transition-[width] duration-200" style={{ width: `${bulkProgress}%` }} /></div>
                {bulkRun.stage === "done" && <div className="mt-4 grid grid-cols-2 gap-2"><div className="rounded-[9px] bg-[#f0fdf4] p-3"><div className="text-[11px] text-[#15803d]">Настроено</div><div className="mt-1 text-[18px] font-medium tabular-nums text-[#166534]">{bulkRun.updated}</div></div><div className="rounded-[9px] bg-[#f5f5f4] p-3"><div className="text-[11px] text-[#79716b]">Без подходящих связей</div><div className="mt-1 text-[18px] font-medium tabular-nums text-[#57534d]">{bulkRun.skipped}</div></div></div>}
              </div>
            )}
            <div className="flex justify-end gap-2 border-t border-[#eceae7] px-4 py-3">
              {bulkRun.stage === "setup" ? (
                <><button type="button" onClick={() => setBulkOpen(false)} className="h-8 rounded-[8px] px-3 text-[13px] text-[#79716b] transition hover:bg-[#f5f5f4]">Отмена</button><button type="button" onClick={startBulkGeneration} className="h-8 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]">Запустить · {bulkScope === "section" ? sectionBulkCount : allBulkCount}</button></>
              ) : bulkRun.stage === "done" ? (
                <button type="button" onClick={() => setBulkOpen(false)} className="h-8 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]">Закрыть</button>
              ) : (
                <button type="button" disabled className="h-8 rounded-[8px] bg-[#d6d3d1] px-3 text-[13px] font-medium text-white">Выполняется</button>
              )}
            </div>
          </div>
        </div>,
        document.body,
      )}
      {feedback && <SelectionFeedback message={feedback} />}
    </main>
    </TooltipProvider>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CatalogWorkspace({
  navigation,
  catalogPhase,
  catalogTab,
  stopListActive,
  viewMode,
  sectionScopeId,
  stopListFilterId,
  stopListSectionScopeId,
  resetSignal,
  onOverviewFilterChange,
  onViewModeChange,
  onSectionScopeChange,
  onStopListFilterChange,
  onStopListSectionScopeChange,
  onCatalogTabChange,
  onRegisterCreateNavigationGuard,
  onAdvancePhase,
}: CatalogWorkspaceProps) {
  const { activeEditorItemId, items: sharedCatalogItems } = useCatalogStore();
  const createdItems = readCreatedCatalogItems();
  const [createdSectionName, setCreatedSectionName] = useState(CREATED_SECTION.name);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  // Переход «Редактировать в Позициях» из вкладки «Разделы» с контекстом раздела.
  const [pendingOpen, setPendingOpen] = useState<PendingOpen | null>(() => readDirectCreatePendingOpen(navigation.route));
  const directPositionHandledRef = useRef<string | null>(null);
  useEffect(() => {
    if (catalogTab !== "overview" || pendingOpen) return;
    const directPositionId = navigation.route.positionId;
    if (!directPositionId || directPositionHandledRef.current === directPositionId) return;
    const directItem = sharedCatalogItems.find((item) => item.id === directPositionId);
    if (!directItem) return;
    directPositionHandledRef.current = directPositionId;
    setPendingOpen({
      id: directItem.id,
      section: {
        sectionId: directItem.sectionId,
        sectionName: directItem.sectionName,
        positionIds: sharedCatalogItems
          .filter((item) => item.sectionId === directItem.sectionId)
          .map((item) => item.id),
        sectionPath: getCatalogSectionPath(directItem.sectionId),
      },
      returnContext: {
        tab: "overview",
        filterId: viewMode === "sections" ? "quick:all" : viewMode,
        sectionScopeId,
        tableQuery: "",
        panelQuery: readOverviewWorkspaceContext().panelQuery,
        sort: readOverviewWorkspaceContext().priceSort,
        scrollTop: readOverviewWorkspaceContext().scrollTop,
      },
    });
  }, [catalogTab, navigation.route.positionId, pendingOpen, sectionScopeId, sharedCatalogItems, viewMode]);
  const directCreateHistoryReadyRef = useRef(false);
  useEffect(() => {
    if (directCreateHistoryReadyRef.current) return;
    directCreateHistoryReadyRef.current = true;
    if (!navigation.route.createPosition) return;
    if (navigation.route.createHistoryEntry) return;
    const sectionId = navigation.route.sectionId;
    const returnContext = pendingOpen?.returnContext ?? {
      tab: "overview" as const,
      filterId: "quick:all" as const,
      sectionScopeId: sectionId,
      tableQuery: "",
      panelQuery: "",
      sort: "none" as const,
      scrollTop: 0,
    };
    navigation.prepareDirectCreate(sectionId, returnContext);
  }, [navigation, pendingOpen]);
  useEffect(() => {
    if (!navigation.route.createPosition) return;
    setPendingOpen((current) => current ?? readDirectCreatePendingOpen(navigation.route));
  }, [navigation.route.createPosition, navigation.route.revision]);
  const sections: TreeSection[] =
    catalogPhase === "empty"
      ? []
      : catalogPhase === "has-sections"
        ? [{ id: CREATED_SECTION.id, name: createdSectionName, emoji: CREATED_SECTION.emoji }]
        : buildSectionTree(catalogSections);
  const [flatQuery, setFlatQuery] = useState("");
  const [stopListQuery, setStopListQuery] = useState("");
  const overviewSectionScopeRef = useRef<string | null>(readOverviewWorkspaceContext().sectionScopeId);
  const [overviewTableOpenSignal, setOverviewTableOpenSignal] = useState(0);
  const [retainedItemId, setRetainedItemId] = useState<string | null>(null);
  const [retainedStructureHighlightItemId, setRetainedStructureHighlightItemId] = useState<string | null>(null);
  // Синхронизация вкладок: при переходе «Позиции → Разделы» с выбранным разделом —
  // открыть и выделить тот же раздел; с «Все разделы» — оставить прежнее состояние
  // дерева нетронутым (PopulatedWorkspace сам восстановит его из localStorage).
  const [retainedSectionId, setRetainedSectionId] = useState<string | null>(null);
  useEffect(() => {
    if (catalogTab !== "sections" || !retainedStructureHighlightItemId) return;
    const frame = window.requestAnimationFrame(() => setRetainedStructureHighlightItemId(null));
    return () => window.cancelAnimationFrame(frame);
  }, [catalogTab, retainedStructureHighlightItemId]);
  const prevCatalogTabRef = useRef(catalogTab);
  useEffect(() => {
    const prevTab = prevCatalogTabRef.current;
    prevCatalogTabRef.current = catalogTab;
    if (catalogTab === "sections" && prevTab !== "sections") {
      const activeItem = activeEditorItemId
        ? sharedCatalogItems.find((item) => item.id === activeEditorItemId) ?? null
        : null;
      setRetainedItemId(activeItem?.id ?? null);
      setRetainedSectionId(activeItem?.sectionId ?? sectionScopeId);
      if (activeItem) onSectionScopeChange(activeItem.sectionId);
    }
    if (catalogTab === "overview" && prevTab === "sections") {
      const restoredOverviewScopeId = overviewSectionScopeRef.current;
      const restoredOverviewContext = readOverviewWorkspaceContext();
      onSectionScopeChange(restoredOverviewScopeId);
      if (!activeEditorItemId) return;
      const activeItem = sharedCatalogItems.find((item) => item.id === activeEditorItemId) ?? null;
      if (!activeItem) return;
      setPendingOpen({
        id: activeItem.id,
        section: {
          sectionId: activeItem.sectionId,
          sectionName: activeItem.sectionName,
          positionIds: sharedCatalogItems
            .filter((item) => item.sectionId === activeItem.sectionId)
            .map((item) => item.id),
          sectionPath: getCatalogSectionPath(activeItem.sectionId),
        },
        returnContext: {
          tab: "overview",
          filterId: viewMode === "sections" ? "quick:all" : viewMode,
          sectionScopeId: restoredOverviewScopeId,
          tableQuery: flatQuery,
          panelQuery: restoredOverviewContext.panelQuery,
          sort: restoredOverviewContext.priceSort,
          scrollTop: restoredOverviewContext.scrollTop,
        },
      });
    }
  }, [activeEditorItemId, catalogTab, flatQuery, onSectionScopeChange, sectionScopeId, sharedCatalogItems, viewMode]);
  const previousCatalogResetSignalRef = useRef(resetSignal);
  useEffect(() => {
    if (previousCatalogResetSignalRef.current === resetSignal) return;
    previousCatalogResetSignalRef.current = resetSignal;
    setFlatQuery("");
    setRetainedItemId(null);
  }, [resetSignal]);
  const structureWorkspace = catalogPhase === "has-items" ? (
    <PopulatedWorkspace
      key="catalog-workspace"
      navigation={navigation}
      sections={sections}
      createdItems={createdItems}
      filterId={viewMode === "sections" ? "quick:all" : viewMode}
      scopeSectionId={sectionScopeId}
      query={flatQuery}
      resetSignal={resetSignal}
      initialSelectedItemId={retainedItemId}
      initialHighlightItemId={retainedStructureHighlightItemId}
      initialSelectedSectionId={retainedSectionId}
      initialReturnContext={null}
      pendingOpen={pendingOpen}
      tableOpenSignal={overviewTableOpenSignal}
      onFilterChange={(id) => {
        onViewModeChange(id);
        onOverviewFilterChange(id);
      }}
      onQueryChange={setFlatQuery}
      onScopeChange={onSectionScopeChange}
      onOpenSectionInOverview={(sectionId) => {
        setFlatQuery("");
        setRetainedSectionId(sectionId);
        setOverviewTableOpenSignal((signal) => signal + 1);
        overviewSectionScopeRef.current = sectionId;
        onSectionScopeChange(sectionId);
        onViewModeChange("quick:all");
        onOverviewFilterChange("quick:all");
        onCatalogTabChange("overview");
      }}
      onRegisterCreateNavigationGuard={onRegisterCreateNavigationGuard}
      onPendingOpenHandled={() => {
        if (pendingOpen?.mode !== "create") setPendingOpen(null);
      }}
      onCreateClosed={() => setPendingOpen(null)}
    />
  ) : (
    <EmptyCatalog
      sections={sections}
      onAddItem={() => onAdvancePhase("has-items")}
    />
  );
  const stopListWorkspace = catalogPhase === "has-items" ? (
    <PopulatedWorkspace
      key="stop-list-workspace"
      navigation={navigation}
      sections={sections}
      createdItems={createdItems}
      filterId={stopListFilterId}
      scopeSectionId={stopListSectionScopeId}
      query={stopListQuery}
      resetSignal={resetSignal}
      initialSelectedItemId={null}
      initialSelectedSectionId={stopListSectionScopeId}
      initialReturnContext={null}
      tableOpenSignal={0}
      onFilterChange={onStopListFilterChange}
      onQueryChange={setStopListQuery}
      onScopeChange={onStopListSectionScopeChange}
      onOpenSectionInOverview={onStopListSectionScopeChange}
      onRegisterCreateNavigationGuard={onRegisterCreateNavigationGuard}
      mandatoryFilterId="status:stop"
      titleOverride="Позиции на стопе"
      allowPositionCreation={false}
      workspaceKind="stop-list"
    />
  ) : (
    <EmptyCatalog sections={sections} onAddItem={() => onAdvancePhase("has-items")} />
  );
  const workspace = catalogPhase === "empty" ? (
      <CatalogEmptyState onCreateSection={() => setSectionDialogOpen(true)} />
    ) : catalogTab === "upsell" ? (
      <RecommendationsContextWorkspace />
    ) : stopListActive ? (
      stopListWorkspace
    ) : (
      structureWorkspace
    );

  return (
    <TooltipProvider delayDuration={200}>
      <div className="flex min-w-0 flex-1 overflow-hidden rounded-[20px] border border-[#e7e5e4] bg-[#fbfbf9]">
        {workspace}
      </div>
      {sectionDialogOpen && (
        <CreateSectionDialog
          onCreate={(name) => {
            setCreatedSectionName(name);
            setSectionDialogOpen(false);
            onAdvancePhase("has-sections");
            return true;
          }}
          onCancel={() => setSectionDialogOpen(false)}
        />
      )}
    </TooltipProvider>
  );
}
