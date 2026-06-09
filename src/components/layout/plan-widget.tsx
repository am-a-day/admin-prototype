import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { usePlanStatus } from "@/lib/use-plan-status";
import { type SectionId } from "@/data/mock-data";
import { cn } from "@/lib/utils";

const SEGMENTS = 20;
const PERIOD_DAYS = 30; // условный расчётный период подписки

/**
 * Компактный виджет тарифа внизу sidebar: LITE · прогресс срока · «Осталось N дней».
 * Действие «Продлить» спрятано в popover, чтобы не конкурировать с навигацией.
 */
export function PlanWidget({ onNavigate }: { onNavigate: (s: SectionId, t: string) => void }) {
  const status = usePlanStatus();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ left: 0, bottom: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

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

  if (status.kind === "none") return null;

  const expired = status.kind === "expired";
  const warn = status.kind === "expiring";
  const daysLeft = "daysLeft" in status ? status.daysLeft : PERIOD_DAYS;

  const filled = expired
    ? 0
    : Math.max(1, Math.min(SEGMENTS, Math.round((daysLeft / PERIOD_DAYS) * SEGMENTS)));
  const fillColor = expired ? "bg-orange-500" : warn ? "bg-amber-500" : "bg-emerald-500";

  const subtitle = expired
    ? "Подписка закончилась"
    : daysLeft === 1
      ? "Остался 1 день"
      : `Осталось ${daysLeft} ${daysLeft < 5 ? "дня" : "дней"}`;

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ left: r.left, bottom: window.innerHeight - r.top + 6 });
    }
    setOpen((v) => !v);
  };

  return (
    <div className="shrink-0 px-3 pb-3 pt-1">
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="flex w-full flex-col gap-1 rounded-lg px-1.5 py-1.5 text-left transition hover:bg-zinc-200/50"
      >
        <div className="flex w-full items-center gap-2">
          <span className="flex h-[17px] shrink-0 items-center justify-center rounded-[3px] bg-[#e7e5e4] px-1.5 text-[11px] font-medium text-[#292524]">
            {String(status.planId).toUpperCase()}
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-[2px]">
            {Array.from({ length: SEGMENTS }).map((_, i) => (
              <span
                key={i}
                className={cn(
                  "h-[13px] w-[3px] shrink-0 rounded-full",
                  i < filled ? fillColor : "bg-[#e7e5e4]",
                )}
              />
            ))}
          </div>
          <ChevronDown size={12} className={cn("shrink-0 text-zinc-400 transition", open && "rotate-180")} />
        </div>
        <span className="text-[13px] text-[#79716b]">{subtitle}</span>
      </button>

      {open && createPortal(
        <div
          id="plan-widget-popup"
          style={{ left: pos.left, bottom: pos.bottom }}
          className="fixed z-[200] w-56 rounded-xl border border-border bg-white p-3 shadow-xl shadow-zinc-300/40"
        >
          <div className="text-sm font-bold text-zinc-950">Тариф {status.planId}</div>
          <div className={cn("mt-0.5 text-xs", expired ? "text-orange-600" : warn ? "text-amber-600" : "text-zinc-500")}>
            {subtitle}
          </div>
          <div className="mt-3 space-y-1">
            <button
              type="button"
              onClick={() => { onNavigate("management", "billing"); setOpen(false); }}
              className={cn(
                "w-full rounded-lg px-3 py-1.5 text-xs font-bold text-white transition",
                expired || warn ? "bg-amber-500 hover:bg-amber-600" : "bg-blue-600 hover:bg-blue-700",
              )}
            >
              Продлить
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
    </div>
  );
}
