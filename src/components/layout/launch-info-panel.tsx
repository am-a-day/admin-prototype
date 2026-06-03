import { Globe, ShieldCheck, Users, Zap } from "lucide-react";
import { useVitrineLaunch } from "@/contexts/vitrine-launch-context";
import { cn } from "@/lib/utils";

const STAGE_META = {
  preparing: {
    dot: "bg-zinc-300",
    label: "Не активна",
    labelClass: "text-zinc-500",
    bg: "",
  },
  ready: {
    dot: "bg-blue-500",
    label: "Готова к запуску",
    labelClass: "text-blue-700",
    bg: "",
  },
  pending: {
    dot: "bg-amber-400 animate-pulse",
    label: "Ожидает активации",
    labelClass: "text-amber-700",
    bg: "bg-amber-50/50",
  },
  active: {
    dot: "bg-emerald-500",
    label: "Активна",
    labelClass: "text-emerald-700",
    bg: "bg-emerald-50/40",
  },
};

export function LaunchInfoPanel() {
  const { stage, address } = useVitrineLaunch();
  const meta = STAGE_META[stage];
  const displayAddress = address.trim() ? `${address.trim()}.tasko.app` : "—";

  return (
    <aside className="flex w-72 shrink-0 flex-col border-l border-border bg-zinc-50/60">
      <div className="flex-1 overflow-y-auto px-5 py-6 space-y-5">

        {/* Status */}
        <div className={cn("rounded-xl border border-border bg-white p-4", meta.bg)}>
          <div className="mb-3 text-[11px] font-black uppercase tracking-wide text-zinc-400">
            Статус витрины
          </div>
          <div className="flex items-center gap-2">
            <span className={cn("h-2 w-2 shrink-0 rounded-full", meta.dot)} />
            <span className={cn("text-[13px] font-bold", meta.labelClass)}>
              {meta.label}
            </span>
          </div>

          {/* Address */}
          <div className="mt-3 rounded-lg bg-zinc-50 px-3 py-2.5">
            <div className="text-[10px] font-bold uppercase tracking-wide text-zinc-400 mb-1">
              {stage === "active" ? "Адрес витрины" : "Желаемый адрес"}
            </div>
            <div className={cn(
              "font-mono text-[12px] break-all",
              address.trim() ? "text-zinc-700" : "text-zinc-300 italic",
            )}>
              {displayAddress}
            </div>
            {stage !== "active" && address.trim() && (
              <p className="mt-1.5 text-[10px] text-zinc-400 leading-[1.5]">
                Адрес будет закреплён после проверки менеджером.
              </p>
            )}
          </div>
        </div>

        {/* Pending-specific message */}
        {stage === "pending" && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
            <div className="text-[12px] font-bold text-amber-800 mb-1">
              Ожидает проверки
            </div>
            <p className="text-[11px] leading-[1.6] text-amber-700/80">
              Менеджер TASKO проверит данные вашей витрины, подтвердит тариф и
              закрепит адрес. Обычно это занимает до 1 рабочего дня.
            </p>
          </div>
        )}

        {/* What happens after */}
        <div>
          <div className="mb-3 text-[11px] font-black uppercase tracking-wide text-zinc-400">
            После активации
          </div>
          <div className="space-y-3">
            {[
              {
                icon: Globe,
                title: "Ссылка становится публичной",
                text: "Гости смогут открыть витрину по адресу и сделать заказ.",
              },
              {
                icon: Users,
                title: "Начинают приходить заказы",
                text: "Заказы через доставку, самовывоз или вызов официанта появятся в истории.",
              },
              {
                icon: Zap,
                title: "Изменения публикуются вручную",
                text: "Меню и настройки обновляются через кнопку «Опубликовать» — не автоматически.",
              },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex items-start gap-3">
                <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border bg-white text-zinc-400">
                  <Icon size={13} />
                </div>
                <div>
                  <div className="text-[12px] font-semibold leading-snug text-zinc-700">
                    {title}
                  </div>
                  <div className="mt-0.5 text-[11px] leading-[1.5] text-zinc-400">
                    {text}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Manager role */}
        <div className="rounded-xl border border-border bg-white p-4">
          <div className="flex items-start gap-2.5">
            <ShieldCheck size={15} className="mt-0.5 shrink-0 text-zinc-400" />
            <div>
              <div className="text-[12px] font-semibold text-zinc-700">
                Роль менеджера
              </div>
              <p className="mt-1 text-[11px] leading-[1.55] text-zinc-400">
                Перед активацией менеджер TASKO вручную проверяет витрину:
                корректность данных, тариф и адрес. Это занимает до 1
                рабочего дня.
              </p>
            </div>
          </div>
        </div>

      </div>
    </aside>
  );
}
