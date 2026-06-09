import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { useAppSettings } from "@/contexts/app-settings-context";
import { usePlanStatus } from "@/lib/use-plan-status";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
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

function PageLangSwitcher() {
  const { contentLanguage, setContentLanguage, contentLanguageShort } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (document.getElementById("page-lang-popup")?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 4, left: r.left });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={cn(
          "flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm transition",
          open
            ? "bg-zinc-100 text-zinc-700"
            : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600",
        )}
        title="Язык контента"
      >
        <span className="text-xs font-medium">Контент: {contentLanguageShort}</span>
        <ChevronDown size={10} className={cn("shrink-0 transition", open && "rotate-180")} />
      </button>

      {open && (
        <div
          id="page-lang-popup"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[200] w-44 rounded-xl border border-border bg-white p-2 shadow-xl shadow-zinc-200/60"
        >
          <div className="mb-1 px-2 text-[10px] font-black uppercase tracking-wide text-zinc-400">
            Язык контента
          </div>
          <p className="mb-1.5 px-2 text-[10px] leading-4 text-zinc-400">
            Версия меню и витрины для редактирования.
          </p>
          {LANGUAGES.map((lang) => (
            <button
              key={lang.code}
              type="button"
              onClick={() => { setContentLanguage(lang.code as LanguageCode); setOpen(false); }}
              className={cn(
                "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                contentLanguage === lang.code
                  ? "bg-blue-50 font-semibold text-blue-700"
                  : "text-zinc-600 hover:bg-zinc-50",
              )}
            >
              <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", contentLanguage === lang.code ? "bg-blue-600" : "bg-transparent")} />
              {lang.label}
              <span className="ml-auto text-xs text-zinc-400">{lang.short}</span>
            </button>
          ))}
        </div>
      )}
    </>
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
};

export function ContentHeader({
  title,
  description,
  showLanguage,
  tabs,
  onRenewPlan,
}: ContentHeaderProps) {
  const hasHeader = !!(title || description || showLanguage || tabs);

  return (
    <div className="shrink-0">
      <PlanWarningStrip onRenew={onRenewPlan} />
      {hasHeader && (
        <div className="border-b border-border bg-white px-5 pb-3 pt-4">
          {/* Title row */}
          {(title || showLanguage) && (
            <div className="flex items-center gap-2">
              {title && (
                <h1 className="text-[15px] font-bold leading-tight text-zinc-950">{title}</h1>
              )}
              {showLanguage && (
                <>
                  <span className="text-xs text-zinc-300">·</span>
                  <PageLangSwitcher />
                </>
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
      )}
    </div>
  );
}
