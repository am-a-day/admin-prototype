import { useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle, Plus } from "lucide-react";
import { createPortal } from "react-dom";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useMockAuth, type WorkspaceLanguageStatus } from "@/contexts/mock-auth-context";
import { usePublish } from "@/contexts/publish-context";
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
  const { account, addWorkspaceLanguage } = useMockAuth();
  const { registerChange } = usePublish();
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, right: 0 });
  const addButtonRef = useRef<HTMLButtonElement>(null);
  const workspaceLanguages = account?.workspace.languages ?? [];
  const availableLanguages = LANGUAGES.filter(
    (language) => !workspaceLanguages.some(({ code }) => code === language.code),
  );

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (addButtonRef.current?.contains(target)) return;
      if (document.getElementById("add-language-popover")?.contains(target)) return;
      setOpen(false);
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutsideClick);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("mousedown", closeOnOutsideClick);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [open]);

  const togglePopover = () => {
    if (!open && addButtonRef.current) {
      const rect = addButtonRef.current.getBoundingClientRect();
      setPosition({ top: rect.bottom + 6, right: window.innerWidth - rect.right });
    }
    setOpen((current) => !current);
  };

  const statusLabel: Record<WorkspaceLanguageStatus, string> = {
    empty: "Не заполнен",
    partial: "Частично заполнен",
    ready: "Готов к публикации",
  };

  return (
    <>
      <div className="inline-flex h-8 items-center gap-1 rounded-lg bg-transparent px-1 text-[12px] text-[#57534d]">
        <span className="px-1.5 text-[13px] font-normal text-[#79716b]">Языковая версия:</span>
        <div className="flex items-center gap-0.5">
        {workspaceLanguages.map((workspaceLanguage) => {
          const lang = LANGUAGES.find(({ code }) => code === workspaceLanguage.code);
          if (!lang) return null;
          const active = contentLanguage === lang.code;
          const primary = account?.workspace.primaryLanguage === lang.code;
          return (
            <button
              key={lang.code}
              type="button"
              onClick={() => setContentLanguage(lang.code)}
              title={`${lang.label}${primary ? " · Основной язык" : ` · ${statusLabel[workspaceLanguage.status]}`}`}
              className={cn(
                "relative flex h-6 min-w-8 items-center justify-center rounded-md px-2 text-[12px] font-medium transition",
                active
                  ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]"
                  : "text-[#79716b] hover:bg-white/70 hover:text-[#292524]",
              )}
            >
              {lang.short}
              {!primary && (
                <span
                  className={cn(
                    "absolute right-1 top-1 h-1.5 w-1.5 rounded-full ring-1 ring-white",
                    workspaceLanguage.status === "empty" && "bg-zinc-300",
                    workspaceLanguage.status === "partial" && "bg-amber-400",
                    workspaceLanguage.status === "ready" && "bg-emerald-500",
                  )}
                />
              )}
            </button>
          );
        })}
          <button
            ref={addButtonRef}
            type="button"
            onClick={togglePopover}
            aria-expanded={open}
            title="Добавить язык"
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-md text-[#79716b] transition hover:bg-white hover:text-[#292524]",
              open && "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]",
            )}
          >
            <Plus size={14} />
          </button>
        </div>
      </div>
      {open &&
        createPortal(
          <div
            id="add-language-popover"
            style={{ top: position.top, right: position.right }}
            className="fixed z-[200] w-64 rounded-[8px] border border-[#e7e5e4] bg-white p-3 shadow-xl shadow-zinc-300/30"
          >
            <div className="px-1 text-[13px] font-bold text-zinc-950">Добавить язык</div>
            <p className="mt-1 px-1 text-[11px] leading-4 text-zinc-500">
              Язык появится на витрине после заполнения и публикации.
            </p>
            <div className="mt-3 space-y-1">
              {availableLanguages.length > 0 ? (
                availableLanguages.map((language) => (
                  <button
                    key={language.code}
                    type="button"
                    onClick={() => {
                      addWorkspaceLanguage(language.code);
                      registerChange("about");
                      setContentLanguage(language.code);
                      setOpen(false);
                    }}
                    className="flex h-9 w-full items-center justify-between rounded-[7px] px-2 text-left text-[13px] text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
                  >
                    <span>{language.label}</span>
                    <span className="text-[11px] font-semibold text-zinc-400">{language.short}</span>
                  </button>
                ))
              ) : (
                <p className="px-1 py-2 text-[12px] text-zinc-400">Все доступные языки уже добавлены.</p>
              )}
            </div>
          </div>,
          document.body,
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
