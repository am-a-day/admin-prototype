import { getSortableDestinationIndex, moveId } from "./reorder";

export type CatalogReorderPlacement = "before" | "after";

/** Canonical order operation shared by table and composition reorder adapters. */
export function reorderCatalogIds(
  ids: readonly string[],
  draggedId: string,
  targetId: string,
  placement: CatalogReorderPlacement,
) {
  const fromIndex = ids.indexOf(draggedId);
  const overIndex = ids.indexOf(targetId);
  if (fromIndex < 0 || overIndex < 0 || draggedId === targetId) return [...ids];
  return moveId([...ids], fromIndex, getSortableDestinationIndex(fromIndex, overIndex, placement));
}

/** Canonical direct-index reorder used by the legacy composition/table adapters. */
export function moveCatalogIdToIndex(ids: readonly string[], draggedId: string, targetId: string) {
  const fromIndex = ids.indexOf(draggedId);
  const targetIndex = ids.indexOf(targetId);
  if (fromIndex < 0 || targetIndex < 0 || draggedId === targetId) return [...ids];
  return moveId([...ids], fromIndex, targetIndex);
}

/** Canonical cross-section order operation. The UI supplies placement-derived index. */
export function moveCatalogItemIds(
  sourceIds: readonly string[],
  targetIds: readonly string[],
  draggedId: string,
  targetIndex: number,
) {
  const nextSourceIds = sourceIds.filter((id) => id !== draggedId);
  const nextTargetIds = targetIds.filter((id) => id !== draggedId);
  nextTargetIds.splice(Math.max(0, Math.min(targetIndex, nextTargetIds.length)), 0, draggedId);
  return { sourceIds: nextSourceIds, targetIds: nextTargetIds };
}
