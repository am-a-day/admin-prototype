import { createContext, useContext, useState, type ReactNode } from "react";
import { CURRENT_PLAN, type PlanId } from "@/data/mock-data";

// ── Mock expiry data for paid plans ──────────────────────────────────────────

const MOCK_EXPIRY: Record<Exclude<PlanId, "Zero">, { label: string; days: number }> = {
  Lite: { label: "до 14 июня", days: 18 },
  Ultra: { label: "до 14 июня", days: 18 },
};

// ── Context ───────────────────────────────────────────────────────────────────

type PlanContextValue = {
  planId: PlanId;
  setPlanId: (p: PlanId) => void;
  expiresLabel: string | null; // "до 14 июня" for paid, null for Zero
  daysLeft: number | null;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [planId, setPlanId] = useState<PlanId>(CURRENT_PLAN);
  const expiry = planId !== "Zero" ? MOCK_EXPIRY[planId as Exclude<PlanId, "Zero">] : null;

  return (
    <PlanContext.Provider
      value={{
        planId,
        setPlanId,
        expiresLabel: expiry?.label ?? null,
        daysLeft: expiry?.days ?? null,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
