import { useEffect, useRef, useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  BellSimpleSlash,
  CaretDown,
  Check,
  CheckCircle,
  Copy,
  DownloadSimple,
  DotsThreeVertical,
  LinkSimple,
  NotePencil,
  Plus,
  Printer,
  QrCode,
  SpinnerGap,
  TelegramLogo,
  Trash,
  WarningCircle,
  WhatsappLogo,
  X,
} from "@phosphor-icons/react";
import QRCode from "react-qr-code";
import { AuthPhoneField } from "@/components/auth/auth-phone-field";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip } from "@/components/ui/tooltip";
import { DescriptionRichTextEditor } from "@/components/workspace/description-rich-text-editor";
import { useAppSettings } from "@/contexts/app-settings-context";
import {
  CHANNEL_LABELS,
  useOrderRouting,
  type ChannelType,
  type OrderChannel,
  type OrderEvent,
} from "@/contexts/order-routing-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { cn } from "@/lib/utils";

export type OrderMethod = "dineIn" | "delivery" | "pickup";

const METHOD_LABELS: Record<OrderMethod, string> = {
  dineIn: "Заказ в заведении",
  delivery: "Доставка",
  pickup: "Самовывоз",
};

const METHOD_DESCRIPTIONS: Record<OrderMethod, string> = {
  dineIn: "Выберите, как гости будут передавать заказ сотрудникам",
  delivery: "Создайте или выберите чат для заказов, чтобы включить доставку",
  pickup: "Создайте или выберите чат для заказов, чтобы включить самовывоз",
};

const ORDER_EVENTS: Record<OrderMethod, OrderEvent> = {
  dineIn: "waiter",
  delivery: "delivery",
  pickup: "pickup",
};

const CREATION_DELAY = 10_000;
const SHARE_LINK = "https://tsqr.sweet-affair.me/delivery";

type ChatChoice = "disabled" | "waiter-default" | string;
type ChatDraft = { type: ChannelType; contact: string; name: string };
type CreationState = { event: OrderMethod; draft: ChatDraft };
type CreationError = CreationState & { message: string };

function chatName(workspaceName: string | undefined, method: OrderMethod) {
  return `${workspaceName?.trim() || "Sweet-affair"} · ${METHOD_LABELS[method]}`;
}

