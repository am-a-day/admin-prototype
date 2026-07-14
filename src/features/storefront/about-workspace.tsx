import { useMemo, useState, type ReactNode } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { ChevronDown, CirclePlus, Facebook, Globe, Image, Info, Instagram, MapPin, MessageCircle, MoreVertical, Music2, Phone, Plus, Search, Send, Trash2, X, Youtube, type LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipProvider } from "@/components/ui/tooltip";
import { CompactContent, PageContent, PageScroll } from "@/components/workspace/page-layout";
import { LaunchPageHint } from "@/components/workspace/launch-hint";
import { useAppSettings } from "@/contexts/app-settings-context";
import { usePublish } from "@/contexts/publish-context";
import { type PreviewScenario } from "@/data/mock-data";
import { cn } from "@/lib/utils";

export type AboutTab = "info" | "guest-rules" | "public-display" | "rec-titles";

type AboutWorkspaceProps = {
  setPreviewScenario: (scenario: PreviewScenario) => void;
  onConfigureOrderSettings: () => void;
  aboutTab: AboutTab;
  seoTitle: string;
  setSeoTitle: (v: string) => void;
  seoDescription: string;
  setSeoDescription: (v: string) => void;
};

const TAB_LABELS: Record<AboutTab, string> = {
  "info": "Основное",
  "guest-rules": "Предупреждения",
  "public-display": "Мой ресторан в сети",
  "rec-titles": "Заголовки и кнопки",
};

// Один источник для заголовка/подзаголовка рабочей области по активной вкладке.
const TAB_HEADERS: Record<AboutTab, { title: string; subtitle: string }> = {
  "info": { title: "Основное", subtitle: "Информация, которая поможет гостям лучше узнать о вас." },
  "guest-rules": { title: "Предупреждения", subtitle: "Настройте подтверждения, которые гости увидят перед открытием меню." },
  "public-display": { title: "Мой ресторан в сети", subtitle: "Настройте, как заведение выглядит в поиске, соцсетях и на Tasko Get." },
  "rec-titles": { title: "Заголовки и кнопки", subtitle: "Настройте подписи и заголовки, которые гости видят на витрине." },
};

const ABOUT_TABS: { id: AboutTab; label: string }[] = [
  { id: "info", label: TAB_LABELS.info },
  { id: "guest-rules", label: TAB_LABELS["guest-rules"] },
  { id: "rec-titles", label: TAB_LABELS["rec-titles"] },
  { id: "public-display", label: TAB_LABELS["public-display"] },
];

export function AboutTabs({ value, onChange }: { value: AboutTab; onChange: (t: AboutTab) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-[#f5f5f4] p-0.5">
      {ABOUT_TABS.map((t) => {
        const active = value === t.id;
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              "rounded-lg px-2.5 py-1 text-[12px] transition",
              active
                ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]"
                : "text-[#79716b] hover:text-zinc-700",
            )}
          >
            {t.label}
          </button>
        );
      })}
    </div>
  );
}

type PublicPreviewTab = "search" | "social" | "tasko";

const PUBLIC_PREVIEW_LABELS: Record<PublicPreviewTab, string> = {
  search: "В поиске",
  social: "В соцсетях",
  tasko: "Tasko Гид",
};

const PUBLIC_FIELD_TOOLTIPS = {
  title:
    "Заголовок помогает гостям и поисковым системам понять, что это за заведение. Используйте название, тип заведения, кухню или специфику и город.\n\nПримеры:\n• Марчеллис | Итальянский ресторан на Невском проспекте в СПб\n• Семейное кафе «Андерсон» в Москве — детская зона и кондитерская\n• White Rabbit — панорамный ресторан в Москве",
  description:
    "Кратко опишите кухню, формат заведения и главное преимущество. Хорошее описание помогает гостям понять, что они откроют по ссылке.\n\nПример:\nАвторские корейские блюда с доставкой и самовывозом. Заказывайте онлайн.",
  keywords:
    "Ключевые слова помогают точнее описать заведение для поиска. Добавьте блюда, услуги, кухню или особенности, по которым гости могут вас искать.\n\nПримеры:\nдоставка, завтраки, кофе навынос, клубника в шоколаде, корейская кухня",
  linkPhoto:
    "Это изображение показывается, когда ссылку на меню отправляют в соцсетях и мессенджерах. Лучше использовать горизонтальное фото без мелкого текста.\n\nРекомендуемый размер: 1200×630 px.",
  taskoCity:
    "Город используется для отображения заведения в Tasko Get. Выберите город, чтобы гости могли найти вас в нужном каталоге.",
} as const;

function DottedLabelWithTooltip({ label, tooltip }: { label: string; tooltip: string }) {
  return (
    <Tooltip
      label={tooltip}
      side="top"
      contentClassName="max-w-[340px] whitespace-pre-line px-3 py-2 text-left leading-5"
    >
      <button
        type="button"
        className="mb-2 inline-block border-b border-dotted border-[#a8a29e] bg-transparent p-0 text-left text-[13px] font-medium leading-[20px] text-[#292524] outline-none transition focus-visible:border-[#292524] focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      >
        {label}
      </button>
    </Tooltip>
  );
}

// ── Storefront text fields ────────────────────────────────────────────────────

// Floating-label поле в стиле наброска: подпись сверху, значение под ней. Controlled.
function TextField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-zinc-50 px-4 py-3 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
      <div className="mb-0.5 text-xs font-semibold text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none"
      />
    </label>
  );
}

type TextsTab = "home" | "dish" | "cart" | "order";

const TEXTS_TAB_LABELS: Record<TextsTab, string> = {
  home: "На главной",
  dish: "В карточке блюда",
  cart: "В корзине",
  order: "Заказ и доставка",
};

const TEXTS_FIELDS: Record<TextsTab, { key: string; label: string; default: string }[]> = {
  home: [{ key: "homeRec", label: "Заголовок рекомендаций на главной", default: "Рекомендуем попробовать" }],
  dish: [{ key: "dishRec", label: "Заголовок рекомендаций в карточке блюда", default: "С этим блюдом часто заказывают" }],
  cart: [
    { key: "cartRec", label: "Заголовок рекомендаций в корзине", default: "Добавьте к заказу" },
    { key: "cartBtn", label: "Надпись на кнопке заказа", default: "Сделать заказ" },
  ],
  order: [
    { key: "pickupBtn", label: "Надпись кнопки самовывоза", default: "Самовывоз" },
    { key: "deliveryBtn", label: "Надпись кнопки доставки", default: "Доставка" },
  ],
};

