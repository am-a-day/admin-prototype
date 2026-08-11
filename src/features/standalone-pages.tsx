import { PageContent, PageScroll } from "@/components/workspace/page-layout";
import { EmptyState, SectionCard } from "@/components/workspace/section-card";
import type { AnalyticsTabId } from "@/data/mock-data";

// ── Analytics ─────────────────────────────────────────────────────────────────

const ANALYTICS_TABS: Record<AnalyticsTabId, { title: string; description: string; icon: string }> = {
  scans: {
    title: "Сканирования",
    description: "Количество сканирований QR-кода и переходов на витрину.",
    icon: "📱",
  },
  orders: {
    title: "Заказы",
    description: "Количество заказов, выручка, средний чек и динамика по времени.",
    icon: "📊",
  },
  likes: {
    title: "Лайки",
    description: "Лайки гостей по блюдам и разделам меню.",
    icon: "❤️",
  },
};

export function AnalyticsPage({ tab }: { tab: AnalyticsTabId }) {
  const meta = ANALYTICS_TABS[tab];
  return (
    <PageScroll>
      <PageContent>
        <EmptyState
          icon={meta.icon}
          title="Раздел в разработке"
          description="В прототипе проверяем навигацию и витрину. Аналитика без превью гостя."
        />
      </PageContent>
    </PageScroll>
  );
}

// ── Order History ─────────────────────────────────────────────────────────────

const MOCK_ORDERS = [
  { id: 30, type: "Доставка", total: "6 350 ₸", time: "Сегодня, 14:22", status: "Новый" },
  { id: 29, type: "Самовывоз", total: "4 500 ₸", time: "Сегодня, 12:05", status: "Выполнен" },
  { id: 28, type: "Доставка", total: "8 900 ₸", time: "Вчера, 19:44", status: "Выполнен" },
  { id: 27, type: "Самовывоз", total: "3 200 ₸", time: "Вчера, 18:10", status: "Выполнен" },
  { id: 26, type: "Доставка", total: "5 700 ₸", time: "Вчера, 13:30", status: "Отменён" },
  { id: 25, type: "Самовывоз", total: "4 100 ₸", time: "01.06.2026, 20:15", status: "Выполнен" },
  { id: 24, type: "Доставка", total: "7 450 ₸", time: "01.06.2026, 17:55", status: "Выполнен" },
  { id: 23, type: "Самовывоз", total: "2 900 ₸", time: "01.06.2026, 11:00", status: "Выполнен" },
];

const STATUS_STYLES: Record<string, string> = {
  Новый: "bg-blue-50 text-blue-700",
  Выполнен: "bg-emerald-50 text-emerald-700",
  Отменён: "bg-zinc-100 text-zinc-500",
};

