import { useState, type ReactNode } from "react";
import { ChevronDown, Facebook, Globe, GripHorizontal, Image, Info, Instagram, MapPin, MessageCircle, MoreVertical, Phone, Plus, Search, Send, Trash2, X, Youtube } from "lucide-react";
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
  "guest-rules": "Правила для гостей",
  "public-display": "Публичное отображение",
  "rec-titles": "Тексты",
};

// Один источник для заголовка/подзаголовка рабочей области по активной вкладке.
const TAB_HEADERS: Record<AboutTab, { title: string; subtitle: string }> = {
  "info": { title: "Основное", subtitle: "Информация, которая поможет гостям лучше узнать о вас." },
  "guest-rules": { title: "Предупреждения", subtitle: "Настройте подтверждения, которые гости увидят перед открытием меню." },
  "public-display": { title: "Публичное отображение", subtitle: "Настройте, как заведение выглядит в поиске, соцсетях и на Tasko Get." },
  "rec-titles": { title: "Тексты", subtitle: "Настройте подписи и заголовки, которые гости видят на витрине." },
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
    { key: "waiterBtn", label: "Надпись кнопки вызова официанта", default: "Позвать официанта" },
    { key: "pickupBtn", label: "Надпись кнопки самовывоза", default: "Самовывоз" },
    { key: "deliveryBtn", label: "Надпись кнопки доставки", default: "Доставка" },
    { key: "showWaiterBtn", label: "Надпись кнопки «Показать официанту»", default: "Показать официанту" },
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
  multiline = false,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  tooltip: string;
  multiline?: boolean;
}) {
  return (
    <div className="block">
      <DottedLabelWithTooltip label={label} tooltip={tooltip} />
      {multiline ? (
        <textarea
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="min-h-[77px] w-full resize-none rounded-[10px] border border-[#e7e5e4] bg-white px-3 py-2 text-[14px] leading-5 text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.05)] outline-none transition placeholder:text-[#a8a29e] focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5"
        />
      ) : (
        <input
          value={value}
          onChange={(event) => onChange(event.target.value)}
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
        />
        <PublicTextField
          label="Описание"
          value={description}
          onChange={updateDescription}
          tooltip={PUBLIC_FIELD_TOOLTIPS.description}
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
                    {keywords.map((keyword) => (
                      <span
                        key={keyword}
                        className="inline-flex h-[22px] shrink-0 items-center gap-1 rounded-md bg-[#f5f5f4] px-2 text-[13px] text-[#292524]"
                      >
                        {keyword}
                        <X size={12} className="text-[#79716b]" />
                      </span>
                    ))}
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
  const [ageEnabled, setAgeEnabled] = useState(true);
  const [minimumAge, setMinimumAge] = useState<18 | 21>(18);
  const [qrDiscountEnabled, setQrDiscountEnabled] = useState(true);

  const updateAgeEnabled = (checked: boolean) => {
    setAgeEnabled(checked);
    onChange();
  };
  const updateMinimumAge = (value: 18 | 21) => {
    setMinimumAge(value);
    onChange();
  };
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
          title="Возрастное ограничение"
          description="Требовать подтверждение возраста"
          checked={ageEnabled}
          onCheckedChange={updateAgeEnabled}
          onMouseEnter={() => setPreviewScenario("age")}
        >
          <div className={cn("flex flex-wrap items-center gap-1 px-3 pb-3 pt-2", !ageEnabled && "opacity-60")}>
            <AgeOption value={18} selected={minimumAge === 18} disabled={!ageEnabled} onClick={() => updateMinimumAge(18)} />
            <AgeOption value={21} selected={minimumAge === 21} disabled={!ageEnabled} onClick={() => updateMinimumAge(21)} />
          </div>
        </WarningCard>

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

// Floating-label поле в стиле макета: белая карточка, подпись сверху, значение под ней.
function BasicField({
  label,
  value,
  onChange,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  return (
    <label
      className={cn(
        "block rounded-[12px] border border-[#e7e5e4] bg-white px-4 py-2.5 shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition focus-within:border-[#c7c2bd]",
        className,
      )}
    >
      <div className="text-[12px] leading-4 text-[#79716b]">{label}</div>
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-0.5 w-full bg-transparent text-[14px] text-[#292524] outline-none"
      />
    </label>
  );
}

// Свёрнутая секция: карточка-строка с плюсом справа.
function CollapsedRow({ label }: { label: string }) {
  return (
    <button
      type="button"
      className="flex h-[52px] w-full items-center justify-between rounded-[12px] border border-[#e7e5e4] bg-white px-4 text-left shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition hover:bg-[#fafaf9]"
    >
      <span className="text-[14px] text-[#292524]">{label}</span>
      <Plus size={18} className="text-[#79716b]" />
    </button>
  );
}

const SOCIAL_CHANNELS = [
  { id: "instagram", label: "Instagram", icon: Instagram },
  { id: "2gis", label: "2GIS", icon: MapPin },
  { id: "facebook", label: "Facebook", icon: Facebook },
  { id: "website", label: "Website", icon: Globe },
  { id: "youtube", label: "YouTube", icon: Youtube },
] as const;

const CONTACT_CHANNELS = [
  { id: "telegram", label: "Telegram", icon: Send },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle },
  { id: "phone", label: "Телефон", icon: Phone },
] as const;

function BasicInfoWorkspace({ onChange }: { onChange: () => void }) {
  const [name, setName] = useState("Sweet affair");
  const [address, setAddress] = useState("Астана, Абылай-хана 34, д 18");
  const [activeSocial, setActiveSocial] = useState<string>("website");
  const [socialLink, setSocialLink] = useState("https://kimchi.events.kz");
  const [socialText, setSocialText] = useState("Следите за нашими ивентами");

  const edit = (setter: (v: string) => void) => (v: string) => {
    setter(v);
    onChange();
  };

  return (
    <div className="w-full space-y-3">
      {/* Логотип + название */}
      <div className="flex items-stretch gap-3">
        <button
          type="button"
          className="flex w-[58px] shrink-0 flex-col items-center justify-center rounded-[12px] bg-[#f5f5f4] text-[#79716b] transition hover:bg-[#eeeeec]"
        >
          <Plus size={16} />
          <span className="mt-0.5 text-[11px] leading-3">Лого</span>
        </button>
        <BasicField label="Название заведения" value={name} onChange={edit(setName)} className="flex-1" />
      </div>

      <BasicField label="Адрес" value={address} onChange={edit(setAddress)} />

      <CollapsedRow label="Добавить описание" />
      <CollapsedRow label="Добавить график работы" />

      {/* Сайты и соцсети */}
      <div className="space-y-4 rounded-[12px] border border-[#e7e5e4] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="text-[12px] font-medium text-[#79716b]">Сайты и соцсети</div>

        <div className="flex items-start gap-2">
          {SOCIAL_CHANNELS.map((channel) => {
            const Icon = channel.icon;
            const selected = activeSocial === channel.id;
            return (
              <div key={channel.id} className="flex flex-col items-center gap-1">
                <button
                  type="button"
                  title={channel.label}
                  onClick={() => setActiveSocial(channel.id)}
                  className={cn(
                    "flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#f5f5f4] text-[#57534d] transition hover:bg-[#eeeeec]",
                    selected && "bg-white text-[#4f39f6] ring-2 ring-[#4f39f6] ring-offset-1",
                  )}
                >
                  <Icon size={20} />
                </button>
                <GripHorizontal size={12} className="text-[#d6d3d1]" />
              </div>
            );
          })}
          <button
            type="button"
            title="Добавить канал"
            className="flex h-12 w-12 items-center justify-center rounded-[12px] border border-dashed border-[#e7e5e4] text-[#79716b] transition hover:bg-[#fafaf9]"
          >
            <Plus size={18} />
          </button>
        </div>

        <div className="space-y-3">
          <BasicField label="Ссылка" value={socialLink} onChange={edit(setSocialLink)} />
          <BasicField label="Текст" value={socialText} onChange={edit(setSocialText)} />
        </div>

        <div className="flex items-center justify-between pt-1">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 px-2 text-[13px] font-normal text-[#79716b] hover:bg-transparent hover:text-[#dc2626]"
          >
            <Trash2 size={15} />
            Удалить
          </Button>
          <div className="flex items-center gap-2">
            <Button type="button" variant="ghost" size="sm" className="h-8 px-3 text-[13px] font-normal text-[#79716b]">
              Свернуть
            </Button>
            <Button type="button" variant="outline" size="sm" className="h-8 px-3 text-[13px] font-medium text-[#292524]">
              Сохранить
            </Button>
          </div>
        </div>
      </div>

      <CollapsedRow label="Добавить Wi-Fi" />

      {/* Контакты */}
      <div className="space-y-3 rounded-[12px] border border-[#e7e5e4] bg-white p-4 shadow-[0_1px_2px_rgba(0,0,0,0.03)]">
        <div className="text-[14px] font-semibold text-[#292524]">Контакты</div>
        <div className="flex items-center gap-3">
          {CONTACT_CHANNELS.map((channel) => {
            const Icon = channel.icon;
            return (
              <button
                key={channel.id}
                type="button"
                title={channel.label}
                className="relative flex h-12 w-12 items-center justify-center rounded-[12px] bg-[#f5f5f4] text-[#79716b] transition hover:bg-[#eeeeec]"
              >
                <Icon size={18} />
                <span className="absolute -bottom-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-white text-[#79716b] shadow-sm ring-1 ring-[#e7e5e4]">
                  <Plus size={10} />
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
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
              <BasicInfoWorkspace onChange={() => registerChange("about")} />
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
