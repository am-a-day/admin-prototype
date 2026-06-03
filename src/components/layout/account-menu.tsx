import { useEffect, useRef, useState, type ComponentType } from "react";
import { createPortal } from "react-dom";
import {
  ArrowUpRight,
  ChevronDown,
  FlaskConical,
  MonitorSmartphone,
  Store,
} from "lucide-react";
import { RESTAURANT_NAME, STOREFRONT_URL, type PlanId, type SectionId } from "@/data/mock-data";
import { usePlan } from "@/contexts/plan-context";
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

/** Organisation / vitrine context menu — top of sidebar */
export function OrgMenu({
  onNavigate: _onNavigate,
}: {
  onNavigate: (section: SectionId, tab: string) => void;
}) {
  const { planId, setPlanId } = usePlan();
  const [open, setOpen] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
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
      setPopupPos({ top: rect.top, left: rect.right + 8 });
    }
    setOpen((v) => !v);
  };

  const close = () => setOpen(false);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-sm font-black text-white transition hover:opacity-90",
          open && "ring-2 ring-blue-500/30 ring-offset-2",
        )}
        aria-expanded={open}
        aria-haspopup="dialog"
        title={RESTAURANT_NAME}
      >
        T
      </button>

      {open && createPortal(
        <div
          id="org-menu-popup"
          style={{ top: popupPos.top, left: popupPos.left }}
          className="fixed z-[200] w-68 rounded-2xl border border-border bg-white p-2 shadow-xl shadow-zinc-300/40"
        >
          {/* Org header */}
          <div className="flex items-center gap-3 px-2.5 py-2">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-zinc-950 text-sm font-black text-white">
              T
            </div>
            <div className="min-w-0">
              <div className="truncate font-bold leading-tight text-zinc-950">
                {RESTAURANT_NAME}
              </div>
              <div className="mt-0.5 text-xs text-muted-foreground">
                Тариф · {planId}
              </div>
            </div>
          </div>

          <div className="my-1.5 border-t border-border" />

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
                        "flex-1 rounded-lg border py-1 text-xs font-semibold transition",
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
            </div>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
