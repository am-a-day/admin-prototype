import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  FlaskConical,
  LayoutDashboard,
  MonitorSmartphone,
  Plus,
  Store,
} from "lucide-react";
import {
  RESTAURANT_NAME, RESTAURANT_INITIALS, RESTAURANT_ADDRESS, STOREFRONT_URL,
  MOCK_VITRINES, CURRENT_VITRINE_ID,
  type PlanId, type SectionId,
} from "@/data/mock-data";
import { usePlan } from "@/contexts/plan-context";
import { useVitrineLaunch, type LaunchStage } from "@/contexts/vitrine-launch-context";
import { usePublish } from "@/contexts/publish-context";
import { usePreviewDemo } from "@/contexts/preview-demo-context";
import { usePlanStatus } from "@/lib/use-plan-status";
import { useVitrineStatus } from "@/lib/use-vitrine-status";
import { cn } from "@/lib/utils";

type MenuItemProps = {
  icon: ComponentType<{ size?: number; className?: string }>;
  label: string;
  external?: boolean;
  onClick?: () => void;
};

function MenuItem({ icon: Icon, label, external, onClick }: MenuItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
    >
      <Icon size={17} className="shrink-0 text-zinc-400" />
      <span className="flex-1">{label}</span>
      {external && <ArrowUpRight size={15} className="shrink-0 text-zinc-400" />}
    </button>
  );
}

