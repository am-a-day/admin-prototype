import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type WorkspaceLocalTab<T extends string> = {
  id: T;
  label: string;
  count?: number;
};

export function WorkspaceLocalTabs<T extends string>({
  tabs,
  value,
  onValueChange,
  endAction,
  className,
}: {
  tabs: readonly WorkspaceLocalTab<T>[];
  value: T;
  onValueChange: (value: T) => void;
  endAction?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-workspace-local-tabs
      className={cn("flex min-w-0 items-center gap-3 border-b border-[#e7e5e4]", className)}
    >
      <div className="min-w-0 flex-1 overflow-x-auto scrollbar-none">
        <div className="flex w-max min-w-full items-center gap-2">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => onValueChange(tab.id)}
              aria-current={value === tab.id ? "page" : undefined}
              className={cn(
                "flex shrink-0 items-center gap-2 whitespace-nowrap border-b px-1 py-3.5 text-[13px] transition",
                value === tab.id
                  ? "border-[#1c1917] font-medium text-[#1c1917]"
                  : "border-transparent text-[#79716b] hover:text-[#44403b]",
              )}
            >
              {tab.label}
              {tab.count != null && (
                <span className="flex h-[14px] min-w-[20px] items-center justify-center rounded-[4px] bg-[#efefeb] px-0.5 text-[10px] font-medium tabular-nums text-[#79716b]">
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
      {endAction && <div className="shrink-0">{endAction}</div>}
    </div>
  );
}
