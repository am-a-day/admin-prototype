import { useEffect, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  CaretDown,
  Clock,
  Dot,
  DotsThreeVertical,
  Fire,
  ForkKnife,
  List,
  Lock,
  MegaphoneSimple,
  Tag,
} from "@phosphor-icons/react";
import { ArrowLeft, Camera, CheckCircle, ChevronRight, GripVertical, ImageOff, Play, Plus, Search, X } from "lucide-react";
import { TranslatableField } from "@/components/workspace/translatable-field";
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
  const stopCount = catalogItems.filter((item) => item.status === "stopped").length;
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
  name: string;
  imageUrl?: string | null;
  emoji?: string;
  children?: TreeSection[];
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
    <aside className="w-[228px] shrink-0 overflow-y-auto border-r border-border bg-[#fbfbf9] px-2 pt-4">
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
  selectedId: controlledId,
  onSelectSection,
  onCreateAction,
}: {
  sections: TreeSection[];
  selectedId?: string | null;
  onSelectSection?: (id: string) => void;
  onCreateAction?: (action: string) => void;
}) {
  const tree = sections;
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [tree[0]?.id ?? ""]: true });
  const [internalId, setInternalId] = useState<string | null>(tree[0]?.id ?? null);
  const selectedId = controlledId !== undefined ? controlledId : internalId;
  const selectSection = (id: string) => {
    if (onSelectSection) onSelectSection(id);
    else setInternalId(id);
  };

  const renderSectionRow = (section: TreeSection, depth = 0) => {
    const hasChildren = Boolean(section.children?.length);
    const isExpanded = expanded[section.id] ?? true;
    const isSelected = section.id === selectedId;

    return (
      <div key={section.id}>
        <div
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
            !isSelected && "border-transparent text-[#79716b] hover:bg-[#f1f1ea]",
          )}
          style={{ paddingLeft: 6 + depth * 10, paddingRight: 8 }}
        >
          <GripVertical
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
              <ChevronRight
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
            className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#79716b] opacity-0 transition hover:bg-[#e6e6db] hover:text-[#292524] group-hover:opacity-100 group-focus-within:opacity-100"
            aria-label={`Добавить позицию в ${section.name}`}
            title="Добавить позицию"
          >
            <Plus size={14} />
          </button>
        </div>
        {hasChildren && isExpanded && (
          <div className="space-y-1 pl-2 pt-1">
            {section.children?.map((child) => renderSectionRow(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  const selectedSectionName = findTreeSectionName(tree, selectedId);

  return (
    <CatalogSidePanel
      title="Разделы"
      actionLabel="Добавить"
      selectedSectionName={selectedSectionName}
      onCreateAction={onCreateAction}
    >
      <div className="space-y-1">{tree.map((section) => renderSectionRow(section))}</div>
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

type EditorTab = "basic" | "media" | "promo" | "options" | "availability" | "display";

const EDITOR_TABS: { id: EditorTab; label: string }[] = [
  { id: "basic", label: "Основное" },
  { id: "media", label: "Медиа" },
  { id: "promo", label: "Продвижение" },
  { id: "options", label: "Опции" },
  { id: "availability", label: "Доступность" },
  { id: "display", label: "Отображение" },
];

// Demo video-package limits (prototype constants, no backend).
const VIDEO_LIMIT_TOTAL = 10;
const VIDEO_LIMIT_USED = 6;
const VIDEO_PACKAGE_CONNECTED = true;

type MediaKind = "photo" | "video";
type MediaEntry = {
  id: string;
  kind: MediaKind;
  fileName?: string;
  previewUrl?: string;
  coverMode?: "auto" | "custom";
};

type SummaryChip = {
  key: string;
  label: string;
  kind: "status" | "label" | "tag" | "count";
  tab: EditorTab;
};

/** Compact audit-like summary: media → exceptional status → promo → counts. */
function buildPositionSummary(item: CatalogItem, media: MediaEntry[]): SummaryChip[] {
  const chips: SummaryChip[] = [];
  const mainMedia = media[0];
  if (!mainMedia) {
    chips.push({
      key: "media-empty",
      label: "Нет медиа",
      kind: "count",
      tab: "media",
    });
  } else if (mainMedia.kind === "video" && mainMedia.fileName) {
    chips.push({
      key: "video",
      label: "С видео",
      kind: "count",
      tab: "media",
    });
  }
  for (const chip of getStatusChips(item)) {
    const tab: EditorTab = chip.label.startsWith("Без кнопки") ? "display" : "availability";
    chips.push({ key: `st-${chip.label}`, label: chip.label, kind: "status", tab });
  }
  item.guestLabels.forEach((label) => chips.push({ key: `lb-${label}`, label, kind: "label", tab: "promo" }));
  item.tags.forEach((tag) => chips.push({ key: `tg-${tag}`, label: tag, kind: "tag", tab: "promo" }));
  if (item.optionsCount > 0) {
    chips.push({ key: "opt", label: `${item.optionsCount} ${plural(item.optionsCount, "опция", "опции", "опций")}`, kind: "count", tab: "options" });
  }
  if (item.modifiersCount > 0) {
    chips.push({ key: "mod", label: `${item.modifiersCount} ${plural(item.modifiersCount, "доп", "допа", "допов")}`, kind: "count", tab: "options" });
  }
  if (item.recommendationsCount > 0) {
    chips.push({ key: "rec", label: `${item.recommendationsCount} ${plural(item.recommendationsCount, "рекомендация", "рекомендации", "рекомендаций")}`, kind: "count", tab: "promo" });
  }
  return chips.slice(0, 6);
}

/** Unfilled audit fields (routed to «Основное»). */
function buildPositionProblems(item: CatalogItem): string[] {
  const problems: string[] = [];
  if (!item.weightLabel) problems.push("Нет веса");
  if (item.nutritionFilledCount === 0) problems.push("Нет КБЖУ");
  if (item.translationFilledCount < item.translationTotalCount) problems.push("Нет перевода");
  if (!item.hasDescription) problems.push("Нет описания");
  return problems;
}

function PositionSummary({
  item,
  media,
  onOpenTab,
}: {
  item: CatalogItem;
  media: MediaEntry[];
  onOpenTab: (tab: EditorTab) => void;
}) {
  const chips = buildPositionSummary(item, media);
  const problems = buildPositionProblems(item);

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1.5">
      {chips.map((chip) => (
        <button
          key={chip.key}
          type="button"
          onClick={() => onOpenTab(chip.tab)}
          className="flex items-center rounded-[4px] transition hover:opacity-80"
          title="Открыть настройку"
        >
          {chip.kind === "status" ? (
            <StatusBadge label={chip.label} />
          ) : chip.kind === "count" ? (
            <span className="flex h-4 items-center rounded-[4px] bg-[#f5f5f4] px-1.5 text-[11px] font-medium leading-5 text-[#57534d]">
              {chip.label}
            </span>
          ) : (
            <AttributeBadge property={{ label: chip.label, icon: chip.kind === "label" ? "label" : "tag" }} />
          )}
        </button>
      ))}
      {problems.length > 0 && problems.length <= 3 &&
        problems.map((problem) => (
          <button
            key={problem}
            type="button"
            onClick={() => onOpenTab("basic")}
            className="flex h-4 items-center rounded-[4px] border border-dashed border-[#e0b3a0] bg-[#fdf6f2] px-1.5 text-[11px] font-medium leading-5 text-[#bc4a08] transition hover:bg-[#faeee7]"
          >
            {problem}
          </button>
        ))}
      {problems.length > 3 && (
        <button
          type="button"
          onClick={() => onOpenTab("basic")}
          className="flex h-4 items-center rounded-[4px] border border-dashed border-[#e0b3a0] bg-[#fdf6f2] px-1.5 text-[11px] font-medium leading-5 text-[#bc4a08] transition hover:bg-[#faeee7]"
        >
          {problems.length} {plural(problems.length, "поле", "поля", "полей")} не заполнены
        </button>
      )}
    </div>
  );
}

function EditorFieldShell({ label, action, children }: { label: string; action?: ReactNode; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        {action}
      </div>
      {children}
    </div>
  );
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

/** Neutral ghost text-action used in the illustration definition line. */
function GhostAction({ children, onClick, disabled, title }: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  title?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      className={cn(
        "rounded-md px-1.5 py-0.5 text-[13px] font-medium transition",
        disabled
          ? "cursor-not-allowed text-[#c4c0ba]"
          : "text-[#57534d] hover:bg-[#f5f5f4] hover:text-[#292524]",
      )}
    >
      {children}
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
        "h-[72px] w-[72px]",
      )}
    >
      {isVideo ? (
        <div className="flex h-full w-full flex-col items-center justify-center gap-1">
          <Play size={17} fill="currentColor" className="text-[#57534d]" />
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
          <ImageOff size={18} className="text-[#a6a09b]" />
        </div>
      )}

      <span className="absolute bottom-1 left-1 flex h-6 w-6 items-center justify-center rounded-md bg-white/90 text-[#79716b] opacity-0 shadow-sm transition group-hover:opacity-100">
        <GripVertical size={15} />
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

      <div className="mb-2 text-[13px] font-medium text-[#292524]">Медиа</div>
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
              className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl border border-dashed border-[#d6d3d1] text-[#79716b] transition hover:border-[#a8a29e] hover:bg-[#fafaf9] hover:text-[#292524]"
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

function MediaTab({
  item,
  media,
  onAddPhotoFile,
  onAddVideoFile,
  onReorder,
  onRemove,
  onSetVideoCoverMode,
}: {
  item: CatalogItem;
  media: MediaEntry[];
  onAddPhotoFile: (file: File) => void;
  onAddVideoFile: (file: File) => void;
  onReorder: (fromIndex: number, toIndex: number) => void;
  onRemove: (id: string) => void;
  onSetVideoCoverMode: (id: string, mode: "auto" | "custom") => void;
}) {
  const [notice, setNotice] = useState("");
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const photoInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timeout = window.setTimeout(() => setNotice(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [notice]);

  const hasVideo = media.some((m) => m.kind === "video");
  const videoEntry = media.find((m) => m.kind === "video");
  const activeVideoUsed = VIDEO_LIMIT_USED; // demo: active positions with video
  const limitReached = activeVideoUsed >= VIDEO_LIMIT_TOTAL;
  const canAddVideo = VIDEO_PACKAGE_CONNECTED && !hasVideo && !limitReached;

  const flash = (text: string) => setNotice(text);
  const openPhotoPicker = () => photoInputRef.current?.click();
  const openVideoPicker = () => {
    if (!VIDEO_PACKAGE_CONNECTED) return flash("Видео доступно в пакете");
    if (hasVideo) return flash("У позиции уже есть видео");
    if (limitReached) return flash(`Лимит ${VIDEO_LIMIT_TOTAL} из ${VIDEO_LIMIT_TOTAL} — отключите видео у другой позиции`);
    videoInputRef.current?.click();
  };
  const handlePhotoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    onAddPhotoFile(file);
  };
  const handleVideoFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    onAddVideoFile(file);
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
    <div className="space-y-4">
      <input
        ref={photoInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handlePhotoFileChange}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/mp4,video/quicktime,video/webm,video/*"
        className="hidden"
        onChange={handleVideoFileChange}
      />

      {media.length === 0 ? (
        <div className="rounded-[12px] border border-dashed border-[#e7e5e4] bg-[#fafaf9] p-6">
          <p className="text-[14px] font-medium text-[#44403b]">Нет медиа</p>
          <p className="mt-1 text-[13px] text-[#79716b]">Добавьте фото или видео, чтобы показать позицию на витрине.</p>
          <div className="mt-4 flex gap-2">
            <button
              type="button"
              onClick={openPhotoPicker}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]"
            >
              <Plus size={14} /> Добавить фото
            </button>
            <button
              type="button"
              onClick={openVideoPicker}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] border border-[#e7e5e4] bg-white px-3 text-[13px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4]"
            >
              Добавить видео
            </button>
          </div>
        </div>
      ) : (
        <>
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
                onReplace={() => entry.kind === "video" ? flash("Замена видео будет подключена позже") : openPhotoPicker()}
              />
            ))}

            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  className="flex h-[72px] w-[72px] shrink-0 items-center justify-center rounded-xl border border-dashed border-[#d6d3d1] text-[#79716b] transition hover:border-[#a8a29e] hover:bg-[#fafaf9] hover:text-[#292524]"
                >
                  <Plus size={18} />
                </button>
              </DropdownMenu.Trigger>
              <DropdownContent align="start">
                <DropdownActionItem onSelect={openPhotoPicker}>Добавить фото</DropdownActionItem>
                <DropdownActionItem
                  onSelect={openVideoPicker}
                >
                  <span className={cn("flex w-full items-center justify-between gap-3", !canAddVideo && "text-[#a8a29e]")}>
                    <span>Добавить видео</span>
                    {!VIDEO_PACKAGE_CONNECTED ? (
                      <Lock size={13} />
                    ) : (
                      <span className="text-[11px] text-[#a8a29e]">{activeVideoUsed}/{VIDEO_LIMIT_TOTAL}</span>
                    )}
                  </span>
                </DropdownActionItem>
                <div className="px-2 py-1 text-[11px] text-[#a8a29e]">
                  {limitReached && !hasVideo ? "Лимит 10 из 10" : `${activeVideoUsed} из ${VIDEO_LIMIT_TOTAL} активных позиций`}
                </div>
              </DropdownContent>
            </DropdownMenu.Root>
          </div>
        </>
      )}

      {/* Video inspector — only when the position has a video */}
      {videoEntry && (
        <div className="rounded-xl border border-zinc-200 bg-white p-3">
          <div className="mb-2 text-[13px] font-semibold text-[#292524]">Видео-иллюстрация</div>
          <div className="space-y-1.5 text-[12px] leading-5 text-[#79716b]">
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="text-[#57534d]">Файл:</span>
              <span>{videoEntry.fileName ?? "video-dish.mp4"}</span>
              <span className="text-[#d6d3d1]">·</span>
              <GhostAction onClick={() => flash("Замена видео будет подключена позже")}>Заменить</GhostAction>
            </div>
            <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
              <span className="text-[#57534d]">Обложка:</span>
              <span>{videoEntry.coverMode === "custom" ? "своя" : "авто"}</span>
              <span className="text-[#d6d3d1]">·</span>
              {videoEntry.coverMode === "custom" ? (
                <GhostAction onClick={() => onSetVideoCoverMode(videoEntry.id, "auto")}>Вернуть авто</GhostAction>
              ) : (
                <GhostAction onClick={() => { onSetVideoCoverMode(videoEntry.id, "custom"); flash("Загрузка обложки будет подключена позже"); }}>Поменять обложку</GhostAction>
              )}
            </div>
          </div>
        </div>
      )}

      {notice && (
        <div className="fixed bottom-5 left-1/2 z-[100003] -translate-x-1/2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">
          {notice}
        </div>
      )}
    </div>
  );
}

function BasicTab({
  item,
  media,
  onAddPhotoFile,
  onAddVideoFile,
  onReorderMedia,
  onRemoveMedia,
}: {
  item: CatalogItem;
  media: MediaEntry[];
  onAddPhotoFile: (file: File) => void;
  onAddVideoFile: (file: File) => void;
  onReorderMedia: (fromIndex: number, toIndex: number) => void;
  onRemoveMedia: (id: string) => void;
}) {
  const [discountOpen, setDiscountOpen] = useState(item.hasDiscount);
  const [kbjuOpen, setKbjuOpen] = useState(item.nutritionFilledCount > 0);

  const [weightValue, weightUnit] = item.weightLabel
    ? [item.weightLabel.replace(/[^\d.,]/g, "").trim(), item.weightLabel.replace(/[\d.,\s]/g, "").trim() || "г"]
    : ["", "г"];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <TranslatableField
          key={`name-${item.id}`}
          label="Название"
          initialTranslations={{ ru: item.title }}
          showTranslationMeta={false}
          compact
        />

        <EditorFieldShell label="Цена">
          <div className="flex items-baseline gap-1">
            <input
              defaultValue={item.price || ""}
              placeholder="0"
              className="w-full bg-transparent text-base font-semibold text-zinc-900 outline-none placeholder:text-zinc-300"
            />
            <span className="text-sm font-semibold text-zinc-400">₸</span>
          </div>
        </EditorFieldShell>
      </div>

      {discountOpen && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-zinc-200 bg-white px-3 py-2.5">
          <span className="text-xs font-semibold text-muted-foreground">Скидка</span>
          <input
            defaultValue="10"
            className="h-8 w-16 rounded-lg border border-zinc-200 bg-white px-2 text-sm font-semibold text-zinc-900 outline-none"
          />
          <span className="text-[13px] text-[#79716b]">%</span>
          <span className="text-[13px] text-[#79716b]">Цена со скидкой:</span>
          <div className="flex h-8 items-center gap-1 rounded-lg border border-zinc-200 px-2">
            <input
              defaultValue={item.priceWithSale ?? Math.round(item.price * 0.9)}
              placeholder="0"
              className="w-24 bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-300"
            />
            <span className="text-xs font-semibold text-zinc-400">₸</span>
          </div>
          <button
            type="button"
            onClick={() => setDiscountOpen(false)}
            className="ml-auto h-8 rounded-[8px] px-3 text-[13px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524]"
          >
            Убрать
          </button>
        </div>
      )}

      <EditorFieldShell label="Порция">
        <div className="flex max-w-[260px] items-center gap-2">
          <input
            defaultValue={weightValue}
            placeholder="—"
            className="w-full bg-transparent text-base font-semibold text-zinc-900 outline-none placeholder:text-zinc-300"
          />
          <select
            defaultValue={weightUnit}
            className="shrink-0 rounded-lg border border-border bg-white px-2 py-1 text-sm font-semibold text-zinc-700 outline-none"
          >
            {["г", "кг", "мл", "л", "шт"].map((u) => (
              <option key={u} value={u}>{u}</option>
            ))}
          </select>
        </div>
      </EditorFieldShell>

      <TranslatableField
        key={`desc-${item.id}`}
        label="Описание"
        multiline
        initialTranslations={{ ru: item.description }}
        placeholder="Кратко опишите состав, вкус или способ подачи"
        showTranslationMeta={false}
        compact
      />

      <BasicMediaStrip
        item={item}
        media={media}
        onAddPhotoFile={onAddPhotoFile}
        onAddVideoFile={onAddVideoFile}
        onReorder={onReorderMedia}
        onRemove={onRemoveMedia}
      />

      <div>
        <div className="mb-1.5 text-xs font-semibold text-muted-foreground">Дополнительно</div>
        <div className="flex flex-wrap items-center gap-2">
          {!discountOpen && <AddInlineButton label="Добавить скидку" onClick={() => setDiscountOpen(true)} />}
          {!kbjuOpen && <AddInlineButton label="Добавить КБЖУ на 100 г" onClick={() => setKbjuOpen(true)} />}
        </div>
      </div>

      {kbjuOpen && (
        <EditorFieldShell label="КБЖУ на 100 г">
          <div className="grid grid-cols-4 gap-2">
            {["Ккал", "Белки", "Жиры", "Углеводы"].map((macro) => (
              <label key={macro} className="rounded-lg border border-zinc-200 bg-white px-2.5 py-2">
                <div className="text-[11px] font-medium text-muted-foreground">{macro}</div>
                <input
                  placeholder="—"
                  className="w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none placeholder:text-zinc-300"
                />
              </label>
            ))}
          </div>
        </EditorFieldShell>
      )}
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

const STATUS_LABELS: Record<CatalogItem["status"], string> = {
  active: "В меню",
  stopped: "На стопе",
  archive: "В архиве",
  "coming-soon": "Скоро будет",
};

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
            <ImageOff size={15} className="text-[#bc4a08]" />
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
        <p className="mt-3 text-[12px] text-[#a8a29e]">Фото и видео позиции — в табе «Медиа».</p>
      </section>

    </div>
  );
}

function getInitialMedia(item: CatalogItem): MediaEntry[] {
  return item.thumbnailUrl ? [{ id: "photo-1", kind: "photo" }] : [];
}

function PositionEditor({ item }: { item: CatalogItem }) {
  const [activeTab, setActiveTab] = useState<EditorTab>("basic");
  const [photoHover, setPhotoHover] = useState(false);
  const [media, setMedia] = useState<MediaEntry[]>(() => getInitialMedia(item));

  const openTab = (tab: EditorTab) => setActiveTab(tab);

  useEffect(() => {
    setMedia(getInitialMedia(item));
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
  const setVideoCoverMode = (id: string, mode: "auto" | "custom") => {
    setMedia((current) => current.map((entry) => entry.id === id ? { ...entry, coverMode: mode } : entry));
  };
  const removeMedia = (id: string) =>
    setMedia((m) => m.filter((x) => x.id !== id));

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-w-0 flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-3xl">
          {/* Compact position header: thumbnail + title + summary */}
          <div className="flex items-start gap-3">
            <button
              type="button"
              onClick={() => setActiveTab("media")}
              onMouseEnter={() => setPhotoHover(true)}
              onMouseLeave={() => setPhotoHover(false)}
              title="Открыть медиа"
              className={cn(
                "relative flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-[8px]",
                media[0]?.kind === "video" ? "bg-[#292524]" : item.thumbnailUrl ? "bg-[#f5f5f4]" : "bg-[#faf0e6]",
              )}
            >
              {media[0]?.kind === "video" ? (
                <Play size={16} fill="white" className="text-white" />
              ) : item.thumbnailUrl ? (
                <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
              ) : (
                <ImageOff size={16} className="text-[#bc4a08]" />
              )}
              {photoHover && (
                <span className="absolute inset-0 flex items-center justify-center bg-black/35">
                  <Camera size={16} className="text-white" />
                </span>
              )}
            </button>
            <div className="min-w-0 flex-1 pt-0.5">
              <h1 className="text-[18px] font-semibold leading-tight text-[#292524]">{item.title}</h1>
              <div className="mt-1.5">
                <PositionSummary
                  item={item}
                  media={media}
                  onOpenTab={openTab}
                />
              </div>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-5 flex items-center gap-0.5 border-b border-[#e7e5e4]">
            {EDITOR_TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "-mb-px border-b-2 px-3 py-2 text-[13px] font-medium transition",
                  activeTab === tab.id
                    ? "border-[#292524] text-[#292524]"
                    : "border-transparent text-[#79716b] hover:text-[#292524]",
                )}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="pt-5">
            {activeTab === "basic" && (
              <BasicTab
                item={item}
                media={media}
                onAddPhotoFile={addPhotoFile}
                onAddVideoFile={addVideoFile}
                onReorderMedia={reorderMedia}
                onRemoveMedia={removeMedia}
              />
            )}
            {activeTab === "media" && (
              <MediaTab
                item={item}
                media={media}
                onAddPhotoFile={addPhotoFile}
                onAddVideoFile={addVideoFile}
                onReorder={reorderMedia}
                onRemove={removeMedia}
                onSetVideoCoverMode={setVideoCoverMode}
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
              <PlaceholderTab title="Доступность">
                Текущий статус: <span className="font-semibold text-[#292524]">{STATUS_LABELS[item.status]}</span>
                {item.scheduled && " · показ по расписанию"}
              </PlaceholderTab>
            )}
            {activeTab === "display" && <DisplayTab item={item} />}
          </div>
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
          <ImageOff size={14} className="text-[#bc4a08]" />
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
  section: { name: string; imageUrl?: string | null } | null;
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
              <h2 className="truncate text-[20px] font-semibold leading-6 text-[#292524]">{sectionName}</h2>
              <p className="mt-1 text-[13px] text-[#a8a29e]">
                {items.length} {plural(items.length, "позиция", "позиции", "позиций")}
              </p>
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={() => onSectionAction("Добавить позицию")}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]"
            >
              <Plus size={14} />
              Добавить позицию
            </button>
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
                {["Переименовать", "Поменять иконку", "Настроить доступность", "Переместить"].map((action) => (
                  <DropdownActionItem key={action} onSelect={() => onSectionAction(action)}>{action}</DropdownActionItem>
                ))}
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                <DropdownActionItem onSelect={() => onSectionAction("Архивировать")} tone="danger">
                  Архивировать
                </DropdownActionItem>
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
                <DropdownActionItem onSelect={() => onSectionAction("Переименовать")}>Переименовать</DropdownActionItem>
                <DropdownActionItem onSelect={() => onSectionAction("Поменять иконку")}>Поменять иконку</DropdownActionItem>
                <DropdownActionItem onSelect={() => onSectionAction("Настроить доступность")}>Настроить доступность</DropdownActionItem>
                <DropdownActionItem onSelect={() => onSectionAction("Переместить")}>Переместить</DropdownActionItem>
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                <DropdownActionItem onSelect={() => onSectionAction("Архивировать")} tone="danger">Архивировать</DropdownActionItem>
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

function buildSectionNavMeta(item: CatalogItem, active = false): string[] {
  const status: string[] = [];
  if (item.status === "archive") status.push("В архиве");
  if (item.status === "stopped") status.push("На стопе");
  if (item.status === "coming-soon") status.push("Скоро будет");
  if (item.scheduled) status.push("По расписанию");

  const problems: string[] = [];
  if (!item.thumbnailUrl) problems.push("Нет фото");
  if (!item.hasDescription) problems.push("Нет описания");
  if (!item.weightLabel) problems.push("Нет веса");
  if (item.nutritionFilledCount === 0) problems.push("Нет КБЖУ");
  if (item.translationFilledCount < item.translationTotalCount) problems.push("Нет перевода");

  const counters: string[] = [];
  if (item.optionsCount > 0) {
    counters.push(`${item.optionsCount} ${plural(item.optionsCount, "опция", "опции", "опций")}`);
  }
  if (item.recommendationsCount > 0) {
    counters.push(`${item.recommendationsCount} ${plural(item.recommendationsCount, "рекомендация", "рекомендации", "рекомендаций")}`);
  }

  if (status.length === 0 && problems.length > 2 && !active) {
    return [`${problems.length} ${plural(problems.length, "поле", "поля", "полей")} не заполнены`];
  }

  return [...status, ...problems, ...counters].slice(0, 2);
}

function SectionPositionNav({
  sectionId,
  sectionName,
  items,
  selectedItemId,
  onBackToSections,
  onSelectSection,
  onSelectItem,
  onAddPosition,
  onSectionAction,
}: {
  sectionId: string | null;
  sectionName: string;
  items: CatalogItem[];
  selectedItemId: string | null;
  onBackToSections: () => void;
  onSelectSection: (id: string) => void;
  onSelectItem: (id: string) => void;
  onAddPosition: () => void;
  onSectionAction: (action: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [sectionQuery, setSectionQuery] = useState("");
  // Поиск по позициям — вторичное действие: скрыт по умолчанию, но в больших
  // разделах (>25 позиций) показывается сразу. «+ Добавить позицию» всегда сверху.
  const [searchOpen, setSearchOpen] = useState(false);
  const bigSection = items.length > 25;
  const showSearch = searchOpen || bigSection;
  const searchInputRef = useRef<HTMLInputElement>(null);
  const closeSearch = () => { setQuery(""); setSearchOpen(false); };
  useEffect(() => { if (searchOpen) searchInputRef.current?.focus(); }, [searchOpen]);
  // Смена раздела — свежий старт: сбрасываем поиск (в большом разделе он снова покажется).
  useEffect(() => { setQuery(""); setSearchOpen(false); }, [sectionId]);
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedSectionQuery = sectionQuery.trim().toLowerCase();
  const visibleItems = normalizedQuery
    ? items.filter((item) => item.title.toLowerCase().includes(normalizedQuery))
    : items;
  const visibleSections = catalogSections.filter((section) =>
    section.name.toLowerCase().includes(normalizedSectionQuery),
  );

  return (
    <aside className="flex w-[260px] shrink-0 flex-col overflow-hidden border-r border-border bg-[#fbfbf9]">
      <div className="shrink-0 px-2 pt-3">
        <button
          type="button"
          onClick={onBackToSections}
          className="mb-3 flex h-8 w-full items-center gap-1.5 rounded-[8px] px-1.5 text-left text-[13px] font-medium text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524]"
        >
          <ArrowLeft size={14} />
          Все разделы
        </button>
        <div className="px-1.5">
          <div className="flex items-center gap-1">
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="flex min-w-0 flex-1 items-center gap-1.5 rounded-[6px] text-left text-[14px] font-medium leading-5 text-[#292524] transition hover:text-[#57534d]"
              >
                <span className="min-w-0 truncate">{sectionName}</span>
                <CaretDown size={12} weight="bold" className="shrink-0 text-[#a8a29e]" />
              </button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                align="start"
                sideOffset={6}
                className="z-[100002] w-[280px] rounded-[12px] border border-[#e7e5e4] bg-white p-2 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
              >
                <label className="mb-2 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-white px-2 text-[#a8a29e]">
                  <Search size={14} />
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
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#a8a29e] transition hover:bg-[#f1f1ea] hover:text-[#57534d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 data-[state=open]:bg-[#f1f1ea]"
                aria-label="Действия с разделом"
              >
                <DotsThreeVertical size={16} weight="bold" />
              </button>
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
          <p className="mt-0.5 text-[12px] leading-4 text-[#a8a29e]">
            {items.length} {plural(items.length, "позиция", "позиции", "позиций")}
          </p>
        </div>
        {/* Основное действие — добавить позицию. Поиск вторичен: иконка справа. */}
        <div className="mt-3 flex items-center gap-1">
          <button
            type="button"
            onClick={onAddPosition}
            className="flex h-8 min-w-0 flex-1 items-center gap-1.5 rounded-[8px] px-1.5 text-left text-[13px] font-medium text-[#57534d] transition hover:bg-[#f1f1ea] hover:text-[#292524]"
          >
            <Plus size={15} />
            Добавить позицию
          </button>
          {!showSearch && (
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#a8a29e] transition hover:bg-[#f1f1ea] hover:text-[#57534d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
              aria-label="Поиск по позициям"
              title="Поиск по позициям"
            >
              <Search size={15} />
            </button>
          )}
        </div>
        {showSearch && (
          <label className="mt-2 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-white px-2 text-[#a8a29e]">
            <Search size={14} className="shrink-0" />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => { if (event.key === "Escape") closeSearch(); }}
              onBlur={() => { if (!query.trim()) closeSearch(); }}
              placeholder="Поиск по позициям"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
            />
            {query && (
              <button
                type="button"
                onClick={closeSearch}
                aria-label="Очистить поиск"
                className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#a8a29e] transition hover:bg-[#efefeb] hover:text-[#57534d]"
              >
                <X size={12} />
              </button>
            )}
          </label>
        )}
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3 pt-3">
        {visibleItems.length === 0 ? (
          <div className="rounded-[10px] border border-dashed border-[#e7e5e4] bg-white/60 px-3 py-4 text-[13px] leading-5 text-[#79716b]">
            Позиции не найдены
          </div>
        ) : (
          <div className="space-y-1">
            {visibleItems.map((item) => {
              const active = item.id === selectedItemId;
              const meta = buildSectionNavMeta(item, active);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectItem(item.id)}
                  className={cn(
                    "flex w-full items-start gap-2 rounded-[8px] border p-1.5 text-left transition",
                    active
                      ? "border-[#e7e5e4] bg-white shadow-[0_0_2px_rgba(0,0,0,0.08)]"
                      : "border-transparent hover:bg-[#f1f1ea]",
                  )}
                >
                  <span
                    className={cn(
                      "flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-[6px]",
                      item.thumbnailUrl ? "bg-[#f5f5f4]" : "bg-[#faf0e6]",
                    )}
                  >
                    {item.thumbnailUrl ? (
                      <img src={item.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                    ) : (
                      <ImageOff size={13} className="text-[#bc4a08]" />
                    )}
                  </span>
                  <span className="min-w-0 flex-1 pt-0.5">
                    <span className={cn("block truncate text-[13px] font-medium leading-4", active ? "text-[#292524]" : "text-[#57534d]")}>
                      {item.title}
                    </span>
                    <span className="mt-0.5 block truncate text-[11px] leading-4 text-[#a8a29e]">
                      {meta.join(" · ")}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}

let draftSeq = 0;
function makeDraftItem(section: CatalogSection | null): CatalogItem {
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

function PopulatedWorkspace({
  sections,
}: {
  sections: TreeSection[];
}) {
  const firstSectionId = SECTIONS_WITH_ITEMS[0]?.id ?? catalogSections[0]?.id ?? null;
  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(firstSectionId);
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);
  // Явный режим: обзор раздела ↔ редактор позиции. Раньше режим выводился из
  // selectedItem != null, из-за чего смена раздела (обнулявшая позицию) выкидывала
  // из редактора и ломала пустой раздел в editor mode.
  const [editing, setEditing] = useState(false);
  // Последняя открытая позиция в каждом разделе за сессию (для правила 2.1).
  const [lastItemBySection, setLastItemBySection] = useState<Record<string, string>>({});
  // Черновики, созданные кнопкой «Добавить позицию» (статичные catalogItems не мутируем).
  const [extraItems, setExtraItems] = useState<CatalogItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [feedback, setFeedback] = useState("");

  const allItems = extraItems.length ? [...catalogItems, ...extraItems] : catalogItems;
  const section = catalogSections.find((s) => s.id === selectedSectionId) ?? null;
  const sectionItems = allItems.filter((item) => item.sectionId === selectedSectionId);
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
    const items = allItems.filter((item) => item.sectionId === id);
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
    setSelectedIds(selected ? new Set(sectionItems.map((item) => item.id)) : new Set());
  };
  const showPlaceholderFeedback = (message: string) => {
    setFeedback(message);
  };
  const handleBulkAction = (action: string) => {
    showPlaceholderFeedback(`${action}: ${selectedIds.size} ${plural(selectedIds.size, "позиция", "позиции", "позиций")}`);
    if (action === "Архивировать") setSelectedIds(new Set());
  };

  useEffect(() => {
    if (!feedback) return;
    const timeout = window.setTimeout(() => setFeedback(""), 2200);
    return () => window.clearTimeout(timeout);
  }, [feedback]);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        {editing ? (
          <SectionPositionNav
            sectionId={selectedSectionId}
            sectionName={section?.name ?? selectedItem?.sectionName ?? "Раздел"}
            items={sectionItems}
            selectedItemId={selectedItemId}
            onBackToSections={() => setEditing(false)}
            onSelectSection={selectSectionInEditor}
            onSelectItem={openItem}
            onAddPosition={addPosition}
            onSectionAction={(action) => showPlaceholderFeedback(`${action}: placeholder`)}
          />
        ) : (
          <CatalogTreePanel
            sections={sections}
            selectedId={selectedSectionId}
            onSelectSection={selectSectionOverview}
            onCreateAction={(action) => showPlaceholderFeedback(`${action}: placeholder`)}
          />
        )}
        {editing ? (
          selectedItem ? (
            <PositionEditor item={selectedItem} />
          ) : (
            <SectionEmptyState sectionName={section?.name ?? "Раздел"} onAddItem={addPosition} />
          )
        ) : (
          <SectionItemList
            section={section}
            items={sectionItems}
            selectedIds={selectedIds}
            feedback={feedback}
            onSelectedChange={setItemSelected}
            onSelectAll={setAllSectionSelected}
            onClearSelection={() => setSelectedIds(new Set())}
            onSectionAction={(action) => showPlaceholderFeedback(`${action}: placeholder`)}
            onBulkAction={handleBulkAction}
            onOpenItem={openItem}
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
          <Search size={14} className="shrink-0 text-[#a6a09b]" />
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
}: {
  children: ReactNode;
  onSelect: () => void;
  tone?: "default" | "danger";
}) {
  return (
    <DropdownMenu.Item
      onSelect={onSelect}
      className={cn(
        "flex h-8 cursor-pointer select-none items-center rounded-lg px-2.5 text-[13px] font-medium outline-none transition data-[highlighted]:bg-[#f5f5f4]",
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
              <ImageOff size={14} className="text-[#bc4a08]" />
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
    <>
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
    </>
  );
}