function ChatIcon({ type, muted = false }: { type?: ChannelType; muted?: boolean }) {
  if (!type) {
    return (
      <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-[6px]", muted ? "border border-[#e7e5e4] bg-white text-[#79716b]" : "bg-[#e7e5e4] text-[#79716b]")}>
        <BellSimpleSlash size={13} weight="regular" aria-hidden="true" />
      </span>
    );
  }
  const Icon = type === "telegram" ? TelegramLogo : WhatsappLogo;
  return (
    <span className={cn("flex size-5 shrink-0 items-center justify-center rounded-[6px] border border-[#e7e5e4] bg-white", type === "telegram" ? "text-sky-500" : "text-emerald-500")}>
      <Icon size={13} weight="fill" aria-hidden="true" />
    </span>
  );
}

function ChatOption({
  channel,
  current,
  editing,
  editValue,
  editError,
  onEditValueChange,
  onSelect,
  onStartRename,
  onCommitRename,
  onCancelRename,
  onDelete,
}: {
  channel: OrderChannel;
  current: boolean;
  editing: boolean;
  editValue: string;
  editError: boolean;
  onEditValueChange: (value: string) => void;
  onSelect: () => void;
  onStartRename: () => void;
  onCommitRename: () => void;
  onCancelRename: () => void;
  onDelete: () => void;
}) {
  return (
    <div className={cn("group flex min-h-8 items-center gap-2 rounded-[8px] p-1 transition", current && "bg-[#f5f5f4]")} role="option" aria-selected={current}>
      {editing ? (
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <ChatIcon type={channel.type} />
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center gap-1">
            <Input
              autoFocus
              value={editValue}
              onChange={(event) => onEditValueChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  onCommitRename();
                }
                if (event.key === "Escape") {
                  event.preventDefault();
                  onCancelRename();
                }
              }}
              aria-label={`Новое название чата ${channel.name}`}
              aria-invalid={editError}
              className="h-6 min-w-0 flex-1 rounded-[7px] px-2 text-[13px] shadow-none focus-visible:ring-1 focus-visible:ring-[#4f39f6]"
            />
            <button type="button" aria-label="Сохранить название чата" onClick={onCommitRename} className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[#4f39f6] hover:bg-white"><Check size={15} /></button>
            <button type="button" aria-label="Отменить переименование" onClick={onCancelRename} className="flex size-6 shrink-0 items-center justify-center rounded-[6px] text-[#79716b] hover:bg-white"><X size={15} /></button>
            </div>
            {editError && <span role="alert" className="mt-1 block text-[10px] leading-3 text-[#c10007]">Название не может быть пустым</span>}
          </div>
        </div>
      ) : (
        <button type="button" onClick={onSelect} className="flex min-w-0 flex-1 items-center gap-2 text-left outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20">
          <ChatIcon type={channel.type} />
          <span className="min-w-0 flex-1 truncate text-[13px] leading-[18px] text-[#333]">{channel.name}</span>
        </button>
      )}

      {!editing && (
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" aria-label={`Действия чата ${channel.name}`} className="flex size-5 shrink-0 items-center justify-center rounded-[6px] text-[#79716b] opacity-0 outline-none transition hover:bg-[#e7e5e4] hover:text-[#292524] focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20 group-hover:opacity-100">
              <DotsThreeVertical size={17} weight="bold" aria-hidden="true" />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content align="end" sideOffset={4} className="z-[100030] min-w-[190px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_4px_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.1)] outline-none">
              <DropdownMenu.Item onSelect={onStartRename} className="flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[13px] text-[#0c0a09] outline-none data-[highlighted]:bg-[#f5f5f4]"><NotePencil size={16} />Переименовать чат</DropdownMenu.Item>
              <DropdownMenu.Separator className="my-1 h-px bg-[#e7e5e4]" />
              <DropdownMenu.Item onSelect={onDelete} className="flex h-8 cursor-pointer items-center gap-2 rounded-[8px] px-2 text-[13px] text-[#c10007] outline-none data-[highlighted]:bg-red-50"><Trash size={16} />Удалить чат</DropdownMenu.Item>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
      )}
    </div>
  );
}

function ChatPicker({
  method,
  currentChannelId,
  defaultSelected,
  onSelect,
  onCreate,
  onRename,
  onDelete,
}: {
  method: OrderMethod;
  currentChannelId: string | null;
  defaultSelected: boolean;
  onSelect: (choice: ChatChoice) => void;
  onCreate: () => void;
  onRename: (channel: OrderChannel, name: string) => void;
  onDelete: (channel: OrderChannel) => void;
}) {
  const { channels } = useOrderRouting();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editError, setEditError] = useState(false);
  const editingChannel = channels.find((channel) => channel.id === editingId) ?? null;

  const startRename = (channel: OrderChannel) => {
    setEditingId(channel.id);
    setEditValue(channel.name);
    setEditError(false);
  };

  const commitRename = () => {
    if (!editingChannel) return;
    if (!editValue.trim()) {
      setEditError(true);
      return;
    }
    onRename(editingChannel, editValue.trim());
    setEditingId(null);
    setEditError(false);
  };

  return (
    <div className="w-[260px] overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_4px_6px_rgba(0,0,0,0.1),0_2px_4px_rgba(0,0,0,0.1)]">
      <div className="border-b border-[#e7e5e4] pb-1">
        {method === "dineIn" && (
          <button type="button" role="option" aria-selected={defaultSelected} onClick={() => onSelect("waiter-default")} className={cn("flex h-8 w-full items-center gap-2 rounded-[8px] px-1 text-left text-[13px] text-[#333]", defaultSelected ? "bg-[#f5f5f4]" : "hover:bg-[#f5f5f4]")}>
            <ChatIcon muted />
            <span className="min-w-0 flex-1 truncate">Показать официанту</span>
            {defaultSelected && <Check size={16} className="shrink-0 text-[#292524]" />}
          </button>
        )}
        {method !== "dineIn" && (
          <button type="button" role="option" aria-selected={!defaultSelected && !currentChannelId} onClick={() => onSelect("disabled")} className={cn("flex h-8 w-full items-center gap-2 rounded-[8px] px-1 text-left text-[13px] text-[#333]", !defaultSelected && !currentChannelId ? "bg-[#f5f5f4]" : "hover:bg-[#f5f5f4]")}>
            <ChatIcon muted />
            <span className="min-w-0 flex-1 truncate">Выключено</span>
            {!defaultSelected && !currentChannelId && <Check size={16} className="shrink-0 text-[#292524]" />}
          </button>
        )}
      </div>

      {channels.length > 0 && (
        <div className="space-y-0.5 border-b border-[#e7e5e4] py-1">
          {channels.map((channel) => (
            <ChatOption
              key={channel.id}
              channel={channel}
              current={channel.id === currentChannelId}
              editing={editingId === channel.id}
              editValue={editingId === channel.id ? editValue : channel.name}
              editError={editingId === channel.id && editError}
              onEditValueChange={setEditValue}
              onSelect={() => onSelect(channel.id)}
              onStartRename={() => startRename(channel)}
              onCommitRename={commitRename}
              onCancelRename={() => { setEditingId(null); setEditError(false); }}
              onDelete={() => onDelete(channel)}
            />
          ))}
        </div>
      )}

      <button type="button" onClick={onCreate} className="flex h-8 w-full items-center gap-2 rounded-[8px] px-1 text-left text-[13px] text-[#666] outline-none hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20">
        <span className="flex size-5 items-center justify-center rounded-[6px] border border-[#e7e5e4] bg-white"><Plus size={16} /></span>
        Создать чат
      </button>
    </div>
  );
}

