import { useEffect, useState, type ReactNode } from "react";
import {
  Bold,
  EyeOff,
  GripVertical,
  Italic,
  Link2,
  Plus,
  Strikethrough,
  Trash2,
  X,
} from "lucide-react";
import { PageContent, PageScroll } from "@/components/workspace/page-layout";
import { LaunchPageHint } from "@/components/workspace/launch-hint";
import { AddTile, DishTile } from "@/components/workspace/section-card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePublish } from "@/contexts/publish-context";
import {
  categories,
  dishes,
  featuredCategoryIds,
  promotedDishIds,
  type Banner,
} from "@/data/mock-data";
import { cn } from "@/lib/utils";

type HomeWorkspaceProps = {
  banners: Banner[];
  selectedBannerId: string;
  setSelectedBannerId: (id: string) => void;
  updateBanner: (id: string, patch: Partial<Banner>) => void;
  removeBanner: (id: string) => void;
  addBanner: () => void;
  /** Прокрутка/подсветка блока при переходе из превью. */
  homeFocus?: "hero" | "sections" | null;
  onHomeFocusHandled?: () => void;
};

const MAX_BANNER_CHARS = 70;
const TAG_PRESETS = ["Хит", "Новинка", "Акция", "Сезон", "Веган"];

function BlockHeading({
  eyebrow,
  eyebrowTone = "accent",
  title,
  titleClassName,
  description,
  action,
}: {
  eyebrow: string;
  eyebrowTone?: "accent" | "muted";
  title: string;
  titleClassName?: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-4">
      <div>
        <div
          className={cn(
            "text-xs font-black uppercase tracking-wide",
            eyebrowTone === "accent" ? "text-blue-600" : "text-zinc-400",
          )}
        >
          {eyebrow}
        </div>
        <h2 className={cn("mt-1 font-black text-zinc-950", titleClassName)}>{title}</h2>
        <p className="mt-1 max-w-xl text-sm leading-5 text-muted-foreground">{description}</p>
      </div>
      {action}
    </div>
  );
}

function FieldLabel({ children }: { children: ReactNode }) {
  return <div className="text-xs font-bold uppercase tracking-wide text-zinc-500">{children}</div>;
}

function BannerThumb({
  banner,
  selected,
  onSelect,
}: {
  banner: Banner;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "relative h-32 w-48 shrink-0 overflow-hidden rounded-3xl bg-gradient-to-br p-4 text-left text-white transition",
        banner.accent,
        selected
          ? "outline outline-2 outline-blue-500 outline-offset-2"
          : "opacity-95 hover:opacity-100",
      )}
    >
      <div className="absolute inset-0 bg-black/25" />
      {!banner.visible && (
        <span className="absolute right-3 top-3 z-10 flex items-center gap-1 rounded-full bg-black/55 px-2 py-1 text-[10px] font-bold backdrop-blur">
          <EyeOff size={11} />
          Скрыт
        </span>
      )}
      <div className="relative z-10 flex h-full flex-col justify-end">
        <div className="text-xs font-semibold opacity-90">{banner.title}</div>
        <div className="mt-0.5 line-clamp-2 text-sm font-black leading-tight">
          {banner.subtitle}
        </div>
      </div>
    </button>
  );
}

