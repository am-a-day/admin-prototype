import { useState, useEffect, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppHeaderRight } from "@/components/layout/app-header";
import { Sidebar, NavDrawer, type SidebarMode } from "@/components/layout/sidebar";
import { ContentHeader } from "@/components/layout/content-header";
import { HeaderActionsProvider } from "@/contexts/header-actions-context";
import { VitrineLaunchProvider } from "@/contexts/vitrine-launch-context";
import { PhonePreview } from "@/components/preview/phone-preview";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { OrderRoutingProvider } from "@/contexts/order-routing-context";
import { PlanProvider } from "@/contexts/plan-context";
import { PublishProvider, type PageKey } from "@/contexts/publish-context";
import { PreviewDemoProvider } from "@/contexts/preview-demo-context";
import { ChangeTracker } from "@/components/workspace/change-tracker";
import { DraftToast } from "@/components/workspace/draft-toast";
import { PublishToast } from "@/components/workspace/publish-toast";
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
import { AboutWorkspace, type AboutTab } from "@/features/storefront/about-workspace";
import { AppearanceWorkspace } from "@/features/storefront/appearance-workspace";
import { CatalogWorkspace, type CatalogPhase } from "@/features/storefront/catalog-workspace";
import { HomeWorkspace, HomeTabs, type HomeTab } from "@/features/storefront/home-workspace";
import { LaunchPage } from "@/features/storefront/launch-page";
import { UpsellWorkspace } from "@/features/storefront/upsell-workspace";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";

type PageMeta = { title: string; description?: string; showLanguage?: boolean };

const PAGE_META: Record<string, PageMeta> = {
  "storefront:launch":     { title: "Моя витрина",       description: "Центр состояния витрины." },
  "storefront:home":       { title: "Главная витрины",    description: "Баннеры, ключевые разделы и продвигаемые позиции.", showLanguage: true },
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
  const { markVisited, stage } = useVitrineLaunch();
  const [section, setSection] = useState<SectionId>("storefront");
  const [storeTab, setStoreTab] = useState<StoreTabId>("catalog");
  const [storeAboutTab, setStoreAboutTab] = useState<AboutTab>("info");
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
  const [homeTab, setHomeTab] = useState<HomeTab>("banners");

  // SEO preview data — lifted here so PhonePreview can render the "seoLink" scenario
  const [seoTitle, setSeoTitle] = useState(`${RESTAURANT_NAME} — корейская кухня`);
  const [seoDescription, setSeoDescription] = useState(
    "Авторские корейские блюда с доставкой и самовывозом. Заказывайте онлайн.",
  );
  const [upsellFocused, setUpsellFocused] = useState(false);
  const [homeFocus, setHomeFocus] = useState<"hero" | "sections" | null>(null);

  // Панель превью можно скрыть
  const [previewCollapsed, setPreviewCollapsed] = useState(false);

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

  const guardedNavigate = (next: SectionId, tab: string) => navigate(next, tab);

  let content: ReactNode = null;

  if (section === "storefront") {
    if (storeTab === "launch") {
      content = <LaunchPage onNavigate={guardedNavigate} />;
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
          homeTab={homeTab}
          setHomeTab={setHomeTab}
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

  // После активации витрины страница запуска исчезает — точкой входа становится Каталог.
  useEffect(() => {
    if (stage === "active" && section === "storefront" && storeTab === "launch") {
      setStoreTab("catalog");
    }
  }, [stage, section, storeTab]);

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
  // Главная сама рисует заголовок «Главная» + табы (как в макете) — прячем дубль в шапке.
  const isHomePage = section === "storefront" && storeTab === "home";

  // When catalog is empty, override preview to show the empty-catalog phone screen
  const effectiveScenario: typeof previewScenario =
    section === "storefront" && storeTab === "catalog" && catalogPhase !== "has-items"
      ? "catalog-empty"
      : previewScenario;
  const previewVisible =
    section === "storefront" ||
    (section === "management" && manageTab === "order-settings");

  const metaKey =
    section === "storefront" ? `storefront:${storeTab}` :
    section === "management" ? `management:${manageTab}` :
    section === "analytics"  ? `analytics:${analyticsTab}` :
    "qr";
  const pageMeta = PAGE_META[metaKey] ?? { title: "" };

  return (
    <div className="flex h-screen overflow-hidden bg-[#f5f5f4] text-zinc-950">

      {/* ── Left: full-height sidebar ─────────────────────────────────────────── */}
      {showInlineSidebar && (
        <div
          className={cn(
            "flex shrink-0 flex-col transition-[width] duration-300 ease-out",
            inlineSidebarMode === "rail" ? "w-12" : "w-48",
          )}
        >
          <Sidebar
            section={section}
            activeTab={activeTab}
            onNavigate={guardedNavigate}
            mode={inlineSidebarMode}
            onToggleSidebar={wide ? toggleNav : undefined}
          />
        </div>
      )}

      {/* ── Right: header + work area ────────────────────────────────────────── */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">

        <AppHeaderRight
          onNavigate={guardedNavigate}
          onResetCatalog={() => setCatalogPhase("empty")}
          showHamburger={!showInlineSidebar}
          onOpenMobileMenu={() => setNavDrawerOpen(true)}
          onToggleSidebar={wide ? toggleNav : undefined}
          sidebarCollapsed={inlineSidebarMode === "rail"}
          isLaunchPage={isLaunchPage}
        />

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">

          {/* Overlay nav drawer (mobile / narrow screens) */}
          <NavDrawer
            open={navDrawerOpen}
            onClose={() => setNavDrawerOpen(false)}
            section={section}
            activeTab={activeTab}
            onNavigate={guardedNavigate}
          />

          {/* Work area */}
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden gap-2 pb-3 pr-3 pl-1">
          {/* Single white container: editor + preview, split by a vertical line */}
          <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden rounded-[20px] border border-[#e7e5e4] bg-white shadow-sm">

            {/* Editor column */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
              <ContentHeader
                title={isHomePage || isLaunchPage ? undefined : pageMeta.title}
                description={isHomePage || isLaunchPage ? undefined : pageMeta.description}
                showLanguage={pageMeta.showLanguage && !previewVisible}
                onRenewPlan={() => guardedNavigate("management", "billing")}
                tabs={isHomePage ? <HomeTabs value={homeTab} onChange={setHomeTab} /> : undefined}
              />
              <div className="flex min-h-0 min-w-0 flex-1">
                <ChangeTracker pageKey={pageKey}>{content}</ChangeTracker>
              </div>
            </div>

            {/* Preview panel (right side of the white container) */}
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
                collapsed={previewCollapsed}
                onExpand={() => setPreviewCollapsed(false)}
                onCollapse={() => setPreviewCollapsed(true)}
              />
            )}
          </div>
        </div>

        </div>

      </div>

      <DraftToast />
      <PublishToast />
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
              <PreviewDemoProvider>
                <HeaderActionsProvider>
                  <AppShell />
                </HeaderActionsProvider>
              </PreviewDemoProvider>
            </VitrineLaunchProvider>
          </PublishProvider>
        </PlanProvider>
      </OrderRoutingProvider>
    </AppSettingsProvider>
  );
}
