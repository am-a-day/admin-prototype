import { useState } from "react";
import { Plus, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageContent, PageScroll } from "@/components/workspace/page-layout";
import { LaunchPageHint } from "@/components/workspace/launch-hint";
import { Field, FormTextArea, SectionCard } from "@/components/workspace/section-card";
import { useAppSettings } from "@/contexts/app-settings-context";
import { usePublish } from "@/contexts/publish-context";
import { RESTAURANT_NAME, type PreviewScenario } from "@/data/mock-data";

export type AboutTab = "info" | "guest-rules" | "rec-titles";

type AboutWorkspaceProps = {
  setPreviewScenario: (scenario: PreviewScenario) => void;
  onConfigureOrderSettings: () => void;
  aboutTab: AboutTab;
  setAboutTab: (t: AboutTab) => void;
  seoTitle: string;
  setSeoTitle: (v: string) => void;
  seoDescription: string;
  setSeoDescription: (v: string) => void;
};

const TAB_LABELS: Record<AboutTab, string> = {
  "info": "Информация",
  "guest-rules": "Правила для гостей",
  "rec-titles": "Заголовки рекомендаций",
};

// ── Recommendation title fields ───────────────────────────────────────────────

function RecTitleField({
  label,
  hint,
  defaultValue,
  onChange,
}: {
  label: string;
  hint: string;
  defaultValue: string;
  onChange?: (v: string) => void;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <label className="block rounded-2xl border border-border bg-zinc-50 px-4 py-3 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
      <div className="mb-0.5 text-xs font-semibold text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          onChange?.(e.target.value);
        }}
        className="w-full bg-transparent text-sm font-semibold text-zinc-900 outline-none"
      />
      <div className="mt-1 text-[11px] text-zinc-400">{hint}</div>
    </label>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AboutWorkspace({
  setPreviewScenario,
  onConfigureOrderSettings,
  aboutTab: tab,
  setAboutTab: setTab,
}: AboutWorkspaceProps) {
  const { serviceFeeEnabled, serviceFeeRateLabel } = useAppSettings();
  const { registerChange } = usePublish();

  const switchTab = (t: AboutTab) => {
    setTab(t);
    if (t === "info") setPreviewScenario("about");
  };

  return (
    <PageScroll>
      <PageContent>
        <LaunchPageHint
          checkId="about"
          title="Заполните информацию о заведении"
          description="Добавьте описание, контакты и график работы — всё, что поможет гостям узнать о вас больше."
        />

        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 w-fit">
          {(["info", "guest-rules", "rec-titles"] as AboutTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => switchTab(t)}
              className={`rounded-lg px-4 py-1.5 text-sm font-semibold transition ${
                tab === t
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-800"
              }`}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── Информация ── */}
        {tab === "info" && (
          <div
            className="space-y-6"
            onMouseEnter={() => setPreviewScenario("about")}
          >
            <SectionCard>
              <h2 className="mb-4 text-lg font-black">О заведении</h2>
              <div className="mb-6 flex items-center gap-4">
                <button
                  type="button"
                  className="flex h-24 w-24 flex-col items-center justify-center rounded-3xl bg-zinc-100 text-zinc-500"
                >
                  <Plus size={22} />
                  <span className="mt-1 text-sm">Логотип</span>
                </button>
                <div className="flex-1">
                  <Field label="Название заведения" value={RESTAURANT_NAME} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Адрес" value="пр. Кабанбай Батыра, 48" />
                <Field label="График работы" value="10:00–23:00" />
                <Field label="Телефон" value="+7 701 000 00 00" />
                <Field label="Instagram" value="@kimchi.astana" />
                <Field label="Wi‑Fi" value="Kimchi Guest" icon={<Wifi size={15} />} />
                <Field label="Пароль Wi‑Fi" value="kimchi2026" />
                <div className="col-span-2">
                  <FormTextArea
                    label="Описание"
                    value="Корейская кухня, авторские блюда и быстрый заказ по QR."
                  />
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── Правила для гостей ── */}
        {tab === "guest-rules" && (
          <div className="space-y-6">
            <SectionCard>
              <h2 className="text-xl font-black">Правила для гостей</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Как гость увидит ограничения и сборы. Настройки заказов — в «Настройка заказов».
              </p>
              <div className="mt-5 space-y-3">
                <div
                  className="rounded-2xl border border-border p-4"
                  onMouseEnter={() => setPreviewScenario("age")}
                  onFocus={() => setPreviewScenario("age")}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="font-black">Возрастное ограничение 18+</div>
                      <div className="mt-1 text-sm text-muted-foreground">
                        Гость увидит подтверждение возраста перед открытием витрины.
                      </div>
                    </div>
                    <Switch defaultChecked onCheckedChange={() => registerChange("about")} />
                  </div>
                </div>

                <div className="rounded-2xl border border-dashed border-border bg-zinc-50/80 p-4">
                  <div className="font-black">
                    Сервисный сбор {serviceFeeEnabled ? serviceFeeRateLabel : "выключен"}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {serviceFeeEnabled
                      ? "Гость увидит информацию о сервисном сборе до оформления заказа."
                      : "Сервисный сбор не добавляется к заказу."}
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="mt-3 font-bold"
                    onClick={onConfigureOrderSettings}
                  >
                    Настроить
                  </Button>
                </div>
              </div>
            </SectionCard>
          </div>
        )}

        {/* ── Заголовки рекомендаций ── */}
        {tab === "rec-titles" && (
          <div className="space-y-6">
            <SectionCard>
              <h2 className="text-xl font-black">Заголовки рекомендаций</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Тексты блоков рекомендаций, которые гость видит в разных местах витрины.
              </p>
              <div className="mt-5 space-y-3">
                <RecTitleField
                  label="На главной странице"
                  hint="Блок рекомендуемых позиций на главном экране витрины."
                  defaultValue="Рекомендуем попробовать"
                  onChange={() => registerChange("about")}
                />
                <RecTitleField
                  label="В карточке блюда"
                  hint="Блок похожих позиций внутри модалки блюда."
                  defaultValue="С этим блюдом берут"
                  onChange={() => registerChange("about")}
                />
                <RecTitleField
                  label="В корзине"
                  hint="Блок дополнений к заказу перед оформлением."
                  defaultValue="Добавьте к заказу"
                  onChange={() => registerChange("about")}
                />
              </div>
            </SectionCard>
          </div>
        )}
      </PageContent>
    </PageScroll>
  );
}
