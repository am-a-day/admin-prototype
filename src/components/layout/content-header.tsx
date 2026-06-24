import { type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useAppSettings } from "@/contexts/app-settings-context";
import { usePlanStatus } from "@/lib/use-plan-status";
import { LANGUAGES } from "@/data/languages";
import { cn } from "@/lib/utils";

// ── Plan warning strip ────────────────────────────────────────────────────────

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
      <AlertTriangle
        size={13}
        className={cn("shrink-0", expired ? "text-orange-500" : "text-amber-500")}
        strokeWidth={2.5}
      />
      <span className={cn("min-w-0 flex-1 truncate text-[12px] font-semibold", expired ? "text-orange-800" : "text-amber-800")}>
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

// ── Content language switcher ─────────────────────────────────────────────────

export function PageLangSwitcher() {
  const { contentLanguage, setContentLanguage } = useAppSettings();

  return (
    <div className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#f5f5f4] px-1 text-[12px] text-[#57534d]">
      <span className="px-1.5 font-medium text-[#57534d]">Языковая версия:</span>
      <div className="flex items-center gap-0.5">
        {LANGUAGES.map((lang) => {
          const active = contentLanguage === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setContentLanguage(lang.code)}
              className={cn(
                "flex h-6 min-w-8 items-center justify-center rounded-md px-2 text-[12px] font-medium transition",
                active
                  ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]"
                  : "text-[#79716b] hover:bg-white/70 hover:text-[#292524]",
              )}
            >
              {lang.short}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Content header (page header) ──────────────────────────────────────────────

type ContentHeaderProps = {
  title?: string;
  description?: string;
  showLanguage?: boolean;
  /** Second-level sub-page tabs */
  tabs?: ReactNode;
  /** Navigate to billing on plan warning CTA */
  onRenewPlan?: () => void;
  /** Действие в правом верхнем углу рабочей области (например, toggle предпросмотра) */
  rightSlot?: ReactNode;
};

export function ContentHeader({
  title,
  description,
  showLanguage,
  tabs,
  onRenewPlan,
  rightSlot,
}: ContentHeaderProps) {
  const hasHeader = !!(title || description || showLanguage || tabs || rightSlot);

  return (
    <div className="shrink-0">
      <PlanWarningStrip onRenew={onRenewPlan} />
      {hasHeader && (
        <div className="bg-white">
          <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-3 px-8  pt-4">
          <div className="min-w-0 flex-1">
            {/* Title row */}
            {(title || showLanguage) && (
              <div className="flex items-center gap-2">
                {title && (
                  <h1 className="text-[14px] leading-tight text-stone-950 font-medium">{title}</h1>
                )}
                
              </div>
            )}
            {/* Description */}
            {description && (
              <p className={cn("text-sm text-zinc-500", title && "mt-1")}>{description}</p>
            )}
            {/* Tabs (rail layout) */}
            {tabs && <div className={cn("-mx-1", (title || description) && "mt-3")}>{tabs}</div>}
          </div>
          {rightSlot && <div className="absolute top-4 right-4">{rightSlot}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
