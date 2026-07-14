import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  Archive,
  ArrowCounterClockwise,
  ArrowLeft,
  CaretDown,
  CaretRight,
  CheckCircle,
  Clock,
  Dot,
  DotsThreeVertical,
  DotsSixVertical,
  Fire,
  ForkKnife,
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
  Trash,
  XCircle,
} from "@phosphor-icons/react";
import { TranslatableField } from "@/components/workspace/translatable-field";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import type { Category } from "@/data/mock-data";
import { buildSectionTree, catalogItems, catalogSections, formatPrice } from "@/data/catalog";
import type { CatalogItem } from "@/data/catalog";
import { cn } from "@/lib/utils";

export type CatalogPhase = "empty" | "has-sections" | "has-items";

export type CatalogTab = "sections" | "overview" | "upsell";
const CATALOG_TABS: { id: CatalogTab; label: string; count?: number }[] = [
  { id: "sections", label: "Разделы" },
  { id: "upsell", label: "Рекомендации" },
  { id: "overview", label: "Все позиции", count: catalogItems.length },
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
  onAdvancePhase: (next: "has-sections" | "has-items") => void;
};

/** Section node for the left panels: real sections carry imageUrl, mock/created ones an emoji. */
type TreeSection = {
  id: string;
  parentId?: string | null;
  name: string;
  imageUrl?: string | null;
  emoji?: string;
  sortOrder?: number;
  status?: SectionStatus;
  children?: TreeSection[];
};
type SectionStatus = "active" | "archive";
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
    label: "Скоро будут",
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

function CatalogFiltersPanel({
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

const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: "basic", label: "Основное" },
  { id: "promo", label: "Допродажа" },
  { id: "options", label: "Опции" },
  { id: "availability", label: "Доступность" },
  { id: "display", label: "Отображение" },
];

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

function AddInlineButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-1 rounded-md px-1 py-0.5 text-[13px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524]"
    >
      <Plus size={14} />
      {label}
    </button>
  );
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
const ALLOWED_DESCRIPTION_TAGS = new Set(["P", "BR", "STRONG", "EM", "S", "UL", "LI"]);
const DESCRIPTION_TAG_ALIASES: Record<string, string> = {
  B: "strong",
  I: "em",
  STRIKE: "s",
  DEL: "s",
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripHtmlTags(value: string) {
  if (!value) return "";
  const div = document.createElement("div");
  div.innerHTML = value;
  return div.textContent ?? "";
}

function sanitizeDescriptionHtml(value: string) {
  if (!value.trim()) return "";
  const parser = new DOMParser();
  const source = /<\/?[a-z][\s\S]*>/i.test(value) ? value : `<p>${escapeHtml(value).replace(/\n/g, "<br>")}</p>`;
  const doc = parser.parseFromString(source, "text/html");

  const cleanNode = (node: Node): Node | DocumentFragment | null => {
    if (node.nodeType === Node.TEXT_NODE) {
      return document.createTextNode(node.textContent ?? "");
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return null;

    const element = node as HTMLElement;
    const tagName = element.tagName.toUpperCase();
    if (["IMG", "VIDEO", "IFRAME", "OBJECT", "EMBED", "SCRIPT", "STYLE"].includes(tagName)) return null;

    const normalizedTag = DESCRIPTION_TAG_ALIASES[tagName] ?? tagName.toLowerCase();
    const canKeepTag = ALLOWED_DESCRIPTION_TAGS.has(normalizedTag.toUpperCase());
    const container = canKeepTag ? document.createElement(normalizedTag) : document.createDocumentFragment();

    element.childNodes.forEach((child) => {
      const cleaned = cleanNode(child);
      if (cleaned) container.appendChild(cleaned);
    });

    return container;
  };

  const result = document.createElement("div");
  doc.body.childNodes.forEach((child) => {
    const cleaned = cleanNode(child);
    if (cleaned) result.appendChild(cleaned);
  });

  return result.innerHTML
    .replace(/<p><\/p>/g, "")
    .replace(/<li><\/li>/g, "");
}

function getDescriptionTextLength(html: string) {
  const root = document.createElement("div");
  root.innerHTML = sanitizeDescriptionHtml(html);
  let text = "";

  const walk = (node: Node) => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent ?? "";
      return;
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return;
    const element = node as HTMLElement;
    if (element.tagName === "BR") {
      text += "\n";
      return;
    }
    element.childNodes.forEach(walk);
    if (["P", "LI"].includes(element.tagName)) text += "\n";
  };

  root.childNodes.forEach(walk);
  return text.replace(/\n$/, "").length;
}

function RichTextToolbarButton({
  label,
  active,
  onMouseDown,
  children,
}: {
  label: string;
  active: boolean;
  onMouseDown: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onMouseDown={(event) => {
        event.preventDefault();
        onMouseDown();
      }}
      className={cn(
        "flex h-7 w-7 items-center justify-center rounded-[7px] text-[13px] font-semibold leading-none text-[#57534d] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        active && "bg-[#efefeb] text-[#292524] shadow-[inset_0_0_0_1px_rgba(41,37,36,0.08)]",
      )}
    >
      {children}
    </button>
  );
}

function DescriptionRichTextEditor({
  initialValue,
  placeholder,
}: {
  initialValue: string;
  placeholder: string;
}) {
  const editorRef = useRef<HTMLDivElement | null>(null);
  const [initialHtml, setInitialHtml] = useState(() => sanitizeDescriptionHtml(initialValue));
  const [charCount, setCharCount] = useState(() => getDescriptionTextLength(initialValue));
  const [activeMarks, setActiveMarks] = useState({ bold: false, italic: false, strike: false, list: false });
  const overLimit = charCount > DESCRIPTION_LIMIT;
  const counterTone = overLimit
    ? "text-[#b42318]"
    : charCount >= DESCRIPTION_LIMIT
      ? "text-[#9f1239]"
      : charCount >= 270
        ? "text-[#b45309]"
        : "text-[#79716b]";

  useEffect(() => {
    const nextHtml = sanitizeDescriptionHtml(initialValue);
    setInitialHtml(nextHtml);
    setCharCount(getDescriptionTextLength(nextHtml));
    if (editorRef.current) editorRef.current.innerHTML = nextHtml;
  }, [initialValue]);

  const syncFromEditor = (sanitize = false) => {
    const nextHtml = sanitizeDescriptionHtml(editorRef.current?.innerHTML ?? "");
    if (sanitize && editorRef.current && editorRef.current.innerHTML !== nextHtml) {
      editorRef.current.innerHTML = nextHtml;
    }
    setCharCount(getDescriptionTextLength(nextHtml));
  };

  const refreshActiveMarks = () => {
    if (!editorRef.current || !document.activeElement || !editorRef.current.contains(document.activeElement)) return;
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0 || !selection.isCollapsed) {
      setActiveMarks({ bold: false, italic: false, strike: false, list: false });
      return;
    }
    setActiveMarks({
      bold: document.queryCommandState("bold"),
      italic: document.queryCommandState("italic"),
      strike: document.queryCommandState("strikeThrough"),
      list: document.queryCommandState("insertUnorderedList"),
    });
  };

  useEffect(() => {
    document.addEventListener("selectionchange", refreshActiveMarks);
    return () => document.removeEventListener("selectionchange", refreshActiveMarks);
  }, []);

  const applyCommand = (command: "bold" | "italic" | "strikeThrough" | "insertUnorderedList") => {
    editorRef.current?.focus();
    document.execCommand(command);
    syncFromEditor();
    window.setTimeout(refreshActiveMarks, 0);
  };

  const insertHtml = (nextHtml: string) => {
    document.execCommand("insertHTML", false, nextHtml);
    syncFromEditor();
  };

  const handleBeforeInput = (event: React.FormEvent<HTMLDivElement> & { nativeEvent: InputEvent }) => {
    const inputEvent = event.nativeEvent;
    if (!inputEvent.data || inputEvent.inputType.startsWith("delete")) return;
    if (!overLimit && charCount + inputEvent.data.length <= DESCRIPTION_LIMIT) return;
    event.preventDefault();
  };

  const handlePaste = (event: React.ClipboardEvent<HTMLDivElement>) => {
    event.preventDefault();
    const htmlData = event.clipboardData.getData("text/html");
    const plainData = event.clipboardData.getData("text/plain");
    const sanitized = sanitizeDescriptionHtml(htmlData || plainData);
    const remaining = DESCRIPTION_LIMIT - charCount;
    if (remaining <= 0 && !overLimit) return;

    if (getDescriptionTextLength(sanitized) <= remaining || overLimit) {
      insertHtml(sanitized);
      return;
    }

    const plain = stripHtmlTags(sanitized).slice(0, Math.max(0, remaining));
    if (plain) insertHtml(escapeHtml(plain).replace(/\n/g, "<br>"));
  };

  return (
    <div>
      <div className="mb-1.5 text-[13px] leading-5 text-[#303030]">Описание</div>
      <div
        className={cn(
          "overflow-hidden rounded-[8px] border bg-white shadow-[0_1px_2px_rgba(0,0,0,0.1)] transition focus-within:border-[#c7c2bd]",
          overLimit ? "border-[#fda29b]" : "border-[#e5e5e5]",
        )}
      >
        <div className="flex h-8 items-center gap-0.5 border-b border-[#e5e5e5] px-1.5">
          <RichTextToolbarButton label="Жирный" active={activeMarks.bold} onMouseDown={() => applyCommand("bold")}>
            B
          </RichTextToolbarButton>
          <RichTextToolbarButton label="Курсив" active={activeMarks.italic} onMouseDown={() => applyCommand("italic")}>
            <span className="italic">I</span>
          </RichTextToolbarButton>
          <RichTextToolbarButton label="Зачёркнутый" active={activeMarks.strike} onMouseDown={() => applyCommand("strikeThrough")}>
            <span className="line-through">S</span>
          </RichTextToolbarButton>
          <RichTextToolbarButton label="Маркированный список" active={activeMarks.list} onMouseDown={() => applyCommand("insertUnorderedList")}>
            •
          </RichTextToolbarButton>
          <div className={cn("ml-auto text-[12px] leading-5", counterTone)}>
            {charCount} / {DESCRIPTION_LIMIT}
          </div>
        </div>
        <div
          ref={(element) => {
            editorRef.current = element;
            if (element && !element.dataset.richTextInitialized) {
              element.innerHTML = initialHtml;
              element.dataset.richTextInitialized = "true";
            }
          }}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-label="Описание"
          aria-multiline="true"
          data-placeholder={placeholder}
          onInput={() => syncFromEditor()}
          onBlur={() => syncFromEditor(true)}
          onKeyUp={refreshActiveMarks}
          onMouseUp={refreshActiveMarks}
          onBeforeInput={handleBeforeInput}
          onPaste={handlePaste}
          className="min-h-[96px] px-3 py-2 text-[13px] leading-5 text-[#292524] outline-none empty:before:pointer-events-none empty:before:text-[#a8a29e] empty:before:content-[attr(data-placeholder)] [&_em]:italic [&_li]:ml-4 [&_li]:list-disc [&_p]:my-0 [&_s]:line-through [&_strong]:font-semibold [&_ul]:my-0 [&_ul]:pl-2"
        />
      </div>
      {overLimit && (
        <div className="mt-1.5 text-[12px] leading-5 text-[#b42318]">
          Сократите описание до 300 символов
        </div>
      )}
    </div>
  );
}

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
      <BasicMediaStrip
        item={item}
        media={media}
        onAddPhotoFile={onAddPhotoFile}
        onAddVideoFile={onAddVideoFile}
        onReorder={onReorderMedia}
        onRemove={onRemoveMedia}
      />

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

      <DescriptionRichTextEditor
        key={`desc-${item.id}`}
        initialValue={item.description}
        placeholder="Кратко опишите состав, вкус или способ подачи"
      />
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

function PromoSectionBlock({ title, empty, addLabel, chips, note }: {
  title: string;
  empty: string;
  addLabel: string;
  chips?: GuestProperty[];
  note?: string;
}) {
  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-[13px] font-semibold text-[#292524]">{title}</h3>
        <AddInlineButton label={addLabel} onClick={() => {}} />
      </div>
      {note ? (
        <p className="text-[13px] text-[#57534d]">{note}</p>
      ) : chips && chips.length > 0 ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {chips.map((chip) => (
            <AttributeBadge key={chip.label} property={chip} />
          ))}
        </div>
      ) : (
        <p className="text-[13px] text-zinc-400">{empty}</p>
      )}
    </div>
  );
}

