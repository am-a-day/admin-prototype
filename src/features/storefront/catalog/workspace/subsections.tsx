import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown, DotsThreeVertical } from "@phosphor-icons/react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import type { CatalogTreeSection } from "../model/tree";
import { CatalogThumbnail } from "../ui/catalog-thumbnail";
import { CatalogTableSearchControl } from "../ui/catalog-table-controls";
import {
  CatalogDndRow,
  catalogDndId,
  StructureDragHandle,
  type CatalogDropTarget,
} from "./dnd";
import type { CatalogSectionActionAnchor } from "../sidebar/section-tree";
import type { WeeklySchedule } from "../ui/catalog-schedule-editor";
import { DropdownContent, TableCheckbox } from "../table/catalog-table";
import { SectionDraftConfirmButton } from "../ui/section-draft-confirm";
import { CATALOG_SECTION_TO_TABLE_GAP_CLASS } from "../ui/catalog-layout";

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
  onAction: (action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => void,
) => ReactNode;

function SubsectionDraftRow({
  active,
  onCreate,
  onCancel,
}: {
  active: boolean;
  onCreate: (name: string) => boolean | string | void;
  onCancel: () => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const closingRef = useRef(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!active) return;
    closingRef.current = false;
    setName("");
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [active]);

  if (!active) return null;

  const cancel = () => {
    closingRef.current = true;
    onCancel();
  };
  const submit = () => {
    const nextName = name.trim();
    if (!nextName || nextName.toLocaleLowerCase("ru") === "без названия") {
      cancel();
      return;
    }
    const result = onCreate(nextName);
    if (result === true) closingRef.current = true;
    else if (typeof result === "string") inputRef.current?.focus();
  };

  return (
    <div data-subsection-create-draft className="relative flex h-[38px] min-h-[38px] max-h-[38px] items-center gap-1 overflow-visible border-b border-[#e5e7eb] pl-0.5 pr-1">
      <span className="flex h-full w-[42px] shrink-0" aria-hidden="true" />
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <CatalogThumbnail kind="section" className="h-6 w-6 rounded-[6px]" />
        <div className="min-w-0 flex-1">
          <input
            ref={inputRef}
            value={name}
            aria-label="Название раздела"
            placeholder="Название раздела"
            onChange={(event) => setName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter") {
                event.preventDefault();
                submit();
              }
              if (event.key === "Escape") {
                event.preventDefault();
                cancel();
              }
            }}
            onBlur={() => {
              if (!closingRef.current) submit();
            }}
            className="min-w-0 w-full bg-transparent py-1 text-[13px] font-medium leading-5 text-[#44403b] outline-none placeholder:text-[#a8a29e]"
          />
        </div>
      </div>
      <span className="flex w-8 shrink-0 items-center justify-center">
        <SectionDraftConfirmButton onCommit={submit} placement="cell" />
      </span>
    </div>
  );
}

