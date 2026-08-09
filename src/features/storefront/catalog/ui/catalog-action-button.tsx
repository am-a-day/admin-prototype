import { PlusCircle, type Icon as PhosphorIcon } from "@phosphor-icons/react";
import type { ReactNode, RefObject } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export function CatalogActionButton({
  icon: Icon = PlusCircle,
  children,
  onClick,
  disabledReason,
  disabled = false,
  loading = false,
  tooltipLabel,
  tooltipDelayDuration = 200,
  ariaLabel,
  dataPositionCreateButton = false,
  buttonRef,
  className,
}: {
  icon?: PhosphorIcon;
  children: ReactNode;
  onClick: () => void;
  disabledReason?: string | null;
  disabled?: boolean;
  loading?: boolean;
  tooltipLabel?: string;
  tooltipDelayDuration?: number;
  ariaLabel?: string;
  dataPositionCreateButton?: boolean;
  buttonRef?: RefObject<HTMLButtonElement | null>;
  className?: string;
}) {
  const isDisabled = disabled || Boolean(disabledReason);
  const tooltipText = tooltipLabel ?? disabledReason ?? "";
  const tooltipEnabled = Boolean(tooltipLabel) || (isDisabled && Boolean(disabledReason));
  return (
    <Tooltip label={tooltipText} side="top" delayDuration={tooltipDelayDuration} disabled={!tooltipEnabled}>
      <span className="inline-flex">
        <button
          type="button"
          ref={buttonRef}
          {...(dataPositionCreateButton ? { "data-position-create-button": true } : {})}
          aria-label={ariaLabel}
          onClick={onClick}
          disabled={isDisabled}
          className={cn(
            "group inline-flex h-[30px] shrink-0 items-center gap-1 whitespace-nowrap rounded-[32px] border border-[#e7e5e4] bg-white pl-1 pr-2 text-[12px] font-normal leading-4 text-[#292524] transition-colors hover:border-[#d6d3d1] hover:bg-[#fafaf9] hover:text-[#1c1917] active:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:cursor-not-allowed disabled:border-[#e7e5e4] disabled:bg-white disabled:text-[#a8a29e]",
            className,
          )}
        >
          {loading ? (
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#a8a29e] border-t-transparent" />
            </span>
          ) : (
            <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center text-[#57534d] group-disabled:text-[#a8a29e]">
              <Icon size={16} weight="regular" />
            </span>
          )}
          <span className="group-disabled:text-[#a8a29e]">{children}</span>
        </button>
      </span>
    </Tooltip>
  );
}
