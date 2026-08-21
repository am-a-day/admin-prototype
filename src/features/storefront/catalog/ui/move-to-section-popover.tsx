import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretRight, CircleNotch, FolderPlus, MagnifyingGlass } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { CatalogThumbnail } from "./catalog-thumbnail";
import {
  buildCatalogTree as buildLocalSectionTree,
  flattenCatalogTree as flattenSections,
  getSectionSubtreeIds,
  getSectionTreeDepth,
  MAX_CATALOG_SECTION_DEPTH,
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

const MOVE_MENU_ITEM_CLASS = "flex h-[34px] w-full cursor-pointer select-none items-center gap-2 rounded-[7px] px-2 text-left text-[13px] leading-4 text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4] data-[state=open]:bg-[#f5f5f4] data-[disabled]:cursor-not-allowed data-[disabled]:opacity-45 focus-visible:ring-2 focus-visible:ring-[#292524]/10";

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
  const busy = loadingTarget !== undefined || creating;

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
    if ((childSectionsByParent.get(section.id)?.length ?? 0) > 0) return "В разделе уже есть подразделы";
    return null;
  }, [childSectionsByParent, entityIds, flatSections, forbiddenTargets, movingSectionId, movingSubtreeHeight, movingSubtreeIds, operation, uniqueCurrentSectionIds]);

  const rootDisabledReason = (operation === "section" || operation === "sections") && uniqueCurrentSectionIds.length === 1 && uniqueCurrentSectionIds[0] === "__root__"
    ? "Текущее расположение"
    : forbiddenTargets.__root__ ?? null;
  const availableSections = useMemo(
    () => flatSections.filter((section) => !disabledReasonFor(section)),
    [disabledReasonFor, flatSections],
  );
  const visibleSearchSections = normalizedQuery
    ? availableSections.filter((section) => pathFor(section).toLocaleLowerCase("ru").includes(normalizedQuery))
    : [];
  const createDisabledReason = (operation === "section" || operation === "sections") && movingSubtreeHeight + 1 > MAX_CATALOG_SECTION_DEPTH
    ? "Достигнута максимальная глубина"
    : null;

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (createMode) createInputRef.current?.focus();
      else searchRef.current?.focus();
    });
    return () => window.cancelAnimationFrame(frame);
  }, [createMode]);

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
    if (!normalizedName || !onCreateSection || creating || createDisabledReason) return;
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
        <CatalogThumbnail src={section.imageUrl} kind="section" className="h-5 w-5 rounded-[5px]" />
        <span className="min-w-0 flex-1 truncate">{label}</span>
        {loading && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
      </DropdownMenu.Item>
    );
  };

  const renderTreeTarget = (section: TreeSection): ReactNode => {
    const children = childSectionsByParent.get(section.id) ?? [];
    if (children.length === 0) return renderMoveItem(section);
    const disabledReason = disabledReasonFor(section);
    return (
      <DropdownMenu.Sub key={section.id}>
        <DropdownMenu.SubTrigger aria-label={pathFor(section)} disabled={busy} className={MOVE_MENU_ITEM_CLASS}>
          <CatalogThumbnail src={section.imageUrl} kind="section" className="h-5 w-5 rounded-[5px]" />
          <span className="min-w-0 flex-1 truncate">{section.name}</span>
          <CaretRight size={14} weight="bold" aria-hidden="true" className="shrink-0 text-[#a8a29e]" />
        </DropdownMenu.SubTrigger>
        <DropdownMenu.Portal>
          <DropdownMenu.SubContent
            sideOffset={5}
            alignOffset={-6}
            collisionPadding={12}
            className="z-[100006] min-w-[220px] max-w-[320px] rounded-[11px] border border-[#e7e5e4] bg-white p-1.5 shadow-[0_14px_36px_rgba(41,37,36,0.16)] outline-none"
          >
            {!disabledReason && (
              <DropdownMenu.Item
                disabled={busy}
                onSelect={(event) => {
                  event.preventDefault();
                  void chooseTarget(section.id, null, section);
                }}
                className={cn(MOVE_MENU_ITEM_CLASS, "font-medium text-[#292524]")}
              >
                <CatalogThumbnail src={section.imageUrl} kind="section" className="h-5 w-5 rounded-[5px]" />
                <span className="min-w-0 flex-1 truncate">Переместить сюда</span>
                {loadingTarget === section.id && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
              </DropdownMenu.Item>
            )}
            {!disabledReason && <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />}
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
          side="bottom"
          sideOffset={6}
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
          className="z-[100005] bg-transparent p-0 outline-none"
        >
          {marker}
          <div
            role="dialog"
            aria-label={operation === "section" || operation === "sections" ? "Переместить раздел" : "Переместить в раздел"}
            className="flex w-[320px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-[11px] border border-[#e7e5e4] bg-white p-1.5 shadow-[0_14px_36px_rgba(41,37,36,0.16)]"
          >
            {createMode ? (
              <div className="p-1">
                <div className="flex items-center gap-2 px-1 pb-2 pt-0.5">
                  <FolderPlus size={16} weight="regular" className="shrink-0 text-[#57534d]" />
                  <span className="text-[13px] font-medium text-[#292524]">Создать раздел</span>
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
                    disabled={!createName.trim() || creating || Boolean(createDisabledReason)}
                    title={createDisabledReason ?? undefined}
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
                    <DropdownMenu.Item
                      aria-label="Основное меню"
                      disabled={busy}
                      onSelect={(event) => {
                        event.preventDefault();
                        void chooseTarget(null, null);
                      }}
                      className={MOVE_MENU_ITEM_CLASS}
                    >
                      <CatalogThumbnail kind="section" className="h-5 w-5 rounded-[5px]" />
                      <span className="min-w-0 flex-1 truncate">Основное меню</span>
                      {loadingTarget === null && <CircleNotch size={14} weight="bold" className="shrink-0 animate-spin text-[#57534d]" />}
                    </DropdownMenu.Item>
                  )}
                  {normalizedQuery
                    ? visibleSearchSections.map((section) => renderMoveItem(section, pathFor(section)))
                    : (childSectionsByParent.get(null) ?? []).map(renderTreeTarget)}
                  {normalizedQuery && visibleSearchSections.length === 0 && (
                    <div className="flex h-16 items-center justify-center px-3 text-[13px] text-[#79716b]">Разделы не найдены</div>
                  )}
                </div>
                {onCreateSection && (
                  <>
                    <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                    <DropdownMenu.Item
                      disabled={busy || Boolean(createDisabledReason)}
                      title={createDisabledReason ?? undefined}
                      onSelect={(event) => {
                        event.preventDefault();
                        setCreateMode(true);
                        setCreateName("");
                        setCreateError("");
                      }}
                      className={cn(MOVE_MENU_ITEM_CLASS, "font-medium text-[#292524]")}
                    >
                      <FolderPlus size={16} weight="regular" className="shrink-0 text-[#57534d]" />
                      <span className="min-w-0 flex-1">Создать раздел…</span>
                    </DropdownMenu.Item>
                  </>
                )}
                {busy && <span className="sr-only" role="status">Перемещение выполняется</span>}
              </>
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