export function SubsectionRow({
  parentSectionId,
  section,
  dropTarget,
  dragActiveRef,
  selected,
  selectionMode,
  reorderEnabled,
  onSelect,
  onSelectedChange,
  onAction,
  renderActions,
}: {
  parentSectionId: string;
  section: CatalogTreeSection;
  dropTarget: CatalogDropTarget;
  dragActiveRef: RefObject<boolean>;
  selected: boolean;
  selectionMode: boolean;
  reorderEnabled: boolean;
  onSelect: (id: string) => void;
  onSelectedChange: (id: string, selected: boolean) => void;
  onAction: (section: CatalogTreeSection, action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => void;
  renderActions: SubsectionActionRenderer;
}) {
  const isDropHere = dropTarget?.kind === "section" && dropTarget.id === section.id;

  return (
    <CatalogDndRow kind="section" id={section.id} containerId={parentSectionId} surface="composition" disabled={!reorderEnabled}>
      {({ setNodeRef, setActivatorNodeRef, dragProps, isDragging, style }) => (
        <div
          ref={setNodeRef}
          style={style}
          role="button"
          tabIndex={0}
          onClick={() => {
            if (dragActiveRef.current) return;
            if (selectionMode) onSelectedChange(section.id, !selected);
            else onSelect(section.id);
          }}
          onKeyDown={(event) => {
            if ((event.target as HTMLElement | null)?.closest("[data-composition-dnd-handle]")) return;
            if (event.key !== "Enter" && event.key !== " ") return;
            event.preventDefault();
            if (selectionMode) onSelectedChange(section.id, !selected);
            else onSelect(section.id);
          }}
          className={cn(
            "group relative flex h-[38px] min-h-[38px] max-h-[38px] cursor-pointer items-center gap-1 overflow-visible border-b border-[#e7e5e4] pl-0.5 pr-1 transition-colors last:border-b-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
            selected ? "bg-[#f1f4ff] hover:bg-[#f1f4ff]" : "hover:bg-[#fafaf9]",
            isDragging && "opacity-0",
            isDropHere && !dropTarget?.valid && "cursor-not-allowed",
          )}
        >
          <StructureDragHandle
            ref={setActivatorNodeRef}
            canDrag={reorderEnabled}
            ariaLabel={`Изменить порядок подраздела ${section.name}`}
            dragProps={dragProps}
            disabledTooltip="Очистите поиск, чтобы изменить порядок"
          />
          <span
            data-no-dnd
            className="flex h-full w-[42px] shrink-0 items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <TableCheckbox
              ariaLabel={`Выбрать подраздел ${section.name}`}
              checked={selected}
              forceVisible
              onChange={(checked) => onSelectedChange(section.id, checked)}
            />
          </span>
          <div className="flex min-w-0 flex-1 items-center gap-2 text-left">
            <CatalogThumbnail src={section.imageUrl} kind="section" className="h-6 w-6 rounded-[6px]" />
            <TruncatedText className="flex-1 whitespace-nowrap text-[13px] font-medium leading-5 text-[#44403b] transition-colors group-hover:text-[#1c1917] group-hover:underline group-hover:decoration-[#d6d3d1] group-hover:underline-offset-2">
              {section.name}
            </TruncatedText>
            {section.status === "archive" && (
              <span className="shrink-0 rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-[#79716b]">
                В архиве
              </span>
            )}
          </div>
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
                  {renderActions(section, (action, anchor, schedule) => onAction(section, action, anchor, schedule))}
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </span>
        </div>
      )}
    </CatalogDndRow>
  );
}

function SubsectionFilter() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          aria-label="Фильтр подразделов"
          className="inline-flex h-full shrink-0 items-center gap-1 rounded-l-[7px] px-2 text-[12px] font-normal leading-4 text-[#57534d] transition hover:bg-[#fafaf9] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f39f6]/20"
        >
          Все
          <CaretDown size={12} weight="regular" />
        </button>
      </DropdownMenu.Trigger>
      <DropdownContent align="start">
        <DropdownMenu.Item
          disabled
          className="flex h-8 items-center rounded-[8px] px-2 text-[13px] font-normal text-[#44403b] opacity-100 outline-none"
        >
          Все
        </DropdownMenu.Item>
      </DropdownContent>
    </DropdownMenu.Root>
  );
}

function SubsectionTableHeader({
  checked,
  indeterminate,
  onSelectAll,
}: {
  checked: boolean;
  indeterminate: boolean;
  onSelectAll: (checked: boolean) => void;
}) {
  return (
    <div data-catalog-table-header className="sticky top-[39px] z-10 bg-[#fafaf9]">
      <div className="flex h-[38px] min-w-0 items-center overflow-hidden border-b border-[#e7e5e4] bg-[#fafaf9]">
        <span className="flex h-full w-[42px] shrink-0 items-center justify-center">
          <TableCheckbox
            ariaLabel="Выбрать все подразделы"
            checked={checked}
            indeterminate={indeterminate}
            onChange={onSelectAll}
          />
        </span>
        <span className="flex h-full min-w-0 flex-1 items-center px-3 text-[12px] font-medium leading-5 text-[#79716b]">
          Название
        </span>
        <span className="flex h-full w-8 shrink-0" aria-hidden="true" />
      </div>
    </div>
  );
}

