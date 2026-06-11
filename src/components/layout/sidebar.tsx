import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  Ellipsis,
  FileSearch,
  Import,
  Menu,
  QrCode,
  Tag,
  X,
} from "lucide-react";
import {
  ClipboardText,
  ClockCounterClockwise,
  Coins,
  ForkKnife,
  House,
  MagicWand,
  Package,
  PushPin,
  Scan,
  Swatches,
  ThumbsUp,
  type Icon,
} from "@phosphor-icons/react";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { PlanWidget } from "@/components/layout/plan-widget";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { MiniLogo } from "@/components/ui/mini-logo";
import { cn } from "@/lib/utils";
import { RESTAURANT_NAME, type SectionId } from "@/data/mock-data";

export type SidebarMode = "full" | "rail" | "topbar";

type NavItem = {
  label: string;
  section: SectionId;
  tab: string;
  icon: Icon;
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
      { label: "Каталог", section: "storefront", tab: "catalog", icon: ForkKnife },
      { label: "Главная витрины", section: "storefront", tab: "home", icon: House },
      { label: "Рекомендации", section: "storefront", tab: "upsell", icon: MagicWand },
      { label: "Оформление", section: "storefront", tab: "appearance", icon: Swatches },
      { label: "О заведении", section: "storefront", tab: "about", icon: ClipboardText },
    ],
    trailingCta: { label: "Улучшить тариф", section: "management", tab: "billing" },
  },
  {
    title: "Заказы",
    items: [
      { label: "Прием заказов", section: "management", tab: "order-settings", icon: Package },
      { label: "История заказов", section: "management", tab: "order-history", icon: ClockCounterClockwise },
    ],
  },
  {
    title: "Аналитика",
    items: [
      { label: "Сканирования", section: "analytics", tab: "scans", icon: Scan },
      { label: "Продажи", section: "analytics", tab: "orders", icon: Coins },
      { label: "Лайки", section: "analytics", tab: "likes", icon: ThumbsUp },
    ],
  },
];


// ── «Ещё» items ───────────────────────────────────────────────────────────────

type MoreItem =
  | { label: string; icon: LucideIcon; section: SectionId; tab: string; soon?: false }
  | { label: string; icon: LucideIcon; soon: true };

const MORE_ITEMS: MoreItem[] = [
  { label: "QR-коды",         icon: QrCode,     section: "qr",         tab: "qr"   },
  { label: "Промокоды",       icon: Tag,         soon: true                          },
  { label: "SEO",             icon: FileSearch,  section: "management", tab: "seo"  },
  { label: "Импорт / экспорт",icon: Import,      section: "management", tab: "io"   },
];