function PromoTab({ item }: { item: CatalogItem }) {
  return (
    <div className="space-y-5">
      <PromoSectionBlock
        title="Рекомендации"
        empty="Нет рекомендаций"
        addLabel="Добавить рекомендацию"
        note={
          item.recommendationsCount > 0
            ? `${item.recommendationsCount} ${plural(item.recommendationsCount, "рекомендация настроена", "рекомендации настроено", "рекомендаций настроено")}`
            : undefined
        }
      />
      <div className="h-px bg-[#f0efe9]" />
      <PromoSectionBlock
        title="Стикеры"
        empty="Нет стикеров"
        addLabel="Добавить стикер"
        chips={item.guestLabels.map((label) => ({ label, icon: "label" }))}
      />
      <div className="h-px bg-[#f0efe9]" />
      <PromoSectionBlock
        title="Теги"
        empty="Нет тегов"
        addLabel="Добавить тег"
        chips={item.tags.map((tag) => ({ label: tag, icon: "tag" }))}
      />
    </div>
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
  const mode = getAvailabilityMode(item);
  const options: { id: AvailabilityMode; title: string; description: string }[] = [
    {
      id: "always",
      title: "Можно заказать",
      description: "Доступно для заказа в любое время",
    },
    {
      id: "unavailable",
      title: "Нельзя заказать",
      description: "Гости не смогут добавить позицию в заказ",
    },
    {
      id: "schedule",
      title: "По расписанию",
      description: "Доступно только в указанные дни и часы",
    },
  ];
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
                  const errorId = `${item.id}-${dayKey}-${index}-time-error`;
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
        aria-label="Доступность позиции"
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
                onClick={() => onSetAvailabilityMode(item, option.id)}
                disabled={option.id === "unavailable" && stopBusy}
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
              {option.id === "unavailable" && selected && (
                <div className="px-4 pb-4">
                  {renderNestedDisplay(
                    "В меню:",
                    unavailableDisplayMode,
                    onUnavailableDisplayModeChange,
                    "Позиция не будет отображаться в меню, пока недоступна",
                    "Позиция останется в меню с отметкой «Скоро будет»",
                  )}
                </div>
              )}
              {option.id === "schedule" && selected && (
                <div className="px-4 pb-4">
                  {renderNestedDisplay(
                    "Вне расписания:",
                    outsideScheduleMode,
                    onOutsideScheduleModeChange,
                    "Позиция не будет отображаться в меню вне расписания",
                    "Позиция останется в меню с отметкой «Скоро будет» вне расписания",
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
}: {
  item: CatalogItem;
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
}) {
  const [activeTab, setActiveTab] = useState<EditorTab>("basic");
  const [media, setMedia] = useState<MediaEntry[]>(() => getInitialMedia(item));
  const [basePriceText, setBasePriceText] = useState(item.price ? formatMoneyInput(item.price) : "");
  const initialEditorWeightUnit = item.weightLabel?.replace(/[\d.,\s]/g, "").trim() || "г";
  const [weightUnit, setWeightUnit] = useState(initialEditorWeightUnit);
  const [discountOpen, setDiscountOpen] = useState(item.hasDiscount);
  const [discountAutofocusKey, setDiscountAutofocusKey] = useState(0);
  const [kbjuOpen, setKbjuOpen] = useState(item.nutritionFilledCount > 0);

  useEffect(() => {
    setMedia(getInitialMedia(item));
    setBasePriceText(item.price ? formatMoneyInput(item.price) : "");
    setWeightUnit(item.weightLabel?.replace(/[\d.,\s]/g, "").trim() || "г");
    setDiscountOpen(item.hasDiscount);
    setDiscountAutofocusKey(0);
    setKbjuOpen(item.nutritionFilledCount > 0);
  }, [item]);

  const addPhotoFile = (file: File) => {
    const previewUrl = URL.createObjectURL(file);
    setMedia((m) => [...m, { id: `photo-${Date.now()}`, kind: "photo", fileName: file.name, previewUrl }]);
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
      <div className="min-w-0 flex-1 overflow-y-auto p-6 pt-0">
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
            <StopQuickActionButton item={item} busy={stopBusy} onToggleStop={onToggleStop} />
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label="Действия с позицией"
                  title="Действия с позицией"
                  className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
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

          {/* Карточка редактора: табы + контент таба */}
          <div className="rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
            <div className="flex items-center gap-2 border-b border-[#e7e5e4] px-3">
              {EDITOR_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cn(
                    "-mb-px flex items-center gap-2 border-b px-1 py-3.5 text-[13px] transition",
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

            <div className="px-4 pb-4 pt-5">
              {activeTab === "basic" && (
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
                />
              )}
              {activeTab === "promo" && <PromoTab item={item} />}
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

function SectionPositionNav({
  sectionId,
  sectionName,
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
  stopBusyIds,
}: {
  sectionId: string | null;
  sectionName: string;
  items: CatalogItem[];
  archiveOpen: boolean;
  selectedItemId: string | null;
  onBackToSections: () => void;
  onSelectSection: (id: string) => void;
  onSelectItem: (id: string) => void;
  onAddPosition: () => void;
  onSectionAction: (action: string) => void;
  onArchiveOpenChange: (open: boolean) => void;
  onRestoreItem: (item: CatalogItem) => void;
  onToggleStop: (item: CatalogItem) => void;
  stopBusyIds: Set<string>;
}) {
  const [sectionQuery, setSectionQuery] = useState("");
  const selectedRowRef = useRef<HTMLButtonElement | null>(null);
  const normalizedSectionQuery = sectionQuery.trim().toLowerCase();
  const visibleSections = catalogSections.filter((section) =>
    section.name.toLowerCase().includes(normalizedSectionQuery),
  );
  const activeSection = catalogSections.find((section) => section.id === sectionId) ?? null;
  const activeItems = items.filter((item) => item.status !== "archive");
  const archivedItems = items.filter((item) => item.status === "archive");

  useEffect(() => {
    if (!selectedItemId || !archiveOpen) return;
    const timeout = window.setTimeout(() => {
      selectedRowRef.current?.scrollIntoView({ block: "nearest" });
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [archiveOpen, selectedItemId, archivedItems.length]);

  const renderPositionRow = (item: CatalogItem, archived = false) => {
    const active = item.id === selectedItemId;
    const stopped = item.status === "stopped";
    const canToggleStop = !archived && (item.status === "active" || item.status === "stopped");
    const stopBusy = stopBusyIds.has(item.id);
    const stopActionLabel = stopped ? "Вернуть в продажу" : "Поставить на стоп";
    return (
      <button
        key={item.id}
        ref={active ? selectedRowRef : undefined}
        type="button"
        onClick={() => onSelectItem(item.id)}
        className={cn(
          "group flex h-8 w-full items-center gap-2 rounded-[8px] border px-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
          active
            ? "border-[#e7e5e4] bg-white shadow-[0_2px_6px_rgba(41,37,36,0.13)]"
            : "border-transparent hover:bg-[#f7f6f2]",
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
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="flex h-8 w-full items-center gap-2 rounded-[10px] bg-[#f6f6f1] px-2 text-left text-[#292524] transition hover:bg-[#efefe8]"
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
              className="z-[100002] w-[280px] rounded-[12px] border border-[#e7e5e4] bg-white p-2 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
            >
              <label className="mb-2 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-white px-2 text-[#a8a29e]">
                <MagnifyingGlass size={14} />
                <input
                  value={sectionQuery}
                  onChange={(event) => setSectionQuery(event.target.value)}
                  placeholder="Найти раздел"
                  className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
                />
              </label>
              <div className="max-h-[320px] overflow-y-auto">
                {visibleSections.map((section) => {
                  const active = section.id === sectionId;
                  const count = catalogItems.filter((item) => item.sectionId === section.id).length;
                  return (
                    <DropdownMenu.Item
                      key={section.id}
                      onSelect={() => onSelectSection(section.id)}
                      className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg px-2 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                    >
                      <span className="w-4 shrink-0 text-center text-[12px] text-[#2563eb]">{active ? "✓" : ""}</span>
                      <span className="min-w-0 flex-1 truncate">{section.name}</span>
                      <span className="shrink-0 text-[12px] text-[#a8a29e]">{count}</span>
                    </DropdownMenu.Item>
                  );
                })}
                {visibleSections.length === 0 && (
                  <div className="px-2 py-3 text-[13px] text-[#79716b]">Разделы не найдены</div>
                )}
              </div>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <button
          type="button"
          onClick={onAddPosition}
          className="mt-3 flex h-8 min-w-0 items-center gap-2 rounded-[8px] px-1 text-left text-[13px] font-normal leading-5 text-[#44403b] transition hover:bg-[#f1f1ea] hover:text-[#292524]"
        >
          <PlusCircle size={16} />
          Добавить позицию
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-4 pt-3">
        {activeItems.length === 0 && archivedItems.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#e7e5e4] bg-white/60 px-3 py-4 text-[13px] leading-5 text-[#79716b]">
            Позиции не найдены
          </div>
        ) : (
          <div className="space-y-1.5">
            {activeItems.map((item) => renderPositionRow(item))}
            {archivedItems.length > 0 && (
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onArchiveOpenChange(!archiveOpen)}
                  className="flex h-7 w-full items-center rounded-[8px] px-1.5 text-left text-[12px] font-medium leading-5 text-[#a8a29e] transition hover:bg-[#f7f6f2] hover:text-[#79716b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <span className="min-w-0 flex-1 truncate">Архивные · {archivedItems.length}</span>
                  <CaretRight size={13} className={cn("shrink-0 transition", archiveOpen && "rotate-90")} />
                </button>
                {archiveOpen && (
                  <div className="mt-1.5 space-y-1.5">
                    {archivedItems.map((item) => renderPositionRow(item, true))}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button
              type="button"
              className="sr-only"
              aria-label="Действия с разделом"
            />
          </DropdownMenu.Trigger>
          <DropdownContent align="end">
            <DropdownActionItem onSelect={onAddPosition}>Добавить позицию</DropdownActionItem>
            <DropdownActionItem onSelect={() => onSectionAction("Добавить подраздел")}>Добавить подраздел</DropdownActionItem>
            <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
            <DropdownActionItem onSelect={() => onSectionAction("Изменить раздел")}>Изменить раздел</DropdownActionItem>
            <DropdownActionItem onSelect={() => onSectionAction("Скрыть раздел")}>Скрыть раздел</DropdownActionItem>
            <DropdownActionItem tone="danger" onSelect={() => onSectionAction("Архивировать раздел")}>Архивировать раздел</DropdownActionItem>
          </DropdownContent>
        </DropdownMenu.Root>
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
}: {
  sections: TreeSection[];
}) {
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
  const firstSectionId = preferredSectionId;
  const firstItemId = preferredItemId;
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(firstSectionId);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(firstItemId);
  // Явный режим: обзор раздела ↔ редактор позиции. Раньше режим выводился из
  // selectedItem != null, из-за чего смена раздела (обнулявшая позицию) выкидывала
  // из редактора и ломала пустой раздел в editor mode.
  const [editing, setEditing] = useState(Boolean(firstItemId));
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
  const [deletedItemIds, setDeletedItemIds] = useState<Set<string>>(new Set());
  const [deletedSectionIds, setDeletedSectionIds] = useState<Set<string>>(new Set());
  const [pendingPermanentDelete, setPendingPermanentDelete] = useState<CatalogItem | null>(null);
  const [pendingSectionDelete, setPendingSectionDelete] = useState<SectionDeleteDialogState | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [sectionArchiveOpen, setSectionArchiveOpen] = useState(false);
  const [stopBusyIds, setStopBusyIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState("");

  const allSections = catalogSections
    .filter((section) => !deletedSectionIds.has(section.id))
    .map<TreeSection>((section) => ({
      ...section,
      status: sectionStatusOverrides[section.id] ?? "active",
    }));
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
      return {
        ...item,
        status: status ?? item.status,
        scheduled: scheduled ?? item.scheduled,
      };
    });
  const section = allSections.find((s) => s.id === selectedSectionId) ?? null;
  const sectionItems = allItems.filter((item) => item.sectionId === selectedSectionId);
  const activeSectionItems = sectionItems.filter((item) => item.status !== "archive");
  const selectedItem = selectedItemId
    ? allItems.find((item) => item.id === selectedItemId) ?? null
    : null;

  const rememberItem = (id: string) => {
    const it = allItems.find((i) => i.id === id);
    if (it) setLastItemBySection((prev) => ({ ...prev, [it.sectionId]: id }));
  };

  // Правило 1: клик по разделу в дереве — только обзор, редактор не открываем.
  const selectSectionOverview = (id: string) => {
    setSelectedSectionId(id);
    setSelectedIds(new Set());
  };

  // Открыть позицию (из обзора или sibling-навигации) → войти в editor mode.
  const openItem = (id: string) => {
    setSelectedItemId(id);
    setEditing(true);
    rememberItem(id);
  };

  // Правило 2: смена раздела внутри редактора сохраняет editor mode.
  const selectSectionInEditor = (id: string) => {
    setSelectedSectionId(id);
    setSelectedIds(new Set());
    const items = allItems.filter((item) => item.sectionId === id && item.status !== "archive");
    const remembered = lastItemBySection[id];
    const nextId = remembered && items.some((i) => i.id === remembered)
      ? remembered
      : items[0]?.id ?? null; // null → пустой раздел → empty state в редакторе
    setSelectedItemId(nextId);
    if (nextId) setLastItemBySection((prev) => ({ ...prev, [id]: nextId }));
  };

  // «Добавить позицию» в текущий раздел → создаём черновик и сразу открываем.
  const addPosition = () => {
    if (!selectedSectionId) return;
    const draft = makeDraftItem(section);
    setExtraItems((prev) => [...prev, draft]);
    setSelectedItemId(draft.id);
    setEditing(true);
    setLastItemBySection((prev) => ({ ...prev, [selectedSectionId]: draft.id }));
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

  const archiveSection = (target: TreeSection | null = section) => {
    if (!target) return;
    setSectionStatusOverrides((prev) => ({ ...prev, [target.id]: "archive" }));
    setSelectedSectionId(target.id);
    setSelectedIds(new Set());
    setSectionArchiveOpen(true);
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

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-[#fbfbf9]">
      <div className="flex min-h-0 flex-1">
        {editing ? (
          <SectionPositionNav
            sectionId={selectedSectionId}
            sectionName={section?.name ?? selectedItem?.sectionName ?? "Раздел"}
            items={sectionItems}
            archiveOpen={archiveOpen}
            selectedItemId={selectedItemId}
            onBackToSections={() => setEditing(false)}
            onSelectSection={selectSectionInEditor}
            onSelectItem={openItem}
            onAddPosition={addPosition}
            onSectionAction={handleSectionAction}
            onArchiveOpenChange={setArchiveOpen}
            onRestoreItem={restoreItem}
            onToggleStop={toggleStopItem}
            stopBusyIds={stopBusyIds}
          />
        ) : (
          <CatalogTreePanel
            sections={activeSectionTree}
            archivedSections={archivedSectionTree}
            selectedId={selectedSectionId}
            archiveOpen={sectionArchiveOpen}
            onSelectSection={selectSectionOverview}
            onArchiveOpenChange={setSectionArchiveOpen}
            onRestoreSection={restoreSection}
            onDeleteArchivedSection={requestDeleteArchivedSection}
            onCreateAction={(action) => showPlaceholderFeedback(`${action}: placeholder`)}
          />
        )}
        {editing ? (
          selectedItem ? (
            <PositionEditor
              item={selectedItem}
              stopBusy={stopBusyIds.has(selectedItem.id)}
              onArchiveItem={archiveItem}
              onRestoreItem={restoreItem}
              onMoveItem={(item) => showPlaceholderFeedback(`Переместить «${item.title}»: placeholder`)}
              onToggleStop={toggleStopItem}
              onSetAvailabilityMode={setAvailabilityMode}
              unavailableDisplayMode={unavailableDisplayByItem[selectedItem.id] ?? "hidden"}
              outsideScheduleMode={outsideScheduleByItem[selectedItem.id] ?? "hidden"}
              weeklySchedule={weeklyScheduleByItem[selectedItem.id] ?? createDefaultWeeklySchedule()}
              onUnavailableDisplayModeChange={(mode) => setUnavailableDisplayByItem((prev) => ({ ...prev, [selectedItem.id]: mode }))}
              onOutsideScheduleModeChange={(mode) => setOutsideScheduleByItem((prev) => ({ ...prev, [selectedItem.id]: mode }))}
              onWeeklyScheduleChange={(schedule) => setWeeklyScheduleByItem((prev) => ({ ...prev, [selectedItem.id]: schedule }))}
              onRequestPermanentDelete={requestPermanentDelete}
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
        {editing && feedback && (
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
  description: "w-[87px]",
  weight: "w-[58px]",
  kbju: "w-[62px]",
  translation: "w-[80px]",
  price: "w-[82px]",
  kebab: "w-[40px]",
};

function TableCheckbox({
  ariaLabel,
  checked = false,
  indeterminate = false,
  onChange,
}: {
  ariaLabel: string;
  checked?: boolean;
  indeterminate?: boolean;
  onChange?: (checked: boolean) => void;
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
      className="h-[18px] w-[18px] shrink-0 cursor-pointer rounded-[5px] border border-[#d6d3d1] bg-white accent-[#292524] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
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
}: {
  query: string;
  onQueryChange: (value: string) => void;
  checked: boolean;
  indeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
}) {
  const labels: [string, string][] = [
    ["Описание", TABLE_COL.description],
    ["Вес", TABLE_COL.weight],
    ["КБЖУ", TABLE_COL.kbju],
    ["Перевод", TABLE_COL.translation],
    ["Цена", TABLE_COL.price],
  ];

  return (
    <div className="sticky top-0 z-10 flex h-10 items-center border-b border-[#e7e5e4] bg-white">
      <div className="flex min-w-0 flex-1 items-center gap-2 pr-3">
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
          className={cn("flex h-full shrink-0 items-center justify-center px-3 text-[13px] leading-5 text-[#79716b]", width)}
        >
          {label}
        </span>
      ))}
      <span className={cn("h-10 shrink-0", TABLE_COL.kebab)} />
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
  onSelectedChange,
}: {
  item: CatalogItem;
  showSectionMeta?: boolean;
  onAction: (item: CatalogItem, action: string) => void;
  selected: boolean;
  onSelectedChange: (id: string, selected: boolean) => void;
}) {
  const kbjuState =
    item.nutritionFilledCount === 4 ? "filled" : item.nutritionFilledCount > 0 ? "partial" : "missing";
  const salePrice = item.hasDiscount && item.priceWithSale != null ? item.priceWithSale : null;

  return (
    <div
      className={cn(
        "group flex h-[62px] items-center border-b border-[#e5e7eb] transition hover:bg-[#fafaf9]",
        selected ? "bg-[#f7f6f2]" : "bg-white",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TableCheckbox
          ariaLabel={`Выбрать ${item.title}`}
          checked={selected}
          onChange={(checked) => onSelectedChange(item.id, checked)}
        />
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
            <button
              type="button"
              onClick={() => onAction(item, "Открыть позицию")}
              className="block max-w-full truncate text-left text-[13px] leading-none text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              {item.title}
            </button>
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
      <span className={cn("flex shrink-0 items-center justify-center", TABLE_COL.kebab)}>
        <AuditRowActionsMenu item={item} onAction={(action) => onAction(item, action)} />
      </span>
    </div>
  );
}

type ProblemLink = { id: OverviewFilterId; label: string };
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
  problems,
  onProblemClick,
}: {
  filterId: OverviewFilterId;
  count: number;
  query: string;
  scopeName?: string;
  problems: ProblemLink[];
  onProblemClick: (id: OverviewFilterId) => void;
}) {
  const meta = OVERVIEW_FILTER_META[filterId];

  return (
    <div className="flex h-[41px] min-w-0 flex-col justify-center gap-1">
      <div className="text-[14px] font-medium leading-[1.4] text-[#292524]">{meta.label}</div>
      <div className="text-[13px] leading-4 text-[#292524]">
        {meta.countText(count)}
        {scopeName && <span> · раздел «{scopeName}»</span>}
        {query.trim() && <span> · с учётом поиска</span>}
        {problems.map((problem) => (
          <span key={problem.id}>
            {" · "}
            <button
              type="button"
              onClick={() => onProblemClick(problem.id)}
              className="transition hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              {problem.label}
            </button>
          </span>
        ))}
      </div>
    </div>
  );
}

function OverviewWorkspace({
  filterId,
  onFilterChange,
}: {
  filterId: OverviewFilterId;
  onFilterChange: (id: OverviewFilterId) => void;
}) {
  const [items, setItems] = useState<CatalogItem[]>(catalogItems);
  const [query, setQuery] = useState("");
  const [sectionScopeId, setSectionScopeId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkDialog, setBulkDialog] = useState<BulkDialog | null>(null);
  const [feedback, setFeedback] = useState("");
  const scopeSection = catalogSections.find((section) => section.id === sectionScopeId) ?? null;
  const inScope = (item: CatalogItem) => !scopeSection || item.sectionId === scopeSection.id;
  const filtered = getOverviewItems(filterId, items).filter(inScope);
  const normalizedQuery = query.trim().toLowerCase();
  // Fixture already carries the real menu order — keep it, no re-sorting.
  const visible = normalizedQuery
    ? filtered.filter((item) =>
        [item.title, item.sectionName].some((value) => value.toLowerCase().includes(normalizedQuery)),
      )
    : filtered;
  const grouped = catalogSections
    .map((section) => ({
      ...section,
      items: visible.filter((item) => item.sectionId === section.id),
    }))
    .filter((group) => group.items.length > 0);
  const statusMeta = OVERVIEW_FILTER_META[filterId];
  const flat = normalizedQuery.length > 0;
  const visibleIds = visible.map((item) => item.id);
  const visibleIdKey = visibleIds.join("|");
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const someVisibleSelected = visibleIds.some((id) => selectedIds.has(id));

  const stopCount = getOverviewItems("status:stop", items).filter(inScope).length;
  const problems: ProblemLink[] =
    filterId !== "status:stop" && stopCount > 0
      ? [{ id: "status:stop", label: `${stopCount} на стопе` }]
      : [];

  const resetFilter = () => {
    setQuery("");
    setSectionScopeId(null);
    setSelectedIds(new Set());
    onFilterChange("quick:all");
  };
  const clearSearch = () => {
    setQuery("");
  };
  const emptyTitle = statusMeta.emptyTitle;
  const emptyText = statusMeta.emptyText;

  const toggleSection = (id: string) => {
    setCollapsedSections((current) => ({ ...current, [id]: !current[id] }));
  };

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
    setSectionScopeId(id);
  };
  const handleQueryChange = (value: string) => {
    clearSelection();
    setQuery(value);
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
  const setGroupSelected = (ids: string[], selected: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      ids.forEach((id) => {
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
  const prepareRowAction = (item: CatalogItem, action: string) => {
    const ids = new Set([item.id]);
    if (action === "На стоп") updateItems(ids, (current) => ({ ...current, status: "stopped" }));
    if (action === "Убрать со стопа" || action === "Восстановить") updateItems(ids, (current) => ({ ...current, status: "active" }));
    if (action === "В архив") updateItems(ids, (current) => ({ ...current, status: "archive" }));
    if (action === "Задать скидку") {
      updateItems(ids, (current) => ({ ...current, hasDiscount: true, priceWithSale: Math.round(current.price * 0.9) }));
    }
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

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <CatalogFiltersPanel
          selectedId={filterId}
          onSelect={handleFilterChange}
          sectionScopeId={sectionScopeId}
          onSectionScopeChange={handleSectionScopeChange}
          items={items}
        />
        <div className="min-w-0 flex-1 overflow-y-auto px-6 pb-10">
          <div className="min-w-0">
            <div className="pt-[14px]">
              <OverviewStatusBar
                filterId={filterId}
                count={visible.length}
                query={query}
                scopeName={scopeSection?.name}
                problems={problems}
                onProblemClick={handleFilterChange}
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
                  />
                  {flat ? (
                    <div>
                      {selectedIds.size > 0 && (
                        <div className="sticky top-10 z-[9] flex items-center bg-white py-1">
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
                          onSelectedChange={setItemSelected}
                          onAction={prepareRowAction}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[38px] pt-1">
                      {grouped.map((group) => {
                        const isCollapsed = Boolean(collapsedSections[group.id]);
                        const groupIds = group.items.map((item) => item.id);
                        const selectedInGroup = groupIds.filter((id) => selectedIds.has(id)).length;
                        return (
                          <section key={group.id} className="flex flex-col gap-[10px]">
                            <div className="sticky top-10 z-[9] flex items-center gap-2 bg-white">
                              {selectedIds.size > 0 && selectedInGroup > 0 ? (
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
                              ) : (
                                <>
                                  <TableCheckbox
                                    ariaLabel={`Выбрать раздел ${group.name}`}
                                    checked={groupIds.length > 0 && selectedInGroup === groupIds.length}
                                    indeterminate={selectedInGroup > 0 && selectedInGroup < groupIds.length}
                                    onChange={(checked) => setGroupSelected(groupIds, checked)}
                                  />
                                  <button
                                    type="button"
                                    onClick={() => toggleSection(group.id)}
                                    aria-expanded={!isCollapsed}
                                    className="flex min-w-0 items-center gap-1.5 py-0.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                                  >
                                    <span className="flex h-[14px] w-5 shrink-0 items-center justify-center rounded-[4px] bg-[#efefeb] text-[10px] font-medium leading-4 text-[#79716b]">
                                      {group.items.length}
                                    </span>
                                    <span className="truncate text-[13px] font-medium leading-[18px] text-[#292524]">
                                      {group.name}
                                    </span>
                                    <CaretDown
                                      size={13}
                                      weight="bold"
                                      className={cn("shrink-0 text-[#57534d] transition-transform", isCollapsed && "-rotate-90")}
                                    />
                                  </button>
                                </>
                              )}
                            </div>
                            {!isCollapsed && (
                              <div>
                                {group.items.map((item) => (
                                  <AuditDishRow
                                    key={item.id}
                                    item={item}
                                    selected={selectedIds.has(item.id)}
                                    onSelectedChange={setItemSelected}
                                    onAction={prepareRowAction}
                                  />
                                ))}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  )}
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

  const workspace = catalogPhase === "empty" && catalogTab === "sections" ? (
      <CatalogEmptyState onCreateSection={() => setSectionDialogOpen(true)} />
    ) : catalogPhase === "empty" ? (
      <CatalogEmptyState onCreateSection={() => setSectionDialogOpen(true)} />
    ) : catalogTab === "overview" ? (
      <OverviewWorkspace
        filterId={overviewFilterId}
        onFilterChange={onOverviewFilterChange}
      />
    ) : catalogTab === "upsell" ? (
      <RecommendationsContextWorkspace />
    ) : catalogPhase === "has-items" ? (
      <PopulatedWorkspace sections={sections} />
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
