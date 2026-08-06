import { useEffect, useMemo, useRef, useState, type ClipboardEvent } from "react";
import { ChevronDown, Globe2, Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { useMockAuth } from "@/contexts/mock-auth-context";
import { cn } from "@/lib/utils";

type CountryOption = {
  code: "KZ" | "RS" | "RU" | "KG" | "UZ";
  name: string;
  dialCode: string;
  digits: number;
  groups: number[];
  mask: string;
  flag: string;
};

const COUNTRIES: CountryOption[] = [
  { code: "KZ", name: "Казахстан", dialCode: "+7", digits: 10, groups: [3, 3, 2, 2], mask: "(000) 000-00-00", flag: "/flags/kz.png" },
  { code: "RS", name: "Сербия", dialCode: "+381", digits: 9, groups: [2, 3, 2, 2], mask: "(00) 000-00-00", flag: "/flags/rs.png" },
  { code: "RU", name: "Россия", dialCode: "+7", digits: 10, groups: [3, 3, 2, 2], mask: "(000) 000-00-00", flag: "/flags/ru.png" },
  { code: "KG", name: "Кыргызстан", dialCode: "+996", digits: 9, groups: [3, 3, 3], mask: "(000) 000-000", flag: "/flags/kg.png" },
  { code: "UZ", name: "Узбекистан", dialCode: "+998", digits: 9, groups: [2, 3, 2, 2], mask: "(00) 000-00-00", flag: "/flags/uz.png" },
];

function defaultCountry() {
  const hostname = window.location.hostname.toLowerCase();
  return COUNTRIES.find(({ code }) => code === (hostname === "tsqr.app" || hostname.endsWith(".tsqr.app") ? "RS" : "KZ")) ?? COUNTRIES[0];
}

function formatNationalNumber(digits: string, groups: number[]) {
  if (!digits) return "";
  const first = digits.slice(0, groups[0]);
  let result = `(${first}`;
  if (first.length === groups[0]) result += ")";
  let offset = groups[0];
  groups.slice(1).forEach((size, index) => {
    const part = digits.slice(offset, offset + size);
    if (!part) return;
    result += `${index === 0 ? " " : "-"}${part}`;
    offset += size;
  });
  return result;
}

function fillPhoneMask(digits: string, mask: string) {
  let slotIndex = 0;
  let splitAt = 0;
  let value = "";
  for (const character of mask) {
    if (character === "0") {
      const digit = digits[slotIndex];
      value += digit ?? "0";
      slotIndex += 1;
      if (digit != null) splitAt = value.length;
    } else {
      value += character;
    }
  }
  return { filled: digits ? value.slice(0, splitAt) : "", remaining: digits ? value.slice(splitAt) : value };
}

function detectCountry(rawDigits: string, currentCountry?: CountryOption) {
  const candidates = COUNTRIES.filter((item) => rawDigits.startsWith(item.dialCode.replace(/\D/g, "")));
  if (!candidates.length) return null;
  const longest = Math.max(...candidates.map((item) => item.dialCode.replace(/\D/g, "").length));
  const matches = candidates.filter((item) => item.dialCode.replace(/\D/g, "").length === longest);
  if (matches.length === 1) return matches[0];
  if (matches.every(({ dialCode }) => dialCode === "+7")) {
    const firstNationalDigit = rawDigits.slice(1, 2);
    if (firstNationalDigit === "6" || firstNationalDigit === "7") return COUNTRIES.find(({ code }) => code === "KZ") ?? null;
    if (firstNationalDigit) return COUNTRIES.find(({ code }) => code === "RU") ?? null;
    return currentCountry?.dialCode === "+7" ? currentCountry : null;
  }
  return null;
}

function initialPhoneState(value: string) {
  const digits = value.replace(/\D/g, "");
  const country = detectCountry(digits) ?? defaultCountry();
  const dialDigits = country.dialCode.replace(/\D/g, "");
  const recognized = !value || digits.startsWith(dialDigits);
  return {
    country,
    nationalNumber: recognized ? digits.slice(dialDigits.length, dialDigits.length + country.digits) : "",
    internationalDraft: recognized ? null : value,
  };
}

export function AuthPhoneField({
  id,
  initialValue = "",
  disabled = false,
  onValueChange,
}: {
  id: string;
  initialValue?: string;
  disabled?: boolean;
  onValueChange: (value: string, valid: boolean) => void;
}) {
  const { validateAuthContact } = useMockAuth();
  const initial = useMemo(() => initialPhoneState(initialValue), [initialValue]);
  const [countryCode, setCountryCode] = useState<CountryOption["code"]>(initial.country.code);
  const [nationalNumber, setNationalNumber] = useState(initial.nationalNumber);
  const [internationalDraft, setInternationalDraft] = useState<string | null>(initial.internationalDraft);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [touched, setTouched] = useState(false);
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const countryPopoverRef = useRef<HTMLDivElement>(null);
  const onValueChangeRef = useRef(onValueChange);
  const country = COUNTRIES.find((item) => item.code === countryCode) ?? COUNTRIES[0];
  const normalizedPhone = internationalDraft === null ? `${country.dialCode}${nationalNumber}` : internationalDraft;
  const validation = validateAuthContact(normalizedPhone, "phone");
  const valid = validation.ok && internationalDraft === null && nationalNumber.length === country.digits;
  const formattedPhone = formatNationalNumber(nationalNumber, country.groups);
  const phoneMask = fillPhoneMask(nationalNumber, country.mask);
  const editablePhone = internationalDraft ?? `${country.dialCode}${formattedPhone ? ` ${formattedPhone}` : ""}`;
  const phoneVisual = internationalDraft !== null
    ? { filled: internationalDraft, remaining: "" }
    : { filled: `${country.dialCode}${phoneMask.filled ? ` ${phoneMask.filled}` : " "}`, remaining: phoneMask.remaining };
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLocaleLowerCase("ru");
    return query ? COUNTRIES.filter((item) => `${item.name} ${item.code} ${item.dialCode}`.toLocaleLowerCase("ru").includes(query)) : COUNTRIES;
  }, [countrySearch]);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    onValueChangeRef.current(normalizedPhone, valid);
  }, [normalizedPhone, valid]);

  useEffect(() => {
    if (!countryOpen) return;
    const close = (event: PointerEvent) => {
      if (!countryPopoverRef.current?.contains(event.target as Node)) setCountryOpen(false);
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [countryOpen]);

  const setPhoneDigits = (digits: string, nextCountry: CountryOption = country) => {
    setInternationalDraft(null);
    setCountryCode(nextCountry.code);
    setNationalNumber(digits.slice(0, nextCountry.digits));
    setTouched(false);
  };

  const applyInternationalNumber = (rawValue: string) => {
    const rawDigits = rawValue.replace(/\D/g, "");
    const detected = detectCountry(rawDigits, internationalDraft === null ? country : undefined);
    if (!detected) return false;
    const dialDigits = detected.dialCode.replace(/\D/g, "");
    setPhoneDigits(rawDigits.slice(dialDigits.length), detected);
    return true;
  };

  const handleInput = (rawValue: string) => {
    if (!rawValue) {
      setInternationalDraft("");
      setNationalNumber("");
      setTouched(false);
      return;
    }
    const normalizedDraft = rawValue.trim().startsWith("+")
      ? `+${rawValue.replace(/\+/g, "").replace(/[^\d\s()-]/g, "")}`
      : rawValue.replace(/[^\d\s()-]/g, "");
    if (applyInternationalNumber(normalizedDraft)) return;
    setInternationalDraft(normalizedDraft.startsWith("+") ? normalizedDraft : `+${normalizedDraft.replace(/\D/g, "")}`);
    setNationalNumber("");
    setTouched(false);
  };

  const handlePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const digits = event.clipboardData.getData("text").replace(/\D/g, "");
    if (!digits) return;
    event.preventDefault();
    const value = `+${digits}`;
    if (!applyInternationalNumber(value)) {
      setInternationalDraft(value);
      setNationalNumber("");
    }
  };

  return (
    <div>
      <div
        ref={countryPopoverRef}
        className={cn(
          "relative flex h-[52px] items-center rounded-[12px] border bg-[#f5f5f4] px-[6px] transition",
          touched && !valid
            ? "border-rose-500 ring-2 ring-rose-500/15"
            : "border-[#d6d3d1] focus-within:border-[#4f39f6] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#4f39f6]/15",
          disabled && "cursor-wait opacity-70",
        )}
      >
        <button
          type="button"
          aria-label={`Страна: ${country.name} ${country.dialCode}`}
          aria-expanded={countryOpen}
          disabled={disabled}
          onClick={() => { setCountryOpen((open) => !open); setCountrySearch(""); }}
          className="flex h-10 w-[58px] shrink-0 items-center justify-center gap-1 rounded-[7px] bg-[#e7e5e4] transition hover:bg-[#ddd9d7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
        >
          {internationalDraft === null ? <img src={country.flag} alt="" className="size-7 rounded-full object-cover" /> : <Globe2 size={22} className="text-[#79716b]" aria-hidden="true" />}
          <ChevronDown size={13} className="text-[#79716b]" aria-hidden="true" />
        </button>
        <div className="relative ml-[7px] h-10 min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-1.5 text-[16px] font-semibold leading-6" aria-hidden="true">
            <span className="text-[#292524]">{phoneVisual.filled}</span>
            <span className="text-[#a6a09b]">{phoneVisual.remaining}</span>
          </div>
          <Input
            ref={phoneInputRef}
            id={id}
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            disabled={disabled}
            value={editablePhone}
            onChange={(event) => handleInput(event.target.value)}
            onPaste={handlePaste}
            onBlur={() => setTouched(Boolean(normalizedPhone.replace(/\D/g, "")))}
            className={cn("h-10 min-w-0 border-0 bg-transparent px-1.5 text-[16px] font-semibold text-transparent shadow-none caret-[#4f39f6] focus-visible:ring-0", editablePhone && "pr-10")}
            aria-invalid={touched && !valid}
            aria-describedby={touched && !valid ? `${id}-error` : undefined}
          />
          {editablePhone && (
            <button
              type="button"
              aria-label="Очистить номер"
              disabled={disabled}
              onClick={() => { setInternationalDraft(""); setNationalNumber(""); setTouched(false); window.requestAnimationFrame(() => phoneInputRef.current?.focus()); }}
              className="absolute right-0 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#e7e5e4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
            >
              <X size={18} aria-hidden="true" />
            </button>
          )}
        </div>

        {countryOpen && (
          <div role="listbox" aria-label="Страна" className="absolute left-0 right-0 top-[58px] z-30 overflow-hidden rounded-[12px] border border-[#d6d3d1] bg-white p-2 shadow-lg">
            <div className="flex h-10 items-center gap-2 rounded-[8px] bg-[#f5f5f4] px-3 focus-within:ring-2 focus-within:ring-[#4f39f6]/20">
              <Search size={16} className="shrink-0 text-[#79716b]" aria-hidden="true" />
              <input autoFocus value={countrySearch} onChange={(event) => setCountrySearch(event.target.value)} placeholder="Страна или код" aria-label="Страна или код" className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#a6a09b]" />
            </div>
            <div className="mt-1 max-h-48 overflow-y-auto">
              {filteredCountries.map((item) => (
                <button key={item.code} type="button" role="option" aria-selected={item.code === country.code} onClick={() => { setPhoneDigits(nationalNumber, item); setCountryOpen(false); setCountrySearch(""); window.requestAnimationFrame(() => phoneInputRef.current?.focus()); }} className={cn("flex min-h-11 w-full items-center gap-3 rounded-[8px] px-2 text-left transition hover:bg-[#f5f5f4]", item.code === country.code && "bg-[#f5f5f4]")}>
                  <img src={item.flag} alt="" className="h-6 w-8 rounded-[4px] object-cover" />
                  <span className="min-w-0 flex-1 truncate text-[14px] font-medium">{item.name}</span>
                  <span className="text-[14px] text-[#79716b]">{item.dialCode}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      {touched && !valid && <p id={`${id}-error`} role="alert" className="mt-2 text-[13px] leading-5 text-rose-600">Введите полный номер телефона</p>}
    </div>
  );
}
