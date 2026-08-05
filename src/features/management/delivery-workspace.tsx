import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CirclePlus,
  Loader2,
  MessageCircle,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TranslatableField } from "@/components/workspace/translatable-field";
import { PageContent, PageScroll } from "@/components/workspace/page-layout";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import {
  CHANNEL_LABELS,
  useOrderRouting,
  type ChannelType,
  type OrderEvent,
  type RouteChannel,
} from "@/contexts/order-routing-context";
import { usePublish } from "@/contexts/publish-context";
import { cn } from "@/lib/utils";

export type OrderSettingsTab = "delivery" | "pickup" | "service-fee" | "waiter";
export type OrderSettingsSaveState = "saving" | "saved" | "error";

const ORDER_TABS: { id: OrderSettingsTab; label: string }[] = [
  { id: "delivery", label: "Доставка" },
  { id: "pickup", label: "Самовывоз" },
  { id: "service-fee", label: "Сервисный сбор" },
  { id: "waiter", label: "Вызов официанта" },
];

export function OrderSettingsTabs({
  value,
  onChange,
}: {
  value: OrderSettingsTab;
  onChange: (tab: OrderSettingsTab) => void;
}) {
  return (
    <div className="max-w-full overflow-x-auto rounded-lg scrollbar-none">
      <div role="tablist" aria-label="Настройка заказов" className="inline-flex min-w-max items-center gap-0.5 rounded-lg bg-[#f5f5f4] p-0.5">
        {ORDER_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={value === tab.id}
            onClick={() => onChange(tab.id)}
            className={cn(
              "whitespace-nowrap rounded-lg px-2.5 py-1 text-[12px] transition",
              value === tab.id
                ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]"
                : "text-[#79716b] hover:text-zinc-700",
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function OrderSettingsSaveIndicator({ state }: { state: OrderSettingsSaveState }) {
  return (
    <div
      role="status"
      className={cn(
        "flex h-7 items-center gap-1.5 whitespace-nowrap rounded-md px-2 text-[12px]",
        state === "error" ? "text-red-600" : "text-[#79716b]",
      )}
    >
      {state === "saving" ? (
        <Loader2 size={13} className="animate-spin" />
      ) : state === "error" ? (
        <AlertCircle size={13} />
      ) : (
        <Check size={13} />
      )}
      {state === "saving" ? "Сохранение…" : state === "error" ? "Ошибка сохранения" : "Сохранено"}
    </div>
  );
}

const PURPOSE_LABELS: Record<OrderEvent, string> = {
  delivery: "Доставка",
  pickup: "Самовывоз",
  waiter: "Зал",
};

const PURPOSE_DESCRIPTIONS: Record<OrderEvent, string> = {
  delivery: "Заказы доставки",
  pickup: "Заказы самовывоза",
  waiter: "Вызовы официанта",
};

const CONNECTED_CHANNELS: Record<ChannelType, RouteChannel[]> = {
  telegram: [
    { type: "telegram", contact: "@kimchi_orders" },
    { type: "telegram", contact: "@kimchi_team" },
  ],
  whatsapp: [
    { type: "whatsapp", contact: "+7 701 555 55 55" },
    { type: "whatsapp", contact: "+7 707 404 20 20" },
  ],
};

function channelKey(channel: RouteChannel) {
  return `${channel.type}:${channel.contact}`;
}

function channelName(type: ChannelType, contact: string) {
  return `${CHANNEL_LABELS[type]} · ${contact}`;
}

function slugifyChannelName(value: string) {
  return value
    .toLocaleLowerCase("ru")
    .replace(/[^a-zа-яё0-9]+/gi, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);
}

function ChannelDialog({
  event,
  route,
  onClose,
  onSave,
  onClear,
}: {
  event: OrderEvent;
  route: RouteChannel | null;
  onClose: () => void;
  onSave: (channel: RouteChannel) => void;
  onClear: () => void;
}) {
  const { account } = useMockAuth();
  const venueName = account?.workspace.name || "RAUDA";
  const [type, setType] = useState<ChannelType>(route?.type ?? "telegram");
  const [mode, setMode] = useState<"existing" | "new">("existing");
  const [selectedKey, setSelectedKey] = useState(
    route ? channelKey(route) : channelKey(CONNECTED_CHANNELS.telegram[0]),
  );
  const [newContact, setNewContact] = useState("");
  const generatedChatName = `${venueName} · ${PURPOSE_LABELS[event]}`;
  const suggestedExisting = CONNECTED_CHANNELS[type][0];
  const selectedExisting = CONNECTED_CHANNELS[type].find((channel) => channelKey(channel) === selectedKey)
    ?? CONNECTED_CHANNELS[type][0];
  const generatedTelegramContact = `@${slugifyChannelName(`${venueName}_${PURPOSE_LABELS[event]}`)}`;
  const newChannel: RouteChannel = type === "telegram"
    ? { type, contact: generatedTelegramContact }
    : { type, contact: newContact.trim() };
  const canSave = mode === "existing" || newChannel.contact.length > 0;

  const switchType = (nextType: ChannelType) => {
    setType(nextType);
    setSelectedKey(channelKey(CONNECTED_CHANNELS[nextType][0]));
    setNewContact("");
  };

  return (
    <div className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/25 px-4" role="dialog" aria-modal="true" aria-label="Выбор канала уведомлений">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Закрыть" />
      <div className="relative flex max-h-[calc(100vh-32px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border border-[#e7e5e4] bg-white shadow-[0_24px_64px_rgba(41,37,36,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#eceae7] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-semibold text-[#292524]">Канал уведомлений</h2>
            <p className="mt-1 text-[12px] text-[#79716b]">Назначение: {PURPOSE_DESCRIPTIONS[event]}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524]">
            <X size={16} />
          </button>
        </div>

        <div className="overflow-y-auto px-5 py-5">
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-[#f5f5f4] p-0.5">
            {(["telegram", "whatsapp"] as ChannelType[]).map((channelType) => (
              <button
                key={channelType}
                type="button"
                onClick={() => switchType(channelType)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-[12px] transition",
                  type === channelType
                    ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]"
                    : "text-[#79716b] hover:text-[#292524]",
                )}
              >
                {CHANNEL_LABELS[channelType]}
              </button>
            ))}
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-[13px] font-medium text-[#292524]">Подключённые каналы</h3>
              <p className="mt-0.5 text-[12px] text-[#79716b]">Выберите чат или номер для этой функции.</p>
            </div>
            <button
              type="button"
              onClick={() => setMode("new")}
              className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4] hover:text-[#292524]"
            >
              <CirclePlus size={14} />
              Создать новый
            </button>
          </div>

          <div className="mt-3 space-y-2">
            {CONNECTED_CHANNELS[type].map((channel) => {
              const selected = mode === "existing" && selectedKey === channelKey(channel);
              return (
                <button
                  key={channelKey(channel)}
                  type="button"
                  onClick={() => {
                    setMode("existing");
                    setSelectedKey(channelKey(channel));
                  }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-[10px] border px-3 py-3 text-left transition",
                    selected
                      ? "border-[#a8a29e] bg-[#fafaf9]"
                      : "border-[#e7e5e4] hover:border-[#c7c2bd]",
                  )}
                >
                  <span className={cn("flex h-8 w-8 items-center justify-center rounded-[8px]", type === "telegram" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600")}>
                    <MessageCircle size={16} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-medium text-[#292524]">{channel.contact}</span>
                    <span className="mt-0.5 block text-[11px] text-[#79716b]">Уже подключён</span>
                  </span>
                  <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", selected ? "border-[#292524] bg-[#292524] text-white" : "border-[#c7c2bd]")}>
                    {selected && <Check size={10} />}
                  </span>
                </button>
              );
            })}
          </div>

          {mode === "new" && (
            <div className="mt-4 rounded-[10px] border border-[#e7e5e4] bg-[#fafaf9] p-4">
              <div className="text-[13px] font-medium text-[#292524]">
                {type === "telegram" ? "Новый Telegram-чат" : "Новый номер WhatsApp"}
              </div>
              {type === "telegram" ? (
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-[12px] text-[#79716b]">Название будет создано автоматически</span>
                    <Input value={generatedChatName} readOnly className="mt-1.5 h-9 bg-white text-[13px]" />
                  </label>
                  <div className="rounded-[8px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-800">
                    Подходящий канал уже есть: <span className="font-medium">{suggestedExisting.contact}</span>. Используйте его, чтобы не создавать дубликат.
                    <button
                      type="button"
                      className="ml-1 font-medium underline underline-offset-2"
                      onClick={() => {
                        setMode("existing");
                        setSelectedKey(channelKey(suggestedExisting));
                      }}
                    >
                      Использовать существующий
                    </button>
                  </div>
                </div>
              ) : (
                <label className="mt-3 block">
                  <span className="text-[12px] text-[#79716b]">Номер телефона</span>
                  <Input
                    value={newContact}
                    onChange={(eventValue) => setNewContact(eventValue.target.value)}
                    placeholder="+7 700 000 00 00"
                    className="mt-1.5 h-9 bg-white text-[13px]"
                  />
                </label>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-[#eceae7] px-5 py-4">
          <div>
            {route && (
              <button type="button" onClick={onClear} className="h-8 rounded-[8px] px-2 text-[12px] font-medium text-red-600 transition hover:bg-red-50">
                Убрать канал
              </button>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Отмена</Button>
            <Button
              type="button"
              size="sm"
              disabled={!canSave}
              onClick={() => onSave(mode === "existing" ? selectedExisting : newChannel)}
            >
              {mode === "new" ? "Создать и выбрать" : "Выбрать канал"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function FeatureHeader({
  title,
  description,
  enabled,
  validationMessage,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  validationMessage?: string;
  onToggle: (enabled: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-6 px-5 py-5">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[16px] font-semibold text-[#292524]">{title}</h2>
          {!enabled && (
            <span className="rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[10px] font-medium text-[#79716b]">Выключено</span>
          )}
        </div>
        <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#79716b]">{description}</p>
        {validationMessage && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-red-600">
            <AlertCircle size={13} />
            {validationMessage}
          </div>
        )}
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} aria-label={`${enabled ? "Выключить" : "Включить"} ${title.toLowerCase()}`} className="mt-0.5" />
    </div>
  );
}

function SettingsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="grid gap-4 border-t border-[#eceae7] px-5 py-5 md:grid-cols-[190px_minmax(0,1fr)] md:gap-7">
      <div>
        <h3 className="text-[13px] font-medium text-[#292524]">{title}</h3>
        {description && <p className="mt-1 text-[12px] leading-5 text-[#79716b]">{description}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

function CompactField({
  id,
  label,
  value,
  onChange,
  suffix,
  placeholder,
  type = "text",
}: {
  id?: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  suffix?: string;
  placeholder?: string;
  type?: "text" | "number";
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[12px] text-[#57534d]">{label}</span>
      <div className="relative">
        <Input
          id={id}
          type={type}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className={cn("h-9 rounded-[8px] bg-white px-3 text-[13px]", suffix && "pr-11")}
        />
        {suffix && <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-[12px] text-[#79716b]">{suffix}</span>}
      </div>
    </label>
  );
}

type TestState = "idle" | "sending" | "success" | "error";

function ChannelSection({
  route,
  testState,
  testLabel,
  onConfigure,
  onTest,
}: {
  route: RouteChannel | null;
  testState: TestState;
  testLabel: string;
  onConfigure: () => void;
  onTest: () => void;
}) {
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e7e5e4] bg-white px-3 py-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]", route?.type === "whatsapp" ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600")}>
            <MessageCircle size={16} />
          </span>
          <div className="min-w-0">
            {route ? (
              <>
                <div className="truncate text-[13px] font-medium text-[#292524]">{channelName(route.type, route.contact)}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle2 size={11} /> Канал подключён</div>
              </>
            ) : (
              <>
                <div className="text-[13px] font-medium text-[#292524]">Не настроено</div>
                <div className="mt-0.5 text-[11px] text-[#79716b]">Уведомления не будут приходить</div>
              </>
            )}
          </div>
        </div>
        <Button type="button" variant={route ? "outline" : "default"} size="sm" onClick={onConfigure}>
          {route ? "Изменить" : "Настроить"}
        </Button>
      </div>
      <div className="mt-2 flex min-h-8 flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={onTest}
          disabled={testState === "sending"}
          className="inline-flex h-8 items-center gap-1.5 rounded-[8px] px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4] hover:text-[#292524] disabled:opacity-50"
        >
          {testState === "sending" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
          {testState === "sending" ? "Отправляем…" : testLabel}
        </button>
        {testState === "success" && <span role="status" className="flex items-center gap-1 text-[12px] text-emerald-600"><CheckCircle2 size={13} /> Сообщение отправлено</span>}
        {testState === "error" && <span role="alert" className="flex items-center gap-1 text-[12px] text-red-600"><AlertCircle size={13} /> Не удалось отправить: настройте канал</span>}
      </div>
    </div>
  );
}

function ToggleSetting({
  title,
  description,
  checked,
  onChange,
}: {
  title: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-4 py-1">
      <div>
        <div className="text-[13px] text-[#292524]">{title}</div>
        {description && <p className="mt-1 text-[12px] leading-5 text-[#79716b]">{description}</p>}
      </div>
      <Switch checked={checked} onCheckedChange={onChange} className="mt-0.5" />
    </div>
  );
}

function WorkspaceLoading() {
  return (
    <div className="overflow-hidden rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_1px_4px_rgba(12,12,13,0.05)]" aria-label="Загрузка настроек">
      <div className="animate-pulse px-5 py-5">
        <div className="h-4 w-32 rounded bg-[#eceae7]" />
        <div className="mt-3 h-3 w-80 max-w-full rounded bg-[#f1f1ef]" />
      </div>
      {[0, 1, 2].map((item) => (
        <div key={item} className="grid animate-pulse gap-4 border-t border-[#eceae7] px-5 py-5 md:grid-cols-[190px_minmax(0,1fr)] md:gap-7">
          <div className="h-3 w-28 rounded bg-[#eceae7]" />
          <div className="h-9 rounded bg-[#f1f1ef]" />
        </div>
      ))}
    </div>
  );
}

export function DeliveryWorkspace({
  activeTab,
  onSaveStateChange,
}: {
  activeTab: OrderSettingsTab;
  onSaveStateChange: (state: OrderSettingsSaveState) => void;
}) {
  const {
    serviceFeeEnabled,
    setServiceFeeEnabled,
    serviceFeePercent,
    setServiceFeePercent,
    serviceFeeRequireConsent,
    setServiceFeeRequireConsent,
    deliveryEnabled,
    setDeliveryEnabled,
    pickupEnabled,
    setPickupEnabled,
    setDeliveryComment,
    setPickupComment,
    pickupAddress,
  } = useAppSettings();
  const { routes, setRoute } = useOrderRouting();
  const { registerChange } = usePublish();
  const saveTimerRef = useRef<number | null>(null);
  const testTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogEvent, setDialogEvent] = useState<OrderEvent | null>(null);
  const [validationEvent, setValidationEvent] = useState<OrderEvent | null>(null);
  const [testStates, setTestStates] = useState<Record<OrderEvent, TestState>>({ delivery: "idle", pickup: "idle", waiter: "idle" });
  const [deliveryMinimum, setDeliveryMinimum] = useState("5000");
  const [deliveryPrice, setDeliveryPrice] = useState("700");
  const [freeDeliveryFrom, setFreeDeliveryFrom] = useState("12000");
  const [deliveryTime, setDeliveryTime] = useState("45–60");
  const [pickupPoint, setPickupPoint] = useState(pickupAddress);
  const [pickupTime, setPickupTime] = useState("20");
  const [serviceApplications, setServiceApplications] = useState({ delivery: true, pickup: true, dineIn: true });
  const [waiterEnabled, setWaiterEnabled] = useState(true);
  const [includeTable, setIncludeTable] = useState(true);
  const [includeZone, setIncludeZone] = useState(true);
  const [repeatDelay, setRepeatDelay] = useState("2");

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (testTimerRef.current) window.clearTimeout(testTimerRef.current);
  }, []);

  const queueSave = (register = false, fail = false) => {
    if (register) registerChange("order-settings");
    onSaveStateChange("saving");
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    saveTimerRef.current = window.setTimeout(() => onSaveStateChange(fail ? "error" : "saved"), 700);
  };

  const setTestState = (event: OrderEvent, state: TestState) => {
    setTestStates((current) => ({ ...current, [event]: state }));
  };

  const sendTest = (event: OrderEvent) => {
    setTestState(event, "sending");
    if (testTimerRef.current) window.clearTimeout(testTimerRef.current);
    testTimerRef.current = window.setTimeout(() => {
      setTestState(event, routes[event] ? "success" : "error");
    }, 650);
  };

  const toggleRoutedFeature = (event: OrderEvent, enabled: boolean) => {
    if (enabled && !routes[event]) {
      setValidationEvent(event);
      onSaveStateChange("error");
      return;
    }
    setValidationEvent(null);
    if (event === "delivery") setDeliveryEnabled(enabled);
    if (event === "pickup") setPickupEnabled(enabled);
    if (event === "waiter") setWaiterEnabled(enabled);
    queueSave(true);
  };

  const disableFeatureForMissingRoute = (event: OrderEvent) => {
    if (event === "delivery") setDeliveryEnabled(false);
    if (event === "pickup") setPickupEnabled(false);
    if (event === "waiter") setWaiterEnabled(false);
    setValidationEvent(event);
  };

  const content = useMemo(() => {
    if (activeTab === "delivery") {
      return {
        title: "Доставка",
        description: "Гости смогут оформить доставку через витрину.",
        enabled: deliveryEnabled,
      };
    }
    if (activeTab === "pickup") {
      return {
        title: "Самовывоз",
        description: "Гости смогут самостоятельно забрать заказ из заведения.",
        enabled: pickupEnabled,
      };
    }
    if (activeTab === "service-fee") {
      return {
        title: "Сервисный сбор",
        description: "Добавьте сервисный сбор к заказу и сообщите об этом гостю до подтверждения.",
        enabled: serviceFeeEnabled,
      };
    }
    return {
      title: "Вызов официанта",
      description: "Гость сможет позвать официанта прямо из витрины.",
      enabled: waiterEnabled,
    };
  }, [activeTab, deliveryEnabled, pickupEnabled, serviceFeeEnabled, waiterEnabled]);

  const activeRouteEvent: OrderEvent | null = activeTab === "service-fee" ? null : activeTab;
  const validationMessage = activeRouteEvent && validationEvent === activeRouteEvent
    ? "Сначала настройте обязательный канал уведомлений."
    : undefined;

  return (
    <PageScroll>
      <PageContent className="max-w-5xl space-y-0 px-8 pb-8 pt-5">
        {loading ? (
          <WorkspaceLoading />
        ) : (
          <div className="overflow-hidden rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
            <FeatureHeader
              title={content.title}
              description={content.description}
              enabled={content.enabled}
              validationMessage={validationMessage}
              onToggle={(enabled) => {
                if (activeTab === "service-fee") {
                  setServiceFeeEnabled(enabled);
                  queueSave(true);
                } else {
                  toggleRoutedFeature(activeTab, enabled);
                }
              }}
            />

            {activeTab === "delivery" && (
              <>
                <fieldset disabled={!deliveryEnabled} className={cn(!deliveryEnabled && "opacity-50")}>
                  <SettingsSection title="Условия доставки" description="Суммы отображаются в валюте заведения.">
                    <div className="grid gap-4 sm:grid-cols-2">
                      <CompactField label="Минимальная сумма заказа" value={deliveryMinimum} onChange={(value) => { setDeliveryMinimum(value); queueSave(); }} suffix="₸" type="number" />
                      <CompactField label="Стоимость доставки" value={deliveryPrice} onChange={(value) => { setDeliveryPrice(value); queueSave(); }} suffix="₸" type="number" />
                      <CompactField label="Бесплатная доставка от" value={freeDeliveryFrom} onChange={(value) => { setFreeDeliveryFrom(value); queueSave(); }} suffix="₸" type="number" />
                      <CompactField label="Примерное время доставки" value={deliveryTime} onChange={(value) => { setDeliveryTime(value); queueSave(); }} suffix="мин" />
                    </div>
                  </SettingsSection>
                  <SettingsSection title="Комментарий для гостя" description="Текст меняется для выбранной языковой версии.">
                    <TranslatableField
                      label="Комментарий"
                      initialTranslations={{ ru: "Курьер свяжется с вами после подтверждения заказа." }}
                      multiline
                      rows={3}
                      plain
                      showTranslationMeta={false}
                      storageKey="order-settings.delivery-comment"
                      onValueChange={(value) => { setDeliveryComment(value); queueSave(); }}
                    />
                  </SettingsSection>
                </fieldset>
                <SettingsSection title="Получение заказов" description="Канал, куда будут приходить новые заказы.">
                  <ChannelSection route={routes.delivery} testState={testStates.delivery} testLabel="Отправить тест" onConfigure={() => setDialogEvent("delivery")} onTest={() => sendTest("delivery")} />
                </SettingsSection>
              </>
            )}

            {activeTab === "pickup" && (
              <>
                <fieldset disabled={!pickupEnabled} className={cn(!pickupEnabled && "opacity-50")}>
                  <SettingsSection title="Точка самовывоза" description="Адрес, который увидит гость после оформления.">
                    <div className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <CompactField id="pickup-address-input" label="Адрес" value={pickupPoint} onChange={(value) => { setPickupPoint(value); queueSave(); }} />
                      </div>
                      <Button type="button" variant="outline" size="sm" className="mb-0.5" onClick={() => document.getElementById("pickup-address-input")?.focus()}>Изменить</Button>
                    </div>
                  </SettingsSection>
                  <SettingsSection title="Подготовка заказа" description="Срок и сообщение после подтверждения заказа.">
                    <div className="space-y-4">
                      <div className="max-w-[260px]">
                        <CompactField label="Примерное время приготовления" value={pickupTime} onChange={(value) => { setPickupTime(value); queueSave(); }} suffix="мин" type="number" />
                      </div>
                      <TranslatableField
                        label="Комментарий для гостя"
                        initialTranslations={{ ru: "Заказ будет готов через 20 минут." }}
                        multiline
                        rows={3}
                        plain
                        showTranslationMeta={false}
                        storageKey="order-settings.pickup-comment"
                        onValueChange={(value) => { setPickupComment(value); queueSave(); }}
                      />
                    </div>
                  </SettingsSection>
                </fieldset>
                <SettingsSection title="Получение заказов" description="Канал, куда будут приходить новые заказы.">
                  <ChannelSection route={routes.pickup} testState={testStates.pickup} testLabel="Отправить тест" onConfigure={() => setDialogEvent("pickup")} onTest={() => sendTest("pickup")} />
                </SettingsSection>
              </>
            )}

            {activeTab === "service-fee" && (
              <fieldset disabled={!serviceFeeEnabled} className={cn(!serviceFeeEnabled && "opacity-50")}>
                <SettingsSection title="Размер сбора" description="Процент добавится к итоговой сумме заказа.">
                  <div className="max-w-[220px]">
                    <CompactField label="Сервисный сбор" value={String(serviceFeePercent)} onChange={(value) => { setServiceFeePercent(Math.min(100, Math.max(0, Number(value) || 0))); queueSave(); }} suffix="%" type="number" />
                  </div>
                </SettingsSection>
                <SettingsSection title="Применение сбора" description="Выберите способы обслуживания, для которых действует сбор.">
                  <div className="space-y-3">
                    {([
                      ["delivery", "Доставка"],
                      ["pickup", "Самовывоз"],
                      ["dineIn", "Заказ в заведении"],
                    ] as const).map(([key, label]) => (
                      <label key={key} className="flex cursor-pointer items-center gap-2.5 text-[13px] text-[#292524]">
                        <input
                          type="checkbox"
                          checked={serviceApplications[key]}
                          onChange={(eventValue) => {
                            setServiceApplications((current) => ({ ...current, [key]: eventValue.target.checked }));
                            queueSave();
                          }}
                          className="h-4 w-4 rounded border-[#c7c2bd] accent-[#292524]"
                        />
                        {label}
                      </label>
                    ))}
                  </div>
                </SettingsSection>
                <SettingsSection title="Согласие гостя">
                  <ToggleSetting
                    title="Требовать согласие гостя"
                    description="Гость должен подтвердить согласие с сервисным сбором перед продолжением."
                    checked={serviceFeeRequireConsent}
                    onChange={(checked) => { setServiceFeeRequireConsent(checked); queueSave(true); }}
                  />
                </SettingsSection>
              </fieldset>
            )}

            {activeTab === "waiter" && (
              <>
                <SettingsSection title="Получение вызовов" description="Канал для уведомлений сотрудников зала.">
                  <ChannelSection route={routes.waiter} testState={testStates.waiter} testLabel="Отправить тестовый вызов" onConfigure={() => setDialogEvent("waiter")} onTest={() => sendTest("waiter")} />
                </SettingsSection>
                <fieldset disabled={!waiterEnabled} className={cn(!waiterEnabled && "opacity-50")}>
                  <SettingsSection title="Данные вызова" description="Информация, которую получит сотрудник.">
                    <div className="space-y-4">
                      <ToggleSetting title="Передавать номер стола" checked={includeTable} onChange={(checked) => { setIncludeTable(checked); queueSave(true); }} />
                      <div className="border-t border-[#eceae7]" />
                      <ToggleSetting title="Передавать название зоны" checked={includeZone} onChange={(checked) => { setIncludeZone(checked); queueSave(true); }} />
                      <div className="border-t border-[#eceae7]" />
                      <div className="max-w-[320px]">
                        <CompactField label="Защита от повторного вызова" value={repeatDelay} onChange={(value) => { setRepeatDelay(value); queueSave(); }} suffix="мин" type="number" />
                        <p className="mt-1.5 text-[11px] leading-4 text-[#79716b]">Повторная кнопка станет доступна гостю после этого интервала.</p>
                      </div>
                    </div>
                  </SettingsSection>
                </fieldset>
              </>
            )}
          </div>
        )}
      </PageContent>

      {dialogEvent && (
        <ChannelDialog
          key={dialogEvent}
          event={dialogEvent}
          route={routes[dialogEvent]}
          onClose={() => setDialogEvent(null)}
          onSave={(channel) => {
            setRoute(dialogEvent, channel);
            setValidationEvent(null);
            setTestState(dialogEvent, "idle");
            queueSave(true);
            setDialogEvent(null);
          }}
          onClear={() => {
            setRoute(dialogEvent, null);
            disableFeatureForMissingRoute(dialogEvent);
            setTestState(dialogEvent, "idle");
            queueSave(true);
            setDialogEvent(null);
          }}
        />
      )}
    </PageScroll>
  );
}
