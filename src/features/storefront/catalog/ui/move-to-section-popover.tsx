import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretRight, CircleNotch, Image as ImageIcon, MagnifyingGlass } from "@phosphor-icons/react";
import { Tooltip } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  buildCatalogTree as buildLocalSectionTree,
  flattenCatalogTree as flattenSections,
  getSectionSubtreeIds,
  type CatalogTreeSection,
} from "../model/tree";
import { usePositionSidePeekOverlay, usePositionSidePeekOverlayLayer } from "../editor/side-peek-context";
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
  positionOccupiedTargetIds?: string[];
  anchor: MovePopoverAnchor;
  onClose: () => void;
  onMove: (targetSectionId: string | null, destination?: TreeSection) => Promise<void> | void;
  onSuccess?: (targetSectionId: string | null) => void;
  onError?: () => void;
};

const MOVE_MENU_ITEM_CLASS = "flex h-7 w-full cursor-pointer select-none items-center gap-2 rounded-[4px] py-1 pl-[6px] pr-2 text-left text-[13px] font-normal leading-4 text-[#44403b] outline-none transition-colors data-[highlighted]:bg-[#f5f5f4] data-[state=open]:bg-[#f5f5f4] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45";
const MOVE_MENU_SURFACE_CLASS = "w-[264px] max-w-[calc(100vw-24px)] rounded-[12px] border border-[#e7e5e4] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.25)] outline-none";
// Keep the portaled menu layers adjacent in the established catalog overlay stack.
const MOVE_MENU_LAYER_CLASS = "z-[100005]";
const MOVE_SUBMENU_LAYER_CLASS = "z-[100006]";
const MOVE_TOOLTIP_LAYER_CLASS = "z-[100007]";
const POSITION_OCCUPIED_TOOLTIP = "В эти разделы нельзя переместить раздел: один раздел может содержать либо позиции, либо подразделы.";

function MoveDestinationThumbnail({ src }: { src?: string | null }) {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-[4.615px] border-[0.714px] border-[#e7e5e4] bg-white text-[#79716b]">
      {src ? (
        <img src={src} alt="" loading="lazy" className="h-full w-full object-cover" />
      ) : (
        <ImageIcon size={11} weight="regular" aria-hidden="true" />
      )}
    </span>
  );
}