function TextsWorkspace({ onChange }: { onChange: () => void }) {
  const [tab, setTab] = useState<TextsTab>("home");
  // mock/local state — бэкенда для этих текстов нет
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(Object.values(TEXTS_FIELDS).flat().map((f) => [f.key, f.default])),
  );
  const update = (key: string) => (v: string) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    onChange();
  };

  return (
    <div className="w-full space-y-5">
      <div className="flex items-end gap-4 border-b border-[#e7e5e4]">
        {(Object.keys(TEXTS_TAB_LABELS) as TextsTab[]).map((key) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`-mb-px h-9 border-b-2 px-1 text-[14px] transition ${
              tab === key
                ? "border-[#292524] text-[#292524]"
                : "border-transparent text-[#79716b] hover:text-[#44403b]"
            }`}
          >
            {TEXTS_TAB_LABELS[key]}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {TEXTS_FIELDS[tab].map((f) => (
          <TextField key={f.key} label={f.label} value={values[f.key]} onChange={update(f.key)} />
        ))}
      </div>
    </div>
  );
}

function PublicTextField({
  label,
  value,
  onChange,
  tooltip,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tooltip: string;
  placeholder: string;
  multiline?: boolean;
}) {
  return (
    <div className="block">
      <DottedLabelWithTooltip label={label} tooltip={tooltip} />
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="min-h-[77px] w-full resize-none rounded-[10px] border border-[#e7e5e4] bg-white px-3 py-2 text-[14px] leading-5 text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.05)] outline-none transition placeholder:text-[#a8a29e] focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-9 w-full rounded-[10px] border border-[#e7e5e4] bg-white px-3 text-[14px] text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.05)] outline-none transition placeholder:text-[#a8a29e] focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5"
        />
      )}
    </div>
  );
}

function SearchPreview({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-[12px] font-medium text-[#79716b]">
        <Search size={14} className="text-[#a8a29e]" />
        Так выглядит в поиске
      </div>
      <div className="rounded-[12px] border border-[#e7e5e4] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-start gap-2.5">
            <span className="mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#e7e5e4] text-[9px] font-semibold text-[#57534d]">
              S
            </span>
            <div className="min-w-0">
              <div className="truncate text-[12px] leading-[15px] text-[#292524]">sweetaffair.kz</div>
              <div className="truncate text-[11px] leading-3 text-[#79716b]">https://sweetaffair.kz</div>
            </div>
          </div>
          <MoreVertical size={15} className="shrink-0 text-[#a8a29e]" />
        </div>
        <div className="mt-2 text-[16px] leading-6 text-[#1a0dab]">
          {title || "Sweet affair — кондитерская и кофейня в Алматы"}
        </div>
        <p className="mt-1 text-[13px] leading-5 text-[#57534d]">
          {description || "Авторские торты, десерты и кофе навынос. Закажите онлайн или забронируйте столик на улице Мухтара Ауэзова, 43/1."}
        </p>
      </div>
    </div>
  );
}

function SocialPreview({ title, description }: { title: string; description: string }) {
  return (
    <div className="space-y-3">
      <div className="text-[12px] font-medium text-[#79716b]">
        Так будет выглядеть в соцсетях и мессенджерах
      </div>
      <div className="overflow-hidden rounded-[14px] border border-[#dedbd6] bg-white">
        <div className="flex h-[109px] items-center justify-center bg-[radial-gradient(#d6d3d1_1px,transparent_1px)] [background-size:24px_24px]">
          <button
            type="button"
            className="inline-flex h-10 items-center gap-2 rounded-[10px] border border-[#e7e5e4] bg-white px-3 text-[13px] font-medium text-[#292524] shadow-sm transition hover:bg-[#fafaf9]"
          >
            <Image size={16} />
            Выбрать изображение
            <ChevronDown size={14} />
          </button>
        </div>
        <div className="p-3">
          <div className="text-[12px] leading-[15px] text-[#57534d]">sweet-affair.tsqr.me</div>
          <div className="mt-2 text-[16px] leading-6 text-[#292524]">
            {title || "Sweet affair — кондитерская и кофейня в Алматы"}
          </div>
          <p className="mt-1 text-[13px] leading-5 text-[#57534d]">
            {description || "Авторские торты, десерты и кофе навынос. Закажите онлайн или забронируйте столик на улице Мухтара Ауэзова, 43/1."}
          </p>
        </div>
      </div>
    </div>
  );
}

function TaskoGetPreview({ city }: { city: string }) {
  return (
    <div className="space-y-3">
      <div className="text-[12px] font-medium text-[#79716b]">
        Так заведение будет отображаться в Tasko Get. Выберите город, чтобы гости могли найти вас в каталоге.
      </div>
      <div className="rounded-[24px] bg-[linear-gradient(120deg,#93c5fd,#f0abfc,#fca5a5,#86efac)] p-px">
        <div className="rounded-[23px] bg-white p-4">
          <div className="flex h-[54px] w-[54px] items-center justify-center rounded-full bg-[#f5f5f4] text-[11px] font-bold text-[#292524] ring-1 ring-[#e7e5e4]">
            ZERNO
          </div>
          <div className="mt-3 flex items-center gap-1.5">
            <div className="text-[18px] font-semibold leading-[22px] text-[#292524]">Zerno</div>
            <span className="flex h-4 w-4 rotate-45 items-center justify-center rounded-[4px] bg-gradient-to-br from-[#a855f7] to-[#14b8a6]">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[13px] leading-[17px]">
            <span className="text-[#79716b]">{city || "Город не выбран"}</span>
            <span className="text-[#a8a29e]">•</span>
            <span className="font-medium text-[#059669]">Онлайн заказ</span>
          </div>
          <p className="mt-3 text-[13px] leading-[17px] text-[#44403b]">
            Кофейня и пекарня. Каждый день свежая выпечка
          </p>
        </div>
      </div>
    </div>
  );
}

function PublicDisplayWorkspace({
  title,
  setTitle,
  description,
  setDescription,
  onChange,
}: {
  title: string;
  setTitle: (value: string) => void;
  description: string;
  setDescription: (value: string) => void;
  onChange: () => void;
}) {
  const [previewTab, setPreviewTab] = useState<PublicPreviewTab>("search");
  const [city, setCity] = useState("");
  const keywords = ["Доставка", "Клубника в шоколаде"];

  const updateTitle = (value: string) => {
    setTitle(value);
    onChange();
  };
  const updateDescription = (value: string) => {
    setDescription(value);
    onChange();
  };

  return (
    <TooltipProvider delayDuration={300}>
      <div className="w-full space-y-5">
      <div className="space-y-3">
        <PublicTextField
          label="Заголовок"
          value={title}
          onChange={updateTitle}
          tooltip={PUBLIC_FIELD_TOOLTIPS.title}
          placeholder="Например: Kimchi Astana — корейская кухня"
        />
        <PublicTextField
          label="Описание"
          value={description}
          onChange={updateDescription}
          tooltip={PUBLIC_FIELD_TOOLTIPS.description}
          placeholder="Кратко опишите кухню, формат и главное преимущество заведения"
          multiline
        />
      </div>

      <div className="overflow-hidden rounded-[12px] border border-[#e7e5e4] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="flex h-11 items-end bg-white px-4">
          {(Object.keys(PUBLIC_PREVIEW_LABELS) as PublicPreviewTab[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => setPreviewTab(key)}
              className={`mr-4 h-9 border-b-2 px-1 text-[14px] transition ${
                previewTab === key
                  ? "border-[#292524] text-[#292524]"
                  : "border-transparent text-[#79716b] hover:text-[#44403b]"
              }`}
            >
              {PUBLIC_PREVIEW_LABELS[key]}
            </button>
          ))}
        </div>

        <div className="border-t border-[#e7e5e4]" />

        <div className="space-y-5 bg-white p-4">
          {previewTab === "search" && (
            <>
              <div className="block">
                <DottedLabelWithTooltip label="Ключевые слова" tooltip={PUBLIC_FIELD_TOOLTIPS.keywords} />
                <div className="flex h-10 items-center rounded-[10px] border border-[#e7e5e4] bg-white px-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-1.5 overflow-hidden">
                    {keywords.length > 0 ? (
                      keywords.map((keyword) => (
                        <span
                          key={keyword}
                          className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-md bg-[#f5f5f4] px-2 text-[13px] text-[#292524]"
                        >
                          {keyword}
                          <X size={12} className="text-[#79716b]" />
                        </span>
                      ))
                    ) : (
                      <span className="truncate text-[14px] text-[#a8a29e]">Добавьте блюда, услуги или особенности</span>
                    )}
                  </div>
                  <ChevronDown size={14} className="ml-2 shrink-0 text-[#79716b]" />
                </div>
              </div>
              <div className="border-t border-[#e7e5e4]" />
              <SearchPreview title={title} description={description} />
            </>
          )}

          {previewTab === "social" && (
            <>
              <div>
                <DottedLabelWithTooltip label="Фото для ссылки" tooltip={PUBLIC_FIELD_TOOLTIPS.linkPhoto} />
                <p className="mt-1 text-[12px] leading-4 text-[#79716b]">
                  Показывается, когда ссылку отправляют в соцсетях и мессенджерах.
                </p>
              </div>
              <div className="border-t border-[#e7e5e4]" />
              <SocialPreview title={title} description={description} />
            </>
          )}

          {previewTab === "tasko" && (
            <>
              <div className="block">
                <DottedLabelWithTooltip label="Город в Tasko Get" tooltip={PUBLIC_FIELD_TOOLTIPS.taskoCity} />
                <div className="relative">
                  <select
                    value={city}
                    onChange={(event) => {
                      setCity(event.target.value);
                      onChange();
                    }}
                    className="h-10 w-full appearance-none rounded-[10px] border border-[#e7e5e4] bg-white px-3 pr-9 text-[14px] text-[#292524] outline-none transition focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5"
                  >
                    <option value="">Выберите город</option>
                    <option value="Астана">Астана</option>
                    <option value="Алматы">Алматы</option>
                  </select>
                  <ChevronDown size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#79716b]" />
                </div>
              </div>
              <div className="border-t border-[#e7e5e4]" />
              <TaskoGetPreview city={city} />
            </>
          )}
        </div>
      </div>
      </div>
    </TooltipProvider>
  );
}

function WarningInfoRow({
  children,
  action,
}: {
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-8 items-center gap-1.5 px-3 pb-3 pt-2 text-[12px] leading-[17px] text-[#a6a09b]">
      <Info size={14} className="shrink-0 text-[#a6a09b]" />
      <span className="min-w-0">{children}</span>
      {action}
    </div>
  );
}

function WarningCard({
  title,
  description,
  checked,
  disabled,
  onCheckedChange,
  onMouseEnter,
  children,
}: {
  title: string;
  description: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
  onMouseEnter?: () => void;
  children?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[13px] bg-[#f5f5f4]/50 transition",
        disabled && "opacity-60",
      )}
      onMouseEnter={onMouseEnter}
      onFocus={onMouseEnter}
    >
      <div className="border-b border-[#e7e5e4] px-3 pt-3">
        <div className="text-[13px] font-medium leading-[17px] text-[#292524]">{title}</div>
        <div className="flex min-h-[42px] items-center gap-6 py-3">
          <p className="min-w-0 flex-1 text-[13px] leading-[17px] text-[#79716b]">{description}</p>
          <Switch
            checked={checked}
            disabled={disabled}
            onCheckedChange={onCheckedChange}
            className="data-[state=checked]:bg-[#57534d]"
          />
        </div>
      </div>
      {children}
    </div>
  );
}

function AgeOption({
  value,
  selected,
  disabled,
  onClick,
}: {
  value: 18 | 21;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "flex h-8 w-[74px] items-center justify-center rounded-[9px] text-[14px] transition disabled:cursor-not-allowed",
        selected ? "bg-[#e7e5e4] font-medium text-[#1c1917]" : "text-[#79716b] hover:bg-[#f5f5f4]",
      )}
    >
      {value}+
    </button>
  );
}

