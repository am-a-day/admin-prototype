import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretRight, Check, Globe, Lifebuoy, LockKeyOpen, SignOut, User } from "@phosphor-icons/react";
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
          className="z-[200] w-[260px] overflow-hidden rounded-[14px] border border-[#e7e5e4] bg-white p-0 shadow-xl shadow-zinc-300/40"
        >
          {/* Header */}
          <div className="px-3 py-3">
            <div className="flex min-w-0 items-center gap-2">
              <span className="truncate text-[13px] font-semibold leading-none text-[#292524]">
                {MOCK_USER.name}
              </span>
              <span className="shrink-0 rounded-full bg-[#f5f5f4] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#57534d]">
                {MOCK_USER.role}
              </span>
            </div>
            <div className="mt-1.5 truncate text-[12px] leading-none text-[#a6a09b]">
              {MOCK_USER.phone}
            </div>
          </div>

          <div className="h-px bg-[#e7e5e4]" />

          {/* Menu */}
          <div className="p-1">
            {/* UI language */}
            <DropdownMenu.Sub open={langOpen} onOpenChange={setLangOpen}>
              <DropdownMenu.SubTrigger
                onPointerEnter={() => setLangOpen(true)}
                className="flex h-9 w-full cursor-default items-center gap-1.5 rounded-lg px-2 text-left outline-none transition hover:bg-[#f5f5f4] data-[state=open]:bg-[#f5f5f4]"
              >
                <Globe size={14} className="shrink-0 text-[#57534d]" />
                <span className="min-w-0 flex-1 text-[13px] text-[#44403b]">Язык админки</span>
                <span className="text-[12px] text-[#a6a09b]">
                  {LANGUAGES.find((lang) => lang.code === uiLanguage)?.short}
                </span>
                <CaretRight size={14} className="shrink-0 text-[#a6a09b]" />
              </DropdownMenu.SubTrigger>
              <DropdownMenu.Portal>
                <DropdownMenu.SubContent
                  sideOffset={6}
                  alignOffset={-4}
                  className="z-[210] w-44 rounded-xl border border-[#e7e5e4] bg-white p-1.5 shadow-xl shadow-zinc-300/40"
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

            <button
              type="button"
              onPointerEnter={() => setLangOpen(false)}
              onFocus={() => setLangOpen(false)}
              onClick={() => nav("management", "account")}
              className="flex h-9 w-full items-center gap-1.5 rounded-lg px-2 text-left transition hover:bg-[#f5f5f4]"
            >
              <User size={14} className="shrink-0 text-[#57534d]" />
              <span className="flex-1 text-[13px] text-[#44403b]">Настройки аккаунта</span>
            </button>

            <button
              type="button"
              onPointerEnter={() => setLangOpen(false)}
              onFocus={() => setLangOpen(false)}
              onClick={close}
              className="flex h-9 w-full items-center gap-1.5 rounded-lg px-2 text-left transition hover:bg-[#f5f5f4]"
            >
              <Lifebuoy size={14} className="shrink-0 text-[#57534d]" />
              <span className="flex-1 text-[13px] text-[#44403b]">Помощь и поддержка</span>
              <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-[#f5f5f4] px-1.5 py-0.5 text-[10px] font-semibold leading-none text-[#a6a09b]">
                <LockKeyOpen size={11} />
                LITE
              </span>
            </button>

            <button
              type="button"
              onPointerEnter={() => setLangOpen(false)}
              onFocus={() => setLangOpen(false)}
              onClick={close}
              className="flex h-9 w-full items-center gap-1.5 rounded-lg px-2 text-left transition hover:bg-[#f5f5f4]"
            >
              <SignOut size={14} className="shrink-0 text-[#57534d]" />
              <span className="flex-1 text-[13px] text-[#44403b]">Выйти</span>
            </button>
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
