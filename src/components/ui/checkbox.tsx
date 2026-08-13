import * as React from "react";
import * as CheckboxPrimitive from "@radix-ui/react-checkbox";
import { CheckIcon, MinusIcon } from "lucide-react";
import { cn } from "@/lib/utils";

const Checkbox = React.forwardRef<
  React.ElementRef<typeof CheckboxPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>
>(({ className, ...props }, ref) => (
  <CheckboxPrimitive.Root
    ref={ref}
    className={cn(
      "peer size-4 shrink-0 rounded-[4px] border border-stone-300 bg-white shadow-sm outline-none transition focus-visible:ring-2 focus-visible:ring-stone-400/30 disabled:cursor-not-allowed disabled:opacity-50 data-[state=checked]:border-stone-500 data-[state=checked]:bg-stone-500 data-[state=checked]:text-white data-[state=indeterminate]:border-stone-500 data-[state=indeterminate]:bg-stone-500 data-[state=indeterminate]:text-white",
      className,
    )}
    {...props}
  >
    <CheckboxPrimitive.Indicator className="flex items-center justify-center text-current">
      {props.checked === "indeterminate" ? <MinusIcon className="size-3" /> : <CheckIcon className="size-3" strokeWidth={3} />}
    </CheckboxPrimitive.Indicator>
  </CheckboxPrimitive.Root>
));
Checkbox.displayName = CheckboxPrimitive.Root.displayName;

export { Checkbox };
