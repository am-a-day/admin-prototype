import { useEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import { useAppSettings } from "@/contexts/app-settings-context";
import { cn } from "@/lib/utils";
import { createPortal } from "react-dom";

function LanguageOption({
  label,
  selected,
  primary,
  onSelect,
}: {
  label: string;
  selected: boolean;
  primary?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm transition",
        selected && primary
          ? "bg-blue-50 font-bold text-blue-700"
          : selected
            ? "bg-zinc-100 font-semibold text-zinc-900"
            : "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-950",
      )}
    >
      <span
        className={cn(
          "h-1.5 w-1.5 shrink-0 rounded-full",
          selected ? (primary ? "bg-blue-600" : "bg-zinc-400") : "bg-transparent",
        )}
      />
      {label}
    </button>
  );
}

export function LanguageSwitcher({ compact = true }: { compact?: boolean }) {
  const { contentLanguage, setContentLanguage, contentLanguageShort } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState({ bottom: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current && btnRef.current.contains(target)) return;
      const popup = document.getElementById("language-switcher-popup");
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

  const handleToggle = () => {
    if (!open && btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect();
      setPopupPos({ bottom: window.innerHeight - rect.bottom, left: rect.right + 8 });
    }
    setOpen((v) => !v);
  };

  const currentLabel = LANGUAGES.find((l) => l.code === contentLanguage)?.label ?? contentLanguageShort;

  const popup = open && createPortal(
    <div
      id="language-switcher-popup"
      style={{ bottom: popupPos.bottom, left: popupPos.left }}
      className="fixed z-[200] w-48 rounded-2xl border border-border bg-white p-3 shadow-xl shadow-zinc-300/40"
    >
      <div className="mb-0.5 px-2 text-[10px] font-black uppercase tracking-wide text-zinc-400">
        Язык контента
      </div>
      <p className="mb-2 px-2 text-[10px] leading-4 text-zinc-400">
        Версия меню и витрины для редактирования.
      </p>
      <div className="space-y-0.5">
        {LANGUAGES.map((lang) => (
          <LanguageOption
            key={lang.code}
            label={lang.label}
            selected={contentLanguage === lang.code}
            primary
            onSelect={() => setContentLanguage(lang.code as LanguageCode)}
          />
        ))}
      </div>
    </div>,
    document.body,
  );

  return (
    <>
      {compact ? (
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className="flex h-9 w-9 flex-col items-center justify-center rounded-xl text-[10px] font-black text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950"
          aria-expanded={open}
          title="Языки"
        >
          <span>{contentLanguageShort}</span>
          <ChevronDown size={10} className={cn("transition", open && "rotate-180")} />
        </button>
      ) : (
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            "flex w-full items-center rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-100",
            open && "bg-zinc-100",
          )}
          aria-expanded={open}
          title="Язык контента"
        >
          <div className="flex-1 min-w-0">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 leading-none mb-0.5">
              Контент
            </div>
            <div className="text-xs font-medium text-zinc-600 leading-none">{currentLabel}</div>
          </div>
          <ChevronDown size={12} className={cn("shrink-0 text-zinc-400 transition", open && "rotate-180")} />
        </button>
      )}
      {popup}
    </>
  );
}
