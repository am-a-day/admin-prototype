import { useVitrineLaunch, type LaunchTabId } from "@/contexts/vitrine-launch-context";
import { useAppSettings } from "@/contexts/app-settings-context";
import { banners } from "@/data/mock-data";
import {
  PhoneCatalog,
  PhoneCheckout,
  PhoneHome,
} from "@/components/preview/phone-screens";
import { cn } from "@/lib/utils";

// ── Phone frame constants ────────────────────────────────────────────────────

const PHONE_W = 292;
const PHONE_H = 662;
// Fit the phone so height ≈ 480px inside the panel
const SCALE = Math.min(480 / PHONE_H, 1);
// Panel must be at least phoneWidth*scale + 2×padding

const MOCK_BANNER = banners[0];
const MOCK_DISH_ID = "pepperoni";

// ── Screen logic ─────────────────────────────────────────────────────────────

type ScreenId =
  | "empty"
  | "catalog"
  | "home"
  | "appearance"
  | "ordering"
  | "ready"
  | "pending"
  | "active";

function resolveScreen(
  checks: { id: string; done: boolean }[],
  hoveredId: string | null,
  stage: string,
  activeTab: LaunchTabId,
): ScreenId {
  if (stage === "active") return "active";
  if (stage === "pending") return "pending";

  const done = (id: string) => checks.find((c) => c.id === id)?.done ?? false;

  // Non-quick tabs show context-appropriate screens
  if (activeTab === "improve") {
    return done("appearance") ? "appearance" : done("home") ? "home" : done("catalog") ? "catalog" : "empty";
  }
  if (activeTab === "orders") return "ordering";
  if (activeTab === "manager") return done("catalog") ? "catalog" : "empty";
  if (activeTab === "tour") return done("catalog") ? "catalog" : "empty";

  // Quick tab: hover preview takes precedence
  if (hoveredId) {
    if (hoveredId === "catalog") return done("catalog") ? "catalog" : "empty";
    if (hoveredId === "address" || hoveredId === "plan") return done("plan") ? "ready" : done("catalog") ? "catalog" : "empty";
    if (hoveredId === "home") return done("home") ? "home" : done("catalog") ? "catalog" : "empty";
    if (hoveredId === "appearance" || hoveredId === "upsell" || hoveredId === "about") return done("appearance") ? "appearance" : done("catalog") ? "catalog" : "empty";
    if (hoveredId === "ordering" || hoveredId === "waiter") return "ordering";
  }

  // Default — show highest achieved state
  if (done("plan")) return "ready";
  if (done("appearance")) return "appearance";
  if (done("home")) return "home";
  if (done("ordering")) return "ordering";
  if (done("catalog")) return "catalog";
  return "empty";
}

type ScreenMeta = { label: string; labelCls: string; hint: (address?: string, activeTab?: LaunchTabId) => string };

const SCREEN_META: Record<ScreenId, ScreenMeta> = {
  empty: {
    label: "Витрина пока пустая",
    labelCls: "text-zinc-400",
    hint: (_a, tab) =>
      tab === "tour" ? "Перейдите в Каталог, чтобы добавить первые позиции." :
      "Добавьте первые позиции, чтобы гости увидели меню.",
  },
  catalog: {
    label: "Меню заполняется",
    labelCls: "text-zinc-500",
    hint: (_a, tab) =>
      tab === "improve" ? "Настройте главную и оформление, чтобы витрина стала привлекательнее." :
      tab === "tour" ? "Здесь гости смотрят меню и выбирают блюда." :
      "Гости увидят ваши блюда и смогут сделать выбор.",
  },
  home: {
    label: "Главный экран настроен",
    labelCls: "text-zinc-500",
    hint: () => "Баннеры и разделы встречают гостей на главной.",
  },
  appearance: {
    label: "Оформление применено",
    labelCls: "text-zinc-500",
    hint: () => "Витрина выглядит в вашем фирменном стиле.",
  },
  ordering: {
    label: "Приём заказов",
    labelCls: "text-zinc-500",
    hint: () => "Гости смогут оформить доставку или самовывоз прямо из витрины.",
  },
  ready: {
    label: "Готова к запуску",
    labelCls: "text-blue-600",
    hint: (addr) =>
      addr
        ? `После активации: ${addr}.tasko.app`
        : "Отправьте витрину менеджеру на активацию.",
  },
  pending: {
    label: "Ожидает активации",
    labelCls: "text-amber-600",
    hint: (addr) =>
      addr
        ? `Скоро появится по адресу: ${addr}.tasko.app`
        : "Менеджер проверит и активирует витрину.",
  },
  active: {
    label: "Витрина активна",
    labelCls: "text-emerald-600",
    hint: (addr) => (addr ? `Открыть: ${addr}.tasko.app` : "Ссылка доступна гостям."),
  },
};

