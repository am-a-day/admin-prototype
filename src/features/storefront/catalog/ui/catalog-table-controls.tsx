import { MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export const CATALOG_TABLE_SEARCH_WIDTH = "w-[clamp(300px,30vw,360px)] max-w-full";

export function CatalogTableSearch({
  value,
  onValueChange,
  placeholder = "Поиск по названию",
  ariaLabel,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  className?: string;
}) {
  return (
    <label
      data-catalog-table-search
      className={cn(
        "flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] bg-[#f5f5f4] px-[7px] text-[#a6a09b] transition focus-within:ring-2 focus-within:ring-[#292524]/5",
        CATALOG_TABLE_SEARCH_WIDTH,
        className,
      )}
    >
      <MagnifyingGlass size={14} className="shrink-0" />
      <input
        value={value}
        onChange={(event) => onValueChange(event.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="min-w-0 flex-1 bg-transparent text-[13px] font-normal leading-4 text-[#57534d] outline-none placeholder:text-[#a6a09b]"
      />
    </label>
  );
}
