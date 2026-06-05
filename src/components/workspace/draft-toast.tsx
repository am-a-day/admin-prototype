import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { usePublish } from "@/contexts/publish-context";
import { useLayoutMode } from "@/contexts/layout-mode-context";
import { cn } from "@/lib/utils";

/** Режим 1 (Toast): ненавязчивое уведомление о сохранении черновика. */
export function DraftToast() {
  const { toast } = usePublish();
  const { changeModel } = useLayoutMode();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!toast) return;
    setVisible(true);
    const t = window.setTimeout(() => setVisible(false), 2200);
    return () => window.clearTimeout(t);
  }, [toast?.id]);

  // В Save + Live Preview нет «черновика» — сохранение сразу применяется на витрине.
  if (changeModel === "save-live") return null;
  if (!toast) return null;

  return (
    <div
      className={cn(
        "pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 transition-all duration-300",
        visible ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
      )}
    >
      <div className="flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm font-semibold text-zinc-900 shadow-lg shadow-zinc-300/40">
        <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-white">
          <Check size={11} strokeWidth={3} />
        </span>
        {toast.text.replace(/^✓\s*/, "")}
      </div>
    </div>
  );
}
