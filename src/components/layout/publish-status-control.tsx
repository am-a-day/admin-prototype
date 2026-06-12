import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { usePublish } from "@/contexts/publish-context";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { cn } from "@/lib/utils";

type State = "review" | "changes" | "published";

function formatLastPublished(ts: number | null): string {
  if (!ts) return "—";
  const d = new Date(ts);
  const now = new Date();
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const sameDay =
    d.getDate() === now.getDate() &&
    d.getMonth() === now.getMonth() &&
    d.getFullYear() === now.getFullYear();
  return sameDay ? `сегодня в ${hh}:${mm}` : `${d.getDate()}.${String(d.getMonth() + 1).padStart(2, "0")} в ${hh}:${mm}`;
}

export function PublishStatusControl() {
  const { totalChanges, changeList, startPublish, publishPhase, lastPublishedAt } = usePublish();
  const { stage } = useVitrineLaunch();

  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const wasPublishing = useRef(false);

  // Закрытие по клику вне / Escape
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (document.getElementById("publish-status-popup")?.contains(e.target as Node)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Закрыть popover, когда публикация завершилась
  useEffect(() => {
    if (publishPhase === "publishing") {
      wasPublishing.current = true;
    } else if (wasPublishing.current) {
      wasPublishing.current = false;
      setOpen(false);
    }
  }, [publishPhase]);

  // Контрол виден только после отправки на проверку (на проверке/активна).
  if (stage !== "pending" && stage !== "active") return null;
  const state: State = stage === "pending" ? "review" : totalChanges > 0 ? "changes" : "published";

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    }
    setOpen((v) => !v);
  };

  const isPublishing = publishPhase === "publishing";

  // ── Chip (status trigger) ──
  const cfg = {
    review:    { dot: "bg-amber-500",   text: "text-amber-700",   chevron: "text-amber-900",   hover: "hover:bg-amber-50",   openBg: "bg-amber-100" },
    changes:   { dot: "bg-amber-500",   text: "text-amber-700",   chevron: "text-amber-900",   hover: "hover:bg-amber-50",   openBg: "bg-amber-100" },
    published: { dot: "bg-emerald-500", text: "text-emerald-700", chevron: "text-emerald-900", hover: "hover:bg-emerald-50", openBg: "bg-emerald-100" },
  }[state];

  const short = { review: "На проверке", changes: "Есть изменения", published: "Всё опубликовано" }[state];
  const full =
    state === "review" ? "На проверке · Что дальше?" :
    state === "changes" ? <>Есть изменения · <span className="font-medium">Опубликовать</span></> :
    "Все изменения опубликованы";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-haspopup="dialog"
        className={cn(
          "flex h-9 shrink-0 cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 text-[14px] transition",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500/40 focus-visible:ring-offset-1",
          cfg.text,
          open ? cfg.openBg : cfg.hover,
        )}
      >
        <span className={cn("h-2 w-2 shrink-0 rounded-full", cfg.dot)} />
        <span>
          <span className="hidden sm:inline">{full}</span>
          <span className="sm:hidden">{short}</span>
        </span>
        <ChevronDown size={13} className={cn("shrink-0 transition", cfg.chevron, open && "rotate-180")} />
      </button>

      {open && createPortal(
        <div
          id="publish-status-popup"
          role="dialog"
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-[200] w-[300px] rounded-2xl border border-border bg-white p-3.5 shadow-xl shadow-zinc-300/40"
        >
          {state === "changes" && (
            <>
              <div className="text-[14px] font-bold text-zinc-950">Изменения не опубликованы</div>
              <p className="mt-1 text-[12px] leading-[1.5] text-zinc-500">
                После публикации обновления увидят гости.
              </p>
              {changeList.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {changeList.map((c) => (
                    <li key={c.page} className="flex items-center gap-2 text-[13px] text-zinc-700">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span className="truncate">{c.label}</span>
                    </li>
                  ))}
                </ul>
              )}
              <button
                type="button"
                onClick={() => startPublish()}
                disabled={isPublishing}
                className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isPublishing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Публикуем…
                  </>
                ) : (
                  "Опубликовать"
                )}
              </button>
            </>
          )}

          {state === "published" && (
            <>
              <div className="text-[14px] font-bold text-zinc-950">Все изменения опубликованы</div>
              <p className="mt-1 text-[12px] leading-[1.5] text-zinc-500">
                Гости видят актуальную версию витрины.
              </p>
              <div className="mt-3 flex items-center gap-1.5 text-[12px] text-zinc-400">
                <Check size={13} className="shrink-0 text-emerald-600" strokeWidth={2.5} />
                Последняя публикация: {formatLastPublished(lastPublishedAt)}
              </div>
            </>
          )}

          {state === "review" && (
            <>
              <div className="text-[14px] font-bold text-zinc-950">Витрина на проверке</div>
              <p className="mt-1 text-[12px] leading-[1.55] text-zinc-500">
                Менеджер проверит данные и активирует публичную ссылку. После этого вы сможете передать ссылку гостям и использовать её в QR-кодах.
              </p>
              <p className="mt-2 text-[12px] leading-[1.55] text-zinc-500">
                Пока можно продолжать заполнять меню и настраивать оформление.
              </p>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
