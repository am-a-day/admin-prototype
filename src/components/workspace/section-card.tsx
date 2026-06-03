import { Plus } from "lucide-react";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

export function SectionCard({ children, className }: { children: ReactNode; className?: string }) {
  return <Card className={cn("p-5", className)}>{children}</Card>;
}

export function BlockHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action: string;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <div className="mb-1 text-xs font-black uppercase tracking-wide text-blue-600">{eyebrow}</div>
        <h3 className="text-xl font-black text-zinc-950">{title}</h3>
        <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      <Button size="sm" className="shrink-0 font-black">
        <Plus size={15} />
        {action}
      </Button>
    </div>
  );
}

export function Field({
  label,
  value,
  icon,
}: {
  label: string;
  value: string;
  icon?: ReactNode;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-zinc-50 px-4 py-3">
      <div className="mb-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground">
        {icon}
        {label}
      </div>
      <input
        className="w-full bg-transparent text-base font-semibold text-zinc-900 outline-none"
        defaultValue={value}
      />
    </label>
  );
}

export function FormTextArea({ label, value }: { label: string; value: string }) {
  return (
    <label className="block rounded-2xl border border-border bg-zinc-50 px-4 py-3">
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>
      <textarea
        className="min-h-28 w-full resize-none bg-transparent text-base font-semibold text-zinc-900 outline-none"
        defaultValue={value}
      />
    </label>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  chips,
}: {
  icon: string;
  title: string;
  description: string;
  chips?: string[];
}) {
  return (
    <div className="rounded-[28px] border border-dashed border-zinc-300 bg-zinc-50/60 px-8 py-14 text-center">
      <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-2xl shadow-sm">
        {icon}
      </div>
      <h3 className="text-lg font-black text-zinc-950">{title}</h3>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground">{description}</p>
      {chips && (
        <div className="mt-5 flex justify-center gap-2 text-xs text-muted-foreground">
          {chips.map((chip) => (
            <span key={chip} className="rounded-full bg-white px-3 py-1.5 shadow-sm">
              {chip}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function AddTile({ label, className }: { label: string; className?: string }) {
  return (
    <button
      type="button"
      className={cn(
        "flex shrink-0 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 bg-zinc-50 text-sm font-bold text-zinc-500 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-600",
        className,
      )}
    >
      <Plus size={22} className="mb-2" />
      {label}
    </button>
  );
}

export function DishTile({ dish, removable }: { dish: { id: string; name: string; category: string; price: string; accent: string; emoji: string }; removable?: boolean }) {
  if (!dish) return null;
  return (
    <button
      type="button"
      className="group relative flex w-full items-center gap-3 rounded-3xl border border-border bg-white p-3 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
    >
      <div
        className={cn(
          "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br text-3xl",
          dish.accent,
        )}
      >
        {dish.emoji}
      </div>
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-black text-zinc-950">{dish.name}</div>
        <div className="mt-1 text-xs text-muted-foreground">{dish.category}</div>
        <div className="mt-1 text-sm font-bold text-zinc-950">{dish.price}</div>
      </div>
      {removable && (
        <span className="absolute right-3 top-3 hidden rounded-full bg-white p-1 text-zinc-400 shadow-sm group-hover:block">
          ×
        </span>
      )}
    </button>
  );
}

export function ToggleRow({ title, description, defaultChecked = true }: { title: string; description: string; defaultChecked?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-border p-4">
      <div>
        <div className="font-black">{title}</div>
        <div className="mt-1 text-sm text-muted-foreground">{description}</div>
      </div>
      <Switch defaultChecked={defaultChecked} />
    </div>
  );
}
