import { useState } from "react";
import { Rocket, X } from "lucide-react";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";

/**
 * Compact contextual hint shown at the top of pages that are part of the
 * launch checklist. Disappears when the check is done or user dismisses it.
 */
export function LaunchPageHint({
  checkId,
  title,
  description,
}: {
  checkId: string;
  title: string;
  description: string;
}) {
  const { checks, stage } = useVitrineLaunch();
  const [dismissed, setDismissed] = useState(false);

  const check = checks.find((c) => c.id === checkId);

  // Show only during "preparing" stage, when this check is not done, and not dismissed
  if (!check || check.done || stage !== "preparing" || dismissed) return null;

  return (
    <div className="mb-6 flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50/70 px-4 py-3">
      <Rocket size={13} className="mt-0.5 shrink-0 text-blue-400" />
      <div className="min-w-0 flex-1">
        <span className="text-[12px] font-bold text-blue-800">{title}</span>
        <p className="mt-0.5 text-[12px] leading-[1.55] text-blue-600/80">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => setDismissed(true)}
        className="mt-0.5 shrink-0 text-blue-300 transition hover:text-blue-500"
        title="Скрыть подсказку"
      >
        <X size={13} />
      </button>
    </div>
  );
}