function ChatSelect({
  method,
  route,
  enabled,
  creatingType,
  onChoice,
  onCreate,
  onRename,
  onDelete,
}: {
  method: OrderMethod;
  route: OrderChannel | null;
  enabled: boolean;
  creatingType?: ChannelType;
  onChoice: (choice: ChatChoice) => void;
  onCreate: () => void;
  onRename: (channel: OrderChannel, name: string) => void;
  onDelete: (channel: OrderChannel) => void;
}) {
  const [open, setOpen] = useState(false);
  const defaultSelected = method === "dineIn" && enabled && !route;
  const creating = Boolean(creatingType);
  const label = creating ? "Создаём чат…" : defaultSelected ? "Показать официанту" : enabled && route ? route.name : "Выключено";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button type="button" disabled={creating} aria-label={`${METHOD_LABELS[method]}: ${label}`} className="flex h-7 w-full min-w-0 items-center gap-1.5 rounded-[8px] border border-[#e7e5e4] bg-white pl-0.5 pr-2 text-left text-[13px] text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.05)] outline-none transition hover:border-[#c7c2bd] focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20 disabled:cursor-wait disabled:opacity-70">
          {creating ? <ChatIcon type={creatingType} /> : defaultSelected ? <ChatIcon muted /> : route ? <ChatIcon type={route.type} /> : <ChatIcon muted />}
          <span className="min-w-0 flex-1 truncate">{label}</span>
          {creating ? <SpinnerGap size={15} className="shrink-0 animate-spin text-[#79716b]" /> : <CaretDown size={12} className="shrink-0 text-[#79716b]" />}
        </button>
      </PopoverTrigger>
      <PopoverContent side="bottom" align="end" sideOffset={6} className="z-[100025] w-auto p-0">
        <ChatPicker
          method={method}
          currentChannelId={enabled ? route?.id ?? null : null}
          defaultSelected={defaultSelected}
          onSelect={(choice) => { onChoice(choice); setOpen(false); }}
          onCreate={() => { onCreate(); setOpen(false); }}
          onRename={onRename}
          onDelete={onDelete}
        />
      </PopoverContent>
    </Popover>
  );
}

