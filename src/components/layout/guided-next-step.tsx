import { ArrowRight, Check, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export type OnbSuccess = {
  title: string;
  subtitle: string;
  actionLabel?: string;
  onAction?: () => void;
};

/**
 * Компактный статус первого запуска: «Шаг X из N · …» с авто-переходами.
 * Имеет короткое success-состояние между шагами. Навигацию не блокирует.
 */
export function GuidedNextStep({
  success,
  index,
  total,
  label,
  actionLabel,
  onAction,
  onTour,
  primary = false,
}: {
  success?: OnbSuccess | null;
  index?: number;
  total?: number;
  label?: string;
  actionLabel?: string;
  onAction?: () => void;
  onTour?: () => void;
  primary?: boolean;
}) {
  // ── Success-состояние между шагами ──
  if (success) {
    return (
      <div className="flex items-center gap-3 border-b border-emerald-100 bg-emerald-50/60 px-5 py-2">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check size={12} strokeWidth={3} />
        </span>
        <div className="min-w-0 flex-1">
          <span className="text-[13px] font-bold text-emerald-900">{success.title}</span>
          <span className="ml-2 text-[12px] text-emerald-700">{success.subtitle}</span>
        </div>
        {success.actionLabel && success.onAction && (
          <button
            type="button"
            onClick={success.onAction}
            className="shrink-0 rounded-lg px-3 py-1 text-[12px] font-bold text-emerald-700 transition hover:bg-emerald-100"
          >
            {success.actionLabel}
          </button>
        )}
      </div>
    );
  }

  if (index == null) return null;

  return (
    <div
      className={cn(
        "flex items-center gap-3 border-b px-5 py-2",
        primary ? "border-blue-200 bg-blue-50" : "border-blue-100 bg-blue-50/50",
      )}
    >
      <span className="flex h-5 shrink-0 items-center rounded-full bg-blue-600 px-2 text-[11px] font-bold text-white">
        Шаг {index} из {total}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-zinc-800">
        {label}
      </span>
      {onTour && (
        <button
          type="button"
          onClick={onTour}
          className="flex shrink-0 items-center gap-1 text-[12px] font-bold text-blue-600 transition hover:text-blue-700"
        >
          <Sparkles size={12} />
          Показать
        </button>
      )}
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className={cn(
            "flex shrink-0 items-center gap-1 rounded-lg px-3 py-1 text-[12px] font-bold text-white transition",
            primary ? "bg-blue-600 hover:bg-blue-700" : "bg-zinc-900 hover:bg-zinc-700",
          )}
        >
          {actionLabel}
          <ArrowRight size={12} />
        </button>
      )}
    </div>
  );
}
