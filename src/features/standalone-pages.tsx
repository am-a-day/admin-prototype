import { PageTitle } from "@/components/workspace/page-title";
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
    <main className="min-w-0 flex-1 overflow-y-auto bg-white p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageTitle title={meta.title} description={meta.description} />
        <EmptyState
          icon={meta.icon}
          title="Раздел в разработке"
          description="В прототипе проверяем навигацию и витрину. Аналитика без превью гостя."
        />
      </div>
    </main>
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
    <main className="min-w-0 flex-1 overflow-y-auto bg-white p-8">
      <div className="mx-auto max-w-4xl space-y-6">
        <PageTitle
          title="История заказов"
          description="Все входящие заказы — доставка и самовывоз."
        />
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
      </div>
    </main>
  );
}

export function QRPage() {
  return (
    <main className="min-w-0 flex-1 overflow-y-auto bg-white p-8">
      <div className="mx-auto max-w-4xl">
        <PageTitle
          title="QR"
          description="Генерация и управление QR-кодами для столов, доставки и самовывоза."
        />
        <EmptyState
          icon="🔳"
          title="Раздел в разработке"
          description="QR-меню и столы — отдельный сценарий без mobile preview."
        />
      </div>
    </main>
  );
}
