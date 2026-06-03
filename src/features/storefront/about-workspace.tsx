import { Plus, Wifi } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageContent, PageScroll } from "@/components/workspace/page-layout";
import { LaunchPageHint } from "@/components/workspace/launch-hint";
import { Field, FormTextArea, SectionCard } from "@/components/workspace/section-card";
import { useAppSettings } from "@/contexts/app-settings-context";
import { usePublish } from "@/contexts/publish-context";
import { RESTAURANT_NAME, type PreviewScenario } from "@/data/mock-data";

type Tab = "info" | "seo";

type AboutWorkspaceProps = {
  setPreviewScenario: (scenario: PreviewScenario) => void;
  onConfigureOrderSettings: () => void;
  aboutTab: Tab;
  setAboutTab: (t: Tab) => void;
  seoTitle: string;
  setSeoTitle: (v: string) => void;
  seoDescription: string;
  setSeoDescription: (v: string) => void;
};

// ── Main component ────────────────────────────────────────────────────────────

export function AboutWorkspace({
  setPreviewScenario,
  onConfigureOrderSettings,
  aboutTab: tab,
  setAboutTab: setTab,
  seoTitle,
  setSeoTitle,
  seoDescription,
  setSeoDescription,
}: AboutWorkspaceProps) {
  const { serviceFeeEnabled, serviceFeeRateLabel } = useAppSettings();
  const { registerChange } = usePublish();

  const switchTab = (t: Tab) => {
    setTab(t);
    if (t === "info") setPreviewScenario("about");
    else setPreviewScenario("seoLink");
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
          {(["info", "seo"] as Tab[]).map((t) => (
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
              {t === "info" ? "Информация" : "Ссылка на витрину"}
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

            <SectionCard>
              <h2 className="text-xl font-black">Правила для гостей</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Как гость увидит ограничения и сборы. Настройки — в «Настройка заказов».
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

        {/* ── Ссылка на витрину ── */}
        {tab === "seo" && (
          <div className="space-y-6">
            <SectionCard>
              <h2 className="mb-4 text-lg font-black">Мета-данные</h2>
              <div className="space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Title
                  </label>
                  <input
                    type="text"
                    value={seoTitle}
                    onChange={(e) => {
                      setSeoTitle(e.target.value);
                      registerChange("about");
                    }}
                    className="w-full rounded-xl border border-border bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-blue-500 focus:bg-white"
                    placeholder="Название для браузера и поиска"
                    maxLength={70}
                  />
                  <div className="mt-1 text-right text-xs text-zinc-400">
                    {seoTitle.length} / 70
                  </div>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-zinc-500">
                    Description
                  </label>
                  <textarea
                    value={seoDescription}
                    onChange={(e) => {
                      setSeoDescription(e.target.value);
                      registerChange("about");
                    }}
                    rows={3}
                    className="w-full resize-none rounded-xl border border-border bg-zinc-50 px-3 py-2.5 text-sm font-medium text-zinc-900 outline-none focus:border-blue-500 focus:bg-white"
                    placeholder="Краткое описание для поисковиков"
                    maxLength={160}
                  />
                  <div className="mt-1 text-right text-xs text-zinc-400">
                    {seoDescription.length} / 160
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard>
              <h2 className="mb-1 text-lg font-black">OG-изображение</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Показывается при репосте ссылки в мессенджерах и соцсетях.
              </p>
              <button
                type="button"
                className="flex h-32 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border bg-zinc-50 text-zinc-400 transition hover:border-zinc-300 hover:bg-zinc-100"
              >
                <Plus size={20} />
                <span className="text-sm font-medium">Загрузить изображение</span>
                <span className="text-xs text-zinc-400">1200 × 630 px, JPG или PNG</span>
              </button>
            </SectionCard>
          </div>
        )}
      </PageContent>
    </PageScroll>
  );
}
