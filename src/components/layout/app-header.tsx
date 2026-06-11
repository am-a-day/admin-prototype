import { Loader2, Menu } from "lucide-react";
import { SidebarSimple } from "@phosphor-icons/react";
import { OrgMenu } from "@/components/layout/account-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { usePublish } from "@/contexts/publish-context";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { type SectionId } from "@/data/mock-data";

// ── Publish button ────────────────────────────────────────────────────────────

function PublishButton({ isLaunchPage }: { isLaunchPage?: boolean }) {
  const { totalChanges, publishPhase, startPublish } = usePublish();
  const { stage } = useVitrineLaunch();

  // On the launch page itself, suppress the launch CTA — the page already shows it
  if (!isLaunchPage) {
    if (stage === "preparing" || stage === "ready") {
      return (
        <button type="button" className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-zinc-600 transition hover:bg-zinc-50">
          {stage === "ready" ? "Отправить на запуск" : "Продолжить запуск"}
        </button>
      );
    }
    if (stage === "pending") {
      return <span className="text-xs text-zinc-400">Менеджер проверяет витрину</span>;
    }
  }

  if (publishPhase === "publishing") {
    return (
      <button type="button" disabled className="flex h-8 items-center gap-1.5 rounded-xl bg-blue-400 px-4 text-sm font-semibold text-white">
        <Loader2 size={13} className="animate-spin" />
        Публикуем…
      </button>
    );
  }

  // Нет изменений — кнопка всегда на месте, но задизейблена.
  if (totalChanges === 0) {
    return (
      <button
        type="button"
        disabled
        title="Изменений нет. Витрина актуальна."
        className="flex h-8 cursor-not-allowed items-center justify-center rounded-xl bg-zinc-100 px-4 text-sm font-semibold text-zinc-400"
      >
        Опубликовано
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => startPublish()}
      className="flex h-8 items-center justify-center rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white transition hover:bg-blue-700"
    >
      Опубликовать
    </button>
  );
}

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
  isLaunchPage,
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

      {/* ── Right: account + publish ── */}
      <div className="flex shrink-0 items-center gap-3">
        <UserMenu compact placement="down" onNavigate={onNavigate} />
        <PublishButton isLaunchPage={isLaunchPage} />
      </div>
    </header>
  );
}
