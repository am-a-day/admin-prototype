import { LayoutGrid, Plus, Search, ShieldAlert, Upload } from "lucide-react";
import { Field, SectionCard } from "@/components/workspace/section-card";
import { TranslatableField } from "@/components/workspace/translatable-field";
import { categories, getDish } from "@/data/mock-data";
import { cn } from "@/lib/utils";

export type CatalogPhase = "empty" | "has-sections" | "has-items";

type CatalogWorkspaceProps = {
  selectedDishId: string;
  catalogPhase: CatalogPhase;
  onAdvancePhase: (next: "has-sections" | "has-items") => void;
};

// ── Sidebar action button ─────────────────────────────────────────────────────

function NavAction({
  icon: Icon,
  label,
  count,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  count?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 transition"
    >
      <span className="flex items-center gap-2">
        <Icon size={16} className="shrink-0" />
        {label}
      </span>
      {count && (
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{count}</span>
      )}
    </button>
  );
}

// ── Phase 1: No sections ──────────────────────────────────────────────────────

function EmptyNoSections({ onCreateSection }: { onCreateSection: () => void }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col items-center justify-center overflow-hidden bg-white px-8 py-16">
      <div className="w-full max-w-md text-center">
        {/* Icon */}
        <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-100">
          <LayoutGrid size={28} className="text-zinc-400" />
        </div>

        {/* Copy */}
        <h2 className="text-[20px] font-black text-zinc-950">
          Создайте первый раздел
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-[14px] leading-relaxed text-zinc-500">
          Разделы помогают гостям ориентироваться в меню. Например:{" "}
          <span className="font-semibold text-zinc-700">Пицца</span>,{" "}
          <span className="font-semibold text-zinc-700">Напитки</span>,{" "}
          <span className="font-semibold text-zinc-700">Завтраки</span> или{" "}
          <span className="font-semibold text-zinc-700">Десерты</span>.
        </p>

        {/* CTAs */}
        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            type="button"
            data-tour="create-dish"
            onClick={onCreateSection}
            className="flex items-center gap-2 rounded-xl bg-zinc-950 px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-zinc-800"
          >
            <Plus size={15} />
            Создать раздел
          </button>
          <button
            type="button"
            className="flex items-center gap-2 rounded-xl border border-border px-5 py-2.5 text-[14px] font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            <Upload size={14} />
            Импортировать меню
          </button>
        </div>

        {/* Launch hint */}
        <div className="mx-auto mt-10 flex max-w-sm items-start gap-2.5 rounded-xl bg-zinc-50 px-4 py-3 text-left">
          <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
          <p className="text-[12px] leading-[1.6] text-zinc-500">
            Это первый шаг запуска витрины. Добавьте хотя бы несколько позиций,
            чтобы меню не было пустым для гостей.
          </p>
        </div>
      </div>
    </main>
  );
}

// ── Phase 2: Section exists, no items ────────────────────────────────────────

function EmptyHasSections({ onAddItem }: { onAddItem: () => void }) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        {/* Left sidebar with the mock section */}
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border bg-zinc-50/60 p-4">
          <div className="space-y-1">
            <NavAction icon={Plus} label="Новая позиция" onClick={onAddItem} />
            <NavAction icon={Search} label="Найти позицию" />
          </div>
          <div className="mt-6 text-xs font-black uppercase tracking-wide text-zinc-400">
            Разделы
          </div>
          {/* Mock newly created section */}
          <div className="mt-2">
            <button
              type="button"
              className="flex w-full items-center gap-3 rounded-2xl bg-white px-3 py-3 text-left shadow-sm ring-1 ring-zinc-100"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-orange-400 to-amber-300 text-lg">
                🍽️
              </div>
              <div>
                <span className="text-sm font-bold">Горячие блюда</span>
                <div className="text-[11px] text-zinc-400">0 позиций</div>
              </div>
            </button>
          </div>
        </aside>

        {/* Right: empty "add first item" state */}
        <div className="flex min-w-0 flex-1 flex-col items-center justify-center px-8 py-16 text-center">
          <div className="w-full max-w-sm">
            <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100">
              <Plus size={24} className="text-zinc-400" />
            </div>
            <h2 className="text-[18px] font-black text-zinc-950">
              Добавьте первую позицию
            </h2>
            <p className="mt-2 text-[13px] leading-relaxed text-zinc-500">
              Раздел создан. Теперь добавьте блюдо или товар, чтобы гости
              увидели его на витрине.
            </p>
            <button
              type="button"
              onClick={onAddItem}
              className="mt-6 flex items-center gap-2 mx-auto rounded-xl bg-zinc-950 px-5 py-2.5 text-[14px] font-bold text-white transition hover:bg-zinc-800"
            >
              <Plus size={15} />
              Добавить позицию
            </button>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Phase 3: Normal populated workspace ──────────────────────────────────────

function PopulatedWorkspace({ selectedDishId }: { selectedDishId: string }) {
  const selectedDish = getDish(selectedDishId);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        {/* Left panel */}
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border bg-zinc-50/60 p-4">
          <div className="space-y-1">
            <NavAction icon={Plus} label="Новый раздел" />
            <NavAction icon={Plus} label="Новая позиция" />
            <NavAction icon={Search} label="Найти позицию" />
            <NavAction icon={ShieldAlert} label="Позиции на стопе" count="1" />
          </div>
          <div className="mt-6 text-xs font-black uppercase tracking-wide text-zinc-400">
            Разделы
          </div>
          <div className="mt-2 space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white transition"
              >
                <div
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-lg",
                    category.photo,
                  )}
                >
                  {category.emoji}
                </div>
                <span className="text-sm font-bold">{category.name}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* Editor area */}
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
      </div>
    </main>
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────

export function CatalogWorkspace({
  selectedDishId,
  catalogPhase,
  onAdvancePhase,
}: CatalogWorkspaceProps) {
  if (catalogPhase === "empty") {
    return <EmptyNoSections onCreateSection={() => onAdvancePhase("has-sections")} />;
  }
  if (catalogPhase === "has-sections") {
    return <EmptyHasSections onAddItem={() => onAdvancePhase("has-items")} />;
  }
  return <PopulatedWorkspace selectedDishId={selectedDishId} />;
}
