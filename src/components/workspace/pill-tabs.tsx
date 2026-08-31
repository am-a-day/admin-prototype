import { type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type PillTab<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
};

export type PillTabsVariant = "page" | "sidePeek" | "catalog";

export function getPillTabClassName(active: boolean, variant: PillTabsVariant = "page") {
  return cn(
    "inline-flex h-[26px] shrink-0 items-center gap-1.5 whitespace-nowrap rounded-[8px] text-[12px] leading-4 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
    variant === "sidePeek" ? "px-2.5" : "px-2",
    active
      ? "bg-[#f1f1f0] text-[#292524]"
      : "text-[#78716b] hover:bg-[#f5f5f4] hover:text-[#44403b]",
  );
}

export function PillTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  ariaLabel,
  variant = "page",
  className,
}: {
  tabs: readonly PillTab<T>[];
  value: T;
  onValueChange: (value: T) => void;
  ariaLabel: string;
  variant?: PillTabsVariant;
  className?: string;
}) {
  return (
    <div
      className={cn(
        variant === "page"
          ? "flex w-full justify-center overflow-visible"
          : "max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        className,
      )}
    >
      <div
        role="tablist"
        aria-label={ariaLabel}
        className="flex min-w-max items-center gap-1"
      >
        {tabs.map((tab) => {
          const active = value === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onValueChange(tab.id)}
              className={getPillTabClassName(active, variant)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count != null && (
                <span className="flex h-[14px] min-w-[20px] items-center justify-center rounded-[4px] bg-[#efefeb] px-0.5 text-[10px] font-medium tabular-nums text-[#79716b]">
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
