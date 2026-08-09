import { getSortableDestinationIndex, moveId } from "./reorder";

export type CatalogReorderPlacement = "before" | "after";
export type CatalogReorderEntityKind = "section" | "item";

export type CatalogSiblingReorderTarget = {
  kind: CatalogReorderEntityKind;
  id: string;
  parentId: string | null;
};

export type CatalogSiblingReorderValidation =
  | { valid: true }
  | { valid: false; reason: string };

/** DnD is intentionally limited to ordering siblings; reparenting uses explicit Move. */
export function validateCatalogSiblingReorder(
  source: CatalogSiblingReorderTarget,
  target: CatalogSiblingReorderTarget,
): CatalogSiblingReorderValidation {
  if (source.id === target.id) return { valid: false, reason: "Элемент уже находится в этой позиции" };
  if (source.kind !== target.kind) return { valid: false, reason: "Можно менять порядок только однотипных элементов" };
  if (source.parentId !== target.parentId) {
    return { valid: false, reason: "Для переноса в другой раздел используйте «Переместить»" };
  }
  return { valid: true };
}

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
  return reorderCatalogIds(ids, draggedId, targetId, targetIndex > fromIndex ? "after" : "before");
}
