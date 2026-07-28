import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ClipboardEvent,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  ChevronDown,
  Eye,
  EyeOff,
  Globe2,
  KeyRound,
  LoaderCircle,
  Pencil,
  Search,
  X,
} from "lucide-react";
import { ChatTeardropDots, TelegramLogo, WhatsappLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useMockAuth } from "@/contexts/mock-auth-context";
import type { LanguageCode } from "@/data/languages";
import { trackAuthEvent } from "@/lib/auth-analytics";
import { cn } from "@/lib/utils";

type AuthStep = "phone" | "code" | "password";
type PhoneChannel = "whatsapp" | "telegram" | "sms";
type AuthMethod = PhoneChannel | "password";
type CodeState = "idle" | "verifying" | "incorrect" | "expired" | "not-sent";
type AuthLocale = Extract<LanguageCode, "ru" | "kk" | "en">;

type CountryOption = {
  code: "KZ" | "RS" | "RU" | "KG" | "UZ";
  names: Record<AuthLocale, string>;
  dialCode: string;
  digits: number;
  groups: number[];
  mask: string;
  flag: string;
};

type AuthCopy = {
  title: string;
  subtitle: string;
  phoneLabel: string;
  countryLabel: string;
  countrySearch: string;
  noCountries: string;
  clearNumber: string;
  sending: string;
  phoneError: string;
  deliveryError: string;
  otherMethods: string;
  methodLabels: Record<AuthMethod, string>;
  channelNames: Record<PhoneChannel, string>;
  retryIn: string;
  legalPrefix: string;
  agreement: string;
  legalJoin: string;
  privacy: string;
  passwordTitle: string;
  passwordFor: string;
  passwordPlaceholder: string;
  showPassword: string;
  hidePassword: string;
  signIn: string;
  signingIn: string;
  forgotPassword: string;
  incorrectPassword: string;
  accountNotFound: string;
  passwordNotSet: string;
  codeTitle: string;
  sentVia: Record<PhoneChannel, string>;
  editNumber: string;
  codeLabel: string;
  codeIncomplete: string;
  codeNotSent: string;
  codeExpired: string;
  codeIncorrect: string;
  verifyingCode: string;
  resendQuestion: string;
  resendIn: string;
  resend: string;
  resending: string;
};

const COUNTRIES: CountryOption[] = [
  {
    code: "KZ",
    names: { ru: "Казахстан", kk: "Қазақстан", en: "Kazakhstan" },
    dialCode: "+7",
    digits: 10,
    groups: [3, 3, 2, 2],
    mask: "(000) 000-00-00",
    flag: "/flags/kz.png",
  },
  {
    code: "RS",
    names: { ru: "Сербия", kk: "Сербия", en: "Serbia" },
    dialCode: "+381",
    digits: 9,
    groups: [2, 3, 2, 2],
    mask: "(00) 000-00-00",
    flag: "/flags/rs.png",
  },
  {
    code: "RU",
    names: { ru: "Россия", kk: "Ресей", en: "Russia" },
    dialCode: "+7",
    digits: 10,
    groups: [3, 3, 2, 2],
    mask: "(000) 000-00-00",
    flag: "/flags/ru.png",
  },
  {
    code: "KG",
    names: { ru: "Кыргызстан", kk: "Қырғызстан", en: "Kyrgyzstan" },
    dialCode: "+996",
    digits: 9,
    groups: [3, 3, 3],
    mask: "(000) 000-000",
    flag: "/flags/kg.png",
  },
  {
    code: "UZ",
    names: { ru: "Узбекистан", kk: "Өзбекстан", en: "Uzbekistan" },
    dialCode: "+998",
    digits: 9,
    groups: [2, 3, 2, 2],
    mask: "(00) 000-00-00",
    flag: "/flags/uz.png",
  },
];

const PHONE_CHANNELS: PhoneChannel[] = ["whatsapp", "telegram", "sms"];
const AUTH_METHODS: AuthMethod[] = [...PHONE_CHANNELS, "password"];
const RESEND_SECONDS = 30;
const CODE_EXPIRES_MS = 5 * 60 * 1000;
const LAST_SUCCESSFUL_METHOD_KEY = "tasko.auth.lastSuccessfulChannel.v1";

