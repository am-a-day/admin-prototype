import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { usePlan } from "@/contexts/plan-context";
import { useAppSettings } from "@/contexts/app-settings-context";
import type { SectionId } from "@/data/mock-data";

export type LaunchStage = "preparing" | "ready" | "pending" | "active";

export type LaunchCheck = {
  id: string;
  label: string;
  done: boolean;
  /** Куда переходить при клике на незавершённый шаг */
  section?: SectionId;
  tab?: string;
};

type VitrineLaunchContextValue = {
  stage: LaunchStage;
  checks: LaunchCheck[];
  completedCount: number;
  totalCount: number;
  /** Показывать подтверждающий modal после "Отправить на запуск" */
  confirmVisible: boolean;
  dismissConfirm: () => void;
  sendForLaunch: () => void;
  /** Для демо: симулировать активацию менеджером */
  simulateActivation: () => void;
  /** Компактное / развёрнутое состояние карточки ожидания */
  pendingCollapsed: boolean;
  collapsePending: () => void;
};

const VitrineLaunchContext = createContext<VitrineLaunchContextValue | null>(null);

export function VitrineLaunchProvider({ children }: { children: ReactNode }) {
  const { planId } = usePlan();
  const { deliveryEnabled, pickupEnabled } = useAppSettings();

  const checks: LaunchCheck[] = useMemo(() => [
    {
      id: "dishes",
      label: "Добавлены позиции в каталог",
      done: true, // mock data always has dishes
    },
    {
      id: "storefront",
      label: "Настроен внешний вид",
      done: true, // mock data has storefront configured
    },
    {
      id: "ordering",
      label: "Настроен приём заказов",
      done: deliveryEnabled || pickupEnabled,
      section: "management",
      tab: "order-settings",
    },
    {
      id: "plan",
      label: "Выбран тариф",
      done: planId !== "Zero",
      section: "management",
      tab: "billing",
    },
  ], [planId, deliveryEnabled, pickupEnabled]);

  const completedCount = checks.filter((c) => c.done).length;
  const allDone = completedCount === checks.length;

  // Derive initial stage from data — can be overridden by user actions
  const [stageOverride, setStageOverride] = useState<LaunchStage | null>(null);

  // Initial stage: Zero plan without all checks → preparing, else active for demo
  const derivedStage: LaunchStage = allDone ? "ready" : "preparing";
  const stage = stageOverride ?? derivedStage;

  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingCollapsed, setPendingCollapsed] = useState(false);

  const sendForLaunch = () => {
    setStageOverride("pending");
    setConfirmVisible(true);
    setPendingCollapsed(false);
  };

  const dismissConfirm = () => setConfirmVisible(false);

  const simulateActivation = () => {
    setStageOverride("active");
    setConfirmVisible(false);
  };

  const collapsePending = () => setPendingCollapsed(true);

  const value = useMemo<VitrineLaunchContextValue>(() => ({
    stage,
    checks,
    completedCount,
    totalCount: checks.length,
    confirmVisible,
    dismissConfirm,
    sendForLaunch,
    simulateActivation,
    pendingCollapsed,
    collapsePending,
  }), [stage, checks, completedCount, confirmVisible, pendingCollapsed]);

  return (
    <VitrineLaunchContext.Provider value={value}>
      {children}
    </VitrineLaunchContext.Provider>
  );
}

export function useVitrineLaunch() {
  const ctx = useContext(VitrineLaunchContext);
  if (!ctx) throw new Error("useVitrineLaunch must be used within VitrineLaunchProvider");
  return ctx;
}
