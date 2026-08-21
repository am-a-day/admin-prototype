import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CircleDashed, DotsThreeVertical, FilePlus } from "@phosphor-icons/react";
import { SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { cn } from "@/lib/utils";
import type { CatalogTreeSection } from "../model/tree";
import {
  CATALOG_TABLE_ROW_THUMBNAIL_CLASS,
  CatalogThumbnail,
} from "../ui/catalog-thumbnail";
import { CatalogTableFilterTrigger, CatalogTableToolbarShell } from "../ui/catalog-table-controls";
import {
  CatalogDndRow,
  catalogDndId,
  StructureDragHandle,
  type CatalogDropTarget,
} from "./dnd";
import type { CatalogSectionActionAnchor } from "../sidebar/section-tree";
import type { WeeklySchedule } from "../ui/catalog-schedule-editor";
import { DropdownContent, TableCheckbox } from "../table/catalog-table";
import { CatalogStructureInlineCreateRow } from "../ui/structure-inline-create";
import {
  CATALOG_SECTION_TO_TABLE_GAP_CLASS,
  CATALOG_TABLE_ACTIONS_COLUMN_WIDTH,
  CATALOG_TABLE_HEADER_STICKY_CLASS,
  CATALOG_TABLE_HEADER_SURFACE_CLASS,
  CATALOG_TABLE_ROW_HEIGHT_CLASS,
  CATALOG_TABLE_SELECTION_COLUMN_WIDTH,
  CATALOG_TABLE_TOOLBAR_CLASS,
} from "../ui/catalog-layout";

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

function formatPositionsCount(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  const noun = mod10 === 1 && mod100 !== 11
    ? "позиция"
    : mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)
      ? "позиции"
      : "позиций";
  return `${count} ${noun}`;
}

