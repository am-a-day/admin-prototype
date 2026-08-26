export type LanguageCode = "ru" | "kk" | "en" | "zh" | "fr" | "es" | "sr";

export const LANGUAGES: { code: LanguageCode; label: string; short: string }[] = [
  { code: "ru", label: "Русский", short: "RU" },
  { code: "kk", label: "Қазақша", short: "KK" },
  { code: "en", label: "English", short: "EN" },
  { code: "zh", label: "中文", short: "ZH" },
  { code: "fr", label: "Français", short: "FR" },
  { code: "es", label: "Español", short: "ES" },
  { code: "sr", label: "Srpski", short: "SR" },
];

export function getLanguage(code: LanguageCode) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
