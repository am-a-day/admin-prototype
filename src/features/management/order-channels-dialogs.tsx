import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { TelegramLogo, WhatsappLogo } from "@phosphor-icons/react";
import { ArrowLeft, Check, Loader2, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { AuthPhoneField, formatAuthPhone } from "@/components/auth/auth-phone-field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  CHANNEL_LABELS,
  ORDER_EVENT_LABELS,
  useOrderRouting,
  type ChannelType,
  type OrderChannel,
  type OrderEvent,
} from "@/contexts/order-routing-context";
import { cn } from "@/lib/utils";

const EVENTS: OrderEvent[] = ["delivery", "pickup", "waiter"];
const EVENT_CHECKBOX_LABELS: Record<OrderEvent, string> = {
  delivery: "Заказы доставки",
  pickup: "Заказы самовывоза",
  waiter: "Вызовы официанта",
};
export type ChannelPopoverAnchor = { left: number; right: number; top: number; bottom: number };
export type ChannelToast = { message: string; tone: "success" | "error" };
export type ChannelManagerInitialView =
  | { type: "list" }
  | {
      type: "create";
      sourceEvent: OrderEvent | null;
      returnToList: boolean;
      enableSourceEventAfterCreate?: boolean;
    }
  | { type: "edit"; channelId: string };

export function getChannelPopoverAnchor(target: Element): ChannelPopoverAnchor {
  const rect = target.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
}

export function channelAssignmentText(events: OrderEvent[]) {
  return events.length ? events.map((event) => ORDER_EVENT_LABELS[event]).join(" · ") : "Не назначен";
}

function channelStatusLabel(status: OrderChannel["status"]) {
  if (status === "connected") return "Подключён";
  if (status === "checking") return "Проверяем";
  if (status === "error") return "Ошибка подключения";
  return "Требуется повторное подключение";
}

function channelStatusColor(status: OrderChannel["status"]) {
  if (status === "connected") return "bg-emerald-500";
  if (status === "checking") return "bg-amber-500";
  if (status === "error") return "bg-red-500";
  return "bg-[#a8a29e]";
}

function assignmentSentence(events: OrderEvent[]) {
  const labels = events.map((event) => event === "delivery" ? "доставки" : event === "pickup" ? "самовывоза" : "вызовов официанта");
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  if (labels.length === 2) return `${labels[0]} и ${labels[1]}`;
  return `${labels.slice(0, -1).join(", ")} и ${labels.at(-1)}`;
}

function deletionConsequence(events: OrderEvent[]) {
  const usage = assignmentSentence(events);
  if (events.length === 1) {
    return `Канал используется для ${usage}. После удаления эта функция перестанет получать уведомления и будет выключена. Остальные настройки сохранятся.`;
  }
  return `Канал используется для ${usage}. После удаления эти функции перестанут получать уведомления и будут выключены. Остальные настройки сохранятся.`;
}

function automaticChannelName(events: OrderEvent[]) {
  const delivery = events.includes("delivery");
  const pickup = events.includes("pickup");
  const waiter = events.includes("waiter");
  if (delivery && pickup && waiter) return "RAUDA · Все уведомления";
  if ((delivery || pickup) && waiter) return "RAUDA · Заказы и вызовы";
  if (delivery && pickup) return "RAUDA · Заказы";
  if (delivery) return "RAUDA · Доставка";
  if (pickup) return "RAUDA · Самовывоз";
  if (waiter) return "RAUDA · Зал";
  return "RAUDA · Уведомления";
}

function assignmentSummary(events: OrderEvent[]) {
  const delivery = events.includes("delivery");
  const pickup = events.includes("pickup");
  const waiter = events.includes("waiter");
  if (waiter && (delivery || pickup)) return "Заказы и вызовы гостей будут приходить в один канал.";
  if (delivery && pickup) return "Заказы доставки и самовывоза будут приходить в один канал.";
  if (delivery) return "Новые заказы доставки будут приходить в этот канал.";
  if (pickup) return "Новые заказы самовывоза будут приходить в этот канал.";
  if (waiter) return "Вызовы гостей будут приходить в этот канал.";
  return "Выберите, какие уведомления должны приходить в этот канал.";
}

