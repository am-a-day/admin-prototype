import { useEffect, useState } from "react";
import { useAppSettings } from "@/contexts/app-settings-context";
import { LANGUAGES, type LanguageCode } from "@/data/languages";

const LANGUAGE_GENITIVE: Record<LanguageCode, string> = {
  ru: "русского",
  kk: "казахского",
  en: "английского",
};

type Translations = Partial<Record<LanguageCode, string>>;

type LocalizedTextAreaProps = {
  label: string;
  initialTranslations: Translations;
  fallbackLang?: LanguageCode;
  rows?: number;
  /** Fires with the effective value (current language, or fallback if empty) — useful for live previews. */
  onEffectiveValueChange?: (value: string) => void;
};

export function LocalizedTextArea({
  label,
  initialTranslations,
  fallbackLang = "ru",
  rows = 4,
  onEffectiveValueChange,
}: LocalizedTextAreaProps) {
  const { contentLanguage } = useAppSettings();
  const [translations, setTranslations] = useState<Translations>(initialTranslations);

  const currentValue = translations[contentLanguage] ?? "";
  const isEmpty = currentValue.trim() === "";

  const fallbackValue = translations[fallbackLang] ?? "";

  useEffect(() => {
    onEffectiveValueChange?.(isEmpty ? fallbackValue : currentValue);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentValue, fallbackValue, isEmpty]);
  const fallbackLabel = LANGUAGES.find((l) => l.code === fallbackLang)?.short ?? fallbackLang.toUpperCase();
  const currentShort = LANGUAGES.find((l) => l.code === contentLanguage)?.short ?? contentLanguage.toUpperCase();

  const handleChange = (value: string) => {
    setTranslations((prev) => ({ ...prev, [contentLanguage]: value }));
  };

  const copyFromFallback = () => {
    setTranslations((prev) => ({ ...prev, [contentLanguage]: fallbackValue }));
  };

  const showCopyAction =
    isEmpty && contentLanguage !== fallbackLang && fallbackValue.trim() !== "";

  return (
    <div className="rounded-2xl border border-border bg-zinc-50 px-4 py-3">
      {/* Label row */}
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <span className="text-[10px] font-black uppercase tracking-widest text-zinc-400">
          {currentShort}
        </span>
      </div>

      {isEmpty ? (
        /* Empty state */
        <div className="space-y-2">
          <p className="text-sm text-zinc-400">
            Перевод для {LANGUAGE_GENITIVE[contentLanguage] ?? contentLanguage} языка ещё не заполнен
          </p>
          {showCopyAction && (
            <button
              type="button"
              onClick={copyFromFallback}
              className="text-xs font-semibold text-blue-600 underline-offset-2 hover:underline"
            >
              Скопировать из {fallbackLabel}
            </button>
          )}
          {/* Hidden textarea to still allow typing directly */}
          <textarea
            rows={rows}
            value=""
            onChange={(e) => handleChange(e.target.value)}
            placeholder="Введите перевод…"
            className="mt-1 min-h-0 w-full resize-none bg-transparent text-base font-semibold text-zinc-900 placeholder:text-zinc-300 outline-none"
          />
        </div>
      ) : (
        <textarea
          rows={rows}
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          className="w-full resize-none bg-transparent text-base font-semibold text-zinc-900 outline-none"
        />
      )}
    </div>
  );
}
