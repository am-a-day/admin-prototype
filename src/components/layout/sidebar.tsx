import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import {
  Buildings,
  CardsThree,
  CaretDown,
  ChartBar,
  ClockCountdown,
  Coins,
  BookOpen,
  DotsThreeOutline,
  DownloadSimple,
  FileMagnifyingGlass,
  FilePlus,
  Flask,
  FolderSimplePlus,
  ForkKnife,
  List,
  MagnifyingGlass,
  Package,
  PlusCircle,
  PushPin,
  QrCode,
  Scan,
  SealPercent,
  ShieldCheck,
  Stack,
  Swatches,
  Tag,
  ThumbsUp,
  Translate,
  X,
  type Icon,
} from "@phosphor-icons/react";
import { PlanWidget } from "@/components/layout/plan-widget";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { MiniLogo } from "@/components/ui/mini-logo";
import { cn } from "@/lib/utils";
import { CURRENT_ROLE, dishes, RESTAURANT_NAME, type SectionId } from "@/data/mock-data";
import { usePlan } from "@/contexts/plan-context";
import {
  useMockAuth,
  type OrganizationType,
} from "@/contexts/mock-auth-context";

export type SidebarMode = "full" | "rail" | "topbar";
export type QuickCreateAction = "position" | "section" | "promo" | "qr" | "banner" | "iiko" | "sheets";

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
    title: "Онлайн-меню",
    items: [
      { label: "Главная", section: "storefront", tab: "home", icon: Stack },
      { label: "Каталог", section: "storefront", tab: "catalog", icon: ForkKnife },
      { label: "Оформление", section: "storefront", tab: "appearance", icon: Swatches },
    ],
  },
  {
    title: "Заказы",
    items: [
      { label: "Настройка заказов", section: "management", tab: "order-settings", icon: Package },
      { label: "История заказов", section: "management", tab: "order-history", icon: ClockCountdown },
    ],
  },
];

function getOrganizationLabels(type: OrganizationType) {
  if (type === "restaurant") {
    return { group: "Мой ресторан", about: "Заведение" };
  }
  if (type === "store") {
    return { group: "Мой магазин", about: "Заведение" };
  }
  return { group: "Мой бизнес", about: "Заведение" };
}

function getNavGroups(type: OrganizationType) {
  const labels = getOrganizationLabels(type);
  return {
    primary: [
      { label: labels.group, section: "storefront" as const, tab: "about", icon: Buildings },
      { label: "Переводы", section: "storefront" as const, tab: "translations", icon: Translate },
      { label: "Аналитика", section: "analytics" as const, tab: "scans", icon: ChartBar },
    ],
    groups: NAV_GROUPS,
  };
}


// ── «Ещё» items ───────────────────────────────────────────────────────────────

type MoreItem =
  | { label: string; icon: Icon; section: SectionId; tab: string; soon?: false }
  | { label: string; icon: Icon; soon: true };

const MORE_ITEMS: MoreItem[] = [
  { label: "QR-коды",         icon: QrCode,     section: "qr",         tab: "qr"   },
  { label: "Промокоды",       icon: Tag,         section: "qr",         tab: "promo" },
  { label: "SEO",             icon: FileMagnifyingGlass, section: "management", tab: "seo"  },
  { label: "Импорт / экспорт",icon: DownloadSimple,      section: "management", tab: "io"   },
  { label: "Обучение",        icon: BookOpen,            section: "training",   tab: "trainer" },
  { label: "Продажи",         icon: Coins,               section: "analytics",  tab: "orders" },
  { label: "Лайки",           icon: ThumbsUp,            section: "analytics",  tab: "likes" },
  ...(CURRENT_ROLE === "am" ? [{ label: "АМ-панель", icon: ShieldCheck, section: "am" as const, tab: "review" }] : []),
];

