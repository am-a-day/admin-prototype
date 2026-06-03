import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  ClipboardList,
  Ellipsis,
  LayoutGrid,
  Rocket,
} from "lucide-react";
import type { SectionId } from "@/data/mock-data";

export type WorkAreaId = "launch" | "vitrine" | "orders" | "analytics" | "tools";

export type SubPage = {
  label: string;
  section: SectionId;
  tab: string;
  soon?: boolean;
};

export type WorkArea = {
  id: WorkAreaId;
  label: string;
  tooltip: string;
  icon: LucideIcon;
  pages: SubPage[];
};

export const WORK_AREAS: WorkArea[] = [
  {
    id: "launch",
    label: "Запуск",
    tooltip: "Запуск витрины",
    icon: Rocket,
    pages: [{ label: "Запуск витрины", section: "storefront", tab: "launch" }],
  },
  {
    id: "vitrine",
    label: "Витрина",
    tooltip: "Витрина",
    icon: LayoutGrid,
    pages: [
      { label: "Главная", section: "storefront", tab: "home" },
      { label: "Каталог", section: "storefront", tab: "catalog" },
      { label: "Рекомендации", section: "storefront", tab: "upsell" },
      { label: "Оформление", section: "storefront", tab: "appearance" },
      { label: "О заведении", section: "storefront", tab: "about" },
    ],
  },
  {
    id: "orders",
    label: "Заказы",
    tooltip: "Заказы",
    icon: ClipboardList,
    pages: [
      { label: "История заказов", section: "management", tab: "order-history" },
      { label: "Настройка заказов", section: "management", tab: "order-settings" },
    ],
  },
  {
    id: "analytics",
    label: "Аналитика",
    tooltip: "Аналитика",
    icon: BarChart3,
    pages: [
      { label: "Сканирования", section: "analytics", tab: "scans" },
      { label: "Продажи", section: "analytics", tab: "orders" },
      { label: "Лайки", section: "analytics", tab: "likes" },
    ],
  },
  {
    id: "tools",
    label: "Ещё",
    tooltip: "Ещё",
    icon: Ellipsis,
    pages: [
      { label: "QR-коды", section: "qr", tab: "qr" },
      { label: "Промокоды", section: "management", tab: "promo", soon: true },
      { label: "SEO", section: "management", tab: "seo" },
      { label: "Импорт / экспорт", section: "management", tab: "io" },
    ],
  },
];

export function getActiveArea(section: SectionId, tab: string | null): WorkAreaId {
  if (section === "storefront") return tab === "launch" ? "launch" : "vitrine";
  if (section === "analytics") return "analytics";
  if (section === "qr") return "tools";
  if (section === "management") {
    if (tab === "order-history" || tab === "order-settings") return "orders";
    return "tools"; // seo, io, billing, account — system pages
  }
  return "vitrine";
}

export function getWorkArea(id: WorkAreaId): WorkArea {
  return WORK_AREAS.find((a) => a.id === id) ?? WORK_AREAS[1];
}
