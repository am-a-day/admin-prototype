import { useEffect, useMemo, useRef, useState, type ReactNode, type RefObject } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Asterisk, CaretRight, DotsThreeVertical, MagnifyingGlass, PlusCircle, X } from "@phosphor-icons/react";
import type { CatalogItem } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { Tooltip } from "@/components/ui/tooltip";
import type { WeeklySchedule } from "../ui/catalog-schedule-editor";
import {
  countItemsBySection,
  findSectionPath,
  flattenCatalogTree,
  getParentAvailability,
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
  subsectionDisabledReason: string | null;
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
  onCreateSection: () => void;
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
};

function SectionTreeDropdown({ children }: { children: ReactNode }) {
  return (
    <DropdownMenu.Portal>
      <DropdownMenu.Content
        align="end"
        sideOffset={6}
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
  onCreateSection,
  createSectionButtonRef,
  onSectionAction,
  renderSectionActions,
  getSectionPath,
  positionCreationEnabled = true,
  menuSwitcher,
}: UnifiedCatalogTreePanelProps) {
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const [expanded, setExpanded] = useState<Record<string, boolean>>(() => {
    const root = sections[0]?.id;
    return root ? { [root]: true } : {};
  });
  const treeScrollRef = useRef<HTMLDivElement | null>(null);
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const flatSections = flattenCatalogTree(sections);
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

  const renderSection = (section: CatalogTreeSection, depth = 0): ReactNode => {
    if (normalizedQuery && !visibleIds.has(section.id)) return null;
    const hasChildren = (section.children?.length ?? 0) > 0;
    const isExpanded = normalizedQuery ? true : Boolean(expanded[section.id]);
    const active = sectionEditingEnabled && selectedSectionId === section.id;
    const isArchived = section.status === "archive";
    const parentAvailability = getParentAvailability(section, items, flatSections);
    const subsectionDisabledReason = parentAvailability.available ? null : parentAvailability.label;
    return (
      <div key={section.id}>
        <div
          data-tree-section-id={section.id}
          role="button"
          tabIndex={0}
          onClick={() => onSelectSection(section.id)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelectSection(section.id);
            }
          }}
          className={cn(
            "group flex min-h-8 items-center rounded-[8px] px-1.5 py-1 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10",
            active ? "bg-[#f3f3ed]" : "hover:bg-[#f3f3ed]",
          )}
          style={{ paddingLeft: 8 + depth * 18 }}
        >
          <button
            type="button"
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
          <span className={cn("ml-2 min-w-0 flex-1 truncate text-[13px] font-medium leading-[18px]", active ? "text-[#292524]" : isArchived ? "text-[#a8a29e]" : "text-[#79716b]")}>{section.name}</span>
          {isArchived && <span className="mr-1 shrink-0 text-[10px] text-[#a8a29e]">В архиве</span>}
          <span className="relative ml-1 flex h-5 min-w-5 shrink-0 items-center justify-end">
            <span className="text-[11px] tabular-nums text-[#a8a29e] transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
              {countBySection.get(section.id) ?? 0}
            </span>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button
                  type="button"
                  aria-label={`Действия с разделом ${section.name}`}
                  onClick={(event) => event.stopPropagation()}
                  className="absolute inset-0 flex h-5 w-5 items-center justify-center rounded-[5px] text-[#79716b] opacity-0 transition hover:bg-[#e6e6db] hover:text-[#292524] group-hover:opacity-100 group-focus-within:opacity-100 focus-visible:opacity-100 focus-visible:outline-none"
                >
                  <DotsThreeVertical size={13} weight="bold" />
                </button>
              </DropdownMenu.Trigger>
              <SectionTreeDropdown>
                {renderSectionActions(
                  section,
                  { allowPositionCreation: positionCreationEnabled && !hasChildren, subsectionDisabledReason },
                  (action, anchor, schedule) => onSectionAction(section, action, anchor, schedule),
                )}
              </SectionTreeDropdown>
            </DropdownMenu.Root>
          </span>
        </div>
        {hasChildren && isExpanded && <div className="space-y-0.5">{section.children?.map((child) => renderSection(child, depth + 1))}</div>}
      </div>
    );
  };

  return (
    <aside className="relative flex w-[250px] max-w-[250px] shrink-0 flex-col overflow-hidden border-r border-[#e7e5e4] bg-white pt-3">
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
        <div className="flex h-8 items-center gap-1">
          <span className="min-w-0 flex-1 px-2 text-[13px] font-medium leading-[18px] text-[#79716b]">Разделы</span>
          <Tooltip label="Поиск по разделам" side="top" delayDuration={250}>
            <button
              type="button"
              aria-label="Открыть поиск разделов"
              onClick={() => setSearchOpen(true)}
              className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] transition hover:bg-[#f3f3ed] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10", searchOpen && "bg-[#f3f3ed] text-[#292524]")}
            >
              <MagnifyingGlass size={16} weight="regular" />
            </button>
          </Tooltip>
          <Tooltip label="Добавить новый раздел" side="top" delayDuration={250}>
            <button
              type="button"
              ref={createSectionButtonRef}
              onClick={onCreateSection}
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
                if (event.key === "Escape" && !query) setSearchOpen(false);
              }}
              placeholder="Поиск по разделам"
              className="min-w-0 flex-1 bg-transparent text-[13px] leading-4 text-[#79716b] outline-none placeholder:text-[#79716b]"
            />
            {query && (
              <button type="button" aria-label="Очистить поиск" onClick={() => setQuery("")} className="flex h-5 w-5 items-center justify-center rounded-[5px] hover:bg-white">
                <X size={13} />
              </button>
            )}
          </label>
        )}
      </div>
      <div ref={treeScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[6px] pb-3 pt-2">
        <div className="space-y-0.5">{sections.map((section) => renderSection(section, 0))}</div>
        {normalizedQuery && visibleIds.size === 0 && <p className="px-2 py-4 text-[13px] leading-5 text-[#79716b]">Разделы не найдены</p>}
      </div>
    </aside>
  );
}
