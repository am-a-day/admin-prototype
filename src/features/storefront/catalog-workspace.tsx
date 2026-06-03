import { Plus, Search, ShieldAlert } from "lucide-react";
import { Field, FormTextArea, SectionCard } from "@/components/workspace/section-card";
import { categories, getDish } from "@/data/mock-data";
import { cn } from "@/lib/utils";

type CatalogWorkspaceProps = {
  selectedDishId: string;
};

function NavAction({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Plus;
  label: string;
  count?: string;
}) {
  return (
    <button
      type="button"
      className="flex w-full items-center justify-between rounded-xl px-3 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50"
    >
      <span className="flex items-center gap-2">
        <Icon size={16} />
        {label}
      </span>
      {count && (
        <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">{count}</span>
      )}
    </button>
  );
}

export function CatalogWorkspace({ selectedDishId }: CatalogWorkspaceProps) {
  const selectedDish = getDish(selectedDishId);

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {/* Workspace area */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel — visually inside the page, not part of global nav */}
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border bg-zinc-50/60 p-4">
          <div className="space-y-1">
            <NavAction icon={Plus} label="Новый раздел" />
            <NavAction icon={Plus} label="Новая позиция" />
            <NavAction icon={Search} label="Найти позицию" />
            <NavAction icon={ShieldAlert} label="Позиции на стопе" count="1" />
          </div>
          <div className="mt-6 text-xs font-black uppercase tracking-wide text-zinc-400">Разделы</div>
          <div className="mt-2 space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-white"
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
                  <p className="mt-3 text-sm leading-6 text-muted-foreground">{selectedDish.description}</p>
                </div>
              </div>
            </div>
            <SectionCard>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Название" value={selectedDish.name} />
                <Field label="Раздел" value={selectedDish.category} />
                <Field label="Цена" value={selectedDish.price} />
                <Field label="Вес / объем" value={selectedDish.weight} />
                <div className="col-span-2">
                  <FormTextArea label="Описание" value={selectedDish.description} />
                </div>
              </div>
            </SectionCard>
          </div>
        </div>
      </div>
    </main>
  );
}
