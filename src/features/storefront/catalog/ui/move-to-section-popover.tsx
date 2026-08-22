import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretRight, CircleNotch, FolderPlus, Image as ImageIcon, MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  anchor: MovePopoverAnchor;
  onClose: () => void;
  onMove: (targetSectionId: string | null, destination?: TreeSection) => Promise<void> | void;
  onCreateSection?: (name: string, parentId: string | null) => Promise<TreeSection | string> | TreeSection | string;
  onSuccess?: (targetSectionId: string | null) => void;
  onError?: () => void;
};

const MOVE_MENU_ITEM_CLASS = "flex h-7 w-full cursor-pointer select-none items-center gap-2 rounded-[4px] py-1 pl-[6px] pr-2 text-left text-[13px] font-normal leading-4 text-[#44403b] outline-none transition-colors data-[highlighted]:bg-[#f5f5f4] data-[state=open]:bg-[#f5f5f4] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45";
const MOVE_MENU_SURFACE_CLASS = "w-[264px] max-w-[calc(100vw-24px)] rounded-[12px] border border-[#e7e5e4] bg-white shadow-[0_4px_20px_rgba(0,0,0,0.25)] outline-none";
// Keep the three portaled layers adjacent in the established catalog overlay stack.
const MOVE_MENU_LAYER_CLASS = "z-[100005]";
const MOVE_SUBMENU_LAYER_CLASS = "z-[100006]";
const MOVE_TOOLTIP_LAYER_CLASS = "z-[100007]";

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

