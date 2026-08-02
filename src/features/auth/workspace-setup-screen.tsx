import { useState } from "react";
import { BriefcaseBusiness, Shapes, ShoppingBag, UtensilsCrossed } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { useAppSettings } from "@/contexts/app-settings-context";
import {
  useMockAuth,
  type OrganizationType,
} from "@/contexts/mock-auth-context";
import { LANGUAGES, type LanguageCode } from "@/data/languages";
import { cn } from "@/lib/utils";

const ORGANIZATION_OPTIONS = [
  {
    value: "restaurant",
    label: "Ресторан или кафе",
    icon: UtensilsCrossed,
  },
  {
    value: "store",
    label: "Магазин",
    icon: ShoppingBag,
  },
  {
    value: "services",
    label: "Услуги",
    icon: BriefcaseBusiness,
  },
  {
    value: "other",
    label: "Другое",
    icon: Shapes,
  },
] satisfies Array<{
  value: OrganizationType;
  label: string;
  icon: typeof UtensilsCrossed;
}>;

export function WorkspaceSetupScreen() {
  const { completeWorkspaceSetup } = useMockAuth();
  const { uiLanguage, setContentLanguage } = useAppSettings();
  const [organizationType, setOrganizationType] = useState<OrganizationType | null>(null);
  const [primaryLanguage, setPrimaryLanguage] = useState<LanguageCode>(uiLanguage);

  const continueToAdmin = () => {
    if (!organizationType) return;
    setContentLanguage(primaryLanguage);
    completeWorkspaceSetup(organizationType, primaryLanguage);
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf9f6] px-4 py-6 text-zinc-950">
      <section className="w-full max-w-[480px] rounded-[20px] border border-[#e7e5e4] bg-white p-6 shadow-sm">
        <div className="flex justify-center">
          <TaskoLogo className="text-zinc-950" />
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-[22px] font-black leading-7">Настроим Tasko под ваш бизнес</h1>
          <p className="mt-1 text-[13px] leading-5 text-zinc-500">
            Два выбора, чтобы подготовить рабочее пространство.
          </p>
        </div>

        <fieldset className="mt-6">
          <legend className="text-[14px] font-bold text-zinc-900">Что вы создаёте?</legend>
          <div className="mt-2 grid grid-cols-2 gap-2">
            {ORGANIZATION_OPTIONS.map(({ value, label, icon: Icon }) => {
              const selected = organizationType === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setOrganizationType(value)}
                  className={cn(
                    "flex min-h-[72px] items-center gap-3 rounded-[8px] border px-3 text-left transition",
                    selected
                      ? "border-zinc-950 bg-zinc-950 text-white"
                      : "border-[#e7e5e4] bg-[#fbfbf9] text-zinc-700 hover:border-zinc-400 hover:bg-white",
                  )}
                >
                  <Icon size={18} className="shrink-0" />
                  <span className="text-[13px] font-semibold leading-4">{label}</span>
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="mt-6">
          <legend className="text-[14px] font-bold text-zinc-900">Основной язык витрины</legend>
          <div className="mt-2 grid grid-cols-3 rounded-[10px] bg-zinc-100 p-1">
            {LANGUAGES.map((language) => {
              const selected = primaryLanguage === language.code;
              return (
                <button
                  key={language.code}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => setPrimaryLanguage(language.code)}
                  className={cn(
                    "min-h-10 rounded-[8px] px-2 text-[12px] font-semibold transition",
                    selected
                      ? "bg-white text-zinc-950 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-800",
                  )}
                >
                  {language.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <Button
          type="button"
          disabled={!organizationType}
          onClick={continueToAdmin}
          className="mt-6 h-11 w-full rounded-[10px] bg-zinc-950 text-[14px] hover:bg-zinc-800"
        >
          Перейти в админку
        </Button>
      </section>
    </main>
  );
}
