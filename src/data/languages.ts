export type LanguageCode = "ru" | "kk" | "en";

export const LANGUAGES: { code: LanguageCode; label: string; short: string }[] = [
  { code: "ru", label: "Русский", short: "RU" },
  { code: "kk", label: "Қазақша", short: "KK" },
  { code: "en", label: "English", short: "EN" },
];

export function getLanguage(code: LanguageCode) {
  return LANGUAGES.find((l) => l.code === code) ?? LANGUAGES[0];
}
