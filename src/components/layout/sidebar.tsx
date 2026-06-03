import { useEffect, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  ClipboardList,
  Home,
  LayoutGrid,
  Menu,
  Palette,
  ShoppingBag,
  Sparkles,
  Truck,
  X,
} from "lucide-react";
import { AccountMenu } from "@/components/layout/account-menu";
import { LanguageSwitcher } from "@/components/layout/language-switcher";
import { VitrineStatus } from "@/components/layout/vitrine-status";
import { cn } from "@/lib/utils";
import { RESTAURANT_NAME, type SectionId } from "@/data/mock-data";
import { usePlan } from "@/contexts/plan-context";

export type SidebarMode = "full" | "rail" | "topbar";

type NavItem = {
  label: string;
  section: SectionId;
  tab: string;
  icon: LucideIcon;
};

type NavGroup = {
  title: string;
  items: NavItem[];
  trailingCta?: { label: string; section: SectionId; tab: string };
};

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Витрина",
    items: [
      { label: "Главная", section: "storefront", tab: "home", icon: Home },
      { label: "Каталог", section: "storefront", tab: "catalog", icon: LayoutGrid },
      { label: "Рекомендации", section: "storefront", tab: "upsell", icon: Sparkles },
      { label: "Оформление", section: "storefront", tab: "appearance", icon: Palette },
      { label: "О заведении", section: "storefront", tab: "about", icon: Building2 },
    ],
    trailingCta: { label: "Улучшить тариф", section: "management", tab: "billing" },
  },
  {
    title: "Заказы",
    items: [
      { label: "История заказов", section: "management", tab: "order-history", icon: ClipboardList },
      { label: "Настройка заказов", section: "management", tab: "order-settings", icon: Truck },
    ],
  },
  {
    title: "Аналитика",
    items: [
      { label: "Сканирования", section: "analytics", tab: "scans", icon: BarChart3 },
      { label: "Продажи", section: "analytics", tab: "orders", icon: ShoppingBag },
      { label: "Лайки", section: "analytics", tab: "likes", icon: Sparkles },
    ],
  },
];

// ── Shared nav list ────────────────────────────────────────────────────────────

function NavList({
  section,
  activeTab,
  onNavigate,
  compact,
}: {
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
  compact: boolean;
}) {
  const { planId } = usePlan();
  return (
    <nav className={cn("flex-1 overflow-y-auto py-1", compact ? "px-1 space-y-1" : "px-2 space-y-4 pb-3 pt-1")}>
      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          {!compact && (
            <div className="mb-1 px-2 text-[10px] font-black uppercase tracking-wide text-zinc-400">
              {group.title}
            </div>
          )}
          {compact && <div className="my-1 h-px bg-border" />}
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = section === item.section && activeTab === item.tab;
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => onNavigate(item.section, item.tab)}
                  title={compact ? item.label : undefined}
                  className={cn(
                    "group relative flex items-center rounded-lg transition",
                    compact
                      ? "h-9 w-9 justify-center"
                      : "w-full gap-2 px-2 py-1.5 text-left text-[13px]",
                    active
                      ? "bg-blue-50 text-blue-700"
                      : "text-zinc-600 hover:bg-zinc-100 hover:text-zinc-950",
                    active && !compact && "font-bold",
                    !active && !compact && "font-medium",
                  )}
                >
                  <Icon size={compact ? 17 : 15} className="shrink-0" />
                  {!compact && <span className="truncate">{item.label}</span>}
                  {compact && (
                    <span className="pointer-events-none absolute left-11 z-50 hidden whitespace-nowrap rounded-lg bg-zinc-950 px-2 py-1 text-xs text-white shadow-xl group-hover:block">
                      {item.label}
                    </span>
                  )}
                </button>
              );
            })}
            {group.trailingCta && planId === "Zero" && (
              <button
                type="button"
                onClick={() => onNavigate(group.trailingCta!.section, group.trailingCta!.tab)}
                title={compact ? group.trailingCta.label : undefined}
                className={cn(
                  "group relative flex items-center rounded-lg transition",
                  compact
                    ? "h-9 w-9 justify-center text-blue-500 hover:bg-blue-50"
                    : "w-full gap-2 px-2 py-1.5 text-left text-[13px] font-medium text-blue-600 hover:bg-blue-50/60",
                )}
              >
                <Sparkles size={compact ? 17 : 13} className="shrink-0 text-blue-500" />
                {!compact && <span className="truncate">{group.trailingCta.label}</span>}
                {compact && (
                  <span className="pointer-events-none absolute left-11 z-50 hidden whitespace-nowrap rounded-lg bg-zinc-950 px-2 py-1 text-xs text-white shadow-xl group-hover:block">
                    {group.trailingCta.label}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      ))}
    </nav>
  );
}

// ── Plan status row (Lite / Ultra only) ───────────────────────────────────────

