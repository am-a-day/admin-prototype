import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Plus, Search, ShieldAlert } from "lucide-react";
import { Field, SectionCard } from "@/components/workspace/section-card";
import { TranslatableField } from "@/components/workspace/translatable-field";
import { categories, getDish } from "@/data/mock-data";
import { destroyTour } from "@/lib/launch-tour";
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
  tourId,
  onClick,
}: {
  icon: typeof Plus;
  label: string;
  count?: string;
  tourId?: string;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      data-tour={tourId}
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

// ── Quick creation modal ──────────────────────────────────────────────────────

function QuickModal({
  title,
  placeholder,
  confirmLabel,
  onConfirm,
  onCancel,
}: {
  title: string;
  placeholder: string;
  confirmLabel: string;
  onConfirm: (value: string) => void;
  onCancel: () => void;
}) {
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleConfirm = () => {
    if (!value.trim()) return;
    onConfirm(value.trim());
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onCancel();
  };

  return createPortal(
    <div className="fixed inset-0 z-[100001] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
      <div className="w-[340px] rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-zinc-200">
        <h2 className="text-base font-bold text-zinc-900">{title}</h2>
        <input
          ref={inputRef}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          className="mt-3 w-full rounded-xl border border-zinc-200 px-3 py-2.5 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-sm text-zinc-500 transition hover:bg-zinc-100"
          >
            Отмена
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!value.trim()}
            className="rounded-xl bg-zinc-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-zinc-700 disabled:opacity-40"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

// ── Empty catalog: skeleton + left panel (phase-aware) ────────────────────────

function EmptyCatalog({
  phase,
  onOpenSectionModal,
  onOpenItemModal,
}: {
  phase: "empty" | "has-sections";
  onOpenSectionModal: () => void;
  onOpenItemModal: () => void;
}) {
  return (
    <main className="flex min-h-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">

        {/* Left panel */}
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border bg-zinc-50/60 p-4">
          <div className="space-y-1">
            {phase === "empty" ? (
              /* Шаг 1: только кнопка создания раздела */
              <NavAction
                icon={Plus}
                label="Новый раздел"
                tourId="create-section"
                onClick={onOpenSectionModal}
              />
            ) : (
              /* Шаг 2: раздел создан, теперь нужна позиция */
              <>
                <NavAction icon={Plus} label="Новый раздел" />
                <NavAction
                  icon={Plus}
                  label="Новая позиция"
                  tourId="create-dish"
                  onClick={onOpenItemModal}
                />
                <NavAction icon={Search} label="Найти позицию" />
              </>
            )}
          </div>

          {/* Созданный раздел (фаза has-sections) */}
          {phase === "has-sections" && (
            <div className="mt-4">
              <div className="mb-2 px-1 text-xs font-black uppercase tracking-wide text-zinc-400">
                Разделы
              </div>
              <div className="flex items-center gap-3 rounded-2xl bg-white px-3 py-3 ring-1 ring-blue-200">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 text-lg">
                  🍽️
                </div>
                <span className="text-sm font-bold text-zinc-800">Мой раздел</span>
              </div>
            </div>
          )}

          {/* Hint */}
          <div className="mt-6 flex items-start gap-2 rounded-xl bg-white px-3 py-3 ring-1 ring-zinc-100">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
            <p className="text-[12px] leading-[1.6] text-zinc-500">
              {phase === "empty"
                ? "Создайте раздел для группировки блюд — например «Горячие», «Напитки» или «Завтраки»."
                : "Добавьте первое блюдо в раздел. Оно сразу появится в предпросмотре витрины."}
            </p>
          </div>
        </aside>

        {/* Right: skeleton outline */}
        <div className="flex min-w-0 flex-1 flex-col overflow-y-auto p-8">
          <div className="mx-auto w-full max-w-3xl space-y-4 opacity-40 pointer-events-none select-none">

            {/* Skeleton dish card */}
            <div className="overflow-hidden rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50">
              <div className="flex">
                <div className="h-40 w-48 shrink-0 rounded-l-[28px] bg-zinc-200" />
                <div className="flex flex-1 flex-col justify-center gap-3 p-7">
                  <div className="h-3 w-16 rounded-full bg-zinc-300" />
                  <div className="h-7 w-48 rounded-xl bg-zinc-300" />
                  <div className="space-y-1.5">
                    <div className="h-2.5 w-full rounded-full bg-zinc-200" />
                    <div className="h-2.5 w-3/4 rounded-full bg-zinc-200" />
                  </div>
                </div>
              </div>
            </div>

            {/* Skeleton fields */}
            <div className="rounded-2xl border border-dashed border-zinc-300 bg-zinc-50 p-6">
              <div className="grid grid-cols-2 gap-4">
                {[...Array(4)].map((_, i) => (
                  <div key={i} className="space-y-2">
                    <div className="h-2.5 w-20 rounded-full bg-zinc-300" />
                    <div className="h-9 w-full rounded-xl bg-zinc-200" />
                  </div>
                ))}
                <div className="col-span-2 space-y-2">
                  <div className="h-2.5 w-24 rounded-full bg-zinc-300" />
                  <div className="h-20 w-full rounded-xl bg-zinc-200" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

// ── Normal populated workspace ────────────────────────────────────────────────

function PopulatedWorkspace({ selectedDishId }: { selectedDishId: string }) {
  const selectedDish = getDish(selectedDishId);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      <div className="flex min-h-0 flex-1">
        {/* Left panel */}
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border bg-zinc-50/60 p-4">
          <div className="space-y-1">
            <NavAction icon={Plus} label="Новый раздел" />
            <NavAction icon={Plus} label="Новая позиция" tourId="create-dish" />
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
  const [sectionModalOpen, setSectionModalOpen] = useState(false);
  const [itemModalOpen, setItemModalOpen] = useState(false);

  if (catalogPhase === "has-items") {
    return <PopulatedWorkspace selectedDishId={selectedDishId} />;
  }

  return (
    <>
      <EmptyCatalog
        phase={catalogPhase}
        onOpenSectionModal={() => {
          destroyTour();
          setSectionModalOpen(true);
        }}
        onOpenItemModal={() => {
          destroyTour();
          setItemModalOpen(true);
        }}
      />

      {sectionModalOpen && (
        <QuickModal
          title="Новый раздел"
          placeholder="Например: Горячие блюда"
          confirmLabel="Создать раздел"
          onConfirm={() => {
            setSectionModalOpen(false);
            onAdvancePhase("has-sections");
          }}
          onCancel={() => setSectionModalOpen(false)}
        />
      )}

      {itemModalOpen && (
        <QuickModal
          title="Новая позиция"
          placeholder="Например: Пицца Маргарита"
          confirmLabel="Создать"
          onConfirm={() => {
            setItemModalOpen(false);
            onAdvancePhase("has-items");
          }}
          onCancel={() => setItemModalOpen(false)}
        />
      )}
    </>
  );
}
