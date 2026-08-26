import { type ReactNode } from "react";
import { Warning } from "@phosphor-icons/react";
import { usePlanStatus } from "@/lib/use-plan-status";
import { cn } from "@/lib/utils";

function PlanWarningStrip({ onRenew }: { onRenew?: () => void }) {
  const status = usePlanStatus();
  if (status.kind !== "expiring" && status.kind !== "expired") return null;

  const expired = status.kind === "expired";
  const text = expired
    ? "Подписка закончилась · витрина может быть недоступна гостям"
    : status.daysLeft === 1
      ? "Подписка закончится завтра"
      : `Подписка закончится через ${status.daysLeft} ${status.daysLeft < 5 ? "дня" : "дней"}`;

  return (
    <div
      className={cn(
        "flex items-center gap-2 border-b px-5 py-1.5",
        expired ? "border-orange-200 bg-orange-50" : "border-amber-200 bg-amber-50",
      )}
    >
      <Warning
        size={13}
        className={cn("shrink-0", expired ? "text-orange-500" : "text-amber-500")}
        strokeWidth={2.5}
      />
      <span
        className={cn(
          "min-w-0 flex-1 truncate text-[12px] font-semibold",
          expired ? "text-orange-800" : "text-amber-800",
        )}
      >
        {text}
      </span>
      <button
        type="button"
        onClick={onRenew}
        className={cn(
          "shrink-0 rounded-md px-2.5 py-1 text-[12px] font-bold text-white transition",
          expired ? "bg-orange-600 hover:bg-orange-700" : "bg-amber-500 hover:bg-amber-600",
        )}
      >
        {expired ? "Продлить доступ" : "Продлить"}
      </button>
    </div>
  );
}

type ContentHeaderProps = {
  title?: string;
  description?: string;
  onRenewPlan?: () => void;
  rightSlot?: ReactNode;
};

export function ContentHeader({
  title,
  description,
  onRenewPlan,
  rightSlot,
}: ContentHeaderProps) {
  const hasHeader = Boolean(title || description || rightSlot);

  return (
    <div className="shrink-0">
      <PlanWarningStrip onRenew={onRenewPlan} />
      {hasHeader && (
        <div className="bg-white">
          <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-3 px-8 pt-4">
            <div className="min-w-0 flex-1">
              {title && (
                <div className="flex items-center gap-2">
                  <h1 className="text-[14px] font-medium leading-tight text-stone-950">
                    {title}
                  </h1>
                </div>
              )}
              {description && (
                <p className={cn("text-sm text-zinc-500", title && "mt-1")}>
                  {description}
                </p>
              )}
            </div>
            {rightSlot && <div className="absolute right-4 top-4">{rightSlot}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
