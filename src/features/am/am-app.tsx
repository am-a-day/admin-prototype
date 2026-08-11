import { useEffect, useMemo, useState } from "react";
import { AlertTriangle, Clock3, ExternalLink, History, LogOut, Search, ShieldCheck, X } from "lucide-react";
import { useMockAuth, type MockAccount, type StorefrontReviewStatus } from "@/contexts/mock-auth-context";
import { getPublicMenuHref } from "@/lib/public-menu-url";
import { cn } from "@/lib/utils";

const AM_ACCOUNT = "Айгерим · AM";

const REVIEW_LABELS: Record<StorefrontReviewStatus, string> = {
  unpublished: "Не опубликована",
  pending: "Ожидает проверки",
  verified: "Проверена",
  "disabled-manual": "Отключена менеджером",
  "disabled-timeout": "Отключена: проверка не завершена",
};

function formatDate(timestamp: number) {
  return new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" }).format(timestamp);
}

function formatRemaining(deadlineAt: number | null) {
  if (!deadlineAt) return null;
  const remaining = Math.max(0, deadlineAt - Date.now());
  const hours = Math.floor(remaining / 3_600_000);
  const minutes = Math.floor((remaining % 3_600_000) / 60_000);
  return `${hours} ч ${minutes} мин`;
}

function statusTone(status: StorefrontReviewStatus) {
  if (status === "verified") return "bg-emerald-50 text-emerald-700";
  if (status === "pending") return "bg-amber-50 text-amber-700";
  if (status.startsWith("disabled")) return "bg-red-50 text-red-700";
  return "bg-zinc-100 text-zinc-600";
}

