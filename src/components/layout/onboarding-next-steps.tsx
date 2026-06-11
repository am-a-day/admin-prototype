import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, ChevronDown, X } from "lucide-react";
import { cn } from "@/lib/utils";

type ScenarioId = "catalog" | "appearance" | "home" | "upsell";

const SCENARIOS: Array<{
  id: ScenarioId;
  label: string;
  desc: string;
  primary?: boolean;
}> = [
  {
    id: "appearance",
    label: "Настроить внешний вид",
    desc: "Измените цвет, тему и стиль витрины.",
    primary: true,
  },
  {
    id: "catalog",
    label: "Продолжить меню",
    desc: "Добавьте ещё блюда, цены, фото и описания.",
  },
  {
    id: "home",
    label: "Добавить баннер",
    desc: "Покажите акцию или важную информацию на главной.",
  },
  {
    id: "upsell",
    label: "Настроить рекомендации",
    desc: "Предлагайте гостям дополнительные блюда.",
  },
];

export function OnboardingNextSteps({
  onScenario,
  onDismiss,
}: {
  onScenario: (id: ScenarioId) => void;
  onDismiss: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const [visible, setVisible] = useState(false);

  // Animate in after mount
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 50);
    return () => window.clearTimeout(t);
  }, []);

  return createPortal(
    <div
      className={cn(
        "fixed bottom-6 left-[220px] z-50 w-[300px] overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-xl transition-all duration-300 ease-out",
        visible ? "translate-y-0 opacity-100" : "translate-y-4 opacity-0",
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-emerald-50 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white">
            <Check size={11} strokeWidth={3} />
          </span>
          <span className="text-[13px] font-bold text-emerald-900">
            {collapsed ? "Следующие шаги" : "Первая позиция добавлена"}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setCollapsed((v) => !v)}
            title={collapsed ? "Раскрыть" : "Свернуть"}
            className="flex h-6 w-6 items-center justify-center rounded-lg text-emerald-600 transition hover:bg-emerald-100"
          >
            <ChevronDown
              size={14}
              className={cn("transition-transform duration-200", collapsed ? "rotate-180" : "")}
            />
          </button>
          <button
            type="button"
            onClick={onDismiss}
            title="Закрыть"
            className="flex h-6 w-6 items-center justify-center rounded-lg text-emerald-500 transition hover:bg-emerald-100 hover:text-emerald-700"
          >
            <X size={13} />
          </button>
        </div>
      </div>

      {/* Body — collapse by height for smooth animation */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-out",
          collapsed ? "max-h-0" : "max-h-[400px]",
        )}
      >
        <div className="p-4">
          <p className="mb-3 text-[12px] leading-[1.6] text-zinc-500">
            Вы уже видите, как будет выглядеть витрина. Можете продолжить наполнять меню или быстро
            улучшить внешний вид.
          </p>
          <div className="space-y-2">
            {SCENARIOS.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => {
                  onScenario(s.id);
                  setCollapsed(true);
                }}
                className={cn(
                  "flex w-full flex-col gap-0.5 rounded-xl border px-3 py-2.5 text-left text-[12px] transition hover:shadow-sm",
                  s.primary
                    ? "border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50"
                    : "border-zinc-200 bg-zinc-50/50 hover:bg-zinc-50",
                )}
              >
                <span
                  className={cn("font-semibold", s.primary ? "text-emerald-800" : "text-zinc-800")}
                >
                  {s.label}
                </span>
                <span className="text-zinc-500">{s.desc}</span>
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={onDismiss}
            className="mt-3 text-[11px] text-zinc-400 transition hover:text-zinc-600"
          >
            Позже
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
