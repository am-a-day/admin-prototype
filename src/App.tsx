import { useState, useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { AppHeaderRight } from "@/components/layout/app-header";
import { Sidebar, FullSidebar, NavDrawer, getPageTitle, type QuickCreateAction, type SidebarMode } from "@/components/layout/sidebar";
import { ContentHeader, PageLangSwitcher } from "@/components/layout/content-header";
import { PreviewReturnButton, PreviewToggle } from "@/components/layout/preview-toggle";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { HeaderActionsProvider } from "@/contexts/header-actions-context";
import { VitrineLaunchProvider, useVitrineLaunch, type LaunchStage } from "@/contexts/vitrine-launch-context";
import { PhonePreview } from "@/components/preview/phone-preview";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { OrderRoutingProvider } from "@/contexts/order-routing-context";
import { PlanProvider, usePlan } from "@/contexts/plan-context";
import { PublishProvider, usePublish, type PageKey } from "@/contexts/publish-context";
import { PreviewDemoProvider, usePreviewDemo } from "@/contexts/preview-demo-context";
import {
  PREVIEW_PANEL_TRANSITION_MS,
  PreviewPanelProvider,
  usePreviewPanel,
} from "@/contexts/preview-panel-context";
import {
  MockAuthProvider,
  useMockAuth,
  type AuthResolution,
} from "@/contexts/mock-auth-context";
import { trackAuthEvent } from "@/lib/auth-analytics";
import {
  catalogStorageKey,
  IS_PRAGMATIC_CATALOG_PREVIEW,
  resetDesignLabStorage,
  resetPragmaticCatalogPreview,
} from "@/lib/catalog-preview";
import {
  readCatalogDataScenario,
  resetCatalogDataScenario,
  selectCatalogDataScenario,
  type CatalogDataScenario,
} from "@/lib/catalog-data-scenarios";
import { CatalogStoreProvider, useCatalogStore } from "@/contexts/catalog-store-context";
import {
  TranslationsProvider,
  useTranslations,
  type TranslationMaterial,
} from "@/contexts/translations-context";
import { PositionEditorFixtureProvider } from "@/features/storefront/catalog/editor/position-editor-fixture-context";
import { PositionEditorDesignLab } from "@/design-lab/position-editor-lab";
import {
  getPositionEditorDesignFixture,
  getPositionEditorDesignScenario,
  type PositionEditorDesignFixture,
} from "@/design-lab/fixtures/position-editor";
import { ChangeTracker } from "@/components/workspace/change-tracker";
import { DraftToast } from "@/components/workspace/draft-toast";
import { PublishToast } from "@/components/workspace/publish-toast";
import { AuthScreen } from "@/features/auth/auth-screen";
import { WorkspaceSetupScreen } from "@/features/auth/workspace-setup-screen";
import { Flask, X } from "@phosphor-icons/react";
import { Bell } from "lucide-react";
import {
  DEFAULT_RECOMMENDATION_TEXTS,
  RESTAURANT_NAME,
  type AnalyticsTabId,
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
import {
  DeliveryWorkspace,
  OrderSettingsSaveIndicator,
  OrderSettingsTabs,
  type OrderSettingsSaveState,
  type OrderSettingsTab,
} from "@/features/management/delivery-workspace";
import { ManagementStub } from "@/features/management/management-stub";
import { AboutTabs, AboutWorkspace, type AboutTab } from "@/features/storefront/about-workspace";
import { AppearanceWorkspace } from "@/features/storefront/appearance-workspace";
import {
  CatalogTabs,
  CatalogWorkspace,
  type CatalogBrowserRoute,
  type CatalogCreateNavigationGuard,
  type CatalogNavigationBoundary,
  type CatalogPhase,
  type CatalogPrimaryTab,
  type CatalogReturnContext,
  type CatalogTab,
  type CatalogViewMode,
  type OverviewFilterId,
} from "@/features/storefront/catalog";
import { HomeWorkspace, HomeTabs, type HomeTab } from "@/features/storefront/home-workspace";
import { LaunchPage } from "@/features/storefront/launch-page";
import { UpsellWorkspace } from "@/features/storefront/upsell-workspace";
import { PublicMenuPage } from "@/features/storefront/public-menu-page";
import { TranslationOverlays, TranslationsWorkspace } from "@/features/storefront/translations-workspace";
import { OwnerTrainingLayout, WaiterTrainingLayout } from "@/features/training/training-layouts";
import { TrainingTabs } from "@/features/training/training-tabs";
import type { TrainingActiveSession, TrainingTab } from "@/features/training/training-data";

type PageMeta = { title: string; description?: string; showLanguage?: boolean };
type SidebarPreference = "expanded" | "collapsed" | null;

function getCatalogHistoryContext(state: unknown = window.history.state): CatalogReturnContext | null {
  if (!state || typeof state !== "object") return null;
  const context = (state as Record<string, unknown>).taskoCatalogContext;
  if (!context || typeof context !== "object" || !("tab" in context)) return null;
  const tab = (context as { tab?: unknown }).tab;
  return tab === "sections" || tab === "overview" ? context as CatalogReturnContext : null;
}

const CATALOG_CREATE_QUERY_PARAM = "createPosition";
const CATALOG_HISTORY_CONTEXT_KEY = "taskoCatalogContext";
const CATALOG_HISTORY_CREATE_KEY = "taskoCatalogCreate";

function getCatalogBrowserRoute(revision: number): CatalogBrowserRoute {
  const params = new URLSearchParams(window.location.search);
  const state = window.history.state;
  return {
    editorNav: params.get("editorNav"),
    sectionId: params.get("sectionId"),
    positionId: params.get("positionId"),
    highlightPositionId: params.get("highlightPositionId"),
    createPosition: params.get(CATALOG_CREATE_QUERY_PARAM) === "1",
    createHistoryEntry: Boolean(
      state
      && typeof state === "object"
      && (state as Record<string, unknown>)[CATALOG_HISTORY_CREATE_KEY] === true
    ),
    returnContext: getCatalogHistoryContext(state),
    location: { url: window.location.href, state },
    revision,
  };
}

function catalogHistoryStateRecord(): Record<string, unknown> {
  return window.history.state && typeof window.history.state === "object"
    ? window.history.state as Record<string, unknown>
    : {};
}

const SIDEBAR_PREFERENCE_KEY = "admin-prototype:sidebar-preference";
const CATALOG_PHASE_STORAGE_KEY = catalogStorageKey("phase");
const TRAINING_PATH = "/training";
const STOREFRONT_PATH = "/storefront";
const ABOUT_PATH = `${STOREFRONT_PATH}/about`;

const ABOUT_PATH_SEGMENTS: Record<AboutTab, string> = {
  info: "profile",
  "language-region": "language-region",
  "guest-rules": "guest-rules",
  "rec-titles": "rec-titles",
  "public-display": "public-display",
};

function normalizeAboutTab(tab: string | null | undefined): AboutTab {
  if (tab === "profile" || tab === "info") return "info";
  if (
    tab === "language-region" ||
    tab === "guest-rules" ||
    tab === "rec-titles" ||
    tab === "public-display"
  ) {
    return tab;
  }
  return "info";
}

function getAboutPath(tab: AboutTab) {
  return `${ABOUT_PATH}/${ABOUT_PATH_SEGMENTS[tab]}`;
}

function getInitialStorefrontRoute() {
  const path = window.location.pathname.replace(/\/+$/, "");
  const [, sectionSegment, storeTabSegment, aboutTabSegment] = path.split("/");
  if (sectionSegment !== "storefront") {
    return { storeTab: "catalog" as StoreTabId, aboutTab: "info" as AboutTab };
  }
  const storeTab: StoreTabId =
    storeTabSegment === "home" ||
    storeTabSegment === "catalog" ||
    storeTabSegment === "translations" ||
    storeTabSegment === "upsell" ||
    storeTabSegment === "appearance" ||
    storeTabSegment === "about" ||
    storeTabSegment === "launch"
      ? storeTabSegment
      : "catalog";
  return {
    storeTab,
    aboutTab: storeTab === "about" ? normalizeAboutTab(aboutTabSegment) : "info",
  };
}

function isTrainingPath(pathname: string) {
  const path = pathname.replace(/\/+$/, "");
  return path === TRAINING_PATH || path.startsWith(`${TRAINING_PATH}/`);
}

function normalizeTrainingTab(tab: string | null | undefined): TrainingTab {
  if (tab === "cards" || tab === "menu") return "cards";
  if (tab === "check") return "check";
  if (tab === "practice" || tab === "trainer") return "trainer";
  if (tab === "progress") return "progress";
  return "trainer";
}

function getInitialTrainingTab() {
  const path = window.location.pathname.replace(/\/+$/, "");
  const [, trainingSegment, tabSegment] = path.split("/");
  if (trainingSegment !== "training") return "trainer";
  return normalizeTrainingTab(tabSegment);
}

function getTrainingPath(tab: TrainingTab) {
  if (tab === "trainer") return `${TRAINING_PATH}/practice`;
  return `${TRAINING_PATH}/${tab}`;
}

function getTrainingSessionExitMessage(kind?: TrainingActiveSession) {
  if (kind === "cards") return "Завершить изучение?\n\nПрогресс текущей сессии будет потерян";
  if (kind === "check") return "Завершить проверку?\n\nНезавершённая попытка не попадёт в результаты";
  return "Завершить упражнение?\n\nТекущий раунд не будет сохранён";
}

const PAGE_META: Record<string, PageMeta> = {
  "storefront:launch":     { title: "Моя витрина",       description: "Центр состояния витрины." },
  "storefront:home":       { title: "Главная витрины",    description: "Баннеры, ключевые разделы и продвигаемые позиции.", showLanguage: true },
  "storefront:catalog":    { title: "Каталог",            description: "Разделы, позиции и карточки меню.",                showLanguage: true },
  "storefront:translations": { title: "Переводы",          description: "Языки и переводы контента онлайн-меню." },
  "storefront:upsell":     { title: "Рекомендации",       description: "Что предложить вместе с позициями.",              showLanguage: true },
  "storefront:appearance": { title: "Оформление",         description: "Стиль карточек, цвет и фон витрины.",             showLanguage: true },
  "storefront:about":      { title: "Заведение",          description: "Информация о заведении и публичное представление.", showLanguage: true },
  "management:order-settings": { title: "Настройка заказов", description: "Настройте способы получения заказов и обслуживание гостей.", showLanguage: true },
  "management:order-history":  { title: "История заказов",   description: "Все входящие заказы — доставка и самовывоз." },
  "management:billing":    { title: "Тарифы",             description: "Текущий план, ограничения и возможности следующего." },
  "management:account":    { title: "Аккаунт",            description: "Личные данные владельца и доступ к аккаунту." },
  "management:io":         { title: "Импорт / экспорт",   description: "Загрузка и выгрузка меню, данных и настроек." },
  "management:seo":        { title: "SEO",                 description: "Метатеги, заголовок и описание для поисковиков." },
  "analytics:scans":       { title: "Сканирования",       description: "Количество сканирований QR-кода и переходов." },
  "analytics:orders":      { title: "Заказы",             description: "Выручка, средний чек и динамика по времени." },
  "analytics:likes":       { title: "Лайки",              description: "Лайки гостей по блюдам и разделам меню." },
  "qr":                    { title: "QR-коды",            description: "Генерация и управление QR-кодами." },
  "training:trainer":      { title: "Обучение",           description: "Тренажёры для официантов на данных текущего каталога." },
  "training:cards":        { title: "Обучение",           description: "Карточки для самостоятельного изучения меню." },
  "training:check":        { title: "Обучение",           description: "Проверка знаний по меню." },
  "training:progress":     { title: "Обучение",           description: "Прогресс обучения официантов." },
};

const HOME_TAB_META: Record<HomeTab, { title?: string; description?: string }> = {
  banners:  {},
  sections: {},
  promoted: {},
};

function PrototypeToolsPanel({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [catalogDataScenario] = useState(readCatalogDataScenario);
  const { planId, setPlanId, daysLeft, setDaysLeftDemo } = usePlan();
  const { stage, forceStage } = useVitrineLaunch();
  const { totalChanges, injectDemoChanges, clearChanges } = usePublish();
  const { emptyVitrine, setEmptyVitrine } = usePreviewDemo();
  const { account, updateWorkspace, confirmStorefrontReview, disableStorefrontReview } = useMockAuth();

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onOpenChange(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onOpenChange, open]);

  if (!open) return null;

  return (
    <div className="fixed bottom-5 left-1/2 z-[210] max-h-[calc(100dvh-40px)] w-[320px] -translate-x-1/2 overflow-y-auto rounded-2xl border border-border bg-white p-3 shadow-xl shadow-zinc-300/40">
          <div className="mb-2 flex items-center gap-2 px-1">
            <Flask size={17} weight="fill" className="text-zinc-500" />
            <div className="flex-1 text-sm font-semibold text-zinc-900">Prototype tools</div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              aria-label="Закрыть Prototype tools"
              className="h-7 w-7 rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
            >
              <X size={15} />
            </Button>
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
                Данные каталога
              </div>
              <div className="flex gap-1">
                {([
                  ["empty", "Пустой"],
                  ["demo", "Демо"],
                  ["client", "Клиентский"],
                ] as [CatalogDataScenario, string][]).map(([scenario, label]) => (
                  <button
                    key={scenario}
                    type="button"
                    onClick={() => {
                      selectCatalogDataScenario(scenario);
                      window.location.reload();
                    }}
                    className={cn(
                      "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                      catalogDataScenario === scenario
                        ? "border-blue-500 bg-blue-50 text-blue-700"
                        : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                onClick={() => {
                  resetCatalogDataScenario(catalogDataScenario);
                  window.location.reload();
                }}
                className="mt-1.5 w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-left text-[11px] font-semibold text-zinc-600 transition hover:bg-zinc-50"
              >
                Сбросить сценарий
              </button>
            </div>

            <div>
              <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                Статус публикации
              </div>
              <div className="flex gap-1">
                {([
                  ["draft", "Черновик"],
                  ["published", "Опубликовано"],
                  ["changes", "Изменения"],
                ] as const).map(([v, label]) => {
                  const active = account?.workspace.status === v;
                  return (
                    <button
                      key={v}
                      type="button"
                      onClick={() => {
                        updateWorkspace({ status: v });
                        if (v === "published" || v === "draft") {
                          clearChanges();
                        } else {
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
              {account && account.workspace.review.status !== "unpublished" && (
                <div className="mt-1 flex gap-1">
                  <button
                    type="button"
                    onClick={() => confirmStorefrontReview(account.id)}
                    className={cn(
                      "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                      account.workspace.review.status !== "disabled-manual" && account.workspace.review.status !== "disabled-timeout"
                        ? "border-emerald-500 bg-emerald-50 text-emerald-700"
                        : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                    )}
                  >
                    Доступна
                  </button>
                  <button
                    type="button"
                    onClick={() => disableStorefrontReview(account.id, "Добавьте актуальные контакты и уточните данные заведения")}
                    className={cn(
                      "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                      account.workspace.review.status === "disabled-manual" || account.workspace.review.status === "disabled-timeout"
                        ? "border-red-500 bg-red-50 text-red-700"
                        : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                    )}
                  >
                    Отключена
                  </button>
                </div>
              )}
            </div>

            {IS_PRAGMATIC_CATALOG_PREVIEW && (
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  Pragmatic preview
                </div>
                <button
                  type="button"
                  onClick={resetPragmaticCatalogPreview}
                  className="w-full rounded-lg border border-border bg-white px-2.5 py-1.5 text-left text-[11px] font-semibold text-zinc-600 transition hover:bg-zinc-50"
                >
                  Сбросить дерево к исходным данным
                </button>
              </div>
            )}
          </div>
        </div>
  );
}

function AuthenticatedShell() {
  const { account } = useMockAuth();
  const { registerChange } = usePublish();
  const { markVisited, stage } = useVitrineLaunch();
  const { activeEditorItemId, itemsById } = useCatalogStore();
  const {
    banners: bannerList,
    updateBanner,
    removeBanner: removeSharedBanner,
    addBanner: addSharedBanner,
  } = useTranslations();
  const isInitialTrainingRoute = isTrainingPath(window.location.pathname);
  const initialStorefrontRoute = getInitialStorefrontRoute();
  const isWaiterTrainingRoute = isInitialTrainingRoute && new URLSearchParams(window.location.search).get("role") === "waiter";
  const initialCatalogParams = new URLSearchParams(window.location.search);
  const initialCatalogCreate = initialStorefrontRoute.storeTab === "catalog" && initialCatalogParams.get("createPosition") === "1";
  const initialCatalogContext = getCatalogHistoryContext();
  const initialCatalogSectionId = initialCatalogParams.get("sectionId");
  const [section, setSection] = useState<SectionId>(isInitialTrainingRoute ? "training" : "storefront");
  const [storeTab, setStoreTab] = useState<StoreTabId>(initialStorefrontRoute.storeTab);
  const [storeAboutTab, setStoreAboutTab] = useState<AboutTab>(initialStorefrontRoute.aboutTab);
  const [manageTab, setManageTab] = useState<ManageTabId>("order-settings");
  const [orderSettingsTab, setOrderSettingsTab] = useState<OrderSettingsTab>("delivery");
  const [orderSettingsSaveState, setOrderSettingsSaveState] = useState<OrderSettingsSaveState>("saved");
  const [orderChannelsOpen, setOrderChannelsOpen] = useState(false);
  const [analyticsTab, setAnalyticsTab] = useState<AnalyticsTabId>("scans");
  const [trainingTab, setTrainingTab] = useState<TrainingTab>(() => getInitialTrainingTab());
  const [trainingQuizActive, setTrainingQuizActive] = useState(false);
  const [trainingActiveSessionKind, setTrainingActiveSessionKind] = useState<TrainingActiveSession | undefined>();
  const [selectedDishId, setSelectedDishId] = useState("pepperoni");
  const [selectedBannerId, setSelectedBannerId] = useState(() => bannerList[0]?.id ?? "");
  const [previewScenario, setPreviewScenario] = useState<PreviewScenario>(null);
  const [recommendationTexts, setRecommendationTexts] = useState<RecommendationTexts>(
    DEFAULT_RECOMMENDATION_TEXTS,
  );
  const [upsellSurface, setUpsellSurface] = useState<UpsellSurface>("dish");
  const [catalogPhase, setCatalogPhase] = useState<CatalogPhase>(() => {
    const stored = window.localStorage.getItem(CATALOG_PHASE_STORAGE_KEY);
    if (stored === "empty" || stored === "has-sections" || stored === "has-items") return stored;
    return account?.workspace.firstEntry ? "empty" : "has-items";
  });
  const [catalogTab, setCatalogTab] = useState<CatalogTab>(() =>
    initialCatalogCreate ? "overview" : initialCatalogContext?.tab ?? "sections",
  );
  const [catalogStopListActive, setCatalogStopListActive] = useState(false);
  const [catalogStopListFilterId, setCatalogStopListFilterId] = useState<OverviewFilterId>("quick:all");
  const [catalogStopListSectionScopeId, setCatalogStopListSectionScopeId] = useState<string | null>(null);
  const [catalogOverviewFilterId, setCatalogOverviewFilterId] = useState<OverviewFilterId>(() =>
    initialCatalogContext?.tab === "overview" ? initialCatalogContext.filterId : "quick:all",
  );
  const lastNonStopCatalogFilterRef = useRef<OverviewFilterId>(
    catalogOverviewFilterId === "status:stop" ? "quick:all" : catalogOverviewFilterId,
  );
  const [catalogViewMode, setCatalogViewMode] = useState<CatalogViewMode>(() =>
    initialCatalogContext?.tab === "overview"
      ? initialCatalogContext.filterId
      : initialCatalogCreate ? "quick:all" : "sections",
  );
  const [catalogSectionScopeId, setCatalogSectionScopeId] = useState<string | null>(() =>
    initialCatalogCreate
      ? initialCatalogSectionId
      : initialCatalogContext?.tab === "overview"
        ? initialCatalogContext.sectionScopeId
        : initialCatalogContext?.sectionId ?? null,
  );
  const [catalogResetSignal] = useState(0);
  const [catalogRouteRevision, setCatalogRouteRevision] = useState(0);
  const catalogCreateNavigationGuardRef = useRef<CatalogCreateNavigationGuard | null>(null);
  const skipNextCatalogPopGuardRef = useRef(false);
  const [homeTab, setHomeTab] = useState<HomeTab>("banners");
  const [quickCatalogCreate, setQuickCatalogCreate] = useState<{ id: number; action: "section" | "iiko" | "sheets" } | null>(null);
  const [quickStandaloneCreate, setQuickStandaloneCreate] = useState<{ id: number; action: "promo" | "qr" } | null>(null);
  const [qrToolTab, setQrToolTab] = useState<"promo" | "qr">("qr");
  const updateCatalogPhase = (next: CatalogPhase) => {
    setCatalogPhase(next);
    window.localStorage.setItem(CATALOG_PHASE_STORAGE_KEY, next);
    registerChange("catalog");
  };

  // SEO preview data — lifted here so PhonePreview can render the "seoLink" scenario
  const [seoTitle, setSeoTitle] = useState(`${RESTAURANT_NAME} — корейская кухня`);
  const [seoDescription, setSeoDescription] = useState(
    "Авторские корейские блюда с доставкой и самовывозом. Заказывайте онлайн.",
  );
  const [upsellFocused, setUpsellFocused] = useState(false);
  const [homeFocus, setHomeFocus] = useState<"hero" | "sections" | null>(null);

  // Панель превью можно скрыть — чисто пользовательский тумблер, не зависит
  // от вкладки/фильтра/выбранной позиции каталога.
  const [previewCollapsed, setPreviewCollapsed] = useState(false);
  const [prototypeToolsOpen, setPrototypeToolsOpen] = useState(false);
  const changeCatalogViewMode = (mode: CatalogViewMode) => {
    setCatalogStopListActive(false);
    setCatalogViewMode(mode);
    if (mode === "sections") {
      setCatalogTab("sections");
      return;
    }
    setCatalogTab("overview");
    setCatalogOverviewFilterId(mode);
    if (mode !== "status:stop") lastNonStopCatalogFilterRef.current = mode;
  };
  const requestCatalogNavigation = (navigate: () => void) => {
    if (catalogCreateNavigationGuardRef.current) {
      catalogCreateNavigationGuardRef.current.request(navigate);
      return;
    }
    navigate();
  };
  const catalogNavigation: CatalogNavigationBoundary = {
    route: getCatalogBrowserRoute(catalogRouteRevision),
    replaceSection: (sectionId) => {
      const url = new URL(window.location.href);
      url.searchParams.delete("positionId");
      url.searchParams.set("sectionId", sectionId);
      window.history.replaceState(null, "", url);
      setCatalogRouteRevision((revision) => revision + 1);
    },
    replacePosition: (positionId) => {
      const url = new URL(window.location.href);
      url.searchParams.delete("sectionId");
      url.searchParams.set("positionId", positionId);
      window.history.replaceState(null, "", url);
      setCatalogRouteRevision((revision) => revision + 1);
    },
    consumeHighlightPosition: () => {
      const url = new URL(window.location.href);
      url.searchParams.delete("highlightPositionId");
      window.history.replaceState(window.history.state, "", url);
      setCatalogRouteRevision((revision) => revision + 1);
    },
    prepareDirectCreate: (sectionId, returnContext) => {
      const returnUrl = new URL(window.location.href);
      returnUrl.searchParams.delete(CATALOG_CREATE_QUERY_PARAM);
      returnUrl.searchParams.delete("positionId");
      const returnState = {
        ...catalogHistoryStateRecord(),
        [CATALOG_HISTORY_CONTEXT_KEY]: returnContext,
        [CATALOG_HISTORY_CREATE_KEY]: false,
      };
      window.history.replaceState(returnState, "", returnUrl);

      const createUrl = new URL(returnUrl);
      createUrl.searchParams.set(CATALOG_CREATE_QUERY_PARAM, "1");
      if (sectionId) createUrl.searchParams.set("sectionId", sectionId);
      else createUrl.searchParams.delete("sectionId");
      window.history.pushState({
        ...returnState,
        [CATALOG_HISTORY_CREATE_KEY]: true,
      }, "", createUrl);
      setCatalogRouteRevision((revision) => revision + 1);
    },
    replaceDirectCreateDestination: (returnContext, sectionId) => {
      const url = new URL(window.location.href);
      url.searchParams.delete(CATALOG_CREATE_QUERY_PARAM);
      url.searchParams.delete("positionId");
      if (sectionId) url.searchParams.set("sectionId", sectionId);
      else url.searchParams.delete("sectionId");
      window.history.replaceState({
        ...catalogHistoryStateRecord(),
        [CATALOG_HISTORY_CONTEXT_KEY]: returnContext,
        [CATALOG_HISTORY_CREATE_KEY]: false,
      }, "", url);
      setCatalogRouteRevision((revision) => revision + 1);
    },
    back: () => window.history.back(),
  };
  const changeCatalogTab = (next: CatalogTab) => {
    requestCatalogNavigation(() => {
      setCatalogStopListActive(false);
      setCatalogTab(next);
      if (next === "overview") {
        const nextFilter = catalogViewMode === "sections"
          ? lastNonStopCatalogFilterRef.current
          : catalogViewMode;
        setCatalogViewMode(nextFilter);
        setCatalogOverviewFilterId(nextFilter);
        if (nextFilter !== "status:stop") lastNonStopCatalogFilterRef.current = nextFilter;
      } else if (next === "sections") {
        setCatalogViewMode("sections");
      }
    });
  };
  const catalogPrimaryTab: CatalogPrimaryTab = catalogTab === "upsell"
    ? "upsell"
    : catalogStopListActive
      ? "stop-list"
      : "sections";
  const changeCatalogPrimaryTab = (next: CatalogPrimaryTab) => {
    if (next === "sections") {
      requestCatalogNavigation(() => {
        const restoredFilter = catalogViewMode === "status:stop"
          ? lastNonStopCatalogFilterRef.current
          : catalogViewMode === "sections" ? "quick:all" : catalogViewMode;
        setCatalogTab("overview");
        setCatalogStopListActive(false);
        setCatalogViewMode(restoredFilter);
        setCatalogOverviewFilterId(restoredFilter);
      });
      return;
    }
    if (next === "overview") {
      if (catalogViewMode === "status:stop") {
        requestCatalogNavigation(() => {
          const restoredFilter = lastNonStopCatalogFilterRef.current;
          setCatalogTab("overview");
          setCatalogViewMode(restoredFilter);
          setCatalogOverviewFilterId(restoredFilter);
        });
        return;
      }
      changeCatalogTab("overview");
      return;
    }
    if (next === "upsell") {
      setCatalogStopListActive(false);
      changeCatalogTab("upsell");
      return;
    }
    if (next === "stop-list") {
      requestCatalogNavigation(() => {
        setCatalogStopListActive(true);
        setCatalogTab("overview");
      });
      return;
    }
  };
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

  // Sidebar visibility / collapse — desktop starts expanded, matching the shared shell in Figma.
  const [userSidebarPreference, setUserSidebarPreference] = useState<SidebarPreference>(() => {
    const saved = window.localStorage.getItem(SIDEBAR_PREFERENCE_KEY);
    return saved === "expanded" || saved === "collapsed" ? saved : "expanded";
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
  // навигацию поверх контента, не сдвигая layout. Hover работает только на мыши.
  const [flyoutOpen, setFlyoutOpen] = useState(false);
  const [canHoverSidebar, setCanHoverSidebar] = useState(() =>
    window.matchMedia("(hover: hover) and (pointer: fine)").matches,
  );
  useEffect(() => {
    const media = window.matchMedia("(hover: hover) and (pointer: fine)");
    const update = () => setCanHoverSidebar(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);
  const autoHoverRail = desktopRail && canHoverSidebar;
  useEffect(() => {
    if (!autoHoverRail) setFlyoutOpen(false);
  }, [autoHoverRail]);
  useEffect(() => {
    if (!desktopRail && flyoutOpen) setFlyoutOpen(false);
  }, [desktopRail, flyoutOpen]);

  const pinSidebar = () => {
    setPreference("expanded");
    setFlyoutOpen(false);
  };
  const unpinSidebar = () => {
    setPreference("collapsed");
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
    const nextPath = tab === "about" ? getAboutPath("info") : `${STOREFRONT_PATH}/${tab}`;
    if (window.location.pathname !== nextPath || window.location.search) {
      window.history.pushState(null, "", nextPath);
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
  const navUpsellPage = () => { openStoreTab("catalog"); changeCatalogTab("upsell"); };
  const navAbout = () => openStoreTab("about");
  const navCatalogDish = (id: string) => {
    setSelectedDishId(id);
    openStoreTab("catalog");
  };

  const activeTab =
    section === "storefront" ? storeTab :
    section === "management" ? manageTab :
    section === "analytics" ? analyticsTab :
    section === "training" ? trainingTab :
    section === "qr" ? qrToolTab :
    null;

  const removeBanner = (id: string) => {
    const nextSelectedId = removeSharedBanner(id);
    if (id === selectedBannerId) setSelectedBannerId(nextSelectedId ?? "");
  };

  const addBanner = (imageUrl?: string) => {
    setSelectedBannerId(addSharedBanner(imageUrl));
  };

  const previewBanner =
    bannerList.find((b) => b.id === selectedBannerId) ?? bannerList[0] ?? null;

  const navigate = (next: SectionId, tab: string) => {
    setSection(next);
    setPreviewScenario(null);
    if (next === "training") {
      const nextTrainingTab = normalizeTrainingTab(tab);
      setTrainingTab(nextTrainingTab);
      const nextPath = getTrainingPath(nextTrainingTab);
      if (window.location.pathname !== nextPath || window.location.search) {
        window.history.pushState(null, "", nextPath);
      }
    } else if (next !== "storefront" && (
      isTrainingPath(window.location.pathname) ||
      window.location.pathname.startsWith(`${STOREFRONT_PATH}/`)
    )) {
      setTrainingQuizActive(false);
      window.history.pushState(null, "", "/");
    }
    if (next === "storefront") {
      const [storefrontTab, nestedTab] = tab.split(":");
      setStoreTab(storefrontTab as StoreTabId);
      if (storefrontTab === "about") {
        const aboutTab = normalizeAboutTab(nestedTab);
        setStoreAboutTab(aboutTab);
        setPreviewScenario(aboutTab === "info" ? "about" : null);
        if (aboutTab === "language-region") {
          window.requestAnimationFrame(() => {
            window.requestAnimationFrame(() => {
              document
                .getElementById("about-language-region-top")
                ?.scrollIntoView({ block: "start" });
            });
          });
        }
      }
      // Mark launch checklist steps as visited
      // (catalog is marked only when user adds first item — see CatalogWorkspace onAdvancePhase)
      if (storefrontTab === "home") markVisited("home");
      if (storefrontTab === "appearance") markVisited("appearance");
      if (storefrontTab === "about") markVisited("about");
      const nextPath =
        storefrontTab === "about"
          ? getAboutPath(normalizeAboutTab(nestedTab))
          : `${STOREFRONT_PATH}/${storefrontTab}`;
      if (window.location.pathname !== nextPath || window.location.search) {
        window.history.pushState(null, "", nextPath);
      }
    }
    if (next === "management") {
      setManageTab(tab as ManageTabId);
      if (tab === "order-settings") markVisited("ordering");
    }
    if (next === "analytics") setAnalyticsTab(tab as AnalyticsTabId);
    if (next === "qr") setQrToolTab(tab === "promo" ? "promo" : "qr");
  };

  const openOrderAcceptance = () => {
    setSection("management");
    setManageTab("order-settings");
    setPreviewScenario(null);
  };

  const guardedNavigate = (next: SectionId, tab: string) => {
    const continueNavigation = () => navigate(next, tab);
    if (catalogCreateNavigationGuardRef.current) {
      catalogCreateNavigationGuardRef.current.request(continueNavigation);
      return;
    }
    continueNavigation();
  };

  useEffect(() => {
    const openTranslations = () => navigate("storefront", "translations");
    window.addEventListener("tasko:open-translations", openTranslations);
    return () => window.removeEventListener("tasko:open-translations", openTranslations);
  }, []);

  const openCatalogItemFromTranslations = (itemId: string) => {
    const target = itemsById[itemId];
    setSection("storefront");
    setStoreTab("catalog");
    setCatalogTab("overview");
    setCatalogViewMode("quick:all");
    setCatalogOverviewFilterId("quick:all");
    setCatalogSectionScopeId(target?.sectionId ?? null);
    const url = new URL(`${window.location.origin}${STOREFRONT_PATH}/catalog`);
    url.searchParams.set("positionId", itemId);
    if (target?.sectionId) url.searchParams.set("sectionId", target.sectionId);
    window.history.pushState(null, "", url);
    setCatalogRouteRevision((revision) => revision + 1);
  };

  const openOriginalFromTranslations = (material: TranslationMaterial) => {
    if (material.catalogItemId) {
      openCatalogItemFromTranslations(material.catalogItemId);
      return;
    }
    if (material.kind === "section") {
      setSection("storefront");
      setStoreTab("catalog");
      setCatalogTab("sections");
      setCatalogViewMode("sections");
      setCatalogSectionScopeId(material.entityId);
      window.history.pushState(null, "", `${STOREFRONT_PATH}/catalog`);
      return;
    }
    if (material.kind === "banner") {
      setSelectedBannerId(material.entityId);
      setHomeTab("banners");
      navigate("storefront", "home");
      return;
    }
    if (material.kind === "about") {
      navigate("storefront", "about:info");
      return;
    }
    if (material.kind === "tag" || material.kind === "sticker") {
      setCatalogTab("overview");
      setCatalogViewMode(material.kind === "tag" ? "quick:with-tags" : "quick:with-labels");
      setCatalogOverviewFilterId(material.kind === "tag" ? "quick:with-tags" : "quick:with-labels");
      navigate("storefront", "catalog");
    }
  };

  const handleQuickCreate = (action: QuickCreateAction) => {
    if (action === "banner") {
      guardedNavigate("storefront", "home");
      setHomeTab("banners");
      addBanner();
      return;
    }
    if (action === "promo" || action === "qr") {
      setQuickStandaloneCreate({ id: Date.now(), action });
      setQrToolTab(action);
      guardedNavigate("qr", action);
      return;
    }
    if (action === "position") {
      requestCatalogNavigation(() => {
        navigate("storefront", "catalog");
        setCatalogTab("overview");
        setCatalogViewMode("quick:all");
        setCatalogOverviewFilterId("quick:all");
        const url = new URL(window.location.href);
        url.searchParams.set(CATALOG_CREATE_QUERY_PARAM, "1");
        url.searchParams.delete("positionId");
        window.history.pushState({ [CATALOG_HISTORY_CREATE_KEY]: true }, "", url);
        setCatalogRouteRevision((revision) => revision + 1);
      });
      return;
    }
    setQuickCatalogCreate({ id: Date.now(), action });
    guardedNavigate("storefront", "catalog");
  };

  useEffect(() => {
    const handlePopState = (event: PopStateEvent) => {
      const createGuard = catalogCreateNavigationGuardRef.current;
      if (createGuard && !skipNextCatalogPopGuardRef.current) {
        window.history.pushState(createGuard.location.state, "", createGuard.location.url);
        createGuard.requestBack(() => {
          skipNextCatalogPopGuardRef.current = true;
          window.history.back();
        });
        return;
      }
      if (skipNextCatalogPopGuardRef.current) skipNextCatalogPopGuardRef.current = false;
      setCatalogRouteRevision((revision) => revision + 1);
      if (isTrainingPath(window.location.pathname)) {
        setSection("training");
        setTrainingTab(getInitialTrainingTab());
        setPreviewScenario(null);
        return;
      }

      const route = getInitialStorefrontRoute();
      setSection("storefront");
      setStoreTab(route.storeTab);
      setStoreAboutTab(route.aboutTab);
      if (route.storeTab === "catalog") {
        const params = new URLSearchParams(window.location.search);
        const createOpen = params.get("createPosition") === "1";
        const context = getCatalogHistoryContext(event.state);
        if (createOpen) {
          setCatalogTab("overview");
          setCatalogViewMode(context?.tab === "overview" ? context.filterId : "quick:all");
          setCatalogOverviewFilterId(context?.tab === "overview" ? context.filterId : "quick:all");
          setCatalogSectionScopeId(params.get("sectionId"));
        } else if (context?.tab === "overview") {
          setCatalogTab("overview");
          setCatalogViewMode(context.filterId);
          setCatalogOverviewFilterId(context.filterId);
          setCatalogSectionScopeId(context.sectionScopeId);
        } else if (context?.tab === "sections") {
          setCatalogTab("sections");
          setCatalogViewMode("sections");
          setCatalogSectionScopeId(context.sectionId);
        }
      }
      setPreviewScenario(
        route.storeTab === "about" && route.aboutTab === "info" ? "about" : null,
      );
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const changeTrainingTab = (tab: TrainingTab) => {
    if (trainingQuizActive && tab !== trainingTab) {
      const confirmed = window.confirm(getTrainingSessionExitMessage(trainingActiveSessionKind));
      if (!confirmed) return;
      setTrainingQuizActive(false);
      setTrainingActiveSessionKind(undefined);
    }
    setTrainingTab(tab);
    const nextPath = getTrainingPath(tab);
    if (window.location.pathname !== nextPath || window.location.search) {
      window.history.pushState(null, "", nextPath);
    }
  };

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
          onOpenPosition={(id) => {
            requestCatalogNavigation(() => {
              const target = itemsById[id];
              const url = new URL(window.location.href);
              url.searchParams.set("positionId", id);
              if (target?.sectionId) url.searchParams.set("sectionId", target.sectionId);
              url.searchParams.delete("createPosition");
              window.history.pushState(null, "", url);
              setCatalogTab("overview");
              setCatalogViewMode("quick:all");
              setCatalogOverviewFilterId("quick:all");
              setCatalogSectionScopeId(target?.sectionId ?? null);
            });
          }}
        />
      ) : (
        <CatalogWorkspace
          navigation={catalogNavigation}
          selectedDishId={selectedDishId}
          catalogPhase={catalogPhase}
          catalogTab={catalogTab}
          stopListActive={catalogStopListActive}
          viewMode={catalogViewMode}
          sectionScopeId={catalogSectionScopeId}
          stopListFilterId={catalogStopListFilterId}
          stopListSectionScopeId={catalogStopListSectionScopeId}
          resetSignal={catalogResetSignal}
          onOverviewFilterChange={setCatalogOverviewFilterId}
          onViewModeChange={changeCatalogViewMode}
          onSectionScopeChange={setCatalogSectionScopeId}
          onStopListFilterChange={setCatalogStopListFilterId}
          onStopListSectionScopeChange={setCatalogStopListSectionScopeId}
          onCatalogTabChange={setCatalogTab}
          onRegisterCreateNavigationGuard={(guard) => {
            catalogCreateNavigationGuardRef.current = guard;
          }}
          onAdvancePhase={(next) => {
            updateCatalogPhase(next);
            if (next === "has-items") markVisited("catalog");
          }}
          quickCreateRequest={quickCatalogCreate}
          onQuickCreateHandled={() => setQuickCatalogCreate(null)}
        />
      );
    }
    if (storeTab === "translations") {
      content = <TranslationsWorkspace onOpenOriginal={openOriginalFromTranslations} />;
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
          onOpenTranslations={() => navigate("storefront", "translations")}
        />
      );
    }
  } else if (section === "management") {
    if (manageTab === "order-settings") {
      content = (
        <DeliveryWorkspace
          activeTab={orderSettingsTab}
          onSaveStateChange={setOrderSettingsSaveState}
          channelsManagerOpen={orderChannelsOpen}
          onChannelsManagerOpenChange={setOrderChannelsOpen}
        />
      );
    } else if (manageTab === "order-history") {
      content = <OrderHistoryPage />;
    } else {
      content = <ManagementStub tabId={manageTab} />;
    }
  } else if (section === "analytics") {
    content = <AnalyticsPage tab={analyticsTab} />;
  } else if (section === "training") {
    content = (
      <OwnerTrainingLayout
        activeTab={trainingTab}
        onQuizActiveChange={(active, kind) => {
          setTrainingQuizActive(active);
          setTrainingActiveSessionKind(kind);
        }}
      />
    );
  } else {
    content = (
      <QRPage
        mode={qrToolTab}
        createRequestId={quickStandaloneCreate?.id ?? null}
        onCreateHandled={() => setQuickStandaloneCreate(null)}
      />
    );
  }

  // После активации витрины страница запуска исчезает — точкой входа становится Каталог.
  useEffect(() => {
    if (stage === "active" && section === "storefront" && storeTab === "launch") {
      setStoreTab("catalog");
    }
  }, [stage, section, storeTab]);

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

  if (section === "training" && isWaiterTrainingRoute) {
    return <WaiterTrainingLayout />;
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
  const isTranslationsPage = section === "storefront" && storeTab === "translations";
  const isAboutPage = section === "storefront" && storeTab === "about";
  const isOrderSettingsPage = section === "management" && manageTab === "order-settings";
  const isTrainingPage = section === "training";
  const isPublicDisplayPage = section === "storefront" && storeTab === "about" && storeAboutTab === "public-display";

  // When catalog is empty, override preview to show the empty-catalog phone screen
  const effectiveScenario: typeof previewScenario =
    section === "storefront" && storeTab === "catalog" && catalogTab !== "upsell" && catalogPhase !== "has-items"
      ? "catalog-empty"
      : previewScenario;

  // When on catalog's Recommendations tab, preview should show the recommendation screen.
  const effectiveActiveTab: StoreTabId | ManageTabId | AnalyticsTabId | null =
    isCatalogPage && catalogTab === "upsell" ? "upsell" :
    isTrainingPage ? null :
    (activeTab as StoreTabId | ManageTabId | AnalyticsTabId | null);
  const previewVisible = section === "storefront" && !isTranslationsPage;

  const metaKey =
    section === "storefront" ? `storefront:${storeTab}` :
    section === "management" ? `management:${manageTab}` :
    section === "analytics"  ? `analytics:${analyticsTab}` :
    section === "training" ? `training:${trainingTab}` :
    "qr";
  const pageMeta = PAGE_META[metaKey] ?? { title: "" };

  return (
    <PreviewPanelProvider
      open={!previewCollapsed}
      onOpenChange={(open) => setPreviewCollapsed(!open)}
    >
    <div className="flex h-screen overflow-hidden bg-stone-100 text-zinc-950">

      {/* ── Left: full-height sidebar (+ desktop hover flyout) ────────────────── */}
      {showInlineSidebar && (
        <div
          className={cn(
            "relative z-30 flex shrink-0 flex-col transition-[width] duration-300 ease-out",
            inlineSidebarMode === "rail" ? "w-[46px]" : "w-48",
          )}
          onMouseEnter={autoHoverRail ? () => setFlyoutOpen(true) : undefined}
          onMouseLeave={autoHoverRail ? () => setFlyoutOpen(false) : undefined}
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
              onQuickCreate={handleQuickCreate}
              onOpenPrototypeTools={() => setPrototypeToolsOpen(true)}
            />
          </div>

          {/* Flyout: панель «вырастает» из рейла по ширине (48→192), без fade.
              Внутренний слой фиксирован на 192px и не переверстывается — контейнер
              его раскрывает через overflow, иконки остаются на месте. Layout не двигается. */}
          {desktopRail && (
            <div
              className={cn(
                "fixed inset-y-0 left-0 z-40 overflow-hidden transition-[width,left,right] duration-100 delay-0 ease-linear",
                flyoutOpen ? "z-[80] w-48 pointer-events-auto shadow-xl shadow-zinc-400/25" : "w-0 pointer-events-none",
              )}
            >
              <div className="flex h-full w-48 flex-col bg-stone-100">
                <FullSidebar
                  section={section}
                  activeTab={activeTab}
                  onNavigate={guardedNavigate}
                  onPin={pinSidebar}
                  pinned={false}
                  onQuickCreate={handleQuickCreate}
                  onOpenPrototypeTools={() => setPrototypeToolsOpen(true)}
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
          onResetCatalog={() => updateCatalogPhase("empty")}
          showHamburger={!showInlineSidebar}
          onOpenMobileMenu={() => setNavDrawerOpen(true)}
          onToggleSidebar={wide ? toggleNav : undefined}
          sidebarCollapsed={inlineSidebarMode === "rail"}
          pageTitle={getPageTitle(
            section,
            activeTab,
            account?.workspace.organizationType ?? "restaurant",
          )}
          isLaunchPage={isLaunchPage}
          catalogHasVisibleItems={catalogPhase === "has-items"}
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
            onQuickCreate={handleQuickCreate}
            onOpenPrototypeTools={() => setPrototypeToolsOpen(true)}
          />

          {/* Work area */}
          <div
            data-position-editor-overlay-root
            className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden gap-[6px] pb-3 pr-3 pl-1"
          >
            {/* Toolbar: tabs left + language right */}
            {(isHomePage || isCatalogPage || isAboutPage || isTrainingPage || pageMeta.showLanguage || previewVisible) && (
              <div className={cn(
                "flex min-h-8 shrink-0 flex-wrap items-center justify-between gap-2",
              )}>
                <div className={cn(isAboutPage || isOrderSettingsPage ? "min-w-0 flex-1" : "shrink-0")}>
                  {isHomePage && <HomeTabs value={homeTab} onChange={setHomeTab} />}
                  {isCatalogPage && catalogPhase !== "empty" && (
                    <CatalogTabs value={catalogPrimaryTab} onChange={changeCatalogPrimaryTab} />
                  )}
                  {isAboutPage && (
                    <AboutTabs
                      value={storeAboutTab}
                      onChange={(t) => {
                        navigate("storefront", `about:${t}`);
                      }}
                    />
                  )}
                  {isTrainingPage && (
                    <TrainingTabs value={trainingTab} onChange={changeTrainingTab} />
                  )}
                  {isOrderSettingsPage && (
                    <OrderSettingsTabs value={orderSettingsTab} onChange={setOrderSettingsTab} />
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {pageMeta.showLanguage && (!isOrderSettingsPage || orderSettingsTab === "delivery" || orderSettingsTab === "pickup") && (
                    <PageLangSwitcher
                      compact={isOrderSettingsPage}
                      onManageLanguages={() =>
                        navigate("storefront", "translations")
                      }
                    />
                  )}
                  {isOrderSettingsPage && (
                    <button
                      type="button"
                      data-order-channels-trigger
                      aria-haspopup="dialog"
                      aria-expanded={orderChannelsOpen}
                      onClick={() => setOrderChannelsOpen((open) => !open)}
                      className="flex h-8 items-center rounded-[10px] border border-[#d6d3d1] bg-white px-3 text-[13px] font-medium text-[#292524] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                    >
                      <Bell size={13} className="mr-1.5" />
                      Каналы уведомлений
                    </button>
                  )}
                  {isOrderSettingsPage && (
                    <OrderSettingsSaveIndicator state={orderSettingsSaveState} />
                  )}
                </div>
              </div>
            )}

          {/* Editor card + preview card side by side */}
          <div
            data-catalog-adaptive-shell={isCatalogPage || undefined}
            className="relative flex min-h-0 min-w-0 flex-1 overflow-hidden"
          >
            {previewVisible && !isPublicDisplayPage && viewportWidth >= 1200 && (
              <div className="absolute right-4 top-4 z-20">
                <PreviewToolbarToggle />
              </div>
            )}

            {/* Editor card */}
            <div
              data-workspace-editor-card
              className={cn(
                "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-[20px] border border-[#e7e5e4]",
                isCatalogPage || isTranslationsPage ? "bg-white" : "bg-[#fbfbf9]",
              )}
            >
              <ContentHeader
                title={isLaunchPage || isCatalogPage || isTranslationsPage || isAboutPage || isTrainingPage || isOrderSettingsPage ? undefined : isHomePage ? HOME_TAB_META[homeTab].title : pageMeta.title}
                description={isLaunchPage || isCatalogPage || isTranslationsPage || isAboutPage || isTrainingPage || isOrderSettingsPage ? undefined : isHomePage ? HOME_TAB_META[homeTab].description : pageMeta.description}
                onRenewPlan={() => guardedNavigate("management", "billing")}
              />
              <div className="flex min-h-0 min-w-0 flex-1">
                <ChangeTracker pageKey={pageKey}>{content}</ChangeTracker>
              </div>
              <GlobalPreviewReturnControl />
            </div>

            {/* Preview card */}
            {previewVisible && (
              <div
                data-preview-panel-slot
                className={cn(
                  "min-h-0 shrink-0 overflow-hidden transition-[width,margin] ease-out motion-reduce:transition-none",
                  isCatalogPage && "max-[1199px]:ml-0 max-[1199px]:w-0",
                  previewCollapsed ? "ml-0 w-0" : "ml-3 w-[390px]",
                )}
                style={{ transitionDuration: `${PREVIEW_PANEL_TRANSITION_MS}ms` }}
              >
                <div
                  data-preview-panel
                  className={cn(
                    "h-full w-[390px] overflow-hidden rounded-[20px] border border-[#e7e5e4] bg-white shadow-sm transition-[transform,opacity] ease-out motion-reduce:transition-none",
                    previewCollapsed
                      ? "pointer-events-none translate-x-full opacity-0"
                      : "translate-x-0 opacity-100",
                  )}
                  style={{ transitionDuration: `${PREVIEW_PANEL_TRANSITION_MS}ms` }}
                >
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
                    catalogItem={activeEditorItemId ? itemsById[activeEditorItemId] ?? null : null}
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        </div>

      </div>

      <DraftToast />
      <PublishToast />
      <TranslationOverlays />
      <PrototypeToolsPanel open={prototypeToolsOpen} onOpenChange={setPrototypeToolsOpen} />
    </div>
    </PreviewPanelProvider>
  );
}

function PreviewToolbarToggle() {
  const previewPanel = usePreviewPanel();
  if (!previewPanel?.open) return null;
  return <PreviewToggle open={previewPanel.open} onToggle={previewPanel.toggle} />;
}

function GlobalPreviewReturnControl() {
  const previewPanel = usePreviewPanel();
  if (!previewPanel?.returnControlVisible) return null;
  return (
    <div data-preview-return-control className="absolute bottom-3 right-3 z-[60]">
      <PreviewReturnButton onClick={previewPanel.show} />
    </div>
  );
}

export default function App() {
  useEffect(() => {
    if (!IS_PRAGMATIC_CATALOG_PREVIEW) return;
    const previousTitle = document.title;
    document.title = "TASKO Catalog — Pragmatic DnD Preview";
    return () => {
      document.title = previousTitle;
    };
  }, []);

  const designLabPath = window.location.pathname.startsWith("/__design/");
  const designLabScenario = designLabPath
    ? getPositionEditorDesignScenario(window.location.pathname)
    : null;
  const designLabEnabled = import.meta.env.DEV || import.meta.env.MODE === "test";

  if (designLabPath) {
    if (!designLabEnabled || !designLabScenario) return <DesignLabNotFound />;
    resetDesignLabStorage();
    return <PositionEditorDesignLabRoot fixture={getPositionEditorDesignFixture(designLabScenario)} />;
  }

  return (
    <TooltipProvider delayDuration={300}>
      <MockAuthProvider>
        <AppSettingsProvider>
          <OrderRoutingProvider>
            <PlanProvider>
              <PublishProvider>
                <VitrineLaunchProvider>
                  <PreviewDemoProvider>
                    <CatalogStoreProvider>
                      <TranslationsProvider>
                        <HeaderActionsProvider>
                          <AppShell />
                        </HeaderActionsProvider>
                      </TranslationsProvider>
                    </CatalogStoreProvider>
                  </PreviewDemoProvider>
                </VitrineLaunchProvider>
              </PublishProvider>
            </PlanProvider>
          </OrderRoutingProvider>
        </AppSettingsProvider>
      </MockAuthProvider>
    </TooltipProvider>
  );
}

function PositionEditorDesignLabRoot({ fixture }: { fixture: PositionEditorDesignFixture }) {
  return (
    <TooltipProvider delayDuration={300}>
      <MockAuthProvider fixture>
        <AppSettingsProvider persistence={false}>
          <PublishProvider persistence={false}>
            <CatalogStoreProvider
              initialData={{
                sections: fixture.sections,
                items: fixture.items,
                autosaveByItem: fixture.autosaveByItem,
              }}
              persistence={false}
            >
              <PositionEditorFixtureProvider value={
                fixture.validationMessage || fixture.promo || fixture.positionActionsOpen
                  ? { nameError: fixture.validationMessage, promo: fixture.promo, positionActionsOpen: fixture.positionActionsOpen }
                  : null
              }>
                <PositionEditorDesignLab fixture={fixture} />
              </PositionEditorFixtureProvider>
            </CatalogStoreProvider>
          </PublishProvider>
        </AppSettingsProvider>
      </MockAuthProvider>
    </TooltipProvider>
  );
}

function DesignLabNotFound() {
  return (
    <main className="grid min-h-dvh place-items-center bg-white text-sm text-zinc-600">
      404
    </main>
  );
}

function AppShell() {
  const {
    account,
    authResolution,
    dismissAuthResolution,
    isAuthenticated,
    getAccountById,
  } = useMockAuth();
  const publicMenuId = new URLSearchParams(window.location.search).get("publicMenu");
  if (publicMenuId) return <PublicMenuPage account={getAccountById(publicMenuId)} />;
  if (!isAuthenticated) return <AuthScreen />;
  return (
    <>
      {account && !account.workspace.setupCompleted ? (
        <WorkspaceSetupScreen />
      ) : (
        <>
          <AdminOpenedTracker resolution={authResolution} />
          <AuthenticatedShell />
        </>
      )}
      {authResolution === "created" && (
        <AccountCreatedToast onDismiss={dismissAuthResolution} />
      )}
    </>
  );
}

function AdminOpenedTracker({ resolution }: { resolution: AuthResolution | null }) {
  useEffect(() => {
    if (!resolution) return;
    trackAuthEvent("admin_opened", { resolution });
  }, [resolution]);
  return null;
}

function AccountCreatedToast({ onDismiss }: { onDismiss: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDismiss, 2600);
    return () => window.clearTimeout(timer);
  }, [onDismiss]);

  return (
    <div
      role="status"
      className="fixed right-5 top-5 z-[400] rounded-[8px] border border-emerald-200 bg-white px-4 py-3 text-[13px] font-semibold text-zinc-900 shadow-lg"
    >
      Аккаунт создан
    </div>
  );
}
