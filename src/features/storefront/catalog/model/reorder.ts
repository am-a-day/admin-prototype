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