function MethodRow({
  method,
  route,
  enabled,
  creating,
  error,
  onChoice,
  onCreate,
  onRename,
  onDelete,
  onRetry,
  children,
}: {
  method: OrderMethod;
  route: OrderChannel | null;
  enabled: boolean;
  creating?: CreationState | null;
  error?: CreationError;
  onChoice: (choice: ChatChoice) => void;
  onCreate: () => void;
  onRename: (channel: OrderChannel, name: string) => void;
  onDelete: (channel: OrderChannel) => void;
  onRetry: () => void;
  children?: ReactNode;
}) {
  const description = enabled && method !== "dineIn"
    ? method === "delivery" ? "Получайте заказы на доставку из онлайн-меню" : "Получайте заказы на самовывоз из онлайн-меню"
    : METHOD_DESCRIPTIONS[method];

  return (
    <section className={cn("py-6", method !== "pickup" && "border-b border-[#e7e5e4]")}>
      <div className="grid grid-cols-[minmax(0,1fr)_205px] items-center gap-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium leading-5 text-[#292524]">{METHOD_LABELS[method]}</h2>
          <p className="mt-0.5 text-[13px] leading-4 text-[#666]">{description}</p>
        </div>
        <div className="min-w-0">
          <ChatSelect method={method} route={route} enabled={enabled} creatingType={creating?.draft.type} onChoice={onChoice} onCreate={onCreate} onRename={onRename} onDelete={onDelete} />
          {error && (
            <p role="alert" className="mt-1 flex items-start gap-1 text-[11px] leading-4 text-[#c10007]">
              <WarningCircle size={13} className="mt-0.5 shrink-0" />
              <span>Не удалось создать чат. <button type="button" onClick={onRetry} className="font-medium underline underline-offset-2">Повторить</button></span>
            </p>
          )}
        </div>
      </div>
      {enabled && method !== "dineIn" && children && <div className="mt-5">{children}</div>}
    </section>
  );
}

