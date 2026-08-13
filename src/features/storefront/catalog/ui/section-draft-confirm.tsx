import { Check } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/tooltip";

export function SectionDraftConfirmButton({
  onCommit,
  placement = "field",
}: {
  onCommit: () => void;
  placement?: "field" | "cell";
}) {
  return (
    <Tooltip label="Создать раздел" side="top">
      <button
        type="button"
        data-no-dnd
        aria-label="Создать раздел"
        onMouseDown={(event) => event.preventDefault()}
        onClick={onCommit}
        className={placement === "cell"
          ? "flex h-7 w-7 items-center justify-center rounded-[7px] text-[#78716c] transition hover:bg-[#efefea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          : "absolute right-0 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-[6px] text-[#78716c] transition hover:bg-[#efefea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"}
      >
        <Check size={14} weight="bold" />
      </button>
    </Tooltip>
  );
}
