import { usePlanStatus } from "@/lib/use-plan-status";
import { cn } from "@/lib/utils";
import type { SectionId } from "@/data/mock-data";

type OnNavigate = (section: SectionId, tab: string) => void;

/**
 * Compact plan + subscription line for the organization block (full sidebar).
 * Detail lives in the org popover; this is a readable one-liner.
 */
export function PlanStatusLine({ onNavigate }: { onNavigate: OnNavigate }) {
  const status = usePlanStatus();
  const warn = status.kind === "expiring";
  const crit = status.kind === "expired";

  const text =
    status.kind === "none" ? "Тариф не выбран" :
    status.kind === "pending" ? `${status.planId} · ожидает активации` :
    status.kind === "expired" ? "Подписка закончилась" :
    status.kind === "expiring" ? `${status.planId} · ${status.daysLeftPhrase}` :
    `${status.planId} · ${status.expiryLabel}`;

  const cta =
    status.kind === "none" ? "Выбрать" :
    status.kind === "pending" ? "Изменить" :
    status.kind === "expired" ? "Продлить доступ" :
    status.kind === "expiring" ? "Продлить тариф" :
    "Продлить";

  return (
    <button
      type="button"
      onClick={() => onNavigate("management", "billing")}
      className={cn(
        "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1 text-left transition",
        crit ? "hover:bg-orange-100/60" : warn ? "hover:bg-amber-100/60" : "hover:bg-zinc-100",
      )}
    >
      <span
        className={cn(
          "min-w-0 truncate text-[12px] font-semibold",
          crit ? "text-orange-700" : warn ? "text-amber-700" : "text-zinc-600",
        )}
      >
        {text}
      </span>
      <span
        className={cn(
          "shrink-0 text-[11px] font-bold",
          crit || warn ? "text-orange-600" : "text-blue-600",
        )}
      >
        {cta} →
      </span>
    </button>
  );
}
