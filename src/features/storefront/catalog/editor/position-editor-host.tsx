import { useEffect, useRef, useState } from "react";
import { usePublish } from "@/contexts/publish-context";
import { useCatalogStore } from "@/contexts/catalog-store-context";
import { catalogSections, type CatalogItem } from "@/data/catalog";
import type { CatalogPriceSortDirection, CatalogReturnContext } from "../navigation/types";
import type { OverviewFilterId } from "../model/types";
import type { CatalogSectionCrumb } from "../model/section-path";
import type { CatalogAvailabilityMode, CatalogTreeSection } from "../model/tree";
import { deriveEditorQueue, descriptionHasContent, getQueueEditorContext, type EditorTab } from "./editor-queue";
import { DescriptionQueueComplete } from "./description-queue-complete";
import { PositionQueueControls } from "./editor-queue-controls";
import { PositionEditor, createDefaultWeeklySchedule } from "./position-editor";
import type { MovePopoverAnchor } from "../ui/move-anchor";
import { MoveToSectionPopover } from "../ui/move-to-section-popover";

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

export function PositionEditorHost({
  intent,
  onCurrentIdChange,
  onClose,
  onFeedback,
  onRequestPermanentDelete,
  onRevealItem,
  structureSections = catalogSections,
  presentation = "pane",
}: {
  intent: OpenPositionIntent;
  onCurrentIdChange: (id: string) => void;
  onClose: () => void;
  onFeedback?: (message: string) => void;
  onRequestPermanentDelete?: (item: CatalogItem) => void;
  onRevealItem?: (item: CatalogItem) => void;
  structureSections?: TreeSection[];
  presentation?: "pane" | "dialog";
}) {
  const {
    items,
    itemsById,
    itemOrderBySection,
    autosaveByItem,
    addItem,
    updateItem,
    deleteItem,
    moveItem,
    setItemStatus,
    setItemOrder,
    setAutosaveStatus,
    setActiveEditorItemId,
    upsellByItem,
    setUpsellByItem,
  } = useCatalogStore();
  const { registerChange } = usePublish();
  const [moveRequest, setMoveRequest] = useState<{ itemId: string; anchor: MovePopoverAnchor } | null>(null);
  const [moveUndo, setMoveUndo] = useState<{ itemId: string; sectionId: string; sectionName: string; message: string } | null>(null);
  const saveTimersRef = useRef<Record<string, { save?: number; hide?: number }>>({});
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
  const outsideCurrentSelection = intent.origin === "positions" && !editorQueue.itemIds.includes(intent.currentId);
  const { previousId: previousQueueId, nextId: nextQueueId } = editorQueue;

  useEffect(() => () => {
    Object.values(saveTimersRef.current).forEach(({ save, hide }) => {
      if (save) window.clearTimeout(save);
      if (hide) window.clearTimeout(hide);
    });
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

  const finishAutosave = (itemId: string) => {
    const timers = saveTimersRef.current[itemId] ?? {};
    if (timers.save) window.clearTimeout(timers.save);
    if (timers.hide) window.clearTimeout(timers.hide);
    setAutosaveStatus(itemId, "saved");
    registerChange("catalog");
    timers.hide = window.setTimeout(() => {
      setAutosaveStatus(itemId, "idle");
      delete saveTimersRef.current[itemId];
    }, 1400);
    saveTimersRef.current[itemId] = timers;
  };

  const scheduleAutosave = (itemId: string) => {
    const timers = saveTimersRef.current[itemId] ?? {};
    if (timers.save) window.clearTimeout(timers.save);
    if (timers.hide) window.clearTimeout(timers.hide);
    setAutosaveStatus(itemId, "saving");
    timers.save = window.setTimeout(() => finishAutosave(itemId), 450);
    saveTimersRef.current[itemId] = timers;
  };

  const saveDescription = (target: CatalogItem, value: string) => {
    updateItem(target.id, { description: value, hasDescription: descriptionHasContent(value) });
    scheduleAutosave(target.id);
  };

  const updateAndAutosave = (targetId: string, patch: Partial<CatalogItem>) => {
    updateItem(targetId, patch);
    scheduleAutosave(targetId);
  };

  const navigateToItem = (targetId: string) => {
    if (saveTimersRef.current[item.id]?.save) finishAutosave(item.id);
    onCurrentIdChange(targetId);
  };

  const closeEditor = () => {
    if (saveTimersRef.current[item.id]?.save) finishAutosave(item.id);
    onClose();
  };

  const getAvailabilityMode = (target: CatalogItem): AvailabilityMode => {
    if (target.status === "stopped" || target.status === "coming-soon") return "unavailable";
    return target.scheduled ? "schedule" : "always";
  };

  const setAvailability = (target: CatalogItem, mode: AvailabilityMode) => {
    if (target.status === "archive") return;
    if (mode === "unavailable") setItemStatus(target.id, "stopped");
    else updateItem(target.id, { status: "active", scheduled: mode === "schedule" });
    scheduleAutosave(target.id);
  };

  const duplicateItem = (target: CatalogItem) => {
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `position-copy-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const copy: CatalogItem = {
      ...target,
      id,
      title: `${target.title} — копия`,
      status: "active",
      scheduled: false,
      unavailableDisplayMode: "hidden",
      archivedAvailabilityMode: undefined,
    };
    addItem(copy);
    setItemOrder(target.sectionId, [
      id,
      ...(itemOrderBySection[target.sectionId] ?? items.filter((candidate) => candidate.sectionId === target.sectionId).map((candidate) => candidate.id)),
    ]);
    registerChange("catalog");
    onFeedback?.("Позиция скопирована");
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
      upsell={item.upsell ?? upsellByItem[item.id] ?? {}}
      onUpsellChange={(next) => {
        setUpsellByItem((current) => ({ ...current, [item.id]: next }));
        updateAndAutosave(item.id, { upsell: next });
      }}
      stopBusy={false}
      onArchiveItem={(target) => {
        updateAndAutosave(target.id, {
          status: "archive",
          archivedAvailabilityMode: getAvailabilityMode(target),
        });
        onFeedback?.("Позиция перенесена в архив");
      }}
      onRestoreItem={(target) => {
        const mode = target.archivedAvailabilityMode ?? (target.scheduled ? "schedule" : "always");
        updateAndAutosave(target.id, {
          status: mode === "unavailable" ? "stopped" : "active",
          scheduled: mode === "schedule",
          archivedAvailabilityMode: undefined,
        });
        onFeedback?.("Позиция восстановлена");
      }}
      onMoveItem={(target, anchor) => setMoveRequest({ itemId: target.id, anchor })}
      onSetAvailabilityMode={setAvailability}
      unavailableDisplayMode={item.unavailableDisplayMode ?? (item.status === "coming-soon" ? "comingSoon" : "hidden")}
      outsideScheduleMode={item.outsideScheduleMode ?? "hidden"}
      weeklySchedule={item.weeklySchedule ?? createDefaultWeeklySchedule()}
      onUnavailableDisplayModeChange={(mode) => {
        updateAndAutosave(item.id, { unavailableDisplayMode: mode });
      }}
      onOutsideScheduleModeChange={(mode) => {
        updateAndAutosave(item.id, { outsideScheduleMode: mode });
      }}
      onWeeklyScheduleChange={(schedule) => {
        updateAndAutosave(item.id, { weeklySchedule: schedule });
      }}
      onRequestPermanentDelete={(target) => {
        if (onRequestPermanentDelete) onRequestPermanentDelete(target);
        else {
          deleteItem(target.id);
          closeEditor();
        }
      }}
      onDuplicateItem={duplicateItem}
      onDescriptionChange={saveDescription}
      onDraftChange={(patch) => {
        updateAndAutosave(item.id, patch);
      }}
      onMediaAdded={(target, previewUrl) => {
        updateAndAutosave(target.id, { thumbnailUrl: target.thumbnailUrl ?? previewUrl });
      }}
      onItemChange={(target, patch) => {
        if (patch.upsell) {
          setUpsellByItem((current) => ({ ...current, [target.id]: patch.upsell! }));
        }
        updateAndAutosave(target.id, patch);
      }}
      forcedEditorTab={editorContext.tab}
      focusAnchor={editorContext.anchor}
      onBackEdit={closeEditor}
      detailPane={presentation === "pane"}
      autosaveStatus={autosaveByItem[item.id]?.status ?? "idle"}
      onRetrySave={() => finishAutosave(item.id)}
      headerMeta={editorQueue.itemIds.length > 0 ? (
        <PositionQueueControls
          onSelect={navigateToItem}
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
          onMove={async (targetSectionId, destinationOverride) => {
            if (!targetSectionId) return;
            const target = itemsById[moveRequest.itemId];
            const destination = destinationOverride ?? structureSections.find((section) => section.id === targetSectionId);
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
