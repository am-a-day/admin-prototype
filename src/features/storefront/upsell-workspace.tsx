import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import {
  ArrowCounterClockwise,
  CaretDown,
  CaretRight,
  Check,
  CheckCircle,
  FunnelSimple,
  ImageBroken,
  MagnifyingGlass,
  Robot,
  Sparkle,
  X,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { TooltipProvider } from "@/components/ui/tooltip";
import { PromoRecommendationsCard, PromoTab, RecommendationsContextWorkspace } from "@/features/storefront/catalog-workspace";
import { useCatalogStore } from "@/contexts/catalog-store-context";
import { usePublish } from "@/contexts/publish-context";
import { catalogSections, type CatalogItem } from "@/data/catalog";
import type { RecommendationTexts, UpsellSurface } from "@/data/mock-data";
import { catalogStorageKey } from "@/lib/catalog-preview";
import {
  readCatalogUpsellState,
  resolveRecommendationIds,
  writeCatalogUpsellState,
  type CatalogUpsellStateByItem,
} from "@/lib/catalog-upsell";
import { cn } from "@/lib/utils";

type UpsellWorkspaceProps = {
  selectedDishId: string;
  setSelectedDishId: (id: string) => void;
  recommendationTexts: RecommendationTexts;
  setRecommendationText: (key: keyof RecommendationTexts, value: string) => void;
  setUpsellSurface: (surface: UpsellSurface) => void;
  setUpsellFocused: (focused: boolean) => void;
  onOpenPosition?: (id: string) => void;
};

type MainFilter = "all" | "missing" | "configured";
type RecommendationSource = "manual" | "generated";
type UpsellMeta = {
  source: RecommendationSource;
  runId?: string;
  generatedIds?: string[];
  updatedAt: number;
  manuallyChangedAfterGeneration?: boolean;
};
type UpsellMetaByItem = Record<string, UpsellMeta>;
type GeneratorScope = "catalog" | "section";
type GenerationResult = {
  runId: string;
  createdIds: string[];
  noCandidateIds: string[];
  skippedManualIds: string[];
  technicalErrorIds: string[];
};

const UPSELL_META_STORAGE_KEY = catalogStorageKey("upsellAuditMetaByItem");
const UPSELL_LAST_RUN_STORAGE_KEY = catalogStorageKey("upsellLastGenerationRun");
const ALL_SECTIONS = "all";

function readStored<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) as T : fallback;
  } catch {
    return fallback;
  }
}

function writeStored(key: string, value: unknown) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function sectionPath(sectionId: string) {
  const byId = new Map(catalogSections.map((section) => [section.id, section]));
  const names: string[] = [];
  let current = byId.get(sectionId);
  const visited = new Set<string>();
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    names.unshift(current.name);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return names.join(" / ");
}

function sectionAndDescendants(sectionId: string) {
  const result = new Set([sectionId]);
  let changed = true;
  while (changed) {
    changed = false;
    catalogSections.forEach((section) => {
      if (section.parentId && result.has(section.parentId) && !result.has(section.id)) {
        result.add(section.id);
        changed = true;
      }
    });
  }
  return result;
}

function isActiveCatalogItem(item: CatalogItem) {
  return item.status === "active";
}

