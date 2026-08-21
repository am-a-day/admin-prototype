import type { ComponentPropsWithoutRef, ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import type { Icon as PhosphorIcon } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { usePositionSidePeekOverlayLayer } from "../editor/side-peek-context";

export const CATALOG_DROPDOWN_CONTENT_CLASS =
  "rounded-lg border border-[#e2e8f0] bg-white p-1 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)] outline-none";
export const CATALOG_DROPDOWN_ITEM_CLASS =
  "flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium outline-none transition data-[disabled]:pointer-events-none data-[disabled]:opacity-50 data-[highlighted]:bg-[#f5f5f4] data-[state=open]:bg-[#f5f5f4]";
export const CATALOG_DROPDOWN_SEPARATOR_CLASS = "my-1 h-px bg-[#e2e8f0]";

export type CatalogDropdownOutsideEvent = Parameters<NonNullable<ComponentPropsWithoutRef<typeof DropdownMenu.Content>["onInteractOutside"]>>[0];
export type CatalogDropdownCloseAutoFocusEvent = Parameters<NonNullable<ComponentPropsWithoutRef<typeof DropdownMenu.Content>["onCloseAutoFocus"]>>[0];
export type CatalogDropdownOutsideDismiss = boolean | ((event: CatalogDropdownOutsideEvent) => boolean);

export function DropdownContent({
  children,
  align = "end",
  className,
  preventOutsideDismiss = false,
  preventFocusOutsideDismiss = false,
  onCloseAutoFocus,
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
  preventOutsideDismiss?: CatalogDropdownOutsideDismiss;
  preventFocusOutsideDismiss?: boolean;
  onCloseAutoFocus?: (event: CatalogDropdownCloseAutoFocusEvent) => void;
}) {
  const { marker, shouldPreventOverlayDismissal } = usePositionSidePeekOverlayLayer();
  const shouldPreventOutsideDismiss = (event: CatalogDropdownOutsideEvent) => (
    (typeof preventOutsideDismiss === "function" ? preventOutsideDismiss(event) : preventOutsideDismiss)
    || shouldPreventOverlayDismissal(event)
  );
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn("z-[100002] min-w-[208px]", CATALOG_DROPDOWN_CONTENT_CLASS, className)}
        onPointerDownOutside={(event) => {
          if (shouldPreventOutsideDismiss(event)) {
            event.preventDefault();
          }
        }}
        onInteractOutside={(event) => {
          if (shouldPreventOutsideDismiss(event)) {
            event.preventDefault();
          }
        }}
        onFocusOutside={(event) => {
          if (preventFocusOutsideDismiss) event.preventDefault();
        }}
        onCloseAutoFocus={onCloseAutoFocus}
      >
        {marker}
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function DropdownActionItem({
  children,
  onSelect,
  tone = "default",
  disabled = false,
  icon: Icon,
}: {
  children: ReactNode;
  onSelect: (event: Event) => void;
  tone?: "default" | "danger";
  disabled?: boolean;
  icon?: PhosphorIcon;
}) {
  return (
    <DropdownMenu.Item
      disabled={disabled}
      onSelect={onSelect}
      className={cn(
        CATALOG_DROPDOWN_ITEM_CLASS,
        tone === "danger" ? "text-[#c10007]" : "text-[#44403b]",
      )}
    >
      {Icon && <Icon size={15} weight="regular" className="shrink-0" />}
      {children}
    </DropdownMenu.Item>
  );
}