function MoreMenu({
  compact,
  showTooltip = false,
  section,
  activeTab,
  onNavigate,
  onOpenPrototypeTools,
}: {
  compact: boolean;
  showTooltip?: boolean;
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
  onOpenPrototypeTools?: () => void;
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
      <Tooltip label="Больше" disabled={!compact || !showTooltip} delayDuration={0}>
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            "flex cursor-pointer items-center gap-1.5 rounded-[8px] px-2 py-[7px] text-left text-[13px] font-normal leading-4 transition",
            !compact && "w-full",
            isMoreActive || open
              ? "bg-[#e7e7e8] text-zinc-950"
              : "text-[#5a5a5c] hover:bg-white/70 hover:text-zinc-800",
          )}
        >
          <DotsThreeOutline size={16} weight="fill" className="shrink-0" />
          {!compact && <span className="truncate flex-1">Больше</span>}
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
          <div className="my-1 h-px bg-[#e7e5e4]" />
          <button
            type="button"
            onClick={() => {
              onOpenPrototypeTools?.();
              setOpen(false);
            }}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-50 hover:text-zinc-950"
          >
            <Flask size={15} className="shrink-0" />
            <span className="flex-1">Prototype tools</span>
            <span className="rounded-md bg-[#f1f1ea] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-[#79716b]">
              DEV
            </span>
          </button>
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
          <MagnifyingGlass size={16} className="shrink-0 text-zinc-400" />
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
  onNavigate,
  showTooltip = false,
}: {
  compact: boolean;
  onNavigate: (section: SectionId, tab: string) => void;
  showTooltip?: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {compact ? (
        <Tooltip label="Найти позицию" disabled={!compact || !showTooltip} delayDuration={0}>
          {/* Та же высота (28px) и X иконки, что у поля поиска в full — Y/X не прыгают при раскрытии */}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setOpen(true); }}
            className="flex h-[30px] w-8 cursor-pointer items-center justify-center rounded-[8px] text-[#5a5a5c] transition hover:bg-white/70 hover:text-zinc-800"
          >
            <MagnifyingGlass size={16} className="shrink-0" />
          </button>
        </Tooltip>
      ) : (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="flex w-full cursor-pointer items-center gap-1.5 rounded-[8px] px-[7px] py-[6px] text-left text-[13px] font-normal leading-4 text-[#5a5a5c] transition hover:bg-white/70 hover:text-zinc-800"
        >
          <MagnifyingGlass size={16} className="shrink-0" />
          <span>Найти позицию</span>
        </button>
      )}

      {open && (
        <SearchModal onClose={() => setOpen(false)} onNavigate={onNavigate} />
      )}
    </>
  );
}

