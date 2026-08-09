import type { CatalogItem } from "@/data/catalog";

export type CatalogAvailabilityMode = "always" | "unavailable" | "schedule";

export type CatalogTreeSection = {
  id: string;
  parentId?: string | null;
  name: string;
  imageUrl?: string | null;
  emoji?: string;
  sortOrder?: number;
  status?: "active" | "archive";
  visibility?: "visible" | "hidden";
  availabilityMode?: CatalogAvailabilityMode;
  children?: CatalogTreeSection[];
};

export const MAX_CATALOG_SECTION_DEPTH = 2;

export function buildCatalogTree(sections: CatalogTreeSection[]): CatalogTreeSection[] {
  const nodes = new Map(sections.map((section) => [section.id, { ...section, children: [] as CatalogTreeSection[] }]));
  const roots: CatalogTreeSection[] = [];
  for (const node of nodes.values()) {
    const parent = node.parentId ? nodes.get(node.parentId) : undefined;
    (parent ? parent.children : roots).push(node);
  }
  const sortTree = (list: CatalogTreeSection[]) => {
    list.sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.name.localeCompare(right.name, "ru"));
    list.forEach((section) => sortTree(section.children ?? []));
  };
  sortTree(roots);
  return roots;
}

export function flattenCatalogTree(sections: CatalogTreeSection[]): CatalogTreeSection[] {
  return sections.flatMap((section) => [section, ...flattenCatalogTree(section.children ?? [])]);
}

export function getDirectChildSections(parentId: string | null, sections: CatalogTreeSection[]) {
  return sections
    .filter((section) => (section.parentId ?? null) === parentId)
    .sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || left.name.localeCompare(right.name, "ru"));
}

export function countItemsBySection(
  items: CatalogItem[],
  sections: CatalogTreeSection[],
  includeArchived: boolean,
) {
  const parentById = new Map(flattenCatalogTree(sections).map((section) => [section.id, section.parentId ?? null]));
  const counts = new Map<string, number>();
  items.forEach((item) => {
    if (!includeArchived && item.status === "archive") return;
    let current: string | null = item.sectionId;
    const seen = new Set<string>();
    while (current && !seen.has(current)) {
      seen.add(current);
      counts.set(current, (counts.get(current) ?? 0) + 1);
      current = parentById.get(current) ?? null;
    }
  });
  return counts;
}

export function getSectionSubtreeIds(sectionId: string, sections: CatalogTreeSection[]) {
  const result = new Set<string>([sectionId]);
  let changed = true;
  while (changed) {
    changed = false;
    sections.forEach((section) => {
      if (section.parentId && result.has(section.parentId) && !result.has(section.id)) {
        result.add(section.id);
        changed = true;
      }
    });
  }
  return result;
}

export function getSectionTreeDepth(sectionId: string, sections: CatalogTreeSection[]) {
  const byId = new Map(flattenCatalogTree(sections).map((section) => [section.id, section]));
  let depth = 0;
  let current = byId.get(sectionId);
  const seen = new Set<string>();
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    depth += 1;
    current = byId.get(current.parentId);
  }
  return depth;
}

export function isSectionDescendant(
  possibleDescendantId: string,
  ancestorId: string,
  sections: CatalogTreeSection[],
) {
  const byId = new Map(flattenCatalogTree(sections).map((section) => [section.id, section]));
  const seen = new Set<string>();
  let current = byId.get(possibleDescendantId);
  while (current?.parentId && !seen.has(current.id)) {
    seen.add(current.id);
    if (current.parentId === ancestorId) return true;
    current = byId.get(current.parentId);
  }
  return false;
}

export function findSectionPath(sections: CatalogTreeSection[], targetId: string): string[] {
  for (const section of sections) {
    if (section.id === targetId) return [section.id];
    const childPath = findSectionPath(section.children ?? [], targetId);
    if (childPath.length > 0) return [section.id, ...childPath];
  }
  return [];
}

export function filterSectionTree(sections: CatalogTreeSection[], query: string): CatalogTreeSection[] {
  const normalizedQuery = query.trim().toLowerCase();
  if (!normalizedQuery) return sections;

  return sections.flatMap((section) => {
    const children = filterSectionTree(section.children ?? [], normalizedQuery);
    if (section.name.toLowerCase().includes(normalizedQuery) || children.length > 0) {
      return [{ ...section, children }];
    }
    return [];
  });
}

export type CatalogParentAvailability =
  | { available: true }
  | { available: false; reason: "has-positions" | "max-depth"; label: string };

export function getParentAvailability(
  section: CatalogTreeSection,
  allItems: CatalogItem[],
  sections: CatalogTreeSection[] = [],
): CatalogParentAvailability {
  if (allItems.some((item) => item.sectionId === section.id && item.status !== "archive")) {
    return { available: false, reason: "has-positions", label: "В разделе уже есть позиции" };
  }
  if (sections.length > 0 && getSectionTreeDepth(section.id, sections) >= MAX_CATALOG_SECTION_DEPTH) {
    return { available: false, reason: "max-depth", label: "Достигнута максимальная вложенность" };
  }
  return { available: true };
}