function MoreMenu({
  compact,
  section,
  activeTab,
  onNavigate,
}: {
  compact: boolean;
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  // Активен, если текущая страница находится среди «Ещё»-пунктов
  const isMoreActive = MORE_ITEMS.some(
    (item) =>
      !item.soon &&
      section === item.section &&
      activeTab === item.tab,
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (document.getElementById("more-menu-popup")?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.top, left: rect.right + 6 });
    }
    setOpen((v) => !v);
  };

  const handleNavigate = (s: SectionId, t: string) => {
    onNavigate(s, t);
    setOpen(false);
  };

  return (
    <>
      <Tooltip label="Ещё" disabled={!compact}>
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            "flex items-center rounded-lg transition",
            compact ? "h-8 w-8 justify-center" : "w-full gap-2 px-2 py-[5px] text-left text-[13px] font-medium",
            isMoreActive || open
              ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200/70"
              : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
          )}
        >
          <Ellipsis size={compact ? 17 : 15} className="shrink-0" />
          {!compact && <span>Ещё</span>}
        </button>
      </Tooltip>

      {open && createPortal(
        <div
          id="more-menu-popup"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[200] w-52 rounded-xl border border-border bg-white p-1.5 shadow-xl shadow-zinc-300/40"
        >
          {MORE_ITEMS.map((item) => {
            const Icon = item.icon;
            if (item.soon) {
              return (
                <div
                  key={item.label}
                  className="flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[13px] text-zinc-400"
                >
                  <Icon size={15} className="shrink-0" />
                  <span className="flex-1">{item.label}</span>
                  <span className="rounded-md bg-zinc-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                    Скоро
                  </span>
                </div>
              );
            }
            const active = section === item.section && activeTab === item.tab;
            return (
              <button
                key={item.label}
                type="button"
                onClick={() => handleNavigate(item.section, item.tab)}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] transition",
                  active
                    ? "bg-zinc-100 font-bold text-zinc-900"
                    : "font-medium text-zinc-700 hover:bg-zinc-50 hover:text-zinc-950",
                )}
              >
                <Icon size={15} className="shrink-0" />
                {item.label}
              </button>
            );
          })}
        </div>,
        document.body,
      )}
    </>
  );
}

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
  const { checks } = useVitrineLaunch();
  // Нейтральные точки: разделы, которые ещё ни разу не использовались.
  const unusedTabs = new Set(
    checks.filter((c) => c.section === "storefront" && c.tab && !c.done).map((c) => c.tab as string),
  );

  return (
    <nav className={cn("flex-1 overflow-y-auto py-1", compact ? "px-1 space-y-0.5" : "px-2 space-y-1.5 pb-2 pt-1")}>

      {NAV_GROUPS.map((group) => (
        <div key={group.title}>
          {!compact && (
            <div className="mb-0.5 mt-3 first:mt-0 px-2 text-[12px] font-normal text-[#5a5a5c]">
              {group.title}
            </div>
          )}
          {compact && <div className="my-0.5 h-px bg-border" />}
          <div className="space-y-px">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = section === item.section && activeTab === item.tab;
              return (
                <Tooltip key={item.label} label={item.label} disabled={!compact}>
                  <button
                    type="button"
                    data-tour={item.section === "storefront" && item.tab === "home" ? "nav-home" : undefined}
                    onClick={() => onNavigate(item.section, item.tab)}
                    className={cn(
                      "relative flex items-center rounded-[7px] font-normal transition",
                      compact
                        ? "h-8 w-8 justify-center"
                        : "w-full gap-1.5 px-[7px] py-1.5 text-left text-[13px] leading-4",
                      active
                        ? "bg-white text-[#1c1917] shadow-sm"
                        : "text-[#5a5a5c] hover:bg-zinc-200/50 hover:text-zinc-800",
                    )}
                  >
                    <Icon size={compact ? 17 : 14} weight="fill" className="shrink-0" />
                    {!compact && <span className="truncate flex-1">{item.label}</span>}
                    {/* Нейтральная точка: возможность ещё не использовалась */}
                    {!compact && !active && item.section === "storefront" && unusedTabs.has(item.tab) && (
                      <span className="ml-auto h-1.5 w-1.5 shrink-0 rounded-full bg-zinc-300" title="Ещё не использовали" />
                    )}
                    {compact && item.section === "storefront" && unusedTabs.has(item.tab) && (
                      <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-zinc-300" />
                    )}
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── «Ещё» separator + button ── */}
      {compact && <div className="my-0.5 h-px bg-border" />}
      {!compact && (
        <div className="mb-0.5 mt-3 px-2 text-[12px] font-normal text-[#5a5a5c]">
          Инструменты
        </div>
      )}
      <MoreMenu
        compact={compact}
        section={section}
        activeTab={activeTab}
        onNavigate={onNavigate}
      />
    </nav>
  );
}

// ── Shared drawer (used by rail and topbar) ───────────────────────────────────

export function NavDrawer({
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
          <span className="text-sm font-black tracking-tight text-zinc-950">{RESTAURANT_NAME}</span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X size={15} />
          </button>
        </div>
        <div className="h-px bg-border" />
        <NavList section={section} activeTab={activeTab} onNavigate={handleNavigate} compact={false} />
      </div>
    </>
  );
}

// ── Full sidebar ───────────────────────────────────────────────────────────────

type NavProps = {
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
  onResetCatalog?: () => void;
  onToggleSidebar?: () => void;
};

function FullSidebar({ section, activeTab, onNavigate }: NavProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header row: logo only (toggle is in app header) */}
      <div className="flex h-[59px] shrink-0 items-center px-4">
        <TaskoLogo className="text-zinc-900" />
      </div>
      <NavList section={section} activeTab={activeTab} onNavigate={onNavigate} compact={false} />
      <PlanWidget onNavigate={onNavigate} compact={false} />
    </div>
  );
}

// ── Rail sidebar (icons only) ─────────────────────────────────────────────────

function RailSidebar({ section, activeTab, onNavigate }: NavProps) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header row: mini logo, aligns with app header height */}
      <div className="flex h-[59px] shrink-0 items-center justify-center">
        <MiniLogo className="text-zinc-900" />
      </div>
      <NavList section={section} activeTab={activeTab} onNavigate={onNavigate} compact={true} />
      <PlanWidget onNavigate={onNavigate} compact={true} />
    </div>
  );
}

// ── Hover overlay (portal, fixed, appears when rail is hovered) ───────────────

