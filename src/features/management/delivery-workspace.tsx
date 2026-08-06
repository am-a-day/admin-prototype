import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CreditCard,
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
  waiter: "Вызов официанта",
};

const PURPOSE_DESCRIPTIONS: Record<OrderEvent, string> = {
  delivery: "Заказы доставки",
  pickup: "Заказы самовывоза",
  waiter: "Вызов официанта",
};

const PURPOSE_GENITIVE: Record<OrderEvent, string> = {
  delivery: "доставки",
  pickup: "самовывоза",
  waiter: "вызова официанта",
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
  channels,
  onClose,
  onSave,
  onOpenVenueSettings,
}: {
  event: OrderEvent;
  route: RouteChannel | null;
  channels: RouteChannel[];
  onClose: () => void;
  onSave: (channel: RouteChannel) => void;
  onOpenVenueSettings: () => void;
}) {
  const { account } = useMockAuth();
  const rawVenueName = account?.workspace.name.trim() ?? "";
  const venueName = rawVenueName && rawVenueName !== "Новое меню" && !/^Мой ресторан \d+$/u.test(rawVenueName)
    ? rawVenueName
    : "";
  const [type, setType] = useState<ChannelType>(route?.type ?? "telegram");
  const [screen, setScreen] = useState<"list" | "telegram-create" | "telegram-duplicate">("list");
  const [selectedKey, setSelectedKey] = useState(route ? channelKey(route) : "");
  const [creating, setCreating] = useState(false);
  const generatedChatName = `${venueName} · ${PURPOSE_LABELS[event]}`;
  const generatedTelegramContact = `@${slugifyChannelName(`${venueName}_${PURPOSE_LABELS[event]}`)}`;
  const visibleChannels = channels.filter((channel) => channel.type === type);
  const selectedExisting = visibleChannels.find((channel) => channelKey(channel) === selectedKey) ?? null;
  const duplicateChannel = channels.find((channel) => channel.type === "telegram" && channel.contact === generatedTelegramContact) ?? null;

  const switchType = (nextType: ChannelType) => {
    setType(nextType);
    setSelectedKey(route?.type === nextType ? channelKey(route) : "");
  };

  useEffect(() => {
    const onKeyDown = (eventValue: KeyboardEvent) => {
      if (eventValue.key === "Escape" && !creating) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [creating, onClose]);

  const createTelegramChannel = (forceNew = false) => {
    if (!venueName || creating) return;
    if (duplicateChannel && !forceNew) {
      setScreen("telegram-duplicate");
      return;
    }
    setCreating(true);
    window.setTimeout(() => {
      const matchingCount = channels.filter((channel) => channel.type === "telegram" && channel.contact.startsWith(generatedTelegramContact)).length;
      const contact = forceNew && matchingCount > 0 ? `${generatedTelegramContact}_${matchingCount + 1}` : generatedTelegramContact;
      onSave({ type: "telegram", contact });
    }, 450);
  };

  return (
    <div className="fixed inset-0 z-[100004] flex justify-end bg-black/25" role="dialog" aria-modal="true" aria-label="Канал получения заказов">
      <button type="button" className="absolute inset-0 cursor-default" onClick={() => { if (!creating) onClose(); }} aria-label="Закрыть" />
      <div className="relative flex h-full w-full max-w-[460px] flex-col overflow-hidden border-l border-[#e7e5e4] bg-white shadow-[-20px_0_64px_rgba(41,37,36,0.16)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#eceae7] px-5 py-4">
          <div className="flex min-w-0 items-start gap-2">
            {screen !== "list" && (
              <button type="button" onClick={() => setScreen("list")} disabled={creating} aria-label="Назад" className="mt-[-4px] flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] disabled:opacity-50">
                <ArrowLeft size={16} />
              </button>
            )}
            <div className="min-w-0">
              <h2 className="text-[15px] font-semibold text-[#292524]">{screen === "list" ? "Канал получения заказов" : "Новый Telegram-чат"}</h2>
              <p className="mt-1 text-[12px] text-[#79716b]">{PURPOSE_DESCRIPTIONS[event]}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} disabled={creating} aria-label="Закрыть" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] disabled:opacity-50">
            <X size={16} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {screen === "list" ? (
            <>
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

              <div className="mt-5">
                <h3 className="text-[13px] font-medium text-[#292524]">Подключённые каналы</h3>
                {visibleChannels.length === 0 ? (
                  <div className="mt-3 rounded-[10px] border border-dashed border-[#d8d5d0] bg-[#fafaf9] px-3 py-4 text-[12px] text-[#79716b]">
                    Подключённых каналов пока нет.
                  </div>
                ) : (
                  <div className="mt-3 space-y-1" role="radiogroup" aria-label="Подключённые каналы">
                    {visibleChannels.map((channel) => {
                      const selected = selectedKey === channelKey(channel);
                      return (
                        <button
                          key={channelKey(channel)}
                          type="button"
                          role="radio"
                          aria-checked={selected}
                          onClick={() => setSelectedKey(channelKey(channel))}
                          className={cn(
                            "flex h-11 w-full items-center gap-3 rounded-[9px] px-2.5 text-left transition",
                            selected ? "bg-[#f5f5f4]" : "hover:bg-[#fafaf9]",
                          )}
                        >
                          <span className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-[7px]", type === "telegram" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600")}>
                            <MessageCircle size={15} />
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] text-[#292524]">{channel.contact}</span>
                          <span className={cn("flex h-4 w-4 items-center justify-center rounded-full border", selected ? "border-[#292524] bg-[#292524] text-white" : "border-[#c7c2bd]")}>
                            {selected && <Check size={10} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
                {type === "whatsapp" && (
                  <div className="mt-3 rounded-[9px] border border-[#e7e5e4] bg-[#fafaf9] px-3 py-3 text-[12px] leading-5 text-[#79716b]">
                    Подключение WhatsApp для заказов пока недоступно в прототипе.
                  </div>
                )}
              </div>
            </>
          ) : screen === "telegram-create" ? (
            <div>
              <p className="text-[13px] leading-5 text-[#57534d]">Мы создадим чат для этой функции и добавим в него бота Tasko.</p>
              {venueName ? (
                <>
                  <div className="mt-5 rounded-[10px] border border-[#e7e5e4] bg-[#fafaf9] px-4 py-4">
                    <div className="text-[14px] font-medium text-[#292524]">{generatedChatName}</div>
                  </div>
                  <div className="mt-3 space-y-1 text-[12px] leading-5 text-[#79716b]">
                    <p><span className="font-medium text-[#57534d]">{venueName}</span> — название заведения</p>
                    <p><span className="font-medium text-[#57534d]">{PURPOSE_LABELS[event]}</span> — назначение канала</p>
                  </div>
                </>
              ) : (
                <div className="mt-5 rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] leading-5 text-amber-900">
                  <p className="font-medium">Сначала укажите название заведения</p>
                  <button type="button" onClick={onOpenVenueSettings} className="mt-1 font-medium underline underline-offset-2">Перейти в настройки заведения</button>
                </div>
              )}
            </div>
          ) : (
            <div className="rounded-[10px] border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] leading-5 text-amber-900">
              <p>Для {PURPOSE_GENITIVE[event]} уже подключён канал <span className="font-medium">{duplicateChannel?.contact}</span>.</p>
              <p className="mt-1 text-amber-800">Используйте его, чтобы не создавать дубликат.</p>
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-2 border-t border-[#eceae7] px-5 py-4">
          <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={creating}>Отмена</Button>
          {screen === "list" ? (
            selectedExisting ? (
              <Button type="button" size="sm" onClick={() => onSave(selectedExisting)}>Выбрать канал</Button>
            ) : (
              <Button type="button" size="sm" disabled={type === "whatsapp"} onClick={() => setScreen("telegram-create")}>Подключить новый канал</Button>
            )
          ) : screen === "telegram-create" ? (
            <Button type="button" size="sm" disabled={!venueName || creating} onClick={() => createTelegramChannel()}>
              {creating ? <><Loader2 size={14} className="animate-spin" /> Создаём…</> : "Создать Telegram-чат"}
            </Button>
          ) : (
            <>
              <Button type="button" variant="outline" size="sm" onClick={() => duplicateChannel && onSave(duplicateChannel)}>Использовать существующий</Button>
              <Button type="button" size="sm" disabled={creating} onClick={() => createTelegramChannel(true)}>
                {creating ? <><Loader2 size={14} className="animate-spin" /> Создаём…</> : "Всё равно создать новый"}
              </Button>
            </>
          )}
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
      {route ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-[10px] border border-[#e7e5e4] bg-white px-3 py-3">
          <div className="flex min-w-0 items-center gap-3">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]", route.type === "whatsapp" ? "bg-emerald-50 text-emerald-600" : "bg-sky-50 text-sky-600")}>
              <MessageCircle size={16} />
            </span>
            <div className="min-w-0">
              <div className="truncate text-[13px] font-medium text-[#292524]">{channelName(route.type, route.contact)}</div>
              <div className="mt-0.5 flex items-center gap-1 text-[11px] text-emerald-600"><CheckCircle2 size={11} /> Канал подключён</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <Button type="button" variant="ghost" size="sm" onClick={onConfigure}>Изменить</Button>
            <Button type="button" variant="outline" size="sm" onClick={onTest} disabled={testState === "sending"}>
              {testState === "sending" ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
              {testState === "sending" ? "Отправляем…" : testLabel}
            </Button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-[10px] border border-dashed border-[#d8d5d0] bg-[#fafaf9] px-4 py-4">
          <div className="min-w-0">
            <div className="text-[13px] font-medium text-[#292524]">Канал не подключён</div>
            <p className="mt-1 text-[12px] leading-5 text-[#79716b]">Подключите Telegram или WhatsApp, чтобы получать новые заказы.</p>
          </div>
          <Button type="button" size="sm" onClick={onConfigure}>Подключить канал</Button>
        </div>
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
  onOpenVenueSettings,
}: {
  activeTab: OrderSettingsTab;
  onSaveStateChange: (state: OrderSettingsSaveState) => void;
  onOpenVenueSettings: () => void;
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
    deliveryComment,
    setDeliveryComment,
    pickupComment,
    setPickupComment,
    pickupAddress,
    setPickupAddress,
  } = useAppSettings();
  const { routes, setRoute } = useOrderRouting();
  const { registerChange } = usePublish();
  const saveTimerRef = useRef<number | null>(null);
  const testTimerRef = useRef<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [dialogEvent, setDialogEvent] = useState<OrderEvent | null>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [validationEvent, setValidationEvent] = useState<OrderEvent | null>(null);
  const [testStates, setTestStates] = useState<Record<OrderEvent, TestState>>({ delivery: "idle", pickup: "idle", waiter: "idle" });
  const [pickupPoint, setPickupPoint] = useState(pickupAddress);
  const [pickupAddressEditing, setPickupAddressEditing] = useState(false);
  const [serviceApplications, setServiceApplications] = useState({ delivery: false, pickup: false, dineIn: false });
  const [waiterEnabled, setWaiterEnabled] = useState(false);
  const [includeTable, setIncludeTable] = useState(false);
  const [includeZone, setIncludeZone] = useState(false);
  const [repeatDelay, setRepeatDelay] = useState("");
  const [connectedChannels, setConnectedChannels] = useState<RouteChannel[]>([]);
  const [toast, setToast] = useState<{ message: string; tone: "success" | "error" } | null>(null);
  const availableChannels = useMemo(() => {
    const result = [...connectedChannels];
    Object.values(routes).forEach((route) => {
      if (route && !result.some((candidate) => channelKey(candidate) === channelKey(route))) result.push(route);
    });
    return result;
  }, [connectedChannels, routes]);

  useEffect(() => {
    const timer = window.setTimeout(() => setLoading(false), 420);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => () => {
    if (saveTimerRef.current) window.clearTimeout(saveTimerRef.current);
    if (testTimerRef.current) window.clearTimeout(testTimerRef.current);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3200);
    return () => window.clearTimeout(timer);
  }, [toast]);

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
    if (activeTab === "payment") {
      return {
        title: "Оплата",
        description: "Подключите онлайн-оплату, чтобы гости могли оплачивать заказы на витрине.",
        enabled: false,
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

  const activeRouteEvent: OrderEvent | null = activeTab === "delivery" || activeTab === "pickup" || activeTab === "waiter"
    ? activeTab
    : null;
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
            {activeTab === "payment" ? (
              <div className="flex flex-wrap items-start justify-between gap-5 px-5 py-5">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[16px] font-semibold text-[#292524]">Оплата</h2>
                    <span className="rounded-[5px] bg-[#f1f1ea] px-1.5 py-0.5 text-[10px] font-medium text-[#79716b]">Онлайн-оплата не подключена</span>
                  </div>
                  <p className="mt-1 max-w-2xl text-[13px] leading-5 text-[#79716b]">Подключите онлайн-оплату, чтобы гости могли оплачивать заказы на витрине.</p>
                </div>
                <Button type="button" size="sm" onClick={() => setPaymentDialogOpen(true)}>
                  <CreditCard size={14} />
                  Подключить эквайринг
                </Button>
              </div>
            ) : (
              <FeatureHeader
                title={content.title}
                description={content.description}
                enabled={content.enabled}
                validationMessage={validationMessage}
                onToggle={(enabled) => {
                  if (activeTab === "service-fee") {
                    setServiceFeeEnabled(enabled);
                    queueSave(true);
                  } else if (activeTab === "delivery" || activeTab === "pickup" || activeTab === "waiter") {
                    toggleRoutedFeature(activeTab, enabled);
                  }
                }}
              />
            )}

            {activeTab === "delivery" && (
              <>
                <SettingsSection title="Комментарий для гостя" description="Необязательный текст для выбранной языковой версии.">
                  <TranslatableField
                    label="Комментарий"
                    initialTranslations={{ ru: deliveryComment }}
                    multiline
                    rows={3}
                    plain
                    showTranslationMeta={false}
                    persist={false}
                    placeholder="Добавьте комментарий для гостя…"
                    onValueChange={(value) => { setDeliveryComment(value); queueSave(); }}
                  />
                </SettingsSection>
                <SettingsSection title="Получение заказов" description="Канал, куда будут приходить новые заказы.">
                  <ChannelSection route={routes.delivery} testState={testStates.delivery} testLabel="Отправить тест" onConfigure={() => setDialogEvent("delivery")} onTest={() => sendTest("delivery")} />
                </SettingsSection>
              </>
            )}

            {activeTab === "pickup" && (
              <>
                <SettingsSection title="Точка самовывоза" description="Адрес, который увидит гость после оформления.">
                  {pickupPoint || pickupAddressEditing ? (
                    <div className="flex items-end gap-2">
                      <div className="min-w-0 flex-1">
                        <CompactField id="pickup-address-input" label="Адрес" value={pickupPoint} placeholder="Укажите адрес точки" onChange={setPickupPoint} />
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="mb-0.5"
                        disabled={!pickupPoint.trim()}
                        onClick={() => {
                          const nextAddress = pickupPoint.trim();
                          setPickupPoint(nextAddress);
                          setPickupAddress(nextAddress);
                          setPickupAddressEditing(false);
                          queueSave(true);
                        }}
                      >
                        Сохранить
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" size="sm" onClick={() => setPickupAddressEditing(true)}>Добавить адрес</Button>
                  )}
                </SettingsSection>
                <SettingsSection title="Комментарий для гостя" description="Необязательный текст для выбранной языковой версии.">
                  <TranslatableField
                    label="Комментарий"
                    initialTranslations={{ ru: pickupComment }}
                    multiline
                    rows={3}
                    plain
                    showTranslationMeta={false}
                    persist={false}
                    placeholder="Добавьте комментарий для гостя…"
                    onValueChange={(value) => { setPickupComment(value); queueSave(); }}
                  />
                </SettingsSection>
                <SettingsSection title="Получение заказов" description="Канал, куда будут приходить новые заказы.">
                  <ChannelSection route={routes.pickup} testState={testStates.pickup} testLabel="Отправить тест" onConfigure={() => setDialogEvent("pickup")} onTest={() => sendTest("pickup")} />
                </SettingsSection>
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
          channels={availableChannels}
          onClose={() => setDialogEvent(null)}
          onOpenVenueSettings={() => {
            setDialogEvent(null);
            onOpenVenueSettings();
          }}
          onSave={(channel) => {
            setConnectedChannels((current) => current.some((candidate) => channelKey(candidate) === channelKey(channel))
              ? current
              : [...current, channel]);
            setRoute(dialogEvent, channel);
            setValidationEvent(null);
            setTestState(dialogEvent, "idle");
            queueSave(true);
            setDialogEvent(null);
            setToast({ message: `${CHANNEL_LABELS[channel.type]} подключён`, tone: "success" });
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
