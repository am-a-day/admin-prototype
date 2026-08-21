import type { CatalogSectionActionAnchor } from "../sidebar/section-tree";

export type MovePopoverAnchor = CatalogSectionActionAnchor & {
  placement?: "bottom" | "right";
};

export function getMovePopoverAnchor(
  event: Event | React.MouseEvent<HTMLElement>,
  placement: MovePopoverAnchor["placement"] = "bottom",
): MovePopoverAnchor {
  const target = event.currentTarget as HTMLElement;
  const rect = target.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, placement };
}
