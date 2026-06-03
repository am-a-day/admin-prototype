import {
  Bell,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Globe,
  Home,
  Info,
  LayoutGrid,
  Menu,
  Pencil,
  Search,
  ShoppingCart,
  UtensilsCrossed,
} from "lucide-react";
import {
  banners,
  categories,
  dishes,
  featuredCategoryIds,
  promotedDishIds,
  RESTAURANT_NAME,
  STOREFRONT_URL,
  type Banner,
  type Category,
  type Dish,
} from "@/data/mock-data";
import { cn } from "@/lib/utils";

/** Стиль наведения для кликабельных навигационных сущностей в превью. */
const NAV_HOVER = "cursor-pointer transition hover:ring-2 hover:ring-blue-400/60";

function MiniDishCard({ dish }: { dish: Dish }) {
  return (
    <div className="w-28 shrink-0 rounded-2xl bg-zinc-50 p-2">
      <div
        className={cn(
          "mb-2 flex h-20 items-center justify-center rounded-xl bg-gradient-to-br text-3xl",
          dish.accent,
        )}
      >
        {dish.emoji}
      </div>
      <div className="line-clamp-2 text-xs font-black leading-tight">{dish.name}</div>
      <div className="mt-1 text-xs text-zinc-500">{dish.price}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-3">
      <div className="text-[10px] font-black uppercase tracking-wide text-zinc-400">{label}</div>
      <div className="mt-1 font-semibold text-zinc-800">{value}</div>
    </div>
  );
}

export function PhoneHome({
  banner,
  theme,
  onBanner,
  onSections,
  onRecommendations,
  onAbout,
}: {
  banner: Banner;
  theme?: boolean;
  onBanner?: () => void;
  onSections?: () => void;
  onRecommendations?: () => void;
  onAbout?: () => void;
}) {
  const hidden = banner.visible === false;
  return (
    <div className={cn("pb-6", theme ? "bg-amber-50" : "bg-white")}>
      {hidden ? (
        <div className="flex h-56 flex-col items-center justify-center gap-2 bg-zinc-100 px-6 text-center">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white text-zinc-400">
            <EyeOff size={16} />
          </div>
          <div className="text-sm font-bold text-zinc-500">Баннер скрыт с витрины</div>
          <p className="text-xs leading-4 text-zinc-400">Гость не увидит этот баннер на главной</p>
        </div>
      ) : (
        <div className={cn("relative h-56 bg-gradient-to-br p-4 text-white", banner.accent)}>
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 mt-5 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 rounded-2xl bg-white/20 p-2 backdrop-blur">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-center text-xs font-black leading-8 text-zinc-950">
                K
              </div>
              <div className="text-sm font-bold">Kimchi</div>
            </div>
            {onAbout ? (
              <button
                type="button"
                onClick={onAbout}
                className="flex items-center gap-1 rounded-full bg-white/25 px-3 py-2 text-xs font-bold backdrop-blur transition hover:bg-white/40"
              >
                <Info size={13} />О нас
              </button>
            ) : (
              <button type="button" className="rounded-full bg-white/20 p-2">
                <Menu size={14} />
              </button>
            )}
          </div>
          <div
            role={onBanner ? "button" : undefined}
            onClick={onBanner}
            className={cn(
              "relative z-10 mt-12 rounded-2xl p-2",
              onBanner && NAV_HOVER,
            )}
          >
            <div className="mb-2 flex flex-wrap gap-1">
              {banner.tags.map((tag) => (
                <span key={tag} className="rounded-full bg-white px-2 py-1 text-[10px] font-black text-zinc-950">
                  {tag}
                </span>
              ))}
            </div>
            <h2 className="text-lg font-black leading-tight">{banner.subtitle}</h2>
          </div>
        </div>
      )}
      <div className="-mt-5 rounded-t-[28px] bg-white px-4 pt-4">
        <div className="mb-4 flex h-11 items-center rounded-2xl bg-zinc-100 px-3 text-sm text-zinc-400">
          <Search size={17} className="mr-2" />
          Поиск по меню...
        </div>
        <div className="mb-3 text-xs font-black uppercase tracking-wide text-zinc-500">Разделы</div>
        <div className="grid grid-cols-2 gap-3">
          {featuredCategoryIds.slice(0, 4).map((id) => {
            const c = categories.find((cat) => cat.id === id)!;
            return (
              <div
                key={id}
                role={onSections ? "button" : undefined}
                onClick={onSections}
                className={cn("rounded-2xl bg-zinc-50 p-2", onSections && NAV_HOVER)}
              >
                <div
                  className={cn(
                    "mb-2 flex h-20 items-center justify-center rounded-xl bg-gradient-to-br text-3xl",
                    c.photo,
                  )}
                >
                  {c.emoji}
                </div>
                <div className="text-xs font-bold">{c.name}</div>
              </div>
            );
          })}
        </div>
        <div
          role={onRecommendations ? "button" : undefined}
          onClick={onRecommendations}
          className={cn(
            "mb-3 mt-6 inline-flex items-center gap-1 rounded-lg text-xs font-black uppercase tracking-wide text-zinc-500",
            onRecommendations && "cursor-pointer transition hover:text-blue-600",
          )}
        >
          Попробуйте
          {onRecommendations && <ChevronRight size={13} />}
        </div>
        <div className="flex gap-3 overflow-hidden">
          {promotedDishIds.map((id) => (
            <MiniDishCard key={id} dish={dishes.find((d) => d.id === id)!} />
          ))}
        </div>
      </div>
    </div>
  );
}

