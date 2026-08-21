import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import {
  CATALOG_PAGE_HEADER_CLASS,
  CATALOG_WORKSPACE_TABLE_GAP_CLASS,
} from "./catalog-layout";

export function CatalogWorkspaceTableHeader({
  children,
  endAction,
  showTableGap = true,
  className,
}: {
  children: ReactNode;
  endAction?: ReactNode;
  showTableGap?: boolean;
  className?: string;
}) {
  return (
    <>
      <div
        data-catalog-workspace-table-header
        className={cn(CATALOG_PAGE_HEADER_CLASS, className)}
      >
        <div data-catalog-workspace-table-title className="min-w-0 flex-1">
          {children}
        </div>
        {endAction}
      </div>
      {showTableGap && (
        <div
          data-catalog-workspace-table-gap
          className={CATALOG_WORKSPACE_TABLE_GAP_CLASS}
          aria-hidden="true"
        />
      )}
    </>
  );
}
