import { cn } from "@/lib/utils";
import type { TrainingTab } from "./training-data";

const TRAINING_TABS: { id: TrainingTab; label: string }[] = [
  { id: "trainer", label: "Тренажёр" },
  { id: "cards", label: "Карточки" },
  { id: "progress", label: "Прогресс" },
];

export function TrainingTabs({
  value,
  onChange,
  compact = false,
}: {
  value: TrainingTab;
  onChange: (tab: TrainingTab) => void;
  compact?: boolean;
}) {
  return (
    <div className={cn("inline-flex items-center gap-0.5 rounded-lg bg-[#f5f5f4] p-0.5", compact && "w-full")}>
      {TRAINING_TABS.map((tab) => (
        <button
          key={tab.id}
          type="button"
          onClick={() => onChange(tab.id)}
          className={cn(
            "rounded-lg px-2.5 py-1 text-[12px] transition",
            compact && "flex-1 py-1.5",
            value === tab.id
              ? "bg-white text-[#292524] shadow-sm ring-1 ring-[#e7e5e4]"
              : "text-[#79716b] hover:text-zinc-700",
          )}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
