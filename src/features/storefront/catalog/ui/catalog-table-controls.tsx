import { MagnifyingGlass } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export const CATALOG_TABLE_SEARCH_WIDTH = "w-[clamp(300px,30vw,360px)] max-w-full";

export function CatalogTableSearch({
  value,
  onValueChange,
  placeholder = "Поиск по названию",
  ariaLabel,
  variant = "field",
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  placeholder?: string;
  ariaLabel: string;
  variant?: "field" | "toolbar";
  className?: string;
}) {
  const isToolbar = variant === "toolbar";
  return (
    <label
      data-catalog-table-search
      className={cn(
        "flex items-center gap-1.5 text-[#a6a09b] transition focus-within:ring-2 focus-within:ring-[#292524]/5",
        isToolbar
          ? "h-6 min-w-0 w-[clamp(140px,22vw,280px)] rounded-[7px] px-1"
          : "h-7 shrink-0 rounded-[8px] bg-[#f5f5f4] px-[7px]",
        !isToolbar && CATALOG_TABLE_SEARCH_WIDTH,
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
