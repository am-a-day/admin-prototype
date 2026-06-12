import { Menu } from "lucide-react";
import { SidebarSimple } from "@phosphor-icons/react";
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
  isLaunchPage?: boolean;
};

export function AppHeaderRight({
  onNavigate,
  onResetCatalog,
  showHamburger,
  onOpenMobileMenu,
  onToggleSidebar,
  sidebarCollapsed,
}: AppHeaderRightProps) {
  return (
    <header className="flex h-[59px] shrink-0 items-center px-3 gap-1">

      {/* ── Left: sidebar toggle (desktop) OR logo+hamburger (mobile) ── */}
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
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarCollapsed ? "Развернуть sidebar" : "Свернуть sidebar"}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200/60 hover:text-zinc-600"
        >
          <SidebarSimple size={18} mirrored={sidebarCollapsed} />
        </button>
      ) : null}

      {/* ── Center: organization ── */}
      <div className="flex min-w-0 flex-1 items-center justify-center">
        <OrgMenu variant="text" onNavigate={onNavigate} onResetCatalog={onResetCatalog} />
      </div>

      {/* ── Right: status + account ── */}
      <div className="flex shrink-0 items-center gap-3">
        <PublishStatusControl />
        <UserMenu compact placement="down" onNavigate={onNavigate} />
      </div>
    </header>
  );
}
