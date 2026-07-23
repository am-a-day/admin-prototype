import { useEffect } from "react";
import { AlertTriangle, Check, RotateCcw, X } from "lucide-react";
import { usePublish } from "@/contexts/publish-context";

/**
 * Toast результата публикации витрины (Publish model).
 * Повторное обновление — компактное подтверждение; ошибка — действие «Повторить».
 */
export function PublishToast() {
  const { publishResult, dismissPublishResult, startPublish } = usePublish();

  // Повторное обновление автоматически скрываем; ошибку оставляем до действия пользователя.
  useEffect(() => {
    if (publishResult !== "update") return;
    const t = window.setTimeout(() => dismissPublishResult(), 3500);
    return () => window.clearTimeout(t);
  }, [publishResult, dismissPublishResult]);

  if (!publishResult || publishResult === "first-publish") return null;

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-xl shadow-zinc-300/40">
        {publishResult === "update" ? (
          <>
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check size={12} strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-zinc-900">Меню обновлено</div>
              <p className="mt-0.5 text-[12px] leading-4 text-zinc-500">Изменения уже видны гостям.</p>
            </div>
          </>
        ) : (
          <>
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-orange-100 text-orange-600">
              <AlertTriangle size={12} strokeWidth={2.5} />
            </span>
            <div className="min-w-0 max-w-[260px]">
              <div className="text-[13px] font-bold text-zinc-900">Не удалось обновить витрину</div>
              <p className="mt-0.5 text-[12px] leading-4 text-zinc-500">
                Изменения сохранены, но гости пока видят предыдущую версию.
              </p>
            </div>
            <button
              type="button"
              onClick={() => startPublish()}
              className="ml-1 flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-zinc-700"
            >
              <RotateCcw size={12} />
              Повторить
            </button>
            <button
              type="button"
              onClick={dismissPublishResult}
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
            >
              <X size={13} />
            </button>
          </>
        )}
      </div>
    </div>
  );
}
