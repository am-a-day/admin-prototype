import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { CaretDown } from "@phosphor-icons/react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export type WorkspaceLocalTab<T extends string> = {
  id: T;
  label: string;
  icon?: ReactNode;
  count?: number;
};

const TAB_BUTTON_CLASS = "flex h-10 shrink-0 items-center gap-2 whitespace-nowrap border-b px-2 py-[10px] text-[13px] transition";
const TAB_LIST_CLASS = "flex h-10 min-w-0 items-stretch";

function sameIds<T extends string>(first: readonly T[], second: readonly T[]) {
  return first.length === second.length && first.every((id, index) => id === second[index]);
}

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
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const tabMeasureRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const overflowMeasureRefs = useRef<Record<number, HTMLButtonElement | null>>({});
  const [visibleTabIds, setVisibleTabIds] = useState<readonly T[]>(() => tabs.map((tab) => tab.id));
  const [overflowOpen, setOverflowOpen] = useState(false);

  useLayoutEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport) return;

    const recalculate = () => {
      const availableWidth = Math.max(0, (viewport.clientWidth || viewport.getBoundingClientRect().width) - 16);
      const tabWidths = tabs.map((tab) => tabMeasureRefs.current[tab.id]?.getBoundingClientRect().width ?? 0);
      const totalTabWidth = tabWidths.reduce((sum, width) => sum + width, 0);
      if (!availableWidth || tabWidths.some((width) => width <= 0)) return;

      if (totalTabWidth <= availableWidth) {
        const allIds = tabs.map((tab) => tab.id);
        setVisibleTabIds((current) => sameIds(current, allIds) ? current : allIds);
        return;
      }

      const activeIndex = tabs.findIndex((tab) => tab.id === value);
      const getTabWidth = (id: T) => tabWidths[tabs.findIndex((tab) => tab.id === id)] ?? 0;
      const getOverflowWidth = (count: number) => overflowMeasureRefs.current[count]?.getBoundingClientRect().width ?? 0;

      for (let prefixLength = tabs.length; prefixLength >= 1; prefixLength -= 1) {
        let candidateIds = tabs.slice(0, prefixLength).map((tab) => tab.id);

        if (activeIndex >= prefixLength) {
          const replaceIndex = [...candidateIds].reverse().findIndex((id) => id !== value);
          if (replaceIndex === -1) continue;
          const actualReplaceIndex = candidateIds.length - 1 - replaceIndex;
          candidateIds = candidateIds.filter((_, index) => index !== actualReplaceIndex);
          candidateIds.push(value);
          candidateIds.sort((first, second) => (
            tabs.findIndex((tab) => tab.id === first) - tabs.findIndex((tab) => tab.id === second)
          ));
        }

        const overflowCount = tabs.length - candidateIds.length;
        const candidateWidth = candidateIds.reduce((sum, id) => sum + getTabWidth(id), 0)
          + (overflowCount > 0 ? getOverflowWidth(overflowCount) : 0);
        if (candidateWidth <= availableWidth) {
          setVisibleTabIds((current) => sameIds(current, candidateIds) ? current : candidateIds);
          return;
        }
      }
    };

    recalculate();
    if (typeof ResizeObserver === "undefined") return;

    let frame = 0;
    const scheduleRecalculate = () => {
      if (frame) window.cancelAnimationFrame(frame);
      if (typeof window.requestAnimationFrame === "function") {
        frame = window.requestAnimationFrame(recalculate);
      } else {
        recalculate();
      }
    };
    const observer = new ResizeObserver(scheduleRecalculate);
    observer.observe(viewport);

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, [tabs, value]);

  useLayoutEffect(() => {
    const tabIds = new Set(tabs.map((tab) => tab.id));
    setVisibleTabIds((current) => {
      const next = current.filter((id) => tabIds.has(id));
      return next.length === current.length ? current : tabs.map((tab) => tab.id);
    });
  }, [tabs]);

  const visibleTabIdSet = new Set(visibleTabIds);
  const visibleTabs = tabs.filter((tab) => visibleTabIdSet.has(tab.id));
  const overflowTabs = tabs.filter((tab) => !visibleTabIdSet.has(tab.id));
  const activeTabIsInOverflow = overflowTabs.some((tab) => tab.id === value);

  const renderTabContents = (tab: WorkspaceLocalTab<T>) => (
    <>
      {tab.icon}
      <span className="min-w-0 truncate">{tab.label}</span>
      {tab.count != null && (
        <span className="flex h-[14px] min-w-[20px] items-center justify-center rounded-[4px] bg-[#efefeb] px-0.5 text-[10px] font-medium tabular-nums text-[#79716b]">
          {tab.count}
        </span>
      )}
    </>
  );

  const renderMeasurementContents = (tab: WorkspaceLocalTab<T>) => (
    <>
      {tab.icon}
      <span
        aria-hidden="true"
        data-workspace-local-tab-measure-label={tab.label}
        className="min-w-0 truncate"
      />
      {tab.count != null && (
        <span
          aria-hidden="true"
          data-workspace-local-tab-measure-label={tab.count}
          className="flex h-[14px] min-w-[20px] items-center justify-center rounded-[4px] bg-[#efefeb] px-0.5 text-[10px] font-medium tabular-nums text-[#79716b]"
        />
      )}
    </>
  );

  return (
    <div
      data-workspace-local-tabs
      className={cn("relative flex h-[41px] min-w-0 items-stretch border-b border-[#e7e5e4]", className)}
    >
      <div ref={viewportRef} className="min-w-0 flex-1 overflow-hidden px-2">
        <div className={TAB_LIST_CLASS}>
          {visibleTabs.map((tab) => {
            const selected = value === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onValueChange(tab.id)}
                aria-current={selected ? "page" : undefined}
                className={cn(
                  TAB_BUTTON_CLASS,
                  selected
                    ? "border-[#1c1917] font-medium text-[#1c1917]"
                    : "border-transparent font-normal text-[#79716b] hover:text-[#44403b]",
                )}
              >
                {renderTabContents(tab)}
              </button>
            );
          })}
          {overflowTabs.length > 0 && (
            <Popover open={overflowOpen} onOpenChange={setOverflowOpen}>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  aria-current={activeTabIsInOverflow ? "page" : undefined}
                  aria-label={`Еще ${overflowTabs.length}`}
                  className={cn(
                    TAB_BUTTON_CLASS,
                    activeTabIsInOverflow
                      ? "border-[#1c1917] font-medium text-[#1c1917]"
                      : "border-transparent font-normal text-[#79716b] hover:text-[#44403b]",
                  )}
                >
                  <span>Еще {overflowTabs.length}</span>
                  <CaretDown size={16} weight="regular" aria-hidden="true" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="start" sideOffset={4} className="w-[196px] rounded-[10px] p-1">
                <div role="menu" aria-label="Скрытые разделы">
                  {overflowTabs.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        onValueChange(tab.id);
                        setOverflowOpen(false);
                      }}
                      className="flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left text-[13px] text-[#57534d] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                    >
                      {tab.icon}
                      <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      </div>
      {endAction && <div className="shrink-0">{endAction}</div>}

      <div aria-hidden="true" className="pointer-events-none absolute left-[-10000px] top-0 flex w-max opacity-0">
        <div className={TAB_LIST_CLASS}>
          {tabs.map((tab) => (
            <button
              key={tab.id}
              ref={(element) => { tabMeasureRefs.current[tab.id] = element; }}
              type="button"
              tabIndex={-1}
              className={cn(TAB_BUTTON_CLASS, "border-transparent font-normal text-[#79716b]")}
            >
              {renderMeasurementContents(tab)}
            </button>
          ))}
          {tabs.slice(0, -1).map((_, index) => {
            const count = index + 1;
            return (
              <button
                key={count}
                ref={(element) => { overflowMeasureRefs.current[count] = element; }}
                type="button"
                tabIndex={-1}
                className={cn(TAB_BUTTON_CLASS, "border-transparent font-normal text-[#79716b]")}
              >
                <span aria-hidden="true" data-workspace-local-tab-measure-label={`Еще ${count}`} />
                <CaretDown size={16} weight="regular" aria-hidden="true" />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