export function MoveToSectionPopover({
  operation,
  entityIds,
  currentSectionIds,
  movingSectionId,
  sections,
  forbiddenTargets = {},
  positionOccupiedTargetIds,
  anchor,
  onClose,
  onMove,
  onSuccess,
  onError,
}: MoveToSectionPopoverProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [loadingTarget, setLoadingTarget] = useState<string | null | undefined>(undefined);
  const nestedPlacement = anchor.placement === "right";
  const { marker, shouldPreventOverlayDismissal } = usePositionSidePeekOverlayLayer();
  usePositionSidePeekOverlay(true, onClose);

  const flatSections = useMemo(() => flattenSections(buildLocalSectionTree(sections)), [sections]);
  const sectionById = useMemo(() => new Map(flatSections.map((section) => [section.id, section])), [flatSections]);
  const childSectionsByParent = useMemo(() => {
    const result = new Map<string | null, TreeSection[]>();
    flatSections.forEach((section) => {
      const parentId = section.parentId ?? null;
      result.set(parentId, [...(result.get(parentId) ?? []), section]);
    });
    return result;
  }, [flatSections]);
  const normalizedQuery = query.trim().toLocaleLowerCase("ru");
  const uniqueCurrentSectionIds = useMemo(() => [...new Set(currentSectionIds)], [currentSectionIds]);
  const movingSubtreeIds = useMemo(() => {
    const ids = new Set<string>();
    if (movingSectionId) getSectionSubtreeIds(movingSectionId, flatSections).forEach((id) => ids.add(id));
    if (operation === "sections") {
      entityIds.forEach((id) => getSectionSubtreeIds(id, flatSections).forEach((subtreeId) => ids.add(subtreeId)));
    }
    return ids;
  }, [entityIds, flatSections, movingSectionId, operation]);
  const busy = loadingTarget !== undefined;
  const movesSections = operation === "section" || operation === "sections";
  const positionOccupiedTargetIdSet = useMemo(
    () => new Set(positionOccupiedTargetIds ?? []),
    [positionOccupiedTargetIds],
  );

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
    return names.join(" › ");
  }, [sectionById]);

  const disabledReasonFor = useCallback((section: TreeSection): string | null => {
    if (movesSections) {
      if (section.id === movingSectionId || entityIds.includes(section.id)) return "Нельзя переместить раздел внутрь самого себя";
      if (movingSubtreeIds.has(section.id)) return "Нельзя переместить раздел в его подраздел";
      if (uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === section.id) return "Текущее расположение";
      if (section.status === "archive") return "Архивный раздел нельзя выбрать";
      if (forbiddenTargets[section.id]) return forbiddenTargets[section.id];
      return null;
    }
    if (forbiddenTargets[section.id]) return forbiddenTargets[section.id];
    if (section.status === "archive") return "Архивный раздел нельзя выбрать";
    if (uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === section.id) return "Текущее расположение";
    if ((childSectionsByParent.get(section.id)?.length ?? 0) > 0) return "Выберите один из подразделов";
    return null;
  }, [childSectionsByParent, entityIds, forbiddenTargets, movesSections, movingSectionId, movingSubtreeIds, uniqueCurrentSectionIds]);

  const positionOccupiedDestinationCount = useMemo(() => {
    if (!movesSections) return 0;
    return flatSections.filter((section) => {
      if (!positionOccupiedTargetIdSet.has(section.id)) return false;
      if (section.status === "archive") return false;
      if (section.id === movingSectionId || entityIds.includes(section.id)) return false;
      if (movingSubtreeIds.has(section.id)) return false;
      if (uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === section.id) return false;
      return true;
    }).length;
  }, [entityIds, flatSections, movesSections, movingSectionId, movingSubtreeIds, positionOccupiedTargetIdSet, uniqueCurrentSectionIds]);

  const rootDisabledReason = movesSections && uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === "__root__"
    ? "Текущее расположение"
    : forbiddenTargets.__root__ ?? null;
  const availableSections = useMemo(
    () => flatSections.filter((section) => !disabledReasonFor(section)),
    [disabledReasonFor, flatSections],
  );
  const visibleTreeSectionIds = useMemo(() => {
    const ids = new Set<string>();
    availableSections.forEach((section) => {
      ids.add(section.id);
      const seen = new Set<string>([section.id]);
      let parentId = section.parentId ?? null;
      while (parentId && !seen.has(parentId)) {
        seen.add(parentId);
        ids.add(parentId);
        parentId = sectionById.get(parentId)?.parentId ?? null;
      }
    });
    return ids;
  }, [availableSections, sectionById]);
  const matchingSearchSections = useMemo(
    () => normalizedQuery
      ? flatSections.filter((section) => pathFor(section).toLocaleLowerCase("ru").includes(normalizedQuery))
      : [],
    [flatSections, normalizedQuery, pathFor],
  );
  const searchPlaceholder = "Найти раздел...";

  useEffect(() => {
    if (nestedPlacement) return;
    const frame = window.requestAnimationFrame(() => {
      searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [nestedPlacement]);

  const chooseTarget = async (targetSectionId: string | null, disabledReason: string | null, destination?: TreeSection) => {
    if (disabledReason || busy) return;
    setLoadingTarget(targetSectionId);
    try {
      await Promise.resolve(onMove(targetSectionId, destination));
      onSuccess?.(targetSectionId);
      onClose();
    } catch {
      setLoadingTarget(undefined);
      onError?.();
    }
  };

  const renderMoveItem = (section: TreeSection, label = section.name): ReactNode => {
    const disabledReason = disabledReasonFor(section);
    const loading = loadingTarget === section.id;
    return (
      <DropdownMenu.Item
        key={section.id}
        aria-label={pathFor(section)}
        disabled={Boolean(disabledReason) || busy}
        title={disabledReason ?? undefined}
        onSelect={(event) => {
          event.preventDefault();
          void chooseTarget(section.id, disabledReason, section);
        }}
        className={MOVE_MENU_ITEM_CLASS}
      >
        <MoveDestinationThumbnail src={section.imageUrl} />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {loading && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
      </DropdownMenu.Item>
    );
  };

  const renderTreeTarget = (section: TreeSection): ReactNode => {
    const disabledReason = disabledReasonFor(section);
    const allChildren = childSectionsByParent.get(section.id) ?? [];
    const children = allChildren
      .filter((child) => visibleTreeSectionIds.has(child.id));
    const canChooseSectionParent = movesSections && !disabledReason && allChildren.length > 0;

    if (children.length === 0 && !canChooseSectionParent) return disabledReason ? null : renderMoveItem(section);

    return (
      <DropdownMenu.Sub key={section.id}>
        <DropdownMenu.SubTrigger aria-label={pathFor(section)} disabled={busy} className={MOVE_MENU_ITEM_CLASS}>
          <MoveDestinationThumbnail src={section.imageUrl} />
          <span className="min-w-0 flex-1 truncate">{section.name}</span>
          <CaretRight size={12} weight="bold" aria-hidden="true" className="shrink-0 text-[#79716b]" />
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent
            sideOffset={5}
            alignOffset={-4}
            collisionPadding={12}
            data-move-to-section-nested-menu
            className={cn(
              MOVE_MENU_SURFACE_CLASS,
              MOVE_SUBMENU_LAYER_CLASS,
              "scrollbar-subtle max-h-[min(340px,calc(100vh-24px))] overflow-y-auto overscroll-contain p-1",
            )}
          >
            {canChooseSectionParent && (
              <>
                <DropdownMenu.Item
                  aria-label={`Переместить в «${section.name}»`}
                  data-move-to-section-parent-target={section.id}
                  disabled={busy}
                  onSelect={(event) => {
                    event.preventDefault();
                    void chooseTarget(section.id, null, section);
                  }}
                  className={cn(MOVE_MENU_ITEM_CLASS, "px-[10px]")}
                >
                  <span className="min-w-0 flex-1 truncate">Переместить в «{section.name}»</span>
                  {loadingTarget === section.id && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
                </DropdownMenu.Item>
                {children.length > 0 && <DropdownMenu.Separator className="-mx-1 my-1 h-px bg-[#e7e5e4]" />}
              </>
            )}
            {children.map(renderTreeTarget)}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
    );
  };

  const renderSearchResult = (section: TreeSection): ReactNode => {
    const disabledReason = disabledReasonFor(section);
    if (!disabledReason) return renderMoveItem(section, pathFor(section));

    return (
      <DropdownMenu.Item
        key={section.id}
        disabled
        aria-label={`${pathFor(section)}. ${disabledReason}`}
        data-move-unavailable-search-result={section.id}
        className="flex min-h-10 w-full select-none items-start gap-2 rounded-[4px] px-1.5 py-1.5 text-left outline-none data-[disabled]:opacity-100"
      >
        <MoveDestinationThumbnail src={section.imageUrl} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] leading-4 text-[#44403b]">{pathFor(section)}</span>
          <span className="mt-0.5 block truncate text-[11px] leading-4 text-[#a8a29e]">{disabledReason}</span>
        </span>
      </DropdownMenu.Item>
    );
  };

  return (
    <DropdownMenu.Root open modal={false} onOpenChange={() => {}}>
      <DropdownMenu.Trigger asChild>
        <button
          type="button"
          tabIndex={-1}
          aria-hidden="true"
          className="pointer-events-none fixed opacity-0"
          style={{ left: anchor.left, top: anchor.top, width: Math.max(1, anchor.right - anchor.left), height: Math.max(1, anchor.bottom - anchor.top) }}
        />
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          side={nestedPlacement ? "right" : "bottom"}
          sideOffset={nestedPlacement ? 5 : 6}
          alignOffset={nestedPlacement ? -4 : 0}
          collisionPadding={12}
          onCloseAutoFocus={(event) => event.preventDefault()}
          onEscapeKeyDown={(event) => {
            if (busy) event.preventDefault();
            else onClose();
          }}
          onPointerDownOutside={(event) => {
            if (shouldPreventOverlayDismissal(event)) {
              event.preventDefault();
              return;
            }
            if (busy) event.preventDefault();
            else onClose();
          }}
          onInteractOutside={(event) => {
            if (shouldPreventOverlayDismissal(event)) event.preventDefault();
          }}
          className={cn(MOVE_MENU_LAYER_CLASS, "bg-transparent p-0 outline-none")}
        >
          {marker}
          <div
            data-move-to-section-menu
            role="dialog"
            aria-label={movesSections ? "Переместить раздел" : "Переместить в раздел"}
            className={cn(MOVE_MENU_SURFACE_CLASS, "flex flex-col overflow-hidden pt-1")}
          >
            <div className="px-1">
              <label className="flex h-8 items-center gap-[6px] rounded-[6px] bg-[#f5f5f4] px-[7px] py-[6px]">
                <MagnifyingGlass size={14} weight="regular" className="shrink-0 text-[#79716b]" />
                <input
                  ref={searchRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  onKeyDown={(event) => event.stopPropagation()}
                  placeholder={searchPlaceholder}
                  className="min-w-0 flex-1 bg-transparent text-[13px] leading-4 text-[#44403b] outline-none placeholder:text-[#79716b]"
                />
              </label>
            </div>

            <div
              className={cn(
                "scrollbar-subtle overflow-y-auto overscroll-contain p-1",
                movesSections && positionOccupiedDestinationCount > 0 ? "max-h-[303px]" : "max-h-[340px]",
              )}
            >
              {movesSections && !rootDisabledReason && (!normalizedQuery || "основное меню".includes(normalizedQuery)) && (
                <DropdownMenu.Item
                  aria-label="Основное меню"
                  disabled={busy}
                  onSelect={(event) => {
                    event.preventDefault();
                    void chooseTarget(null, null);
                  }}
                  className={MOVE_MENU_ITEM_CLASS}
                >
                  <MoveDestinationThumbnail />
                  <span className="min-w-0 flex-1 truncate">Основное меню</span>
                  {loadingTarget === null && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
                </DropdownMenu.Item>
              )}
              {normalizedQuery
                ? matchingSearchSections.map(renderSearchResult)
                : (childSectionsByParent.get(null) ?? [])
                  .filter((section) => visibleTreeSectionIds.has(section.id))
                  .map(renderTreeTarget)}
              {normalizedQuery && matchingSearchSections.length === 0 && (
                <div className="flex h-14 items-center justify-center px-3 text-[13px] text-[#79716b]">Разделы не найдены</div>
              )}
              {!normalizedQuery && availableSections.length === 0 && !(movesSections && !rootDisabledReason) && (
                <div className="flex h-14 items-center justify-center px-3 text-[13px] text-[#79716b]">Нет подходящих разделов</div>
              )}
            </div>
            {movesSections && positionOccupiedDestinationCount > 0 && (
              <div data-move-position-occupied-summary className="border-t border-[#e7e5e4] p-1">
                <Tooltip
                  label={POSITION_OCCUPIED_TOOLTIP}
                  side="top"
                  delayDuration={250}
                  contentClassName={cn(MOVE_TOOLTIP_LAYER_CLASS, "max-w-[320px] px-2 py-1.5 text-[12px] leading-4")}
                >
                  <button
                    type="button"
                    aria-label={`Содержат позиции · ${positionOccupiedDestinationCount}`}
                    className="flex h-7 w-full items-center rounded-[4px] px-[10px] text-left text-[13px] font-normal leading-4 text-[#79716b] outline-none transition-colors hover:bg-[#f5f5f4] focus-visible:bg-[#f5f5f4]"
                  >
                    <span className="border-b border-dashed border-[#a8a29e] tabular-nums">
                      Содержат позиции · {positionOccupiedDestinationCount}
                    </span>
                  </button>
                </Tooltip>
              </div>
            )}
            {busy && <span className="sr-only" role="status">Перемещение выполняется</span>}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
