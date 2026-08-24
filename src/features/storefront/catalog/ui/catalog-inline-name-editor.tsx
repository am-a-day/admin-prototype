import { forwardRef, type ChangeEventHandler, type MouseEventHandler, type PointerEventHandler } from "react";
import { Check, X } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type CatalogInlineNameEditorProps = {
  value: string;
  ariaLabel: string;
  onChange: ChangeEventHandler<HTMLInputElement>;
  onCommit: () => void;
  onCancel: () => void;
  cancelLabel: string;
  commitLabel: string;
  className?: string;
  inputClassName?: string;
  placeholder?: string;
  autoFocus?: boolean;
  invalid?: boolean;
  commitDisabled?: boolean;
  onClick?: MouseEventHandler<HTMLDivElement>;
  onPointerDown?: PointerEventHandler<HTMLDivElement>;
};

export const CatalogInlineNameEditor = forwardRef<HTMLInputElement, CatalogInlineNameEditorProps>(
  function CatalogInlineNameEditor({
    value,
    ariaLabel,
    onChange,
    onCommit,
    onCancel,
    cancelLabel,
    commitLabel,
    className,
    inputClassName,
    placeholder,
    autoFocus,
    invalid = false,
    commitDisabled = false,
    onClick,
    onPointerDown,
  }, ref) {
    return (
      <div
        className={cn(
          "flex min-w-0 items-center rounded-[8px] border border-indigo-600 bg-white px-2 ring-2 ring-indigo-600/15",
          className,
        )}
        onClick={onClick}
        onPointerDown={onPointerDown}
      >
        <input
          ref={ref}
          value={value}
          aria-label={ariaLabel}
          aria-invalid={invalid || undefined}
          autoFocus={autoFocus}
          placeholder={placeholder}
          onChange={onChange}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              onCommit();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              onCancel();
            }
          }}
          className={cn(
            "min-w-0 flex-1 bg-transparent text-[14px] leading-7 text-[#292524] outline-none",
            inputClassName,
          )}
        />
        <Tooltip label={cancelLabel} side="bottom" delayDuration={250}>
          <button
            type="button"
            aria-label={cancelLabel}
            onClick={onCancel}
            className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600/25"
          >
            <X size={14} weight="regular" aria-hidden="true" />
          </button>
        </Tooltip>
        <Tooltip label={commitLabel} side="bottom" delayDuration={250}>
          <button
            type="button"
            aria-label={commitLabel}
            onClick={onCommit}
            disabled={commitDisabled || !value.trim()}
            className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-indigo-600 transition hover:bg-indigo-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-600/25 disabled:cursor-not-allowed disabled:text-[#c7c2bd]"
          >
            <Check size={15} weight="bold" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>
    );
  },
);
