import { forwardRef, useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { DotsSixVertical } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/tooltip";

export const DND_TRANSITION = { duration: 200, easing: "cubic-bezier(0.25, 1, 0.5, 1)" };

export const restrictTableSortToVerticalAxis = ({ transform }: { transform: { x: number; y: number; scaleX: number; scaleY: number } }) => ({ ...transform, x: 0 });

export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() =>
    typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)").matches : false,
  );
  useEffect(() => {
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  return reduced;
}

export type CatalogDndKind = "section" | "item";
export type CatalogDndSurface = "tree" | "composition";
export type CatalogDropZone = "before" | "after" | "inside";
export type CatalogDropTarget = {
  kind: CatalogDndKind;
  surface: CatalogDndSurface;
  id: string;
  containerId: string | null;
  zone: CatalogDropZone;
  valid: boolean;
  reason?: string;
  insideActive?: boolean;
} | null;
export type CatalogActiveDrag = { kind: CatalogDndKind; id: string; title: string; imageUrl?: string | null } | null;

export function catalogDndId(kind: CatalogDndKind, id: string) {
  return `${kind}:${id}`;
}

export function parseCatalogDndId(compoundId: string | number): string {
  const raw = String(compoundId);
  const separatorIndex = raw.indexOf(":");
  return separatorIndex === -1 ? raw : raw.slice(separatorIndex + 1);
}

export function CatalogDndRow({
  kind,
  id,
  containerId,
  surface = "tree",
  disabled,
  children,
}: {
  kind: CatalogDndKind;
  id: string;
  containerId: string | null;
  surface?: CatalogDndSurface;
  disabled?: boolean;
  children: (args: {
    setNodeRef: (element: HTMLElement | null) => void;
    setActivatorNodeRef: (element: HTMLElement | null) => void;
    dragProps: Record<string, unknown>;
    isDragging: boolean;
    style: CSSProperties;
  }) => ReactNode;
}) {
  const { setNodeRef, setActivatorNodeRef, listeners, attributes, isDragging, transform, transition } = useSortable({
    id: catalogDndId(kind, id),
    data: { kind, containerId, surface },
    disabled,
    transition: DND_TRANSITION,
  });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };
  return <>{children({ setNodeRef, setActivatorNodeRef, dragProps: disabled ? {} : { ...attributes, ...listeners }, isDragging, style })}</>;
}

export const StructureDragHandle = forwardRef<
  HTMLButtonElement,
  {
    canDrag: boolean;
    ariaLabel: string;
    dragProps: Record<string, unknown>;
    disabledTooltip?: string;
  }
>(({ canDrag, ariaLabel, dragProps, disabledTooltip = "Изменение порядка недоступно" }, ref) => (
  <Tooltip label={canDrag ? ariaLabel : disabledTooltip} side="top" delayDuration={250}>
    <span
      className="flex h-8 w-6 shrink-0 items-center justify-center"
      onClick={(event) => event.stopPropagation()}
    >
      <button
        ref={ref}
        type="button"
        data-composition-dnd-handle
        {...dragProps}
        disabled={!canDrag}
        aria-label={ariaLabel}
        className="flex h-7 w-6 cursor-grab items-center justify-center rounded-[6px] text-[#a8a29e] transition hover:bg-[#f0f0ea] hover:text-[#57534d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/15 active:cursor-grabbing disabled:cursor-not-allowed disabled:opacity-45"
      >
        <DotsSixVertical size={15} weight="bold" />
      </button>
    </span>
  </Tooltip>
));

StructureDragHandle.displayName = "StructureDragHandle";