// ── Skeleton empty state ─────────────────────────────────────────────────────

function EmptyScreen() {
  return (
    <div className="flex flex-col gap-3 bg-white p-4 pt-8">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div className="h-3 w-20 animate-pulse rounded bg-zinc-100" />
        <div className="h-3 w-8 animate-pulse rounded bg-zinc-100" />
      </div>
      {/* Banner */}
      <div className="flex h-32 animate-pulse items-center justify-center rounded-2xl bg-zinc-100">
        <span className="text-[11px] text-zinc-300">Баннер</span>
      </div>
      {/* Section label */}
      <div className="h-2.5 w-20 animate-pulse rounded bg-zinc-100" />
      {/* Cards */}
      <div className="grid grid-cols-2 gap-2">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100" />
        ))}
      </div>
      <div className="h-2.5 w-24 animate-pulse rounded bg-zinc-100" />
      <div className="grid grid-cols-2 gap-2">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-24 animate-pulse rounded-xl bg-zinc-100" />
        ))}
      </div>
    </div>
  );
}

// ── Launch phone preview panel ───────────────────────────────────────────────

export function LaunchPhonePreview() {
  const { checks, stage, address, hoveredStepId, activeLaunchTab } = useVitrineLaunch();
  const { deliveryComment } = useAppSettings();

  const screenId = resolveScreen(checks, hoveredStepId, stage, activeLaunchTab);
  const meta = SCREEN_META[screenId];

  let screenContent: React.ReactNode;
  switch (screenId) {
    case "empty":
      screenContent = <EmptyScreen />;
      break;
    case "catalog":
      screenContent = <PhoneCatalog selectedDishId={MOCK_DISH_ID} />;
      break;
    case "home":
      screenContent = <PhoneHome banner={MOCK_BANNER} />;
      break;
    case "appearance":
      screenContent = <PhoneCatalog selectedDishId={MOCK_DISH_ID} themed />;
      break;
    case "ordering":
      screenContent = (
        <PhoneCheckout method="delivery" comment={deliveryComment} />
      );
      break;
    case "ready":
    case "pending":
    case "active":
      screenContent = <PhoneHome banner={MOCK_BANNER} />;
      break;
  }

  const statusDot =
    screenId === "active"
      ? "bg-emerald-500"
      : screenId === "pending"
        ? "bg-amber-400 animate-pulse"
        : screenId === "ready"
          ? "bg-blue-500"
          : "bg-zinc-300";

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-zinc-50/60">
      <div className="flex flex-col items-center overflow-hidden px-4 py-5 flex-1">

        {/* Panel title */}
        <div className="mb-4 flex w-full items-center gap-2">
          <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", statusDot)} />
          <span className="text-[11px] font-black uppercase tracking-[0.16em] text-zinc-500">
            Превью витрины
          </span>
        </div>

        {/* Phone frame */}
        <div
          style={{ width: PHONE_W * SCALE, height: PHONE_H * SCALE }}
          className="shrink-0"
        >
          <div
            style={{
              width: PHONE_W,
              height: PHONE_H,
              transform: `scale(${SCALE})`,
              transformOrigin: "top left",
            }}
            className="relative overflow-hidden rounded-[42px] border-[7px] border-zinc-950 bg-white shadow-2xl shadow-zinc-300/60"
          >
            {/* Notch */}
            <div className="absolute left-1/2 top-0 z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-950" />
            <div className="flex h-full flex-col">
              <div className="flex-1 overflow-y-auto scrollbar-none">
                {screenContent}
              </div>
            </div>

            {/* Pending/active overlay badge */}
            {(screenId === "pending" || screenId === "active") && (
              <div className={cn(
                "absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full px-4 py-1.5 text-[11px] font-bold text-white shadow-lg",
                screenId === "active" ? "bg-emerald-600" : "bg-amber-500",
              )}>
                {screenId === "active" ? "Витрина активна" : "Ожидает активации"}
              </div>
            )}
          </div>
        </div>

        {/* Status label + hint */}
        <div className="mt-4 w-full space-y-1 text-center">
          <div className={cn("text-[12px] font-bold", meta.labelCls)}>
            {meta.label}
          </div>
          <p className="text-[11px] leading-[1.5] text-zinc-400">
            {meta.hint(address.trim() || undefined, activeLaunchTab)}
          </p>
        </div>

        {/* Hover tip — only on quick tab */}
        {activeLaunchTab === "quick" && stage !== "active" && stage !== "pending" && (
          <p className="mt-4 text-center text-[10px] leading-[1.6] text-zinc-300">
            Наведите на шаг, чтобы увидеть превью.
          </p>
        )}

      </div>
    </aside>
  );
}
