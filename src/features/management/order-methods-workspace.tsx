import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ArrowRight,
  CaretDown,
  CheckCircle,
  Copy,
  DownloadSimple,
  Info,
  Printer,
  QrCode,
} from "@phosphor-icons/react";
import QRCode from "react-qr-code";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { DescriptionRichTextEditor } from "@/components/workspace/description-rich-text-editor";
import { useAppSettings, type DineInOrderMode } from "@/contexts/app-settings-context";
import { cn } from "@/lib/utils";

export type OrderMethod = "dineIn" | "delivery" | "pickup";

const METHOD_LABELS: Record<OrderMethod, string> = {
  dineIn: "Заказы в заведении",
  delivery: "Доставка",
  pickup: "Самовывоз",
};

const METHOD_DESCRIPTIONS: Record<OrderMethod, string> = {
  dineIn: "Как гости будут передавать заказ сотрудникам",
  delivery: "Настройте приём заказов на доставку",
  pickup: "Настройте приём заказов на самовывоз",
};

const SHARE_LINK = "https://tsqr.sweet-affair.me/delivery";

function MethodStateSelect({
  method,
  enabled,
  onEnabledChange,
}: {
  method: "delivery" | "pickup";
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
}) {
  return (
    <Select value={enabled ? "enabled" : "disabled"} onValueChange={(value) => onEnabledChange(value === "enabled")}>
      <SelectTrigger aria-label={`${METHOD_LABELS[method]}: ${enabled ? "Работает" : "Выключено"}`} className="h-7 rounded-[8px] px-2 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="z-[100025] min-w-[205px]">
        <SelectItem value="enabled">Работает</SelectItem>
        <SelectItem value="disabled">Выключено</SelectItem>
      </SelectContent>
    </Select>
  );
}

function DineInOrderSelect({
  mode,
  onModeChange,
}: {
  mode: DineInOrderMode;
  onModeChange: (mode: DineInOrderMode) => void;
}) {
  const label = mode === "send-order" ? "Отправить заказ" : "Показать официанту";

  return (
    <Select value={mode} onValueChange={(value) => onModeChange(value as DineInOrderMode)}>
      <SelectTrigger aria-label={`Заказы в заведении: ${label}`} className="h-7 rounded-[8px] px-2 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.05)]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent align="end" className="z-[100025] min-w-[286px]">
        <SelectItem value="waiter" description="Гость показывает собранный заказ сотруднику" className="h-auto min-h-[52px] items-start py-2">
          Показать официанту
        </SelectItem>
        <SelectItem value="send-order" description="Гость отправляет заказ, он появляется на табло" className="h-auto min-h-[52px] items-start py-2">
          Отправить заказ
        </SelectItem>
      </SelectContent>
    </Select>
  );
}

function MethodRow({
  method,
  enabled = true,
  control,
  children,
}: {
  method: OrderMethod;
  enabled?: boolean;
  control: ReactNode;
  children?: ReactNode;
}) {
  return (
    <section className={cn("py-6", method !== "pickup" && "border-b border-[#e7e5e4]")}>
      <div className="grid grid-cols-[minmax(0,1fr)_205px] items-center gap-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium leading-5 text-[#292524]">{METHOD_LABELS[method]}</h2>
          <p className="mt-0.5 text-[13px] leading-4 text-[#666]">{METHOD_DESCRIPTIONS[method]}</p>
        </div>
        <div className="min-w-0">{control}</div>
      </div>
      {enabled && children && <div className="mt-5">{children}</div>}
    </section>
  );
}

