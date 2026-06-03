import type { ReactNode } from "react";
import { Plus, Search, ShieldAlert } from "lucide-react";
import { categories } from "@/data/mock-data";
import { cn } from "@/lib/utils";

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

type CatalogSidebarProps = {
  title: string;
  description: string;
  showQuickActions?: boolean;
  children?: ReactNode;
};

export function CatalogSidebar({
  title,
  description,
  showQuickActions = true,
  children,
}: CatalogSidebarProps) {
  return (
    <aside className="w-[280px] shrink-0 border-r border-border bg-white p-4">
      <h2 className="text-lg font-black">{title}</h2>
      <p className="mt-1 text-sm text-muted-foreground">{description}</p>
      {showQuickActions && (
        <div className="mt-4 space-y-1">
          <NavAction icon={Plus} label="Новый раздел" />
          <NavAction icon={Plus} label="Новая позиция" />
          <NavAction icon={Search} label="Найти позицию" />
          <NavAction icon={ShieldAlert} label="Позиции на стопе" count="1" />
        </div>
      )}
      {children ?? (
        <>
          <div className="mt-6 text-xs font-black uppercase tracking-wide text-zinc-400">Разделы</div>
          <div className="mt-2 space-y-1">
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                className="flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left hover:bg-zinc-50"
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
        </>
      )}
    </aside>
  );
}
