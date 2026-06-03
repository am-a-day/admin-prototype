import { Check, X } from "lucide-react";
import { PageTitle } from "@/components/workspace/page-title";
import { SectionCard } from "@/components/workspace/section-card";
import { managementStubCopy, type ManageTabId, type PlanId } from "@/data/mock-data";
import { usePlan } from "@/contexts/plan-context";
import { cn } from "@/lib/utils";

// ── Plan features config ───────────────────────────────────────────────────────

const PLAN_INFO: Record<PlanId, {
  price: string;
  features: { label: string; included: boolean }[];
}> = {
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

// ── Billing workspace ─────────────────────────────────────────────────────────

function BillingWorkspace() {
  const { planId, expiresLabel } = usePlan();
  const nextPlan = NEXT_PLAN[planId];

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-white p-8">
      <div className="mx-auto max-w-3xl space-y-6">
        <PageTitle
          title="Тарифы"
          description="Текущий план, ограничения и возможности следующего тарифа."
        />

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
      </div>
    </main>
  );
}

// ── Generic stub ──────────────────────────────────────────────────────────────

type ManagementStubProps = {
  tabId: Exclude<ManageTabId, "order-settings" | "order-history">;
};

export function ManagementStub({ tabId }: ManagementStubProps) {
  if (tabId === "billing") return <BillingWorkspace />;

  const copy = managementStubCopy[tabId];

  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-white p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageTitle title={copy.title} description={copy.description} />
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
      </div>
    </main>
  );
}
