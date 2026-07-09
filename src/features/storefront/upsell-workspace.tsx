import { useEffect, useMemo, useRef, useState } from "react";
import { useHeaderActions } from "@/contexts/header-actions-context";
import { ImageOff, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/workspace/section-card";
import type { RecommendationTexts, UpsellSurface } from "@/data/mock-data";
import { catalogItems, catalogSections, formatPrice } from "@/data/catalog";
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
  const item = catalogItems.find((i) => i.id === selectedDishId) ?? catalogItems[0];
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
      catalogSections
        .map((section) => ({
          ...section,
          items: catalogItems.filter((i) => i.sectionId === section.id),
        }))
        .filter((group) => group.items.length > 0),
    [],
  );

  return (
    <main className="flex min-w-0 flex-1 flex-col overflow-hidden bg-white">
      {/* Workspace area */}
      <div className="flex min-h-0 flex-1">
        {/* Left panel — visually inside the page, not part of global nav */}
        <aside className="w-[228px] shrink-0 overflow-y-auto border-r border-border bg-[#fbfbf9] px-2 pt-4">
          <div className="mb-4 flex items-center px-2">
            <h2 className="min-w-0 flex-1 text-[14px] font-normal leading-[1.4] text-[#292524]">Рекомендации</h2>
          </div>
          <div className="mx-1 flex h-8 items-center rounded-xl border border-transparent bg-[#f1f1ea] px-2 text-[13px] text-[#79716b]">
            <Search size={16} className="mr-2" />
            Поиск по позициям...
          </div>
          <div className="mt-4 space-y-4">
            {grouped.map((group) => (
              <div key={group.id}>
                <div className="mb-1 flex items-center justify-between px-2 text-[11px] font-medium text-[#a8a29e]">
                  <span>{group.name}</span>
                </div>
                <div className="space-y-1">
                  {group.items.map((row) => {
                    const active = selectedDishId === row.id;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelectedDishId(row.id)}
                        className={cn(
                          "flex h-8 w-full items-center justify-between gap-2 rounded-xl border px-[6px] pr-2 text-left text-[13px] font-medium leading-[18px] transition",
                          active
                            ? "rounded-lg border-[#e7e5e4] bg-white text-[#292524] shadow-[0_0_2px_rgba(0,0,0,0.09)]"
                            : "border-transparent text-[#79716b] hover:bg-[#f1f1ea]",
                        )}
                      >
                        <span className="truncate">{row.title}</span>
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
                <div className="flex h-48 w-72 shrink-0 items-center justify-center overflow-hidden bg-[#f5f5f4]">
                  {item.thumbnailUrl ? (
                    <img src={item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageOff size={40} className="text-[#a6a09b]" />
                  )}
                </div>
                <div className="flex flex-1 flex-col justify-center p-7">
                  <div className="mb-2 text-xs font-black uppercase tracking-wide text-blue-600">
                    {item.sectionName} · Меню
                  </div>
                  <h1 className="text-3xl font-black text-zinc-950">{item.title}</h1>
                  <div className="mt-2 flex items-center gap-2 text-sm font-semibold text-zinc-950">
                    <span>{item.price ? formatPrice(item.price) : "Цена не указана"}</span>
                    {item.weightLabel && (
                      <>
                        <span className="text-zinc-300">•</span>
                        <span className="text-zinc-500">{item.weightLabel}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <section data-tour="upsell-setup">
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

              {/* ponytail: fixture has no recommendation links yet — always empty until the import covers them */}
              <EmptyState
                icon="✨"
                title="Пока нет рекомендаций"
                description="Подскажите гостю, что хорошо сочетается с этой позицией: напиток, соус, десерт или другое блюдо."
                chips={["🥤 Напитки", "🧄 Соусы", "🍰 Десерты"]}
              />
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