function enabledRemovalWarning(event: OrderEvent) {
  if (event === "delivery") return "Доставка сейчас включена.";
  if (event === "pickup") return "Самовывоз сейчас включён.";
  return "Вызов официанта сейчас включён.";
}

function creationToast(events: OrderEvent[]) {
  if (!events.length) return "Канал создан";
  if (events.length === 1) {
    const target = events[0] === "delivery" ? "доставке" : events[0] === "pickup" ? "самовывозу" : "вызовам официанта";
    return `Канал создан и назначен ${target}`;
  }
  return `Канал создан для ${assignmentSentence(events)}`;
}

function pickerTitle(event: OrderEvent) {
  if (event === "delivery") return "Канал для доставки";
  if (event === "pickup") return "Канал для самовывоза";
  return "Канал для вызовов";
}

export function ChannelIcon({ type }: { type: ChannelType }) {
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]", type === "telegram" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600")}>
      {type === "telegram" ? <TelegramLogo size={17} weight="fill" /> : <WhatsappLogo size={17} weight="fill" />}
    </span>
  );
}

function AssignmentCheckboxes({ value, onChange }: { value: OrderEvent[]; onChange: (events: OrderEvent[]) => void }) {
  return (
    <div className="space-y-1">
      {EVENTS.map((event) => (
        <label key={event} className="flex min-h-8 cursor-pointer items-center gap-2.5 rounded-[8px] px-2 text-[13px] text-[#292524] transition hover:bg-[#f5f5f4]">
          <input
            type="checkbox"
            checked={value.includes(event)}
            onChange={(changeEvent) => onChange(changeEvent.target.checked ? [...value, event] : value.filter((candidate) => candidate !== event))}
            className="h-4 w-4 rounded border-[#c7c2bd] accent-[#292524]"
          />
          {EVENT_CHECKBOX_LABELS[event]}
        </label>
      ))}
    </div>
  );
}

function popoverPosition(anchor: ChannelPopoverAnchor, width: number, height: number) {
  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const panelWidth = Math.min(width, viewportWidth - 24);
  const left = Math.max(12, Math.min(anchor.left, viewportWidth - panelWidth - 12));
  const below = anchor.bottom + 6;
  const top = below + height <= viewportHeight - 12 ? below : Math.max(12, anchor.top - height - 6);
  return { width: panelWidth, left, top };
}

function usePopoverDismiss(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void) {
  useEffect(() => {
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as HTMLElement)) onClose();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, ref]);
}

