import { createPortal } from "react-dom";
import { useEffect, useRef, useState, type ReactNode } from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  GripVertical,
  Image as ImageIcon,
  LayoutGrid,
  Link,
  Plus,
  Sparkles,
  Trash2,
  Video,
  X,
  XCircle,
} from "lucide-react";
import { PageContent, PageScroll } from "@/components/workspace/page-layout";
import { LaunchPageHint } from "@/components/workspace/launch-hint";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { usePublish } from "@/contexts/publish-context";
import { usePreviewDemo } from "@/contexts/preview-demo-context";
import { usePlan } from "@/contexts/plan-context";
import {
  categories,
  dishes,
  featuredCategoryIds,
  promotedDishIds,
  START_BANNER_LIMIT,
  type Banner,
  type BannerTag,
  type BannerTagType,
} from "@/data/mock-data";
import { cn } from "@/lib/utils";

type HomeWorkspaceProps = {
  banners: Banner[];
  selectedBannerId: string;
  setSelectedBannerId: (id: string) => void;
  updateBanner: (id: string, patch: Partial<Banner>) => void;
  removeBanner: (id: string) => void;
  addBanner: (imageUrl?: string) => void;
  /** Активная вкладка главной (живёт в App, рендерится в общей шапке контента). */
  homeTab: HomeTab;
  setHomeTab: (t: HomeTab) => void;
  /** Прокрутка/подсветка блока при переходе из превью. */
  homeFocus?: "hero" | "sections" | null;
  onHomeFocusHandled?: () => void;
};

const MAX_BANNER_CHARS = 70;

function tagStyle(type: BannerTagType) {
  if (type === "accent")   return "bg-[#ff2d55] text-white font-bold border-transparent";
  if (type === "contrast") return "bg-white border-[1.5px] border-zinc-900 text-zinc-900 font-bold";
  return "bg-white border border-zinc-300 text-zinc-700";
}

export type HomeTab = "banners" | "sections" | "promoted";
const HOME_TABS: { id: HomeTab; label: string }[] = [
  { id: "banners",  label: "Баннеры" },
  { id: "sections", label: "Подборка разделов" },
  { id: "promoted", label: "Подборка позиций" },
];

