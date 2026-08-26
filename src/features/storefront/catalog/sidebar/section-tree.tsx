import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Asterisk, CaretDoubleLeft, CaretDown, CaretRight, Check, DotsThreeVertical, MagnifyingGlass, Plus, X } from "@phosphor-icons/react";
import type { CatalogItem } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { catalogStorageKey } from "@/lib/catalog-preview";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu as SharedDropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Tooltip } from "@/components/ui/tooltip";
import { readCatalogJson, writeCatalogJson } from "../persistence";
import { CatalogInlineNameEditor } from "../ui/catalog-inline-name-editor";
import { CatalogThumbnail } from "../ui/catalog-thumbnail";
import {
  CatalogAvailabilityStatusIcon,
  type CatalogAvailabilityStatusIconState,
} from "../ui/catalog-availability-status-icon";
import { CATALOG_SECTION_ACTION_ITEM_CLASS } from "../ui/catalog-dropdown";
import type { WeeklySchedule } from "../ui/catalog-schedule-editor";
import {
  countItemsBySection,
  findSectionPath,
  flattenCatalogTree,
  getSectionTreeDepth,
  MAX_CATALOG_SECTION_DEPTH,
  type CatalogTreeSection,
} from "../model/tree";

export type CatalogSectionActionAnchor = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export function CatalogTreeThumbnail({
  src,
  selected,
  muted,
}: {
  src?: string | null;
  selected?: boolean;
  muted?: boolean;
}) {
  return (
    <span
      data-catalog-tree-thumbnail
      data-has-image={src ? "true" : "false"}
      className={cn(
        "relative flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[5.263px]",
        selected && "rounded-[3px] border-[0.556px] border-[#4f39f6] bg-stone-100 p-[1.818px]",
        muted && "opacity-60 grayscale",
      )}
    >
      <CatalogThumbnail
        src={src}
        kind="item"
        className={cn(
          "size-5 rounded-[4.615px] bg-stone-100 text-[#a6a09b] [&_svg]:size-[11px]",
          !src && "border-[0.714px] border-[#e7e5e4]",
          selected && "size-full rounded-[2px] border-0",
        )}
      />
    </span>
  );
}

const CATALOG_TREE_SHOW_ARCHIVED_STORAGE_KEY = catalogStorageKey("sections.treeShowArchived");
const CATALOG_SECTION_ACTION_GRID_CLASS = "grid w-[46px] shrink-0 grid-cols-[20px_20px] items-center gap-1.5";

const SECTION_STATUS_LABELS: Record<Exclude<CatalogAvailabilityStatusIconState, "soon">, string> = {
  archive: "В архиве",
  stopped: "На стопе",
  scheduled: "По расписанию",
};

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

function hideArchivedSections(sections: CatalogTreeSection[]): CatalogTreeSection[] {
  return sections.flatMap((section) => section.status === "archive"
    ? []
    : [{ ...section, children: hideArchivedSections(section.children ?? []) }]);
}

type SectionTreeActionOptions = {
  allowPositionCreation: boolean;
  allowSubsectionCreation: boolean;
};