export function SubsectionList({
  parentSectionId,
  childSections,
  dropTarget,
  dragActiveRef,
  selectedIds,
  onSelectedChange,
  bulkToolbar,
  draftActive = false,
  onCreateDraft,
  onCancelDraft,
  onSelect,
  onAction,
  renderActions,
}: {
  parentSectionId: string;
  childSections: Array<{ section: CatalogTreeSection; itemCount: number }>;
  dropTarget: CatalogDropTarget;
  dragActiveRef: RefObject<boolean>;
  selectedIds: Set<string>;
  onSelectedChange: (id: string, selected: boolean) => void;
  bulkToolbar?: ReactNode;
  draftActive?: boolean;
  onCreateDraft?: (name: string) => boolean | string | void;
  onCancelDraft?: () => void;
  onSelect: (id: string) => void;
  onAction: (section: CatalogTreeSection, action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => void;
  renderActions: SubsectionActionRenderer;
}) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchActiveRef = useRef(false);
  const selectedCount = selectedIds.size;
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const visibleChildSections = normalizedQuery
    ? childSections.filter(({ section }) => section.name.toLocaleLowerCase("ru").includes(normalizedQuery))
    : childSections;

  useEffect(() => {
    if (searchActiveRef.current || query.trim()) {
      const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
      return () => window.cancelAnimationFrame(frame);
    }
    setQuery("");
  }, [parentSectionId]);

  return (
    <SortableContext
      items={visibleChildSections.map(({ section }) => catalogDndId("section", section.id))}
      strategy={verticalListSortingStrategy}
    >
      <div className="min-w-0">
        <div className={cn("border-b border-[#e7e5e4] pb-[5px]", CATALOG_SECTION_TO_TABLE_GAP_CLASS)}>
          <CatalogTableSearchControl
            value={query}
            onValueChange={setQuery}
            ariaLabel="Найти подраздел"
            inputRef={searchInputRef}
            onFocus={() => { searchActiveRef.current = true; }}
            onBlur={() => { searchActiveRef.current = false; }}
            filter={<SubsectionFilter />}
            className="w-[clamp(300px,30vw,360px)]"
          />
        </div>
        {selectedCount > 0 && bulkToolbar && (
          <div className="border-b border-[#e7e5e4]">{bulkToolbar}</div>
        )}
        {selectedCount === 0 && (
          <SubsectionTableHeader
            checked={childSections.length > 0 && childSections.every(({ section }) => selectedIds.has(section.id))}
            indeterminate={childSections.some(({ section }) => selectedIds.has(section.id))}
            onSelectAll={(selected) => {
              const next = selected ? new Set(childSections.map(({ section }) => section.id)) : new Set<string>();
              childSections.forEach(({ section }) => onSelectedChange(section.id, next.has(section.id)));
            }}
          />
        )}
        {draftActive && onCreateDraft && onCancelDraft && (
          <SubsectionDraftRow active={draftActive} onCreate={onCreateDraft} onCancel={onCancelDraft} />
        )}
        {visibleChildSections.map(({ section }) => (
          <SubsectionRow
            key={section.id}
            parentSectionId={parentSectionId}
            section={section}
            dropTarget={dropTarget}
            dragActiveRef={dragActiveRef}
            selected={selectedIds.has(section.id)}
            selectionMode={selectedCount > 0}
            reorderEnabled={!normalizedQuery}
            onSelect={onSelect}
            onSelectedChange={onSelectedChange}
            onAction={onAction}
            renderActions={renderActions}
          />
        ))}
        {visibleChildSections.length === 0 && !draftActive && (
          <div className="py-8 text-center text-[13px] leading-5 text-[#78716c]">Поиск не дал результатов</div>
        )}
      </div>
    </SortableContext>
  );
}