function GuestRulesWorkspace({
  setPreviewScenario,
  onConfigureOrderSettings,
  onChange,
}: {
  setPreviewScenario: (scenario: PreviewScenario) => void;
  onConfigureOrderSettings: () => void;
  onChange: () => void;
}) {
  const {
    serviceFeeEnabled,
    serviceFeeRequireConsent,
    setServiceFeeRequireConsent,
  } = useAppSettings();
  const [qrDiscountEnabled, setQrDiscountEnabled] = useState(true);

  const updateQrDiscountEnabled = (checked: boolean) => {
    setQrDiscountEnabled(checked);
    onChange();
  };
  const updateServiceFeeConsent = (checked: boolean) => {
    setServiceFeeRequireConsent(checked);
    onChange();
  };

  return (
    <div className="w-full space-y-[18px]">
      <div className="space-y-2">
        <WarningCard
          title="Скидка на QR"
          description="Показывать размер скидки гостю"
          checked={qrDiscountEnabled}
          onCheckedChange={updateQrDiscountEnabled}
        >
          <WarningInfoRow
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto rounded-md px-1 py-0 text-[12px] font-normal text-[#4f39f6] hover:bg-transparent hover:text-[#3b2cc7]"
              >
                в QR-кодах
              </Button>
            }
          >
            Размер скидки и QR-коды настраиваются на странице
          </WarningInfoRow>
        </WarningCard>

        <WarningCard
          title="Сервисный сбор"
          description="Запрашивать согласие на сервисный сбор"
          checked={serviceFeeEnabled && serviceFeeRequireConsent}
          disabled={!serviceFeeEnabled}
          onCheckedChange={updateServiceFeeConsent}
          onMouseEnter={() => setPreviewScenario("serviceFee")}
        >
          <WarningInfoRow
            action={
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-auto rounded-md px-1 py-0 text-[12px] font-normal text-[#4f39f6] hover:bg-transparent hover:text-[#3b2cc7]"
                onClick={onConfigureOrderSettings}
              >
                “Настройка заказов”
              </Button>
            }
          >
            Размер сервисного сбора настраивается на странице
          </WarningInfoRow>
        </WarningCard>
      </div>
    </div>
  );
}

// ── Основное (basic info) ─────────────────────────────────────────────────────

// Поле в стиле макета: подпись над полем, поле в белой рамке.
function BasicField({
  label,
  value,
  onChange,
  onBlur,
  error,
  id,
  helperText,
  className,
  placeholder,
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  onBlur?: () => void;
  error?: string;
  id?: string;
  helperText?: string;
  className?: string;
  placeholder?: string;
  multiline?: boolean;
}) {
  const errorId = error && id ? `${id}-error` : undefined;
  const inputClass =
    "w-full rounded-[12px] border border-[#e7e5e4] bg-white px-3.5 text-[14px] text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.03)] outline-none transition placeholder:text-[#a8a29e] focus:border-[#c7c2bd]";
  return (
    <label className={cn("block", className)}>
      <div className="mb-1.5 text-[13px] font-medium leading-[18px] text-[#292524]">{label}</div>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          rows={3}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={cn(inputClass, "resize-none py-2.5 leading-5", error && "border-[#dc2626] focus:border-[#dc2626]")}
        />
      ) : (
        <input
          id={id}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={onBlur}
          placeholder={placeholder}
          aria-invalid={Boolean(error)}
          aria-describedby={errorId}
          className={cn(inputClass, "h-10", error && "border-[#dc2626] focus:border-[#dc2626]")}
        />
      )}
      <div
        id={errorId}
        className={cn("mt-1 min-h-[16px] text-[12px] leading-4", error ? "text-[#dc2626]" : "text-[#a8a29e]")}
      >
        {error ?? helperText}
      </div>
    </label>
  );
}

