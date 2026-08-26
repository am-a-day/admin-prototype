import { Archive, CalendarDots, Clock, LockLaminated } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

export type CatalogAvailabilityStatusIconState = "archive" | "soon" | "stopped" | "scheduled";

const STATUS_META = {
  archive: { label: "В архиве", Icon: Archive, className: "text-[#94a3b8]" },
  soon: { label: "Скоро будет", Icon: Clock, className: "text-[#2b7fff]" },
  stopped: { label: "На стопе", Icon: LockLaminated, className: "text-[#f54900]" },
  scheduled: { label: "По расписанию", Icon: CalendarDots, className: "text-[#2b7fff]" },
} as const satisfies Record<CatalogAvailabilityStatusIconState, {
  label: string;
  Icon: typeof Archive;
  className: string;
}>;

export function CatalogAvailabilityStatusIcon({
  state,
  entity,
  tone = "semantic",
  iconSize = 14,
  className,
}: {
  state: CatalogAvailabilityStatusIconState;
  entity: "position" | "section";
  tone?: "semantic" | "neutral";
  iconSize?: number;
  className?: string;
}) {
  const { label, Icon, className: iconClassName } = STATUS_META[state];

  return (
    <Tooltip label={label} side="top">
      <span
        data-catalog-position-status={entity === "position" ? state : undefined}
        data-catalog-section-status={entity === "section" ? state : undefined}
        aria-label={label}
        className={cn(
          "inline-flex shrink-0 items-center justify-center transition-opacity group-hover:pointer-events-none group-hover:opacity-0 group-focus-within:pointer-events-none group-focus-within:opacity-0",
          className,
        )}
      >
        <Icon
          size={iconSize}
          weight="regular"
          className={cn("shrink-0", tone === "neutral" ? "text-[#79716b]" : iconClassName)}
        />
      </span>
    </Tooltip>
  );
}
