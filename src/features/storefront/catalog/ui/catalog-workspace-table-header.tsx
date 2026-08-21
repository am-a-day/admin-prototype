import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { CATALOG_PAGE_HEADER_CLASS } from "./catalog-layout";

export function CatalogWorkspaceTableHeader({
  children,
  endAction,
  className,
}: {
  children: ReactNode;
  endAction?: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-catalog-workspace-table-header
      className={cn(CATALOG_PAGE_HEADER_CLASS, className)}
    >
      <div data-catalog-workspace-table-title className="min-w-0 flex-1">
        {children}
      </div>
      {endAction}
    </div>
  );
}
