import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAppSettings } from "@/contexts/app-settings-context";
import type { LanguageCode } from "@/data/languages";
import { useMockAuth } from "@/contexts/mock-auth-context";

type Translations = Partial<Record<LanguageCode, string>>;

/**
 * A single field (text input or textarea) with language versions.
 * The active language is controlled by the workspace-level language selector.
 */
export function TranslatableField({
  label,
  initialTranslations,
  multiline = false,
  rows = 4,
  placeholder = "Введите перевод…",
  compact = false,
  plain = false,
  storageKey,
  autoFocus = false,
  inputAriaLabel,
  resetKey,
  onValueChange,
  persist = true,
  onChange,
}: {
  label: string;
  initialTranslations: Translations;
  multiline?: boolean;
  rows?: number;
  placeholder?: string;
  compact?: boolean;
  /** Стиль макета редактора позиции: подпись над полем, поле в собственной рамке. */
  plain?: boolean;
  storageKey?: string;
  autoFocus?: boolean;
  inputAriaLabel?: string;
  resetKey?: string;
  onValueChange?: (value: string) => void;
  persist?: boolean;
  onChange?: (translations: Translations) => void;
}) {
  const { contentLanguage } = useAppSettings();
  const { account, setWorkspaceLanguageHasContent } = useMockAuth();
  const persistedKey = persist && account
    ? `tasko.catalog.translations.${account.id}.${storageKey ?? label}`
    : null;
  const [translations, setTranslations] = useState<Translations>(() => {
    if (!persistedKey) return initialTranslations;
    try {
      const stored = window.localStorage.getItem(persistedKey);
      return stored ? { ...initialTranslations, ...JSON.parse(stored) } : initialTranslations;
    } catch {
      return initialTranslations;
    }
  });
  const translationsRef = useRef(translations);
  const resetKeyRef = useRef(resetKey);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    if (resetKeyRef.current === resetKey) return;
    resetKeyRef.current = resetKey;
    translationsRef.current = initialTranslations;
    setTranslations(initialTranslations);
    // The reset is keyed to an explicit editor session/item change. Depending on
    // the translations object itself would overwrite the controlled typing draft.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey]);

  const currentValue = translations[contentLanguage] ?? "";

  const saveTranslation = (value: string) => {
    const next = { ...translationsRef.current, [contentLanguage]: value };
    translationsRef.current = next;
    setTranslations(next);
    if (persistedKey) window.localStorage.setItem(persistedKey, JSON.stringify(next));
    onChange?.(next);
    setWorkspaceLanguageHasContent(contentLanguage, value.trim() !== "");
    onValueChange?.(value);
  };

  const plainInputClass =
    "w-full rounded-[8px] border border-[#e5e5e5] bg-white px-3 text-[13px] text-[#292524] shadow-[0_1px_2px_rgba(0,0,0,0.1)] outline-none transition placeholder:text-[#a8a29e] focus:border-[#c7c2bd]";

  return (
    <div className={plain ? undefined : compact ? "rounded-xl border border-zinc-200 bg-white px-3 py-2.5" : "rounded-2xl border border-border bg-zinc-50 px-4 py-3"}>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className={plain ? "text-[13px] leading-5 text-[#303030]" : "text-xs font-semibold text-muted-foreground"}>{label}</span>
      </div>

      {multiline ? (
        <textarea
          ref={(el) => { inputRef.current = el; }}
          aria-label={inputAriaLabel}
          autoFocus={autoFocus}
          rows={rows}
          value={currentValue}
          onChange={(e) => saveTranslation(e.target.value)}
          placeholder={placeholder}
          className={
            plain
              ? cn(plainInputClass, "min-h-[77px] resize-none py-2 leading-6")
              : "w-full resize-none bg-transparent text-base font-semibold text-zinc-900 placeholder:text-zinc-300 outline-none"
          }
        />
      ) : (
        <input
          ref={(el) => { inputRef.current = el; }}
          aria-label={inputAriaLabel}
          autoFocus={autoFocus}
          value={currentValue}
          onChange={(e) => saveTranslation(e.target.value)}
          placeholder={placeholder}
          className={
            plain
              ? cn(plainInputClass, "h-9")
              : "w-full bg-transparent text-base font-semibold text-zinc-900 placeholder:text-zinc-300 outline-none"
          }
        />
      )}
    </div>
  );
}
