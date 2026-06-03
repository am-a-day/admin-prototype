import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { STOREFRONT_URL } from "@/data/mock-data";

export type VitrineStatusKind = "preparing" | "ready" | "pending" | "active";

/** Vitrine-wide status (belongs to the organization, not the current page). */
export function useVitrineStatus() {
  const { stage, address } = useVitrineLaunch();

  const label =
    stage === "active" ? "Активна" :
    stage === "pending" ? "Ожидает активации" :
    stage === "ready" ? "Готова к запуску" :
    "Готовится";

  const dot =
    stage === "active" ? "bg-emerald-500" :
    stage === "pending" ? "bg-amber-400 animate-pulse" :
    stage === "ready" ? "bg-blue-500" :
    "bg-zinc-300";

  const webAddress = address.trim() ? `${address.trim()}.tasko.app` : STOREFRONT_URL;

  return {
    stage: stage as VitrineStatusKind,
    label,
    dot,
    webAddress,
    isActive: stage === "active",
  };
}
