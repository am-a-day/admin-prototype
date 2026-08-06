import { useCallback, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Check, Loader2, MessageCircle, MoreHorizontal, Plus, Trash2, X } from "lucide-react";
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

function assignmentLabel(events: OrderEvent[]) {
  if (!events.length) return "не используется";
  const labels = events.map((event) => ORDER_EVENT_LABELS[event].toLocaleLowerCase("ru"));
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} и ${labels.at(-1)}`;
}

function ChannelIcon({ type }: { type: ChannelType }) {
  return (
    <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px]", type === "telegram" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600")}>
      <MessageCircle size={16} />
    </span>
  );
}

function AssignmentBadges({ events }: { events: OrderEvent[] }) {
  if (!events.length) return <span className="text-[11px] text-[#a8a29e]">Не используется</span>;
  return (
    <div className="flex flex-wrap gap-1">
      {events.map((event) => (
        <span key={event} className="rounded-[5px] bg-[#f1f1ef] px-1.5 py-0.5 text-[10px] font-medium text-[#57534d]">{ORDER_EVENT_LABELS[event]}</span>
      ))}
    </div>
  );
}

function AssignmentCheckboxes({ value, onChange }: { value: OrderEvent[]; onChange: (events: OrderEvent[]) => void }) {
  return (
    <div className="space-y-2">
      {EVENTS.map((event) => (
        <label key={event} className="flex cursor-pointer items-center gap-2.5 rounded-[8px] px-2 py-1.5 text-[13px] text-[#292524] hover:bg-[#fafaf9]">
          <input
            type="checkbox"
            checked={value.includes(event)}
            onChange={(eventValue) => onChange(eventValue.target.checked ? [...value, event] : value.filter((candidate) => candidate !== event))}
            className="h-4 w-4 rounded border-[#c7c2bd] accent-[#292524]"
          />
          {ORDER_EVENT_LABELS[event]}
        </label>
      ))}
    </div>
  );
}

type ToastPayload = { message: string; tone: "success" | "error" };
type ManagerView =
  | { type: "list" }
  | { type: "create"; sourceEvent: OrderEvent | null }
  | { type: "edit"; channelId: string }
  | { type: "assign"; channelId: string }
  | { type: "delete"; channelId: string };

export function ChannelManagerDialog({
  initialCreateEvent = null,
  onClose,
  onToast,
  onAssignmentsApplied,
  onChannelDeleted,
  onReset,
}: {
  initialCreateEvent?: OrderEvent | null;
  onClose: () => void;
  onToast: (toast: ToastPayload) => void;
  onAssignmentsApplied: (events: OrderEvent[], sourceEvent: OrderEvent | null) => void;
  onChannelDeleted: (events: OrderEvent[]) => void;
  onReset: () => void;
}) {
  const {
    channels,
    routes,
    createChannel,
    updateChannel,
    deleteChannel,
    setChannelAssignments,
    getChannelAssignments,
    resetChannels,
  } = useOrderRouting();
  const venueName = "RAUDA";
  const [view, setView] = useState<ManagerView>(initialCreateEvent ? { type: "create", sourceEvent: initialCreateEvent } : { type: "list" });
  const [testChannelId, setTestChannelId] = useState<string | null>(null);
  const activeChannel = view.type === "edit" || view.type === "assign" || view.type === "delete"
    ? channels.find(({ id }) => id === view.channelId) ?? null
    : null;

  const sendTest = (channel: OrderChannel) => {
    setTestChannelId(channel.id);
    window.setTimeout(() => {
      setTestChannelId(null);
      onToast({
        message: channel.contact ? "Тестовое сообщение отправлено" : "Не удалось отправить сообщение. Проверьте подключение канала.",
        tone: channel.contact ? "success" : "error",
      });
    }, 650);
  };

  const close = () => {
    if (!testChannelId) onClose();
  };

  return (
    <div className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/25 px-4" role="dialog" aria-modal="true" aria-labelledby="channels-manager-title">
      <button type="button" className="absolute inset-0 cursor-default" onClick={close} aria-label="Закрыть" />
      <div className="relative flex max-h-[min(720px,calc(100vh-32px))] w-full max-w-[720px] flex-col overflow-hidden rounded-[16px] border border-[#e7e5e4] bg-white shadow-[0_24px_64px_rgba(41,37,36,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#eceae7] px-5 py-4">
          <div className="min-w-0">
            <h2 id="channels-manager-title" className="text-[15px] font-semibold text-[#292524]">
              {view.type === "list" ? "Каналы уведомлений" : view.type === "create" ? "Новый канал" : view.type === "edit" ? "Изменить канал" : view.type === "assign" ? "Назначения канала" : "Удалить канал"}
            </h2>
            <p className="mt-1 text-[12px] leading-5 text-[#79716b]">
              {view.type === "list" ? "Управляйте каналами, в которые приходят заказы и вызовы гостей." : view.type === "create" ? "Создайте канал и выберите функции, которые будут его использовать." : view.type === "edit" ? "Измените название и номер. Тип канала останется прежним." : view.type === "assign" ? "Один канал можно использовать сразу для нескольких функций." : "Проверьте последствия перед удалением."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {view.type === "list" && <Button type="button" size="sm" onClick={() => setView({ type: "create", sourceEvent: null })}><Plus size={14} /> Создать канал</Button>}
            <button type="button" onClick={close} aria-label="Закрыть" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524]"><X size={16} /></button>
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {view.type === "list" && (
            <ChannelList
              channels={channels}
              getAssignments={getChannelAssignments}
              testChannelId={testChannelId}
              onCreate={() => setView({ type: "create", sourceEvent: null })}
              onEdit={(channelId) => setView({ type: "edit", channelId })}
              onTest={sendTest}
              onAssign={(channelId) => setView({ type: "assign", channelId })}
              onDelete={(channelId) => setView({ type: "delete", channelId })}
            />
          )}

          {view.type === "create" && (
            <ChannelCreateForm
              venueName={venueName}
              sourceEvent={view.sourceEvent}
              channels={channels}
              onCancel={() => setView({ type: "list" })}
              onUseExisting={(channel, events) => {
                setChannelAssignments(channel.id, events);
                onAssignmentsApplied(events, view.sourceEvent);
                onToast({ message: "Назначения обновлены", tone: "success" });
                setView({ type: "list" });
              }}
              onCreate={(input, events) => {
                const channel = createChannel(input);
                setChannelAssignments(channel.id, events);
                onAssignmentsApplied(events, view.sourceEvent);
                onToast({ message: "Канал подключён", tone: "success" });
                setView({ type: "list" });
              }}
            />
          )}

          {view.type === "edit" && activeChannel && (
            <ChannelEditForm
              channel={activeChannel}
              channels={channels}
              onCancel={() => setView({ type: "list" })}
              onSave={(patch) => {
                updateChannel(activeChannel.id, patch);
                onToast({ message: "Канал обновлён", tone: "success" });
                setView({ type: "list" });
              }}
            />
          )}

          {view.type === "assign" && activeChannel && (
            <ChannelAssignmentsForm
              channel={activeChannel}
              routes={routes}
              initialEvents={getChannelAssignments(activeChannel.id)}
              onCancel={() => setView({ type: "list" })}
              onSave={(events) => {
                const removedEvents = getChannelAssignments(activeChannel.id).filter((event) => !events.includes(event));
                setChannelAssignments(activeChannel.id, events);
                onAssignmentsApplied(events, null);
                if (removedEvents.length) onChannelDeleted(removedEvents);
                onToast({ message: "Назначения обновлены", tone: "success" });
                setView({ type: "list" });
              }}
            />
          )}

          {view.type === "delete" && activeChannel && (
            <ChannelDeleteView
              channel={activeChannel}
              events={getChannelAssignments(activeChannel.id)}
              onCancel={() => setView({ type: "list" })}
              onDelete={() => {
                const events = getChannelAssignments(activeChannel.id);
                deleteChannel(activeChannel.id);
                onChannelDeleted(events);
                onToast({ message: "Канал удалён", tone: "success" });
                setView({ type: "list" });
              }}
            />
          )}
        </div>

        {view.type === "list" && import.meta.env.DEV && (
          <div className="flex items-center justify-between border-t border-[#eceae7] px-5 py-3">
            <button type="button" onClick={() => { resetChannels(); onReset(); onToast({ message: "Данные каналов сброшены", tone: "success" }); }} className="text-[11px] text-[#a8a29e] underline underline-offset-2 hover:text-[#57534d]">Сбросить данные прототипа</button>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>Закрыть</Button>
          </div>
        )}
      </div>
    </div>
  );
}

function ChannelList({
  channels,
  getAssignments,
  testChannelId,
  onCreate,
  onEdit,
  onTest,
  onAssign,
  onDelete,
}: {
  channels: OrderChannel[];
  getAssignments: (id: string) => OrderEvent[];
  testChannelId: string | null;
  onCreate: () => void;
  onEdit: (id: string) => void;
  onTest: (channel: OrderChannel) => void;
  onAssign: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (!channels.length) {
    return (
      <div className="py-8 text-center">
        <h3 className="text-[14px] font-semibold text-[#292524]">Каналов пока нет</h3>
        <p className="mt-1 text-[12px] leading-5 text-[#79716b]">Создайте канал, чтобы получать заказы и вызовы гостей.</p>
        <button type="button" onClick={onCreate} className="mt-3 text-[12px] font-medium text-[#57534d] underline underline-offset-2">Создать первый канал</button>
      </div>
    );
  }

  return (
    <ChannelRows
      mode="manage"
      channels={channels}
      getAssignments={getAssignments}
      testChannelId={testChannelId}
      onEdit={onEdit}
      onTest={onTest}
      onAssign={onAssign}
      onDelete={onDelete}
    />
  );
}

function ChannelRows({
  mode,
  channels,
  getAssignments,
  selectedId,
  testChannelId,
  onSelect,
  onEdit,
  onTest,
  onAssign,
  onDelete,
}: {
  mode: "manage" | "select";
  channels: OrderChannel[];
  getAssignments: (id: string) => OrderEvent[];
  selectedId?: string;
  testChannelId: string | null;
  onSelect?: (id: string) => void;
  onEdit: (id: string) => void;
  onTest: (channel: OrderChannel) => void;
  onAssign: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="divide-y divide-[#eceae7] border-y border-[#eceae7]" role={mode === "select" ? "radiogroup" : undefined} aria-label={mode === "select" ? "Каналы" : undefined}>
      {channels.map((channel) => {
        const events = getAssignments(channel.id);
        const selected = mode === "select" && selectedId === channel.id;
        return (
          <div key={channel.id} onClick={() => mode === "select" && onSelect?.(channel.id)} className={cn("grid items-center gap-3 px-1 py-2.5", mode === "manage" ? "grid-cols-[minmax(0,1.5fr)_minmax(160px,1fr)_auto]" : "cursor-pointer grid-cols-[auto_minmax(0,1.5fr)_minmax(130px,0.9fr)_auto]", selected && "bg-[#fafaf9]")}>
            {mode === "select" && (
              <button type="button" role="radio" aria-checked={selected} aria-label={`Выбрать ${channel.name}`} onClick={() => onSelect?.(channel.id)} className={cn("flex h-5 w-5 items-center justify-center rounded-full border", selected ? "border-[#292524] bg-[#292524] text-white" : "border-[#c7c2bd]")}>
                {selected && <Check size={11} />}
              </button>
            )}
            <button type="button" disabled={mode !== "select"} onClick={() => onSelect?.(channel.id)} className={cn("flex min-w-0 items-center gap-3 text-left", mode === "manage" && "cursor-default")}>
              <ChannelIcon type={channel.type} />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium text-[#292524]">{channel.name}</span>
                <span className="mt-0.5 block truncate text-[11px] text-[#79716b]">{CHANNEL_LABELS[channel.type]} · {channel.contact}</span>
              </span>
            </button>
            <div>
              <AssignmentBadges events={events} />
              <div className={cn("mt-1 text-[10px]", channelStatusClass(channel.status))}>{channelStatusLabel(channel.status)}</div>
            </div>
            <DropdownMenu.Root>
              <DropdownMenu.Trigger asChild>
                <button type="button" onClick={(event) => event.stopPropagation()} aria-label={`Действия канала ${channel.name}`} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#79716b] hover:bg-[#f5f5f4] hover:text-[#292524]"><MoreHorizontal size={16} /></button>
              </DropdownMenu.Trigger>
              <DropdownMenu.Portal>
                <DropdownMenu.Content sideOffset={6} align="end" className="z-[100008] min-w-48 rounded-[10px] border border-[#e7e5e4] bg-white p-1.5 shadow-xl">
                  <DropdownMenu.Item onSelect={() => onEdit(channel.id)} className="flex h-8 cursor-pointer items-center rounded-[7px] px-2 text-[12px] text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]">Редактировать</DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => onAssign(channel.id)} className="flex h-8 cursor-pointer items-center rounded-[7px] px-2 text-[12px] text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]">Настроить назначения</DropdownMenu.Item>
                  <DropdownMenu.Item onSelect={() => onTest(channel)} className="flex h-8 cursor-pointer items-center gap-2 rounded-[7px] px-2 text-[12px] text-[#57534d] outline-none data-[highlighted]:bg-[#f5f5f4]">{testChannelId === channel.id && <Loader2 size={13} className="animate-spin" />} Отправить тест</DropdownMenu.Item>
                  <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                  <DropdownMenu.Item onSelect={() => onDelete(channel.id)} className="flex h-8 cursor-pointer items-center gap-2 rounded-[7px] px-2 text-[12px] text-red-600 outline-none data-[highlighted]:bg-red-50"><Trash2 size={13} /> Удалить</DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        );
      })}
    </div>
  );
}

function ChannelCreateForm({
  venueName,
  sourceEvent,
  channels,
  onCancel,
  onCreate,
  onUseExisting,
}: {
  venueName: string;
  sourceEvent: OrderEvent | null;
  channels: OrderChannel[];
  onCancel: () => void;
  onCreate: (channel: Omit<OrderChannel, "id" | "status">, events: OrderEvent[]) => void;
  onUseExisting: (channel: OrderChannel, events: OrderEvent[]) => void;
}) {
  const suffix = sourceEvent === "delivery" ? "Доставка" : sourceEvent === "pickup" ? "Самовывоз" : sourceEvent === "waiter" ? "Зал" : "Заказы";
  const [type, setType] = useState<ChannelType>("telegram");
  const [name, setName] = useState(`${venueName} · ${suffix}`);
  const [events, setEvents] = useState<OrderEvent[]>(sourceEvent ? [sourceEvent] : []);
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const contact = phone;
  const exactDuplicate = channels.find((channel) => channel.type === type && channel.contact === contact) ?? channels.find((channel) => channel.name.trim().toLocaleLowerCase("ru") === name.trim().toLocaleLowerCase("ru"));
  const nameDuplicate = channels.some((channel) => channel.name.trim().toLocaleLowerCase("ru") === name.trim().toLocaleLowerCase("ru"));
  const handlePhone = useCallback((value: string, valid: boolean) => { setPhone(value); setPhoneValid(valid); }, []);
  const canSubmit = Boolean(name.trim()) && !nameDuplicate && phoneValid && !submitting;

  const submit = () => {
    if (!canSubmit) return;
    setSubmitting(true);
    window.setTimeout(() => onCreate({ type, name: name.trim(), contact }, events), 450);
  };

  return (
    <div>
      <button type="button" onClick={onCancel} className="mb-4 text-[12px] font-medium text-[#57534d] underline underline-offset-2">Назад к каналам</button>
      <div role="tablist" aria-label="Тип канала" className="inline-flex items-center gap-0.5 rounded-lg bg-[#f5f5f4] p-0.5">
        {(["telegram", "whatsapp"] as ChannelType[]).map((channelType) => (
          <button key={channelType} type="button" role="tab" aria-selected={type === channelType} onClick={() => setType(channelType)} className={cn("rounded-lg px-3 py-1.5 text-[12px] transition", type === channelType ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]" : "text-[#79716b]")}>{CHANNEL_LABELS[channelType]}</button>
        ))}
      </div>

      <div className="mt-5 space-y-5">
        <label className="block">
          <span className="mb-1.5 block text-[12px] font-medium text-[#57534d]">Название канала</span>
          <Input value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-[9px] text-[13px]" />
          <span className="mt-1.5 block text-[11px] leading-4 text-[#79716b]">Название помогает отличать каналы друг от друга. Его можно изменить.</span>
          {nameDuplicate && <span className="mt-1 block text-[11px] text-red-600">Канал с таким названием уже существует.</span>}
        </label>

        <div>
          <label htmlFor="manager-channel-phone" className="mb-1.5 block text-[12px] font-medium text-[#57534d]">{type === "telegram" ? "Номер Telegram" : "Номер WhatsApp"}</label>
          <AuthPhoneField key={type} id="manager-channel-phone" initialValue={phone} disabled={submitting} onValueChange={handlePhone} />
          {type === "telegram" && <p className="mt-1.5 text-[11px] leading-4 text-[#79716b]">Укажите номер, к которому привязан Telegram.</p>}
        </div>

        <div>
          <div className="mb-1 text-[12px] font-medium text-[#57534d]">Назначения</div>
          <AssignmentCheckboxes value={events} onChange={setEvents} />
        </div>

        {exactDuplicate && (
          <div className="rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-3 text-[12px] text-amber-900">
            <div className="font-medium">Этот канал уже добавлен</div>
            <Button type="button" variant="outline" size="sm" className="mt-2" onClick={() => onUseExisting(exactDuplicate, events)}>Использовать существующий</Button>
          </div>
        )}
      </div>

      <div className="mt-6 flex justify-end gap-2 border-t border-[#eceae7] pt-4">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel} disabled={submitting}>Отмена</Button>
        <Button type="button" size="sm" disabled={!canSubmit || Boolean(exactDuplicate)} onClick={submit}>{submitting ? <><Loader2 size={14} className="animate-spin" /> Подключаем…</> : type === "telegram" ? "Создать и подключить" : "Подключить WhatsApp"}</Button>
      </div>
    </div>
  );
}

function ChannelEditForm({ channel, channels, onCancel, onSave }: { channel: OrderChannel; channels: OrderChannel[]; onCancel: () => void; onSave: (patch: Pick<OrderChannel, "name" | "contact">) => void }) {
  const [name, setName] = useState(channel.name);
  const [phone, setPhone] = useState(channel.contact);
  const [phoneValid, setPhoneValid] = useState(false);
  const duplicate = channels.some((candidate) => candidate.id !== channel.id && (
    candidate.name.trim().toLocaleLowerCase("ru") === name.trim().toLocaleLowerCase("ru")
    || (candidate.type === channel.type && candidate.contact === phone)
  ));
  const handlePhone = useCallback((value: string, valid: boolean) => { setPhone(value); setPhoneValid(valid); }, []);
  return (
    <div>
      <label className="block"><span className="mb-1.5 block text-[12px] font-medium text-[#57534d]">Название канала</span><Input value={name} onChange={(event) => setName(event.target.value)} className="h-10 rounded-[9px] text-[13px]" /></label>
      <div className="mt-4">
        <label htmlFor={`edit-channel-phone-${channel.id}`} className="mb-1.5 block text-[12px] font-medium text-[#57534d]">{channel.type === "telegram" ? "Номер Telegram" : "Номер WhatsApp"}</label>
        <AuthPhoneField id={`edit-channel-phone-${channel.id}`} initialValue={channel.contact} onValueChange={handlePhone} />
        <p className="mt-1.5 text-[11px] text-[#79716b]">Тип канала: {CHANNEL_LABELS[channel.type]}</p>
      </div>
      {duplicate && <p className="mt-2 text-[11px] text-red-600">Канал с таким названием уже существует.</p>}
      <div className="mt-6 flex justify-end gap-2 border-t border-[#eceae7] pt-4"><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Отмена</Button><Button type="button" size="sm" disabled={!name.trim() || !phoneValid || duplicate} onClick={() => onSave({ name: name.trim(), contact: phone })}>Сохранить</Button></div>
    </div>
  );
}

function ChannelAssignmentsForm({ channel, routes, initialEvents, onCancel, onSave }: { channel: OrderChannel; routes: Record<OrderEvent, OrderChannel | null>; initialEvents: OrderEvent[]; onCancel: () => void; onSave: (events: OrderEvent[]) => void }) {
  const [events, setEvents] = useState(initialEvents);
  const conflicts = events.filter((event) => routes[event] && routes[event]?.id !== channel.id);
  return (
    <div>
      <div className="mb-4 flex items-center gap-3"><ChannelIcon type={channel.type} /><div><div className="text-[13px] font-medium text-[#292524]">{channel.name}</div><div className="text-[11px] text-[#79716b]">{CHANNEL_LABELS[channel.type]} · {channel.contact}</div></div></div>
      <AssignmentCheckboxes value={events} onChange={setEvents} />
      {conflicts.map((event) => (
        <div key={event} className="mt-3 rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2.5 text-[12px] leading-5 text-amber-900">{ORDER_EVENT_LABELS[event]} сейчас использует канал “{routes[event]?.name}”. После сохранения {event === "waiter" ? "новые вызовы" : "новые заказы"} будут приходить сюда.</div>
      ))}
      <div className="mt-6 flex justify-end gap-2 border-t border-[#eceae7] pt-4"><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Отмена</Button><Button type="button" size="sm" onClick={() => onSave(events)}>Сохранить</Button></div>
    </div>
  );
}

function ChannelDeleteView({ channel, events, onCancel, onDelete }: { channel: OrderChannel; events: OrderEvent[]; onCancel: () => void; onDelete: () => void }) {
  return (
    <div>
      <div className="flex items-center gap-3"><ChannelIcon type={channel.type} /><div><div className="text-[13px] font-medium text-[#292524]">{channel.name}</div><div className="text-[11px] text-[#79716b]">{CHANNEL_LABELS[channel.type]} · {channel.contact}</div></div></div>
      {events.length ? (
        <div className="mt-4 rounded-[9px] border border-red-200 bg-red-50 px-3 py-3 text-[12px] leading-5 text-red-900">
          <p className="font-medium">Канал используется для {assignmentLabel(events)}.</p>
          <p className="mt-1">После удаления перестанут получать уведомления: {events.map((event) => ORDER_EVENT_LABELS[event]).join(", ")}.</p>
        </div>
      ) : <p className="mt-4 text-[12px] text-[#79716b]">Канал нигде не используется и может быть удалён.</p>}
      <div className="mt-6 flex justify-end gap-2 border-t border-[#eceae7] pt-4"><Button type="button" variant="ghost" size="sm" onClick={onCancel}>Отмена</Button><Button type="button" size="sm" className="bg-red-600 text-white hover:bg-red-700" onClick={onDelete}>{events.length ? "Отключить функции и удалить" : "Удалить"}</Button></div>
    </div>
  );
}

export function ChannelPickerDialog({
  event,
  currentChannel,
  explainConnectionFirst,
  onClose,
  onConnect,
  onCreate,
  onToast,
  onAssignmentsApplied,
  onChannelDeleted,
}: {
  event: OrderEvent;
  currentChannel: OrderChannel | null;
  explainConnectionFirst: boolean;
  onClose: () => void;
  onConnect: (channel: OrderChannel) => void;
  onCreate: () => void;
  onToast: (toast: ToastPayload) => void;
  onAssignmentsApplied: (events: OrderEvent[]) => void;
  onChannelDeleted: (events: OrderEvent[]) => void;
}) {
  const { channels, routes, updateChannel, deleteChannel, setChannelAssignments, getChannelAssignments } = useOrderRouting();
  const [selectedId, setSelectedId] = useState(currentChannel?.id ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [testChannelId, setTestChannelId] = useState<string | null>(null);
  const [actionView, setActionView] = useState<Exclude<ManagerView, { type: "list" } | { type: "create" }> | null>(null);
  const selected = channels.find(({ id }) => id === selectedId) ?? null;
  const actionChannel = actionView ? channels.find(({ id }) => id === actionView.channelId) ?? null : null;
  const confirmation = event === "delivery" ? "Новые заказы доставки будут приходить в выбранный канал." : event === "pickup" ? "Новые заказы самовывоза будут приходить в выбранный канал." : "Вызовы гостей будут приходить в выбранный канал.";
  const unchanged = Boolean(currentChannel && selected?.id === currentChannel.id);

  const connect = () => {
    if (!selected || submitting || unchanged) return;
    setSubmitting(true);
    window.setTimeout(() => onConnect(selected), 350);
  };

  const sendTest = (channel: OrderChannel) => {
    if (testChannelId) return;
    setTestChannelId(channel.id);
    window.setTimeout(() => {
      setTestChannelId(null);
      onToast({ message: channel.contact ? "Тестовое сообщение отправлено" : "Не удалось отправить сообщение. Проверьте подключение канала.", tone: channel.contact ? "success" : "error" });
    }, 650);
  };

  const title = !actionView ? "Выберите канал" : actionView.type === "edit" ? "Изменить канал" : actionView.type === "assign" ? "Назначения канала" : "Удалить канал";
  const description = !actionView ? confirmation : actionView.type === "edit" ? "Измените название и номер. Тип канала останется прежним." : actionView.type === "assign" ? "Один канал можно использовать сразу для нескольких функций." : "Проверьте последствия перед удалением.";

  return (
    <div className="fixed inset-0 z-[100004] flex items-center justify-center bg-black/25 px-4" role="dialog" aria-modal="true" aria-labelledby="channel-picker-title">
      <button type="button" className="absolute inset-0 cursor-default" onClick={onClose} aria-label="Закрыть" />
      <div className="relative flex max-h-[min(640px,calc(100vh-32px))] w-full max-w-[620px] flex-col overflow-hidden rounded-[16px] border border-[#e7e5e4] bg-white shadow-[0_24px_64px_rgba(41,37,36,0.18)]">
        <div className="flex items-start justify-between gap-4 border-b border-[#eceae7] px-5 py-4"><div><h2 id="channel-picker-title" className="text-[15px] font-semibold text-[#292524]">{title}</h2><p className="mt-1 text-[12px] text-[#79716b]">{description}</p></div><button type="button" onClick={onClose} aria-label="Закрыть" className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#79716b] hover:bg-[#f5f5f4]"><X size={16} /></button></div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {!actionView && (
            <>
              {explainConnectionFirst && <div className="mb-3 rounded-[9px] border border-amber-200 bg-amber-50 px-3 py-2 text-[12px] text-amber-900">Сначала выберите канал. После назначения функция включится автоматически.</div>}
              {channels.length ? (
                <ChannelRows
                  mode="select"
                  channels={channels}
                  getAssignments={getChannelAssignments}
                  selectedId={selectedId}
                  testChannelId={testChannelId}
                  onSelect={setSelectedId}
                  onEdit={(channelId) => setActionView({ type: "edit", channelId })}
                  onTest={sendTest}
                  onAssign={(channelId) => setActionView({ type: "assign", channelId })}
                  onDelete={(channelId) => setActionView({ type: "delete", channelId })}
                />
              ) : (
                <div className="py-6 text-center"><div className="text-[13px] font-medium text-[#292524]">Каналов пока нет</div><p className="mt-1 text-[12px] text-[#79716b]">Сначала создайте канал.</p></div>
              )}
              <button type="button" onClick={onCreate} className="mt-3 flex items-center gap-1.5 text-[12px] font-medium text-[#57534d] underline underline-offset-2"><Plus size={13} /> Создать новый канал</button>
            </>
          )}
          {actionView?.type === "edit" && actionChannel && (
            <ChannelEditForm channel={actionChannel} channels={channels} onCancel={() => setActionView(null)} onSave={(patch) => { updateChannel(actionChannel.id, patch); onToast({ message: "Канал обновлён", tone: "success" }); setActionView(null); }} />
          )}
          {actionView?.type === "assign" && actionChannel && (
            <ChannelAssignmentsForm
              channel={actionChannel}
              routes={routes}
              initialEvents={getChannelAssignments(actionChannel.id)}
              onCancel={() => setActionView(null)}
              onSave={(events) => {
                const removedEvents = getChannelAssignments(actionChannel.id).filter((assignedEvent) => !events.includes(assignedEvent));
                setChannelAssignments(actionChannel.id, events);
                onAssignmentsApplied(events);
                if (removedEvents.length) onChannelDeleted(removedEvents);
                onToast({ message: "Назначения обновлены", tone: "success" });
                setActionView(null);
              }}
            />
          )}
          {actionView?.type === "delete" && actionChannel && (
            <ChannelDeleteView
              channel={actionChannel}
              events={getChannelAssignments(actionChannel.id)}
              onCancel={() => setActionView(null)}
              onDelete={() => {
                const assignedEvents = getChannelAssignments(actionChannel.id);
                deleteChannel(actionChannel.id);
                if (selectedId === actionChannel.id) setSelectedId("");
                onChannelDeleted(assignedEvents);
                onToast({ message: "Канал удалён", tone: "success" });
                setActionView(null);
              }}
            />
          )}
        </div>
        {!actionView && <div className="flex justify-end gap-2 border-t border-[#eceae7] px-5 py-4"><Button type="button" variant="ghost" size="sm" onClick={onClose} disabled={submitting}>Отмена</Button><Button type="button" size="sm" disabled={!selected || submitting || unchanged} onClick={connect}>{submitting ? <><Loader2 size={14} className="animate-spin" /> Подключаем…</> : "Подключить"}</Button></div>}
      </div>
    </div>
  );
}