function OverlayNav({
  section,
  activeTab,
  onNavigate,
  top,
  visible,
  onPin,
  setRef,
  onPointerEnter,
  onPointerLeave,
}: {
  section: SectionId;
  activeTab: string | null;
  onNavigate: (s: SectionId, t: string) => void;
  top: number;
  visible: boolean;
  onPin: () => void;
  setRef: (el: HTMLDivElement | null) => void;
  onPointerEnter: () => void;
  onPointerLeave: () => void;
}) {
  return createPortal(
    <div
      ref={setRef}
      style={{
        top,
        left: 0,
        opacity: visible ? 1 : 0,
        transform: visible ? "translateX(0)" : "translateX(-6px)",
        transition: "opacity 180ms ease-out, transform 180ms ease-out",
      }}
      className="fixed bottom-0 z-[200] flex w-48 flex-col bg-[#f5f5f4] border-r border-[#e7e5e4] shadow-[2px_0_20px_rgba(0,0,0,0.10)]"
      onPointerEnter={onPointerEnter}
      onPointerLeave={onPointerLeave}
    >
      {/* Header row: logo + pin */}
      <div className="flex h-[59px] shrink-0 items-center gap-2 px-4">
        <TaskoLogo className="flex-1 text-zinc-900" />
        <Tooltip label="Закрепить sidebar" side="left">
          <button
            type="button"
            onClick={onPin}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200/70 hover:text-zinc-600"
          >
            <PushPin size={17} />
          </button>
        </Tooltip>
      </div>
      <NavList section={section} activeTab={activeTab} onNavigate={onNavigate} compact={false} />
      <PlanWidget onNavigate={onNavigate} compact={false} />
    </div>,
    document.body,
  );
}

// ── Sidebar (full / rail only — topbar mode returns null) ──────────────────────

type SidebarProps = NavProps & {
  mode: SidebarMode;
  dragging?: boolean;
};

export function Sidebar({ section, activeTab, onNavigate, onToggleSidebar, mode }: SidebarProps) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [overlayMounted, setOverlayMounted] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(false);
  const [overlayTop, setOverlayTop] = useState(0);
  const railRef = useRef<HTMLDivElement>(null);
  const overlayEl = useRef<HTMLDivElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const openTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isRail = mode === "rail";

  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null; }
  };
  const cancelOpen = () => {
    if (openTimer.current) { clearTimeout(openTimer.current); openTimer.current = null; }
  };
  const scheduleClose = () => {
    cancelOpen();
    cancelClose();
    closeTimer.current = setTimeout(() => setHoverOpen(false), 220);
  };
  const scheduleOpen = (top: number) => {
    cancelClose();
    cancelOpen();
    openTimer.current = setTimeout(() => {
      setOverlayTop(top);
      setHoverOpen(true);
    }, 120);
  };

  // Mount/visible two-state for smooth enter + exit animation
  useEffect(() => {
    if (hoverOpen) {
      setOverlayMounted(true);
      const id = requestAnimationFrame(() => setOverlayVisible(true));
      return () => cancelAnimationFrame(id);
    } else {
      setOverlayVisible(false);
      const t = setTimeout(() => setOverlayMounted(false), 220);
      return () => clearTimeout(t);
    }
  }, [hoverOpen]);

  useEffect(() => {
    if (!hoverOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setHoverOpen(false); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [hoverOpen]);

  useEffect(() => {
    if (!hoverOpen) return;
    const onDown = (e: MouseEvent) => {
      if (railRef.current?.contains(e.target as Node)) return;
      if (overlayEl.current?.contains(e.target as Node)) return;
      setHoverOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [hoverOpen]);

  useEffect(() => { if (!isRail) setHoverOpen(false); }, [isRail]);

  useEffect(() => () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
    if (openTimer.current) clearTimeout(openTimer.current);
  }, []);

  const handlePin = () => { setHoverOpen(false); onToggleSidebar?.(); };

  if (mode === "topbar") return null;

  return (
    <TooltipProvider>
      {isRail ? (
        <div
          ref={railRef}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
          onPointerEnter={(e) => {
            if (e.pointerType !== "mouse") return;
            cancelClose();
            if (!hoverOpen) {
              const r = railRef.current?.getBoundingClientRect();
              scheduleOpen(r?.top ?? 0);
            }
          }}
          onPointerLeave={(e) => {
            if (e.pointerType !== "mouse") return;
            scheduleClose();
          }}
        >
          <RailSidebar
            section={section}
            activeTab={activeTab}
            onNavigate={onNavigate}
            onToggleSidebar={onToggleSidebar}
          />
        </div>
      ) : (
        <FullSidebar
          section={section}
          activeTab={activeTab}
          onNavigate={onNavigate}
          onToggleSidebar={onToggleSidebar}
        />
      )}

      {isRail && overlayMounted && (
        <OverlayNav
          section={section}
          activeTab={activeTab}
          onNavigate={onNavigate}
          top={overlayTop}
          visible={overlayVisible}
          onPin={handlePin}
          setRef={(el) => { overlayEl.current = el; }}
          onPointerEnter={() => { cancelClose(); cancelOpen(); }}
          onPointerLeave={scheduleClose}
        />
      )}
    </TooltipProvider>
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
