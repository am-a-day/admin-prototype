import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import { AlertTriangle, Check, Loader2, PanelRightClose, Pencil, RotateCcw, Smartphone, UploadCloud } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useLayoutMode } from "@/contexts/layout-mode-context";
import { usePublish } from "@/contexts/publish-context";
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
  onNavOrders: () => void;
  // SEO-сценарий
  seoTitle?: string;
  seoDescription?: string;
  // Ресайзируемая панель
  width: number;
  collapsed: boolean;
  dragging: boolean;
  resizable?: boolean;
  onStartResize: (e: MouseEvent) => void;
  onExpand: () => void;
  onCollapse: () => void;
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
  onNavOrders,
  seoTitle = "",
  seoDescription = "",
  width,
  collapsed,
  dragging,
  resizable = false,
  onStartResize,
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
  const { changeModel, simulateUpdateError } = useLayoutMode();
  const { totalChanges, applyPhase, apply, retryUpdate } = usePublish();

  const [previewTab, setPreviewTab] = useState<PreviewTab>("home");
  const [menuCategory, setMenuCategory] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  // В Save + Live превью — свободный браузер: открытая в нём карточка блюда
  // не уводит админку, а показывает floating-кнопку перехода.
  const [previewDishId, setPreviewDishId] = useState<string | null>(null);

  const isSaveModel = changeModel === "save-live";

  // При возврате на админ-вкладку «Главная» сбрасываем состояние навигации превью.
  useEffect(() => {
    if (activeTab === "home") {
      setPreviewTab("home");
      setMenuCategory(null);
      setAboutOpen(false);
      setPreviewDishId(null);
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
    if (isSaveModel && previewDishId) {
      // Карточка блюда, открытая внутри превью (Save + Live).
      const pd = getDish(previewDishId);
      screen = (
        <PhoneDish dish={pd} recommended={getRecommendedDishes(pd)} title={recommendationTexts.dish} />
      );
    } else if (previewTab === "home") {
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
          onPickDish={(id) => {
            if (isSaveModel) setPreviewDishId(id); // остаёмся в превью
            else onNavCatalogDish(id); // Publish model — прежнее поведение
          }}
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

  const safeWidth = Number.isFinite(width) ? width : 360;
  const scale = Math.min(1, Math.max(MIN_SCALE, (safeWidth - 40) / PHONE_W));

  // ── «Change model» experiment ──────────────────────────────────────────────
  const isGuestPreview =
    scenario !== "seoLink" &&
    scenario !== "notification-delivery" &&
    scenario !== "notification-pickup" &&
    scenario !== "notification-waiter";
  const hasChanges = totalChanges > 0;
  const draftMode = isGuestPreview && hasChanges && applyPhase === "idle";

  // Header label / caption
  // Короткий статус-бейдж над телефоном (только Save + Live).
  let badgeText: string | null = null;
  let badgeTone = "";
  if (isSaveModel && isGuestPreview) {
    if (applyPhase === "saving" || applyPhase === "updating") {
      badgeText = "Обновляем витрину";
      badgeTone = "bg-blue-100 text-blue-700";
    } else if (applyPhase === "done") {
      badgeText = "Гости уже видят";
      badgeTone = "bg-emerald-100 text-emerald-700";
    } else if (applyPhase === "error") {
      badgeText = "Витрина не обновилась";
      badgeTone = "bg-orange-100 text-orange-700";
    } else if (draftMode) {
      badgeText = "Будет после сохранения";
      badgeTone = "bg-amber-100 text-amber-700";
    }
  }
  // Пояснение под телефоном — только для не-гостевых сценариев.
  const scenarioCaption = !isGuestPreview
    ? "Превью переключается на сценарий, который сейчас редактируется."
    : "";

  const runApply = () => apply({ failUpdate: simulateUpdateError });

  // ── Floating admin CTA (Save + Live): переход в админку по явному действию ──
  // Свободная навигация внутри телефона не уводит со страницы — это делает кнопка.
  let ctaLabel: string | null = null;
  let ctaAction: (() => void) | null = null;
  if (isSaveModel && browsing && applyPhase === "idle") {
    if (aboutOpen) {
      ctaLabel = "Поменять информацию о заведении";
      ctaAction = onNavAbout;
    } else if (previewDishId) {
      ctaLabel = "Редактировать позицию";
      ctaAction = () => onNavCatalogDish(previewDishId);
    } else if (previewTab === "cart") {
      ctaLabel = "Настроить заказы";
      ctaAction = onNavOrders;
    }
  }
  const floatingCta = ctaLabel && ctaAction && (
    <div className="absolute inset-x-0 bottom-[70px] z-40 flex justify-center px-3">
      <button
        type="button"
        onClick={ctaAction}
        className="flex items-center gap-1.5 rounded-full bg-zinc-900/95 px-4 py-2 text-[12px] font-bold text-white shadow-lg shadow-zinc-900/30 backdrop-blur transition hover:bg-zinc-800"
      >
        <Pencil size={12} />
        {ctaLabel}
      </button>
    </div>
  );

  // Overlay shown inside the phone during the apply flow
  const applyOverlay = applyPhase !== "idle" && (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-white/90 px-6 text-center backdrop-blur-[2px]">
      {applyPhase === "saving" && (
        <>
          <Loader2 size={26} className="animate-spin text-blue-600" />
          <div className="text-sm font-bold text-zinc-800">
            {/* In Save + Live the form already shows «Сохраняем…»;
                the preview's job is to show the storefront updating. */}
            {isSaveModel ? "Обновляем витрину…" : "Сохраняем…"}
          </div>
        </>
      )}
      {applyPhase === "updating" && (
        <>
          <Loader2 size={26} className="animate-spin text-blue-600" />
          <div className="text-sm font-bold text-zinc-800">Обновляем витрину…</div>
        </>
      )}
      {applyPhase === "done" && (
        <>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
            <Check size={24} strokeWidth={3} />
          </div>
          <div className="text-sm font-bold text-zinc-800">
            {isSaveModel ? "Сохранено · изменения видны гостям" : "Витрина обновлена"}
          </div>
        </>
      )}
      {applyPhase === "error" && (
        <>
          <div className="flex h-11 w-11 items-center justify-center rounded-full bg-orange-100 text-orange-600">
            <AlertTriangle size={22} strokeWidth={2.5} />
          </div>
          <div className="text-sm font-bold text-zinc-800">
            Изменения сохранены, но витрина не обновилась
          </div>
          <button
            type="button"
            onClick={retryUpdate}
            className="mt-1 flex items-center gap-1.5 rounded-lg bg-zinc-900 px-3.5 py-1.5 text-[13px] font-bold text-white transition hover:bg-zinc-700"
          >
            <RotateCcw size={13} />
            Повторить обновление
          </button>
        </>
      )}
    </div>
  );

  return (
    <aside
      style={{ width: collapsed ? 44 : safeWidth }}
      className={cn(
        "relative flex shrink-0 flex-col border-l border-border bg-zinc-50",
        !dragging && "transition-[width] duration-300 ease-out",
      )}
    >
      {/* Ручка перетаскивания — только в экспериментальном режиме */}
      {!collapsed && resizable && (
        <div
          onMouseDown={onStartResize}
          className="group absolute left-0 top-0 z-30 flex h-full w-2.5 -translate-x-1/2 cursor-col-resize items-center justify-center"
          title="Потяните, чтобы изменить ширину"
        >
          <div className="h-12 w-1 rounded-full bg-zinc-300 transition group-hover:bg-blue-400" />
        </div>
      )}

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
        <div className="flex h-full flex-col items-center overflow-hidden px-4 py-6">
          <div className="mb-3 flex w-full items-center">
            <ContentLanguageControl />
            <button
              type="button"
              onClick={onCollapse}
              title="Скрыть превью"
              className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            >
              <PanelRightClose size={15} />
            </button>
          </div>
          {badgeText && (
            <div className="mb-2 flex w-full justify-center">
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-bold", badgeTone)}>
                {badgeText}
              </span>
            </div>
          )}

          {/* Draft strip — только Publish model (статус + «Обновить витрину»).
              В Save + Live состояние формы показывает нижняя save bar, а превью
              остаётся спокойным режимом просмотра. */}
          {draftMode && !isSaveModel && (
            <div className="mb-3 flex w-full items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5">
              <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
              <span className="min-w-0 flex-1 truncate text-[11px] font-semibold text-amber-800">
                {`${totalChanges} ${totalChanges === 1 ? "неопубликованное изменение" : totalChanges < 5 ? "неопубликованных изменения" : "неопубликованных изменений"}`}
              </span>
              <button
                type="button"
                onClick={runApply}
                className="flex shrink-0 items-center gap-1 rounded-md bg-blue-600 px-2.5 py-1 text-[11px] font-bold text-white transition hover:bg-blue-700"
              >
                <UploadCloud size={11} />
                Обновить витрину
              </button>
            </div>
          )}
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
                      setPreviewDishId(null);
                      if (t !== "menu") setMenuCategory(null);
                    }}
                  />
                )}
              </div>
              {overlay}
              {floatingCta}
              {applyOverlay}
            </div>
          </div>
          {(showBottomNav || scenarioCaption) && (
            <p className="mt-3 max-w-[250px] text-center text-xs leading-5 text-zinc-500">
              {showBottomNav
                ? "Нажмите на элемент витрины, чтобы открыть его настройки."
                : scenarioCaption}
            </p>
          )}
        </div>
      )}
    </aside>
  );
}
