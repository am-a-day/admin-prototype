import { describe, expect, it } from "vitest";
import {
  buildMockCatalogTitleTranslations,
  getCatalogTitleForLanguage,
} from "./mock-catalog-translations";

describe("mock catalog translations", () => {
  it("fills every menu language while preserving existing translations", () => {
    expect(buildMockCatalogTitleTranslations(
      "Борщ",
      "ru",
      ["ru", "en", "kk"],
      { ru: "Борщ", en: "Borscht" },
    )).toEqual({ ru: "Борщ", en: "Borscht", kk: "Борщ" });
  });

  it("uses the non-Russian primary language as the source", () => {
    expect(buildMockCatalogTitleTranslations("Coffee", "en", ["en", "sr"]))
      .toEqual({ en: "Coffee", sr: "Coffee" });
  });

  it("resolves the guest language and falls back to the primary language", () => {
    const translations = { ru: "Борщ", en: "Borscht" };
    expect(getCatalogTitleForLanguage("Борщ", translations, "en", "ru")).toBe("Borscht");
    expect(getCatalogTitleForLanguage("Борщ", translations, "kk", "ru")).toBe("Борщ");
  });
});
