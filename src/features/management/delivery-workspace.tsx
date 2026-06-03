import { useState, type ReactNode } from "react";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { PageContent, PageScroll } from "@/components/workspace/page-layout";
import { SectionCard } from "@/components/workspace/section-card";
import { LocalizedTextArea } from "@/components/workspace/localized-textarea";
import { useAppSettings } from "@/contexts/app-settings-context";
import {
  CHANNEL_LABELS,
  useOrderRouting,
  type ChannelType,
  type OrderEvent,
  type RouteChannel,
} from "@/contexts/order-routing-context";
import { usePublish } from "@/contexts/publish-context";
import type { PreviewScenario } from "@/data/mock-data";
import { cn } from "@/lib/utils";

type DeliveryWorkspaceProps = {
  setPreviewScenario: (scenario: PreviewScenario) => void;
};

const DRAWER_META: Record<
  OrderEvent,
  { title: string; warningTitle: string; warningDesc: string; preview: ReactNode }
> = {
  delivery: {
    title: "Куда отправлять заказы доставки",
    warningTitle: "Заказы не будут приниматься",
    warningDesc: "Укажите канал получения заказов.",
    preview: (
      <>
        <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
          Новый заказ · Доставка
        </div>
        <div className="mt-1 text-sm font-bold text-zinc-900">Заказ #1024</div>
        <div className="mt-1 text-sm text-zinc-600">Маргарита ×1 · Кола ×2</div>
        <div className="mt-1 text-sm font-bold text-zinc-900">Сумма: 5 200 ₸</div>
      </>
    ),
  },
  pickup: {
    title: "Куда отправлять заказы самовывоза",
    warningTitle: "Заказы не будут приниматься",
    warningDesc: "Укажите канал получения заказов.",
    preview: (
      <>
        <div className="text-xs font-black uppercase tracking-wide text-emerald-700">
          Новый заказ · Самовывоз
        </div>
        <div className="mt-1 text-sm font-bold text-zinc-900">Заказ #1025</div>
        <div className="mt-1 text-sm text-zinc-600">Пепперони ×1</div>
        <div className="mt-1 text-sm font-bold text-zinc-900">Сумма: 4 500 ₸</div>
      </>
    ),
  },
  waiter: {
    title: "Куда отправлять вызовы официанта",
    warningTitle: "Вызовы не будут приходить",
    warningDesc: "Укажите канал для вызовов официанта.",
    preview: (
      <>
        <div className="text-xs font-black uppercase tracking-wide text-blue-700">
          Вызов официанта
        </div>
        <div className="mt-1 text-sm font-bold text-zinc-900">Стол 4</div>
        <div className="mt-1 text-sm text-zinc-600">Гость зовёт официанта</div>
      </>
    ),
  },
};

