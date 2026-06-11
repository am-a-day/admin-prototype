import { useState } from "react";
import { PageContent, PageScroll } from "@/components/workspace/page-layout";
import { LaunchPageHint } from "@/components/workspace/launch-hint";
import { SectionCard } from "@/components/workspace/section-card";
import { Switch } from "@/components/ui/switch";
import { usePublish } from "@/contexts/publish-context";
import { cn } from "@/lib/utils";

type AppearanceTab = "cards" | "theme" | "masks";

const TAB_LABELS: Record<AppearanceTab, string> = {
  cards: "Карточки",
  theme: "Тема",
  masks: "Маски",
};

const cardStyles = ["Плитка", "Лента", "Гастро"];
const accentColors = [
  "bg-blue-600",
  "bg-emerald-600",
  "bg-teal-600",
  "bg-violet-600",
  "bg-pink-600",
  "bg-orange-500",
  "bg-amber-500",
  "bg-red-600",
  "bg-rose-500",
];
const backgrounds = ["Светлый", "Тёплый", "Тёмный"];
const themes = ["Светлая", "Тёмная", "Системная"];
const maskStyles = ["Скругление", "Волна", "Диагональ", "Без маски"];

export function AppearanceWorkspace() {
  const { registerChange } = usePublish();
  const mark = () => registerChange("appearance");

  const [activeTab, setActiveTab] = useState<AppearanceTab>("cards");
  const [cardStyle, setCardStyle] = useState(0);
  const [hidePlaceholders, setHidePlaceholders] = useState(false);
  const [showLikeCount, setShowLikeCount] = useState(false);
  const [accent, setAccent] = useState(6);
  const [background, setBackground] = useState(0);
  const [theme, setTheme] = useState(0);
  const [mask, setMask] = useState(0);

  const select = (setter: (n: number) => void) => (index: number) => {
    setter(index);
    mark();
  };

  return (
    <PageScroll>
      <PageContent className="space-y-8">
        <LaunchPageHint
          checkId="appearance"
          title="Выберите стиль витрины"
          description="Оформление формирует первое впечатление — выберите стиль карточек, цвета и фон."
        />

        {/* Tab bar */}
        <div className="flex gap-1 rounded-xl bg-zinc-100 p-1 w-fit">
          {(["cards", "theme", "masks"] as AppearanceTab[]).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTab(t)}
              className={cn(
                "rounded-lg px-4 py-1.5 text-sm font-semibold transition",
                activeTab === t
                  ? "bg-white text-zinc-950 shadow-sm"
                  : "text-zinc-500 hover:text-zinc-800",
              )}
            >
              {TAB_LABELS[t]}
            </button>
          ))}
        </div>

        {/* ── Карточки ── */}
        {activeTab === "cards" && (
          <>
            <SectionCard>
              <h2 className="text-xl font-black">Стиль карточек</h2>
              <p className="mt-1 text-sm text-muted-foreground">Выберите, как блюда будут выглядеть в меню.</p>
              <div className="mt-5 grid grid-cols-3 gap-4">
                {cardStyles.map((style, index) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => select(setCardStyle)(index)}
                    className={cn(
                      "rounded-3xl border p-4 text-left transition hover:border-zinc-300",
                      index === cardStyle ? "border-blue-500 bg-blue-50/40" : "border-border bg-white",
                    )}
                  >
                    <div className="mb-3 h-28 rounded-2xl bg-gradient-to-br from-zinc-100 to-orange-50" />
                    <div className="font-black">{style}</div>
                    <div className="mt-1 text-xs leading-5 text-muted-foreground">
                      Подходит для меню с фото блюд и быстрым выбором.
                    </div>
                  </button>
                ))}
              </div>
            </SectionCard>
            <SectionCard>
              <h2 className="text-xl font-black">Отображение без фото</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Показывать позиции текстом и цветом, если нет изображения.
              </p>
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-border p-4">
                <div>
                  <div className="font-black">Скрывать плейсхолдеры фото</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Карточки компактнее: название, цена и акцентный фон вместо пустого кадра.
                  </div>
                </div>
                <Switch
                  checked={hidePlaceholders}
                  onCheckedChange={(v) => {
                    setHidePlaceholders(v);
                    mark();
                  }}
                />
              </div>
            </SectionCard>
            <SectionCard>
              <h2 className="text-xl font-black">Лайки</h2>
              <p className="mt-1 text-sm text-muted-foreground">Дополнительные элементы на карточках меню.</p>
              <div className="mt-5 flex items-center justify-between rounded-2xl border border-border p-4">
                <div>
                  <div className="font-black">Показывать количество лайков</div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Отображать количество лайков рядом с иконкой на карточках блюд.
                  </div>
                  <div className="mt-2 flex items-center gap-3 text-sm text-zinc-400">
                    <span>{showLikeCount ? "♡ 127" : "♡"}</span>
                    <span className="text-zinc-300">→</span>
                    <span className={showLikeCount ? "text-zinc-700 font-semibold" : ""}>
                      {showLikeCount ? "♡ 127" : "♡"}
                    </span>
                  </div>
                </div>
                <Switch
                  checked={showLikeCount}
                  onCheckedChange={(v) => {
                    setShowLikeCount(v);
                    mark();
                  }}
                />
              </div>
            </SectionCard>
          </>
        )}

        {/* ── Тема ── */}
        {activeTab === "theme" && (
          <>
            <div data-tour="appearance-color">
              <SectionCard>
                <h2 className="text-xl font-black">Акцентный цвет</h2>
                <p className="mt-1 text-sm text-muted-foreground">Кнопки, теги и активные состояния.</p>
                <div className="mt-5 flex flex-wrap gap-3">
                  {accentColors.map((color, index) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => select(setAccent)(index)}
                      className={cn(
                        "h-9 w-9 rounded-full ring-offset-2 transition hover:scale-105",
                        color,
                        index === accent ? "ring-2 ring-zinc-950" : "",
                      )}
                    />
                  ))}
                </div>
              </SectionCard>
            </div>
            <SectionCard>
              <h2 className="text-xl font-black">Фон</h2>
              <p className="mt-1 text-sm text-muted-foreground">Общий фон витрины за карточками меню.</p>
              <div className="mt-5 grid grid-cols-3 gap-4">
                {backgrounds.map((bg, index) => (
                  <button
                    key={bg}
                    type="button"
                    onClick={() => select(setBackground)(index)}
                    className={cn(
                      "rounded-2xl border px-4 py-3 text-left font-bold transition",
                      index === background ? "border-blue-500 bg-blue-50/40" : "border-border",
                    )}
                  >
                    {bg}
                  </button>
                ))}
              </div>
            </SectionCard>
            <SectionCard>
              <h2 className="text-xl font-black">Тема</h2>
              <p className="mt-1 text-sm text-muted-foreground">Светлая или тёмная витрина для гостя.</p>
              <div className="mt-5 flex gap-3">
                {themes.map((t, index) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => select(setTheme)(index)}
                    className={cn(
                      "rounded-2xl border px-4 py-2.5 text-sm font-bold",
                      index === theme ? "border-blue-500 bg-blue-50/40" : "border-border",
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </SectionCard>
          </>
        )}

        {/* ── Маски ── */}
        {activeTab === "masks" && (
          <SectionCard>
            <h2 className="text-xl font-black">Маски / декоративные стили</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Форма изображений блюд и декоративные элементы карточек.
            </p>
            <div className="mt-5 grid grid-cols-4 gap-3">
              {maskStyles.map((m, index) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => select(setMask)(index)}
                  className={cn(
                    "rounded-2xl border px-3 py-3 text-sm font-bold transition",
                    index === mask ? "border-blue-500 bg-blue-50/40" : "border-border",
                  )}
                >
                  {m}
                </button>
              ))}
            </div>
          </SectionCard>
        )}
      </PageContent>
    </PageScroll>
  );
}
