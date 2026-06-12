import { Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toggle видимости предпросмотра витрины. Живёт в правом верхнем углу рабочей
 * области (перед панелью предпросмотра). Иконка одинаковая в обоих состояниях:
 * открыто — активное синее состояние, скрыто — нейтральное.
 */
export function PreviewToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      title={open ? "Скрыть предпросмотр" : "Показать предпросмотр"}
      aria-pressed={open}
      className={cn(
        "flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] transition",
        open
          ? "bg-blue-100 text-blue-600 hover:bg-blue-200"
          : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-700",
      )}
    >
      <Smartphone size={18} />
    </button>
  );
}
