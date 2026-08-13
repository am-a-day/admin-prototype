import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CircleNotch, MagnifyingGlass } from "@phosphor-icons/react";
import { CatalogThumbnail } from "./catalog-thumbnail";
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
export type MoveOperation = "position" | "section" | "sections" | "bulk";

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
  entityIds,
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
  const movingSubtreeIds = useMemo(
    () => {
      const ids = new Set<string>();
      if (movingSectionId) getSectionSubtreeIds(movingSectionId, flatSections).forEach((id) => ids.add(id));
      if (operation === "sections") {
        entityIds.forEach((id) => getSectionSubtreeIds(id, flatSections).forEach((subtreeId) => ids.add(subtreeId)));
      }
      return ids;
    },
    [entityIds, flatSections, movingSectionId, operation],
  );
  const movingSubtreeHeight = useMemo(() => {
    const movingIds = movingSectionId ? [movingSectionId] : operation === "sections" ? entityIds : [];
    if (movingIds.length === 0) return 0;
    return Math.max(0, ...movingIds.map((id) => {
      const baseDepth = getSectionTreeDepth(id, flatSections);
      return Math.max(
        0,
        ...flatSections
          .filter((section) => getSectionSubtreeIds(id, flatSections).has(section.id))
          .map((section) => getSectionTreeDepth(section.id, flatSections) - baseDepth),
      );
    }));
  }, [entityIds, flatSections, movingSectionId, operation]);

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
    if (operation === "section" || operation === "sections") {
      if (section.id === movingSectionId || entityIds.includes(section.id)) return "Нельзя переместить раздел внутрь самого себя";
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
    if (uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === section.id) return "Текущее расположение";
    if ((childIdsByParent.get(section.id)?.length ?? 0) > 0) return "В разделе уже есть подразделы";
    return null;
  }, [childIdsByParent, entityIds, flatSections, forbiddenTargets, movingSectionId, movingSubtreeHeight, movingSubtreeIds, operation, uniqueCurrentSectionIds]);

  const rootDisabledReason = (operation === "section" || operation === "sections") && uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === "__root__"
    ? "Текущее расположение"
    : forbiddenTargets.__root__ ?? null;
  const availableSections = useMemo(
    () => flatSections.filter((section) => !disabledReasonFor(section)),
    [disabledReasonFor, flatSections],
  );
  const visibleSections = normalizedQuery
    ? availableSections.filter((section) => pathFor(section).toLocaleLowerCase("ru").includes(normalizedQuery))
    : availableSections;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => searchRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, []);

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
    const loading = loadingTarget === section.id;
    return (
      <button
        key={section.id}
        type="button"
        aria-label={pathFor(section)}
        disabled={loadingTarget !== undefined}
        onClick={() => void chooseTarget(section.id, null)}
        className="flex h-[34px] w-full items-center gap-2 rounded-[7px] px-2 text-left text-[#44403b] outline-none transition hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:cursor-wait"
      >
        <CatalogThumbnail src={section.imageUrl} kind="section" className="h-5 w-5 rounded-[5px]" />
        <span className="min-w-0 flex-1 truncate text-[13px] leading-4">{pathFor(section)}</span>
        {loading && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
      </button>
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
            aria-label={operation === "section" || operation === "sections" ? "Переместить раздел" : "Переместить в раздел"}
            className="flex w-[320px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[11px] border border-[#e7e5e4] bg-white p-1.5 shadow-[0_14px_36px_rgba(41,37,36,0.16)]"
          >
          <label className="mb-1.5 flex h-8 items-center gap-2 rounded-[7px] bg-[#f5f5f4] px-2.5 ring-1 ring-inset ring-[#eceae7] focus-within:bg-white focus-within:ring-[#a8a29e]">
            <MagnifyingGlass size={14} className="shrink-0 text-[#79716b]" />
            <input
              ref={searchRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => event.stopPropagation()}
              placeholder="Найти раздел..."
              className="min-w-0 flex-1 bg-transparent text-[13px] leading-5 text-[#292524] outline-none placeholder:text-[#a8a29e]"
            />
          </label>
          <div className="max-h-[340px] overflow-y-auto overscroll-contain [scrollbar-width:thin]">
            {(operation === "section" || operation === "sections") && !rootDisabledReason && (!normalizedQuery || "основное меню".includes(normalizedQuery)) && (
              <button
                type="button"
                aria-label="Основное меню"
                disabled={loadingTarget !== undefined}
                onClick={() => void chooseTarget(null, null)}
                className="flex h-[34px] w-full items-center gap-2 rounded-[7px] px-2 text-left text-[#44403b] outline-none transition hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:cursor-wait"
              >
                <CatalogThumbnail kind="section" className="h-5 w-5 rounded-[5px]" />
                <span className="min-w-0 flex-1 truncate text-[13px] leading-4">Основное меню</span>
                {loadingTarget === null && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
              </button>
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
