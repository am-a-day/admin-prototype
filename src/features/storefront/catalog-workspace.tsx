import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  CaretDown,
  Clock,
  DotsThreeVertical,
  Fire,
  ForkKnife,
  List,
  Lock,
  MegaphoneSimple,
  Tag,
} from "@phosphor-icons/react";
import { ChevronRight, GripVertical, ImageOff, Play, Plus, Search } from "lucide-react";
import { Field, SectionCard } from "@/components/workspace/section-card";
import { TranslatableField } from "@/components/workspace/translatable-field";
import { categories, dishes, getDish } from "@/data/mock-data";
import type { Category, Dish } from "@/data/mock-data";
import { cn } from "@/lib/utils";

export type CatalogPhase = "empty" | "has-sections" | "has-items";

export type CatalogTab = "sections" | "overview" | "upsell";
const CATALOG_TABS: { id: CatalogTab; label: string; count?: number }[] = [
  { id: "sections", label: "Разделы" },
  { id: "upsell", label: "Рекомендации" },
  { id: "overview", label: "Все позиции", count: dishes.length },
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
  const stopCount = dishes.filter((dish) => dish.stop).length;
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

type CatalogTreeSection = Category & { children?: Category[] };
type PanelRow = {
  id: string;
  label: string;
  count?: number;
  icon?: string;
  accent?: boolean;
};
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
  | "quick:with-video"
  | "quick:with-tags"
  | "quick:with-labels"
  | "quick:with-options"
  | "quick:with-recommendations"
  | "quick:no-recommendations"
  | "status:active"
  | "status:archived"
  | "status:hidden"
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
  "quick:with-video": {
    label: "С видео",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} с видео`,
    emptyTitle: "Нет позиций с видео",
    emptyText: "Позиции с видео появятся здесь.",
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
  "status:hidden": {
    label: "Скрытые",
    countText: (count) => `${count} ${plural(count, "позиция скрыта", "позиции скрыты", "позиций скрыты")}`,
    emptyTitle: "Нет скрытых позиций",
    emptyText: "Скрытые позиции появятся здесь.",
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

function parsePrice(price: string) {
  return Number(price.replace(/[^\d]/g, "")) || 0;
}

function getDishAuditState(dish: Dish) {
  const guestPropertiesByDish: Record<string, GuestProperty[]> = {
    pepperoni: [
      { label: "Хит", icon: "label" },
      { label: "Острая", icon: "spicy" },
    ],
    margarita: [
      { label: "Хит", icon: "label" },
      { label: "4 вида сыра", icon: "tag" },
      { label: "Острая", icon: "spicy" },
    ],
    quattro: [
      { label: "4 вида сыра", icon: "tag" },
    ],
    tiramisu: [
      { label: "Новинка", icon: "label" },
    ],
  };

  return {
    archived: dish.id === "quattro",
    hidden: dish.id === "garlic",
    soon: dish.id === "tiramisu",
    scheduled: dish.id === "cola",
    discount: dish.id === "margarita",
    noPhoto: dish.id === "orange" || !dish.emoji,
    noDescription: dish.id === "quattro" || !dish.description.trim(),
    noWeight: dish.id === "garlic" || !dish.weight.trim(),
    noTranslation: dish.id === "orange" || dish.id === "garlic",
    noKbju: dish.id === "orange" || dish.id === "margarita" || dish.id === "tiramisu",
    kbjuPartial: dish.id === "cola",
    hasVideo: dish.id === "pepperoni" || dish.id === "margarita",
    displayMode: (dish.id === "tiramisu" ? "no-price" : dish.id === "garlic" ? "no-button" : "full") as
      | "full"
      | "no-button"
      | "no-price",
    hasOptions: dish.category === "Пицца",
    hasTags: (guestPropertiesByDish[dish.id] ?? []).some((property) => property.icon === "tag"),
    hasLabels: (guestPropertiesByDish[dish.id] ?? []).some((property) => property.icon === "label"),
    guestProperties: guestPropertiesByDish[dish.id] ?? [],
  };
}

function buildCatalogTree(sections: Category[]): CatalogTreeSection[] {
  if (sections.length < 5) return sections;

  return [
    { ...sections[0], children: sections.slice(1, 3) },
    ...sections.slice(3),
  ];
}

function CatalogSidePanel({
  title,
  children,
  actionLabel,
}: {
  title: string;
  children: ReactNode;
  actionLabel?: string;
}) {
  return (
    <aside className="w-[228px] shrink-0 overflow-y-auto border-r border-border bg-[#fbfbf9] px-2 pt-4">
      <div className="mb-4 flex items-center px-2">
        <h2 className="min-w-0 flex-1 text-[14px] font-normal leading-[1.4] text-[#292524]">{title}</h2>
        {actionLabel && (
          <button
            type="button"
            className="flex h-4 w-[84px] items-center justify-end text-[#292524] transition hover:text-[#57534d]"
            aria-label={actionLabel}
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
      {row.icon && (
        <span className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-[#e6e6db] text-[12px]">
          {row.icon}
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
}: {
  sections: Category[];
}) {
  const tree = useMemo(() => buildCatalogTree(sections), [sections]);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ [tree[0]?.id ?? ""]: true });
  const [selectedId, setSelectedId] = useState<string | null>(tree[0]?.id ?? null);

  useEffect(() => {
    const sectionIds = new Set<string>();
    const collectIds = (items: CatalogTreeSection[]) => {
      items.forEach((item) => {
        sectionIds.add(item.id);
        if (item.children) collectIds(item.children);
      });
    };

    collectIds(tree);
    if (!selectedId || !sectionIds.has(selectedId)) {
      setSelectedId(tree[0]?.id ?? null);
    }
  }, [selectedId, tree]);

  const renderSectionRow = (section: CatalogTreeSection, depth = 0) => {
    const hasChildren = Boolean(section.children?.length);
    const isExpanded = expanded[section.id] ?? true;
    const isSelected = section.id === selectedId;

    return (
      <div key={section.id}>
        <div
          role="button"
          tabIndex={0}
          onClick={() => setSelectedId(section.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              setSelectedId(section.id);
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
            <span className={cn("transition", hasChildren && "group-hover:opacity-0")}>{section.emoji}</span>
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
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
            className="ml-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-md text-[#79716b] opacity-0 transition hover:bg-[#e6e6db] hover:text-[#292524] group-hover:opacity-100 group-focus-within:opacity-100"
            aria-label={`Добавить в ${section.name}`}
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

  return (
    <CatalogSidePanel title="Разделы" actionLabel="Добавить раздел">
      <div className="space-y-1">{tree.map((section) => renderSectionRow(section))}</div>
    </CatalogSidePanel>
  );
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

function SectionEmptyState({ sectionName }: { sectionName: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-8">
      <div className="mx-auto w-full max-w-3xl space-y-4">
        <h2 className="text-[18px] font-semibold text-[#292524]">{sectionName}</h2>
        <div className="rounded-[12px] border border-dashed border-[#e7e5e4] bg-[#fafaf9] p-6">
          <div className="flex flex-col gap-3">
            <p className="text-[16px] font-medium leading-[1.4] text-[#44403b]">В разделе пока нет позиций</p>
            <p className="text-[14px] leading-[1.4] text-[#79716b]">
              Добавление позиций появится следующим шагом.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function getOverviewDishes(filterId: OverviewFilterId) {
  if (filterId === "quick:no-description") {
    return dishes.filter((dish) => getDishAuditState(dish).noDescription);
  }
  if (filterId === "quick:no-photo") {
    return dishes.filter((dish) => getDishAuditState(dish).noPhoto);
  }
  if (filterId === "quick:no-weight") {
    return dishes.filter((dish) => getDishAuditState(dish).noWeight);
  }
  if (filterId === "quick:no-kbju") {
    return dishes.filter((dish) => getDishAuditState(dish).noKbju);
  }
  if (filterId === "quick:no-translation") {
    return dishes.filter((dish) => getDishAuditState(dish).noTranslation);
  }
  if (filterId === "quick:with-tags") {
    return dishes.filter((dish) => getDishAuditState(dish).hasTags);
  }
  if (filterId === "quick:with-labels") {
    return dishes.filter((dish) => getDishAuditState(dish).hasLabels);
  }
  if (filterId === "quick:with-options") {
    return dishes.filter((dish) => getDishAuditState(dish).hasOptions);
  }
  if (filterId === "quick:with-video") {
    return dishes.filter((dish) => getDishAuditState(dish).hasVideo);
  }
  if (filterId === "quick:with-recommendations") {
    return dishes.filter((dish) => dish.recommendations.length > 0);
  }
  if (filterId === "quick:no-recommendations") {
    return dishes.filter((dish) => dish.recommendations.length === 0);
  }
  if (filterId === "quick:discount") {
    return dishes.filter((dish) => getDishAuditState(dish).discount);
  }
  if (filterId === "status:active") {
    return dishes.filter((dish) => {
      const state = getDishAuditState(dish);
      return !dish.stop && !state.archived && !state.hidden && !state.soon && !state.scheduled;
    });
  }
  if (filterId === "status:archived") {
    return dishes.filter((dish) => getDishAuditState(dish).archived);
  }
  if (filterId === "status:hidden") {
    return dishes.filter((dish) => getDishAuditState(dish).hidden);
  }
  if (filterId === "status:stop") {
    return dishes.filter((dish) => dish.stop);
  }
  if (filterId === "status:soon") {
    return dishes.filter((dish) => getDishAuditState(dish).soon);
  }
  if (filterId === "status:schedule") {
    return dishes.filter((dish) => getDishAuditState(dish).scheduled);
  }
  return dishes;
}

function CatalogFiltersPanel({
  selectedId,
  onSelect,
  sectionScopeId,
  onSectionScopeChange,
}: {
  selectedId: OverviewFilterId;
  onSelect: (id: OverviewFilterId) => void;
  sectionScopeId: string | null;
  onSectionScopeChange: (id: string | null) => void;
}) {
  const scopeCategory = categories.find((category) => category.id === sectionScopeId) ?? null;
  const countByFilter = (id: OverviewFilterId) =>
    getOverviewDishes(id).filter((dish) => !scopeCategory || dish.category === scopeCategory.name).length;
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
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-[3px] bg-white text-[11px]">
              {scopeCategory ? scopeCategory.emoji : <List size={12} className="text-[#57534d]" />}
            </span>
            <span className="min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px] text-[#292524]">
              {scopeCategory ? scopeCategory.name : "Все разделы"}
            </span>
            <span className="flex h-[14px] w-5 shrink-0 items-center justify-center rounded-[4px] bg-[#efefeb]">
              <CaretDown size={12} className="text-[#79716b]" />
            </span>
          </button>
        </DropdownMenu.Trigger>
        <DropdownContent align="start">
          <DropdownActionItem onSelect={() => onSectionScopeChange(null)}>Все разделы</DropdownActionItem>
          <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
          {categories.map((category) => {
            const count = getOverviewDishes(selectedId).filter((dish) => dish.category === category.name).length;
            return (
              <DropdownActionItem key={category.id} onSelect={() => onSectionScopeChange(category.id)}>
                <span className="flex w-full items-center gap-2">
                  <span>{category.emoji}</span>
                  <span className="min-w-0 flex-1 truncate">{category.name}</span>
                  <span className="text-[12px] text-[#a8a29e]">{count}</span>
                </span>
              </DropdownActionItem>
            );
          })}
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
        {categories.map((category) => (
          <CatalogPanelRow
            key={category.id}
            row={{
              id: category.id,
              label: category.name,
              count: dishes
                .filter((dish) => dish.category === category.name)
                .reduce((sum, dish) => sum + dish.recommendations.length, 0),
              icon: category.emoji,
            }}
            selected={selectedId === category.id}
            onClick={() => onSelect(category.id)}
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
  sections: Category[];
}) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <CatalogTreePanel sections={sections} />
        <SectionEmptyState sectionName={sections[0]?.name ?? "Раздел"} />
      </div>
    </main>
  );
}

// ── Normal populated workspace ────────────────────────────────────────────────

function DishEditorArea({ selectedDishId }: { selectedDishId: string }) {
  const selectedDish = getDish(selectedDishId);

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      <div className="min-w-0 flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl space-y-6">
          <div className="overflow-hidden rounded-[28px] border border-border bg-white">
            <div className="flex">
              <div
                className={cn(
                  "flex h-48 w-56 shrink-0 items-center justify-center bg-gradient-to-br text-7xl",
                  selectedDish.accent,
                )}
              >
                {selectedDish.emoji}
              </div>
              <div className="flex flex-1 flex-col justify-center p-7">
                <div className="text-xs font-black uppercase tracking-wide text-blue-600">
                  {selectedDish.category}
                </div>
                <h1 className="mt-1 text-3xl font-black">{selectedDish.name}</h1>
                <p className="mt-3 text-sm leading-6 text-muted-foreground">
                  {selectedDish.description}
                </p>
              </div>
            </div>
          </div>
          <SectionCard>
            <div data-tour="dish-fields" className="grid grid-cols-2 gap-4">
              <TranslatableField
                key={`name-${selectedDish.id}`}
                label="Название"
                initialTranslations={{ ru: selectedDish.name }}
              />
              <Field label="Раздел" value={selectedDish.category} />
              <Field label="Цена" value={selectedDish.price} />
              <Field label="Вес / объем" value={selectedDish.weight} />
              <div className="col-span-2">
                <TranslatableField
                  key={`desc-${selectedDish.id}`}
                  label="Описание"
                  multiline
                  initialTranslations={{ ru: selectedDish.description }}
                />
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </div>
  );
}

function PopulatedWorkspace({
  selectedDishId,
  sections,
}: {
  selectedDishId: string;
  sections: Category[];
}) {
  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <CatalogTreePanel sections={sections} />
        <DishEditorArea selectedDishId={selectedDishId} />
      </div>
    </main>
  );
}

function getStatusChips(dish: Dish): AuditChip[] {
  const state = getDishAuditState(dish);
  const chips: AuditChip[] = [];
  if (dish.stop) chips.push({ label: "На стопе", tone: "stop" });
  if (state.archived) chips.push({ label: "В архиве", tone: "archived" });
  if (state.hidden) chips.push({ label: "Скрыта", tone: "status" });
  if (state.soon) chips.push({ label: "Скоро будет", tone: "status" });
  if (state.scheduled) chips.push({ label: "С расписанием", tone: "status" });
  if (state.displayMode === "no-button") chips.push({ label: "Без кнопки", tone: "status" });
  if (state.displayMode === "no-price") chips.push({ label: "Без цены", tone: "status" });
  return chips;
}

// ── Audit table (Figma 979:10759) ─────────────────────────────────────────────

const TRANSLATION_TOTAL = 3;
const TABLE_COL = {
  description: "w-[87px]",
  weight: "w-[58px]",
  kbju: "w-[62px]",
  translation: "w-[80px]",
  price: "w-[82px]",
  kebab: "w-[40px]",
};

function TableCheckbox({ ariaLabel }: { ariaLabel: string }) {
  return (
    <input
      type="checkbox"
      aria-label={ariaLabel}
      className="h-[18px] w-[18px] shrink-0 cursor-pointer appearance-none rounded-[5px] border border-[#d6d3d1] bg-white transition checked:border-[#292524] checked:bg-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
    />
  );
}

function AuditDot({ state, title }: { state: "filled" | "partial" | "missing"; title: string }) {
  return (
    <span className="flex items-center justify-center" title={title}>
      {state === "filled" && <span className="h-[7px] w-[7px] rounded-full bg-[#006045]" />}
      {state === "partial" && <span className="h-[9px] w-[9px] rounded-full border-[1.5px] border-[#006045]" />}
      {state === "missing" && <span className="text-[13px] leading-none text-[#a6a09b]">—</span>}
    </span>
  );
}

function TableHeaderRow({ query, onQueryChange }: { query: string; onQueryChange: (value: string) => void }) {
  const labels: [string, string][] = [
    ["Описание", TABLE_COL.description],
    ["Вес", TABLE_COL.weight],
    ["КБЖУ", TABLE_COL.kbju],
    ["Перевод", TABLE_COL.translation],
    ["Цена", TABLE_COL.price],
  ];

  return (
    <div className="sticky top-0 z-10 flex items-center bg-white">
      <div className="flex min-w-0 flex-1 items-center py-3 pr-3">
        <div className="flex h-[34px] min-w-0 flex-1 items-center gap-1.5 rounded-[7px] border border-[#e7e5e4] px-[7px]">
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
          className={cn("flex shrink-0 items-center justify-center p-3 text-[13px] leading-5 text-[#79716b]", width)}
        >
          {label}
        </span>
      ))}
      <span className={cn("h-[44px] shrink-0", TABLE_COL.kebab)} />
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

function RowMeta({ dish, showSectionMeta }: { dish: Dish; showSectionMeta?: boolean }) {
  const state = getDishAuditState(dish);
  const statusChips = getStatusChips(dish);
  const counts: string[] = [];
  if (showSectionMeta) counts.push(dish.category);
  if (state.hasOptions) counts.push("2 опции");
  if (dish.recommendations.length > 0) {
    counts.push(
      `${dish.recommendations.length} ${plural(dish.recommendations.length, "рекомендация", "рекомендации", "рекомендаций")}`,
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
  if (state.guestProperties.length > 0) {
    segments.push(
      <span key="attributes" className="flex items-center gap-[3px]">
        {state.guestProperties.map((property, index) => (
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

function AuditRowActionsMenu({ dish, onAction }: { dish: Dish; onAction: (action: string) => void }) {
  const state = getDishAuditState(dish);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#57534d] transition hover:bg-[#efefea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          aria-label={`Действия для ${dish.name}`}
        >
          <DotsThreeVertical size={18} weight="bold" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent>
        <DropdownActionItem onSelect={() => onAction("Открыть позицию")}>Открыть позицию</DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction("Редактировать")}>Редактировать</DropdownActionItem>
        <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
        <DropdownActionItem onSelect={() => onAction(state.hidden ? "Показать" : "Скрыть")}>
          {state.hidden ? "Показать" : "Скрыть"}
        </DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction(dish.stop ? "Убрать со стопа" : "На стоп")}>
          {dish.stop ? "Убрать со стопа" : "На стоп"}
        </DropdownActionItem>
        <DropdownActionItem onSelect={() => onAction(state.archived ? "Восстановить" : "В архив")} tone={state.archived ? "default" : "danger"}>
          {state.archived ? "Восстановить" : "В архив"}
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
  dish,
  showSectionMeta,
  onAction,
}: {
  dish: Dish;
  showSectionMeta?: boolean;
  onAction: (dish: Dish, action: string) => void;
}) {
  const state = getDishAuditState(dish);
  const translated = state.noTranslation ? 1 : TRANSLATION_TOTAL;
  const oldPrice = state.discount ? `${Math.round((parsePrice(dish.price) * 1.18) / 100) * 100} ₸` : null;

  return (
    <div className="group flex h-[62px] items-center border-b border-[#e5e7eb] bg-white transition hover:bg-[#fafaf9]">
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TableCheckbox ariaLabel={`Выбрать ${dish.name}`} />
        <div className="flex min-w-0 items-center gap-[9px]">
          <span
            className={cn(
              "relative flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] text-[18px]",
              state.noPhoto ? "bg-[#faf0e6]" : "bg-[#f5f5f4]",
            )}
            title={state.noPhoto ? "Нет фото" : undefined}
          >
            {state.noPhoto ? <ImageOff size={14} className="text-[#bc4a08]" /> : dish.emoji}
            {state.hasVideo && (
              <span
                className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white shadow-[0_0_0_1px_#e7e5e4]"
                title="Есть видео"
              >
                <Play size={7} className="ml-px fill-[#57534d] text-[#57534d]" />
              </span>
            )}
          </span>
          <div className="flex min-w-0 flex-col justify-center gap-1.5">
            <button
              type="button"
              onClick={() => onAction(dish, "Открыть позицию")}
              className="block max-w-full truncate text-left text-[13px] leading-none text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              {dish.name}
            </button>
            <RowMeta dish={dish} showSectionMeta={showSectionMeta} />
          </div>
        </div>
      </div>
      <span className={cn("flex shrink-0 items-center justify-center px-3", TABLE_COL.description)}>
        <AuditDot
          state={state.noDescription ? "missing" : "filled"}
          title={state.noDescription ? "Нет описания" : "Описание есть"}
        />
      </span>
      <span
        className={cn("flex shrink-0 items-center justify-center px-3 text-[13px] leading-5 text-[#292524]", TABLE_COL.weight)}
        title={state.noWeight ? "Нет граммовки" : `Граммовка: ${dish.weight}`}
      >
        {state.noWeight ? <span className="text-[#a6a09b]">—</span> : dish.weight}
      </span>
      <span className={cn("flex shrink-0 items-center justify-center px-3", TABLE_COL.kbju)}>
        <AuditDot
          state={state.noKbju ? "missing" : state.kbjuPartial ? "partial" : "filled"}
          title={
            state.noKbju
              ? "Нет КБЖУ"
              : state.kbjuPartial
                ? "КБЖУ (на 100 г) заполнено частично"
                : "КБЖУ (на 100 г) заполнено"
          }
        />
      </span>
      <span
        className={cn("flex shrink-0 items-center justify-center px-3 text-[13px] leading-5 text-[#292524]", TABLE_COL.translation)}
        title={`Перевод: ${translated} из ${TRANSLATION_TOTAL} языков`}
      >
        {translated}/{TRANSLATION_TOTAL}
      </span>
      <span
        className={cn(
          "flex shrink-0 flex-col items-center justify-center px-3 text-[13px] leading-5 text-[#292524]",
          TABLE_COL.price,
        )}
      >
        <span className="whitespace-nowrap">{dish.price}</span>
        {oldPrice && <span className="text-[11px] leading-3 text-[#a6a09b] line-through">{oldPrice}</span>}
      </span>
      <span className={cn("flex shrink-0 items-center justify-center", TABLE_COL.kebab)}>
        <AuditRowActionsMenu dish={dish} onAction={(action) => onAction(dish, action)} />
      </span>
    </div>
  );
}

type ProblemLink = { id: OverviewFilterId; label: string };

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
  const [query, setQuery] = useState("");
  const [sectionScopeId, setSectionScopeId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Record<string, boolean>>({});
  const scopeCategory = categories.find((category) => category.id === sectionScopeId) ?? null;
  const inScope = (dish: Dish) => !scopeCategory || dish.category === scopeCategory.name;
  const filtered = getOverviewDishes(filterId).filter(inScope);
  const searched = filtered.filter((dish) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return [dish.name, dish.category, dish.description].some((value) =>
      value.toLowerCase().includes(normalized),
    );
  });
  const visible = [...searched].sort((left, right) => left.name.localeCompare(right.name, "ru"));
  const grouped = categories
    .map((category) => ({
      ...category,
      items: visible.filter((dish) => dish.category === category.name),
    }))
    .filter((group) => group.items.length > 0);
  const statusMeta = OVERVIEW_FILTER_META[filterId];
  const flat = query.trim().length > 0;

  const stopCount = getOverviewDishes("status:stop").filter(inScope).length;
  const problems: ProblemLink[] =
    filterId !== "status:stop" && stopCount > 0
      ? [{ id: "status:stop", label: `${stopCount} на стопе` }]
      : [];

  const resetFilter = () => {
    setQuery("");
    setSectionScopeId(null);
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

  const prepareRowAction = () => {};

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <CatalogFiltersPanel
          selectedId={filterId}
          onSelect={onFilterChange}
          sectionScopeId={sectionScopeId}
          onSectionScopeChange={setSectionScopeId}
        />
        <div className="min-w-0 flex-1 overflow-y-auto px-6 pb-10 pt-[14px]">
          <div className="min-w-0">
            <OverviewStatusBar
              filterId={filterId}
              count={visible.length}
              query={query}
              scopeName={scopeCategory?.name}
              problems={problems}
              onProblemClick={onFilterChange}
            />
            <div className="pt-[14px]">
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
                    {filterId === "quick:all" && !query.trim() && !scopeCategory ? (
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
                  <TableHeaderRow query={query} onQueryChange={setQuery} />
                  {flat ? (
                    <div>
                      {visible.map((dish) => (
                        <AuditDishRow key={dish.id} dish={dish} showSectionMeta onAction={prepareRowAction} />
                      ))}
                    </div>
                  ) : (
                    <div className="flex flex-col gap-[38px] pt-1">
                      {grouped.map((group) => {
                        const isCollapsed = Boolean(collapsedSections[group.id]);
                        return (
                          <section key={group.id} className="flex flex-col gap-[10px]">
                            <div className="sticky top-[58px] z-[9] flex items-center gap-2 bg-white">
                              <TableCheckbox ariaLabel={`Выбрать раздел ${group.name}`} />
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
                            </div>
                            {!isCollapsed && (
                              <div>
                                {group.items.map((dish) => (
                                  <AuditDishRow key={dish.id} dish={dish} onAction={prepareRowAction} />
                                ))}
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  )}
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
  const [selectedContextId, setSelectedContextId] = useState(categories[0]?.id ?? "all");

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <CatalogContextPanel selectedId={selectedContextId} onSelect={setSelectedContextId} />
        <SectionEmptyState
          sectionName={categories.find((category) => category.id === selectedContextId)?.name ?? "Рекомендации"}
        />
      </div>
    </main>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CatalogWorkspace({
  selectedDishId,
  catalogPhase,
  catalogTab,
  overviewFilterId,
  onOverviewFilterChange,
  onAdvancePhase,
}: CatalogWorkspaceProps) {
  const [createdSectionName, setCreatedSectionName] = useState(CREATED_SECTION.name);
  const [sectionDialogOpen, setSectionDialogOpen] = useState(false);
  const sections =
    catalogPhase === "empty"
      ? []
      : catalogPhase === "has-sections"
        ? [{ ...CREATED_SECTION, name: createdSectionName }]
        : categories;

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
      <PopulatedWorkspace
        selectedDishId={selectedDishId}
        sections={sections}
      />
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
