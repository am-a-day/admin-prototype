import { CaretUpDown, MagnifyingGlass, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";
import { forwardRef, useState, type ButtonHTMLAttributes, type ReactNode, type RefObject } from "react";
import {
  CATALOG_TABLE_TOOLBAR_CLASS,
  CATALOG_TABLE_TOOLBAR_DIVIDER_CLASS,
  CATALOG_TABLE_TOOLBAR_GROUP_CLASS,
} from "./catalog-layout";

export const CATALOG_TABLE_SEARCH_WIDTH = "w-[clamp(300px,30vw,360px)] max-w-full";

type CatalogTableFilterTriggerProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label: string;
  ariaLabel?: string;
};

export const CatalogTableFilterTrigger = forwardRef<HTMLButtonElement, CatalogTableFilterTriggerProps>(function CatalogTableFilterTrigger({
  label,
  ariaLabel = "Фильтры",
  className,
  ...buttonProps
}, ref) {
  return (
    <button
      ref={ref}
      type="button"
      {...buttonProps}
      aria-label={ariaLabel}
      data-catalog-table-filter-trigger
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-[7px] py-1 text-[13px] font-normal leading-4 text-[#1c1917] transition hover:text-[#1c1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f39f6]/20",
        className,
      )}
    >
      <span className="min-w-0 truncate">{label}</span>
      <CaretUpDown size={13} weight="regular" />
    </button>
  );
});

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
  const [focused, setFocused] = useState(false);
  const showSearchHint = !focused;

  const handleFocus = () => {
    setFocused(true);
    onFocus?.();
  };

  const handleBlur = () => {
    setFocused(false);
    onBlur?.();
  };

  return (
    <div
      data-catalog-table-search-control
      className={cn(
        "relative box-border flex h-[30px] min-w-0 max-w-full flex-1 items-center gap-2 overflow-hidden rounded-[7px] border text-[#a6a09b]",
        focused ? "border-[#4f39f6]" : "border-transparent",
        className,
      )}
    >
      <span
        data-catalog-table-filter-cell
        className="relative -ml-px flex h-full w-auto min-w-[60px] shrink-0 items-center pl-[16px]"
      >
        {filter ?? <CatalogTableFilterTrigger label="Все" ariaLabel="Фильтр таблицы" />}
        {focused && (
          <span
            data-catalog-table-search-divider
            className="pointer-events-none absolute bottom-[6px] right-0 top-[6px] w-px bg-[#e7e5e4]"
            aria-hidden="true"
          />
        )}
      </span>
      <label className="flex min-w-0 flex-1 items-center gap-1.5 text-[#a6a09b]">
        {showSearchHint && <MagnifyingGlass size={14} className="shrink-0" />}
        <input
          ref={inputRef}
          value={value}
          onChange={(event) => onValueChange(event.target.value)}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={showSearchHint ? placeholder : ""}
          aria-label={ariaLabel}
          className="min-w-0 flex-1 bg-transparent text-[13px] font-normal leading-5 text-[#1c1917] outline-none placeholder:text-[#a6a09b]"
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

export function CatalogTableToolbarShell({
  value,
  onValueChange,
  filter,
  placeholder = "Поиск по названию",
  ariaLabel,
  inputRef,
  onFocus,
  onBlur,
  endContent,
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
  endContent?: ReactNode;
  className?: string;
}) {
  return (
    <div data-catalog-table-toolbar className={cn(CATALOG_TABLE_TOOLBAR_CLASS, className)}>
      <div className={CATALOG_TABLE_TOOLBAR_GROUP_CLASS}>
        <CatalogTableSearchControl
          value={value}
          onValueChange={onValueChange}
          filter={filter}
          placeholder={placeholder}
          ariaLabel={ariaLabel}
          inputRef={inputRef}
          onFocus={onFocus}
          onBlur={onBlur}
          className="w-full"
        />
      </div>
      {endContent != null && (
        <>
          <span className={CATALOG_TABLE_TOOLBAR_DIVIDER_CLASS} aria-hidden="true" />
          {endContent}
        </>
      )}
    </div>
  );
}