function ShareLinkSection({
  deliveryEnabled,
  pickupEnabled,
  onCopy,
  onToast,
}: {
  deliveryEnabled: boolean;
  pickupEnabled: boolean;
  onCopy: () => void;
  onToast: (message: string) => void;
}) {
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

  const title = deliveryEnabled && pickupEnabled
    ? "Ссылка на доставку и самовывоз"
    : deliveryEnabled
      ? "Ссылка на доставку"
      : "Ссылка на самовывоз";
  const description = deliveryEnabled && pickupEnabled
    ? "По этой ссылке гости смогут оформить доставку или самовывоз."
    : deliveryEnabled
      ? "По этой ссылке гости смогут оформить доставку."
      : "По этой ссылке гости смогут оформить самовывоз.";

  return (
    <section className="border-b border-[#e7e5e4] py-6">
      <div className="flex min-h-7 items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className="text-[14px] font-medium leading-5 text-[#292524]">{title}</h2>
          <p className="mt-0.5 text-[13px] leading-4 text-[#666]">{description}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button type="button" onClick={copyLink} className="flex h-7 items-center gap-1.5 rounded-[8px] border border-[#e5e5e5] bg-white px-2 text-[13px] text-[#57534d] shadow-[0_1px_2px_rgba(0,0,0,0.05)] transition hover:bg-[#fafaf9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/20" aria-label={copied ? "Ссылка скопирована" : "Скопировать ссылку"}>{copied ? <CheckCircle size={16} weight="fill" className="text-[#059669]" /> : <Copy size={16} />} {copied ? "Скопировано" : "Скопировать"}</button>
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
      </div>
      <div ref={qrContainerRef} className="sr-only"><QRCode value={SHARE_LINK} size={240} /></div>
    </section>
  );
}

export function OrderMethodsWorkspace({ onChange, onOpenReceiving }: { onChange: () => void; onOpenReceiving: () => void }) {
  const {
    deliveryEnabled,
    setDeliveryEnabled,
    pickupEnabled,
    setPickupEnabled,
    waiterEnabled,
    setWaiterEnabled,
    dineInOrderMode,
    setDineInOrderMode,
    deliveryComment,
    setDeliveryComment,
    pickupComment,
    setPickupComment,
    pickupAddress,
    setPickupAddress,
  } = useAppSettings();
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const hasDeliveryOrPickup = deliveryEnabled || pickupEnabled;

  return (
    <div className="mx-auto w-full max-w-[741px] space-y-4">
      <div className="px-[6px]">
        <MethodRow
          method="dineIn"
          control={<DineInOrderSelect mode={dineInOrderMode} onModeChange={(mode) => { setDineInOrderMode(mode); onChange(); }} />}
        >
          <div className="flex items-center justify-between gap-4">
            <div className="min-w-0">
              <h3 className="text-[14px] font-medium leading-5 text-[#292524]">Вызов сотрудника</h3>
              <p className="mt-0.5 text-[13px] leading-4 text-[#666]">Гости смогут позвать сотрудника из онлайн-меню</p>
            </div>
            <Switch
              checked={waiterEnabled}
              onCheckedChange={(enabled) => { setWaiterEnabled(enabled); onChange(); }}
              aria-label={`${waiterEnabled ? "Выключить" : "Включить"} вызов сотрудника`}
            />
          </div>
        </MethodRow>

        <MethodRow
          method="delivery"
          enabled={deliveryEnabled}
          control={<MethodStateSelect method="delivery" enabled={deliveryEnabled} onEnabledChange={(enabled) => { setDeliveryEnabled(enabled); onChange(); }} />}
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
          enabled={pickupEnabled}
          control={<MethodStateSelect method="pickup" enabled={pickupEnabled} onEnabledChange={(enabled) => { setPickupEnabled(enabled); onChange(); }} />}
        >
          <div className="space-y-5">
            <label className="block"><span className="mb-1.5 block text-[13px] leading-5 text-[#333]">Откуда забирать заказы</span><Input value={pickupAddress} onChange={(event) => { setPickupAddress(event.target.value); onChange(); }} placeholder="Астана, Абылай-хана 34, д 18" className="h-7 rounded-[8px] px-2 text-[13px] shadow-[0_1px_2px_rgba(0,0,0,0.1)]" /></label>
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

        {hasDeliveryOrPickup && <ShareLinkSection deliveryEnabled={deliveryEnabled} pickupEnabled={pickupEnabled} onCopy={() => { void navigator.clipboard?.writeText(SHARE_LINK); setToast("Ссылка скопирована"); }} onToast={setToast} />}

        <section className="flex flex-wrap items-center justify-between gap-3 py-6">
          <p className="flex items-center gap-1.5 text-[13px] leading-4 text-[#666]"><span className="flex size-[18px] shrink-0 items-center justify-center rounded-[5px] bg-[#f5f5f4] text-[#79716b]"><Info size={12} aria-hidden="true" /></span>Все заказы автоматически появляются на <span className="text-[#51a2ff]">табло</span></p>
          <Button type="button" variant="outline" size="sm" onClick={onOpenReceiving} className="h-7 rounded-[10px] px-2 text-[13px] font-normal text-[#57534d]">Настроить получение заказов<ArrowRight size={16} aria-hidden="true" /></Button>
        </section>
      </div>

      {toast && <div role="status" className="fixed bottom-5 left-1/2 z-[100040] -translate-x-1/2 rounded-[10px] bg-[#292524] px-3 py-2 text-[13px] font-medium text-white shadow-[0_12px_36px_rgba(41,37,36,0.2)]">{toast}</div>}
    </div>
  );
}
