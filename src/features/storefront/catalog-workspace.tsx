import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Fire, ForkKnife, SealCheck, Tag } from "@phosphor-icons/react";
import { ChevronDown, ChevronRight, GripVertical, MoreVertical, Plus, Search } from "lucide-react";
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
  | "quick:with-tags"
  | "quick:with-labels"
  | "quick:with-options"
  | "status:active"
  | "status:archived"
  | "status:hidden"
  | "status:stop"
  | "status:soon"
  | "status:schedule";
type OverviewSortId = "name" | "price" | "category" | "status";

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
    label: "С лейблами",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} с лейблами`,
    emptyTitle: "Нет позиций с лейблами",
    emptyText: "Позиции с лейблами появятся здесь.",
  },
  "quick:with-options": {
    label: "С опциями",
    countText: (count) => `${count} ${plural(count, "позиция", "позиции", "позиций")} с опциями`,
    emptyTitle: "Нет позиций с опциями",
    emptyText: "Позиции с опциями появятся здесь.",
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
          selected ? "text-[#57534d]" : "text-[#a8a29e]",
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
  if (filterId === "quick:discount") {
    return dishes.filter((dish) => getDishAuditState(dish).discount);
  }
  if (filterId === "status:active") {
    return dishes.filter((dish) => {
      const state = getDishAuditState(dish);
      return !dish.stop && !state.archived && !state.hidden && !state.soon;
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
}: {
  selectedId: OverviewFilterId;
  onSelect: (id: OverviewFilterId) => void;
}) {
  const countByFilter = (id: OverviewFilterId) => getOverviewDishes(id).length;
  const groups: { title: string; rows: PanelRow[] }[] = [
    {
      title: "Состояние",
      rows: [
        { id: "quick:all", label: "Все", count: countByFilter("quick:all") },
        { id: "status:active", label: "Активные", count: countByFilter("status:active") },
        { id: "status:archived", label: "В архиве", count: countByFilter("status:archived") },
        { id: "status:hidden", label: "Скрытые", count: countByFilter("status:hidden") },
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
        { id: "quick:discount", label: "Со скидкой", count: countByFilter("quick:discount") },
        { id: "quick:with-tags", label: "С тегами", count: countByFilter("quick:with-tags") },
        { id: "quick:with-labels", label: "С лейблами", count: countByFilter("quick:with-labels") },
        { id: "quick:with-options", label: "С опциями", count: countByFilter("quick:with-options") },
      ],
    },
  ];

  return (
    <CatalogSidePanel title="Все позиции">
      <div className="space-y-4">
        {groups.map((group) => (
          <div key={group.title}>
            <div className="mb-1 px-2 text-[11px] font-medium leading-[18px] text-[#a8a29e]">
              {group.title}
            </div>
            <div className="space-y-1">
              {group.rows.map((row) => (
                <CatalogPanelRow
                  key={row.id}
                  row={row}
                  selected={selectedId === row.id}
                  onClick={() => onSelect(row.id as OverviewFilterId)}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </CatalogSidePanel>
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

function getDishAuditChips(dish: Dish, filterId: OverviewFilterId): AuditChip[] {
  const state = getDishAuditState(dish);
  const chips: AuditChip[] = [];
  if (dish.stop) chips.push({ label: "На стопе", tone: "stop" });
  if (state.archived) chips.push({ label: "В архиве", tone: "archived" });
  if (state.hidden) chips.push({ label: "Скрыта", tone: "status" });
  if (state.soon) chips.push({ label: "Скоро будет", tone: "status" });
  if (state.scheduled) chips.push({ label: "По расписанию", tone: "status" });
  if (state.noPhoto) chips.push({ label: "Без фото", tone: "problem" });
  if (state.noDescription) chips.push({ label: "Без описания", tone: "problem" });
  if (state.noWeight) chips.push({ label: "Без граммовки", tone: "problem" });
  if (state.noKbju || filterId === "quick:no-kbju") chips.push({ label: "Без КБЖУ", tone: "problem" });
  if (state.noTranslation) chips.push({ label: "Без перевода", tone: "problem" });
  return chips;
}

function DishPrice({ dish }: { dish: Dish }) {
  const state = getDishAuditState(dish);
  const oldPrice = state.discount ? `${Math.round(parsePrice(dish.price) * 1.18 / 100) * 100} ₸` : null;

  return (
    <span className="min-w-[76px] shrink-0 text-right">
      <span className="block text-[14px] font-medium leading-5 text-[#292524]">{dish.price}</span>
      {oldPrice && (
        <span className="block text-[12px] leading-4 text-[#a8a29e] line-through">{oldPrice}</span>
      )}
    </span>
  );
}

function AuditChipBadge({ chip }: { chip: AuditChip }) {
  return (
    <span
      className={cn(
        "inline-flex h-[24px] items-center rounded-full px-2.5 text-[12px] font-medium leading-none",
        chip.tone === "stop" && "bg-[#bc4a08] text-white",
        chip.tone === "archived" && "bg-[#f5f5f4] text-[#a16207] ring-1 ring-[#e7e5e4]",
        chip.tone === "status" && "bg-[#efefea] text-[#57534d]",
        chip.tone === "problem" && "bg-[#f5f5f4] text-[#79716b]",
      )}
    >
      {chip.label}
    </span>
  );
}

function GuestPropertyIcon({ icon }: { icon: GuestProperty["icon"] }) {
  if (icon === "label") return <SealCheck size={14} weight="fill" className="text-[#79716b]" />;
  if (icon === "tag") return <Tag size={14} weight="fill" className="text-[#79716b]" />;
  if (icon === "spicy") return <Fire size={14} weight="fill" className="text-[#79716b]" />;
  return null;
}

function AuditPropertyLine({
  dish,
  filterId,
  showSectionMeta,
}: {
  dish: Dish;
  filterId: OverviewFilterId;
  showSectionMeta?: boolean;
}) {
  const state = getDishAuditState(dish);
  const kcalByDish: Record<string, string> = {
    pepperoni: "139 ккал",
    quattro: "143 ккал",
    cola: "42 ккал",
    garlic: "118 ккал",
  };
  const properties: GuestProperty[] = [
    ...state.guestProperties,
    showSectionMeta ? { label: dish.category } : null,
    filterId === "quick:with-options" && state.hasOptions ? { label: "2 опции" } : null,
    !state.noWeight && dish.weight.trim() ? { label: dish.weight } : null,
    !state.noKbju && kcalByDish[dish.id] ? { label: kcalByDish[dish.id] } : null,
  ].filter((property): property is GuestProperty => Boolean(property));

  if (properties.length === 0) return null;

  return (
    <span className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[14px] leading-5 text-[#79716b]">
      {properties.map((property, index) => (
        <span key={`${property.label}-${index}`} className="inline-flex items-center gap-1.5">
          {index > 0 && <span className="text-[#d6d3d1]">·</span>}
          <span className="inline-flex items-center gap-1">
            <GuestPropertyIcon icon={property.icon} />
            <span>{property.label}</span>
          </span>
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

function getQuickActionLabel(dish: Dish) {
  const state = getDishAuditState(dish);
  if (dish.stop) return "Убрать со стопа";
  if (state.archived) return "Восстановить";
  if (state.hidden) return "Показать";
  return null;
}

function AuditRowActionsMenu({ dish, onAction }: { dish: Dish; onAction: (action: string) => void }) {
  const state = getDishAuditState(dish);

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a8a29e] transition hover:bg-[#efefea] hover:text-[#57534d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          aria-label={`Действия для ${dish.name}`}
        >
          <MoreVertical size={16} />
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
  filterId,
  selected,
  onSelectedChange,
  onAction,
}: {
  dish: Dish;
  filterId: OverviewFilterId;
  selected: boolean;
  onSelectedChange: (checked: boolean) => void;
  onAction: (dish: Dish, action: string) => void;
}) {
  const chips = getDishAuditChips(dish, filterId);
  const visibleChips = chips.slice(0, 3);
  const hiddenChipCount = Math.max(0, chips.length - visibleChips.length);
  const state = getDishAuditState(dish);
  const quickActionLabel = getQuickActionLabel(dish);

  return (
    <div
      className={cn(
        "group flex w-full items-center gap-3 border-b border-[#eceae7] bg-white px-0 py-3 text-left transition hover:bg-[#fafaf9]",
        selected && "bg-[#fafaf9]",
      )}
    >
      <label className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg hover:bg-[#efefea]">
        <input
          type="checkbox"
          checked={selected}
          onChange={(event) => onSelectedChange(event.target.checked)}
          className="h-[18px] w-[18px] rounded-[6px] border-[#d6d3d1] text-[#292524] accent-[#292524]"
          aria-label={`Выбрать ${dish.name}`}
        />
      </label>
      <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-[12px] bg-[#f5f5f4] text-[28px]">
        {state.noPhoto ? <span className="text-[20px] text-[#a8a29e]">□</span> : dish.emoji}
      </span>
      <button
        type="button"
        onClick={() => onAction(dish, "Открыть позицию")}
        className="min-w-0 flex-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      >
        <span className="flex min-w-0 items-start justify-between gap-4">
          <span className="min-w-0">
            {visibleChips.length > 0 && (
              <span className="mb-1.5 flex flex-wrap gap-1.5">
                {visibleChips.map((chip) => (
                  <AuditChipBadge key={chip.label} chip={chip} />
                ))}
                {hiddenChipCount > 0 && (
                  <span className="inline-flex h-[24px] items-center rounded-full bg-[#f5f5f4] px-2.5 text-[12px] font-medium leading-none text-[#a8a29e]">
                    +{hiddenChipCount}
                  </span>
                )}
              </span>
            )}
            <span className="block truncate text-[15px] font-semibold leading-5 text-[#44403b]">{dish.name}</span>
            <AuditPropertyLine dish={dish} filterId={filterId} showSectionMeta={false} />
          </span>
        </span>
      </button>
      <span className="flex shrink-0 items-start gap-3">
        {quickActionLabel && (
          <button
            type="button"
            onClick={() => onAction(dish, quickActionLabel)}
            className="mt-0.5 hidden rounded-lg px-2 py-1 text-[12px] font-medium text-[#79716b] transition hover:bg-[#efefea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 group-hover:inline-flex"
          >
            {quickActionLabel}
          </button>
        )}
        <DishPrice dish={dish} />
        <AuditRowActionsMenu dish={dish} onAction={(action) => onAction(dish, action)} />
      </span>
    </div>
  );
}

function OverviewStatusBar({
  filterId,
  count,
  query,
}: {
  filterId: OverviewFilterId;
  count: number;
  query: string;
}) {
  const meta = OVERVIEW_FILTER_META[filterId];

  return (
    <div className="min-w-0">
      <div className="text-[18px] font-semibold leading-6 text-[#292524]">{meta.label}</div>
      {filterId !== "quick:all" && (
        <div className="mt-1 text-[13px] leading-5 text-[#79716b]">
          {meta.label} — {meta.countText(count)}
          {query.trim() && <span> · с учётом поиска</span>}
        </div>
      )}
    </div>
  );
}

function BulkActionMenu({
  label,
  items,
  onAction,
}: {
  label: string;
  items: string[];
  onAction: (action: string) => void;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          className="inline-flex h-8 items-center gap-1.5 rounded-[10px] border border-[#e7e5e4] bg-white px-2.5 text-[13px] font-medium text-[#57534d] transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          {label}
          <ChevronDown size={14} />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent align="start">
        {items.map((item) => (
          <DropdownActionItem key={item} onSelect={() => onAction(`${label}: ${item}`)}>
            {item}
          </DropdownActionItem>
        ))}
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

function SelectionToolbar({
  selectedCount,
  discountOpen,
  discountValue,
  onDiscountOpenChange,
  onDiscountValueChange,
  onApplyDiscount,
  onClear,
  onAction,
}: {
  selectedCount: number;
  discountOpen: boolean;
  discountValue: string;
  onDiscountOpenChange: (open: boolean) => void;
  onDiscountValueChange: (value: string) => void;
  onApplyDiscount: () => void;
  onClear: () => void;
  onAction: (action: string) => void;
}) {
  if (selectedCount === 0) return null;

  return (
    <div className="rounded-[14px] border border-[#e7e5e4] bg-[#fbfbf9] px-3 py-2 shadow-[0_1px_2px_rgba(41,37,36,0.04)]">
      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[13px] font-medium text-[#292524]">
          Выбрано: {selectedCount}
        </span>
        <BulkActionMenu
          label="Статус"
          items={["Активна", "Скрыта", "В архиве"]}
          onAction={onAction}
        />
        <BulkActionMenu
          label="Доступность"
          items={["Доступна", "На стопе", "Скоро будет", "По расписанию"]}
          onAction={onAction}
        />
        <button
          type="button"
          onClick={() => onDiscountOpenChange(!discountOpen)}
          className="inline-flex h-8 items-center rounded-[10px] border border-[#e7e5e4] bg-white px-2.5 text-[13px] font-medium text-[#57534d] transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          Задать скидку
        </button>
        <button
          type="button"
          onClick={onClear}
          className="ml-auto inline-flex h-8 items-center rounded-[10px] px-2.5 text-[13px] font-medium text-[#79716b] transition hover:bg-[#efefea] hover:text-[#292524]"
        >
          Снять выбор
        </button>
      </div>
      {discountOpen && (
        <div className="mt-2 flex flex-wrap items-center gap-2 border-t border-[#eceae7] pt-2">
          <label className="text-[13px] font-medium text-[#57534d]" htmlFor="bulk-discount-input">
            Скидка
          </label>
          <input
            id="bulk-discount-input"
            value={discountValue}
            onChange={(event) => onDiscountValueChange(event.target.value)}
            placeholder="Например, 15%"
            className="h-8 w-[160px] rounded-[10px] border border-[#e7e5e4] bg-white px-2.5 text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e] focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5"
          />
          <button
            type="button"
            onClick={onApplyDiscount}
            disabled={!discountValue.trim()}
            className="inline-flex h-8 items-center rounded-[10px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b] disabled:opacity-40"
          >
            Применить
          </button>
        </div>
      )}
    </div>
  );
}

function SectionNavigation({
  groups,
  activeId,
  onSelect,
}: {
  groups: Array<Category & { items: Dish[] }>;
  activeId: string | null;
  onSelect: (id: string) => void;
}) {
  if (groups.length <= 1) return null;

  return (
    <aside className="sticky top-0 hidden w-[168px] shrink-0 pt-1 lg:block">
      <div className="relative border-l border-[#e7e5e4] pl-3">
        <div className="mb-2 text-[11px] font-medium leading-[18px] text-[#a8a29e]">По разделам</div>
        <div className="space-y-1">
          {groups.map((group) => {
            const active = activeId === group.id;
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => onSelect(group.id)}
                className={cn(
                  "relative flex h-8 w-full items-center justify-between gap-2 rounded-lg px-2 text-left text-[13px] font-medium transition",
                  active ? "text-[#292524]" : "text-[#79716b] hover:bg-[#f5f5f4] hover:text-[#292524]",
                )}
              >
                {active && <span className="absolute -left-[13px] h-5 w-[2px] rounded-full bg-[#292524]" />}
                <span className="truncate">{group.name}</span>
                <span className="shrink-0 text-[12px] text-[#a8a29e]">{group.items.length}</span>
              </button>
            );
          })}
        </div>
      </div>
    </aside>
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
  const [sortId, setSortId] = useState<OverviewSortId>("name");
  const [activeSectionId, setActiveSectionId] = useState<string | null>(null);
  const [selectedDishIds, setSelectedDishIds] = useState<string[]>([]);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountValue, setDiscountValue] = useState("");
  const [lastPreparedAction, setLastPreparedAction] = useState<string | null>(null);
  const sectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const filtered = getOverviewDishes(filterId);
  const searched = filtered.filter((dish) => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return true;
    return [dish.name, dish.category, dish.description].some((value) =>
      value.toLowerCase().includes(normalized),
    );
  });
  const visible = [...searched].sort((left, right) => {
    if (sortId === "price") return parsePrice(left.price) - parsePrice(right.price);
    if (sortId === "category") return left.category.localeCompare(right.category, "ru");
    if (sortId === "status") {
      const leftStatus = getDishAuditState(left).archived ? 3 : left.stop ? 0 : getDishAuditState(left).soon ? 1 : 2;
      const rightStatus = getDishAuditState(right).archived ? 3 : right.stop ? 0 : getDishAuditState(right).soon ? 1 : 2;
      return leftStatus - rightStatus || left.name.localeCompare(right.name, "ru");
    }
    return left.name.localeCompare(right.name, "ru");
  });
  const grouped = categories
    .map((category) => ({
      ...category,
      items: visible.filter((dish) => dish.category === category.name),
    }))
    .filter((group) => group.items.length > 0);
  const statusMeta = OVERVIEW_FILTER_META[filterId];
  const visibleDishIds = visible.map((dish) => dish.id);
  const selectedVisibleCount = selectedDishIds.filter((id) => visibleDishIds.includes(id)).length;

  useEffect(() => {
    if (grouped.length === 0) {
      setActiveSectionId(null);
      return;
    }
    setActiveSectionId((current) => current && grouped.some((group) => group.id === current) ? current : grouped[0].id);
  }, [grouped]);

  useEffect(() => {
    setSelectedDishIds((current) => current.filter((id) => visibleDishIds.includes(id)));
  }, [visibleDishIds.join("|")]);

  const resetFilter = () => {
    setQuery("");
    onFilterChange("quick:all");
  };
  const emptyTitle = statusMeta.emptyTitle;
  const emptyText = statusMeta.emptyText;

  const scrollToSection = (id: string) => {
    setActiveSectionId(id);
    sectionRefs.current[id]?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const toggleDishSelection = (dishId: string, checked: boolean) => {
    setSelectedDishIds((current) => {
      if (checked) return current.includes(dishId) ? current : [...current, dishId];
      return current.filter((id) => id !== dishId);
    });
  };

  const prepareBulkAction = (action: string) => {
    setLastPreparedAction(`${action} · ${selectedVisibleCount} выбрано`);
  };

  const applyDiscount = () => {
    if (!discountValue.trim()) return;
    setLastPreparedAction(`Скидка ${discountValue.trim()} · ${selectedVisibleCount} выбрано`);
    setDiscountOpen(false);
    setDiscountValue("");
  };

  const prepareRowAction = (dish: Dish, action: string) => {
    setLastPreparedAction(`${action} · ${dish.name}`);
  };

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <CatalogFiltersPanel selectedId={filterId} onSelect={onFilterChange} />
        <div className="min-w-0 flex-1 overflow-y-auto p-8">
          <div className="mx-auto flex w-full max-w-6xl items-start gap-6">
            <div className="min-w-0 flex-1 space-y-5">
              <div className="rounded-[16px] border border-[#eceae7] bg-white p-4 shadow-[0_1px_2px_rgba(41,37,36,0.04)]">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <OverviewStatusBar filterId={filterId} count={visible.length} query={query} />
                  {lastPreparedAction && (
                    <div className="rounded-full bg-[#f5f5f4] px-2.5 py-1 text-[12px] font-medium text-[#79716b]">
                      Подготовлено: {lastPreparedAction}
                    </div>
                  )}
                </div>
                <div className="mt-4 flex items-center gap-2">
                  <div className="flex h-9 min-w-0 flex-1 items-center rounded-[12px] border border-[#e7e5e4] bg-white px-3 text-[14px] text-[#79716b]">
                    <Search size={16} className="mr-2 shrink-0 text-[#a8a29e]" />
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Найти позицию"
                      className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-[#a8a29e]"
                    />
                  </div>
                  <label className="sr-only" htmlFor="catalog-overview-sort">Сортировка</label>
                  <select
                    id="catalog-overview-sort"
                    value={sortId}
                    onChange={(event) => setSortId(event.target.value as OverviewSortId)}
                    className="h-9 rounded-[12px] border border-[#e7e5e4] bg-white px-3 text-[13px] font-medium text-[#57534d] outline-none transition hover:bg-[#fafaf9] focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5"
                  >
                    <option value="name">По названию</option>
                    <option value="price">По цене</option>
                    <option value="category">По разделу</option>
                    <option value="status">По статусу</option>
                  </select>
                </div>
              </div>
              <SelectionToolbar
                selectedCount={selectedVisibleCount}
                discountOpen={discountOpen}
                discountValue={discountValue}
                onDiscountOpenChange={setDiscountOpen}
                onDiscountValueChange={setDiscountValue}
                onApplyDiscount={applyDiscount}
                onClear={() => setSelectedDishIds([])}
                onAction={prepareBulkAction}
              />

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
                    <button
                      type="button"
                      onClick={resetFilter}
                      className="inline-flex h-[32px] self-start items-center justify-center rounded-[10px] bg-[#4f39f6] px-[10px] text-[14px] font-medium text-white transition hover:bg-[#4030d4]"
                    >
                      Показать все позиции
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-7">
                  {grouped.map((group) => (
                    <section
                      key={group.id}
                      ref={(node) => {
                        sectionRefs.current[group.id] = node;
                      }}
                      className="scroll-mt-6 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <h2 className="text-[16px] font-semibold text-[#292524]">{group.name}</h2>
                        <span className="text-[13px] font-medium text-[#a8a29e]">{group.items.length}</span>
                      </div>
                      <div className="space-y-2">
                        {group.items.map((dish) => (
                          <AuditDishRow
                            key={dish.id}
                            dish={dish}
                            filterId={filterId}
                            selected={selectedDishIds.includes(dish.id)}
                            onSelectedChange={(checked) => toggleDishSelection(dish.id, checked)}
                            onAction={prepareRowAction}
                          />
                        ))}
                      </div>
                    </section>
                  ))}
                </div>
              )}
            </div>

            <SectionNavigation groups={grouped} activeId={activeSectionId} onSelect={scrollToSection} />
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