function CreateSectionIcon() {
  return (
    <span className="flex size-5 shrink-0 items-center justify-center rounded-[4.615px] border-[0.714px] border-[#e7e5e4] bg-white text-[#44403b]">
      <FolderPlus size={12} weight="regular" aria-hidden="true" />
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
  anchor,
  onClose,
  onMove,
  onCreateSection,
  onSuccess,
  onError,
}: MoveToSectionPopoverProps) {
  const searchRef = useRef<HTMLInputElement | null>(null);
  const createInputRef = useRef<HTMLInputElement | null>(null);
  const [query, setQuery] = useState("");
  const [createMode, setCreateMode] = useState(false);
  const [createName, setCreateName] = useState("");
  const [createError, setCreateError] = useState("");
  const [creating, setCreating] = useState(false);
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
  const busy = loadingTarget !== undefined || creating;
  const movesSections = operation === "section" || operation === "sections";

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
    if (movesSections) {
      if (section.id === movingSectionId || entityIds.includes(section.id)) return "Нельзя переместить раздел внутрь самого себя";
      if (movingSubtreeIds.has(section.id)) return "Нельзя переместить раздел в его подраздел";
      if (uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === section.id) return "Текущее расположение";
      if (forbiddenTargets[section.id]) return forbiddenTargets[section.id];
      if (section.status === "archive") return "Архивный раздел нельзя выбрать";
      return null;
    }
    if (forbiddenTargets[section.id]) return forbiddenTargets[section.id];
    if (section.status === "archive") return "Архивный раздел нельзя выбрать";
    if (uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === section.id) return "Текущее расположение";
    if ((childSectionsByParent.get(section.id)?.length ?? 0) > 0) return "Внутри есть подразделы";
    return null;
  }, [childSectionsByParent, entityIds, forbiddenTargets, movesSections, movingSectionId, movingSubtreeIds, uniqueCurrentSectionIds]);

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
  const visibleSearchSections = useMemo(
    () => matchingSearchSections.filter((section) => !disabledReasonFor(section)),
    [disabledReasonFor, matchingSearchSections],
  );
  const unavailableSearchSections = useMemo(
    () => matchingSearchSections.filter((section) => Boolean(disabledReasonFor(section))),
    [disabledReasonFor, matchingSearchSections],
  );
  const destinationHint = movesSections
    ? "Раздел может содержать либо позиции, либо подразделы. Поэтому раздел можно переместить только туда, где нет позиций."
    : "Раздел может содержать либо позиции, либо подразделы. Поэтому позицию можно переместить только в раздел без подразделов.";
  const searchPlaceholder = movesSections ? "Переместить раздел в..." : "Переместить позицию в...";

  useEffect(() => {
    if (nestedPlacement) return;
    const frame = window.requestAnimationFrame(() => {
      if (createMode) createInputRef.current?.focus();
      else searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [createMode, nestedPlacement]);

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

  const createAndMove = async () => {
    const normalizedName = createName.trim();
    if (!normalizedName || !onCreateSection || creating) return;
    setCreating(true);
    setCreateError("");
    try {
      const result = await Promise.resolve(onCreateSection(normalizedName, null));
      if (typeof result === "string") {
        setCreateError(result);
        setCreating(false);
        return;
      }
      await Promise.resolve(onMove(result.id, result));
      onSuccess?.(result.id);
      onClose();
    } catch {
      setCreating(false);
      setCreateError("Не удалось создать раздел. Попробуйте ещё раз");
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
    const children = (childSectionsByParent.get(section.id) ?? [])
      .filter((child) => visibleTreeSectionIds.has(child.id));

    if (!disabledReason) return renderMoveItem(section);
    if (children.length === 0) return null;

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
            {children.map(renderTreeTarget)}
          </DropdownMenu.SubContent>
        </DropdownMenu.Portal>
      </DropdownMenu.Sub>
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
            else if (createMode) {
              event.preventDefault();
              setCreateMode(false);
              setCreateError("");
            } else onClose();
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
            {createMode ? (
              <div className="p-2">
                <div className="flex items-center gap-2 px-1 pb-2">
                  <CreateSectionIcon />
                  <span className="text-[13px] font-medium leading-4 text-[#292524]">Создать раздел</span>
                </div>
                <Input
                  ref={createInputRef}
                  size="compact"
                  value={createName}
                  maxLength={25}
                  aria-label="Название нового раздела"
                  placeholder="Название раздела"
                  onChange={(event) => {
                    setCreateName(event.target.value);
                    setCreateError("");
                  }}
                  onKeyDown={(event) => {
                    event.stopPropagation();
                    if (event.key === "Enter") {
                      event.preventDefault();
                      void createAndMove();
                    }
                    if (event.key === "Escape") {
                      event.preventDefault();
                      setCreateMode(false);
                      setCreateError("");
                    }
                  }}
                  className="h-8 border-[#d6d3d1] focus:border-[#4f39f6]"
                />
                {createError && <p role="alert" className="px-1 pt-1.5 text-[12px] leading-4 text-[#9f1239]">{createError}</p>}
                <div className="mt-3 flex justify-end gap-1.5">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    disabled={creating}
                    onClick={() => {
                      setCreateMode(false);
                      setCreateError("");
                    }}
                    className="h-8 px-3 text-[13px] text-[#57534d]"
                  >
                    Отмена
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={!createName.trim() || creating}
                    onClick={() => void createAndMove()}
                    className="h-8 bg-[#4f39f6] px-3 text-[13px] text-white hover:bg-[#4030d4]"
                  >
                    {creating && <CircleNotch size={14} weight="bold" className="animate-spin" />}
                    Создать и переместить
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <div className="flex flex-col gap-1">
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
                  {onCreateSection && (
                    <div className="border-b border-[#e7e5e4] p-1">
                      <DropdownMenu.Item
                        disabled={busy}
                        onSelect={(event) => {
                          event.preventDefault();
                          setCreateMode(true);
                          setCreateName("");
                          setCreateError("");
                        }}
                        className={MOVE_MENU_ITEM_CLASS}
                      >
                        <CreateSectionIcon />
                        <span className="min-w-0 flex-1 truncate">Создать раздел</span>
                      </DropdownMenu.Item>
                    </div>
                  )}
                  {!onCreateSection && <div className="h-px bg-[#e7e5e4]" />}
                </div>

                <div className="flex flex-col gap-1 pt-2">
                  <div className="flex items-center pl-3">
                    <Tooltip
                      label={destinationHint}
                      side="top"
                      delayDuration={250}
                      contentClassName={cn(MOVE_TOOLTIP_LAYER_CLASS, "max-w-[320px] px-2 py-1.5 text-[12px] leading-4")}
                    >
                      <button
                        type="button"
                        data-move-destinations-hint
                        className="cursor-help border-b border-dashed border-[#a8a29e] text-left text-[12px] font-medium leading-4 text-[#78716c] outline-none focus-visible:border-indigo-500 focus-visible:text-[#44403b]"
                      >
                        Доступны для перемещения
                      </button>
                    </Tooltip>
                  </div>

                  <div className="scrollbar-subtle max-h-[340px] overflow-y-auto overscroll-contain p-1">
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
                      ? visibleSearchSections.map((section) => renderMoveItem(section, pathFor(section)))
                      : (childSectionsByParent.get(null) ?? [])
                        .filter((section) => visibleTreeSectionIds.has(section.id))
                        .map(renderTreeTarget)}
                    {normalizedQuery && unavailableSearchSections.map((section) => (
                      <DropdownMenu.Item
                        key={section.id}
                        disabled
                        aria-label={`${pathFor(section)}. ${disabledReasonFor(section)}`}
                        data-move-unavailable-search-result={section.id}
                        className="flex min-h-10 w-full select-none items-start gap-2 rounded-[4px] px-1.5 py-1.5 text-left outline-none data-[disabled]:opacity-100"
                      >
                        <MoveDestinationThumbnail src={section.imageUrl} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[13px] leading-4 text-[#44403b]">{pathFor(section)}</span>
                          <span className="mt-0.5 block truncate text-[11px] leading-4 text-[#a8a29e]">{disabledReasonFor(section)}</span>
                        </span>
                      </DropdownMenu.Item>
                    ))}
                    {normalizedQuery && visibleSearchSections.length === 0 && unavailableSearchSections.length === 0 && (
                      <div className="flex h-14 items-center justify-center px-3 text-[13px] text-[#79716b]">Разделы не найдены</div>
                    )}
                    {!normalizedQuery && availableSections.length === 0 && !(movesSections && !rootDisabledReason) && (
                      <div className="flex h-14 items-center justify-center px-3 text-[13px] text-[#79716b]">Нет подходящих разделов</div>
                    )}
                  </div>
                </div>
                {busy && <span className="sr-only" role="status">Перемещение выполняется</span>}
              </>
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