/** Organisation / vitrine context menu — triggered from header or sidebar */
export function OrgMenu({
  onNavigate,
  onResetCatalog,
  variant = "full",
}: {
  onNavigate: (section: SectionId, tab: string) => void;
  onResetCatalog?: () => void;
  /** "full" = T avatar (sidebar), "rail" = T avatar with dot, "text" = inline org name (header) */
  variant?: "full" | "rail" | "text";
}) {
  const { planId, setPlanId, daysLeft, setDaysLeftDemo } = usePlan();
  const { stage, forceStage } = useVitrineLaunch();
  const planStatus = usePlanStatus();
  const vitrine = useVitrineStatus();
  const { totalChanges, injectDemoChanges, clearChanges } = usePublish();
  const { emptyVitrine, setEmptyVitrine } = usePreviewDemo();

  const railWarn = planStatus.kind === "expiring" || planStatus.kind === "expired";

  const [open, setOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  const [selectedVitrineId, setSelectedVitrineId] = useState(CURRENT_VITRINE_ID);
  const [popupPos, setPopupPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      const popup = document.getElementById("org-menu-popup");
      if (popup?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      if (variant === "text") {
        // Open below for inline header trigger
        setPopupPos({ top: rect.bottom + 4, left: rect.left });
      } else {
        // Open to the right for sidebar triggers
        setPopupPos({ top: rect.top, left: rect.right + 8 });
      }
    }
    setOpen((v) => !v);
  };

  const close = () => setOpen(false);

  return (
    <>
      {variant === "text" ? (
        /* Inline header trigger: [KA] Kimchi Astana · Абая, 10 ˅ */
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            "flex items-center gap-2 rounded-lg px-2 py-1.5 transition",
            open ? "bg-zinc-100" : "hover:bg-zinc-100",
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={`${RESTAURANT_NAME} · ${RESTAURANT_ADDRESS || vitrine.webAddress}`}
        >
          {/* Avatar */}
          <div className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-md bg-zinc-900 text-[10px] font-bold leading-none text-white">
            {RESTAURANT_INITIALS}
          </div>
          {/* Org name */}
          <span className="max-w-[140px] truncate text-[13px] font-medium text-zinc-900">{RESTAURANT_NAME}</span>
          {/* Separator — скрывается вместе с адресом на узкой ширине */}
          <span className="hidden text-[13px] text-zinc-300 lg:inline" aria-hidden>·</span>
          {/* Address or URL — скрывается первым на узкой ширине */}
          <span className="hidden max-w-[160px] truncate text-[13px] text-zinc-400 lg:inline">
            {RESTAURANT_ADDRESS || vitrine.webAddress}
          </span>
          {/* Chevron */}
          <ChevronDown size={11} className={cn("shrink-0 text-zinc-400 transition", open && "rotate-180")} />
        </button>
      ) : (
        /* Avatar trigger for sidebar (full / rail) */
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            "relative flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-sm font-black text-white transition hover:opacity-90",
            open && "ring-2 ring-blue-500/30 ring-offset-2",
          )}
          aria-expanded={open}
          aria-haspopup="dialog"
          title={variant === "rail" ? `${RESTAURANT_NAME} · ${vitrine.label}` : RESTAURANT_NAME}
        >
          T
          {variant === "rail" && (
            <>
              <span className={cn("absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white", vitrine.dot)} />
              {railWarn && (
                <span className={cn("absolute -right-1 -top-1 h-2 w-2 rounded-full border border-white", planStatus.kind === "expired" ? "bg-orange-500" : "bg-amber-400")} />
              )}
            </>
          )}
        </button>
      )}

      {open && createPortal(
        <div
          id="org-menu-popup"
          style={{ top: popupPos.top, left: popupPos.left }}
          className="fixed z-[200] w-[380px] rounded-2xl border border-border bg-white p-2 shadow-xl shadow-zinc-300/40"
        >
          {/* ── Current vitrine header ── */}
          {(() => {
            const current = MOCK_VITRINES.find((v) => v.id === selectedVitrineId) ?? MOCK_VITRINES[0];
            const subtitle = [current.address, current.url].filter(Boolean).join(" · ");
            return (
              <div className="flex items-center gap-3 px-2.5 py-2.5">
                <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold text-white", current.avatarColor)}>
                  {current.initials}
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[14px] font-semibold leading-tight text-zinc-950">
                    {current.name}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5">
                    <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", vitrine.dot)} />
                    <span className="truncate text-[12px] text-zinc-500">{subtitle}</span>
                  </div>
                </div>
              </div>
            );
          })()}

          <div className="my-1 border-t border-border" />

          {/* ── Quick actions ── */}
          <MenuItem
            icon={Store}
            label="Открыть витрину"
            external
            onClick={() => { window.open(`https://${STOREFRONT_URL}`, "_blank"); close(); }}
          />
          <MenuItem
            icon={MonitorSmartphone}
            label="Открыть табло"
            external
            onClick={() => { window.open(`https://${STOREFRONT_URL}/board`, "_blank"); close(); }}
          />
          <MenuItem
            icon={LayoutDashboard}
            label="Управление витриной"
            onClick={() => { onNavigate("storefront", "launch"); close(); }}
          />

          <div className="my-1.5 border-t border-border" />

          {/* ── Vitrine switcher ── */}
          <div className="px-2.5 pb-1 pt-0.5">
            <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
              Витрины
            </div>
          </div>
          <div className="max-h-[220px] overflow-y-auto">
            {MOCK_VITRINES.map((v) => {
              const isSelected = v.id === selectedVitrineId;
              const subtitle = [v.address, v.url].filter(Boolean).join(" · ");
              return (
                <button
                  key={v.id}
                  type="button"
                  onClick={() => { setSelectedVitrineId(v.id); close(); }}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left transition",
                    isSelected ? "bg-zinc-50" : "hover:bg-zinc-50",
                  )}
                >
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold text-white", v.avatarColor)}>
                    {v.initials}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={cn("truncate text-[13px] leading-snug", isSelected ? "font-semibold text-zinc-950" : "font-medium text-zinc-700")}>
                      {v.name}
                    </div>
                    <div className="truncate text-[11px] text-zinc-400">{subtitle}</div>
                  </div>
                  {isSelected && (
                    <Check size={14} className="shrink-0 text-zinc-500" strokeWidth={2.5} />
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => { close(); }}
            className="flex w-full items-center gap-2 rounded-xl px-2.5 py-2 text-left text-[13px] font-medium text-zinc-400 transition hover:bg-zinc-50 hover:text-zinc-700"
          >
            <Plus size={14} className="shrink-0" />
            Добавить витрину
          </button>

          <div className="my-1.5 border-t border-border" />

          {/* Prototype tools */}
          <button
            type="button"
            onClick={() => setDemoOpen((v) => !v)}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
          >
            <FlaskConical size={17} className="shrink-0 text-zinc-300" />
            <span className="flex-1">Prototype tools</span>
            <ChevronDown
              size={13}
              className={cn("shrink-0 text-zinc-300 transition", demoOpen && "rotate-180")}
            />
          </button>
          {demoOpen && (
            <div className="mx-1 mb-1 rounded-xl border border-border bg-zinc-50 px-3 py-2.5 space-y-3">

              {/* ── A. Статус витрины ── */}
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  Статус витрины
                </div>
                <div className="flex gap-1">
                  {([
                    ["pending", "Ожидает проверки"],
                    ["active",  "Витрина активна"],
                  ] as [LaunchStage, string][]).map(([s, label]) => {
                    const isActive = s === "active" ? stage === "active" : stage !== "active";
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => forceStage(s)}
                        className={cn(
                          "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                          isActive
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* ── B. Неопубликованные изменения (только когда активна) ── */}
              {stage === "active" && (
                <div>
                  <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                    Неопубликованные изменения
                  </div>
                  <button
                    type="button"
                    onClick={() => injectDemoChanges()}
                    className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 transition hover:bg-zinc-50"
                  >
                    <span className="whitespace-nowrap">Добавить изменения</span>
                    <span
                      className={cn(
                        "relative h-4 w-7 shrink-0 rounded-full transition",
                        totalChanges > 0 ? "bg-blue-600" : "bg-zinc-300",
                      )}
                    >
                      <span
                        className={cn(
                          "absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all",
                          totalChanges > 0 ? "left-3.5" : "left-0.5",
                        )}
                      />
                    </span>
                  </button>
                </div>
              )}

              {/* ── Подписка ── */}
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  Подписка
                </div>
                <div className="flex gap-1">
                  {([
                    [18, "Активна"],
                    [5,  "Истекает"],
                    [0,  "Истекла"],
                  ] as [number, string][]).map(([d, label]) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDaysLeftDemo(d)}
                      className={cn(
                        "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                        daysLeft === d
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Тариф ── */}
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  Тариф
                </div>
                <div className="flex gap-1">
                  {(["Zero", "Lite", "Ultra"] as PlanId[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPlanId(p)}
                      className={cn(
                        "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                        planId === p
                          ? "border-blue-500 bg-blue-50 text-blue-700"
                          : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                      )}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Превью (демо) ── */}
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  Превью
                </div>
                <button
                  type="button"
                  onClick={() => setEmptyVitrine(!emptyVitrine)}
                  className="flex w-full items-center justify-between rounded-lg border border-border bg-white px-2.5 py-1.5 text-[11px] font-semibold text-zinc-600 transition hover:bg-zinc-50"
                >
                  <span className="whitespace-nowrap">Витрина пустая (демо)</span>
                  <span className={cn("relative h-4 w-7 shrink-0 rounded-full transition", emptyVitrine ? "bg-blue-600" : "bg-zinc-300")}>
                    <span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", emptyVitrine ? "left-3.5" : "left-0.5")} />
                  </span>
                </button>
              </div>

              {/* ── Статус витрины (демо) ── */}
              <div>
                <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-zinc-400">
                  Статус витрины
                </div>
                <div className="flex gap-1">
                  {([
                    ["review", "На проверке"],
                    ["published", "Опубликовано"],
                    ["changes", "Есть изменения"],
                  ] as ["review" | "published" | "changes", string][]).map(([v, label]) => {
                    const active =
                      v === "review" ? stage === "pending" :
                      v === "published" ? stage === "active" && totalChanges === 0 :
                      stage === "active" && totalChanges > 0;
                    return (
                      <button
                        key={v}
                        type="button"
                        onClick={() => {
                          if (v === "review") { forceStage("pending"); }
                          else if (v === "published") { forceStage("active"); clearChanges(); }
                          else { forceStage("active"); injectDemoChanges(); }
                        }}
                        className={cn(
                          "flex-1 whitespace-nowrap rounded-lg border py-1 text-[11px] font-semibold transition",
                          active
                            ? "border-blue-500 bg-blue-50 text-blue-700"
                            : "border-border bg-white text-zinc-600 hover:bg-zinc-50",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
