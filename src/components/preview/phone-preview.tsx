import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/contexts/app-settings-context";
import {
  categories,
  dishes,
  getDish,
  getRecommendedDishes,
  promotedDishIds,
  type AnalyticsTabId,
  type Banner,
  type ManageTabId,
  type PreviewScenario,
  type RecommendationTexts,
  type SectionId,
  type StoreTabId,
  type UpsellSurface,
} from "@/data/mock-data";
import {
  PhoneAboutDrawer,
  PhoneAboutSheet,
  PhoneAgeGate,
  PhoneBottomNav,
  PhoneCart,
  PhoneCatalog,
  PhoneCheckout,
  PhoneDish,
  PhoneHome,
  PhoneMenuScreen,
  PhoneSectionsScreen,
  PhoneServiceFeeConsent,
  PhoneSeoLink,
  PhoneUpsellHome,
  PhoneWaiterScreen,
  type PreviewTab,
} from "@/components/preview/phone-screens";

type PhonePreviewProps = {
  section: SectionId;
  activeTab: StoreTabId | ManageTabId | AnalyticsTabId | null;
  selectedDishId: string;
  previewBanner: Banner | null;
  scenario: PreviewScenario;
  recommendationTexts: RecommendationTexts;
  upsellSurface: UpsellSurface;
  highlightUpsell: boolean;
  // Навигация из превью в настройки (UX-эксперимент)
  onNavHomeHero: () => void;
  onNavHomeSections: () => void;
  onNavUpsell: () => void;
  onNavAbout: () => void;
  onNavCatalogDish: (id: string) => void;
  // SEO-сценарий
  seoTitle?: string;
  seoDescription?: string;
  // Ресайзируемая панель
  width: number;
  collapsed: boolean;
  dragging: boolean;
  onStartResize: (e: MouseEvent) => void;
  onExpand: () => void;
};

const PHONE_W = 292;
const PHONE_H = 662;
const MIN_SCALE = 0.62;

