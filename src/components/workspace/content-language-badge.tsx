import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ChevronDown } from "lucide-react";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import { useAppSettings } from "@/contexts/app-settings-context";
import { cn } from "@/lib/utils";

type ContentLanguageBadgeProps = {
  /**
   * "header" (default) — pill with full label + chevron, shown in the page header.
   * "field" — minimal short-code badge (RU / KK / EN) shown inline next to field labels.
   */
  variant?: "header" | "field";
};

export function ContentLanguageBadge({ variant = "header" }: ContentLanguageBadgeProps) {
  const { contentLanguage, setContentLanguage, contentLanguageShort } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (document.getElementById("content-lang-popup")?.contains(t)) return;
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
      setPos({ top: rect.bottom + 6, left: rect.left });
    }
    setOpen((v) => !v);
  };

  const currentLabel = LANGUAGES.find((l) => l.code === contentLanguage)?.label ?? contentLanguageShort;

  return (
    <>
      {variant === "field" ? (
        /* ── Minimal inline badge for field labels ── */
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          title="Язык редактируемого контента. Нажмите, чтобы переключить."
          className={cn(
            "rounded px-0.5 text-[10px] font-black uppercase tracking-widest transition",
            open
              ? "text-blue-600"
              : "text-zinc-400 hover:text-blue-500",
          )}
        >
          {contentLanguageShort}
        </button>
      ) : (
        /* ── Header pill ── */
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          title="Язык редактируемого контента"
          className={cn(
            "flex items-center gap-1 rounded-md border border-border px-2 py-1 text-[11px] font-semibold text-zinc-600 transition hover:border-zinc-300 hover:bg-zinc-50 hover:text-zinc-900",
            open && "border-zinc-300 bg-zinc-50 text-zinc-900",
          )}
        >
          <span>Контент: {currentLabel}</span>
          <ChevronDown size={11} className={cn("shrink-0 text-zinc-400 transition", open && "rotate-180")} />
        </button>
      )}

      {open && createPortal(
        <div
          id="content-lang-popup"
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-[200] w-52 rounded-xl border border-border bg-white p-1.5 shadow-xl shadow-zinc-300/40"
        >
          <div className="px-2.5 pb-1 pt-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-400">
            Язык контента
          </div>
          <p className="mb-1.5 px-2.5 text-[10px] leading-[1.5] text-zinc-400">
            Какую языковую версию витрины вы сейчас редактируете.
          </p>
          <div className="space-y-px">
            {LANGUAGES.map((lang) => (
              <button
                key={lang.code}
                type="button"
                onClick={() => { setContentLanguage(lang.code as LanguageCode); setOpen(false); }}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-1.5 text-left text-[13px] transition",
                  contentLanguage === lang.code
                    ? "bg-blue-50 font-bold text-blue-700"
                    : "text-zinc-700 hover:bg-zinc-50",
                )}
              >
                <span className={cn(
                  "h-1.5 w-1.5 shrink-0 rounded-full",
                  contentLanguage === lang.code ? "bg-blue-500" : "bg-zinc-200",
                )} />
                {lang.label}
              </button>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
