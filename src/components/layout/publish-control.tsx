import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, UploadCloud } from "lucide-react";
import { usePublish } from "@/contexts/publish-context";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { useLayoutMode } from "@/contexts/layout-mode-context";
import { cn } from "@/lib/utils";

function lastChangeLabel(ts: number, now: number): string {
  const diffSec = Math.floor((now - ts) / 1000);
  if (diffSec < 10) return "только что";
  if (diffSec < 60) return "меньше минуты назад";
  const min = Math.floor(diffSec / 60);
  if (min === 1) return "минуту назад";
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  return hours === 1 ? "час назад" : `${hours} ч назад`;
}

/**
 * Publish control — lives in the organization block (sidebar), active only.
 * Before vitrine activation there is no "publish" — launch handles that.
 */
export function PublishControl() {
  const { status, totalChanges, changeList, lastChangeAt, publish } = usePublish();
  const { stage } = useVitrineLaunch();
  const { changeModel } = useLayoutMode();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const isDraft = status === "draft";
  const isPublishing = status === "publishing";
  const isSaving = status === "saving";
  const hasChanges = totalChanges > 0;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      if (document.getElementById("publish-popup")?.contains(target)) return;
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

  useEffect(() => {
    if (!open) return;
    setNow(Date.now());
    const id = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(id);
  }, [open]);

  // Publish exists only after the vitrine is activated by the manager.
  if (stage !== "active") return null;
  // Save + Live Preview model has no global publish control.
  if (changeModel === "save-live") return null;

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen((v) => !v);
  };

  const handlePublish = () => {
    publish();
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        className={cn(
          "flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left transition",
          isDraft
            ? "bg-amber-50 hover:bg-amber-100"
            : "hover:bg-zinc-100",
          open && (isDraft ? "bg-amber-100" : "bg-zinc-100"),
        )}
      >
        <span className="flex items-center gap-1.5 text-[12px] font-semibold">
          {isPublishing || isSaving ? (
            <Loader2 size={11} className="animate-spin text-blue-600" />
          ) : isDraft ? (
            <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
          ) : (
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
          )}
          <span className={isDraft ? "text-amber-800" : "text-zinc-500"}>
            {isPublishing
              ? "Публикация…"
              : isSaving
                ? "Сохранение…"
                : isDraft
                  ? totalChanges === 1
                    ? "1 изменение"
                    : totalChanges < 5
                      ? `${totalChanges} изменения`
                      : `${totalChanges} изменений`
                  : "Опубликовано"}
          </span>
        </span>
        {isDraft && !isPublishing && (
          <span className="shrink-0 rounded-md bg-blue-600 px-2 py-0.5 text-[11px] font-bold text-white">
            Опубликовать
          </span>
        )}
      </button>

      {open && createPortal(
        <div
          id="publish-popup"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[200] w-[300px] rounded-2xl border border-border bg-white p-4 shadow-xl shadow-zinc-300/40"
        >
          {!hasChanges && !isPublishing ? (
            <div className="flex items-start gap-3">
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                <Check size={15} strokeWidth={3} />
              </span>
              <div>
                <div className="font-bold text-zinc-950">Витрина опубликована</div>
                <p className="mt-0.5 text-xs leading-5 text-muted-foreground">
                  Все изменения видны гостям. Новые правки появятся здесь.
                </p>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2">
                {isPublishing ? (
                  <Loader2 size={13} className="animate-spin text-blue-600" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                )}
                <div className="font-bold text-zinc-950">
                  {isPublishing ? "Публикация…" : "Неопубликованные изменения"}
                </div>
              </div>

              {lastChangeAt != null && (
                <div className="mt-1 text-xs text-muted-foreground">
                  Последнее изменение: {lastChangeLabel(lastChangeAt, now)}
                </div>
              )}

              <div className="mt-3 space-y-1">
                {changeList.map((entry) => (
                  <div
                    key={entry.page}
                    className="flex items-center justify-between rounded-lg px-1 py-1.5 text-sm"
                  >
                    <span className="text-zinc-700">{entry.label}</span>
                    <span className="text-xs font-semibold text-zinc-500">{entry.count} изм.</span>
                  </div>
                ))}
              </div>

              <div className="my-3 border-t border-border" />

              <button
                type="button"
                onClick={handlePublish}
                disabled={isPublishing}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition",
                  isPublishing ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700",
                )}
              >
                {isPublishing ? (
                  <><Loader2 size={15} className="animate-spin" />Публикуем…</>
                ) : (
                  <><UploadCloud size={15} />Опубликовать изменения</>
                )}
              </button>
            </>
          )}
        </div>,
        document.body,
      )}
    </>
  );
}