function PlanStatusRow({
  onNavigate,
  compact = false,
}: {
  onNavigate: (section: SectionId, tab: string) => void;
  compact?: boolean;
}) {
  const { planId, expiresLabel } = usePlan();
  if (planId === "Zero") return null;

  const label = `${planId} · ${expiresLabel}`;

  if (compact) {
    return (
      <button
        type="button"
        onClick={() => onNavigate("management", "billing")}
        title={label}
        className="group relative flex h-9 w-9 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
      >
        <span className="text-[8px] font-black leading-none text-zinc-500">{planId[0]}</span>
        <span className="pointer-events-none absolute left-11 z-50 hidden whitespace-nowrap rounded-lg bg-zinc-950 px-2 py-1 text-xs text-white shadow-xl group-hover:block">
          {label}
        </span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => onNavigate("management", "billing")}
      className="flex w-full items-center rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-100"
    >
      <span className="text-xs font-medium text-zinc-500">{label}</span>
    </button>
  );
}

// ── Shared drawer (used by rail and topbar) ───────────────────────────────────

function NavDrawer({
  open,
  onClose,
  section,
  activeTab,
  onNavigate,
}: {
  open: boolean;
  onClose: () => void;
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
}) {
  const drawerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const handleNavigate = (s: SectionId, t: string) => {
    onNavigate(s, t);
    onClose();
  };

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-black/30 transition-opacity duration-200",
          open ? "opacity-100" : "pointer-events-none opacity-0",
        )}
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        ref={drawerRef}
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col bg-white shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <div className="flex items-center gap-2">
            <AccountMenu onNavigate={handleNavigate} />
            <span className="truncate text-sm font-black">{RESTAURANT_NAME}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X size={15} />
          </button>
        </div>
        <NavList section={section} activeTab={activeTab} onNavigate={handleNavigate} compact={false} />
        <div className="border-t border-border px-2 py-2 flex flex-col gap-1">
          <VitrineStatus />
          <PlanStatusRow onNavigate={handleNavigate} />
          <LanguageSwitcher />
        </div>
      </div>
    </>
  );
}

// ── Full sidebar ───────────────────────────────────────────────────────────────

type NavProps = {
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
};

function FullSidebar({ section, activeTab, onNavigate }: NavProps) {
  return (
    <>
      <div className="flex items-center gap-2 px-2.5 py-3">
        <AccountMenu onNavigate={onNavigate} />
        <span className="truncate text-sm font-black tracking-tight">{RESTAURANT_NAME}</span>
      </div>
      <NavList section={section} activeTab={activeTab} onNavigate={onNavigate} compact={false} />
      <div className="border-t border-border px-2 py-2 flex flex-col gap-1">
        <VitrineStatus compact={false} />
        <PlanStatusRow onNavigate={onNavigate} />
        <LanguageSwitcher compact={false} />
      </div>
    </>
  );
}

// ── Rail sidebar (icons + hamburger that opens drawer) ────────────────────────

function RailSidebar({ section, activeTab, onNavigate }: NavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);

  return (
    <>
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        section={section}
        activeTab={activeTab}
        onNavigate={onNavigate}
      />
      <div className="flex flex-col items-center gap-1 py-2">
        <AccountMenu onNavigate={onNavigate} />
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          title="Меню"
        >
          <Menu size={18} />
        </button>
      </div>
      <NavList section={section} activeTab={activeTab} onNavigate={onNavigate} compact={true} />
      <div className="flex flex-col items-center gap-1 border-t border-border py-2">
        <VitrineStatus />
        <PlanStatusRow compact onNavigate={onNavigate} />
        <LanguageSwitcher />
      </div>
    </>
  );
}

// ── Sidebar (full / rail only — topbar mode returns null) ──────────────────────

type SidebarProps = NavProps & {
  mode: SidebarMode;
  dragging?: boolean;
};

export function Sidebar({ section, activeTab, onNavigate, mode, dragging }: SidebarProps) {
  if (mode === "topbar") return null;

  const isRail = mode === "rail";

  return (
    <aside
      className={cn(
        "flex shrink-0 flex-col border-r border-border bg-white overflow-hidden",
        !dragging && "transition-[width] duration-300 ease-out",
        isRail ? "w-11" : "w-48",
      )}
    >
      {isRail ? (
        <RailSidebar section={section} activeTab={activeTab} onNavigate={onNavigate} />
      ) : (
        <FullSidebar section={section} activeTab={activeTab} onNavigate={onNavigate} />
      )}
    </aside>
  );
}

// ── TopBar (small viewport — replaces sidebar entirely) ───────────────────────

function getPageTitle(section: SectionId, activeTab: string | null): string {
  if (section === "qr") return "QR-меню";
  if (section === "am") return "";

  const allItems = NAV_GROUPS.flatMap((g) => g.items);
  const match = allItems.find((i) => i.section === section && i.tab === activeTab);
  return match?.label ?? "";
}

export function TopBar({ section, activeTab, onNavigate }: NavProps) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = getPageTitle(section, activeTab);

  return (
    <>
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        section={section}
        activeTab={activeTab}
        onNavigate={onNavigate}
      />
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-white px-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          title="Меню"
        >
          <Menu size={18} />
        </button>
        {title && (
          <span className="text-sm font-semibold text-zinc-800 truncate">{title}</span>
        )}
      </header>
    </>
  );
}
