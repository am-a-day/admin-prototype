import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { CURRENT_PLAN, type PlanId } from "@/data/mock-data";

// ── Mock "today" (matches prototype currentDate) ─────────────────────────────
const TODAY = new Date(2026, 5, 3); // 3 June 2026

const MONTHS_GEN = [
  "января", "февраля", "марта", "апреля", "мая", "июня",
  "июля", "августа", "сентября", "октября", "ноября", "декабря",
];

const DEFAULT_DAYS_LEFT = 12;

function expiryFromDays(daysLeft: number) {
  const d = new Date(TODAY);
  d.setDate(d.getDate() + daysLeft);
  const day = d.getDate();
  const month = MONTHS_GEN[d.getMonth()];
  return {
    label: `до ${day} ${month}`,
    full: `${day} ${month} ${d.getFullYear()}`,
  };
}

/** Correct Russian plural for "день" */
export function pluralDays(days: number): string {
  const mod10 = days % 10;
  const mod100 = days % 100;
  if (mod10 === 1 && mod100 !== 11) return "день";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "дня";
  return "дней";
}

// ── Context ───────────────────────────────────────────────────────────────────

type PlanContextValue = {
  planId: PlanId;
  setPlanId: (p: PlanId) => void;
  /** Days until subscription expires (meaningful once active) */
  daysLeft: number;
  setDaysLeftDemo: (n: number) => void;
  /** "до 15 июня" */
  expiryLabel: string;
  /** "15 июня 2026" */
  expiryFull: string;
  /** Backward-compat alias for expiryLabel (null for Zero) */
  expiresLabel: string | null;
};

const PlanContext = createContext<PlanContextValue | null>(null);

export function PlanProvider({ children }: { children: ReactNode }) {
  const [planId, setPlanId] = useState<PlanId>(CURRENT_PLAN);
  const [daysLeft, setDaysLeft] = useState(DEFAULT_DAYS_LEFT);

  const value = useMemo<PlanContextValue>(() => {
    const { label, full } = expiryFromDays(daysLeft);
    return {
      planId,
      setPlanId,
      daysLeft,
      setDaysLeftDemo: setDaysLeft,
      expiryLabel: label,
      expiryFull: full,
      expiresLabel: planId === "Zero" ? null : label,
    };
  }, [planId, daysLeft]);

  return <PlanContext.Provider value={value}>{children}</PlanContext.Provider>;
}

export function usePlan() {
  const ctx = useContext(PlanContext);
  if (!ctx) throw new Error("usePlan must be used within PlanProvider");
  return ctx;
}
