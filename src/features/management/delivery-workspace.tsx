import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  AlertCircle,
  Check,
  CheckCircle2,
  CreditCard,
  Loader2,
  MoreHorizontal,
  Send,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { TranslatableField } from "@/components/workspace/translatable-field";
import { CompactContent, PageContent, PageScroll } from "@/components/workspace/page-layout";
import {
  ChannelIcon,
  ChannelManagerPopover,
  ChannelPickerPopover,
  channelAssignmentText,
  getChannelPopoverAnchor,
  type ChannelManagerInitialView,
  type ChannelPopoverAnchor,
} from "@/features/management/order-channels-dialogs";
import { useAppSettings } from "@/contexts/app-settings-context";
import {
  CHANNEL_LABELS,
  useOrderRouting,
  type ChannelType,
  type OrderChannel,
  type OrderEvent,
  type RouteChannel,
} from "@/contexts/order-routing-context";
import { usePublish } from "@/contexts/publish-context";
import { cn } from "@/lib/utils";

export type OrderSettingsTab = "delivery" | "pickup" | "payment" | "service-fee" | "waiter";
export type OrderSettingsSaveState = "saving" | "saved" | "error";

const ORDER_TABS: { id: OrderSettingsTab; label: string }[] = [
  { id: "delivery", label: "Доставка" },
  { id: "pickup", label: "Самовывоз" },
  { id: "payment", label: "Оплата" },
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
  const [visible, setVisible] = useState(state !== "saved");
  const activeRef = useRef(state !== "saved");

  useEffect(() => {
    if (state === "saving" || state === "error") {
      activeRef.current = true;
      setVisible(true);
      return;
    }
    if (!activeRef.current) return;
    setVisible(true);
    const timer = window.setTimeout(() => {
      setVisible(false);
      activeRef.current = false;
    }, 1600);
    return () => window.clearTimeout(timer);
  }, [state]);

  if (!visible) return null;
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
      {state === "saving" ? "Сохранение…" : state === "error" ? "Не удалось сохранить" : "Сохранено"}
    </div>
  );
}

function channelName(type: ChannelType, contact: string) {
  return `${CHANNEL_LABELS[type]} · ${contact}`;
}

function channelStatus(status: RouteChannel["status"]) {
  if (status === "connected") return { label: "Подключено", className: "text-emerald-600" };
  if (status === "checking") return { label: "Проверяем", className: "text-amber-600" };
  if (status === "error") return { label: "Ошибка подключения", className: "text-red-600" };
  return { label: "Не подключено", className: "text-[#79716b]" };
}

