import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Eye,
  EyeOff,
  KeyRound,
  Mail,
  MessageCircle,
  MessageSquareText,
  Phone,
  Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { useMockAuth, type AuthContactKind } from "@/contexts/mock-auth-context";
import { cn } from "@/lib/utils";
import { trackAuthEvent } from "@/lib/auth-analytics";

type AuthStep = "methods" | "code" | "password";
type DeliveryChannel = "whatsapp" | "telegram" | "sms" | "email";

const RESEND_SECONDS = 30;
const LAST_SUCCESSFUL_CHANNEL_KEY = "tasko.auth.lastSuccessfulChannel.v1";

function maskPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  const country = digits.length > 10 ? digits.slice(0, digits.length - 10) : digits.slice(0, 1);
  const lastFour = digits.slice(-4).padStart(4, "•");
  return `+${country || "7"} ••• ••• ${lastFour.slice(0, 2)} ${lastFour.slice(2)}`;
}

function maskEmail(value: string) {
  const [local, domain] = value.split("@");
  if (!domain) return value;
  return `${local.slice(0, 1) || "•"}•••@${domain}`;
}

function deliveryDescription(channel: DeliveryChannel, contact: string) {
  if (channel === "email") return `Отправили код на ${maskEmail(contact)}`;
  const maskedPhone = maskPhone(contact);
  if (channel === "sms") return `Отправили код по SMS на ${maskedPhone}`;
  return `Отправили код в ${channel === "whatsapp" ? "WhatsApp" : "Telegram"} на ${maskedPhone}`;
}

