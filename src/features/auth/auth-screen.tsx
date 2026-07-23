import { useState, type FormEvent } from "react";
import { Chrome, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TaskoLogo } from "@/components/ui/tasko-logo";
import { useMockAuth } from "@/contexts/mock-auth-context";

export function AuthScreen() {
  const { loginWithContact, loginWithGoogle } = useMockAuth();
  const [contact, setContact] = useState("");
  const [error, setError] = useState("");

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const result = loginWithContact(contact);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setError("");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fbf9f6] px-4 text-zinc-950">
      <section className="w-full max-w-[380px] rounded-[20px] border border-[#e7e5e4] bg-white p-5 shadow-sm">
        <div className="flex justify-center">
          <TaskoLogo className="text-zinc-950" />
        </div>

        <div className="mt-6 text-center">
          <h1 className="text-[20px] font-black tracking-tight text-zinc-950">
            Войти или создать аккаунт
          </h1>
          <p className="mt-1 text-[13px] leading-5 text-zinc-500">
            Начните создавать онлайн-меню. Это бесплатно
          </p>
        </div>

        <Button
          type="button"
          variant="outline"
          onClick={loginWithGoogle}
          className="mt-5 h-10 w-full rounded-xl border-[#e7e5e4] bg-white text-[14px] text-[#292524] hover:bg-[#f5f5f4]"
        >
          <Chrome size={16} />
          Продолжить с Google
        </Button>

        <div className="my-4 flex items-center gap-3">
          <div className="h-px flex-1 bg-[#e7e5e4]" />
          <span className="text-[12px] font-medium text-[#a6a09b]">или</span>
          <div className="h-px flex-1 bg-[#e7e5e4]" />
        </div>

        <form onSubmit={submit} noValidate>
          <label className="text-[12px] font-semibold text-[#57534d]" htmlFor="auth-contact">
            Телефон или email
          </label>
          <div className="mt-1.5 flex items-center gap-2 rounded-xl border border-[#e7e5e4] bg-[#fbfbf9] px-3 focus-within:border-[#c7c2bd] focus-within:bg-white focus-within:ring-2 focus-within:ring-blue-500/20">
            <Mail size={15} className="shrink-0 text-[#a6a09b]" />
            <Input
              id="auth-contact"
              value={contact}
              onChange={(event) => {
                setContact(event.target.value);
                if (error) setError("");
              }}
              placeholder="+7 777 123 45 67 или name@email.com"
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

          <Button type="submit" className="mt-4 h-10 w-full rounded-xl bg-zinc-950 text-[14px] hover:bg-zinc-800">
            Продолжить
          </Button>
        </form>

        <p className="mt-4 text-center text-[11px] leading-4 text-[#a6a09b]">
          Продолжая, вы принимаете условия использования и политику конфиденциальности.
        </p>
      </section>
    </main>
  );
}
