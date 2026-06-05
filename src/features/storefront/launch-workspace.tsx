import { createPortal } from "react-dom";
import { useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Check,
  CheckCircle2,
  Circle,
  Compass,
  Headset,
  Home as HomeIcon,
  LayoutGrid,
  Palette,
  Truck,
} from "lucide-react";
import { useVitrineLaunch, type LaunchTabId } from "@/contexts/vitrine-launch-context";
import { usePlanStatus } from "@/lib/use-plan-status";
import { cn } from "@/lib/utils";
import type { SectionId } from "@/data/mock-data";

type OnNavigate = (section: SectionId, tab: string) => void;

// ── Tab definitions ───────────────────────────────────────────────────────────

type TabCounts = {
  requiredDone: number;
  requiredTotal: number;
  improveDone: number;
  improveTotal: number;
  ordersDone: number;
  ordersTotal: number;
};

type TabDef = {
  id: LaunchTabId;
  label: string;
  sublabel: (c: TabCounts, stage: string) => string;
};

const LAUNCH_TABS: TabDef[] = [
  {
    id: "quick",
    label: "Быстрый запуск",
    sublabel: (c, stage) =>
      stage === "active" ? "Витрина активна" :
      stage === "pending" ? "Ожидает активации" :
      c.requiredDone === c.requiredTotal ? "Обязательные выполнены" :
      `${c.requiredDone} из ${c.requiredTotal} обязательных`,
  },
  {
    id: "improve",
    label: "Улучшить витрину",
    sublabel: (c) => `${c.improveDone} из ${c.improveTotal} рекомендованных`,
  },
  {
    id: "orders",
    label: "Прием заказов",
    sublabel: (c) => `${c.ordersDone} из ${c.ordersTotal} опциональных`,
  },
  {
    id: "manager",
    label: "Помощь менеджера",
    sublabel: () => "Передать запуск менеджеру",
  },
  {
    id: "tour",
    label: "Знакомство с админкой",
    sublabel: () => "Короткий обзор интерфейса",
  },
];

// ── Tour sections ─────────────────────────────────────────────────────────────

type TourSection = {
  icon: LucideIcon;
  label: string;
  desc: string;
  section: SectionId;
  tab: string;
};

const TOUR_SECTIONS: TourSection[] = [
  { icon: LayoutGrid, label: "Каталог",     desc: "Разделы и позиции меню",                   section: "storefront", tab: "catalog"        },
  { icon: HomeIcon,   label: "Главная",     desc: "Баннеры и ключевые разделы",               section: "storefront", tab: "home"           },
  { icon: Palette,    label: "Оформление",  desc: "Внешний вид витрины",                      section: "storefront", tab: "appearance"     },
  { icon: Truck,      label: "Заказы",      desc: "Доставка, самовывоз и уведомления",        section: "management", tab: "order-settings" },
  { icon: BarChart3,  label: "Аналитика",   desc: "Сканирования, продажи и лайки",            section: "analytics",  tab: "scans"          },
];

// ── Tab nav item ──────────────────────────────────────────────────────────────

function TabNavItem({
  def,
  active,
  counts,
  stage,
  onClick,
}: {
  def: TabDef;
  active: boolean;
  counts: TabCounts;
  stage: string;
  onClick: () => void;
}) {
  const sublabel = def.sublabel(counts, stage);
  const isQuickDone = def.id === "quick" && counts.requiredDone === counts.requiredTotal;
  const isQuickActive = def.id === "quick" && stage === "active";
  const isQuickPending = def.id === "quick" && stage === "pending";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full border-l-2 px-4 py-2.5 text-left transition",
        active
          ? "border-blue-500 bg-zinc-50/80"
          : "border-transparent hover:border-zinc-200 hover:bg-zinc-50/60",
      )}
    >
      <div className={cn(
        "text-[13px] leading-snug",
        active ? "font-semibold text-zinc-950" : "font-medium text-zinc-600",
      )}>
        {def.label}
      </div>
      <div className={cn(
        "mt-0.5 text-[11px]",
        isQuickActive ? "text-emerald-600" :
        isQuickPending ? "text-amber-600" :
        isQuickDone ? "text-emerald-600" :
        "text-zinc-400",
      )}>
        {sublabel}
      </div>
    </button>
  );
}

// ── Pending confirmation modal ────────────────────────────────────────────────

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

// ── Address input ─────────────────────────────────────────────────────────────

