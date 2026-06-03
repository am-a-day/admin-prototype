import { createPortal } from "react-dom";
import { useState } from "react";
import { Check, CheckCircle2, Circle, Compass, Headset, X } from "lucide-react";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { usePlanStatus } from "@/lib/use-plan-status";
import { PageScroll, PageContent } from "@/components/workspace/page-layout";
import { cn } from "@/lib/utils";
import type { SectionId } from "@/data/mock-data";

type OnNavigate = (section: SectionId, tab: string) => void;

// ── Modals ────────────────────────────────────────────────────────────────────

function PendingModal({ onDismiss }: { onDismiss: () => void }) {
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
          <Check size={22} strokeWidth={2.5} />
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

function ManagerModal({ onDismiss }: { onDismiss: () => void }) {
  const [sent, setSent] = useState(false);
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />
      <div className="relative w-full max-w-sm rounded-2xl bg-white p-6 shadow-2xl">
        {sent ? (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check size={22} strokeWidth={2.5} />
            </div>
            <h3 className="mt-3 text-base font-black text-zinc-950">Менеджер свяжется с вами</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Мы передали запрос. Менеджер напишет вам в течение рабочего дня
              и поможет завершить настройку и запуск витрины.
            </p>
            <button
              type="button"
              onClick={onDismiss}
              className="mt-5 w-full rounded-xl bg-zinc-950 py-2.5 text-sm font-bold text-white transition hover:bg-zinc-800"
            >
              Понятно
            </button>
          </>
        ) : (
          <>
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-blue-50 text-blue-600">
              <Headset size={20} />
            </div>
            <h3 className="mt-3 text-base font-black text-zinc-950">
              Попросить менеджера помочь
            </h3>
            <p className="mt-2 text-sm leading-6 text-zinc-500">
              Менеджер поможет проверить витрину, тариф и запуск. Вы можете
              заполнить всё самостоятельно или передать запуск менеджеру.
            </p>
            <div className="mt-5 flex gap-2.5">
              <button
                type="button"
                onClick={onDismiss}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-50"
              >
                Не сейчас
              </button>
              <button
                type="button"
                onClick={() => setSent(true)}
                className="flex-1 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
              >
                Позвать менеджера
              </button>
            </div>
          </>
        )}
      </div>
    </div>,
    document.body,
  );
}

function TourModal({ onDismiss }: { onDismiss: () => void }) {
  const stops = [
    { area: "Витрина", text: "Меню, оформление и главный экран — всё, что видит гость." },
    { area: "Заказы", text: "Настройка доставки/самовывоза и история входящих заказов." },
    { area: "Аналитика", text: "Сканирования QR, продажи и лайки гостей." },
    { area: "Превью", text: "Справа всегда видно, как витрина выглядит на телефоне гостя." },
  ];
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onDismiss} />
      <div className="relative w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl">
        <button
          type="button"
          onClick={onDismiss}
          className="absolute right-4 top-4 text-zinc-300 transition hover:text-zinc-500"
        >
          <X size={16} />
        </button>
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-zinc-100 text-zinc-600">
          <Compass size={20} />
        </div>
        <h3 className="mt-3 text-base font-black text-zinc-950">Как устроена админка</h3>
        <p className="mt-1.5 text-sm leading-6 text-zinc-500">
          Коротко о том, где что находится. Подробный тур не обязателен —
          можно разобраться по ходу настройки.
        </p>
        <div className="mt-4 space-y-3">
          {stops.map((s, i) => (
            <div key={s.area} className="flex items-start gap-3">
              <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-black text-zinc-500">
                {i + 1}
              </div>
              <div>
                <div className="text-[13px] font-bold text-zinc-800">{s.area}</div>
                <div className="text-[12px] leading-[1.5] text-zinc-500">{s.text}</div>
              </div>
            </div>
          ))}
        </div>
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

// ── Address input ─────────────────────────────────────────────────────────────

function AddressInput({ isNext }: { isNext: boolean }) {
  const { address, setAddress } = useVitrineLaunch();
  const [local, setLocal] = useState(address);

  const commit = () => setAddress(local.trim());
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") commit(); };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center overflow-hidden rounded-xl border border-border bg-white focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100 transition">
        <input
          type="text"
          value={local}
          onChange={(e) => setLocal(e.target.value)}
          onBlur={commit}
          onKeyDown={handleKey}
          placeholder="kimchi"
          className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-[13px] text-zinc-900 placeholder-zinc-300 outline-none"
        />
        <span className="shrink-0 border-l border-border bg-zinc-50 px-3 py-2 font-mono text-[13px] text-zinc-400">
          .tasko.app
        </span>
      </div>
      <p className={cn("text-[11px]", isNext ? "text-zinc-400" : "text-zinc-300")}>
        Адрес будет закреплён после проверки менеджером.
      </p>
    </div>
  );
}

