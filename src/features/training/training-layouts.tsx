import { useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, ExternalLink, LogOut, Menu, UserCircle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { useVitrineStatus } from "@/lib/use-vitrine-status";
import { cn } from "@/lib/utils";
import { TrainingPage } from "./training-page";
import { TrainingTabs } from "./training-tabs";
import type { TrainingTab } from "./training-data";

function getInitialTrainingTab(): TrainingTab {
  const path = window.location.pathname.replace(/\/+$/, "");
  const tab = path.split("/")[2];
  if (tab === "cards" || tab === "menu") return "cards";
  if (tab === "progress") return "progress";
  return "trainer";
}

export function OwnerTrainingLayout({
  activeTab,
  onQuizActiveChange,
}: {
  activeTab: TrainingTab;
  onQuizActiveChange?: (active: boolean) => void;
}) {
  const { webAddress } = useVitrineStatus();
  return <TrainingPage activeTab={activeTab} menuUrl={`https://${webAddress}`} onQuizActiveChange={onQuizActiveChange} />;
}

export function WaiterTrainingLayout() {
  const [activeTab, setActiveTab] = useState<TrainingTab>(() => getInitialTrainingTab());
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [quizActive, setQuizActive] = useState(false);
  const { webAddress } = useVitrineStatus();
  const menuUrl = `https://${webAddress}`;

  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDrawerOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  const navigate = (tab: TrainingTab) => {
    setActiveTab(tab);
    setDrawerOpen(false);
  };

  return (
    <div className="flex h-screen min-w-0 flex-col overflow-hidden bg-[#fbf9f6] text-[#292524]">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-[#e7e5e4] bg-white px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-3">
          <button
            type="button"
            onClick={() => setDrawerOpen(true)}
            className="flex h-9 w-9 items-center justify-center rounded-[10px] text-[#57534d] hover:bg-[#f5f5f4] md:hidden"
            aria-label="Открыть меню"
          >
            <Menu size={20} />
          </button>
          <div className="hidden sm:block">
            <TaskoLogo className="text-[#292524]" />
          </div>
          <div className="text-sm font-black tracking-tight text-[#292524] sm:hidden">Tasko</div>
          <div className="hidden h-5 w-px bg-[#e7e5e4] sm:block" />
          <div className="hidden text-sm font-semibold text-[#79716b] sm:block">Обучение</div>
        </div>

        <nav className={cn("hidden md:block", quizActive && "md:hidden")}>
          <TrainingTabs value={activeTab} onChange={setActiveTab} />
        </nav>

        {!quizActive && (
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="sm" asChild className="hidden shrink-0 lg:inline-flex">
              <a href={menuUrl} target="_blank" rel="noreferrer">
                <ExternalLink size={16} />
                Открыть меню
              </a>
            </Button>
            <ProfileMenu />
          </div>
        )}
      </header>

      <main className="min-h-0 min-w-0 flex-1 overflow-hidden">
        <TrainingPage activeTab={activeTab} menuUrl={menuUrl} onQuizActiveChange={setQuizActive} />
      </main>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity md:hidden",
          drawerOpen ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={() => setDrawerOpen(false)}
      />
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-white shadow-2xl transition-transform md:hidden",
          drawerOpen ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex h-14 items-center justify-between border-b border-[#e7e5e4] px-4">
          <div>
            <div className="text-sm font-black text-[#292524]">Tasko</div>
            <div className="text-xs text-[#79716b]">Обучение</div>
          </div>
          <button
            type="button"
            onClick={() => setDrawerOpen(false)}
            className="flex h-8 w-8 items-center justify-center rounded-[10px] text-[#79716b] hover:bg-[#f5f5f4]"
            aria-label="Закрыть меню"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-1 p-3">
          <DrawerItem label="Тренажёр" active={activeTab === "trainer"} onClick={() => navigate("trainer")} />
          <DrawerItem label="Карточки" active={activeTab === "cards"} onClick={() => navigate("cards")} />
          <DrawerItem label="Прогресс" active={activeTab === "progress"} onClick={() => navigate("progress")} />
        </div>
        <div className="mt-auto border-t border-[#e7e5e4] p-3">
          <a
            href={menuUrl}
            target="_blank"
            rel="noreferrer"
            className="mb-1 flex h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-semibold text-[#57534d] transition hover:bg-[#fbfbf9] hover:text-[#292524]"
          >
            <ExternalLink size={16} />
            Открыть меню заведения
          </a>
          <DrawerItem label="Выйти" icon={LogOut} onClick={() => setDrawerOpen(false)} />
        </div>
      </aside>
    </div>
  );
}

function ProfileMenu() {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button type="button" variant="outline" size="sm" className="hidden shrink-0 md:inline-flex">
          <UserCircle size={16} />
          Профиль
          <ChevronDown size={14} />
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={6}
          className="z-[100] w-44 rounded-[14px] border border-[#e7e5e4] bg-white p-1.5 shadow-xl shadow-zinc-300/40"
        >
          <DropdownMenu.Item className="flex h-9 cursor-default items-center gap-2 rounded-[10px] px-2.5 text-sm font-medium text-[#57534d] outline-none">
            <UserCircle size={16} />
            Официант
          </DropdownMenu.Item>
          <DropdownMenu.Separator className="my-1 h-px bg-[#e7e5e4]" />
          <DropdownMenu.Item className="flex h-9 cursor-default items-center gap-2 rounded-[10px] px-2.5 text-sm font-medium text-[#57534d] outline-none">
            <LogOut size={16} />
            Выйти
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function DrawerItem({
  label,
  active,
  icon: Icon,
  onClick,
}: {
  label: string;
  active?: boolean;
  icon?: typeof LogOut;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex h-10 w-full items-center gap-2 rounded-[10px] px-3 text-left text-sm font-semibold transition",
        active ? "bg-[#f5f5f4] text-[#292524]" : "text-[#57534d] hover:bg-[#fbfbf9] hover:text-[#292524]",
      )}
    >
      {Icon && <Icon size={16} />}
      {label}
    </button>
  );
}
