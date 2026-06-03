import type { ReactNode } from "react";
import { AlertTriangle, PanelLeft, PanelLeftClose } from "lucide-react";
import { ContentLanguageBadge } from "@/components/workspace/content-language-badge";
import { useHeaderActionsSlot } from "@/contexts/header-actions-context";
import { usePlanStatus } from "@/lib/use-plan-status";
import { cn } from "@/lib/utils";

type ContentHeaderProps = {
  title: string;
  description?: string;
  showLanguage?: boolean;
  /** Second-level sub-page tabs (rail layout only) */
  tabs?: ReactNode;
  /** Unified sidebar toggle (sidebar layout only) */
  onToggleSidebar?: () => void;
  /** Whether the inline sidebar is currently expanded (controls toggle icon) */
  sidebarExpanded?: boolean;
  /** Navigate to billing/renew */
  onRenewPlan?: () => void;
};

/** Slim subscription warning — only when expiring soon or expired. */
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
        "flex items-center gap-2 border-b px-4 py-1.5 sm:px-5",
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

export function ContentHeader({
  title,
  description,
  showLanguage = false,
  tabs,
  onToggleSidebar,
  sidebarExpanded = false,
  onRenewPlan,
}: ContentHeaderProps) {
  const actions = useHeaderActionsSlot();

  return (
    <div className="shrink-0">
      <PlanWarningStrip onRenew={onRenewPlan} />
      <header className="border-b border-border bg-white px-4 pt-3 pb-0 sm:px-5">
        <div className="flex items-center justify-between gap-4 pb-3">
          <div className="flex min-w-0 items-center gap-2.5">
            {onToggleSidebar && (
              <button
                type="button"
                onClick={onToggleSidebar}
                title={sidebarExpanded ? "Свернуть навигацию" : "Открыть навигацию"}
                aria-label={sidebarExpanded ? "Свернуть навигацию" : "Открыть навигацию"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                {sidebarExpanded ? <PanelLeftClose size={17} /> : <PanelLeft size={17} />}
              </button>
            )}
            <div className="min-w-0">
              <h1 className="truncate text-[15px] font-bold leading-tight text-zinc-950">{title}</h1>
              {description && (
                <p className="mt-0.5 truncate text-xs text-muted-foreground">{description}</p>
              )}
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {actions}
            {showLanguage && <ContentLanguageBadge />}
          </div>
        </div>
        {tabs && <div className="-mx-1 pb-2">{tabs}</div>}
      </header>
    </div>
  );
}