// ── Required step card ────────────────────────────────────────────────────────

function RequiredStep({
  index,
  check,
  isNext,
  onNavigate,
}: {
  index: number;
  check: ReturnType<typeof useVitrineLaunch>["checks"][number];
  isNext: boolean;
  onNavigate: OnNavigate;
}) {
  const { setHoveredStepId } = useVitrineLaunch();
  const planStatus = usePlanStatus();

  // Plan step shows live subscription status instead of a struck-through label
  const isPlanStep = check.id === "plan";
  const planChosen = isPlanStep && check.done;
  const planSub =
    planStatus.kind === "pending"
      ? "Активируется после проверки менеджером"
      : `Действует ${planStatus.expiryLabel}`;

  return (
    <div
      onMouseEnter={() => setHoveredStepId(check.id)}
      onMouseLeave={() => setHoveredStepId(null)}
      className={cn(
        "rounded-2xl border p-5 transition-all",
        check.done
          ? planChosen
            ? "border-border bg-white"
            : "border-border bg-white opacity-55"
          : isNext
            ? "border-blue-200 bg-blue-50/40 shadow-sm"
            : "border-border bg-white",
      )}
    >
      <div className="flex items-start gap-4">
        {/* Indicator */}
        <div className="mt-0.5 shrink-0">
          {check.done ? (
            <CheckCircle2 size={22} className="text-emerald-500" strokeWidth={2} />
          ) : isNext ? (
            <div className="flex h-[22px] w-[22px] items-center justify-center rounded-full bg-blue-600 text-[11px] font-black text-white">
              {index + 1}
            </div>
          ) : (
            <Circle size={22} className="text-zinc-200" strokeWidth={1.5} />
          )}
        </div>

        {/* Content */}
        <div className="min-w-0 flex-1">
          {planChosen ? (
            <>
              <div className="text-[14px] font-semibold leading-snug text-zinc-900">
                {planStatus.planId} выбран
              </div>
              <p className="mt-1 text-[13px] leading-[1.55] text-zinc-500">{planSub}</p>
            </>
          ) : (
            <>
              <div className={cn(
                "text-[14px] font-semibold leading-snug",
                check.done ? "text-zinc-400 line-through decoration-zinc-300" : isNext ? "text-zinc-950" : "text-zinc-600",
              )}>
                {check.label}
              </div>
              {!check.done && (
                <p className={cn("mt-1 text-[13px] leading-[1.55]", isNext ? "text-zinc-600" : "text-zinc-400")}>
                  {check.description}
                </p>
              )}
              {!check.done && check.isAddressStep && <AddressInput isNext={isNext} />}
            </>
          )}
        </div>

        {/* Nav button */}
        {!check.done && !check.isAddressStep && check.section && (
          <button
            type="button"
            onClick={() => onNavigate(check.section!, check.tab!)}
            className={cn(
              "mt-0.5 shrink-0 rounded-lg px-3.5 py-1.5 text-[13px] font-semibold transition",
              isNext
                ? "bg-blue-600 text-white hover:bg-blue-700"
                : "border border-border text-zinc-500 hover:border-zinc-300 hover:bg-zinc-50",
            )}
          >
            {check.actionLabel}
          </button>
        )}
        {planChosen && (
          <button
            type="button"
            onClick={() => onNavigate("management", "billing")}
            className="mt-0.5 shrink-0 rounded-lg border border-border px-3.5 py-1.5 text-[13px] font-semibold text-zinc-500 transition hover:border-zinc-300 hover:bg-zinc-50"
          >
            Изменить тариф
          </button>
        )}
      </div>
    </div>
  );
}

// ── Optional step row ─────────────────────────────────────────────────────────

