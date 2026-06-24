import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretRight, Check, Gear, Globe, Question, SignOut, User } from "@phosphor-icons/react";
import { MOCK_USER, type SectionId } from "@/data/mock-data";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import { useAppSettings } from "@/contexts/app-settings-context";
import { cn } from "@/lib/utils";

function ProfileThumb({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full bg-[#d4d4d4]",
        className,
      )}
    >
      <User size={18} weight="fill" className="text-white" />
    </span>
  );
}

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
  const [langOpen, setLangOpen] = useState(false);

  const close = () => {
    setOpen(false);
    setLangOpen(false);
  };
  const nav = (section: SectionId, tab: string) => {
    onNavigate(section, tab);
    close();
  };

  return (
    <DropdownMenu.Root open={open} onOpenChange={setOpen}>
      <DropdownMenu.Trigger asChild>
        {compact ? (
          /* Rail mode: just the avatar circle */
          <button
            type="button"
            title={MOCK_USER.name}
            className={cn(
              "flex h-[26px] w-[26px] shrink-0 items-center justify-center rounded-full transition",
              open && "ring-2 ring-blue-500/30 ring-offset-1",
            )}
          >
            <ProfileThumb />
          </button>
        ) : (
          /* Full sidebar mode: avatar + name row */
          <button
            type="button"
            className={cn(
              "flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-zinc-100",
              open && "bg-zinc-100",
            )}
          >
            <ProfileThumb />
            <span className="flex-1 truncate text-[13px] font-medium text-zinc-700">
              {MOCK_USER.shortName}
            </span>
          </button>
        )}
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          id="user-menu-popup"
          side={placement === "down" ? "bottom" : "top"}
          align={placement === "down" ? "end" : "start"}
          sideOffset={6}
          className="z-[200] w-64 rounded-2xl border border-border bg-white p-2 shadow-xl shadow-zinc-300/40"
        >
          {/* User header */}
          <div className="flex items-center gap-3 px-2.5 py-2">
            <ProfileThumb />
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
          <DropdownMenu.Sub open={langOpen} onOpenChange={setLangOpen}>
            <DropdownMenu.SubTrigger
              onPointerEnter={() => setLangOpen(true)}
              className="flex w-full cursor-default items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-zinc-700 outline-none transition hover:bg-zinc-100 hover:text-zinc-950 data-[state=open]:bg-zinc-100 data-[state=open]:text-zinc-950"
            >
              <Globe size={17} weight="fill" className="shrink-0 text-zinc-400" />
              <span className="min-w-0 flex-1">Язык админки</span>
              <span className="text-xs font-semibold text-zinc-400">
                {LANGUAGES.find((lang) => lang.code === uiLanguage)?.short}
              </span>
              <CaretRight size={14} weight="fill" className="shrink-0 text-zinc-400" />
            </DropdownMenu.SubTrigger>
            <DropdownMenu.Portal>
              <DropdownMenu.SubContent
                sideOffset={6}
                alignOffset={-4}
                className="z-[210] w-44 rounded-xl border border-border bg-white p-1.5 shadow-xl shadow-zinc-300/40"
              >
                {LANGUAGES.map((lang) => (
                  <DropdownMenu.Item
                    key={lang.code}
                    onClick={() => setUiLanguage(lang.code as LanguageCode)}
                    className={cn(
                      "flex h-8 cursor-default items-center gap-2 rounded-lg px-2 text-[13px] outline-none transition",
                      uiLanguage === lang.code
                        ? "bg-zinc-100 font-medium text-zinc-950"
                        : "text-zinc-600 hover:bg-zinc-50 focus:bg-zinc-50 focus:text-zinc-950",
                    )}
                  >
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center text-zinc-500">
                      {uiLanguage === lang.code && <Check size={13} weight="fill" />}
                    </span>
                    <span className="min-w-0 flex-1">{lang.label}</span>
                    <span className="text-xs text-zinc-400">{lang.short}</span>
                  </DropdownMenu.Item>
                ))}
              </DropdownMenu.SubContent>
            </DropdownMenu.Portal>
          </DropdownMenu.Sub>

          <div className="my-1.5 border-t border-border" />

          <button
            type="button"
            onPointerEnter={() => setLangOpen(false)}
            onFocus={() => setLangOpen(false)}
            onClick={() => nav("management", "account")}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <Gear size={17} weight="fill" className="shrink-0 text-zinc-400" />
            <span className="flex-1">Настройки аккаунта</span>
          </button>
          <button
            type="button"
            onPointerEnter={() => setLangOpen(false)}
            onFocus={() => setLangOpen(false)}
            onClick={close}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <Question size={17} weight="fill" className="shrink-0 text-zinc-400" />
            <span className="flex-1">Помощь и поддержка</span>
          </button>

          <div className="my-1.5 border-t border-border" />

          <button
            type="button"
            onPointerEnter={() => setLangOpen(false)}
            onFocus={() => setLangOpen(false)}
            onClick={close}
            className="flex w-full items-center gap-3 rounded-xl px-2.5 py-2 text-left text-sm font-medium text-zinc-700 transition hover:bg-zinc-100 hover:text-zinc-950"
          >
            <SignOut size={17} weight="fill" className="shrink-0 text-zinc-400" />
            <span className="flex-1">Выйти из аккаунта</span>
          </button>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
