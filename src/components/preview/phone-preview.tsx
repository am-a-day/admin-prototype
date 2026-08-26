import { useEffect, useState, type ReactNode } from "react";
import { Lock, SpinnerGap } from "@phosphor-icons/react";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { useVitrineStatus } from "@/lib/use-vitrine-status";
import { useAppSettings } from "@/contexts/app-settings-context";
import { ContentLanguageControl } from "@/components/preview/content-language-control";
import { usePublish } from "@/contexts/publish-context";
import { usePreviewDemo } from "@/contexts/preview-demo-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { useTranslationsOptional, type TranslationMaterialKind } from "@/contexts/translations-context";
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
  type Dish,
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
import { formatPrice, type CatalogItem } from "@/data/catalog";
import { useCatalogStore } from "@/contexts/catalog-store-context";
import {
  getCatalogLabelText,
  resolveCatalogItemStickerId,
  resolveCatalogItemTagIds,
  useCatalogLabels,
  type CatalogLabel,
} from "@/features/storefront/catalog/labels/catalog-labels";
import {
  getLocalCatalogItemLabels,
  getLocalCatalogLabelText,
} from "@/features/storefront/catalog/labels/local-catalog-labels";
import { USE_SHARED_TAGS_AND_STICKERS } from "@/features/storefront/catalog/feature-flags";
import { getCatalogTitleForLanguage } from "@/lib/mock-catalog-translations";
import {
  CATALOG_UPSELL_CHANGE_EVENT,
  readCatalogUpsellState,
  resolveRecommendationIds,
} from "@/lib/catalog-upsell";
import type { LanguageCode } from "@/data/languages";

type PhonePreviewProps = {
  section: SectionId;
  activeTab: StoreTabId | ManageTabId | AnalyticsTabId | null;
  selectedDishId: string;
  previewBanner: Banner | null;
  scenario: PreviewScenario;
  recommendationTexts: RecommendationTexts;
  upsellSurface: UpsellSurface;
  highlightUpsell: boolean;
  previewLanguage: LanguageCode;
  onPreviewLanguageChange: (language: LanguageCode) => void;
  // Навигация из превью в настройки (UX-эксперимент)
  onNavHomeHero: () => void;
  onNavHomeSections: () => void;
  onNavUpsell: () => void;
  onNavAbout: () => void;
  onNavCatalogDish: (id: string) => void;
  // SEO-сценарий
  seoTitle?: string;
  seoDescription?: string;
  catalogItem?: CatalogItem | null;
};

const EMPTY_CATALOG_LABELS: CatalogLabel[] = [];

function SharedPhonePreview(props: PhonePreviewProps) {
  const { labels } = useCatalogLabels();
  return <PhonePreviewContent {...props} sharedLabels={labels} />;
}

export function PhonePreview(props: PhonePreviewProps) {
  return USE_SHARED_TAGS_AND_STICKERS
    ? <SharedPhonePreview {...props} />
    : <PhonePreviewContent {...props} sharedLabels={EMPTY_CATALOG_LABELS} />;
}

