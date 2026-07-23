import { useEffect, useState } from "react";
import { AlertTriangle, Check, Copy, ExternalLink, RotateCcw, X } from "lucide-react";
import { usePublish } from "@/contexts/publish-context";
import { useMockAuth } from "@/contexts/mock-auth-context";

/**
 * Toast результата публикации витрины (Publish model).
 * Успех — «Витрина обновлена» + «Открыть витрину»; ошибка — «Повторить».
 */
export function PublishToast() {
  const { publishResult, dismissPublishResult, startPublish } = usePublish();
  const { account } = useMockAuth();
  const [copied, setCopied] = useState(false);

  // Успех автоматически скрываем; ошибку оставляем до действия пользователя.
  useEffect(() => {
    if (publishResult !== "success") return;
    const t = window.setTimeout(() => dismissPublishResult(), 6000);
    return () => window.clearTimeout(t);
  }, [publishResult, dismissPublishResult]);

  if (!publishResult) return null;

  const storeHref = account
    ? `${window.location.origin}${window.location.pathname}?publicMenu=${encodeURIComponent(account.id)}`
    : "#";

  const copyLink = async () => {
    await navigator.clipboard.writeText(storeHref);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2">
      <div className="pointer-events-auto flex items-start gap-3 rounded-2xl border border-border bg-white px-4 py-3 shadow-xl shadow-zinc-300/40">
        {publishResult === "success" ? (
          <>
            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
              <Check size={12} strokeWidth={3} />
            </span>
            <div className="min-w-0">
              <div className="text-[13px] font-bold text-zinc-900">Меню опубликовано</div>
              <p className="mt-0.5 max-w-[260px] text-[12px] leading-4 text-zinc-500">
                Теперь его можно открыть по ссылке или показать гостям через QR-код.
              </p>
            </div>
            <a
              href={storeHref}
              target="_blank"
              rel="noreferrer"
              className="ml-1 flex shrink-0 items-center gap-1.5 rounded-lg bg-zinc-900 px-3 py-1.5 text-[12px] font-bold text-white transition hover:bg-zinc-700"
            >
              <ExternalLink size={12} />
              Открыть меню
            </a>
            <button
              type="button"
              onClick={copyLink}
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-zinc-200 text-zinc-500 transition hover:bg-zinc-50"
              title="Скопировать ссылку"
            >
              {copied ? <Check size={13} /> : <Copy size={13} />}
            </button>
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