export function OrderHistoryPage() {
  return (
    <PageScroll>
      <PageContent>
        <SectionCard>
          <div className="divide-y divide-border">
            {MOCK_ORDERS.map((order) => (
              <div
                key={order.id}
                className="flex items-center justify-between gap-4 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-sm font-bold text-zinc-800 shrink-0">
                    Заказ #{order.id}
                  </span>
                  <span className="text-sm text-zinc-500 truncate">{order.type}</span>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <span className="text-sm text-zinc-400">{order.time}</span>
                  <span className="text-sm font-semibold text-zinc-800">{order.total}</span>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${STATUS_STYLES[order.status] ?? ""}`}
                  >
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </SectionCard>
      </PageContent>
    </PageScroll>
  );
}

export function QRPage({
  mode = "qr",
  createRequestId,
  onCreateHandled,
}: {
  mode?: "qr" | "promo";
  createRequestId?: number | null;
  onCreateHandled?: () => void;
}) {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [created, setCreated] = useState<string[]>([]);
  const handledRef = useRef<number | null>(null);

  useEffect(() => {
    if (!createRequestId || handledRef.current === createRequestId) return;
    handledRef.current = createRequestId;
    setDialogOpen(true);
    onCreateHandled?.();
  }, [createRequestId, onCreateHandled]);

  const isPromo = mode === "promo";
  const title = isPromo ? "Промокоды" : "QR-коды";
  const createLabel = isPromo ? "Создать промокод" : "Создать QR-код";
  const finishCreate = () => {
    const value = name.trim();
    if (!value) return;
    setCreated((items) => [...items, value]);
    setName("");
    setDialogOpen(false);
  };

  return (
    <PageScroll>
      <PageContent>
        <SectionCard>
          <div className="flex items-start justify-between gap-4 p-5">
            <div>
              <h1 className="text-[18px] font-semibold text-zinc-950">{title}</h1>
              <p className="mt-1 text-[13px] text-zinc-500">{isPromo ? "Создавайте скидки для гостей и отслеживайте их использование." : "Создавайте коды для столов, печати и быстрых переходов на витрину."}</p>
            </div>
            <button type="button" onClick={() => setDialogOpen(true)} className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-[10px] bg-[#4f39f6] px-3.5 text-[13px] font-medium text-white hover:bg-[#4030d4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]/25"><Plus size={15} />{createLabel}</button>
          </div>
          <div className="border-t border-zinc-100 p-5">
            {created.length === 0 ? (
              <div className="rounded-xl border border-dashed border-zinc-200 py-12 text-center text-[13px] text-zinc-500">{isPromo ? "Промокодов пока нет" : "QR-кодов пока нет"}</div>
            ) : (
              <div className="divide-y divide-zinc-100 rounded-xl border border-zinc-200">
                {created.map((item) => <div key={item} className="flex items-center gap-3 px-4 py-3 text-[13px] font-medium text-zinc-800">{isPromo ? <Tag size={15} /> : <QrCode size={15} />}<span>{item}</span><span className="ml-auto rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] text-emerald-700">Активен</span></div>)}
              </div>
            )}
          </div>
        </SectionCard>
      </PageContent>
      {dialogOpen && (
        <div className="fixed inset-0 z-[320] grid place-items-center bg-black/30 px-4" role="dialog" aria-modal="true" aria-labelledby="quick-tool-dialog-title" onMouseDown={(event) => { if (event.target === event.currentTarget) setDialogOpen(false); }}>
          <div className="w-full max-w-[400px] rounded-[16px] bg-white p-5 shadow-2xl" onKeyDown={(event) => { if (event.key === "Escape") setDialogOpen(false); }}>
            <div className="flex items-center justify-between"><h2 id="quick-tool-dialog-title" className="text-[16px] font-semibold text-zinc-950">{createLabel}</h2><button type="button" onClick={() => setDialogOpen(false)} aria-label="Закрыть" className="grid h-7 w-7 place-items-center rounded-lg hover:bg-zinc-100"><X size={14} /></button></div>
            <label htmlFor="quick-tool-name" className="mt-5 block text-[12px] font-medium text-zinc-700">{isPromo ? "Код промокода" : "Название или номер стола"}</label>
            <input id="quick-tool-name" autoFocus value={name} onChange={(event) => setName(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") finishCreate(); }} placeholder={isPromo ? "Например, WELCOME10" : "Например, Стол 12"} className="mt-1.5 h-10 w-full rounded-[9px] border border-zinc-200 px-3 text-[13px] outline-none focus:border-[#4f39f6] focus:ring-2 focus:ring-[#4f39f6]/10" />
            {isPromo && <p className="mt-2 text-[11px] text-zinc-400">Размер скидки и условия можно настроить после создания.</p>}
            <div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setDialogOpen(false)} className="h-8 px-3 text-[12px] text-zinc-600">Отмена</button><button type="button" onClick={finishCreate} disabled={!name.trim()} className="h-8 rounded-[8px] bg-[#292524] px-3 text-[12px] font-medium text-white disabled:bg-zinc-300">Создать</button></div>
          </div>
        </div>
      )}
    </PageScroll>
  );
}
import { useEffect, useRef, useState } from "react";
import { Plus, QrCode, Tag, X } from "lucide-react";
