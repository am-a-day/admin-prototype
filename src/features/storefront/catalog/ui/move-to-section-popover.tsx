import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CaretRight, CircleNotch, List, MagnifyingGlass } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  buildCatalogTree as buildLocalSectionTree,
  flattenCatalogTree as flattenSections,
  getSectionSubtreeIds,
  getSectionTreeDepth,
  MAX_CATALOG_SECTION_DEPTH,
  type CatalogTreeSection,
} from "../model/tree";
import type { MovePopoverAnchor } from "./move-anchor";

type TreeSection = CatalogTreeSection;
export type MoveOperation = "position" | "section" | "bulk";

export type MoveToSectionPopoverProps = {
  operation: MoveOperation;
  entityIds: string[];
  currentSectionIds: string[];
  movingSectionId?: string;
  sections: TreeSection[];
  forbiddenTargets?: Record<string, string>;
  anchor: MovePopoverAnchor;
  onClose: () => void;
  onMove: (targetSectionId: string | null) => Promise<void> | void;
  onSuccess?: (targetSectionId: string | null) => void;
  onError?: () => void;
};

export function MoveToSectionPopover({
  operation,
  currentSectionIds,
  movingSectionId,
  sections,
  forbiddenTargets = {},
  anchor,
  onClose,
  onMove,
  onSuccess,
  onError,
}: MoveToSectionPopoverProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [loadingTarget, setLoadingTarget] = useState<string | null | undefined>(undefined);
  const flatSections = useMemo(() => flattenSections(buildLocalSectionTree(sections)), [sections]);
  const sectionById = useMemo(() => new Map(flatSections.map((section) => [section.id, section])), [flatSections]);
  const childIdsByParent = useMemo(() => {
    const result = new Map<string | null, string[]>();
    flatSections.forEach((section) => {
      const parentId = section.parentId ?? null;
      result.set(parentId, [...(result.get(parentId) ?? []), section.id]);
    });
    return result;
  }, [flatSections]);
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set(flatSections.map((section) => section.id)));
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const uniqueCurrentSectionIds = useMemo(() => [...new Set(currentSectionIds)], [currentSectionIds]);
  const showCurrentLabel = operation !== "bulk" || uniqueCurrentSectionIds.length === 1;
  const movingSubtreeIds = useMemo(
    () => movingSectionId ? getSectionSubtreeIds(movingSectionId, flatSections) : new Set<string>(),
    [flatSections, movingSectionId],
  );
  const movingSubtreeHeight = useMemo(() => {
    if (!movingSectionId) return 0;
    const baseDepth = getSectionTreeDepth(movingSectionId, flatSections);
    return Math.max(
      0,
      ...flatSections
        .filter((section) => movingSubtreeIds.has(section.id))
        .map((section) => getSectionTreeDepth(section.id, flatSections) - baseDepth),
    );
  }, [flatSections, movingSectionId, movingSubtreeIds]);

  const pathFor = useCallback((section: TreeSection) => {
    const names: string[] = [section.name];
    const seen = new Set<string>([section.id]);
    let parentId = section.parentId ?? null;
    while (parentId && !seen.has(parentId)) {
      seen.add(parentId);
      const parent = sectionById.get(parentId);
      if (!parent) break;
      names.unshift(parent.name);
      parentId = parent.parentId ?? null;
    }
    return ["Каталог", ...names].join(" / ");
  }, [sectionById]);

  const disabledReasonFor = useCallback((section: TreeSection): string | null => {
    if (operation === "section") {
      if (section.id === movingSectionId) return "Нельзя переместить раздел внутрь самого себя";
      if (movingSubtreeIds.has(section.id)) return "Нельзя переместить раздел в его подраздел";
      if (uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === section.id) return "Текущее расположение";
      if (getSectionTreeDepth(section.id, flatSections) + 1 + movingSubtreeHeight > MAX_CATALOG_SECTION_DEPTH) {
        return "Достигнута максимальная глубина";
      }
      if (forbiddenTargets[section.id]) return forbiddenTargets[section.id];
      if (section.status === "archive") return "Архивный раздел нельзя выбрать";
      return null;
    }
    if (forbiddenTargets[section.id]) return forbiddenTargets[section.id];
    if (section.status === "archive") return "Архивный раздел нельзя выбрать";
    if (showCurrentLabel && uniqueCurrentSectionIds[0] === section.id) return "Текущее расположение";
    if ((childIdsByParent.get(section.id)?.length ?? 0) > 0) return "В разделе уже есть подразделы";
    return null;
  }, [childIdsByParent, flatSections, forbiddenTargets, movingSectionId, movingSubtreeHeight, movingSubtreeIds, operation, showCurrentLabel, uniqueCurrentSectionIds]);

  const rootDisabledReason = operation === "section" && uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === "__root__"
    ? "Текущее расположение"
    : forbiddenTargets.__root__ ?? null;

  const searchResults = useMemo(() => normalizedQuery
    ? flatSections.filter((section) => pathFor(section).toLocaleLowerCase("ru").includes(normalizedQuery))
    : [], [flatSections, normalizedQuery, pathFor]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    const handlePointerDown = (event: PointerEvent) => {
      if (loadingTarget !== undefined) return;
      if (!panelRef.current?.contains(event.target as Node)) onClose();
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || loadingTarget !== undefined) return;
      event.preventDefault();
      onClose();
    };
    document.addEventListener("pointerdown", handlePointerDown, true);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", handlePointerDown, true);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [loadingTarget, onClose]);

  const chooseTarget = async (targetSectionId: string | null, disabledReason: string | null) => {
    if (disabledReason || loadingTarget !== undefined) return;
    setLoadingTarget(targetSectionId);
    try {
      await Promise.resolve(onMove(targetSectionId));
      onSuccess?.(targetSectionId);
      onClose();
    } catch {
      setLoadingTarget(undefined);
      onError?.();
    }
  };

  const renderRow = (section: TreeSection, depth: number, searchMode: boolean) => {
    const childIds = childIdsByParent.get(section.id) ?? [];
    const hasChildren = childIds.length > 0;
    const disabledReason = disabledReasonFor(section);
    const current = showCurrentLabel && uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === section.id;
    const loading = loadingTarget === section.id;
    return (
      <Fragment key={section.id}>
        <Tooltip label={disabledReason ?? ""} side="left" disabled={!disabledReason} delayDuration={180}>
          <span className="block">
            <button
              type="button"
              disabled={Boolean(disabledReason) || loadingTarget !== undefined}
              onClick={() => void chooseTarget(section.id, disabledReason)}
              className={cn(
                "group flex h-8 w-full items-center gap-1.5 rounded-[6px] pr-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                disabledReason ? "cursor-not-allowed text-[#a8a29e]" : "text-[#44403b] hover:bg-[#f5f5f4]",
              )}
              style={{ paddingLeft: searchMode ? 8 : 8 + depth * 14 }}
            >
              <span
                role={hasChildren && !searchMode ? "button" : undefined}
                tabIndex={hasChildren && !searchMode ? 0 : -1}
                onClick={(event) => {
                  if (!hasChildren || searchMode) return;
                  event.preventDefault();
                  event.stopPropagation();
                  setExpanded((currentExpanded) => {
                    const next = new Set(currentExpanded);
                    if (next.has(section.id)) next.delete(section.id);
                    else next.add(section.id);
                    return next;
                  });
                }}
                className="flex h-5 w-4 shrink-0 items-center justify-center rounded-[4px]"
              >
                {hasChildren && !searchMode ? (
                  <CaretRight size={11} weight="bold" className={cn("transition-transform", expanded.has(section.id) && "rotate-90")} />
                ) : <span className="w-[11px]" />}
              </span>
              <span className={cn("flex h-5 w-5 shrink-0 items-center justify-center overflow-hidden rounded-[5px]", disabledReason ? "bg-[#f1f1ea]" : "bg-[#e6e6db]") }>
                {section.imageUrl ? <img src={section.imageUrl} alt="" className="h-full w-full object-cover" /> : <List size={12} />}
              </span>
              <span className="min-w-0 flex-1 truncate text-[13px] leading-4">{section.name}</span>
              {searchMode && (
                <span className="min-w-0 max-w-[180px] truncate text-[10px] font-normal text-[#a8a29e]">{pathFor(section)}</span>
              )}
              {current && <span className="shrink-0 rounded-[4px] bg-[#f1f1ea] px-1.5 text-[10px] font-medium leading-4 text-[#79716b]">Текущий</span>}
              {loading && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
            </button>
          </span>
        </Tooltip>
        {!searchMode && hasChildren && expanded.has(section.id) && childIds.map((childId) => {
          const child = sectionById.get(childId);
          return child ? renderRow(child, depth + 1, false) : null;
        })}
      </Fragment>
    );
  };

  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const panelWidth = Math.min(380, viewportWidth - 24);
  const left = Math.max(12, Math.min(anchor.left, viewportWidth - panelWidth - 12));
  const preferredTop = anchor.bottom + 6;
  const top = Math.max(12, Math.min(preferredTop, viewportHeight - 480));

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={operation === "section" ? "Переместить раздел" : "Переместить в раздел"}
      className="fixed z-[100005] flex max-h-[468px] flex-col overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white p-1.5 shadow-[0_18px_48px_rgba(41,37,36,0.18)]"
      style={{ width: panelWidth, left, top }}
    >
      <div className="sticky top-0 z-10 bg-white pb-1.5">
        <label className="flex h-8 items-center gap-2 rounded-[7px] bg-[#f5f5f4] px-2.5 ring-1 ring-inset ring-[#eceae7] focus-within:bg-white focus-within:ring-[#a8a29e]">
          <MagnifyingGlass size={14} className="shrink-0 text-[#79716b]" />
          <input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder={operation === "section" ? "Переместить раздел…" : "Переместить в раздел…"}
            className="min-w-0 flex-1 bg-transparent text-[13px] leading-5 text-[#292524] outline-none placeholder:text-[#a8a29e]"
          />
          {loadingTarget !== undefined && <CircleNotch size={13} weight="bold" className="animate-spin text-[#79716b]" />}
        </label>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain py-0.5 [scrollbar-width:thin]">
        {operation === "section" && !normalizedQuery && (
          <Tooltip label={rootDisabledReason ?? ""} side="left" disabled={!rootDisabledReason} delayDuration={180}>
            <span className="block">
              <button
                type="button"
                disabled={Boolean(rootDisabledReason) || loadingTarget !== undefined}
                onClick={() => void chooseTarget(null, rootDisabledReason)}
                className={cn(
                  "flex h-8 w-full items-center gap-1.5 rounded-[6px] px-2 text-left text-[13px] outline-none transition focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                  rootDisabledReason ? "cursor-not-allowed text-[#a8a29e]" : "text-[#44403b] hover:bg-[#f5f5f4]",
                )}
              >
                <span className="w-4 shrink-0" />
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-[5px] bg-[#e6e6db]"><List size={12} /></span>
                <span className="min-w-0 flex-1 truncate">В корень каталога</span>
                {rootDisabledReason === "Текущее расположение" && <span className="shrink-0 rounded-[4px] bg-[#f1f1ea] px-1.5 text-[10px] font-medium leading-4 text-[#79716b]">Текущий</span>}
                {loadingTarget === null && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
              </button>
            </span>
          </Tooltip>
        )}
        {normalizedQuery
          ? searchResults.map((section) => renderRow(section, 0, true))
          : (childIdsByParent.get(null) ?? []).map((sectionId) => {
              const root = sectionById.get(sectionId);
              return root ? renderRow(root, 0, false) : null;
            })}
        {normalizedQuery && searchResults.length === 0 && (
          <div className="flex h-20 items-center justify-center px-3 text-[13px] text-[#79716b]">Разделы не найдены</div>
        )}
      </div>
    </div>,
    document.body,
  );
}
