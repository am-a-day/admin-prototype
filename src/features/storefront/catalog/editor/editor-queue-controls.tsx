import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ArrowLeft, CaretLeft, CaretRight, Check, MagnifyingGlass } from "@phosphor-icons/react";
import { useState, type ReactNode } from "react";
import { Tooltip } from "@/components/ui/tooltip";
import type { CatalogItem } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { CatalogThumbnail } from "../ui/catalog-thumbnail";

function CatalogPickerContent({
  children,
  align = "start",
  className,
}: {
  children: ReactNode;
  align?: "start" | "center" | "end";
  className?: string;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align={align}
        sideOffset={6}
        className={cn(
          "z-[100002] w-[300px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none",
          className,
        )}
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
  );
}

export function PositionQueueReturnLink({ filterLabel, onBack }: { filterLabel: string; onBack: () => void }) {
  return (
    <Tooltip label="Вернуться к результатам" side="bottom" delayDuration={250}>
      <button
        type="button"
        onClick={onBack}
        className="inline-flex h-7 max-w-[150px] shrink-0 items-center gap-1 rounded-[7px] px-1.5 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      >
        <ArrowLeft size={13} weight="bold" />
        <span className="truncate">{filterLabel}</span>
      </button>
    </Tooltip>
  );
}

export function PositionQueueControls({
  filterLabel,
  itemIds,
  currentId,
  itemsById,
  onSelect,
  previousId,
  nextId,
}: {
  filterLabel: string;
  itemIds: string[];
  currentId: string;
  itemsById: Record<string, CatalogItem>;
  onSelect: (id: string) => void;
  previousId: string | null;
  nextId: string | null;
}) {
  const [query, setQuery] = useState("");
  const queueIndex = itemIds.indexOf(currentId);
  const normalizedQuery = query.trim().toLocaleLowerCase();
  const visibleIds = normalizedQuery
    ? itemIds.filter((id) => itemsById[id]?.title.toLocaleLowerCase().includes(normalizedQuery))
    : itemIds;

  return (
    <div className="flex shrink-0 items-center gap-1">
      <DropdownMenu.Root onOpenChange={(open) => { if (!open) setQuery(""); }}>
        <DropdownMenu.Trigger asChild>
          <button
            type="button"
            aria-label={`Открыть очередь, ${Math.max(0, queueIndex + 1)} из ${itemIds.length}`}
            className="inline-flex h-7 shrink-0 items-center rounded-[7px] px-2 text-[12px] tabular-nums text-[#57534d] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            {Math.max(0, queueIndex + 1)} из {itemIds.length}
          </button>
        </DropdownMenu.Trigger>
        <CatalogPickerContent align="end" className="w-[320px]">
          <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
            {filterLabel} · {itemIds.length}
          </div>
          <label className="mx-1 mb-1 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-[#fafaf9] px-2.5">
            <MagnifyingGlass size={14} className="shrink-0 text-[#a8a29e]" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Найти в очереди"
              aria-label="Поиск по сохранённой очереди"
              className="min-w-0 flex-1 bg-transparent text-[12px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
            />
          </label>
          <div className="max-h-[320px] overflow-y-auto py-0.5">
            {visibleIds.map((id) => {
              const candidate = itemsById[id];
              if (!candidate) return null;
              return (
                <DropdownMenu.Item
                  key={id}
                  onSelect={() => onSelect(id)}
                  className={cn(
                    "flex min-h-10 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 py-1.5 text-[13px] outline-none data-[highlighted]:bg-[#f5f5f4]",
                    id === currentId && "bg-[#f5f5f4] font-medium",
                  )}
                >
                  <CatalogThumbnail src={candidate.thumbnailUrl} kind="item" className="h-7 w-7" />
                  <span className="min-w-0 flex-1 truncate text-[#44403b]">{candidate.title}</span>
                  {id === currentId && <Check size={14} weight="bold" className="shrink-0 text-[#79716b]" />}
                </DropdownMenu.Item>
              );
            })}
            {visibleIds.length === 0 && <div className="px-2.5 py-3 text-[12px] text-[#79716b]">Ничего не найдено</div>}
          </div>
        </CatalogPickerContent>
      </DropdownMenu.Root>
      <span className="flex shrink-0 items-center gap-0.5">
        <button
          type="button"
          onClick={() => previousId && onSelect(previousId)}
          disabled={!previousId}
          aria-label="Предыдущая позиция в выборке"
          title="Предыдущая позиция"
          className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[#57534d] transition hover:bg-[#f5f5f4] disabled:cursor-default disabled:text-[#d6d3d1] disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <CaretLeft size={14} weight="bold" />
        </button>
        <button
          type="button"
          onClick={() => nextId && onSelect(nextId)}
          disabled={!nextId}
          aria-label="Следующая позиция в выборке"
          title="Следующая позиция"
          className="flex h-7 w-7 items-center justify-center rounded-[7px] text-[#57534d] transition hover:bg-[#f5f5f4] disabled:cursor-default disabled:text-[#d6d3d1] disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <CaretRight size={14} weight="bold" />
        </button>
      </span>
    </div>
  );
}