function QuickCreateMenu({ compact, onAction }: { compact: boolean; onAction?: (action: QuickCreateAction) => void }) {
  const { account } = useMockAuth();
  const { planId } = usePlan();
  const canCreate = account?.role !== "Наблюдатель";
  const canImportIiko = planId === "Ultra";

  if (!canCreate || !onAction) return null;

  const Item = ({ action, icon: ItemIcon, brandSrc, children, disabled, hint }: {
    action: QuickCreateAction;
    icon?: Icon;
    brandSrc?: string;
    children: ReactNode;
    disabled?: boolean;
    hint?: string;
  }) => (
    <DropdownMenuItem
      disabled={disabled}
      onSelect={() => onAction(action)}
      title={hint}
      aria-label={typeof children === "string" ? children : undefined}
      className="h-7 gap-1.5 px-[7px] text-[13px] font-normal text-[#5a5a5c] data-[disabled]:cursor-default data-[disabled]:text-[#a6a09b]"
    >
      {ItemIcon && <ItemIcon size={14} weight="fill" className="shrink-0" />}
      {brandSrc && <img src={brandSrc} alt="" className="h-3.5 w-3.5 shrink-0 object-contain" />}
      <span className="min-w-0 flex-1">{children}</span>
      {disabled && <span className="rounded bg-[#f5f5f4] px-1 py-0.5 text-[9px] font-semibold">ULTRA</span>}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <Tooltip label="Создать" disabled={!compact} delayDuration={0}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={compact ? "Создать" : undefined}
            data-sidebar-create-trigger
            className={cn(
              "overflow-hidden border-[#e7e5e4] bg-white p-0 font-normal text-[#1c1917] shadow-[0_1px_1px_rgba(0,0,0,0.1)] hover:bg-white focus-visible:ring-[#a8a29e]/30",
              compact
                ? "h-8 w-8 rounded-full"
                : "h-7 w-full rounded-[7px] text-[13px]",
            )}
          >
            {compact ? (
              <PlusCircle size={17} />
            ) : (
              <>
                <span className="flex min-w-0 flex-1 items-center justify-center gap-1">
                  <PlusCircle size={14} />
                  <span>Создать</span>
                </span>
                <span className="flex h-full w-[22px] shrink-0 items-center justify-center border-l border-[#e7e5e4]" aria-hidden="true">
                  <CaretDown size={12} />
                </span>
              </>
            )}
          </Button>
        </DropdownMenuTrigger>
      </Tooltip>
      <DropdownMenuContent side="bottom" align="start" sideOffset={4} className="z-[220] w-[224px] rounded-[7px] p-1 shadow-[0_8px_24px_rgba(41,37,36,0.14)]">
        <DropdownMenuLabel>Добавить</DropdownMenuLabel>
        <Item action="position" icon={FilePlus}>Позицию</Item>
        <Item action="section" icon={FolderSimplePlus}>Раздел</Item>
        <Item action="qr" icon={Scan}>QR-код</Item>
        <Item action="banner" icon={CardsThree}>Баннер</Item>
        <Item action="promo" icon={SealPercent}>Промокод</Item>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Импортировать каталог</DropdownMenuLabel>
        <Item action="sheets" brandSrc="/brands/google-sheets.png">Импорт из Google Sheets</Item>
        <Item action="iiko" brandSrc="/brands/iiko.png" disabled={!canImportIiko} hint={!canImportIiko ? "Импорт из iiko доступен на тарифе Ultra" : undefined}>Импорт из iiko</Item>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

// ── Shared nav list ────────────────────────────────────────────────────────────

// Заголовок группы (full) и разделитель (rail) занимают одинаковый ряд 28px,
// пункты — 28px в обоих режимах: rail и flyout стоят на одних Y-координатах (Figma 1058:5517 / 1058:5611).
function GroupHeaderRow({ compact, title }: { compact: boolean; title: string }) {
  return (
    <div className={cn("flex h-7 items-center", compact ? "hidden" : "pl-2")}>
      {compact ? (
        <div className="h-px w-4 bg-border" />
      ) : (
        <span className="text-[11px] font-normal leading-4 text-[#5a5a5c]">{title}</span>
      )}
    </div>
  );
}

function NavList({
  section,
  activeTab,
  onNavigate,
  compact,
  showTooltips = false,
  onOpenPrototypeTools,
}: {
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
  compact: boolean;
  showTooltips?: boolean;
  onOpenPrototypeTools?: () => void;
}) {
  const { account } = useMockAuth();
  const navigation = getNavGroups(account?.workspace.organizationType ?? "restaurant");

  const renderItem = (item: NavItem) => {
    const ItemIcon = item.icon;
    const active = section === item.section && activeTab === item.tab;
    return (
      <Tooltip key={item.label} label={item.label} disabled={!compact || !showTooltips} delayDuration={0}>
        <button
          type="button"
          data-tour={item.section === "storefront" && item.tab === "home" ? "nav-home" : undefined}
          onClick={(event) => { event.stopPropagation(); onNavigate(item.section, item.tab); }}
          className={cn(
            "relative flex cursor-pointer items-center gap-1.5 rounded-[8px] text-left text-[13px] font-normal leading-4 transition",
            compact ? "h-[30px] w-8 justify-center p-0" : "w-full px-[7px] py-[6px]",
            active
              ? "bg-[#e7e7e8] text-[#1c1917]"
              : "text-[#5a5a5c] hover:bg-white/70 hover:text-zinc-800",
          )}
        >
          <ItemIcon size={16} weight="fill" className="shrink-0" />
          {!compact && <span className="min-w-0 flex-1 truncate">{item.label}</span>}
        </button>
      </Tooltip>
    );
  };

  return (
    <nav className={cn("flex-1 overflow-y-auto pb-2", compact ? "mt-4 space-y-5 px-[7px]" : "mt-2 space-y-[6px] px-2 pt-1")}>
      <div className={compact ? "space-y-1" : undefined}>
        {renderItem(navigation.primary[0])}
        <SidebarSearch compact={compact} onNavigate={onNavigate} showTooltip={showTooltips} />
        {renderItem(navigation.primary[1])}
        {renderItem(navigation.primary[2])}
      </div>

      {navigation.groups.map((group) => (
        <div key={group.title}>
          <GroupHeaderRow compact={compact} title={group.title} />
          <div className={compact ? "space-y-1" : undefined}>
            {group.items.map(renderItem)}
          </div>
        </div>
      ))}

      <div>
        <MoreMenu
          compact={compact}
          showTooltip={showTooltips}
          section={section}
          activeTab={activeTab}
          onNavigate={onNavigate}
          onOpenPrototypeTools={onOpenPrototypeTools}
        />
      </div>
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
  onOpenPrototypeTools,
  onQuickCreate,
}: {
  open: boolean;
  onClose: () => void;
  section: SectionId;
  activeTab: string | null;
  onNavigate: (section: SectionId, tab: string) => void;
  onOpenPrototypeTools?: () => void;
  onQuickCreate?: (action: QuickCreateAction) => void;
}) {
  const { account } = useMockAuth();
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
          "fixed inset-y-0 left-0 z-50 flex w-56 flex-col bg-stone-100 shadow-2xl transition-transform duration-300",
          open ? "translate-x-0" : "-translate-x-full",
        )}
      >
        <div className="flex items-center justify-between px-3 py-3">
          <span className="text-sm font-black tracking-tight text-zinc-950">
            {account?.workspace.name || RESTAURANT_NAME}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X size={15} />
          </button>
        </div>
        <div className="h-px bg-border" />
        <div className="px-3 pt-2">
          <QuickCreateMenu compact={false} onAction={(action) => { onQuickCreate?.(action); onClose(); }} />
        </div>
        <NavList
          section={section}
          activeTab={activeTab}
          onNavigate={handleNavigate}
          compact={false}
          onOpenPrototypeTools={() => {
            onOpenPrototypeTools?.();
            onClose();
          }}
        />
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
  onPin?: () => void;
  pinned?: boolean;
  onQuickCreate?: (action: QuickCreateAction) => void;
  onOpenPrototypeTools?: () => void;
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

export function FullSidebar({ section, activeTab, onNavigate, onPin, pinned = false, onQuickCreate, onOpenPrototypeTools }: NavProps) {
  const { planId } = usePlan();
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-stone-100">
      {/* Header row: logo + optional pin (pin appears only in the hover flyout) */}
      <div className="flex h-[59px] shrink-0 items-center justify-between px-4">
        <TaskoLogo className="text-zinc-900" />
        {onPin && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onPin();
            }}
            title={pinned ? "Открепить меню" : "Закрепить меню"}
            aria-pressed={pinned}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-200/60 hover:text-zinc-700"
          >
            <PushPin size={15} />
          </button>
        )}
      </div>
      <div className="px-3 pb-1">
        <QuickCreateMenu compact={false} onAction={onQuickCreate} />
      </div>
      <NavList section={section} activeTab={activeTab} onNavigate={onNavigate} compact={false} onOpenPrototypeTools={onOpenPrototypeTools} />
      {planId === "Start" ? <StartPlanBlock /> : <PlanWidget onNavigate={onNavigate} compact={false} />}
    </div>
  );
}

