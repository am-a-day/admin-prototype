import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { TelegramLogo, WhatsappLogo } from "@phosphor-icons/react";
import { ArrowLeft, Check, Loader2, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
import { AuthPhoneField } from "@/components/auth/auth-phone-field";
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
  | { type: "create"; sourceEvent: OrderEvent | null }
  | { type: "edit"; channelId: string };

export function getChannelPopoverAnchor(target: Element): ChannelPopoverAnchor {
  const rect = target.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
}

export function channelAssignmentText(events: OrderEvent[]) {
  return events.length ? events.map((event) => ORDER_EVENT_LABELS[event]).join(" · ") : "Не используется";
}

function channelStatusLabel(status: OrderChannel["status"]) {
  if (status === "connected") return "Подключено";
  if (status === "checking") return "Проверяем";
  if (status === "error") return "Ошибка подключения";
  return "Не подключено";
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
  return `${labels.slice(0, -1).join(", ")} и ${labels.at(-1)}`;
}

function deletionConsequence(events: OrderEvent[]) {
  const parts: string[] = [];
  if (events.includes("delivery") && events.includes("pickup")) parts.push("заказы доставки и самовывоза");
  else if (events.includes("delivery")) parts.push("заказы доставки");
  else if (events.includes("pickup")) parts.push("заказы самовывоза");
  if (events.includes("waiter")) parts.push("вызовы официанта");
  return `Канал получает ${parts.join(" и ")}. После удаления эти функции перестанут получать уведомления.`;
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

function creationToast(events: OrderEvent[]) {
  if (!events.length) return "Канал создан";
  if (events.length === 1) {
    const target = events[0] === "delivery" ? "доставке" : events[0] === "pickup" ? "самовывозу" : "вызовам официанта";
    return `Канал создан и подключён к ${target}`;
  }
  return `Канал создан для ${assignmentSentence(events)}`;
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

function popoverPosition(anchor: ChannelPopoverAnchor, width: number, height: number, align: "start" | "end" = "start") {
  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const panelWidth = Math.min(width, viewportWidth - 24);
  const preferredLeft = align === "end" ? anchor.right - panelWidth : anchor.left;
  const left = Math.max(12, Math.min(preferredLeft, viewportWidth - panelWidth - 12));
  const below = anchor.bottom + 6;
  const top = below + height <= viewportHeight - 12 ? below : Math.max(12, anchor.top - height - 6);
  return { width: panelWidth, left, top };
}

function usePopoverDismiss(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void, disabled = false) {
  useEffect(() => {
    if (disabled) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("[data-channel-menu-content]")) return;
      if (!ref.current?.contains(target)) onClose();
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
  }, [disabled, onClose, ref]);
}

function ChannelRow({
  channel,
  assignments,
  mode,
  current,
  testLoading,
  onSelect,
  onEdit,
  onTest,
  onDelete,
}: {
  channel: OrderChannel;
  assignments: OrderEvent[];
  mode: "select" | "manage";
  current?: boolean;
  testLoading?: boolean;
  onSelect?: () => void;
  onEdit?: () => void;
  onTest?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={cn("flex min-h-[60px] items-center gap-3 px-2.5 py-2", mode === "select" && !current && "cursor-pointer hover:bg-[#f5f5f4]", current && "bg-[#fafaf9]")} onClick={() => mode === "select" && !current && onSelect?.()}>
      <ChannelIcon type={channel.type} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium leading-5 text-[#292524]">{channel.name}</div>
        <div className="flex min-w-0 items-center gap-1.5 text-[11px] leading-4 text-[#79716b]">
          <span className="truncate">{CHANNEL_LABELS[channel.type]} · {channel.contact}</span>
          <span title={channelStatusLabel(channel.status)} className={cn("h-1.5 w-1.5 shrink-0 rounded-full", channelStatusColor(channel.status))} />
        </div>
        <div className="truncate text-[10px] leading-4 text-[#a8a29e]">{channelAssignmentText(assignments)}</div>
      </div>
      {mode === "select" ? (
        current && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#292524] text-white" aria-label="Текущий канал"><Check size={11} /></span>
      ) : (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" aria-label={`Действия канала ${channel.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] outline-none transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:ring-2 focus-visible:ring-[#292524]/10"><MoreHorizontal size={16} /></button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content data-channel-menu-content sideOffset={6} align="end" className="z-[100010] min-w-[190px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none">
              <DropdownMenu.Item onSelect={onEdit} className="flex h-8 cursor-pointer items-center rounded-[8px] px-2 text-[12px] text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]">Настроить</DropdownMenu.Item>
              <DropdownMenu.Item onSelect={onTest} className="flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[12px] text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]">{testLoading && <Loader2 size={13} className="animate-spin" />} Отправить тест</DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
              <DropdownMenu.Item onSelect={onDelete} className="flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[12px] text-red-600 outline-none data-[highlighted]:bg-red-50"><Trash2 size={13} /> Удалить канал</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
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
  const height = channels.length ? Math.min(390, channels.length * 60 + 52) : 88;
  const position = popoverPosition(anchor, 400, height);

  return createPortal(
    <div ref={panelRef} role="dialog" aria-label={`Выбрать канал для ${ORDER_EVENT_LABELS[event].toLocaleLowerCase("ru")}`} className="fixed z-[100005] max-h-[390px] overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white p-1.5 shadow-[0_18px_48px_rgba(41,37,36,0.18)]" style={position}>
      {channels.length ? (
        <>
          <div className="max-h-[320px] divide-y divide-[#f0efec] overflow-y-auto overscroll-contain">
            {channels.map((channel) => <ChannelRow key={channel.id} channel={channel} assignments={getChannelAssignments(channel.id)} mode="select" current={channel.id === currentChannelId} onSelect={() => onSelect(channel)} />)}
          </div>
          <div className="mt-1 border-t border-[#eceae7] pt-1"><button type="button" onClick={onCreate} className="flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[12px] font-medium text-[#57534d] outline-none transition hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10"><Plus size={13} /> Создать новый канал</button></div>
        </>
      ) : (
        <button type="button" onClick={onCreate} className="flex h-10 w-full items-center justify-center gap-2 rounded-[9px] bg-[#4f39f6] px-3 text-[13px] font-medium text-white transition hover:bg-[#4030d4]"><Plus size={14} /> Создать канал</button>
      )}
    </div>,
    document.body,
  );
}

type ChannelFormState = { ready: boolean; submitting: boolean; type: ChannelType };

function ChannelForm({
  mode,
  channel,
  initialEvent,
  submitSignal,
  onStateChange,
  onSubmit,
}: {
  mode: "create" | "edit";
  channel?: OrderChannel;
  initialEvent?: OrderEvent | null;
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
  const canSubmit = Boolean(displayedName.trim() && phoneValid && !duplicate && !submitting);
  const handlePhone = useCallback((value: string, valid: boolean) => { setPhone(value); setPhoneValid(valid); }, []);

  useEffect(() => {
    onStateChange({ ready: canSubmit, submitting, type });
  }, [canSubmit, onStateChange, submitting, type]);

  useEffect(() => {
    if (submitSignalRef.current === submitSignal || !canSubmit) return;
    submitSignalRef.current = submitSignal;
    setSubmitting(true);
    window.setTimeout(() => onSubmit({ type, name: displayedName.trim(), contact: phone }, events), 350);
  }, [submitSignal]);

  return (
    <div className="space-y-4">
      {mode === "create" ? (
        <div role="tablist" aria-label="Тип канала" className="inline-flex items-center gap-0.5 rounded-[10px] bg-[#f5f5f4] p-0.5">
          {(["telegram", "whatsapp"] as ChannelType[]).map((channelType) => <button key={channelType} type="button" role="tab" aria-selected={type === channelType} onClick={() => setType(channelType)} className={cn("h-8 rounded-[8px] px-3 text-[12px] font-medium transition", type === channelType ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]" : "text-[#79716b] hover:text-[#292524]")}>{CHANNEL_LABELS[channelType]}</button>)}
        </div>
      ) : (
        <div className="flex items-center gap-2 text-[12px] text-[#79716b]"><ChannelIcon type={type} /><span>Тип канала: {CHANNEL_LABELS[type]}</span></div>
      )}

      <label className="block">
        <span className="mb-1.5 flex items-center justify-between gap-3 text-[12px] font-medium text-[#44403b]"><span>Название канала</span>{mode === "create" && manualName && <button type="button" onClick={() => setManualName(false)} className="text-[11px] font-normal text-[#57534d] underline underline-offset-2">Вернуть автоматическое название</button>}</span>
        <Input autoFocus value={displayedName} onChange={(event) => { setManualName(true); setName(event.target.value); }} size="compact" />
      </label>

      <div>
        <label htmlFor={`channel-form-phone-${channel?.id ?? "new"}`} className="mb-1.5 block text-[12px] font-medium text-[#44403b]">{type === "telegram" ? "Номер Telegram" : "Номер WhatsApp"}</label>
        <AuthPhoneField key={mode === "create" ? type : channel?.id} id={`channel-form-phone-${channel?.id ?? "new"}`} initialValue={phone} disabled={submitting} onValueChange={handlePhone} />
        <p className="mt-1.5 text-[11px] leading-4 text-[#79716b]">{type === "telegram" ? "Укажите номер, привязанный к Telegram." : "Укажите номер WhatsApp."}</p>
      </div>

      <div>
        <div className="mb-1 text-[12px] font-medium text-[#44403b]">Получать уведомления</div>
        <AssignmentCheckboxes value={events} onChange={setEvents} />
        <p className="mt-2 rounded-[8px] bg-[#f5f5f4] px-3 py-2 text-[11px] leading-4 text-[#57534d]">{assignmentSummary(events)}</p>
      </div>

      {conflicts.map((event) => <div key={event} className="rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-900">{ORDER_EVENT_LABELS[event]} сейчас использует канал “{routes[event]?.name}”. После {mode === "create" ? "создания" : "сохранения"} {event === "waiter" ? "новые вызовы" : event === "pickup" ? "новые заказы самовывоза" : "новые заказы доставки"} будут приходить в этот канал.</div>)}

      {mode === "edit" && channel && <div className="flex items-center justify-between border-t border-[#eceae7] pt-3 text-[11px]"><span className="text-[#79716b]">Статус подключения</span><span className="flex items-center gap-1.5 text-[#57534d]"><span className={cn("h-1.5 w-1.5 rounded-full", channelStatusColor(channel.status))} />{channelStatusLabel(channel.status)}</span></div>}
      {duplicate && <p className="text-[11px] text-red-600">Канал с таким названием или номером уже существует.</p>}
    </div>
  );
}

type ManagerView = ChannelManagerInitialView | { type: "delete"; channelId: string };

export function ChannelManagerPopover({
  anchor,
  initialView,
  onClose,
  onToast,
  onAssignmentsApplied,
  onAssignmentsRemoved,
  onChannelDeleted,
}: {
  anchor: ChannelPopoverAnchor;
  initialView: ChannelManagerInitialView;
  onClose: () => void;
  onToast: (toast: ChannelToast) => void;
  onAssignmentsApplied: (events: OrderEvent[], enableEvents: boolean) => void;
  onAssignmentsRemoved: (events: OrderEvent[]) => void;
  onChannelDeleted: (events: OrderEvent[]) => void;
}) {
  const { channels, createChannel, updateChannel, deleteChannel, setChannelAssignments, getChannelAssignments } = useOrderRouting();
  const panelRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<ManagerView>(initialView);
  const [testChannelId, setTestChannelId] = useState<string | null>(null);
  const [submitSignal, setSubmitSignal] = useState(0);
  const [formState, setFormState] = useState<ChannelFormState>({ ready: false, submitting: false, type: "telegram" });
  const activeChannel = view.type === "edit" || view.type === "delete" ? channels.find(({ id }) => id === view.channelId) ?? null : null;
  const deletingEvents = view.type === "delete" && activeChannel ? getChannelAssignments(activeChannel.id) : [];
  const position = popoverPosition(anchor, 468, 560, "end");
  const safeClose = () => {
    if (!formState.submitting) onClose();
  };
  usePopoverDismiss(panelRef, safeClose, formState.submitting);

  const goTo = (nextView: ManagerView) => {
    setSubmitSignal(0);
    setFormState({ ready: false, submitting: false, type: "telegram" });
    setView(nextView);
  };

  const sendTest = (channel: OrderChannel) => {
    if (testChannelId) return;
    setTestChannelId(channel.id);
    window.setTimeout(() => {
      setTestChannelId(null);
      onToast({ message: "Тестовое сообщение отправлено", tone: "success" });
    }, 650);
  };

  const title = view.type === "list" ? "Каналы уведомлений" : view.type === "create" ? "Новый канал" : view.type === "edit" ? "Настройка канала" : "Удалить канал?";
  const description = view.type === "list" ? "Каналы, в которые приходят заказы и вызовы гостей." : view.type === "create" ? "Добавьте канал и выберите уведомления." : view.type === "edit" ? "Измените данные и назначения канала." : "Проверьте последствия перед удалением.";
  const hasBack = view.type === "create" || view.type === "edit";

  return createPortal(
    <div ref={panelRef} role="dialog" aria-labelledby="channel-manager-title" className="fixed z-[100008] flex h-[min(560px,calc(100vh-24px))] flex-col overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white shadow-[0_18px_48px_rgba(41,37,36,0.18)]" style={position}>
      <div className="flex shrink-0 items-start gap-2 border-b border-[#eceae7] px-4 py-3.5">
        {hasBack && <button type="button" disabled={formState.submitting} onClick={() => goTo({ type: "list" })} aria-label="Назад" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] disabled:pointer-events-none disabled:opacity-50"><ArrowLeft size={15} /></button>}
        <div className="min-w-0 flex-1"><h2 id="channel-manager-title" className="text-[15px] font-semibold text-[#292524]">{title}</h2><p className="mt-0.5 text-[11px] leading-4 text-[#79716b]">{description}</p></div>
        <button type="button" disabled={formState.submitting} onClick={safeClose} aria-label="Закрыть" className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] disabled:pointer-events-none disabled:opacity-50"><X size={15} /></button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {view.type === "list" && (channels.length ? (
          <>
            <div className="divide-y divide-[#eceae7] overflow-hidden rounded-[12px] border border-[#e7e5e4]">
              {channels.map((channel) => <ChannelRow key={channel.id} channel={channel} assignments={getChannelAssignments(channel.id)} mode="manage" testLoading={testChannelId === channel.id} onEdit={() => goTo({ type: "edit", channelId: channel.id })} onTest={() => sendTest(channel)} onDelete={() => goTo({ type: "delete", channelId: channel.id })} />)}
            </div>
            <button type="button" onClick={() => goTo({ type: "create", sourceEvent: null })} className="mt-2 flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[12px] font-medium text-[#57534d] transition hover:bg-[#f5f5f4]"><Plus size={13} /> Создать новый канал</button>
          </>
        ) : (
          <div className="flex min-h-[330px] flex-col items-center justify-center px-6 text-center"><h3 className="text-[14px] font-medium text-[#292524]">Каналов пока нет</h3><p className="mt-1 max-w-[300px] text-[12px] leading-5 text-[#79716b]">Создайте канал, чтобы получать заказы и вызовы гостей.</p><Button type="button" size="sm" className="mt-4" onClick={() => goTo({ type: "create", sourceEvent: null })}><Plus size={14} /> Создать канал</Button></div>
        ))}

        {view.type === "create" && <ChannelForm mode="create" initialEvent={view.sourceEvent} submitSignal={submitSignal} onStateChange={setFormState} onSubmit={(input, events) => { const channel = createChannel(input); setChannelAssignments(channel.id, events); onAssignmentsApplied(events, true); onToast({ message: creationToast(events), tone: "success" }); goTo({ type: "list" }); }} />}

        {view.type === "edit" && activeChannel && <ChannelForm mode="edit" channel={activeChannel} submitSignal={submitSignal} onStateChange={setFormState} onSubmit={(input, events) => { const removed = getChannelAssignments(activeChannel.id).filter((event) => !events.includes(event)); updateChannel(activeChannel.id, { name: input.name, contact: input.contact }); setChannelAssignments(activeChannel.id, events); onAssignmentsApplied(events, false); if (removed.length) onAssignmentsRemoved(removed); onToast({ message: "Канал обновлён", tone: "success" }); goTo({ type: "list" }); }} />}

        {view.type === "delete" && activeChannel && <div className="px-1"><div className="flex items-center gap-3 rounded-[12px] border border-[#e7e5e4] px-3 py-3"><ChannelIcon type={activeChannel.type} /><div className="min-w-0"><div className="truncate text-[13px] font-medium text-[#292524]">{activeChannel.name}</div><div className="truncate text-[11px] text-[#79716b]">{CHANNEL_LABELS[activeChannel.type]} · {activeChannel.contact}</div></div></div><p className="mt-4 text-[13px] leading-5 text-[#57534d]">{deletingEvents.length ? deletionConsequence(deletingEvents) : "Канал нигде не используется и будет полностью удалён."}</p></div>}
      </div>

      {(view.type === "create" || view.type === "edit" || view.type === "delete") && <div className="flex shrink-0 justify-end gap-2 border-t border-[#eceae7] px-4 py-3">
        <Button type="button" variant="ghost" size="sm" disabled={formState.submitting} onClick={() => goTo({ type: "list" })}>Отмена</Button>
        {view.type === "create" && <Button type="button" size="sm" disabled={!formState.ready || formState.submitting} onClick={() => setSubmitSignal((signal) => signal + 1)}>{formState.submitting ? <><Loader2 size={13} className="animate-spin" /> Создаём…</> : "Создать канал"}</Button>}
        {view.type === "edit" && <Button type="button" size="sm" disabled={!formState.ready || formState.submitting} onClick={() => setSubmitSignal((signal) => signal + 1)}>{formState.submitting ? <><Loader2 size={13} className="animate-spin" /> Сохраняем…</> : "Сохранить"}</Button>}
        {view.type === "delete" && activeChannel && <Button type="button" size="sm" className="bg-[#9f1239] text-white hover:bg-[#881337]" onClick={() => { deleteChannel(activeChannel.id); onChannelDeleted(deletingEvents); onToast({ message: "Канал удалён", tone: "success" }); goTo({ type: "list" }); }}>{deletingEvents.length ? "Отключить функции и удалить" : "Удалить канал"}</Button>}
      </div>}
    </div>,
    document.body,
  );
}
