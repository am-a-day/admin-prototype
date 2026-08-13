import { ArrowDown, ArrowUp } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/tooltip";

export function PositionQueueControls({
  onSelect,
  previousId,
  nextId,
}: {
  onSelect: (id: string) => void;
  previousId: string | null;
  nextId: string | null;
}) {
  return (
    <div className="flex shrink-0 items-center gap-0.5" role="group" aria-label="Навигация между позициями">
      <Tooltip label="Предыдущая позиция" side="bottom" delayDuration={250}>
        <button
          type="button"
          onClick={() => previousId && onSelect(previousId)}
          disabled={!previousId}
          aria-label="Предыдущая позиция в выборке"
          className="flex size-8 items-center justify-center rounded-lg text-[#57534d] transition hover:bg-[#f5f5f4] disabled:cursor-default disabled:text-[#d6d3d1] disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <ArrowUp size={15} weight="bold" />
        </button>
      </Tooltip>
      <Tooltip label="Следующая позиция" side="bottom" delayDuration={250}>
        <button
          type="button"
          onClick={() => nextId && onSelect(nextId)}
          disabled={!nextId}
          aria-label="Следующая позиция в выборке"
          className="flex size-8 items-center justify-center rounded-lg text-[#57534d] transition hover:bg-[#f5f5f4] disabled:cursor-default disabled:text-[#d6d3d1] disabled:hover:bg-transparent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <ArrowDown size={15} weight="bold" />
        </button>
      </Tooltip>
    </div>
  );
}
