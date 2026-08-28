export type TranslationDelayScenario = "fast" | "normal" | "slow";

export const TRANSLATION_DELAY_SCENARIOS: Array<{
  id: TranslationDelayScenario;
  label: string;
  rangeLabel: string;
}> = [
  { id: "fast", label: "Fast", rangeLabel: "300–600 ms" },
  { id: "normal", label: "Normal", rangeLabel: "1–2 s" },
  { id: "slow", label: "Slow", rangeLabel: "4–7 s" },
];

const TRANSLATION_DELAY_SCENARIO_STORAGE_KEY = "tasko.translations.delay-scenario.v1";

export function readTranslationDelayScenario(): TranslationDelayScenario {
  if (typeof window === "undefined") return "normal";
  const stored = window.localStorage.getItem(TRANSLATION_DELAY_SCENARIO_STORAGE_KEY);
  return TRANSLATION_DELAY_SCENARIOS.some(({ id }) => id === stored)
    ? stored as TranslationDelayScenario
    : "normal";
}

export function writeTranslationDelayScenario(scenario: TranslationDelayScenario) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TRANSLATION_DELAY_SCENARIO_STORAGE_KEY, scenario);
}
