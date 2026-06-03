import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Plus } from "lucide-react";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import { useAppSettings } from "@/contexts/app-settings-context";
import { cn } from "@/lib/utils";

type Translations = Partial<Record<LanguageCode, string>>;

/**
 * Compact per-field translation status indicator (`RU · 1/3`).
 * Opens a popover with per-language status and "add translation" actions.
 * It does NOT edit values inline — picking a language switches the page
 * content language and (via onPickLanguage) re-focuses the field.
 */
export function TranslationIndicator({
  translations,
  fieldLabel,
  onPickLanguage,
}: {
  translations: Translations;
  fieldLabel: string;
  /** Called when user navigates to a language (filled row or "Добавить") */
  onPickLanguage: (lang: LanguageCode) => void;
}) {
  const { contentLanguage, contentLanguageShort } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  const filledCount = LANGUAGES.filter(
    (l) => (translations[l.code] ?? "").trim() !== "",
  ).length;
  const total = LANGUAGES.length;
  const allFilled = filledCount === total;

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (document.getElementById("translation-popup")?.contains(t)) return;
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
      // Right-align the 256px popover to the indicator
      const left = Math.max(12, rect.right - 256);
      setPos({ top: rect.bottom + 6, left });
    }
    setOpen((v) => !v);
  };

  const pick = (lang: LanguageCode) => {
    onPickLanguage(lang);
    setOpen(false);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={handleToggle}
        title="Переводы поля"
        className={cn(
          "flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide transition",
          open
            ? "border-zinc-300 bg-zinc-50 text-zinc-700"
            : allFilled
              ? "border-transparent text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600"
              : "border-amber-200 bg-amber-50 text-amber-600 hover:bg-amber-100",
        )}
    >
        <span>{contentLanguageShort}</span>
        <span className="opacity-50">·</span>
        <span className="tabular-nums">{filledCount}/{total}</span>
      </button>

      {open && createPortal(
        <div
          id="translation-popup"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[200] w-64 rounded-xl border border-border bg-white p-1.5 shadow-xl shadow-zinc-300/40"
        >
          <div className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-400">
            Переводы поля
          </div>
          <div className="mb-1 px-2.5 text-[12px] font-bold text-zinc-700">
            {fieldLabel}
          </div>
          <div className="space-y-px">
            {LANGUAGES.map((lang) => {
              const value = (translations[lang.code] ?? "").trim();
              const filled = value !== "";
              const isCurrent = contentLanguage === lang.code;

              if (filled) {
                return (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => pick(lang.code as LanguageCode)}
                    className={cn(
                      "flex w-full items-start gap-2 rounded-lg px-2.5 py-1.5 text-left transition hover:bg-zinc-50",
                      isCurrent && "bg-blue-50/60",
                    )}
                  >
                    <Check size={13} className="mt-0.5 shrink-0 text-emerald-500" strokeWidth={2.5} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-[12px] font-semibold text-zinc-800">
                        {lang.label}
                        {isCurrent && (
                          <span className="rounded bg-blue-100 px-1 py-px text-[9px] font-bold uppercase text-blue-600">
                            сейчас
                          </span>
                        )}
                      </span>
                      <span className="mt-0.5 block truncate text-[11px] text-zinc-400">
                        {value}
                      </span>
                    </span>
                  </button>
                );
              }

              return (
                <div
                  key={lang.code}
                  className="flex items-center gap-2 rounded-lg px-2.5 py-1.5"
                >
                  <span className="flex h-[13px] w-[13px] shrink-0 items-center justify-center">
                    <span className="h-2 w-2 rounded-full border border-zinc-300" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12px] font-semibold text-zinc-500">
                      {lang.label}
                    </span>
                    <span className="text-[11px] text-zinc-400">Не заполнено</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => pick(lang.code as LanguageCode)}
                    className="flex shrink-0 items-center gap-1 rounded-md bg-zinc-900 px-2 py-1 text-[11px] font-bold text-white transition hover:bg-zinc-700"
                  >
                    <Plus size={11} />
                    Добавить
                  </button>
                </div>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
