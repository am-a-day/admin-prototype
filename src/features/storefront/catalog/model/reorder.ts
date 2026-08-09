import type { CatalogItem } from "@/data/catalog";
import { getSectionTreeDepth, isSectionDescendant, MAX_CATALOG_SECTION_DEPTH, type CatalogTreeSection } from "./tree";

export type CatalogReorderZone = "before" | "after";

export function orderSectionItems<T extends { id: string }>(items: T[], order: string[] | undefined): T[] {
  if (!order?.length) return items;
  const positions = new Map(order.map((id, index) => [id, index]));
  return [...items].sort((left, right) =>
    (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER),
  );
}

export function orderItemsByPositionOrder<T extends { id: string; sectionId: string }>(
  items: T[],
  orders: Record<string, string[]>,
) {
  const originalIndexes = new Map(items.map((item, index) => [item.id, index]));
  return [...items].sort((left, right) => {
    if (left.sectionId !== right.sectionId) {
      return (originalIndexes.get(left.id) ?? 0) - (originalIndexes.get(right.id) ?? 0);
    }
    const order = orders[left.sectionId];
    if (!order?.length) return (originalIndexes.get(left.id) ?? 0) - (originalIndexes.get(right.id) ?? 0);
    const positions = new Map(order.map((id, index) => [id, index]));
    return (positions.get(left.id) ?? Number.MAX_SAFE_INTEGER) - (positions.get(right.id) ?? Number.MAX_SAFE_INTEGER)
      || (originalIndexes.get(left.id) ?? 0) - (originalIndexes.get(right.id) ?? 0);
  });
}

export function cloneStringArrayRecord(record: Record<string, string[]>) {
  return Object.fromEntries(Object.entries(record).map(([key, ids]) => [key, [...ids]]));
}

export function getSortableDestinationIndex(fromIndex: number, overIndex: number, zone: CatalogReorderZone) {
  if (zone === "before") return fromIndex < overIndex ? overIndex - 1 : overIndex;
  return fromIndex < overIndex ? overIndex : overIndex + 1;
}

export function moveId<T>(ids: T[], fromIndex: number, toIndex: number) {
  const next = [...ids];
  const [moved] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, moved);
  return next;
}

export type CatalogTreeDropSource = {
  kind: "section" | "item";
  id: string;
  parentId: string | null;
};

export type CatalogTreeDropIntent =
  | { type: "inside"; parentId: string; index: number }
  | { type: "between"; parentId: string | null; index: number };

export type CatalogTreeValidation = { valid: true } | { valid: false; reason: string };

export type CatalogTreeDndModel = { sections: CatalogTreeSection[]; items: CatalogItem[] };

export function validateCatalogTreeDrop(
  source: CatalogTreeDropSource,
  intent: CatalogTreeDropIntent,
  model: CatalogTreeDndModel,
): CatalogTreeValidation {
  const targetParentId = intent.parentId;
  if (source.kind === "item" && targetParentId === null) {
    return { valid: false, reason: "Позицию нельзя разместить в корне" };
  }
  if (targetParentId !== null && !model.sections.some((section) => section.id === targetParentId)) {
    return { valid: false, reason: "Родительский раздел не найден" };
  }
  if (source.kind === "section" && targetParentId === source.id) {
    return { valid: false, reason: "Раздел нельзя переместить внутрь себя" };
  }
  if (
    source.kind === "section"
    && targetParentId !== null
    && isSectionDescendant(targetParentId, source.id, model.sections)
  ) {
    return { valid: false, reason: "Раздел нельзя переместить в собственный подраздел" };
  }
  if (intent.type === "between" && targetParentId === source.parentId) {
    return { valid: true };
  }
  if (
    source.kind === "section"
    && targetParentId !== null
    && getSectionTreeDepth(targetParentId, model.sections) >= MAX_CATALOG_SECTION_DEPTH
  ) {
    return { valid: false, reason: "Достигнута максимальная вложенность" };
  }

  const directSections = model.sections.filter((section) => (section.parentId ?? null) === targetParentId);
  const directItems = targetParentId === null
    ? []
    : model.items.filter((item) => item.sectionId === targetParentId);
  if (directSections.length > 0 && directItems.length > 0) {
    return { valid: false, reason: "В разделе уже смешаны подразделы и позиции" };
  }
  if (source.kind === "section" && directItems.length > 0) {
    return { valid: false, reason: "Раздел нельзя разместить рядом с позицией" };
  }
  if (source.kind === "item" && directSections.length > 0) {
    return { valid: false, reason: "Позицию нельзя разместить рядом с подразделом" };
  }
  return { valid: true };
}
