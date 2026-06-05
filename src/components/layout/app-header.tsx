import { useEffect, useRef, useState } from "react";
import { Bell, Check, ChevronDown, Loader2, Menu, PanelLeft, PanelLeftClose, UploadCloud } from "lucide-react";
import { createPortal } from "react-dom";
import { OrgMenu } from "@/components/layout/account-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { usePlanStatus } from "@/lib/use-plan-status";
import { useVitrineStatus } from "@/lib/use-vitrine-status";
import { usePublish } from "@/contexts/publish-context";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { useLayoutMode } from "@/contexts/layout-mode-context";
import { type SectionId } from "@/data/mock-data";
import { cn } from "@/lib/utils";

// ── Plan badge with popover ───────────────────────────────────────────────────

function PlanBadge({ onNavigate }: { onNavigate: (s: SectionId, t: string) => void }) {
  const status = usePlanStatus();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (document.getElementById("plan-badge-popup")?.contains(e.target as Node)) return;
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
      setPos({ top: r.bottom + 4, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  if (status.kind === "none") return null;

  const warn = status.kind === "expiring";
  const crit = status.kind === "expired";

  const badgeText =
    crit  ? "Подписка закончилась" :
    warn  ? `${status.planId} · ${status.daysLeft} дн.` :
    status.kind === "pending" ? `${status.planId} · ожидает` :
    `${status.planId} · ${status.expiryLabel}`;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        className={cn(
          "flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition hover:bg-zinc-100",
          crit ? "text-orange-600" : warn ? "text-amber-600" : "text-zinc-400",
          open && "bg-zinc-100",
        )}
      >
        {badgeText}
        <ChevronDown size={10} className={cn("shrink-0 transition", open && "rotate-180")} />
      </button>

      {open && createPortal(
        <div
          id="plan-badge-popup"
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-[200] w-56 rounded-xl border border-border bg-white p-3 shadow-xl shadow-zinc-200/60"
        >
          <div className="mb-2 text-[10px] font-black uppercase tracking-wide text-zinc-400">Подписка</div>
          <div className={cn("text-sm font-bold", crit ? "text-orange-600" : warn ? "text-amber-700" : "text-zinc-950")}>
            Тариф {status.planId}
          </div>
          {!crit && status.kind !== "pending" && (
            <>
              <div className="mt-0.5 text-xs text-zinc-500">Действует до {status.expiryFull}</div>
              <div className={cn("mt-0.5 text-xs font-medium", warn ? "text-amber-600" : "text-zinc-400")}>
                {status.daysLeftPhrase}
              </div>
            </>
          )}
          {status.kind === "pending" && (
            <div className="mt-0.5 text-xs text-zinc-400">Активируется после проверки менеджером</div>
          )}
          {crit && (
            <div className="mt-0.5 text-xs text-zinc-400">Витрина может быть недоступна гостям</div>
          )}
          <div className="mt-3 space-y-1">
            <button
              type="button"
              onClick={() => { onNavigate("management", "billing"); setOpen(false); }}
              className={cn(
                "w-full rounded-lg px-3 py-1.5 text-xs font-bold text-white transition",
                crit || warn ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700",
              )}
            >
              {crit ? "Продлить доступ" : warn ? "Продлить тариф" : "Продлить"}
            </button>
            <button
              type="button"
              onClick={() => { onNavigate("management", "billing"); setOpen(false); }}
              className="w-full rounded-lg px-3 py-1.5 text-xs font-medium text-zinc-600 transition hover:bg-zinc-100"
            >
              Управление тарифом
            </button>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Notifications bell with popover ───────────────────────────────────────────

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Прототип: системные события захардкожены.
  const items = [
    {
      title: "Есть несохранённые изменения",
      body: "Сохраните данные, чтобы гости увидели обновлённую версию.",
    },
    {
      title: "Подписка действует до 21 июня",
      body: "Продлите доступ заранее, чтобы витрина не отключилась.",
    },
  ];
  const unread = items.length > 0;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (document.getElementById("notif-popup")?.contains(e.target as Node)) return;
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
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title="Уведомления"
        aria-expanded={open}
        className={cn(
          "relative flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700",
          open && "bg-zinc-100 text-zinc-700",
        )}
      >
        <Bell size={16} />
        {unread && (
          <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 ring-2 ring-white" />
        )}
      </button>

      {open && createPortal(
        <div
          id="notif-popup"
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-[200] w-80 rounded-2xl border border-border bg-white p-2 shadow-xl shadow-zinc-300/40"
        >
          <div className="px-2 py-1.5 text-sm font-black text-zinc-950">Уведомления</div>
          <div className="space-y-0.5">
            {items.map((it) => (
              <div key={it.title} className="rounded-xl px-2 py-2 transition hover:bg-zinc-50">
                <div className="text-[13px] font-bold text-zinc-900">{it.title}</div>
                <p className="mt-0.5 text-xs leading-5 text-zinc-500">{it.body}</p>
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}

// ── Publish button ────────────────────────────────────────────────────────────

function PublishButton({ isLaunchPage }: { isLaunchPage?: boolean }) {
  const { status, totalChanges, publish } = usePublish();
  const { stage } = useVitrineLaunch();
  const { changeModel } = useLayoutMode();

  // On the launch page itself, suppress the launch CTA — the page already shows it
  if (!isLaunchPage) {
    if (stage === "preparing" || stage === "ready") {
      return (
        <button type="button" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50">
          {stage === "ready" ? "Отправить на запуск" : "Продолжить запуск"}
        </button>
      );
    }
    if (stage === "pending") {
      return <span className="text-xs text-zinc-400">Менеджер проверяет витрину</span>;
    }
  }

  // Save + Live Preview model has no global publish — saving happens next to the form.
  if (changeModel === "save-live") return null;

  const hasChanges = totalChanges > 0;
  const isPublishing = status === "publishing" || status === "saving";

  if (isPublishing) {
    return (
      <button type="button" disabled className="flex items-center gap-1.5 rounded-lg bg-blue-400 px-3 py-1.5 text-xs font-bold text-white">
        <Loader2 size={11} className="animate-spin" />
        Публикуем…
      </button>
    );
  }

  if (hasChanges) {
    return (
      <button type="button" onClick={publish} className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700">
        <UploadCloud size={12} />
        Опубликовать
      </button>
    );
  }

  return (
    <button type="button" disabled className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-zinc-400">
      <Check size={11} strokeWidth={2.5} />
      Опубликовано
    </button>
  );
}

// ── Separator ─────────────────────────────────────────────────────────────────

function Sep() {
  return <div className="h-4 w-px shrink-0 bg-zinc-200" />;
}

// ── AppHeaderLeft: brand + sidebar toggle ─────────────────────────────────────
// Lives in the left nav column — same bg as sidebar (zinc-50).

export type AppHeaderLeftProps = {
  compact?: boolean;
  onToggleSidebar?: () => void;
  sidebarExpanded?: boolean;
};

export function AppHeaderLeft({
  compact,
  onToggleSidebar,
  sidebarExpanded = false,
}: AppHeaderLeftProps) {
  return (
    <div className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-200 px-3">
      {!compact && (
        <span className="select-none text-[13px] font-black tracking-tight text-zinc-500">
          TASKO
        </span>
      )}
      {onToggleSidebar && (
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarExpanded ? "Свернуть навигацию" : "Открыть навигацию"}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200/70 hover:text-zinc-600"
        >
          {sidebarExpanded ? <PanelLeftClose size={16} /> : <PanelLeft size={16} />}
        </button>
      )}
    </div>
  );
}

// ── AppHeaderRight: vitrine context + publish + account ───────────────────────
// Lives in the right column — bg-white, creates continuous border with AppHeaderLeft.

export type AppHeaderRightProps = {
  onNavigate: (section: SectionId, tab: string) => void;
  onResetCatalog?: () => void;
  /** Show hamburger for mobile / no inline sidebar */
  showHamburger?: boolean;
  onOpenMobileMenu?: () => void;
  /** Suppress launch CTAs when user is already on the launch page */
  isLaunchPage?: boolean;
};

export function AppHeaderRight({
  onNavigate,
  onResetCatalog,
  showHamburger,
  onOpenMobileMenu,
  isLaunchPage,
}: AppHeaderRightProps) {
  const vitrine = useVitrineStatus();

  return (
    <header className="flex h-11 shrink-0 items-center gap-2 border-b border-zinc-200 bg-white px-4">

      {/* Mobile hamburger */}
      {showHamburger && (
        <button
          type="button"
          onClick={onOpenMobileMenu}
          className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100"
          title="Навигация"
        >
          <Menu size={17} />
        </button>
      )}

      {/* ── Center: 3-column grid — org name as visual anchor ── */}
      <div className="min-w-0 flex-1 grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">

        {/* Left meta: domain */}
        <div className="flex items-center justify-end min-w-0">
          {vitrine.isActive && (
            <span className="hidden truncate text-xs font-medium text-zinc-400 sm:block max-w-[160px]">
              {vitrine.webAddress}
            </span>
          )}
        </div>

        {/* Center: org name */}
        <OrgMenu variant="text" onNavigate={onNavigate} onResetCatalog={onResetCatalog} />

        {/* Right meta: spacer (plan moved to the right cluster) */}
        <div className="min-w-0" />
      </div>

      {/* ── Right: publish + plan chip + notifications + account ── */}
      <div className="flex shrink-0 items-center gap-2">
        <PublishButton isLaunchPage={isLaunchPage} />
        <PlanBadge onNavigate={onNavigate} />
        <NotificationBell />
        <Sep />
        <UserMenu compact placement="down" onNavigate={onNavigate} />
      </div>
    </header>
  );
}
