import {
  ArrowRight,
  Check,
  Globe,
  Palette,
  QrCode,
  ShoppingBag,
  Sparkles,
} from "lucide-react";
import { PageContent, PageScroll } from "@/components/workspace/page-layout";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { cn } from "@/lib/utils";
import type { SectionId } from "@/data/mock-data";

type OnNavigate = (section: SectionId, tab: string) => void;

// ── Block 2: capability cards ───────────────────────────────────────────────────

type Capability = {
  icon: typeof QrCode;
  title: string;
  desc: string;
  section: SectionId;
  tab: string;
};

const CAPABILITIES: Capability[] = [
  { icon: QrCode, title: "QR-коды", desc: "Печатайте QR для столов и быстрого доступа к меню.", section: "qr", tab: "qr" },
  { icon: ShoppingBag, title: "Приём заказов", desc: "Принимайте заказы прямо через витрину.", section: "management", tab: "order-settings" },
  { icon: Palette, title: "Оформление", desc: "Настройте внешний вид витрины под стиль заведения.", section: "storefront", tab: "appearance" },
  { icon: Sparkles, title: "Рекомендации", desc: "Предлагайте гостям дополнительные блюда и напитки.", section: "storefront", tab: "upsell" },
];

// ── Page ────────────────────────────────────────────────────────────────────────

export function LaunchPage({ onNavigate }: { onNavigate: OnNavigate }) {
  const {
    checks,
    requiredCompletedCount,
    requiredTotalCount,
    address,
    setAddress,
    sendForLaunch,
    stage,
  } = useVitrineLaunch();

  const required = checks.filter((c) => c.required);
  const allDone = requiredCompletedCount === requiredTotalCount;
  const sent = stage === "pending";

  return (
    <PageScroll>
      <PageContent className="mx-auto max-w-2xl space-y-6">

        <header>
          <h1 className="text-[18px] font-black tracking-tight text-zinc-950">Запуск витрины</h1>
          <p className="mt-0.5 text-[13px] text-zinc-500">
            Выполните обязательные условия и передайте витрину менеджеру на запуск.
          </p>
        </header>

        {/* ── Block 1: Быстрый запуск ── */}
        <div className="rounded-2xl border border-[#e7e5e4] bg-white p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-[15px] font-bold text-zinc-950">Быстрый запуск</h2>
            <span className="text-[12px] font-semibold text-zinc-400">
              {requiredCompletedCount} из {requiredTotalCount} готово
            </span>
          </div>

          <div className="mt-4 space-y-1">
            {required.map((c) => (
              <div key={c.id} className="flex items-start gap-3 rounded-xl px-2 py-2">
                <span
                  className={cn(
                    "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                    c.done ? "bg-emerald-500 text-white" : "border border-zinc-300",
                  )}
                >
                  {c.done && <Check size={12} strokeWidth={3} />}
                </span>

                <div className="min-w-0 flex-1">
                  <div className={cn("text-[14px] font-semibold", c.done ? "text-zinc-400 line-through" : "text-zinc-900")}>
                    {c.label}
                  </div>

                  {/* Address step — inline input */}
                  {c.isAddressStep && !c.done && (
                    <div className="mt-2 flex items-center gap-2 rounded-lg border border-border bg-zinc-50 px-2.5 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/30">
                      <Globe size={14} className="shrink-0 text-zinc-400" />
                      <input
                        value={address}
                        onChange={(e) => setAddress(e.target.value)}
                        placeholder="my-restaurant"
                        className="h-9 min-w-0 flex-1 bg-transparent text-[13px] outline-none placeholder:text-zinc-400"
                      />
                      <span className="shrink-0 text-[13px] text-zinc-400">.tasko.app</span>
                    </div>
                  )}

                  {/* Navigable step — context CTA */}
                  {!c.isAddressStep && !c.done && c.section && c.tab && (
                    <button
                      type="button"
                      onClick={() => onNavigate(c.section!, c.tab!)}
                      className="mt-1 inline-flex items-center gap-1 text-[13px] font-bold text-blue-600 transition hover:text-blue-700"
                    >
                      {c.actionLabel ?? "Перейти"}
                      <ArrowRight size={13} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <button
            type="button"
            data-tour="send-review"
            onClick={sendForLaunch}
            disabled={!allDone || sent}
            className={cn(
              "mt-4 flex h-10 w-full items-center justify-center gap-1.5 rounded-xl text-[14px] font-bold transition",
              !allDone || sent
                ? "cursor-not-allowed bg-zinc-100 text-zinc-400"
                : "bg-zinc-900 text-white hover:bg-zinc-700",
            )}
          >
            {sent ? "Передано менеджеру" : "Передать менеджеру на запуск"}
          </button>
        </div>

        {/* ── Block 2: Возможности TASKO ── */}
        <div>
          <h2 className="px-1 text-[15px] font-bold text-zinc-950">Возможности TASKO</h2>
          <p className="mt-0.5 px-1 text-[13px] text-zinc-500">
            Это не обязательные шаги — просто возможности, которые можно открыть для себя.
          </p>

          <div className="mt-3 grid grid-cols-2 gap-3">
            {CAPABILITIES.map((cap) => {
              const Icon = cap.icon;
              return (
                <div
                  key={cap.title}
                  className="flex flex-col rounded-2xl border border-[#e7e5e4] bg-white p-4"
                >
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-100 text-zinc-600">
                    <Icon size={18} />
                  </span>
                  <div className="mt-2.5 text-[14px] font-bold text-zinc-950">{cap.title}</div>
                  <p className="mt-1 flex-1 text-[12px] leading-snug text-zinc-500">{cap.desc}</p>
                  <button
                    type="button"
                    onClick={() => onNavigate(cap.section, cap.tab)}
                    className="mt-3 inline-flex items-center gap-1 self-start text-[13px] font-bold text-blue-600 transition hover:text-blue-700"
                  >
                    Настроить
                    <ArrowRight size={13} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

      </PageContent>
    </PageScroll>
  );
}
