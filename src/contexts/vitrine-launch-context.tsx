import {
  createContext,
  useCallback,
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
  description: string;
  actionLabel?: string;
  done: boolean;
  section?: SectionId;
  tab?: string;
  isAddressStep?: boolean;
  /** true = blocks sending to launch; false = recommended, not blocking */
  required: boolean;
};

type VitrineLaunchContextValue = {
  stage: LaunchStage;
  checks: LaunchCheck[];
  /** Required-only progress */
  requiredCompletedCount: number;
  requiredTotalCount: number;
  confirmVisible: boolean;
  dismissConfirm: () => void;
  sendForLaunch: () => void;
  simulateActivation: () => void;
  pendingCollapsed: boolean;
  collapsePending: () => void;
  address: string;
  setAddress: (v: string) => void;
  markVisited: (tab: string) => void;
  resetLaunch: () => void;
  hoveredStepId: string | null;
  setHoveredStepId: (id: string | null) => void;
};

const INITIAL_VISITED: Record<string, boolean> = {
  catalog: false,
  home: false,
  appearance: false,
  about: false,
  upsell: false,
  ordering: false,
};

const VitrineLaunchContext = createContext<VitrineLaunchContextValue | null>(null);

export function VitrineLaunchProvider({ children }: { children: ReactNode }) {
  const { planId } = usePlan();
  const { deliveryEnabled, pickupEnabled } = useAppSettings();

  const [visitedTabs, setVisitedTabs] = useState<Record<string, boolean>>(INITIAL_VISITED);
  const [address, setAddressState] = useState("");
  const [stageOverride, setStageOverride] = useState<LaunchStage | null>(null);
  const [confirmVisible, setConfirmVisible] = useState(false);
  const [pendingCollapsed, setPendingCollapsed] = useState(false);
  const [hoveredStepId, setHoveredStepId] = useState<string | null>(null);

  const markVisited = useCallback((tab: string) => {
    setVisitedTabs((prev) =>
      tab in prev && !prev[tab] ? { ...prev, [tab]: true } : prev,
    );
  }, []);

  const setAddress = useCallback((v: string) => setAddressState(v), []);

  const resetLaunch = useCallback(() => {
    setVisitedTabs(INITIAL_VISITED);
    setAddressState("");
    setStageOverride(null);
    setConfirmVisible(false);
    setPendingCollapsed(false);
  }, []);

  const checks: LaunchCheck[] = useMemo(() => [
    // ── Required for launch ───────────────────────────────────────────
    {
      id: "catalog",
      label: "Добавьте минимум 2 раздела и 5 позиций",
      description: "Заполните каталог, чтобы гостям было что выбрать в меню.",
      actionLabel: "Перейти в каталог",
      done: visitedTabs.catalog,
      section: "storefront",
      tab: "catalog",
      required: true,
    },
    {
      id: "address",
      label: "Укажите желаемый веб-адрес",
      description: "Выберите адрес, по которому гости будут открывать витрину после активации.",
      done: address.trim().length > 0,
      isAddressStep: true,
      required: true,
    },
    {
      id: "plan",
      label: "Выберите тариф",
      description: "Выберите тариф, на котором будет работать витрина.",
      actionLabel: "Выбрать тариф",
      done: planId !== "Zero",
      section: "management",
      tab: "billing",
      required: true,
    },
    // ── Improvements (recommended, not blocking) ──────────────────────
    {
      id: "home",
      label: "Настройте главный экран",
      description: "Добавьте баннеры, ключевые разделы и продвигаемые позиции.",
      actionLabel: "Настроить главную",
      done: visitedTabs.home,
      section: "storefront",
      tab: "home",
      required: false,
    },
    {
      id: "appearance",
      label: "Настройте внешний вид",
      description: "Выберите стиль, цвета и оформление витрины.",
      actionLabel: "Перейти к оформлению",
      done: visitedTabs.appearance,
      section: "storefront",
      tab: "appearance",
      required: false,
    },
    {
      id: "about",
      label: "Заполните информацию о заведении",
      description: "Добавьте описание, контакты, график работы — всё, что увидит гость.",
      actionLabel: "Заполнить информацию",
      done: visitedTabs.about,
      section: "storefront",
      tab: "about",
      required: false,
    },
    {
      id: "upsell",
      label: "Добавьте рекомендации",
      description: "Свяжите блюда, которые хорошо сочетаются между собой.",
      actionLabel: "Настроить рекомендации",
      done: visitedTabs.upsell,
      section: "storefront",
      tab: "upsell",
      required: false,
    },
    // ── Ordering (optional section) ───────────────────────────────────
    {
      id: "ordering",
      label: "Настройте доставку и самовывоз",
      description: "Выберите способы получения заказа и куда будут приходить уведомления.",
      actionLabel: "Настроить заказы",
      done: visitedTabs.ordering && (deliveryEnabled || pickupEnabled),
      section: "management",
      tab: "order-settings",
      required: false,
    },
    {
      id: "waiter",
      label: "Настройте вызов официанта",
      description: "Позвольте гостям позвать официанта прямо из витрины.",
      actionLabel: "Настроить вызов",
      done: false, // prototype — waiter config not yet implemented
      section: "management",
      tab: "order-settings",
      required: false,
    },
  ], [visitedTabs, address, planId, deliveryEnabled, pickupEnabled]);

  const requiredChecks = checks.filter((c) => c.required);
  const requiredCompletedCount = requiredChecks.filter((c) => c.done).length;
  const requiredTotalCount = requiredChecks.length;
  const allRequiredDone = requiredCompletedCount === requiredTotalCount;

  const derivedStage: LaunchStage = allRequiredDone ? "ready" : "preparing";
  const stage = stageOverride ?? derivedStage;

  const sendForLaunch = useCallback(() => {
    setStageOverride("pending");
    setConfirmVisible(true);
    setPendingCollapsed(false);
  }, []);

  const dismissConfirm = useCallback(() => setConfirmVisible(false), []);
  const simulateActivation = useCallback(() => {
    setStageOverride("active");
    setConfirmVisible(false);
  }, []);
  const collapsePending = useCallback(() => setPendingCollapsed(true), []);

  const value = useMemo<VitrineLaunchContextValue>(
    () => ({
      stage,
      checks,
      requiredCompletedCount,
      requiredTotalCount,
      confirmVisible,
      dismissConfirm,
      sendForLaunch,
      simulateActivation,
      pendingCollapsed,
      collapsePending,
      address,
      setAddress,
      markVisited,
      resetLaunch,
      hoveredStepId,
      setHoveredStepId,
    }),
    [
      stage, checks, requiredCompletedCount, requiredTotalCount,
      confirmVisible, dismissConfirm, sendForLaunch, simulateActivation,
      pendingCollapsed, collapsePending, address, setAddress,
      markVisited, resetLaunch, hoveredStepId, setHoveredStepId,
    ],
  );

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