export function PhonePreview({
  section,
  activeTab,
  selectedDishId,
  previewBanner,
  scenario,
  recommendationTexts,
  upsellSurface,
  highlightUpsell,
  onNavHomeHero,
  onNavHomeSections,
  onNavUpsell,
  onNavAbout,
  onNavCatalogDish,
  seoTitle = "",
  seoDescription = "",
  width,
  collapsed,
  dragging,
  onStartResize,
  onExpand,
}: PhonePreviewProps) {
  const {
    serviceFeeRequireConsent,
    deliveryComment,
    pickupComment,
    pickupAddress,
  } = useAppSettings();

  const [previewTab, setPreviewTab] = useState<PreviewTab>("home");
  const [menuCategory, setMenuCategory] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);

  // При возврате на админ-вкладку «Главная» сбрасываем состояние навигации превью.
  useEffect(() => {
    if (activeTab === "home") {
      setPreviewTab("home");
      setMenuCategory(null);
      setAboutOpen(false);
    }
  }, [activeTab]);

  const dish = getDish(selectedDishId);
  const recommended = getRecommendedDishes(dish);
  // Чтобы блок рекомендаций в превью не был пустым — fallback на промо-позиции.
  const recItems =
    recommended.length > 0
      ? recommended
      : promotedDishIds
          .map((id) => dishes.find((d) => d.id === id))
          .filter((d): d is NonNullable<typeof d> => Boolean(d) && d!.id !== dish.id);

  // Навигация по витрине доступна на админ-вкладке «Главная».
  const browsing = section === "storefront" && activeTab === "home" && previewBanner != null;

  let screen: ReactNode = previewBanner ? <PhoneHome banner={previewBanner} /> : null;
  let showBottomNav = false;
  let overlay: ReactNode = null;

  if (scenario === "seoLink") {
    screen = <PhoneSeoLink title={seoTitle} description={seoDescription} />;
  } else if (scenario === "age") {
    screen = <PhoneAgeGate />;
  } else if (scenario === "about" || activeTab === "about") {
    screen = <PhoneAboutSheet />;
  } else if (scenario === "serviceFee") {
    screen = serviceFeeRequireConsent ? (
      <PhoneServiceFeeConsent />
    ) : (
      <PhoneCheckout emphasizeServiceFee />
    );
  } else if (scenario === "pickup") {
    screen = (
      <PhoneCheckout method="pickup" comment={pickupComment} pickupAddress={pickupAddress} />
    );
  } else if (scenario === "delivery") {
    screen = <PhoneCheckout method="delivery" comment={deliveryComment} />;
  } else if (browsing && previewBanner) {
    showBottomNav = true;
    if (previewTab === "home") {
      screen = (
        <PhoneHome
          banner={previewBanner}
          onBanner={onNavHomeHero}
          onSections={onNavHomeSections}
          onRecommendations={onNavUpsell}
          onAbout={() => setAboutOpen(true)}
        />
      );
    } else if (previewTab === "sections") {
      screen = (
        <PhoneSectionsScreen
          onPickCategory={(id) => {
            setMenuCategory(id);
            setPreviewTab("menu");
          }}
        />
      );
    } else if (previewTab === "menu") {
      const cat = categories.find((c) => c.id === menuCategory) ?? null;
      screen = (
        <PhoneMenuScreen
          category={cat}
          onPickCategory={setMenuCategory}
          onBack={() => setMenuCategory(null)}
          onPickDish={onNavCatalogDish}
        />
      );
    } else if (previewTab === "waiter") {
      screen = <PhoneWaiterScreen />;
    } else {
      screen = (
        <PhoneCart
          title={recommendationTexts.cart}
          dish={dish}
          recommended={recItems}
          onRecommendations={onNavUpsell}
        />
      );
    }
    if (aboutOpen) {
      overlay = (
        <PhoneAboutDrawer
          onClose={() => setAboutOpen(false)}
          onEdit={() => {
            setAboutOpen(false);
            onNavAbout();
          }}
        />
      );
    }
  } else if (activeTab === "catalog") {
    screen = <PhoneCatalog selectedDishId={selectedDishId} />;
  } else if (activeTab === "upsell") {
    // Сценарий превью управляется фокусом полей «Тексты рекомендаций».
    if (upsellSurface === "home") {
      screen = (
        <PhoneUpsellHome
          title={recommendationTexts.home}
          recommended={recItems}
          highlight={highlightUpsell}
        />
      );
    } else if (upsellSurface === "cart") {
      screen = (
        <PhoneCart
          title={recommendationTexts.cart}
          dish={dish}
          recommended={recItems}
          highlight={highlightUpsell}
        />
      );
    } else {
      screen = (
        <PhoneDish
          dish={dish}
          recommended={recItems}
          title={recommendationTexts.dish}
          highlight={highlightUpsell}
        />
      );
    }
  } else if (activeTab === "appearance") {
    screen = <PhoneCatalog selectedDishId={selectedDishId} themed />;
  }

  const safeWidth = Number.isFinite(width) ? width : 360;
  const scale = Math.min(1, Math.max(MIN_SCALE, (safeWidth - 40) / PHONE_W));

  return (
    <aside
      style={{ width: collapsed ? 44 : safeWidth }}
      className={cn(
        "relative flex shrink-0 flex-col border-l border-border bg-zinc-50",
        !dragging && "transition-[width] duration-300 ease-out",
      )}
    >
      {/* Ручка перетаскивания */}
      {!collapsed && (
        <div
          onMouseDown={onStartResize}
          className="group absolute left-0 top-0 z-30 flex h-full w-2.5 -translate-x-1/2 cursor-col-resize items-center justify-center"
          title="Потяните, чтобы изменить ширину"
        >
          <div className="h-12 w-1 rounded-full bg-zinc-300 transition group-hover:bg-blue-400" />
        </div>
      )}

      {collapsed ? (
        <button
          type="button"
          onClick={onExpand}
          className="flex h-full w-full flex-col items-center justify-center gap-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
          title="Показать превью"
        >
          <Smartphone size={18} />
          <span className="text-xs font-bold uppercase tracking-wide [writing-mode:vertical-rl]">
            Превью
          </span>
        </button>
      ) : (
        <div className="flex h-full flex-col items-center overflow-hidden px-4 py-6">
          <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
            {scenario === "seoLink" ? "Ссылка в мессенджерах" : "Превью гостя"}
          </div>
          <div style={{ width: PHONE_W * scale, height: PHONE_H * scale }} className="shrink-0">
            <div
              style={{ width: PHONE_W, height: PHONE_H, transform: `scale(${scale})`, transformOrigin: "top left" }}
              className="relative overflow-hidden rounded-[42px] border-[7px] border-zinc-950 bg-white shadow-2xl shadow-zinc-300/60"
            >
              <div className="absolute left-1/2 top-0 z-20 h-6 w-28 -translate-x-1/2 rounded-b-2xl bg-zinc-950" />
              <div className="flex h-full flex-col">
                <div className="flex-1 overflow-y-auto bg-white scrollbar-none">{screen}</div>
                {showBottomNav && (
                  <PhoneBottomNav
                    active={previewTab}
                    onSelect={(t) => {
                      setPreviewTab(t);
                      if (t !== "menu") setMenuCategory(null);
                    }}
                  />
                )}
              </div>
              {overlay}
            </div>
          </div>
          <p className="mt-3 max-w-[250px] text-center text-xs leading-5 text-zinc-500">
            {showBottomNav
              ? "Нажмите на элемент витрины, чтобы открыть его настройки."
              : "Превью переключается на сценарий, который сейчас редактируется."}
          </p>
        </div>
      )}
    </aside>
  );
}