function ReviewCard({ account }: { account: MockAccount }) {
  const { confirmStorefrontReview, disableStorefrontReview, expireStorefrontReview } = useMockAuth();
  const [reasonOpen, setReasonOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [feedback, setFeedback] = useState("");
  const [, setTick] = useState(0);
  const review = account.workspace.review;
  const remaining = formatRemaining(review.deadlineAt);
  const publicHref = getPublicMenuHref(account);

  useEffect(() => {
    if (review.status !== "pending") return;
    const timer = window.setInterval(() => setTick((value) => value + 1), 60_000);
    return () => window.clearInterval(timer);
  }, [review.status]);

  const confirm = () => {
    confirmStorefrontReview(account.id);
    setFeedback("Витрина подтверждена и продолжает работать");
    window.setTimeout(() => setFeedback(""), 2600);
  };

  const disable = () => {
    if (!reason.trim()) return;
    disableStorefrontReview(account.id, reason);
    setReason("");
    setReasonOpen(false);
    setFeedback("Витрина отключена, причина сохранена");
    window.setTimeout(() => setFeedback(""), 2600);
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
      <div className="p-5">
        <div className="flex flex-wrap items-start gap-3">
          <div className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-100 text-sm font-black text-violet-700">
            {account.workspace.name.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-[17px] font-bold text-zinc-950">{account.workspace.name}</h2>
            <a href={publicHref} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-1 text-[12px] text-blue-600 hover:text-blue-700">
              {account.workspace.webAddress} <ExternalLink size={11} />
            </a>
          </div>
          <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", statusTone(review.status))}>
            {REVIEW_LABELS[review.status]}
          </span>
        </div>

        {review.status === "pending" && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-amber-50 px-3 py-2.5 text-[13px] text-amber-800">
            <Clock3 size={15} />
            <span className="flex-1">До автоматического отключения</span>
            <strong className="tabular-nums">{remaining}</strong>
          </div>
        )}

        {(review.status === "disabled-manual" || review.status === "disabled-timeout") && (
          <div className="mt-4 rounded-xl bg-red-50 px-3 py-2.5 text-[13px] leading-5 text-red-800">
            <div className="flex items-center gap-1.5 font-semibold"><AlertTriangle size={14} /> Причина отключения</div>
            <div className="mt-1">{review.disabledReason}</div>
          </div>
        )}

        {feedback && <div role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-[12px] font-medium text-emerald-700">{feedback}</div>}

        {(review.status === "pending" || review.status === "disabled-manual" || review.status === "disabled-timeout") && (
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={confirm} className="inline-flex h-9 items-center gap-1.5 rounded-[10px] bg-violet-600 px-3.5 text-[13px] font-semibold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/30">
              <ShieldCheck size={15} /> Подтвердить
            </button>
            {review.status === "pending" && (
              <button type="button" onClick={() => setReasonOpen(true)} className="inline-flex h-9 items-center rounded-[10px] border border-zinc-200 px-3.5 text-[13px] font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400/20">
                Отключить
              </button>
            )}
            {review.status === "pending" && (
              <button type="button" onClick={() => expireStorefrontReview(account.id)} className="ml-auto h-9 px-2 text-[11px] text-zinc-400 hover:text-zinc-700" title="Прототип: проверить состояние после истечения срока">
                Истечь 48 ч
              </button>
            )}
          </div>
        )}

        {reasonOpen && (
          <div className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-3" role="dialog" aria-label="Причина отключения">
            <div className="flex items-center justify-between">
              <label htmlFor="disable-reason" className="text-[12px] font-semibold text-zinc-800">Причина отключения</label>
              <button type="button" onClick={() => setReasonOpen(false)} aria-label="Закрыть"><X size={14} /></button>
            </div>
            <textarea id="disable-reason" autoFocus value={reason} onChange={(event) => setReason(event.target.value)} placeholder="Что нужно исправить владельцу" className="mt-2 min-h-20 w-full resize-none rounded-[9px] border border-zinc-200 bg-white p-2.5 text-[13px] outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
            <div className="mt-2 flex justify-end gap-2">
              <button type="button" onClick={() => setReasonOpen(false)} className="h-8 px-3 text-[12px] text-zinc-600">Отмена</button>
              <button type="button" onClick={disable} disabled={!reason.trim()} className="h-8 rounded-[8px] bg-red-600 px-3 text-[12px] font-semibold text-white disabled:bg-zinc-300">Отключить</button>
            </div>
          </div>
        )}
      </div>

      {review.history.length > 0 && (
        <div className="border-t border-zinc-100 bg-zinc-50/60 px-5 py-4">
          <div className="mb-2 flex items-center gap-1.5 text-[12px] font-semibold text-zinc-700"><History size={13} /> История</div>
          <div className="space-y-2">
            {[...review.history].reverse().map((entry) => (
              <div key={entry.id} className="flex gap-3 text-[11px] leading-4 text-zinc-500">
                <span className="w-[112px] shrink-0 tabular-nums">{formatDate(entry.at)}</span>
                <span><strong className="font-medium text-zinc-700">{entry.actor}</strong> · {entry.reason || entry.details || (entry.type === "verified" ? "Витрина подтверждена" : "Статус изменён")}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}

export function AMApp({ onExit }: { onExit: () => void }) {
  const { account } = useMockAuth();
  const [query, setQuery] = useState("");
  const visible = useMemo(() => !query.trim() || account?.workspace.name.toLowerCase().includes(query.trim().toLowerCase()), [account, query]);

  return (
    <div className="flex h-screen flex-col bg-zinc-50 text-zinc-950">
      <header className="flex h-14 shrink-0 items-center justify-between border-b border-zinc-200 bg-white px-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-violet-600 text-sm font-black text-white">T</div>
          <div className="flex items-center gap-2"><span className="font-black tracking-tight">TASKO</span><span className="rounded-md bg-violet-100 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-violet-700">Account Manager</span></div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden text-sm text-zinc-500 sm:block">{AM_ACCOUNT}</div>
          <button type="button" onClick={onExit} className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"><LogOut size={16} /> К витрине</button>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-6 py-8">
        <div className="mx-auto max-w-4xl">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Проверка витрин</h1>
            <p className="mt-2 text-sm text-zinc-500">Опубликованные витрины доступны гостям сразу и должны быть проверены в течение 48 часов.</p>
          </div>
          <div className="relative mt-6 max-w-md">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Поиск по названию витрины…" className="h-11 w-full rounded-xl border border-zinc-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          </div>
          <div className="mt-6 space-y-4">
            {account && visible && <ReviewCard account={account} />}
            {!visible && <div className="rounded-2xl border border-dashed border-zinc-300 bg-white py-16 text-center text-sm text-zinc-500">Ничего не найдено по запросу «{query}»</div>}
          </div>
        </div>
      </main>
    </div>
  );
}
