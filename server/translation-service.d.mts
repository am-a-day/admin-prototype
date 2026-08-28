export type TranslationDelayScenario = "fast" | "normal" | "slow";

export const DEFAULT_TRANSLATION_DELAY_RANGE_MS: { min: number; max: number };
export const TRANSLATION_DELAY_RANGES_MS: Record<TranslationDelayScenario, { min: number; max: number }>;

export function splitTranslationSegments(text: string, maxBytes?: number): string[];
export function translateWithMyMemory(request: {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
}): Promise<{ translatedText: string; upstreamRequestCount: number }>;
export function handleTranslateRequest(request: Request): Promise<Response>;
