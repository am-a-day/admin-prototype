import { useEffect, useRef, useState } from "react";
import { Check, FolderPlus, Plus, X } from "@phosphor-icons/react";
import { cn } from "@/lib/utils";

export type CatalogStructureCreateResult = boolean | string | void;

export function CatalogStructureInlineCreateRow({
  entity,
  active,
  variant = "table",
  onStart,
  onCreate,
  onCancel,
}: {
  entity: "section" | "subsection";
  active: boolean;
  variant?: "table" | "empty";
  onStart: () => void;
  onCreate: (name: string) => CatalogStructureCreateResult;
  onCancel: () => void;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const normalizedName = name.trim();
  const canSubmit = normalizedName.length > 0;
  const label = entity === "section" ? "Добавить раздел..." : "Добавить подраздел...";
  const placeholder = entity === "section" ? "Название раздела..." : "Название подраздела...";
  const inputLabel = entity === "section" ? "Название раздела" : "Название подраздела";

  useEffect(() => {
    if (!active) {
      setName("");
      setError(null);
      return;
    }
    setName("");
    setError(null);
    inputRef.current?.focus();
    const frame = window.requestAnimationFrame(() => {
      inputRef.current?.focus();
      rowRef.current?.scrollIntoView?.({ block: "nearest" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  const submit = () => {
    if (!canSubmit) return;
    const result = onCreate(normalizedName);
    if (typeof result === "string") {
      setError(result);
      inputRef.current?.focus();
    }
  };

  const iconColumnWidth = variant === "empty" ? 45 : 57;

  return (
    <div
      ref={rowRef}
      data-catalog-structure-create-row
      data-subsection-create-draft={active ? "true" : undefined}
      data-structure-create-entity={entity}
      className="flex h-[36px] min-h-[36px] w-full items-center border-b border-[#f5f5f4] bg-white"
    >
      <span
        style={{ width: iconColumnWidth }}
        className="flex h-full shrink-0 items-center justify-center"
        aria-hidden="true"
      >
        {variant === "empty" ? (
          <span className="flex size-7 items-center justify-center rounded-[6.462px] border border-[#e7e5e4] bg-white text-black">
            <FolderPlus size={16} weight="regular" />
          </span>
        ) : (
          <Plus size={16} weight="regular" className="text-[#78716c]" />
        )}
      </span>
      {active ? (
        <div className="flex h-full min-w-0 flex-1 items-center gap-[6px] pl-[8px] pr-[12px]">
          <input
            ref={inputRef}
            value={name}
            aria-label={inputLabel}
            aria-invalid={error ? "true" : undefined}
            title={error ?? undefined}
            placeholder={placeholder}
            onChange={(event) => {
              setName(event.target.value);
              if (error) setError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                onCancel();
              }
            }}
            className="h-4 min-w-0 flex-1 bg-transparent text-[13px] font-normal leading-4 text-[#292524] outline-none placeholder:text-[#a6a09b]"
          />
          <span className="flex h-[26px] shrink-0 items-center gap-[12px] rounded-[26px] px-[6px] py-[4px]">
            <button
              type="button"
              aria-label="Отменить создание"
              onMouseDown={(event) => event.preventDefault()}
              onClick={onCancel}
              className="flex size-[18px] items-center justify-center rounded-[4px] text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              <X size={18} weight="regular" />
            </button>
            <button
              type="button"
              aria-label={entity === "section" ? "Создать раздел" : "Создать подраздел"}
              disabled={!canSubmit}
              onMouseDown={(event) => event.preventDefault()}
              onClick={submit}
              className={cn(
                "flex size-[18px] items-center justify-center rounded-[4px] text-[#1c1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                !canSubmit && "cursor-default opacity-40",
              )}
            >
              <Check size={18} weight="regular" />
            </button>
          </span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onStart}
          data-empty-subsection-create={variant === "empty" && entity === "subsection" ? "true" : undefined}
          className={cn(
            "flex h-full min-w-0 flex-1 items-center pl-[8px] pr-[12px] text-left text-[13px] font-normal leading-4 transition-colors hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
            variant === "empty" ? "text-[#292524]" : "text-[#a6a09b]",
          )}
        >
          <span className="truncate">{label}</span>
        </button>
      )}
    </div>
  );
}