export function AuthScreen() {
  const { validateAuthContact, verifyCode, loginWithPassword } = useMockAuth();
  const [activeTab, setActiveTab] = useState<AuthContactKind>("phone");
  const [step, setStep] = useState<AuthStep>("methods");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [pendingContact, setPendingContact] = useState("");
  const [channel, setChannel] = useState<DeliveryChannel>("whatsapp");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [resendSeconds, setResendSeconds] = useState(RESEND_SECONDS);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const currentContact = activeTab === "phone" ? phone : email;

  useEffect(() => {
    trackAuthEvent("auth_view");
  }, []);

  useEffect(() => {
    if (step !== "code" || resendSeconds <= 0) return;
    const timer = window.setTimeout(() => setResendSeconds((seconds) => seconds - 1), 1000);
    return () => window.clearTimeout(timer);
  }, [resendSeconds, step]);

  useEffect(() => {
    if (step !== "code" || code.length !== 6 || verifying) return;
    setVerifying(true);
    const result = verifyCode(pendingContact, activeTab, code);
    if (!result.ok) {
      setError(result.error);
      setVerifying(false);
      return;
    }
    trackAuthEvent("code_verified", { contact_kind: activeTab, channel });
    trackAuthEvent(
      result.resolution === "existing" ? "existing_account_opened" : "account_created",
      { contact_kind: activeTab, channel },
    );
    if (activeTab === "phone") {
      window.localStorage.setItem(LAST_SUCCESSFUL_CHANNEL_KEY, channel);
    }
  }, [activeTab, channel, code, pendingContact, step, verifyCode, verifying]);

  const resetMessages = () => {
    setError("");
    setNotice("");
  };

  const changeTab = (tab: AuthContactKind) => {
    setActiveTab(tab);
    setStep("methods");
    setCode("");
    setPassword("");
    setPasswordVisible(false);
    resetMessages();
  };

  const startCode = (nextChannel: DeliveryChannel) => {
    const validation = validateAuthContact(currentContact, activeTab);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setPendingContact(validation.contact);
    if (activeTab === "phone") {
      trackAuthEvent("phone_completed", { channel: nextChannel });
    }
    setChannel(nextChannel);
    setCode("");
    setResendSeconds(RESEND_SECONDS);
    setVerifying(false);
    setStep("code");
    resetMessages();
  };

  const startPassword = () => {
    const validation = validateAuthContact(currentContact, activeTab);
    if (!validation.ok) {
      setError(validation.error);
      return;
    }
    setPendingContact(validation.contact);
    setPassword("");
    setPasswordVisible(false);
    setStep("password");
    resetMessages();
  };

  const backToMethods = () => {
    setStep("methods");
    setCode("");
    setPassword("");
    setVerifying(false);
    resetMessages();
  };

  const submitPrimary = (event: FormEvent) => {
    event.preventDefault();
    startCode(activeTab === "phone" ? "whatsapp" : "email");
  };

  const submitPassword = (event: FormEvent) => {
    event.preventDefault();
    const result = loginWithPassword(pendingContact, activeTab, password);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    trackAuthEvent("existing_account_opened", {
      contact_kind: activeTab,
      channel: "password",
    });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf9f6] px-4 py-6 text-zinc-950">
      <section className="w-full max-w-[400px] rounded-[20px] border border-[#e7e5e4] bg-white p-5 shadow-sm">
        <div className="flex justify-center">
          <TaskoLogo className="text-zinc-950" />
        </div>

        {step === "methods" && (
          <>
            <div className="mt-6 text-center">
              <h1 className="text-[20px] font-black text-zinc-950">Войти или создать аккаунт</h1>
              <p className="mt-1 text-[13px] leading-5 text-zinc-500">
                Введите номер телефона. Если аккаунта ещё нет, мы создадим его автоматически
              </p>
            </div>

            <div role="tablist" aria-label="Способ входа" className="mt-5 grid grid-cols-2 rounded-[10px] bg-zinc-100 p-1">
              {([
                ["phone", "Телефон"],
                ["email", "Почта"],
              ] as const).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab}
                  onClick={() => changeTab(tab)}
                  className={cn(
                    "h-8 rounded-[8px] text-[13px] font-semibold transition",
                    activeTab === tab ? "bg-white text-zinc-950 shadow-sm" : "text-zinc-500 hover:text-zinc-800",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>

            <form onSubmit={submitPrimary} noValidate className="mt-4">
              <label className="text-[12px] font-semibold text-[#57534d]" htmlFor="auth-contact">
                {activeTab === "phone" ? "Номер телефона" : "Email"}
              </label>
              <div className="mt-1.5 flex items-center gap-2 rounded-[10px] border border-[#e7e5e4] bg-[#fbfbf9] px-3 focus-within:border-[#c7c2bd] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
                {activeTab === "phone" ? (
                  <Phone size={15} className="shrink-0 text-[#a6a09b]" />
                ) : (
                  <Mail size={15} className="shrink-0 text-[#a6a09b]" />
                )}
                <Input
                  id="auth-contact"
                  type={activeTab === "email" ? "email" : "tel"}
                  inputMode={activeTab === "email" ? "email" : "tel"}
                  autoComplete={activeTab === "email" ? "email" : "tel"}
                  value={currentContact}
                  onChange={(event) => {
                    if (activeTab === "phone") setPhone(event.target.value);
                    else setEmail(event.target.value);
                    resetMessages();
                  }}
                  onKeyDown={(event) => {
                    if (event.key !== "Enter") return;
                    event.preventDefault();
                    startCode(activeTab === "phone" ? "whatsapp" : "email");
                  }}
                  placeholder={activeTab === "phone" ? "+7 777 123 38 50" : "name@example.com"}
                  className="h-10 border-0 bg-transparent px-0 text-[14px] focus-visible:ring-0"
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? "auth-contact-error" : undefined}
                />
              </div>
              {error && (
                <p id="auth-contact-error" className="mt-1.5 text-[12px] leading-4 text-rose-600">
                  {error}
                </p>
              )}

              {activeTab === "phone" ? (
                <div className="mt-4 space-y-2">
                  <Button type="submit" className="h-10 w-full rounded-[10px] bg-zinc-950 text-[14px] hover:bg-zinc-800">
                    <MessageCircle size={16} />
                    Получить код в WhatsApp
                  </Button>
                  <Button type="button" variant="outline" onClick={startPassword} className="h-10 w-full rounded-[10px] text-[14px]">
                    <KeyRound size={15} />
                    Войти по паролю
                  </Button>
                  <Button type="button" variant="outline" onClick={() => startCode("telegram")} className="h-10 w-full rounded-[10px] text-[14px]">
                    <Send size={15} />
                    Получить код в Telegram
                  </Button>
                  <Button type="button" variant="outline" onClick={() => startCode("sms")} className="h-10 w-full rounded-[10px] text-[14px]">
                    <MessageSquareText size={15} />
                    Получить код по SMS
                  </Button>
                </div>
              ) : (
                <div className="mt-4 space-y-2">
                  <Button type="submit" className="h-10 w-full rounded-[10px] bg-zinc-950 text-[14px] hover:bg-zinc-800">
                    <Mail size={15} />
                    Получить код на почту
                  </Button>
                  <Button type="button" variant="outline" onClick={startPassword} className="h-10 w-full rounded-[10px] text-[14px]">
                    <KeyRound size={15} />
                    Войти по паролю
                  </Button>
                </div>
              )}
            </form>
          </>
        )}

        {step === "code" && (
          <div className="mt-6">
            <button type="button" onClick={backToMethods} className="flex h-8 items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800">
              <ArrowLeft size={14} />
              {activeTab === "phone" ? "Изменить номер" : "Изменить email"}
            </button>
            <div className="mt-3 text-center">
              <h1 className="text-[20px] font-black text-zinc-950">Введите код</h1>
              <p className="mx-auto mt-1 max-w-[330px] text-[13px] leading-5 text-zinc-500">
                {deliveryDescription(channel, pendingContact)}
              </p>
            </div>

            <Input
              autoFocus
              value={code}
              onChange={(event) => {
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6));
                if (error) setError("");
              }}
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              aria-label="Одноразовый код"
              placeholder="000000"
              className="mt-5 h-12 rounded-[10px] text-center text-[20px] font-bold"
            />
            {error && <p className="mt-1.5 text-center text-[12px] text-rose-600">{error}</p>}
            {verifying && <p className="mt-2 text-center text-[12px] text-zinc-400">Проверяем код…</p>}

            <div className="mt-4 flex flex-col items-center gap-2">
              <button
                type="button"
                disabled={resendSeconds > 0}
                onClick={() => {
                  setCode("");
                  setResendSeconds(RESEND_SECONDS);
                  setVerifying(false);
                  resetMessages();
                }}
                className="text-[13px] font-semibold text-zinc-700 transition hover:text-zinc-950 disabled:cursor-default disabled:text-zinc-400"
              >
                {resendSeconds > 0
                  ? `Отправить повторно через 0:${String(resendSeconds).padStart(2, "0")}`
                  : "Отправить повторно"}
              </button>
              <button type="button" onClick={backToMethods} className="text-[12px] font-medium text-blue-600 hover:text-blue-700">
                Получить код другим способом
              </button>
            </div>
          </div>
        )}

        {step === "password" && (
          <form onSubmit={submitPassword} noValidate className="mt-6">
            <button type="button" onClick={backToMethods} className="flex h-8 items-center gap-1 text-[12px] font-medium text-zinc-500 hover:text-zinc-800">
              <ArrowLeft size={14} />
              Вернуться к входу по коду
            </button>
            <div className="mt-3 text-center">
              <h1 className="text-[20px] font-black text-zinc-950">Вход по паролю</h1>
              <p className="mt-1 text-[13px] text-zinc-500">
                {activeTab === "phone" ? maskPhone(pendingContact) : pendingContact}
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

        <p className="mt-5 text-center text-[11px] leading-4 text-[#a6a09b]">
          Продолжая, вы принимаете условия использования и политику конфиденциальности.
        </p>
      </section>
    </main>
  );
}
