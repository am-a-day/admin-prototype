import { readTranslationDelayScenario, type TranslationDelayScenario } from "./config";

export type TranslateTextRequest = {
  text: string;
  sourceLanguage: string;
  targetLanguage: string;
  delayScenario?: TranslationDelayScenario;
};

export type TranslateTextResult = {
  translatedText: string;
  provider: "mymemory";
  upstreamRequestCount: number;
  durationMs: number;
  artificialDelayMs: number;
};

export interface TranslationService {
  translateText(request: TranslateTextRequest): Promise<TranslateTextResult>;
}

let clientRequestCount = 0;

async function translateText(request: TranslateTextRequest): Promise<TranslateTextResult> {
  const requestId = ++clientRequestCount;
  const startedAt = performance.now();
  try {
    const response = await fetch("/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        ...request,
        delayScenario: request.delayScenario ?? readTranslationDelayScenario(),
      }),
    });
    const payload = await response.json() as TranslateTextResult & { error?: string };
    if (!response.ok) throw new Error(payload.error || `Translation request failed (${response.status})`);
    const durationMs = Math.round(performance.now() - startedAt);
    console.info(`[translation] request #${requestId} completed in ${durationMs}ms`, {
      sourceLanguage: request.sourceLanguage,
      targetLanguage: request.targetLanguage,
      upstreamRequests: payload.upstreamRequestCount,
    });
    return payload;
  } catch (error) {
    const durationMs = Math.round(performance.now() - startedAt);
    console.error(`[translation] request #${requestId} failed in ${durationMs}ms`, error);
    throw error;
  }
}

export const translationService: TranslationService = { translateText };
