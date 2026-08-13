import { describe, expect, it } from "vitest";
import { TAKEN_STORE_ADDRESSES, validateFirstPublishAddress } from "./first-publish-address";

describe("first publish store address validation", () => {
  it.each(["cafe", "cafe24", "my-shop", "Restaurant-2"])("accepts %s", (value) => {
    expect(validateFirstPublishAddress(value)).toBeNull();
  });

  it("returns one relevant format error", () => {
    expect(validateFirstPublishAddress("ab")).toBe("Минимум 3 символа");
    expect(validateFirstPublishAddress("кафе")).toBe("Используйте только латинские буквы, цифры и дефис");
    expect(validateFirstPublishAddress("my cafe")).toBe("Используйте только латинские буквы, цифры и дефис");
    expect(validateFirstPublishAddress("cafe_1")).toBe("Используйте только латинские буквы, цифры и дефис");
    expect(validateFirstPublishAddress("café")).toBe("Используйте только латинские буквы, цифры и дефис");
  });

  it.each(TAKEN_STORE_ADDRESSES)("rejects the occupied address %s", (value) => {
    expect(validateFirstPublishAddress(value)).toBe("Адрес уже занят. Попробуйте другой");
  });
});