function ModalFrame({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return createPortal(
    <div className="fixed inset-0 z-[100005] flex items-center justify-center bg-black/25 px-4" role="dialog" aria-modal="true" aria-label={title}>
      <div className="w-full max-w-[520px] overflow-hidden rounded-[14px] border border-[#e7e5e4] bg-white shadow-[0_24px_64px_rgba(41,37,36,0.18)]">
        <div className="flex items-center justify-between border-b border-[#eceae7] px-4 py-3">
          <h2 className="text-[14px] font-medium text-[#292524]">{title}</h2>
          <button type="button" onClick={onClose} className="flex h-8 w-8 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#f5f5f4]" aria-label="Закрыть">
            <X size={17} />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

export function UpsellWorkspace(props: UpsellWorkspaceProps) {
  return (
    <RecommendationsContextWorkspace
      selectedDishId={props.selectedDishId}
      setSelectedDishId={props.setSelectedDishId}
      setUpsellSurface={props.setUpsellSurface}
      setUpsellFocused={props.setUpsellFocused}
    />
  );
}

export function LegacyUpsellWorkspace({
  selectedDishId,
  setSelectedDishId,
  setUpsellSurface,
  setUpsellFocused,
}: UpsellWorkspaceProps) {
  const { items, setActiveEditorItemId } = useCatalogStore();
  const { registerChange } = usePublish();
  const activeItems = useMemo(() => items.filter(isActiveCatalogItem), [items]);
  const [upsellByItem, setUpsellByItem] = useState<CatalogUpsellStateByItem>(readCatalogUpsellState);
  const [metaByItem, setMetaByItem] = useState<UpsellMetaByItem>(() => readStored(UPSELL_META_STORAGE_KEY, {}));
  const [query, setQuery] = useState("");
  const [mainFilter, setMainFilter] = useState<MainFilter>("all");
  const [sectionId, setSectionId] = useState(ALL_SECTIONS);
  const [generatorOpen, setGeneratorOpen] = useState(false);
  const [generatorScope, setGeneratorScope] = useState<GeneratorScope>("catalog");
  const [generationProgress, setGenerationProgress] = useState<{ current: number; total: number } | null>(null);
  const [generationResult, setGenerationResult] = useState<GenerationResult | null>(() => readStored(UPSELL_LAST_RUN_STORAGE_KEY, null));
  const [resultOpen, setResultOpen] = useState(false);
  const cancelledRef = useRef(false);
  const stateRef = useRef(upsellByItem);
  const metaRef = useRef(metaByItem);

  useEffect(() => { stateRef.current = upsellByItem; }, [upsellByItem]);
  useEffect(() => { metaRef.current = metaByItem; }, [metaByItem]);
  useEffect(() => () => { cancelledRef.current = true; }, []);

  const selectedScopeSections = useMemo(
    () => sectionId === ALL_SECTIONS ? null : sectionAndDescendants(sectionId),
    [sectionId],
  );
  const rows = useMemo(() => activeItems.map((item) => ({
    item,
    recommendationIds: resolveRecommendationIds(item, items, upsellByItem[item.id]),
  })), [activeItems, items, upsellByItem]);
  const scopedRows = useMemo(
    () => rows.filter((row) => !selectedScopeSections || selectedScopeSections.has(row.item.sectionId)),
    [rows, selectedScopeSections],
  );
  const filteredRows = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return scopedRows
      .filter((row) => !normalizedQuery || `${row.item.title} ${sectionPath(row.item.sectionId)}`.toLowerCase().includes(normalizedQuery))
      .filter((row) => mainFilter === "all" || (mainFilter === "missing" ? row.recommendationIds.length === 0 : row.recommendationIds.length > 0));
  }, [mainFilter, query, scopedRows]);
  const missingCount = scopedRows.filter((row) => row.recommendationIds.length === 0).length;
  const configuredCount = scopedRows.length - missingCount;
  const selectedItem = items.find((item) => item.id === selectedDishId) ?? null;
  const selectedSection = catalogSections.find((section) => section.id === sectionId) ?? null;
  const activeFilterCount = Number(mainFilter !== "all") + Number(sectionId !== ALL_SECTIONS);

  useEffect(() => {
    if (!selectedItem) {
      setActiveEditorItemId(null);
      setUpsellFocused(false);
      return;
    }
    setActiveEditorItemId(selectedItem.id);
    setUpsellSurface("dish");
    setUpsellFocused(true);
    return () => {
      setActiveEditorItemId(null);
      setUpsellFocused(false);
    };
  }, [selectedItem?.id, setActiveEditorItemId, setUpsellFocused, setUpsellSurface]);

  const persistState = (next: CatalogUpsellStateByItem) => {
    stateRef.current = next;
    setUpsellByItem(next);
    writeCatalogUpsellState(next);
  };
  const persistMeta = (next: UpsellMetaByItem) => {
    metaRef.current = next;
    setMetaByItem(next);
    writeStored(UPSELL_META_STORAGE_KEY, next);
  };
  const updateSelectedUpsell = (next: CatalogUpsellStateByItem[string]) => {
    if (!selectedItem) return;
    const previousMeta = metaRef.current[selectedItem.id];
    persistState({ ...stateRef.current, [selectedItem.id]: next });
    persistMeta({
      ...metaRef.current,
      [selectedItem.id]: {
        source: "manual",
        updatedAt: Date.now(),
        ...(previousMeta?.source === "generated" ? { manuallyChangedAfterGeneration: true } : {}),
      },
    });
    registerChange("catalog");
  };

  const scopeCandidates = useMemo(() => {
    const scopeSections = generatorScope === "section" && sectionId !== ALL_SECTIONS
      ? sectionAndDescendants(sectionId)
      : null;
    return activeItems.filter((item) => !scopeSections || scopeSections.has(item.sectionId));
  }, [activeItems, generatorScope, sectionId]);
  const preflightMissing = scopeCandidates.filter((item) => resolveRecommendationIds(item, items, upsellByItem[item.id]).length === 0);
  const preflightConfigured = scopeCandidates.length - preflightMissing.length;

  const validCandidatesFor = (item: CatalogItem) => {
    const candidates = items
      .filter((candidate) => candidate.sectionId === item.sectionId)
      .filter((candidate) => candidate.id !== item.id && isActiveCatalogItem(candidate) && candidate.displayMode === "full")
      .sort((left, right) => left.title.localeCompare(right.title, "ru"));
    if (candidates.length === 0) return [];
    const seed = [...item.id].reduce((sum, character) => sum + character.charCodeAt(0), 0);
    const start = seed % candidates.length;
    return [...candidates.slice(start), ...candidates.slice(0, start)].slice(0, 4).map((candidate) => candidate.id);
  };

  const startGeneration = async () => {
    if (generationProgress || preflightMissing.length === 0) return;
    setGeneratorOpen(false);
    cancelledRef.current = false;
    const runId = `run-${Date.now()}`;
    const result: GenerationResult = { runId, createdIds: [], noCandidateIds: [], skippedManualIds: [], technicalErrorIds: [] };
    setGenerationProgress({ current: 0, total: preflightMissing.length });

    for (let index = 0; index < preflightMissing.length; index += 1) {
      if (cancelledRef.current) return;
      const item = preflightMissing[index];
      await new Promise((resolve) => window.setTimeout(resolve, 70));
      const latestState = readCatalogUpsellState();
      if (resolveRecommendationIds(item, items, latestState[item.id]).length > 0) {
        result.skippedManualIds.push(item.id);
        setGenerationProgress({ current: index + 1, total: preflightMissing.length });
        continue;
      }
      const candidates = validCandidatesFor(item);
      if (candidates.length === 0) {
        result.noCandidateIds.push(item.id);
        setGenerationProgress({ current: index + 1, total: preflightMissing.length });
        continue;
      }
      const nextState = { ...latestState, [item.id]: { ...latestState[item.id], recommendationIds: candidates } };
      const nextMeta = {
        ...metaRef.current,
        [item.id]: { source: "generated" as const, runId, generatedIds: candidates, updatedAt: Date.now() },
      };
      persistState(nextState);
      persistMeta(nextMeta);
      result.createdIds.push(item.id);
      setGenerationProgress({ current: index + 1, total: preflightMissing.length });
    }

    setGenerationProgress(null);
    setGenerationResult(result);
    writeStored(UPSELL_LAST_RUN_STORAGE_KEY, result);
    setResultOpen(true);
    registerChange("catalog");
  };

  const undoLastGeneration = () => {
    if (!generationResult) return;
    const nextState = { ...stateRef.current };
    const nextMeta = { ...metaRef.current };
    generationResult.createdIds.forEach((id) => {
      const meta = nextMeta[id];
      const currentIds = nextState[id]?.recommendationIds ?? [];
      if (meta?.source !== "generated" || meta.runId !== generationResult.runId || meta.manuallyChangedAfterGeneration) return;
      if (JSON.stringify(currentIds) !== JSON.stringify(meta.generatedIds ?? [])) return;
      const rest = { ...nextState[id] };
      delete rest.recommendationIds;
      if (Object.keys(rest).length > 0) nextState[id] = rest;
      else delete nextState[id];
      delete nextMeta[id];
    });
    persistState(nextState);
    persistMeta(nextMeta);
    setGenerationResult(null);
    window.localStorage.removeItem(UPSELL_LAST_RUN_STORAGE_KEY);
    registerChange("catalog");
  };

  const resetFilters = () => {
    setQuery("");
    setMainFilter("all");
    setSectionId(ALL_SECTIONS);
  };

  const filterOptions: { id: MainFilter; label: string; count: number }[] = [
    { id: "all", label: "Все позиции", count: scopedRows.length },
    { id: "missing", label: "Без допродаж", count: missingCount },
    { id: "configured", label: "С допродажами", count: configuredCount },
  ];

  return (
    <TooltipProvider>
    <main className="flex min-h-0 min-w-0 flex-1 overflow-hidden bg-[#fbfbf9]">
      <aside className="flex w-[251px] shrink-0 flex-col overflow-hidden border-r border-[#e7e5e4] bg-[#fbfbf9]">
        <div className="shrink-0 px-3 pb-3 pt-3">
          <div className="flex h-8 items-center justify-between gap-2">
            <h2 className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#292524]">Позиции</h2>
            <Button
              type="button"
              size="sm"
              disabled={Boolean(generationProgress)}
              onClick={() => setGeneratorOpen(true)}
              className="h-7 gap-1.5 rounded-[8px] px-2 text-[12px] font-medium"
            >
              <Sparkle size={14} weight="bold" />
              {generationProgress ? "Генерация…" : "Сгенерировать"}
            </Button>
          </div>

          <label className="mt-2 flex h-9 items-center gap-2 rounded-[9px] bg-[#f1f1ec] px-2.5 text-[#a8a29e] focus-within:ring-2 focus-within:ring-[#292524]/10">
            <MagnifyingGlass size={16} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Поиск по позициям"
              className="min-w-0 flex-1 bg-transparent text-[13px] text-[#292524] outline-none placeholder:text-[#a8a29e]"
            />
          </label>

          <DropdownMenu.Root>
            <DropdownMenu.Trigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-1.5 h-8 w-full justify-start gap-2 rounded-[8px] px-2 text-[12px] font-normal text-[#57534d] hover:bg-[#f0f0ea]"
              >
                <FunnelSimple size={15} />
                <span className="flex-1 text-left">Фильтры</span>
                {activeFilterCount > 0 && (
                  <span className="flex h-4 min-w-4 items-center justify-center rounded-[4px] bg-[#e7e5e4] px-1 text-[10px] font-medium tabular-nums text-[#57534d]">
                    {activeFilterCount}
                  </span>
                )}
                <CaretDown size={13} />
              </Button>
            </DropdownMenu.Trigger>
            <DropdownMenu.Portal>
              <DropdownMenu.Content
                sideOffset={4}
                align="start"
                className="z-[100010] min-w-[235px] rounded-[10px] border border-[#e7e5e4] bg-white p-1 shadow-[0_12px_32px_rgba(41,37,36,0.14)]"
              >
                {filterOptions.map((option) => (
                  <DropdownMenu.Item
                    key={option.id}
                    onSelect={() => setMainFilter(option.id)}
                    className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]"
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {mainFilter === option.id && <Check size={13} weight="bold" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">{option.label}</span>
                    <span className="shrink-0 text-[12px] tabular-nums text-[#a8a29e]">{option.count}</span>
                  </DropdownMenu.Item>
                ))}
                <DropdownMenu.Separator className="my-1 h-px bg-[#eceae7]" />
                <DropdownMenu.Sub>
                  <DropdownMenu.SubTrigger className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] text-[#44403b] outline-none transition data-[highlighted]:bg-[#f5f5f4]">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center">
                      {sectionId !== ALL_SECTIONS && <Check size={13} weight="bold" />}
                    </span>
                    <span className="min-w-0 flex-1 truncate">Раздел</span>
                    <span className="max-w-[105px] truncate text-[12px] text-[#a8a29e]">{selectedSection?.name ?? "Все"}</span>
                    <CaretRight size={13} className="shrink-0 text-[#a8a29e]" />
                  </DropdownMenu.SubTrigger>
                  <DropdownMenu.Portal>
                    <DropdownMenu.SubContent
                      sideOffset={4}
                      alignOffset={-4}
                      className="z-[100011] max-h-[360px] min-w-[260px] overflow-y-auto rounded-[10px] border border-[#e7e5e4] bg-white p-1 shadow-[0_12px_32px_rgba(41,37,36,0.14)]"
                    >
                      <DropdownMenu.Item
                        onSelect={() => setSectionId(ALL_SECTIONS)}
                        className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] text-[#44403b] outline-none data-[highlighted]:bg-[#f5f5f4]"
                      >
                        <span className="flex h-4 w-4 shrink-0 items-center justify-center">{sectionId === ALL_SECTIONS && <Check size={13} weight="bold" />}</span>
                        <span className="min-w-0 flex-1 truncate">Все разделы</span>
                        <span className="text-[12px] tabular-nums text-[#a8a29e]">{activeItems.length}</span>
                      </DropdownMenu.Item>
                      {catalogSections.map((section) => {
                        const scopeIds = sectionAndDescendants(section.id);
                        const count = activeItems.filter((item) => scopeIds.has(item.sectionId)).length;
                        return (
                          <DropdownMenu.Item
                            key={section.id}
                            onSelect={() => setSectionId(section.id)}
                            className="flex min-h-8 cursor-pointer select-none items-center gap-2 rounded-[8px] px-2 text-[13px] text-[#44403b] outline-none data-[highlighted]:bg-[#f5f5f4]"
                          >
                            <span className="flex h-4 w-4 shrink-0 items-center justify-center">{sectionId === section.id && <Check size={13} weight="bold" />}</span>
                            <span className="min-w-0 flex-1 truncate">{sectionPath(section.id)}</span>
                            <span className="shrink-0 text-[12px] tabular-nums text-[#a8a29e]">{count}</span>
                          </DropdownMenu.Item>
                        );
                      })}
                    </DropdownMenu.SubContent>
                  </DropdownMenu.Portal>
                </DropdownMenu.Sub>
              </DropdownMenu.Content>
            </DropdownMenu.Portal>
          </DropdownMenu.Root>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
          {filteredRows.length > 0 ? filteredRows.map((row) => {
            const active = selectedItem?.id === row.item.id;
            return (
              <button
                key={row.item.id}
                type="button"
                onClick={() => setSelectedDishId(row.item.id)}
                className={cn(
                  "flex h-10 w-full items-center gap-2 rounded-[8px] px-1.5 text-left transition",
                  active ? "bg-[#f0f0ea]" : "hover:bg-[#f5f5f4]",
                )}
              >
                <span className="flex h-[30px] w-[30px] shrink-0 items-center justify-center overflow-hidden rounded-[7px] bg-[#efefeb]">
                  {row.item.thumbnailUrl ? (
                    <img src={row.item.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <ImageBroken size={15} className="text-[#a8a29e]" />
                  )}
                </span>
                <span className={cn("min-w-0 flex-1 truncate text-[13px] leading-5", active ? "font-medium text-[#292524]" : "font-normal text-[#44403b]")}>{row.item.title}</span>
                <span className="min-w-5 shrink-0 text-right text-[12px] tabular-nums text-[#79716b]">{row.recommendationIds.length}</span>
              </button>
            );
          }) : (
            <div className="flex h-full flex-col items-center justify-center px-4 text-center">
              <p className="text-[13px] text-[#79716b]">Ничего не найдено</p>
              <button type="button" onClick={resetFilters} className="mt-2 h-8 rounded-[8px] px-2 text-[12px] font-medium text-[#57534d] transition hover:bg-[#f0f0ea]">
                Сбросить фильтры
              </button>
            </div>
          )}
        </div>
      </aside>

      <section className="min-w-0 flex-1 overflow-y-auto bg-[#fbfbf9]">
        {selectedItem ? (
          <div className="mx-auto w-full max-w-[800px] p-6 pt-0">
            <div className="flex items-center gap-2 pb-2 pt-6">
              <h2 className="min-w-0 flex-1 truncate text-[14px] font-medium leading-7 text-[#292524]">{selectedItem.title}</h2>
            </div>
            <div className="space-y-2">
              <div data-editor-tabs-card className="rounded-[13px] border border-[#e7e5e4] bg-white shadow-[0_1px_4px_rgba(12,12,13,0.05)]">
                <div className="flex items-center gap-2 px-3">
                  <div className="border-b border-[#1c1917] px-1 py-3.5 text-[13px] font-medium text-[#1c1917]">Допродажа</div>
                </div>
                <PromoRecommendationsCard
                  item={selectedItem}
                  allItems={items}
                  upsell={upsellByItem[selectedItem.id] ?? {}}
                  onChange={updateSelectedUpsell}
                />
              </div>
              <PromoTab
                item={selectedItem}
                upsell={upsellByItem[selectedItem.id] ?? {}}
                onChange={updateSelectedUpsell}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-[14px] text-[#79716b]">
            Выберите позицию, чтобы настроить допродажи
          </div>
        )}
      </section>

      {generatorOpen && (
        <ModalFrame title="Сгенерировать допродажи" onClose={() => setGeneratorOpen(false)}>
          <div className="space-y-4 px-4 py-4">
            <p className="text-[13px] leading-5 text-[#57534d]">Генерация добавит рекомендации только позициям без допродаж. Существующие ручные настройки не будут перезаписаны.</p>
            <div className="space-y-2">
              <label className="flex cursor-pointer items-start gap-3 rounded-[10px] border border-[#e7e5e4] p-3">
                <input type="radio" checked={generatorScope === "catalog"} onChange={() => setGeneratorScope("catalog")} className="mt-0.5 accent-[#4f46e5]" />
                <span><span className="block text-[13px] font-medium text-[#292524]">Весь каталог</span><span className="text-[12px] text-[#79716b]">Только позиции без допродаж</span></span>
              </label>
              <label className={cn("flex items-start gap-3 rounded-[10px] border border-[#e7e5e4] p-3", sectionId === ALL_SECTIONS ? "cursor-not-allowed opacity-50" : "cursor-pointer")}>
                <input type="radio" disabled={sectionId === ALL_SECTIONS} checked={generatorScope === "section"} onChange={() => setGeneratorScope("section")} className="mt-0.5 accent-[#4f46e5]" />
                <span><span className="block text-[13px] font-medium text-[#292524]">Выбранный раздел и подразделы</span><span className="text-[12px] text-[#79716b]">{selectedSection ? sectionPath(selectedSection.id) : "Сначала выберите раздел в фильтрах"}</span></span>
              </label>
            </div>
            <p className="text-[12px] text-[#79716b]">К генерации: {preflightMissing.length} · Уже настроено: {preflightConfigured}</p>
          </div>
          <div className="flex justify-end gap-2 border-t border-[#eceae7] px-4 py-3">
            <Button type="button" variant="ghost" size="sm" onClick={() => setGeneratorOpen(false)}>Отменить</Button>
            <Button type="button" size="sm" disabled={preflightMissing.length === 0} onClick={startGeneration} className="font-medium"><Robot size={14} />Сгенерировать</Button>
          </div>
        </ModalFrame>
      )}

      {resultOpen && generationResult && (
        <ModalFrame title="Генерация завершена" onClose={() => setResultOpen(false)}>
          <div className="space-y-2 px-4 py-4 text-[13px] text-[#57534d]">
            <div className="flex items-center gap-2"><CheckCircle size={16} className="text-[#15803d]" />Созданы рекомендации: <strong>{generationResult.createdIds.length}</strong></div>
            <div>Не найдены подходящие позиции: {generationResult.noCandidateIds.length}</div>
            <div>Пропущены из-за ручных изменений: {generationResult.skippedManualIds.length}</div>
          </div>
          <div className="flex justify-between gap-2 border-t border-[#eceae7] px-4 py-3">
            <Button type="button" variant="ghost" size="sm" onClick={undoLastGeneration}><ArrowCounterClockwise size={14} />Отменить генерацию</Button>
            <Button type="button" size="sm" onClick={() => setResultOpen(false)}>Готово</Button>
          </div>
        </ModalFrame>
      )}
    </main>
    </TooltipProvider>
  );
}
