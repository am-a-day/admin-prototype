import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  Buildings,
  CaretLeft,
  CaretRight,
  Check,
  CurrencyKzt,
  GlobeHemisphereEast,
  Plus,
  UsersThree,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { usePlan } from "@/contexts/plan-context";
import { usePublish } from "@/contexts/publish-context";
import {
  CURRENT_VITRINE_ID,
  MOCK_USER,
  MOCK_VITRINES,
  type MockVitrine,
  type SectionId,
} from "@/data/mock-data";
import { cn } from "@/lib/utils";

type MenuView = "root" | "locations" | "staff" | "regional";

const RESTAURANT_LABEL = "Мой ресторан 7470";
const ACTIVE_LOCATION_STORAGE_KEY = "tasko.activeLocation.v1";
const LOCATIONS_STORAGE_KEY = "tasko.locations.v1";

function readLocations() {
  if (typeof window === "undefined") return MOCK_VITRINES;
  try {
    const raw = window.localStorage.getItem(LOCATIONS_STORAGE_KEY);
    return raw ? JSON.parse(raw) as MockVitrine[] : MOCK_VITRINES;
  } catch {
    return MOCK_VITRINES;
  }
}

const CURRENCY_OPTIONS = [
  { value: "KZT", label: "Казахстанский тенге — KZT" },
  { value: "RSD", label: "Сербский динар — RSD" },
  { value: "RUB", label: "Российский рубль — RUB" },
  { value: "USD", label: "Доллар США — USD" },
  { value: "EUR", label: "Евро — EUR" },
];

const TIMEZONE_OPTIONS = [
  { value: "Asia/Almaty", label: "Казахстан, UTC+5" },
  { value: "Europe/Belgrade", label: "Белград, Центральная Европа" },
  { value: "Europe/Moscow", label: "Москва, UTC+3" },
  { value: "Europe/London", label: "Лондон" },
  { value: "Europe/Berlin", label: "Берлин, Центральная Европа" },
];

function pointLabel(address: string) {
  if (/^ул\./i.test(address)) return address;
  const [street, building] = address.split(",").map((part) => part.trim());
  return building ? `ул. ${street} ${building}` : `ул. ${address}`;
}

function MenuSection({ children }: { children: ReactNode }) {
  return <div className="border-t border-[#e7e5e4] p-1 first:border-t-0">{children}</div>;
}

function MenuRow({
  icon: Icon,
  children,
  trailing,
  onClick,
}: {
  icon: typeof Buildings;
  children: ReactNode;
  trailing?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      onClick={onClick}
      className="min-h-8 w-full justify-start gap-2 rounded-[8px] px-2 py-1.5 text-left text-[13px] font-normal leading-5 text-[#0c0a09] hover:bg-[#f5f5f4] focus-visible:bg-[#f5f5f4]"
    >
      <Icon size={14} weight="fill" className="shrink-0 text-[#57534d]" aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate">{children}</span>
      {trailing}
    </Button>
  );
}

function SubmenuHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex h-10 items-center gap-1 border-b border-[#e7e5e4] px-1.5">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label="Назад"
        onClick={onBack}
        className="size-7 rounded-[7px] text-[#57534d] hover:bg-[#f5f5f4]"
      >
        <CaretLeft size={14} weight="bold" />
      </Button>
      <h2 className="text-[13px] font-semibold text-[#292524]">{title}</h2>
    </div>
  );
}