export function PhoneCatalog({
  selectedDishId,
  themed,
}: {
  selectedDishId: string;
  themed?: boolean;
}) {
  const selected = dishes.find((d) => d.id === selectedDishId);
  return (
    <div className={cn("p-4 pt-10", themed && "bg-amber-50")}>
      <div className="mb-4 text-xl font-black">Меню</div>
      <div className="mb-4 flex h-11 items-center rounded-2xl bg-zinc-100 px-3 text-sm text-zinc-400">
        <Search size={17} className="mr-2" />
        Найти блюдо
      </div>
      <div className="grid grid-cols-2 gap-3">
        {dishes.slice(0, 6).map((dish) => (
          <div
            key={dish.id}
            className={cn(
              dish.id === selected?.id ? "rounded-[20px] ring-2 ring-blue-500 ring-offset-2" : "",
            )}
          >
            <MiniDishCard dish={dish} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function PhoneDish({
  dish,
  recommended,
  title = "С этим блюдом часто берут",
  highlight = false,
}: {
  dish: Dish;
  recommended: Dish[];
  title?: string;
  highlight?: boolean;
}) {
  return (
    <div className="pb-6">
      <div className={cn("flex h-64 items-center justify-center bg-gradient-to-br text-8xl", dish.accent)}>
        {dish.emoji}
      </div>
      <div className="rounded-t-[28px] bg-white px-5 pt-5">
        <h2 className="text-xl font-black leading-tight">{dish.name}</h2>
        <p className="mt-2 text-sm leading-5 text-zinc-500">{dish.description}</p>
        <div className="mt-5 flex items-center justify-between">
          <div className="text-xl font-black">{dish.price}</div>
          <button type="button" className="rounded-full bg-zinc-950 px-4 py-2 text-xs font-black text-white">
            В корзину
          </button>
        </div>
        {recommended.length > 0 && (
          <section
            className={cn(
              "mt-8 rounded-2xl p-3 transition",
              highlight ? "bg-blue-50/60 ring-2 ring-blue-400/60" : "-mx-3",
            )}
          >
            <div className="mb-3 text-xs font-black uppercase tracking-wide text-zinc-500">
              {title}
            </div>
            <div className="flex gap-3 overflow-hidden">
              {recommended.map((item) => (
                <MiniDishCard key={item.id} dish={item} />
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

export function PhoneUpsellHome({
  title,
  recommended,
  highlight = false,
}: {
  title: string;
  recommended: Dish[];
  highlight?: boolean;
}) {
  return (
    <div className="pb-6">
      <div className="relative h-44 bg-gradient-to-br from-zinc-950 via-stone-800 to-amber-800 p-4 text-white">
        <div className="absolute inset-0 bg-black/20" />
        <div className="relative z-10 mt-5 flex items-center justify-between rounded-2xl bg-white/20 p-2 backdrop-blur">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-white text-center text-xs font-black leading-8 text-zinc-950">
              K
            </div>
            <div className="text-sm font-bold">Kimchi</div>
          </div>
          <button type="button" className="rounded-full bg-white/20 p-2">
            <Menu size={14} />
          </button>
        </div>
        <div className="relative z-10 mt-10">
          <h2 className="text-lg font-black leading-tight">Рибай Wagyu MB9+ на углях</h2>
        </div>
      </div>
      <div className="-mt-5 rounded-t-[28px] bg-white px-4 pt-4">
        <div className="mb-4 flex h-11 items-center rounded-2xl bg-zinc-100 px-3 text-sm text-zinc-400">
          <Search size={17} className="mr-2" />
          Поиск по меню...
        </div>
        <section
          className={cn(
            "rounded-2xl p-3 transition",
            highlight ? "bg-blue-50/70 ring-2 ring-blue-400/60" : "bg-amber-50/70",
          )}
        >
          <div
            className={cn(
              "mb-3 text-xs font-black uppercase tracking-wide",
              highlight ? "text-blue-700" : "text-amber-700",
            )}
          >
            {title}
          </div>
          <div className="flex gap-3 overflow-hidden">
            {recommended.map((item) => (
              <MiniDishCard key={item.id} dish={item} />
            ))}
          </div>
        </section>
        <div className="mb-3 mt-6 text-xs font-black uppercase tracking-wide text-zinc-500">Разделы</div>
        <div className="grid grid-cols-2 gap-3">
          {featuredCategoryIds.slice(0, 2).map((id) => {
            const c = categories.find((cat) => cat.id === id)!;
            return (
              <div key={id} className="rounded-2xl bg-zinc-50 p-2">
                <div
                  className={cn(
                    "mb-2 flex h-16 items-center justify-center rounded-xl bg-gradient-to-br text-3xl",
                    c.photo,
                  )}
                >
                  {c.emoji}
                </div>
                <div className="text-xs font-bold">{c.name}</div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function PhoneCart({
  title,
  dish,
  recommended,
  highlight = false,
  onRecommendations,
}: {
  title: string;
  dish: Dish;
  recommended: Dish[];
  highlight?: boolean;
  onRecommendations?: () => void;
}) {
  return (
    <div className="p-4 pt-10">
      <h2 className="text-xl font-black">Корзина</h2>

      <div className="mt-4 flex items-center gap-3 rounded-2xl bg-zinc-50 p-3">
        <div
          className={cn(
            "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl",
            dish.accent,
          )}
        >
          {dish.emoji}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-black">{dish.name}</div>
          <div className="text-xs text-zinc-500">{dish.price}</div>
        </div>
        <div className="flex items-center gap-2 text-sm font-bold">
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-zinc-500">−</span>
          1
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-white text-zinc-500">+</span>
        </div>
      </div>

      {recommended.length > 0 && (
        <section
          className={cn(
            "mt-6 rounded-2xl border p-3 transition",
            highlight
              ? "border-blue-400/60 bg-blue-50/70 ring-2 ring-blue-400/60"
              : "border-blue-100 bg-blue-50/40",
          )}
        >
          <div
            role={onRecommendations ? "button" : undefined}
            onClick={onRecommendations}
            className={cn(
              "mb-3 inline-flex items-center gap-1 text-xs font-black uppercase tracking-wide text-blue-700",
              onRecommendations && "cursor-pointer hover:text-blue-800",
            )}
          >
            {title}
            {onRecommendations && <ChevronRight size={13} />}
          </div>
          <div className="flex gap-3 overflow-hidden">
            {recommended.map((item) => (
              <MiniDishCard key={item.id} dish={item} />
            ))}
          </div>
        </section>
      )}

      <div className="mt-6 space-y-2">
        <CheckoutLine label="Сумма" value={dish.price} />
        <CheckoutLine label="Итого" value={dish.price} />
      </div>
      <button
        type="button"
        className="mt-4 w-full rounded-2xl bg-zinc-950 py-3.5 text-sm font-black text-white"
      >
        Оформить заказ
      </button>
    </div>
  );
}

export function PhoneAboutSheet() {
  return (
    <div className="relative min-h-full bg-zinc-100 pt-10">
      <PhoneHome banner={banners[0]} />
      <div className="absolute inset-x-0 bottom-0 rounded-t-[32px] bg-white p-5 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-200" />
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-sm font-black text-white">
            K
          </div>
          <div>
            <h3 className="font-black">{RESTAURANT_NAME}</h3>
            <p className="text-xs text-zinc-500">Корейская кухня и авторские блюда</p>
          </div>
        </div>
        <div className="mt-5 space-y-3 text-sm">
          <InfoRow label="Адрес" value="пр. Кабанбай Батыра, 48" />
          <InfoRow label="График" value="Сегодня 10:00–23:00" />
          <InfoRow label="Wi‑Fi" value="Kimchi Guest" />
          <InfoRow label="Instagram" value="@kimchi.astana" />
        </div>
      </div>
    </div>
  );
}

function CheckoutLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-1 text-sm">
      <span className="shrink-0 text-zinc-700">{label}</span>
      <span className="min-w-0 flex-1 border-b border-dotted border-zinc-300" aria-hidden />
      <span className="shrink-0 font-semibold tabular-nums text-zinc-950">{value}</span>
    </div>
  );
}

export function PhoneServiceFeeConsent() {
  return (
    <div className="p-4 pt-10">
      <h2 className="text-xl font-black">Подтвердите заказ</h2>
      <div className="mt-5 space-y-3 rounded-3xl border border-border p-4 text-sm">
        <div className="flex justify-between">
          <span className="text-zinc-500">Сумма заказа</span>
          <span className="font-semibold">4 500 ₸</span>
        </div>
        <div className="flex justify-between">
          <span className="text-zinc-500">Сервисный сбор</span>
          <span className="font-semibold">450 ₸</span>
        </div>
      </div>
      <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-blue-200 bg-blue-50/50 p-4">
        <input type="checkbox" defaultChecked className="mt-0.5 h-4 w-4 rounded border-zinc-300" />
        <span className="text-sm font-semibold leading-5 text-zinc-800">
          Я согласен с сервисным сбором
        </span>
      </label>
      <button
        type="button"
        className="mt-4 w-full rounded-2xl bg-zinc-950 py-3.5 text-sm font-black text-white"
      >
        Продолжить
      </button>
    </div>
  );
}

export function PhoneCheckout({
  emphasizeServiceFee = false,
  method = "delivery",
  comment,
  pickupAddress,
}: {
  emphasizeServiceFee?: boolean;
  method?: "delivery" | "pickup";
  comment?: string;
  pickupAddress?: string;
}) {
  const isPickup = method === "pickup";
  return (
    <div className="p-4 pt-10">
      <h2 className="text-xl font-black">Оформление заказа</h2>
      {!emphasizeServiceFee && (
        <div className="mt-5 rounded-3xl bg-zinc-50 p-4">
          <div className="text-xs font-black uppercase tracking-wide text-zinc-500">Способ получения</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              className={cn(
                "rounded-2xl px-3 py-3 text-sm font-black",
                isPickup ? "bg-white text-zinc-600" : "bg-zinc-950 text-white",
              )}
            >
              Доставка
            </button>
            <button
              type="button"
              className={cn(
                "rounded-2xl px-3 py-3 text-sm font-black",
                isPickup ? "bg-zinc-950 text-white" : "bg-white text-zinc-600",
              )}
            >
              Самовывоз
            </button>
          </div>
          {isPickup && pickupAddress && (
            <div className="mt-4 rounded-2xl bg-white p-3">
              <div className="text-[10px] font-black uppercase tracking-wide text-zinc-400">
                Адрес получения
              </div>
              <div className="mt-1 text-sm font-semibold text-zinc-800">{pickupAddress}</div>
            </div>
          )}
          {comment && (
            <p className="mt-4 text-sm leading-5 text-zinc-500">{comment}</p>
          )}
        </div>
      )}
      <div
        className={cn(
          "mt-5 rounded-3xl border p-4",
          emphasizeServiceFee ? "border-blue-500 bg-blue-50/30 ring-2 ring-blue-500/20" : "border-border",
        )}
      >
        <div className="mb-3 text-sm font-black">Ваш заказ</div>
        <div className="space-y-2">
          <CheckoutLine label="Блюда" value="4 500 ₸" />
          <CheckoutLine label="Сервисный сбор" value="450 ₸" />
        </div>
        <div className="mt-4">
          <CheckoutLine label="Итого" value="4 950 ₸" />
        </div>
      </div>
    </div>
  );
}

export function PhoneAgeGate() {
  return (
    <div className="relative flex h-full min-h-[600px] flex-col bg-gradient-to-br from-zinc-100 to-zinc-200 pt-14">
      <div className="mx-4 flex flex-1 flex-col justify-end rounded-t-[28px] bg-white p-5 shadow-2xl">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-lg font-black text-amber-900">
          18+
        </div>
        <h2 className="text-xl font-black text-zinc-950">Подтвердите возраст</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Витрина содержит позиции с возрастным ограничением
        </p>
        <button
          type="button"
          className="mt-6 w-full rounded-2xl bg-zinc-950 py-3.5 text-sm font-black text-white"
        >
          Мне есть 18 лет
        </button>
        <button
          type="button"
          className="mt-2 w-full rounded-2xl border border-border bg-white py-3.5 text-sm font-black text-zinc-600"
        >
          Покинуть витрину
        </button>
      </div>
    </div>
  );
}

// ── Навигация по витрине в превью (UX-эксперимент) ──────────────────────────

export type PreviewTab = "home" | "sections" | "menu" | "waiter" | "cart";

const PHONE_NAV: { key: PreviewTab; label: string; Icon: typeof Home }[] = [
  { key: "home", label: "Главная", Icon: Home },
  { key: "sections", label: "Разделы", Icon: LayoutGrid },
  { key: "menu", label: "Меню", Icon: UtensilsCrossed },
  { key: "waiter", label: "Официант", Icon: Bell },
  { key: "cart", label: "Корзина", Icon: ShoppingCart },
];

export function PhoneBottomNav({
  active,
  onSelect,
}: {
  active: PreviewTab;
  onSelect: (tab: PreviewTab) => void;
}) {
  return (
    <div className="flex shrink-0 items-stretch border-t border-zinc-200 bg-white/95 backdrop-blur">
      {PHONE_NAV.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onSelect(key)}
          className={cn(
            "flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 transition",
            active === key ? "text-blue-600" : "text-zinc-400 hover:text-zinc-600",
          )}
        >
          <Icon size={16} />
          <span className="block w-full truncate text-center text-[8px] font-bold leading-none">
            {label}
          </span>
        </button>
      ))}
    </div>
  );
}

export function PhoneSectionsScreen({ onPickCategory }: { onPickCategory: (id: string) => void }) {
  return (
    <div className="p-4 pt-10">
      <div className="mb-4 text-xl font-black">Разделы</div>
      <div className="grid grid-cols-2 gap-3">
        {categories.map((c) => (
          <button
            key={c.id}
            type="button"
            onClick={() => onPickCategory(c.id)}
            className={cn("rounded-2xl bg-zinc-50 p-2 text-left", NAV_HOVER)}
          >
            <div
              className={cn(
                "mb-2 flex h-20 items-center justify-center rounded-xl bg-gradient-to-br text-3xl",
                c.photo,
              )}
            >
              {c.emoji}
            </div>
            <div className="text-xs font-bold">{c.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

export function PhoneMenuScreen({
  category,
  onPickCategory,
  onBack,
  onPickDish,
}: {
  category: Category | null;
  onPickCategory: (id: string) => void;
  onBack: () => void;
  onPickDish: (id: string) => void;
}) {
  if (!category) {
    return (
      <div className="p-4 pt-10">
        <div className="mb-4 text-xl font-black">Меню</div>
        <div className="space-y-2">
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => onPickCategory(c.id)}
              className={cn("flex w-full items-center gap-3 rounded-2xl bg-zinc-50 p-3 text-left", NAV_HOVER)}
            >
              <div
                className={cn(
                  "flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br text-2xl",
                  c.photo,
                )}
              >
                {c.emoji}
              </div>
              <div className="flex-1 text-sm font-bold">{c.name}</div>
              <ChevronRight size={16} className="text-zinc-400" />
            </button>
          ))}
        </div>
      </div>
    );
  }

  const items = dishes.filter((d) => d.category === category.name);
  return (
    <div className="p-4 pt-10">
      <button
        type="button"
        onClick={onBack}
        className="mb-3 flex items-center gap-1 text-sm font-bold text-zinc-500 hover:text-zinc-900"
      >
        <ChevronLeft size={16} />
        Меню
      </button>
      <div className="mb-4 text-xl font-black">{category.name}</div>
      <div className="space-y-2">
        {items.map((d) => (
          <button
            key={d.id}
            type="button"
            onClick={() => onPickDish(d.id)}
            className={cn("flex w-full items-center gap-3 rounded-2xl bg-zinc-50 p-2 text-left", NAV_HOVER)}
          >
            <div
              className={cn(
                "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-2xl",
                d.accent,
              )}
            >
              {d.emoji}
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-black">{d.name}</div>
              <div className="text-xs text-zinc-500">{d.price}</div>
            </div>
            <ChevronRight size={16} className="text-zinc-400" />
          </button>
        ))}
      </div>
    </div>
  );
}

export function PhoneWaiterScreen() {
  return (
    <div className="flex h-full flex-col items-center justify-center px-6 pt-10 text-center">
      <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-blue-50 text-blue-600">
        <Bell size={28} />
      </div>
      <h2 className="text-xl font-black">Позвать официанта</h2>
      <p className="mt-2 text-sm leading-6 text-zinc-500">
        Нужна помощь? Официант подойдёт к вашему столу.
      </p>
      <button
        type="button"
        className="mt-6 w-full rounded-2xl bg-zinc-950 py-3.5 text-sm font-black text-white"
      >
        Позвать официанта
      </button>
    </div>
  );
}

export function PhoneAboutDrawer({
  onClose,
  onEdit,
}: {
  onClose: () => void;
  onEdit: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative max-h-[90%] overflow-y-auto rounded-t-[28px] bg-white p-5 shadow-2xl">
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-zinc-200" />
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-zinc-950 text-sm font-black text-white">
            K
          </div>
          <div>
            <h3 className="font-black">{RESTAURANT_NAME}</h3>
            <p className="text-xs text-zinc-500">Корейская кухня и авторские блюда</p>
          </div>
        </div>
        <div className="mt-5 space-y-3 text-sm">
          <InfoRow label="Адрес" value="пр. Кабанбай Батыра, 48" />
          <InfoRow label="Телефон" value="+7 701 000 00 00" />
          <InfoRow label="Описание" value="Корейская кухня, авторские блюда и быстрый заказ по QR." />
          <InfoRow label="Instagram" value="@kimchi.astana" />
        </div>
        <button
          type="button"
          onClick={onEdit}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-zinc-950 py-3 text-sm font-black text-white"
        >
          <Pencil size={14} />
          Редактировать
        </button>
      </div>
    </div>
  );
}

// ── WhatsApp link preview screen ──────────────────────────────────────────────

export function PhoneSeoLink({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-full flex-col bg-[#0b141a]">
      {/* Contact header (pt-7 clears the phone notch) */}
      <div className="flex items-center gap-2.5 bg-[#202c33] px-3 pt-7 pb-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-sm font-bold text-white">
          K
        </div>
        <div>
          <div className="text-sm font-semibold leading-tight text-white">{RESTAURANT_NAME}</div>
          <div className="mt-0.5 text-[11px] text-emerald-400">в сети</div>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 p-3">
        {/* Date chip */}
        <div className="mb-3 flex justify-center">
          <span className="rounded-full bg-[#182229] px-3 py-0.5 text-[10px] text-[#8aab97]">
            Сегодня
          </span>
        </div>

        {/* Sent bubble */}
        <div className="flex justify-end">
          <div className="max-w-[220px] overflow-hidden rounded-xl rounded-tr-sm bg-[#005c4b] shadow-sm">
            {/* OG card */}
            <div className="border-l-[3px] border-emerald-400 bg-[#0d2821]">
              <div className="flex h-24 items-center justify-center bg-gradient-to-br from-zinc-700/80 to-zinc-800/80">
                <div className="flex flex-col items-center gap-1 text-white/25">
                  <Globe size={20} />
                  <span className="text-[9px]">og:image</span>
                </div>
              </div>
              <div className="px-2.5 py-1.5">
                <p className="truncate text-[10px] text-emerald-400">{STOREFRONT_URL}</p>
                <p className="mt-0.5 line-clamp-2 text-[11px] font-semibold leading-tight text-white">
                  {title || "Название сайта"}
                </p>
                <p className="mt-0.5 line-clamp-2 text-[10px] leading-tight text-white/55">
                  {description || "Описание страницы."}
                </p>
              </div>
            </div>
            {/* Link + timestamp */}
            <div className="px-2.5 py-2">
              <p className="break-all text-[11px] text-emerald-300 underline underline-offset-2">
                https://{STOREFRONT_URL}
              </p>
              <p className="mt-1 text-right text-[9px] text-white/40">14:32 ✓✓</p>
            </div>
          </div>
        </div>
      </div>

      {/* Input bar */}
      <div className="flex items-center gap-2 bg-[#202c33] px-3 py-2">
        <div className="flex-1 rounded-full bg-[#2a3942] px-3 py-1.5 text-[11px] text-[#8aab97]">
          Сообщение
        </div>
      </div>
    </div>
  );
}

// ── Operator notification preview ─────────────────────────────────────────────

type NotificationEvent = "delivery" | "pickup" | "waiter";

const NOTIFICATION_META: Record<
  NotificationEvent,
  { badge: string; badgeColor: string; title: string; body: string[]; total?: string }
> = {
  delivery: {
    badge: "🟢 НОВЫЙ ЗАКАЗ · ДОСТАВКА",
    badgeColor: "text-emerald-400",
    title: "Заказ #1024",
    body: ["Маргарита ×1", "Кола ×2"],
    total: "5 200 ₸",
  },
  pickup: {
    badge: "🟢 НОВЫЙ ЗАКАЗ · САМОВЫВОЗ",
    badgeColor: "text-emerald-400",
    title: "Заказ #1025",
    body: ["Пепперони Фреш ×1"],
    total: "4 500 ₸",
  },
  waiter: {
    badge: "🔔 ВЫЗОВ ОФИЦИАНТА",
    badgeColor: "text-blue-400",
    title: "Стол 4",
    body: ["Гость просит помощи"],
  },
};

export function PhoneNotification({
  event,
  channelType,
  contact,
}: {
  event: NotificationEvent;
  channelType: "telegram" | "whatsapp";
  contact: string;
}) {
  const meta = NOTIFICATION_META[event];
  const isTelegram = channelType === "telegram";
  const bgMain = isTelegram ? "bg-[#17212b]" : "bg-[#0a1014]";
  const bgBubble = isTelegram ? "bg-[#182533]" : "bg-[#1a2229]";
  const headerBg = isTelegram ? "bg-[#17212b]" : "bg-[#202c33]";
  const accentColor = isTelegram ? "#5288c1" : "#00a884";
  const appLabel = isTelegram ? "Telegram" : "WhatsApp";

  return (
    <div className={cn("flex h-full flex-col", bgMain)}>
      {/* Chat header */}
      <div className={cn("flex items-center gap-2.5 px-3 py-2.5", headerBg)}>
        <div
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black text-white"
          style={{ backgroundColor: accentColor }}
        >
          {contact.replace("@", "").slice(0, 2).toUpperCase()}
        </div>
        <div className="min-w-0">
          <div className="truncate text-[12px] font-bold text-white">{contact}</div>
          <div className="text-[10px] text-white/40">{appLabel} · бот-интеграция</div>
        </div>
      </div>

      {/* Date separator */}
      <div className="my-3 flex items-center justify-center">
        <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] text-white/40">
          Сегодня
        </span>
      </div>

      {/* Message bubble */}
      <div className="px-3">
        <div className={cn("rounded-2xl rounded-tl-sm p-3", bgBubble)}>
          {/* Badge */}
          <div className={cn("text-[10px] font-black uppercase tracking-wide", meta.badgeColor)}>
            {meta.badge}
          </div>

          {/* Divider */}
          <div className="my-2 border-t border-white/10" />

          {/* Order title */}
          <div className="text-[13px] font-bold text-white">{meta.title}</div>

          {/* Items */}
          <div className="mt-1 space-y-0.5">
            {meta.body.map((line) => (
              <div key={line} className="text-[12px] text-white/70">{line}</div>
            ))}
          </div>

          {/* Total */}
          {meta.total && (
            <div className="mt-2 text-[13px] font-black text-white">
              Сумма: {meta.total}
            </div>
          )}

          {/* Timestamp */}
          <div className="mt-2 text-right text-[9px] text-white/30">14:32 ✓✓</div>
        </div>
      </div>
    </div>
  );
}
