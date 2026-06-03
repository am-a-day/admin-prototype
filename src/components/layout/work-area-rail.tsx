import { OrgMenu } from "@/components/layout/account-menu";
import { UserMenu } from "@/components/layout/user-menu";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { cn } from "@/lib/utils";
import { type SectionId } from "@/data/mock-data";
import { WORK_AREAS, getActiveArea, getWorkArea, type WorkArea } from "@/lib/work-areas";

// ── Progress ring for the launch rail icon ─────────────────────────────────────

function LaunchRing() {
  const { requiredCompletedCount, requiredTotalCount, stage } = useVitrineLaunch();
  const size = 20;
  const r = size / 2 - 2;
  const circ = 2 * Math.PI * r;
  const pct = requiredTotalCount > 0 ? requiredCompletedCount / requiredTotalCount : 0;
  const complete = stage !== "preparing";

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="2" stroke="currentColor" className="text-zinc-200" />
      {pct > 0 && (
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" strokeWidth="2"
          stroke="currentColor" strokeLinecap="round"
          strokeDasharray={circ} strokeDashoffset={circ * (1 - pct)}
          className={cn("transition-all duration-500", complete ? "text-emerald-500" : "text-blue-500")}
        />
      )}
    </svg>
  );
}

// ── Rail icon ──────────────────────────────────────────────────────────────────

function RailIcon({
  area,
  active,
  onClick,
}: {
  area: WorkArea;
  active: boolean;
  onClick: () => void;
}) {
  const Icon = area.icon;
  const isLaunch = area.id === "launch";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "group relative flex h-10 w-10 items-center justify-center rounded-xl transition",
        active
          ? "bg-zinc-100 text-zinc-950"
          : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700",
      )}
    >
      {/* Active indicator bar */}
      {active && (
        <span className="absolute -left-2 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-zinc-900" />
      )}
      {isLaunch ? <LaunchRing /> : <Icon size={19} className="shrink-0" />}
      {/* Tooltip */}
      <span className="pointer-events-none absolute left-12 z-50 hidden whitespace-nowrap rounded-lg bg-zinc-950 px-2 py-1 text-xs font-medium text-white shadow-xl group-hover:block">
        {area.tooltip}
      </span>
    </button>
  );
}

// ── Narrow rail (single column) ──────────────────────────────────────────────

type WorkAreaRailProps = {
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
  onResetCatalog?: () => void;
};

export function WorkAreaRail({ section, activeTab, onNavigate, onResetCatalog }: WorkAreaRailProps) {
  const { stage } = useVitrineLaunch();
  const activeArea = getActiveArea(section, activeTab);

  const handleAreaClick = (area: WorkArea) => {
    const first = area.pages.find((p) => !p.soon) ?? area.pages[0];
    if (first && !first.soon) onNavigate(first.section, first.tab);
  };

  // Hide launch area once vitrine is active
  const visibleAreas = WORK_AREAS.filter((a) => !(a.id === "launch" && stage === "active"));

  return (
    <aside className="flex w-14 shrink-0 flex-col items-center overflow-hidden rounded-xl border border-zinc-200/80 bg-white py-3 shadow-sm">
      <div className="mb-3">
        <OrgMenu variant="rail" onNavigate={onNavigate} onResetCatalog={onResetCatalog} />
      </div>
      <nav className="flex flex-1 flex-col items-center gap-1">
        {visibleAreas.map((area) => (
          <RailIcon
            key={area.id}
            area={area}
            active={activeArea === area.id}
            onClick={() => handleAreaClick(area)}
          />
        ))}
      </nav>
      <div className="mt-2">
        <UserMenu compact onNavigate={onNavigate} />
      </div>
    </aside>
  );
}

// ── Header sub-page tabs (second-level nav) ──────────────────────────────────

export function WorkAreaTabs({
  section,
  activeTab,
  onNavigate,
}: {
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
}) {
  const area = getWorkArea(getActiveArea(section, activeTab));

  // Launch area has a single page — no need for tabs
  if (area.pages.length <= 1) return null;

  return (
    <div className="flex items-center gap-1 overflow-x-auto scrollbar-none">
      {area.pages.map((page) => {
        const active = section === page.section && activeTab === page.tab;
        if (page.soon) {
          return (
            <span
              key={page.label}
              className="flex shrink-0 items-center gap-1.5 rounded-lg px-2.5 py-1 text-[13px] font-medium text-zinc-300"
            >
              {page.label}
              <span className="rounded bg-zinc-100 px-1 py-px text-[9px] font-bold uppercase text-zinc-400">
                Скоро
              </span>
            </span>
          );
        }
        return (
          <button
            key={page.label}
            type="button"
            onClick={() => onNavigate(page.section, page.tab)}
            className={cn(
              "shrink-0 rounded-lg px-2.5 py-1 text-[13px] transition",
              active
                ? "bg-zinc-100 font-semibold text-zinc-950"
                : "font-medium text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800",
            )}
          >
            {page.label}
          </button>
        );
      })}
    </div>
  );
}
