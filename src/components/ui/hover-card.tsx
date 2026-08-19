import * as React from "react";
import * as HoverCardPrimitive from "@radix-ui/react-hover-card";
import { cn } from "@/lib/utils";
import { PositionSidePeekOverlayMarker, usePositionSidePeekOverlayInteraction } from "@/features/storefront/catalog/editor/side-peek-context";

const HoverCard = HoverCardPrimitive.Root;
const HoverCardTrigger = HoverCardPrimitive.Trigger;

const HoverCardContent = React.forwardRef<
  React.ElementRef<typeof HoverCardPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof HoverCardPrimitive.Content>
>(({ className, align = "start", sideOffset = 6, children, onPointerDownOutside, ...props }, ref) => {
  const consumeOverlayInteraction = usePositionSidePeekOverlayInteraction();
  return (
    <HoverCardPrimitive.Portal>
      <HoverCardPrimitive.Content
        ref={ref}
        align={align}
        sideOffset={sideOffset}
        className={cn(
          "z-[100002] rounded-[12px] border border-[#e7e5e4] bg-white p-1 text-[#292524] shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none",
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95",
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
      </HoverCardPrimitive.Content>
    </HoverCardPrimitive.Portal>
  );
});
HoverCardContent.displayName = HoverCardPrimitive.Content.displayName;

export { HoverCard, HoverCardContent, HoverCardTrigger };
