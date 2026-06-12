import { useEffect, useState, type ReactNode } from "react";
import { Loader2, Lock } from "lucide-react";
import { Globe } from "@phosphor-icons/react";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { useVitrineStatus } from "@/lib/use-vitrine-status";
import { useAppSettings } from "@/contexts/app-settings-context";
import { usePublish } from "@/contexts/publish-context";
import { usePreviewDemo } from "@/contexts/preview-demo-context";
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
  PhoneCatalogEmpty,
  PhoneHome,
  PhoneMenuScreen,
  PhoneNotification,
  PhoneSectionsScreen,
  PhoneServiceFeeConsent,
  PhoneSeoLink,
  PhoneUpsellHome,
  PhoneWaiterScreen,
  type PreviewTab,
} from "@/components/preview/phone-screens";
import { useOrderRouting } from "@/contexts/order-routing-context";
import { ContentLanguageControl } from "@/components/preview/content-language-control";

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
};

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
}: PhonePreviewProps) {
  const {
    serviceFeeRequireConsent,
    deliveryComment,
    pickupComment,
    pickupAddress,
  } = useAppSettings();
  const { routes } = useOrderRouting();
  const { publishPhase } = usePublish();
  const { emptyVitrine } = usePreviewDemo();
  const { stage } = useVitrineLaunch();
  const { webAddress } = useVitrineStatus();

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

  let screen: ReactNode = previewBanner ? <PhoneHome banner={previewBanner} empty={emptyVitrine} /> : null;
  let showBottomNav = false;
  let overlay: ReactNode = null;

  if (scenario === "notification-delivery") {
    const r = routes.delivery;
    screen = (
      <PhoneNotification
        event="delivery"
        channelType={r?.type ?? "telegram"}
        contact={r?.contact || "@channel"}
      />
    );
  } else if (scenario === "notification-pickup") {
    const r = routes.pickup;
    screen = (
      <PhoneNotification
        event="pickup"
        channelType={r?.type ?? "telegram"}
        contact={r?.contact || "@channel"}
      />
    );
  } else if (scenario === "notification-waiter") {
    const r = routes.waiter;
    screen = (
      <PhoneNotification
        event="waiter"
        channelType={r?.type ?? "telegram"}
        contact={r?.contact || "@channel"}
      />
    );
  } else if (scenario === "seoLink") {
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
          empty={emptyVitrine}
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
  } else if (scenario === "catalog-empty") {
    screen = <PhoneCatalogEmpty />;
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

  // Overlay публикации (Publish model): аккуратный полупрозрачный слой на 3 сек.
  const publishOverlay = publishPhase === "publishing" && (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-white/70 px-6 text-center backdrop-blur-[1px]">
      <Loader2 size={26} className="animate-spin text-blue-600" />
      <div className="text-sm font-bold text-zinc-800">Обновляем витрину…</div>
    </div>
  );

  return (
    <aside
      data-tour="preview-panel"
      style={{ width: 390 }}
      className="relative flex shrink-0 flex-col border-l border-[#e7e5e4] bg-white"
    >
        <div className="flex h-full flex-col overflow-hidden px-3 pt-4">
          {/* Header: «Предпросмотр витрины» + статус + язык + скрыть */}
          <div className="mb-3 flex w-full items-start justify-between px-1">
            <div className="flex flex-col gap-1">
              <span className="text-[16px] font-medium tracking-[-0.38px] text-black">
                Предпросмотр витрины
              </span>

              {/* Ссылка на витрину — переход активен после валидации менеджером */}
              {stage === "active" ? (
                <a
                  href={`https://${webAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit text-[13px] text-[#79716b] transition hover:text-blue-600 hover:underline"
                >
                  {webAddress}
                </a>
              ) : (
                <span
                  title="Будет доступно после валидации менеджером"
                  className="inline-flex w-fit cursor-not-allowed items-center gap-1.5 text-[13px] text-zinc-400"
                >
                  <Lock size={12} className="shrink-0" />
                  {webAddress}
                </span>
              )}
            </div>
            <div className="flex items-center gap-0.5 text-black">
              <Globe size={16} className="shrink-0" />
              <ContentLanguageControl compact />
            </div>
          </div>

          {/* Flat preview viewport — заполняет всю высоту панели */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-2xl border border-b-0 border-[#e7e5e4] bg-[#f5f5f5]">
            <div className="flex h-full flex-col">
              <div className="flex-1 overflow-y-auto scrollbar-none">{screen}</div>
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
            {publishOverlay}
          </div>
        </div>
    </aside>
  );
}
