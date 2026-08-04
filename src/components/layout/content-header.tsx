import { type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { usePlanStatus } from "@/lib/use-plan-status";
import { LANGUAGES } from "@/data/languages";
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
      <AlertTriangle
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

export function PageLangSwitcher({
  onManageLanguages,
}: {
  onManageLanguages?: () => void;
}) {
  const { contentLanguage, setContentLanguage } = useAppSettings();
  const { account } = useMockAuth();
  const workspaceLanguages = account?.workspace.languages ?? [];

  return (
    <div className="inline-flex h-8 items-center gap-1 rounded-lg bg-transparent px-1 text-[12px] text-[#57534d]">
      <span className="px-1.5 text-[13px] font-normal text-[#79716b]">
        Языковая версия:
      </span>
      <div className="flex items-center gap-0.5">
        {workspaceLanguages.map((workspaceLanguage) => {
          const language = LANGUAGES.find(({ code }) => code === workspaceLanguage.code);
          if (!language) return null;
          const active = contentLanguage === language.code;
          const primary = account?.workspace.primaryLanguage === language.code;
          return (
            <button
              key={language.code}
              type="button"
              onClick={() => setContentLanguage(language.code)}
              title={`${language.label}${primary ? " · Основной язык" : ""}`}
              className={cn(
                "flex h-6 min-w-8 items-center justify-center rounded-md px-2 text-[12px] font-medium transition",
                active
                  ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]"
                  : "text-[#79716b] hover:bg-white/70 hover:text-[#292524]",
              )}
            >
              {language.short}
            </button>
          );
        })}
        {onManageLanguages && (
          <button
            type="button"
            onClick={onManageLanguages}
            className="ml-1 h-6 whitespace-nowrap rounded-md px-2 text-[12px] font-medium text-[#79716b] transition hover:bg-white hover:text-[#292524]"
          >
            Управлять языками
          </button>
        )}
      </div>
    </div>
  );
}

type ContentHeaderProps = {
  title?: string;
  description?: string;
  showLanguage?: boolean;
  tabs?: ReactNode;
  onRenewPlan?: () => void;
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
  const hasHeader = Boolean(title || description || showLanguage || tabs || rightSlot);

  return (
    <div className="shrink-0">
      <PlanWarningStrip onRenew={onRenewPlan} />
      {hasHeader && (
        <div className="bg-white">
          <div className="mx-auto flex w-full max-w-5xl items-start justify-between gap-3 px-8 pt-4">
            <div className="min-w-0 flex-1">
              {(title || showLanguage) && (
                <div className="flex items-center gap-2">
                  {title && (
                    <h1 className="text-[14px] font-medium leading-tight text-stone-950">
                      {title}
                    </h1>
                  )}
                </div>
              )}
              {description && (
                <p className={cn("text-sm text-zinc-500", title && "mt-1")}>
                  {description}
                </p>
              )}
              {tabs && (
                <div className={cn("-mx-1", (title || description) && "mt-3")}>
                  {tabs}
                </div>
              )}
            </div>
            {rightSlot && <div className="absolute right-4 top-4">{rightSlot}</div>}
          </div>
        </div>
      )}
    </div>
  );
}