type UnifiedCatalogTreePanelProps = {
  sections: CatalogTreeSection[];
  items: CatalogItem[];
  allPositionsSelected: boolean;
  selectedSectionId: string | null;
  sectionEditingEnabled: boolean;
  includeArchived: boolean;
  onSelectSection: (id: string) => void;
  onSelectAllPositions: () => void;
  onStartCreateSection: (parentId: string | null) => void;
  onCreateSection: (name: string, parentId: string | null) => boolean | string | void;
  onCancelCreateSection: () => void;
  draftParentId: string | null | undefined;
  renamingSectionId: string | null;
  onStartRenameSection: (sectionId: string) => void;
  onRenameSection: (sectionId: string, name: string) => boolean | string | void;
  onCancelRenameSection: () => void;
  createSectionButtonRef?: RefObject<HTMLButtonElement | null>;
  onSectionAction: (section: CatalogTreeSection, action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => void;
  renderSectionActions: (
    section: CatalogTreeSection,
    options: SectionTreeActionOptions,
    onAction: (action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => void,
  ) => ReactNode;
  positionCreationEnabled?: boolean;
  secondaryNavigation?: ReactNode;
  menuSwitcher?: ReactNode;
  onCollapseSections: () => void;
  onReorderSections: (parentId: string | null, activeId: string, overId: string) => void;
};

class SectionTreePointerSensor extends PointerSensor {
  static activators = [
    {
      eventName: "onPointerDown" as const,
      handler: ({ nativeEvent }: { nativeEvent: PointerEvent }) => {
        if (nativeEvent.button !== 0) return false;
        return !(nativeEvent.target as HTMLElement | null)?.closest("[data-no-dnd]");
      },
    },
  ];
}

function SortableSectionNode({
  id,
  parentId,
  disabled,
  children,
}: {
  id: string;
  parentId: string | null;
  disabled: boolean;
  children: (args: {
    setNodeRef: (element: HTMLElement | null) => void;
    dragProps: Record<string, unknown>;
    isDragging: boolean;
    sortableStyle: CSSProperties;
  }) => ReactNode;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
    data: { parentId },
    disabled,
  });

  return children({
    setNodeRef,
    dragProps: disabled ? {} : { ...attributes, ...listeners },
    isDragging,
    sortableStyle: {
      transform: CSS.Transform.toString(transform),
      transition,
      position: "relative",
      zIndex: isDragging ? 2 : undefined,
    },
  });
}

function SectionTreeDropdown({
  children,
  preventTriggerFocus = false,
  align = "end",
}: {
  children: ReactNode;
  preventTriggerFocus?: boolean;
  align?: "start" | "center" | "end";
}) {
  return (
    <DropdownMenuContent
      align={align}
      sideOffset={6}
      onClick={(event) => event.stopPropagation()}
      onFocusOutside={(event) => event.preventDefault()}
      onCloseAutoFocus={preventTriggerFocus ? (event) => event.preventDefault() : undefined}
      className="z-[100002] w-[200px] overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white p-0 shadow-[0_2px_4px_-2px_rgba(0,0,0,0.1),0_4px_6px_-1px_rgba(0,0,0,0.1)] outline-none"
    >
      {children}
    </DropdownMenuContent>
  );
}

export function UnifiedCatalogTreePanel({
  sections,
  items,
  allPositionsSelected,
  selectedSectionId,
  sectionEditingEnabled,
  includeArchived,
  onSelectSection,
  onSelectAllPositions,
  onStartCreateSection,
  onCreateSection,
  onCancelCreateSection,
  draftParentId,
  renamingSectionId,
  onStartRenameSection,
  onRenameSection,
  onCancelRenameSection,
  createSectionButtonRef,
  onSectionAction,
  renderSectionActions,
  positionCreationEnabled = true,
  secondaryNavigation,
  menuSwitcher,
  onCollapseSections,
  onReorderSections,
}: UnifiedCatalogTreePanelProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(() =>
    readCatalogJson<boolean>(CATALOG_TREE_SHOW_ARCHIVED_STORAGE_KEY, false),
  );
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const draftInputRef = useRef<HTMLInputElement | null>(null);
  const [draftName, setDraftName] = useState("");
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [renameName, setRenameName] = useState("");
  const [openMenuSectionId, setOpenMenuSectionId] = useState<string | null>(null);
  const [focusedActionSectionId, setFocusedActionSectionId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const root = sections[0]?.id;
    return root ? { [root]: true } : {};
  });
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const dndSensors = useSensors(
    useSensor(SectionTreePointerSensor, { activationConstraint: { distance: 7 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const sameParentCollisionDetection: CollisionDetection = useCallback((args) => {
    const activeParentId = args.active.data.current?.parentId ?? null;
    const siblingContainers = args.droppableContainers.filter(
      (container) => (container.data.current?.parentId ?? null) === activeParentId,
    );
    const siblingArgs = { ...args, droppableContainers: siblingContainers };
    return args.pointerCoordinates ? pointerWithin(siblingArgs) : closestCenter(siblingArgs);
  }, []);
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const allFlatSections = useMemo(() => flattenCatalogTree(sections), [sections]);
  const visibleSections = useMemo(
    () => showArchived ? sections : hideArchivedSections(sections),
    [sections, showArchived],
  );
  const flatSections = useMemo(() => flattenCatalogTree(visibleSections), [visibleSections]);
  const visibleIds = useMemo(() => {
    if (!normalizedQuery) return new Set(flatSections.map((section) => section.id));
    return new Set(flatSections
      .filter((section) => section.name.toLocaleLowerCase("ru").includes(normalizedQuery))
      .flatMap((section) => [section.id, ...findSectionPath(visibleSections, section.id)]));
  }, [flatSections, normalizedQuery, visibleSections]);
  const countBySection = useMemo(
    () => countItemsBySection(items, visibleSections, includeArchived),
    [includeArchived, items, visibleSections],
  );

  useEffect(() => {
    if (showArchived || !selectedSectionId) return;
    if (allFlatSections.find((section) => section.id === selectedSectionId)?.status === "archive") {
      onSelectAllPositions();
    }
  }, [allFlatSections, onSelectAllPositions, selectedSectionId, showArchived]);

  const handleSectionDragEnd = (event: DragEndEvent) => {
    if (!event.over || event.active.id === event.over.id) return;
    const activeId = String(event.active.id);
    const overId = String(event.over.id);
    const activeParentId = event.active.data.current?.parentId ?? null;
    const overParentId = event.over.data.current?.parentId ?? null;
    if (activeParentId !== overParentId) return;
    onReorderSections(activeParentId, activeId, overId);
  };

  useEffect(() => {
    if (!selectedSectionId) return;
    const sectionById = new Map(flatSections.map((section) => [section.id, section]));
    setExpanded((current) => {
      const next = { ...current };
      let parentId = sectionById.get(selectedSectionId)?.parentId ?? null;
      let changed = false;
      while (parentId) {
        if (!next[parentId]) {
          next[parentId] = true;
          changed = true;
        }
        parentId = sectionById.get(parentId)?.parentId ?? null;
      }
      return changed ? next : current;
    });
  }, [flatSections, selectedSectionId]);

  useEffect(() => {
    if (!searchOpen) return;
    const frame = window.requestAnimationFrame(() => searchInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [searchOpen]);

  useEffect(() => {
    if (draftParentId === undefined) return;
    setDraftName("");
    const frame = window.requestAnimationFrame(() => draftInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [draftParentId]);

  useEffect(() => {
    if (!renamingSectionId) return;
    const section = flatSections.find((candidate) => candidate.id === renamingSectionId);
    if (!section) return;
    setRenameName(section.name);
    const frame = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [flatSections, renamingSectionId]);

  const cancelDraft = () => {
    onCancelCreateSection();
  };

  const submitDraft = () => {
    const name = draftName.trim();
    if (!name || name.toLocaleLowerCase("ru") === "без названия") {
      cancelDraft();
      return;
    }
    const result = onCreateSection(name, draftParentId ?? null);
    if (result !== true) {
      if (typeof result === "string") draftInputRef.current?.focus();
      return;
    }
  };

  const cancelRename = () => {
    onCancelRenameSection();
  };

  const submitRename = () => {
    if (!renamingSectionId) return;
    const name = renameName.trim();
    if (!name || name.toLocaleLowerCase("ru") === "без названия") {
      cancelRename();
      return;
    }
    const result = onRenameSection(renamingSectionId, name);
    if (result !== true) {
      if (typeof result === "string") renameInputRef.current?.focus();
      return;
    }
  };

  const renderDraftRow = (depth: number) => (
    <div
      data-section-create-draft
      className={cn(
        "flex items-center pl-1.5",
        depth === 0 ? "h-10" : "h-7",
      )}
    >
      {depth === 0 && <span className="mr-1 h-5 w-2.5 shrink-0" />}
      <CatalogTreeThumbnail />
      <CatalogInlineNameEditor
        ref={draftInputRef}
        variant="tree"
        value={draftName}
        ariaLabel="Название раздела"
        onChange={(event) => setDraftName(event.target.value)}
        onCommit={submitDraft}
        onCancel={cancelDraft}
        cancelLabel="Отменить создание раздела"
        commitLabel="Создать раздел"
        placeholder="Название"
        autoFocus
        className="ml-2 flex-1"
        inputClassName="h-full text-[13px] font-normal leading-4 placeholder:text-[#a8a29e]"
      />
    </div>
  );

  const closeSearch = () => {
    setQuery("");
    setSearchOpen(false);
  };

  const openSearch = () => {
    setQuery("");
    setSearchOpen(true);
  };

  const renderSection = (section: CatalogTreeSection, depth = 0): ReactNode => {
    if (normalizedQuery && !visibleIds.has(section.id)) return null;
    const hasChildren = (section.children?.length ?? 0) > 0;
    const isExpanded = normalizedQuery ? true : Boolean(expanded[section.id]);
    const active = sectionEditingEnabled && selectedSectionId === section.id;
    const renaming = renamingSectionId === section.id;
    const isArchived = section.status === "archive";
    const availabilityStatus: CatalogAvailabilityStatusIconState | null = isArchived
      ? "archive"
      : section.availabilityMode === "unavailable"
        ? "stopped"
        : section.availabilityMode === "schedule"
          ? "scheduled"
          : null;
    const sectionItemCount = countBySection.get(section.id) ?? 0;
    const sectionStatusTooltipLabel = availabilityStatus
      ? `${SECTION_STATUS_LABELS[availabilityStatus]} · ${formatPositionsCount(sectionItemCount)}`
      : undefined;
    const hasDirectSubsections = hasChildren;
    const hasDirectPositions = items.some((item) => item.sectionId === section.id && (includeArchived || item.status !== "archive"));
    const reachedMaxDepth = getSectionTreeDepth(section.id, sections) >= MAX_CATALOG_SECTION_DEPTH;
    const allowSubsectionCreation = !isArchived && !reachedMaxDepth && (hasDirectSubsections || !hasDirectPositions);
    const allowPositionCreation = positionCreationEnabled && !isArchived && !hasDirectSubsections;
    const showCaretSlot = depth === 0 || hasChildren;
    const menuOpen = openMenuSectionId === section.id;
    const handleMenuAction = (action: string, anchor?: CatalogSectionActionAnchor, schedule?: WeeklySchedule) => {
      if (action === "Добавить подраздел") {
        setExpanded((current) => ({ ...current, [section.id]: true }));
        onStartCreateSection(section.id);
        return;
      }
      if (action === "Переименовать") {
        onStartRenameSection(section.id);
        return;
      }
      onSectionAction(section, action, anchor, schedule);
    };
    return (
      <SortableSectionNode
        key={section.id}
        id={section.id}
        parentId={section.parentId ?? null}
        disabled={Boolean(normalizedQuery)}
      >
        {({ setNodeRef, dragProps, isDragging, sortableStyle }) => (
          <>
            <div
              ref={setNodeRef}
              {...dragProps}
              data-sortable-section-id={section.id}
              data-tree-section-id={section.id}
              data-archived-section={isArchived || undefined}
              role="button"
              aria-label={`Раздел ${section.name}`}
              title={sectionStatusTooltipLabel}
              tabIndex={0}
              onClick={() => onSelectSection(section.id)}
              onContextMenu={(event) => {
                event.preventDefault();
                event.stopPropagation();
                setOpenMenuSectionId(section.id);
              }}
              onKeyDown={(event) => {
                if (event.target !== event.currentTarget) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  onSelectSection(section.id);
                }
              }}
              className={cn(
                "group relative flex items-center rounded-[8px] text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
                renaming ? (depth === 0 ? "h-10 pl-1.5" : "h-7 pl-1.5") : "h-8 py-1.5",
                !renaming && (active && depth === 0 ? "pl-2 pr-0.5" : "pl-1.5 pr-0.5"),
                active ? "bg-[#f5f5f4]" : "hover:bg-[#f5f5f4]",
                isDragging && "bg-[#f5f5f4] opacity-70 shadow-sm",
              )}
              style={sortableStyle}
            >
              {showCaretSlot && (
                <button
                  type="button"
                  data-no-dnd
                  aria-label={`${isExpanded ? "Свернуть" : "Раскрыть"} раздел ${section.name}`}
                  disabled={!hasChildren}
                  onClick={(event) => {
                    event.stopPropagation();
                    if (hasChildren) setExpanded((current) => ({ ...current, [section.id]: !isExpanded }));
                  }}
                  className={cn("mr-1 flex h-5 w-2.5 shrink-0 items-center justify-center text-[#a6a09b]", !hasChildren && "invisible")}
                >
                  <CaretRight size={10} weight="fill" className={cn("transition-transform", isExpanded && "rotate-90")} />
                </button>
              )}
              <CatalogTreeThumbnail src={section.imageUrl} selected={active} muted={isArchived} />
              {renaming ? (
                <CatalogInlineNameEditor
                  ref={renameInputRef}
                  variant="tree"
                  value={renameName}
                  ariaLabel="Название раздела"
                  onChange={(event) => setRenameName(event.target.value)}
                  onCommit={submitRename}
                  onCancel={cancelRename}
                  cancelLabel="Отменить переименование"
                  commitLabel="Подтвердить переименование"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => event.stopPropagation()}
                  className="ml-2 flex-1"
                  inputClassName="h-full text-[13px] font-normal leading-4"
                />
              ) : (
                <>
                  <span
                    data-section-title
                    className={cn(
                      "ml-2 min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]",
                      isArchived ? "text-[#79716b] opacity-60" : active ? "text-[#292524]" : "text-[#79716b]",
                    )}
                  >
                    {section.name}
                  </span>
                  <span
                    data-catalog-section-right-slots
                    className={cn(
                      CATALOG_SECTION_ACTION_GRID_CLASS,
                      "relative ml-[9px] h-5",
                      isArchived && "opacity-60",
                    )}
                  >
                    <span
                      data-catalog-section-metadata
                      className={cn(
                        CATALOG_SECTION_ACTION_GRID_CLASS,
                        "col-span-2 col-start-1 row-start-1 h-5 transition-opacity group-hover:opacity-0",
                        (menuOpen || focusedActionSectionId === section.id) && "opacity-0",
                      )}
                    >
                      {availabilityStatus && (
                        <CatalogAvailabilityStatusIcon
                          state={availabilityStatus}
                          entity="section"
                          tone="neutral"
                          iconSize={12}
                          className="col-start-2 size-5"
                          tooltipLabel={sectionStatusTooltipLabel}
                          hideWithGroupActions={false}
                        />
                      )}
                      {!availabilityStatus && (
                        <span
                          data-catalog-section-count
                          className="col-span-2 col-start-1 min-w-0 text-right text-[11px] leading-[18px] tabular-nums text-[#78716c]"
                        >
                          {sectionItemCount}
                        </span>
                      )}
                    </span>
                    <div
                      data-catalog-section-hover-actions
                      className={cn(
                        CATALOG_SECTION_ACTION_GRID_CLASS,
                        "pointer-events-none col-span-2 col-start-1 row-start-1 h-5 opacity-0 transition-opacity group-hover:pointer-events-auto group-hover:opacity-100 focus-within:pointer-events-auto focus-within:opacity-100",
                        (menuOpen || focusedActionSectionId === section.id) && "pointer-events-auto opacity-100",
                      )}
                      onFocusCapture={() => setFocusedActionSectionId(section.id)}
                      onBlurCapture={(event) => {
                        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
                          setFocusedActionSectionId((current) => current === section.id ? null : current);
                        }
                      }}
                    >
                      <Tooltip
                        label="Нельзя добавить подраздел: в разделе уже есть позиции"
                        side="top"
                        delayDuration={250}
                        disabled={allowSubsectionCreation}
                      >
                        <span
                          className="flex size-5 shrink-0 items-center justify-center"
                          tabIndex={allowSubsectionCreation ? undefined : 0}
                          aria-label={allowSubsectionCreation ? undefined : "Нельзя добавить подраздел: в разделе уже есть позиции"}
                        >
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            data-no-dnd
                            aria-label={`Добавить подраздел в раздел ${section.name}`}
                            disabled={!allowSubsectionCreation}
                            onClick={(event) => {
                              event.stopPropagation();
                              setExpanded((current) => ({ ...current, [section.id]: true }));
                              onStartCreateSection(section.id);
                            }}
                            className="size-5 rounded-[6px] text-[#78716c] hover:bg-transparent hover:text-[#292524] focus-visible:ring-[#292524]/10 disabled:cursor-not-allowed disabled:text-[#d6d3d1]"
                          >
                            <Plus size={14} weight="regular" aria-hidden="true" />
                          </Button>
                        </span>
                      </Tooltip>
                      <SharedDropdownMenu
                        modal={false}
                        open={menuOpen}
                        onOpenChange={(open) => setOpenMenuSectionId(open ? section.id : null)}
                      >
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            data-no-dnd
                            aria-label={`Действия с разделом ${section.name}`}
                            onClick={(event) => event.stopPropagation()}
                            className="size-5 shrink-0 rounded-[6px] text-[#78716c] hover:bg-transparent hover:text-[#292524] focus-visible:ring-[#292524]/10"
                          >
                            <DotsThreeVertical size={16} weight="regular" aria-hidden="true" />
                          </Button>
                        </DropdownMenuTrigger>
                        <SectionTreeDropdown preventTriggerFocus>
                          {renderSectionActions(
                            section,
                            { allowPositionCreation, allowSubsectionCreation },
                            handleMenuAction,
                          )}
                        </SectionTreeDropdown>
                      </SharedDropdownMenu>
                    </div>
                  </span>
                </>
              )}
            </div>
            {((hasChildren && isExpanded) || draftParentId === section.id)
              && renderSectionList(section.children ?? [], section.id, depth + 1)}
          </>
        )}
      </SortableSectionNode>
    );
  };

  const renderSectionList = (list: CatalogTreeSection[], parentId: string | null, depth: number): ReactNode => {
    const visibleSections = normalizedQuery ? list.filter((section) => visibleIds.has(section.id)) : list;
    return (
      <SortableContext items={visibleSections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
        <div
          data-section-parent-id={parentId ?? "__root__"}
          className={cn(parentId !== null && "py-0.5 pl-5")}
        >
          {draftParentId === parentId && renderDraftRow(depth)}
          {visibleSections.map((section) => renderSection(section, depth))}
        </div>
      </SortableContext>
    );
  };

  const sectionsHeader = (
    <div className="flex h-6 shrink-0 items-center justify-between pl-[14px] pr-2">
      <SharedDropdownMenu modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Настройки разделов"
            className="flex min-w-0 shrink-0 items-center gap-1.5 rounded-[6px] text-[#1c1917] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <span className="truncate text-[13px] font-normal leading-[18px]">Разделы</span>
            <CaretDown size={10} weight="fill" aria-hidden="true" className="shrink-0 text-[#79716b]" />
          </button>
        </DropdownMenuTrigger>
        <SectionTreeDropdown align="start" preventTriggerFocus>
          <div className="p-1">
            <DropdownMenu.CheckboxItem
              checked={showArchived}
              onCheckedChange={(checked) => {
                const nextShowArchived = checked === true;
                setShowArchived(nextShowArchived);
                writeCatalogJson(CATALOG_TREE_SHOW_ARCHIVED_STORAGE_KEY, nextShowArchived);
              }}
              onSelect={(event) => event.preventDefault()}
              className={cn(CATALOG_SECTION_ACTION_ITEM_CLASS, "text-[#44403b]")}
            >
              <span className="flex size-4 shrink-0 items-center justify-center rounded-[4px] border border-[#d6d3d1] bg-white">
                <DropdownMenu.ItemIndicator>
                  <Check size={12} weight="bold" aria-hidden="true" />
                </DropdownMenu.ItemIndicator>
              </span>
              <span className="min-w-0 flex-1 truncate">Показывать архивные</span>
            </DropdownMenu.CheckboxItem>
          </div>
        </SectionTreeDropdown>
      </SharedDropdownMenu>
      <div data-catalog-section-action-grid="header" className={CATALOG_SECTION_ACTION_GRID_CLASS}>
        <Tooltip label="Добавить новый раздел" side="top" delayDuration={250}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            ref={createSectionButtonRef}
            onClick={() => onStartCreateSection(null)}
            aria-label="Добавить раздел"
            className="size-5 shrink-0 rounded-[6px] text-[#79716b] hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:ring-[#292524]/10"
          >
            <Plus size={14} weight="regular" aria-hidden="true" />
          </Button>
        </Tooltip>
        <Tooltip label="Поиск по разделам" side="top" delayDuration={250}>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Открыть поиск разделов"
            onClick={() => {
              if (searchOpen) searchInputRef.current?.focus();
              else openSearch();
            }}
            className={cn(
              "size-5 shrink-0 rounded-[6px] text-[#79716b] hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:ring-[#292524]/10",
              searchOpen && "bg-[#f5f5f4] text-[#292524]",
            )}
          >
            <MagnifyingGlass size={14} weight="regular" aria-hidden="true" />
          </Button>
        </Tooltip>
      </div>
    </div>
  );

  return (
    <aside className="relative flex h-full w-full min-w-0 flex-col overflow-hidden bg-white shadow-[inset_-1px_0_0_#e7e5e4]">
      {secondaryNavigation && (
        <div
          data-secondary-navigation-scope="catalog-sidebar"
          className="shrink-0 border-b border-[#e7e5e4] px-2 py-2"
        >
          {secondaryNavigation}
        </div>
      )}
      <div className="mt-4 flex h-[18px] shrink-0 items-center justify-between pl-[14px] pr-3">
        <div className="min-w-0 flex-1">
          {menuSwitcher ?? <span className="block truncate text-[14px] font-normal leading-[18px] text-[#1c1917]">Меню</span>}
        </div>
        <Tooltip label="Свернуть разделы" side="top" delayDuration={250}>
          <button
            type="button"
            aria-label="Свернуть разделы"
            onClick={onCollapseSections}
            className="flex size-4 shrink-0 items-center justify-center text-[#57534d] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <CaretDoubleLeft size={16} weight="regular" aria-hidden="true" />
          </button>
        </Tooltip>
      </div>

      <div className="mt-2 flex min-h-0 flex-1 flex-col gap-2">
        <div className="h-11 shrink-0 border-b border-[#e7e5e4] pb-3 pl-2 pr-1.5">
          <button
            type="button"
            data-catalog-tree-root
            onClick={onSelectAllPositions}
            className={cn(
              "flex h-8 w-full items-center gap-2 rounded-[8px] p-1.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
              allPositionsSelected ? "bg-[#f5f5f4]" : "hover:bg-[#f5f5f4]",
            )}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-[6px] bg-[#e7e5e4] text-[#57534d]">
              <Asterisk size={14} weight="regular" aria-hidden="true" />
            </span>
            <span className={cn(
              "min-w-0 flex-1 truncate text-[13px] font-medium leading-4",
              allPositionsSelected ? "text-[#292524]" : "text-[#79716b]",
            )}>
              Все позиции
            </span>
            <span className="shrink-0 text-right text-[11px] leading-[18px] tabular-nums text-[#78716c]">{items.length}</span>
          </button>
        </div>

        <div className={cn("flex min-h-0 flex-1 flex-col", searchOpen ? "gap-2" : "gap-1.5")}>
          {searchOpen ? (
            <div className="flex shrink-0 flex-col gap-1 pb-2 shadow-[inset_0_-1px_0_#e7e5e4]">
              {sectionsHeader}
              <div className="flex h-7 items-center gap-1.5 px-3">
                <Input
                  ref={searchInputRef}
                  size="compact"
                  autoFocus
                  value={query}
                  aria-label="Поиск по разделам"
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Escape") closeSearch();
                  }}
                  placeholder="Найти раздел..."
                  className="h-7 min-w-0 flex-1 rounded-[7px] border-[#4f39f6] px-2 py-0.5 text-[13px] leading-4 text-[#1c1917] placeholder:text-[#a8a29e] focus:border-[#4f39f6] focus-visible:ring-0"
                />
                <Tooltip label="Закрыть поиск по разделам" side="top" delayDuration={250}>
                  <button
                    type="button"
                    aria-label="Закрыть поиск разделов"
                    onClick={closeSearch}
                    className="flex size-5 shrink-0 items-center justify-center rounded-[6px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                  >
                    <X size={14} weight="regular" aria-hidden="true" />
                  </button>
                </Tooltip>
              </div>
            </div>
          ) : sectionsHeader}

          <DndContext sensors={dndSensors} collisionDetection={sameParentCollisionDetection} onDragEnd={handleSectionDragEnd}>
            <div ref={treeScrollRef} className="scrollbar-subtle min-h-0 flex-1 overflow-x-hidden overflow-y-auto overscroll-contain px-1.5 pb-3">
              {renderSectionList(visibleSections, null, 0)}
              {normalizedQuery && visibleIds.size === 0 && (
                <p className="px-1.5 text-[13px] font-normal leading-4 text-[#78716c]">Разделы не найдены</p>
              )}
            </div>
          </DndContext>
        </div>
      </div>
    </aside>
  );
}
