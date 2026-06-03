import type { LucideIcon } from "lucide-react";
import {
  BarChart3,
  Building2,
  ClipboardList,
  FileSearch,
  Home,
  Import,
  LayoutGrid,
  Palette,
  QrCode,
  Settings,
  ShoppingBag,
  Sparkles,
  Truck,
  User,
} from "lucide-react";

export type SectionId = "analytics" | "storefront" | "qr" | "management" | "am";

export type UserRole = "owner" | "am";
export type StoreTabId = "home" | "catalog" | "upsell" | "appearance" | "about";
export type ManageTabId = "order-settings" | "order-history" | "billing" | "account" | "io" | "seo";
export type AnalyticsTabId = "scans" | "orders" | "likes";
export type PreviewScenario =
  | "about"
  | "delivery"
  | "pickup"
  | "age"
  | "serviceFee"
  | "seoLink"
  | null;

/** Где гость видит блок рекомендаций (для превью на странице «Рекомендации»). */
export type UpsellSurface = "home" | "dish" | "cart";

export type RecommendationTexts = {
  home: string;
  dish: string;
  cart: string;
};

export const DEFAULT_RECOMMENDATION_TEXTS: RecommendationTexts = {
  home: "А это вы пробовали?",
  dish: "С этим блюдом часто берут",
  cart: "Возьмите ещё это 🔥",
};

export type PlanId = "Zero" | "Lite" | "Ultra";

export const RESTAURANT_NAME = "Kimchi Astana";
export const CURRENT_PLAN: PlanId = "Zero";
export const STOREFRONT_URL = "kimchi.tasko.app";

/** Лимит блюд и текущее использование для тарифа Zero. */
export const ZERO_DISH_LIMIT = 100;
export const ZERO_DISH_USED = 87;
/** Демо-роль текущего пользователя. Иконка AM в rail показывается только при "am". */
export const CURRENT_ROLE: UserRole = "am";

export const notificationChannel = {
  label: "Telegram",
  phone: "+7 (777) 123-45-67",
  formatted: "Telegram · +7 (777) 123-45-67",
  hint: "Используется для заказов и событий витрины",
};

export const storeTabs: { id: StoreTabId; label: string; icon: LucideIcon }[] = [
  { id: "catalog", label: "Каталог", icon: LayoutGrid },
  { id: "home", label: "Главная", icon: Home },
  { id: "upsell", label: "Рекомендации", icon: Sparkles },
  { id: "appearance", label: "Оформление", icon: Palette },
  { id: "about", label: "О заведении", icon: Building2 },
];

export const manageTabs: { id: ManageTabId; label: string; icon: LucideIcon }[] = [
  { id: "order-history", label: "История заказов", icon: ClipboardList },
  { id: "order-settings", label: "Настройка заказов", icon: Truck },
  { id: "billing", label: "Тарифы", icon: ClipboardList },
  { id: "account", label: "Аккаунт", icon: User },
  { id: "io", label: "Импорт / экспорт", icon: Import },
  { id: "seo", label: "SEO", icon: FileSearch },
];

export const railItems: { id: SectionId; label: string; icon: LucideIcon }[] = [
  { id: "analytics", label: "Аналитика", icon: BarChart3 },
  { id: "storefront", label: "Витрина", icon: ShoppingBag },
  { id: "qr", label: "QR", icon: QrCode },
  { id: "management", label: "Управление", icon: Settings },
];

export type Category = {
  id: string;
  name: string;
  emoji: string;
  photo: string;
};

export type Dish = {
  id: string;
  name: string;
  category: string;
  price: string;
  weight: string;
  description: string;
  accent: string;
  emoji: string;
  recommendations: string[];
  stop: boolean;
};

export type Banner = {
  id: string;
  title: string;
  subtitle: string;
  tags: string[];
  accent: string;
  visible: boolean;
  link: string;
};

export const categories: Category[] = [
  { id: "pizza", name: "Пицца", emoji: "🍕", photo: "from-orange-100 to-red-100" },
  { id: "drinks", name: "Напитки", emoji: "🥤", photo: "from-cyan-100 to-blue-100" },
  { id: "sauces", name: "Соусы", emoji: "🧄", photo: "from-stone-100 to-amber-50" },
  { id: "desserts", name: "Десерты", emoji: "🍰", photo: "from-pink-100 to-orange-50" },
  { id: "burgers", name: "Бургеры", emoji: "🍔", photo: "from-yellow-100 to-orange-100" },
];