const AUTH_COPY: Record<AuthLocale, AuthCopy> = {
  ru: {
    title: "Войти или создать аккаунт",
    subtitle: "Если аккаунта ещё нет, создадим его автоматически",
    phoneLabel: "Номер телефона",
    countryLabel: "Выбрать страну",
    countrySearch: "Страна или код",
    noCountries: "Ничего не найдено",
    clearNumber: "Очистить номер",
    sending: "Отправляем код",
    phoneError: "Введите полный номер телефона",
    deliveryError: "Не удалось отправить код по SMS. Выберите другой способ",
    otherMethods: "Другие способы входа",
    methodLabels: {
      whatsapp: "Продолжить с WhatsApp",
      telegram: "Продолжить с Telegram",
      sms: "Продолжить по SMS",
      password: "Войти по паролю",
    },
    channelNames: {
      whatsapp: "WhatsApp",
      telegram: "Telegram",
      sms: "SMS",
    },
    retryIn: "повторно через",
    legalPrefix: "Продолжая, вы принимаете",
    agreement: "пользовательское соглашение",
    legalJoin: "и",
    privacy: "политику конфиденциальности",
    passwordTitle: "Введите пароль для входа",
    passwordFor: "Для номера",
    passwordPlaceholder: "Пароль",
    showPassword: "Показать пароль",
    hidePassword: "Скрыть пароль",
    signIn: "Войти",
    signingIn: "Входим",
    forgotPassword: "Забыли или не установили пароль?",
    incorrectPassword: "Неверный пароль",
    accountNotFound: "Аккаунт с таким номером не найден. Войдите по коду, чтобы создать его",
    passwordNotSet: "Для этого аккаунта не установлен пароль. Войдите по коду",
    codeTitle: "Введите код",
    sentVia: {
      whatsapp: "Отправили код в WhatsApp на",
      telegram: "Отправили код в Telegram на",
      sms: "Отправили код по SMS на",
    },
    editNumber: "Изменить номер телефона",
    codeLabel: "Одноразовый код",
    codeIncomplete: "Введите полный шестизначный код",
    codeNotSent: "Код не был отправлен. Выберите другой способ входа",
    codeExpired: "Срок действия кода истёк. Отправьте новый код",
    codeIncorrect: "Неверный код. Проверьте цифры и попробуйте ещё раз",
    verifyingCode: "Проверяем код",
    resendQuestion: "Не пришёл код?",
    resendIn: "Отправить повторно через",
    resend: "Отправить повторно",
    resending: "Отправляем повторно",
  },
  kk: {
    title: "Кіру немесе аккаунт жасау",
    subtitle: "Егер аккаунт әлі жоқ болса, оны автоматты түрде жасаймыз",
    phoneLabel: "Телефон нөмірі",
    countryLabel: "Елді таңдау",
    countrySearch: "Ел немесе код",
    noCountries: "Ештеңе табылмады",
    clearNumber: "Нөмірді тазарту",
    sending: "Код жіберілуде",
    phoneError: "Телефон нөмірін толық енгізіңіз",
    deliveryError: "SMS арқылы код жіберілмеді. Басқа тәсілді таңдаңыз",
    otherMethods: "Кірудің басқа тәсілдері",
    methodLabels: {
      whatsapp: "WhatsApp арқылы жалғастыру",
      telegram: "Telegram арқылы жалғастыру",
      sms: "SMS арқылы жалғастыру",
      password: "Құпиясөзбен кіру",
    },
    channelNames: {
      whatsapp: "WhatsApp",
      telegram: "Telegram",
      sms: "SMS",
    },
    retryIn: "қайта жіберу",
    legalPrefix: "Жалғастыра отырып, сіз",
    agreement: "пайдаланушы келісімін",
    legalJoin: "және",
    privacy: "құпиялылық саясатын қабылдайсыз",
    passwordTitle: "Кіру үшін құпиясөзді енгізіңіз",
    passwordFor: "Нөмір үшін",
    passwordPlaceholder: "Құпиясөз",
    showPassword: "Құпиясөзді көрсету",
    hidePassword: "Құпиясөзді жасыру",
    signIn: "Кіру",
    signingIn: "Кіру орындалуда",
    forgotPassword: "Құпиясөзді ұмыттыңыз немесе орнатпадыңыз ба?",
    incorrectPassword: "Құпиясөз қате",
    accountNotFound: "Бұл нөмірмен аккаунт табылмады. Оны жасау үшін кодпен кіріңіз",
    passwordNotSet: "Бұл аккаунт үшін құпиясөз орнатылмаған. Кодпен кіріңіз",
    codeTitle: "Кодты енгізіңіз",
    sentVia: {
      whatsapp: "WhatsApp арқылы код жіберілді:",
      telegram: "Telegram арқылы код жіберілді:",
      sms: "SMS арқылы код жіберілді:",
    },
    editNumber: "Телефон нөмірін өзгерту",
    codeLabel: "Бір реттік код",
    codeIncomplete: "Алты таңбалы кодты толық енгізіңіз",
    codeNotSent: "Код жіберілмеді. Басқа кіру тәсілін таңдаңыз",
    codeExpired: "Кодтың мерзімі аяқталды. Жаңа код жіберіңіз",
    codeIncorrect: "Код қате. Сандарды тексеріп, қайталап көріңіз",
    verifyingCode: "Код тексерілуде",
    resendQuestion: "Код келмеді ме?",
    resendIn: "Қайта жіберу:",
    resend: "Қайта жіберу",
    resending: "Қайта жіберілуде",
  },
  en: {
    title: "Sign in or create an account",
    subtitle: "If you don't have an account yet, we'll create one automatically",
    phoneLabel: "Phone number",
    countryLabel: "Choose country",
    countrySearch: "Country or code",
    noCountries: "Nothing found",
    clearNumber: "Clear number",
    sending: "Sending code",
    phoneError: "Enter a complete phone number",
    deliveryError: "We couldn't send the code via SMS. Choose another method",
    otherMethods: "Other sign-in methods",
    methodLabels: {
      whatsapp: "Continue with WhatsApp",
      telegram: "Continue with Telegram",
      sms: "Continue via SMS",
      password: "Sign in with password",
    },
    channelNames: {
      whatsapp: "WhatsApp",
      telegram: "Telegram",
      sms: "SMS",
    },
    retryIn: "retry in",
    legalPrefix: "By continuing, you accept the",
    agreement: "user agreement",
    legalJoin: "and",
    privacy: "privacy policy",
    passwordTitle: "Enter your password",
    passwordFor: "For number",
    passwordPlaceholder: "Password",
    showPassword: "Show password",
    hidePassword: "Hide password",
    signIn: "Sign in",
    signingIn: "Signing in",
    forgotPassword: "Forgot or haven't set a password?",
    incorrectPassword: "Incorrect password",
    accountNotFound: "No account was found for this number. Sign in with a code to create it",
    passwordNotSet: "This account doesn't have a password. Sign in with a code",
    codeTitle: "Enter the code",
    sentVia: {
      whatsapp: "We sent a code via WhatsApp to",
      telegram: "We sent a code via Telegram to",
      sms: "We sent a code via SMS to",
    },
    editNumber: "Edit phone number",
    codeLabel: "One-time code",
    codeIncomplete: "Enter the complete six-digit code",
    codeNotSent: "The code wasn't sent. Choose another sign-in method",
    codeExpired: "The code has expired. Send a new code",
    codeIncorrect: "Incorrect code. Check the digits and try again",
    verifyingCode: "Verifying code",
    resendQuestion: "Didn't receive the code?",
    resendIn: "Resend in",
    resend: "Resend",
    resending: "Resending",
  },
};

