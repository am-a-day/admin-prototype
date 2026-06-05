import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { HelpCircle, LogOut, Settings } from "lucide-react";
import { MOCK_USER, type SectionId } from "@/data/mock-data";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import { useAppSettings } from "@/contexts/app-settings-context";
import { cn } from "@/lib/utils";

/** User account menu — bottom of sidebar or in app header */
export function UserMenu({
  compact = false,
  placement = "up",
  onNavigate,
}: {
  compact?: boolean;
  /** "up" opens above button (sidebar), "down" opens below (header) */
  placement?: "up" | "down";
  onNavigate: (section: SectionId, tab: string) => void;
}) {
  const { uiLanguage, setUiLanguage } = useAppSettings();
  const [open, setOpen] = useState(false);
  const [popupPos, setPopupPos] = useState({ top: 0, bottom: 0, left: 0 });
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (btnRef.current?.contains(target)) return;
      const popup = document.getElementById("user-menu-popup");
      if (popup?.contains(target)) return;
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
      if (placement === "down") {
        setPopupPos({
          top: rect.bottom + 6,
          bottom: 0,
          left: Math.max(8, rect.right - 256),
        });
      } else {
        // Open upward: anchor to the top of the trigger button
        setPopupPos({
          top: 0,
          bottom: window.innerHeight - rect.top + 6,
          left: compact ? rect.right + 8 : rect.left,
        });
      }
    }
    setOpen((v) => !v);
  };

  const close = () => setOpen(false);
  const nav = (section: SectionId, tab: string) => {
    onNavigate(section, tab);
    close();
  };

  return (
    <>
      {compact ? (
        /* Rail mode: just the avatar circle */
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          title={MOCK_USER.name}
          className={cn(
            "flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[10px] font-black text-zinc-700 transition hover:bg-zinc-300",
            open && "ring-2 ring-blue-500/30 ring-offset-1",
          )}
        >
          {MOCK_USER.initials}
        </button>
      ) : (
        /* Full sidebar mode: avatar + name row */
        <button
          ref={btnRef}
          type="button"
          onClick={handleToggle}
          className={cn(
            "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-100",
            open && "bg-zinc-100",
          )}
        >
          <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[9px] font-black text-zinc-700">
            {MOCK_USER.initials}
          </div>
          <span className="flex-1 truncate text-[13px] font-medium text-zinc-700">
            {MOCK_USER.shortName}
          </span>
        </button>
      )}

      {open && createPortal(
        <div
          id="user-menu-popup"
          style={
            placement === "down"
              ? { top: popupPos.top, left: popupPos.left }
              : { bottom: popupPos.bottom, left: popupPos.left }
          }
          className="fixed z-[200] w-64 rounded-2xl border border-border bg-white p-2 shadow-xl shadow-zinc-300/40"
        >
          {/* User header */}
          <div className="flex items-center gap-3 px-2.5 py-2">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-zinc-200 text-[11px] font-black text-zinc-700">
              {MOCK_USER.initials}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold leading-tight text-zinc-950">
                {MOCK_USER.name}
              </div>
              <div className="mt-0.5 truncate text-xs text-muted-foreground">
                {MOCK_USER.email}
              </div>
            </div>
          </div>

          <div className="my-1.5 border-t border-border" />

          {/* UI language */}
          <div className="px-2.5 pb-1.5">
            <div className="mb-1.5 text-[10px] font-black uppercase tracking-wide text-zinc-400">
              Язык интерфейса
            </div>
            <div className="flex gap-1">
              {LANGUAGES.map((lang) => (
                <button
                  key={lang.code}
                  type="button"
                  onClick={() => setUiLanguage(lang.code as LanguageCode)}
                  className={cn(
                    "flex-1 rounded-lg border py-1 text-xs font-semibold transition",
                    uiLanguage === lang.code
                      ? "border-blue-500 bg-blue-50 text-blue-700"
                      : "border-border bg-white text-zinc-500 hover:bg-zinc-50",
                  )}
                >
                  {lang.short}
                </button>
              ))}
            </div>
          </div>

          <div className="my-1.5 border-t border-border" />

          <button
            type="button"
            onClick={() => nav("management", "account")}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <Settings size={17} className="shrink-0 text-zinc-400" />
            <span className="flex-1">Настройки аккаунта</span>
          </button>
          <button
            type="button"
            onClick={close}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <HelpCircle size={17} className="shrink-0 text-zinc-400" />
            <span className="flex-1">Помощь и поддержка</span>
          </button>

          <div className="my-1.5 border-t border-border" />

          <button
            type="button"
            onClick={close}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-red-600 transition hover:bg-red-50"
          >
            <LogOut size={17} className="shrink-0 text-red-500" />
            <span className="flex-1">Выйти из аккаунта</span>
          </button>
        </div>,
        document.body,
      )}
    </>
  );
}
