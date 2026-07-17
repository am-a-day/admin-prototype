import { useEffect, useRef, useState, type ChangeEvent, type DragEvent, type PointerEvent as ReactPointerEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowLeft,
  CaretLeft,
  CaretDown,
  CaretRight,
  CaretUp,
  Check,
  CheckCircle,
  Clock,
  Dot,
  DotsThreeVertical,
  DotsSixVertical,
  Fire,
  ForkKnife,
  FunnelSimple,
  ImageBroken,
  List,
  Lock,
  MagnifyingGlass,
  MegaphoneSimple,
  Play,
  Plus,
  PlusCircle,
  Prohibit,
  Tag,
  Table,
  Trash,
  XCircle,
} from "@phosphor-icons/react";
import { TranslatableField } from "@/components/workspace/translatable-field";
import { DescriptionRichTextEditor } from "@/components/workspace/description-rich-text-editor";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { useAppSettings } from "@/contexts/app-settings-context";
import { usePublish } from "@/contexts/publish-context";
import type { Category } from "@/data/mock-data";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import { buildSectionTree, catalogItems, catalogSections, formatPrice } from "@/data/catalog";
import type { CatalogItem } from "@/data/catalog";
import { cn } from "@/lib/utils";

export type CatalogPhase = "empty" | "has-sections" | "has-items";

export type CatalogTab = "sections" | "overview" | "upsell";
const CATALOG_TABS: { id: CatalogTab; label: string; count?: number }[] = [
  { id: "sections", label: "Разделы" },
  { id: "upsell", label: "Рекомендации" },
];

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
  value: CatalogTab;
  onChange: (t: CatalogTab) => void;
}) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-[#f5f5f4] p-0.5">
      {CATALOG_TABS.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[12px] transition",
            value === t.id
              ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]"
              : "text-[#79716b] hover:text-zinc-700",
          )}
        >
          <span>{t.label}</span>
          {typeof t.count === "number" && (
            <span className={cn(
              "ml-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-medium",
              value === t.id ? "bg-[#f5f5f4] text-[#57534d]" : "bg-white/70 text-[#a6a09b]",
            )}>
              {t.count}
            </span>
          )}
        </button>
      ))}
    </div>
  );
}

export function StopListShortcut({
  hidden,
  onClick,
}: {
  hidden?: boolean;
  onClick: () => void;
}) {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const onStatusChange = () => setVersion((value) => value + 1);
    window.addEventListener("tasko-catalog-status-change", onStatusChange);
    return () => window.removeEventListener("tasko-catalog-status-change", onStatusChange);
  }, []);

  const statusOverrides = readJsonRecord<Record<string, CatalogItem["status"]>>(CATALOG_STATUS_STORAGE_KEY, {});
  const stopCount = catalogItems.filter((item) => (statusOverrides[item.id] ?? item.status) === "stopped").length;
  void version;
  if (hidden) return null;

  return (
    <div className="flex items-center gap-2">
      <div className="h-5 w-px bg-[#d6d3d1]" />
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-lg px-2.5 text-[12px] font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
          stopCount === 0
            ? "text-[#a8a29e] hover:bg-[#efefea]"
            : "text-[#79716b] hover:bg-[#efefea] hover:text-[#292524]",
        )}
      >
        <span>Стоп-лист</span>
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-white/70 px-1 text-[10px] font-medium text-[#a6a09b]">
          {stopCount}
        </span>
      </button>
    </div>
  );
}

type CatalogWorkspaceProps = {
  selectedDishId: string;
  catalogPhase: CatalogPhase;
  catalogTab: CatalogTab;
  overviewFilterId: OverviewFilterId;
  onOverviewFilterChange: (id: OverviewFilterId) => void;
  onCatalogTabChange: (tab: CatalogTab) => void;
  onFlatModeChange: (flat: boolean) => void;
  onAdvancePhase: (next: "has-sections" | "has-items") => void;
};

type CatalogViewMode = "sections" | OverviewFilterId;

/** Section node for the left panels: real sections carry imageUrl, mock/created ones an emoji. */
type TreeSection = {
  id: string;
  parentId?: string | null;
  name: string;
  imageUrl?: string | null;
  emoji?: string;
  sortOrder?: number;
  status?: SectionStatus;
  availabilityMode?: AvailabilityMode;
  children?: TreeSection[];
};
type SectionStatus = "active" | "archive";
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

const SECTIONS_WITH_ITEMS = catalogSections.filter((section) =>
  catalogItems.some((item) => item.sectionId === section.id),
);
type AuditChip = {
  label: string;
  tone: "stop" | "status" | "archived" | "problem";
};
type GuestProperty = {
  label: string;
  icon?: "label" | "tag" | "spicy";
};
type OverviewFilterMeta = {
  label: string;
  emptyTitle: string;
  emptyText: string;
  countText: (count: number) => string;
};
export type OverviewFilterId =
  | "quick:all"
  | "quick:no-description"
  | "quick:no-photo"
  | "quick:no-weight"
  | "quick:no-kbju"
  | "quick:no-translation"
  | "quick:discount"
  | "quick:with-tags"
  | "quick:with-labels"
  | "quick:with-options"
  | "quick:with-recommendations"
  | "quick:no-recommendations"
  | "display:full"
  | "display:no-button"
  | "display:no-price"
  | "status:active"
  | "status:archived"
  | "status:stop"
  | "status:soon"
  | "status:schedule";

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
    label: "Без граммовки",
    countText: (count) => `${count} ${plural(count, "позиция требует", "позиции требуют", "позиций требуют")} граммовку`,
    emptyTitle: "Нет позиций без граммовки",
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

const FILTER_PREDICATES: Record<OverviewFilterId, (item: CatalogItem) => boolean> = {
  "quick:all": () => true,
  "quick:no-description": (item) => !item.hasDescription,
  "quick:no-photo": (item) => !item.thumbnailUrl,
  "quick:no-weight": (item) => !item.weightLabel,
  "quick:no-kbju": (item) => item.nutritionFilledCount === 0,
  "quick:no-translation": (item) => item.translationFilledCount < item.translationTotalCount,
  "quick:discount": (item) => item.hasDiscount,
  "quick:with-tags": (item) => item.tags.length > 0,
  "quick:with-labels": (item) => item.guestLabels.length > 0,
  "quick:with-options": (item) => item.optionsCount > 0,
  "quick:with-recommendations": (item) => item.recommendationsCount > 0,
  "quick:no-recommendations": (item) => item.recommendationsCount === 0,
  "display:full": (item) => item.displayMode === "full",
  "display:no-button": (item) => item.displayMode === "no-button",
  "display:no-price": (item) => item.displayMode === "no-price",
  "status:active": (item) => item.status === "active",
  "status:archived": (item) => item.status === "archive",
  "status:stop": (item) => item.status === "stopped",
  "status:soon": (item) => item.status === "coming-soon",
  "status:schedule": (item) => item.scheduled,
};

function getOverviewItems(filterId: OverviewFilterId, items: CatalogItem[] = catalogItems) {
  return items.filter(FILTER_PREDICATES[filterId]);
}

const CATALOG_VIEW_MODE_GROUPS: { label: string; ids: CatalogViewMode[] }[] = [
  { label: "Структура", ids: ["sections"] },
  { label: "Позиции", ids: ["quick:all", "status:active", "status:archived"] },
  { label: "Доступность", ids: ["status:stop", "status:soon", "status:schedule"] },
  { label: "Заполненность", ids: ["quick:no-description", "quick:no-photo", "quick:no-weight", "quick:no-kbju", "quick:no-translation"] },
  { label: "Возможности", ids: ["quick:no-recommendations", "quick:with-recommendations", "quick:discount", "quick:with-labels", "quick:with-tags"] },
];

function getCatalogViewModeLabel(mode: CatalogViewMode) {
  return mode === "sections" ? "По разделам" : OVERVIEW_FILTER_META[mode].label;
}

function getCatalogViewModeCount(mode: CatalogViewMode) {
  return mode === "sections" ? null : getOverviewItems(mode).length;
}

function CatalogViewModeSelect({
  value,
  onChange,
  onReset,
}: {
  value: CatalogViewMode;
  onChange: (mode: CatalogViewMode) => void;
  onReset?: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-2">
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label="Режим представления каталога"
            className="inline-flex h-5 min-w-0 max-w-[190px] cursor-pointer items-center gap-1.5 rounded-[6px] px-1 text-left transition hover:bg-[#f1f1ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <span className="min-w-0 truncate text-[14px] font-normal leading-5 text-[#292524]">{getCatalogViewModeLabel(value)}</span>
            <CaretDown size={14} weight="bold" className="shrink-0 text-[#1c1917]" />
          </button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content
            align="start"
            collisionPadding={12}
            sideOffset={6}
            className="z-[100002] max-h-[min(520px,calc(100vh-24px),var(--radix-dropdown-menu-content-available-height))] w-[250px] overflow-y-auto overscroll-contain rounded-[12px] border border-[#e7e5e4] bg-white p-1.5 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
          >
            {CATALOG_VIEW_MODE_GROUPS.map((group, groupIndex) => (
              <div key={group.label}>
                {groupIndex > 0 && <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />}
                <DropdownMenu.Label className="px-2 pb-1 pt-1.5 text-[11px] font-medium text-[#a6a09b]">{group.label}</DropdownMenu.Label>
                {group.ids.map((mode) => {
                  const count = getCatalogViewModeCount(mode);
                  return (
                    <DropdownMenu.Item
                      key={mode}
                      onSelect={() => onChange(mode)}
                      className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                    >
                      <span className="min-w-0 flex-1 truncate">{getCatalogViewModeLabel(mode)}</span>
                      {typeof count === "number" && (
                        <span className="shrink-0 text-[12px] font-medium tabular-nums text-[#a6a09b]">{count}</span>
                      )}
                      {value === mode && <Check size={13} className="shrink-0 text-[#79716b]" />}
                    </DropdownMenu.Item>
                  );
                })}
              </div>
            ))}
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
      {value !== "sections" && onReset && (
        <Tooltip label="Вернуться к разделам" side="bottom">
          <button
            type="button"
            aria-label="Вернуться к разделам"
            onClick={onReset}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <XCircle size={16} />
          </button>
        </Tooltip>
      )}
    </div>
  );
}

function getSectionScopeIds(sectionId: string | null) {
  if (!sectionId) return null;
  const result = new Set<string>([sectionId]);
  let changed = true;
  while (changed) {
    changed = false;
    catalogSections.forEach((section) => {
      if (section.parentId && result.has(section.parentId) && !result.has(section.id)) {
        result.add(section.id);
        changed = true;
      }
    });
  }
  return result;
}

type AuditQueueFilterId = OverviewFilterId;
type PriceSortDirection = "none" | "asc" | "desc";
type DescriptionAuditQueueSnapshot = {
  itemIds: string[];
  filterId: AuditQueueFilterId;
  query: string;
  sectionScopeId: string | null;
  scrollTop: number;
  entryItemId: string;
  sort: PriceSortDirection;
};
type DescriptionAuditQueueState = {
  snapshot: DescriptionAuditQueueSnapshot;
  currentId: string | null;
  currentBucket: "remaining" | "fixed";
};
type DescriptionSaveStatus = "idle" | "saving" | "saved";

const REPAIR_QUEUE_FILTER_IDS: AuditQueueFilterId[] = [
  "quick:no-description",
  "quick:no-photo",
  "quick:no-weight",
  "quick:no-kbju",
  "quick:no-translation",
  "quick:no-recommendations",
  "status:stop",
];
const AUDIT_QUEUE_EMPTY_TITLE: Partial<Record<AuditQueueFilterId, string>> = {
  "quick:no-description": "У всех позиций есть описание",
  "quick:no-photo": "У всех позиций есть фото",
  "quick:no-weight": "У всех позиций указан вес",
  "quick:no-kbju": "У всех позиций заполнены КБЖУ",
  "quick:no-translation": "У всех позиций заполнены переводы",
  "quick:no-recommendations": "У всех позиций есть рекомендации",
  "status:stop": "В стоп-листе нет позиций",
};
const AUDIT_QUEUE_EDITOR_CONTEXT: Partial<Record<AuditQueueFilterId, { tab: EditorTab; anchor?: "description" | "media" }>> = {
  "quick:no-description": { tab: "basic", anchor: "description" },
  "quick:no-photo": { tab: "basic", anchor: "media" },
  "quick:no-recommendations": { tab: "promo" },
  "status:stop": { tab: "availability" },
};

function isRepairQueueFilter(id: AuditQueueFilterId) {
  return REPAIR_QUEUE_FILTER_IDS.includes(id);
}

function getQueueEditorContext(id: AuditQueueFilterId): { tab: EditorTab; anchor?: "description" | "media" } {
  return AUDIT_QUEUE_EDITOR_CONTEXT[id] ?? { tab: "basic" };
}

function descriptionHasContent(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .trim().length > 0;
}

function getDisplayedPrice(item: CatalogItem) {
  if (item.price === 0 && item.priceWithSale == null) return null;
  return item.hasDiscount && item.priceWithSale != null ? item.priceWithSale : item.price;
}

function sortItemsByPrice<T extends CatalogItem>(items: T[], direction: PriceSortDirection): T[] {
  if (direction === "none") return items;
  return items
    .map((item, index) => ({ item, index, price: getDisplayedPrice(item) }))
    .sort((left, right) => {
      if (left.price == null && right.price == null) return left.index - right.index;
      if (left.price == null) return 1;
      if (right.price == null) return -1;
      const diff = direction === "asc" ? left.price - right.price : right.price - left.price;
      return diff || left.index - right.index;
    })
    .map(({ item }) => item);
}

function getNextPriceSort(direction: PriceSortDirection): PriceSortDirection {
  if (direction === "none") return "asc";
  if (direction === "asc") return "desc";
  return "none";
}

function getPriceSortTooltip(direction: PriceSortDirection) {
  if (direction === "none") return "Сортировать по возрастанию";
  if (direction === "asc") return "Сортировать по убыванию";
  return "Сбросить сортировку";
}

function getAdjacentUnfixedId(
  itemIds: string[],
  items: CatalogItem[],
  filterId: AuditQueueFilterId,
  currentId: string | null,
  direction: 1 | -1,
) {
  const byId = new Map(items.map((item) => [item.id, item]));
  const repairMode = isRepairQueueFilter(filterId);
  const currentIndex = currentId ? itemIds.indexOf(currentId) : -1;
  let index = currentIndex + direction;
  while (index >= 0 && index < itemIds.length) {
    const item = byId.get(itemIds[index]);
    if (item && (!repairMode || FILTER_PREDICATES[filterId](item))) return item.id;
    index += direction;
  }
  return null;
}

function getQueueItemIds(
  filterId: AuditQueueFilterId,
  items: CatalogItem[],
  query: string,
  sectionScopeId: string | null,
  priceSort: PriceSortDirection = "none",
) {
  const normalizedQuery = query.trim().toLowerCase();
  const scopeIds = getSectionScopeIds(sectionScopeId);
  const filtered = getOverviewItems(filterId, items)
    .filter((item) => !scopeIds || scopeIds.has(item.sectionId))
    .filter((item) =>
      !normalizedQuery || [item.title, item.sectionName].some((value) => value.toLowerCase().includes(normalizedQuery)),
    );
  return sortItemsByPrice(filtered, priceSort).map((item) => item.id);
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

function CatalogPanelRow({
  row,
  selected,
  onClick,
}: {
  row: PanelRow;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group flex h-8 w-full items-center rounded-xl border px-[6px] pr-2 text-left text-[13px] font-medium leading-[18px] transition",
        selected
          ? "rounded-lg border-[#e7e5e4] bg-white text-[#292524] shadow-[0_0_2px_rgba(0,0,0,0.09)]"
          : "border-transparent text-[#79716b] hover:bg-[#f1f1ea]",
      )}
    >
      {(row.icon || row.imageUrl) && (
        <span className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-[#e6e6db] text-[12px]">
          {row.imageUrl ? (
            <img src={row.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            row.icon
          )}
        </span>
      )}
      <span className="min-w-0 flex-1 truncate">{row.label}</span>
      {typeof row.count === "number" && (
        <span className={cn(
          "ml-2 shrink-0 text-[12px] font-medium",
          selected || (row.accent && (row.count ?? 0) > 0) ? "text-[#57534d]" : "text-[#a8a29e]",
        )}>
          {row.count}
        </span>
      )}
    </button>
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

function buildLocalSectionTree(sections: TreeSection[]): TreeSection[] {
  const nodes = new Map(sections.map((section) => [section.id, { ...section, children: [] as TreeSection[] }]));
  const roots: TreeSection[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children ?? [] : roots).push(node);
  }
  const sortTree = (list: TreeSection[]) => {
    list.sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "ru"));
    list.forEach((section) => sortTree(section.children ?? []));
  };
  sortTree(roots);
  return roots;
}

function flattenSections(sections: TreeSection[]): TreeSection[] {
  return sections.flatMap((section) => [section, ...flattenSections(section.children ?? [])]);
}

function sectionHasChildren(sectionId: string, sections: TreeSection[]) {
  return sections.some((section) => section.parentId === sectionId);
}

function AddSectionDialog({
  onCreate,
  onCancel,
}: {
  onCreate: (name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSubmit = () => {
    const nextName = name.trim();
    if (!nextName) return;
    onCreate(nextName);
  };

  return createPortal(
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/30 backdrop-blur-[2px]">
      <div className="w-[360px] rounded-2xl bg-white p-5 shadow-2xl ring-1 ring-[#e7e5e4]">
        <h2 className="text-[16px] font-medium text-[#292524]">Новый раздел</h2>
        <input
          ref={inputRef}
          value={name}
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSubmit();
            if (event.key === "Escape") onCancel();
          }}
          placeholder="Название раздела"
          className="mt-4 h-9 w-full rounded-[10px] border border-[#e7e5e4] px-3 text-[14px] text-[#292524] outline-none transition placeholder:text-[#a8a29e] focus:border-[#4f39f6] focus:ring-2 focus:ring-[#4f39f6]/10"
        />
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-[10px] px-3 text-[14px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524]"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!name.trim()}
            className="h-8 rounded-[10px] bg-[#4f39f6] px-3 text-[14px] font-medium text-white transition hover:bg-[#4030d4] disabled:opacity-40"
          >
            Создать раздел
          </button>
        </div>
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

export function CatalogFiltersPanel({
  selectedId,
  onSelect,
  sectionScopeId,
  onSectionScopeChange,
  items,
}: {
  selectedId: OverviewFilterId;
  onSelect: (id: OverviewFilterId) => void;
  sectionScopeId: string | null;
  onSectionScopeChange: (id: string | null) => void;
  items: CatalogItem[];
}) {
  const scopeSection = catalogSections.find((section) => section.id === sectionScopeId) ?? null;
  const countByFilter = (id: OverviewFilterId) =>
    getOverviewItems(id, items).filter((item) => !scopeSection || item.sectionId === scopeSection.id).length;
  const groups: { title: string; rows: PanelRow[] }[] = [
    {
      title: "Позиции",
      rows: [
        { id: "quick:all", label: "Все", count: countByFilter("quick:all") },
        { id: "status:active", label: "Активные", count: countByFilter("status:active") },
        { id: "status:archived", label: "В архиве", count: countByFilter("status:archived") },
      ],
    },
    {
      title: "Доступность",
      rows: [
        { id: "status:stop", label: "На стопе", count: countByFilter("status:stop") },
        { id: "status:soon", label: "Скоро будут", count: countByFilter("status:soon") },
        { id: "status:schedule", label: "По расписанию", count: countByFilter("status:schedule") },
      ],
    },
    {
      title: "Заполненность",
      rows: [
        { id: "quick:no-description", label: "Без описания", count: countByFilter("quick:no-description") },
        { id: "quick:no-photo", label: "Без фото", count: countByFilter("quick:no-photo") },
        { id: "quick:no-weight", label: "Без граммовки", count: countByFilter("quick:no-weight") },
        { id: "quick:no-kbju", label: "Без КБЖУ", count: countByFilter("quick:no-kbju") },
        { id: "quick:no-translation", label: "Без перевода", count: countByFilter("quick:no-translation") },
      ],
    },
    {
      title: "Возможности",
      rows: [
        { id: "quick:no-recommendations", label: "Без рекомендаций", count: countByFilter("quick:no-recommendations") },
        { id: "quick:with-recommendations", label: "С рекомендациями", count: countByFilter("quick:with-recommendations") },
        { id: "quick:discount", label: "Со скидкой", count: countByFilter("quick:discount") },
        { id: "quick:with-labels", label: "Со стикерами", count: countByFilter("quick:with-labels") },
        { id: "quick:with-tags", label: "С тегами", count: countByFilter("quick:with-tags") },
        { id: "quick:with-options", label: "С опциями", count: countByFilter("quick:with-options") },
      ],
    },
    {
      title: "Отображение",
      rows: [
        { id: "display:full", label: "Полный вид", count: countByFilter("display:full") },
        { id: "display:no-button", label: "Без кнопки", count: countByFilter("display:no-button") },
        { id: "display:no-price", label: "Без кнопки и цены", count: countByFilter("display:no-price") },
      ],
    },
  ];

  return (
    <aside className="flex w-[228px] shrink-0 flex-col gap-4 overflow-y-auto border-r border-border bg-[#fbfbf9] px-2 pt-4">
      <div className="pl-[5px] pr-2">
        <h2 className="text-[14px] leading-[1.4] text-[#292524]">Фильтры</h2>
      </div>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            className="flex w-full items-center gap-2 rounded-[8px] bg-[#f0f0ea] p-1.5 text-left transition hover:bg-[#eae9e2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center overflow-hidden rounded-[3px] bg-white text-[11px]">
              {scopeSection?.imageUrl ? (
                <img src={scopeSection.imageUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <List size={12} className="text-[#57534d]" />
              )}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px] text-[#292524]">
              {scopeSection ? scopeSection.name : "Все разделы"}
            </span>
            <span className="flex h-[14px] w-5 shrink-0 items-center justify-center rounded-[4px] bg-[#efefeb]">
              <CaretDown size={12} className="text-[#79716b]" />
            </span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownContent align="start">
          <DropdownActionItem onSelect={() => onSectionScopeChange(null)}>Все разделы</DropdownActionItem>
          <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
          <div className="max-h-[320px] overflow-y-auto">
            {SECTIONS_WITH_ITEMS.map((section) => {
              const count = getOverviewItems(selectedId, items).filter((item) => item.sectionId === section.id).length;
              return (
                <DropdownActionItem key={section.id} onSelect={() => onSectionScopeChange(section.id)}>
                  <span className="flex w-full items-center gap-2">
                    <span className="min-w-0 flex-1 truncate">{section.name}</span>
                    <span className="text-[12px] text-[#a8a29e]">{count}</span>
                  </span>
                </DropdownActionItem>
              );
            })}
          </div>
        </DropdownContent>
      </DropdownMenu.Root>
      {groups.map((group) => (
        <div key={group.title} className="flex flex-col gap-[9px]">
          <div className="px-1.5 text-[12px] font-medium leading-[18px] text-[#a6a09b]">{group.title}</div>
          <div className="flex flex-col gap-1">
            {group.rows.map((row) => (
              <FilterPanelRow
                key={row.id}
                row={row}
                selected={selectedId === row.id}
                onClick={() => onSelect(row.id as OverviewFilterId)}
              />
            ))}
          </div>
        </div>
      ))}
      <div className="h-2 shrink-0" />
    </aside>
  );
}

function FilterPanelRow({
  row,
  selected,
  onClick,
}: {
  row: PanelRow;
  selected?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex w-full items-center gap-2 p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        selected
          ? "rounded-[8px] border border-[#e7e5e4] bg-white shadow-[0_0_2px_rgba(0,0,0,0.09)]"
          : "rounded-[12px] border border-transparent hover:bg-[#f0f0ea]",
      )}
    >
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]",
          selected ? "text-[#292524]" : "text-[#79716b]",
        )}
      >
        {row.label}
      </span>
      <span className="flex h-[14px] w-5 shrink-0 items-center justify-center rounded-[4px] bg-[#efefeb] text-[10px] font-medium leading-4 text-[#79716b]">
        {row.count}
      </span>
    </button>
  );
}

