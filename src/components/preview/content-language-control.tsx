import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { ChevronDown } from "lucide-react";
import { createPortal } from "react-dom";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import { useAppSettings } from "@/contexts/app-settings-context";
import { cn } from "@/lib/utils";

/**
 * Переключатель языка редактируемого контента витрины.
 * Живёт в шапке панели превью (основной) и в свёрнутой плашке (compact).
 */
export function ContentLanguageControl({ compact = false }: { compact?: boolean }) {
  const { contentLanguage, setContentLanguage, contentLanguageShort } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, right: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (btnRef.current?.contains(t)) return;
      if (document.getElementById("content-lang-popup")?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const toggle = (e: ReactMouseEvent) => {
    e.stopPropagation();
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setPos({ top: r.bottom + 6, right: window.innerWidth - r.right });
    }
    setOpen((v) => !v);
  };

  const currentLabel = LANGUAGES.find((l) => l.code === contentLanguage)?.label ?? contentLanguageShort;

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        title="Язык контента"
        aria-expanded={open}
        className={cn(
          "flex items-center gap-0.5 rounded-md font-normal text-black transition hover:bg-zinc-100",
          open && "bg-zinc-100",
          compact ? "px-1 py-0.5 text-[14px]" : "px-1.5 py-1 text-[13px]",
        )}
      >
        <span className="normal-case tracking-normal">
          {compact ? contentLanguageShort : currentLabel}
        </span>
        <ChevronDown size={12} className={cn("shrink-0 text-zinc-400 transition", open && "rotate-180")} />
      </button>

      {open && createPortal(
        <div
          id="content-lang-popup"
          style={{ top: pos.top, right: pos.right }}
          className="fixed z-[200] w-52 rounded-2xl border border-border bg-white p-3 shadow-xl shadow-zinc-300/40"
        >
          <div className="mb-0.5 px-2 text-[10px] font-black uppercase tracking-wide text-zinc-400">
            Язык контента
          </div>
          <p className="mb-2 px-2 text-[10px] leading-4 text-zinc-400">
            Версия меню и витрины для редактирования.
          </p>
          <div className="space-y-0.5">
            {LANGUAGES.map((lang) => {
              const selected = contentLanguage === lang.code;
              return (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => {
                    setContentLanguage(lang.code as LanguageCode);
                    setOpen(false);
                  }}
                  className={cn(
                    "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
                    selected
                      ? "bg-blue-50 font-bold text-blue-700"
                      : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950",
                  )}
                >
                  <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", selected ? "bg-blue-600" : "bg-transparent")} />
                  {lang.label}
                </button>
              );
            })}
          </div>
        </div>,
        document.body,
      )}
    </>
  );
}