function ChannelRow({
  channel,
  assignments,
  mode,
  current,
  onSelect,
  onEdit,
  onDelete,
}: {
  channel: OrderChannel;
  assignments: OrderEvent[];
  mode: "select" | "manage";
  current?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const details = (
    <>
      <ChannelIcon type={channel.type} />
      <span className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13px] font-medium leading-5 text-[#292524]">{channel.name}</span>
        <span className="block truncate text-[11px] leading-4 text-[#79716b]">{CHANNEL_LABELS[channel.type]} · {formatAuthPhone(channel.contact)}</span>
        <span className="block truncate text-[10px] leading-4 text-[#a8a29e]">{mode === "select" ? `Используется: ${channelAssignmentText(assignments)}` : channelAssignmentText(assignments)}</span>
      </span>
    </>
  );

  if (mode === "select") {
    return (
      <button
        type="button"
        role="radio"
        aria-checked={Boolean(current)}
        onClick={() => !current && onSelect?.()}
        className={cn(
          "flex min-h-[60px] w-full items-center gap-3 rounded-[9px] px-2.5 py-2 text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#292524]/10",
          current ? "bg-[#f5f5f4]" : "hover:bg-[#f8f7f4]",
        )}
      >
        {details}
        {current && <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-[6px] bg-white px-2 text-[10px] font-medium text-[#57534d] ring-1 ring-[#e7e5e4]"><Check size={11} /> Текущий</span>}
      </button>
    );
  }

  return (
    <div className="flex min-h-[66px] items-center gap-3 px-3 py-2.5">
      {details}
      <span className="flex shrink-0 items-center gap-1.5 text-[10px] text-[#79716b]">
        <span className={cn("h-1.5 w-1.5 rounded-full", channelStatusColor(channel.status))} />
        {channelStatusLabel(channel.status)}
      </span>
      <DropdownMenu.Root>
        <DropdownMenu.Trigger asChild>
          <button type="button" aria-label={`Действия канала ${channel.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] outline-none transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:ring-2 focus-visible:ring-[#292524]/10"><MoreHorizontal size={16} /></button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content sideOffset={6} align="end" className="z-[100012] min-w-[190px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none">
            <DropdownMenu.Item onSelect={onEdit} className="flex h-8 cursor-pointer items-center rounded-[8px] px-2 text-[12px] text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]">Редактировать</DropdownMenu.Item>
            <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
            <DropdownMenu.Item onSelect={onDelete} className="flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[12px] text-red-600 outline-none data-[highlighted]:bg-red-50"><Trash2 size={13} /> Удалить канал</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

export function ChannelPickerPopover({
  event,
  currentChannelId,
  anchor,
  onClose,
  onSelect,
  onCreate,
}: {
  event: OrderEvent;
  currentChannelId: string | null;
  anchor: ChannelPopoverAnchor;
  onClose: () => void;
  onSelect: (channel: OrderChannel) => void;
  onCreate: () => void;
}) {
  const { channels, getChannelAssignments } = useOrderRouting();
  const panelRef = useRef<HTMLDivElement>(null);
  usePopoverDismiss(panelRef, onClose);
  const height = Math.min(420, channels.length * 60 + 92);
  const position = popoverPosition(anchor, 392, height);
  const title = pickerTitle(event);

  return createPortal(
    <div ref={panelRef} role="dialog" aria-labelledby="channel-picker-title" className="fixed z-[100005] max-h-[420px] overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white shadow-[0_18px_42px_rgba(41,37,36,0.14)]" style={position}>
      <div className="border-b border-[#eceae7] px-3 py-2.5">
        <h2 id="channel-picker-title" className="text-[13px] font-semibold text-[#292524]">{title}</h2>
      </div>
      <div role="radiogroup" aria-label={title} className="max-h-[320px] space-y-0.5 overflow-y-auto overscroll-contain p-1.5">
        {channels.map((channel) => <ChannelRow key={channel.id} channel={channel} assignments={getChannelAssignments(channel.id)} mode="select" current={channel.id === currentChannelId} onSelect={() => onSelect(channel)} />)}
      </div>
      <div className="border-t border-[#eceae7] p-1.5"><button type="button" onClick={onCreate} className="flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[12px] font-medium text-[#57534d] outline-none transition hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10"><Plus size={13} /> Создать новый канал</button></div>
    </div>,
    document.body,
  );
}

type ChannelFormState = { ready: boolean; submitting: boolean };

function ChannelForm({
  mode,
  channel,
  initialEvent,
  enabledEvents,
  submitSignal,
  onStateChange,
  onSubmit,
}: {
  mode: "create" | "edit";
  channel?: OrderChannel;
  initialEvent?: OrderEvent | null;
  enabledEvents: OrderEvent[];
  submitSignal: number;
  onStateChange: (state: ChannelFormState) => void;
  onSubmit: (input: Omit<OrderChannel, "id" | "status">, events: OrderEvent[]) => void;
}) {
  const { channels, routes, getChannelAssignments } = useOrderRouting();
  const initialEvents = useMemo(() => channel ? getChannelAssignments(channel.id) : initialEvent ? [initialEvent] : [], [channel, getChannelAssignments, initialEvent]);
  const [type, setType] = useState<ChannelType>(channel?.type ?? "telegram");
  const [events, setEvents] = useState<OrderEvent[]>(initialEvents);
  const [manualName, setManualName] = useState(mode === "edit");
  const [name, setName] = useState(channel?.name ?? automaticChannelName(initialEvents));
  const [phone, setPhone] = useState(channel?.contact ?? "");
  const [phoneValid, setPhoneValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitSignalRef = useRef(submitSignal);
  const displayedName = manualName ? name : automaticChannelName(events);
  const duplicate = channels.some((candidate) => candidate.id !== channel?.id && (
    candidate.name.trim().toLocaleLowerCase("ru") === displayedName.trim().toLocaleLowerCase("ru")
    || (candidate.type === type && candidate.contact === phone)
  ));
  const conflicts = events.filter((event) => routes[event] && routes[event]?.id !== channel?.id);
  const removedEnabledEvents = initialEvents.filter((event) => !events.includes(event) && enabledEvents.includes(event));
  const canSubmit = Boolean(displayedName.trim() && phoneValid && !duplicate && !submitting);
  const handlePhone = useCallback((value: string, valid: boolean) => { setPhone(value); setPhoneValid(valid); }, []);

  useEffect(() => {
    onStateChange({ ready: canSubmit, submitting });
  }, [canSubmit, onStateChange, submitting]);

  useEffect(() => {
    if (submitSignalRef.current === submitSignal || !canSubmit) return;
    submitSignalRef.current = submitSignal;
    setSubmitting(true);
    window.setTimeout(() => onSubmit({ type, name: displayedName.trim(), contact: phone }, events), 350);
  }, [canSubmit, displayedName, events, onSubmit, phone, submitSignal, type]);

  return (
    <div className="space-y-4">
      {mode === "create" ? (
        <div>
          <div className="mb-1.5 text-[12px] font-medium text-[#44403b]">Тип канала</div>
          <div role="tablist" aria-label="Тип канала" className="inline-flex items-center gap-0.5 rounded-[10px] bg-[#f5f5f4] p-0.5">
            {(["telegram", "whatsapp"] as ChannelType[]).map((channelType) => <button key={channelType} type="button" role="tab" aria-selected={type === channelType} onClick={() => setType(channelType)} className={cn("h-8 rounded-[8px] px-3 text-[12px] font-medium transition", type === channelType ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]" : "text-[#79716b] hover:text-[#292524]")}>{CHANNEL_LABELS[channelType]}</button>)}
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2 rounded-[10px] bg-[#fafaf9] px-3 py-2 text-[12px] text-[#57534d]"><ChannelIcon type={type} /><span>Тип канала: <span className="font-medium text-[#292524]">{CHANNEL_LABELS[type]}</span></span></div>
      )}

      <div>
        <label htmlFor={`channel-form-phone-${channel?.id ?? "new"}`} className="mb-1.5 block text-[12px] font-medium text-[#44403b]">{type === "telegram" ? "Номер, привязанный к Telegram" : "Номер WhatsApp"}</label>
        <AuthPhoneField key={mode === "create" ? type : channel?.id} id={`channel-form-phone-${channel?.id ?? "new"}`} initialValue={phone} disabled={submitting} onValueChange={handlePhone} />
        <p className="mt-1.5 text-[11px] leading-4 text-[#79716b]">{type === "telegram" ? "Tasko создаст чат с ботом и добавит аккаунт Telegram, привязанный к этому номеру." : "На этот номер будут приходить выбранные уведомления."}</p>
      </div>

      {mode === "edit" && <label className="block"><span className="mb-1.5 block text-[12px] font-medium text-[#44403b]">Название канала</span><Input value={name} onChange={(event) => setName(event.target.value)} size="compact" /></label>}

      <div>
        <div className="mb-1 text-[12px] font-medium text-[#44403b]">Получать уведомления</div>
        <AssignmentCheckboxes value={events} onChange={setEvents} />
        <div className="mt-2 rounded-[8px] bg-[#f5f5f4] px-3 py-2 text-[11px] leading-4 text-[#57534d]">
          <p>{assignmentSummary(events)}</p>
          <p className="mt-1 text-[#79716b]">{mode === "create" ? "Выключенные функции останутся выключенными." : "Канал будет назначен выбранным функциям. Состояние самих функций не изменится."}</p>
        </div>
      </div>

      {mode === "create" && (!manualName ? (
          <div>
            <div className="mb-1.5 text-[12px] font-medium text-[#44403b]">Название канала</div>
            <div className="flex min-h-9 items-center justify-between gap-3 rounded-[10px] border border-[#e7e5e4] bg-[#fafaf9] px-3">
              <span className="truncate text-[13px] text-[#292524]">{displayedName}</span>
              <button type="button" onClick={() => { setName(displayedName); setManualName(true); }} className="shrink-0 text-[11px] font-medium text-[#57534d] underline underline-offset-2">Изменить</button>
            </div>
            <p className="mt-1.5 text-[11px] leading-4 text-[#79716b]">Название формируется из заведения и выбранных уведомлений.</p>
          </div>
        ) : (
          <label className="block">
            <span className="mb-1.5 flex items-center justify-between gap-3 text-[12px] font-medium text-[#44403b]"><span>Название канала</span><button type="button" onClick={() => setManualName(false)} className="text-[11px] font-normal text-[#57534d] underline underline-offset-2">Вернуть автоматическое название</button></span>
            <Input value={displayedName} onChange={(event) => { setManualName(true); setName(event.target.value); }} size="compact" />
          </label>
        ))}

      {conflicts.map((event) => <div key={event} className="rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-900">{ORDER_EVENT_LABELS[event]} сейчас использует канал “{routes[event]?.name}”. После {mode === "create" ? "создания" : "сохранения"} {event === "waiter" ? "новые вызовы" : event === "pickup" ? "новые заказы самовывоза" : "новые заказы доставки"} будут приходить сюда.</div>)}

      {removedEnabledEvents.map((event) => <div key={`removed-${event}`} className="rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-900">{enabledRemovalWarning(event)} После снятия назначения функция будет выключена. Остальные настройки сохранятся.</div>)}

      {mode === "edit" && channel && <div className="flex items-center justify-between border-t border-[#eceae7] pt-3 text-[11px]"><span className="text-[#79716b]">Состояние подключения</span><span className="flex items-center gap-1.5 text-[#57534d]"><span className={cn("h-1.5 w-1.5 rounded-full", channelStatusColor(channel.status))} />{channelStatusLabel(channel.status)}</span></div>}
      {duplicate && <p className="text-[11px] text-red-600">Канал с таким названием или номером уже существует.</p>}
    </div>
  );
}

type ManagerView = ChannelManagerInitialView | { type: "delete"; channelId: string };

export function ChannelManagerDialog({
  initialView,
  enabledEvents,
  onClose,
  onToast,
  onChannelCreated,
  onChannelUpdated,
  onChannelDeleted,
}: {
  initialView: ChannelManagerInitialView;
  enabledEvents: OrderEvent[];
  onClose: () => void;
  onToast: (toast: ChannelToast) => void;
  onChannelCreated: (events: OrderEvent[], enableSourceEvent: OrderEvent | null) => void;
  onChannelUpdated: (events: OrderEvent[], removedEvents: OrderEvent[]) => void;
  onChannelDeleted: (events: OrderEvent[]) => void;
}) {
  const { channels, createChannel, updateChannel, setChannelStatus, deleteChannel, setChannelAssignments, getChannelAssignments, resetChannels } = useOrderRouting();
  const [view, setView] = useState<ManagerView>(initialView);
  const [submitSignal, setSubmitSignal] = useState(0);
  const [formState, setFormState] = useState<ChannelFormState>({ ready: false, submitting: false });
  const activeChannel = view.type === "edit" || view.type === "delete" ? channels.find(({ id }) => id === view.channelId) ?? null : null;
  const deletingEvents = view.type === "delete" && activeChannel ? getChannelAssignments(activeChannel.id) : [];

  const safeClose = useCallback(() => {
    if (!formState.submitting) onClose();
  }, [formState.submitting, onClose]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") safeClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [safeClose]);

  const goTo = (nextView: ManagerView) => {
    setSubmitSignal(0);
    setFormState({ ready: false, submitting: false });
    setView(nextView);
  };

  const returnFromCurrentView = () => {
    if (view.type === "create" && !view.returnToList) {
      safeClose();
      return;
    }
    goTo({ type: "list" });
  };

  const title = view.type === "list" ? "Каналы уведомлений" : view.type === "create" ? "Новый канал" : view.type === "edit" ? "Редактировать канал" : "Удалить канал?";
  const description = view.type === "list" ? "Управляйте каналами для заказов и вызовов гостей." : view.type === "create" ? "Подключите канал и выберите его назначения." : view.type === "edit" ? "Измените данные и назначения канала." : "Проверьте последствия перед удалением.";
  const hasBack = view.type === "edit" || (view.type === "create" && view.returnToList);

  return createPortal(
    <div className="fixed inset-0 z-[100008] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[1px]" onMouseDown={(event) => { if (event.target === event.currentTarget) safeClose(); }}>
      <div role="dialog" aria-modal="true" aria-labelledby="channel-manager-title" className="flex h-[min(620px,calc(100vh-32px))] w-full max-w-[560px] flex-col overflow-hidden rounded-[14px] border border-[#e7e5e4] bg-white shadow-[0_24px_64px_rgba(41,37,36,0.18)]">
        <div className="flex shrink-0 items-start gap-2 border-b border-[#eceae7] px-5 py-4">
          {hasBack && <button type="button" disabled={formState.submitting} onClick={() => goTo({ type: "list" })} aria-label="Назад" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] disabled:pointer-events-none disabled:opacity-50"><ArrowLeft size={15} /></button>}
          <div className="min-w-0 flex-1"><h2 id="channel-manager-title" className="text-[16px] font-semibold text-[#292524]">{title}</h2><p className="mt-1 text-[12px] leading-4 text-[#79716b]">{description}</p></div>
          <button type="button" disabled={formState.submitting} onClick={safeClose} aria-label="Закрыть" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] disabled:pointer-events-none disabled:opacity-50"><X size={16} /></button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
          {view.type === "list" && (channels.length ? (
            <div className="divide-y divide-[#eceae7] overflow-hidden rounded-[12px] border border-[#e7e5e4]">
              {channels.map((channel) => <ChannelRow key={channel.id} channel={channel} assignments={getChannelAssignments(channel.id)} mode="manage" onEdit={() => goTo({ type: "edit", channelId: channel.id })} onDelete={() => goTo({ type: "delete", channelId: channel.id })} />)}
            </div>
          ) : (
            <div className="flex min-h-[390px] flex-col items-center justify-center px-6 text-center"><h3 className="text-[14px] font-medium text-[#292524]">Каналов пока нет</h3><p className="mt-1 max-w-[300px] text-[12px] leading-5 text-[#79716b]">Создайте канал, чтобы получать заказы и вызовы гостей.</p></div>
          ))}

          {view.type === "create" && <ChannelForm mode="create" initialEvent={view.sourceEvent} enabledEvents={enabledEvents} submitSignal={submitSignal} onStateChange={setFormState} onSubmit={(input, events) => {
            const channel = createChannel(input);
            setChannelAssignments(channel.id, events);
            const enableSourceEvent = view.enableSourceEventAfterCreate ? view.sourceEvent : null;
            onChannelCreated(events, enableSourceEvent);
            onToast({ message: creationToast(events), tone: "success" });
            if (view.returnToList) goTo({ type: "list" });
            else onClose();
          }} />}

          {view.type === "edit" && activeChannel && <ChannelForm mode="edit" channel={activeChannel} enabledEvents={enabledEvents} submitSignal={submitSignal} onStateChange={setFormState} onSubmit={(input, events) => {
            const removed = getChannelAssignments(activeChannel.id).filter((event) => !events.includes(event));
            updateChannel(activeChannel.id, { name: input.name, contact: input.contact });
            setChannelAssignments(activeChannel.id, events);
            onChannelUpdated(events, removed);
            onToast({ message: "Канал обновлён", tone: "success" });
            goTo({ type: "list" });
          }} />}

          {view.type === "delete" && activeChannel && <div><div className="flex items-center gap-3 rounded-[12px] border border-[#e7e5e4] px-3 py-3"><ChannelIcon type={activeChannel.type} /><div className="min-w-0"><div className="truncate text-[13px] font-medium text-[#292524]">{activeChannel.name}</div><div className="truncate text-[11px] text-[#79716b]">{CHANNEL_LABELS[activeChannel.type]} · {formatAuthPhone(activeChannel.contact)}</div></div></div><p className="mt-4 text-[13px] leading-5 text-[#57534d]">{deletingEvents.length ? deletionConsequence(deletingEvents) : "Канал нигде не используется и будет полностью удалён."}</p></div>}
        </div>

        <div className="flex min-h-[61px] shrink-0 items-center justify-between gap-2 border-t border-[#eceae7] px-5 py-3.5">
          <div className="flex items-center gap-1">
            {view.type === "list" && import.meta.env.DEV && channels.length > 0 && <><button type="button" onClick={() => { const channel = channels[0]; setChannelStatus(channel.id, channel.status === "error" ? "connected" : "error"); onToast({ message: channel.status === "error" ? "Подключение восстановлено" : "Включена тестовая ошибка канала", tone: channel.status === "error" ? "success" : "error" }); }} className="h-8 rounded-[8px] px-2 text-[11px] text-[#a8a29e] transition hover:bg-[#f5f5f4] hover:text-[#57534d]">{channels[0].status === "error" ? "Восстановить канал" : "Ошибка канала"}</button><button type="button" onClick={() => { resetChannels(); onToast({ message: "Данные каналов сброшены", tone: "success" }); }} className="h-8 rounded-[8px] px-2 text-[11px] text-[#a8a29e] transition hover:bg-[#f5f5f4] hover:text-[#57534d]">Сбросить данные</button></>}
          </div>
          <div className="flex items-center gap-2">
            {view.type === "list" && <Button type="button" size="sm" onClick={() => goTo({ type: "create", sourceEvent: null, returnToList: true })}><Plus size={14} /> Создать канал</Button>}
            {(view.type === "create" || view.type === "edit" || view.type === "delete") && <Button type="button" variant="ghost" size="sm" disabled={formState.submitting} onClick={returnFromCurrentView}>Отмена</Button>}
            {view.type === "create" && <Button type="button" size="sm" disabled={!formState.ready || formState.submitting} onClick={() => setSubmitSignal((signal) => signal + 1)}>{formState.submitting ? <><Loader2 size={13} className="animate-spin" /> Создаём…</> : "Создать канал"}</Button>}
            {view.type === "edit" && <Button type="button" size="sm" disabled={!formState.ready || formState.submitting} onClick={() => setSubmitSignal((signal) => signal + 1)}>{formState.submitting ? <><Loader2 size={13} className="animate-spin" /> Сохраняем…</> : "Сохранить"}</Button>}
            {view.type === "delete" && activeChannel && <Button type="button" size="sm" className="bg-[#9f1239] text-white hover:bg-[#881337]" onClick={() => { deleteChannel(activeChannel.id); onChannelDeleted(deletingEvents); onToast({ message: "Канал удалён", tone: "success" }); goTo({ type: "list" }); }}>{deletingEvents.length ? "Отключить функции и удалить" : "Удалить канал"}</Button>}
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
