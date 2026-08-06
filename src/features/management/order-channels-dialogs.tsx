import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { TelegramLogo, WhatsappLogo } from "@phosphor-icons/react";
import { Check, Loader2, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
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

export type ChannelPopoverAnchor = { left: number; right: number; top: number; bottom: number };
export type ChannelToast = { message: string; tone: "success" | "error" };

export function getChannelPopoverAnchor(target: Element): ChannelPopoverAnchor {
  const rect = target.getBoundingClientRect();
  return { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom };
}

function channelStatusLabel(status: OrderChannel["status"]) {
  if (status === "connected") return "Подключено";
  if (status === "checking") return "Проверяем";
  if (status === "error") return "Ошибка подключения";
  return "Не подключено";
}

function channelStatusClass(status: OrderChannel["status"]) {
  if (status === "connected") return "text-emerald-600";
  if (status === "checking") return "text-amber-600";
  if (status === "error") return "text-red-600";
  return "text-[#79716b]";
}

function assignmentText(events: OrderEvent[]) {
  return events.length ? events.map((event) => ORDER_EVENT_LABELS[event]).join(" · ") : "Не используется";
}

function assignmentSentence(events: OrderEvent[]) {
  const labels = events.map((event) => ORDER_EVENT_LABELS[event].toLocaleLowerCase("ru"));
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} и ${labels.at(-1)}`;
}

function ChannelIcon({ type }: { type: ChannelType }) {
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]", type === "telegram" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600")}>
      {type === "telegram" ? <TelegramLogo size={17} weight="fill" /> : <WhatsappLogo size={17} weight="fill" />}
    </span>
  );
}

function AssignmentCheckboxes({ value, onChange, lockedEvent }: { value: OrderEvent[]; onChange: (events: OrderEvent[]) => void; lockedEvent?: OrderEvent | null }) {
  return (
    <div className="space-y-1">
      {EVENTS.map((event) => (
        <label key={event} className={cn("flex min-h-8 items-center gap-2.5 rounded-[8px] px-2 text-[13px] text-[#292524] transition", event === lockedEvent ? "cursor-default" : "cursor-pointer hover:bg-[#f5f5f4]")}>
          <input
            type="checkbox"
            checked={value.includes(event)}
            disabled={event === lockedEvent}
            onChange={(changeEvent) => onChange(changeEvent.target.checked ? [...value, event] : value.filter((candidate) => candidate !== event))}
            className="h-4 w-4 rounded border-[#c7c2bd] accent-[#292524]"
          />
          {ORDER_EVENT_LABELS[event]}
        </label>
      ))}
    </div>
  );
}

function ChannelRow({
  channel,
  assignments,
  mode,
  current,
  testLoading,
  onSelect,
  onConfigure,
  onTest,
  onDelete,
}: {
  channel: OrderChannel;
  assignments: OrderEvent[];
  mode: "select" | "manage";
  current?: boolean;
  testLoading?: boolean;
  onSelect?: () => void;
  onConfigure?: (anchor: ChannelPopoverAnchor) => void;
  onTest?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div className={cn("flex min-h-[58px] items-center gap-3 px-2.5 py-2", mode === "select" && !current && "cursor-pointer hover:bg-[#f5f5f4]", current && "bg-[#fafaf9]")} onClick={() => mode === "select" && !current && onSelect?.()}>
      <ChannelIcon type={channel.type} />
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium leading-5 text-[#292524]">{channel.name}</div>
        <div className="truncate text-[11px] leading-4 text-[#79716b]">{CHANNEL_LABELS[channel.type]} · {channel.contact}</div>
        <div className="truncate text-[10px] leading-4 text-[#a8a29e]">{assignmentText(assignments)}</div>
      </div>
      {mode === "select" ? (
        current && <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#292524] text-white" aria-label="Текущий канал"><Check size={11} /></span>
      ) : (
        <>
          <span className={cn("shrink-0 text-[10px]", channelStatusClass(channel.status))}>{channelStatusLabel(channel.status)}</span>
          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <button type="button" onClick={(event) => event.stopPropagation()} aria-label={`Действия канала ${channel.name}`} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#79716b] outline-none transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:ring-2 focus-visible:ring-[#292524]/10"><MoreHorizontal size={16} /></button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content sideOffset={6} align="end" className="z-[100009] min-w-[190px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none">
                <DropdownMenu.Item onSelect={(event) => onConfigure?.(getChannelPopoverAnchor(event.currentTarget as Element))} className="flex h-8 cursor-pointer items-center rounded-[8px] px-2 text-[12px] text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]">Настроить канал</DropdownMenu.Item>
                <DropdownMenu.Item onSelect={onTest} className="flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[12px] text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]">{testLoading && <Loader2 size={13} className="animate-spin" />} Отправить тест</DropdownMenu.Item>
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                <DropdownMenu.Item onSelect={onDelete} className="flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[12px] text-red-600 outline-none data-[highlighted]:bg-red-50"><Trash2 size={13} /> Удалить канал</DropdownMenu.Item>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </>
      )}
    </div>
  );
}

function usePopoverDismiss(ref: React.RefObject<HTMLDivElement | null>, onClose: () => void, disabled = false) {
  useEffect(() => {
    if (disabled) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose();
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

function popoverPosition(anchor: ChannelPopoverAnchor, width: number, height: number) {
  const viewportWidth = typeof window === "undefined" ? 1200 : window.innerWidth;
  const viewportHeight = typeof window === "undefined" ? 800 : window.innerHeight;
  const panelWidth = Math.min(width, viewportWidth - 24);
  const left = Math.max(12, Math.min(anchor.left, viewportWidth - panelWidth - 12));
  const topBelow = anchor.bottom + 6;
  const top = topBelow + height <= viewportHeight - 12 ? topBelow : Math.max(12, anchor.top - height - 6);
  return { width: panelWidth, left, top };
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
  const height = channels.length ? Math.min(390, channels.length * 58 + 52) : 88;
  const position = popoverPosition(anchor, 400, height);

  return createPortal(
    <div ref={panelRef} role="dialog" aria-label={`Выбрать канал для ${ORDER_EVENT_LABELS[event].toLocaleLowerCase("ru")}`} className="fixed z-[100005] max-h-[390px] overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white p-1.5 shadow-[0_18px_48px_rgba(41,37,36,0.18)]" style={position}>
      {channels.length ? (
        <>
          <div className="max-h-[320px] divide-y divide-[#f0efec] overflow-y-auto overscroll-contain">
            {channels.map((channel) => (
              <ChannelRow key={channel.id} channel={channel} assignments={getChannelAssignments(channel.id)} mode="select" current={channel.id === currentChannelId} onSelect={() => onSelect(channel)} />
            ))}
          </div>
          <div className="mt-1 border-t border-[#eceae7] pt-1">
            <button type="button" onClick={onCreate} className="flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[12px] font-medium text-[#57534d] outline-none transition hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10"><Plus size={13} /> Добавить новый канал</button>
          </div>
        </>
      ) : (
        <button type="button" onClick={onCreate} className="flex h-10 w-full items-center justify-center gap-2 rounded-[9px] bg-[#4f39f6] px-3 text-[13px] font-medium text-white transition hover:bg-[#4030d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/25"><Plus size={14} /> Создать канал</button>
      )}
    </div>,
    document.body,
  );
}

export function ChannelSettingsPopover({
  channelId,
  anchor,
  onClose,
  onToast,
  onAssignmentsApplied,
  onAssignmentsRemoved,
}: {
  channelId: string;
  anchor: ChannelPopoverAnchor;
  onClose: () => void;
  onToast: (toast: ChannelToast) => void;
  onAssignmentsApplied: (events: OrderEvent[]) => void;
  onAssignmentsRemoved: (events: OrderEvent[]) => void;
}) {
  const { channels, routes, updateChannel, setChannelAssignments, getChannelAssignments } = useOrderRouting();
  const channel = channels.find(({ id }) => id === channelId) ?? null;
  const panelRef = useRef<HTMLDivElement>(null);
  const initialEvents = useMemo(() => channel ? getChannelAssignments(channel.id) : [], [channel, getChannelAssignments]);
  const [name, setName] = useState(channel?.name ?? "");
  const [phone, setPhone] = useState(channel?.contact ?? "");
  const [phoneValid, setPhoneValid] = useState(false);
  const [events, setEvents] = useState<OrderEvent[]>(initialEvents);
  const [submitting, setSubmitting] = useState(false);
  usePopoverDismiss(panelRef, onClose, submitting);
  const position = popoverPosition(anchor, 430, 560);
  const conflicts = events.filter((event) => routes[event] && routes[event]?.id !== channelId);
  const duplicate = channel ? channels.some((candidate) => candidate.id !== channel.id && (
    candidate.name.trim().toLocaleLowerCase("ru") === name.trim().toLocaleLowerCase("ru")
    || (candidate.type === channel.type && candidate.contact === phone)
  )) : false;
  const handlePhone = useCallback((value: string, valid: boolean) => { setPhone(value); setPhoneValid(valid); }, []);
  const canSave = Boolean(channel && name.trim() && phoneValid && !duplicate && !submitting);

  if (!channel) return null;

  const save = () => {
    if (!canSave) return;
    setSubmitting(true);
    const removedEvents = initialEvents.filter((event) => !events.includes(event));
    window.setTimeout(() => {
      updateChannel(channel.id, { name: name.trim(), contact: phone });
      setChannelAssignments(channel.id, events);
      onAssignmentsApplied(events);
      if (removedEvents.length) onAssignmentsRemoved(removedEvents);
      onToast({ message: "Канал обновлён", tone: "success" });
      onClose();
    }, 300);
  };

  return createPortal(
    <div ref={panelRef} data-channel-settings-popover role="dialog" aria-labelledby="channel-settings-popover-title" className="fixed z-[100008] flex max-h-[min(620px,calc(100vh-24px))] flex-col overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white shadow-[0_18px_48px_rgba(41,37,36,0.18)]" style={position}>
      <div className="flex shrink-0 items-start justify-between gap-3 border-b border-[#eceae7] px-4 py-3.5">
        <div>
          <h2 id="channel-settings-popover-title" className="text-[15px] font-semibold text-[#292524]">Настройка канала</h2>
          <p className="mt-0.5 text-[11px] text-[#79716b]">Тип канала: {CHANNEL_LABELS[channel.type]}</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524]"><X size={15} /></button>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[#44403b]">Название</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} size="compact" />
        </label>
        <div>
          <label htmlFor={`channel-settings-phone-${channel.id}`} className="mb-1.5 block text-[12px] font-medium text-[#44403b]">{channel.type === "telegram" ? "Номер Telegram" : "Номер WhatsApp"}</label>
          <AuthPhoneField id={`channel-settings-phone-${channel.id}`} initialValue={channel.contact} disabled={submitting} onValueChange={handlePhone} />
        </div>
        <div>
          <div className="mb-1 text-[12px] font-medium text-[#44403b]">Использовать для</div>
          <AssignmentCheckboxes value={events} onChange={setEvents} />
        </div>
        {conflicts.map((event) => (
          <div key={event} className="rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-900">{ORDER_EVENT_LABELS[event]} сейчас использует канал “{routes[event]?.name}”. После сохранения {event === "waiter" ? "новые вызовы" : "новые заказы"} будут приходить в этот канал.</div>
        ))}
        <div className="flex items-center justify-between gap-3 border-t border-[#eceae7] pt-3 text-[11px]">
          <span className="text-[#79716b]">Статус подключения</span>
          <span className={channelStatusClass(channel.status)}>{channelStatusLabel(channel.status)}</span>
        </div>
        {duplicate && <p className="text-[11px] text-red-600">Канал с таким названием или номером уже существует.</p>}
      </div>
      <div className="flex shrink-0 justify-end gap-2 border-t border-[#eceae7] px-4 py-3">
        <Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Отмена</Button>
        <Button type="button" size="sm" disabled={!canSave} onClick={save}>{submitting ? <><Loader2 size={13} className="animate-spin" /> Сохраняем…</> : "Сохранить"}</Button>
      </div>
    </div>,
    document.body,
  );
}

function ChannelDialogShell({ title, description, onClose, children, footer, headerAction }: { title: string; description: string; onClose: () => void; children: ReactNode; footer?: ReactNode; headerAction?: ReactNode }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector("[data-channel-settings-popover]")) onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/30 px-4 backdrop-blur-[2px]">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Закрыть" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="channel-dialog-title" className="relative flex h-[min(580px,calc(100vh-32px))] w-full max-w-[640px] flex-col overflow-hidden rounded-[14px] border border-[#e7e5e4] bg-white shadow-[0_20px_60px_rgba(41,37,36,0.18)]">
        <div className="flex shrink-0 items-start justify-between gap-4 border-b border-[#eceae7] px-5 py-4">
          <div className="min-w-0">
            <h2 id="channel-dialog-title" className="text-[16px] font-semibold leading-6 text-[#292524]">{title}</h2>
            <p className="mt-0.5 text-[12px] leading-5 text-[#79716b]">{description}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">{headerAction}<button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524]"><X size={16} /></button></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <div className="flex shrink-0 items-center justify-end gap-2 border-t border-[#eceae7] px-5 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

function ChannelCreateForm({
  venueName,
  sourceEvent,
  channels,
  onCreate,
  submitSignal,
  onStateChange,
}: {
  venueName: string;
  sourceEvent: OrderEvent | null;
  channels: OrderChannel[];
  onCreate: (channel: Omit<OrderChannel, "id" | "status">, events: OrderEvent[]) => void;
  submitSignal: number;
  onStateChange: (state: { ready: boolean; submitting: boolean; type: ChannelType }) => void;
}) {
  const suffix = sourceEvent === "delivery" ? "Доставка" : sourceEvent === "pickup" ? "Самовывоз" : sourceEvent === "waiter" ? "Зал" : "Заказы";
  const [type, setType] = useState<ChannelType>("telegram");
  const [name, setName] = useState(`${venueName} · ${suffix}`);
  const [events, setEvents] = useState<OrderEvent[]>(sourceEvent ? [sourceEvent] : []);
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const submitSignalRef = useRef(submitSignal);
  const duplicate = channels.find((channel) => channel.name.trim().toLocaleLowerCase("ru") === name.trim().toLocaleLowerCase("ru") || (channel.type === type && channel.contact === phone));
  const handlePhone = useCallback((value: string, valid: boolean) => { setPhone(value); setPhoneValid(valid); }, []);
  const canSubmit = Boolean(name.trim() && phoneValid && !duplicate && !submitting);

  const submit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    window.setTimeout(() => onCreate({ type, name: name.trim(), contact: phone }, events), 400);
  };

  useEffect(() => {
    onStateChange({ ready: canSubmit, submitting, type });
  }, [canSubmit, onStateChange, submitting, type]);

  useEffect(() => {
    if (submitSignalRef.current === submitSignal) return;
    submitSignalRef.current = submitSignal;
    submit();
  }, [submitSignal]);

  return (
    <div className="flex min-h-full flex-col">
      <div role="tablist" aria-label="Тип канала" className="inline-flex self-start items-center gap-0.5 rounded-[10px] bg-[#f5f5f4] p-0.5">
        {(["telegram", "whatsapp"] as ChannelType[]).map((channelType) => (
          <button key={channelType} type="button" role="tab" aria-selected={type === channelType} onClick={() => setType(channelType)} className={cn("h-8 rounded-[8px] px-3 text-[12px] font-medium transition", type === channelType ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]" : "text-[#79716b] hover:text-[#292524]")}>{CHANNEL_LABELS[channelType]}</button>
        ))}
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[#44403b]">Название</span>
          <Input autoFocus value={name} onChange={(event) => setName(event.target.value)} size="compact" />
        </label>
        <div>
          <label htmlFor="channel-create-phone" className="mb-1.5 block text-[12px] font-medium text-[#44403b]">{type === "telegram" ? "Номер Telegram" : "Номер WhatsApp"}</label>
          <AuthPhoneField key={type} id="channel-create-phone" initialValue={phone} disabled={submitting} onValueChange={handlePhone} />
          {type === "telegram" && <p className="mt-1.5 text-[11px] leading-4 text-[#79716b]">Укажите номер, привязанный к Telegram.</p>}
        </div>
      </div>
      <div className="mt-5 max-w-[280px]">
        <div className="mb-1 text-[12px] font-medium text-[#44403b]">Использовать для</div>
        <AssignmentCheckboxes value={events} onChange={setEvents} lockedEvent={sourceEvent} />
      </div>
      {duplicate && <p className="mt-3 text-[11px] text-red-600">Канал с таким названием или номером уже существует.</p>}
      {submitting && <span className="sr-only" role="status">Создаём канал</span>}
    </div>
  );
}

type ManagerView = { type: "list" } | { type: "create"; sourceEvent: OrderEvent | null } | { type: "delete"; channelId: string };

export function ChannelManagerDialog({
  initialCreateEvent = null,
  onClose,
  onToast,
  onAssignmentsApplied,
  onAssignmentsRemoved,
  onChannelDeleted,
  onReset,
}: {
  initialCreateEvent?: OrderEvent | null;
  onClose: () => void;
  onToast: (toast: ChannelToast) => void;
  onAssignmentsApplied: (events: OrderEvent[], sourceEvent: OrderEvent | null) => void;
  onAssignmentsRemoved: (events: OrderEvent[]) => void;
  onChannelDeleted: (events: OrderEvent[]) => void;
  onReset: () => void;
}) {
  const { channels, createChannel, deleteChannel, setChannelAssignments, getChannelAssignments, resetChannels } = useOrderRouting();
  const [view, setView] = useState<ManagerView>(initialCreateEvent ? { type: "create", sourceEvent: initialCreateEvent } : { type: "list" });
  const [settingsRequest, setSettingsRequest] = useState<{ channelId: string; anchor: ChannelPopoverAnchor } | null>(null);
  const [testChannelId, setTestChannelId] = useState<string | null>(null);
  const [createSubmitSignal, setCreateSubmitSignal] = useState(0);
  const [createState, setCreateState] = useState<{ ready: boolean; submitting: boolean; type: ChannelType }>({ ready: false, submitting: false, type: "telegram" });
  const activeDeleteChannel = view.type === "delete" ? channels.find(({ id }) => id === view.channelId) ?? null : null;
  const deleteEvents = activeDeleteChannel ? getChannelAssignments(activeDeleteChannel.id) : [];

  const openCreate = (sourceEvent: OrderEvent | null) => {
    setCreateSubmitSignal(0);
    setCreateState({ ready: false, submitting: false, type: "telegram" });
    setView({ type: "create", sourceEvent });
  };

  const sendTest = (channel: OrderChannel) => {
    if (testChannelId) return;
    setTestChannelId(channel.id);
    window.setTimeout(() => {
      setTestChannelId(null);
      onToast({ message: "Тестовое сообщение отправлено", tone: "success" });
    }, 650);
  };

  const createChannelAndClose = (input: Omit<OrderChannel, "id" | "status">, events: OrderEvent[]) => {
    const channel = createChannel(input);
    setChannelAssignments(channel.id, events);
    const sourceEvent = view.type === "create" ? view.sourceEvent : null;
    onAssignmentsApplied(events, sourceEvent);
    onToast({ message: sourceEvent ? "Канал создан и подключён" : "Канал создан", tone: "success" });
    onClose();
  };

  if (view.type === "create") {
    return (
      <ChannelDialogShell
        title="Новый канал"
        description="Добавьте канал и выберите функции, которые будут его использовать."
        onClose={onClose}
        footer={<><Button type="button" variant="ghost" size="sm" onClick={() => initialCreateEvent ? onClose() : setView({ type: "list" })} disabled={createState.submitting}>Отмена</Button><Button type="button" size="sm" disabled={!createState.ready || createState.submitting} onClick={() => setCreateSubmitSignal((signal) => signal + 1)}>{createState.submitting ? <><Loader2 size={13} className="animate-spin" /> Подключаем…</> : createState.type === "telegram" ? "Создать и подключить" : "Подключить WhatsApp"}</Button></>}
      >
        <ChannelCreateForm venueName="RAUDA" sourceEvent={view.sourceEvent} channels={channels} onCreate={createChannelAndClose} submitSignal={createSubmitSignal} onStateChange={setCreateState} />
      </ChannelDialogShell>
    );
  }

  if (view.type === "delete" && activeDeleteChannel) {
    return (
      <ChannelDialogShell
        title="Удалить канал?"
        description="Полное удаление нельзя отменить."
        onClose={() => setView({ type: "list" })}
        footer={<><Button type="button" variant="ghost" size="sm" onClick={() => setView({ type: "list" })}>Отмена</Button><Button type="button" size="sm" className="bg-[#9f1239] text-white hover:bg-[#881337]" onClick={() => { deleteChannel(activeDeleteChannel.id); onChannelDeleted(deleteEvents); onToast({ message: "Канал удалён", tone: "success" }); setView({ type: "list" }); }}>{deleteEvents.length ? "Отключить функции и удалить" : "Удалить канал"}</Button></>}
      >
        <div className="flex items-center gap-3 rounded-[12px] border border-[#e7e5e4] px-3 py-3">
          <ChannelIcon type={activeDeleteChannel.type} />
          <div><div className="text-[13px] font-medium text-[#292524]">{activeDeleteChannel.name}</div><div className="text-[11px] text-[#79716b]">{CHANNEL_LABELS[activeDeleteChannel.type]} · {activeDeleteChannel.contact}</div></div>
        </div>
        <p className="mt-4 text-[13px] leading-5 text-[#57534d]">{deleteEvents.length ? `Канал используется для ${assignmentSentence(deleteEvents)}. После удаления эти функции перестанут получать уведомления.` : "Канал нигде не используется и будет полностью удалён из системы."}</p>
      </ChannelDialogShell>
    );
  }

  return (
    <>
      <ChannelDialogShell
        title="Каналы уведомлений"
        description="Управляйте каналами, в которые приходят заказы и вызовы гостей."
        onClose={onClose}
        headerAction={<Button type="button" size="sm" onClick={() => openCreate(null)}><Plus size={14} /> Создать канал</Button>}
        footer={import.meta.env.DEV ? <><button type="button" onClick={() => { resetChannels(); onReset(); onToast({ message: "Данные каналов сброшены", tone: "success" }); }} className="mr-auto text-[11px] text-[#a8a29e] underline underline-offset-2 hover:text-[#57534d]">Сбросить данные прототипа</button><Button type="button" variant="ghost" size="sm" onClick={onClose}>Закрыть</Button></> : <Button type="button" variant="ghost" size="sm" onClick={onClose}>Закрыть</Button>}
      >
        {channels.length ? (
          <div className="divide-y divide-[#eceae7] overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white">
            {channels.map((channel) => (
              <ChannelRow
                key={channel.id}
                channel={channel}
                assignments={getChannelAssignments(channel.id)}
                mode="manage"
                testLoading={testChannelId === channel.id}
                onConfigure={(anchor) => setSettingsRequest({ channelId: channel.id, anchor })}
                onTest={() => sendTest(channel)}
                onDelete={() => setView({ type: "delete", channelId: channel.id })}
              />
            ))}
          </div>
        ) : (
          <div className="flex min-h-[250px] flex-col items-center justify-center text-center"><div className="text-[14px] font-medium text-[#292524]">Каналов пока нет</div><p className="mt-1 text-[12px] text-[#79716b]">Создайте канал, чтобы получать заказы и вызовы гостей.</p></div>
        )}
      </ChannelDialogShell>
      {settingsRequest && (
        <ChannelSettingsPopover
          channelId={settingsRequest.channelId}
          anchor={settingsRequest.anchor}
          onClose={() => setSettingsRequest(null)}
          onToast={onToast}
          onAssignmentsApplied={(events) => onAssignmentsApplied(events, null)}
          onAssignmentsRemoved={onAssignmentsRemoved}
        />
      )}
    </>
  );
}
