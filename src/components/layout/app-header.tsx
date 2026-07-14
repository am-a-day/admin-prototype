import { ChevronsLeft, ChevronsRight, Menu } from "lucide-react";
import { OrgMenu } from "@/components/layout/account-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { PublishStatusControl } from "@/components/layout/publish-status-control";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { type SectionId } from "@/data/mock-data";

// ── AppHeaderRight: full-width global header ───────────────────────────────────

export type AppHeaderRightProps = {
  onNavigate: (section: SectionId, tab: string) => void;
  onResetCatalog?: () => void;
  showHamburger?: boolean;
  onOpenMobileMenu?: () => void;
  onToggleSidebar?: () => void;
  sidebarCollapsed?: boolean;
  pageTitle?: string;
  isLaunchPage?: boolean;
};

export function AppHeaderRight({
  onNavigate,
  onResetCatalog,
  showHamburger,
  onOpenMobileMenu,
  onToggleSidebar,
  sidebarCollapsed,
  pageTitle,
}: AppHeaderRightProps) {
  return (
    <header className="flex h-[59px] shrink-0 items-center gap-1 bg-[#fbf9f6] pr-3">

      {/* ── Left: mobile logo+hamburger, OR fixed collapse toggle + page title (collapsed) ── */}
      {showHamburger ? (
        <div className="flex shrink-0 items-center gap-2 mr-1">
          <TaskoLogo className="text-zinc-900" />
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-200/70"
            title="Навигация"
          >
            <Menu size={18} />
          </button>
        </div>
      ) : onToggleSidebar ? (
        <div className="flex shrink-0 items-center gap-[7px]">
          <button
            type="button"
            onClick={onToggleSidebar}
            title={sidebarCollapsed ? "Развернуть меню" : "Свернуть меню"}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-lg text-[#79716b] transition hover:bg-white/70 hover:text-[#44403b]"
          >
            {sidebarCollapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          </button>
          {sidebarCollapsed && pageTitle && (
            <span className="shrink-0 text-[12px] leading-4 text-black">{pageTitle}</span>
          )}
        </div>
      ) : sidebarCollapsed && pageTitle ? (
        <div className="flex shrink-0 items-center gap-2">
          <span className="shrink-0 text-[12px] leading-4 text-black">{pageTitle}</span>
        </div>
      ) : null}

      {/* ── Center: organization ── */}
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <OrgMenu variant="text" onNavigate={onNavigate} onResetCatalog={onResetCatalog} />
      </div>

      {/* ── Right: status + account ── */}
      <div className="flex shrink-0 items-center gap-[15px]">
        <PublishStatusControl />
        <UserMenu compact placement="down" onNavigate={onNavigate} />
      </div>
    </header>
  );
}
