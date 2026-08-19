import * as React from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { cn } from "@/lib/utils";
import { PositionSidePeekOverlayMarker, usePositionSidePeekOverlayInteraction } from "@/features/storefront/catalog/editor/side-peek-context";

const Popover = PopoverPrimitive.Root;
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;

const PopoverContent = React.forwardRef<
  React.ElementRef<typeof PopoverPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content>
>(({ className, align = "center", sideOffset = 8, children, onPointerDownOutside, ...props }, ref) => {
  const consumeOverlayInteraction = usePositionSidePeekOverlayInteraction();
  return (
    <PopoverPrimitive.Portal>
      <PopoverPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-[200] rounded-[14px] border border-[#e7e5e4] bg-white text-[#292524] shadow-xl shadow-zinc-300/40 outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out",
          className,
        )}
        onPointerDownOutside={(event) => {
          consumeOverlayInteraction(event);
          onPointerDownOutside?.(event);
        }}
        {...props}
      >
        <PositionSidePeekOverlayMarker />
        {children}
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Portal>
  );
});
PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverAnchor, PopoverContent, PopoverTrigger };
