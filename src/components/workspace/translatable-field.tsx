import { useEffect, useRef, useState } from "react";
import { TranslationIndicator } from "@/components/workspace/translation-indicator";
import { useAppSettings } from "@/contexts/app-settings-context";
import { LANGUAGES, type LanguageCode } from "@/data/languages";

type Translations = Partial<Record<LanguageCode, string>>;

const GENITIVE: Record<LanguageCode, string> = {
  ru: "русском",
  kk: "казахском",
  en: "английском",
};

/**
 * A single field (text input or textarea) with language versions.
 * Shows the per-field translation indicator and switches the page content
 * language + re-focuses the field when a language is picked from the popover.
 */
export function TranslatableField({
  label,
  initialTranslations,
  multiline = false,
  rows = 4,
  fallbackLang = "ru",
  placeholder = "Введите перевод…",
}: {
  label: string;
  initialTranslations: Translations;
  multiline?: boolean;
  rows?: number;
  fallbackLang?: LanguageCode;
  placeholder?: string;
}) {
  const { contentLanguage, setContentLanguage } = useAppSettings();
  const [translations, setTranslations] = useState<Translations>(initialTranslations);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);
  const pendingFocus = useRef(false);

  const currentValue = translations[contentLanguage] ?? "";
  const isEmpty = currentValue.trim() === "";
  const fallbackValue = translations[fallbackLang] ?? "";
  const showCopy = isEmpty && contentLanguage !== fallbackLang && fallbackValue.trim() !== "";
  const fallbackShort = LANGUAGES.find((l) => l.code === fallbackLang)?.short ?? fallbackLang.toUpperCase();
  const currentLabel = LANGUAGES.find((l) => l.code === contentLanguage)?.label ?? contentLanguage;

  // After picking a language from the popover, focus this field once it re-renders
  useEffect(() => {
    if (pendingFocus.current) {
      inputRef.current?.focus();
      pendingFocus.current = false;
    }
  }, [contentLanguage]);

  const handlePickLanguage = (lang: LanguageCode) => {
    pendingFocus.current = true;
    if (lang === contentLanguage) {
      // Already on this language — just focus
      inputRef.current?.focus();
      pendingFocus.current = false;
    } else {
      setContentLanguage(lang);
    }
  };

  const handleChange = (value: string) =>
    setTranslations((prev) => ({ ...prev, [contentLanguage]: value }));

  const copyFromFallback = () =>
    setTranslations((prev) => ({ ...prev, [contentLanguage]: fallbackValue }));

  return (
    <div className="rounded-2xl border border-border bg-zinc-50 px-4 py-3">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-xs font-semibold text-muted-foreground">{label}</span>
        <TranslationIndicator
          translations={translations}
          fieldLabel={label}
          onPickLanguage={handlePickLanguage}
        />
      </div>

      {multiline ? (
        <textarea
          ref={(el) => { inputRef.current = el; }}
          rows={rows}
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="w-full resize-none bg-transparent text-base font-semibold text-zinc-900 placeholder:text-zinc-300 outline-none"
        />
      ) : (
        <input
          ref={(el) => { inputRef.current = el; }}
          value={currentValue}
          onChange={(e) => handleChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-transparent text-base font-semibold text-zinc-900 placeholder:text-zinc-300 outline-none"
        />
      )}

      {/* Soft hint when current language is empty */}
      {isEmpty && (
        <div className="mt-1.5 flex items-center gap-2 text-[11px] text-zinc-400">
          <span>Перевод на {GENITIVE[contentLanguage] ?? currentLabel} ещё не заполнен</span>
          {showCopy && (
            <button
              type="button"
              onClick={copyFromFallback}
              className="font-semibold text-blue-600 underline-offset-2 hover:underline"
            >
              Скопировать из {fallbackShort}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
