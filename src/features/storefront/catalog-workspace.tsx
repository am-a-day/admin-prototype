import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { ForkKnife } from "@phosphor-icons/react";
import { ChevronRight, GripVertical, MoreVertical, Plus, Search } from "lucide-react";
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
  return {
    archived: dish.id === "quattro",
    hidden: dish.id === "garlic",
    soon: dish.id === "tiramisu",
    scheduled: dish.id === "cola",
    discount: dish.id === "margarita",
    noTranslation: dish.id === "orange" || dish.id === "garlic",
    noKbju: dish.id === "orange" || dish.id === "margarita" || dish.id === "tiramisu",
    hasOptions: dish.category === "Пицца",
    hasTags: dish.recommendations.length > 0,
    hasLabels: dish.stop,
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
      <span className="mr-2 flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px] bg-[#e6e6db] text-[12px]">
        {row.icon ?? "•"}
      </span>
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
    return dishes.filter((dish) => !dish.description.trim());
  }
  if (filterId === "quick:no-photo") {
    return dishes.filter((dish) => !dish.emoji);
  }
  if (filterId === "quick:no-weight") {
    return dishes.filter((dish) => !dish.weight.trim());
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
        { id: "quick:all", label: "Все", count: countByFilter("quick:all"), icon: "≡" },
        { id: "status:active", label: "Активные", count: countByFilter("status:active"), icon: "✓" },
        { id: "status:archived", label: "В архиве", count: countByFilter("status:archived"), icon: "↧" },
        { id: "status:hidden", label: "Скрытые", count: countByFilter("status:hidden"), icon: "◌" },
      ],
    },
    {
      title: "Доступность",
      rows: [
        { id: "status:stop", label: "На стопе", count: countByFilter("status:stop"), icon: "!" },
        { id: "status:soon", label: "Скоро будут", count: countByFilter("status:soon"), icon: "⏱" },
        { id: "status:schedule", label: "По расписанию", count: countByFilter("status:schedule"), icon: "⌁" },
      ],
    },
    {
      title: "Заполненность",
      rows: [
        { id: "quick:no-description", label: "Без описания", count: countByFilter("quick:no-description"), icon: "…" },
        { id: "quick:no-photo", label: "Без фото", count: countByFilter("quick:no-photo"), icon: "□" },
        { id: "quick:no-weight", label: "Без граммовки", count: countByFilter("quick:no-weight"), icon: "г" },
        { id: "quick:no-kbju", label: "Без КБЖУ", count: countByFilter("quick:no-kbju"), icon: "к" },
        { id: "quick:no-translation", label: "Без перевода", count: countByFilter("quick:no-translation"), icon: "文" },
      ],
    },
    {
      title: "Возможности",
      rows: [
        { id: "quick:discount", label: "Со скидкой", count: countByFilter("quick:discount"), icon: "%" },
        { id: "quick:with-tags", label: "С тегами", count: countByFilter("quick:with-tags"), icon: "#" },
        { id: "quick:with-labels", label: "С лейблами", count: countByFilter("quick:with-labels"), icon: "!" },
        { id: "quick:with-options", label: "С опциями", count: countByFilter("quick:with-options"), icon: "+" },
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

function getDishAuditChips(dish: Dish, filterId: OverviewFilterId) {
  const state = getDishAuditState(dish);
  const chips: string[] = [];
  if (state.archived) chips.push("В архиве");
  if (state.hidden) chips.push("Скрыта");
  if (dish.stop) chips.push("На стопе");
  if (state.soon) chips.push("Скоро будет");
  if (state.scheduled) chips.push("По расписанию");
  if (!dish.emoji) chips.push("Без фото");
  if (!dish.description.trim()) chips.push("Без описания");
  if (!dish.weight.trim()) chips.push("Без граммовки");
  if (state.noKbju || filterId === "quick:no-kbju") chips.push("Без КБЖУ");
  if (state.noTranslation) chips.push("Без перевода");
  if (!state.hasTags) chips.push("Без тегов");
  if (state.discount) chips.push("Со скидкой");
  if (filterId === "quick:with-options" && state.hasOptions) chips.push("С опциями");
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

function AuditDishRow({
  dish,
  filterId,
  showSectionMeta,
}: {
  dish: Dish;
  filterId: OverviewFilterId;
  showSectionMeta?: boolean;
}) {
  const chips = getDishAuditChips(dish, filterId);
  const visibleChips = chips.slice(0, 3);
  const hiddenChipCount = Math.max(0, chips.length - visibleChips.length);
  const state = getDishAuditState(dish);
  const metaItems = [
    showSectionMeta ? dish.category : null,
    filterId === "quick:with-options" && state.hasOptions ? "2 модиф." : null,
  ].filter(Boolean);

  return (
    <button
      type="button"
      className="group flex w-full items-center gap-3 rounded-[12px] border border-[#e7e5e4] bg-white px-3 py-2.5 text-left transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
    >
      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#f5f5f4] text-[20px]">
        {dish.emoji || "□"}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex min-w-0 items-start justify-between gap-3">
          <span className="min-w-0">
            <span className="block truncate text-[14px] font-medium text-[#292524]">{dish.name}</span>
            {metaItems.length > 0 && (
              <span className="mt-0.5 block truncate text-[13px] text-[#79716b]">
                {metaItems.join(" · ")}
              </span>
            )}
          </span>
          <span className="flex shrink-0 items-center gap-3">
            {dish.stop && (
              <span className="hidden rounded-lg px-2 py-1 text-[12px] font-medium text-[#79716b] transition hover:bg-[#efefea] hover:text-[#292524] group-hover:inline-flex">
                Вернуть со стопа
              </span>
            )}
            <DishPrice dish={dish} />
            <span className="flex h-7 w-7 items-center justify-center rounded-lg text-[#a8a29e] transition hover:bg-[#efefea] hover:text-[#57534d]">
              <MoreVertical size={16} />
            </span>
          </span>
        </span>
        {visibleChips.length > 0 && (
          <span className="mt-2 flex flex-wrap gap-1.5">
            {visibleChips.map((chip) => (
              <span
                key={chip}
                className={cn(
                  "rounded-full bg-[#f5f5f4] px-2 py-0.5 text-[11px] font-medium text-[#79716b]",
                  chip === "Со скидкой" && "bg-[#efefea] text-[#57534d]",
                  ["На стопе", "Скоро будет", "По расписанию", "В архиве", "Скрыта"].includes(chip) &&
                    "bg-[#efefea] text-[#57534d]",
                )}
              >
                {chip}
              </span>
            ))}
            {hiddenChipCount > 0 && (
              <span className="rounded-full bg-[#f5f5f4] px-2 py-0.5 text-[11px] font-medium text-[#a8a29e]">
                +{hiddenChipCount}
              </span>
            )}
          </span>
        )}
      </span>
    </button>
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
  const showChip = filterId !== "quick:all";

  return (
    <div className="flex items-center justify-between gap-4 rounded-[12px] bg-[#fafaf9] px-4 py-3">
      <div className="min-w-0">
        <div className="text-[14px] font-medium leading-5 text-[#292524]">{meta.label}</div>
        <div className="mt-0.5 text-[13px] leading-5 text-[#79716b]">
          {meta.countText(count)}
          {query.trim() && <span> · с учётом поиска</span>}
        </div>
      </div>
      {showChip && (
        <span className="shrink-0 rounded-full bg-white px-2.5 py-1 text-[12px] font-medium text-[#79716b] ring-1 ring-[#e7e5e4]">
          {meta.label}
        </span>
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
  const showSectionMeta = query.trim().length > 0 || sortId !== "category";

  useEffect(() => {
    if (grouped.length === 0) {
      setActiveSectionId(null);
      return;
    }
    setActiveSectionId((current) => current && grouped.some((group) => group.id === current) ? current : grouped[0].id);
  }, [grouped]);

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

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        <CatalogFiltersPanel selectedId={filterId} onSelect={onFilterChange} />
        <div className="min-w-0 flex-1 overflow-y-auto p-8">
          <div className="mx-auto flex w-full max-w-6xl items-start gap-6">
            <div className="min-w-0 flex-1 space-y-5">
              <OverviewStatusBar filterId={filterId} count={visible.length} query={query} />
              <div className="flex items-center gap-2">
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
                <button
                  type="button"
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[12px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b]"
                >
                  <Plus size={15} />
                  Добавить позицию
                </button>
              </div>

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
                            showSectionMeta={showSectionMeta}
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
