import { afterEach, describe, expect, it, vi } from "vitest";
import {
  handleTranslateRequest,
  splitTranslationSegments,
  translateWithMyMemory,
} from "../../../server/translation-service.mjs";

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("server translation service", () => {
  it("splits long UTF-8 fields into MyMemory-safe segments", () => {
    const segments = splitTranslationSegments("Очень длинное описание блюда ".repeat(30), 120);

    expect(segments.length).toBeGreaterThan(1);
    expect(segments.every((segment) => new TextEncoder().encode(segment).length <= 120)).toBe(true);
  });

  it("uses MyMemory once per segment and keeps the provider behind the service", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      return new Response(JSON.stringify({
        responseStatus: 200,
        responseData: { translatedText: `EN: ${url.searchParams.get("q")}` },
      }), { status: 200, headers: { "content-type": "application/json" } });
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await translateWithMyMemory({
      text: "Название блюда",
      sourceLanguage: "ru",
      targetLanguage: "en",
    });

    expect(result).toEqual({ translatedText: "EN: Название блюда", upstreamRequestCount: 1 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(String(fetchMock.mock.calls[0]?.[0]));
    expect(requestUrl.searchParams.get("langpair")).toBe("ru|en");
  });

  it("applies the default artificial delay at the server endpoint", async () => {
    vi.useFakeTimers();
    vi.spyOn(Math, "random").mockReturnValue(0);
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      responseStatus: 200,
      responseData: { translatedText: "Coffee" },
    }), { status: 200, headers: { "content-type": "application/json" } })));

    const responsePromise = handleTranslateRequest(new Request("http://localhost/api/translate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text: "Кофе", sourceLanguage: "ru", targetLanguage: "en" }),
    }));
    await vi.runAllTimersAsync();
    const response = await responsePromise;
    const payload = await response.json() as { translatedText: string; artificialDelayMs: number };

    expect(response.status).toBe(200);
    expect(payload).toMatchObject({ translatedText: "Coffee", artificialDelayMs: 800 });
  });
});
