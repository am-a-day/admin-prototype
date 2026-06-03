import { createPortal } from "react-dom";
import { Check, ChevronDown, ChevronRight, Circle } from "lucide-react";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { cn } from "@/lib/utils";
import type { SectionId } from "@/data/mock-data";

type OnNavigate = (section: SectionId, tab: string) => void;

// ── Confirmation modal after "Отправить на запуск" ─────────────────────────

function LaunchConfirmModal({ onDismiss }: { onDismiss: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Check size={20} strokeWidth={2.5} />
        </div>
        <h3 className="mt-3 text-base font-black text-zinc-950">
          Витрина отправлена на запуск
        </h3>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Менеджер проверит данные, подтвердит тариф и активирует витрину.
          После активации ссылка станет доступна гостям.
        </p>
        <button
          type="button"
          onClick={onDismiss}
          className="mt-5 w-full rounded-xl bg-zinc-950 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
        >
          Понятно
        </button>
      </div>
    </div>,
    document.body,
  );
}

// ── Full sidebar status block ──────────────────────────────────────────────

export function VitrineLaunchStatus({ onNavigate }: { onNavigate: OnNavigate }) {
  const {
    stage,
    checks,
    completedCount,
    totalCount,
    confirmVisible,
    dismissConfirm,
    sendForLaunch,
    simulateActivation,
    pendingCollapsed,
    collapsePending,
  } = useVitrineLaunch();

  const remaining = totalCount - completedCount;

  return (
    <>
      {confirmVisible && <LaunchConfirmModal onDismiss={dismissConfirm} />}

      <div className="border-t border-border px-2 pt-2 pb-1">

        {/* ── State 1: Preparing ── */}
        {stage === "preparing" && (
          <div className="rounded-xl bg-zinc-50 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12px] font-bold text-zinc-700">Подготовка витрины</span>
            </div>
            <p className="mt-0.5 text-[11px] text-zinc-400">
              {remaining === 1 ? "Остался 1 шаг до запуска" : `Осталось ${remaining} шага до запуска`}
            </p>
            <div className="mt-2.5 space-y-1.5">
              {checks.map((check) => (
                <button
                  key={check.id}
                  type="button"
                  disabled={check.done || !check.section}
                  onClick={() => check.section && onNavigate(check.section, check.tab!)}
                  className={cn(
                    "flex w-full items-center gap-2 text-left text-[11px] transition",
                    check.done
                      ? "cursor-default text-zinc-400"
                      : check.section
                        ? "font-semibold text-zinc-700 hover:text-blue-600"
                        : "text-zinc-500",
                  )}
                >
                  {check.done ? (
                    <Check size={12} className="shrink-0 text-emerald-500" strokeWidth={2.5} />
                  ) : (
                    <Circle size={12} className="shrink-0 text-zinc-300" />
                  )}
                  <span className={check.done ? "line-through decoration-zinc-300" : ""}>
                    {check.label}
                  </span>
                  {!check.done && check.section && (
                    <ChevronRight size={10} className="ml-auto shrink-0 text-zinc-300" />
                  )}
                </button>
              ))}
            </div>
            {/* "Перейти к незавершённому шагу" */}
            {(() => {
              const next = checks.find((c) => !c.done && c.section);
              return next ? (
                <button
                  type="button"
                  onClick={() => onNavigate(next.section!, next.tab!)}
                  className="mt-3 w-full rounded-lg bg-zinc-900 py-1.5 text-[11px] font-bold text-white transition hover:bg-zinc-700"
                >
                  Продолжить настройку
                </button>
              ) : null;
            })()}
          </div>
        )}

        {/* ── State 2: Ready to launch ── */}
        {stage === "ready" && (
          <div className="rounded-xl bg-blue-50 p-3">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-blue-500" />
              <span className="text-[12px] font-bold text-blue-900">Готова к запуску</span>
            </div>
            <p className="mt-1 text-[11px] leading-[1.5] text-blue-700/80">
              Проверьте данные и отправьте витрину менеджеру на активацию.
            </p>
            <button
              type="button"
              onClick={sendForLaunch}
              className="mt-2.5 w-full rounded-lg bg-blue-600 py-1.5 text-[11px] font-bold text-white transition hover:bg-blue-700"
            >
              Отправить на запуск
            </button>
          </div>
        )}

        {/* ── State 3+4: Pending activation ── */}
        {stage === "pending" && !pendingCollapsed && (
          <div className="rounded-xl border border-border bg-white p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400" />
                <span className="text-[12px] font-bold text-zinc-800">Ожидает активации</span>
              </div>
              <button
                type="button"
                onClick={collapsePending}
                className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded text-zinc-300 hover:text-zinc-500"
                title="Свернуть"
              >
                <ChevronDown size={12} />
              </button>
            </div>
            <p className="mt-1 text-[11px] leading-[1.5] text-zinc-500">
              Витрина передана менеджеру. Как только он активирует её, ссылка станет доступна гостям.
            </p>
            {/* Demo helper */}
            <button
              type="button"
              onClick={simulateActivation}
              className="mt-2.5 w-full rounded-lg border border-border py-1.5 text-[11px] font-semibold text-zinc-500 transition hover:bg-zinc-50 hover:text-zinc-700"
            >
              Симулировать активацию ↗
            </button>
          </div>
        )}

        {stage === "pending" && pendingCollapsed && (
          <button
            type="button"
            onClick={() => {}} // no-op, just status indicator
            className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-50"
          >
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-amber-400 shrink-0" />
            <span className="text-[11px] font-semibold text-zinc-500">Ожидает активации</span>
          </button>
        )}

        {/* ── State 5: Active ── */}
        {stage === "active" && (
          <div className="rounded-xl bg-emerald-50 p-3">
            <div className="flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="text-[12px] font-bold text-emerald-900">Витрина активна</span>
            </div>
            <p className="mt-0.5 text-[11px] text-emerald-700/80">
              Ссылка доступна гостям.
            </p>
            <button
              type="button"
              onClick={() => onNavigate("management", "billing")}
              className="mt-2.5 w-full rounded-lg border border-emerald-200 bg-white py-1.5 text-[11px] font-semibold text-emerald-800 transition hover:bg-emerald-50"
            >
              Управление тарифом
            </button>
          </div>
        )}

      </div>
    </>
  );
}

// ── Rail / compact indicator ──────────────────────────────────────────────

export function VitrineLaunchRailDot() {
  const { stage } = useVitrineLaunch();

  const dotClass =
    stage === "active"
      ? "bg-emerald-500"
      : stage === "pending"
        ? "bg-amber-400 animate-pulse"
        : stage === "ready"
          ? "bg-blue-500"
          : "bg-zinc-300";

  const title =
    stage === "active"
      ? "Витрина активна"
      : stage === "pending"
        ? "Ожидает активации"
        : stage === "ready"
          ? "Готова к запуску"
          : "Подготовка витрины";

  return (
    <div
      className="flex h-8 w-8 items-center justify-center"
      title={title}
    >
      <span className={cn("h-2 w-2 rounded-full", dotClass)} />
    </div>
  );
}
