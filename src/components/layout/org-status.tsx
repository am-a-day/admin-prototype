import { useVitrineStatus } from "@/lib/use-vitrine-status";
import { cn } from "@/lib/utils";

/** Vitrine status line for the full sidebar — sits under the org name. */
export function VitrineStatusLine() {
  const { label, dot, webAddress, isActive } = useVitrineStatus();

  return (
    <div className="flex items-center gap-1.5">
      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dot)} />
      <span className="truncate text-[12px] font-semibold text-zinc-700">{label}</span>
      {isActive && (
        <span className="truncate text-[11px] text-zinc-400">· {webAddress}</span>
      )}
    </div>
  );
}
