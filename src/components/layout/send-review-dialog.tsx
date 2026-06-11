import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

/**
 * Модалка финального шага: запрос желаемого веб-адреса и отправка менеджеру.
 */
export function SendReviewDialog({
  open,
  initialAddress = "",
  onCancel,
  onSubmit,
}: {
  open: boolean;
  initialAddress?: string;
  onCancel: () => void;
  onSubmit: (address: string) => void;
}) {
  const [value, setValue] = useState(initialAddress);

  useEffect(() => {
    if (open) setValue(initialAddress);
  }, [open, initialAddress]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onCancel(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onCancel]);

  if (!open) return null;

  const clean = value.trim();

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/30" onClick={onCancel} />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-white p-5 shadow-2xl">
        <button
          type="button"
          onClick={onCancel}
          className="absolute right-3 top-3 flex h-7 w-7 items-center justify-center rounded-lg text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
        >
          <X size={16} />
        </button>

        <h2 className="text-[16px] font-black text-zinc-950">Отправить витрину на проверку</h2>
        <p className="mt-1.5 text-[13px] leading-relaxed text-zinc-500">
          Укажите желаемый адрес витрины. Менеджер проверит его и закрепит после проверки.
        </p>

        <div className="mt-4 flex items-center rounded-xl border border-border bg-zinc-50 px-3 focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/30">
          <input
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="my-restaurant"
            className="h-10 min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-zinc-400"
          />
          <span className="shrink-0 text-[14px] text-zinc-400">.tasko.app</span>
        </div>
        <p className="mt-1.5 text-[12px] text-zinc-400">Адрес можно будет изменить до запуска.</p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-zinc-600 transition hover:bg-zinc-100"
          >
            Отмена
          </button>
          <button
            type="button"
            disabled={clean.length === 0}
            onClick={() => onSubmit(clean)}
            className="rounded-xl bg-blue-600 px-4 py-2 text-[13px] font-bold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-zinc-200 disabled:text-zinc-400"
          >
            Отправить менеджеру
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