function CatalogContextPanel({
  selectedId,
  onSelect,
}: {
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  return (
    <CatalogSidePanel title="Разделы" actionLabel="Добавить раздел">
      <div className="space-y-1">
        {SECTIONS_WITH_ITEMS.map((section) => (
          <CatalogPanelRow
            key={section.id}
            row={{
              id: section.id,
              label: section.name,
              count: catalogItems.filter((item) => item.sectionId === section.id).length,
              imageUrl: section.imageUrl,
              icon: section.imageUrl ? undefined : "🍽️",
            }}
            selected={selectedId === section.id}
            onClick={() => onSelect(section.id)}
          />
        ))}
      </div>
    </CatalogSidePanel>
  );
}

// ── Empty catalog: skeleton + left panel (phase-aware) ────────────────────────

function EmptyCatalog({
  sections,
}: {
  sections: TreeSection[];
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
          onAddItem={() => showPlaceholderFeedback("Добавить позицию: placeholder")}
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

type EditorTab = "basic" | "promo" | "options" | "availability" | "display";
type AvailabilityMode = "always" | "unavailable" | "schedule";
type UnavailableDisplayMode = "hidden" | "comingSoon";
type OutsideScheduleMode = "hidden" | "comingSoon";
type ScheduleDayKey = "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday";
type DaySchedule =
  | { mode: "allDay" }
  | { mode: "unavailable" }
  | { mode: "custom"; intervals: Array<{ start: string; end: string }> };
type WeeklySchedule = Record<ScheduleDayKey, DaySchedule>;
type PreviousAvailabilityState = {
  status: CatalogItem["status"];
  scheduled: boolean;
};
type LocalizedValue = {
  ru: string;
  kk?: string;
  en?: string;
};
type CatalogItemUpsellState = {
  recommendationIds?: string[];
  sticker?: LocalizedValue | null;
  tags?: LocalizedValue[];
  keywords?: LocalizedValue[];
};
type CatalogUpsellStateByItem = Record<string, CatalogItemUpsellState>;

const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: "basic", label: "Основное" },
  { id: "promo", label: "Допродажа" },
  { id: "options", label: "Опции" },
  { id: "availability", label: "Доступность" },
  { id: "display", label: "Отображение" },
];
const editorTabByItem = new Map<string, EditorTab>();

// Demo video-package limits (prototype constants, no backend).
const VIDEO_LIMIT_TOTAL = 10;
const VIDEO_LIMIT_USED = 6;
const VIDEO_PACKAGE_CONNECTED = true;
const ACTIVE_POSITION_LIMIT = 600;
const CATALOG_STATUS_STORAGE_KEY = "tasko.catalog.statusOverrides";
const CATALOG_SCHEDULE_STORAGE_KEY = "tasko.catalog.scheduleOverrides";
const CATALOG_PREVIOUS_AVAILABILITY_STORAGE_KEY = "tasko.catalog.previousAvailability";
const CATALOG_UNAVAILABLE_DISPLAY_STORAGE_KEY = "tasko.catalog.unavailableDisplay";
const CATALOG_OUTSIDE_SCHEDULE_STORAGE_KEY = "tasko.catalog.outsideSchedule";
const CATALOG_WEEKLY_SCHEDULE_STORAGE_KEY = "tasko.catalog.weeklySchedule";
const CATALOG_SECTION_STATUS_STORAGE_KEY = "tasko.catalog.sectionStatusOverrides";
const CATALOG_SECTION_DRAFT_STORAGE_KEY = "tasko.catalog.sectionDraftOverrides";
const CATALOG_SECTION_AVAILABILITY_STORAGE_KEY = "tasko.catalog.sectionAvailabilityMode";
const CATALOG_SECTION_OUTSIDE_SCHEDULE_STORAGE_KEY = "tasko.catalog.sectionOutsideSchedule";
const CATALOG_SECTION_WEEKLY_SCHEDULE_STORAGE_KEY = "tasko.catalog.sectionWeeklySchedule";
const CATALOG_UPSELL_STORAGE_KEY = "tasko.catalog.upsellByItem";
const CATALOG_POSITION_ORDER_STORAGE_KEY = "tasko.catalog.positionOrderBySection";
const CATALOG_SECTION_ORDER_STORAGE_KEY = "tasko.catalog.sectionOrderByParent";
const CATALOG_ITEM_SECTION_STORAGE_KEY = "tasko.catalog.itemSectionOverrides";
const CATALOG_SECTION_PARENT_STORAGE_KEY = "tasko.catalog.sectionParentOverrides";
const LOCALIZED_VALUE_PLACEHOLDERS: Record<LanguageCode, string> = {
  ru: "Например, Хит",
  kk: "Мысалы, Хит",
  en: "For example, Hit",
};

type MediaKind = "photo" | "video";
type MediaEntry = {
  id: string;
  kind: MediaKind;
  fileName?: string;
  previewUrl?: string;
  coverMode?: "auto" | "custom";
};

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

function getLocalizedValueLabel(value: LocalizedValue | null | undefined, language: LanguageCode) {
  if (!value) return null;
  return value[language]?.trim() || value.ru.trim() || value.kk?.trim() || value.en?.trim() || null;
}

function getLocalizedValueFromUnknown(value: unknown, fallback: string | null = null) {
  if (value === null) return null;
  if (value === undefined) return fallback ? normalizeLocalizedValue({ ru: fallback }) : null;
  const normalized = normalizeLocalizedValue({
    ru: getStringField(value, "ru"),
    kk: getStringField(value, "kk"),
    en: getStringField(value, "en"),
  });
  return normalized ?? (fallback ? normalizeLocalizedValue({ ru: fallback }) : null);
}

function getLocalizedValuesFromUnknown(value: unknown, fallback: string[] = []) {
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

function getLocalizedValueLabels(values: LocalizedValue[], language: LanguageCode) {
  return values
    .map((value) => getLocalizedValueLabel(value, language))
    .filter((value): value is string => Boolean(value));
}

function buildDefaultRecommendationIds(item: CatalogItem, items: CatalogItem[]) {
  if (item.recommendationsCount <= 0) return [];
  return items
    .filter((candidate) => candidate.id !== item.id && candidate.status !== "archive")
    .slice(0, item.recommendationsCount)
    .map((candidate) => candidate.id);
}

function resolveRecommendationIds(
  item: CatalogItem,
  items: CatalogItem[],
  state?: CatalogItemUpsellState,
) {
  return state?.recommendationIds ?? buildDefaultRecommendationIds(item, items);
}

function moveArrayItem<T>(items: T[], fromIndex: number, toIndex: number) {
  if (fromIndex < 0 || toIndex < 0 || fromIndex >= items.length || toIndex >= items.length) return items;
  const next = [...items];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

function getItemSearchText(item: CatalogItem) {
  return `${item.title} ${item.sectionName}`.toLowerCase();
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
        showTranslationMeta={false}
        plain
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

        <EditorField label="Объем">
          <input
            value={weightText}
            onChange={(event) => {
              if (isFormattedNumericDraft(event.target.value)) setWeightText(event.target.value);
            }}
            onBlur={() => {
              const value = parseMoneyInput(weightText);
              if (value != null) setWeightText(formatPlainNumber(value));
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

function CatalogThumb({ item, size = 30 }: { item: CatalogItem; size?: number }) {
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
  onAdd: (ids: string[]) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sectionFilterId, setSectionFilterId] = useState<string | null>(null);
  const [checkedIds, setCheckedIds] = useState<string[]>([]);
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
    onAdd(next);
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
                    <span className="min-w-0 truncate">{selectedSection?.name ?? "Все разделы"}</span>
                    <CaretDown size={13} className="shrink-0 text-[#a8a29e]" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-[100006] max-h-[280px] min-w-[220px] overflow-y-auto rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
                  >
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
          <div className="flex shrink-0 items-center gap-2 border-t border-[#eceae7] px-4 py-3">
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

function PromoRecommendationsCard({
  item,
  allItems,
  upsell,
  onChange,
}: {
  item: CatalogItem;
  allItems: CatalogItem[];
  upsell: CatalogItemUpsellState;
  onChange: (next: CatalogItemUpsellState) => void;
}) {
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const recommendationIds = resolveRecommendationIds(item, allItems, upsell);
  const recommendations = recommendationIds
    .map((id) => allItems.find((candidate) => candidate.id === id))
    .filter((candidate): candidate is CatalogItem => Boolean(candidate));
  const setRecommendationIds = (ids: string[]) => onChange({ ...upsell, recommendationIds: ids });
  const reorderRecommendation = (fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;
    setRecommendationIds(moveArrayItem(recommendationIds, fromIndex, toIndex));
  };
  const handleDrop = (toIndex: number) => {
    if (dragIndex == null) return;
    reorderRecommendation(dragIndex, toIndex);
    setDragIndex(null);
  };

  return (
    <>
      <div data-upsell-card="recommendations" className="border-t border-[#e7e5e4]">
        <div className="px-4 pb-2 pt-4">
          <h3 className="text-[13px] font-medium leading-5 text-[#292524]">Рекомендации</h3>
          <p className="text-[13px] leading-5 text-[#79716b]">показываются гостю при открытии позиции</p>
        </div>
        {recommendations.length > 0 ? (
          <div className="space-y-2 px-4 pb-3">
            {recommendations.map((recommended, index) => (
              <div
                key={recommended.id}
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault();
                  handleDrop(index);
                }}
                className={cn(
                  "group flex h-[30px] items-center gap-2 rounded-[8px] transition hover:bg-[#f8f7f4]",
                  dragIndex === index && "bg-[#f5f5f4] opacity-70",
                )}
              >
                <Tooltip label="Изменить порядок" side="top">
                  <button
                    type="button"
                    draggable
                    aria-label="Изменить порядок рекомендации"
                    onDragStart={(event) => {
                      event.dataTransfer.effectAllowed = "move";
                      setDragIndex(index);
                    }}
                    onDragEnd={() => setDragIndex(null)}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowUp") {
                        event.preventDefault();
                        reorderRecommendation(index, Math.max(0, index - 1));
                      }
                      if (event.key === "ArrowDown") {
                        event.preventDefault();
                        reorderRecommendation(index, Math.min(recommendations.length - 1, index + 1));
                      }
                    }}
                    className="flex h-[30px] w-5 shrink-0 cursor-grab items-center justify-center rounded-[6px] text-[#a8a29e] transition hover:bg-[#f5f5f4] hover:text-[#57534d] active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                  >
                    <DotsSixVertical size={16} />
                  </button>
                </Tooltip>
                <CatalogThumb item={recommended} size={30} />
                <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-4 text-[#292524]">{recommended.title}</span>
                <Tooltip label="Удалить рекомендацию" side="top">
                  <button
                    type="button"
                    aria-label="Удалить рекомендацию"
                    onClick={() => setRecommendationIds(recommendationIds.filter((id) => id !== recommended.id))}
                    className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[8px] text-[#a8a29e] opacity-0 transition hover:bg-[#f5f5f4] hover:text-[#dc2626] focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 group-hover:opacity-100"
                  >
                    <XCircle size={18} />
                  </button>
                </Tooltip>
              </div>
            ))}
          </div>
        ) : (
          <div className="px-4 pb-3 text-[13px] leading-5 text-[#a8a29e]">
            Рекомендации не добавлены
          </div>
        )}
        <button
          type="button"
          onClick={() => setSelectorOpen(true)}
          className="flex h-10 w-full items-center gap-2 border-t border-[#eceae7] px-4 text-[13px] font-medium text-[#57534d] transition hover:bg-[#f8f7f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10"
        >
          <PlusCircle size={16} className="text-[#79716b]" />
          Добавить рекомендацию
        </button>
      </div>

      {selectorOpen && (
        <ItemSelectorDialog
          currentItem={item}
          items={allItems}
          selectedIds={recommendationIds}
          onAdd={(ids) => setRecommendationIds([...recommendationIds, ...ids.filter((id) => !recommendationIds.includes(id) && id !== item.id)])}
          onClose={() => setSelectorOpen(false)}
        />
      )}
    </>
  );
}

type PromoLocalizedDialogState =
  | { kind: "sticker"; index: 0 | null }
  | { kind: "tags" | "keywords"; index: number | null };

function PromoTab({
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

function PlaceholderTab({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <h3 className="text-[13px] font-semibold text-[#292524]">{title}</h3>
      <div className="mt-2 text-[13px] leading-6 text-[#57534d]">{children}</div>
      <p className="mt-3 text-[12px] text-zinc-400">Редактирование появится на следующем шаге прототипа.</p>
    </div>
  );
}

function StopQuickActionButton({
  item,
  busy,
  onToggleStop,
  compact = false,
}: {
  item: CatalogItem;
  busy: boolean;
  onToggleStop: (item: CatalogItem) => void;
  compact?: boolean;
}) {
  if (item.status !== "active" && item.status !== "stopped") return null;
  const stopped = item.status === "stopped";
  const label = stopped ? "Вернуть в продажу" : "Поставить на стоп";

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip label={label} side="top" delayDuration={200}>
      <button
        type="button"
        aria-label={label}
        disabled={busy}
        onClick={() => onToggleStop(item)}
        className={cn(
          "inline-flex h-7 shrink-0 items-center justify-center gap-1.5 rounded-[8px] border border-transparent text-[12px] font-medium leading-5 text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:pointer-events-none disabled:opacity-50",
          compact ? "w-7 px-0" : "px-2",
        )}
      >
        {busy ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-[#a8a29e] border-t-transparent" />
        ) : stopped ? (
          <ArrowCounterClockwise size={13} />
        ) : (
          <Prohibit size={13} />
        )}
        {!compact && <span className="hidden min-[520px]:inline">{label}</span>}
      </button>
      </Tooltip>
    </div>
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

function createDefaultWeeklySchedule(): WeeklySchedule {
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

function isWeeklyScheduleValid(schedule: WeeklySchedule) {
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

function SectionAvailabilityTab({
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
          title: "Скрыть раздел",
          description: "Раздел временно не показывается гостям",
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

function PositionEditor({
  item,
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
  headerMeta,
  onDescriptionChange,
  onMediaAdded,
  forcedEditorTab,
  focusAnchor,
  forceBasicTabOnItemChange = false,
  showStopQuickAction = true,
}: {
  item: CatalogItem;
  allItems: CatalogItem[];
  upsell: CatalogItemUpsellState;
  onUpsellChange: (next: CatalogItemUpsellState) => void;
  stopBusy: boolean;
  onArchiveItem: (item: CatalogItem) => void;
  onRestoreItem: (item: CatalogItem) => void;
  onMoveItem: (item: CatalogItem) => void;
  onToggleStop: (item: CatalogItem) => void;
  onSetAvailabilityMode: (item: CatalogItem, mode: AvailabilityMode) => void;
  unavailableDisplayMode: UnavailableDisplayMode;
  outsideScheduleMode: OutsideScheduleMode;
  weeklySchedule: WeeklySchedule;
  onUnavailableDisplayModeChange: (mode: UnavailableDisplayMode) => void;
  onOutsideScheduleModeChange: (mode: OutsideScheduleMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  onRequestPermanentDelete: (item: CatalogItem) => void;
  headerMeta?: ReactNode;
  onDescriptionChange?: (item: CatalogItem, value: string) => void;
  onMediaAdded?: (item: CatalogItem, previewUrl: string) => void;
  forcedEditorTab?: EditorTab;
  focusAnchor?: "description" | "media";
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

  const nextForcedTab = forcedEditorTab ?? (forceBasicTabOnItemChange ? "basic" : undefined);

  useEffect(() => {
    setActiveTab(nextForcedTab ?? editorTabByItem.get(item.id) ?? "basic");
    setMedia(getInitialMedia(item));
    setBasePriceText(item.price ? formatMoneyInput(item.price) : "");
    setWeightUnit(item.weightLabel?.replace(/[\d.,\s]/g, "").trim() || "г");
    setDiscountOpen(item.hasDiscount);
    setDiscountAutofocusKey(0);
    setKbjuOpen(item.nutritionFilledCount > 0);
  }, [item, nextForcedTab]);

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
  };
  const reorderMedia = (fromIndex: number, toIndex: number) => {
    setMedia((current) => {
      if (fromIndex < 0 || toIndex < 0 || fromIndex >= current.length || toIndex >= current.length) return current;
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  };
  const removeMedia = (id: string) =>
    setMedia((m) => m.filter((x) => x.id !== id));
  const updateBasePrice = (value: string) => {
    if (!isFormattedNumericDraft(value)) return;
    setBasePriceText(value);
  };
  const formatBasePrice = () => {
    const value = parseMoneyInput(basePriceText);
    if (value != null) setBasePriceText(formatMoneyInput(value));
  };
  const addDiscount = () => {
    setDiscountOpen(true);
    setDiscountAutofocusKey((value) => value + 1);
  };
  const removeDiscount = () => {
    setDiscountOpen(false);
    setDiscountAutofocusKey(0);
  };
  const basePrice = parseMoneyInput(basePriceText);
  const isArchived = item.status === "archive";

  const addRowClass =
    "flex h-8 items-center gap-1.5 rounded-[8px] px-1.5 text-[13px] text-[#44403b] transition hover:bg-[#f5f5f4]";

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div ref={editorScrollRef} className="min-w-0 flex-1 overflow-y-auto p-6 pt-0">
        <div className="mx-auto max-w-[600px]">
          {/* Название позиции + действия с позицией */}
          <div className="flex items-center gap-2 pb-2 pt-6">
            <h2 className="flex min-w-0 flex-1 items-center gap-1.5 text-[14px] font-medium leading-7 text-[#292524]">
              <span className="truncate">{item.title}</span>
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
            <div className="ml-auto flex shrink-0 items-center gap-1.5">
              {headerMeta}
              {showStopQuickAction && <StopQuickActionButton item={item} busy={stopBusy} onToggleStop={onToggleStop} />}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="Действия с позицией"
                  title="Действия с позицией"
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <DotsThreeVertical size={18} weight="bold" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownContent align="end">
                {isArchived ? (
                  <>
                    <DropdownActionItem onSelect={() => onRestoreItem(item)}>Восстановить из архива</DropdownActionItem>
                    <DropdownActionItem onSelect={() => onMoveItem(item)}>Переместить в другой раздел</DropdownActionItem>
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
                    <DropdownActionItem onSelect={() => onMoveItem(item)}>Переместить в другой раздел</DropdownActionItem>
                    <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                    <DropdownActionItem onSelect={() => onArchiveItem(item)}>Архивировать</DropdownActionItem>
                  </>
                )}
              </DropdownContent>
            </DropdownMenu.Root>
            </div>
          </div>

          <div className="space-y-2">
            <div data-editor-tabs-card className="rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
              <div className="flex items-center gap-2 px-3">
                {EDITOR_TABS.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => selectEditorTab(tab.id)}
                    className={cn(
                      "flex items-center gap-2 border-b px-1 py-3.5 text-[13px] transition",
                      activeTab === tab.id
                        ? "border-[#1c1917] font-medium text-[#1c1917]"
                        : "border-transparent text-[#79716b] hover:text-[#44403b]",
                    )}
                  >
                    {tab.label}
                    {tab.id === "options" && (
                      <span className="flex h-[14px] min-w-[20px] items-center justify-center rounded-[4px] bg-[#efefeb] px-0.5 text-[10px] font-medium text-[#79716b]">
                        {item.optionsCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {activeTab === "promo" && (
                <PromoRecommendationsCard
                  item={item}
                  allItems={allItems}
                  upsell={upsell}
                  onChange={onUpsellChange}
                />
              )}
              {activeTab === "basic" && (
                <div className="border-t border-[#e7e5e4] px-4 pb-4 pt-5">
                  <BasicTab
                    item={item}
                    media={media}
                    basePriceText={basePriceText}
                    basePrice={basePrice}
                    weightUnit={weightUnit}
                    discountOpen={discountOpen}
                    discountAutofocusKey={discountAutofocusKey}
                    onWeightUnitChange={setWeightUnit}
                    onBasePriceChange={updateBasePrice}
                    onBasePriceBlur={formatBasePrice}
                    onAddDiscount={addDiscount}
                    onRemoveDiscount={removeDiscount}
                    onAddPhotoFile={addPhotoFile}
                    onAddVideoFile={addVideoFile}
                    onReorderMedia={reorderMedia}
                    onRemoveMedia={removeMedia}
                    onDescriptionChange={(value) => onDescriptionChange?.(item, value)}
                  />
                </div>
              )}
            </div>

            {activeTab === "promo" ? (
              <PromoTab
                item={item}
                upsell={upsell}
                onChange={onUpsellChange}
              />
            ) : activeTab === "basic" ? null : (
              <div className="rounded-[13px] border border-[#e7e5e4] bg-white px-4 pb-4 pt-5 shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
                {activeTab === "options" && (
                  <PlaceholderTab title="Опции и добавки">
                    {item.optionsCount > 0 || item.modifiersCount > 0
                      ? `${item.optionsCount} ${plural(item.optionsCount, "опция", "опции", "опций")} · ${item.modifiersCount} ${plural(item.modifiersCount, "доп", "допа", "допов")}`
                      : "У позиции нет опций и добавок."}
                  </PlaceholderTab>
                )}
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
              {kbjuOpen && <KbjuBlock weightUnit={weightUnit} onRemove={() => setKbjuOpen(false)} />}
              {!kbjuOpen && (
                <div className="px-1.5 pt-1">
                  <div className="flex flex-col items-start">
                    <button type="button" className={addRowClass} onClick={() => setKbjuOpen(true)}>
                      <PlusCircle size={16} className="text-[#a8a29e]" />
                      Добавить КБЖУ
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
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
  onSectionAction: (action: string) => void;
  onBulkAction: (action: string) => void;
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
                      <DropdownActionItem key={action} onSelect={() => onSectionAction(action)}>{action}</DropdownActionItem>
                    ))}
                  </>
                )}
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                {isArchivedSection ? (
                  <DropdownActionItem onSelect={() => onSectionAction("Удалить навсегда")} tone="danger">
                    Удалить навсегда
                  </DropdownActionItem>
                ) : (
                  <DropdownActionItem onSelect={() => onSectionAction("Архивировать")} tone="danger">
                    Архивировать
                  </DropdownActionItem>
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
                    <DropdownActionItem onSelect={() => onSectionAction("Переместить")}>Переместить</DropdownActionItem>
                  </>
                )}
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                {isArchivedSection ? (
                  <DropdownActionItem onSelect={() => onSectionAction("Удалить навсегда")} tone="danger">Удалить навсегда</DropdownActionItem>
                ) : (
                  <DropdownActionItem onSelect={() => onSectionAction("Архивировать")} tone="danger">Архивировать</DropdownActionItem>
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
  onSelectAll,
  onClear,
  onAction,
}: {
  count: number;
  checked: boolean;
  indeterminate: boolean;
  onSelectAll: (selected: boolean) => void;
  onClear: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <div className="mt-4 flex h-8 w-fit items-center overflow-hidden rounded-[8px] border border-[#d8d5d0] bg-[#f7f6f2] shadow-[0_4px_14px_rgba(41,37,36,0.08)]">
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
      <ToolbarDropdown label="Доступность">
        <DropdownActionItem onSelect={() => onAction("Поставить на стоп")}>Поставить на стоп</DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction("Убрать со стопа")}>Убрать со стопа</DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction("Скоро будет")}>Скоро будет</DropdownActionItem>
      </ToolbarDropdown>
      <ToolbarDivider />
      <ToolbarDropdown label="Переместить">
        <div className="max-h-[260px] overflow-y-auto">
          {catalogSections.slice(0, 16).map((section) => (
            <DropdownActionItem key={section.id} onSelect={() => onAction(`Переместить в ${section.name}`)}>
              <span className="flex w-full items-center justify-between gap-3">
                <span className="min-w-0 truncate">{section.name}</span>
                <span className="text-[12px] text-[#a8a29e]">
                  {catalogItems.filter((item) => item.sectionId === section.id).length}
                </span>
              </span>
            </DropdownActionItem>
          ))}
        </div>
      </ToolbarDropdown>
      <ToolbarDivider />
      <button
        type="button"
        onClick={() => onAction("Архивировать")}
        className="flex h-full items-center px-2.5 text-[13px] font-medium text-[#9f1239] transition hover:bg-white/70"
      >
        Архивировать
      </button>
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

function filterSectionTree(sections: TreeSection[], query: string): TreeSection[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return sections;

  return sections.flatMap((section) => {
    const children = filterSectionTree(section.children ?? [], normalizedQuery);
    if (section.name.toLowerCase().includes(normalizedQuery) || children.length > 0) {
      return [{ ...section, children }];
    }
    return [];
  });
}

function orderSectionItems(items: CatalogItem[], order: string[] | undefined): CatalogItem[] {
  if (!order?.length) return items;
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((left, right) =>
    (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

function findSectionPath(sections: TreeSection[], targetId: string): string[] {
  for (const section of sections) {
    if (section.id === targetId) return [section.id];
    const childPath = findSectionPath(section.children ?? [], targetId);
    if (childPath.length > 0) return [section.id, ...childPath];
  }
  return [];
}

type CatalogTreeDragSource = {
  kind: "item" | "section";
  id: string;
  parentId: string | null;
  title: string;
  imageUrl?: string | null;
};

type CatalogTreeDropIntent = {
  targetKind: "item" | "section";
  targetId: string;
  targetParentId: string | null;
  mode: "before" | "inside" | "after";
  valid: boolean;
};

function UnifiedCatalogTreePanel({
  sections,
  items,
  scopeSectionId,
  selectedSectionId,
  selectedItemId,
  sectionEditingEnabled,
  includeArchived,
  positionOrderBySection,
  onSelectSection,
  onSelectItem,
  onScopeChange,
  onViewModeChange,
  onAddSection,
  onAddPositionRequest,
  onAddPosition,
  onSectionAction,
  onMoveItem,
  onMoveSection,
}: {
  sections: TreeSection[];
  items: CatalogItem[];
  scopeSectionId: string | null;
  selectedSectionId: string | null;
  selectedItemId: string | null;
  sectionEditingEnabled: boolean;
  includeArchived: boolean;
  positionOrderBySection: Record<string, string[]>;
  onSelectSection: (id: string) => void;
  onSelectItem: (id: string) => void;
  onScopeChange: (id: string | null) => void;
  onViewModeChange: (mode: CatalogViewMode) => void;
  onAddSection: () => void;
  onAddPositionRequest: () => void;
  onAddPosition: (sectionId: string) => void;
  onSectionAction: (section: TreeSection, action: string) => void;
  onMoveItem: (draggedId: string, targetSectionId: string, targetItemId: string | null, mode: "before" | "after" | "inside") => void;
  onMoveSection: (draggedId: string, targetParentId: string | null, targetSectionId: string | null, mode: "before" | "after" | "inside") => void;
}) {
  const selectedItem = selectedItemId ? items.find((item) => item.id === selectedItemId) ?? null : null;
  const initialExpandedPath = selectedItem
    ? findSectionPath(sections, selectedItem.sectionId)
    : sectionEditingEnabled && selectedSectionId
      ? findSectionPath(sections, selectedSectionId)
      : [sections[0]?.id ?? ""];
  const initialExpanded = Object.fromEntries(initialExpandedPath.map((id) => [id, true]));
  const [expanded, setExpanded] = useState<Record<string, boolean>>(initialExpanded);
  const [query, setQuery] = useState("");
  const [scopeMenuOpen, setScopeMenuOpen] = useState(false);
  const [scopeQuery, setScopeQuery] = useState("");
  const [dragSource, setDragSource] = useState<CatalogTreeDragSource | null>(null);
  const [dropIntent, setDropIntent] = useState<CatalogTreeDropIntent | null>(null);
  const [dragPoint, setDragPoint] = useState({ x: 0, y: 0 });
  const panelScrollRef = useRef<HTMLDivElement | null>(null);
  const selectedRowRef = useRef<HTMLDivElement | null>(null);
  const fullTreeExpandedRef = useRef<Record<string, boolean> | null>(null);
  const fullTreeScrollTopRef = useRef(0);
  const suppressRowClickRef = useRef(false);
  const autoExpandTimerRef = useRef<number | null>(null);
  const autoExpandTargetRef = useRef<string | null>(null);
  const touchDragRef = useRef<{
    source: CatalogTreeDragSource;
    startX: number;
    startY: number;
    pointerId: number;
    timer: number | null;
    active: boolean;
  } | null>(null);
  const normalizedQuery = query.trim().toLowerCase();
  const allFlatSections = flattenSections(sections);
  const focusedSection = scopeSectionId
    ? allFlatSections.find((section) => section.id === scopeSectionId) ?? null
    : null;
  const treeSections = focusedSection ? [focusedSection] : sections;
  const flatSections = flattenSections(treeSections);
  const sectionById = new Map(flatSections.map((section) => [section.id, section]));
  const sectionOptions = (() => {
    const collect = (nodes: TreeSection[], parents: string[] = []): { section: TreeSection; path: string }[] =>
      nodes.flatMap((section) => {
        const names = [...parents, section.name];
        return [{ section, path: names.join(" / ") }, ...collect(section.children ?? [], names)];
      });
    return collect(sections);
  })();
  const normalizedScopeQuery = scopeQuery.trim().toLowerCase();
  const visibleSectionOptions = normalizedScopeQuery
    ? sectionOptions.filter((option) => option.path.toLowerCase().includes(normalizedScopeQuery))
    : sectionOptions;
  const itemsBySection = new Map<string, CatalogItem[]>();

  items.forEach((item) => {
    if (!includeArchived && item.status === "archive" && item.id !== selectedItemId) return;
    const current = itemsBySection.get(item.sectionId) ?? [];
    current.push(item);
    itemsBySection.set(item.sectionId, current);
  });

  const aggregateItemCountBySection = new Map<string, number>();
  const getAggregateItemCount = (section: TreeSection): number => {
    const cachedCount = aggregateItemCountBySection.get(section.id);
    if (cachedCount !== undefined) return cachedCount;
    const ownCount = (itemsBySection.get(section.id) ?? []).filter((item) => item.status !== "archive").length;
    const totalCount = ownCount + (section.children ?? []).reduce((total, child) => total + getAggregateItemCount(child), 0);
    aggregateItemCountBySection.set(section.id, totalCount);
    return totalCount;
  };

  const visibleSectionIds = new Set<string>();
  const visibleItemIds = new Set<string>();

  const markSectionAndParents = (section: TreeSection) => {
    let current: TreeSection | undefined = section;
    while (current) {
      visibleSectionIds.add(current.id);
      current = current.parentId ? sectionById.get(current.parentId) : undefined;
    }
  };

  if (normalizedQuery) {
    flatSections.forEach((section) => {
      const sectionItems = itemsBySection.get(section.id) ?? [];
      const sectionMatches = section.name.toLowerCase().includes(normalizedQuery);
      const matchingItems = sectionItems.filter((item) => item.title.toLowerCase().includes(normalizedQuery));
      if (!sectionMatches && matchingItems.length === 0) return;
      markSectionAndParents(section);
      if (sectionMatches) {
        sectionItems.forEach((item) => visibleItemIds.add(item.id));
      } else {
        matchingItems.forEach((item) => visibleItemIds.add(item.id));
      }
    });
  }

  useEffect(() => {
    const path = selectedItem
      ? findSectionPath(sections, selectedItem.sectionId)
      : [];
    if (path.length > 0) {
      setExpanded((current) => ({ ...current, ...Object.fromEntries(path.map((id) => [id, true])) }));
    }
    const timeout = window.setTimeout(() => selectedRowRef.current?.scrollIntoView({ block: "nearest" }), 0);
    return () => window.clearTimeout(timeout);
  }, [selectedItem?.id, selectedItem?.sectionId]);

  useEffect(() => {
    const focusSectionSorting = (event: Event) => {
      const sectionId = (event as CustomEvent<string>).detail;
      if (!sectionId) return;
      const path = findSectionPath(sections, sectionId);
      setExpanded((current) => ({ ...current, ...Object.fromEntries(path.map((id) => [id, true])) }));
      window.setTimeout(() => {
        const handle = Array.from(document.querySelectorAll<HTMLElement>("[data-position-section-id]"))
          .find((candidate) => candidate.dataset.positionSectionId === sectionId);
        handle?.focus();
        handle?.scrollIntoView({ block: "nearest" });
      }, 0);
    };
    window.addEventListener("tasko-focus-section-sorting", focusSectionSorting);
    return () => window.removeEventListener("tasko-focus-section-sorting", focusSectionSorting);
  }, [sections]);

  useEffect(() => {
    if (!scopeSectionId || focusedSection) return;
    onScopeChange(null);
    if (fullTreeExpandedRef.current) setExpanded(fullTreeExpandedRef.current);
  }, [focusedSection, scopeSectionId, onScopeChange]);

  const selectTreeScope = (sectionId: string | null) => {
    setScopeQuery("");
    setQuery("");
    if (!sectionId) {
      onScopeChange(null);
      if (fullTreeExpandedRef.current) {
        setExpanded(fullTreeExpandedRef.current);
        fullTreeExpandedRef.current = null;
      }
      window.requestAnimationFrame(() => {
        if (panelScrollRef.current) panelScrollRef.current.scrollTop = fullTreeScrollTopRef.current;
      });
      return;
    }

    if (!scopeSectionId) {
      fullTreeExpandedRef.current = expanded;
      fullTreeScrollTopRef.current = panelScrollRef.current?.scrollTop ?? 0;
    }
    onScopeChange(sectionId);
    setExpanded((current) => ({ ...current, [sectionId]: true }));
    window.requestAnimationFrame(() => {
      if (panelScrollRef.current) panelScrollRef.current.scrollTop = 0;
    });
  };

  const toggleSection = (id: string) => {
    setExpanded((current) => ({ ...current, [id]: !(current[id] ?? false) }));
  };

  const clearAutoExpand = () => {
    if (autoExpandTimerRef.current != null) window.clearTimeout(autoExpandTimerRef.current);
    autoExpandTimerRef.current = null;
    autoExpandTargetRef.current = null;
  };

  const autoScrollPanel = (clientY: number) => {
    if (!panelScrollRef.current) return;
    const bounds = panelScrollRef.current.getBoundingClientRect();
    const edge = 56;
    if (clientY < bounds.top + edge) {
      const strength = Math.max(0, Math.min(1, (bounds.top + edge - clientY) / edge));
      panelScrollRef.current.scrollTop -= 2 + strength * 12;
    } else if (clientY > bounds.bottom - edge) {
      const strength = Math.max(0, Math.min(1, (clientY - (bounds.bottom - edge)) / edge));
      panelScrollRef.current.scrollTop += 2 + strength * 12;
    }
  };

  const handlePanelDragOver = (event: DragEvent<HTMLDivElement>) => {
    if (!dragSource) return;
    event.preventDefault();
    setDropIntent(null);
    clearAutoExpand();
    setDragPoint({ x: event.clientX, y: event.clientY });
    autoScrollPanel(event.clientY);
  };

  const isSectionDescendant = (sourceId: string, possibleDescendantId: string | null) => {
    if (!possibleDescendantId) return false;
    const source = allFlatSections.find((section) => section.id === sourceId);
    return Boolean(source && findSectionPath(source.children ?? [], possibleDescendantId).length > 0);
  };

  const getDropValidity = (
    source: CatalogTreeDragSource,
    targetKind: CatalogTreeDropIntent["targetKind"],
    targetId: string,
    targetParentId: string | null,
    mode: CatalogTreeDropIntent["mode"],
  ) => {
    if (source.id === targetId) return false;
    if (scopeSectionId === targetId && mode !== "inside") return false;
    if (source.kind === "item") return targetKind === "item" ? mode !== "inside" : mode === "inside";
    if (targetKind !== "section") return false;
    const nextParentId = mode === "inside" ? targetId : targetParentId;
    return nextParentId !== source.id && !isSectionDescendant(source.id, nextParentId);
  };

  const setDropIntentForTarget = (
    clientX: number,
    clientY: number,
    bounds: DOMRect,
    targetKind: CatalogTreeDropIntent["targetKind"],
    targetId: string,
    targetParentId: string | null,
    isExpanded = false,
  ) => {
    if (!dragSource) return;
    const ratio = (clientY - bounds.top) / Math.max(bounds.height, 1);
    const mode: CatalogTreeDropIntent["mode"] = targetKind === "section"
      ? ratio < 0.25 ? "before" : ratio > 0.75 ? "after" : "inside"
      : ratio < 0.5 ? "before" : "after";
    const valid = getDropValidity(dragSource, targetKind, targetId, targetParentId, mode);
    setDropIntent({ targetKind, targetId, targetParentId, mode, valid });
    setDragPoint({ x: clientX, y: clientY });
    autoScrollPanel(clientY);

    if (targetKind === "section" && mode === "inside" && valid && !isExpanded) {
      if (autoExpandTargetRef.current !== targetId) {
        clearAutoExpand();
        autoExpandTargetRef.current = targetId;
        autoExpandTimerRef.current = window.setTimeout(() => {
          setExpanded((current) => ({ ...current, [targetId]: true }));
          clearAutoExpand();
        }, 700);
      }
    } else {
      clearAutoExpand();
    }
  };

  const updateDropIntent = (
    event: DragEvent<HTMLElement>,
    targetKind: CatalogTreeDropIntent["targetKind"],
    targetId: string,
    targetParentId: string | null,
    isExpanded = false,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDropIntentForTarget(
      event.clientX,
      event.clientY,
      event.currentTarget.getBoundingClientRect(),
      targetKind,
      targetId,
      targetParentId,
      isExpanded,
    );
  };

  const startTreeDrag = (event: DragEvent<HTMLElement>, source: CatalogTreeDragSource) => {
    const target = event.target as HTMLElement;
    if (normalizedQuery || target.closest("[data-no-tree-drag]")) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", `${source.kind}:${source.id}`);
    const transparentPreview = new Image();
    transparentPreview.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";
    event.dataTransfer.setDragImage(transparentPreview, 0, 0);
    setDragPoint({ x: event.clientX, y: event.clientY });
    setDragSource(source);
    suppressRowClickRef.current = true;
  };

  const finishTreeDrag = () => {
    clearAutoExpand();
    setDragSource(null);
    setDropIntent(null);
    window.setTimeout(() => {
      suppressRowClickRef.current = false;
    }, 0);
  };

  const performTreeDrop = () => {
    if (!dragSource || !dropIntent?.valid) {
      finishTreeDrag();
      return;
    }
    if (dragSource.kind === "item") {
      const targetSectionId = dropIntent.targetKind === "section"
        ? dropIntent.targetId
        : dropIntent.targetParentId;
      if (targetSectionId) {
        onMoveItem(
          dragSource.id,
          targetSectionId,
          dropIntent.targetKind === "item" ? dropIntent.targetId : null,
          dropIntent.mode,
        );
      }
    } else if (dropIntent.targetKind === "section") {
      onMoveSection(
        dragSource.id,
        dropIntent.mode === "inside" ? dropIntent.targetId : dropIntent.targetParentId,
        dropIntent.mode === "inside" ? null : dropIntent.targetId,
        dropIntent.mode,
      );
    }
    finishTreeDrag();
  };

  const applyTreeDrop = (event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    performTreeDrop();
  };

  const beginTouchDrag = (
    event: ReactPointerEvent<HTMLElement>,
    source: CatalogTreeDragSource,
    enabled: boolean,
  ) => {
    if (event.pointerType !== "touch" || !enabled) return;
    const target = event.target as HTMLElement;
    if (target.closest("[data-no-tree-drag]")) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const pending = {
      source,
      startX: event.clientX,
      startY: event.clientY,
      pointerId: event.pointerId,
      timer: null as number | null,
      active: false,
    };
    pending.timer = window.setTimeout(() => {
      pending.active = true;
      pending.timer = null;
      suppressRowClickRef.current = true;
      setDragPoint({ x: pending.startX, y: pending.startY });
      setDragSource(source);
    }, 225);
    touchDragRef.current = pending;
  };

  const handleTouchDragMove = (event: ReactPointerEvent<HTMLElement>) => {
    const touch = touchDragRef.current;
    if (!touch || event.pointerId !== touch.pointerId) return;
    const distance = Math.hypot(event.clientX - touch.startX, event.clientY - touch.startY);
    if (!touch.active) {
      if (distance > 8 && touch.timer != null) {
        window.clearTimeout(touch.timer);
        touchDragRef.current = null;
      }
      return;
    }
    event.preventDefault();
    const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>("[data-tree-dnd-kind]");
    if (!target) {
      setDropIntent(null);
      clearAutoExpand();
      setDragPoint({ x: event.clientX, y: event.clientY });
      autoScrollPanel(event.clientY);
      return;
    }
    const targetKind = target.dataset.treeDndKind === "section" ? "section" : "item";
    setDropIntentForTarget(
      event.clientX,
      event.clientY,
      target.getBoundingClientRect(),
      targetKind,
      target.dataset.treeDndId ?? "",
      target.dataset.treeDndParentId || null,
      target.dataset.treeDndExpanded === "true",
    );
  };

  const finishTouchDrag = (event: ReactPointerEvent<HTMLElement>) => {
    const touch = touchDragRef.current;
    if (!touch || event.pointerId !== touch.pointerId) return;
    if (touch.timer != null) window.clearTimeout(touch.timer);
    touchDragRef.current = null;
    if (touch.active) {
      event.preventDefault();
      performTreeDrop();
    }
  };

  const renderPosition = (item: CatalogItem, section: TreeSection, depth: number) => {
    const active = item.id === selectedItemId;
    const isSource = dragSource?.kind === "item" && dragSource.id === item.id;
    const activeDrop = dropIntent?.targetKind === "item" && dropIntent.targetId === item.id ? dropIntent : null;
    const dragEnabled = !normalizedQuery;
    return (
      <div
        key={item.id}
        ref={active ? selectedRowRef : undefined}
        data-position-section-id={section.id}
        data-tree-dnd-kind="item"
        data-tree-dnd-id={item.id}
        data-tree-dnd-parent-id={section.id}
        role="button"
        tabIndex={0}
        draggable={dragEnabled}
        onDragStart={(event) => startTreeDrag(event, {
          kind: "item",
          id: item.id,
          parentId: section.id,
          title: item.title,
          imageUrl: item.thumbnailUrl,
        })}
        onDragEnd={finishTreeDrag}
        onPointerDown={(event) => beginTouchDrag(event, {
          kind: "item",
          id: item.id,
          parentId: section.id,
          title: item.title,
          imageUrl: item.thumbnailUrl,
        }, dragEnabled)}
        onDragOver={(event) => updateDropIntent(event, "item", item.id, section.id)}
        onDrop={applyTreeDrop}
        onClick={() => {
          if (!suppressRowClickRef.current) onSelectItem(item.id);
        }}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            onSelectItem(item.id);
          }
        }}
        title={normalizedQuery ? "Очистите поиск, чтобы изменить порядок" : item.title}
        className={cn(
          "group relative flex h-[34px] cursor-grab items-center gap-2 rounded-[7px] border border-transparent pr-2 text-left transition-[opacity,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 active:cursor-grabbing",
          active ? "bg-[#efefea] shadow-[0_1px_2px_rgba(41,37,36,0.06)]" : "hover:bg-[#f5f5f1]",
          isSource && "cursor-grabbing opacity-35",
          activeDrop && !activeDrop.valid && "cursor-not-allowed",
          !dragEnabled && "cursor-default",
        )}
        style={{ marginLeft: (sectionEditingEnabled ? 30 : 18) + depth * 12 }}
      >
        {activeDrop?.valid && activeDrop.mode !== "inside" && (
          <span className={cn("pointer-events-none absolute left-0 right-1 z-10 h-px bg-[#6d5dfc]", activeDrop.mode === "before" ? "top-0" : "bottom-0")}>
            <span className="absolute -left-0.5 -top-[2px] h-[5px] w-[5px] rounded-full bg-[#6d5dfc]" />
          </span>
        )}
        <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#e9e9df]">
          {item.thumbnailUrl ? (
            <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
          ) : (
            <ImageBroken size={12} className="text-[#a8a29e]" />
          )}
        </span>
        <span className={cn("min-w-0 flex-1 truncate text-[13px] leading-5", active ? "font-medium text-[#292524]" : "font-normal text-[#79716b]")}>{item.title}</span>
        {sectionEditingEnabled && item.status === "stopped" && (
          <Tooltip label="На стопе" side="top" delayDuration={200}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#a8a29e]"><Prohibit size={12} /></span>
          </Tooltip>
        )}
        {sectionEditingEnabled && item.status === "archive" && (
          <Tooltip label="В архиве" side="top" delayDuration={200}>
            <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#a8a29e]"><Archive size={12} /></span>
          </Tooltip>
        )}
      </div>
    );
  };

  const renderSection = (section: TreeSection, depth = 0): ReactNode => {
    if (normalizedQuery && !visibleSectionIds.has(section.id)) return null;
    const sectionItems = orderSectionItems(itemsBySection.get(section.id) ?? [], positionOrderBySection[section.id]);
    const visibleItems = normalizedQuery
      ? sectionItems.filter((item) => visibleItemIds.has(item.id))
      : sectionItems;
    const isExpanded = normalizedQuery ? true : Boolean(expanded[section.id]);
    const parentId = section.parentId ?? null;
    const isSource = dragSource?.kind === "section" && dragSource.id === section.id;
    const activeDrop = dropIntent?.targetKind === "section" && dropIntent.targetId === section.id ? dropIntent : null;
    const active = sectionEditingEnabled && selectedSectionId === section.id && !selectedItemId;
    const activeCount = getAggregateItemCount(section);
    const hasVisibleChildren = (section.children ?? []).some((child) => !normalizedQuery || visibleSectionIds.has(child.id));
    const hasTreeChildren = sectionItems.length > 0 || (section.children?.length ?? 0) > 0;
    const dragEnabled = !normalizedQuery && scopeSectionId !== section.id;
    const sectionIcon = section.imageUrl ? (
      <img src={section.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
    ) : (
      <ForkKnife size={11} weight="fill" />
    );

    return (
      <div key={section.id}>
        <div
          ref={active ? selectedRowRef : undefined}
          data-tree-dnd-kind="section"
          data-tree-dnd-id={section.id}
          data-tree-dnd-parent-id={parentId ?? ""}
          data-tree-dnd-expanded={isExpanded ? "true" : "false"}
          role="button"
          tabIndex={0}
          draggable={dragEnabled}
          onDragStart={(event) => startTreeDrag(event, {
            kind: "section",
            id: section.id,
            parentId,
            title: section.name,
            imageUrl: section.imageUrl,
          })}
          onDragEnd={finishTreeDrag}
          onPointerDown={(event) => beginTouchDrag(event, {
            kind: "section",
            id: section.id,
            parentId,
            title: section.name,
            imageUrl: section.imageUrl,
          }, dragEnabled)}
          onDragOver={(event) => updateDropIntent(event, "section", section.id, parentId, isExpanded)}
          onDrop={applyTreeDrop}
          onClick={() => {
            if (!suppressRowClickRef.current) onSelectSection(section.id);
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectSection(section.id);
            }
          }}
          title={normalizedQuery ? "Очистите поиск, чтобы изменить порядок" : section.name}
          className={cn(
            "group relative flex h-8 cursor-grab items-center rounded-[7px] border border-transparent transition-[opacity,background-color,box-shadow] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 active:cursor-grabbing",
            active ? "bg-[#efefea] shadow-[0_1px_2px_rgba(41,37,36,0.06)]" : "hover:bg-[#f1f1ea]",
            isSource && "cursor-grabbing opacity-35",
            activeDrop?.valid && activeDrop.mode === "inside" && "border-[#9d93ff] bg-[#f3f1ff] shadow-[inset_0_0_0_1px_rgba(109,93,252,0.12)]",
            activeDrop && !activeDrop.valid && "cursor-not-allowed",
            !dragEnabled && "cursor-default",
          )}
          style={{ paddingLeft: 4 + depth * 12 }}
        >
          {activeDrop?.valid && activeDrop.mode !== "inside" && (
            <span
              className={cn("pointer-events-none absolute right-1 z-10 h-px bg-[#6d5dfc]", activeDrop.mode === "before" ? "top-0" : "bottom-0")}
              style={{ left: 4 + depth * 12 }}
            >
              <span className="absolute -left-0.5 -top-[2px] h-[5px] w-[5px] rounded-full bg-[#6d5dfc]" />
            </span>
          )}
          {hasTreeChildren ? (
            <button
              type="button"
              data-no-tree-drag
              onClick={(event) => {
                event.stopPropagation();
                toggleSection(section.id);
              }}
              aria-expanded={isExpanded}
              aria-label={`${isExpanded ? "Свернуть" : "Раскрыть"} раздел ${section.name}`}
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[6px] text-[#79716b] transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              {!isExpanded && (
                <span className="col-start-1 row-start-1 flex h-5 w-5 items-center justify-center overflow-hidden rounded-[5px] bg-[#e6e6db] text-[#a8a29e] transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
                  {sectionIcon}
                </span>
              )}
              <CaretRight
                size={12}
                className={cn(
                  "col-start-1 row-start-1 transition-all",
                  isExpanded ? "rotate-90 opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100",
                )}
              />
            </button>
          ) : (
            <span className="flex h-7 w-7 shrink-0 items-center justify-center">
              <span className="flex h-5 w-5 items-center justify-center overflow-hidden rounded-[5px] bg-[#e6e6db] text-[#a8a29e]">
                {sectionIcon}
              </span>
            </span>
          )}
          <div className="flex h-full min-w-0 flex-1 items-center gap-2 text-left">
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#44403b]">{section.name}</span>
            {sectionEditingEnabled && section.status === "archive" && (
              <Tooltip label="В архиве" side="top" delayDuration={200}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#a8a29e]"><Archive size={12} /></span>
              </Tooltip>
            )}
            {sectionEditingEnabled && section.status !== "archive" && section.availabilityMode === "unavailable" && (
              <Tooltip label="Раздел скрыт" side="top" delayDuration={200}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#a8a29e]"><Prohibit size={12} /></span>
              </Tooltip>
            )}
            {sectionEditingEnabled && section.status !== "archive" && section.availabilityMode === "schedule" && (
              <Tooltip label="По расписанию" side="top" delayDuration={200}>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center text-[#a8a29e]"><Clock size={12} /></span>
              </Tooltip>
            )}
          </div>
          <div className="grid w-7 shrink-0 grid-cols-1 items-center pr-1">
            <span className="col-start-1 row-start-1 justify-self-end text-[11px] tabular-nums text-[#a8a29e] transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
              {activeCount}
            </span>
            <div className="pointer-events-none col-start-1 row-start-1 flex justify-end opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 group-focus-within:pointer-events-auto group-focus-within:opacity-100">
              <div className="flex">
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      data-no-tree-drag
                      aria-label={`Действия с разделом ${section.name}`}
                      onClick={(event) => event.stopPropagation()}
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] hover:bg-white hover:text-[#292524] focus-visible:outline-none"
                    >
                      <DotsThreeVertical size={14} weight="bold" />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownContent align="end">
                    <DropdownActionItem onSelect={() => onSectionAction(section, "Добавить подраздел")}>Добавить подраздел</DropdownActionItem>
                    <DropdownActionItem onSelect={() => onAddPosition(section.id)}>Добавить позицию</DropdownActionItem>
                    <DropdownActionItem onSelect={() => onSectionAction(section, "Переместить")}>Переместить</DropdownActionItem>
                    <DropdownActionItem onSelect={() => onSectionAction(section, "Скрыть или показать")}>Скрыть или показать</DropdownActionItem>
                    <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                    {section.status === "archive" ? (
                      <DropdownActionItem onSelect={() => onSectionAction(section, "Восстановить раздел")}>Восстановить из архива</DropdownActionItem>
                    ) : (
                      <DropdownActionItem tone="danger" onSelect={() => onSectionAction(section, "Архивировать раздел")}>Архивировать</DropdownActionItem>
                    )}
                  </DropdownContent>
                </DropdownMenu.Root>
              </div>
            </div>
          </div>
        </div>
        {isExpanded && (
          <div className="space-y-px">
            {visibleItems.map((item) => renderPosition(item, section, depth))}
            {visibleItems.length === 0 && !hasVisibleChildren && !normalizedQuery && (
              <div className="flex h-8 items-center gap-2 text-[12px] text-[#a8a29e]" style={{ paddingLeft: 42 + depth * 12 }}>
                <span className="min-w-0 flex-1 truncate">В разделе пока нет позиций</span>
                <button type="button" onClick={() => onAddPosition(section.id)} className="mr-2 inline-flex shrink-0 items-center gap-1 text-[#57534d] hover:text-[#292524]">
                  <PlusCircle size={13} />
                  Добавить
                </button>
              </div>
            )}
            {section.children?.map((child) => renderSection(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const nestingTarget = dropIntent?.valid && dropIntent.mode === "inside" && dropIntent.targetKind === "section"
    ? allFlatSections.find((section) => section.id === dropIntent.targetId) ?? null
    : null;

  return (
    <>
    <aside
      className="flex w-[250px] shrink-0 flex-col overflow-hidden border-r border-[#e7e5e4] bg-[#fbfbf9]"
      onPointerMove={handleTouchDragMove}
      onPointerUp={finishTouchDrag}
      onPointerCancel={finishTouchDrag}
    >
      <div className="shrink-0 border-b border-[#e7e5e4] px-3 pb-4 pt-5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <CatalogViewModeSelect value="sections" onChange={onViewModeChange} />
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Добавить"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[#57534d] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
              >
                <PlusCircle size={18} />
              </button>
            </DropdownMenu.Trigger>
            <DropdownContent align="end">
              {focusedSection ? (
                <>
                  <DropdownActionItem onSelect={() => onAddPosition(focusedSection.id)}>Добавить позицию</DropdownActionItem>
                  <DropdownActionItem onSelect={() => onSectionAction(focusedSection, "Добавить подраздел")}>Добавить подраздел</DropdownActionItem>
                  <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                  <DropdownActionItem onSelect={onAddSection}>Добавить раздел верхнего уровня</DropdownActionItem>
                </>
              ) : (
                <>
                  <DropdownActionItem onSelect={onAddSection}>Добавить раздел</DropdownActionItem>
                  <DropdownActionItem onSelect={onAddPositionRequest}>Добавить позицию</DropdownActionItem>
                </>
              )}
            </DropdownContent>
          </DropdownMenu.Root>
        </div>
        <div className="mt-4 flex h-8 min-w-0 items-center gap-2 rounded-[8px] bg-[#f0f0ea] px-1.5">
          {focusedSection ? (
            <Tooltip label="Показать все разделы" side="bottom" delayDuration={300}>
              <button
                type="button"
                aria-label="Показать все разделы"
                onClick={() => selectTreeScope(null)}
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[#79716b] transition hover:bg-white/70 hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
              >
                <ArrowLeft size={14} weight="bold" />
              </button>
            </Tooltip>
          ) : (
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-[#e6e6db] text-[#1c1917]">
              <FunnelSimple size={14} />
            </span>
          )}
            <DropdownMenu.Root
              open={scopeMenuOpen}
              onOpenChange={(open) => {
                setScopeMenuOpen(open);
                if (!open) setScopeQuery("");
              }}
            >
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Выбрать раздел"
                className="flex h-full min-w-0 flex-1 cursor-pointer items-center gap-2 rounded-[9px] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-normal leading-[18px] text-[#292524]">{focusedSection?.name ?? "Все разделы"}</span>
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[#1c1917] transition hover:bg-white/55">
                  <CaretDown size={14} weight="bold" className={cn("transition-transform", scopeMenuOpen && "rotate-180")} />
                </span>
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={6}
                className="z-[100002] w-[310px] rounded-[12px] border border-[#e7e5e4] bg-white p-2 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
              >
                <label className="mb-2 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-white px-2 text-[#a8a29e] focus-within:border-[#a8a29e]">
                  <MagnifyingGlass size={14} />
                  <input
                    value={scopeQuery}
                    onChange={(event) => setScopeQuery(event.target.value)}
                    onKeyDown={(event) => event.stopPropagation()}
                    placeholder="Найти раздел"
                    autoFocus
                    className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
                  />
                </label>
                <div className="max-h-[360px] overflow-y-auto overscroll-contain">
                  <DropdownMenu.Item
                    onSelect={() => selectTreeScope(null)}
                    className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                  >
                    <span className="min-w-0 flex-1 truncate">Все разделы</span>
                    {!focusedSection && <Check size={13} className="shrink-0 text-[#79716b]" />}
                  </DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                  {visibleSectionOptions.map((option) => (
                    <DropdownMenu.Item
                      key={option.section.id}
                      onSelect={() => selectTreeScope(option.section.id)}
                      title={option.path}
                      className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                    >
                      <span className="min-w-0 flex-1 truncate">{option.path}</span>
                      {scopeSectionId === option.section.id && <Check size={13} className="shrink-0 text-[#79716b]" />}
                    </DropdownMenu.Item>
                  ))}
                  {visibleSectionOptions.length === 0 && (
                    <div className="px-2 py-3 text-[13px] text-[#79716b]">Разделы не найдены</div>
                  )}
                </div>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
            </DropdownMenu.Root>
        </div>
      </div>
      <div ref={panelScrollRef} onDragOver={handlePanelDragOver} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 py-3">
        <label className="mb-3 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-white px-2 text-[#a8a29e] focus-within:border-[#a8a29e]">
          <MagnifyingGlass size={14} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Разделы и позиции"
            className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
          />
          {query && (
            <button type="button" onClick={() => setQuery("")} aria-label="Очистить поиск" className="flex h-5 w-5 items-center justify-center rounded-[6px] hover:bg-[#f5f5f4] hover:text-[#57534d]">
              <XCircle size={13} />
            </button>
          )}
        </label>
        <div className="space-y-px">{treeSections.map((section) => renderSection(section))}</div>
        {normalizedQuery && visibleSectionIds.size === 0 && (
          <p className="px-2 py-4 text-[13px] leading-5 text-[#79716b]">Разделы и позиции не найдены</p>
        )}
      </div>
    </aside>
    {dragSource && createPortal(
      <div
        className="pointer-events-none fixed z-[100006] max-w-[220px] rounded-[8px] border border-[#e7e5e4] bg-white px-2 py-1.5 shadow-[0_10px_28px_rgba(41,37,36,0.18)]"
        style={{ left: dragPoint.x + 12, top: dragPoint.y + 12 }}
      >
        <div className="flex items-center gap-2">
          <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#e9e9df] text-[#79716b]">
            {dragSource.imageUrl ? (
              <img src={dragSource.imageUrl} alt="" className="h-full w-full object-cover" />
            ) : dragSource.kind === "section" ? (
              <ForkKnife size={12} weight="fill" />
            ) : (
              <ImageBroken size={12} />
            )}
          </span>
          <span className="min-w-0 truncate text-[13px] font-medium text-[#44403b]">{dragSource.title}</span>
        </div>
        {nestingTarget && (
          <p className="mt-1 truncate pl-8 text-[11px] text-[#79716b]">В раздел «{nestingTarget.name}»</p>
        )}
      </div>,
      document.body,
    )}
    </>
  );
}

function SectionEditorContext({
  section,
  itemCount,
  onEdit,
  onAddPosition,
  onAction,
}: {
  section: TreeSection;
  itemCount: number;
  onEdit: () => void;
  onAddPosition: () => void;
  onAction: (action: string) => void;
}) {
  return (
    <div className="h-12 shrink-0 border-b border-[#e7e5e4] bg-[#fbfbf9] px-6">
      <div className="mx-auto flex h-full max-w-[600px] items-center gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-[#e6e6db] text-[#57534d]">
          {section.imageUrl ? <img src={section.imageUrl} alt="" className="h-full w-full object-cover" /> : section.emoji ?? <ForkKnife size={13} weight="fill" />}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#44403b]">
          {section.name} <span className="font-normal text-[#a8a29e]">· {itemCount} {plural(itemCount, "позиция", "позиции", "позиций")}</span>
        </span>
        <button type="button" onClick={onEdit} className="inline-flex h-7 items-center rounded-[7px] px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f1f1ea] hover:text-[#292524]">Изменить</button>
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" aria-label={`Действия с разделом ${section.name}`} className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524]">
              <DotsThreeVertical size={16} weight="bold" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownContent align="end">
            <DropdownActionItem onSelect={onEdit}>Изменить раздел</DropdownActionItem>
            <DropdownActionItem onSelect={() => onAction("Добавить подраздел")}>Добавить подраздел</DropdownActionItem>
            <DropdownActionItem onSelect={onAddPosition}>Добавить позицию</DropdownActionItem>
            <DropdownActionItem onSelect={() => onAction("Переместить раздел")}>Переместить раздел</DropdownActionItem>
            <DropdownActionItem onSelect={() => onAction("Скрыть или показать")}>Скрыть или показать</DropdownActionItem>
            <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
            <DropdownActionItem tone="danger" onSelect={() => onAction("Архивировать раздел")}>Архивировать</DropdownActionItem>
          </DropdownContent>
        </DropdownMenu.Root>
      </div>
    </div>
  );
}

function SectionEditor({
  section,
  childSections,
  compositionItems,
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
  onOpenItem,
  onOpenSection,
  onReorderItem,
  onReorderSection,
  getSectionDirectChildCount,
  onArchive,
  onRestore,
  onAction,
}: {
  section: TreeSection;
  childSections: TreeSection[];
  compositionItems: CatalogItem[];
  activeTab: "composition" | "basic" | "availability";
  availabilityMode: AvailabilityMode;
  outsideScheduleMode: OutsideScheduleMode;
  weeklySchedule: WeeklySchedule;
  onTabChange: (tab: "composition" | "basic" | "availability") => void;
  onNameChange: (name: string) => void;
  onImageChange: (imageUrl: string | null) => void;
  onAvailabilityModeChange: (mode: AvailabilityMode) => void;
  onOutsideScheduleModeChange: (mode: OutsideScheduleMode) => void;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  onAddPosition: () => void;
  onOpenItem: (id: string) => void;
  onOpenSection: (id: string) => void;
  onReorderItem: (draggedId: string, targetId: string) => void;
  onReorderSection: (draggedId: string, targetId: string) => void;
  getSectionDirectChildCount: (sectionId: string) => number;
  onArchive: () => void;
  onRestore: () => void;
  onAction: (action: string) => void;
}) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const [draggedCompositionRow, setDraggedCompositionRow] = useState<{ type: "item" | "section"; id: string } | null>(null);
  const [dragOverCompositionRow, setDragOverCompositionRow] = useState<{ type: "item" | "section"; id: string } | null>(null);
  const archived = section.status === "archive";
  const compositionRows = [
    ...compositionItems.map((item) => ({ type: "item" as const, id: item.id, item })),
    ...childSections.map((child) => ({ type: "section" as const, id: child.id, section: child })),
  ];

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
    setDraggedCompositionRow(null);
    setDragOverCompositionRow(null);
  }, [section.id]);

  const renderCompositionStatus = (item: CatalogItem) => {
    if (item.status === "stopped") return <span className="rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[10px] font-medium text-[#79716b]">Стоп</span>;
    if (item.status === "coming-soon") return <span className="rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[10px] font-medium text-[#79716b]">Скоро</span>;
    if (item.status === "archive") return <Archive size={13} className="text-[#a8a29e]" />;
    if (item.scheduled) return <Clock size={13} className="text-[#a8a29e]" />;
    return null;
  };

  const handleCompositionDrop = (target: { type: "item" | "section"; id: string }) => {
    if (!draggedCompositionRow || draggedCompositionRow.id === target.id || draggedCompositionRow.type !== target.type) return;
    if (target.type === "item") onReorderItem(draggedCompositionRow.id, target.id);
    else onReorderSection(draggedCompositionRow.id, target.id);
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-w-0 flex-1 overflow-y-auto p-6 pt-0">
        <div className="mx-auto max-w-[600px]">
          <div className="flex items-center gap-2 pb-2 pt-6">
            <h2 className="min-w-0 flex-1 truncate text-[14px] font-medium leading-7 text-[#292524]">{section.name}</h2>
            {archived && <span className="rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[11px] font-medium text-[#79716b]">В архиве</span>}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" aria-label="Действия с разделом" className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">
                  <DotsThreeVertical size={18} weight="bold" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownContent align="end">
                <DropdownActionItem onSelect={() => onAction("Добавить подраздел")}>Добавить подраздел</DropdownActionItem>
                <DropdownActionItem onSelect={onAddPosition}>Добавить позицию</DropdownActionItem>
                <DropdownActionItem onSelect={() => onAction("Переместить раздел")}>Переместить раздел</DropdownActionItem>
              </DropdownContent>
            </DropdownMenu.Root>
          </div>
          <div className="space-y-2">
            <div data-editor-tabs-card className="rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
              <div className="flex items-center gap-2 px-3">
                {([
                  { id: "composition", label: "Состав" },
                  { id: "basic", label: "Основное" },
                  { id: "availability", label: "Доступность" },
                ] as const).map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => onTabChange(tab.id)}
                    className={cn(
                      "flex items-center gap-2 border-b px-1 py-3.5 text-[13px] transition",
                      activeTab === tab.id
                        ? "border-[#1c1917] font-medium text-[#1c1917]"
                        : "border-transparent text-[#79716b] hover:text-[#44403b]",
                    )}
                  >
                    {tab.label}
                    {tab.id === "composition" && (
                      <span className="flex h-[14px] min-w-[20px] items-center justify-center rounded-[4px] bg-[#efefeb] px-0.5 text-[10px] font-medium text-[#79716b]">
                        {compositionRows.length}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              <div className="border-t border-[#e7e5e4]">
            {activeTab === "composition" ? (
            <section>
              <div className="flex items-center justify-between gap-3 border-b border-[#eceae7] px-4 py-3">
                <div className="min-w-0">
                  <div className="text-[13px] font-medium text-[#292524]">Состав раздела</div>
                  <div className="mt-0.5 truncate text-[12px] text-[#a8a29e]">
                    {compositionRows.length} {plural(compositionRows.length, "элемент", "элемента", "элементов")} в порядке витрины
                  </div>
                </div>
                {!archived && (
                  <div className="flex shrink-0 items-center gap-1">
                    <button type="button" onClick={onAddPosition} className="h-8 whitespace-nowrap rounded-[8px] px-2.5 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4] hover:text-[#292524]">Добавить позицию</button>
                  </div>
                )}
              </div>
              {compositionRows.length === 0 ? (
                <div className="p-4">
                  <div className="rounded-[10px] border border-dashed border-[#e7e5e4] bg-[#fafaf9] px-4 py-5">
                    <p className="text-[13px] font-medium text-[#44403b]">В разделе пока нет позиций</p>
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      <button type="button" onClick={onAddPosition} className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[#292524] px-3 text-[12px] font-medium text-white transition hover:bg-[#44403b]">
                        <Plus size={13} />
                        Добавить позицию
                      </button>
                      <button type="button" onClick={() => onAction("Добавить подраздел")} className="h-8 rounded-[8px] border border-[#e7e5e4] bg-white px-3 text-[12px] font-medium text-[#57534d] transition hover:bg-[#fafaf9]">Добавить подраздел</button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="divide-y divide-[#f0efe9]">
                  {compositionRows.map((row) => {
                    const isDropTarget = dragOverCompositionRow?.type === row.type && dragOverCompositionRow.id === row.id && draggedCompositionRow?.id !== row.id;
                    if (row.type === "section") {
                      const child = row.section;
                      const childCount = getSectionDirectChildCount(child.id);
                      return (
                        <div
                          key={`section-${child.id}`}
                          onDragOver={(event) => {
                            if (!draggedCompositionRow || draggedCompositionRow.type !== "section" || draggedCompositionRow.id === child.id) return;
                            event.preventDefault();
                            event.dataTransfer.dropEffect = "move";
                            setDragOverCompositionRow({ type: "section", id: child.id });
                          }}
                          onDrop={(event) => {
                            event.preventDefault();
                            handleCompositionDrop({ type: "section", id: child.id });
                            setDraggedCompositionRow(null);
                            setDragOverCompositionRow(null);
                          }}
                          className={cn("group flex h-10 items-center gap-2 px-3 transition hover:bg-[#fafaf9]", isDropTarget && "bg-[#f5f3ff]")}
                        >
                          <span
                            draggable
                            role="button"
                            tabIndex={0}
                            aria-label={`Изменить порядок подраздела ${child.name}`}
                            onDragStart={(event) => {
                              event.dataTransfer.effectAllowed = "move";
                              event.dataTransfer.setData("text/plain", child.id);
                              setDraggedCompositionRow({ type: "section", id: child.id });
                            }}
                            onDragEnd={() => {
                              setDraggedCompositionRow(null);
                              setDragOverCompositionRow(null);
                            }}
                            className="flex h-full w-5 shrink-0 cursor-grab items-center justify-center text-[#a8a29e] opacity-60 transition hover:text-[#57534d] active:cursor-grabbing"
                          >
                            <DotsSixVertical size={13} />
                          </span>
                          <button type="button" onClick={() => onOpenSection(child.id)} className="flex h-full min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">
                            <span className="flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#f1f1ea] text-[#79716b]">
                              {child.imageUrl ? <img src={child.imageUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ForkKnife size={13} weight="fill" />}
                            </span>
                            <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#44403b]">{child.name}</span>
                            <span className="shrink-0 whitespace-nowrap text-[12px] text-[#a8a29e]">{childCount} {plural(childCount, "элемент", "элемента", "элементов")}</span>
                          </button>
                        </div>
                      );
                    }
                    const item = row.item;
                    const salePrice = item.hasDiscount && item.priceWithSale != null ? item.priceWithSale : null;
                    return (
                      <div
                        key={`item-${item.id}`}
                        onDragOver={(event) => {
                          if (!draggedCompositionRow || draggedCompositionRow.type !== "item" || draggedCompositionRow.id === item.id) return;
                          event.preventDefault();
                          event.dataTransfer.dropEffect = "move";
                          setDragOverCompositionRow({ type: "item", id: item.id });
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          handleCompositionDrop({ type: "item", id: item.id });
                          setDraggedCompositionRow(null);
                          setDragOverCompositionRow(null);
                        }}
                        className={cn("group flex h-10 items-center gap-2 px-3 transition hover:bg-[#fafaf9]", isDropTarget && "bg-[#f5f3ff]")}
                      >
                        <span
                          draggable
                          role="button"
                          tabIndex={0}
                          aria-label={`Изменить порядок позиции ${item.title}`}
                          onDragStart={(event) => {
                            event.dataTransfer.effectAllowed = "move";
                            event.dataTransfer.setData("text/plain", item.id);
                            setDraggedCompositionRow({ type: "item", id: item.id });
                          }}
                          onDragEnd={() => {
                            setDraggedCompositionRow(null);
                            setDragOverCompositionRow(null);
                          }}
                          className="flex h-full w-5 shrink-0 cursor-grab items-center justify-center text-[#a8a29e] opacity-60 transition hover:text-[#57534d] active:cursor-grabbing"
                        >
                          <DotsSixVertical size={13} />
                        </span>
                        <button type="button" onClick={() => onOpenItem(item.id)} className="flex h-full min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10">
                          <span className="flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#f5f5f4]">
                            {item.thumbnailUrl ? <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" /> : <ImageBroken size={13} className="text-[#a8a29e]" />}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium text-[#292524]">{item.title}</span>
                          <span className="shrink-0 whitespace-nowrap text-[13px] text-[#44403b]">{item.price === 0 && salePrice == null ? "—" : formatPrice(salePrice ?? item.price)}</span>
                          <span className="flex h-5 min-w-5 shrink-0 items-center justify-center whitespace-nowrap">{renderCompositionStatus(item)}</span>
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
            ) : activeTab === "basic" ? (
            <section>
              <div className="px-4 py-3 text-[13px] font-medium text-[#292524]">Основное</div>
              <div className="divide-y divide-[#f0efe9]">
                <div className="grid gap-3 px-4 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <div className="text-[13px] font-medium text-[#44403b]">Иконка раздела</div>
                  <div className="flex items-center gap-3">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-[10px] bg-[#f1f1ea] text-[#a8a29e]">
                      {section.imageUrl ? <img src={section.imageUrl} alt="" className="h-full w-full object-cover" /> : <ImageBroken size={18} />}
                    </span>
                    <button type="button" onClick={() => imageInputRef.current?.click()} className="h-8 rounded-[8px] px-2.5 text-[13px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4] hover:text-[#292524]">
                      {section.imageUrl ? "Заменить" : "Загрузить"}
                    </button>
                    {section.imageUrl && (
                      <Tooltip label="Удалить иконку" side="top">
                        <button type="button" onClick={() => onImageChange(null)} aria-label="Удалить иконку" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#a8a29e] transition hover:bg-[#f5f5f4] hover:text-[#57534d]">
                          <Trash size={14} />
                        </button>
                      </Tooltip>
                    )}
                    <input ref={imageInputRef} type="file" accept="image/*" className="hidden" onChange={handleImageFile} />
                  </div>
                </div>

                <label className="grid gap-3 px-4 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <span className="text-[13px] font-medium text-[#44403b]">Название</span>
                  <input
                    value={section.name}
                    onChange={(event) => onNameChange(event.target.value)}
                    className="h-9 w-full rounded-[9px] border border-[#e7e5e4] bg-white px-3 text-[13px] text-[#292524] shadow-[0_1px_2px_rgba(12,12,13,0.04)] outline-none transition focus:border-[#a8a29e] focus:ring-2 focus:ring-[#292524]/5"
                  />
                </label>

                <div className="grid gap-3 px-4 py-4 sm:grid-cols-[150px_minmax(0,1fr)]">
                  <div>
                    <div className="text-[13px] font-medium text-[#9f3a31]">Опасная зона</div>
                    <div className="mt-0.5 text-[12px] leading-4 text-[#a8a29e]">Архивирование раздела</div>
                  </div>
                  <div>
                    <div className="text-[12px] leading-5 text-[#79716b]">
                      {archived ? "Раздел находится в архиве и не показывается гостям." : "Архивный раздел не показывается гостям и остается доступен для восстановления."}
                    </div>
                    <button type="button" onClick={archived ? onRestore : onArchive} className={cn("mt-2 h-8 rounded-[8px] border px-3 text-[12px] font-medium transition", archived ? "border-[#d8d5d0] text-[#57534d] hover:bg-[#f5f5f4]" : "border-[#e7c6c2] text-[#9f3a31] hover:bg-[#fff7f6]")}>
                      {archived ? "Восстановить раздел" : "Архивировать раздел"}
                    </button>
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
  onOpenOverview,
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
  onSectionAction: (action: string) => void;
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
          Все разделы
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
              <DropdownActionItem onSelect={() => onSectionAction("Изменить раздел")}>Изменить раздел</DropdownActionItem>
              <DropdownActionItem onSelect={() => onSectionAction("Добавить подраздел")}>Добавить подраздел</DropdownActionItem>
              <DropdownActionItem onSelect={onOpenOverview}>Обзор раздела</DropdownActionItem>
              <DropdownActionItem onSelect={() => onSectionAction("Переместить")}>Переместить</DropdownActionItem>
              <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
              <DropdownActionItem tone="danger" onSelect={() => onSectionAction("Архивировать раздел")}>Архивировать</DropdownActionItem>
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
    title: "Новая позиция",
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

type SectionDeleteDialogState = {
  section: TreeSection;
  mode: "confirm" | "blocked";
  reason?: "items" | "children" | "both";
};

function SectionDeleteDialog({
  state,
  onCancel,
  onConfirm,
  onOpenSection,
}: {
  state: SectionDeleteDialogState;
  onCancel: () => void;
  onConfirm: (section: TreeSection) => void;
  onOpenSection: (section: TreeSection) => void;
}) {
  const blockedDescription =
    state.reason === "both"
      ? "Раздел не пуст. Сначала переместите или удалите позиции и подразделы."
      : state.reason === "children"
        ? "В разделе есть подразделы. Сначала переместите или удалите их."
        : "В разделе есть позиции. Сначала переместите или удалите их.";

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
        aria-labelledby="section-delete-title"
        className="w-full max-w-[380px] rounded-[16px] border border-[#e7e5e4] bg-white p-5 shadow-[0_24px_80px_rgba(41,37,36,0.22)]"
      >
        <h2 id="section-delete-title" className="text-[16px] font-semibold leading-6 text-[#292524]">
          {state.mode === "confirm" ? "Удалить раздел навсегда?" : "Нельзя удалить раздел"}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-[#79716b]">
          {state.mode === "confirm" ? "Раздел нельзя будет восстановить." : blockedDescription}
        </p>
        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="h-8 rounded-[9px] px-3 text-[13px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            Отмена
          </button>
          {state.mode === "confirm" ? (
            <button
              type="button"
              onClick={() => onConfirm(state.section)}
              className="h-8 rounded-[9px] bg-[#9f1239] px-3 text-[13px] font-medium text-white transition hover:bg-[#881337] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9f1239]/20"
            >
              Удалить навсегда
            </button>
          ) : (
            <button
              type="button"
              onClick={() => onOpenSection(state.section)}
              className="h-8 rounded-[9px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              Открыть позиции раздела
            </button>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function readJsonRecord<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function writeJsonRecord(key: string, value: unknown) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function PopulatedWorkspace({
  sections,
  scopeSectionId,
  initialSelectedItemId,
  onScopeChange,
  onViewModeChange,
}: {
  sections: TreeSection[];
  scopeSectionId: string | null;
  initialSelectedItemId: string | null;
  onScopeChange: (id: string | null) => void;
  onViewModeChange: (mode: CatalogViewMode) => void;
}) {
  const { contentLanguage } = useAppSettings();
  const { registerChange } = usePublish();
  const preferredSectionId =
    catalogSections.find((section) => section.name === "Горячие блюда")?.id ??
    SECTIONS_WITH_ITEMS[0]?.id ??
    catalogSections[0]?.id ??
    null;
  const preferredSectionItems = catalogItems.filter((item) => item.sectionId === preferredSectionId);
  const preferredItemId =
    catalogItems.find((item) => item.sectionId === preferredSectionId && item.title.includes("Пицца"))?.id ??
    preferredSectionItems[2]?.id ??
    preferredSectionItems[0]?.id ??
    null;
  const editorNavParam = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("editorNav");
  const editorNavMode: "entity" | "unified" | "section" | "legacy" = editorNavParam === "legacy"
    ? "legacy"
    : editorNavParam === "section"
      ? "section"
      : editorNavParam === "unified"
        ? "unified"
        : "entity";
  const directPositionId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("positionId");
  const directSectionId = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("sectionId");
  const directItem = directPositionId ? catalogItems.find((item) => item.id === directPositionId) ?? null : null;
  const directSection = directSectionId ? catalogSections.find((candidate) => candidate.id === directSectionId) ?? null : null;
  const retainedItem = initialSelectedItemId ? catalogItems.find((item) => item.id === initialSelectedItemId) ?? null : null;
  const firstSectionId = retainedItem?.sectionId ?? directItem?.sectionId ?? directSection?.id ?? preferredSectionId;
  const firstItemId = editorNavMode === "entity" || editorNavMode === "unified" ? retainedItem?.id ?? directItem?.id ?? null : preferredItemId;
  const editorNavExperiment = editorNavMode !== "legacy";
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(firstSectionId);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(firstItemId);
  // Явный режим: обзор раздела ↔ редактор позиции. Раньше режим выводился из
  // selectedItem != null, из-за чего смена раздела (обнулявшая позицию) выкидывала
  // из редактора и ломала пустой раздел в editor mode.
  const [editing, setEditing] = useState(editorNavMode === "section" ? false : Boolean(firstItemId));
  const [positionOrderBySection, setPositionOrderBySection] = useState<Record<string, string[]>>(() =>
    readJsonRecord<Record<string, string[]>>(CATALOG_POSITION_ORDER_STORAGE_KEY, {}),
  );
  const [sectionOrderByParent, setSectionOrderByParent] = useState<Record<string, string[]>>(() =>
    readJsonRecord<Record<string, string[]>>(CATALOG_SECTION_ORDER_STORAGE_KEY, {}),
  );
  const [itemSectionOverrides, setItemSectionOverrides] = useState<Record<string, string>>(() =>
    readJsonRecord<Record<string, string>>(CATALOG_ITEM_SECTION_STORAGE_KEY, {}),
  );
  const [sectionParentOverrides, setSectionParentOverrides] = useState<Record<string, string | null>>(() =>
    readJsonRecord<Record<string, string | null>>(CATALOG_SECTION_PARENT_STORAGE_KEY, {}),
  );
  // Последняя открытая позиция в каждом разделе за сессию (для правила 2.1).
  const [lastItemBySection, setLastItemBySection] = useState<Record<string, string>>({});
  // Черновики, созданные кнопкой «Добавить позицию» (статичные catalogItems не мутируем).
  const [extraItems, setExtraItems] = useState<CatalogItem[]>([]);
  const [itemStatusOverrides, setItemStatusOverrides] = useState<Record<string, CatalogItem["status"]>>(() =>
    readJsonRecord<Record<string, CatalogItem["status"]>>(CATALOG_STATUS_STORAGE_KEY, {}),
  );
  const [itemScheduledOverrides, setItemScheduledOverrides] = useState<Record<string, boolean>>(() =>
    readJsonRecord<Record<string, boolean>>(CATALOG_SCHEDULE_STORAGE_KEY, {}),
  );
  const [previousAvailabilityByItem, setPreviousAvailabilityByItem] = useState<Record<string, PreviousAvailabilityState>>(() =>
    readJsonRecord<Record<string, PreviousAvailabilityState>>(CATALOG_PREVIOUS_AVAILABILITY_STORAGE_KEY, {}),
  );
  const [unavailableDisplayByItem, setUnavailableDisplayByItem] = useState<Record<string, UnavailableDisplayMode>>(() =>
    readJsonRecord<Record<string, UnavailableDisplayMode>>(CATALOG_UNAVAILABLE_DISPLAY_STORAGE_KEY, {}),
  );
  const [outsideScheduleByItem, setOutsideScheduleByItem] = useState<Record<string, OutsideScheduleMode>>(() =>
    readJsonRecord<Record<string, OutsideScheduleMode>>(CATALOG_OUTSIDE_SCHEDULE_STORAGE_KEY, {}),
  );
  const [weeklyScheduleByItem, setWeeklyScheduleByItem] = useState<Record<string, WeeklySchedule>>(() =>
    readJsonRecord<Record<string, WeeklySchedule>>(CATALOG_WEEKLY_SCHEDULE_STORAGE_KEY, {}),
  );
  const [sectionStatusOverrides, setSectionStatusOverrides] = useState<Record<string, SectionStatus>>(() =>
    readJsonRecord<Record<string, SectionStatus>>(CATALOG_SECTION_STATUS_STORAGE_KEY, {}),
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
  const [upsellByItem, setUpsellByItem] = useState<CatalogUpsellStateByItem>(() =>
    readJsonRecord<CatalogUpsellStateByItem>(CATALOG_UPSELL_STORAGE_KEY, {}),
  );
  const [deletedItemIds, setDeletedItemIds] = useState<Set<string>>(new Set());
  const [deletedSectionIds, setDeletedSectionIds] = useState<Set<string>>(new Set());
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<CatalogItem | null>(null);
  const [pendingSectionDelete, setPendingSectionDelete] = useState<SectionDeleteDialogState | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [sectionArchiveOpen, setSectionArchiveOpen] = useState(false);
  const [sectionEditorTab, setSectionEditorTab] = useState<"composition" | "basic" | "availability">("composition");
  const [stopBusyIds, setStopBusyIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState("");

  const allSections = catalogSections
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
        availabilityMode: sectionAvailabilityBySection[section.id] ?? "always",
        sortOrder: storedIndex >= 0 ? storedIndex : 10_000 + (section.sortOrder ?? 0),
      };
    });
  const allSectionTree = buildLocalSectionTree(allSections);
  const activeSectionTree = buildLocalSectionTree(allSections.filter((candidate) => candidate.status !== "archive"));
  const archivedSectionTree = buildLocalSectionTree(allSections.filter((candidate) => candidate.status === "archive"));
  const activeSections = allSections.filter((candidate) => candidate.status !== "archive");
  void sections;

  const baseItems = extraItems.length ? [...catalogItems, ...extraItems] : catalogItems;
  const allItems = baseItems
    .filter((item) => !deletedItemIds.has(item.id))
    .map((item) => {
      const status = itemStatusOverrides[item.id];
      const scheduled = itemScheduledOverrides[item.id];
      const upsell = upsellByItem[item.id];
      const recommendationIds = resolveRecommendationIds(
        { ...item, status: status ?? item.status, scheduled: scheduled ?? item.scheduled },
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
        sectionId: itemSectionOverrides[item.id] ?? item.sectionId,
        sectionName: allSections.find((section) => section.id === (itemSectionOverrides[item.id] ?? item.sectionId))?.name ?? item.sectionName,
        status: status ?? item.status,
        scheduled: scheduled ?? item.scheduled,
        guestLabels: sticker ? [sticker] : [],
        tags,
        recommendationsCount: recommendationIds.length,
      };
    });
  const section = allSections.find((s) => s.id === selectedSectionId) ?? null;
  const sectionItems = orderSectionItems(
    allItems.filter((item) => item.sectionId === selectedSectionId),
    selectedSectionId ? positionOrderBySection[selectedSectionId] : undefined,
  );
  const childSections = selectedSectionId
    ? allSections
      .filter((candidate) => (candidate.parentId ?? null) === selectedSectionId)
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
    : [];
  const activeSectionItems = sectionItems.filter((item) => item.status !== "archive");
  const selectedItem = selectedItemId
    ? allItems.find((item) => item.id === selectedItemId) ?? null
    : null;
  const getSectionDirectChildCount = (sectionId: string) =>
    allItems.filter((item) => item.sectionId === sectionId && item.status !== "archive").length +
    allSections.filter((candidate) => (candidate.parentId ?? null) === sectionId && candidate.status !== "archive").length;

  const rememberItem = (id: string) => {
    const it = allItems.find((i) => i.id === id);
    if (it) setLastItemBySection((prev) => ({ ...prev, [it.sectionId]: id }));
  };

  // Правило 1: клик по разделу в дереве — только обзор, редактор не открываем.
  const selectSectionOverview = (id: string) => {
    setSelectedSectionId(id);
    setSelectedIds(new Set());
  };

  const openSectionEditor = (id: string) => {
    setSelectedSectionId(id);
    setSelectedItemId(null);
    setSelectedIds(new Set());
    setEditing(false);
    if (editorNavMode === "entity") {
      const url = new URL(window.location.href);
      url.searchParams.delete("positionId");
      url.searchParams.set("sectionId", id);
      window.history.replaceState(null, "", url);
    }
  };

  // Открыть позицию (из обзора или sibling-навигации) → войти в editor mode.
  const openItem = (id: string) => {
    const item = allItems.find((candidate) => candidate.id === id);
    if (item) setSelectedSectionId(item.sectionId);
    setSelectedItemId(id);
    setEditing(true);
    rememberItem(id);
    if (editorNavMode === "entity") {
      const url = new URL(window.location.href);
      url.searchParams.delete("sectionId");
      url.searchParams.set("positionId", id);
      window.history.replaceState(null, "", url);
    }
  };
  // В эксперименте раздел открывает список слева, но не выбирает позицию за пользователя.
  const selectSectionInEditor = (id: string) => {
    setSelectedSectionId(id);
    setSelectedIds(new Set());
    const items = allItems.filter((item) => item.sectionId === id);
    const remembered = lastItemBySection[id];
    const nextId = remembered && items.some((item) => item.id === remembered) ? remembered : null;
    setSelectedItemId(nextId);
    setEditing(true);
  };

  const openSectionOverview = () => {
    setSelectedItemId(null);
    setEditing(false);
    setSelectedIds(new Set());
  };

  const reorderItemsInSection = (sectionId: string, draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const ids = orderSectionItems(
      allItems.filter((item) => item.sectionId === sectionId && item.status !== "archive"),
      positionOrderBySection[sectionId],
    ).map((item) => item.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextIds = [...ids];
    const [draggedIdValue] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, draggedIdValue);
    setPositionOrderBySection((current) => ({ ...current, [sectionId]: nextIds }));
    setFeedback("Порядок позиций изменён");
  };

  const reorderSections = (parentId: string | null, draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const ids = allSections
      .filter((candidate) => (candidate.parentId ?? null) === parentId && candidate.status !== "archive")
      .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
      .map((candidate) => candidate.id);
    const fromIndex = ids.indexOf(draggedId);
    const toIndex = ids.indexOf(targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    const nextIds = [...ids];
    const [draggedIdValue] = nextIds.splice(fromIndex, 1);
    nextIds.splice(toIndex, 0, draggedIdValue);
    setSectionOrderByParent((current) => ({ ...current, [parentId ?? "__root__"]: nextIds }));
    setFeedback("Порядок разделов изменён");
  };

  const moveTreeItem = (
    draggedId: string,
    targetSectionId: string,
    targetItemId: string | null,
    mode: "before" | "after" | "inside",
  ) => {
    const dragged = allItems.find((item) => item.id === draggedId);
    if (!dragged) return;
    const sourceSectionId = dragged.sectionId;
    setPositionOrderBySection((current) => {
      const getIds = (sectionId: string) => orderSectionItems(
        allItems.filter((item) => item.sectionId === sectionId && item.id !== draggedId),
        current[sectionId],
      ).map((item) => item.id);
      const targetIds = getIds(targetSectionId);
      const targetIndex = targetItemId ? targetIds.indexOf(targetItemId) : -1;
      const insertionIndex = targetIndex < 0
        ? targetIds.length
        : mode === "after" ? targetIndex + 1 : targetIndex;
      targetIds.splice(insertionIndex, 0, draggedId);
      const next = { ...current, [targetSectionId]: targetIds };
      if (sourceSectionId !== targetSectionId) next[sourceSectionId] = getIds(sourceSectionId);
      return next;
    });
    setItemSectionOverrides((current) => ({ ...current, [draggedId]: targetSectionId }));
    if (selectedItemId === draggedId) setSelectedSectionId(targetSectionId);
    setLastItemBySection((current) => ({ ...current, [targetSectionId]: draggedId }));
    registerChange("catalog");
    setFeedback(sourceSectionId === targetSectionId ? "Порядок позиций изменён" : "Позиция перемещена");
  };

  const moveTreeSection = (
    draggedId: string,
    targetParentId: string | null,
    targetSectionId: string | null,
    mode: "before" | "after" | "inside",
  ) => {
    const dragged = allSections.find((section) => section.id === draggedId);
    if (!dragged || targetParentId === draggedId) return;
    const draggedNode = flattenSections(buildLocalSectionTree(allSections)).find((section) => section.id === draggedId);
    const descendants = new Set(flattenSections(draggedNode?.children ?? []).map((section) => section.id));
    if (targetParentId && descendants.has(targetParentId)) return;
    const sourceParentId = dragged.parentId ?? null;
    setSectionOrderByParent((current) => {
      const getIds = (parentId: string | null) => allSections
        .filter((section) => (section.parentId ?? null) === parentId && section.id !== draggedId)
        .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0))
        .map((section) => section.id);
      const targetIds = getIds(targetParentId);
      const targetIndex = targetSectionId ? targetIds.indexOf(targetSectionId) : -1;
      const insertionIndex = targetIndex < 0
        ? targetIds.length
        : mode === "after" ? targetIndex + 1 : targetIndex;
      targetIds.splice(insertionIndex, 0, draggedId);
      const targetKey = targetParentId ?? "__root__";
      const next = { ...current, [targetKey]: targetIds };
      if (sourceParentId !== targetParentId) next[sourceParentId ?? "__root__"] = getIds(sourceParentId);
      return next;
    });
    setSectionParentOverrides((current) => ({ ...current, [draggedId]: targetParentId }));
    registerChange("catalog");
    setFeedback(mode === "inside" ? "Раздел перемещён" : "Порядок разделов изменён");
  };

  // «Добавить позицию» в текущий раздел → создаём черновик и сразу открываем.
  const addPositionToSection = (sectionId: string) => {
    const targetSection = allSections.find((candidate) => candidate.id === sectionId) ?? null;
    if (!targetSection) return;
    const draft = makeDraftItem(targetSection);
    setExtraItems((prev) => [...prev, draft]);
    setSelectedSectionId(sectionId);
    setSelectedItemId(draft.id);
    setEditing(true);
    setLastItemBySection((prev) => ({ ...prev, [sectionId]: draft.id }));
  };
  const addPosition = () => {
    if (selectedSectionId) addPositionToSection(selectedSectionId);
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
    writeJsonRecord(CATALOG_STATUS_STORAGE_KEY, itemStatusOverrides);
    window.dispatchEvent(new Event("tasko-catalog-status-change"));
  }, [itemStatusOverrides]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SCHEDULE_STORAGE_KEY, itemScheduledOverrides);
  }, [itemScheduledOverrides]);

  useEffect(() => {
    writeJsonRecord(CATALOG_PREVIOUS_AVAILABILITY_STORAGE_KEY, previousAvailabilityByItem);
  }, [previousAvailabilityByItem]);

  useEffect(() => {
    writeJsonRecord(CATALOG_UNAVAILABLE_DISPLAY_STORAGE_KEY, unavailableDisplayByItem);
  }, [unavailableDisplayByItem]);

  useEffect(() => {
    writeJsonRecord(CATALOG_OUTSIDE_SCHEDULE_STORAGE_KEY, outsideScheduleByItem);
  }, [outsideScheduleByItem]);

  useEffect(() => {
    const validSchedules = Object.fromEntries(
      Object.entries(weeklyScheduleByItem).filter(([, schedule]) => isWeeklyScheduleValid(schedule)),
    );
    writeJsonRecord(CATALOG_WEEKLY_SCHEDULE_STORAGE_KEY, validSchedules);
  }, [weeklyScheduleByItem]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_STATUS_STORAGE_KEY, sectionStatusOverrides);
  }, [sectionStatusOverrides]);

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
    writeJsonRecord(CATALOG_UPSELL_STORAGE_KEY, upsellByItem);
  }, [upsellByItem]);

  useEffect(() => {
    writeJsonRecord(CATALOG_POSITION_ORDER_STORAGE_KEY, positionOrderBySection);
  }, [positionOrderBySection]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_ORDER_STORAGE_KEY, sectionOrderByParent);
  }, [sectionOrderByParent]);

  useEffect(() => {
    writeJsonRecord(CATALOG_ITEM_SECTION_STORAGE_KEY, itemSectionOverrides);
  }, [itemSectionOverrides]);

  useEffect(() => {
    writeJsonRecord(CATALOG_SECTION_PARENT_STORAGE_KEY, sectionParentOverrides);
  }, [sectionParentOverrides]);

  const updateUpsell = (itemId: string, next: CatalogItemUpsellState) => {
    setUpsellByItem((prev) => ({ ...prev, [itemId]: next }));
    registerChange("catalog");
  };

  const updateSectionDraft = (sectionId: string, patch: SectionDraftOverride) => {
    setSectionDraftOverrides((current) => ({
      ...current,
      [sectionId]: { ...current[sectionId], ...patch },
    }));
    registerChange("catalog");
  };

  const archiveSection = (target: TreeSection | null = section) => {
    if (!target) return;
    setSectionStatusOverrides((prev) => ({ ...prev, [target.id]: "archive" }));
    setSelectedSectionId(target.id);
    setSelectedIds(new Set());
    setSectionArchiveOpen(true);
    if (editorNavMode === "entity" || (editorNavMode === "unified" && selectedItem?.sectionId === target.id)) {
      setSelectedItemId(null);
      setEditing(false);
    }
    registerChange("catalog");
    setFeedback("Раздел перенесён в архив");
  };

  const restoreSection = (target: TreeSection) => {
    if (target.parentId) {
      const parent = allSections.find((candidate) => candidate.id === target.parentId);
      if (parent?.status === "archive") {
        setFeedback("Сначала восстановите родительский раздел");
        return;
      }
    }
    setSectionStatusOverrides((prev) => ({ ...prev, [target.id]: "active" }));
    setSelectedSectionId(target.id);
    if (editorNavMode === "entity") setSelectedItemId(null);
    registerChange("catalog");
    setFeedback("Раздел восстановлен");
  };

  const requestDeleteArchivedSection = (target: TreeSection) => {
    if (target.status !== "archive") return;
    const hasItems = allItems.some((item) => item.sectionId === target.id);
    const hasChildren = sectionHasChildren(target.id, allSections);
    if (hasItems || hasChildren) {
      setPendingSectionDelete({
        section: target,
        mode: "blocked",
        reason: hasItems && hasChildren ? "both" : hasChildren ? "children" : "items",
      });
      return;
    }
    setPendingSectionDelete({ section: target, mode: "confirm" });
  };

  const confirmDeleteArchivedSection = (target: TreeSection) => {
    setDeletedSectionIds((prev) => new Set(prev).add(target.id));
    setSectionStatusOverrides((prev) => {
      const next = { ...prev };
      delete next[target.id];
      return next;
    });
    setPendingSectionDelete(null);
    if (selectedSectionId === target.id) {
      const replacement = activeSections.find((candidate) => candidate.id !== target.id) ?? null;
      setSelectedSectionId(replacement?.id ?? null);
      setSelectedItemId(null);
      setEditing(false);
    }
    setFeedback("Раздел удалён навсегда");
  };

  const openSectionFromDeleteDialog = (target: TreeSection) => {
    setPendingSectionDelete(null);
    setSelectedSectionId(target.id);
    setSelectedItemId(null);
    setEditing(false);
    if (target.status === "archive") setSectionArchiveOpen(true);
  };

  const handleSectionAction = (action: string) => {
    if (action === "Архивировать" || action === "Архивировать раздел") {
      archiveSection();
      return;
    }
    if (action === "Восстановить из архива" && section) {
      restoreSection(section);
      return;
    }
    if (action === "Удалить навсегда" && section) {
      requestDeleteArchivedSection(section);
      return;
    }
    showPlaceholderFeedback(`${action}: placeholder`);
  };

  const handleUnifiedSectionAction = (target: TreeSection, action: string) => {
    if (action === "Настроить раздел" || action === "Изменить раздел") {
      if (editorNavMode === "entity") openSectionEditor(target.id);
      else showPlaceholderFeedback(`${action}: placeholder`);
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
    showPlaceholderFeedback(`${action}: placeholder`);
  };

  const archiveItem = (item: CatalogItem) => {
    setItemStatusOverrides((prev) => ({ ...prev, [item.id]: "archive" }));
    setArchiveOpen(true);
    setSelectedIds((current) => {
      const next = new Set(current);
      next.delete(item.id);
      return next;
    });
    setFeedback("Позиция перемещена в архив");
  };
  const restoreItem = (item: CatalogItem) => {
    const activeCount = allItems.filter((candidate) => candidate.status !== "archive" && candidate.id !== item.id).length;
    if (activeCount >= ACTIVE_POSITION_LIMIT) {
      setFeedback("Нельзя восстановить позицию: достигнут лимит тарифа");
      return;
    }
    setItemStatusOverrides((prev) => ({ ...prev, [item.id]: "active" }));
    setFeedback("Позиция восстановлена");
  };

  const setAvailabilityMode = (item: CatalogItem, mode: AvailabilityMode) => {
    if (item.status === "archive") return;
    if (mode === "unavailable") {
      if (item.status !== "stopped") {
        setPreviousAvailabilityByItem((prev) => ({
          ...prev,
          [item.id]: { status: item.status, scheduled: item.scheduled },
        }));
      }
      setItemStatusOverrides((prev) => ({ ...prev, [item.id]: "stopped" }));
      setFeedback("Позиция поставлена на стоп");
      return;
    }

    setPreviousAvailabilityByItem((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setItemStatusOverrides((prev) => ({ ...prev, [item.id]: "active" }));
    setItemScheduledOverrides((prev) => ({ ...prev, [item.id]: mode === "schedule" }));
    setFeedback(mode === "schedule" ? "Позиция доступна по расписанию" : "Позиция снова доступна для заказа");
  };

  const toggleStopItem = (item: CatalogItem) => {
    if ((item.status !== "active" && item.status !== "stopped") || stopBusyIds.has(item.id)) return;
    setStopBusyIds((current) => new Set(current).add(item.id));
    window.setTimeout(() => {
      if (item.status === "stopped") {
        const previous = previousAvailabilityByItem[item.id] ?? { status: "active", scheduled: false };
        setItemStatusOverrides((prev) => ({ ...prev, [item.id]: previous.status }));
        setItemScheduledOverrides((prev) => ({ ...prev, [item.id]: previous.scheduled }));
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
        setItemStatusOverrides((prev) => ({ ...prev, [item.id]: "stopped" }));
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
    setDeletedItemIds((prev) => new Set(prev).add(item.id));
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
  const handleBulkAction = (action: string) => {
    showPlaceholderFeedback(`${action}: ${selectedIds.size} ${plural(selectedIds.size, "позиция", "позиции", "позиций")}`);
    if (action === "Архивировать") {
      setItemStatusOverrides((prev) => {
        const next = { ...prev };
        selectedIds.forEach((id) => {
          next[id] = "archive";
        });
        return next;
      });
      setArchiveOpen(true);
      setSelectedIds(new Set());
    }
  };

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  const renderPositionEditor = (item: CatalogItem) => (
    <PositionEditor
      item={item}
      allItems={allItems}
      upsell={upsellByItem[item.id] ?? {}}
      onUpsellChange={(next) => updateUpsell(item.id, next)}
      stopBusy={stopBusyIds.has(item.id)}
      onArchiveItem={archiveItem}
      onRestoreItem={restoreItem}
      onMoveItem={(targetItem) => showPlaceholderFeedback(`Переместить «${targetItem.title}»: placeholder`)}
      onToggleStop={toggleStopItem}
      onSetAvailabilityMode={setAvailabilityMode}
      unavailableDisplayMode={unavailableDisplayByItem[item.id] ?? "hidden"}
      outsideScheduleMode={outsideScheduleByItem[item.id] ?? "hidden"}
      weeklySchedule={weeklyScheduleByItem[item.id] ?? createDefaultWeeklySchedule()}
      onUnavailableDisplayModeChange={(mode) => setUnavailableDisplayByItem((prev) => ({ ...prev, [item.id]: mode }))}
      onOutsideScheduleModeChange={(mode) => setOutsideScheduleByItem((prev) => ({ ...prev, [item.id]: mode }))}
      onWeeklyScheduleChange={(schedule) => setWeeklyScheduleByItem((prev) => ({ ...prev, [item.id]: schedule }))}
      onRequestPermanentDelete={requestPermanentDelete}
    />
  );
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbf9]">
      <div className="flex min-h-0 flex-1">
        {editorNavMode === "entity" || editorNavMode === "unified" ? (
          <UnifiedCatalogTreePanel
            sections={editorNavMode === "entity" ? allSectionTree : activeSectionTree}
            items={allItems}
            scopeSectionId={scopeSectionId}
            selectedSectionId={selectedSectionId}
            selectedItemId={selectedItemId}
            sectionEditingEnabled={editorNavMode === "entity"}
            includeArchived={editorNavMode === "entity"}
            positionOrderBySection={positionOrderBySection}
            onSelectSection={openSectionEditor}
            onSelectItem={openItem}
            onScopeChange={onScopeChange}
            onViewModeChange={onViewModeChange}
            onAddSection={() => showPlaceholderFeedback("Добавить раздел: placeholder")}
            onAddPositionRequest={() => showPlaceholderFeedback("Добавить позицию: выберите родительский раздел")}
            onAddPosition={addPositionToSection}
            onSectionAction={handleUnifiedSectionAction}
            onMoveItem={moveTreeItem}
            onMoveSection={moveTreeSection}
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
        {editorNavMode === "entity" ? (
          selectedItem ? (
            renderPositionEditor(selectedItem)
          ) : section ? (
            <SectionEditor
              section={section}
              childSections={childSections}
              compositionItems={sectionItems}
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
              onOpenItem={openItem}
              onOpenSection={openSectionEditor}
              onReorderItem={(draggedId, targetId) => reorderItemsInSection(section.id, draggedId, targetId)}
              onReorderSection={(draggedId, targetId) => reorderSections(section.id, draggedId, targetId)}
              getSectionDirectChildCount={getSectionDirectChildCount}
              onArchive={() => archiveSection(section)}
              onRestore={() => restoreSection(section)}
              onAction={(action) => handleUnifiedSectionAction(section, action)}
            />
          ) : (
            <UnifiedCatalogSelectionState />
          )
        ) : editorNavMode === "unified" ? (
          selectedItem ? (
            <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
              {(() => {
                const selectedItemSection = allSections.find((candidate) => candidate.id === selectedItem.sectionId) ?? null;
                if (!selectedItemSection) return null;
                const itemCount = allItems.filter((candidate) => candidate.sectionId === selectedItemSection.id && candidate.status !== "archive").length;
                return (
                  <SectionEditorContext
                    section={selectedItemSection}
                    itemCount={itemCount}
                    onEdit={() => handleUnifiedSectionAction(selectedItemSection, "Изменить раздел")}
                    onAddPosition={() => addPositionToSection(selectedItemSection.id)}
                    onAction={(action) => handleUnifiedSectionAction(selectedItemSection, action)}
                  />
                );
              })()}
              {renderPositionEditor(selectedItem)}
            </div>
          ) : (
            <UnifiedCatalogSelectionState />
          )
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
        {selectedItem?.status === "archive" && (
          <div className="pointer-events-none fixed bottom-5 right-8 z-[100001] rounded-[10px] border border-[#e7e5e4] bg-white px-3 py-2 text-[13px] font-medium text-[#79716b] shadow-[0_12px_36px_rgba(41,37,36,0.12)]">
            Архивные позиции не отображаются в меню
          </div>
        )}
        {(editorNavMode === "entity" || editorNavMode === "unified" || editing) && feedback && (
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
            onConfirm={confirmDeleteArchivedSection}
            onOpenSection={openSectionFromDeleteDialog}
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

// ── Audit table (Figma 979:10759) ─────────────────────────────────────────────

const TABLE_COL = {
  description: "w-[72px]",
  weight: "w-[52px]",
  kbju: "w-[54px]",
  translation: "w-[66px]",
  price: "w-[76px]",
  kebab: "w-[36px]",
};

function TableCheckbox({
  ariaLabel,
  checked = false,
  indeterminate = false,
  onChange,
  quiet = false,
  forceVisible = false,
}: {
  ariaLabel: string;
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
  quiet?: boolean;
  forceVisible?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate;
  }, [indeterminate]);

  return (
    <input
      ref={ref}
      type="checkbox"
      checked={checked}
      onChange={(event) => onChange?.(event.target.checked)}
      aria-label={ariaLabel}
      className={cn(
        "h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[5px] border border-[#d6d3d1] bg-white accent-[#57534d] transition-opacity duration-150 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        quiet && !checked && !indeterminate && !forceVisible && "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 [@media(hover:none)]:opacity-100",
        (!quiet || checked || indeterminate || forceVisible) && "opacity-100",
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

function TableHeaderRow({
  query,
  onQueryChange,
  checked,
  indeterminate,
  onSelectAll,
  priceSort,
  onPriceSortChange,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  checked: boolean;
  indeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
  priceSort: PriceSortDirection;
  onPriceSortChange: () => void;
}) {
  const labels: [string, string][] = [
    ["Описание", TABLE_COL.description],
    ["Вес", TABLE_COL.weight],
    ["КБЖУ", TABLE_COL.kbju],
    ["Перевод", TABLE_COL.translation],
  ];
  const priceSortTooltip = getPriceSortTooltip(priceSort);

  return (
    <div className="sticky top-0 z-10 border-b border-[#e7e5e4] bg-white pb-2 pt-2">
      <div className="flex min-h-9 items-center">
      <div className="flex min-w-[220px] flex-1 items-center gap-2 pr-2">
        <TableCheckbox
          ariaLabel="Выбрать все видимые позиции"
          checked={checked}
          indeterminate={indeterminate}
          onChange={onSelectAll}
        />
        <div className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-[7px] border border-[#e7e5e4] px-[7px]">
          <MagnifyingGlass size={14} className="shrink-0 text-[#a6a09b]" />
          <input
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            placeholder="Поиск по всем позициям"
            className="min-w-0 flex-1 bg-transparent text-[13px] leading-4 text-[#292524] outline-none placeholder:text-[#79716b]"
          />
        </div>
      </div>
      {labels.map(([label, width]) => (
        <span
          key={label}
          className={cn("flex h-full shrink-0 items-center justify-center px-2 text-[12px] leading-5 text-[#79716b]", width)}
        >
          {label}
        </span>
      ))}
      <Tooltip label={priceSortTooltip} side="top">
        <button
          type="button"
          onClick={onPriceSortChange}
          aria-label={priceSortTooltip}
          className={cn(
            "flex h-8 shrink-0 items-center justify-center gap-1 rounded-[7px] px-2 text-[12px] leading-5 transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
            TABLE_COL.price,
            priceSort === "none" ? "text-[#79716b]" : "font-medium text-[#292524]",
          )}
        >
          <span>Цена</span>
          <span className="flex h-4 w-3 shrink-0 items-center justify-center">
            {priceSort === "asc" ? (
              <CaretUp size={11} weight="bold" />
            ) : priceSort === "desc" ? (
              <CaretDown size={11} weight="bold" />
            ) : (
              <span className="flex flex-col items-center justify-center leading-none text-[#a8a29e]">
                <CaretUp size={8} weight="bold" />
                <CaretDown size={8} weight="bold" className="-mt-1" />
              </span>
            )}
          </span>
        </button>
      </Tooltip>
      <span className={cn("h-8 shrink-0", TABLE_COL.kebab)} />
      </div>
    </div>
  );
}

function StatusBadge({ label }: { label: string }) {
  const isStop = label === "На стопе";
  const isBlue = label === "С расписанием" || label === "Скоро будет";
  const isSlate = label === "В архиве" || label === "Скрыта";

  return (
    <span
      className={cn(
        "flex h-4 items-center justify-center gap-0.5 rounded-[4px]",
        isStop && "bg-[#ffedd4] pl-[3px] pr-1.5",
        isBlue && "bg-[#dbeafe] pl-[3px] pr-1.5",
        isSlate && "bg-[#f1f5f9] px-1.5",
        !isStop && !isBlue && !isSlate && "bg-[#f5f5f4] px-1.5",
      )}
    >
      {isStop && <Lock size={12} weight="fill" className="shrink-0 text-[#f54900]" />}
      {isBlue && <Clock size={12} weight="fill" className="shrink-0 text-[#2b7fff]" />}
      <span
        className={cn(
          "whitespace-nowrap text-[11px] font-semibold leading-5",
          isStop ? "text-[#ca3500]" : isBlue ? "text-[#2b7fff]" : isSlate ? "text-[#62748e]" : "text-[#57534d]",
        )}
      >
        {label}
      </span>
    </span>
  );
}

function GuestPropertyIcon({ icon }: { icon: GuestProperty["icon"] }) {
  if (icon === "label") return <MegaphoneSimple size={12} className="shrink-0 text-[#57534d]" />;
  if (icon === "tag") return <Tag size={12} className="shrink-0 text-[#57534d]" />;
  if (icon === "spicy") return <Fire size={12} weight="fill" className="shrink-0 text-[#57534d]" />;
  return null;
}

function AttributeBadge({ property }: { property: GuestProperty }) {
  return (
    <span className="flex h-4 items-center justify-center gap-0.5 rounded-[4px] bg-[#f5f5f4] pl-[3px] pr-1.5">
      <GuestPropertyIcon icon={property.icon} />
      <span className="whitespace-nowrap text-[11px] font-medium leading-5 text-[#292524]">{property.label}</span>
    </span>
  );
}

function MetaDot() {
  return <span className="text-[10px] font-extralight leading-none text-[#a6a6a6]">•</span>;
}

function RowMeta({ item, showSectionMeta }: { item: CatalogItem; showSectionMeta?: boolean }) {
  const statusChips = getStatusChips(item);
  const guestProperties: GuestProperty[] = [
    ...item.guestLabels.map((label): GuestProperty => ({ label, icon: "label" })),
    ...item.tags.map((label): GuestProperty => ({ label, icon: "tag" })),
  ];
  const counts: string[] = [];
  if (showSectionMeta) counts.push(item.sectionName);
  if (item.optionsCount > 0) {
    counts.push(`${item.optionsCount} ${plural(item.optionsCount, "опция", "опции", "опций")}`);
  }
  if (item.recommendationsCount > 0) {
    counts.push(
      `${item.recommendationsCount} ${plural(item.recommendationsCount, "рекомендация", "рекомендации", "рекомендаций")}`,
    );
  }

  const segments: ReactNode[] = [];
  if (statusChips.length > 0) {
    segments.push(
      <span key="status" className="flex items-center gap-1">
        {statusChips.map((chip) => (
          <StatusBadge key={chip.label} label={chip.label} />
        ))}
      </span>,
    );
  }
  if (guestProperties.length > 0) {
    segments.push(
      <span key="attributes" className="flex items-center gap-[3px]">
        {guestProperties.map((property, index) => (
          <span key={property.label} className="flex items-center gap-[3px]">
            {index > 0 && <MetaDot />}
            <AttributeBadge property={property} />
          </span>
        ))}
      </span>,
    );
  }
  if (counts.length > 0) {
    segments.push(
      <span key="counts" className="flex items-center gap-[3px]">
        {counts.map((count, index) => (
          <span key={count} className="flex items-center gap-[3px]">
            {index > 0 && <MetaDot />}
            <span className="whitespace-nowrap text-[12px] leading-none text-[#595959]">{count}</span>
          </span>
        ))}
      </span>,
    );
  }

  if (segments.length === 0) return null;

  return (
    <span className="flex min-w-0 items-center gap-2 overflow-hidden">
      {segments.map((segment, index) => (
        <span key={index} className="flex shrink-0 items-center gap-2">
          {index > 0 && <span className="h-[11px] w-px shrink-0 bg-[#e7e5e4]" />}
          {segment}
        </span>
      ))}
    </span>
  );
}

function DropdownContent({ children, align = "end" }: { children: ReactNode; align?: "start" | "center" | "end" }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className="z-[100002] min-w-[190px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
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
}: {
  children: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        "flex h-8 cursor-pointer select-none items-center rounded-lg px-2.5 text-[13px] font-medium outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[#f5f5f4]",
        tone === "danger" ? "text-[#9f1239]" : "text-[#44403b]",
      )}
    >
      {children}
    </DropdownMenu.Item>
  );
}

function AuditRowActionsMenu({ item, onAction }: { item: CatalogItem; onAction: (action: string) => void }) {
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
        <DropdownActionItem onSelect={() => onAction("Открыть позицию")}>Открыть позицию</DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction("Редактировать")}>Редактировать</DropdownActionItem>
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
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

function AuditDishRow({
  item,
  showSectionMeta,
  onAction,
  selected,
  selectionMode,
  onSelectedChange,
}: {
  item: CatalogItem;
  showSectionMeta?: boolean;
  onAction: (item: CatalogItem, action: string) => void;
  selected: boolean;
  selectionMode: boolean;
  onSelectedChange: (id: string, selected: boolean) => void;
}) {
  const kbjuState =
    item.nutritionFilledCount === 4 ? "filled" : item.nutritionFilledCount > 0 ? "partial" : "missing";
  const salePrice = item.hasDiscount && item.priceWithSale != null ? item.priceWithSale : null;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onAction(item, "Открыть позицию")}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          onAction(item, "Открыть позицию");
        }
      }}
      className={cn(
        "group flex h-[62px] cursor-pointer items-center border-b border-[#e5e7eb] transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        selected ? "bg-[#f7f6f2]" : "bg-white",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className="flex h-full w-[18px] shrink-0 items-center"
          onClick={(event) => event.stopPropagation()}
          onKeyDown={(event) => event.stopPropagation()}
        >
          <TableCheckbox
            ariaLabel={`Выбрать ${item.title}`}
            checked={selected}
            quiet
            forceVisible={selectionMode}
            onChange={(checked) => onSelectedChange(item.id, checked)}
          />
        </span>
        <div className="flex min-w-0 items-center gap-[9px]">
          <span
            className={cn(
              "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-[6px]",
              item.thumbnailUrl ? "bg-[#f5f5f4]" : "bg-[#faf0e6]",
            )}
            title={item.thumbnailUrl ? undefined : "Нет фото"}
          >
            {item.thumbnailUrl ? (
              <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
            ) : (
              <ImageBroken size={14} className="text-[#bc4a08]" />
            )}
          </span>
          <div className="flex min-w-0 flex-col justify-center gap-1.5">
            <span className="block max-w-full truncate text-left text-[13px] leading-none text-[#292524]">
              {item.title}
            </span>
            <RowMeta item={item} showSectionMeta={showSectionMeta} />
          </div>
        </div>
      </div>
      <span className={cn("flex shrink-0 items-center justify-center px-3", TABLE_COL.description)}>
        <AuditDot
          state={item.hasDescription ? "filled" : "missing"}
          title={item.hasDescription ? "Описание есть" : "Нет описания"}
        />
      </span>
      <span
        className={cn("flex shrink-0 items-center justify-center px-3 text-[13px] leading-5 text-[#292524]", TABLE_COL.weight)}
        title={item.weightLabel ? `Граммовка: ${item.weightLabel}` : "Нет граммовки"}
      >
        {item.weightLabel ? (
          <span className="truncate whitespace-nowrap">{item.weightLabel}</span>
        ) : (
          <span className="text-[#a6a09b]">—</span>
        )}
      </span>
      <span className={cn("flex shrink-0 items-center justify-center px-3", TABLE_COL.kbju)}>
        <AuditDot
          state={kbjuState}
          title={
            kbjuState === "missing"
              ? "Нет КБЖУ"
              : kbjuState === "partial"
                ? `КБЖУ заполнено частично (${item.nutritionFilledCount} из 4)`
                : "КБЖУ (на 100 г) заполнено"
          }
        />
      </span>
      <span
        className={cn("flex shrink-0 items-center justify-center px-3 text-[13px] leading-5 text-[#292524]", TABLE_COL.translation)}
        title={`Перевод: ${item.translationFilledCount} из ${item.translationTotalCount} языков`}
      >
        {item.translationFilledCount}/{item.translationTotalCount}
      </span>
      <span
        className={cn(
          "flex shrink-0 flex-col items-center justify-center px-3 text-[13px] leading-5 text-[#292524]",
          TABLE_COL.price,
        )}
      >
        {item.price === 0 && salePrice == null ? (
          <span className="text-[#a6a09b]" title="Цена не указана">—</span>
        ) : (
          <span className="whitespace-nowrap">{formatPrice(salePrice ?? item.price)}</span>
        )}
        {salePrice != null && (
          <span className="text-[11px] leading-3 text-[#a6a09b] line-through">{formatPrice(item.price)}</span>
        )}
      </span>
      <span
        className={cn("flex shrink-0 items-center justify-center", TABLE_COL.kebab)}
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => event.stopPropagation()}
      >
        <AuditRowActionsMenu item={item} onAction={(action) => onAction(item, action)} />
      </span>
    </div>
  );
}

type BulkDialog =
  | { type: "schedule" }
  | { type: "discount" }
  | { type: "placeholder"; title: string; text: string }
  | { type: "delete" };

function SelectionToolbar({
  count,
  checked,
  indeterminate,
  onSelectAll,
  onClear,
  onSetStatus,
  onSetAvailable,
  onClearDiscount,
  onOpenSchedule,
  onOpenDiscount,
  onOpenPlaceholder,
  onOpenDelete,
}: {
  count: number;
  checked: boolean;
  indeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
  onClear: () => void;
  onSetStatus: (status: CatalogItem["status"]) => void;
  onSetAvailable: () => void;
  onClearDiscount: () => void;
  onOpenSchedule: () => void;
  onOpenDiscount: () => void;
  onOpenPlaceholder: (title: string, text: string) => void;
  onOpenDelete: () => void;
}) {
  return (
    <div className="flex h-8 min-w-0 items-center overflow-hidden rounded-[8px] border border-[#d8d5d0] bg-[#f7f6f2] shadow-[0_4px_14px_rgba(41,37,36,0.08)]">
      <div className="flex h-full min-w-0 items-center">
        <TableCheckbox
          ariaLabel="Выбрать все видимые позиции"
          checked={checked}
          indeterminate={indeterminate}
          onChange={onSelectAll}
        />
        <button
          type="button"
          onClick={onClear}
          className="flex h-full items-center px-2.5 text-[13px] font-medium text-[#2563eb] transition hover:bg-white/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          title="Снять выделение"
        >
          {count} {plural(count, "выбрана", "выбраны", "выбрано")}
        </button>
        <ToolbarDivider />
        <ToolbarDropdown label="Статус">
          <DropdownActionItem onSelect={() => onSetStatus("active")}>В меню</DropdownActionItem>
          <DropdownActionItem onSelect={() => onSetStatus("archive")} tone="danger">В архив</DropdownActionItem>
        </ToolbarDropdown>
        <ToolbarDivider />
        <ToolbarDropdown label="Доступность">
          <DropdownActionItem onSelect={() => onSetStatus("stopped")}>Поставить на стоп</DropdownActionItem>
          <DropdownActionItem onSelect={() => onSetStatus("active")}>Убрать со стопа</DropdownActionItem>
          <DropdownActionItem onSelect={() => onSetStatus("coming-soon")}>Скоро будет</DropdownActionItem>
          <DropdownActionItem onSelect={onSetAvailable}>Всегда доступно</DropdownActionItem>
          <DropdownActionItem onSelect={onOpenSchedule}>По расписанию</DropdownActionItem>
        </ToolbarDropdown>
        <ToolbarDivider />
        <ToolbarDropdown label="Скидка">
          <DropdownActionItem onSelect={onOpenDiscount}>Задать скидку</DropdownActionItem>
          <DropdownActionItem onSelect={onClearDiscount}>Убрать скидку</DropdownActionItem>
        </ToolbarDropdown>
        <ToolbarDivider />
        <ToolbarDropdown label="Ещё">
          <DropdownActionItem onSelect={() => onOpenPlaceholder("Добавить тег", "Добавление тегов будет добавлено позже")}>
            Добавить тег
          </DropdownActionItem>
          <DropdownActionItem onSelect={() => onOpenPlaceholder("Убрать тег", "Удаление тегов будет добавлено позже")}>
            Убрать тег
          </DropdownActionItem>
          <DropdownActionItem onSelect={() => onOpenPlaceholder("Дублировать", "Дублирование будет добавлено позже")}>
            Дублировать
          </DropdownActionItem>
          <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
          <DropdownActionItem onSelect={onOpenDelete} tone="danger">Удалить</DropdownActionItem>
        </ToolbarDropdown>
        <ToolbarDivider />
        <button
          type="button"
          onClick={onClear}
          aria-label="Снять выбор"
          className="flex h-full w-8 items-center justify-center text-[17px] leading-none text-[#79716b] transition hover:bg-white/70 hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          ×
        </button>
      </div>
    </div>
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
  count,
  query,
  scopeName,
  onStartSequential,
}: {
  filterId: OverviewFilterId;
  count: number;
  query: string;
  scopeName?: string;
  onStartSequential?: () => void;
}) {
  const meta = OVERVIEW_FILTER_META[filterId];
  const subtitle = (() => {
    if (filterId === "quick:no-description" || filterId === "quick:no-photo") return `${count} ${plural(count, "позиция требует", "позиции требуют", "позиций требуют")} внимания`;
    if (filterId === "status:stop") return `${count} ${plural(count, "позиция сейчас на стопе", "позиции сейчас на стопе", "позиций сейчас на стопе")}`;
    if (filterId === "status:active") return `${count} ${plural(count, "позиция доступна", "позиции доступны", "позиций доступны")} гостям`;
    if (filterId === "status:archived") return `${count} ${plural(count, "позиция находится", "позиции находятся", "позиций находятся")} в архиве`;
    return meta.countText(count);
  })();

  return (
    <div className="flex min-h-[42px] min-w-0 items-center gap-3">
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-medium leading-[1.4] text-[#292524]">{meta.label}</div>
        <div className="text-[13px] leading-4 text-[#292524]">
        {subtitle}
        {scopeName && <span> · раздел «{scopeName}»</span>}
        {query.trim() && <span> · с учётом поиска</span>}
        </div>
      </div>
      {onStartSequential && count > 0 && (
        <button
          type="button"
          onClick={onStartSequential}
          className="inline-flex h-8 shrink-0 items-center justify-center rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          Исправлять по очереди
        </button>
      )}
    </div>
  );
}

function DescriptionQueueRow({
  item,
  selected,
  fixed,
  onClick,
}: {
  item: CatalogItem;
  selected: boolean;
  fixed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${item.title} · ${item.sectionName}`}
      className={cn(
        "group flex h-[34px] w-full items-center gap-2 rounded-[7px] border px-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        selected ? "border-[#e7e5e4] bg-white shadow-[0_2px_6px_rgba(41,37,36,0.13)]" : "border-transparent hover:bg-[#f7f6f2]",
        fixed && !selected && "text-[#8a8179]",
      )}
    >
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-[6px] bg-[#e9e9df]",
          selected && "border border-[#6d5dfc] bg-white p-[2px]",
        )}
      >
        {item.thumbnailUrl ? (
          <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full rounded-[4px] object-cover" />
        ) : (
          <ImageBroken size={12} className="text-[#a8a29e]" />
        )}
      </span>
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[13px] leading-5",
          fixed ? "font-medium text-[#8a8179]" : selected ? "font-semibold text-[#292524]" : "font-medium text-[#79716b]",
        )}
      >
        {item.title}
      </span>
      {fixed && (
        <span title="Исправлено" className="flex h-6 w-6 shrink-0 items-center justify-center text-[#79716b]">
          <Check size={14} />
        </span>
      )}
    </button>
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

function CatalogScopeSelect({ value, onChange }: { value: string | null; onChange: (id: string | null) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const selected = catalogSections.find((section) => section.id === value) ?? null;
  const normalizedQuery = query.trim().toLowerCase();
  const options = catalogSections
    .map((section) => ({ section, path: getSectionFullPath(section.id) }))
    .filter((option) => !normalizedQuery || option.path.toLowerCase().includes(normalizedQuery));

  return (
    <DropdownMenu.Root open={open} onOpenChange={(next) => { setOpen(next); if (!next) setQuery(""); }}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Область каталога"
          className="flex h-8 w-full items-center gap-2 rounded-[8px] bg-[#f0f0ea] px-1.5 text-left transition hover:bg-[#eae9e2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-[#e6e6db] text-[#1c1917]">
            {selected?.imageUrl ? <img src={selected.imageUrl} alt="" className="h-full w-full object-cover" /> : <FunnelSimple size={14} />}
          </span>
          <span className="min-w-0 flex-1 truncate text-[13px] font-normal leading-[18px] text-[#292524]">{selected?.name ?? "Все разделы"}</span>
          <CaretDown size={14} weight="bold" className="shrink-0 text-[#1c1917]" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content align="start" sideOffset={6} className="z-[100002] w-[310px] rounded-[12px] border border-[#e7e5e4] bg-white p-2 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none">
          <label className="mb-2 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] px-2 text-[#a8a29e] focus-within:border-[#a8a29e]">
            <MagnifyingGlass size={14} />
            <input value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.stopPropagation()} placeholder="Найти раздел" autoFocus className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]" />
          </label>
          <div className="max-h-[360px] overflow-y-auto">
            <DropdownMenu.Item onSelect={() => onChange(null)} className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-medium text-[#44403b] outline-none data-[highlighted]:bg-[#f5f5f4]">
              <span className="min-w-0 flex-1">Все разделы</span>{value === null && <Check size={13} />}
            </DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
            {options.map(({ section, path }) => (
              <DropdownMenu.Item key={section.id} onSelect={() => onChange(section.id)} title={path} className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] font-medium text-[#44403b] outline-none data-[highlighted]:bg-[#f5f5f4]">
                <span className="min-w-0 flex-1 truncate">{path}</span>{value === section.id && <Check size={13} />}
              </DropdownMenu.Item>
            ))}
            {options.length === 0 && <div className="px-2 py-3 text-[13px] text-[#79716b]">Разделы не найдены</div>}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function UnifiedFlatCatalogPanel({
  filterId,
  scopeSectionId,
  query,
  count,
  items,
  selectedItemId,
  fixedIds,
  repairProgress,
  tableActive,
  onFilterChange,
  onScopeChange,
  onQueryChange,
  onReset,
  onOpenTable,
  onSelectItem,
}: {
  filterId: OverviewFilterId;
  scopeSectionId: string | null;
  query: string;
  count: number;
  items: CatalogItem[];
  selectedItemId: string | null;
  fixedIds?: Set<string>;
  repairProgress?: { remaining: number; total: number };
  tableActive: boolean;
  onFilterChange: (id: OverviewFilterId) => void;
  onScopeChange: (id: string | null) => void;
  onQueryChange: (value: string) => void;
  onReset: () => void;
  onOpenTable: () => void;
  onSelectItem: (item: CatalogItem, fixed: boolean) => void;
}) {
  const scope = catalogSections.find((section) => section.id === scopeSectionId) ?? null;
  const emptyText = scope
    ? filterId === "quick:all" ? "В разделе пока нет позиций" : `В разделе «${scope.name}» нет позиций: ${OVERVIEW_FILTER_META[filterId].label.toLowerCase()}`
    : OVERVIEW_FILTER_META[filterId].emptyTitle;

  return (
    <aside className="flex w-[250px] shrink-0 flex-col overflow-hidden border-r border-[#e7e5e4] bg-[#fbfbf9]">
      <div className="shrink-0 border-b border-[#e7e5e4] px-3 pb-4 pt-5">
        <CatalogViewModeSelect value={filterId} onChange={(mode) => mode === "sections" ? onReset() : onFilterChange(mode)} onReset={onReset} />
        <div className="mt-3">
          <CatalogScopeSelect value={scopeSectionId} onChange={onScopeChange} />
        </div>
      </div>
      <div className="shrink-0 border-b border-[#e7e5e4] px-3 py-3">
        <button
          type="button"
          onClick={onOpenTable}
          className={cn(
            "flex h-10 w-full items-center gap-2 rounded-[10px] border px-2.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
            tableActive ? "border-[#e7e5e4] bg-white shadow-[0_2px_8px_rgba(41,37,36,0.08)]" : "border-transparent hover:bg-[#f1f1ea]",
          )}
        >
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] bg-[#efefe8] text-[#57534d]"><Table size={16} /></span>
          <span className="min-w-0 flex-1 text-[14px] font-medium text-[#292524]">Таблица</span>
          <span className="rounded-[7px] bg-[#f4f3ef] px-1.5 py-0.5 text-[12px] font-medium tabular-nums text-[#79716b]">{count}</span>
        </button>
        {repairProgress && <p className="mt-2 px-1 text-[12px] leading-4 text-[#79716b]">Осталось {repairProgress.remaining} из {repairProgress.total}</p>}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-1">
          {items.map((item) => {
            const fixed = fixedIds?.has(item.id) ?? false;
            return <DescriptionQueueRow key={item.id} item={item} selected={item.id === selectedItemId} fixed={fixed} onClick={() => onSelectItem(item, fixed)} />;
          })}
          {items.length === 0 && (
            <div className="rounded-[10px] border border-dashed border-[#e7e5e4] bg-white/60 px-3 py-4">
              <p className="text-[12px] leading-5 text-[#79716b]">{query.trim() ? "По вашему запросу ничего не найдено" : emptyText}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {query.trim() && <button type="button" onClick={() => onQueryChange("")} className="text-[12px] font-medium text-[#57534d] hover:text-[#292524]">Очистить поиск</button>}
                <button type="button" onClick={onReset} className="text-[12px] font-medium text-[#57534d] hover:text-[#292524]">Вернуться к разделам</button>
              </div>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}

function DescriptionQueueEditorControls({
  filterId,
  prevDisabled,
  nextDisabled,
  onPrev,
  onNext,
}: {
  filterId: AuditQueueFilterId;
  prevDisabled: boolean;
  nextDisabled: boolean;
  onPrev: () => void;
  onNext: () => void;
}) {
  const label = OVERVIEW_FILTER_META[filterId].label.toLowerCase();
  const previousLabel = `Предыдущая позиция ${label}`;
  const nextLabel = `Следующая позиция ${label}`;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Tooltip label={previousLabel} side="top">
        <button
          type="button"
          aria-label={previousLabel}
          disabled={prevDisabled}
          onClick={onPrev}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <CaretLeft size={16} weight="bold" />
        </button>
      </Tooltip>
      <Tooltip label={nextLabel} side="top">
        <button
          type="button"
          aria-label={nextLabel}
          disabled={nextDisabled}
          onClick={onNext}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] disabled:cursor-not-allowed disabled:opacity-35 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <CaretRight size={16} weight="bold" />
        </button>
      </Tooltip>
    </div>
  );
}

function DescriptionQueueComplete({ filterId, onBack }: { filterId: AuditQueueFilterId; onBack: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center p-8">
      <div className="w-full max-w-[360px] rounded-[12px] border border-[#e7e5e4] bg-white px-5 py-4 shadow-[0_2px_8px_rgba(41,37,36,0.05)]">
        <h2 className="text-[16px] font-medium leading-6 text-[#292524]">
          {AUDIT_QUEUE_EMPTY_TITLE[filterId] ?? "В текущей выборке нет позиций"}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-[#79716b]">
          В текущей выборке больше нет позиций для этой очереди.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex h-8 items-center justify-center rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          Вернуться ко всем позициям
        </button>
      </div>
    </div>
  );
}

function OverviewWorkspace({
  filterId,
  onFilterChange,
  sectionScopeId,
  onSectionScopeChange,
  query,
  onQueryChange,
  onReturnToSections,
}: {
  filterId: OverviewFilterId;
  onFilterChange: (id: OverviewFilterId) => void;
  sectionScopeId: string | null;
  onSectionScopeChange: (id: string | null) => void;
  query: string;
  onQueryChange: (value: string) => void;
  onReturnToSections: (openItemId: string | null) => void;
}) {
  const { registerChange } = usePublish();
  const [items, setItems] = useState<CatalogItem[]>(catalogItems);
  const [queue, setQueue] = useState<DescriptionAuditQueueState | null>(null);
  const [queueUpsellByItem, setQueueUpsellByItem] = useState<CatalogUpsellStateByItem>({});
  const [descriptionSaveStateById, setDescriptionSaveStateById] = useState<Record<string, DescriptionSaveStatus>>({});
  const [priceSort, setPriceSort] = useState<PriceSortDirection>("none");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDialog, setBulkDialog] = useState<BulkDialog | null>(null);
  const [feedback, setFeedback] = useState("");
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const restoreScrollTopRef = useRef<number | null>(null);
  const descriptionSaveTimersRef = useRef<Record<string, number>>({});
  const scopeSection = catalogSections.find((section) => section.id === sectionScopeId) ?? null;
  const scopeIds = getSectionScopeIds(sectionScopeId);
  const inScope = (item: CatalogItem) => !scopeIds || scopeIds.has(item.sectionId);
  const filtered = getOverviewItems(filterId, items).filter(inScope);
  const normalizedQuery = query.trim().toLowerCase();
  const searched = normalizedQuery
    ? filtered.filter((item) =>
        [item.title, item.sectionName].some((value) => value.toLowerCase().includes(normalizedQuery)),
      )
    : filtered;
  const visible = sortItemsByPrice(searched, priceSort);
  const statusMeta = OVERVIEW_FILTER_META[filterId];
  const visibleIds = visible.map((item) => item.id);
  const visibleIdKey = visibleIds.join("|");
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const resetFilter = () => {
    onQueryChange("");
    onSectionScopeChange(null);
    setSelectedIds(new Set());
    onFilterChange("quick:all");
  };
  const clearSearch = () => {
    onQueryChange("");
  };
  const handlePriceSortChange = () => {
    setPriceSort((current) => getNextPriceSort(current));
  };
  const emptyTitle = statusMeta.emptyTitle;
  const emptyText = statusMeta.emptyText;

  const clearSelection = () => setSelectedIds(new Set());
  const showFeedback = (message: string) => {
    setFeedback(message);
  };
  const handleFilterChange = (id: OverviewFilterId) => {
    clearSelection();
    onFilterChange(id);
  };
  const handleSectionScopeChange = (id: string | null) => {
    clearSelection();
    onSectionScopeChange(id);
    if (queue) setQueue(null);
  };
  const handleQueryChange = (value: string) => {
    clearSelection();
    onQueryChange(value);
    if (queue) setQueue(null);
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
    setItems((current) => current.map((item) => (ids.has(item.id) ? update(item) : item)));
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
    setItems((current) => current.filter((item) => !selectedIds.has(item.id)));
    setBulkDialog(null);
    clearSelection();
    showFeedback("Позиции удалены из прототипа");
  };
  const buildQueueSnapshot = (
    nextFilterId: AuditQueueFilterId,
    entryItemId: string,
    snapshotQuery = query,
    snapshotSectionScopeId = sectionScopeId,
    scrollTop = scrollContainerRef.current?.scrollTop ?? 0,
    snapshotPriceSort = priceSort,
  ): DescriptionAuditQueueSnapshot => ({
    itemIds: getQueueItemIds(nextFilterId, items, snapshotQuery, snapshotSectionScopeId, snapshotPriceSort),
    filterId: nextFilterId,
    query: snapshotQuery,
    sectionScopeId: snapshotSectionScopeId,
    scrollTop,
    entryItemId,
    sort: snapshotPriceSort,
  });
  const startDescriptionQueue = (item: CatalogItem, nextFilterId: AuditQueueFilterId) => {
    const nextSnapshot = buildQueueSnapshot(nextFilterId, item.id);
    const currentId = nextSnapshot.itemIds.includes(item.id) ? item.id : nextSnapshot.itemIds[0] ?? null;
    setSelectedIds(new Set());
    setQueue({
      snapshot: { ...nextSnapshot, entryItemId: currentId ?? item.id },
      currentId,
      currentBucket: "remaining",
    });
  };
  const switchQueueFilter = (nextFilterId: AuditQueueFilterId) => {
    if (!queue || nextFilterId === queue.snapshot.filterId) return;
    const currentId = queue.currentId;
    const nextSnapshot = buildQueueSnapshot(
      nextFilterId,
      currentId ?? "",
      queue.snapshot.query,
      queue.snapshot.sectionScopeId,
      0,
      queue.snapshot.sort,
    );
    const nextCurrentId = currentId && nextSnapshot.itemIds.includes(currentId)
      ? currentId
      : nextSnapshot.itemIds[0] ?? null;
    setQueue({
      snapshot: { ...nextSnapshot, entryItemId: nextCurrentId ?? currentId ?? "" },
      currentId: nextCurrentId,
      currentBucket: "remaining",
    });
    onFilterChange(nextFilterId);
  };
  const prepareRowAction = (item: CatalogItem, action: string) => {
    if (action === "Открыть позицию") {
      startDescriptionQueue(item, filterId);
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
  const returnToOverview = () => {
    if (queue) {
      onFilterChange(queue.snapshot.filterId);
      onQueryChange(queue.snapshot.query);
      onSectionScopeChange(queue.snapshot.sectionScopeId);
      setPriceSort(queue.snapshot.sort);
      restoreScrollTopRef.current = queue.snapshot.scrollTop;
    }
    setQueue(null);
    setBulkDialog(null);
    clearSelection();
  };
  const selectQueueItem = (id: string, bucket: DescriptionAuditQueueState["currentBucket"]) => {
    setQueue((current) => current ? { ...current, currentId: id, currentBucket: bucket } : current);
  };
  const finishQueue = () => {
    setQueue((current) => current ? { ...current, currentId: null, currentBucket: "fixed" } : current);
  };
  const saveDescription = (item: CatalogItem, value: string) => {
    window.clearTimeout(descriptionSaveTimersRef.current[item.id]);
    setDescriptionSaveStateById((current) => ({ ...current, [item.id]: "saving" }));
    setItems((current) => current.map((candidate) =>
      candidate.id === item.id ? { ...candidate, description: value } : candidate
    ));
    descriptionSaveTimersRef.current[item.id] = window.setTimeout(() => {
      setItems((current) => current.map((candidate) =>
        candidate.id === item.id
          ? { ...candidate, description: value, hasDescription: descriptionHasContent(value) }
          : candidate
      ));
      setDescriptionSaveStateById((current) => ({ ...current, [item.id]: "saved" }));
      registerChange("catalog");
    }, 450);
  };
  const saveQueueMedia = (item: CatalogItem, previewUrl: string) => {
    setItems((current) => current.map((candidate) =>
      candidate.id === item.id ? { ...candidate, thumbnailUrl: candidate.thumbnailUrl ?? previewUrl } : candidate
    ));
    registerChange("catalog");
  };
  const setQueueAvailabilityMode = (item: CatalogItem, mode: AvailabilityMode) => {
    setItems((current) => current.map((candidate) => {
      if (candidate.id !== item.id || candidate.status === "archive") return candidate;
      if (mode === "unavailable") return { ...candidate, status: "stopped", scheduled: false };
      return { ...candidate, status: "active", scheduled: mode === "schedule" };
    }));
    registerChange("catalog");
  };
  const toggleQueueStop = (item: CatalogItem) => {
    setItems((current) => current.map((candidate) =>
      candidate.id === item.id
        ? { ...candidate, status: candidate.status === "stopped" ? "active" : "stopped" }
        : candidate
    ));
    registerChange("catalog");
  };
  const archiveQueueItem = (item: CatalogItem) => {
    setItems((current) => current.map((candidate) =>
      candidate.id === item.id ? { ...candidate, status: "archive" } : candidate
    ));
    showFeedback("Позиция перенесена в архив");
  };
  const restoreQueueItem = (item: CatalogItem) => {
    setItems((current) => current.map((candidate) =>
      candidate.id === item.id ? { ...candidate, status: "active" } : candidate
    ));
    showFeedback("Позиция восстановлена");
  };

  useEffect(() => {
    clearSelection();
  }, [filterId]);

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
        clearSelection();
        setBulkDialog(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  useEffect(() => {
    return () => {
      Object.values(descriptionSaveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    if (queue || restoreScrollTopRef.current == null) return;
    const scrollTop = restoreScrollTopRef.current;
    restoreScrollTopRef.current = null;
    window.requestAnimationFrame(() => {
      if (scrollContainerRef.current) scrollContainerRef.current.scrollTop = scrollTop;
    });
  }, [queue, filterId, query, sectionScopeId]);

  if (queue) {
    const repairMode = isRepairQueueFilter(queue.snapshot.filterId);
    const currentItem = queue.currentId ? items.find((item) => item.id === queue.currentId) ?? null : null;
    const remaining = queue.snapshot.itemIds.filter((id) => {
      const item = items.find((candidate) => candidate.id === id);
      return item && repairMode ? FILTER_PREDICATES[queue.snapshot.filterId](item) : false;
    }).length;
    const prevId = getAdjacentUnfixedId(queue.snapshot.itemIds, items, queue.snapshot.filterId, queue.currentId, -1);
    const nextId = getAdjacentUnfixedId(queue.snapshot.itemIds, items, queue.snapshot.filterId, queue.currentId, 1);
    const currentFixed = Boolean(repairMode && currentItem && !FILTER_PREDICATES[queue.snapshot.filterId](currentItem));
    const canFinish = repairMode && currentFixed && remaining === 0;
    const saveStatus = currentItem ? descriptionSaveStateById[currentItem.id] : undefined;
    const editorContext = getQueueEditorContext(queue.snapshot.filterId);
    const byId = new Map(items.map((item) => [item.id, item]));
    const remainingIds = queue.snapshot.itemIds.filter((id) => {
      const item = byId.get(id);
      if (!item) return false;
      if (!repairMode) return true;
      if (id === queue.currentId && queue.currentBucket === "remaining") return true;
      return FILTER_PREDICATES[queue.snapshot.filterId](item);
    });
    const fixedIds = new Set(queue.snapshot.itemIds.filter((id) => {
      const item = byId.get(id);
      if (!item || !repairMode) return false;
      if (id === queue.currentId && queue.currentBucket === "remaining") return false;
      return !FILTER_PREDICATES[queue.snapshot.filterId](item);
    }));
    const panelItems = [...remainingIds, ...fixedIds].map((id) => byId.get(id)).filter((item): item is CatalogItem => Boolean(item));
    const queueScopeIds = getSectionScopeIds(queue.snapshot.sectionScopeId);
    const unsearchedCount = getOverviewItems(queue.snapshot.filterId, items).filter((item) => !queueScopeIds || queueScopeIds.has(item.sectionId)).length;

    return (
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbf9]">
        <div className="flex min-h-0 flex-1">
          <UnifiedFlatCatalogPanel
            filterId={queue.snapshot.filterId}
            scopeSectionId={queue.snapshot.sectionScopeId}
            query={queue.snapshot.query}
            count={unsearchedCount}
            items={panelItems}
            selectedItemId={queue.currentId}
            fixedIds={fixedIds}
            repairProgress={repairMode ? { remaining, total: queue.snapshot.itemIds.length } : undefined}
            tableActive={false}
            onFilterChange={switchQueueFilter}
            onScopeChange={handleSectionScopeChange}
            onQueryChange={handleQueryChange}
            onReset={() => onReturnToSections(queue.currentId)}
            onOpenTable={returnToOverview}
            onSelectItem={(item, fixed) => selectQueueItem(item.id, fixed ? "fixed" : "remaining")}
          />
          {currentItem ? (
            <PositionEditor
              item={currentItem}
              allItems={items}
              upsell={queueUpsellByItem[currentItem.id] ?? {}}
              onUpsellChange={(next) => setQueueUpsellByItem((current) => ({ ...current, [currentItem.id]: next }))}
              stopBusy={false}
              onArchiveItem={archiveQueueItem}
              onRestoreItem={restoreQueueItem}
              onMoveItem={(targetItem) => showFeedback(`Переместить «${targetItem.title}»: placeholder`)}
              onToggleStop={toggleQueueStop}
              onSetAvailabilityMode={setQueueAvailabilityMode}
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
              onDescriptionChange={saveDescription}
              onMediaAdded={saveQueueMedia}
              headerMeta={
                <DescriptionQueueEditorControls
                  filterId={queue.snapshot.filterId}
                  prevDisabled={!prevId}
                  nextDisabled={!nextId && !canFinish}
                  onPrev={() => {
                    if (prevId) selectQueueItem(prevId, "remaining");
                  }}
                  onNext={() => {
                    if (nextId) selectQueueItem(nextId, "remaining");
                    else if (canFinish) finishQueue();
                  }}
                />
              }
            />
          ) : (
            <DescriptionQueueComplete filterId={queue.snapshot.filterId} onBack={returnToOverview} />
          )}
          {saveStatus === "saving" && (
            <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100003] -translate-x-1/2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">
              Сохраняется
            </div>
          )}
          {feedback && <SelectionFeedback message={feedback} />}
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <UnifiedFlatCatalogPanel
          filterId={filterId}
          scopeSectionId={sectionScopeId}
          query={query}
          count={filtered.length}
          items={visible}
          selectedItemId={null}
          tableActive
          onFilterChange={handleFilterChange}
          onScopeChange={handleSectionScopeChange}
          onQueryChange={handleQueryChange}
          onReset={() => onReturnToSections(null)}
          onOpenTable={() => {}}
          onSelectItem={(item) => startDescriptionQueue(item, filterId)}
        />
        <div ref={scrollContainerRef} className="min-w-0 flex-1 overflow-y-auto overflow-x-auto px-6 pb-10">
          <div className="mx-auto w-full max-w-[800px] min-w-[620px]">
            <div className="pt-[14px]">
              <OverviewStatusBar
                filterId={filterId}
                count={visible.length}
                query={query}
                scopeName={scopeSection?.name}
                onStartSequential={isRepairQueueFilter(filterId) && visible[0] ? () => startDescriptionQueue(visible[0], filterId) : undefined}
              />
            </div>
            <div className="mt-[14px]">
              {visible.length === 0 ? (
                <div className="rounded-[12px] border border-dashed border-[#e7e5e4] bg-[#fafaf9] p-6">
                  <div className="flex flex-col gap-4">
                    <div>
                      <p className="text-[16px] font-medium leading-[1.4] text-[#44403b]">
                        {emptyTitle}
                      </p>
                      <p className="mt-2 text-[14px] leading-[1.4] text-[#79716b]">
                        {emptyText}
                      </p>
                    </div>
                    {filterId === "quick:all" && !query.trim() && !scopeSection ? (
                      <button
                        type="button"
                        className="inline-flex h-[32px] items-center justify-center gap-1.5 self-start rounded-[10px] bg-[#292524] px-[10px] text-[13px] font-medium text-white transition hover:bg-[#44403b]"
                      >
                        <Plus size={14} />
                        Добавить позицию
                      </button>
                    ) : query.trim() ? (
                      <button
                        type="button"
                        onClick={clearSearch}
                        className="inline-flex h-[32px] items-center justify-center self-start rounded-[10px] border border-[#e7e5e4] bg-white px-[10px] text-[13px] font-medium text-[#57534d] transition hover:bg-[#fafaf9]"
                      >
                        Очистить поиск
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={resetFilter}
                        className="inline-flex h-[32px] items-center justify-center self-start rounded-[10px] border border-[#e7e5e4] bg-white px-[10px] text-[13px] font-medium text-[#57534d] transition hover:bg-[#fafaf9]"
                      >
                        Показать все позиции
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div>
                  <TableHeaderRow
                    query={query}
                    onQueryChange={handleQueryChange}
                    checked={allVisibleSelected}
                    indeterminate={!allVisibleSelected && someVisibleSelected}
                    onSelectAll={setVisibleSelected}
                    priceSort={priceSort}
                    onPriceSortChange={handlePriceSortChange}
                  />
                  <div className="pt-2">
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
                          onOpenPlaceholder={(title, text) => setBulkDialog({ type: "placeholder", title, text })}
                          onOpenDelete={() => setBulkDialog({ type: "delete" })}
                        />
                      </div>
                    )}
                    {visible.map((item) => (
                      <AuditDishRow
                        key={item.id}
                        item={item}
                        showSectionMeta
                        selected={selectedIds.has(item.id)}
                        selectionMode={selectedIds.size > 0}
                        onSelectedChange={setItemSelected}
                        onAction={prepareRowAction}
                      />
                    ))}
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
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function RecommendationsContextWorkspace() {
  const [selectedContextId, setSelectedContextId] = useState(SECTIONS_WITH_ITEMS[0]?.id ?? "all");

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <CatalogContextPanel selectedId={selectedContextId} onSelect={setSelectedContextId} />
        <SectionEmptyState
          sectionName={SECTIONS_WITH_ITEMS.find((section) => section.id === selectedContextId)?.name ?? "Рекомендации"}
        />
      </div>
    </main>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CatalogWorkspace({
  catalogPhase,
  catalogTab,
  overviewFilterId,
  onOverviewFilterChange,
  onFlatModeChange,
  onAdvancePhase,
}: CatalogWorkspaceProps) {
  const [createdSectionName, setCreatedSectionName] = useState(CREATED_SECTION.name);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const sections: TreeSection[] =
    catalogPhase === "empty"
      ? []
      : catalogPhase === "has-sections"
        ? [{ id: CREATED_SECTION.id, name: createdSectionName, emoji: CREATED_SECTION.emoji }]
        : buildSectionTree(catalogSections);
  const overviewSectionScopeParam = typeof window === "undefined" ? null : new URLSearchParams(window.location.search).get("overviewSectionId");
  const overviewSectionScopeId = overviewSectionScopeParam && catalogSections.some((section) => section.id === overviewSectionScopeParam)
    ? overviewSectionScopeParam
    : null;
  const [viewMode, setViewMode] = useState<CatalogViewMode>(catalogTab === "overview" ? overviewFilterId : "sections");
  const [sectionScopeId, setSectionScopeId] = useState<string | null>(overviewSectionScopeId);
  const [flatQuery, setFlatQuery] = useState("");
  const [retainedItemId, setRetainedItemId] = useState<string | null>(null);
  const flatModeActiveRef = useRef(viewMode !== "sections");
  const setFlatModeActive = (flat: boolean) => {
    flatModeActiveRef.current = flat;
    onFlatModeChange(flat);
  };
  useEffect(() => {
    if (flatModeActiveRef.current) onFlatModeChange(true);
    return () => {
      if (flatModeActiveRef.current) onFlatModeChange(false);
    };
  }, []);
  const changeViewMode = (mode: CatalogViewMode) => {
    setViewMode(mode);
    const flat = mode !== "sections";
    setFlatModeActive(flat);
    if (flat) onOverviewFilterChange(mode);
  };
  const returnToSections = (openItemId: string | null) => {
    setFlatQuery("");
    setRetainedItemId(openItemId);
    setViewMode("sections");
    setFlatModeActive(false);
  };
  const workspace = catalogPhase === "empty" && catalogTab === "sections" ? (
      <CatalogEmptyState onCreateSection={() => setSectionDialogOpen(true)} />
    ) : catalogPhase === "empty" ? (
      <CatalogEmptyState onCreateSection={() => setSectionDialogOpen(true)} />
    ) : catalogTab === "upsell" ? (
      <RecommendationsContextWorkspace />
    ) : viewMode !== "sections" ? (
      <OverviewWorkspace
        filterId={viewMode}
        onFilterChange={(id) => {
          setViewMode(id);
          setFlatModeActive(true);
          onOverviewFilterChange(id);
        }}
        sectionScopeId={sectionScopeId}
        onSectionScopeChange={setSectionScopeId}
        query={flatQuery}
        onQueryChange={setFlatQuery}
        onReturnToSections={returnToSections}
      />
    ) : catalogPhase === "has-items" ? (
      <PopulatedWorkspace
        sections={sections}
        scopeSectionId={sectionScopeId}
        initialSelectedItemId={retainedItemId}
        onScopeChange={setSectionScopeId}
        onViewModeChange={changeViewMode}
      />
    ) : (
      <EmptyCatalog
        sections={sections}
      />
    );

  return (
    <TooltipProvider delayDuration={200}>
      {workspace}
      {sectionDialogOpen && (
        <AddSectionDialog
          onCreate={(name) => {
            setCreatedSectionName(name);
            setSectionDialogOpen(false);
            onAdvancePhase("has-sections");
          }}
          onCancel={() => setSectionDialogOpen(false)}
        />
      )}
    </TooltipProvider>
  );
}