type ChannelDef = { id: string; label: string; icon: LucideIcon };

const SOCIAL_CHANNELS: ChannelDef[] = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "2gis", label: "2GIS", icon: MapPin },
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "tiktok", label: "TikTok", icon: Music2 },
  { id: "website", label: "Сайт", icon: Globe },
  { id: "youtube", label: "YouTube", icon: Youtube },
];

const CONTACT_CHANNELS: ChannelDef[] = [
  { id: "telegram", label: "Telegram", icon: Send },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "phone", label: "Телефон", icon: Phone },
];

// ── График работы ─────────────────────────────────────────────────────────────

const WEEK_DAYS = ["Понедельник", "Вторник", "Среда", "Четверг", "Пятница", "Суббота", "Воскресенье"];

type DayMode = "custom" | "allday" | "closed";
type DaySchedule = { mode: DayMode; from: string; to: string };

const DAY_MODE_LABELS: Record<DayMode, string> = {
  custom: "Своё время",
  allday: "Круглосуточно",
  closed: "Недоступно",
};

// Заголовок секции опционального блока: подпись + корзинка справа, как в макете.
function BlockHeader({
  label,
  onRemove,
  removeTitle,
}: {
  label: ReactNode;
  onRemove: () => void;
  removeTitle: string;
}) {
  return (
    <div className="mb-1.5 flex h-7 items-center">
      <div className="flex min-w-0 items-center gap-1.5 text-[13px] font-medium leading-[18px] text-[#292524]">
        {label}
      </div>
      <div className="flex-1" />
      <button
        type="button"
        title={removeTitle}
        onClick={onRemove}
        className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#a8a29e] transition hover:bg-[#fef2f2] hover:text-[#dc2626]"
      >
        <Trash2 size={15} />
      </button>
    </div>
  );
}