function PhonePreviewContent({
  section,
  activeTab,
  selectedDishId,
  previewBanner,
  scenario,
  recommendationTexts,
  upsellSurface,
  highlightUpsell,
  previewLanguage,
  onPreviewLanguageChange,
  onNavHomeHero,
  onNavHomeSections,
  onNavUpsell,
  onNavAbout,
  onNavCatalogDish,
  seoTitle = "",
  seoDescription = "",
  catalogItem = null,
  sharedLabels,
}: PhonePreviewProps & { sharedLabels: CatalogLabel[] }) {
  const {
    serviceFeeRequireConsent,
    deliveryComment,
    pickupComment,
    pickupAddress,
  } = useAppSettings();
  const { routes } = useOrderRouting();
  const { publishPhase } = usePublish();
  const { items: catalogItems, sections: catalogSections } = useCatalogStore();
  const translations = useTranslationsOptional();
  const { emptyVitrine } = usePreviewDemo();
  const { account } = useMockAuth();
  const { stage } = useVitrineLaunch();
  const { webAddress } = useVitrineStatus();
  const privatePreview = Boolean(account?.workspace.privatePreviewAvailable);
  const restaurantName =
    account?.workspace.localizedNames[previewLanguage] ||
    (account
      ? account.workspace.localizedNames[account.workspace.primaryLanguage]
      : undefined) ||
    account?.workspace.name ||
    "Новое меню";
  const previewAddress = account?.workspace.webAddress || "preview.tasko.local";
  const primaryLanguage = account?.workspace.primaryLanguage ?? "ru";

  const translatedFieldValue = (
    kind: TranslationMaterialKind,
    entityId: string,
    fieldId: string,
    fallback: string,
  ) => translations?.materials
    .find((material) => material.kind === kind && material.entityId === entityId)
    ?.fields.find((field) => field.id === fieldId)
    ?.values[previewLanguage]?.trim() || fallback;

  const [previewTab, setPreviewTab] = useState<PreviewTab>("home");
  const [menuCategory, setMenuCategory] = useState<string | null>(null);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [upsellRevision, setUpsellRevision] = useState(0);

  useEffect(() => {
    const refresh = () => setUpsellRevision((value) => value + 1);
    window.addEventListener(CATALOG_UPSELL_CHANGE_EVENT, refresh);
    return () => window.removeEventListener(CATALOG_UPSELL_CHANGE_EVENT, refresh);
  }, []);

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
  const toPreviewDish = (item: CatalogItem, index = 0): Dish => {
    const localLabels = getLocalCatalogItemLabels(item, primaryLanguage);
    const section = catalogSections.find((candidate) => candidate.id === item.sectionId);
    const localizedSectionName = section
      ? translatedFieldValue(
          "section",
          section.id,
          "name",
          getCatalogTitleForLanguage(section.name, section.nameTranslations, previewLanguage, primaryLanguage),
        )
      : item.sectionName;
    const tags = USE_SHARED_TAGS_AND_STICKERS
      ? resolveCatalogItemTagIds(item, sharedLabels)
          .map((id) => getCatalogLabelText(sharedLabels.find((label) => label.id === id), previewLanguage, primaryLanguage))
          .filter(Boolean)
      : localLabels.tags.map((tag) => getLocalCatalogLabelText(tag, previewLanguage, primaryLanguage));
    const sticker = USE_SHARED_TAGS_AND_STICKERS
      ? getCatalogLabelText(
          sharedLabels.find((label) => label.id === resolveCatalogItemStickerId(item, sharedLabels)),
          previewLanguage,
          primaryLanguage,
        ) || null
      : getLocalCatalogLabelText(localLabels.sticker, previewLanguage, primaryLanguage) || null;
    return {
      id: item.id,
      name: getCatalogTitleForLanguage(
        item.title,
        item.titleTranslations,
        previewLanguage,
        primaryLanguage,
      ),
      category: localizedSectionName,
      price: formatPrice(item.priceWithSale ?? item.price),
      weight: item.weightLabel ?? "",
      description: translatedFieldValue(
        "position",
        item.id,
        "description",
        getCatalogTitleForLanguage(
          item.description,
          item.descriptionTranslations,
          previewLanguage,
          primaryLanguage,
        ),
      ),
      accent: ["from-amber-50 to-orange-100", "from-emerald-50 to-lime-100", "from-violet-50 to-fuchsia-100", "from-sky-50 to-cyan-100"][index % 4],
      emoji: "🍽️",
      recommendations: [],
      stop: item.status === "stopped",
      tags,
      sticker,
    };
  };
  // The revision is intentionally read here: a same-tab custom event refreshes
  // the phone immediately while the shared upsell editor writes local storage.
  void upsellRevision;
  const storedUpsell = readCatalogUpsellState();
  const catalogPreviewDish = catalogItem ? toPreviewDish(catalogItem) : null;
  const catalogMenuDishes = catalogItems
    .filter((item) => item.status === "active" && item.displayMode === "full")
    .slice(0, 6)
    .map(toPreviewDish);
  const catalogRecommended = catalogItem
    ? resolveRecommendationIds(catalogItem, catalogItems, storedUpsell[catalogItem.id])
        .map((id) => catalogItems.find((item) => item.id === id))
        .filter((item): item is CatalogItem => Boolean(item) && item!.status === "active" && item!.displayMode === "full")
        .map(toPreviewDish)
    : [];
  // Чтобы блок рекомендаций в превью не был пустым — fallback на промо-позиции.
  const recItems = catalogPreviewDish
    ? catalogRecommended
    : recommended.length > 0
      ? recommended
      : promotedDishIds
          .map((id) => dishes.find((d) => d.id === id))
          .filter((d): d is NonNullable<typeof d> => Boolean(d) && d!.id !== dish.id);

  const localizedPreviewBanner = previewBanner ? {
    ...previewBanner,
    title: getCatalogTitleForLanguage(
      previewBanner.title,
      previewBanner.titleTranslations,
      previewLanguage,
      primaryLanguage,
    ),
    subtitle: translatedFieldValue(
      "banner",
      previewBanner.id,
      "subtitle",
      getCatalogTitleForLanguage(
        previewBanner.subtitle,
        previewBanner.subtitleTranslations,
        previewLanguage,
        primaryLanguage,
      ),
    ),
    tags: previewBanner.tags.map((tag) => {
      const tagFallbacks: Partial<Record<LanguageCode, string>> = {
        ru: tag.texts.ru,
        kk: tag.texts.kz,
        en: tag.texts.en,
        zh: tag.texts.zh,
        fr: tag.texts.fr,
        es: tag.texts.es,
        sr: tag.texts.sr,
      };
      const text = translatedFieldValue(
        "banner",
        previewBanner.id,
        `tag:${tag.id}`,
        tagFallbacks[previewLanguage]?.trim() || tag.texts.ru,
      );
      return { ...tag, texts: { ...tag.texts, ru: text } };
    }),
  } : null;
  const localizedRecommendationTexts: RecommendationTexts = {
    home: translatedFieldValue("interface", "recommendations", "home", recommendationTexts.home),
    dish: translatedFieldValue("interface", "recommendations", "dish", recommendationTexts.dish),
    cart: translatedFieldValue("interface", "recommendations", "cart", recommendationTexts.cart),
  };

  // Навигация по витрине доступна на админ-вкладке «Главная».
  const browsing = section === "storefront" && activeTab === "home" && localizedPreviewBanner != null;

  let screen: ReactNode = localizedPreviewBanner ? (
    <PhoneHome banner={localizedPreviewBanner} restaurantName={restaurantName} empty={emptyVitrine} />
  ) : null;
  let showBottomNav = false;
  let overlay: ReactNode = null;

  if (scenario === "notification-delivery") {
    const r = routes.delivery;
    screen = (
      <PhoneNotification
        event="delivery"
        channelType={r?.type ?? "telegram"}
        contact={r?.contact || "Канал не выбран"}
      />
    );
  } else if (scenario === "notification-pickup") {
    const r = routes.pickup;
    screen = (
      <PhoneNotification
        event="pickup"
        channelType={r?.type ?? "telegram"}
        contact={r?.contact || "Канал не выбран"}
      />
    );
  } else if (scenario === "notification-waiter") {
    const r = routes.waiter;
    screen = (
      <PhoneNotification
        event="waiter"
        channelType={r?.type ?? "telegram"}
        contact={r?.contact || "Канал не выбран"}
      />
    );
  } else if (scenario === "seoLink") {
    screen = <PhoneSeoLink title={seoTitle} description={seoDescription} />;
  } else if (scenario === "age") {
    screen = <PhoneAgeGate />;
  } else if (scenario === "about" || activeTab === "about") {
    screen = <PhoneAboutSheet restaurantName={restaurantName} />;
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
  } else if (browsing && localizedPreviewBanner) {
    showBottomNav = true;
    if (previewTab === "home") {
      screen = (
        <PhoneHome
          banner={localizedPreviewBanner}
          restaurantName={restaurantName}
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
          title={localizedRecommendationTexts.cart}
          dish={catalogPreviewDish ?? dish}
          recommended={recItems}
          onRecommendations={onNavUpsell}
        />
      );
    }
    if (aboutOpen) {
      overlay = (
        <PhoneAboutDrawer
          restaurantName={restaurantName}
          onClose={() => setAboutOpen(false)}
          onEdit={() => {
            setAboutOpen(false);
            onNavAbout();
          }}
        />
      );
    }
  } else if (scenario === "catalog-empty") {
    screen = <PhoneCatalogEmpty restaurantName={restaurantName} />;
  } else if (activeTab === "catalog") {
    screen = catalogItems.length === 0 ? (
      <PhoneCatalogEmpty restaurantName={restaurantName} />
    ) : (
      <PhoneCatalog
        selectedDishId={selectedDishId}
        restaurantName={restaurantName}
        catalogItem={catalogItem}
        catalogItems={catalogItems}
        catalogDish={catalogPreviewDish}
        catalogDishes={catalogMenuDishes}
      />
    );
  } else if (activeTab === "upsell") {
    // Сценарий превью управляется фокусом полей «Тексты рекомендаций».
    if (upsellSurface === "home") {
      screen = (
        <PhoneUpsellHome
          title={localizedRecommendationTexts.home}
          recommended={recItems}
          highlight={highlightUpsell}
        />
      );
    } else if (upsellSurface === "cart") {
      screen = (
        <PhoneCart
          title={localizedRecommendationTexts.cart}
          dish={catalogPreviewDish ?? dish}
          recommended={recItems}
          highlight={highlightUpsell}
        />
      );
    } else {
      screen = (
        <PhoneDish
          dish={catalogPreviewDish ?? dish}
          recommended={recItems}
          title={localizedRecommendationTexts.dish}
          highlight={highlightUpsell}
        />
      );
    }
  } else if (activeTab === "appearance") {
    screen = <PhoneCatalog selectedDishId={selectedDishId} restaurantName={restaurantName} catalogItem={catalogItem} catalogItems={catalogItems} catalogDish={catalogPreviewDish} catalogDishes={catalogMenuDishes} themed />;
  }

  // Overlay публикации (Publish model): аккуратный полупрозрачный слой на 3 сек.
  const publishOverlay = publishPhase === "publishing" && (
    <div className="absolute inset-0 z-30 flex flex-col items-center justify-center gap-3 bg-white/70 px-6 text-center backdrop-blur-[1px]">
      <SpinnerGap size={26} className="animate-spin text-blue-600" />
      <div className="text-sm font-bold text-zinc-800">Обновляем витрину…</div>
    </div>
  );

  return (
    <aside
      data-tour="preview-panel"
      style={{ width: 390 }}
      className="relative flex shrink-0 flex-col bg-white"
    >
        <div className="flex h-full flex-col overflow-hidden px-3 pt-5">
          {/* Header: «Предпросмотр» + статус */}
          <div className="mb-[15px] flex w-full items-start justify-between px-1 pr-12">
            <div className="flex flex-col gap-[3px]">
              <span className="text-[14px] font-medium tracking-[-0.38px] text-[#292524]">
                Предпросмотр
              </span>

              {/* Ссылка на витрину — переход активен после валидации менеджером */}
              {privatePreview ? (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-zinc-100 px-2 py-0.5 text-[12px] font-semibold text-zinc-600">
                  <Lock size={11} className="shrink-0" />
                  Приватный предпросмотр
                </span>
              ) : stage === "active" ? (
                <a
                  href={`https://${previewAddress || webAddress}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-fit text-[13px] text-[#79716b] transition hover:text-blue-600 hover:underline"
                >
                  {previewAddress || webAddress}
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
            <ContentLanguageControl
              value={previewLanguage}
              onChange={onPreviewLanguageChange}
            />
          </div>

          {/* Flat preview viewport — заполняет всю высоту панели */}
          <div className="relative min-h-0 flex-1 overflow-hidden rounded-t-[24px] border border-b-0 border-[#f5f5f4] bg-[#f5f5f5]">
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
