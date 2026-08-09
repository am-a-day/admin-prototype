import type { CatalogTreeSection } from "./tree";

export type CatalogSectionCrumb = { id: string; name: string };

export function getCatalogSectionPathFromSections(
  sectionId: string | null,
  sections: Pick<CatalogTreeSection, "id" | "name" | "parentId">[],
): CatalogSectionCrumb[] {
  if (!sectionId) return [];
  const byId = new Map(sections.map((section) => [section.id, section]));
  const path: CatalogSectionCrumb[] = [];
  const visited = new Set<string>();
  let current = byId.get(sectionId) ?? null;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    path.unshift({ id: current.id, name: current.name });
    current = current.parentId ? byId.get(current.parentId) ?? null : null;
  }
  return path;
}