export function HomeTabs({ value, onChange }: { value: HomeTab; onChange: (t: HomeTab) => void }) {
  return (
    <div className="inline-flex items-center gap-0.5 rounded-lg bg-[#f5f5f4] p-0.5">
      {HOME_TABS.map((t) => {
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

function EditorEmpty({
  icon: Icon,
  title,
  desc,
  cta,
  onClick,
}: {
  icon: typeof ImageIcon;
  title: string;
  desc: string;
  cta: string;
  onClick: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-zinc-300 bg-zinc-50/50 px-6 py-14 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-zinc-400 ring-1 ring-zinc-200">
        <Icon size={22} />
      </div>
      <div className="text-[15px] font-medium text-zinc-900">{title}</div>
      <p className="max-w-sm text-[13px] leading-relaxed text-zinc-500">{desc}</p>
      <Button onClick={onClick} className="font-bold">
        <Plus size={15} />
        {cta}
      </Button>
    </div>
  );
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
        "shrink-0 rounded-[10px] border p-0.5 transition",
        selected ? "border-[#4f39f6]" : "border-transparent hover:border-zinc-200",
      )}
    >
      <div className={cn("relative h-[60px] w-[55px] overflow-hidden rounded-[7px] bg-gradient-to-br", banner.accent)}>
        {banner.image && (
          <img src={banner.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
        )}
        {!banner.visible && (
          <div className="absolute inset-0 flex items-center justify-center bg-[rgba(105,105,105,0.7)]">
            <EyeOff size={22} className="text-white" />
          </div>
        )}
      </div>
    </button>
  );
}

type PickItem = { id: string; emoji: string; accent: string; name: string; price?: string };

function WorkAreaHeader({
  title, action,
}: {
  title: string; action?: ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <h2 className="text-[15px] font-semibold text-[#292524]">{title}</h2>
      {action}
    </div>
  );
}

function DismissibleIntro({ title, text, onDismiss }: { title: string; text: string; onDismiss: () => void }) {
  return (
    <div className="relative rounded-xl bg-[#f5f5f4] px-4 py-3 pr-10">
      <button type="button" onClick={onDismiss} aria-label="Закрыть" className="absolute right-3 top-3 text-[#a6a09b] transition hover:text-[#57534d]">
        <X size={14} />
      </button>
      <p className="text-[13px] font-medium text-[#292524]">{title}</p>
      <p className="mt-0.5 text-[13px] leading-[1.4] text-[#79716b]">{text}</p>
    </div>
  );
}

function PickList({ items, onRemove, onReorder }: { items: PickItem[]; onRemove: (id: string) => void; onReorder?: (from: number, to: number) => void }) {
  const dragIdx = useRef<number | null>(null);
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div
          key={item.id}
          draggable={!!onReorder}
          onDragStart={() => { dragIdx.current = i; }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={() => { if (dragIdx.current !== null && dragIdx.current !== i) { onReorder!(dragIdx.current, i); dragIdx.current = null; } }}
          className="flex items-center gap-[7px]"
        >
          <GripVertical size={14} className={cn("shrink-0", onReorder ? "cursor-grab text-[#a6a09b]" : "text-[#d6d3d1]")} />
          <div className="flex min-w-0 flex-1 items-center gap-[10px]">
            <div className={cn("flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-[3px] bg-gradient-to-br text-sm", item.accent)}>
              {item.emoji}
            </div>
            <span className="min-w-0 flex-1 truncate text-[13px] text-[#292524]">{item.name}</span>
            {item.price && <span className="shrink-0 text-[12px] text-[#a6a09b]">{item.price}</span>}
          </div>
          <button
            type="button"
            onClick={() => onRemove(item.id)}
            className="flex shrink-0 items-center gap-[5px] text-[#a6a09b] transition hover:text-red-500"
          >
            <XCircle size={13} className="shrink-0" />
            <span className="text-[12px]">Убрать</span>
          </button>
        </div>
      ))}
    </div>
  );
}

