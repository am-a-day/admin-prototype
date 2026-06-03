import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SectionId } from "@/data/mock-data";

type Tab = { id: string; label: string; icon: LucideIcon };

type HeaderProps = {
  section: SectionId;
  activeTab: string | null;
  onTabChange: (tab: string) => void;
  tabs: Tab[];
};

export function Header({ activeTab, onTabChange, tabs }: HeaderProps) {
  return (
    <header className="flex h-14 shrink-0 items-center border-b border-border bg-white px-5">
      <div className="flex min-w-0 items-center gap-5">
        {tabs.length > 0 && (
          <div className="flex max-w-[980px] items-center gap-1 overflow-x-auto rounded-2xl bg-zinc-100 p-1 scrollbar-none">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => onTabChange(tab.id)}
                  className={cn(
                    "flex shrink-0 items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-medium transition",
                    activeTab === tab.id
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-950",
                  )}
                >
                  <Icon size={15} />
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
}
