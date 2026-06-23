import { createPortal } from "react-dom";

/**
 * Диалог при попытке уйти со страницы с несохранёнными изменениями
 * (только модель Save + Live Preview).
 */
export function UnsavedChangesDialog({
  open,
  onSave,
  onDiscard,
  onStay,
}: {
  open: boolean;
  onSave: () => void;
  onDiscard: () => void;
  onStay: () => void;
}) {
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-zinc-950/40 p-4">
      <div className="w-full max-w-sm rounded-2xl border border-border bg-white p-6 shadow-2xl shadow-zinc-400/30">
        <h2 className="text-lg font-black text-zinc-950">Есть несохранённые изменения</h2>
        <p className="mt-2 text-sm leading-6 text-zinc-500">
          Вы изменили данные, но ещё не сохранили их. Что сделать перед переходом?
        </p>

        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={onSave}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-blue-700"
          >
            Сохранить и перейти
          </button>
          <button
            type="button"
            onClick={onDiscard}
            className="w-full rounded-xl border border-border px-4 py-2.5 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50"
          >
            Перейти без сохранения
          </button>
          <button
            type="button"
            onClick={onStay}
            className="w-full rounded-xl px-4 py-2.5 text-sm font-semibold text-zinc-500 transition hover:bg-zinc-100"
          >
            Остаться
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