function BannerEditor({
  banner,
  updateBanner,
  removeBanner,
}: {
  banner: Banner;
  updateBanner: (id: string, patch: Partial<Banner>) => void;
  removeBanner: (id: string) => void;
}) {
  const { registerChange } = usePublish();
  const mark = () => registerChange("home");

  const [format, setFormat] = useState<string[]>([]);
  const toggleFormat = (key: string) => {
    setFormat((prev) => (prev.includes(key) ? prev.filter((f) => f !== key) : [...prev, key]));
    mark();
  };

  const chars = banner.subtitle.length;
  const words = banner.subtitle.trim() ? banner.subtitle.trim().split(/\s+/).length : 0;

  const formatButtons = [
    { key: "bold", icon: Bold },
    { key: "italic", icon: Italic },
    { key: "strike", icon: Strikethrough },
  ];

  const addTag = () => {
    const next = TAG_PRESETS.find((t) => !banner.tags.includes(t)) ?? `Тег ${banner.tags.length + 1}`;
    updateBanner(banner.id, { tags: [...banner.tags, next] });
    mark();
  };
  const removeTag = (tag: string) => {
    updateBanner(banner.id, { tags: banner.tags.filter((t) => t !== tag) });
    mark();
  };

  return (
    <div className="rounded-3xl border border-border bg-white p-6">
      <div className="mb-5 flex items-center justify-between">
        <div className="text-xs font-black uppercase tracking-wide text-zinc-400">
          Настройки баннера
        </div>
        <button
          type="button"
          onClick={() => {
            removeBanner(banner.id);
            mark();
          }}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-red-500 transition hover:text-red-600"
        >
          <Trash2 size={14} />
          Удалить
        </button>
      </div>

      <div className="grid gap-x-8 gap-y-6 md:grid-cols-[1fr_260px]">
        {/* Main column */}
        <div className="space-y-6">
          <div>
            <div className="mb-2 flex items-center justify-between">
              <FieldLabel>Текст баннера</FieldLabel>
              <div className="flex gap-1">
                {formatButtons.map(({ key, icon: Icon }) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => toggleFormat(key)}
                    className={cn(
                      "flex h-7 w-7 items-center justify-center rounded-lg transition",
                      format.includes(key)
                        ? "bg-zinc-900 text-white"
                        : "text-zinc-500 hover:bg-zinc-100",
                    )}
                  >
                    <Icon size={14} />
                  </button>
                ))}
              </div>
            </div>
            <textarea
              value={banner.subtitle}
              maxLength={MAX_BANNER_CHARS}
              onChange={(e) => updateBanner(banner.id, { subtitle: e.target.value })}
              className={cn(
                "min-h-20 w-full resize-none rounded-2xl bg-zinc-50 px-4 py-3 text-base font-semibold text-zinc-900 outline-none transition focus:bg-white focus:ring-2 focus:ring-blue-500/30",
                format.includes("bold") && "font-black",
                format.includes("italic") && "italic",
                format.includes("strike") && "line-through",
              )}
            />
            <div className="mt-1.5 text-right text-xs text-muted-foreground">
              {chars} / {MAX_BANNER_CHARS} · слов: {words}
            </div>
          </div>

          <div>
            <FieldLabel>Ссылка при клике</FieldLabel>
            <div className="relative mt-2">
              <Link2
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400"
              />
              <input
                value={banner.link}
                placeholder="https:// или /menu"
                onChange={(e) => updateBanner(banner.id, { link: e.target.value })}
                className="h-10 w-full rounded-xl bg-zinc-50 pl-9 pr-3 text-sm font-medium text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:bg-white focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
            <p className="mt-1.5 text-xs text-muted-foreground">
              Куда ведёт баннер. Можно оставить пустым.
            </p>
          </div>
        </div>

        {/* Side column */}
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3 rounded-2xl bg-zinc-50 px-4 py-3">
            <div>
              <div className="text-sm font-bold text-zinc-900">На витрине</div>
              <div className="mt-0.5 text-xs text-muted-foreground">Показывать гостям</div>
            </div>
            <Switch
              checked={banner.visible}
              onCheckedChange={(v) => {
                updateBanner(banner.id, { visible: v });
                mark();
              }}
            />
          </div>

          <div>
            <FieldLabel>Теги</FieldLabel>
            <div className="mt-2 flex flex-wrap gap-2">
              {banner.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1.5 rounded-full bg-zinc-100 py-1.5 pl-3 pr-2 text-xs font-semibold text-zinc-700"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="text-zinc-400 transition hover:text-zinc-700"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <button
                type="button"
                onClick={addTag}
                className="inline-flex items-center gap-1 rounded-full border border-dashed border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-500 transition hover:border-blue-300 hover:text-blue-600"
              >
                <Plus size={12} />
                Тег
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function HomeWorkspace({
  banners,
  selectedBannerId,
  setSelectedBannerId,
  updateBanner,
  removeBanner,
  addBanner,
  homeFocus,
  onHomeFocusHandled,
}: HomeWorkspaceProps) {
  const selectedBanner = banners.find((b) => b.id === selectedBannerId) ?? banners[0] ?? null;
  const { registerChange } = usePublish();
  const [flash, setFlash] = useState<"hero" | "sections" | null>(null);
  const handleAddBanner = () => {
    addBanner();
    registerChange("home");
  };

  // Переход из превью: прокрутить к блоку и кратко подсветить его.
  useEffect(() => {
    if (!homeFocus) return;
    const id = homeFocus === "hero" ? "home-hero" : "home-sections";
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    setFlash(homeFocus);
    onHomeFocusHandled?.();
    const t = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeFocus]);

  return (
    <PageScroll>
      <PageContent className="space-y-8">
        <LaunchPageHint
          checkId="home"
          title="Настройте главный экран витрины"
          description="Добавьте баннеры, ключевые разделы и продвигаемые позиции — это первое, что увидят гости."
        />
        {/* 1 — Баннеры (главный блок) */}
        <section
          id="home-hero"
          className={cn(
            "mt-8 scroll-mt-6 space-y-5 rounded-3xl transition",
            flash === "hero" && "ring-2 ring-blue-400 ring-offset-4",
          )}
        >
          <BlockHeading
            eyebrow="Первый экран"
            title="Баннеры"
            titleClassName="text-2xl"
            description="Акции, новинки и сезонные предложения в верхней части главной."
            action={
              <Button size="sm" className="shrink-0 font-bold" onClick={handleAddBanner}>
                <Plus size={15} />
                Добавить баннер
              </Button>
            }
          />

          <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none">
            {banners.map((banner) => (
              <BannerThumb
                key={banner.id}
                banner={banner}
                selected={selectedBanner?.id === banner.id}
                onSelect={() => setSelectedBannerId(banner.id)}
              />
            ))}
            <button
              type="button"
              onClick={handleAddBanner}
              className="flex h-32 w-32 shrink-0 flex-col items-center justify-center rounded-3xl border border-dashed border-zinc-300 text-sm font-bold text-zinc-500 transition hover:border-blue-300 hover:bg-blue-50/50 hover:text-blue-600"
            >
              <Plus size={20} className="mb-1.5" />
              Новый
            </button>
          </div>

          {selectedBanner && (
            <BannerEditor
              key={selectedBanner.id}
              banner={selectedBanner}
              updateBanner={updateBanner}
              removeBanner={removeBanner}
            />
          )}
        </section>

        {/* 2 — Разделы */}
        <section
          id="home-sections"
          className={cn(
            "mt-12 scroll-mt-6 space-y-5 rounded-3xl border-t border-border pt-10 transition",
            flash === "sections" && "ring-2 ring-blue-400 ring-offset-4",
          )}
        >
          <BlockHeading
            eyebrow="Навигация гостя"
            title="Разделы на главной"
            titleClassName="text-xl"
            description="Покажите до 6 ключевых разделов. Остальные останутся в полном меню."
            action={
              <Button variant="outline" size="sm" className="shrink-0 font-bold">
                <Plus size={15} />
                Добавить раздел
              </Button>
            }
          />
          <div className="grid grid-cols-4 gap-4">
            {featuredCategoryIds.map((id) => {
              const category = categories.find((c) => c.id === id)!;
              return (
                <div key={id} className="group rounded-3xl border border-border bg-white p-3">
                  <div
                    className={cn(
                      "mb-3 flex h-28 items-center justify-center rounded-2xl bg-gradient-to-br text-4xl",
                      category.photo,
                    )}
                  >
                    {category.emoji}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm font-black">{category.name}</div>
                    <GripVertical className="text-zinc-300 group-hover:text-zinc-500" size={16} />
                  </div>
                </div>
              );
            })}
            <AddTile label="Добавить" className="min-h-[164px]" />
          </div>
        </section>

        {/* 3 — Рекомендуемые */}
        <section className="mt-12 space-y-5 border-t border-border pt-10">
          <BlockHeading
            eyebrow="Мерчендайзинг"
            eyebrowTone="muted"
            title="Рекомендуемые позиции"
            titleClassName="text-lg"
            description="Блюда и напитки, которые стоит продвигать на главной."
            action={
              <Button variant="ghost" size="sm" className="shrink-0 font-bold text-zinc-500">
                <Plus size={15} />
                Добавить позицию
              </Button>
            }
          />
          <div className="grid grid-cols-3 gap-4">
            {promotedDishIds.map((id) => (
              <DishTile key={id} dish={dishes.find((d) => d.id === id)!} removable />
            ))}
          </div>
        </section>
      </PageContent>
    </PageScroll>
  );
}