function defaultCountryCode(): CountryOption["code"] {
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "tsqr.app" || hostname.endsWith(".tsqr.app") ? "RS" : "KZ";
}

function readLastSuccessfulMethod(): AuthMethod {
  const stored = window.localStorage.getItem(LAST_SUCCESSFUL_METHOD_KEY);
  return stored === "telegram" ||
    stored === "sms" ||
    stored === "whatsapp" ||
    stored === "password"
    ? stored
    : "whatsapp";
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
  return {
    filled: digits ? value.slice(0, splitAt) : "",
    remaining: digits ? value.slice(splitAt) : value,
  };
}

function caretPositionForDigitCount(formatted: string, digitCount: number) {
  if (digitCount <= 0) return 0;
  let seen = 0;
  for (let index = 0; index < formatted.length; index += 1) {
    if (/\d/.test(formatted[index])) seen += 1;
    if (seen === digitCount) return index + 1;
  }
  return formatted.length;
}

function formatCooldown(seconds: number) {
  return `0:${String(seconds).padStart(2, "0")}`;
}

function detectCountryFromInternationalDigits(
  rawDigits: string,
  currentCountry?: CountryOption,
): CountryOption | null {
  const candidates = COUNTRIES.filter((item) =>
    rawDigits.startsWith(item.dialCode.replace(/\D/g, "")),
  );
  if (!candidates.length) return null;

  const longestDialLength = Math.max(
    ...candidates.map((item) => item.dialCode.replace(/\D/g, "").length),
  );
  const longestCandidates = candidates.filter(
    (item) => item.dialCode.replace(/\D/g, "").length === longestDialLength,
  );
  if (longestCandidates.length === 1) return longestCandidates[0];

  if (longestCandidates.every(({ dialCode }) => dialCode === "+7")) {
    const nationalFirstDigit = rawDigits.slice(1, 2);
    if (nationalFirstDigit === "6" || nationalFirstDigit === "7") {
      return COUNTRIES.find(({ code }) => code === "KZ") ?? null;
    }
    if (nationalFirstDigit) {
      return COUNTRIES.find(({ code }) => code === "RU") ?? null;
    }
    return currentCountry?.dialCode === "+7" ? currentCountry : null;
  }

  return null;
}

function displayPhone(contact: string, country: CountryOption) {
  const allDigits = contact.replace(/\D/g, "");
  const dialDigits = country.dialCode.replace(/\D/g, "");
  const national = allDigits.startsWith(dialDigits)
    ? allDigits.slice(dialDigits.length)
    : allDigits;
  return `${country.dialCode} ${formatNationalNumber(national, country.groups)}`;
}

function localizePasswordError(error: string, copy: AuthCopy) {
  const normalized = error.toLowerCase();
  if (normalized.includes("не найден")) return copy.accountNotFound;
  if (normalized.includes("не настроен") || normalized.includes("не установлен")) {
    return copy.passwordNotSet;
  }
  return copy.incorrectPassword;
}

function MethodIcon({ method, size = 22 }: { method: AuthMethod; size?: number }) {
  if (method === "whatsapp") {
    return <WhatsappLogo size={size} weight="fill" aria-hidden="true" />;
  }
  if (method === "telegram") {
    return <TelegramLogo size={size} weight="fill" aria-hidden="true" />;
  }
  if (method === "sms") {
    return <ChatTeardropDots size={size} weight="fill" aria-hidden="true" />;
  }
  return <KeyRound size={size} aria-hidden="true" />;
}