function ScheduleCard({ onChange, onRemove }: { onChange: () => void; onRemove: () => void }) {
  const [expanded, setExpanded] = useState(true);
  const [days, setDays] = useState<DaySchedule[]>(() =>
    WEEK_DAYS.map(() => ({ mode: "custom" as DayMode, from: "10:00", to: "22:00" })),
  );

  const updateDay = (index: number, patch: Partial<DaySchedule>) => {
    setDays((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
    onChange();
  };

  return (
    <div>
      <div className={cn("flex h-7 items-center", expanded && "mb-1.5")}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 rounded-[6px] text-[13px] font-medium leading-[18px] text-[#292524] transition hover:text-[#57534d]"
        >
          График работы
          <ChevronDown size={15} className={cn("text-[#79716b] transition-transform", expanded && "rotate-180")} />
        </button>
        <div className="flex-1" />
        <button
          type="button"
          title="Удалить график"
          onClick={onRemove}
          className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#a8a29e] transition hover:bg-[#fef2f2] hover:text-[#dc2626]"
        >
          <Trash2 size={15} />
        </button>
      </div>
      {expanded && (
        <div className="divide-y divide-[#eceae7] rounded-[12px] border border-[#e7e5e4] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
          {days.map((day, index) => (
            <div key={WEEK_DAYS[index]} className="group flex h-[52px] items-center gap-3 px-4">
              <span className={cn("w-[110px] shrink-0 text-[14px]", day.mode === "closed" ? "text-[#a8a29e]" : "text-[#292524]")}>
                {WEEK_DAYS[index]}
              </span>
              {day.mode === "custom" ? (
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={day.from}
                    onChange={(event) => updateDay(index, { from: event.target.value })}
                    className="h-9 rounded-[10px] border border-[#e7e5e4] bg-white px-2.5 text-[13px] text-[#292524] outline-none transition focus:border-[#c7c2bd]"
                  />
                  <span className="text-[13px] text-[#a8a29e]">–</span>
                  <input
                    type="time"
                    value={day.to}
                    onChange={(event) => updateDay(index, { to: event.target.value })}
                    className="h-9 rounded-[10px] border border-[#e7e5e4] bg-white px-2.5 text-[13px] text-[#292524] outline-none transition focus:border-[#c7c2bd]"
                  />
                </div>
              ) : (
                <span className={cn("text-[14px]", day.mode === "closed" ? "text-[#a8a29e]" : "text-[#292524]")}>
                  {DAY_MODE_LABELS[day.mode]}
                </span>
              )}
              <div className="flex-1" />
              {/* Переключатель режима дня — появляется при hover строки */}
              <DropdownMenu.Root>
                <DropdownMenu.Trigger asChild>
                  <button
                    type="button"
                    className="flex h-8 items-center gap-1 rounded-[8px] px-2 text-[13px] text-[#79716b] opacity-0 transition hover:bg-[#f5f5f4] focus-visible:opacity-100 group-hover:opacity-100 data-[state=open]:opacity-100"
                  >
                    {DAY_MODE_LABELS[day.mode]}
                    <ChevronDown size={14} className="text-[#a8a29e]" />
                  </button>
                </DropdownMenu.Trigger>
                <DropdownMenu.Portal>
                  <DropdownMenu.Content
                    align="end"
                    sideOffset={6}
                    className="z-50 min-w-[160px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
                  >
                    {(Object.keys(DAY_MODE_LABELS) as DayMode[]).map((mode) => (
                      <DropdownMenu.Item
                        key={mode}
                        onSelect={() => updateDay(index, { mode })}
                        className="flex h-8 cursor-pointer select-none items-center rounded-lg px-2.5 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                      >
                        {DAY_MODE_LABELS[mode]}
                      </DropdownMenu.Item>
                    ))}
                  </DropdownMenu.Content>
                </DropdownMenu.Portal>
              </DropdownMenu.Root>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Ссылки по каналам (соцсети, контакты) ─────────────────────────────────────

type ChannelEntry = { id: number; channel: string; link: string; text: string };
type ChannelGroup = "social" | "contact";
type ChannelEntryError = { link?: string };
type TouchedRows = Record<number, boolean>;

// ponytail: модульный счётчик id — бэкенда нет, коллизии невозможны в рамках сессии
let nextEntryId = 1;
function createChannelEntry(channel: string): ChannelEntry {
  return { id: nextEntryId++, channel, link: "", text: "" };
}

const SOCIAL_DOMAIN_RULES: Record<string, { label: string; hosts: string[] }> = {
  instagram: { label: "Instagram", hosts: ["instagram.com"] },
  "2gis": { label: "2GIS", hosts: ["2gis.kz", "2gis.ru", "2gis.com"] },
  facebook: { label: "Facebook", hosts: ["facebook.com", "fb.com"] },
  tiktok: { label: "TikTok", hosts: ["tiktok.com"] },
  youtube: { label: "YouTube", hosts: ["youtube.com", "youtu.be"] },
};

const LINK_PLACEHOLDERS: Record<ChannelGroup, Record<string, string>> = {
  social: {
    instagram: "instagram.com/tasko",
    "2gis": "2gis.kz",
    facebook: "facebook.com/tasko",
    tiktok: "tiktok.com/@tasko",
    website: "tasko.kz",
    youtube: "youtube.com/@tasko",
  },
  contact: {
    telegram: "t.me/tasko",
    whatsapp: "wa.me/77771234567",
    phone: "+7 (___) ___-__-__",
  },
};

const DESCRIPTION_LIMIT = 500;

function isRowBlank(entry: ChannelEntry) {
  return entry.link.trim().length === 0 && entry.text.trim().length === 0;
}

function hasUrlScheme(value: string) {
  return /^[a-z][a-z\d+\-.]*:\/\//i.test(value);
}

function getLinkPlaceholder(group: ChannelGroup, channelId: string) {
  return LINK_PLACEHOLDERS[group][channelId] ?? "Ссылка";
}

function getLinkInputMode(group: ChannelGroup, channelId: string) {
  if (group === "social") return "url";
  if (channelId === "phone" || channelId === "whatsapp") return "tel";
  return "url";
}

function getLinkAutocomplete(group: ChannelGroup, channelId: string) {
  if (group === "social") return "url";
  if (channelId === "phone" || channelId === "whatsapp") return "tel";
  return "url";
}

function normalizeUrl(value: string) {
  const trimmed = value.trim();
  if (!trimmed || /\s/.test(trimmed)) return null;

  try {
    const url = new URL(hasUrlScheme(trimmed) ? trimmed : `https://${trimmed}`);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    if (!url.hostname.includes(".")) return null;

    const host = url.host.toLowerCase();
    const path = url.pathname === "/" && !url.search && !url.hash ? "" : url.pathname;
    return `${url.protocol}//${host}${path}${url.search}${url.hash}`;
  } catch {
    return null;
  }
}

function hostMatches(host: string, allowedHost: string) {
  return host === allowedHost || host.endsWith(`.${allowedHost}`);
}

function getUrlHost(value: string) {
  const normalized = normalizeUrl(value);
  if (!normalized) return null;
  return new URL(normalized).hostname.toLowerCase();
}

function getDigitPosition(value: string, digitCount: number) {
  if (digitCount <= 0) return 0;

  let seen = 0;
  for (let index = 0; index < value.length; index++) {
    if (/\d/.test(value[index])) seen++;
    if (seen === digitCount) return index + 1;
  }

  return value.length;
}

function formatLocalPhone(prefix: string, digits: string) {
  const area = digits.slice(0, 3);
  const first = digits.slice(3, 6);
  const second = digits.slice(6, 8);
  const third = digits.slice(8, 10);

  if (!area) return prefix;
  if (area.length < 3) return `${prefix} (${area}`;
  if (!first) return `${prefix} (${area})`;
  if (first.length < 3) return `${prefix} (${area}) ${first}`;
  if (!second) return `${prefix} (${area}) ${first}`;
  if (second.length < 2) return `${prefix} (${area}) ${first}-${second}`;
  if (!third) return `${prefix} (${area}) ${first}-${second}`;
  return `${prefix} (${area}) ${first}-${second}-${third}`;
}

function formatGenericPhone(value: string) {
  const hasPlus = value.trim().startsWith("+");
  const digits = value.replace(/\D/g, "");
  const groups = digits.match(/.{1,3}/g) ?? [];
  return `${hasPlus ? "+" : ""}${groups.join(" ")}`;
}

function canFormatPhoneInput(value: string) {
  if (!value) return true;
  if (/[^+\d\s()-]/.test(value)) return false;

  const plusCount = (value.match(/\+/g) ?? []).length;
  return plusCount <= 1 && (plusCount === 0 || value.trim().startsWith("+"));
}

function formatPhoneInput(value: string) {
  if (!canFormatPhoneInput(value)) return value;

  const trimmed = value.trimStart();
  const digits = value.replace(/\D/g, "");
  if (!digits) return trimmed.startsWith("+") ? "+" : "";

  if (trimmed.startsWith("+7")) {
    return formatLocalPhone("+7", digits.startsWith("7") ? digits.slice(1, 11) : digits.slice(0, 10));
  }

  if (!trimmed.startsWith("+") && digits.startsWith("8")) {
    return formatLocalPhone("8", digits.slice(1, 11));
  }

  if (!trimmed.startsWith("+") && digits.length <= 10) {
    return formatLocalPhone("", digits.slice(0, 10)).trim();
  }

  return formatGenericPhone(value);
}

function normalizePhone(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/[^+\d\s()-]/.test(trimmed)) return null;

  const plusCount = (trimmed.match(/\+/g) ?? []).length;
  if (plusCount > 1 || (plusCount === 1 && !trimmed.startsWith("+"))) return null;

  const digits = trimmed.replace(/\D/g, "");
  if (digits.length < 10 || digits.length > 15) return null;

  if (trimmed.startsWith("+")) return `+${digits}`;
  if (digits.length === 11 && digits.startsWith("8")) return `+7${digits.slice(1)}`;
  return `+${digits}`;
}

function normalizeTelegramInput(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (/^@[a-zA-Z0-9_]{5,32}$/.test(trimmed)) return trimmed.toLowerCase();

  const url = normalizeUrl(trimmed);
  if (!url) return null;
  const parsed = new URL(url);
  const host = parsed.hostname.toLowerCase();
  if (!hostMatches(host, "t.me") && !hostMatches(host, "telegram.me")) return null;
  return url.toLowerCase();
}

function normalizeContactInput(entry: ChannelEntry) {
  if (entry.channel === "telegram") {
    return normalizeTelegramInput(entry.link) ?? normalizePhone(entry.link);
  }
  if (entry.channel === "whatsapp") {
    const phone = normalizePhone(entry.link);
    if (phone) return phone;
    const url = normalizeUrl(entry.link);
    if (!url) return null;
    const host = new URL(url).hostname.toLowerCase();
    return hostMatches(host, "wa.me") || hostMatches(host, "whatsapp.com") ? url.toLowerCase() : null;
  }
  return normalizePhone(entry.link);
}

function validateEntryValue(group: ChannelGroup, entry: ChannelEntry): ChannelEntryError {
  if (isRowBlank(entry)) return {};
  if (!entry.link.trim()) {
    return { link: group === "social" ? "Заполните ссылку или удалите строку" : "Заполните контакт или удалите строку" };
  }

  if (group === "social") {
    const normalized = normalizeUrl(entry.link);
    if (!normalized) return { link: "Введите корректную ссылку" };

    const rule = SOCIAL_DOMAIN_RULES[entry.channel];
    if (rule) {
      const host = getUrlHost(normalized);
      if (!host || !rule.hosts.some((allowedHost) => hostMatches(host, allowedHost))) {
        return { link: `Укажите ссылку на ${rule.label}` };
      }
    }

    return {};
  }

  if (entry.channel === "telegram") {
    return normalizeContactInput(entry) ? {} : { link: "Введите @username, ссылку t.me или телефон" };
  }

  if (entry.channel === "whatsapp") {
    return normalizeContactInput(entry) ? {} : { link: "Введите корректный номер WhatsApp" };
  }

  return normalizeContactInput(entry) ? {} : { link: "Введите корректный номер телефона" };
}

function getEntryDuplicateKey(group: ChannelGroup, entry: ChannelEntry) {
  if (isRowBlank(entry) || !entry.link.trim()) return null;

  if (group === "social") {
    return normalizeUrl(entry.link)?.toLowerCase() ?? null;
  }

  return normalizeContactInput(entry)?.toLowerCase() ?? null;
}

function validateChannelEntries(group: ChannelGroup, entries: ChannelEntry[], touched: TouchedRows) {
  const errors: Record<number, ChannelEntryError> = {};
  const duplicateKeys = new Map<string, number[]>();

  entries.forEach((entry) => {
    const key = getEntryDuplicateKey(group, entry);
    if (!key) return;
    duplicateKeys.set(key, [...(duplicateKeys.get(key) ?? []), entry.id]);
  });

  entries.forEach((entry) => {
    if (!touched[entry.id]) return;
    const entryError = validateEntryValue(group, entry);
    const duplicateKey = getEntryDuplicateKey(group, entry);
    const isDuplicate = duplicateKey ? (duplicateKeys.get(duplicateKey)?.length ?? 0) > 1 : false;

    if (isDuplicate && !entryError.link) {
      entryError.link = group === "social" ? "Такая ссылка уже добавлена" : "Такой контакт уже добавлен";
    }

    if (entryError.link) errors[entry.id] = entryError;
  });

  return errors;
}

// Дропдаун выбора канала; используется и в карточке, и в списке «Ещё».
function ChannelMenu({
  channels,
  onSelect,
  children,
}: {
  channels: ChannelDef[];
  onSelect: (channelId: string) => void;
  children: ReactNode;
}) {
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>{children}</DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="start"
          sideOffset={6}
          className="z-50 min-w-[190px] rounded-[12px] border border-[#e7e5e4] bg-white p-1 shadow-[0_18px_42px_rgba(41,37,36,0.14)] outline-none"
        >
          {channels.map((channel) => {
            const Icon = channel.icon;
            return (
              <DropdownMenu.Item
                key={channel.id}
                onSelect={() => onSelect(channel.id)}
                className="flex h-8 cursor-pointer select-none items-center gap-2 rounded-lg px-2.5 text-[13px] font-medium text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
              >
                <Icon size={15} className="text-[#79716b]" />
                {channel.label}
              </DropdownMenu.Item>
            );
          })}
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ChannelLinksCard({
  group,
  title,
  addLabel,
  channels,
  entries,
  setEntries,
  onChange,
}: {
  group: ChannelGroup;
  title: string;
  addLabel: string;
  channels: ChannelDef[];
  entries: ChannelEntry[];
  setEntries: (update: (prev: ChannelEntry[]) => ChannelEntry[]) => void;
  onChange: () => void;
}) {
  const [touchedRows, setTouchedRows] = useState<TouchedRows>({});
  const errors = useMemo(() => validateChannelEntries(group, entries, touchedRows), [entries, group, touchedRows]);

  const touchEntry = (id: number) => {
    setTouchedRows((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  };
  const addEntry = (channel: string) => {
    setEntries((prev) => [...prev, createChannelEntry(channel)]);
    onChange();
  };
  const updateEntry = (id: number, patch: Partial<ChannelEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...patch } : e)));
    onChange();
  };
  const updateLinkValue = (entry: ChannelEntry, value: string, caretPosition: number | null, input: HTMLInputElement) => {
    const shouldFormatPhone = group === "contact" && (entry.channel === "phone" || canFormatPhoneInput(value));
    const nextValue = shouldFormatPhone ? formatPhoneInput(value) : value;
    updateEntry(entry.id, { link: nextValue });

    if (shouldFormatPhone && caretPosition !== null && nextValue !== value) {
      const digitsBeforeCaret = value.slice(0, caretPosition).replace(/\D/g, "").length;
      const nextCaret = getDigitPosition(nextValue, digitsBeforeCaret);
      window.requestAnimationFrame(() => {
        input.setSelectionRange(nextCaret, nextCaret);
      });
    }
  };
  const updateChannel = (entry: ChannelEntry, channelId: string) => {
    if (!isRowBlank(entry)) touchEntry(entry.id);
    updateEntry(entry.id, { channel: channelId });
  };
  const removeEntry = (id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    setTouchedRows((prev) => {
      if (!prev[id]) return prev;
      const next = { ...prev };
      delete next[id];
      return next;
    });
    onChange();
  };
  const handleLinkBlur = (entry: ChannelEntry) => {
    touchEntry(entry.id);

    const normalized = normalizeUrl(entry.link);
    const shouldNormalizeUrl =
      group === "social" ||
      (entry.channel === "telegram" && normalized && ["t.me", "telegram.me"].some((host) => hostMatches(new URL(normalized).hostname.toLowerCase(), host))) ||
      (entry.channel === "whatsapp" && normalized && ["wa.me", "whatsapp.com"].some((host) => hostMatches(new URL(normalized).hostname.toLowerCase(), host)));

    if (shouldNormalizeUrl && normalized && normalized !== entry.link.trim()) {
      updateEntry(entry.id, { link: normalized });
      return;
    }

    if (group === "contact" && (entry.channel === "phone" || normalizePhone(entry.link))) {
      const formatted = formatPhoneInput(entry.link);
      if (formatted !== entry.link) updateEntry(entry.id, { link: formatted });
    }
  };

  const [expanded, setExpanded] = useState(true);
  const inputClass =
    "h-10 w-full min-w-0 rounded-[10px] border border-[#e7e5e4] bg-white px-3 text-[14px] text-[#292524] outline-none transition placeholder:text-[#a8a29e] focus:border-[#c7c2bd]";

  return (
    <div>
      <div className={cn("flex h-7 items-center", expanded && "mb-1.5")}>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="flex items-center gap-1.5 rounded-[6px] text-[13px] font-medium leading-[18px] text-[#292524] transition hover:text-[#57534d]"
        >
          {title}
          <ChevronDown size={15} className={cn("text-[#79716b] transition-transform", expanded && "rotate-180")} />
        </button>
      </div>
      {expanded && (
      <div className="rounded-[12px] border border-[#e7e5e4] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        {entries.length > 0 && (
          <div className="space-y-2 p-3">
            {entries.map((entry) => {
              const channel = channels.find((c) => c.id === entry.channel) ?? channels[0];
              const Icon = channel.icon;
              const error = errors[entry.id]?.link;
              const errorId = error ? `channel-${group}-${entry.id}-error` : undefined;
              return (
                <div key={entry.id} className="space-y-1">
                  <div className="flex items-center gap-2">
                    {/* Иконка — переключатель типа канала */}
                    <ChannelMenu channels={channels} onSelect={(id) => updateChannel(entry, id)}>
                      <button
                        type="button"
                        title={`${channel.label} — сменить канал`}
                        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#f5f5f4] text-[#57534d] transition hover:bg-[#eeeeec]"
                      >
                        <Icon size={18} />
                      </button>
                    </ChannelMenu>
                    <input
                      value={entry.link}
                      onChange={(event) =>
                        updateLinkValue(entry, event.target.value, event.target.selectionStart, event.currentTarget)
                      }
                      onBlur={() => handleLinkBlur(entry)}
                      placeholder={getLinkPlaceholder(group, entry.channel)}
                      inputMode={getLinkInputMode(group, entry.channel)}
                      autoComplete={getLinkAutocomplete(group, entry.channel)}
                      aria-invalid={Boolean(error)}
                      aria-describedby={errorId}
                      className={cn(inputClass, "flex-1", error && "border-[#dc2626] focus:border-[#dc2626]")}
                    />
                    <input
                      value={entry.text}
                      onChange={(event) => updateEntry(entry.id, { text: event.target.value })}
                      onBlur={() => touchEntry(entry.id)}
                      placeholder="Подпись (необязательно)"
                      className={cn(inputClass, "flex-[1.2]")}
                    />
                    <button
                      type="button"
                      title="Удалить"
                      onClick={() => removeEntry(entry.id)}
                      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[8px] text-[#a8a29e] transition hover:bg-[#f5f5f4] hover:text-[#57534d]"
                    >
                      <X size={16} />
                    </button>
                  </div>
                  <div id={errorId} className="min-h-[16px] pl-12 text-[12px] leading-4 text-[#dc2626]">
                    {error}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <ChannelMenu channels={channels} onSelect={addEntry}>
          <button
            type="button"
            className={cn(
              "flex h-11 w-full items-center gap-2 rounded-b-[12px] px-3.5 text-[13px] text-[#57534d] transition hover:bg-[#fafaf9]",
              entries.length > 0 ? "border-t border-[#eceae7]" : "rounded-t-[12px]",
            )}
          >
            <CirclePlus size={16} className="text-[#a8a29e]" />
            {addLabel}
          </button>
        </ChannelMenu>
      </div>
      )}
    </div>
  );
}

// ── Возрастное ограничение (карточка на странице = ограничение включено) ──────

const AGE_TOOLTIP =
  "Перед открытием меню гость подтверждает, что достиг выбранного возраста — 18 лет или 21 года. Подходит барам, кальянным и меню с алкоголем.";

function AgeRestrictionCard({
  onChange,
  setPreviewScenario,
}: {
  onChange: () => void;
  setPreviewScenario: (scenario: PreviewScenario) => void;
}) {
  const { setAgeConfirmationEnabled, minimumAge, setMinimumAge } = useAppSettings();

  return (
    <div
      onMouseEnter={() => setPreviewScenario("age")}
      onMouseLeave={() => setPreviewScenario("about")}
    >
      <BlockHeader
        label={
          <Tooltip
            label={AGE_TOOLTIP}
            side="top"
            contentClassName="max-w-[300px] whitespace-pre-line px-3 py-2 text-left leading-5"
          >
            <span className="cursor-default border-b border-dotted border-[#a8a29e] pb-px">
              Возрастное ограничение
            </span>
          </Tooltip>
        }
        removeTitle="Убрать ограничение"
        onRemove={() => {
          setAgeConfirmationEnabled(false);
          onChange();
        }}
      />
      <div className="flex items-center gap-1">
        {([18, 21] as const).map((age) => (
          <AgeOption
            key={age}
            value={age}
            selected={minimumAge === age}
            onClick={() => {
              setMinimumAge(age);
              onChange();
            }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Wi-Fi ─────────────────────────────────────────────────────────────────────

function WifiCard({ onChange, onRemove }: { onChange: () => void; onRemove: () => void }) {
  const [network, setNetwork] = useState("");
  const [password, setPassword] = useState("");
  const inputClass =
    "h-10 w-full min-w-0 rounded-[10px] border border-[#e7e5e4] bg-white px-3 text-[14px] text-[#292524] outline-none transition placeholder:text-[#a8a29e] focus:border-[#c7c2bd]";

  return (
    <div>
      <BlockHeader label="Wi-Fi" removeTitle="Удалить Wi-Fi" onRemove={onRemove} />
      <div className="flex gap-2">
        <input
          value={network}
          onChange={(event) => {
            setNetwork(event.target.value);
            onChange();
          }}
          placeholder="Название сети"
          className={cn(inputClass, "flex-1")}
        />
        <input
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            onChange();
          }}
          placeholder="Пароль"
          className={cn(inputClass, "flex-[1.6]")}
        />
      </div>
    </div>
  );
}

function BasicInfoWorkspace({
  onChange,
  setPreviewScenario,
}: {
  onChange: () => void;
  setPreviewScenario: (scenario: PreviewScenario) => void;
}) {
  const { ageConfirmationEnabled, setAgeConfirmationEnabled } = useAppSettings();
  const [name, setName] = useState("Sweet affair");
  const [address, setAddress] = useState("Астана, Абылай-хана 34, д 18");
  const [description, setDescription] = useState("");
  const [wifiAdded, setWifiAdded] = useState(false);
  const [scheduleAdded, setScheduleAdded] = useState(false);
  const [basicTouched, setBasicTouched] = useState<Record<"name" | "address" | "description", boolean>>({
    name: false,
    address: false,
    description: false,
  });
  // Один пустой ряд по умолчанию: показывает форму данных и экономит клик.
  // Пустые ряды инертны — на витрину не попадают и нигде не считаются «незаполненными».
  const [socialEntries, setSocialEntries] = useState<ChannelEntry[]>(() => [createChannelEntry("instagram")]);
  const [contactEntries, setContactEntries] = useState<ChannelEntry[]>(() => [createChannelEntry("phone")]);

  const basicErrors = useMemo(
    () => ({
      name: basicTouched.name && !name.trim() ? "Введите название заведения" : undefined,
      address: basicTouched.address && !address.trim() ? "Введите адрес" : undefined,
      description:
        basicTouched.description && description.trim().length > DESCRIPTION_LIMIT
          ? `Сократите описание до ${DESCRIPTION_LIMIT} символов`
          : undefined,
    }),
    [address, basicTouched, description, name],
  );

  const touchBasicField = (field: keyof typeof basicTouched) => {
    setBasicTouched((prev) => (prev[field] ? prev : { ...prev, [field]: true }));
  };

  const edit = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    onChange();
  };

  const addRowClass =
    "flex h-9 items-center gap-2 rounded-[8px] px-1.5 text-[14px] text-[#44403b] transition hover:bg-[#f5f5f4]";

  // Пустые строки «Ещё» показываются, пока соответствующий блок не добавлен.
  const moreRows: ReactNode[] = [];
  if (!wifiAdded) {
    moreRows.push(
      <button key="wifi" type="button" className={addRowClass} onClick={() => { setWifiAdded(true); onChange(); }}>
        <CirclePlus size={16} className="text-[#a8a29e]" />
        Добавить Wi-Fi
      </button>,
    );
  }
  if (!scheduleAdded) {
    moreRows.push(
      <button key="schedule" type="button" className={addRowClass} onClick={() => { setScheduleAdded(true); onChange(); }}>
        <CirclePlus size={16} className="text-[#a8a29e]" />
        Добавить график работы
      </button>,
    );
  }
  if (!ageConfirmationEnabled) {
    moreRows.push(
      <Tooltip
        key="age"
        label={AGE_TOOLTIP}
        side="top"
        contentClassName="max-w-[300px] whitespace-pre-line px-3 py-2 text-left leading-5"
      >
        <button type="button" className={addRowClass} onClick={() => { setAgeConfirmationEnabled(true); onChange(); }}>
          <CirclePlus size={16} className="text-[#a8a29e]" />
          Добавить возрастное ограничение
        </button>
      </Tooltip>,
    );
  }
  return (
    <TooltipProvider delayDuration={300}>
    <div className="w-full space-y-4">
      {/* Логотип + название */}
      <div className="flex items-end gap-3">
        <button
          type="button"
          className="flex h-[68px] w-[68px] shrink-0 flex-col items-center justify-center rounded-[14px] bg-[#f5f5f4] text-[#79716b] transition hover:bg-[#eeeeec]"
        >
          <Plus size={16} />
          <span className="mt-0.5 text-[11px] leading-3">Лого</span>
        </button>
        <BasicField
          id="about-name"
          label="Название заведения"
          value={name}
          onChange={edit(setName)}
          onBlur={() => touchBasicField("name")}
          error={basicErrors.name}
          className="flex-1"
        />
      </div>

      <BasicField
        id="about-address"
        label="Адрес"
        value={address}
        onChange={edit(setAddress)}
        onBlur={() => touchBasicField("address")}
        error={basicErrors.address}
        placeholder="Например, ул. Кунаева, 12"
      />

      <BasicField
        id="about-description"
        label="Описание"
        value={description}
        onChange={edit(setDescription)}
        onBlur={() => touchBasicField("description")}
        error={basicErrors.description}
        helperText={`${description.length}/${DESCRIPTION_LIMIT}`}
        placeholder="Расскажите гостям о заведении: кухня, формат, атмосфера"
        multiline
      />

      {scheduleAdded && (
        <ScheduleCard onChange={onChange} onRemove={() => { setScheduleAdded(false); onChange(); }} />
      )}

      <ChannelLinksCard
        group="social"
        title="Соцсети и сайты"
        addLabel="Добавить ссылку"
        channels={SOCIAL_CHANNELS}
        entries={socialEntries}
        setEntries={setSocialEntries}
        onChange={onChange}
      />

      <ChannelLinksCard
        group="contact"
        title="Контакты"
        addLabel="Добавить контакт"
        channels={CONTACT_CHANNELS}
        entries={contactEntries}
        setEntries={setContactEntries}
        onChange={onChange}
      />

      {wifiAdded && <WifiCard onChange={onChange} onRemove={() => { setWifiAdded(false); onChange(); }} />}

      {ageConfirmationEnabled && (
        <AgeRestrictionCard onChange={onChange} setPreviewScenario={setPreviewScenario} />
      )}

      {moreRows.length > 0 && (
        <div className="pt-1">
          <div className="mb-1 text-[13px] font-medium text-[#292524]">Ещё</div>
          <div className="flex flex-col items-start">{moreRows}</div>
        </div>
      )}
    </div>
    </TooltipProvider>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AboutWorkspace({
  setPreviewScenario,
  onConfigureOrderSettings,
  aboutTab: tab,
  seoTitle,
  setSeoTitle,
  seoDescription,
  setSeoDescription,
}: AboutWorkspaceProps) {
  const { registerChange } = usePublish();

  return (
    <PageScroll>
      <PageContent>
        <CompactContent className="space-y-6">
          <div>
            <h1 className="text-[14px] font-medium leading-tight text-stone-950">{TAB_HEADERS[tab].title}</h1>
            <p className="mt-1 text-sm text-zinc-500">{TAB_HEADERS[tab].subtitle}</p>
          </div>

          <LaunchPageHint
            checkId="about"
            title="Заполните информацию о заведении"
            description="Добавьте описание, контакты и график работы — всё, что поможет гостям узнать о вас больше."
          />

          {/* ── Основное ── */}
          {tab === "info" && (
            <div onMouseEnter={() => setPreviewScenario("about")}>
              <BasicInfoWorkspace onChange={() => registerChange("about")} setPreviewScenario={setPreviewScenario} />
            </div>
          )}

          {/* ── Правила для гостей ── */}
          {tab === "guest-rules" && (
            <GuestRulesWorkspace
              setPreviewScenario={setPreviewScenario}
              onConfigureOrderSettings={onConfigureOrderSettings}
              onChange={() => registerChange("about")}
            />
          )}

          {tab === "public-display" && (
            <PublicDisplayWorkspace
              title={seoTitle}
              setTitle={setSeoTitle}
              description={seoDescription}
              setDescription={setSeoDescription}
              onChange={() => registerChange("about")}
            />
          )}

          {/* ── Тексты ── */}
          {tab === "rec-titles" && (
            <TextsWorkspace onChange={() => registerChange("about")} />
          )}
        </CompactContent>
      </PageContent>
    </PageScroll>
  );
}
