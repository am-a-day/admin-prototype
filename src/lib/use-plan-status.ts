import { usePlan, pluralDays } from "@/contexts/plan-context";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import type { PlanId } from "@/data/mock-data";

export type PlanStatusKind =
  | "none"      // тариф не выбран (Zero)
  | "pending"   // тариф выбран, витрина не активирована менеджером
  | "active"    // активна, срок далеко (> 7 дней)
  | "expiring"  // активна, осталось ≤ 7 дней
  | "expired";  // срок истёк

export type PlanStatus = {
  kind: PlanStatusKind;
  planId: PlanId;
  daysLeft: number;
  expiryLabel: string;
  expiryFull: string;
  /** "осталось 5 дней" */
  daysLeftPhrase: string;
};

/** Combined subscription status — plan + vitrine activation + expiry. */
export function usePlanStatus(): PlanStatus {
  const { planId, daysLeft, expiryLabel, expiryFull } = usePlan();
  const { stage } = useVitrineLaunch();

  let kind: PlanStatusKind;
  if (planId === "Zero" || planId === "Start") kind = "none";
  else if (stage !== "active") kind = "pending";
  else if (daysLeft <= 0) kind = "expired";
  else if (daysLeft <= 7) kind = "expiring";
  else kind = "active";

  return {
    kind,
    planId,
    daysLeft,
    expiryLabel,
    expiryFull,
    daysLeftPhrase: `осталось ${daysLeft} ${pluralDays(daysLeft)}`,
  };
}