export const dishes: Dish[] = [
  {
    id: "pepperoni",
    name: "Пепперони Фреш",
    category: "Пицца",
    price: "4 500 ₸",
    weight: "440 г",
    description: "Острая пепперони, моцарелла и томатный соус.",
    accent: "from-orange-100 to-red-100",
    emoji: "🍕",
    recommendations: ["cola", "garlic"],
    stop: false,
  },
  {
    id: "margarita",
    name: "Пицца Маргарита",
    category: "Пицца",
    price: "3 900 ₸",
    weight: "420 г",
    description: "Томаты, базилик и нежная моцарелла.",
    accent: "from-emerald-100 to-red-100",
    emoji: "🍕",
    recommendations: ["cola"],
    stop: false,
  },
  {
    id: "quattro",
    name: "Четыре сыра",
    category: "Пицца",
    price: "4 200 ₸",
    weight: "410 г",
    description: "Моцарелла, дорблю, пармезан и сливочный соус.",
    accent: "from-yellow-50 to-amber-100",
    emoji: "🧀",
    recommendations: [],
    stop: false,
  },
  {
    id: "cola",
    name: "Кола 0.5л",
    category: "Напитки",
    price: "850 ₸",
    weight: "500 мл",
    description: "Холодный напиток к горячим блюдам.",
    accent: "from-red-100 to-zinc-100",
    emoji: "🥤",
    recommendations: [],
    stop: false,
  },
  {
    id: "orange",
    name: "Апельсиновый сок",
    category: "Напитки",
    price: "1 100 ₸",
    weight: "300 мл",
    description: "Свежевыжатый апельсиновый сок.",
    accent: "from-orange-100 to-yellow-100",
    emoji: "🍊",
    recommendations: [],
    stop: true,
  },
  {
    id: "garlic",
    name: "Чесночный соус",
    category: "Соусы",
    price: "350 ₸",
    weight: "50 г",
    description: "Нежный соус с чесноком и зеленью.",
    accent: "from-stone-100 to-yellow-50",
    emoji: "🧄",
    recommendations: [],
    stop: false,
  },
  {
    id: "tiramisu",
    name: "Тирамису",
    category: "Десерты",
    price: "1 600 ₸",
    weight: "120 г",
    description: "Итальянский десерт с маскарпоне и кофе.",
    accent: "from-stone-100 to-orange-50",
    emoji: "🍰",
    recommendations: [],
    stop: false,
  },
];

export const banners: Banner[] = [
  {
    id: "hero-1",
    title: "Шеф рекомендует",
    subtitle: "Рибай Wagyu MB9+ на углях",
    tags: ["Signature", "Блюдо недели"],
    accent: "from-zinc-950 via-stone-800 to-amber-800",
    visible: true,
    link: "",
  },
  {
    id: "hero-2",
    title: "Комбо на двоих",
    subtitle: "Пицца + напитки со скидкой",
    tags: ["Комбо", "Хит"],
    accent: "from-rose-700 via-orange-500 to-yellow-400",
    visible: true,
    link: "/promo/combo",
  },
  {
    id: "hero-3",
    title: "Новинки недели",
    subtitle: "Попробуйте сезонные позиции",
    tags: ["Новинка"],
    accent: "from-emerald-800 via-teal-500 to-cyan-400",
    visible: false,
    link: "",
  },
];

export const featuredCategoryIds = ["pizza", "drinks", "desserts", "burgers"];
export const promotedDishIds = ["pepperoni", "cola", "tiramisu"];

export const notificationEvents = [
  { id: "new-order", label: "Новый заказ" },
  { id: "delivery", label: "Доставка" },
  { id: "pickup", label: "Самовывоз" },
  { id: "waiter", label: "Вызов официанта" },
  { id: "cancel", label: "Отмена заказа" },
] as const;

export const managementStubCopy: Record<
  Exclude<ManageTabId, "order-settings" | "order-history">,
  { title: string; description: string; bullets: string[] }
> = {
  billing: {
    title: "Тарифы",
    description: "Текущий план, лимиты и оплата подписки TASKO.",
    bullets: ["План Pro", "До 3 заведений", "Следующее списание 1 июня"],
  },
  account: {
    title: "Аккаунт",
    description: "Профиль владельца и доступы команды.",
    bullets: ["Владелец: Айгерим", "Роль: Администратор", "2 активных пользователя"],
  },
  io: {
    title: "Импорт / экспорт",
    description: "Массовая загрузка меню и выгрузка данных.",
    bullets: ["Импорт из Excel", "Экспорт меню", "История загрузок"],
  },
  seo: {
    title: "SEO",
    description: "Мета-данные витрины для поисковых систем.",
    bullets: ["Title и description", "Open Graph", "Индексация витрины"],
  },
};

export function getDish(id: string) {
  return dishes.find((d) => d.id === id) ?? dishes[0];
}

export function getRecommendedDishes(dish: Dish) {
  return dish.recommendations
    .map((rid) => dishes.find((d) => d.id === rid))
    .filter((d): d is Dish => Boolean(d));
}
