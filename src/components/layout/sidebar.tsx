import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { LucideIcon } from "lucide-react";
import {
  Ellipsis,
  FileSearch,
  Import,
  Menu,
  QrCode,
  Search,
  Tag,
  X,
} from "lucide-react";
import {
  ClipboardText,
  ClockCounterClockwise,
  Coins,
  ForkKnife,
  House,
  MagnifyingGlass,
  Package,
  Scan,
  Swatches,
  ThumbsUp,
  type Icon,
} from "@phosphor-icons/react";
import { PlanWidget } from "@/components/layout/plan-widget";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { MiniLogo } from "@/components/ui/mini-logo";
import { cn } from "@/lib/utils";
import { dishes, RESTAURANT_NAME, type SectionId } from "@/data/mock-data";
import { usePlan } from "@/contexts/plan-context";

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

type SidebarRow =
  | { type: "brand" }
  | { type: "search" }
  | { type: "group"; label: string }
  | { type: "item"; item: NavItem }
  | { type: "more" };
const NAV_GROUPS: NavGroup[] = [
  {
    title: "Мой ресторан",
    items: [
      { label: "Главная", section: "storefront", tab: "home", icon: House },
      { label: "Каталог", section: "storefront", tab: "catalog", icon: ForkKnife },
      { label: "Оформление", section: "storefront", tab: "appearance", icon: Swatches },
      { label: "О заведении", section: "storefront", tab: "about", icon: ClipboardText },
    ],
    trailingCta: { label: "Улучшить тариф", section: "management", tab: "billing" },
  },
  {
    title: "Заказы",
    items: [
      { label: "Настройка заказов", section: "management", tab: "order-settings", icon: Package },
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

const TOOLS_GROUP_LABEL = "Инструменты";
const RAIL_WIDTH_CLASS = "w-16";
const RAIL_GRID_CLASS = "grid-cols-[64px_minmax(0,1fr)]";
const RAIL_COLLAPSED_WIDTH = 64;
const RAIL_EXPANDED_WIDTH = 360;

const SIDEBAR_ROWS: SidebarRow[] = [
  { type: "brand" },
  { type: "search" },
  ...NAV_GROUPS.flatMap<SidebarRow>((group) => [
    { type: "group", label: group.title },
    ...group.items.map((item): SidebarRow => ({ type: "item", item })),
  ]),
  { type: "group", label: TOOLS_GROUP_LABEL },
  { type: "more" },
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
  expanded = false,
  section,
  activeTab,
  onNavigate,
}: {
  compact: boolean;
  expanded?: boolean;
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

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
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
      {compact ? (
        <div
          className={cn(
            "grid h-10 w-full items-center rounded-[7px]",
            RAIL_GRID_CLASS,
            expanded && (
              isMoreActive || open
                ? "bg-white text-[#1c1917] shadow-sm"
                : "text-[#5a5a5c] hover:bg-zinc-200/50 hover:text-zinc-800"
            ),
          )}
        >
          <Tooltip label="Ещё" disabled={expanded} delayDuration={0}>
            <button
              ref={btnRef}
              type="button"
              onClick={handleToggle}
              className={cn(
                "mx-auto flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[7px] transition",
                expanded
                  ? isMoreActive || open ? "text-[#1c1917]" : "text-[#5a5a5c]"
                  : isMoreActive || open
                    ? "bg-white text-[#1c1917] shadow-sm"
                    : "text-[#5a5a5c] hover:bg-zinc-200/50 hover:text-zinc-800",
              )}
            >
              <Ellipsis size={16} className="shrink-0" />
            </button>
          </Tooltip>
          {expanded && (
            <button
              type="button"
              onClick={handleToggle}
              className={cn(
                "min-w-0 truncate rounded-[7px] py-2 pl-6 pr-4 text-left text-[16px] font-normal leading-6 transition",
                isMoreActive || open ? "text-zinc-950" : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              Ещё
            </button>
          )}
        </div>
      ) : (
        <Tooltip label="Ещё" disabled delayDuration={0}>
          <button
            ref={btnRef}
            type="button"
            onClick={handleToggle}
            className={cn(
              "flex w-full cursor-pointer items-center gap-2 rounded-lg px-2 py-[5px] text-left text-[13px] font-medium transition",
              isMoreActive || open
                ? "bg-white text-zinc-950 shadow-sm ring-1 ring-zinc-200/70"
                : "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-800",
            )}
          >
            <Ellipsis size={16} className="shrink-0" />
            <span>Ещё</span>
          </button>
        </Tooltip>
      )}

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
                  <Icon size={16} className="shrink-0" />
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
                <Icon size={16} className="shrink-0" />
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

// ── Search modal ──────────────────────────────────────────────────────────────

function SearchModal({
  onClose,
  onNavigate,
}: {
  onClose: () => void;
  onNavigate: (section: SectionId, tab: string) => void;
}) {
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = window.setTimeout(() => inputRef.current?.focus(), 30);
    return () => window.clearTimeout(t);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const q = query.toLowerCase().trim();
  const results = q.length < 1 ? [] : dishes.filter(
    (d) => d.name.toLowerCase().includes(q) || d.category.toLowerCase().includes(q),
  ).slice(0, 10);

  const handlePick = () => {
    onNavigate("storefront", "catalog");
    onClose();
  };

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-start justify-center pt-20 px-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-white shadow-2xl shadow-zinc-400/30 overflow-hidden">
        {/* Search input */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
          <Search size={16} className="shrink-0 text-zinc-400" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Найти позицию…"
            className="flex-1 bg-transparent text-sm font-medium text-zinc-900 outline-none placeholder:text-zinc-400"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-200 text-zinc-500 transition hover:bg-zinc-300"
            >
              <X size={10} />
            </button>
          )}
        </div>

        {/* Results */}
        <div className="max-h-[360px] overflow-y-auto">
          {q.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              Начните вводить название позиции или раздела
            </div>
          )}
          {q.length > 0 && results.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-zinc-400">
              Ничего не найдено
            </div>
          )}
          {results.map((dish) => (
            <button
              key={dish.id}
              type="button"
              onClick={handlePick}
              className="flex w-full items-center gap-3 px-4 py-2.5 text-left transition hover:bg-zinc-50"
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-100 text-xl">
                {dish.emoji}
              </span>
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-900">{dish.name}</div>
                <div className="text-xs text-zinc-400">{dish.category} · {dish.price}</div>
              </div>
            </button>
          ))}
        </div>

        {results.length > 0 && (
          <div className="border-t border-border px-4 py-2 text-[11px] text-zinc-400">
            Нажмите на позицию, чтобы перейти в каталог
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}

// ── Search trigger (top of sidebar) ────────────────────────────────────────────

function SidebarSearch({
  compact,
  expanded = false,
  onNavigate,
}: {
  compact: boolean;
  expanded?: boolean;
  onNavigate: (section: SectionId, tab: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {compact ? (
        <div className={cn("grid h-10 w-full items-center", RAIL_GRID_CLASS)}>
          <Tooltip label="Поиск позиций" disabled={expanded} delayDuration={0}>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              className="mx-auto flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-[7px] text-zinc-400 transition hover:bg-zinc-200/50 hover:text-zinc-700"
            >
              <MagnifyingGlass size={16} className="shrink-0" />
            </button>
          </Tooltip>
          {expanded && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setOpen(true); }}
              className="min-w-0 truncate rounded-[9px] bg-[#e7e5e4]/70 py-2 pl-6 pr-4 text-left text-[16px] font-normal leading-6 text-[#5a5a5c] transition hover:bg-[#e7e5e4] hover:text-zinc-800"
            >
                Поиск позиций
            </button>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="relative flex w-full cursor-pointer items-center"
        >
          <MagnifyingGlass
            size={16}
            className="pointer-events-none absolute left-[7px] text-[#5a5a5c]"
          />
          <Input
            readOnly
            tabIndex={-1}
            placeholder="Поиск позиций"
            className="pointer-events-none h-8 cursor-pointer rounded-[7px] border-0 bg-[#e7e5e4]/70 py-0 pl-[27px] text-[13px] text-[#5a5a5c] shadow-none placeholder:text-[#5a5a5c] focus-visible:ring-0"
          />
        </button>
      )}

      {open && (
        <SearchModal onClose={() => setOpen(false)} onNavigate={onNavigate} />
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
  expanded = false,
}: {
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
  compact: boolean;
  expanded?: boolean;
}) {
  return (
    <nav
      className={cn(
        "flex-1 overflow-y-auto py-1 mt-2",
        compact ? "px-1 space-y-0 pb-2 pt-1" : "px-2 space-y-4 pb-2 pt-1",
      )}
    >
      {NAV_GROUPS.map((group, groupIndex) => (
        <div key={group.title}>
          {!compact && (
            <div className="mb-0.5 mt-3 first:mt-0 px-2 text-[12px] font-normal text-[#5a5a5c]">
              {group.title}
            </div>
          )}
          {compact && groupIndex === 0 && expanded && (
            <div className="relative h-0">
              <div className="absolute left-10 top-[-18px] whitespace-nowrap text-[12px] font-normal leading-[18px] text-[#5a5a5c]">
                {group.title}
              </div>
            </div>
          )}
          {compact && groupIndex > 0 && (
            <div className="relative h-[9px]">
              <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-border" />
              {expanded && (
                <div className="absolute left-10 top-1/2 -translate-y-1/2 whitespace-nowrap text-[12px] font-normal leading-[18px] text-[#5a5a5c]">
                  {group.title}
                </div>
              )}
            </div>
          )}
          <div className="space-y-px">
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = section === item.section && activeTab === item.tab;
              if (compact) {
                return (
                  <div
                    key={item.label}
                    className={cn(
                      "flex h-8 w-full items-center gap-2 rounded-[7px]",
                      expanded && (
                        active
                          ? "bg-white text-[#1c1917] shadow-sm"
                          : "text-[#5a5a5c] hover:bg-zinc-200/50 hover:text-zinc-800"
                      ),
                    )}
                  >
                    <Tooltip label={item.label} disabled delayDuration={0}>
                      <button
                        type="button"
                        data-tour={item.section === "storefront" && item.tab === "home" ? "nav-home" : undefined}
                        onClick={(e) => { e.stopPropagation(); onNavigate(item.section, item.tab); }}
                        className={cn(
                          "flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-[7px] font-normal transition",
                          expanded
                            ? active ? "text-[#1c1917]" : "text-[#5a5a5c]"
                            : active
                              ? "bg-white text-[#1c1917] shadow-sm"
                              : "text-[#5a5a5c] hover:bg-zinc-200/50 hover:text-zinc-800",
                        )}
                      >
                        <Icon size={16} weight="fill" className="shrink-0" />
                      </button>
                    </Tooltip>
                    {expanded && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onNavigate(item.section, item.tab); }}
                        className={cn(
                          "min-w-0 flex-1 truncate rounded-[7px] py-1.5 pr-2 text-left text-[13px] leading-4 transition",
                          active ? "text-[#1c1917]" : "text-[#5a5a5c] hover:text-zinc-800",
                        )}
                      >
                        {item.label}
                      </button>
                    )}
                  </div>
                );
              }
              return (
                <Tooltip key={item.label} label={item.label} disabled delayDuration={0}>
                  <button
                    type="button"
                    data-tour={item.section === "storefront" && item.tab === "home" ? "nav-home" : undefined}
                    onClick={(e) => { e.stopPropagation(); onNavigate(item.section, item.tab); }}
                    className={cn(
                      "relative flex w-full cursor-pointer items-center gap-1.5 rounded-[7px] px-[7px] py-1.5 text-left text-[13px] font-normal leading-4 transition",
                      active
                        ? "bg-white text-[#1c1917] shadow-sm"
                        : "text-[#5a5a5c] hover:bg-zinc-200/50 hover:text-zinc-800",
                    )}
                  >
                    <Icon size={16} weight="fill" className="shrink-0" />
                    <span className="truncate flex-1">{item.label}</span>
                  </button>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}

      {/* ── «Ещё» separator + button ── */}
      {compact && (
        <div className="relative h-[9px]">
          <div className="absolute left-2 right-2 top-1/2 h-px -translate-y-1/2 bg-border" />
          {expanded && (
            <div className="absolute left-10 top-1/2 -translate-y-1/2 whitespace-nowrap text-[12px] font-normal leading-[18px] text-[#5a5a5c]">
              Инструменты
            </div>
          )}
        </div>
      )}
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
        expanded={expanded}
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
            <X size={16} />
          </button>
        </div>
        <div className="h-px bg-border" />
        <div className="px-3 pt-2">
          <SidebarSearch compact={false} onNavigate={handleNavigate} />
        </div>
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

function StartPlanBlock() {
  return (
    <div className="shrink-0 px-3 pb-3 pt-1">
      <div className="flex flex-col gap-[9px]">
        <div className="flex flex-col gap-[4px]">
          <div className="flex items-center gap-2">
            <div className="flex h-[17px] items-center justify-center rounded-[3px] bg-[#f5f5f4] px-1">
              <span className="whitespace-nowrap text-[13px] font-medium text-[#44403b]">
                START · Бесплатно
              </span>
            </div>
          </div>
          <p className="w-[163px] text-[13px] leading-[1.3] text-[#a6a09b]">
            Базовые возможности для начала работы
          </p>
        </div>
        <button
          type="button"
          onClick={() => {}}
          className="flex h-[32px] w-full items-center justify-center rounded-[10px] border border-[#d6d3d1] bg-white text-[14px] text-[#292524] transition hover:bg-zinc-50"
        >
          Выбрать тариф
        </button>
      </div>
    </div>
  );
}

function FullSidebar({ section, activeTab, onNavigate }: NavProps) {
  const { planId } = usePlan();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      {/* Header row: logo only — collapse toggle lives in the work-area header */}
      <div className="flex h-[59px] shrink-0 items-center px-4">
        <TaskoLogo className="text-zinc-900" />
      </div>
      {/* Search */}
      <div className="px-3 pb-1">
        <SidebarSearch compact={false} onNavigate={onNavigate} />
      </div>
      <NavList section={section} activeTab={activeTab} onNavigate={onNavigate} compact={false} />
      {planId === "Start" ? <StartPlanBlock /> : <PlanWidget onNavigate={onNavigate} compact={false} />}
    </div>
  );
}

// ── Rail sidebar (icons only) ─────────────────────────────────────────────────

function RailRowList({
  section,
  activeTab,
  onNavigate,
  expanded,
}: NavProps & { expanded: boolean }) {
  return (
    <nav className="flex min-h-0 flex-1 flex-col overflow-y-auto pb-2">
      {SIDEBAR_ROWS.map((row, index) => {
        if (row.type === "brand") {
          return (
            <div
              key="brand"
              data-sidebar-row="brand"
              className={cn("grid h-[64px] shrink-0 items-center", RAIL_GRID_CLASS)}
            >
              {expanded ? (
                <>
                  <div className="flex items-center justify-center">
                    <MiniLogo className="text-zinc-900" />
                  </div>
                  <div className="flex items-center pl-6 pr-4">
                    <TaskoLogo className="text-zinc-900" />
                  </div>
                </>
              ) : (
                <div className="flex items-center justify-center">
                  <MiniLogo className="text-zinc-900" />
                </div>
              )}
            </div>
          );
        }

        if (row.type === "search") {
          return (
            <div key="search" data-sidebar-row="search" className="h-10 shrink-0">
              <SidebarSearch compact expanded={expanded} onNavigate={onNavigate} />
            </div>
          );
        }

        if (row.type === "group") {
          return (
            <div
              key={`${row.label}-${index}`}
              data-sidebar-row={`group:${row.label}`}
              className={cn("mt-5 mb-2 grid h-5 shrink-0 items-center", RAIL_GRID_CLASS)}
            >
              <div className="flex items-center justify-center">
                <div className="h-px w-6 bg-border" />
              </div>
              {expanded && (
                <div className="min-w-0 truncate pl-6 pr-4 text-[16px] font-normal leading-5 text-[#5a5a5c]">
                  {row.label}
                </div>
              )}
            </div>
          );
        }

        if (row.type === "more") {
          return (
            <div key="more" data-sidebar-row="more" className="h-10 shrink-0">
              <MoreMenu
                compact
                section={section}
                activeTab={activeTab}
                onNavigate={onNavigate}
                expanded={expanded}
              />
            </div>
          );
        }

        const item = row.item;
        const Icon = item.icon;
        const active = section === item.section && activeTab === item.tab;
        const rowId = `${item.section}:${item.tab}`;

        return (
          <Tooltip key={rowId} label={item.label} disabled={expanded} delayDuration={0}>
            <button
              type="button"
              data-sidebar-row={rowId}
              data-tour={item.section === "storefront" && item.tab === "home" ? "nav-home" : undefined}
              onClick={(e) => { e.stopPropagation(); onNavigate(item.section, item.tab); }}
              className={cn(
                "grid h-10 w-full shrink-0 cursor-pointer items-center rounded-[9px] text-left transition",
                RAIL_GRID_CLASS,
                expanded
                  ? active
                    ? "bg-white text-[#1c1917] shadow-sm"
                    : "text-[#5a5a5c] hover:bg-zinc-200/50 hover:text-zinc-800"
                  : "text-[#5a5a5c]",
              )}
            >
              <span className="flex items-center justify-center">
                <span
                  data-sidebar-icon={rowId}
                  className={cn(
                    "flex h-10 w-10 items-center justify-center rounded-[9px] transition",
                    !expanded && (
                      active
                        ? "bg-white text-[#1c1917] shadow-sm"
                        : "hover:bg-zinc-200/50 hover:text-zinc-800"
                    ),
                  )}
                >
                  <Icon size={16} weight="fill" className="shrink-0" />
                </span>
              </span>
              {expanded && (
                <span
                  data-sidebar-label={rowId}
                  className="min-w-0 truncate pl-6 pr-4 text-[16px] font-normal leading-6"
                >
                  {item.label}
                </span>
              )}
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
}

function RailSidebar({
  section,
  activeTab,
  onNavigate,
  expanded = false,
}: NavProps & { expanded?: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
      <RailRowList
        section={section}
        activeTab={activeTab}
        onNavigate={onNavigate}
        expanded={expanded}
      />
      {/* stopPropagation: клик по тарифу не должен разворачивать rail */}
      <div onClick={(e) => e.stopPropagation()}>
        <PlanWidget onNavigate={onNavigate} compact={!expanded} />
      </div>
    </div>
  );
}

// ── Sidebar (full / rail only — topbar mode returns null) ──────────────────────

type SidebarProps = NavProps & {
  mode: SidebarMode;
  dragging?: boolean;
};

export function Sidebar({ section, activeTab, onNavigate, mode }: SidebarProps) {
  const [hoverExpanded, setHoverExpanded] = useState(false);
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (openTimer.current !== null) window.clearTimeout(openTimer.current);
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    };
  }, []);

  if (mode === "topbar") return null;

  if (mode === "full") {
    return (
      <TooltipProvider delayDuration={0}>
        <FullSidebar section={section} activeTab={activeTab} onNavigate={onNavigate} />
      </TooltipProvider>
    );
  }

  const handleMouseEnter = () => {
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = window.setTimeout(() => setHoverExpanded(true), 140);
  };

  const handleMouseLeave = () => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    closeTimer.current = window.setTimeout(() => setHoverExpanded(false), 100);
  };

  const handleNavigate = (nextSection: SectionId, nextTab: string) => {
    onNavigate(nextSection, nextTab);
  };

  return (
    <TooltipProvider delayDuration={0}>
      <div
        className={cn("relative z-50 h-full", RAIL_WIDTH_CLASS)}
      >
        <div
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          style={{ width: hoverExpanded ? RAIL_EXPANDED_WIDTH : RAIL_COLLAPSED_WIDTH }}
          className={cn(
            "absolute inset-y-0 left-0 flex min-h-0 flex-col overflow-hidden border-r border-[#e7e5e4] bg-[#f5f5f4] transition-[width,box-shadow] duration-150 ease-out",
            hoverExpanded
              ? "shadow-2xl shadow-zinc-300/35"
              : "shadow-none",
          )}
        >
          <RailSidebar
            section={section}
            activeTab={activeTab}
            onNavigate={handleNavigate}
            expanded={hoverExpanded}
          />
        </div>
      </div>
    </TooltipProvider>
  );
}

// ── TopBar (small viewport — replaces sidebar entirely) ───────────────────────

export function getPageTitle(section: SectionId, activeTab: string | null): string {
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
