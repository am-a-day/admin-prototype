import { useAppSettings } from "@/contexts/app-settings-context";

type ContentLanguageBadgeProps = {
  variant?: "compact" | "full";
};

export function ContentLanguageBadge({ variant = "compact" }: ContentLanguageBadgeProps) {
  const { contentLanguageLabel, contentLanguageShort } = useAppSettings();

  if (variant === "full") {
    return (
      <span
        className="shrink-0 rounded-full bg-zinc-100 px-2.5 py-1 text-xs font-semibold text-zinc-600"
        title="Язык редактирования контента"
      >
        Редактирование: {contentLanguageLabel}
      </span>
    );
  }

  return (
    <span
      className="shrink-0 rounded-md bg-blue-50 px-1.5 py-0.5 text-[10px] font-black uppercase tracking-wide text-blue-700"
      title={`Редактирование: ${contentLanguageLabel}`}
    >
      {contentLanguageShort}
    </span>
  );
}
