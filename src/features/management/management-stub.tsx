import { useEffect, useState } from "react";
import { AlertTriangle, Check, Database, Headset, RotateCcw, X } from "lucide-react";
import { PageContent, PageScroll } from "@/components/workspace/page-layout";
import { SectionCard } from "@/components/workspace/section-card";
import { managementStubCopy, type ManageTabId, type PlanId } from "@/data/mock-data";
import { usePlan } from "@/contexts/plan-context";
import { usePlanStatus } from "@/lib/use-plan-status";
import { cn } from "@/lib/utils";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { usePublish } from "@/contexts/publish-context";
import { useAppSettings } from "@/contexts/app-settings-context";

// ── Plan features config ───────────────────────────────────────────────────────

const PLAN_INFO: Record<PlanId, {
  price: string;
  features: { label: string; included: boolean }[];
}> = {
  Start: {
    price: "Бесплатно",
    features: [
      { label: "До 20 блюд в меню", included: true },
      { label: "1 язык витрины", included: true },
      { label: "QR-меню", included: true },
      { label: "Аналитика", included: false },
      { label: "Табло заказов", included: false },
      { label: "Импорт меню", included: false },
    ],
  },
  Zero: {
    price: "Бесплатно",
    features: [
      { label: "До 100 блюд в меню", included: true },
      { label: "1 язык витрины", included: true },
      { label: "QR-меню", included: true },
      { label: "Аналитика", included: false },
      { label: "Табло заказов", included: false },
      { label: "Импорт меню", included: false },
    ],
  },
  Lite: {
    price: "990 ₸/мес",
    features: [
      { label: "До 500 блюд в меню", included: true },
      { label: "3 языка витрины", included: true },
      { label: "QR-меню", included: true },
      { label: "Базовая аналитика", included: true },
      { label: "Табло заказов", included: true },
      { label: "Импорт меню", included: false },
    ],
  },
  Ultra: {
    price: "2 490 ₸/мес",
    features: [
      { label: "Безлимит блюд в меню", included: true },
      { label: "3 языка витрины", included: true },
      { label: "QR-меню", included: true },
      { label: "Расширенная аналитика", included: true },
      { label: "Табло заказов", included: true },
      { label: "Импорт меню", included: true },
    ],
  },
};

const NEXT_PLAN: Record<PlanId, PlanId | null> = {
  Start: "Zero",
  Zero: "Lite",
  Lite: "Ultra",
  Ultra: null,
};

// ── Plan card ─────────────────────────────────────────────────────────────────

function PlanCard({
  planId,
  isCurrent,
  expiresLabel,
  onUpgrade,
}: {
  planId: PlanId;
  isCurrent: boolean;
  expiresLabel?: string | null;
  onUpgrade?: () => void;
}) {
  const info = PLAN_INFO[planId];

  return (
    <div
      className={cn(
        "flex flex-col rounded-2xl border p-5 transition",
        isCurrent
          ? "border-zinc-200 bg-white"
          : "border-blue-200 bg-blue-50/40",
      )}
    >
      {/* Header */}
      <div className="mb-4">
        <div className="flex items-center justify-between">
          <span className={cn(
            "text-lg font-black",
            isCurrent ? "text-zinc-950" : "text-blue-900",
          )}>
            {planId}
          </span>
          {isCurrent && (
            <span className="rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-semibold text-zinc-500">
              Текущий
            </span>
          )}
        </div>
        <div className={cn(
          "mt-1 text-sm font-semibold",
          isCurrent ? "text-zinc-400" : "text-blue-600",
        )}>
          {info.price}
        </div>
        {isCurrent && expiresLabel && (
          <div className="mt-0.5 text-xs text-zinc-400">{expiresLabel}</div>
        )}
      </div>

      {/* Features */}
      <ul className="flex-1 space-y-2">
        {info.features.map((f) => (
          <li key={f.label} className="flex items-center gap-2.5 text-sm">
            {f.included ? (
              <Check size={14} className={cn("shrink-0", isCurrent ? "text-zinc-400" : "text-blue-500")} strokeWidth={2.5} />
            ) : (
              <X size={14} className="shrink-0 text-zinc-300" strokeWidth={2} />
            )}
            <span className={f.included ? "text-zinc-700" : "text-zinc-400"}>{f.label}</span>
          </li>
        ))}
      </ul>

      {/* CTA */}
      {!isCurrent && onUpgrade && (
        <button
          type="button"
          onClick={onUpgrade}
          className="mt-5 w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
        >
          Перейти на {planId}
        </button>
      )}
      {isCurrent && planId !== "Zero" && (
        <div className="mt-5 rounded-xl bg-zinc-50 border border-border px-3 py-2 text-center text-xs font-medium text-zinc-500">
          Продление {expiresLabel}
        </div>
      )}
    </div>
  );
}

// ── Current subscription status header ────────────────────────────────────────