// ponytail: mock cycle, replace with real upload handler when backend ready
const MOCK_IMAGES = [
  "https://picsum.photos/seed/cafe-a/300/150",
  "https://picsum.photos/seed/cafe-b/300/150",
  "https://picsum.photos/seed/cafe-c/300/150",
];

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
  const [linkOpen, setLinkOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [addingTag, setAddingTag] = useState(false);
  const [editingTagId, setEditingTagId] = useState<string | null>(null);
  const [tagLang, setTagLang] = useState<"ru" | "kz" | "en">("ru");
  const [tagType, setTagType] = useState<BannerTagType>("accent");
  const [tagTexts, setTagTexts] = useState({ ru: "", kz: "", en: "" });
  const handleReplaceMock = () => {
    const idx = MOCK_IMAGES.indexOf(banner.image ?? "");
    updateBanner(banner.id, { image: MOCK_IMAGES[(idx + 1) % MOCK_IMAGES.length] });
    mark();
  };

  const openEditTag = (tag: BannerTag) => {
    setEditingTagId(tag.id);
    setTagType(tag.type);
    setTagTexts({ ...tag.texts });
    setTagLang("ru");
    setAddingTag(true);
  };
  const closeTagPanel = () => {
    setAddingTag(false);
    setEditingTagId(null);
    setTagTexts({ ru: "", kz: "", en: "" });
  };
  const confirmTag = () => {
    if (!tagTexts.ru.trim()) return;
    if (editingTagId) {
      updateBanner(banner.id, {
        tags: banner.tags.map((t) => t.id === editingTagId ? { ...t, type: tagType, texts: { ...tagTexts } } : t),
      });
    } else {
      const newTag: BannerTag = { id: `tag-${Date.now()}`, type: tagType, texts: { ...tagTexts } };
      updateBanner(banner.id, { tags: [...banner.tags, newTag] });
    }
    mark();
    closeTagPanel();
  };
  const removeTag = (id: string) => {
    updateBanner(banner.id, { tags: banner.tags.filter((t) => t.id !== id) });
    mark();
  };

  const chars = banner.subtitle.length;

  return (
    <>
    <div className="rounded-2xl border border-[#e7e5e4] bg-[#f5f5f4]">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={handleReplaceMock}
            title="Заменить медиа"
            className="relative shrink-0 cursor-pointer overflow-hidden rounded-[5px] border border-[#4f39f6] p-0.5 transition hover:opacity-75"
          >
            <div className={cn("h-7 w-[26px] overflow-hidden rounded-[3px] bg-gradient-to-br", banner.accent)}>
              {banner.image && <img src={banner.image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
            </div>
          </button>
          <div className="flex min-w-0 items-center gap-1.5">
            <Video size={14} className="shrink-0 text-[#79716b]" />
            <span className="truncate text-[13px] font-medium text-[#79716b]">{banner.subtitle}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setConfirmDelete(true)}
          className="shrink-0 text-zinc-400 transition hover:text-red-500"
          title="Удалить баннер"
        >
          <Trash2 size={16} />
        </button>
      </div>

      {/* Body */}
      <div className="flex flex-col gap-1.5 px-1 pb-1">
        {/* Tags + Textarea */}
        <div className="flex flex-col gap-2 rounded-2xl bg-white px-2.5 py-4">
          <div className="flex flex-wrap gap-1.5">
            {banner.tags.map((tag) => (
              <button
                key={tag.id}
                type="button"
                onClick={() => openEditTag(tag)}
                className={cn("inline-flex h-8 items-center gap-1 rounded-full border px-2 text-[13px] transition hover:opacity-80", tagStyle(tag.type))}
              >
                {tag.texts.ru}
                <span
                  role="button"
                  onClick={(e) => { e.stopPropagation(); removeTag(tag.id); }}
                  className="opacity-60 hover:opacity-100"
                >
                  <X size={14} />
                </span>
              </button>
            ))}
            {!addingTag && (
              <button
                type="button"
                onClick={() => setAddingTag(true)}
                className="inline-flex h-8 items-center gap-1 rounded-full border border-dashed border-[#d6d3d1] px-4 text-[13px] text-[#292524] hover:border-zinc-400"
              >
                <Plus size={13} />
                Добавить тег
              </button>
            )}
          </div>
          {addingTag && (
            <div className="rounded-xl border border-[#e7e5e4] bg-[#f5f5f4] p-3">
              {/* Input + lang switcher */}
              <div className="mb-2 flex items-center gap-2">
                <input
                  autoFocus
                  value={tagTexts[tagLang]}
                  placeholder="Текст тега..."
                  onChange={(e) => setTagTexts((p) => ({ ...p, [tagLang]: e.target.value }))}
                  onKeyDown={(e) => { if (e.key === "Enter") confirmTag(); if (e.key === "Escape") setAddingTag(false); }}
                  className="min-w-0 flex-1 rounded-lg border border-[#e7e5e4] bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-[#4f39f6]"
                />
                <div className="flex overflow-hidden rounded-lg border border-[#e7e5e4]">
                  {(["ru", "kz", "en"] as const).map((lang) => (
                    <button
                      key={lang}
                      type="button"
                      onClick={() => setTagLang(lang)}
                      className={cn("px-2 py-1.5 text-[11px] font-medium uppercase transition", tagLang === lang ? "bg-[#4f39f6] text-white" : "bg-white text-zinc-500 hover:bg-zinc-50")}
                    >
                      {lang}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={closeTagPanel} className="text-zinc-400 hover:text-zinc-600">
                  <X size={14} />
                </button>
              </div>
              {/* Type selector */}
              <div className="mb-2.5 flex gap-1.5">
                {(["accent", "contrast", "outline"] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setTagType(t)}
                    className={cn(
                      "flex-1 rounded-lg py-1.5 text-[11px] font-medium transition",
                      tagType === t ? "bg-white shadow-sm ring-1 ring-[#4f39f6] text-[#4f39f6]" : "text-zinc-500 hover:bg-white/60",
                    )}
                  >
                    {t === "accent" ? "Акцентный" : t === "contrast" ? "Контрастный" : "Контурный"}
                  </button>
                ))}
              </div>
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={confirmTag}
                  disabled={!tagTexts.ru.trim()}
                  className="rounded-lg bg-[#4f39f6] px-3 py-1.5 text-[12px] font-medium text-white transition disabled:opacity-40"
                >
                  {editingTagId ? "Сохранить" : "Добавить"}
                </button>
              </div>
            </div>
          )}

          <div className="relative rounded-xl border border-[#e7e5e4] bg-white">
            <span className="absolute left-2.5 top-[9px] text-[12px] leading-[1.5] text-[#79716b]">
              Надпись на баннере
            </span>
            <textarea
              value={banner.subtitle}
              maxLength={MAX_BANNER_CHARS}
              rows={3}
              onChange={(e) => { updateBanner(banner.id, { subtitle: e.target.value }); mark(); }}
              className="w-full resize-none rounded-xl bg-transparent pb-5 pl-2.5 pr-2 pt-7 text-[13px] text-[#292524] outline-none"
            />
            <span className="absolute bottom-1.5 right-2.5 text-[11px] text-[#a6a09b]">
              {chars} из {MAX_BANNER_CHARS}
            </span>
          </div>
        </div>

        {/* Action rows */}
        <div className="overflow-hidden rounded-2xl bg-white">
          {/* Ссылка: click to expand inline input */}
          <button
            type="button"
            onClick={() => setLinkOpen((v) => !v)}
            className="flex h-[42px] w-full items-center justify-between px-4 text-left"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Link size={18} className="shrink-0 text-[#292524]" />
              <span className="text-[13px] text-[#292524]">Ссылка</span>
              {banner.link && !linkOpen && (
                <>
                  <span className="text-[13px] text-[#79716b]">·</span>
                  <span className="truncate text-[13px] text-[#a6a09b]">{banner.link}</span>
                </>
              )}
            </div>
            <ChevronDown size={16} className={cn("shrink-0 text-zinc-400 transition", linkOpen && "rotate-180")} />
          </button>
          {linkOpen && (
            <div className="border-t border-[#e7e5e4] px-4 pb-3 pt-2">
              <input
                autoFocus
                value={banner.link}
                placeholder="https://..."
                onChange={(e) => { updateBanner(banner.id, { link: e.target.value }); mark(); }}
                className="w-full rounded-lg border border-[#e7e5e4] bg-[#f5f5f4] px-3 py-1.5 text-[13px] text-[#292524] outline-none focus:border-[#4f39f6]"
              />
            </div>
          )}
          <div className="flex h-[42px] items-center justify-between border-t border-[#e7e5e4] px-4">
            <div className="flex items-center gap-2">
              <Eye size={18} className="text-[#292524]" />
              <span className="text-[13px] text-[#292524]">Отображение гостям</span>
            </div>
            <Switch
              checked={banner.visible}
              onCheckedChange={(v) => { updateBanner(banner.id, { visible: v }); mark(); }}
            />
          </div>
        </div>
      </div>
    </div>
    {confirmDelete && createPortal(
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-[2px]">
        <div className="w-[320px] rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-zinc-200">
          <h2 className="text-base font-bold text-zinc-900">Удалить баннер?</h2>
          <p className="mt-1.5 text-[13px] leading-5 text-zinc-500">
            Баннер будет удалён без возможности восстановления.
          </p>
          <div className="mt-5 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDelete(false)}
              className="rounded-xl px-4 py-2 text-[13px] text-zinc-500 transition hover:bg-zinc-100"
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => removeBanner(banner.id)}
              className="rounded-xl bg-red-500 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-red-600"
            >
              Удалить
            </button>
          </div>
        </div>
      </div>,
      document.body,
    )}
    </>
  );
}

export function HomeWorkspace({
  banners,
  selectedBannerId,
  setSelectedBannerId,
  updateBanner,
  removeBanner,
  addBanner,
  homeTab: tab,
  setHomeTab: setTab,
  homeFocus,
  onHomeFocusHandled,
}: HomeWorkspaceProps) {
  const selectedBanner = banners.find((b) => b.id === selectedBannerId) ?? banners[0] ?? null;
  const { registerChange } = usePublish();
  const { planId } = usePlan();
  const [flash, setFlash] = useState<"hero" | "sections" | null>(null);
  const [introDismissed, setIntroDismissed] = useState<Record<string, boolean>>({});
  const dismissIntro = (key: string) => setIntroDismissed((p) => ({ ...p, [key]: true }));
  const { emptyVitrine, setEmptyVitrine } = usePreviewDemo();
  const [sectionIds, setSectionIds] = useState(() => [...featuredCategoryIds]);
  const [promotedIds, setPromotedIds] = useState(() => [...promotedDishIds]);

  const sectionItems: PickItem[] = sectionIds.map((id) => {
    const c = categories.find((x) => x.id === id)!;
    return { id, emoji: c.emoji, accent: c.photo, name: c.name };
  });
  const promotedItems: PickItem[] = promotedIds.map((id) => {
    const d = dishes.find((x) => x.id === id)!;
    return { id, emoji: d.emoji, accent: d.accent, name: d.name, price: d.price };
  });
  const addSection = () => {
    const next = categories.find((c) => !sectionIds.includes(c.id));
    if (next) setSectionIds((p) => [...p, next.id]);
  };
  const addPromoted = () => {
    const next = dishes.find((d) => !promotedIds.includes(d.id));
    if (next) setPromotedIds((p) => [...p, next.id]);
  };
  const addFileRef = useRef<HTMLInputElement>(null);
  const isStart = planId === "Start";
  const atStartLimit = isStart && banners.length >= START_BANNER_LIMIT;

  const handleAddBanner = () => addFileRef.current?.click();

  const handleAddFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    addBanner(file ? URL.createObjectURL(file) : undefined);
    registerChange("home");
    e.target.value = "";
  };

  // Переход из превью: открыть нужную вкладку и кратко подсветить блок.
  useEffect(() => {
    if (!homeFocus) return;
    setTab(homeFocus === "hero" ? "banners" : "sections");
    setFlash(homeFocus);
    onHomeFocusHandled?.();
    const t = window.setTimeout(() => setFlash(null), 1600);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [homeFocus]);

  return (
    <PageScroll>
      <input ref={addFileRef} type="file" accept="image/*" className="hidden" onChange={handleAddFileChange} />
      <PageContent className="space-y-6">
        <LaunchPageHint
          checkId="home"
          title="Настройте главный экран витрины"
          description="Добавьте баннеры, ключевые разделы и продвигаемые позиции — это первое, что увидят гости."
        />

        {/* Баннеры */}
        {tab === "banners" && (
          <WorkAreaHeader title="Баннеры" />
        )}
        {tab === "banners" && !introDismissed.banners && (
          <DismissibleIntro
            title="Расскажите о важном на первом экране"
            text="Используйте баннеры для акций, сезонных предложений, новинок или объявлений. Баннер показывается в верхней части главной страницы витрины."
            onDismiss={() => dismissIntro("banners")}
          />
        )}
        {tab === "banners" && banners.length === 0 && (
          <div data-tour="add-banner" className="rounded-[12px] border border-dashed border-[#e7e5e4] bg-[#fafaf9] p-6">
            <div className="flex flex-col gap-6">
              <div className="flex flex-col gap-[17px]">
                <svg width="45" height="45" viewBox="0 0 256 256" aria-hidden="true">
                  <defs>
                    <linearGradient id="banner-icon-grad" x1="0" y1="0" x2="256" y2="256" gradientUnits="userSpaceOnUse">
                      <stop stopColor="#1c1917" />
                      <stop offset="1" stopColor="#78716c" />
                    </linearGradient>
                  </defs>
                  <path fill="url(#banner-icon-grad)" d="M224,104v96a16,16,0,0,1-16,16H48a16,16,0,0,1-16-16V104A16,16,0,0,1,48,88H208A16,16,0,0,1,224,104ZM56,72H200a8,8,0,0,0,0-16H56a8,8,0,0,0,0,16ZM72,40H184a8,8,0,0,0,0-16H72a8,8,0,0,0,0,16Z" />
                </svg>
                <div className="flex flex-col gap-4">
                  <p className="text-[16px] font-medium text-[#44403b]">Добавьте первый баннер</p>
                  <p className="text-[14px] leading-[1.4] text-[#79716b]">
                    Баннеры помогают выделить акции, новинки, сезонные предложения или важную информацию для гостей
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddBanner}
                className="self-start inline-flex h-[32px] items-center justify-center rounded-[10px] bg-[#4f39f6] px-[10px] text-[14px] font-medium text-white transition hover:bg-[#4030d4]"
              >
                Добавить баннер
              </button>
            </div>
          </div>
        )}
        {tab === "banners" && banners.length > 0 && (
          <section
            className={cn(
              "space-y-4 transition",
              flash === "hero" && "rounded-3xl ring-2 ring-blue-400 ring-offset-4",
            )}
          >
            {/* Limit reached block (START plan, slot full) */}
            {atStartLimit && (
              <div className="rounded-xl border border-dashed border-[#e7e5e4] bg-[#fafaf9] p-6">
                <p className="mb-4 text-[14px] leading-[1.4] text-[#292524]">
                  Улучшите тариф, чтобы создавать больше баннеров.{" "}
                  До 5 видео и фото-баннеров —{" "}
                  <span className="font-medium text-[#2b7fff]">на тарифе LITE</span>
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {}}
                    className="h-[32px] rounded-[10px] bg-[#4f39f6] px-4 text-[14px] font-medium text-white transition hover:bg-[#4030d4]"
                  >
                    Улучшить тариф
                  </button>
                  <button
                    type="button"
                    onClick={() => {}}
                    className="h-[32px] rounded-[10px] border border-[#d6d3d1] bg-white px-4 text-[14px] text-[#292524] transition hover:bg-zinc-50"
                  >
                    Сравнить тарифы
                  </button>
                </div>
              </div>
            )}

            {/* Banner strip: hidden at start limit (single banner, no navigation needed) */}
            {!atStartLimit && (
              <div className="flex items-center gap-[8.78px] overflow-x-auto pb-1 scrollbar-none">
                <button
                  type="button"
                  data-tour="add-banner"
                  onClick={handleAddBanner}
                  className="flex h-[62px] w-[62px] shrink-0 items-center justify-center rounded-[8px] border border-dashed border-[#d6d3d1] bg-[#f5f5f4] text-[#79716b] transition hover:bg-zinc-100"
                >
                  <Plus size={18} />
                </button>
                {banners.map((banner) => (
                  <BannerThumb
                    key={banner.id}
                    banner={banner}
                    selected={selectedBanner?.id === banner.id}
                    onSelect={() => setSelectedBannerId(banner.id)}
                  />
                ))}
              </div>
            )}

            {selectedBanner && (
              <BannerEditor
                key={selectedBanner.id}
                banner={selectedBanner}
                updateBanner={updateBanner}
                removeBanner={removeBanner}
              />
            )}
          </section>
        )}

        {/* Разделы */}
        {tab === "sections" && emptyVitrine && (
          <EditorEmpty
            icon={LayoutGrid}
            title="Избранные разделы не выбраны"
            desc="Покажите гостям самые важные категории меню на главной."
            cta="Выбрать разделы"
            onClick={() => setEmptyVitrine(false)}
          />
        )}
        {tab === "sections" && !emptyVitrine && (
          <>
            <WorkAreaHeader
              title={`Подборка разделов · ${sectionItems.length} из 6`}
              action={
                <button
                  type="button"
                  onClick={addSection}
                  disabled={sectionIds.length >= 6}
                  className={cn(
                    "inline-flex shrink-0 h-[32px] items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium transition",
                    sectionIds.length >= 6 ? "bg-[#f5f5f4] text-[#a6a09b] cursor-default" : "bg-[#4f39f6] text-white hover:bg-[#4030d4]",
                  )}
                >
                  {sectionIds.length >= 6 ? "Лимит достигнут" : <><Plus size={13} />Добавить раздел</>}
                </button>
              }
            />
            {!introDismissed.sections && (
              <DismissibleIntro
                title="Помогите гостям быстрее найти нужное"
                text="Покажите важные разделы меню сразу на главной странице. Мы уже добавили несколько разделов из каталога — вы можете изменить порядок, убрать лишнее или добавить другие."
                onDismiss={() => dismissIntro("sections")}
              />
            )}
            <PickList
              items={sectionItems}
              onRemove={(id) => setSectionIds((p) => p.filter((x) => x !== id))}
              onReorder={(from, to) => setSectionIds((p) => { const next = [...p]; next.splice(to, 0, next.splice(from, 1)[0]); return next; })}
            />
          </>
        )}

        {/* Рекомендации */}
        {tab === "promoted" && emptyVitrine && (
          <EditorEmpty
            icon={Sparkles}
            title="Рекомендации не настроены"
            desc="Помогите гостям быстрее выбирать блюда и увеличьте средний чек."
            cta="Настроить рекомендации"
            onClick={() => setEmptyVitrine(false)}
          />
        )}
        {tab === "promoted" && !emptyVitrine && (
          <>
            <WorkAreaHeader
              title={`Подборка позиций · ${promotedItems.length} из 10`}
              action={
                <button
                  type="button"
                  onClick={addPromoted}
                  disabled={promotedIds.length >= 10}
                  className={cn(
                    "inline-flex shrink-0 h-[32px] items-center gap-1.5 rounded-[10px] px-3 text-[13px] font-medium transition",
                    promotedIds.length >= 10 ? "bg-[#f5f5f4] text-[#a6a09b] cursor-default" : "bg-[#4f39f6] text-white hover:bg-[#4030d4]",
                  )}
                >
                  {promotedIds.length >= 10 ? "Лимит достигнут" : <><Plus size={13} />Добавить позицию</>}
                </button>
              }
            />
            {!introDismissed.promoted && (
              <DismissibleIntro
                title="Выделите позиции на главной"
                text="Покажите гостям блюда, товары или предложения, которые хотите продвинуть. Подборку можно заполнить автоматически, а затем отредактировать вручную."
                onDismiss={() => dismissIntro("promoted")}
              />
            )}
            <PickList
              items={promotedItems}
              onRemove={(id) => setPromotedIds((p) => p.filter((x) => x !== id))}
              onReorder={(from, to) => setPromotedIds((p) => { const next = [...p]; next.splice(to, 0, next.splice(from, 1)[0]); return next; })}
            />
          </>
        )}
      </PageContent>
    </PageScroll>
  );
}