function FeatureHeader({
  title,
  description,
  enabled,
  status,
  validationMessage,
  onToggle,
}: {
  title: string;
  description: string;
  enabled: boolean;
  status: "Не настроено" | "Выключено" | "Включено" | "Требует настройки";
  validationMessage?: string;
  onToggle: (enabled: boolean, anchor: ChannelPopoverAnchor) => void;
}) {
  const toggleAnchorRef = useRef<HTMLSpanElement>(null);
  return (
    <div className="flex items-start justify-between gap-6 px-1 py-1">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-[14px] font-medium leading-tight text-stone-950">{title}</h1>
          <span className={cn(
            "rounded-[5px] px-1.5 py-0.5 text-[10px] font-medium",
            status === "Включено" ? "bg-emerald-50 text-emerald-700" : status === "Требует настройки" ? "bg-amber-50 text-amber-800" : "bg-[#f1f1ea] text-[#79716b]",
          )}>{status}</span>
        </div>
        <p className="mt-1 max-w-2xl text-sm text-zinc-500">{description}</p>
        {validationMessage && (
          <div className="mt-2 flex items-center gap-1.5 text-[12px] text-red-600">
            <AlertCircle size={13} />
            {validationMessage}
          </div>
        )}
      </div>
      <span ref={toggleAnchorRef} className="mt-0.5 flex"><Switch checked={enabled} onCheckedChange={(checked) => onToggle(checked, getChannelPopoverAnchor(toggleAnchorRef.current ?? document.body))} aria-label={`${enabled ? "Выключить" : "Включить"} ${title.toLowerCase()}`} /></span>
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
    <section className="border-t border-[#eceae7] px-5 py-5 first:border-t-0">
      <div>
        <h3 className="text-[13px] font-medium text-[#292524]">{title}</h3>
        {description && <p className="mt-1 text-[12px] leading-5 text-[#79716b]">{description}</p>}
      </div>
      <div className="mt-4 min-w-0">{children}</div>
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
  event,
  route,
  testState,
  testLabel,
  onSelect,
  onConfigure,
  onDetach,
  availableChannels,
  getAssignments,
  onUse,
  onCreate,
  onShowAll,
  onTest,
}: {
  event: OrderEvent;
  route: RouteChannel | null;
  testState: TestState;
  testLabel: string;
  onSelect: (anchor: ChannelPopoverAnchor) => void;
  onConfigure: (anchor: ChannelPopoverAnchor) => void;
  onDetach: () => void;
  availableChannels: OrderChannel[];
  getAssignments: (channelId: string) => OrderEvent[];
  onUse: (channel: OrderChannel) => void;
  onCreate: () => void;
  onShowAll: () => void;
  onTest: () => void;
}) {
  const routeStatus = route ? channelStatus(route.status) : null;
  const detachLabel = event === "delivery" ? "Убрать из доставки" : event === "pickup" ? "Убрать из самовывоза" : "Убрать из вызова официанта";
  return (
    <div>
      {route ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e7e5e4] bg-white px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <ChannelIcon type={route.type} />
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-[#292524]">{route.name}</div>
              <div className="mt-0.5 truncate text-[11px] text-[#79716b]">{channelName(route.type, route.contact)}</div>
              {routeStatus && <div className={cn("mt-0.5 text-[11px]", routeStatus.className)}>{routeStatus.label}</div>}
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={(eventValue) => onSelect(getChannelPopoverAnchor(eventValue.currentTarget))}>Сменить канал</Button>
            <Button type="button" variant="outline" size="sm" onClick={onTest} disabled={testState === "sending"}>
              {testState === "sending" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {testState === "sending" ? "Отправляем…" : testLabel}
            </Button>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" aria-label="Действия канала" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#79716b] outline-none transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:ring-2 focus-visible:ring-[#292524]/10"><MoreHorizontal size={16} /></button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content sideOffset={6} align="end" className="z-[100007] min-w-[210px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none">
                  <DropdownMenu.Item onSelect={(eventValue) => onConfigure(getChannelPopoverAnchor(eventValue.currentTarget as Element))} className="flex h-8 cursor-pointer items-center rounded-[8px] px-2 text-[12px] text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]">Настроить канал</DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                  <DropdownMenu.Item onSelect={onDetach} className="flex h-8 cursor-pointer items-center rounded-[8px] px-2 text-[12px] text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]">{detachLabel}</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        </div>
      ) : (
        availableChannels.length ? (
          <div>
            <div className="divide-y divide-[#eceae7] overflow-hidden rounded-[10px] border border-[#e7e5e4] bg-white">
              {availableChannels.slice(0, 3).map((channel) => (
                <div key={channel.id} className="flex min-h-[58px] items-center gap-3 px-2.5 py-2">
                  <ChannelIcon type={channel.type} />
                  <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-medium text-[#292524]">{channel.name}</div><div className="truncate text-[11px] text-[#79716b]">{channelName(channel.type, channel.contact)}</div><div className="truncate text-[10px] text-[#a8a29e]">{channelAssignmentText(getAssignments(channel.id))}</div></div>
                  <Button type="button" variant="ghost" size="sm" onClick={() => onUse(channel)}>Использовать</Button>
                </div>
              ))}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2"><button type="button" onClick={onCreate} className="h-8 rounded-[8px] px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4]">Создать новый канал</button>{availableChannels.length > 3 && <button type="button" onClick={onShowAll} className="h-8 rounded-[8px] px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4]">Показать все каналы</button>}</div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-dashed border-[#d8d5d0] bg-[#fafaf9] px-4 py-4"><div className="min-w-0"><div className="text-[13px] font-medium text-[#292524]">Каналов пока нет</div><p className="mt-1 text-[12px] leading-5 text-[#79716b]">Создайте канал, чтобы получать уведомления.</p></div><Button type="button" size="sm" onClick={onCreate}>Создать канал</Button></div>
        )
      )}
      {route && testState === "success" && <span role="status" className="sr-only">Тестовое сообщение отправлено</span>}
      {route && testState === "error" && <span role="alert" className="sr-only">Не удалось отправить сообщение. Проверьте подключение канала.</span>}
    </div>
  );
}

