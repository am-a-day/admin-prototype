import { useState, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppHeaderRight } from "@/components/layout/app-header";
import { Sidebar, FullSidebar, NavDrawer, getPageTitle, type SidebarMode } from "@/components/layout/sidebar";
import { ContentHeader, PageLangSwitcher } from "@/components/layout/content-header";
import { PreviewToggle } from "@/components/layout/preview-toggle";
import { HeaderActionsProvider } from "@/contexts/header-actions-context";
import { VitrineLaunchProvider, useVitrineLaunch, type LaunchStage } from "@/contexts/vitrine-launch-context";
import { PhonePreview } from "@/components/preview/phone-preview";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { OrderRoutingProvider } from "@/contexts/order-routing-context";
import { PlanProvider, usePlan } from "@/contexts/plan-context";
import { PublishProvider, usePublish, type PageKey } from "@/contexts/publish-context";
import { PreviewDemoProvider, usePreviewDemo } from "@/contexts/preview-demo-context";
import { ChangeTracker } from "@/components/workspace/change-tracker";
import { DraftToast } from "@/components/workspace/draft-toast";
import { PublishToast } from "@/components/workspace/publish-toast";
import { BookOpen, Flask } from "@phosphor-icons/react";
import {
  banners as seedBanners,
  DEFAULT_RECOMMENDATION_TEXTS,
  RESTAURANT_NAME,
  type AnalyticsTabId,
  type Banner,
  type ManageTabId,
  type PlanId,
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
import { AboutTabs, AboutWorkspace, type AboutTab } from "@/features/storefront/about-workspace";
import { AppearanceWorkspace } from "@/features/storefront/appearance-workspace";
import { CatalogWorkspace, CatalogTabs, StopListShortcut, type CatalogPhase, type CatalogTab, type OverviewFilterId } from "@/features/storefront/catalog-workspace";
import { HomeWorkspace, HomeTabs, type HomeTab } from "@/features/storefront/home-workspace";
import { LaunchPage } from "@/features/storefront/launch-page";
import { UpsellWorkspace } from "@/features/storefront/upsell-workspace";

type PageMeta = { title: string; description?: string; showLanguage?: boolean };
type SidebarPreference = "expanded" | "collapsed" | null;

const SIDEBAR_PREFERENCE_KEY = "admin-prototype:sidebar-preference";

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

const HOME_TAB_META: Record<HomeTab, { title?: string; description?: string }> = {
  banners:  {},
  sections: {},
  promoted: {},
};

function PrototypeToolsFloating({
  catalogPhase,
  setCatalogPhase,
}: {
  catalogPhase: CatalogPhase;
  setCatalogPhase: (phase: CatalogPhase) => void;
}) {
  const [open, setOpen] = useState(false);
  const { planId, setPlanId, daysLeft, setDaysLeftDemo } = usePlan();
  const { stage, forceStage } = useVitrineLaunch();
  const { totalChanges, injectDemoChanges, clearChanges } = usePublish();
  const { emptyVitrine, setEmptyVitrine } = usePreviewDemo();

  return (
    <div className="fixed bottom-5 right-5 z-[210] flex flex-col items-end gap-2">
      {open && (
        <div className="w-[320px] rounded-2xl border border-border bg-white p-3 shadow-xl shadow-zinc-300/40">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Flask size={17} weight="fill" className="text-zinc-500" />
            <div className="text-sm font-semibold text-zinc-900">Prototype tools</div>
          </div>

          <div className="space-y-3">
            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                Статус точки
              </div>
              <div className="flex gap-1">
                {([
                  ["pending", "Ожидает проверки"],
                  ["active", "Активна"],
                ] as [LaunchStage, string][]).map(([s, label]) => {
                  const isActive = s === "active" ? stage === "active" : stage !== "active";
                  return (
                    <button
                      key={s}
                      type="button"
                      onClick={() => forceStage(s)}
                      className={cn(
                        "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                        isActive
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>

            {stage === "active" && (
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  Неопубликованные изменения
                </div>
                <button
                  type="button"
                  onClick={() => injectDemoChanges()}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 transition hover:bg-zinc-50"
                >
                  <span className="whitespace-nowrap">Добавить изменения</span>
                  <span className={cn("relative h-4 w-7 shrink-0 rounded-full transition", totalChanges > 0 ? "bg-blue-600" : "bg-zinc-300")}>
                    <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", totalChanges > 0 ? "left-3.5" : "left-0.5")} />
                  </span>
                </button>
              </div>
            )}

            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                Подписка
              </div>
              <div className="flex gap-1">
                {([
                  [18, "Активна"],
                  [5, "Истекает"],
                  [0, "Истекла"],
                ] as [number, string][]).map(([d, label]) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setDaysLeftDemo(d)}
                    className={cn(
                      "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                      daysLeft === d
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                Тариф
              </div>
              <div className="flex gap-1">
                {(["Start", "Lite", "Ultra"] as PlanId[]).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPlanId(p)}
                    className={cn(
                      "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                      planId === p
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                    )}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                Превью
              </div>
              <button
                type="button"
                onClick={() => setEmptyVitrine(!emptyVitrine)}
                className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 transition hover:bg-zinc-50"
              >
                <span className="whitespace-nowrap">Точка пустая (демо)</span>
                <span className={cn("relative h-4 w-7 shrink-0 rounded-full transition", emptyVitrine ? "bg-blue-600" : "bg-zinc-300")}>
                  <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", emptyVitrine ? "left-3.5" : "left-0.5")} />
                </span>
              </button>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                Каталог
              </div>
              <div className="flex gap-1">
                {([
                  ["empty", "Пустой"],
                  ["has-sections", "Раздел"],
                  ["has-items", "Позиции"],
                ] as [CatalogPhase, string][]).map(([phase, label]) => (
                  <button
                    key={phase}
                    type="button"
                    onClick={() => setCatalogPhase(phase)}
                    className={cn(
                      "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                      catalogPhase === phase
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                Статус публикации
              </div>
              <div className="flex gap-1">
                {([
                  ["review", "На проверке"],
                  ["published", "Опубликовано"],
                  ["changes", "Изменения"],
                ] as ["review" | "published" | "changes", string][]).map(([v, label]) => {
                  const active =
                    v === "review" ? stage === "pending" :
                    v === "published" ? stage === "active" && totalChanges === 0 :
                    stage === "active" && totalChanges > 0;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        if (v === "review") forceStage("pending");
                        else if (v === "published") {
                          forceStage("active");
                          clearChanges();
                        } else {
                          forceStage("active");
                          injectDemoChanges();
                        }
                      }}
                      className={cn(
                        "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                        active
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                      )}
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "flex h-11 w-11 items-center justify-center rounded-full border border-border bg-white text-zinc-600 shadow-lg shadow-zinc-300/40 transition hover:bg-zinc-50 hover:text-zinc-950",
          open && "bg-zinc-100 text-zinc-950",
        )}
        aria-label="Prototype tools"
        title="Prototype tools"
      >
        <Flask size={20} weight="fill" />
      </button>
    </div>
  );
}

function DevNotesFloating({ isCatalogPage }: { isCatalogPage: boolean }) {
  const [open, setOpen] = useState(false);
  const notes = isCatalogPage
    ? [
        {
          title: "Поведение сайдбара",
          text: "Состояние сайдбара — настройка пользователя, а не свойство страницы: Каталог больше не переключает навигацию. В свёрнутом (rail) состоянии наведение временно раскрывает сайдбар поверх контента как flyout — layout не сдвигается. Раскрытый вид можно закрепить (pin).",
        },
        {
          title: "Левая панель",
          text: "Левая панель показывается только когда есть локальная навигация или фильтрация: дерево разделов, фильтры и контекстные списки. Если данных нет, панель скрывается.",
        },
        {
          title: "Пустые состояния",
          text: "Если в каталоге нет разделов или в срезе “На стопе” нет позиций, показывается empty state в основной области.",
        },
        {
          title: "Ширина контента",
          text: "Контент не растягивается на всю доступную ширину. Empty states и простые формы ограничены по max-width.",
        },
        {
          title: "Preview",
          text: "Preview открыт по умолчанию там, где пользователь редактирует структуру или визуальное представление: в разделах и рекомендациях. В обзорных вкладках preview скрыт, чтобы освободить место для списка и фильтров.",
        },
        {
          title: "Стоп-лист",
          text: "Стоп-лист не является отдельной вкладкой. Это быстрый срез во вкладке “Все позиции”, потому что стоп — состояние позиции, а не отдельная сущность каталога.",
        },
      ]
    : [];

  return (
    <div className="fixed bottom-5 right-[78px] z-[210] flex flex-col items-end gap-2">
      {open && (
        <div className="w-[360px] rounded-2xl border border-border bg-white p-4 shadow-xl shadow-zinc-300/40">
          <div className="mb-3 flex items-center gap-2">
            <BookOpen size={17} weight="fill" className="text-zinc-500" />
            <div className="text-sm font-semibold text-zinc-900">
              {isCatalogPage ? "Каталог" : "Решения"}
            </div>
          </div>
          {isCatalogPage ? (
            <div className="space-y-3">
              {notes.map((note) => (
                <div key={note.title}>
                  <div className="text-[12px] font-semibold text-zinc-900">{note.title}</div>
                  <p className="mt-1 text-[12px] leading-5 text-zinc-500">{note.text}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[12px] leading-5 text-zinc-500">
              Для этой страницы пока нет заметок.
            </p>
          )}
        </div>
      )}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className={cn(
          "inline-flex h-11 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm font-medium text-zinc-600 shadow-lg shadow-zinc-300/40 transition hover:bg-zinc-50 hover:text-zinc-950",
          open && "bg-zinc-100 text-zinc-950",
        )}
        aria-label="Решения"
        title="Решения"
      >
        <BookOpen size={18} weight="fill" />
        Решения
      </button>
    </div>
  );
}

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
  const [catalogPhase, setCatalogPhase] = useState<CatalogPhase>("has-items");
  const [catalogTab, setCatalogTab] = useState<CatalogTab>("sections");
  const [catalogOverviewFilterId, setCatalogOverviewFilterId] = useState<OverviewFilterId>("quick:all");
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

  // Sidebar visibility / collapse — the current Figma shell uses a fixed rail on desktop.
  const [userSidebarPreference, setUserSidebarPreference] = useState<SidebarPreference>(() => {
    const saved = window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY);
    return saved === "expanded" || saved === "collapsed" ? saved : "collapsed";
  });
  const [navDrawerOpen, setNavDrawerOpen] = useState(false);

  const wide = viewportWidth >= 1024;        // inline full sidebar fits
  const showInlineSidebar = viewportWidth >= 768; // tablet+ shows at least a rail
  const inlineSidebarMode: SidebarMode = wide && userSidebarPreference === "expanded" ? "full" : "rail";
  const desktopRail = wide && inlineSidebarMode === "rail"; // пользователь свернул сайдбар на десктопе

  const setPreference = (next: Exclude<SidebarPreference, null>) => {
    setUserSidebarPreference(next);
    window.localStorage.setItem(SIDEBAR_PREFERENCE_KEY, next);
  };

  const toggleNav = () => {
    if (wide) {
      setPreference(userSidebarPreference === "collapsed" ? "expanded" : "collapsed");
    } else {
      setNavDrawerOpen((o) => !o);         // narrow → overlay drawer
    }
  };

  // Hover-flyout: в свёрнутом сайдборе на десктопе наведение временно раскрывает
  // навигацию поверх контента, не сдвигая layout. Задержки — hover intent.
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const flyoutTimer = useRef<number | null>(null);
  const pointerX = useRef<number>(Number.POSITIVE_INFINITY);
  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      pointerX.current = event.clientX;
    };

    document.addEventListener("pointermove", onPointerMove);
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, []);
  const scheduleFlyout = (open: boolean, delay: number) => {
    if (flyoutTimer.current) window.clearTimeout(flyoutTimer.current);
    flyoutTimer.current = window.setTimeout(() => {
      if (!open && desktopRail && pointerX.current <= 192) return;
      setFlyoutOpen(open);
    }, delay);
  };
  const pinSidebar = () => {
    setPreference("expanded");
    setFlyoutOpen(false);
  };
  const unpinSidebar = () => {
    setPreference("collapsed");
  };
  useEffect(() => {
    if (!desktopRail && flyoutOpen) setFlyoutOpen(false);
  }, [desktopRail, flyoutOpen]);
  useEffect(() => {
    if (!desktopRail || !flyoutOpen) return;

    const onPointerMove = () => {
      scheduleFlyout(pointerX.current <= 192, pointerX.current <= 192 ? 0 : 150);
    };

    document.addEventListener("pointermove", onPointerMove);
    return () => document.removeEventListener("pointermove", onPointerMove);
  }, [desktopRail, flyoutOpen]);

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
  const navUpsellPage = () => { openStoreTab("catalog"); setCatalogTab("upsell"); };
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

  const addBanner = (imageUrl?: string) => {
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
        ...(imageUrl && { image: imageUrl }),
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
      content = catalogTab === "upsell" ? (
        <UpsellWorkspace
          selectedDishId={selectedDishId}
          setSelectedDishId={setSelectedDishId}
          recommendationTexts={recommendationTexts}
          setRecommendationText={setRecommendationText}
          setUpsellSurface={setUpsellSurface}
          setUpsellFocused={setUpsellFocused}
        />
      ) : (
        <CatalogWorkspace
          selectedDishId={selectedDishId}
          catalogPhase={catalogPhase}
          catalogTab={catalogTab}
          overviewFilterId={catalogOverviewFilterId}
          onOverviewFilterChange={setCatalogOverviewFilterId}
          onCatalogTabChange={setCatalogTab}
          onAdvancePhase={(next) => {
            setCatalogPhase(next);
            if (next === "has-items") markVisited("catalog");
          }}
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

  // После активации витрины страница запуска исчезает — точкой входа становится Каталог.
  useEffect(() => {
    if (stage === "active" && section === "storefront" && storeTab === "launch") {
      setStoreTab("catalog");
    }
  }, [stage, section, storeTab]);

  useEffect(() => {
    if (section === "storefront" && storeTab === "catalog") {
      setPreviewCollapsed(catalogTab !== "sections" && catalogTab !== "upsell");
    }
  }, [section, storeTab, catalogTab]);

  // Публичное отображение использует локальные превью каналов — глобальную
  // превью-панель плавно сворачиваем (как «На стопе» в каталоге), а не размонтируем.
  useEffect(() => {
    if (section === "storefront" && storeTab === "about") {
      setPreviewCollapsed(storeAboutTab === "public-display");
    }
  }, [section, storeTab, storeAboutTab]);

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
  const isCatalogPage = section === "storefront" && storeTab === "catalog";
  const isAboutPage = section === "storefront" && storeTab === "about";
  const isPublicDisplayPage = section === "storefront" && storeTab === "about" && storeAboutTab === "public-display";

  // When catalog is empty, override preview to show the empty-catalog phone screen
  const effectiveScenario: typeof previewScenario =
    section === "storefront" && storeTab === "catalog" && catalogTab !== "upsell" && catalogPhase !== "has-items"
      ? "catalog-empty"
      : previewScenario;

  // When on catalog's Рекомендации tab, preview should show upsell screen
  const effectiveActiveTab = isCatalogPage && catalogTab === "upsell" ? "upsell" : activeTab;
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
    <div className="flex h-screen overflow-hidden bg-[#fbf9f6] text-zinc-950">

      {/* ── Left: full-height sidebar (+ desktop hover flyout) ────────────────── */}
      {showInlineSidebar && (
        <div
          className={cn(
            "relative z-30 flex shrink-0 flex-col transition-[width] duration-300 ease-out",
            inlineSidebarMode === "rail" ? "w-[46px]" : "w-48",
          )}
          onMouseEnter={desktopRail ? () => scheduleFlyout(true, 0) : undefined}
          onMouseMove={desktopRail ? () => scheduleFlyout(true, 0) : undefined}
        >
          <div className={cn("flex min-h-0 flex-1 flex-col", desktopRail && flyoutOpen && "pointer-events-none")}>
            <Sidebar
              section={section}
              activeTab={activeTab}
              onNavigate={guardedNavigate}
              mode={inlineSidebarMode}
              onPin={inlineSidebarMode === "full" ? unpinSidebar : undefined}
              pinned={inlineSidebarMode === "full"}
              showTooltips={!wide}
            />
          </div>

          {/* Flyout: панель «вырастает» из рейла по ширине (48→192), без fade.
              Внутренний слой фиксирован на 192px и не переверстывается — контейнер
              его раскрывает через overflow, иконки остаются на месте. Layout не двигается. */}
          {desktopRail && (
            <div
              className={cn(
                "fixed inset-y-0 left-0 z-40 overflow-hidden transition-[width] duration-150 ease-out",
                flyoutOpen ? "z-[80] w-48 pointer-events-auto shadow-xl shadow-zinc-400/25" : "w-0 pointer-events-none",
              )}
              onMouseEnter={() => scheduleFlyout(true, 0)}
              onMouseLeave={() => scheduleFlyout(false, 150)}
            >
              <div className="flex h-full w-48 flex-col bg-[#fbf9f6]">
                <FullSidebar
                  section={section}
                  activeTab={activeTab}
                  onNavigate={guardedNavigate}
                  onPin={pinSidebar}
                  pinned={false}
                />
              </div>
            </div>
          )}
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
          pageTitle={getPageTitle(section, activeTab)}
          isLaunchPage={isLaunchPage}
        />

        {/* ── Body ─────────────────────────────────────────────────────────── */}
        <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">

          {/* Overlay nav drawer (mobile / narrow screens) */}
          <NavDrawer
            open={navDrawerOpen}
            onClose={() => setNavDrawerOpen(false)}
            section={section}
            activeTab={activeTab}
            onNavigate={guardedNavigate}
          />

          {/* Work area */}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden gap-[6px] pb-3 pr-3 pl-1">
            {/* Toolbar: tabs left + language right */}
            {(isHomePage || isCatalogPage || isAboutPage || pageMeta.showLanguage || previewVisible) && (
              <div className={cn(
                "flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-2",
              )}>
                <div className="shrink-0">
                  {isHomePage && <HomeTabs value={homeTab} onChange={setHomeTab} />}
                  {isCatalogPage && (
                    <div className="flex items-center gap-2">
                      <CatalogTabs
                        value={catalogTab}
                        onChange={(t) => {
                          setCatalogTab(t);
                          if (t === "upsell") markVisited("upsell");
                        }}
                      />
                      <StopListShortcut
                        hidden={catalogTab === "overview" && catalogOverviewFilterId === "status:stop"}
                        onClick={() => {
                          setCatalogTab("overview");
                          setCatalogOverviewFilterId("status:stop");
                        }}
                      />
                    </div>
                  )}
                  {isAboutPage && (
                    <AboutTabs
                      value={storeAboutTab}
                      onChange={(t) => {
                        setStoreAboutTab(t);
                        setPreviewScenario(t === "info" ? "about" : null);
                      }}
                    />
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {pageMeta.showLanguage && <PageLangSwitcher />}
                </div>
              </div>
            )}

          {/* Editor card + preview card side by side */}
          <div className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden">
            {previewVisible && !isPublicDisplayPage && (
              <div className="absolute right-4 top-4 z-20">
                <PreviewToggle
                  open={!previewCollapsed}
                  onToggle={() => setPreviewCollapsed((collapsed) => !collapsed)}
                />
              </div>
            )}

            {/* Editor card */}
            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-[#e7e5e4] bg-[#fbfbf9]">
              <ContentHeader
                title={isLaunchPage || isCatalogPage || isAboutPage ? undefined : isHomePage ? HOME_TAB_META[homeTab].title : pageMeta.title}
                description={isLaunchPage || isCatalogPage || isAboutPage ? undefined : isHomePage ? HOME_TAB_META[homeTab].description : pageMeta.description}
                onRenewPlan={() => guardedNavigate("management", "billing")}
              />
              <div className="flex min-h-0 min-w-0 flex-1">
                <ChangeTracker pageKey={pageKey}>{content}</ChangeTracker>
              </div>
            </div>

            {/* Preview card */}
            {previewVisible && (
              <div className={cn(
                "shrink-0 overflow-hidden rounded-[20px] border border-[#e7e5e4] bg-white shadow-sm transition-[width,margin,opacity] duration-300 ease-out",
                previewCollapsed
                  ? "ml-0 w-0 border-transparent opacity-0 shadow-none"
                  : "ml-3 w-[390px] opacity-100",
              )}>
                <PhonePreview
                  section={section}
                  activeTab={effectiveActiveTab}
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
                />
              </div>
            )}
          </div>
        </div>

        </div>

      </div>

      <DraftToast />
      <PublishToast />
      <DevNotesFloating isCatalogPage={isCatalogPage} />
      <PrototypeToolsFloating catalogPhase={catalogPhase} setCatalogPhase={setCatalogPhase} />
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
