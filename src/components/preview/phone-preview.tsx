import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown, Loader2, Smartphone } from "lucide-react";
import { Globe, SidebarSimple } from "@phosphor-icons/react";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
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
  // Панель превью можно скрыть
  collapsed: boolean;
  onExpand: () => void;
  onCollapse: () => void;
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
  collapsed,
  onExpand,
  onCollapse,
}: PhonePreviewProps) {
  const {
    serviceFeeRequireConsent,
    deliveryComment,
    pickupComment,
    pickupAddress,
  } = useAppSettings();
  const { routes } = useOrderRouting();
  const { publishPhase, totalChanges } = usePublish();
  const { emptyVitrine } = usePreviewDemo();
  const { stage } = useVitrineLaunch();

  const [previewTab, setPreviewTab] = useState<PreviewTab>("home");
  const [statusExpanded, setStatusExpanded] = useState(false);
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
      style={{ width: collapsed ? 44 : 390 }}
      className="relative flex shrink-0 flex-col border-l border-[#e7e5e4] bg-white transition-[width] duration-300 ease-out"
    >
      {collapsed ? (
        <div className="flex h-full w-full flex-col items-center gap-3 py-3">
          {/* Доступ к языку контента сохраняется и в свёрнутом превью */}
          <div className="flex flex-col items-center gap-0.5 text-zinc-500">
            <Smartphone size={14} />
            <ContentLanguageControl compact />
          </div>
          <button
            type="button"
            onClick={onExpand}
            className="flex flex-1 w-full flex-col items-center justify-center gap-2 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900"
            title="Показать превью"
          >
            <span className="text-xs font-bold uppercase tracking-wide [writing-mode:vertical-rl]">
              Превью
            </span>
          </button>
        </div>
      ) : (
        <div className="flex h-full flex-col overflow-hidden px-3 pt-4">
          {/* Header: «Предпросмотр витрины» + статус + язык + скрыть */}
          <div className="mb-3 flex w-full items-start justify-between px-1">
            <div className="flex flex-col gap-1">
              <span className="text-[16px] font-medium tracking-[-0.38px] text-black">
                Предпросмотр витрины
              </span>

              {/* Status badge — pending review or active */}
              {stage !== "active" ? (
                <div className="flex flex-col gap-1">
                  <button
                    type="button"
                    onClick={() => setStatusExpanded((v) => !v)}
                    className="flex items-center gap-1.5 rounded-md py-0.5 text-left transition hover:opacity-80"
                  >
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-60" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                    </span>
                    <span className="text-[11px] font-medium text-amber-700">
                      Ожидает проверки менеджера
                    </span>
                    <ChevronDown
                      size={10}
                      className={`text-amber-600 transition-transform ${statusExpanded ? "rotate-180" : ""}`}
                    />
                  </button>
                  {statusExpanded && (
                    <div className="rounded-lg bg-zinc-50 px-3 py-2.5 text-[11px] leading-[1.65] text-zinc-600">
                      <p>Витрина пока доступна только в предпросмотре.</p>
                      <p className="mt-1.5">Менеджер проверит данные, закрепит адрес витрины и активирует публичную ссылку. После этого гости смогут открыть меню по QR-коду или ссылке.</p>
                      <p className="mt-1.5">Пока вы можете продолжать наполнять меню и проверять результат в предпросмотре.</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="flex flex-col gap-1">
                  <div className="flex items-center gap-1.5">
                    <span className="relative flex h-2 w-2 shrink-0">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-50" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                    </span>
                    <span className="text-[11px] font-medium text-emerald-700">Витрина активна</span>
                  </div>
                  {totalChanges > 0 && (
                    <div className="flex items-center gap-1.5">
                      <span className="flex h-3 w-3 items-center justify-center rounded-full bg-amber-100">
                        <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                      </span>
                      <span className="text-[12px] text-[#79716b]">Есть неопубликованные изменения</span>
                    </div>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex items-center gap-0.5 text-black">
                <Globe size={16} className="shrink-0" />
                <ContentLanguageControl compact />
              </div>
              <button
                type="button"
                onClick={onCollapse}
                title="Скрыть превью"
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                <SidebarSimple size={20} />
              </button>
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
      )}
    </aside>
  );
}