function SubscriptionStatus() {
  const status = usePlanStatus();
  if (status.kind === "none") return null;

  const expired = status.kind === "expired";
  const expiring = status.kind === "expiring";
  const pending = status.kind === "pending";

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        expired
          ? "border-orange-200 bg-orange-50"
          : expiring
            ? "border-amber-200 bg-amber-50"
            : "border-border bg-white",
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {(expired || expiring) && (
              <AlertTriangle
                size={15}
                className={expired ? "text-orange-500" : "text-amber-500"}
                strokeWidth={2.5}
              />
            )}
            <span className="text-[11px] font-black uppercase tracking-wide text-zinc-400">
              Текущий тариф
            </span>
          </div>
          <div className="mt-1.5 text-[22px] font-black leading-none text-zinc-950">
            {status.planId}
          </div>

          {pending ? (
            <p className="mt-2 text-[13px] text-blue-600">
              Активируется после проверки менеджером
            </p>
          ) : (
            <div className="mt-2 space-y-0.5 text-[13px]">
              <div className="text-zinc-600">
                Действует до:{" "}
                <span className="font-semibold text-zinc-900">{status.expiryFull}</span>
              </div>
              <div
                className={cn(
                  "font-semibold",
                  expired ? "text-orange-700" : expiring ? "text-amber-700" : "text-zinc-500",
                )}
              >
                {expired ? "Срок действия истёк" : status.daysLeftPhrase}
              </div>
            </div>
          )}
        </div>

        {!pending && (
          <button
            type="button"
            className={cn(
              "shrink-0 rounded-xl px-5 py-2.5 text-[14px] font-bold text-white transition",
              expired
                ? "bg-orange-600 hover:bg-orange-700"
                : expiring
                  ? "bg-amber-500 hover:bg-amber-600"
                  : "bg-zinc-950 hover:bg-zinc-800",
            )}
          >
            {expired ? "Продлить доступ" : "Продлить тариф"}
          </button>
        )}
      </div>

      {/* What happens after */}
      {!pending && (
        <div className="mt-5 grid gap-3 border-t border-black/5 pt-4 sm:grid-cols-3">
          {[
            { icon: AlertTriangle, title: "После окончания", text: "Витрина может быть приостановлена и недоступна гостям." },
            { icon: Database, title: "Данные сохраняются", text: "Меню, настройки и история заказов никуда не пропадут." },
            { icon: RotateCcw, title: "После продления", text: "Витрина снова станет доступна гостям сразу." },
          ].map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-2.5">
              <Icon size={15} className="mt-0.5 shrink-0 text-zinc-400" />
              <div>
                <div className="text-[12px] font-bold text-zinc-700">{title}</div>
                <p className="mt-0.5 text-[11px] leading-[1.5] text-zinc-500">{text}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Contact manager */}
      <div className="mt-4 flex items-center gap-1.5 text-[12px] text-zinc-400">
        <Headset size={13} className="shrink-0" />
        <span>Нужна помощь с продлением?</span>
        <button type="button" className="font-semibold text-blue-600 hover:underline">
          Связаться с менеджером
        </button>
      </div>
    </div>
  );
}

// ── Billing workspace ─────────────────────────────────────────────────────────

function BillingWorkspace() {
  const { planId, expiresLabel } = usePlan();
  const nextPlan = NEXT_PLAN[planId];

  return (
    <PageScroll>
      <PageContent>
        <SubscriptionStatus />
        {planId === "Ultra" ? (
          /* Ultra — максимальный тариф */
          <div className="max-w-sm">
            <PlanCard planId="Ultra" isCurrent expiresLabel={expiresLabel} />
            <p className="mt-4 text-sm text-zinc-400 text-center">
              Вы на максимальном тарифе. Спасибо, что с нами!
            </p>
          </div>
        ) : (
          /* Zero или Lite — показываем текущий + следующий */
          <div className="grid grid-cols-2 gap-4">
            <PlanCard
              planId={planId}
              isCurrent
              expiresLabel={expiresLabel}
            />
            {nextPlan && (
              <PlanCard
                planId={nextPlan}
                isCurrent={false}
                onUpgrade={() => {/* prototype: no action */}}
              />
            )}
          </div>
        )}

        {planId === "Zero" && (
          <SectionCard>
            <h3 className="mb-1 font-black text-zinc-950">Зачем переходить на Lite?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              На Zero доступно до 100 блюд и один язык. Lite снимает эти ограничения:
              500 блюд, 3 языка витрины, базовая аналитика и табло заказов для персонала.
            </p>
          </SectionCard>
        )}

        {planId === "Lite" && (
          <SectionCard>
            <h3 className="mb-1 font-black text-zinc-950">Что даёт Ultra?</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Ultra снимает ограничения на количество блюд и открывает импорт меню,
              расширенную аналитику и дополнительные инструменты для крупных заведений.
            </p>
          </SectionCard>
        )}
      </PageContent>
    </PageScroll>
  );
}

// ── Generic stub ──────────────────────────────────────────────────────────────

function AccountWorkspace() {
  const { account, updateWorkspace, updateWorkspaceNameTranslation } = useMockAuth();
  const { contentLanguage } = useAppSettings();
  const { registerChange } = usePublish();
  const workspaceName =
    account?.workspace.localizedNames[contentLanguage] ||
    (account
      ? account.workspace.localizedNames[account.workspace.primaryLanguage]
      : undefined) ||
    account?.workspace.name ||
    "Новое меню";
  const [name, setName] = useState(workspaceName);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");

  useEffect(() => {
    setName(workspaceName);
  }, [account?.id, contentLanguage, workspaceName]);

  const saveName = () => {
    const nextName = name.trim() || "Новое меню";
    if (nextName === workspaceName) return;
    setSaveState("saving");
    window.setTimeout(() => {
      updateWorkspaceNameTranslation(contentLanguage, nextName);
      registerChange("about");
      setName(nextName);
      setSaveState("saved");
      window.setTimeout(() => setSaveState("idle"), 1800);
    }, 350);
  };

  if (!account) return null;

  return (
    <PageScroll>
      <PageContent>
        <SectionCard>
          <div className="max-w-[560px]">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <h2 className="text-[16px] font-semibold text-zinc-900">Основные данные</h2>
                <p className="mt-1 text-[13px] text-zinc-500">Настройки сохраняются автоматически.</p>
              </div>
              {saveState !== "idle" && (
                <span className="text-[12px] font-medium text-zinc-500">
                  {saveState === "saving" ? "Сохранение…" : "Сохранено"}
                </span>
              )}
            </div>

            <label className="block text-[12px] font-semibold text-zinc-700" htmlFor="workspace-name">
              Название заведения
            </label>
            <input
              id="workspace-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              onBlur={saveName}
              className="mt-1.5 h-10 w-full rounded-[10px] border border-zinc-200 bg-white px-3 text-[14px] text-zinc-900 outline-none transition focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />

            <div className="mt-5 grid gap-3 border-t border-zinc-100 pt-4 sm:grid-cols-2">
              <label>
                <span className="text-[11px] font-semibold uppercase text-zinc-400">Тип заведения</span>
                <select
                  value={account.workspace.organizationType}
                  onChange={(event) => {
                    updateWorkspace({
                      organizationType: event.target.value as typeof account.workspace.organizationType,
                    });
                    registerChange("about");
                  }}
                  className="mt-1 h-9 w-full rounded-[8px] border border-zinc-200 bg-white px-2 text-[13px] font-medium text-zinc-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="restaurant">Ресторан / общепит</option>
                  <option value="store">Магазин</option>
                  <option value="services">Услуги</option>
                  <option value="other">Другое</option>
                </select>
              </label>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Технический адрес</div>
                <div className="mt-1 truncate text-[13px] font-medium text-zinc-700">
                  {account.workspace.technicalAddress}
                </div>
              </div>
              <label>
                <span className="text-[11px] font-semibold uppercase text-zinc-400">Валюта</span>
                <select
                  value={account.workspace.currency}
                  onChange={(event) => {
                    updateWorkspace({ currency: event.target.value });
                    registerChange("about");
                  }}
                  className="mt-1 h-9 w-full rounded-[8px] border border-zinc-200 bg-white px-2 text-[13px] font-medium text-zinc-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="KZT">KZT</option>
                  <option value="RSD">RSD</option>
                  <option value="EUR">EUR</option>
                  <option value="USD">USD</option>
                </select>
              </label>
              <div>
                <div className="text-[11px] font-semibold uppercase text-zinc-400">Основной язык</div>
                <div className="mt-1 text-[13px] font-medium text-zinc-700">{account.workspace.primaryLanguage.toUpperCase()}</div>
              </div>
              <label>
                <span className="text-[11px] font-semibold uppercase text-zinc-400">Часовой пояс</span>
                <select
                  value={account.workspace.timezone}
                  onChange={(event) => {
                    updateWorkspace({ timezone: event.target.value });
                    registerChange("about");
                  }}
                  className="mt-1 h-9 w-full rounded-[8px] border border-zinc-200 bg-white px-2 text-[13px] font-medium text-zinc-700 outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="Asia/Almaty">Казахстан · Asia/Almaty</option>
                  <option value="Europe/Belgrade">Сербия · Europe/Belgrade</option>
                  <option value="Europe/Warsaw">Central European Time</option>
                  <option value="UTC">UTC</option>
                </select>
              </label>
            </div>
          </div>
        </SectionCard>
      </PageContent>
    </PageScroll>
  );
}

type ManagementStubProps = {
  tabId: Exclude<ManageTabId, "order-settings" | "order-history">;
};

export function ManagementStub({ tabId }: ManagementStubProps) {
  if (tabId === "billing") return <BillingWorkspace />;
  if (tabId === "account") return <AccountWorkspace />;

  const copy = managementStubCopy[tabId];

  return (
    <PageScroll>
      <PageContent>
        <SectionCard>
          <ul className="space-y-3">
            {copy.bullets.map((bullet) => (
              <li
                key={bullet}
                className="flex items-center gap-3 rounded-2xl border border-border bg-zinc-50 px-4 py-3 text-sm font-semibold text-zinc-800"
              >
                <span className="h-2 w-2 rounded-full bg-blue-500" />
                {bullet}
              </li>
            ))}
          </ul>
        </SectionCard>
      </PageContent>
    </PageScroll>
  );
}
