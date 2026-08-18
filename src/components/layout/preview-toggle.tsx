import { useEffect, useState } from "react";
import { CaretDoubleLeft, CaretDoubleRight, DeviceMobileCamera } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function PreviewToggle({ open, onToggle }: { open: boolean; onToggle: () => void }) {
  const label = open ? "Скрыть предпросмотр" : "Показать предпросмотр";
  const Icon = open ? CaretDoubleRight : CaretDoubleLeft;

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

export function PreviewReturnButton({ onClick }: { onClick: () => void }) {
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setEntered(true));
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip label="Показать предпросмотр" side="top">
        <Button
          type="button"
          variant="outline"
          onClick={onClick}
          aria-label="Показать предпросмотр"
          className={cn(
            "h-10 w-[57px] gap-[3.5px] rounded-[14px] border-[#e7e5e4] bg-white p-0 text-[#292524] shadow-[0_1px_3px_rgba(0,0,0,0.1),0_1px_2px_-1px_rgba(0,0,0,0.1)] transition-[opacity,transform,background-color] duration-200 ease-out hover:bg-[#fafaf9] focus-visible:ring-[#292524]/15 motion-reduce:transition-none",
            entered ? "translate-y-0 opacity-100" : "translate-y-2 opacity-0",
          )}
        >
          <DeviceMobileCamera size={19} aria-hidden="true" />
          <CaretDoubleLeft size={19} aria-hidden="true" />
        </Button>
      </Tooltip>
    </TooltipProvider>
  );
}
