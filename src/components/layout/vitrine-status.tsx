import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Loader2, UploadCloud } from "lucide-react";
import { usePublish } from "@/contexts/publish-context";
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

export function VitrineStatus({ compact = true }: { compact?: boolean }) {
  const { status, totalChanges, changeList, lastChangeAt, publish, saveMode, setSaveMode } =
    usePublish();
  const [open, setOpen] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [popupPos, setPopupPos] = useState({ bottom: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current && btnRef.current.contains(target)) return;
      const popup = document.getElementById("vitrine-status-popup");
      if (popup && popup.contains(target)) return;
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

  const isDraft = status === "draft";
  const isSaving = status === "saving";
  const isPublishing = status === "publishing";
  const hasChanges = totalChanges > 0;

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopupPos({ bottom: window.innerHeight - rect.bottom, left: rect.right + 8 });
    }
    setOpen((v) => !v);
  };

  const dotColor = isPublishing || isSaving ? "bg-blue-500" : isDraft ? "bg-amber-500" : "bg-emerald-500";

  const label = isPublishing
    ? "Публикация…"
    : isSaving
      ? "Сохранение…"
      : isDraft
        ? "Не опубликовано"
        : "Опубликовано";

  return (
    <>
      {compact ? (
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            "flex h-9 w-9 flex-col items-center justify-center gap-0.5 rounded-xl transition hover:bg-zinc-100",
            open && "bg-zinc-100",
          )}
          title={label}
        >
          {isPublishing || isSaving ? (
            <Loader2 size={15} className="animate-spin text-blue-600" />
          ) : isDraft ? (
            <>
              <span className="h-2 w-2 rounded-full bg-amber-500" />
              <span className="text-[9px] font-black leading-none text-amber-600">{totalChanges}</span>
            </>
          ) : (
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
          )}
        </button>
      ) : (
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-100",
            open && "bg-zinc-100",
          )}
          title={label}
        >
          {isPublishing || isSaving ? (
            <Loader2 size={12} className="shrink-0 animate-spin text-blue-500" />
          ) : (
            <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", dotColor)} />
          )}
          <span className="text-xs font-medium text-zinc-600">{label}</span>
          {isDraft && totalChanges > 0 && (
            <span className="ml-auto text-[11px] font-medium text-zinc-400">{totalChanges}</span>
          )}
        </button>
      )}

      {open && createPortal(
        <div
          id="vitrine-status-popup"
          style={{ bottom: popupPos.bottom, left: popupPos.left }}
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
                {isSaving ? (
                  <Loader2 size={13} className="animate-spin text-blue-600" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-amber-500" />
                )}
                <div className="font-bold text-zinc-950">
                  {isSaving ? "Сохранение…" : "Неопубликованные изменения"}
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
                    <span className="text-xs font-semibold text-zinc-500">
                      {entry.count}{" "}
                      {entry.count === 1 ? "изменение" : entry.count < 5 ? "изменения" : "изменений"}
                    </span>
                  </div>
                ))}
              </div>

              <div className="my-3 border-t border-border" />

              <div className="mb-3 flex items-center justify-between px-1 text-sm">
                <span className="text-muted-foreground">Всего</span>
                <span className="font-bold text-zinc-950">
                  {totalChanges}{" "}
                  {totalChanges === 1 ? "изменение" : totalChanges < 5 ? "изменения" : "изменений"}
                </span>
              </div>

              <button
                type="button"
                onClick={publish}
                disabled={isPublishing}
                className={cn(
                  "flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold text-white transition",
                  isPublishing ? "bg-blue-400" : "bg-blue-600 hover:bg-blue-700",
                )}
              >
                {isPublishing ? (
                  <><Loader2 size={15} className="animate-spin" />Публикуем изменения…</>
                ) : (
                  <><UploadCloud size={15} />Опубликовать изменения</>
                )}
              </button>
            </>
          )}

          <div className="mt-4 border-t border-border pt-3">
            <div className="mb-2 px-1 text-[10px] font-black uppercase tracking-wide text-zinc-400">
              UX Feedback Mode
            </div>
            <div className="flex gap-1 rounded-xl bg-zinc-100 p-1">
              {([{ mode: "toast", label: "Toast" }, { mode: "rail", label: "Rail Status" }] as const).map((opt) => (
                <button
                  key={opt.mode}
                  type="button"
                  onClick={() => setSaveMode(opt.mode)}
                  className={cn(
                    "flex-1 rounded-lg px-2 py-1.5 text-xs font-bold transition",
                    saveMode === opt.mode ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-950",
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
