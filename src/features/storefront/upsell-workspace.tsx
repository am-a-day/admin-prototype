import { useEffect, useMemo, useRef, useState } from "react";
import { useHeaderActions } from "@/contexts/header-actions-context";
import { Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DishTile, EmptyState } from "@/components/workspace/section-card";
import {
  categories,
  dishes,
  getDish,
  getRecommendedDishes,
  type RecommendationTexts,
  type UpsellSurface,
} from "@/data/mock-data";
import { usePublish } from "@/contexts/publish-context";
import { cn } from "@/lib/utils";

type UpsellWorkspaceProps = {
  selectedDishId: string;
  setSelectedDishId: (id: string) => void;
  recommendationTexts: RecommendationTexts;
  setRecommendationText: (key: keyof RecommendationTexts, value: string) => void;
  setUpsellSurface: (surface: UpsellSurface) => void;
  setUpsellFocused: (focused: boolean) => void;
};

function TextField({
  label,
  value,
  onChange,
  onFocus,
  onBlur,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onFocus: () => void;
  onBlur: () => void;
}) {
  return (
    <label className="block rounded-2xl border border-border bg-zinc-50 px-4 py-3 transition focus-within:border-blue-300 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
      <div className="mb-1 text-xs font-semibold text-muted-foreground">{label}</div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={onFocus}
        onBlur={onBlur}
        className="w-full bg-transparent text-base font-semibold text-zinc-900 outline-none"
      />
    </label>
  );
}