function ChannelDrawer({
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
  const meta = DRAWER_META[event];
  const [type, setType] = useState<ChannelType>(route?.type ?? "whatsapp");
  const [contact, setContact] = useState(route?.contact ?? "");

  const canSave = contact.trim().length > 0;
  const placeholder = type === "whatsapp" ? "+7 700 000 00 00" : "@username или chat id";

  return (
    <div className="fixed inset-0 z-50">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h3 className="text-lg font-black">{meta.title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-900"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto px-6 py-6">
          <div>
            <Label>Тип канала</Label>
            <div className="mt-2 inline-flex w-full gap-1 rounded-xl bg-zinc-100 p-1">
              {(["whatsapp", "telegram"] as ChannelType[]).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setType(t)}
                  className={cn(
                    "flex-1 rounded-lg px-3 py-2 text-sm font-bold transition",
                    type === t ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-950",
                  )}
                >
                  {CHANNEL_LABELS[t]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <Label htmlFor="channel-contact">Контакт</Label>
            <Input
              id="channel-contact"
              value={contact}
              placeholder={placeholder}
              onChange={(e) => setContact(e.target.value)}
              className="mt-2 font-semibold"
            />
            <p className="mt-1.5 text-xs text-muted-foreground">
              Сюда будут приходить уведомления о заказах.
            </p>
          </div>

          <div>
            <Label>Тестовое превью уведомления</Label>
            <div className="mt-2 rounded-2xl border border-border bg-zinc-50 p-4">
              <div className="mb-2 flex items-center gap-2 text-xs font-bold text-zinc-500">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {CHANNEL_LABELS[type]} · {contact.trim() || placeholder}
              </div>
              <div className="rounded-xl bg-white p-3 shadow-sm">{meta.preview}</div>
            </div>
          </div>
        </div>

        <div className="border-t border-border px-6 py-4">
          <Button
            type="button"
            className="w-full font-bold"
            disabled={!canSave}
            onClick={() => onSave({ type, contact: contact.trim() })}
          >
            Сохранить
          </Button>
          {route && (
            <button
              type="button"
              onClick={onClear}
              className="mt-3 w-full text-center text-sm font-semibold text-red-500 transition hover:text-red-600"
            >
              Убрать канал
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function OrderChannel({
  label,
  routeText,
  warningTitle,
  warningDesc,
  onConfigure,
}: {
  label: string;
  routeText: string | null;
  warningTitle: string;
  warningDesc: string;
  onConfigure: () => void;
}) {
  if (!routeText) {
    return (
      <div className="rounded-2xl border border-amber-300 bg-amber-50 p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle size={18} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <div className="font-black text-amber-900">{warningTitle}</div>
            <p className="mt-1 text-sm leading-5 text-amber-800">{warningDesc}</p>
          </div>
        </div>
        <Button type="button" size="sm" className="mt-3 font-bold" onClick={onConfigure}>
          Настроить
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border p-4">
      <div className="text-xs font-black uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 flex items-center justify-between gap-3">
        <div className="font-semibold text-zinc-950">{routeText}</div>
        <Button type="button" variant="outline" size="sm" className="font-bold" onClick={onConfigure}>
          Изменить
        </Button>
      </div>
    </div>
  );
}

function MethodSection({
  title,
  description,
  enabled,
  onToggle,
  address,
  comment,
  routeText,
  onConfigure,
}: {
  title: string;
  description: string;
  enabled: boolean;
  onToggle: (enabled: boolean) => void;
  address?: string;
  comment: ReactNode;
  routeText: string | null;
  onConfigure: () => void;
}) {
  return (
    <SectionCard>
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-xl font-black">{title}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{description}</p>
        </div>
        <Switch checked={enabled} onCheckedChange={onToggle} className="mt-1 shrink-0" />
      </div>

      {!enabled ? (
        <div className="mt-5 rounded-2xl border border-dashed border-border bg-zinc-50 px-4 py-3 text-sm text-muted-foreground">
          Включите способ, чтобы гости могли оформлять заказы.
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          {address && (
            <div className="rounded-2xl border border-border bg-zinc-50 px-4 py-3">
              <div className="text-xs font-semibold text-muted-foreground">Адрес получения</div>
              <div className="mt-1 text-base font-semibold text-zinc-900">{address}</div>
            </div>
          )}
          {comment}
          <OrderChannel
            label="Куда приходят заказы"
            routeText={routeText}
            warningTitle="Заказы не будут приниматься"
            warningDesc="Укажите канал получения заказов."
            onConfigure={onConfigure}
          />
        </div>
      )}
    </SectionCard>
  );
}

export function DeliveryWorkspace({ setPreviewScenario }: DeliveryWorkspaceProps) {
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
  const { routes, setRoute, formatRoute } = useOrderRouting();
  const { registerChange } = usePublish();
  const mark = () => registerChange("order-settings");

  const [drawerEvent, setDrawerEvent] = useState<OrderEvent | null>(null);

  const focusDelivery = () => setPreviewScenario("delivery");
  const focusPickup = () => setPreviewScenario("pickup");
  const focusServiceFee = () => setPreviewScenario("serviceFee");

  return (
    <PageScroll>
      <PageContent>
        <div onMouseEnter={focusDelivery} onFocus={focusDelivery}>
          <MethodSection
            title="Доставка"
            description="Гости смогут оформить доставку через витрину."
            enabled={deliveryEnabled}
            onToggle={(v) => {
              setDeliveryEnabled(v);
              mark();
            }}
            comment={
              <LocalizedTextArea
                label="Комментарий для гостя"
                initialTranslations={{
                  ru: "Курьер свяжется с вами после подтверждения заказа.",
                }}
                onEffectiveValueChange={setDeliveryComment}
              />
            }
            routeText={formatRoute("delivery")}
            onConfigure={() => setDrawerEvent("delivery")}
          />
        </div>

        <div onMouseEnter={focusPickup} onFocus={focusPickup}>
          <MethodSection
            title="Самовывоз"
            description="Гости смогут забрать заказ самостоятельно."
            enabled={pickupEnabled}
            onToggle={(v) => {
              setPickupEnabled(v);
              mark();
            }}
            address={pickupAddress}
            comment={
              <LocalizedTextArea
                label="Комментарий для гостя"
                initialTranslations={{ ru: "Заказ будет готов через 20 минут." }}
                onEffectiveValueChange={setPickupComment}
              />
            }
            routeText={formatRoute("pickup")}
            onConfigure={() => setDrawerEvent("pickup")}
          />
        </div>

        <div onMouseEnter={focusServiceFee} onFocus={focusServiceFee}>
          <SectionCard>
            <h2 className="text-xl font-black">Оформление заказа</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Дополнительные условия, которые гость видит перед подтверждением заказа.
            </p>

            <div className="my-5 border-t border-border" />

            <div className="flex items-center justify-between rounded-2xl border border-border p-4">
              <div className="font-black">Сервисный сбор</div>
              <Switch
                checked={serviceFeeEnabled}
                onCheckedChange={(v) => {
                  setServiceFeeEnabled(v);
                  mark();
                }}
              />
            </div>

            <div
              className={cn(
                "mt-4 rounded-2xl border border-border bg-zinc-50 px-4 py-3",
                !serviceFeeEnabled && "opacity-50",
              )}
            >
              <Label htmlFor="service-fee-percent">Размер сбора</Label>
              <div className="mt-2 flex items-center gap-2">
                <Input
                  id="service-fee-percent"
                  type="number"
                  min={0}
                  max={100}
                  className="w-20 font-semibold"
                  value={serviceFeePercent}
                  disabled={!serviceFeeEnabled}
                  onChange={(e) => setServiceFeePercent(Number(e.target.value) || 0)}
                />
                <span className="text-lg font-black text-zinc-500">%</span>
              </div>
            </div>

            <div className="my-5 border-t border-border" />

            <div className="flex items-center justify-between rounded-2xl border border-border p-4">
              <div>
                <div className="font-black">Требовать согласие гостя</div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Гость должен подтвердить согласие с сервисным сбором перед продолжением.
                </p>
              </div>
              <Switch
                checked={serviceFeeRequireConsent}
                onCheckedChange={(v) => {
                  setServiceFeeRequireConsent(v);
                  mark();
                }}
                disabled={!serviceFeeEnabled}
              />
            </div>
          </SectionCard>
        </div>

        {/* Вызов официанта */}
        <SectionCard>
          <h2 className="text-xl font-black">Вызов официанта</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Гость может позвать официанта прямо из витрины.
          </p>
          <div className="mt-5">
            <OrderChannel
              label="Куда отправлять вызовы"
              routeText={formatRoute("waiter")}
              warningTitle="Вызовы не будут приходить"
              warningDesc="Укажите канал для вызовов официанта."
              onConfigure={() => setDrawerEvent("waiter")}
            />
          </div>
        </SectionCard>
      </PageContent>

      {drawerEvent && (
        <ChannelDrawer
          key={drawerEvent}
          event={drawerEvent}
          route={routes[drawerEvent]}
          onClose={() => setDrawerEvent(null)}
          onSave={(channel) => {
            setRoute(drawerEvent, channel);
            mark();
            setDrawerEvent(null);
          }}
          onClear={() => {
            setRoute(drawerEvent, null);
            mark();
            setDrawerEvent(null);
          }}
        />
      )}
    </PageScroll>
  );
}
