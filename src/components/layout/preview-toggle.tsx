import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function PreviewToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const label = open ? "Скрыть предпросмотр" : "Показать предпросмотр";
  const Icon = open ? ChevronsRight : ChevronsLeft;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip label={label} side="left">
        <button
          type="button"
          onClick={onToggle}
          title={label}
          aria-label={label}
          aria-pressed={open}
          className={cn(
            "flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200/60 hover:text-zinc-600",
          )}
        >
          <Icon size={18} />
        </button>
      </Tooltip>
    </TooltipProvider>
  );
}