function RecommendationTextsPopover({
  texts,
  setText,
  setUpsellSurface,
  setUpsellFocused,
}: {
  texts: RecommendationTexts;
  setText: (key: keyof RecommendationTexts, value: string) => void;
  setUpsellSurface: (surface: UpsellSurface) => void;
  setUpsellFocused: (focused: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const blurTimer = useRef<number | null>(null);

  const resetPreview = () => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    setUpsellSurface("dish");
    setUpsellFocused(false);
  };

  const close = () => {
    setOpen(false);
    resetPreview();
  };

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", onPointerDown);
    return () => document.removeEventListener("mousedown", onPointerDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  const focusSurface = (surface: UpsellSurface) => {
    if (blurTimer.current) window.clearTimeout(blurTimer.current);
    setUpsellSurface(surface);
    setUpsellFocused(true);
  };
  const blurField = () => {
    blurTimer.current = window.setTimeout(() => {
      setUpsellSurface("dish");
      setUpsellFocused(false);
    }, 120);
  };

  return (
    <div ref={rootRef} className="relative shrink-0">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="font-bold"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        <SlidersHorizontal size={15} />
        Тексты рекомендаций
      </Button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-2 w-[340px] rounded-2xl border border-border bg-white p-4 shadow-xl shadow-zinc-300/40">
          <div className="font-black text-zinc-950">Тексты рекомендаций</div>
          <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
            Эти тексты используются в блоках рекомендаций витрины.
          </p>
          <div className="mt-4 space-y-3">
            <TextField
              label="Заголовок на главной"
              value={texts.home}
              onChange={(v) => setText("home", v)}
              onFocus={() => focusSurface("home")}
              onBlur={blurField}
            />
            <TextField
              label="Заголовок в карточке блюда"
              value={texts.dish}
              onChange={(v) => setText("dish", v)}
              onFocus={() => focusSurface("dish")}
              onBlur={blurField}
            />
            <TextField
              label="Заголовок в корзине"
              value={texts.cart}
              onChange={(v) => setText("cart", v)}
              onFocus={() => focusSurface("cart")}
              onBlur={blurField}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function UpsellWorkspace({
  selectedDishId,
  setSelectedDishId,
  recommendationTexts,
  setRecommendationText,
  setUpsellSurface,
  setUpsellFocused,
}: UpsellWorkspaceProps) {
  const dish = getDish(selectedDishId);
  const recommended = getRecommendedDishes(dish);
  const { registerChange } = usePublish();

  useHeaderActions(
    <RecommendationTextsPopover
      texts={recommendationTexts}
      setText={setRecommendationText}
      setUpsellSurface={setUpsellSurface}
      setUpsellFocused={setUpsellFocused}
    />,
  );

  const grouped = useMemo(
    () =>
      categories.map((cat) => ({
        ...cat,
        items: dishes.filter((d) => d.category === cat.name),
      })),
    [],
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {/* Workspace area */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel — visually inside the page, not part of global nav */}
        <aside className="w-[280px] shrink-0 overflow-y-auto border-r border-border bg-zinc-50/60 p-4">
          <div className="flex h-10 items-center rounded-xl border border-border bg-white px-3 text-sm text-zinc-400">
            <Search size={16} className="mr-2" />
            Поиск по позициям...
          </div>
          <div className="mt-5 space-y-4">
            {grouped.map((group) => (
              <div key={group.id}>
                <div className="mb-1 flex items-center justify-between px-1 text-xs font-black uppercase tracking-wide text-zinc-400">
                  <span>{group.name}</span>
                  <span>
                    {group.items.reduce((s, i) => s + i.recommendations.length, 0) || ""}
                  </span>
                </div>
                <div className="space-y-1">
                  {group.items.map((item) => {
                    const active = selectedDishId === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setSelectedDishId(item.id)}
                        className={cn(
                          "flex w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
                          active
                            ? "bg-blue-50 font-bold text-blue-700"
                            : "text-zinc-600 hover:bg-white hover:text-zinc-950",
                        )}
                      >
                        <span className="truncate">{item.name}</span>
                        {item.recommendations.length > 0 && (
                          <span
                            className={cn(
                              "flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                              active ? "bg-blue-100 text-blue-700" : "bg-zinc-100 text-zinc-500",
                            )}
                          >
                            {item.recommendations.length}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </aside>

        {/* Editor area */}
        <div className="min-w-0 flex-1 overflow-y-auto p-8">
          <div className="mx-auto max-w-4xl space-y-6">
            <div className="overflow-hidden rounded-[28px] border border-border bg-white shadow-sm">
              <div className="flex">
                <div
                  className={cn(
                    "flex h-48 w-72 shrink-0 items-center justify-center bg-gradient-to-br text-8xl",
                    dish.accent,
                  )}
                >
                  {dish.emoji}
                </div>
                <div className="flex flex-1 flex-col justify-center p-7">
                  <div className="mb-2 text-xs font-black uppercase tracking-wide text-blue-600">
                    {dish.category} · Меню
                  </div>
                  <h1 className="text-3xl font-black text-zinc-950">
                    {dish.name}{" "}
                    <span className="font-black text-zinc-300">({recommended.length})</span>
                  </h1>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                    <span>{dish.price}</span>
                    <span className="text-zinc-300">•</span>
                    <span className="text-zinc-500">{dish.weight}</span>
                  </div>
                  <p className="mt-4 max-w-lg text-sm leading-6 text-muted-foreground">
                    {dish.description}
                  </p>
                </div>
              </div>
            </div>

            <section>
              <div className="mb-4 flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-xl font-black text-zinc-950">Связанные позиции</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Что предложить вместе? Добавьте напитки, соусы или другие блюда.
                  </p>
                </div>
                <Button className="font-black" onClick={() => registerChange("upsell")}>
                  <Plus size={16} />
                  Добавить рекомендацию
                </Button>
              </div>

              {recommended.length === 0 ? (
                <EmptyState
                  icon="✨"
                  title="Пока нет рекомендаций"
                  description="Подскажите гостю, что хорошо сочетается с этой позицией: напиток, соус, десерт или другое блюдо."
                  chips={["🥤 Напитки", "🧄 Соусы", "🍰 Десерты"]}
                />
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  {recommended.map((item) => (
                    <DishTile key={item.id} dish={item} removable />
                  ))}
                </div>
              )}
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
