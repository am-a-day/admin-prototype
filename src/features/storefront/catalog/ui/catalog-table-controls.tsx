import { CaretDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import type { ReactNode, RefObject } from "react";

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

export function CatalogTableSearchControl({
  value,
  onValueChange,
  filter,
  placeholder = "Поиск по названию",
  ariaLabel,
  inputRef,
  onFocus,
  onBlur,
  className,
}: {
  value: string;
  onValueChange: (value: string) => void;
  filter?: ReactNode;
  placeholder?: string;
  ariaLabel: string;
  inputRef?: RefObject<HTMLInputElement | null>;
  onFocus?: () => void;
  onBlur?: () => void;
  className?: string;
}) {
  return (
    <div
      data-catalog-table-search-control
      className={cn(
        "flex h-7 min-w-0 max-w-full items-center overflow-hidden rounded-[8px] border border-[#e7e5e4] bg-white text-[#a6a09b] transition focus-within:border-[#d6d3d1] focus-within:ring-2 focus-within:ring-[#4f39f6]/10",
        className,
      )}
    >
      {filter ?? (
        <button
          type="button"
          aria-label="Фильтр таблицы"
          className="inline-flex h-full shrink-0 items-center gap-1 rounded-l-[7px] px-2 text-[12px] font-normal leading-4 text-[#57534d] transition hover:bg-[#fafaf9] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f39f6]/20"
        >
          Все
          <CaretDown size={12} weight="regular" />
        </button>
      )}
      <span className="h-4 w-px shrink-0 bg-[#e7e5e4]" aria-hidden="true" />
      <label className="flex h-full min-w-0 flex-1 items-center gap-1.5 px-2 text-[#a6a09b]">
        <MagnifyingGlass size={14} className="shrink-0" />
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={onFocus}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-label={ariaLabel}
          className="min-w-0 flex-1 bg-transparent text-[13px] font-normal leading-4 text-[#57534d] outline-none placeholder:text-[#a6a09b]"
        />
      </label>
      {value.length > 0 && (
        <button
          type="button"
          aria-label={`Очистить ${ariaLabel.toLocaleLowerCase("ru")}`}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => {
            onValueChange("");
            requestAnimationFrame(() => inputRef?.current?.focus());
          }}
          className="mr-1 inline-flex size-5 shrink-0 items-center justify-center rounded-[5px] text-[#a6a09b] transition hover:bg-[#f5f5f4] hover:text-[#57534d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f39f6]/20"
        >
          <X size={13} weight="regular" />
        </button>
      )}
    </div>
  );
}
