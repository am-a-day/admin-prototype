import { useState, useEffect, type MouseEvent as ReactMouseEvent, type ReactNode } from "react";
import { Sidebar, NavDrawer, type SidebarMode } from "@/components/layout/sidebar";
import { WorkAreaRail, WorkAreaTabs } from "@/components/layout/work-area-rail";
import { LayoutModeProvider, useLayoutMode } from "@/contexts/layout-mode-context";
import { ContentHeader } from "@/components/layout/content-header";
import { HeaderActionsProvider } from "@/contexts/header-actions-context";
import { VitrineLaunchProvider } from "@/contexts/vitrine-launch-context";
import { PhonePreview } from "@/components/preview/phone-preview";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { OrderRoutingProvider } from "@/contexts/order-routing-context";
import { PlanProvider } from "@/contexts/plan-context";
import { PublishProvider, type PageKey } from "@/contexts/publish-context";
import { ChangeTracker } from "@/components/workspace/change-tracker";
import { DraftToast } from "@/components/workspace/draft-toast";
import {
  banners as seedBanners,
  DEFAULT_RECOMMENDATION_TEXTS,
  RESTAURANT_NAME,
  type AnalyticsTabId,
  type Banner,
  type ManageTabId,
  type PreviewScenario,
  type RecommendationTexts,
  type SectionId,
  type StoreTabId,
  type UpsellSurface,
} from "@/data/mock-data";
import { AnalyticsPage, OrderHistoryPage, QRPage } from "@/features/standalone-pages";
import { AMApp } from "@/features/am/am-app";
import { DeliveryWorkspace } from "@/features/management/delivery-workspace";
import { ManagementStub } from "@/features/management/management-stub";
import { AboutWorkspace } from "@/features/storefront/about-workspace";
import { AppearanceWorkspace } from "@/features/storefront/appearance-workspace";
import { CatalogWorkspace, type CatalogPhase } from "@/features/storefront/catalog-workspace";
import { HomeWorkspace } from "@/features/storefront/home-workspace";
import { LaunchWorkspace } from "@/features/storefront/launch-workspace";
import { UpsellWorkspace } from "@/features/storefront/upsell-workspace";
import { LaunchPhonePreview } from "@/components/layout/launch-phone-preview";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";

type PageMeta = { title: string; description?: string; showLanguage?: boolean };

const PAGE_META: Record<string, PageMeta> = {
  "storefront:launch":     { title: "Запуск витрины",    description: "Пройдите 5 шагов, чтобы витрина заработала для гостей." },
  "storefront:home":       { title: "Главная",           description: "Баннеры, ключевые разделы и продвигаемые позиции.", showLanguage: true },
  "storefront:catalog":    { title: "Каталог",            description: "Разделы, позиции и карточки меню.",                showLanguage: true },
  "storefront:upsell":     { title: "Рекомендации",       description: "Что предложить вместе с позициями.",              showLanguage: true },
  "storefront:appearance": { title: "Оформление",         description: "Стиль карточек, цвет и фон витрины.",             showLanguage: true },
  "storefront:about":      { title: "О заведении",        description: "Информация о заведении и публичное представление.", showLanguage: true },
  "management:order-settings": { title: "Настройка заказов", description: "Доставка, самовывоз и способы оплаты.", showLanguage: true },
  "management:order-history":  { title: "История заказов",   description: "Все входящие заказы — доставка и самовывоз." },
  "management:billing":    { title: "Тарифы",             description: "Текущий план, ограничения и возможности следующего." },
  "management:account":    { title: "Аккаунт",            description: "Данные заведения, владелец и доступы." },
  "management:io":         { title: "Импорт / экспорт",   description: "Загрузка и выгрузка меню, данных и настроек." },
  "management:seo":        { title: "SEO",                 description: "Метатеги, заголовок и описание для поисковиков." },
  "analytics:scans":       { title: "Сканирования",       description: "Количество сканирований QR-кода и переходов." },
  "analytics:orders":      { title: "Заказы",             description: "Выручка, средний чек и динамика по времени." },
  "analytics:likes":       { title: "Лайки",              description: "Лайки гостей по блюдам и разделам меню." },
  "qr":                    { title: "QR-коды",            description: "Генерация и управление QR-кодами." },
};