function LanguageSwitcher({
  locale,
  setLanguage,
}: {
  locale: AuthLocale;
  setLanguage: (language: LanguageCode) => void;
}) {
  return (
    <nav
      aria-label="Language"
      className="flex shrink-0 justify-center gap-5 pb-[34px] text-[13px] font-medium"
    >
      {([
        ["kk", "Қазақша"],
        ["ru", "Русский"],
        ["en", "English"],
      ] as const).map(([code, label]) => (
        <button
          key={code}
          type="button"
          onClick={() => setLanguage(code)}
          aria-current={locale === code ? "true" : undefined}
          className={cn(
            "min-h-8 rounded-sm px-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]",
            locale === code ? "text-black" : "text-[#a6a09b] hover:text-[#79716b]",
          )}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

function AuthLayout({
  children,
  locale,
  setLanguage,
}: {
  children: ReactNode;
  locale: AuthLocale;
  setLanguage: (language: LanguageCode) => void;
}) {
  return (
    <main className="min-h-[100dvh] overflow-y-auto bg-white text-[#1c1917]">
      <div className="flex min-h-[100dvh] flex-col px-4">
        <header className="flex shrink-0 justify-center pt-[34px]">
          <TaskoLogo className="h-auto w-[95px] text-black" />
        </header>
        <div className="flex flex-1 items-center justify-center py-10">{children}</div>
        <LanguageSwitcher locale={locale} setLanguage={setLanguage} />
      </div>
    </main>
  );
}

export function AuthScreen() {
  const { uiLanguage, setUiLanguage } = useAppSettings();
  const { validateAuthContact, verifyCode, loginWithPassword } = useMockAuth();
  const [step, setStep] = useState<AuthStep>("phone");
  const [countryCode, setCountryCode] =
    useState<CountryOption["code"]>(defaultCountryCode);
  const [nationalNumber, setNationalNumber] = useState("");
  const [internationalDraft, setInternationalDraft] = useState<string | null>(null);
  const [countryOpen, setCountryOpen] = useState(false);
  const [countrySearch, setCountrySearch] = useState("");
  const [showAllMethods, setShowAllMethods] = useState(false);
  const [pendingContact, setPendingContact] = useState("");
  const [channel, setChannel] = useState<PhoneChannel>("whatsapp");
  const [primaryMethod, setPrimaryMethod] =
    useState<AuthMethod>(readLastSuccessfulMethod);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [cooldownEnds, setCooldownEnds] = useState<Record<PhoneChannel, number>>({
    whatsapp: 0,
    telegram: 0,
    sms: 0,
  });
  const [clock, setClock] = useState(Date.now);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [sendingChannel, setSendingChannel] = useState<PhoneChannel | null>(null);
  const completedPhoneRef = useRef("");
  const phoneInputRef = useRef<HTMLInputElement>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);
  const countryPopoverRef = useRef<HTMLDivElement>(null);
  const pendingCaretDigitsRef = useRef<number | null>(null);
  const pendingCaretPositionRef = useRef<number | null>(null);
  const focusPhoneOnReturnRef = useRef(false);

  const country = COUNTRIES.find((item) => item.code === countryCode) ?? COUNTRIES[0];
  const authLocale: AuthLocale =
    uiLanguage === "kk" || uiLanguage === "en" ? uiLanguage : "ru";
  const copy = AUTH_COPY[authLocale];
  const normalizedPhone =
    internationalDraft === null ? `${country.dialCode}${nationalNumber}` : "";
  const formattedPhone = formatNationalNumber(nationalNumber, country.groups);
  const phoneMask = fillPhoneMask(nationalNumber, country.mask);
  const editablePhone =
    internationalDraft ??
    `${country.dialCode}${formattedPhone ? ` ${formattedPhone}` : ""}`;
  const phoneVisual = internationalDraft !== null
    ? { filled: internationalDraft, remaining: "" }
    : {
        filled: `${country.dialCode}${phoneMask.filled ? ` ${phoneMask.filled}` : " "}`,
        remaining: phoneMask.remaining,
      };
  const channelCooldown = (method: PhoneChannel) =>
    Math.max(0, Math.ceil((cooldownEnds[method] - clock) / 1000));
  const orderedMethods = useMemo(
    () => [
      primaryMethod,
      ...AUTH_METHODS.filter((method) => method !== primaryMethod),
    ],
    [primaryMethod],
  );
  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return COUNTRIES;
    return COUNTRIES.filter((item) => {
      const searchable = `${item.names[authLocale]} ${item.code} ${item.dialCode}`.toLowerCase();
      return searchable.includes(query);
    });
  }, [authLocale, countrySearch]);

  useEffect(() => {
    trackAuthEvent("registration_view");
  }, []);

  useEffect(() => {
    if (!PHONE_CHANNELS.some((method) => cooldownEnds[method] > Date.now())) return;
    const timer = window.setTimeout(() => setClock(Date.now()), 250);
    return () => window.clearTimeout(timer);
  }, [clock, cooldownEnds]);

  useEffect(() => {
    if (!countryOpen) return;
    const closeOnPointerDown = (event: PointerEvent) => {
      if (!countryPopoverRef.current?.contains(event.target as Node)) {
        setCountryOpen(false);
      }
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCountryOpen(false);
    };
    document.addEventListener("pointerdown", closeOnPointerDown);
    document.addEventListener("keydown", closeOnEscape);
    return () => {
      document.removeEventListener("pointerdown", closeOnPointerDown);
      document.removeEventListener("keydown", closeOnEscape);
    };
  }, [countryOpen]);

  useEffect(() => {
    const rawPosition = pendingCaretPositionRef.current;
    if (rawPosition != null) {
      pendingCaretPositionRef.current = null;
      const input = phoneInputRef.current;
      input?.setSelectionRange(rawPosition, rawPosition);
      return;
    }
    const digitCount = pendingCaretDigitsRef.current;
    if (digitCount == null) return;
    pendingCaretDigitsRef.current = null;
    const input = phoneInputRef.current;
    if (!input) return;
    const position = caretPositionForDigitCount(editablePhone, digitCount);
    input.setSelectionRange(position, position);
  }, [editablePhone]);

  useEffect(() => {
    if (step !== "phone" || !focusPhoneOnReturnRef.current) return;
    focusPhoneOnReturnRef.current = false;
    const frame = window.requestAnimationFrame(() => phoneInputRef.current?.focus());
    return () => window.cancelAnimationFrame(frame);
  }, [step]);

  const resetMessages = () => {
    setError("");
    setCodeState("idle");
  };

  const setPhoneDigits = (
    digits: string,
    nextCountry: CountryOption = country,
    caretDigits?: number,
  ) => {
    setInternationalDraft(null);
    pendingCaretPositionRef.current = null;
    setCountryCode(nextCountry.code);
    setNationalNumber(digits.slice(0, nextCountry.digits));
    const dialLength = nextCountry.dialCode.replace(/\D/g, "").length;
    pendingCaretDigitsRef.current = Math.min(
      caretDigits ?? dialLength + digits.length,
      dialLength + nextCountry.digits,
    );
    resetMessages();
  };

  const applyInternationalNumber = (
    rawValue: string,
    caretPosition = rawValue.length,
  ) => {
    const rawDigits = rawValue.replace(/\D/g, "");
    const detectedCountry = detectCountryFromInternationalDigits(
      rawDigits,
      internationalDraft === null ? country : undefined,
    );
    if (!detectedCountry) return false;
    const dialDigits = detectedCountry.dialCode.replace(/\D/g, "");
    const national = rawDigits.slice(dialDigits.length);
    const digitsBeforeCaret = rawValue
      .slice(0, caretPosition)
      .replace(/\D/g, "").length;
    setPhoneDigits(national, detectedCountry, digitsBeforeCaret);
    return true;
  };

  const handlePhoneInput = (rawValue: string, selectionStart: number | null) => {
    if (!rawValue) {
      setInternationalDraft("");
      setNationalNumber("");
      pendingCaretDigitsRef.current = null;
      pendingCaretPositionRef.current = 0;
      resetMessages();
      return;
    }
    if (rawValue.trim().startsWith("+") || internationalDraft === "") {
      const normalizedDraft = rawValue.trim().startsWith("+")
        ? `+${rawValue.replace(/\+/g, "").replace(/[^\d\s()-]/g, "")}`
        : `+${rawValue.replace(/\D/g, "")}`;
      const normalizedCaret = Math.min(
        normalizedDraft.length,
        (selectionStart ?? rawValue.length) + (rawValue.startsWith("+") ? 0 : 1),
      );
      if (applyInternationalNumber(normalizedDraft, normalizedCaret)) return;
      setInternationalDraft(normalizedDraft);
      setNationalNumber("");
      pendingCaretPositionRef.current = normalizedCaret;
      resetMessages();
      return;
    }
    setInternationalDraft(rawValue.replace(/[^\d\s()-]/g, ""));
    setNationalNumber("");
    pendingCaretDigitsRef.current = null;
    pendingCaretPositionRef.current = selectionStart;
    resetMessages();
  };

  const handlePhonePaste = (event: ClipboardEvent<HTMLInputElement>) => {
    const pasted = event.clipboardData.getData("text");
    const pastedDigits = pasted.replace(/\D/g, "");
    const looksInternational =
      pasted.trim().startsWith("+") ||
      internationalDraft !== null ||
      pastedDigits.length > country.digits;
    if (!looksInternational) return;
    event.preventDefault();
    const internationalValue = `+${pastedDigits}`;
    if (applyInternationalNumber(internationalValue, internationalValue.length)) {
      return;
    }
    setInternationalDraft(internationalValue);
    setNationalNumber("");
    pendingCaretPositionRef.current = internationalValue.length;
    resetMessages();
  };

  const selectCountry = (nextCountry: CountryOption) => {
    const draftDigits = internationalDraft?.replace(/\D/g, "") ?? "";
    const nextDialDigits = nextCountry.dialCode.replace(/\D/g, "");
    const preservedNational =
      internationalDraft === null
        ? nationalNumber
        : draftDigits.startsWith(nextDialDigits)
          ? draftDigits.slice(nextDialDigits.length)
          : draftDigits;
    setPhoneDigits(preservedNational, nextCountry);
    setCountryOpen(false);
    setCountrySearch("");
    window.requestAnimationFrame(() => phoneInputRef.current?.focus());
  };

  const sendCode = (nextChannel: PhoneChannel, contact: string) => {
    if (completedPhoneRef.current !== contact) {
      trackAuthEvent("phone_completed");
      completedPhoneRef.current = contact;
    }
    trackAuthEvent("auth_channel_selected", { channel: nextChannel });

    const deliveryFails =
      nextChannel === "sms" && contact.replace(/\D/g, "").endsWith("0000");
    if (deliveryFails) {
      trackAuthEvent("code_send_error", {
        channel: nextChannel,
        reason: "mock_delivery_error",
      });
      setCodeState("not-sent");
      setError(copy.deliveryError);
      return false;
    }

    trackAuthEvent("code_send_success", { channel: nextChannel });
    setPendingContact(contact);
    setChannel(nextChannel);
    setCode("");
    setCodeState("idle");
    setCodeSentAt(Date.now());
    const cooldownEnd = Date.now() + RESEND_SECONDS * 1000;
    setCooldownEnds((current) => ({
      ...current,
      [nextChannel]: cooldownEnd,
    }));
    setClock(Date.now());
    setStep("code");
    setError("");
    return true;
  };

  const startPhoneCode = async (nextChannel: PhoneChannel) => {
    if (sendingChannel || passwordLoading || channelCooldown(nextChannel) > 0) return;
    const validation = validateAuthContact(normalizedPhone, "phone");
    if (!validation.ok || nationalNumber.length !== country.digits) {
      setError(copy.phoneError);
      return;
    }
    setSendingChannel(nextChannel);
    setError("");
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    sendCode(nextChannel, validation.contact);
    setSendingChannel(null);
  };

  const startPassword = () => {
    const validation = validateAuthContact(normalizedPhone, "phone");
    if (!validation.ok || nationalNumber.length !== country.digits) {
      setError(copy.phoneError);
      return;
    }
    trackAuthEvent("auth_channel_selected", { channel: "password" });
    setPendingContact(validation.contact);
    setPassword("");
    setPasswordVisible(false);
    setStep("password");
    resetMessages();
  };

  const runMethod = (method: AuthMethod) => {
    if (method === "password") {
      startPassword();
      return;
    }
    void startPhoneCode(method);
  };

  const runPrimaryMethod = () => runMethod(primaryMethod);

  const returnToPhone = (expandMethods?: boolean) => {
    if (expandMethods) setShowAllMethods(true);
    setStep("phone");
    setCode("");
    setPassword("");
    resetMessages();
    focusPhoneOnReturnRef.current = true;
  };

  const verifyCurrentCode = useCallback(() => {
    if (code.length !== 6 || codeState === "verifying") {
      if (code.length !== 6) setError(copy.codeIncomplete);
      return;
    }
    if (!codeSentAt) {
      setCodeState("not-sent");
      setError(copy.codeNotSent);
      return;
    }
    if (Date.now() - codeSentAt > CODE_EXPIRES_MS) {
      setCodeState("expired");
      setError(copy.codeExpired);
      return;
    }

    setCodeState("verifying");
    const result = verifyCode(pendingContact, "phone", code, {
      registrationLanguage: uiLanguage,
      registrationHostname: window.location.hostname,
    });
    if (!result.ok) {
      setCodeState("incorrect");
      setError(copy.codeIncorrect);
      return;
    }

    trackAuthEvent("code_verified", { contact_kind: "phone", channel });
    trackAuthEvent(
      result.resolution === "existing" ? "existing_account_opened" : "account_created",
      { contact_kind: "phone", channel },
    );
    window.localStorage.setItem(LAST_SUCCESSFUL_METHOD_KEY, channel);
    setPrimaryMethod(channel);
  }, [
    channel,
    code,
    codeSentAt,
    codeState,
    copy,
    pendingContact,
    uiLanguage,
    verifyCode,
  ]);

  useEffect(() => {
    if (step !== "code" || code.length !== 6 || codeState !== "idle") return;
    const timer = window.setTimeout(verifyCurrentCode, 250);
    return () => window.clearTimeout(timer);
  }, [code, codeState, step, verifyCurrentCode]);

  const resendCode = async () => {
    if (channelCooldown(channel) > 0 || resending) return;
    setResending(true);
    setCode("");
    resetMessages();
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    sendCode(channel, pendingContact);
    setResending(false);
    window.requestAnimationFrame(() => codeInputRef.current?.focus());
  };

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    if (passwordLoading) return;
    setPasswordLoading(true);
    setError("");
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    const result = loginWithPassword(pendingContact, "phone", password);
    if (!result.ok) {
      setPasswordLoading(false);
      setError(localizePasswordError(result.error, copy));
      return;
    }
    window.localStorage.setItem(LAST_SUCCESSFUL_METHOD_KEY, "password");
    trackAuthEvent("existing_account_opened", {
      contact_kind: "phone",
      channel: "password",
    });
  };

  if (step === "phone") {
    const visibleMethods = showAllMethods ? orderedMethods : [primaryMethod];
    return (
      <AuthLayout locale={authLocale} setLanguage={setUiLanguage}>
        <section className="w-full max-w-[420px]" aria-labelledby="auth-title">
          <div className="relative left-1/2 w-[min(calc(100vw-2rem),600px)] -translate-x-1/2 text-center">
            <h1
              id="auth-title"
              className="text-[18px] font-extrabold leading-normal text-black"
            >
              {copy.title}
            </h1>
            <p className="mt-1 text-[16px] leading-normal text-[#79716b]">
              {copy.subtitle}
            </p>
          </div>

          <form
            onSubmit={(event) => {
              event.preventDefault();
              runPrimaryMethod();
            }}
            noValidate
            className="mt-3"
          >
            <label className="sr-only" htmlFor="auth-phone">
              {copy.phoneLabel}
            </label>
            <div
              className={cn(
                "relative flex h-[52px] items-center rounded-[12px] border bg-[#f5f5f4] px-[6px] transition",
                error
                  ? "border-rose-500 ring-2 ring-rose-500/15"
                  : "border-[#d6d3d1] focus-within:border-[#4f39f6] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#4f39f6]/15",
                sendingChannel && "cursor-wait opacity-70",
              )}
              ref={countryPopoverRef}
            >
              <button
                type="button"
                aria-label={
                  internationalDraft === null
                    ? `${copy.countryLabel}: ${country.names[authLocale]} ${country.dialCode}`
                    : copy.countryLabel
                }
                aria-expanded={countryOpen}
                aria-haspopup="dialog"
                disabled={Boolean(sendingChannel)}
                onClick={() => {
                  setCountryOpen((open) => !open);
                  setCountrySearch("");
                }}
                className="flex h-10 w-[58px] shrink-0 items-center justify-center gap-1 rounded-[7px] bg-[#e7e5e4] transition hover:bg-[#ddd9d7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
              >
                {internationalDraft === null ? (
                  <img
                    src={country.flag}
                    alt=""
                    className="size-7 rounded-full object-cover"
                  />
                ) : (
                  <Globe2 size={22} className="text-[#79716b]" aria-hidden="true" />
                )}
                <ChevronDown size={13} className="text-[#79716b]" aria-hidden="true" />
              </button>
              <div className="relative ml-[7px] h-10 min-w-0 flex-1">
                <div
                  className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-1.5 text-[16px] font-semibold leading-6"
                  aria-hidden="true"
                >
                  <span className="text-[#292524]">{phoneVisual.filled}</span>
                  <span className="text-[#a6a09b]">{phoneVisual.remaining}</span>
                </div>
                <Input
                  ref={phoneInputRef}
                  id="auth-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  disabled={Boolean(sendingChannel)}
                  value={editablePhone}
                  onChange={(event) =>
                    handlePhoneInput(event.target.value, event.target.selectionStart)
                  }
                  onPaste={handlePhonePaste}
                  className={cn(
                    "h-10 min-w-0 border-0 bg-transparent px-1.5 text-[16px] font-semibold text-transparent shadow-none caret-[#4f39f6] focus-visible:ring-0 disabled:cursor-wait",
                    editablePhone && "pr-10",
                  )}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "auth-phone-error" : undefined}
                />
                {editablePhone && (
                  <button
                    type="button"
                    aria-label={copy.clearNumber}
                    disabled={Boolean(sendingChannel)}
                    onClick={() => {
                      setInternationalDraft("");
                      setNationalNumber("");
                      pendingCaretDigitsRef.current = null;
                      pendingCaretPositionRef.current = 0;
                      resetMessages();
                      window.requestAnimationFrame(() => phoneInputRef.current?.focus());
                    }}
                    className="absolute right-0 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#79716b] transition hover:bg-[#e7e5e4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
                  >
                    <X size={18} aria-hidden="true" />
                  </button>
                )}
              </div>

              {countryOpen && (
                <div
                  role="dialog"
                  aria-label={copy.countryLabel}
                  className="absolute left-0 right-0 top-[58px] z-30 overflow-hidden rounded-[12px] border border-[#d6d3d1] bg-white p-2 shadow-lg"
                >
                  <div className="flex h-10 items-center gap-2 rounded-[8px] bg-[#f5f5f4] px-3 focus-within:ring-2 focus-within:ring-[#4f39f6]/20">
                    <Search size={16} className="shrink-0 text-[#79716b]" aria-hidden="true" />
                    <input
                      autoFocus
                      value={countrySearch}
                      onChange={(event) => setCountrySearch(event.target.value)}
                      placeholder={copy.countrySearch}
                      aria-label={copy.countrySearch}
                      className="h-full min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[#a6a09b]"
                    />
                  </div>
                  <div className="mt-1 max-h-64 overflow-y-auto">
                    {filteredCountries.map((item) => (
                      <button
                        key={item.code}
                        type="button"
                        onClick={() => selectCountry(item)}
                        className={cn(
                          "flex min-h-11 w-full items-center gap-3 rounded-[8px] px-2 text-left transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]",
                          internationalDraft === null &&
                            item.code === country.code &&
                            "bg-[#f5f5f4]",
                        )}
                      >
                        <img
                          src={item.flag}
                          alt=""
                          className="h-6 w-8 rounded-[4px] object-cover"
                        />
                        <span className="min-w-0 flex-1 truncate text-[14px] font-medium">
                          {item.names[authLocale]}
                        </span>
                        <span className="text-[14px] text-[#79716b]">{item.dialCode}</span>
                      </button>
                    ))}
                    {!filteredCountries.length && (
                      <p className="px-3 py-5 text-center text-[13px] text-[#79716b]">
                        {copy.noCountries}
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>

            {error && (
              <p
                id="auth-phone-error"
                role="alert"
                className="mt-2 text-[13px] leading-5 text-rose-600"
              >
                {error}
              </p>
            )}

            <div className="mt-3 space-y-2">
              {visibleMethods.map((method, index) => {
                const isPrimary = index === 0;
                const isLoading = method === sendingChannel;
                const cooldown =
                  method === "password" ? 0 : channelCooldown(method);
                return (
                  <Button
                    key={method}
                    type={isPrimary ? "submit" : "button"}
                    variant={isPrimary ? "default" : "outline"}
                    disabled={Boolean(sendingChannel) || cooldown > 0}
                    aria-busy={isLoading}
                    onClick={isPrimary ? undefined : () => runMethod(method)}
                    className={cn(
                      "h-[52px] w-full rounded-[12px] border-[#d6d3d1] text-[16px] font-medium",
                      isPrimary &&
                        "border-[#4f39f6] bg-[#4f39f6] text-white hover:bg-[#4330dc]",
                    )}
                  >
                    {isLoading ? (
                      <LoaderCircle size={22} className="animate-spin" aria-hidden="true" />
                    ) : (
                      <MethodIcon method={method} />
                    )}
                    <span>
                      {isLoading
                        ? copy.sending
                        : cooldown > 0 && method !== "password"
                          ? `${copy.channelNames[method]} · ${copy.retryIn} ${formatCooldown(cooldown)}`
                          : copy.methodLabels[method]}
                    </span>
                  </Button>
                );
              })}
              {!showAllMethods && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowAllMethods(true)}
                  className="h-[52px] w-full rounded-[12px] border-[#d6d3d1] text-[16px] font-medium"
                >
                  {copy.otherMethods}
                </Button>
              )}
            </div>
            <span className="sr-only" aria-live="polite">
              {sendingChannel ? copy.sending : ""}
            </span>
          </form>

          <p className="relative left-1/2 mt-3 w-[min(calc(100vw-2rem),560px)] -translate-x-1/2 text-center text-[14px] leading-5 text-[#818181]">
            {copy.legalPrefix}
            <br className="hidden sm:block" />{" "}
            <a
              href="https://tasko.group/public-offer"
              target="_blank"
              rel="noreferrer"
              className="inline-block min-h-5 text-[#51a2ff] underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
            >
              {copy.agreement}
            </a>{" "}
            {copy.legalJoin}{" "}
            <a
              href="https://tasko.group/privacy-policy"
              target="_blank"
              rel="noreferrer"
              className="inline-block min-h-5 text-[#51a2ff] underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
            >
              {copy.privacy}
            </a>
          </p>
        </section>
      </AuthLayout>
    );
  }

  if (step === "password") {
    const phone = displayPhone(pendingContact, country);
    return (
      <AuthLayout locale={authLocale} setLanguage={setUiLanguage}>
        <section className="w-full max-w-[430px]" aria-labelledby="password-title">
          <div className="text-center">
            <h1
              id="password-title"
              className="text-[18px] font-extrabold leading-normal text-black"
            >
              {copy.passwordTitle}
            </h1>
            <div className="mt-1 flex flex-wrap items-center justify-center gap-1 text-[16px] text-[#79716b]">
              <span>{copy.passwordFor}</span>
              <span className="font-medium">{phone}</span>
              <button
                type="button"
                aria-label={copy.editNumber}
                onClick={() => returnToPhone()}
                className="flex size-7 items-center justify-center rounded-[7px] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <form onSubmit={submitPassword} noValidate className="mx-auto mt-4 max-w-[420px]">
            <label className="sr-only" htmlFor="auth-password">
              {copy.passwordPlaceholder}
            </label>
            <div
              className={cn(
                "flex h-[52px] items-center rounded-[12px] border bg-white px-3 transition focus-within:border-[#4f39f6] focus-within:ring-2 focus-within:ring-[#4f39f6]/15",
                error ? "border-rose-500" : "border-[#d6d3d1]",
                passwordLoading && "cursor-wait opacity-70",
              )}
            >
              <Input
                id="auth-password"
                autoFocus
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                disabled={passwordLoading}
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setError("");
                }}
                onKeyDown={(event) => {
                  if (event.key !== "Enter") return;
                  event.preventDefault();
                  event.currentTarget.form?.requestSubmit();
                }}
                placeholder={copy.passwordPlaceholder}
                className="h-10 min-w-0 border-0 bg-transparent px-0 text-[16px] shadow-none focus-visible:ring-0"
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "auth-password-error" : undefined}
              />
              <button
                type="button"
                aria-label={passwordVisible ? copy.hidePassword : copy.showPassword}
                title={passwordVisible ? copy.hidePassword : copy.showPassword}
                disabled={passwordLoading}
                onClick={() => setPasswordVisible((visible) => !visible)}
                className="flex size-9 shrink-0 items-center justify-center rounded-[8px] text-[#a6a09b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
              >
                {passwordVisible ? (
                  <EyeOff size={20} aria-hidden="true" />
                ) : (
                  <Eye size={20} aria-hidden="true" />
                )}
              </button>
            </div>
            {error && (
              <p
                id="auth-password-error"
                role="alert"
                className="mt-2 text-[13px] leading-5 text-rose-600"
              >
                {error}
              </p>
            )}

            <div className="mt-3 space-y-2">
              <Button
                type="submit"
                disabled={passwordLoading || !password}
                aria-busy={passwordLoading}
                className="h-[52px] w-full rounded-[12px] border-[#4f39f6] bg-[#4f39f6] text-[16px] font-medium text-white hover:bg-[#4330dc]"
              >
                {passwordLoading && (
                  <LoaderCircle size={20} className="animate-spin" aria-hidden="true" />
                )}
                {passwordLoading ? copy.signingIn : copy.signIn}
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={passwordLoading}
                onClick={() => returnToPhone(true)}
                className="h-[52px] w-full rounded-[12px] border-[#d6d3d1] text-[16px] font-medium"
              >
                {copy.otherMethods}
              </Button>
            </div>

            <button
              type="button"
              disabled={passwordLoading}
              onClick={() => returnToPhone(true)}
              className="mt-3 min-h-8 w-full text-center text-[14px] font-semibold text-[#2b7fff] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
            >
              {copy.forgotPassword}
            </button>
          </form>
        </section>
      </AuthLayout>
    );
  }

  const phone = displayPhone(pendingContact, country);
  const activeCooldown = channelCooldown(channel);
  return (
    <AuthLayout locale={authLocale} setLanguage={setUiLanguage}>
      <section className="w-full max-w-[430px]" aria-labelledby="code-title">
        <div className="relative left-1/2 w-[min(calc(100vw-2rem),600px)] -translate-x-1/2 text-center">
          <h1
            id="code-title"
            className="text-[18px] font-extrabold leading-normal text-black"
          >
            {copy.codeTitle}
          </h1>
          <div className="mt-1 flex flex-wrap items-center justify-center gap-x-1 text-[16px] text-[#79716b]">
            <span>{copy.sentVia[channel]}</span>
            <span className="inline-flex items-center whitespace-nowrap">
              <span className="font-medium">{phone}</span>
              <button
                type="button"
                aria-label={copy.editNumber}
                onClick={() => returnToPhone()}
                className="ml-0.5 flex size-8 items-center justify-center rounded-[7px] transition hover:bg-[#f5f5f4] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
              >
                <Pencil size={16} aria-hidden="true" />
              </button>
            </span>
          </div>
        </div>

        <div className="mx-auto mt-4 max-w-[420px]">
          <div
            className="relative flex items-center justify-center gap-1 sm:gap-[5px]"
            onClick={() => codeInputRef.current?.focus()}
          >
            <input
              ref={codeInputRef}
              autoFocus
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setCodeState("idle");
                setError("");
              }}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  verifyCurrentCode();
                }
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-label={copy.codeLabel}
              aria-invalid={Boolean(error)}
              aria-describedby={error ? "auth-code-error" : undefined}
              className="absolute inset-0 z-10 h-full w-full cursor-text opacity-0"
            />
            {Array.from({ length: 6 }, (_, index) => {
              const active = code.length === index && codeState !== "verifying";
              return (
                <div key={index} className="contents">
                  {index === 3 && (
                    <span className="mx-1 text-[16px] text-[#a6a09b]" aria-hidden="true">
                      -
                    </span>
                  )}
                  <div
                    className={cn(
                      "flex size-[46px] shrink-0 items-center justify-center rounded-[8px] bg-[#f5f5f4] text-center text-[20px] font-semibold text-[#292524] transition sm:size-[50px]",
                      code[index] && "bg-[#e7e5e4]",
                      active && "bg-white ring-2 ring-[#4f39f6]",
                      error && "ring-1 ring-rose-500",
                    )}
                    aria-hidden="true"
                  >
                    {code[index] ?? ""}
                  </div>
                </div>
              );
            })}
          </div>
          {error && (
            <p
              id="auth-code-error"
              role="alert"
              className="mt-2 text-center text-[13px] leading-5 text-rose-600"
            >
              {error}
            </p>
          )}
          <span className="sr-only" aria-live="polite">
            {codeState === "verifying" ? copy.verifyingCode : ""}
          </span>

          <Button
            type="button"
            variant="outline"
            onClick={() => returnToPhone(true)}
            className="mx-auto mt-4 h-[52px] w-full max-w-[351px] rounded-[12px] border-[#d6d3d1] text-[16px] font-medium"
          >
            {copy.otherMethods}
          </Button>

          <div className="mt-3 flex min-h-8 flex-wrap items-center justify-center gap-x-1 text-[13px] text-[#292524]">
            <span>{copy.resendQuestion}</span>
            {activeCooldown > 0 ? (
              <span className="font-medium text-[#79716b]">
                {copy.resendIn} {formatCooldown(activeCooldown)}
              </span>
            ) : (
              <button
                type="button"
                disabled={resending}
                onClick={() => void resendCode()}
                className="min-h-8 font-medium text-[#2b7fff] hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
              >
                {resending ? copy.resending : copy.resend}
              </button>
            )}
          </div>
        </div>
      </section>
    </AuthLayout>
  );
}