// ── Rail sidebar (icons only) ─────────────────────────────────────────────────

function RailSidebar({ section, activeTab, onNavigate, showTooltips = false, onQuickCreate, onOpenPrototypeTools }: NavProps & { showTooltips?: boolean }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-stone-100">
      {/* Header row: mini logo, aligns with app header height */}
      <div className="flex h-[59px] shrink-0 items-center justify-center">
        <MiniLogo className="text-zinc-900" />
      </div>
      <div className="shrink-0 px-[7px] pb-1">
        <QuickCreateMenu compact onAction={onQuickCreate} />
      </div>
      <NavList section={section} activeTab={activeTab} onNavigate={onNavigate} compact={true} showTooltips={showTooltips} onOpenPrototypeTools={onOpenPrototypeTools} />
      {/* stopPropagation: клик по тарифу не должен разворачивать rail */}
      <div onClick={(e) => e.stopPropagation()}>
        <PlanWidget onNavigate={onNavigate} compact={true} />
      </div>
    </div>
  );
}

// ── Sidebar (full / rail only — topbar mode returns null) ──────────────────────

type SidebarProps = NavProps & {
  mode: SidebarMode;
  dragging?: boolean;
  /** Rail icon tooltips — only when there's no hover-flyout to reveal labels (tablet rail). */
  showTooltips?: boolean;
};

