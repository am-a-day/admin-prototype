import type { OverviewFilterId } from "../model/types";

export type EditorTab = "basic" | "promo" | "options" | "display";
export type EditorFocusAnchor = "description" | "media" | "weight" | "kbju";

export type EditorQueueNavigation = {
  itemIds: string[];
  queueIndex: number;
  previousId: string | null;
  nextId: string | null;
};

/**
 * Derives the stable navigation window for an open position.
 *
 * The caller owns the source selection and the current catalog snapshot. This
 * helper only removes ids that no longer exist and calculates the adjacent
 * entries; it does not change ordering, filtering, or persistence semantics.
 */
export function deriveEditorQueue(
  candidateIds: readonly string[],
  currentId: string,
  existingIds: ReadonlySet<string>,
): EditorQueueNavigation {
  const itemIds = candidateIds.filter((id) => existingIds.has(id));
  const queueIndex = itemIds.indexOf(currentId);
  return {
    itemIds,
    queueIndex,
    previousId: queueIndex > 0 ? itemIds[queueIndex - 1] : null,
    nextId: queueIndex >= 0 && queueIndex < itemIds.length - 1 ? itemIds[queueIndex + 1] : null,
  };
}

const REPAIR_QUEUE_FILTER_IDS: OverviewFilterId[] = [
  "quick:no-description",
  "quick:no-photo",
  "quick:no-weight",
  "quick:no-kbju",
  "quick:no-translation",
  "quick:no-recommendations",
  "status:stop",
];

const AUDIT_QUEUE_EDITOR_CONTEXT: Partial<Record<OverviewFilterId, { tab: EditorTab; anchor?: EditorFocusAnchor }>> = {
  "quick:no-description": { tab: "basic", anchor: "description" },
  "quick:no-photo": { tab: "basic", anchor: "media" },
  "quick:no-weight": { tab: "basic", anchor: "weight" },
  "quick:no-kbju": { tab: "basic", anchor: "kbju" },
  "quick:no-translation": { tab: "basic" },
  "quick:no-recommendations": { tab: "promo" },
  "status:stop": { tab: "basic" },
};

export function isRepairQueueFilter(id: OverviewFilterId) {
  return REPAIR_QUEUE_FILTER_IDS.includes(id);
}

export function getQueueEditorContext(id: OverviewFilterId): { tab: EditorTab; anchor?: EditorFocusAnchor } {
  return AUDIT_QUEUE_EDITOR_CONTEXT[id] ?? { tab: "basic" };
}

export function descriptionHasContent(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&[a-z]+;/gi, " ")
    .trim().length > 0;
}
