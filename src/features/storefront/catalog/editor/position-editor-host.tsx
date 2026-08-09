import { Fragment, useEffect, useRef, useState } from "react";
import { CaretDown, Check, List, MagnifyingGlass } from "@phosphor-icons/react";
import { HoverCard, HoverCardContent, HoverCardTrigger } from "@/components/ui/hover-card";
import { usePublish } from "@/contexts/publish-context";
import { useCatalogStore } from "@/contexts/catalog-store-context";
import { catalogSections, type CatalogItem } from "@/data/catalog";
import { cn } from "@/lib/utils";
import { catalogStorageKey } from "@/lib/catalog-preview";
import {
  CATALOG_UPSELL_STORAGE_KEY,
  writeCatalogUpsellState,
  type CatalogUpsellStateByItem,
} from "@/lib/catalog-upsell";
import type { CatalogPriceSortDirection, CatalogReturnContext } from "../navigation/types";
import type { OverviewFilterId } from "../model/types";
import { getCatalogSectionPathFromSections, type CatalogSectionCrumb } from "../model/section-path";
import { orderSectionItems } from "../model/reorder";
import { HYBRID_PRIMARY_FILTER_LABELS } from "../model/filter-config";
import type { CatalogAvailabilityMode, CatalogTreeSection } from "../model/tree";
import { deriveEditorQueue, descriptionHasContent, getQueueEditorContext, isRepairQueueFilter, type EditorTab } from "./editor-queue";
import { DescriptionQueueComplete } from "./description-queue-complete";
import { PositionQueueControls, PositionQueueReturnLink } from "./editor-queue-controls";
import { PositionEditor, createDefaultWeeklySchedule } from "./position-editor";
import type { OutsideScheduleMode, UnavailableDisplayMode, WeeklySchedule } from "./position-editor";
import { readJsonRecord, writeJsonRecord } from "../storage";
import type { MovePopoverAnchor } from "../ui/move-anchor";
import { MoveToSectionPopover } from "../ui/move-to-section-popover";
import { CatalogThumbnail } from "../ui/catalog-thumbnail";

type TreeSection = CatalogTreeSection;
type AvailabilityMode = CatalogAvailabilityMode;

export type DescriptionAuditQueueSnapshot = {
  itemIds: string[];
  filterId: OverviewFilterId;
  entryFilterId: OverviewFilterId;
  filterLabel?: string;
  query: string;
  returnPanelQuery?: string;
  tableQuery: string;
  sectionScopeId: string | null;
  scrollTop: number;
  entryItemId: string;
  sort: CatalogPriceSortDirection;
  entryFromSection: boolean;
  returnContext?: CatalogReturnContext;
  sectionPath?: CatalogSectionCrumb[];
};

export type DescriptionAuditQueueState = {
  snapshot: DescriptionAuditQueueSnapshot;
  currentId: string | null;
};

export type OpenPositionIntent = {
  origin: "structure" | "positions";
  currentId: string;
  orderedIds: string[];
  sectionId?: string;
  snapshot?: DescriptionAuditQueueSnapshot;
  returnContext: { label: string };
  revision: number;
};

const CATALOG_UNAVAILABLE_DISPLAY_STORAGE_KEY = catalogStorageKey("unavailableDisplay");
const CATALOG_OUTSIDE_SCHEDULE_STORAGE_KEY = catalogStorageKey("outsideSchedule");
const CATALOG_WEEKLY_SCHEDULE_STORAGE_KEY = catalogStorageKey("weeklySchedule");

