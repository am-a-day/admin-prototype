import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ChevronDown,
  Eye,
  EyeOff,
  KeyRound,
  LoaderCircle,
  Mail,
} from "lucide-react";
import { ChatCircle, TelegramLogo, WhatsappLogo } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { useAppSettings } from "@/contexts/app-settings-context";
import { useMockAuth, type AuthContactKind } from "@/contexts/mock-auth-context";
import type { LanguageCode } from "@/data/languages";
import { trackAuthEvent } from "@/lib/auth-analytics";
import { cn } from "@/lib/utils";

type AuthStep = "phone" | "email" | "code" | "password";
type PhoneChannel = "whatsapp" | "telegram" | "sms";
type DeliveryChannel = PhoneChannel | "email";
type CodeState = "idle" | "verifying" | "incorrect" | "expired" | "not-sent";
type AuthLocale = Extract<LanguageCode, "ru" | "kk" | "en">;

type CountryOption = {
  code: "KZ" | "RS" | "RU" | "KG" | "UZ";
  label: string;
  dialCode: string;
  digits: number;
  groups: number[];
  placeholder: string;
  flag: string;
};

const COUNTRIES: CountryOption[] = [
  { code: "KZ", label: "Казахстан", dialCode: "+7", digits: 10, groups: [3, 3, 2, 2], placeholder: "(000) 000-00-00", flag: "/flags/kz.png" },
  { code: "RS", label: "Сербия", dialCode: "+381", digits: 9, groups: [2, 3, 2, 2], placeholder: "(00) 000-00-00", flag: "/flags/rs.png" },
  { code: "RU", label: "Россия", dialCode: "+7", digits: 10, groups: [3, 3, 2, 2], placeholder: "(000) 000-00-00", flag: "/flags/ru.png" },
  { code: "KG", label: "Кыргызстан", dialCode: "+996", digits: 9, groups: [3, 3, 3], placeholder: "(000) 000-000", flag: "/flags/kg.png" },
  { code: "UZ", label: "Узбекистан", dialCode: "+998", digits: 9, groups: [2, 3, 2, 2], placeholder: "(00) 000-00-00", flag: "/flags/uz.png" },
];

const PHONE_CHANNELS: PhoneChannel[] = ["whatsapp", "telegram", "sms"];

const AUTH_COPY: Record<AuthLocale, {
  title: string;
  subtitle: string;
  phoneLabel: string;
  countryLabel: string;
  sending: string;
  phoneError: string;
  deliveryError: string;
  channelLabels: Record<PhoneChannel, string>;
  legalPrefix: string;
  agreement: string;
  legalJoin: string;
  privacy: string;
}> = {
  ru: {
    title: "Войти или создать аккаунт",
    subtitle: "Если аккаунта ещё нет, создадим его автоматически",
    phoneLabel: "Номер телефона",
    countryLabel: "Выбрать страну",
    sending: "Отправляем код",
    phoneError: "Введите полный номер телефона",
    deliveryError: "Не удалось отправить код по SMS. Выберите другой способ",
    channelLabels: {
      whatsapp: "Продолжить с WhatsApp",
      telegram: "Продолжить с Telegram",
      sms: "Продолжить по SMS",
    },
    legalPrefix: "Продолжая, вы принимаете",
    agreement: "пользовательское соглашение",
    legalJoin: "и",
    privacy: "политику конфиденциальности",
  },
  kk: {
    title: "Кіру немесе аккаунт жасау",
    subtitle: "Егер аккаунт әлі жоқ болса, оны автоматты түрде жасаймыз",
    phoneLabel: "Телефон нөмірі",
    countryLabel: "Елді таңдау",
    sending: "Код жіберілуде",
    phoneError: "Телефон нөмірін толық енгізіңіз",
    deliveryError: "SMS арқылы код жіберілмеді. Басқа тәсілді таңдаңыз",
    channelLabels: {
      whatsapp: "WhatsApp арқылы жалғастыру",
      telegram: "Telegram арқылы жалғастыру",
      sms: "SMS арқылы жалғастыру",
    },
    legalPrefix: "Жалғастыра отырып, сіз",
    agreement: "пайдаланушы келісімін",
    legalJoin: "және",
    privacy: "құпиялылық саясатын қабылдайсыз",
  },
  en: {
    title: "Sign in or create an account",
    subtitle: "If you don't have an account yet, we'll create one automatically",
    phoneLabel: "Phone number",
    countryLabel: "Choose country",
    sending: "Sending code",
    phoneError: "Enter a complete phone number",
    deliveryError: "We couldn't send the code via SMS. Choose another method",
    channelLabels: {
      whatsapp: "Continue with WhatsApp",
      telegram: "Continue with Telegram",
      sms: "Continue via SMS",
    },
    legalPrefix: "By continuing, you accept the",
    agreement: "user agreement",
    legalJoin: "and",
    privacy: "privacy policy",
  },
};

