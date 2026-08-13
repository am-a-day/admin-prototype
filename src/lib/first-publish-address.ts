export const TAKEN_STORE_ADDRESSES = [
  "demo",
  "my-cafe",
  "restaurant-1",
  "astana-food",
  "coffee-point",
] as const;

export type StoreAddressError =
  | "Минимум 3 символа"
  | "Используйте только латинские буквы, цифры и дефис"
  | "Адрес уже занят. Попробуйте другой";

const STORE_ADDRESS_PATTERN = /^[A-Za-z0-9-]+$/;
const TAKEN_STORE_ADDRESS_SET = new Set<string>(TAKEN_STORE_ADDRESSES);

export function validateFirstPublishAddress(value: string): StoreAddressError | null {
  const address = value.trim();

  if (address.length < 3) return "Минимум 3 символа";
  if (!STORE_ADDRESS_PATTERN.test(address)) {
    return "Используйте только латинские буквы, цифры и дефис";
  }
  if (TAKEN_STORE_ADDRESS_SET.has(address.toLowerCase())) {
    return "Адрес уже занят. Попробуйте другой";
  }

  return null;
}