function OptionalStep({
  check,
  onNavigate,
}: {
  check: ReturnType<typeof useVitrineLaunch>["checks"][number];
  onNavigate: OnNavigate;
}) {
  const { setHoveredStepId } = useVitrineLaunch();

  return (
    <div
      onMouseEnter={() => setHoveredStepId(check.id)}
      onMouseLeave={() => setHoveredStepId(null)}
      className="flex items-start gap-3 border-b border-border py-3.5 last:border-0"
    >
      <div className="mt-0.5 shrink-0">
        {check.done ? (
          <Check size={14} className="text-emerald-500" strokeWidth={2.5} />
        ) : (
          <Circle size={14} className="text-zinc-200" strokeWidth={1.5} />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <div className={cn(
          "text-[13px] font-semibold",
          check.done ? "text-zinc-400 line-through decoration-zinc-300" : "text-zinc-700",
        )}>
          {check.label}
        </div>
        {!check.done && (
          <p className="mt-0.5 text-[12px] leading-[1.5] text-zinc-400">{check.description}</p>
        )}
      </div>

      {!check.done && check.section && (
        <button
          type="button"
          onClick={() => onNavigate(check.section!, check.tab!)}
          className="mt-0.5 shrink-0 text-[12px] font-semibold text-zinc-400 transition hover:text-zinc-900"
        >
          {check.actionLabel} →
        </button>
      )}
    </div>
  );
}

// ── Section wrapper ───────────────────────────────────────────────────────────

function SectionBlock({
  title,
  badge,
  note,
  completedCount,
  totalCount,
  children,
}: {
  title: string;
  badge?: React.ReactNode;
  note?: string;
  completedCount?: number;
  totalCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="mb-4 flex items-center gap-2.5">
        <h3 className="text-[14px] font-black text-zinc-800">{title}</h3>
        {badge}
        {completedCount !== undefined && totalCount !== undefined && (
          <span className="ml-auto text-[12px] font-bold tabular-nums text-zinc-400">
            {completedCount}/{totalCount}
          </span>
        )}
      </div>
      {note && (
        <p className="mb-4 text-[12px] leading-[1.5] text-zinc-400">{note}</p>
      )}
      {children}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function LaunchWorkspace({ onNavigate }: { onNavigate: OnNavigate }) {
  const {
    stage,
    checks,
    requiredCompletedCount,
    requiredTotalCount,
    sendForLaunch,
    simulateActivation,
    confirmVisible,
    dismissConfirm,
    pendingCollapsed,
    collapsePending,
  } = useVitrineLaunch();

  const requiredChecks = checks.filter((c) => c.required);
  const improvements = checks.filter((c) => !c.required && ["home", "appearance", "about", "upsell"].includes(c.id));
  const orderingChecks = checks.filter((c) => ["ordering", "waiter"].includes(c.id));

  const improvementsDone = improvements.filter((c) => c.done).length;
  const orderingDone = orderingChecks.filter((c) => c.done).length;

  const firstRequiredUndoneIdx = requiredChecks.findIndex((c) => !c.done);
  const allRequiredDone = requiredCompletedCount === requiredTotalCount;

  const isActive = stage === "active";
  const isPending = stage === "pending";

  const [managerOpen, setManagerOpen] = useState(false);
  const [tourOpen, setTourOpen] = useState(false);

  return (
    <PageScroll>
      {confirmVisible && <PendingModal onDismiss={dismissConfirm} />}
      {managerOpen && <ManagerModal onDismiss={() => setManagerOpen(false)} />}
      {tourOpen && <TourModal onDismiss={() => setTourOpen(false)} />}

      <PageContent>
        <div className="max-w-2xl space-y-10">

          {/* ── Active banner ── */}
          {isActive && (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
              <div className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full bg-emerald-500" />
                <span className="text-[15px] font-black text-emerald-900">Витрина активна</span>
              </div>
              <p className="mt-1.5 text-[13px] leading-relaxed text-emerald-800/80">
                Ссылка доступна гостям. Редактируйте меню и публикуйте изменения через кнопку «Опубликовать».
              </p>
              <div className="mt-3 flex gap-2.5">
                <button
                  type="button"
                  onClick={() => onNavigate("management", "billing")}
                  className="rounded-lg border border-emerald-200 bg-white px-4 py-1.5 text-[13px] font-semibold text-emerald-800 transition hover:bg-emerald-50"
                >
                  Управление тарифом
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate("storefront", "catalog")}
                  className="text-[13px] text-emerald-700 transition hover:underline"
                >
                  К каталогу →
                </button>
              </div>
            </div>
          )}

          {/* ── Pending banner ── */}
          {isPending && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-5">
              <div className="flex items-start gap-3">
                <span className="mt-1.5 h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-amber-400" />
                <div className="flex-1">
                  <div className="text-[15px] font-black text-zinc-900">Витрина ожидает активации</div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">
                    Менеджер проверяет витрину. После активации ссылка станет доступна гостям.
                  </p>
                  <div className="mt-3 flex items-center gap-3">
                    <button
                      type="button"
                      onClick={simulateActivation}
                      className="rounded-lg border border-amber-200 bg-white px-4 py-1.5 text-[13px] font-semibold text-amber-700 transition hover:bg-amber-50"
                    >
                      Симулировать активацию ↗
                    </button>
                    {!pendingCollapsed && (
                      <button
                        type="button"
                        onClick={collapsePending}
                        className="text-[13px] text-zinc-400 transition hover:text-zinc-600"
                      >
                        Скрыть шаги
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Section 1: Required ── */}
          {(!isPending || !pendingCollapsed) && (
            <SectionBlock
              title="Обязательно для запуска"
              badge={
                <span className={cn(
                  "rounded-full px-2 py-0.5 text-[10px] font-black uppercase tracking-wide",
                  allRequiredDone
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-zinc-100 text-zinc-500",
                )}>
                  {allRequiredDone ? "Готово" : "Обязательно"}
                </span>
              }
              completedCount={requiredCompletedCount}
              totalCount={requiredTotalCount}
            >
              <div className={cn("space-y-3", isPending && "opacity-50 pointer-events-none")}>
                {requiredChecks.map((check, i) => (
                  <RequiredStep
                    key={check.id}
                    index={i}
                    check={check}
                    isNext={i === firstRequiredUndoneIdx && !isPending}
                    onNavigate={onNavigate}
                  />
                ))}
              </div>

              {/* Ready CTA */}
              {allRequiredDone && !isPending && !isActive && (
                <div className="mt-4 rounded-2xl border border-blue-200 bg-blue-50 p-5">
                  <div className="text-[15px] font-black text-blue-900">
                    Витрина готова к запуску
                  </div>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-blue-700/80">
                    Отправьте витрину менеджеру. Он проверит данные, подтвердит тариф и активирует ссылку для гостей.
                  </p>
                  <button
                    type="button"
                    onClick={sendForLaunch}
                    className="mt-4 rounded-xl bg-blue-600 px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-blue-700"
                  >
                    Отправить на запуск
                  </button>
                </div>
              )}

              {/* Preparing CTA */}
              {!allRequiredDone && !isPending && !isActive && (
                <div className="mt-4">
                  <button
                    type="button"
                    onClick={() => {
                      const next = requiredChecks.find((c) => !c.done && c.section);
                      if (next) onNavigate(next.section!, next.tab!);
                    }}
                    className="rounded-xl bg-zinc-950 px-5 py-2 text-[13px] font-bold text-white transition hover:bg-zinc-800"
                  >
                    {requiredCompletedCount === 0 ? "Начать настройку" : "Продолжить настройку"}
                  </button>
                </div>
              )}
            </SectionBlock>
          )}

          {/* ── Section 2: Improvements ── */}
          <SectionBlock
            title="Улучшить витрину"
            badge={
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-zinc-400">
                Рекомендуется
              </span>
            }
            note="Не обязательно для запуска — сделает витрину заметнее для гостей."
            completedCount={improvementsDone}
            totalCount={improvements.length}
          >
            <div className="rounded-2xl border border-border bg-white px-4">
              {improvements.map((check) => (
                <OptionalStep key={check.id} check={check} onNavigate={onNavigate} />
              ))}
            </div>
          </SectionBlock>

          {/* ── Section 3: Ordering ── */}
          <SectionBlock
            title="Приём заказов"
            badge={
              <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[10px] font-black uppercase tracking-wide text-zinc-400">
                Опционально
              </span>
            }
            note="Пропустите, если витрина нужна только для просмотра меню без онлайн-заказов."
            completedCount={orderingDone}
            totalCount={orderingChecks.length}
          >
            <div className="rounded-2xl border border-border bg-white px-4">
              {orderingChecks.map((check) => (
                <OptionalStep key={check.id} check={check} onNavigate={onNavigate} />
              ))}
            </div>
          </SectionBlock>

          {/* ── Need help / manager ── */}
          {!isActive && (
            <div className="flex flex-col gap-3 rounded-2xl border border-border bg-zinc-50/70 p-5 sm:flex-row sm:items-center">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white text-zinc-500 shadow-sm">
                <Headset size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[14px] font-bold text-zinc-900">
                  Не хотите разбираться сами?
                </div>
                <p className="mt-0.5 text-[12px] leading-[1.55] text-zinc-500">
                  Менеджер поможет проверить витрину, тариф и запуск. Вы можете
                  заполнить всё самостоятельно или передать запуск менеджеру.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setManagerOpen(true)}
                className="shrink-0 rounded-xl border border-zinc-300 bg-white px-4 py-2 text-[13px] font-bold text-zinc-700 transition hover:bg-zinc-50"
              >
                Позвать менеджера
              </button>
            </div>
          )}

          {/* ── Optional tour ── */}
          <div className="flex items-center justify-center pb-2">
            <button
              type="button"
              onClick={() => setTourOpen(true)}
              className="flex items-center gap-1.5 text-[12px] font-medium text-zinc-400 transition hover:text-zinc-700"
            >
              <Compass size={13} />
              Показать, как устроена админка
            </button>
          </div>

        </div>
      </PageContent>
    </PageScroll>
  );
}