function PaymentConnectionDialog({ onClose }: { onClose: () => void }) {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/25 px-4" role="dialog" aria-modal="true" aria-labelledby="payment-dialog-title">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Закрыть" />
      <div className="relative w-full max-w-[520px] rounded-[16px] border border-[#e7e5e4] bg-white shadow-[0_24px_64px_rgba(41,37,36,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#eceae7] px-5 py-4">
          <div>
            <div className="text-[11px] font-medium uppercase tracking-[0.04em] text-[#a8a29e]">Шаг 1</div>
            <h2 id="payment-dialog-title" className="mt-1 text-[15px] font-semibold text-[#292524]">Подключение эквайринга</h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524]"><X size={16} /></button>
        </div>
        <div className="px-5 py-5">
          <p className="text-[13px] leading-5 text-[#57534d]">Для подключения понадобятся данные, которые выдаёт банк после заключения договора интернет-эквайринга.</p>
          <div className="mt-4 rounded-[10px] border border-[#e7e5e4] bg-[#fafaf9] px-3 py-3 text-[12px] leading-5 text-[#79716b]">
            Платёжный провайдер для этого проекта пока не настроен. Реквизиты появятся после подключения поддерживаемой интеграции.
          </div>
        </div>
        <div className="flex justify-end border-t border-[#eceae7] px-5 py-4">
          <Button type="button" size="sm" onClick={onClose}>Понятно</Button>
        </div>
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
  channelsManagerOpen,
  onChannelsManagerOpenChange,
  channelsManagerAnchor,
}: {
  activeTab: OrderSettingsTab;
  onSaveStateChange: (state: OrderSettingsSaveState) => void;
  channelsManagerOpen: boolean;
  onChannelsManagerOpenChange: (open: boolean) => void;
  channelsManagerAnchor: ChannelPopoverAnchor | null;
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
    waiterEnabled,
    setWaiterEnabled,
    deliveryComment,
    setDeliveryComment,
    pickupComment,
    setPickupComment,
    pickupAddress,
    setPickupAddress,
  } = useAppSettings();
  const { channels, routes, setRoute, getChannelAssignments } = useOrderRouting();
  const { registerChange } = usePublish();
  const saveTimerRef = useRef<number | null>(null);
  const testTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [pickerRequest, setPickerRequest] = useState<{ event: OrderEvent; anchor: ChannelPopoverAnchor; enableAfterSelect: boolean } | null>(null);
  const [managerInitialView, setManagerInitialView] = useState<ChannelManagerInitialView>({ type: "list" });
  const [managerKey, setManagerKey] = useState(0);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [testStates, setTestStates] = useState<Record<OrderEvent, TestState>>({ delivery: "idle", pickup: "idle", waiter: "idle" });
  const [requiresSetupEvents, setRequiresSetupEvents] = useState<OrderEvent[]>([]);
  const [pickupPoint, setPickupPoint] = useState(pickupAddress);
  const [pickupAddressEditing, setPickupAddressEditing] = useState(false);
  const [serviceApplications, setServiceApplications] = useState({ delivery: false, pickup: false, dineIn: false });
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!channelsManagerOpen) setManagerInitialView({ type: "list" });
  }, [channelsManagerOpen]);

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (testTimerRef.current) window.clearTimeout(testTimerRef.current);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    const missing: OrderEvent[] = [];
    if (!routes.delivery && deliveryEnabled) { setDeliveryEnabled(false); missing.push("delivery"); }
    if (!routes.pickup && pickupEnabled) { setPickupEnabled(false); missing.push("pickup"); }
    if (!routes.waiter && waiterEnabled) { setWaiterEnabled(false); missing.push("waiter"); }
    if (missing.length) setRequiresSetupEvents((current) => Array.from(new Set([...current, ...missing])));
  }, [routes.delivery, routes.pickup, routes.waiter, deliveryEnabled, pickupEnabled, waiterEnabled, setDeliveryEnabled, setPickupEnabled, setWaiterEnabled]);

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
      const success = Boolean(routes[event]);
      setTestState(event, success ? "success" : "error");
      setToast({
        message: success
          ? "Тестовое сообщение отправлено"
          : "Не удалось отправить сообщение. Проверьте подключение канала.",
        tone: success ? "success" : "error",
      });
    }, 650);
  };

  const toggleRoutedFeature = (event: OrderEvent, enabled: boolean, anchor: ChannelPopoverAnchor) => {
    if (enabled && !routes[event]) {
      if (channels.length) setPickerRequest({ event, anchor, enableAfterSelect: true });
      else openChannelManager({ type: "create", sourceEvent: event });
      return;
    }
    if (event === "delivery") setDeliveryEnabled(enabled);
    if (event === "pickup") setPickupEnabled(enabled);
    if (event === "waiter") setWaiterEnabled(enabled);
    queueSave(true);
  };

  const setFeatureEnabled = (event: OrderEvent, enabled: boolean) => {
    if (event === "delivery") setDeliveryEnabled(enabled);
    if (event === "pickup") setPickupEnabled(enabled);
    if (event === "waiter") setWaiterEnabled(enabled);
  };

  const detachChannel = (event: OrderEvent) => {
    setRoute(event, null);
    setFeatureEnabled(event, false);
    setRequiresSetupEvents((current) => current.filter((candidate) => candidate !== event));
    setTestState(event, "idle");
    queueSave(true);
    const target = event === "delivery" ? "доставки" : event === "pickup" ? "самовывоза" : "вызова официанта";
    setToast({ message: `Канал отключён от ${target}`, tone: "success" });
  };

  const handleAssignmentsRemoved = (events: OrderEvent[]) => {
    events.forEach((event) => setFeatureEnabled(event, false));
    setRequiresSetupEvents((current) => current.filter((event) => !events.includes(event)));
    queueSave(true);
  };

  const openChannelManager = (initialView: ChannelManagerInitialView = { type: "list" }) => {
    setManagerInitialView(initialView);
    setManagerKey((current) => current + 1);
    onChannelsManagerOpenChange(true);
  };

  const useChannelForEvent = (event: OrderEvent, channel: OrderChannel) => {
    setRoute(event, channel);
    setFeatureEnabled(event, true);
    setRequiresSetupEvents((current) => current.filter((candidate) => candidate !== event));
    setTestState(event, "idle");
    queueSave(true);
    const target = event === "delivery" ? "доставке" : event === "pickup" ? "самовывозу" : "вызовам официанта";
    setToast({ message: `Канал подключён к ${target}`, tone: "success" });
  };

  const functionStatus = (event: OrderEvent, enabled: boolean): "Не настроено" | "Выключено" | "Включено" | "Требует настройки" => {
    if (!routes[event]) return requiresSetupEvents.includes(event) ? "Требует настройки" : "Не настроено";
    return enabled ? "Включено" : "Выключено";
  };

  const content = useMemo(() => {
    if (activeTab === "delivery") {
      return {
        title: "Доставка",
        description: "Гости смогут оформить доставку через витрину.",
        enabled: deliveryEnabled,
        status: functionStatus("delivery", deliveryEnabled),
      };
    }
    if (activeTab === "pickup") {
      return {
        title: "Самовывоз",
        description: "Гости смогут самостоятельно забрать заказ из заведения.",
        enabled: pickupEnabled,
        status: functionStatus("pickup", pickupEnabled),
      };
    }
    if (activeTab === "payment") {
      return {
        title: "Оплата",
        description: "Подключите онлайн-оплату, чтобы гости могли оплачивать заказы на витрине.",
        enabled: false,
        status: "Не настроено" as const,
      };
    }
    if (activeTab === "service-fee") {
      return {
        title: "Сервисный сбор",
        description: "Добавьте сервисный сбор к заказу и сообщите об этом гостю до подтверждения.",
        enabled: serviceFeeEnabled,
        status: serviceFeeEnabled ? "Включено" as const : "Выключено" as const,
      };
    }
    return {
      title: "Вызов официанта",
      description: "Гость сможет позвать официанта прямо из витрины.",
      enabled: waiterEnabled,
      status: functionStatus("waiter", waiterEnabled),
    };
  }, [activeTab, deliveryEnabled, pickupEnabled, serviceFeeEnabled, waiterEnabled, routes, requiresSetupEvents]);

  const effectiveChannelsManagerAnchor = channelsManagerAnchor ?? (() => {
    if (typeof document !== "undefined") {
      const trigger = document.querySelector("[data-order-channels-trigger]");
      if (trigger) return getChannelPopoverAnchor(trigger);
    }
    const right = typeof window === "undefined" ? 1000 : window.innerWidth - 24;
    return { left: right - 160, right, top: 40, bottom: 72 };
  })();

  return (
    <PageScroll>
      <PageContent className="space-y-0">
        <CompactContent className="space-y-4">
        {!loading && (activeTab === "payment" ? (
          <div className="flex flex-wrap items-start justify-between gap-5 px-1 py-1">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-[17px] font-semibold text-[#292524]">Оплата</h1>
                <span className="rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[10px] font-medium text-[#79716b]">Не настроено</span>
              </div>
              <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#79716b]">Подключите онлайн-оплату, чтобы гости могли оплачивать заказы на витрине.</p>
            </div>
            <Button type="button" size="sm" onClick={() => setPaymentDialogOpen(true)}><CreditCard size={14} /> Подключить эквайринг</Button>
          </div>
        ) : (
          <FeatureHeader
            title={content.title}
            description={content.description}
            enabled={content.enabled}
            status={content.status}
            onToggle={(enabled, anchor) => {
              if (activeTab === "service-fee") {
                setServiceFeeEnabled(enabled);
                queueSave(true);
              } else if (activeTab === "delivery" || activeTab === "pickup" || activeTab === "waiter") {
                toggleRoutedFeature(activeTab, enabled, anchor);
              }
            }}
          />
        ))}
        {loading ? (
          <WorkspaceLoading />
        ) : (
          <div className="overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
            {activeTab === "delivery" && (
              <>
                <SettingsSection title="Получение заказов" description="Канал, куда будут приходить новые заказы.">
                  <ChannelSection
                    event="delivery"
                    route={routes.delivery}
                    testState={testStates.delivery}
                    testLabel="Отправить тест"
                    onSelect={(anchor) => setPickerRequest({ event: "delivery", anchor, enableAfterSelect: false })}
                    onConfigure={() => routes.delivery && openChannelManager({ type: "edit", channelId: routes.delivery.id })}
                    onDetach={() => detachChannel("delivery")}
                    availableChannels={channels}
                    getAssignments={getChannelAssignments}
                    onUse={(channel) => useChannelForEvent("delivery", channel)}
                    onCreate={() => openChannelManager({ type: "create", sourceEvent: "delivery" })}
                    onShowAll={() => openChannelManager({ type: "list" })}
                    onTest={() => sendTest("delivery")}
                  />
                </SettingsSection>
                {routes.delivery && (
                  <SettingsSection
                    title="Информация о доставке"
                    description="Гость увидит этот текст при оформлении заказа. Укажите важные условия: минимальную сумму заказа, стоимость и примерное время доставки."
                  >
                    <TranslatableField
                      label="Текст при оформлении"
                      initialTranslations={{ ru: deliveryComment }}
                      multiline
                      rows={3}
                      plain
                      showTranslationMeta={false}
                      persist={false}
                      placeholder="Например: минимальная сумма заказа — 5 000 ₸. Доставка занимает 45–60 минут."
                      onValueChange={(value) => { setDeliveryComment(value); queueSave(); }}
                    />
                  </SettingsSection>
                )}
              </>
            )}

            {activeTab === "pickup" && (
              <>
                <SettingsSection title="Получение заказов" description="Канал, куда будут приходить новые заказы.">
                  <ChannelSection event="pickup" route={routes.pickup} testState={testStates.pickup} testLabel="Отправить тест" onSelect={(anchor) => setPickerRequest({ event: "pickup", anchor, enableAfterSelect: false })} onConfigure={() => routes.pickup && openChannelManager({ type: "edit", channelId: routes.pickup.id })} onDetach={() => detachChannel("pickup")} availableChannels={channels} getAssignments={getChannelAssignments} onUse={(channel) => useChannelForEvent("pickup", channel)} onCreate={() => openChannelManager({ type: "create", sourceEvent: "pickup" })} onShowAll={() => openChannelManager({ type: "list" })} onTest={() => sendTest("pickup")} />
                </SettingsSection>
                {routes.pickup && (
                  <>
                    <SettingsSection title="Точка самовывоза" description="Адрес, который увидит гость после оформления.">
                      {pickupPoint || pickupAddressEditing ? (
                        <div className="flex items-end gap-2">
                          <div className="min-w-0 flex-1"><CompactField id="pickup-address-input" label="Адрес" value={pickupPoint} placeholder="Укажите адрес точки" onChange={setPickupPoint} /></div>
                          <Button type="button" size="sm" className="mb-0.5" disabled={!pickupPoint.trim()} onClick={() => { const nextAddress = pickupPoint.trim(); setPickupPoint(nextAddress); setPickupAddress(nextAddress); setPickupAddressEditing(false); queueSave(true); }}>Сохранить</Button>
                        </div>
                      ) : <Button type="button" variant="outline" size="sm" onClick={() => setPickupAddressEditing(true)}>Добавить адрес</Button>}
                    </SettingsSection>
                    <SettingsSection title="Информация о самовывозе" description="Гость увидит этот текст при оформлении заказа на самовывоз.">
                      <TranslatableField label="Текст при оформлении" initialTranslations={{ ru: pickupComment }} multiline rows={3} plain showTranslationMeta={false} persist={false} placeholder="Например: заказ можно забрать у стойки выдачи." onValueChange={(value) => { setPickupComment(value); queueSave(); }} />
                    </SettingsSection>
                  </>
                )}
              </>
            )}

            {activeTab === "payment" && (
              <SettingsSection title="Статус подключения">
                <div className="flex items-center gap-2 text-[13px] text-[#57534d]">
                  <span className="h-2 w-2 rounded-full bg-[#a8a29e]" />
                  Онлайн-оплата не подключена
                </div>
              </SettingsSection>
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
              <SettingsSection title="Получение вызовов" description="Канал для уведомлений сотрудников зала.">
                <ChannelSection event="waiter" route={routes.waiter} testState={testStates.waiter} testLabel="Отправить тестовый вызов" onSelect={(anchor) => setPickerRequest({ event: "waiter", anchor, enableAfterSelect: false })} onConfigure={() => routes.waiter && openChannelManager({ type: "edit", channelId: routes.waiter.id })} onDetach={() => detachChannel("waiter")} availableChannels={channels} getAssignments={getChannelAssignments} onUse={(channel) => useChannelForEvent("waiter", channel)} onCreate={() => openChannelManager({ type: "create", sourceEvent: "waiter" })} onShowAll={() => openChannelManager({ type: "list" })} onTest={() => sendTest("waiter")} />
              </SettingsSection>
            )}
          </div>
        )}
        </CompactContent>
      </PageContent>

      {pickerRequest && (
        <ChannelPickerPopover
          key={`${pickerRequest.event}-${pickerRequest.anchor.left}-${pickerRequest.anchor.top}`}
          event={pickerRequest.event}
          currentChannelId={routes[pickerRequest.event]?.id ?? null}
          anchor={pickerRequest.anchor}
          onClose={() => setPickerRequest(null)}
          onCreate={() => {
            const sourceEvent = pickerRequest.event;
            setPickerRequest(null);
            openChannelManager({ type: "create", sourceEvent });
          }}
          onSelect={(channel) => {
            const selectedEvent = pickerRequest.event;
            setRoute(selectedEvent, channel);
            setRequiresSetupEvents((current) => current.filter((event) => event !== selectedEvent));
            if (pickerRequest.enableAfterSelect) setFeatureEnabled(selectedEvent, true);
            setTestState(selectedEvent, "idle");
            queueSave(true);
            setPickerRequest(null);
            const target = selectedEvent === "delivery" ? "доставки" : selectedEvent === "pickup" ? "самовывоза" : "вызова официанта";
            setToast({ message: `Канал для ${target} изменён`, tone: "success" });
          }}
        />
      )}
      {channelsManagerOpen && (
        <ChannelManagerPopover
          key={managerKey}
          anchor={effectiveChannelsManagerAnchor}
          initialView={managerInitialView}
          onClose={() => { onChannelsManagerOpenChange(false); setManagerInitialView({ type: "list" }); }}
          onToast={setToast}
          onAssignmentsApplied={(events, enableEvents) => {
            setRequiresSetupEvents((current) => current.filter((event) => !events.includes(event)));
            if (enableEvents) events.forEach((event) => setFeatureEnabled(event, true));
            queueSave(true);
          }}
          onAssignmentsRemoved={handleAssignmentsRemoved}
          onChannelDeleted={(events) => {
            events.forEach((event) => setFeatureEnabled(event, false));
            setRequiresSetupEvents((current) => Array.from(new Set([...current, ...events])));
            queueSave(true);
          }}
        />
      )}
      {paymentDialogOpen && <PaymentConnectionDialog onClose={() => setPaymentDialogOpen(false)} />}
      {toast && (
        <div className="pointer-events-none fixed bottom-5 left-1/2 z-[100006] -translate-x-1/2">
          <div role={toast.tone === "error" ? "alert" : "status"} className={cn(
            "flex items-center gap-2 rounded-[10px] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]",
            toast.tone === "error" ? "bg-[#9f3a31]" : "bg-[#292524]",
          )}>
            {toast.tone === "success" ? <CheckCircle2 size={14} /> : <AlertCircle size={14} />}
            {toast.message}
          </div>
        </div>
      )}
    </PageScroll>
  );
}