const RESEND_SECONDS = 30;
const CODE_EXPIRES_MS = 5 * 60 * 1000;
const LAST_SUCCESSFUL_CHANNEL_KEY = "tasko.auth.lastSuccessfulChannel.v1";

function defaultCountry() {
  const hostname = window.location.hostname.toLowerCase();
  return hostname === "tsqr.app" || hostname.endsWith(".tsqr.app") ? "RS" : "KZ";
}

function readLastSuccessfulChannel(): PhoneChannel {
  const stored = window.localStorage.getItem(LAST_SUCCESSFUL_CHANNEL_KEY);
  return stored === "telegram" || stored === "sms" || stored === "whatsapp"
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

function maskPhone(value: string, country: CountryOption) {
  const allDigits = value.replace(/\D/g, "");
  const dialDigits = country.dialCode.replace(/\D/g, "");
  const national = allDigits.startsWith(dialDigits)
    ? allDigits.slice(dialDigits.length)
    : allDigits;
  const lastFour = national.slice(-4).padStart(4, "•");
  return `${country.dialCode} ••• ••• ${lastFour.slice(0, 2)} ${lastFour.slice(2)}`;
}

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return value;
  return `${local.slice(0, 1) || "•"}•••@${domain}`;
}

function deliveryDescription(
  channel: DeliveryChannel,
  contact: string,
  country: CountryOption,
) {
  if (channel === "email") return `Отправили код на ${maskEmail(contact)}`;
  const maskedPhone = maskPhone(contact, country);
  if (channel === "sms") return `Отправили код по SMS на ${maskedPhone}`;
  return `Отправили код в ${channel === "whatsapp" ? "WhatsApp" : "Telegram"} на ${maskedPhone}`;
}

