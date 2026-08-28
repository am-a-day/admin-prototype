const MYMEMORY_ENDPOINT = "https://api.mymemory.translated.net/get";
const MYMEMORY_MAX_SEGMENT_BYTES = 450;

export const DEFAULT_TRANSLATION_DELAY_RANGE_MS = { min: 800, max: 1500 };
export const TRANSLATION_DELAY_RANGES_MS = {
  fast: { min: 300, max: 600 },
  normal: { min: 1000, max: 2000 },
  slow: { min: 4000, max: 7000 },
};

let serverRequestCount = 0;

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { "content-type": "application/json; charset=utf-8" },
  });
}

function byteLength(value) {
  return new TextEncoder().encode(value).length;
}

function splitLongToken(token, maxBytes) {
  const chunks = [];
  let chunk = "";
  for (const character of token) {
    if (chunk && byteLength(chunk + character) > maxBytes) {
      chunks.push(chunk);
      chunk = character;
    } else {
      chunk += character;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks;
}

export function splitTranslationSegments(text, maxBytes = MYMEMORY_MAX_SEGMENT_BYTES) {
  if (byteLength(text) <= maxBytes) return [text];
  const words = text.trim().split(/\s+/).flatMap((word) => (
    byteLength(word) > maxBytes ? splitLongToken(word, maxBytes) : [word]
  ));
  const segments = [];
  let segment = "";
  words.forEach((word) => {
    const candidate = segment ? `${segment} ${word}` : word;
    if (segment && byteLength(candidate) > maxBytes) {
      segments.push(segment);
      segment = word;
    } else {
      segment = candidate;
    }
  });
  if (segment) segments.push(segment);
  return segments;
}

function decodeCommonEntities(value) {
  return value
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}

function delayRangeForScenario(scenario) {
  return TRANSLATION_DELAY_RANGES_MS[scenario] ?? DEFAULT_TRANSLATION_DELAY_RANGE_MS;
}

function randomDelay({ min, max }) {
  return Math.round(min + Math.random() * (max - min));
}

function wait(delayMs) {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

async function translateSegmentWithMyMemory(text, sourceLanguage, targetLanguage) {
  const url = new URL(MYMEMORY_ENDPOINT);
  url.searchParams.set("q", text);
  url.searchParams.set("langpair", `${sourceLanguage}|${targetLanguage}`);
  url.searchParams.set("mt", "1");
  const response = await fetch(url, {
    headers: { accept: "application/json" },
  });
  const payload = await response.json().catch(() => null);
  const responseStatus = Number(payload?.responseStatus ?? response.status);
  const translatedText = payload?.responseData?.translatedText;
  if (!response.ok || responseStatus >= 400 || typeof translatedText !== "string" || !translatedText.trim()) {
    throw new Error(payload?.responseDetails || `MyMemory returned ${responseStatus || response.status}`);
  }
  return decodeCommonEntities(translatedText.trim());
}

export async function translateWithMyMemory({ text, sourceLanguage, targetLanguage }) {
  const segments = splitTranslationSegments(text);
  const translations = [];
  for (const segment of segments) {
    translations.push(await translateSegmentWithMyMemory(segment, sourceLanguage, targetLanguage));
  }
  return {
    translatedText: translations.join(" "),
    upstreamRequestCount: segments.length,
  };
}

export async function handleTranslateRequest(request) {
  if (request.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Некорректный JSON" }, 400);
  }

  const text = typeof body?.text === "string" ? body.text.trim() : "";
  const sourceLanguage = typeof body?.sourceLanguage === "string" ? body.sourceLanguage : "";
  const targetLanguage = typeof body?.targetLanguage === "string" ? body.targetLanguage : "";
  if (!text || !sourceLanguage || !targetLanguage) {
    return jsonResponse({ error: "Нужны text, sourceLanguage и targetLanguage" }, 400);
  }
  if (sourceLanguage === targetLanguage) {
    return jsonResponse({
      translatedText: text,
      provider: "mymemory",
      upstreamRequestCount: 0,
      durationMs: 0,
      artificialDelayMs: 0,
    });
  }

  const requestId = ++serverRequestCount;
  const startedAt = Date.now();
  const artificialDelayMs = randomDelay(delayRangeForScenario(body?.delayScenario));
  try {
    const result = await translateWithMyMemory({ text, sourceLanguage, targetLanguage });
    await wait(artificialDelayMs);
    const durationMs = Date.now() - startedAt;
    console.info(`[translation:server] request #${requestId} completed in ${durationMs}ms`, {
      sourceLanguage,
      targetLanguage,
      upstreamRequests: result.upstreamRequestCount,
      artificialDelayMs,
    });
    return jsonResponse({
      ...result,
      provider: "mymemory",
      durationMs,
      artificialDelayMs,
    });
  } catch (error) {
    await wait(artificialDelayMs);
    const durationMs = Date.now() - startedAt;
    const message = error instanceof Error ? error.message : "MyMemory translation failed";
    console.error(`[translation:server] request #${requestId} failed in ${durationMs}ms`, { message });
    return jsonResponse({ error: message, durationMs, artificialDelayMs }, 502);
  }
}
