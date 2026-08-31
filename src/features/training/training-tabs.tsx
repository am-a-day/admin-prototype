import { CardsThree, ChartLine, CheckSquare, GraduationCap } from "@phosphor-icons/react";
import { PillTabs, type PillTab, type PillTabsVariant } from "@/components/workspace/pill-tabs";
import { cn } from "@/lib/utils";
import type { TrainingTab } from "./training-data";

const TRAINING_TABS = [
  { id: "cards", label: "Карточки", icon: <CardsThree size={16} aria-hidden="true" /> },
  { id: "trainer", label: "Практика", icon: <GraduationCap size={16} aria-hidden="true" /> },
  { id: "check", label: "Проверка", icon: <CheckSquare size={16} aria-hidden="true" /> },
  { id: "progress", label: "Прогресс", icon: <ChartLine size={16} aria-hidden="true" /> },
] satisfies readonly PillTab<TrainingTab>[];

export function TrainingTabs({
  value,
  onChange,
  compact = false,
  variant = "page",
}: {
  value: TrainingTab;
  onChange: (tab: TrainingTab) => void;
  compact?: boolean;
  variant?: PillTabsVariant;
}) {
  return <PillTabs tabs={TRAINING_TABS} value={value} onValueChange={onChange} ariaLabel="Обучение" variant={variant} className={cn(compact && "w-full")} />;
}