function AppShell() {
  const { markVisited } = useVitrineLaunch();
  const { layoutVersion, resizablePreview } = useLayoutMode();
  const [section, setSection] = useState<SectionId>("storefront");
  const [storeTab, setStoreTab] = useState<StoreTabId>("launch");
  const [storeAboutTab, setStoreAboutTab] = useState<"info" | "seo">("info");
  const [manageTab, setManageTab] = useState<ManageTabId>("order-settings");
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTabId>("scans");
  const [selectedDishId, setSelectedDishId] = useState("pepperoni");
  const [bannerList, setBannerList] = useState<Banner[]>(seedBanners);
  const [selectedBannerId, setSelectedBannerId] = useState("hero-1");
  const [previewScenario, setPreviewScenario] = useState<PreviewScenario>(null);
  const [recommendationTexts, setRecommendationTexts] = useState<RecommendationTexts>(
    DEFAULT_RECOMMENDATION_TEXTS,
  );
  const [upsellSurface, setUpsellSurface] = useState<UpsellSurface>("dish");
  const [catalogPhase, setCatalogPhase] = useState<CatalogPhase>("empty");

  // SEO preview data — lifted here so PhonePreview can render the "seoLink" scenario
  const [seoTitle, setSeoTitle] = useState(`${RESTAURANT_NAME} — корейская кухня`);
  const [seoDescription, setSeoDescription] = useState(
    "Авторские корейские блюда с доставкой и самовывозом. Заказывайте онлайн.",
  );
  const [upsellFocused, setUpsellFocused] = useState(false);
  const [homeFocus, setHomeFocus] = useState<"hero" | "sections" | null>(null);

  // Ресайзируемая панель превью
  const [previewWidth, setPreviewWidth] = useState(360);
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [previewDragging, setPreviewDragging] = useState(false);

  // Sidebar зависит только от ширины viewport
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  useEffect(() => {
    const update = () => setViewportWidth(window.innerWidth);
    window.addEventListener("resize", update);
    // ResizeObserver catches DevTools viewport changes that don't fire resize event
    const ro = new ResizeObserver(update);
    ro.observe(document.documentElement);
    return () => {
      window.removeEventListener("resize", update);
      ro.disconnect();
    };
  }, []);

  // Sidebar visibility / collapse — unified, user-controllable
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => window.innerWidth < 1200);
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);

  const wide = viewportWidth >= 1024;        // inline full sidebar fits
  const showInlineSidebar = viewportWidth >= 768; // tablet+ shows at least a rail
  const inlineSidebarMode: SidebarMode = wide && !sidebarCollapsed ? "full" : "rail";

  const toggleNav = () => {
    if (wide) setSidebarCollapsed((c) => !c); // full ↔ rail inline
    else setNavDrawerOpen((o) => !o);         // narrow → overlay drawer
  };

  const startPreviewResize = (e: ReactMouseEvent) => {
    e.preventDefault();
    setPreviewDragging(true);
    document.body.style.userSelect = "none";
    document.body.style.cursor = "col-resize";
    const onMove = (ev: MouseEvent) => {
      const intended = window.innerWidth - ev.clientX;
      if (!Number.isFinite(intended)) return;
      if (intended < 210) {
        setPreviewCollapsed(true);
      } else {
        setPreviewCollapsed(false);
        setPreviewWidth(Math.min(560, Math.max(248, intended)));
      }
    };
    const onUp = () => {
      setPreviewDragging(false);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const setRecommendationText = (key: keyof RecommendationTexts, value: string) =>
    setRecommendationTexts((prev) => ({ ...prev, [key]: value }));

  // Навигация из превью в настройки витрины (UX-эксперимент)
  const openStoreTab = (tab: StoreTabId) => {
    setSection("storefront");
    setStoreTab(tab);
    if (tab === "about") {
      setStoreAboutTab("info");
      setPreviewScenario("about");
    } else {
      setPreviewScenario(null);
    }
  };
  const navHomeHero = () => {
    openStoreTab("home");
    setHomeFocus("hero");
  };
  const navHomeSections = () => {
    openStoreTab("home");
    setHomeFocus("sections");
  };
  const navUpsellPage = () => openStoreTab("upsell");
  const navAbout = () => openStoreTab("about");
  const navCatalogDish = (id: string) => {
    setSelectedDishId(id);
    openStoreTab("catalog");
  };

  const activeTab =
    section === "storefront" ? storeTab :
    section === "management" ? manageTab :
    section === "analytics" ? analyticsTab :
    null;

  const updateBanner = (id: string, patch: Partial<Banner>) =>
    setBannerList((prev) => prev.map((b) => (b.id === id ? { ...b, ...patch } : b)));

  const removeBanner = (id: string) =>
    setBannerList((prev) => {
      const next = prev.filter((b) => b.id !== id);
      if (id === selectedBannerId && next.length) setSelectedBannerId(next[0].id);
      return next;
    });

  const addBanner = () => {
    const id = `hero-${Date.now()}`;
    setBannerList((prev) => [
      ...prev,
      {
        id,
        title: "Новый баннер",
        subtitle: "Заголовок баннера",
        tags: [],
        accent: "from-indigo-700 via-blue-500 to-sky-400",
        visible: true,
        link: "",
      },
    ]);
    setSelectedBannerId(id);
  };

  const previewBanner =
    bannerList.find((b) => b.id === selectedBannerId) ?? bannerList[0] ?? null;

  const navigate = (next: SectionId, tab: string) => {
    setSection(next);
    setPreviewScenario(null);
    if (next === "storefront") {
      setStoreTab(tab as StoreTabId);
      if (tab === "about") {
        setStoreAboutTab("info");
        setPreviewScenario("about");
      }
      // Mark launch checklist steps as visited
      // (catalog is marked only when user adds first item — see CatalogWorkspace onAdvancePhase)
      if (tab === "home") markVisited("home");
      if (tab === "appearance") markVisited("appearance");
      if (tab === "about") markVisited("about");
      if (tab === "upsell") markVisited("upsell");
    }
    if (next === "management") {
      setManageTab(tab as ManageTabId);
      if (tab === "order-settings") markVisited("ordering");
    }
    if (next === "analytics") setAnalyticsTab(tab as AnalyticsTabId);
  };

  const openOrderAcceptance = () => {
    setSection("management");
    setManageTab("order-settings");
    setPreviewScenario(null);
  };

  let content: ReactNode = null;

  if (section === "storefront") {
    if (storeTab === "launch") {
      content = <LaunchWorkspace onNavigate={navigate} />;
    }
    if (storeTab === "home") {
      content = (
        <HomeWorkspace
          banners={bannerList}
          selectedBannerId={selectedBannerId}
          setSelectedBannerId={setSelectedBannerId}
          updateBanner={updateBanner}
          removeBanner={removeBanner}
          addBanner={addBanner}
          homeFocus={homeFocus}
          onHomeFocusHandled={() => setHomeFocus(null)}
        />
      );
    }
    if (storeTab === "catalog") {
      content = (
        <CatalogWorkspace
          selectedDishId={selectedDishId}
          catalogPhase={catalogPhase}
          onAdvancePhase={(next) => {
            setCatalogPhase(next);
            if (next === "has-items") markVisited("catalog");
          }}
        />
      );
    }
    if (storeTab === "upsell") {
      content = (
        <UpsellWorkspace
          selectedDishId={selectedDishId}
          setSelectedDishId={setSelectedDishId}
          recommendationTexts={recommendationTexts}
          setRecommendationText={setRecommendationText}
          setUpsellSurface={setUpsellSurface}
          setUpsellFocused={setUpsellFocused}
        />
      );
    }
    if (storeTab === "appearance") {
      content = <AppearanceWorkspace />;
    }
    if (storeTab === "about") {
      content = (
        <AboutWorkspace
          setPreviewScenario={setPreviewScenario}
          onConfigureOrderSettings={openOrderAcceptance}
          aboutTab={storeAboutTab}
          setAboutTab={setStoreAboutTab}
          seoTitle={seoTitle}
          setSeoTitle={setSeoTitle}
          seoDescription={seoDescription}
          setSeoDescription={setSeoDescription}
        />
      );
    }
  } else if (section === "management") {
    if (manageTab === "order-settings") {
      content = <DeliveryWorkspace setPreviewScenario={setPreviewScenario} />;
    } else if (manageTab === "order-history") {
      content = <OrderHistoryPage />;
    } else {
      content = <ManagementStub tabId={manageTab} />;
    }
  } else if (section === "analytics") {
    content = <AnalyticsPage tab={analyticsTab} />;
  } else {
    content = <QRPage />;
  }

  // AM — отдельная страница с собственным лейаутом (без rail / header / превью)
  if (section === "am") {
    return <AMApp onExit={() => setSection("storefront")} />;
  }

  // Какая из 6 редактируемых страниц витрины сейчас открыта (для трекинга черновика)
  const pageKey: PageKey | null =
    section === "storefront"
      ? (storeTab as PageKey)
      : section === "management" && manageTab === "order-settings"
        ? "order-settings"
        : null;

  const isLaunchPage = section === "storefront" && storeTab === "launch";
  // When catalog is empty, override preview to show the empty-catalog phone screen
  const effectiveScenario: typeof previewScenario =
    section === "storefront" && storeTab === "catalog" && catalogPhase !== "has-items"
      ? "catalog-empty"
      : previewScenario;
  const previewVisible =
    !isLaunchPage &&
    (section === "storefront" ||
      (section === "management" && manageTab === "order-settings"));

  const metaKey =
    section === "storefront" ? `storefront:${storeTab}` :
    section === "management" ? `management:${manageTab}` :
    section === "analytics"  ? `analytics:${analyticsTab}` :
    "qr";
  const pageMeta = PAGE_META[metaKey] ?? { title: "" };

  const isRailLayout = layoutVersion === "rail";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-zinc-100 text-zinc-950">
      <div className="flex min-h-0 min-w-0 flex-1 gap-2 overflow-hidden p-2">
        {isRailLayout ? (
          <WorkAreaRail
            section={section}
            activeTab={activeTab}
            onNavigate={navigate}
            onResetCatalog={() => setCatalogPhase("empty")}
          />
        ) : showInlineSidebar ? (
          <Sidebar section={section} activeTab={activeTab} onNavigate={navigate} onResetCatalog={() => setCatalogPhase("empty")} mode={inlineSidebarMode} dragging={previewDragging} />
        ) : null}

        {/* Overlay drawer (sidebar layout, narrow screens / expand) */}
        {!isRailLayout && (
          <NavDrawer
            open={navDrawerOpen}
            onClose={() => setNavDrawerOpen(false)}
            section={section}
            activeTab={activeTab}
            onNavigate={navigate}
            onResetCatalog={() => setCatalogPhase("empty")}
          />
        )}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-zinc-200/80 bg-white shadow-sm">
          <ContentHeader
            title={pageMeta.title}
            description={pageMeta.description}
            showLanguage={pageMeta.showLanguage}
            onToggleSidebar={isRailLayout ? undefined : toggleNav}
            sidebarExpanded={wide ? !sidebarCollapsed : false}
            onRenewPlan={() => navigate("management", "billing")}
            tabs={
              isRailLayout ? (
                <WorkAreaTabs section={section} activeTab={activeTab} onNavigate={navigate} />
              ) : undefined
            }
          />
          <div className="flex min-h-0 min-w-0 flex-1">
        <ChangeTracker pageKey={pageKey}>{content}</ChangeTracker>
        {isLaunchPage && <LaunchPhonePreview />}
        {previewVisible && (
          <PhonePreview
            section={section}
            activeTab={activeTab}
            selectedDishId={selectedDishId}
            previewBanner={previewBanner}
            scenario={effectiveScenario}
            recommendationTexts={recommendationTexts}
            upsellSurface={upsellSurface}
            highlightUpsell={upsellFocused}
            onNavHomeHero={navHomeHero}
            onNavHomeSections={navHomeSections}
            onNavUpsell={navUpsellPage}
            onNavAbout={navAbout}
            onNavCatalogDish={navCatalogDish}
            seoTitle={seoTitle}
            seoDescription={seoDescription}
            width={resizablePreview ? previewWidth : 360}
            collapsed={previewCollapsed}
            dragging={previewDragging}
            resizable={resizablePreview}
            onStartResize={startPreviewResize}
            onExpand={() => setPreviewCollapsed(false)}
            onCollapse={() => setPreviewCollapsed(true)}
          />
        )}
          </div>
        </div>
      </div>
      <DraftToast />
    </div>
  );
}

export default function App() {
  return (
    <AppSettingsProvider>
      <OrderRoutingProvider>
        <PlanProvider>
          <PublishProvider>
            <VitrineLaunchProvider>
              <LayoutModeProvider>
                <HeaderActionsProvider>
                  <AppShell />
                </HeaderActionsProvider>
              </LayoutModeProvider>
            </VitrineLaunchProvider>
          </PublishProvider>
        </PlanProvider>
      </OrderRoutingProvider>
    </AppSettingsProvider>
  );
}
