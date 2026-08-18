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
import { Asterisk, CaretRight, DotsThreeVertical, MagnifyingGlass, PlusCircle, X } from "@phosphor-icons/react";
import type { CatalogItem } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import { SectionDraftConfirmButton } from "../ui/section-draft-confirm";
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
}: {
  src?: string | null;
  selected?: boolean;
}) {
  return (
    <span
      className={cn(
        "relative flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[5.263px] bg-[#e6e6db]",
        selected && "border-[0.5px] border-[#4f39f6] bg-white p-px",
      )}
    >
      {src && <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />}
    </span>
  );
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
  getSectionPath: (id: string) => string;
  positionCreationEnabled?: boolean;
  menuSwitcher?: ReactNode;
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
}: {
  children: ReactNode;
  preventTriggerFocus?: boolean;
}) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={6}
        onCloseAutoFocus={preventTriggerFocus ? (event) => event.preventDefault() : undefined}
        className="z-[100002] min-w-[190px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
      >
        {children}
      </DropdownMenu.Content>
    </DropdownMenu.Portal>
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
  getSectionPath,
  positionCreationEnabled = true,
  menuSwitcher,
  onReorderSections,
}: UnifiedCatalogTreePanelProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const searchControlRef = useRef<HTMLDivElement | null>(null);
  const draftInputRef = useRef<HTMLInputElement | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftClosing, setDraftClosing] = useState(false);
  const renameInputRef = useRef<HTMLInputElement | null>(null);
  const [renameName, setRenameName] = useState("");
  const [renameClosing, setRenameClosing] = useState(false);
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
  const flatSections = useMemo(() => flattenCatalogTree(sections), [sections]);
  const visibleIds = useMemo(() => {
    if (!normalizedQuery) return new Set(flatSections.map((section) => section.id));
    return new Set(flatSections
      .filter((section) => getSectionPath(section.id).toLocaleLowerCase("ru").includes(normalizedQuery))
      .flatMap((section) => [section.id, ...findSectionPath(sections, section.id)]));
  }, [flatSections, getSectionPath, normalizedQuery, sections]);
  const countBySection = useMemo(
    () => countItemsBySection(items, sections, includeArchived),
    [includeArchived, items, sections],
  );

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
    setDraftClosing(false);
    const frame = window.requestAnimationFrame(() => draftInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [draftParentId]);

  useEffect(() => {
    if (!renamingSectionId) return;
    const section = flatSections.find((candidate) => candidate.id === renamingSectionId);
    if (!section) return;
    setRenameName(section.name);
    setRenameClosing(false);
    const frame = window.requestAnimationFrame(() => {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [flatSections, renamingSectionId]);

  const cancelDraft = () => {
    setDraftClosing(true);
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
    setDraftClosing(true);
  };

  const cancelRename = () => {
    setRenameClosing(true);
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
    setRenameClosing(true);
  };

  const renderDraftRow = (depth: number) => (
    <div
      data-section-create-draft
      className="flex min-h-8 items-center rounded-[8px] px-1.5 py-1"
      style={{ paddingLeft: 8 + depth * 18 }}
    >
      <span className="mr-1 h-5 w-5 shrink-0" />
      <CatalogTreeThumbnail />
      <div className="relative ml-2 min-w-0 flex-1">
        <input
          ref={draftInputRef}
          value={draftName}
          aria-label="Название раздела"
          onChange={(event) => setDraftName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              submitDraft();
            }
            if (event.key === "Escape") {
              event.preventDefault();
              cancelDraft();
            }
          }}
          onBlur={() => {
            if (!draftClosing) submitDraft();
          }}
          placeholder="Название раздела"
          className="min-w-0 w-full bg-transparent pr-7 text-[13px] font-medium leading-[18px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
        />
        <SectionDraftConfirmButton onCommit={submitDraft} />
      </div>
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

  useEffect(() => {
    if (!searchOpen || query.trim()) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (searchControlRef.current?.contains(event.target as Node)) return;
      closeSearch();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [query, searchOpen]);

  const renderSection = (section: CatalogTreeSection, depth = 0): ReactNode => {
    if (normalizedQuery && !visibleIds.has(section.id)) return null;
    const hasChildren = (section.children?.length ?? 0) > 0;
    const isExpanded = normalizedQuery ? true : Boolean(expanded[section.id]);
    const active = sectionEditingEnabled && selectedSectionId === section.id;
    const isArchived = section.status === "archive";
    const hasDirectSubsections = hasChildren;
    const hasDirectPositions = items.some((item) => item.sectionId === section.id && (includeArchived || item.status !== "archive"));
    const reachedMaxDepth = getSectionTreeDepth(section.id, sections) >= MAX_CATALOG_SECTION_DEPTH;
    const allowSubsectionCreation = !isArchived && !reachedMaxDepth && (hasDirectSubsections || !hasDirectPositions);
    const allowPositionCreation = positionCreationEnabled && !isArchived && !hasDirectSubsections;
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
          role="button"
          aria-label={`Раздел ${section.name}`}
          tabIndex={0}
          onClick={() => onSelectSection(section.id)}
          onKeyDown={(event) => {
            if (event.target !== event.currentTarget) return;
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectSection(section.id);
            }
          }}
          className={cn(
            "group flex min-h-8 items-center rounded-[8px] px-1.5 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
            active ? "bg-[#f3f3ed]" : "hover:bg-[#f3f3ed]",
            isDragging && "bg-[#f3f3ed] opacity-70 shadow-sm",
          )}
          style={{ ...sortableStyle, paddingLeft: 8 + depth * 18 }}
        >
          <button
            type="button"
            data-no-dnd
            aria-label={`${isExpanded ? "Свернуть" : "Раскрыть"} раздел ${section.name}`}
            disabled={!hasChildren}
            onClick={(event) => {
              event.stopPropagation();
              if (hasChildren) setExpanded((current) => ({ ...current, [section.id]: !isExpanded }));
            }}
            className={cn("mr-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] text-[#a6a09b]", !hasChildren && "invisible")}
          >
            <CaretRight size={11} weight="fill" className={cn(isExpanded && "rotate-90")} />
          </button>
          <CatalogTreeThumbnail src={section.imageUrl} selected={active} />
          {renamingSectionId === section.id ? (
            <input
              ref={renameInputRef}
              data-no-dnd
              value={renameName}
              aria-label="Название раздела"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => setRenameName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  submitRename();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  cancelRename();
                }
              }}
              onBlur={() => {
                if (!renameClosing) submitRename();
              }}
              className="ml-2 min-w-0 flex-1 bg-transparent text-[13px] font-medium leading-[18px] text-[#292524] outline-none"
            />
          ) : (
            <span className={cn("ml-2 min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]", active ? "text-[#292524]" : isArchived ? "text-[#a8a29e]" : "text-[#79716b]")}>{section.name}</span>
          )}
          {isArchived && <span className="mr-1 shrink-0 text-[10px] text-[#a8a29e]">В архиве</span>}
          <span className="relative ml-1 flex h-5 min-w-5 shrink-0 items-center justify-end">
            <span className="text-[11px] tabular-nums text-[#a8a29e] transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
              {countBySection.get(section.id) ?? 0}
            </span>
            {allowSubsectionCreation && (
              <button
                type="button"
                data-no-dnd
                aria-label={`Добавить подраздел в раздел ${section.name}`}
                onClick={(event) => {
                  event.stopPropagation();
                  setExpanded((current) => ({ ...current, [section.id]: true }));
                  onStartCreateSection(section.id);
                }}
                className="absolute right-5 flex h-5 w-5 items-center justify-center rounded-[5px] text-[#79716b] opacity-0 transition hover:bg-[#e6e6db] hover:text-[#292524] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
              >
                <PlusCircle size={14} weight="regular" />
              </button>
            )}
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  data-no-dnd
                  aria-label={`Действия с разделом ${section.name}`}
                  onClick={(event) => event.stopPropagation()}
                  className="absolute inset-0 flex h-5 w-5 items-center justify-center rounded-[5px] text-[#79716b] opacity-0 transition hover:bg-[#e6e6db] hover:text-[#292524] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                >
                  <DotsThreeVertical size={13} weight="bold" />
                </button>
              </DropdownMenu.Trigger>
              <SectionTreeDropdown preventTriggerFocus>
                {renderSectionActions(
                  section,
                  { allowPositionCreation, allowSubsectionCreation },
                  (action, anchor, schedule) => {
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
                  },
                )}
              </SectionTreeDropdown>
            </DropdownMenu.Root>
          </span>
        </div>
        {(hasChildren && isExpanded || draftParentId === section.id) && renderSectionList(section.children ?? [], section.id, depth + 1)}
          </>
        )}
      </SortableSectionNode>
    );
  };

  const renderSectionList = (list: CatalogTreeSection[], parentId: string | null, depth: number): ReactNode => {
    const visibleSections = normalizedQuery ? list.filter((section) => visibleIds.has(section.id)) : list;
    return (
      <SortableContext items={visibleSections.map((section) => section.id)} strategy={verticalListSortingStrategy}>
        <div data-section-parent-id={parentId ?? "__root__"} className="space-y-0.5">
          {draftParentId === parentId && renderDraftRow(depth)}
          {visibleSections.map((section) => renderSection(section, depth))}
        </div>
      </SortableContext>
    );
  };

  return (
    <aside className="relative flex h-full w-full min-w-0 flex-col overflow-hidden border-r border-[#e7e5e4] bg-white pt-3">
      <div className="shrink-0 border-b border-[#e7e5e4] px-3 pb-3">
        <div className="min-w-0">{menuSwitcher ?? <span className="inline-flex h-8 items-center px-2 text-[14px] text-[#292524]">Основное меню</span>}</div>
        <button
          type="button"
          data-catalog-tree-root
          onClick={onSelectAllPositions}
          className={cn(
            "mt-2 flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
            allPositionsSelected ? "bg-[#f3f3ed]" : "hover:bg-[#f3f3ed]",
          )}
        >
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5.263px] bg-[#e6e6db] text-[#57534d]"><Asterisk size={13} weight="bold" /></span>
          <span className={cn("min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]", allPositionsSelected ? "text-[#292524]" : "text-[#79716b]")}>Все позиции</span>
          <span className="min-w-4 shrink-0 text-right text-[12px] tabular-nums text-[#a6a09b]">{items.length}</span>
        </button>
      </div>
      <div className="shrink-0 px-3 pt-3">
        <div ref={searchControlRef}>
          <div className="flex h-8 items-center gap-1">
            <span className="min-w-0 flex-1 px-2 text-[13px] font-medium leading-[18px] text-[#79716b]">Разделы</span>
            <Tooltip label={searchOpen ? "Закрыть поиск по разделам" : "Поиск по разделам"} side="top" delayDuration={250}>
              <button
                type="button"
                aria-label={searchOpen ? "Закрыть поиск разделов" : "Открыть поиск разделов"}
                onClick={searchOpen ? closeSearch : openSearch}
                className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] transition hover:bg-[#f3f3ed] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10", searchOpen && "bg-[#f3f3ed] text-[#292524]")}
              >
                {searchOpen ? <X size={16} weight="regular" /> : <MagnifyingGlass size={16} weight="regular" />}
              </button>
            </Tooltip>
            <Tooltip label="Добавить новый раздел" side="top" delayDuration={250}>
              <button
                type="button"
                ref={createSectionButtonRef}
                onClick={() => onStartCreateSection(null)}
                aria-label="Добавить раздел"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] transition hover:bg-[#f3f3ed] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
              >
                <PlusCircle size={16} weight="regular" />
              </button>
            </Tooltip>
          </div>
          {searchOpen && (
            <label className="mt-1 flex h-8 w-full items-center gap-1.5 rounded-[8px] bg-[rgba(241,241,234,0.69)] px-[7px] py-1.5 text-[#79716b] focus-within:ring-2 focus-within:ring-[#292524]/10">
              <MagnifyingGlass size={14} />
              <input
                ref={searchInputRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeSearch();
                }}
                placeholder="Поиск по разделам"
                className="min-w-0 flex-1 bg-transparent text-[13px] leading-4 text-[#79716b] outline-none placeholder:text-[#79716b]"
              />
            </label>
          )}
        </div>
      </div>
      <DndContext sensors={dndSensors} collisionDetection={sameParentCollisionDetection} onDragEnd={handleSectionDragEnd}>
        <div ref={treeScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[6px] pb-3 pt-2">
          {renderSectionList(sections, null, 0)}
          {normalizedQuery && visibleIds.size === 0 && <p className="px-2 py-4 text-[13px] leading-5 text-[#79716b]">Разделы не найдены</p>}
        </div>
      </DndContext>
    </aside>
  );
}