function StructuralSectionCrumb({
  section,
  siblings,
  compact,
  onOpenSection,
  onRevealSection,
}: {
  section: CatalogSectionCrumb;
  siblings: TreeSection[];
  compact: boolean;
  onOpenSection: (id: string) => void;
  onRevealSection: (id: string) => void;
}) {
  return (
    <HoverCard openDelay={275} closeDelay={275}>
      <HoverCardTrigger asChild>
        <button
          type="button"
          title={section.name}
          onClick={() => onOpenSection(section.id)}
          className={cn(
            "min-w-0 truncate rounded-[6px] px-1 py-0.5 text-left text-[13px] font-medium text-[#79716b] transition hover:bg-[#f1f1ea] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
            compact ? "max-w-[100px]" : "max-w-[150px]",
          )}
        >
          {section.name}
        </button>
      </HoverCardTrigger>
      <HoverCardContent className="w-[260px]">
        <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
          Соседние разделы
        </div>
        <div className="max-h-[260px] overflow-y-auto py-0.5">
          {siblings.map((sibling) => (
            <button
              type="button"
              key={sibling.id}
              onClick={() => onOpenSection(sibling.id)}
              className={cn(
                "flex min-h-8 w-full cursor-pointer items-center gap-2 rounded-[8px] px-2.5 py-1.5 text-left text-[13px] outline-none transition hover:bg-[#f5f5f4] focus-visible:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                sibling.id === section.id ? "bg-[#f5f5f4] font-medium text-[#292524]" : "text-[#57534d]",
              )}
            >
              <span className="min-w-0 flex-1 truncate">{sibling.name}</span>
              {sibling.id === section.id && <Check size={14} weight="bold" className="shrink-0 text-[#79716b]" />}
            </button>
          ))}
        </div>
        <div className="my-1 h-px bg-[#eceae7]" />
        <button
          type="button"
          onClick={() => onRevealSection(section.id)}
          className="flex h-8 w-full cursor-pointer items-center gap-2 rounded-[8px] px-2.5 text-left text-[13px] font-medium text-[#44403b] outline-none transition hover:bg-[#f5f5f4] focus-visible:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          <List size={15} />
          Показать в дереве
        </button>
      </HoverCardContent>
    </HoverCard>
  );
}

function StructuralPositionBreadcrumb({
  item,
  sections,
  allItems,
  positionOrderBySection,
  onOpenSection,
  onRevealSection,
  onOpenPosition,
}: {
  item: CatalogItem;
  sections: TreeSection[];
  allItems: CatalogItem[];
  positionOrderBySection: Record<string, string[]>;
  onOpenSection: (id: string) => void;
  onRevealSection: (id: string) => void;
  onOpenPosition: (id: string) => void;
}) {
  const [positionQuery, setPositionQuery] = useState("");
  const [positionMenuOpen, setPositionMenuOpen] = useState(false);
  const sectionPath = getCatalogSectionPathFromSections(item.sectionId, sections);
  const sectionsByParent = new Map<string, TreeSection[]>();
  sections.forEach((section) => {
    const parentKey = section.parentId ?? "__root__";
    const siblings = sectionsByParent.get(parentKey) ?? [];
    siblings.push(section);
    sectionsByParent.set(parentKey, siblings);
  });
  sectionsByParent.forEach((siblings) => siblings.sort((left, right) =>
    (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.name.localeCompare(right.name, "ru"),
  ));
  const structuralItems = orderSectionItems(
    allItems.filter((candidate) => candidate.sectionId === item.sectionId),
    positionOrderBySection[item.sectionId],
  );
  const normalizedPositionQuery = positionQuery.trim().toLocaleLowerCase();
  const visibleStructuralItems = normalizedPositionQuery
    ? structuralItems.filter((candidate) => candidate.title.toLocaleLowerCase().includes(normalizedPositionQuery))
    : structuralItems;
  return (
    <nav aria-label="Положение позиции в каталоге" className="flex min-w-0 items-center gap-1">
      {sectionPath.map((section, index) => {
        const sectionNode = sections.find((candidate) => candidate.id === section.id);
        const siblings = sectionsByParent.get(sectionNode?.parentId ?? "__root__") ?? [];
        return (
          <Fragment key={section.id}>
            {index > 0 && <span className="shrink-0 text-[13px] text-[#d6d3d1]" aria-hidden="true">/</span>}
            <StructuralSectionCrumb
              section={section}
              siblings={siblings}
              compact={index < sectionPath.length - 1}
              onOpenSection={onOpenSection}
              onRevealSection={onRevealSection}
            />
          </Fragment>
        );
      })}
      {sectionPath.length > 0 && <span className="shrink-0 text-[13px] text-[#d6d3d1]" aria-hidden="true">/</span>}
      <HoverCard
        open={positionMenuOpen}
        onOpenChange={(open) => {
          setPositionMenuOpen(open);
          if (!open) setPositionQuery("");
        }}
        openDelay={275}
        closeDelay={275}
      >
        <HoverCardTrigger asChild>
          <button
            type="button"
            title={item.title}
            aria-label={`Открыть позиции раздела, текущая позиция: ${item.title}`}
            aria-expanded={positionMenuOpen}
            onClick={() => setPositionMenuOpen(true)}
            className="flex h-7 min-w-0 flex-1 items-center rounded-[6px] px-1 text-[13px] font-medium text-[#292524] transition hover:bg-[#f1f1ea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
          >
            <span className="min-w-0 flex-1 truncate text-left">{item.title}</span>
            <span className="ml-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[#79716b]">
              <CaretDown size={12} weight="bold" />
            </span>
          </button>
        </HoverCardTrigger>
        <HoverCardContent align="end" className="w-[320px]">
          <div className="px-2.5 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">
            Позиции раздела · {structuralItems.length}
          </div>
          {structuralItems.length > 8 && (
            <label className="mx-1 mb-1 flex h-8 items-center gap-2 rounded-[8px] border border-[#e7e5e4] bg-[#fafaf9] px-2.5">
              <MagnifyingGlass size={14} className="shrink-0 text-[#a8a29e]" />
              <input
                value={positionQuery}
                onChange={(event) => setPositionQuery(event.target.value)}
                onKeyDown={(event) => event.stopPropagation()}
                placeholder="Найти позицию"
                aria-label="Поиск по позициям раздела"
                className="min-w-0 flex-1 bg-transparent text-[12px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
              />
            </label>
          )}
          <div className="max-h-[320px] overflow-y-auto py-0.5">
            {visibleStructuralItems.map((candidate) => (
              <button
                type="button"
                key={candidate.id}
                onClick={() => {
                  setPositionMenuOpen(false);
                  onOpenPosition(candidate.id);
                }}
                className={cn(
                  "flex min-h-10 w-full cursor-pointer items-center gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px] outline-none transition hover:bg-[#f5f5f4] focus-visible:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                  candidate.id === item.id && "bg-[#f5f5f4] font-medium",
                )}
              >
                <CatalogThumbnail src={candidate.thumbnailUrl} kind="item" className="h-7 w-7" />
                <span className="min-w-0 flex-1 truncate text-[#44403b]">{candidate.title}</span>
                {candidate.id === item.id && <Check size={14} weight="bold" className="shrink-0 text-[#79716b]" />}
              </button>
            ))}
            {visibleStructuralItems.length === 0 && (
              <div className="px-2.5 py-3 text-[12px] text-[#79716b]">Ничего не найдено</div>
            )}
          </div>
        </HoverCardContent>
      </HoverCard>
    </nav>
  );
}


export function PositionEditorHost({
  intent,
  onCurrentIdChange,
  onClose,
  onFeedback,
  onRequestPermanentDelete,
  onRevealItem,
  structureSections = catalogSections,
  positionOrderBySection = {},
  onOpenStructuralItem,
  onOpenStructuralSection,
  onRevealStructuralSection,
}: {
  intent: OpenPositionIntent;
  onCurrentIdChange: (id: string) => void;
  onClose: () => void;
  onFeedback?: (message: string) => void;
  onRequestPermanentDelete?: (item: CatalogItem) => void;
  onRevealItem?: (item: CatalogItem) => void;
  structureSections?: TreeSection[];
  positionOrderBySection?: Record<string, string[]>;
  onOpenStructuralItem?: (id: string) => void;
  onOpenStructuralSection?: (id: string) => void;
  onRevealStructuralSection?: (id: string) => void;
}) {
  const {
    items,
    itemsById,
    updateItem,
    deleteItem,
    moveItem,
    setItemStatus,
    setAutosaveStatus,
    setActiveEditorItemId,
  } = useCatalogStore();
  const { registerChange } = usePublish();
  const [upsellByItem, setUpsellByItem] = useState<CatalogUpsellStateByItem>(() =>
    readJsonRecord<CatalogUpsellStateByItem>(CATALOG_UPSELL_STORAGE_KEY, {}),
  );
  const [unavailableDisplayByItem, setUnavailableDisplayByItem] = useState<Record<string, UnavailableDisplayMode>>(() =>
    readJsonRecord<Record<string, UnavailableDisplayMode>>(CATALOG_UNAVAILABLE_DISPLAY_STORAGE_KEY, {}),
  );
  const [outsideScheduleByItem, setOutsideScheduleByItem] = useState<Record<string, OutsideScheduleMode>>(() =>
    readJsonRecord<Record<string, OutsideScheduleMode>>(CATALOG_OUTSIDE_SCHEDULE_STORAGE_KEY, {}),
  );
  const [weeklyScheduleByItem, setWeeklyScheduleByItem] = useState<Record<string, WeeklySchedule>>(() =>
    readJsonRecord<Record<string, WeeklySchedule>>(CATALOG_WEEKLY_SCHEDULE_STORAGE_KEY, {}),
  );
  const [moveRequest, setMoveRequest] = useState<{ itemId: string; anchor: MovePopoverAnchor } | null>(null);
  const [moveUndo, setMoveUndo] = useState<{ itemId: string; sectionId: string; sectionName: string; message: string } | null>(null);
  const saveTimersRef = useRef<Record<string, number>>({});
  const item = itemsById[intent.currentId] ?? null;
  const editorContext = intent.origin === "positions" && intent.snapshot
    ? getQueueEditorContext(intent.snapshot.entryFilterId)
    : { tab: "basic" as EditorTab, anchor: undefined };
  const existingItemIds = new Set(items.map((candidate) => candidate.id));
  const editorQueue = deriveEditorQueue(
    intent.snapshot?.itemIds ?? intent.orderedIds,
    intent.currentId,
    existingItemIds,
  );
  const currentSelectionIds = editorQueue.itemIds;
  const outsideCurrentSelection = intent.origin === "positions" && !currentSelectionIds.includes(intent.currentId);
  const { previousId: previousQueueId, nextId: nextQueueId } = editorQueue;

  useEffect(() => {
    writeCatalogUpsellState(upsellByItem);
  }, [upsellByItem]);

  useEffect(() => writeJsonRecord(CATALOG_UNAVAILABLE_DISPLAY_STORAGE_KEY, unavailableDisplayByItem), [unavailableDisplayByItem]);
  useEffect(() => writeJsonRecord(CATALOG_OUTSIDE_SCHEDULE_STORAGE_KEY, outsideScheduleByItem), [outsideScheduleByItem]);
  useEffect(() => writeJsonRecord(CATALOG_WEEKLY_SCHEDULE_STORAGE_KEY, weeklyScheduleByItem), [weeklyScheduleByItem]);

  useEffect(() => () => {
    Object.values(saveTimersRef.current).forEach((timer) => window.clearTimeout(timer));
  }, []);

  useEffect(() => {
    if (!moveUndo) return;
    const timeout = window.setTimeout(() => setMoveUndo(null), 5000);
    return () => window.clearTimeout(timeout);
  }, [moveUndo]);

  useEffect(() => {
    setActiveEditorItemId(intent.currentId);
    return () => setActiveEditorItemId(null);
  }, [intent.currentId, setActiveEditorItemId]);

  if (!item) {
    return <DescriptionQueueComplete filterId={intent.snapshot?.filterId ?? "quick:all"} onBack={onClose} />;
  }

  const saveDescription = (target: CatalogItem, value: string) => {
    window.clearTimeout(saveTimersRef.current[target.id]);
    updateItem(target.id, { description: value });
    saveTimersRef.current[target.id] = window.setTimeout(() => {
      updateItem(target.id, { description: value, hasDescription: descriptionHasContent(value) }, { autosave: false });
      setAutosaveStatus(target.id, "saved");
      registerChange("catalog");
    }, 450);
  };

  const setAvailability = (target: CatalogItem, mode: AvailabilityMode) => {
    if (target.status === "archive") return;
    setItemStatus(target.id, mode === "unavailable" ? "stopped" : "active", mode === "schedule");
    registerChange("catalog");
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
      {outsideCurrentSelection && (
        <div className="mx-6 mt-4 flex shrink-0 items-center gap-3 rounded-[10px] border border-[#e7e5e4] bg-[#fafaf9] px-3 py-2 text-[12px] leading-5 text-[#79716b]">
          <span className="min-w-0 flex-1">Открытая позиция скрыта текущими фильтрами</span>
          {onRevealItem && (
            <button
              type="button"
              onClick={() => onRevealItem(item)}
              className="shrink-0 rounded-[7px] px-2 py-1 font-medium text-[#44403b] transition hover:bg-[#efefea] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}
      <PositionEditor
      item={item}
      allItems={items}
      upsell={upsellByItem[item.id] ?? {}}
      onUpsellChange={(next) => {
        setUpsellByItem((current) => ({ ...current, [item.id]: next }));
        registerChange("catalog");
      }}
      stopBusy={false}
      onArchiveItem={(target) => {
        setItemStatus(target.id, "archive");
        onFeedback?.("Позиция перенесена в архив");
      }}
      onRestoreItem={(target) => {
        setItemStatus(target.id, "active");
        onFeedback?.("Позиция восстановлена");
      }}
      onMoveItem={(target, anchor) => setMoveRequest({ itemId: target.id, anchor })}
      onToggleStop={(target) => setItemStatus(target.id, target.status === "stopped" ? "active" : "stopped")}
      onSetAvailabilityMode={setAvailability}
      unavailableDisplayMode={unavailableDisplayByItem[item.id] ?? "hidden"}
      outsideScheduleMode={outsideScheduleByItem[item.id] ?? "hidden"}
      weeklySchedule={weeklyScheduleByItem[item.id] ?? createDefaultWeeklySchedule()}
      onUnavailableDisplayModeChange={(mode) => setUnavailableDisplayByItem((current) => ({ ...current, [item.id]: mode }))}
      onOutsideScheduleModeChange={(mode) => setOutsideScheduleByItem((current) => ({ ...current, [item.id]: mode }))}
      onWeeklyScheduleChange={(schedule) => setWeeklyScheduleByItem((current) => ({ ...current, [item.id]: schedule }))}
      onRequestPermanentDelete={(target) => {
        if (onRequestPermanentDelete) onRequestPermanentDelete(target);
        else {
          deleteItem(target.id);
          onClose();
        }
      }}
      onDescriptionChange={saveDescription}
      onMediaAdded={(target, previewUrl) => {
        updateItem(target.id, { thumbnailUrl: target.thumbnailUrl ?? previewUrl });
        registerChange("catalog");
      }}
      onItemChange={(target, patch) => {
        updateItem(target.id, patch);
        registerChange("catalog");
      }}
      forcedEditorTab={editorContext.tab}
      focusAnchor={editorContext.anchor}
      showStopQuickAction={intent.origin !== "positions" && (!intent.snapshot || !isRepairQueueFilter(intent.snapshot.filterId))}
      breadcrumb={(
        <div className="flex min-w-0 items-center gap-1">
          {intent.origin === "positions" && intent.snapshot && (
            <>
              <PositionQueueReturnLink
                filterLabel={intent.snapshot.filterLabel ?? HYBRID_PRIMARY_FILTER_LABELS[intent.snapshot.filterId]}
                onBack={onClose}
              />
              <span className="h-4 w-px shrink-0 bg-[#e7e5e4]" aria-hidden="true" />
            </>
          )}
          <StructuralPositionBreadcrumb
            item={item}
            sections={structureSections}
            allItems={items}
            positionOrderBySection={positionOrderBySection}
            onOpenSection={onOpenStructuralSection ?? (() => {})}
            onRevealSection={onRevealStructuralSection ?? onOpenStructuralSection ?? (() => {})}
            onOpenPosition={onOpenStructuralItem ?? onCurrentIdChange}
          />
        </div>
      )}
      headerMeta={intent.origin === "positions" && intent.snapshot ? (
        <PositionQueueControls
          filterLabel={intent.snapshot.filterLabel ?? HYBRID_PRIMARY_FILTER_LABELS[intent.snapshot.filterId]}
          itemIds={currentSelectionIds}
          currentId={intent.currentId}
          itemsById={itemsById}
          onSelect={onCurrentIdChange}
          previousId={previousQueueId}
          nextId={nextQueueId}
        />
      ) : undefined}
      />
      {moveRequest && itemsById[moveRequest.itemId] && (
        <MoveToSectionPopover
          operation="position"
          entityIds={[moveRequest.itemId]}
          currentSectionIds={[itemsById[moveRequest.itemId].sectionId]}
          sections={structureSections}
          anchor={moveRequest.anchor}
          onClose={() => setMoveRequest(null)}
          onMove={async (targetSectionId) => {
            if (!targetSectionId) return;
            const target = itemsById[moveRequest.itemId];
            const destination = structureSections.find((section) => section.id === targetSectionId);
            if (!target || !destination || target.sectionId === targetSectionId) return;
            const previous = { itemId: target.id, sectionId: target.sectionId, sectionName: target.sectionName };
            moveItem(target.id, targetSectionId, { sectionName: destination.name });
            try {
              await new Promise<void>((resolve) => window.setTimeout(resolve, 350));
              registerChange("catalog");
              setMoveUndo({ ...previous, message: `Позиция перемещена в «${destination.name}»` });
            } catch (error) {
              moveItem(previous.itemId, previous.sectionId, { sectionName: previous.sectionName });
              throw error;
            }
          }}
          onError={() => onFeedback?.("Не удалось переместить. Попробуйте ещё раз")}
        />
      )}
      {moveUndo && (
        <div className="fixed bottom-5 left-1/2 z-[100006] flex -translate-x-1/2 items-center gap-2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">
          <span>{moveUndo.message}</span>
          <span aria-hidden="true" className="text-white/45">·</span>
          <button
            type="button"
            onClick={() => {
              moveItem(moveUndo.itemId, moveUndo.sectionId, { sectionName: moveUndo.sectionName });
              setMoveUndo(null);
              registerChange("catalog");
            }}
            className="rounded-[5px] font-semibold text-[#c9c2ff] outline-none hover:text-white focus-visible:ring-2 focus-visible:ring-white/35"
          >
            Отменить
          </button>
        </div>
      )}
    </div>
  );
}