function AddressInput({ isNext }: { isNext: boolean }) {
  const { address, setAddress } = useVitrineLaunch();
  const [local, setLocal] = useState(address);

  const commit = () => setAddress(local.trim());
  const handleKey = (e: React.KeyboardEvent) => { if (e.key === "Enter") commit(); };

  return (
    <div className="mt-3 space-y-2">
      <div className="flex items-center overflow-hidden rounded-xl border border-border bg-white transition focus-within:border-blue-400 focus-within:ring-2 focus-within:ring-blue-100">
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

function OptionalStepRow({
  check,
  onNavigate,
  isLast,
}: {
  check: ReturnType<typeof useVitrineLaunch>["checks"][number];
  onNavigate: OnNavigate;
  isLast: boolean;
}) {
  const { setHoveredStepId } = useVitrineLaunch();

  return (
    <div
      onMouseEnter={() => setHoveredStepId(check.id)}
      onMouseLeave={() => setHoveredStepId(null)}
      className={cn(
        "flex items-start gap-3 px-4 py-3.5",
        !isLast && "border-b border-border",
      )}
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

// ── Tab content: Быстрый запуск ───────────────────────────────────────────────

function QuickLaunchTab({
  requiredChecks,
  firstUndoneIdx,
  allDone,
  isPending,
  isActive,
  pendingCollapsed,
  onNavigate,
  onSendForLaunch,
  onSimulateActivation,
  onCollapsePending,
}: {
  requiredChecks: ReturnType<typeof useVitrineLaunch>["checks"];
  firstUndoneIdx: number;
  allDone: boolean;
  isPending: boolean;
  isActive: boolean;
  pendingCollapsed: boolean;
  onNavigate: OnNavigate;
  onSendForLaunch: () => void;
  onSimulateActivation: () => void;
  onCollapsePending: () => void;
}) {
  return (
    <div className="px-7 py-6">
      <div className="max-w-xl">
        <h2 className="text-[15px] font-bold text-zinc-950">Быстрый запуск</h2>
        <p className="mt-1 text-[13px] leading-[1.65] text-zinc-500">
          Выполните 3 обязательных шага, чтобы отправить витрину менеджеру на запуск.
        </p>

        {/* Active banner */}
        {isActive && (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-2.5">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              <span className="text-[15px] font-bold text-emerald-900">Витрина активна</span>
            </div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-emerald-800/80">
              Ссылка доступна гостям. Редактируйте меню и публикуйте изменения через кнопку «Опубликовать».
            </p>
            <div className="mt-3 flex gap-2.5">
              <button
                type="button"
                onClick={() => onNavigate("management", "billing")}
                className="rounded-lg border border-emerald-200 bg-white px-4 py-1.5 text-[12px] font-semibold text-emerald-800 transition hover:bg-emerald-50"
              >
                Управление тарифом
              </button>
              <button
                type="button"
                onClick={() => onNavigate("storefront", "catalog")}
                className="text-[12px] text-emerald-700 transition hover:underline"
              >
                К каталогу →
              </button>
            </div>
          </div>
        )}

        {/* Pending banner */}
        {isPending && (
          <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-5">
            <div className="flex items-start gap-3">
              <span className="mt-1.5 h-2 w-2 shrink-0 animate-pulse rounded-full bg-amber-400" />
              <div className="flex-1">
                <div className="text-[14px] font-bold text-zinc-900">Витрина ожидает активации</div>
                <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-600">
                  Менеджер проверяет витрину. После активации ссылка станет доступна гостям.
                </p>
                <div className="mt-3 flex items-center gap-3">
                  <button
                    type="button"
                    onClick={onSimulateActivation}
                    className="rounded-lg border border-amber-200 bg-white px-3.5 py-1.5 text-[12px] font-semibold text-amber-700 transition hover:bg-amber-50"
                  >
                    Симулировать активацию ↗
                  </button>
                  {!pendingCollapsed && (
                    <button
                      type="button"
                      onClick={onCollapsePending}
                      className="text-[12px] text-zinc-400 transition hover:text-zinc-600"
                    >
                      Скрыть шаги
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Required steps */}
        {!isActive && (!isPending || !pendingCollapsed) && (
          <div className={cn("mt-5 space-y-3", isPending && "pointer-events-none opacity-50")}>
            {requiredChecks.map((check, i) => (
              <RequiredStep
                key={check.id}
                index={i}
                check={check}
                isNext={i === firstUndoneIdx && !isPending}
                onNavigate={onNavigate}
              />
            ))}
          </div>
        )}

        {/* Ready CTA */}
        {allDone && !isPending && !isActive && (
          <div className="mt-5 rounded-2xl border border-blue-200 bg-blue-50 p-5">
            <div className="text-[15px] font-bold text-blue-900">Витрина готова к запуску</div>
            <p className="mt-1.5 text-[13px] leading-relaxed text-blue-700/80">
              Отправьте витрину менеджеру. Он проверит данные, подтвердит тариф и активирует ссылку для гостей.
            </p>
            <button
              type="button"
              onClick={onSendForLaunch}
              className="mt-4 rounded-xl bg-blue-600 px-6 py-2.5 text-[13px] font-bold text-white transition hover:bg-blue-700"
            >
              Отправить на запуск
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Tab content: Улучшить витрину ─────────────────────────────────────────────

function ImproveTab({
  checks,
  onNavigate,
}: {
  checks: ReturnType<typeof useVitrineLaunch>["checks"];
  onNavigate: OnNavigate;
}) {
  return (
    <div className="px-7 py-6">
      <div className="max-w-xl">
        <h2 className="text-[15px] font-bold text-zinc-950">Улучшить витрину</h2>
        <p className="mt-1 text-[13px] leading-[1.65] text-zinc-500">
          Эти шаги не обязательны для запуска, но помогут сделать витрину заметнее для гостей.
        </p>
        <div className="mt-5 rounded-2xl border border-border bg-white">
          {checks.map((check, i) => (
            <OptionalStepRow
              key={check.id}
              check={check}
              onNavigate={onNavigate}
              isLast={i === checks.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab content: Прием заказов ────────────────────────────────────────────────

function OrdersTab({
  checks,
  onNavigate,
}: {
  checks: ReturnType<typeof useVitrineLaunch>["checks"];
  onNavigate: OnNavigate;
}) {
  return (
    <div className="px-7 py-6">
      <div className="max-w-xl">
        <h2 className="text-[15px] font-bold text-zinc-950">Прием заказов</h2>
        <p className="mt-1 text-[13px] leading-[1.65] text-zinc-500">
          Пропустите этот раздел, если витрина нужна только для просмотра меню без онлайн-заказов.
        </p>
        <div className="mt-5 rounded-2xl border border-border bg-white">
          {checks.map((check, i) => (
            <OptionalStepRow
              key={check.id}
              check={check}
              onNavigate={onNavigate}
              isLast={i === checks.length - 1}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Tab content: Помощь менеджера ─────────────────────────────────────────────

function ManagerTab({
  sent,
  onSend,
}: {
  sent: boolean;
  onSend: () => void;
}) {
  return (
    <div className="px-7 py-6">
      <div className="max-w-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
          <Headset size={18} />
        </div>
        <h2 className="mt-3 text-[15px] font-bold text-zinc-950">Нужна помощь с запуском?</h2>
        <p className="mt-1.5 text-[13px] leading-[1.65] text-zinc-500">
          Менеджер поможет проверить меню, тариф и адрес витрины. Вы можете заполнить всё
          самостоятельно или передать запуск менеджеру.
        </p>

        {sent ? (
          <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <Check size={17} strokeWidth={2.5} />
              </div>
              <div>
                <div className="text-[14px] font-bold text-emerald-900">Менеджер свяжется с вами</div>
                <p className="mt-0.5 text-[12px] leading-relaxed text-emerald-700/80">
                  Мы передали запрос. Менеджер напишет в течение рабочего дня.
                </p>
              </div>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={onSend}
            className="mt-5 rounded-xl bg-blue-600 px-6 py-2.5 text-[13px] font-bold text-white transition hover:bg-blue-700"
          >
            Позвать менеджера
          </button>
        )}

        <p className="mt-4 text-[12px] leading-[1.6] text-zinc-400">
          Вы сможете продолжить настройку самостоятельно, даже если попросите менеджера помочь.
        </p>
      </div>
    </div>
  );
}

// ── Tab content: Знакомство с админкой ───────────────────────────────────────

function TourTab({ onNavigate }: { onNavigate: OnNavigate }) {
  return (
    <div className="px-7 py-6">
      <div className="max-w-xl">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
          <Compass size={18} />
        </div>
        <h2 className="mt-3 text-[15px] font-bold text-zinc-950">Как устроена админка</h2>
        <p className="mt-1.5 text-[13px] leading-[1.65] text-zinc-500">
          Короткий обзор основных разделов. Подробный тур не обязателен —
          можно разобраться по ходу настройки.
        </p>
        <div className="mt-5 space-y-2">
          {TOUR_SECTIONS.map(({ icon: Icon, label, desc, section, tab }) => (
            <div
              key={label}
              className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3"
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-zinc-100 text-zinc-500">
                <Icon size={15} />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold text-zinc-800">{label}</div>
                <div className="text-[12px] text-zinc-400">{desc}</div>
              </div>
              <button
                type="button"
                onClick={() => onNavigate(section, tab)}
                className="shrink-0 text-[12px] font-semibold text-zinc-400 transition hover:text-zinc-900"
              >
                Открыть →
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Main workspace ────────────────────────────────────────────────────────────

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
    activeLaunchTab,
    setActiveLaunchTab,
    launchDismissed: _dismissed,
    dismissLaunch,
  } = useVitrineLaunch();

  const requiredChecks = checks.filter((c) => c.required);
  const improvements = checks.filter(
    (c) => !c.required && ["home", "appearance", "about", "upsell"].includes(c.id),
  );
  const orderingChecks = checks.filter((c) => ["ordering", "waiter"].includes(c.id));

  const improveDone = improvements.filter((c) => c.done).length;
  const ordersDone = orderingChecks.filter((c) => c.done).length;

  const counts: TabCounts = {
    requiredDone: requiredCompletedCount,
    requiredTotal: requiredTotalCount,
    improveDone,
    improveTotal: improvements.length,
    ordersDone,
    ordersTotal: orderingChecks.length,
  };

  const allRequiredDone = requiredCompletedCount === requiredTotalCount;
  const firstUndoneIdx = requiredChecks.findIndex((c) => !c.done);
  const isActive = stage === "active";
  const isPending = stage === "pending";

  const [managerSent, setManagerSent] = useState(false);

  return (
    <div className="flex min-w-0 flex-1 overflow-hidden">
      {confirmVisible && <PendingModal onDismiss={dismissConfirm} />}

      {/* ── Left tab nav ── */}
      <div className="flex w-44 shrink-0 flex-col overflow-y-auto border-r border-zinc-100 py-3">

        {/* Status badge */}
        {(isPending || isActive) && (
          <div className="mb-3 px-4">
            <div className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold",
              isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
            )}>
              <span className={cn(
                "h-1.5 w-1.5 shrink-0 rounded-full",
                isActive ? "bg-emerald-500" : "bg-amber-400 animate-pulse",
              )} />
              {isActive ? "Витрина активна" : "Проверяется"}
            </div>
          </div>
        )}

        {/* Tab items */}
        {LAUNCH_TABS.map((def) => (
          <TabNavItem
            key={def.id}
            def={def}
            active={activeLaunchTab === def.id}
            counts={counts}
            stage={stage}
            onClick={() => setActiveLaunchTab(def.id)}
          />
        ))}

        {/* Dismiss — only after activation */}
        {isActive && (
          <div className="mt-auto px-4 pb-4 pt-6">
            <button
              type="button"
              onClick={dismissLaunch}
              className="text-[11px] leading-[1.5] text-zinc-400 underline underline-offset-2 transition hover:text-zinc-600"
            >
              Скрыть страницу запуска
            </button>
          </div>
        )}
      </div>

      {/* ── Right content area ── */}
      <div className="min-w-0 flex-1 overflow-y-auto bg-white">
        {activeLaunchTab === "quick" && (
          <QuickLaunchTab
            requiredChecks={requiredChecks}
            firstUndoneIdx={firstUndoneIdx}
            allDone={allRequiredDone}
            isPending={isPending}
            isActive={isActive}
            pendingCollapsed={pendingCollapsed}
            onNavigate={onNavigate}
            onSendForLaunch={sendForLaunch}
            onSimulateActivation={simulateActivation}
            onCollapsePending={collapsePending}
          />
        )}
        {activeLaunchTab === "improve" && (
          <ImproveTab checks={improvements} onNavigate={onNavigate} />
        )}
        {activeLaunchTab === "orders" && (
          <OrdersTab checks={orderingChecks} onNavigate={onNavigate} />
        )}
        {activeLaunchTab === "manager" && (
          <ManagerTab sent={managerSent} onSend={() => setManagerSent(true)} />
        )}
        {activeLaunchTab === "tour" && (
          <TourTab onNavigate={onNavigate} />
        )}
      </div>
    </div>
  );
}
