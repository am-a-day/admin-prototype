import { useEffect, useRef, useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { usePlanStatus } from "@/lib/use-plan-status";
import { type SectionId } from "@/data/mock-data";
import { cn } from "@/lib/utils";

// ── Design tokens (exact from Figma node 54-607) ──────────────────────────────

const THEME = {
  active: {
    pillBg:   "bg-[#d0fae5]",
    pillText: "text-[#004f3b]",
    fill:     "bg-[#009966]",
    subtitle: "text-[#79716b]",
    miniFill: "bg-[#009966]",
  },
  warning: {
    pillBg:   "bg-[#fef3c6]",
    pillText: "text-[#bb4d00]",
    fill:     "bg-[#fe9a00]",
    subtitle: "text-[#973c00]",
    miniFill: "bg-[#fe9a00]",
  },
  danger: {
    pillBg:   "bg-[#ffe4e6]",
    pillText: "text-[#c70036]",
    fill:     "bg-[#ec003f]",
    subtitle: "text-[#a50036]",
    miniFill: "bg-[#ff2056]",
  },
  expired: {
    pillBg:   "bg-[#ffe4e6]",
    pillText: "text-[#c70036]",
    fill:     "bg-[#e7e5e4]", // all inactive
    subtitle: "text-[#a50036]",
    miniFill: "bg-[#d6d3d1]",
  },
  beforeLaunch: {
    pillBg:   "bg-[#e7e5e4]",
    pillText: "text-[#79716b]",
    fill:     "bg-[#e7e5e4]",
    subtitle: "text-[#79716b]",
    miniFill: "bg-[#d6d3d1]",
  },
} as const;

type VisualState = keyof typeof THEME;

const SEGMENTS    = 20;   // horizontal bars in expanded
const MINI_SEGS   = 5;    // vertical bars in collapsed
const PERIOD_DAYS = 30;

// ── Helpers ───────────────────────────────────────────────────────────────────

function getVisualState(kind: string, daysLeft: number): VisualState {
  if (kind === "pending")  return "beforeLaunch";
  if (kind === "expired")  return "expired";
  if (kind === "expiring") return daysLeft <= 3 ? "danger" : "warning";
  if (kind === "active")   return "active";
  return "beforeLaunch";
}

function filledCount(daysLeft: number, total: number, vs: VisualState): number {
  if (vs === "expired" || vs === "beforeLaunch") return 0;
  return Math.max(1, Math.min(total, Math.round((daysLeft / PERIOD_DAYS) * total)));
}

function miniFilledCount(daysLeft: number, vs: VisualState): number {
  if (vs === "expired" || vs === "beforeLaunch") return 0;
  if (daysLeft >= 20) return 5;
  if (daysLeft >= 14) return 4;
  if (daysLeft >= 8)  return 3;
  if (daysLeft >= 4)  return 2;
  return 1;
}

// ── Popover ───────────────────────────────────────────────────────────────────

function PlanPopover({
  pos,
  vs,
  daysLeft,
  planId,
  onNavigate,
  onClose,
}: {
  pos: { left: number; bottom: number };
  vs: VisualState;
  daysLeft: number;
  planId: string;
  onNavigate: (s: SectionId, t: string) => void;
  onClose: () => void;
}) {
  const go = () => { onNavigate("management", "billing"); onClose(); };

  const title =
    vs === "beforeLaunch" ? `${planId} · начнётся после запуска` :
    vs === "expired"      ? `Тариф ${planId} истёк` :
    vs === "danger"       ? `Тариф ${planId} истекает через ${daysLeft} дн.` :
    vs === "warning"      ? `Тариф ${planId} · осталось ${daysLeft} дн.` :
    `Тариф ${planId} · ${daysLeft} дн.`;

  const body =
    vs === "beforeLaunch" ? "Тариф начнётся после того, как менеджер активирует витрину." :
    vs === "expired"      ? "Платные функции ограничены. Продлите тариф, чтобы восстановить доступ." :
    vs === "danger"       ? "Чтобы сохранить доступ, продлите тариф до истечения срока." :
    vs === "warning"      ? "Продлите тариф заблаговременно, чтобы не потерять доступ." :
    `Подписка активна.`;

  return createPortal(
    <div
      id="plan-widget-popup"
      style={{ left: pos.left, bottom: pos.bottom }}
      className="fixed z-[200] w-56 rounded-xl border border-[#d6d3d1] bg-white p-3 shadow-xl shadow-zinc-300/40"
    >
      <div className={cn(
        "text-[13px] font-semibold",
        vs === "expired" || vs === "danger" ? "text-[#a50036]" :
        vs === "warning" ? "text-[#973c00]" : "text-[#292524]",
      )}>
        {title}
      </div>
      <p className="mt-1 text-[12px] leading-[1.55] text-[#79716b]">{body}</p>
      {vs !== "beforeLaunch" && vs !== "active" && (
        <button
          type="button"
          onClick={go}
          className="mt-3 w-full rounded-[10px] border border-[#d6d3d1] bg-white py-1.5 text-[13px] text-[#292524] transition hover:bg-zinc-50"
        >
          Продлить
        </button>
      )}
      <button
        type="button"
        onClick={go}
        className="mt-1.5 w-full rounded-[10px] py-1.5 text-[12px] text-[#79716b] transition hover:bg-zinc-50"
      >
        Управление тарифом
      </button>
    </div>,
    document.body,
  );
}

// ── Expanded widget ───────────────────────────────────────────────────────────

function ExpandedWidget({
  btnRef,
  open,
  onToggle,
  onNavigate,
}: {
  btnRef: React.RefObject<HTMLButtonElement>;
  open: boolean;
  onToggle: () => void;
  onNavigate: (s: SectionId, t: string) => void;
}) {
  const { kind, planId, daysLeft } = usePlanStatus();
  if (kind === "none") return null;

  const vs    = getVisualState(kind, daysLeft);
  const theme = THEME[vs];
  const filled = filledCount(daysLeft, SEGMENTS, vs);
  const showWarningIcon = vs === "warning" || vs === "danger" || vs === "expired";
  const showRenew = vs === "warning" || vs === "danger" || vs === "expired";

  const subtitle =
    vs === "beforeLaunch" ? "Начнётся после запуска" :
    vs === "expired"      ? "Подписка закончилась" :
    vs === "danger"       ? `Истекает через ${daysLeft} ${daysLeft === 1 ? "день" : "дня"}` :
    daysLeft === 1        ? "Остался 1 день" :
    `Осталось ${daysLeft} ${daysLeft < 5 ? "дня" : "дней"}`;

  return (
    <div className="shrink-0 px-3 pb-3 pt-1">
      <div className="flex flex-col gap-[9px]">

        {/* Progress section */}
        <div className="flex flex-col gap-[4px]">

          {/* Row 1: pill + segments + chevron */}
          <button
            ref={btnRef}
            type="button"
            onClick={onToggle}
            aria-expanded={open}
            className="flex w-full items-center gap-[8px] rounded-md px-1 py-0.5 transition hover:bg-zinc-200/40"
          >
            {/* Pill */}
            <div className={cn(
              "flex h-[17px] w-[36px] shrink-0 items-center justify-center rounded-[3px]",
              theme.pillBg,
            )}>
              <span className={cn("text-[11px] font-medium leading-none", theme.pillText)}>
                {planId.toUpperCase()}
              </span>
            </div>

            {/* Segments */}
            <div className="flex flex-1 items-center gap-[2px] min-w-0 overflow-hidden">
              {Array.from({ length: SEGMENTS }).map((_, i) => (
                <div
                  key={i}
                  className={cn(
                    "h-[13px] w-[3px] shrink-0 rounded-[50px]",
                    i < filled ? theme.fill : "bg-[#e7e5e4]",
                  )}
                />
              ))}
            </div>

            {/* Chevron */}
            <ChevronDown
              size={12}
              className={cn("shrink-0 text-[#79716b] transition", open && "rotate-180")}
            />
          </button>

          {/* Row 2: subtitle */}
          <div className="flex items-center gap-[4px] px-1">
            {showWarningIcon && (
              <AlertTriangle
                size={14}
                className={cn(
                  "shrink-0",
                  vs === "warning" ? "text-[#973c00]" : "text-[#a50036]",
                )}
                strokeWidth={2}
              />
            )}
            <span className={cn("text-[13px] font-normal leading-snug", theme.subtitle)}>
              {subtitle}
            </span>
          </div>
        </div>

        {/* Продлить button */}
        {showRenew && (
          <button
            type="button"
            onClick={() => onNavigate("management", "billing")}
            className="flex h-[32px] w-full items-center justify-center rounded-[10px] border border-[#d6d3d1] bg-white text-[14px] text-[#292524] transition hover:bg-zinc-50"
          >
            Продлить
          </button>
        )}
      </div>
    </div>
  );
}

// ── Compact (rail) widget ─────────────────────────────────────────────────────

function CompactWidget({
  btnRef,
  open,
  onToggle,
}: {
  btnRef: React.RefObject<HTMLButtonElement>;
  open: boolean;
  onToggle: () => void;
}) {
  const { kind, planId, daysLeft } = usePlanStatus();
  if (kind === "none") return null;

  const vs      = getVisualState(kind, daysLeft);
  const theme   = THEME[vs];
  const filled  = miniFilledCount(daysLeft, vs);
  const showDot = vs === "expired";

  const tooltip =
    vs === "beforeLaunch" ? `${planId} · начнётся после запуска` :
    vs === "expired"      ? "Тариф истёк" :
    vs === "danger"       ? `${planId} истекает через ${daysLeft} дн.` :
    vs === "warning"      ? `${planId} · осталось ${daysLeft} дн.` :
    `${planId} · ${daysLeft} дн.`;

  return (
    <div className="flex shrink-0 justify-center pb-3 pt-1">
      <button
        ref={btnRef}
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        className="group relative flex flex-col items-center gap-[6px] rounded-[7px] px-[7px] py-[6px] transition hover:bg-zinc-200/50"
      >
        {/* Pill */}
        <div className={cn(
          "flex h-[14px] items-center justify-center rounded-[3px] px-[2px]",
          theme.pillBg,
        )}>
          <span className={cn("text-[11px] font-semibold leading-none", theme.pillText)}>
            {planId.toUpperCase()}
          </span>
        </div>

        {/* Vertical mini bars */}
        <div className="flex items-end gap-[2px]">
          {Array.from({ length: MINI_SEGS }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "h-[15px] w-[3px] rounded-[50px]",
                i < filled ? theme.miniFill : "bg-[#d6d3d1]",
              )}
            />
          ))}
        </div>

        {/* Alert dot (expired only) */}
        {showDot && (
          <div className="absolute -right-[0.5px] -top-[0.5px] size-[6px] rounded-full border border-white bg-[#ec003f]" />
        )}

        {/* Tooltip */}
        <span className="pointer-events-none absolute left-10 z-50 hidden whitespace-nowrap rounded-lg bg-zinc-950 px-2 py-1 text-xs text-white shadow-xl group-hover:block">
          {tooltip}
        </span>
      </button>
    </div>
  );
}

// ── Main export ───────────────────────────────────────────────────────────────

export function PlanWidget({
  onNavigate,
  compact = false,
}: {
  onNavigate: (s: SectionId, t: string) => void;
  compact?: boolean;
}) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
  const { kind, planId, daysLeft } = usePlanStatus();

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (document.getElementById("plan-widget-popup")?.contains(e.target as Node)) return;
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

  if (kind === "none") return null;

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ left: r.left, bottom: window.innerHeight - r.top + 6 });
    }
    setOpen((v) => !v);
  };

  const vs = getVisualState(kind, daysLeft);

  return (
    <>
      {compact ? (
        <CompactWidget btnRef={btnRef} open={open} onToggle={toggle} />
      ) : (
        <ExpandedWidget btnRef={btnRef} open={open} onToggle={toggle} onNavigate={onNavigate} />
      )}
      {open && (
        <PlanPopover
          pos={pos}
          vs={vs}
          daysLeft={daysLeft}
          planId={planId}
          onNavigate={onNavigate}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