/** Compact restaurant and location navigation used in the app header. */
export function OrgMenu({
  onNavigate,
  variant = "full",
}: {
  onNavigate: (section: SectionId, tab: string) => void;
  onResetCatalog?: () => void;
  variant?: "full" | "rail" | "text";
}) {
  const { planId } = usePlan();
  const { account, updateWorkspace } = useMockAuth();
  const { registerChange } = usePublish();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<MenuView>("root");
  const [locations, setLocations] = useState<MockVitrine[]>(readLocations);
  const [selectedVitrineId, setSelectedVitrineId] = useState(() =>
    typeof window === "undefined"
      ? CURRENT_VITRINE_ID
      : window.localStorage.getItem(ACTIVE_LOCATION_STORAGE_KEY) ?? CURRENT_VITRINE_ID);
  const [staff, setStaff] = useState([
    { id: "owner", name: MOCK_USER.name, role: "Владелец" },
    { id: "manager", name: "Алина Садыкова", role: "Менеджер" },
  ]);

  const current = useMemo(
    () => locations.find((location) => location.id === selectedVitrineId) ?? locations[0],
    [locations, selectedVitrineId],
  );
  const address = pointLabel(current?.address ?? "Абая, 10");
  const storefrontHost = current?.url ?? "aura.tsqr.me";
  const triggerLabel = `${RESTAURANT_LABEL} · ${address}`;
  const canAddLocation = planId === "Ultra" && locations.length < 3;
  const canInviteStaff = planId === "Lite" || planId === "Ultra";
  const currencyValue = CURRENCY_OPTIONS.some((option) => option.value === account?.workspace.currency)
    ? account!.workspace.currency
    : "KZT";
  const timezoneValue = TIMEZONE_OPTIONS.some((option) => option.value === account?.workspace.timezone)
    ? account!.workspace.timezone
    : "Asia/Almaty";

  useEffect(() => {
    window.localStorage.setItem(LOCATIONS_STORAGE_KEY, JSON.stringify(locations));
  }, [locations]);

  useEffect(() => {
    window.localStorage.setItem(ACTIVE_LOCATION_STORAGE_KEY, selectedVitrineId);
    window.dispatchEvent(new CustomEvent("tasko:active-location", { detail: selectedVitrineId }));
  }, [selectedVitrineId]);

  useEffect(() => {
    const syncLocation = (event: Event) => {
      const locationId = (event as CustomEvent<string>).detail;
      if (locations.some(({ id }) => id === locationId)) setSelectedVitrineId(locationId);
    };
    window.addEventListener("tasko:active-location", syncLocation);
    return () => window.removeEventListener("tasko:active-location", syncLocation);
  }, [locations]);

  const close = () => {
    setOpen(false);
    setView("root");
  };

  const addLocation = () => {
    if (!canAddLocation) return;
    const next: MockVitrine = {
      id: `location-${locations.length + 1}`,
      initials: "КБ",
      avatarColor: "bg-stone-800",
      name: RESTAURANT_LABEL,
      address: "ул. Кабанбай батыра 12",
      url: "aura-kabanbay.tsqr.me",
      registrationCountryCode: "KZ",
    };
    setLocations((currentLocations) => [...currentLocations, next]);
    setSelectedVitrineId(next.id);
  };

  const inviteStaff = () => {
    if (!canInviteStaff) return;
    setStaff((currentStaff) => currentStaff.some((member) => member.id === "invited")
      ? currentStaff
      : [...currentStaff, { id: "invited", name: "Новый сотрудник", role: "Приглашение отправлено" }]);
  };

  return (
    <Popover
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) setView("root");
      }}
    >
      <PopoverTrigger asChild>
        {variant === "text" ? (
          <Button
            type="button"
            variant="ghost"
            aria-label={triggerLabel}
            className={cn(
              "h-auto min-w-0 items-center gap-2 rounded-lg px-2 py-1.5 text-[13px] font-normal text-black hover:bg-[#f5f5f4]",
              open && "bg-[#f5f5f4]",
            )}
          >
            <span className="max-w-[150px] truncate">{RESTAURANT_LABEL}</span>
            <span aria-hidden="true">·</span>
            <span className="max-w-[160px] truncate">{address}</span>
          </Button>
        ) : (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={triggerLabel}
            className="relative size-8 shrink-0 rounded-xl bg-zinc-950 text-sm font-black text-white hover:bg-zinc-800 hover:text-white"
          >
            T
            {variant === "rail" && <span className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-white bg-emerald-500" />}
          </Button>
        )}
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={4}
        role="dialog"
        aria-label="Настройки ресторана"
        className="w-[264px] overflow-hidden rounded-[12px] p-0 shadow-[0_4px_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.1)]"
      >
        {view === "root" && (
          <>
            <MenuSection>
              <MenuRow
                icon={Buildings}
                onClick={() => setView("locations")}
                trailing={(
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-[3px] bg-[#f5f5f4] px-1.5 py-0.5 text-[10px] font-medium leading-none text-[#57534d]">{planId.toUpperCase()}</span>
                    <CaretRight size={12} weight="bold" className="text-[#79716b]" />
                  </div>
                )}
              >
                {RESTAURANT_LABEL}
              </MenuRow>
              <a
                href={`https://${storefrontHost}`}
                target="_blank"
                rel="noreferrer"
                className="flex min-h-8 w-full items-center gap-2 rounded-[8px] px-2 py-1.5 text-[13px] leading-5 text-[#0c0a09] transition hover:bg-[#f5f5f4] focus-visible:bg-[#f5f5f4] focus-visible:outline-none"
              >
                <GlobeHemisphereEast size={14} weight="fill" className="shrink-0 text-[#57534d]" />
                <span className="min-w-0 flex-1 truncate">{storefrontHost}</span>
                <ArrowUpRight size={14} className="shrink-0 text-[#57534d]" />
              </a>
            </MenuSection>
            <MenuSection>
              <MenuRow icon={UsersThree} onClick={() => setView("staff")} trailing={<CaretRight size={12} weight="bold" className="text-[#79716b]" />}>Сотрудники</MenuRow>
              <MenuRow icon={CurrencyKzt} onClick={() => setView("regional")} trailing={<CaretRight size={12} weight="bold" className="text-[#79716b]" />}>Валюта и часовой пояс</MenuRow>
            </MenuSection>
            <MenuSection>
              <Button type="button" variant="outline" size="sm" className="h-8 w-full rounded-[10px] text-[14px] font-normal" onClick={() => { close(); onNavigate("management", "billing"); }}>Улучшить тариф</Button>
            </MenuSection>
          </>
        )}

        {view === "locations" && (
          <>
            <SubmenuHeader title="Точки ресторана" onBack={() => setView("root")} />
            <div className="max-h-[248px] overflow-y-auto p-1">
              {locations.map((location) => {
                const selected = location.id === selectedVitrineId;
                return (
                  <Button
                    key={location.id}
                    type="button"
                    variant="ghost"
                    aria-pressed={selected}
                    onClick={() => setSelectedVitrineId(location.id)}
                    className={cn("min-h-10 w-full justify-start gap-2 rounded-[8px] px-2 text-left text-[13px] font-normal hover:bg-[#f5f5f4]", selected && "bg-[#f5f5f4] font-medium")}
                  >
                    <span className="flex size-4 items-center justify-center">{selected && <Check size={13} weight="bold" />}</span>
                    <span className="min-w-0 flex-1 truncate">{pointLabel(location.address)}</span>
                  </Button>
                );
              })}
              <Button type="button" variant="ghost" onClick={addLocation} disabled={!canAddLocation} className="mt-1 h-9 w-full justify-start gap-2 rounded-[8px] px-2 text-left text-[13px] font-medium text-[#4f39f6] hover:bg-indigo-50 disabled:text-[#a8a29e]">
                <Plus size={14} weight="bold" />Добавить точку
              </Button>
              {!canAddLocation && (
                <div className="mx-2 mb-2 mt-1 text-[11px] leading-4 text-[#79716b]">
                  Добавление точек доступно на тарифе Ultra. <Button type="button" variant="ghost" className="h-auto p-0 text-[11px] font-medium text-[#4f39f6] hover:bg-transparent" onClick={() => { close(); onNavigate("management", "billing"); }}>Улучшить тариф</Button>
                </div>
              )}
            </div>
          </>
        )}

        {view === "staff" && (
          <>
            <SubmenuHeader title="Сотрудники" onBack={() => setView("root")} />
            <div className="p-1">
              {staff.map((member) => (
                <div key={member.id} className="flex min-h-10 items-center gap-2 rounded-[8px] px-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-[#f5f5f4] text-[10px] font-semibold text-[#57534d]">{member.name.slice(0, 1)}</span>
                  <span className="min-w-0 flex-1"><span className="block truncate text-[13px] text-[#292524]">{member.name}</span><span className="block truncate text-[10px] text-[#79716b]">{member.role}</span></span>
                </div>
              ))}
              <Button type="button" variant="ghost" onClick={inviteStaff} disabled={!canInviteStaff} className="mt-1 h-9 w-full justify-start gap-2 rounded-[8px] px-2 text-left text-[13px] font-medium text-[#4f39f6] hover:bg-indigo-50 disabled:text-[#a8a29e]">
                <Plus size={14} weight="bold" />Пригласить сотрудника
              </Button>
              {!canInviteStaff && (
                <div className="mx-2 mb-2 mt-1 text-[11px] leading-4 text-[#79716b]">
                  Приглашение сотрудников доступно на тарифе Lite. <Button type="button" variant="ghost" className="h-auto p-0 text-[11px] font-medium text-[#4f39f6] hover:bg-transparent" onClick={() => { close(); onNavigate("management", "billing"); }}>Улучшить тариф</Button>
                </div>
              )}
            </div>
          </>
        )}

        {view === "regional" && (
          <>
            <SubmenuHeader title="Валюта и часовой пояс" onBack={() => setView("root")} />
            <div className="space-y-3 p-3">
              <label className="block text-[12px] font-medium text-[#292524]">
                Валюта
                <Select value={currencyValue} onValueChange={(currency) => { updateWorkspace({ currency }); registerChange("about"); }}>
                  <SelectTrigger aria-label="Валюта" className="mt-1 h-8 text-[12px] shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{CURRENCY_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
              <label className="block text-[12px] font-medium text-[#292524]">
                Часовой пояс
                <Select value={timezoneValue} onValueChange={(timezone) => { updateWorkspace({ timezone }); registerChange("about"); }}>
                  <SelectTrigger aria-label="Часовой пояс" className="mt-1 h-8 text-[12px] shadow-none"><SelectValue /></SelectTrigger>
                  <SelectContent>{TIMEZONE_OPTIONS.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
                </Select>
              </label>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
}