function ShareLinkSection({ onCopy, onToast }: { onCopy: () => void; onToast: (message: string) => void }) {
  const qrContainerRef = useRef<HTMLDivElement>(null);
  const copyResetTimer = useRef<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => () => {
    if (copyResetTimer.current) window.clearTimeout(copyResetTimer.current);
  }, []);

  const copyLink = () => {
    onCopy();
    setCopied(true);
    if (copyResetTimer.current) window.clearTimeout(copyResetTimer.current);
    copyResetTimer.current = window.setTimeout(() => setCopied(false), 2_200);
  };

  const getQrMarkup = () => qrContainerRef.current?.querySelector("svg")?.outerHTML ?? "";

  const downloadQr = () => {
    const markup = getQrMarkup();
    if (!markup) return;
    const blob = new Blob([markup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "tasko-delivery-qr.svg";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
    onToast("QR-код скачан");
  };

  const printQr = () => {
    const markup = getQrMarkup();
    if (!markup) return;
    const printWindow = window.open("", "_blank", "noopener,noreferrer,width=420,height=520");
    if (!printWindow) {
      onToast("Разрешите всплывающие окна, чтобы распечатать QR-код");
      return;
    }
    printWindow.document.write(`<html><head><title>QR-код Tasko</title><style>body{font-family:Inter,Arial,sans-serif;margin:48px;text-align:center;color:#292524}svg{width:240px;height:240px}p{font-size:14px;overflow-wrap:anywhere}</style></head><body><h1>Заказы онлайн</h1>${markup}<p>${SHARE_LINK}</p></body></html>`);
    printWindow.document.close();
    printWindow.focus();
    window.setTimeout(() => printWindow.print(), 120);
  };

  return (
    <section className="border-b border-[#e7e5e4] py-6">
      <h2 className="text-[14px] font-medium leading-5 text-[#292524]">Ссылка на доставку и самовывоз</h2>
      <p className="mt-0.5 text-[13px] leading-4 text-[#666]">По этой ссылке гости смогут оформить доставку или самовывоз.</p>
      <div className="mt-3 flex h-7 min-w-0 items-center gap-2">
        <div className="flex h-7 min-w-0 flex-1 items-center overflow-hidden rounded-[8px] border border-[#e5e5e5] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
          <LinkSimple size={14} className="ml-2 shrink-0 text-[#79716b]" />
          <a href={SHARE_LINK} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate px-2 text-[13px] text-[#79716b] transition-colors hover:text-[#333] hover:underline focus-visible:text-[#333] focus-visible:underline focus-visible:outline-none" title={SHARE_LINK}>{SHARE_LINK}</a>
          <button type="button" onClick={copyLink} className="flex h-full shrink-0 items-center gap-1.5 border-l border-[#e5e5e5] px-3 text-[13px] text-[#57534d] transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#4f39f6]/20" aria-label={copied ? "Ссылка скопирована" : "Скопировать ссылку"}>{copied ? <CheckCircle size={16} weight="fill" className="text-[#059669]" /> : <Copy size={16} />} {copied ? "Скопировано" : "Скопировать"}</button>
        </div>
        <Popover>
          <PopoverTrigger asChild>
            <button type="button" className="flex h-7 shrink-0 items-center gap-1.5 rounded-[8px] border border-[#e5e5e5] bg-white px-2 text-[13px] text-[#57534d] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20"><QrCode size={16} /> QR-код<CaretDown size={12} /></button>
          </PopoverTrigger>
          <PopoverContent align="end" sideOffset={6} className="z-[100025] w-[194px] p-1">
            <button type="button" onClick={downloadQr} className="flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-[#292524] transition hover:bg-[#f5f5f4]"><DownloadSimple size={16} />Скачать QR-код</button>
            <button type="button" onClick={printQr} className="flex h-8 w-full items-center gap-2 rounded-[8px] px-2 text-left text-[13px] text-[#292524] transition hover:bg-[#f5f5f4]"><Printer size={16} />Печать QR-кода</button>
          </PopoverContent>
        </Popover>
      </div>
      <div ref={qrContainerRef} className="sr-only"><QRCode value={SHARE_LINK} size={240} /></div>
    </section>
  );
}

function IntroBanner() {
  const [visible, setVisible] = useState(true);
  if (!visible) return null;
  return (
    <section className="relative h-[127px] overflow-hidden rounded-[20px] border border-[#f5f5f4] bg-[#f5f5f4]">
      <div className="relative z-10 max-w-[470px] pl-[14px] pr-3 pt-[29px]">
        <h1 className="text-[14px] font-semibold leading-5 text-[#333]">Получайте заказы прямо из онлайн-меню</h1>
        <p className="mt-1 max-w-[466px] text-[13px] leading-[17px] text-[#79716b]">Подключите чат и получайте заказы из зала, на доставку и самовывоз. Все заказы сохранятся в Tasko и попадут в аналитику.</p>
      </div>
      <div className="absolute right-2 top-2 hidden h-[111px] w-[248px] overflow-hidden rounded-[12px] sm:block">
        <img src="/orders-settings-disclaimer.webp" alt="" className="size-full object-cover" />
        <button type="button" onClick={() => setVisible(false)} aria-label="Скрыть подсказку" className="absolute right-1 top-1 flex size-5 items-center justify-center rounded-[8px] bg-black/10 text-white transition hover:bg-black/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70"><X size={14} /></button>
      </div>
    </section>
  );
}

function AddChatDialog({
  open,
  method,
  workspaceName,
  onClose,
  onSubmit,
}: {
  open: boolean;
  method: OrderMethod | null;
  workspaceName?: string;
  onClose: () => void;
  onSubmit: (draft: ChatDraft) => void;
}) {
  const activeMethod = method ?? "delivery";
  const [type, setType] = useState<ChannelType>("whatsapp");
  const [phone, setPhone] = useState("");
  const [phoneValid, setPhoneValid] = useState(false);
  const [name, setName] = useState("");

  useEffect(() => {
    if (!open) return;
    setType("whatsapp");
    setPhone("");
    setPhoneValid(false);
    setName(chatName(workspaceName, activeMethod));
  }, [activeMethod, open, workspaceName]);

  const previewName = name.trim() || chatName(workspaceName, activeMethod);
  const submit = () => {
    if (!phoneValid || !name.trim()) return;
    onSubmit({ type, contact: phone, name: name.trim() });
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => { if (!nextOpen) onClose(); }}>
      <DialogContent className="max-w-[320px] gap-0 overflow-hidden rounded-[16px] p-0">
        <DialogHeader className="border-b border-[#e7e5e4] px-4 pb-3 pt-4">
          <DialogTitle className="text-[14px] tracking-[-0.35px]">Добавить чат</DialogTitle>
          <DialogDescription className="sr-only">Подключите WhatsApp или Telegram для заказов.</DialogDescription>
          <div role="tablist" aria-label="Мессенджер" className="mt-3 inline-flex items-center gap-1">
            {(["whatsapp", "telegram"] as ChannelType[]).map((channelType) => (
              <button key={channelType} type="button" role="tab" aria-selected={type === channelType} onClick={() => setType(channelType)} className={cn("rounded-[8px] px-2 py-[5px] text-[12px] leading-4 transition", type === channelType ? "bg-[#f1f1f0] text-[#292524]" : "text-[#57534e] shadow-[0_0.841px_0.841px_rgba(0,0,0,0.05)] hover:bg-[#f5f5f4]")}>
                {CHANNEL_LABELS[channelType]}
              </button>
            ))}
          </div>
        </DialogHeader>

        <div className="space-y-3 px-4 py-3">
          <div>
            <Tooltip label="Используем этот номер, чтобы добавить вас в созданный чат." side="top" contentClassName="max-w-[220px] whitespace-normal px-2.5 py-2 text-[11px] leading-4">
              <span tabIndex={0} className="mb-1.5 inline-block cursor-help border-b border-dashed border-[#78716c] text-[13px] leading-5 text-[#333]">Номер телефона</span>
            </Tooltip>
            <AuthPhoneField key={`${activeMethod}-${open}`} id="add-chat-phone" initialValue="" variant="compact" onValueChange={(value, valid) => { setPhone(value); setPhoneValid(valid); }} />
          </div>

          <label className="block">
            <span className="mb-1.5 block text-[13px] text-[#333]">Название чата</span>
            <Input value={name} onChange={(event) => setName(event.target.value)} className="h-7 rounded-[8px] px-2 text-[13px] shadow-none" />
          </label>

          <div>
            <div className="mb-1.5 text-[12px] leading-5 text-[#999]">Пример сообщения</div>
            <div className="flex h-[45px] items-center gap-1.5 overflow-hidden rounded-[13px] bg-[#f5f5f4] px-[7px] py-[7px]">
              <span className="relative size-[30px] shrink-0 overflow-visible rounded-full bg-[#7c86ff]">
                <img src="/order-settings-banner.png" alt="" className="size-full rounded-full object-cover" />
                <span className={cn("absolute -bottom-0.5 -right-0.5 flex size-[13px] items-center justify-center rounded-[4px]", type === "telegram" ? "bg-sky-500 text-white" : "bg-[#00b900] text-white")}>
                  {type === "telegram" ? <TelegramLogo size={10} weight="fill" /> : <WhatsappLogo size={10} weight="fill" />}
                </span>
              </span>
              <div className="min-w-0 flex-1 text-[11px] leading-[14px] text-[#3f3f3f]">
                <div className="flex items-center justify-between gap-2"><strong className="truncate text-[12px] font-semibold text-[#222]">{previewName}</strong><span className="shrink-0 text-[9px] text-[#78716c]">сейчас</span></div>
                <div className="mt-0.5 text-[10px] text-[#57534e]">Стол 9 · 2 450 ₸</div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="border-t border-[#e7e5e4] p-2">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-7 flex-1 rounded-[8px] text-[13px]">Отмена</Button>
          <Button type="button" size="sm" disabled={!phoneValid || !name.trim()} onClick={submit} className="h-7 flex-1 rounded-[8px] bg-[#4f39f6] text-[13px] text-white hover:bg-[#4030d4] disabled:bg-[#d6d3d1]">Добавить чат</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteChatDialog({
  channel,
  assignments,
  onClose,
  onConfirm,
}: {
  channel: OrderChannel | null;
  assignments: OrderEvent[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  if (!channel) return null;
  const consequences = assignments.length <= 1
    ? `Чат «${channel.name}» будет удалён, а ${assignments[0] === "delivery" ? "доставка — выключена" : assignments[0] === "pickup" ? "самовывоз — выключен" : "заказы в заведении — выключены"}.`
    : `Чат «${channel.name}» будет удалён, а ${assignments.includes("delivery") && assignments.includes("pickup") ? "доставка и самовывоз" : assignments.map((event) => event === "delivery" ? "доставка" : event === "pickup" ? "самовывоз" : "заказы в заведении").join(" и ")} — выключены.`;

  return (
    <Dialog open={Boolean(channel)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="max-w-[338px] gap-0 overflow-hidden rounded-[16px] p-0">
        <DialogHeader className="border-b border-[#e7e5e4] p-4">
          <DialogTitle className="text-[14px] tracking-[-0.35px]">Удалить чат?</DialogTitle>
        </DialogHeader>
        <div className="px-4 py-3"><p className="text-[13px] leading-5 text-[#44403b]">{assignments.length ? consequences : `Чат «${channel.name}» будет удалён.`}</p></div>
        <DialogFooter className="border-t border-[#e7e5e4] p-2">
          <button type="button" onClick={onClose} className="h-7 flex-1 rounded-[8px] border border-[#e4e4e7] bg-white text-[13px] text-[#18181b] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">Отмена</button>
          <button type="button" onClick={onConfirm} className="h-7 flex-1 rounded-[8px] bg-[#ec003f] text-[13px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.05)]">Удалить</button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function OrderMethodsWorkspace({ onChange }: { onChange: () => void }) {
  const { account } = useMockAuth();
  const {
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
  const { channels, routes, setRoute, createChannel, updateChannel, deleteChannel, getChannelAssignments } = useOrderRouting();
  const [createMethod, setCreateMethod] = useState<OrderMethod | null>(null);
  const [creation, setCreation] = useState<CreationState | null>(null);
  const [creationError, setCreationError] = useState<CreationError | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<OrderChannel | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const creationTimer = useRef<number | null>(null);

  useEffect(() => () => {
    if (creationTimer.current) window.clearTimeout(creationTimer.current);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const setEnabled = (method: OrderMethod, enabled: boolean) => {
    if (method === "dineIn") setWaiterEnabled(enabled);
    if (method === "delivery") setDeliveryEnabled(enabled);
    if (method === "pickup") setPickupEnabled(enabled);
  };

  const handleChoice = (method: OrderMethod, choice: ChatChoice) => {
    const event = ORDER_EVENTS[method];
    setCreationError(null);
    if (choice === "disabled") {
      setEnabled(method, false);
      onChange();
      return;
    }
    if (choice === "waiter-default") {
      setRoute(event, null);
      setEnabled(method, true);
      onChange();
      return;
    }
    const channel = channels.find(({ id }) => id === choice);
    if (!channel) return;
    setRoute(event, channel);
    setEnabled(method, true);
    onChange();
  };

  const startCreation = (method: OrderMethod, draft: ChatDraft) => {
    const event = ORDER_EVENTS[method];
    setCreateMethod(null);
    setCreationError(null);
    setCreation({ event: method, draft });
    if (creationTimer.current) window.clearTimeout(creationTimer.current);
    creationTimer.current = window.setTimeout(() => {
      try {
        const digits = draft.contact.replace(/\D/g, "");
        // A deterministic mock failure keeps the error/retry state testable without a backend.
        if (digits.endsWith("0000")) throw new Error("mock-create-failed");
        const channel = createChannel({ type: draft.type, contact: draft.contact, name: draft.name });
        setRoute(event, channel);
        setEnabled(method, true);
        setCreation(null);
        onChange();
        setToast(`Чат «${draft.name}» создан`);
      } catch {
        setRoute(event, null);
        setEnabled(method, false);
        setCreation(null);
        setCreationError({ event: method, draft, message: "Не удалось создать чат" });
        onChange();
      }
    }, CREATION_DELAY);
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    const name = deleteTarget.name;
    const assignments = getChannelAssignments(deleteTarget.id);
    deleteChannel(deleteTarget.id);
    assignments.forEach((event) => {
      const method = (Object.keys(ORDER_EVENTS) as OrderMethod[]).find((candidate) => ORDER_EVENTS[candidate] === event);
      if (method) setEnabled(method, false);
    });
    setDeleteTarget(null);
    onChange();
    setToast(`Чат «${name}» удалён`);
  };

  const handleRename = (channel: OrderChannel, name: string) => {
    updateChannel(channel.id, { name, contact: channel.contact });
    setToast("Название чата обновлено");
  };

  const hasDeliveryOrPickup = deliveryEnabled || pickupEnabled;

  return (
    <div className="mx-auto w-full max-w-[741px] space-y-4">
      <IntroBanner />
      <div className="px-[6px]">
        <MethodRow
          method="dineIn"
          route={routes.waiter}
          enabled={waiterEnabled}
          creating={creation?.event === "dineIn" ? creation : null}
          error={creationError?.event === "dineIn" ? creationError : undefined}
          onChoice={(choice) => handleChoice("dineIn", choice)}
          onCreate={() => setCreateMethod("dineIn")}
          onRename={handleRename}
          onDelete={setDeleteTarget}
          onRetry={() => creationError?.event === "dineIn" && startCreation("dineIn", creationError.draft)}
        />

        {hasDeliveryOrPickup && <ShareLinkSection onCopy={() => { void navigator.clipboard?.writeText(SHARE_LINK); setToast("Ссылка скопирована"); }} onToast={setToast} />}

        <MethodRow
          method="delivery"
          route={routes.delivery}
          enabled={deliveryEnabled}
          creating={creation?.event === "delivery" ? creation : null}
          error={creationError?.event === "delivery" ? creationError : undefined}
          onChoice={(choice) => handleChoice("delivery", choice)}
          onCreate={() => setCreateMethod("delivery")}
          onRename={handleRename}
          onDelete={setDeleteTarget}
          onRetry={() => creationError?.event === "delivery" && startCreation("delivery", creationError.draft)}
        >
          <DescriptionRichTextEditor
            label="Информация о доставке"
            value={deliveryComment}
            placeholder="Например: минимальная сумма заказа — 5 000 ₸. Доставка занимает 45–60 минут."
            limit={300}
            compact
            className="[&>div:last-child]:h-[120px] [&>div:last-child>div:first-child]:h-[38px] [&>div:last-child>div:last-child]:h-[80px] [&>div:last-child>div:last-child]:min-h-0"
            onChange={(value) => { setDeliveryComment(value); onChange(); }}
          />
        </MethodRow>

        <MethodRow
          method="pickup"
          route={routes.pickup}
          enabled={pickupEnabled}
          creating={creation?.event === "pickup" ? creation : null}
          error={creationError?.event === "pickup" ? creationError : undefined}
          onChoice={(choice) => handleChoice("pickup", choice)}
          onCreate={() => setCreateMethod("pickup")}
          onRename={handleRename}
          onDelete={setDeleteTarget}
          onRetry={() => creationError?.event === "pickup" && startCreation("pickup", creationError.draft)}
        >
          <div className="space-y-5">
            <label className="block"><span className="mb-1.5 block text-[13px] leading-5 text-[#333]">Откуда забирать</span><Input value={pickupAddress} onChange={(event) => { setPickupAddress(event.target.value); onChange(); }} placeholder="Астана, Абылай-хана 34, д 18" className="h-7 rounded-[8px] px-2 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.1)]" /></label>
            <DescriptionRichTextEditor
              label="Информация о самовывозе"
              value={pickupComment}
              placeholder="Например: заказ будет готов через 20–30 минут. Назовите номер заказа сотруднику."
              limit={300}
              compact
              className="[&>div:last-child]:h-[120px] [&>div:last-child>div:first-child]:h-[38px] [&>div:last-child>div:last-child]:h-[80px] [&>div:last-child>div:last-child]:min-h-0"
              onChange={(value) => { setPickupComment(value); onChange(); }}
            />
          </div>
        </MethodRow>
      </div>

      <AddChatDialog open={createMethod !== null} method={createMethod} workspaceName={account?.workspace.name} onClose={() => setCreateMethod(null)} onSubmit={(draft) => { if (createMethod) startCreation(createMethod, draft); }} />
      <DeleteChatDialog channel={deleteTarget} assignments={deleteTarget ? getChannelAssignments(deleteTarget.id) : []} onClose={() => setDeleteTarget(null)} onConfirm={confirmDelete} />
      {creation && (
        <div role="status" className="sr-only">Создаём чат…</div>
      )}
      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[100040] -translate-x-1/2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">{toast}</div>}
    </div>
  );
}