export function AuthScreen() {
  const { uiLanguage, setUiLanguage } = useAppSettings();
  const { validateAuthContact, verifyCode, loginWithPassword } = useMockAuth();
  const [step, setStep] = useState<AuthStep>("phone");
  const [countryCode, setCountryCode] = useState<CountryOption["code"]>(defaultCountry);
  const [nationalNumber, setNationalNumber] = useState("");
  const [email, setEmail] = useState("");
  const [pendingContact, setPendingContact] = useState("");
  const [pendingKind, setPendingKind] = useState<AuthContactKind>("phone");
  const [channel, setChannel] = useState<DeliveryChannel>("whatsapp");
  const [primaryChannel, setPrimaryChannel] = useState<PhoneChannel>(readLastSuccessfulChannel);
  const [code, setCode] = useState("");
  const [codeState, setCodeState] = useState<CodeState>("idle");
  const [codeSentAt, setCodeSentAt] = useState<number | null>(null);
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [sendingChannel, setSendingChannel] = useState<PhoneChannel | null>(null);
  const completedPhoneRef = useRef("");

  const country = COUNTRIES.find((item) => item.code === countryCode) ?? COUNTRIES[0];
  const authLocale: AuthLocale =
    uiLanguage === "kk" || uiLanguage === "en" ? uiLanguage : "ru";
  const authCopy = AUTH_COPY[authLocale];
  const normalizedPhone = `${country.dialCode}${nationalNumber}`;
  const formattedPhone = formatNationalNumber(nationalNumber, country.groups);
  const orderedChannels = useMemo(
    () => [
      primaryChannel,
      ...PHONE_CHANNELS.filter((id) => id !== primaryChannel),
    ],
    [primaryChannel],
  );

  useEffect(() => {
    trackAuthEvent("registration_view");
  }, []);

  useEffect(() => {
    if (step !== "code" || resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds, step]);

  const resetMessages = () => {
    setError("");
    setNotice("");
    setCodeState("idle");
  };

  const handlePhoneInput = (rawValue: string) => {
    const rawDigits = rawValue.replace(/\D/g, "");
    if (rawValue.trim().startsWith("+")) {
      const matchingCountry = [...COUNTRIES]
        .sort((a, b) => b.dialCode.length - a.dialCode.length)
        .find((item) => rawDigits.startsWith(item.dialCode.replace(/\D/g, "")));
      const pastedCountry =
        matchingCountry?.dialCode === "+7" && country.dialCode === "+7"
          ? country
          : matchingCountry;
      if (pastedCountry) {
        const dialDigits = pastedCountry.dialCode.replace(/\D/g, "");
        setCountryCode(pastedCountry.code);
        setNationalNumber(rawDigits.slice(dialDigits.length, dialDigits.length + pastedCountry.digits));
        resetMessages();
        return;
      }
    }
    setNationalNumber(rawDigits.slice(0, country.digits));
    resetMessages();
  };

  const sendCode = (
    nextChannel: DeliveryChannel,
    contact: string,
    kind: AuthContactKind,
  ) => {
    if (kind === "phone") {
      if (completedPhoneRef.current !== contact) {
        trackAuthEvent("phone_completed");
        completedPhoneRef.current = contact;
      }
      trackAuthEvent("auth_channel_selected", { channel: nextChannel });
    }

    // Deterministic prototype failure for testing channel recovery.
    const deliveryFails =
      kind === "phone" && nextChannel === "sms" && contact.replace(/\D/g, "").endsWith("0000");
    if (deliveryFails) {
      trackAuthEvent("code_send_error", { channel: nextChannel, reason: "mock_delivery_error" });
      setCodeState("not-sent");
      setError(authCopy.deliveryError);
      return false;
    }

    trackAuthEvent("code_send_success", { channel: nextChannel });
    setPendingContact(contact);
    setPendingKind(kind);
    setChannel(nextChannel);
    setCode("");
    setCodeState("idle");
    setCodeSentAt(Date.now());
    setResendSeconds(RESEND_SECONDS);
    setStep("code");
    setError("");
    return true;
  };

  const startPhoneCode = async (nextChannel: PhoneChannel) => {
    if (sendingChannel) return;
    const validation = validateAuthContact(normalizedPhone, "phone");
    if (!validation.ok) {
      setError(authCopy.phoneError);
      return;
    }
    setSendingChannel(nextChannel);
    setError("");
    await new Promise((resolve) => window.setTimeout(resolve, 450));
    sendCode(nextChannel, validation.contact, "phone");
    setSendingChannel(null);
  };

  const startEmailCode = () => {
    const validation = validateAuthContact(email, "email");
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    sendCode("email", validation.contact, "email");
  };

  const startPassword = (kind: AuthContactKind) => {
    const rawContact = kind === "phone" ? normalizedPhone : email;
    const validation = validateAuthContact(rawContact, kind);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setPendingContact(validation.contact);
    setPendingKind(kind);
    setPassword("");
    setPasswordVisible(false);
    setStep("password");
    resetMessages();
  };

  const verifyCurrentCode = useCallback(() => {
    if (code.length !== 6 || codeState === "verifying") {
      if (code.length !== 6) setError("Введите полный шестизначный код.");
      return;
    }
    if (!codeSentAt) {
      setCodeState("not-sent");
      setError("Код не был отправлен. Вернитесь назад и выберите канал.");
      return;
    }
    if (Date.now() - codeSentAt > CODE_EXPIRES_MS) {
      setCodeState("expired");
      setError("Срок действия кода истёк. Отправьте новый код.");
      return;
    }

    setCodeState("verifying");
    const result = verifyCode(pendingContact, pendingKind, code, {
      registrationLanguage: uiLanguage,
      registrationHostname: window.location.hostname,
    });
    if (!result.ok) {
      setCodeState("incorrect");
      setError(result.error || "Неверный код. Проверьте цифры и попробуйте ещё раз.");
      return;
    }

    trackAuthEvent("code_verified", { contact_kind: pendingKind, channel });
    trackAuthEvent(
      result.resolution === "existing" ? "existing_account_opened" : "account_created",
      { contact_kind: pendingKind, channel },
    );
    if (pendingKind === "phone" && channel !== "email") {
      window.localStorage.setItem(LAST_SUCCESSFUL_CHANNEL_KEY, channel);
      setPrimaryChannel(channel);
    }
  }, [
    channel,
    code,
    codeSentAt,
    codeState,
    pendingContact,
    pendingKind,
    uiLanguage,
    verifyCode,
  ]);

  useEffect(() => {
    if (step !== "code" || code.length !== 6 || codeState !== "idle") return;
    const timer = window.setTimeout(verifyCurrentCode, 250);
    return () => window.clearTimeout(timer);
  }, [code, codeState, step, verifyCurrentCode]);

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    const result = loginWithPassword(pendingContact, pendingKind, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    trackAuthEvent("existing_account_opened", {
      contact_kind: pendingKind,
      channel: "password",
    });
  };

  const backToEntry = () => {
    setStep(pendingKind === "email" ? "email" : "phone");
    setCode("");
    setPassword("");
    resetMessages();
  };

  if (step === "phone") {
    return (
      <main className="min-h-[100dvh] overflow-y-auto bg-white text-[#1c1917]">
        <div className="flex min-h-[100dvh] flex-col px-4">
          <header className="flex shrink-0 justify-center pt-[34px]">
            <TaskoLogo className="h-auto w-[95px] text-black" />
          </header>

          <div className="flex flex-1 items-center justify-center py-10">
            <section className="w-full max-w-[420px]" aria-labelledby="auth-title">
              <div className="text-center">
                <h1 id="auth-title" className="text-[18px] font-extrabold leading-normal text-black">
                  {authCopy.title}
                </h1>
                <p className="mt-1 text-[16px] leading-normal text-[#79716b]">
                  {authCopy.subtitle}
                </p>
              </div>

              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void startPhoneCode(primaryChannel);
                }}
                noValidate
                className="mt-3"
              >
                <label className="sr-only" htmlFor="auth-phone">
                  {authCopy.phoneLabel}
                </label>
                <div
                  className={cn(
                    "flex h-[52px] items-center rounded-[12px] border bg-[#f5f5f4] px-[6px] transition",
                    error
                      ? "border-rose-500 ring-2 ring-rose-500/15"
                      : "border-[#d6d3d1] focus-within:border-[#4f39f6] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#4f39f6]/15",
                    sendingChannel && "cursor-wait opacity-70",
                  )}
                >
                  <div className="relative flex h-10 w-[58px] shrink-0 items-center justify-center rounded-[7px] bg-[#e7e5e4] focus-within:ring-2 focus-within:ring-[#4f39f6]">
                    <span className="flex items-center gap-1" aria-hidden="true">
                      <img
                        src={country.flag}
                        alt=""
                        className="size-7 rounded-full object-cover"
                      />
                      <ChevronDown size={13} className="text-[#79716b]" />
                    </span>
                    <select
                      aria-label={authCopy.countryLabel}
                      value={countryCode}
                      disabled={Boolean(sendingChannel)}
                      onChange={(event) => {
                        const next = COUNTRIES.find(({ code }) => code === event.target.value);
                        if (!next) return;
                        setCountryCode(next.code);
                        setNationalNumber((digits) => digits.slice(0, next.digits));
                        resetMessages();
                      }}
                      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-wait"
                    >
                      {COUNTRIES.map((option) => (
                        <option key={option.code} value={option.code}>
                          {option.label} ({option.dialCode})
                        </option>
                      ))}
                    </select>
                  </div>
                  <span className="ml-[7px] shrink-0 text-[16px] font-semibold leading-6 text-[#292524]">
                    {country.dialCode}
                  </span>
                  <Input
                    id="auth-phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    disabled={Boolean(sendingChannel)}
                    value={formattedPhone}
                    onChange={(event) => handlePhoneInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key !== "Enter") return;
                      event.preventDefault();
                      void startPhoneCode(primaryChannel);
                    }}
                    placeholder={country.placeholder}
                    className="h-10 min-w-0 border-0 bg-transparent px-1.5 text-[16px] font-semibold text-[#292524] shadow-none placeholder:font-semibold placeholder:text-[#a6a09b] focus-visible:ring-0 disabled:cursor-wait"
                    aria-invalid={Boolean(error)}
                    aria-describedby={error ? "auth-phone-error" : undefined}
                  />
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
                  {orderedChannels.map((item, index) => {
                    const isLoading = sendingChannel === item;
                    const isPrimary = index === 0;
                    return (
                      <Button
                        key={item}
                        type={isPrimary ? "submit" : "button"}
                        variant={isPrimary ? "default" : "outline"}
                        disabled={Boolean(sendingChannel)}
                        aria-busy={isLoading}
                        onClick={isPrimary ? undefined : () => void startPhoneCode(item)}
                        className={cn(
                          "h-[52px] w-full rounded-[12px] border-[#d6d3d1] text-[16px] font-medium",
                          isPrimary &&
                            "border-[#4f39f6] bg-[#4f39f6] text-white hover:bg-[#4330dc]",
                        )}
                      >
                        {isLoading ? (
                          <LoaderCircle
                            size={22}
                            className="animate-spin"
                            aria-hidden="true"
                          />
                        ) : item === "whatsapp" ? (
                          <WhatsappLogo size={22} weight="fill" aria-hidden="true" />
                        ) : item === "telegram" ? (
                          <TelegramLogo size={22} weight="fill" aria-hidden="true" />
                        ) : (
                          <ChatCircle size={22} weight="fill" aria-hidden="true" />
                        )}
                        <span>
                          {isLoading ? authCopy.sending : authCopy.channelLabels[item]}
                        </span>
                      </Button>
                    );
                  })}
                </div>
                <span className="sr-only" aria-live="polite">
                  {sendingChannel ? authCopy.sending : ""}
                </span>
              </form>

              <p className="mt-3 text-center text-[14px] leading-5 text-[#818181]">
                {authCopy.legalPrefix}{" "}
                <a
                  href="https://tasko.group/public-offer"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block min-h-5 text-[#51a2ff] underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
                >
                  {authCopy.agreement}
                </a>{" "}
                {authCopy.legalJoin}{" "}
                <a
                  href="https://tasko.group/privacy-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-block min-h-5 text-[#51a2ff] underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]"
                >
                  {authCopy.privacy}
                </a>
              </p>
            </section>
          </div>

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
                onClick={() => setUiLanguage(code)}
                aria-current={authLocale === code ? "true" : undefined}
                className={cn(
                  "min-h-8 rounded-sm px-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#4f39f6]",
                  authLocale === code ? "text-black" : "text-[#a6a09b] hover:text-[#79716b]",
                )}
              >
                {label}
              </button>
            ))}
          </nav>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf9f6] px-4 py-6 text-zinc-950">
      <section className="w-full max-w-[420px] rounded-[20px] border border-[#e7e5e4] bg-white p-5 shadow-sm">
        <div className="flex justify-center">
          <TaskoLogo className="text-zinc-950" />
        </div>

        {step === "email" && (
          <form
            onSubmit={(event) => {
              event.preventDefault();
              startEmailCode();
            }}
            noValidate
            className="mt-6"
          >
            <button type="button" onClick={() => setStep("phone")} className="flex h-8 items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800">
              <ArrowLeft size={14} />
              Вернуться к телефону
            </button>
            <div className="mt-3 text-center">
              <h1 className="text-[20px] font-black text-zinc-950">Вход по почте</h1>
              <p className="mt-1 text-[13px] text-zinc-500">Только для существующих аккаунтов</p>
            </div>
            <label className="mt-5 block text-[12px] font-semibold text-[#57534d]" htmlFor="auth-email">
              Email
            </label>
            <Input
              id="auth-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                resetMessages();
              }}
              placeholder="name@example.com"
              className="mt-1.5 h-10 rounded-[10px]"
              aria-invalid={Boolean(error)}
            />
            {error && <p className="mt-1.5 text-[12px] text-rose-600">{error}</p>}
            <Button type="submit" className="mt-4 h-10 w-full rounded-[10px] bg-zinc-950 text-[14px] hover:bg-zinc-800">
              <Mail size={15} />
              Получить код на почту
            </Button>
            <Button type="button" variant="outline" onClick={() => startPassword("email")} className="mt-2 h-10 w-full rounded-[10px] text-[14px]">
              <KeyRound size={15} />
              Войти по паролю
            </Button>
          </form>
        )}

        {step === "code" && (
          <div className="mt-6">
            <button type="button" onClick={backToEntry} className="flex h-8 items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800">
              <ArrowLeft size={14} />
              {pendingKind === "phone" ? "Изменить номер" : "Изменить email"}
            </button>
            <div className="mt-3 text-center">
              <h1 className="text-[20px] font-black text-zinc-950">Введите код</h1>
              <p className="mx-auto mt-1 max-w-[330px] text-[13px] leading-5 text-zinc-500">
                {deliveryDescription(channel, pendingContact, country)}
              </p>
            </div>

            <Input
              autoFocus
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                setCodeState("idle");
                setError("");
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-label="Одноразовый код"
              placeholder="000000"
              className="mt-5 h-12 rounded-[10px] text-center text-[20px] font-bold"
            />
            {error && <p className="mt-1.5 text-center text-[12px] text-rose-600">{error}</p>}
            {codeState === "verifying" && <p className="mt-2 text-center text-[12px] text-zinc-400">Проверяем код…</p>}

            <Button
              type="button"
              onClick={verifyCurrentCode}
              disabled={code.length !== 6 || codeState === "verifying"}
              className="mt-4 h-10 w-full rounded-[10px] bg-zinc-950 text-[14px] hover:bg-zinc-800"
            >
              Подтвердить
            </Button>

            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={resendSeconds > 0}
                onClick={() => {
                  setCode("");
                  resetMessages();
                  if (sendCode(channel, pendingContact, pendingKind)) {
                    setResendSeconds(RESEND_SECONDS);
                  }
                }}
                className="text-[13px] font-semibold text-zinc-700 transition hover:text-zinc-950 disabled:cursor-default disabled:text-zinc-400"
              >
                {resendSeconds > 0
                  ? `Отправить повторно через 0:${String(resendSeconds).padStart(2, "0")}`
                  : "Отправить повторно"}
              </button>
              {pendingKind === "phone" && (
                <button type="button" onClick={backToEntry} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
                  Получить код другим способом
                </button>
              )}
              <button type="button" onClick={backToEntry} className="text-[12px] font-medium text-zinc-500 hover:text-zinc-800">
                {pendingKind === "phone" ? "Изменить номер" : "Изменить email"}
              </button>
            </div>
          </div>
        )}

        {step === "password" && (
          <form onSubmit={submitPassword} noValidate className="mt-6">
            <button type="button" onClick={backToEntry} className="flex h-8 items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800">
              <ArrowLeft size={14} />
              Вернуться к входу по коду
            </button>
            <div className="mt-3 text-center">
              <h1 className="text-[20px] font-black text-zinc-950">Вход по паролю</h1>
              <p className="mt-1 text-[13px] text-zinc-500">
                {pendingKind === "phone" ? maskPhone(pendingContact, country) : pendingContact}
              </p>
            </div>
            <label className="mt-5 block text-[12px] font-semibold text-[#57534d]" htmlFor="auth-password">
              Пароль
            </label>
            <div className="mt-1.5 flex items-center rounded-[10px] border border-[#e7e5e4] bg-[#fbfbf9] px-3 focus-within:border-[#c7c2bd] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
              <Input
                id="auth-password"
                type={passwordVisible ? "text" : "password"}
                autoComplete="current-password"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  resetMessages();
                }}
                className="h-10 border-0 bg-transparent px-0 text-[14px] focus-visible:ring-0"
                aria-invalid={Boolean(error)}
              />
              <button
                type="button"
                onClick={() => setPasswordVisible((visible) => !visible)}
                title={passwordVisible ? "Скрыть пароль" : "Показать пароль"}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[7px] text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-700"
              >
                {passwordVisible ? <EyeOff size={15} /> : <Eye size={15} />}
              </button>
            </div>
            {error && <p className="mt-1.5 text-[12px] leading-4 text-rose-600">{error}</p>}
            {notice && <p className="mt-1.5 text-[12px] leading-4 text-zinc-500">{notice}</p>}
            <Button type="submit" className="mt-4 h-10 w-full rounded-[10px] bg-zinc-950 text-[14px] hover:bg-zinc-800">
              Войти
            </Button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setNotice("Восстановление пароля пока недоступно в прототипе.");
              }}
              className="mt-3 w-full text-center text-[12px] font-medium text-blue-600 hover:text-blue-700"
            >
              Забыли пароль?
            </button>
          </form>
        )}
      </section>
    </main>
  );
}