export function Sidebar({ section, activeTab, onNavigate, mode, showTooltips = false, onPin, pinned = false, onQuickCreate, onOpenPrototypeTools }: SidebarProps) {
  const isRail = mode === "rail";

  if (mode === "topbar") return null;

  return (
    <TooltipProvider delayDuration={0}>
      {isRail ? (
        <RailSidebar section={section} activeTab={activeTab} onNavigate={onNavigate} showTooltips={showTooltips} onQuickCreate={onQuickCreate} onOpenPrototypeTools={onOpenPrototypeTools} />
      ) : (
        <FullSidebar section={section} activeTab={activeTab} onNavigate={onNavigate} onPin={onPin} pinned={pinned} onQuickCreate={onQuickCreate} onOpenPrototypeTools={onOpenPrototypeTools} />
      )}
    </TooltipProvider>
  );
}

// ── TopBar (small viewport — replaces sidebar entirely) ───────────────────────

export function getPageTitle(
  section: SectionId,
  activeTab: string | null,
  organizationType: OrganizationType = "restaurant",
): string {
  if (section === "qr") return "QR-меню";
  if (section === "am") return "";
  if (section === "training") return "Обучение";

  const navigation = getNavGroups(organizationType);
  const allItems = [...navigation.primary, ...navigation.groups.flatMap((group) => group.items)];
  const match = allItems.find((i) => i.section === section && i.tab === activeTab);
  return match?.label ?? "";
}

export function TopBar({ section, activeTab, onNavigate, onOpenPrototypeTools }: NavProps) {
  const { account } = useMockAuth();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const title = getPageTitle(
    section,
    activeTab,
    account?.workspace.organizationType ?? "restaurant",
  );

  return (
    <>
      <NavDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        section={section}
        activeTab={activeTab}
        onNavigate={onNavigate}
        onOpenPrototypeTools={onOpenPrototypeTools}
      />
      <header className="flex h-11 shrink-0 items-center gap-3 border-b border-border bg-white px-3">
        <button
          type="button"
          onClick={() => setDrawerOpen(true)}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
          title="Меню"
        >
          <List size={18} />
        </button>
        {title && (
          <span className="text-sm font-semibold text-zinc-800 truncate">{title}</span>
        )}
      </header>
    </>
  );
}
