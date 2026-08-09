import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { DotsThreeVertical } from "@phosphor-icons/react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import type { CatalogTreeSection } from "../model/tree";
import { CatalogThumbnail } from "../ui/catalog-thumbnail";
import {
  CatalogDndRow,
  catalogDndId,
  StructureDragHandle,
  type CatalogDropTarget,
} from "./dnd";
import type { CatalogSectionActionAnchor } from "../sidebar/section-tree";

function TruncatedText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const textRef = useRef<HTMLSpanElement | null>(null);
  const [isTruncated, setIsTruncated] = useState(false);

  useEffect(() => {
    const node = textRef.current;
    if (!node) return;
    const update = () => setIsTruncated(node.scrollWidth > node.clientWidth + 1);
    update();
    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => window.removeEventListener("resize", update);
    }
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, [children]);

  return (
    <span ref={textRef} title={isTruncated ? children : undefined} className={cn("block min-w-0 truncate", className)}>
      {children}
    </span>
  );
}

type SubsectionActionRenderer = (
  section: CatalogTreeSection,
  onAction: (action: string, anchor?: CatalogSectionActionAnchor) => void,
) => ReactNode;

export function SubsectionRow({
  parentSectionId,
  section,
  itemCount,
  dropTarget,
  dragActiveRef,
  onSelect,
  onAction,
  renderActions,
}: {
  parentSectionId: string;
  section: CatalogTreeSection;
  itemCount: number;
  dropTarget: CatalogDropTarget;
  dragActiveRef: RefObject<boolean>;
  onSelect: (id: string) => void;
  onAction: (section: CatalogTreeSection, action: string, anchor?: CatalogSectionActionAnchor) => void;
  renderActions: SubsectionActionRenderer;
}) {
  const isDropHere = dropTarget?.kind === "section" && dropTarget.id === section.id;

  return (
    <CatalogDndRow kind="section" id={section.id} containerId={parentSectionId} surface="composition">
      {({ setNodeRef, setActivatorNodeRef, dragProps, isDragging, style }) => (
        <div
          ref={setNodeRef}
          style={style}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (dragActiveRef.current) return;
            onSelect(section.id);
          }}
          onKeyDown={(event) => {
            if ((event.target as HTMLElement | null)?.closest("[data-composition-dnd-handle]")) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            onSelect(section.id);
          }}
          className={cn(
            "group relative flex h-11 min-h-11 max-h-11 cursor-pointer items-center gap-1 overflow-hidden border-b border-[#f0efe9] pl-0.5 pr-1 transition-colors last:border-b-0 hover:bg-[#faf9f7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
            isDragging && "opacity-0",
            isDropHere && !dropTarget?.valid && "cursor-not-allowed",
          )}
        >
          <StructureDragHandle
            ref={setActivatorNodeRef}
            canDrag
            ariaLabel={`Изменить порядок подраздела ${section.name}`}
            dragProps={dragProps}
          />
          <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <CatalogThumbnail src={section.imageUrl} kind="section" className="h-6 w-6 rounded-[6px]" />
            <TruncatedText className="flex-1 whitespace-nowrap text-[13px] font-medium leading-5 text-[#44403b] transition-colors group-hover:text-[#1c1917] group-hover:underline group-hover:decoration-[#d6d3d1] group-hover:underline-offset-2">
              {section.name}
            </TruncatedText>
          </div>
          <span className="shrink-0 whitespace-nowrap text-[12px] tabular-nums text-[#a8a29e]">{itemCount}</span>
          <span
            data-no-dnd
            className="flex w-8 shrink-0 items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={`Действия с подразделом ${section.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-[#57534d] transition hover:bg-[#efefea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <DotsThreeVertical size={18} weight="bold" />
                </button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content align="end" sideOffset={6} className="z-[100002] min-w-[190px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none">
                  {renderActions(section, (action, anchor) => onAction(section, action, anchor))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </span>
        </div>
      )}
    </CatalogDndRow>
  );
}

export function SubsectionList({
  parentSectionId,
  childSections,
  dropTarget,
  dragActiveRef,
  onSelect,
  onAction,
  renderActions,
}: {
  parentSectionId: string;
  childSections: Array<{ section: CatalogTreeSection; itemCount: number }>;
  dropTarget: CatalogDropTarget;
  dragActiveRef: RefObject<boolean>;
  onSelect: (id: string) => void;
  onAction: (section: CatalogTreeSection, action: string, anchor?: CatalogSectionActionAnchor) => void;
  renderActions: SubsectionActionRenderer;
}) {
  return (
    <SortableContext
      items={childSections.map(({ section }) => catalogDndId("section", section.id))}
      strategy={verticalListSortingStrategy}
    >
      <div>
        {childSections.map(({ section, itemCount }) => (
          <SubsectionRow
            key={section.id}
            parentSectionId={parentSectionId}
            section={section}
            itemCount={itemCount}
            dropTarget={dropTarget}
            dragActiveRef={dragActiveRef}
            onSelect={onSelect}
            onAction={onAction}
            renderActions={renderActions}
          />
        ))}
      </div>
    </SortableContext>
  );
}