type SubsectionActionRenderer = (
  section: CatalogTreeSection,
  onAction: (action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => void,
) => ReactNode;

export function SubsectionRow({
  parentSectionId,
  section,
  itemCount,
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
  itemCount: number;
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
          data-subsection-row={section.id}
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
            "group relative flex cursor-pointer items-center overflow-visible border-b border-[#eeeeec] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
            CATALOG_TABLE_ROW_HEIGHT_CLASS,
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
            style={{ width: CATALOG_TABLE_SELECTION_COLUMN_WIDTH }}
            className="flex h-full shrink-0 items-center justify-center"
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
          <div className="flex min-w-0 flex-1 items-center gap-[7px] pl-[6px] pr-[12px] text-left">
            <CatalogThumbnail src={section.imageUrl} kind="section" className={CATALOG_TABLE_ROW_THUMBNAIL_CLASS} />
            <TruncatedText className="flex-1 whitespace-nowrap text-[13px] font-normal leading-4 text-[#44403b] transition-colors group-hover:text-[#292524] group-hover:underline group-hover:decoration-[#d6d3d1] group-hover:underline-offset-2">
              {section.name}
            </TruncatedText>
            <span className="shrink-0 whitespace-nowrap text-[12px] font-normal leading-5 text-[#a6a09b]">
              {formatPositionsCount(itemCount)}
            </span>
            {section.status === "archive" && (
              <span className="shrink-0 rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[11px] font-medium leading-4 text-[#79716b]">
                В архиве
              </span>
            )}
          </div>
          <span
            data-no-dnd
            style={{ width: CATALOG_TABLE_ACTIONS_COLUMN_WIDTH }}
            className="flex shrink-0 items-center justify-center"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => event.stopPropagation()}
          >
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={`Действия с подразделом ${section.name}`}
                  className="flex h-7 w-7 items-center justify-center rounded-lg text-black transition hover:bg-[#efefea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                >
                  <DotsThreeVertical size={16} weight="regular" />
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
        <CatalogTableFilterTrigger label="Все" ariaLabel="Фильтр подразделов" />
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
    <div data-catalog-table-header className={CATALOG_TABLE_HEADER_STICKY_CLASS}>
      <div className={CATALOG_TABLE_HEADER_SURFACE_CLASS}>
        <span style={{ width: CATALOG_TABLE_SELECTION_COLUMN_WIDTH }} className="flex h-full shrink-0 items-center justify-center">
          <TableCheckbox
            ariaLabel="Выбрать все подразделы"
            checked={checked}
            indeterminate={indeterminate}
            onChange={onSelectAll}
          />
        </span>
        <span className="flex h-full min-w-0 flex-1 items-center pl-[6px] pr-[3px] text-[13px] font-medium leading-5 text-[#939393]">
          Название подраздела
        </span>
        <span style={{ width: CATALOG_TABLE_ACTIONS_COLUMN_WIDTH }} className="flex h-full shrink-0" aria-hidden="true" />
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
  onStartDraft,
  onCreateDraft,
  onCancelDraft,
  onAddPosition,
  addPositionDisabled = false,
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
  onStartDraft?: () => void;
  onCreateDraft?: (name: string) => boolean | string | void;
  onCancelDraft?: () => void;
  onAddPosition?: () => void;
  addPositionDisabled?: boolean;
  onSelect: (id: string) => void;
  onAction: (section: CatalogTreeSection, action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => void;
  renderActions: SubsectionActionRenderer;
}) {
  const [query, setQuery] = useState("");
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchActiveRef = useRef(false);
  const selectedCount = selectedIds.size;
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const isEmpty = childSections.length === 0;
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
      <div className="min-w-0 flex-1 bg-[#f7f7f7]">
        <div data-catalog-section-table-gap className={CATALOG_SECTION_TO_TABLE_GAP_CLASS} aria-hidden="true" />
        {isEmpty ? (
          <>
            <div data-catalog-table-toolbar className={CATALOG_TABLE_TOOLBAR_CLASS} />
            <div data-empty-section-scaffold className="w-full border-b border-[#e7e5e4]">
              <div className="flex h-[34px] w-full items-center bg-[#fafaf9]">
                <span className="flex h-full w-[45px] shrink-0 items-center justify-center border-b border-[#eeeeec] text-black" aria-hidden="true">
                  <CircleDashed size={16} weight="regular" />
                </span>
                <p className="flex h-full min-w-0 flex-1 items-center border-b border-r border-[#eeeeec] pl-[8px] pr-[3px] text-[13px] font-normal leading-[1.5] text-[#79716b]">
                  В разделе пока ничего нет
                </p>
              </div>
              {onAddPosition && (
                <div className="flex h-[36px] w-full items-center border-b border-[#f5f5f4] bg-white">
                  <span className="flex h-full w-[45px] shrink-0 items-center justify-center" aria-hidden="true">
                    <span className="flex size-7 items-center justify-center rounded-[6.462px] border border-[#e7e5e4] bg-white text-black">
                      <FilePlus size={16} weight="regular" />
                    </span>
                  </span>
                  <button
                    type="button"
                    onClick={onAddPosition}
                    disabled={addPositionDisabled}
                    data-empty-position-create
                    className="flex h-full min-w-0 flex-1 items-center pl-[8px] pr-[12px] text-left text-[13px] font-normal leading-4 text-[#292524] transition-colors hover:bg-[#fafaf9] disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10"
                  >
                    Добавить позицию
                  </button>
                </div>
              )}
              {onStartDraft && onCreateDraft && onCancelDraft && (
                <CatalogStructureInlineCreateRow
                  entity="subsection"
                  active={draftActive}
                  variant="empty"
                  onStart={onStartDraft}
                  onCreate={onCreateDraft}
                  onCancel={onCancelDraft}
                />
              )}
            </div>
          </>
        ) : (
          <>
            <CatalogTableToolbarShell
              value={query}
              onValueChange={setQuery}
              ariaLabel="Найти подраздел"
              inputRef={searchInputRef}
              onFocus={() => { searchActiveRef.current = true; }}
              onBlur={() => { searchActiveRef.current = false; }}
              filter={<SubsectionFilter />}
            />
            {selectedCount > 0 && bulkToolbar && (
              <div className="border-b border-[#e7e5e4]">{bulkToolbar}</div>
            )}
            {selectedCount === 0 && (
              <SubsectionTableHeader
                checked={childSections.every(({ section }) => selectedIds.has(section.id))}
                indeterminate={childSections.some(({ section }) => selectedIds.has(section.id))}
                onSelectAll={(selected) => {
                  const next = selected ? new Set(childSections.map(({ section }) => section.id)) : new Set<string>();
                  childSections.forEach(({ section }) => onSelectedChange(section.id, next.has(section.id)));
                }}
              />
            )}
            {visibleChildSections.map(({ section, itemCount }) => (
              <SubsectionRow
                key={section.id}
                parentSectionId={parentSectionId}
                section={section}
                itemCount={itemCount}
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
            {visibleChildSections.length === 0 && (
              <div className="flex h-[38px] items-center border-b border-[#eeeeec] pl-[57px] pr-[33px] text-[13px] leading-5 text-[#78716c]">
                Поиск не дал результатов
              </div>
            )}
            {onStartDraft && onCreateDraft && onCancelDraft && (
              <CatalogStructureInlineCreateRow
                entity="subsection"
                active={draftActive}
                onStart={onStartDraft}
                onCreate={onCreateDraft}
                onCancel={onCancelDraft}
              />
            )}
          </>
        )}
      </div>
    </SortableContext>
  );
}
