import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CircleNotch, MagnifyingGlass } from "@phosphor-icons/react";
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

const MOVE_SEARCH_THRESHOLD = 10;

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
    return names.join(" / ");
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
  const visibleSections = normalizedQuery
    ? flatSections.filter((section) => pathFor(section).toLocaleLowerCase("ru").includes(normalizedQuery))
    : flatSections;
  const showSearch = flatSections.length > MOVE_SEARCH_THRESHOLD;

  useEffect(() => {
    if (!showSearch) return;
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [showSearch]);

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

  const renderTarget = (section: TreeSection) => {
    const disabledReason = disabledReasonFor(section);
    const current = showCurrentLabel && uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === section.id;
    const loading = loadingTarget === section.id;
    return (
      <Tooltip key={section.id} label={disabledReason ?? ""} side="left" disabled={!disabledReason} delayDuration={180}>
        <span className="block">
          <button
            type="button"
            aria-label={section.name}
            disabled={Boolean(disabledReason) || loadingTarget !== undefined}
            onClick={() => void chooseTarget(section.id, disabledReason)}
            className={cn(
              "flex min-h-8 w-full items-center gap-2 rounded-[7px] px-2 py-1 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#292524]/10",
              disabledReason ? "cursor-not-allowed text-[#a8a29e]" : "text-[#44403b] hover:bg-[#f5f5f4]",
            )}
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] leading-4">{section.name}</span>
              {section.parentId && <span className="mt-0.5 block truncate text-[10px] leading-3 text-[#a8a29e]">{pathFor(section)}</span>}
            </span>
            {current && <span className="shrink-0 rounded-[4px] bg-[#f1f1ea] px-1.5 text-[10px] font-medium leading-4 text-[#79716b]">Текущий</span>}
            {loading && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
          </button>
        </span>
      </Tooltip>
    );
  };

  return (
    <DropdownMenu.Root
      open
      modal={false}
      onOpenChange={() => {}}
    >
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none fixed opacity-0"
          style={{
            left: anchor.left,
            top: anchor.top,
            width: Math.max(1, anchor.right - anchor.left),
            height: Math.max(1, anchor.bottom - anchor.top),
          }}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          side="bottom"
          sideOffset={6}
          collisionPadding={12}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (loadingTarget !== undefined) event.preventDefault();
            else onClose();
          }}
          onPointerDownOutside={(event) => {
            if (loadingTarget !== undefined) event.preventDefault();
            else onClose();
          }}
          className="z-[100005] bg-transparent p-0 outline-none"
        >
          <div
            role="dialog"
            aria-label={operation === "section" ? "Переместить раздел" : "Переместить в раздел"}
            className="flex w-[300px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[11px] border border-[#e7e5e4] bg-white p-1.5 shadow-[0_14px_36px_rgba(41,37,36,0.16)]"
          >
          {showSearch && (
            <label className="mb-1.5 flex h-8 items-center gap-2 rounded-[7px] bg-[#f5f5f4] px-2.5 ring-1 ring-inset ring-[#eceae7] focus-within:bg-white focus-within:ring-[#a8a29e]">
              <MagnifyingGlass size={14} className="shrink-0 text-[#79716b]" />
              <input
                ref={searchRef}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder="Найти раздел"
                className="min-w-0 flex-1 bg-transparent text-[13px] leading-5 text-[#292524] outline-none placeholder:text-[#a8a29e]"
              />
            </label>
          )}
          <div className="max-h-[340px] overflow-y-auto overscroll-contain [scrollbar-width:thin]">
            {operation === "section" && !normalizedQuery && (
              <Tooltip label={rootDisabledReason ?? ""} side="left" disabled={!rootDisabledReason} delayDuration={180}>
                <span className="block">
                  <button
                    type="button"
                    disabled={Boolean(rootDisabledReason) || loadingTarget !== undefined}
                    onClick={() => void chooseTarget(null, rootDisabledReason)}
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded-[7px] px-2 text-left text-[13px] outline-none transition focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                      rootDisabledReason ? "cursor-not-allowed text-[#a8a29e]" : "text-[#44403b] hover:bg-[#f5f5f4]",
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">В корень каталога</span>
                    {rootDisabledReason === "Текущее расположение" && <span className="shrink-0 rounded-[4px] bg-[#f1f1ea] px-1.5 text-[10px] font-medium leading-4 text-[#79716b]">Текущий</span>}
                    {loadingTarget === null && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
                  </button>
                </span>
              </Tooltip>
            )}
            {visibleSections.map(renderTarget)}
            {visibleSections.length === 0 && (
              <div className="flex h-16 items-center justify-center px-3 text-[13px] text-[#79716b]">Разделы не найдены</div>
            )}
          </div>
          {loadingTarget !== undefined && (
            <span className="sr-only" role="status">Перемещение выполняется</span>
          )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
