import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { cn } from "@/lib/utils";

export const TooltipProvider = TooltipPrimitive.Provider;
export const TooltipRoot     = TooltipPrimitive.Root;
export const TooltipTrigger  = TooltipPrimitive.Trigger;

export function TooltipContent({
  className,
  sideOffset = 6,
  ...props
}: React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>) {
  return (
    <TooltipPrimitive.Portal>
      <TooltipPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          "z-[300] rounded-lg bg-zinc-950 px-2 py-1 text-xs text-white shadow-xl",
          "animate-in fade-in-0 zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          className,
        )}
        {...props}
      />
    </TooltipPrimitive.Portal>
  );
}

/** Convenience wrapper — wraps children in TooltipRoot + Trigger + Content */
export function Tooltip({
  label,
  side = "right",
  children,
  disabled,
  delayDuration = 300,
  contentClassName,
}: {
  label: React.ReactNode;
  side?: "right" | "left" | "top" | "bottom";
  children: React.ReactNode;
  disabled?: boolean;
  /** 0 → показ без задержки (для rail-иконок). */
  delayDuration?: number;
  contentClassName?: string;
}) {
  if (disabled) return <>{children}</>;
  return (
    <TooltipRoot delayDuration={delayDuration}>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side={side} className={contentClassName}>
        {label}
      </TooltipContent>
    </TooltipRoot>
  );
}
