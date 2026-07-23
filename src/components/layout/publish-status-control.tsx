import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AlertCircle, Check, ChevronDown, Loader2 } from "lucide-react";
import { usePublish } from "@/contexts/publish-context";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import type { SectionId } from "@/data/mock-data";
import { cn } from "@/lib/utils";

type State = "review" | "changes" | "published" | "unpublished";

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

export function PublishStatusControl({
  onNavigate,
}: {
  onNavigate: (section: SectionId, tab: string) => void;
}) {
  const { totalChanges, changeList, startPublish, publishPhase, lastPublishedAt } = usePublish();
  const { stage } = useVitrineLaunch();
  const { account, getPublishRequirements, markSentForReview } = useMockAuth();
  const [open, setOpen] = useState(false);
  const [showRequirements, setShowRequirements] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);
  const wasPublishing = useRef(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (btnRef.current?.contains(e.target as Node)) return;
      if (document.getElementById("publish-status-popup")?.contains(e.target as Node)) return;
      setOpen(false);
      setShowRequirements(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        setShowRequirements(false);
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (publishPhase === "publishing") {
      wasPublishing.current = true;
    } else if (wasPublishing.current) {
      wasPublishing.current = false;
      setOpen(false);
    }
  }, [publishPhase]);

  const workspace = account?.workspace;
  if (!workspace && stage !== "pending" && stage !== "active") return null;

  const state: State =
    workspace?.status === "unpublished" ? "unpublished" :
    workspace?.status === "review" || stage === "pending" ? "review" :
    totalChanges > 0 ? "changes" : "published";

  const missingRequirements = getPublishRequirements(totalChanges > 0 || state !== "unpublished");
  const isPublishing = publishPhase === "publishing";

  const toggle = () => {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 8, right: Math.max(8, window.innerWidth - r.right) });
    }
    if (open) setShowRequirements(false);
    setOpen((v) => !v);
  };

  const cfg = {
    review: { dot: "bg-amber-500", text: "text-amber-700", chevron: "text-amber-900", hover: "hover:bg-amber-50", openBg: "bg-amber-100" },
    unpublished: { dot: "bg-zinc-400", text: "text-zinc-700", chevron: "text-zinc-800", hover: "hover:bg-zinc-100", openBg: "bg-zinc-100" },
    changes: { dot: "bg-amber-500", text: "text-amber-700", chevron: "text-amber-900", hover: "hover:bg-amber-50", openBg: "bg-amber-100" },
    published: { dot: "bg-emerald-500", text: "text-emerald-700", chevron: "text-emerald-900", hover: "hover:bg-emerald-50", openBg: "bg-emerald-100" },
  }[state];

  const short = {
    review: "На проверке",
    unpublished: "Не опубликовано",
    changes: "Есть изменения",
    published: "Всё опубликовано",
  }[state];
  const full =
    state === "unpublished" ? <>Не опубликовано · <span className="font-medium">Опубликовать</span></> :
    state === "review" ? "На проверке · Что дальше?" :
    state === "changes" ? <>Есть изменения · <span className="font-medium">Опубликовать</span></> :
    "Все изменения опубликованы";

  const handlePublish = () => {
    if (missingRequirements.length > 0) {
      setShowRequirements(true);
      return;
    }
    if (state === "unpublished") {
      markSentForReview();
      setShowRequirements(false);
      return;
    }
    startPublish();
  };

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
          className="fixed z-[200] w-[320px] rounded-2xl border border-border bg-white p-3.5 shadow-xl shadow-zinc-300/40"
        >
          {(state === "unpublished" || state === "changes") && (
            <>
              <div className="text-[14px] font-bold text-zinc-950">
                {state === "unpublished" ? "Меню пока не опубликовано" : "Изменения не опубликованы"}
              </div>
              <p className="mt-1 text-[12px] leading-[1.5] text-zinc-500">
                Приватный предпросмотр доступен сразу. Публичная публикация включится отдельным действием.
              </p>

              {state === "changes" && changeList.length > 0 && (
                <ul className="mt-3 space-y-1.5">
                  {changeList.map((c) => (
                    <li key={c.page} className="flex items-center gap-2 text-[13px] text-zinc-700">
                      <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-amber-400" />
                      <span className="truncate">{c.label}</span>
                    </li>
                  ))}
                </ul>
              )}

              {showRequirements && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-2.5">
                  <div className="flex items-center gap-1.5 text-[12px] font-bold text-amber-800">
                    <AlertCircle size={14} />
                    Заполните перед публикацией
                  </div>
                  <div className="mt-2 space-y-1">
                    {missingRequirements.map((item) => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setOpen(false);
                          setShowRequirements(false);
                          onNavigate(item.section, item.tab);
                        }}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left text-[12px] font-medium text-amber-900 transition hover:bg-amber-100"
                      >
                        <span>{item.label}</span>
                        <span className="text-amber-700">Перейти</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
                className="mt-4 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-[14px] font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-400"
              >
                {isPublishing ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    Публикуем...
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
              <div className="text-[14px] font-bold text-zinc-950">Меню отправлено на проверку</div>
              <p className="mt-1 text-[12px] leading-[1.55] text-zinc-500">
                Пока идёт проверка, вы можете продолжать редактирование и пользоваться предпросмотром.
              </p>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
