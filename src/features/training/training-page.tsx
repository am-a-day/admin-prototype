import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock, Image, ListChecks, MapPinned, Scale, Tag, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageScroll } from "@/components/workspace/page-layout";
import { createRecognizeDishQuestions, trainingCatalogItems, type TrainingTab } from "./training-data";
import { QuizEngine } from "./quiz-engine";

type QuizMode = "home" | "recognize-dish";

const EXERCISES = [
  {
    id: "recognize-dish",
    title: "Узнай блюдо",
    description: "Выберите название блюда по фотографии",
    icon: Image,
    available: true,
  },
  {
    id: "section",
    title: "Где находится?",
    description: "Определите раздел, в котором находится позиция",
    icon: MapPinned,
    available: false,
  },
  {
    id: "weight",
    title: "Вес и объём",
    description: "Вспомните вес или объём порции",
    icon: Scale,
    available: false,
  },
  {
    id: "price",
    title: "Цена",
    description: "Выберите актуальную цену позиции",
    icon: Tag,
    available: false,
  },
] as const;

export function TrainingPage({
  activeTab,
  onQuizActiveChange,
}: {
  activeTab: TrainingTab;
  onQuizActiveChange?: (active: boolean) => void;
}) {
  const [quizMode, setQuizMode] = useState<QuizMode>("home");
  const [roundKey, setRoundKey] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const questions = useMemo(() => createRecognizeDishQuestions(10), [roundKey]);

  useEffect(() => {
    onQuizActiveChange?.(quizMode !== "home");
    return () => onQuizActiveChange?.(false);
  }, [onQuizActiveChange, quizMode]);

  if (quizMode === "recognize-dish") {
    return (
      <QuizEngine
        key={roundKey}
        questions={questions}
        onExit={() => setQuizMode("home")}
        onRestart={() => {
          setRoundKey((value) => value + 1);
          setQuizMode("recognize-dish");
        }}
      />
    );
  }

  if (activeTab === "menu") {
    return (
      <TrainingEmptyState
        icon={ListChecks}
        title="Меню для обучения появится следующим этапом"
        description="Раздел будет добавлен следующим этапом."
      />
    );
  }

  if (activeTab === "progress") {
    return (
      <TrainingEmptyState
        icon={Clock}
        title="Прогресс будет добавлен следующим этапом"
        description="Пока фиксируем базовый цикл тренировки без истории результатов, рейтингов и командной аналитики."
      />
    );
  }

  return (
    <PageScroll className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        {notice && (
          <div className="mb-3 flex items-center justify-between gap-3 rounded-[14px] border border-[#e7e5e4] bg-[#fbfbf9] px-4 py-3 text-sm text-[#57534d]">
            <span>{notice}</span>
            <button
              type="button"
              onClick={() => setNotice(null)}
              className="rounded-lg px-2 py-1 text-xs font-semibold text-[#79716b] hover:bg-white"
            >
              Закрыть
            </button>
          </div>
        )}

        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black tracking-tight text-[#292524]">Тренажёр</h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-[#79716b]">
              Короткие упражнения по текущему каталогу. В первом прототипе доступен полный раунд распознавания блюд.
            </p>
          </div>
          <div className="inline-flex items-center gap-1.5 rounded-[10px] border border-[#e7e5e4] bg-[#fbfbf9] px-3 py-2 text-xs font-medium text-[#79716b]">
            <UserCircle size={15} />
            {trainingCatalogItems.length} позиций с фото
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {EXERCISES.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              title={exercise.title}
              description={exercise.description}
              icon={exercise.icon}
              onClick={() => {
                if (exercise.available) {
                  setRoundKey((value) => value + 1);
                  setQuizMode("recognize-dish");
                  return;
                }
                setNotice("Упражнение будет добавлено следующим этапом");
              }}
            />
          ))}
        </div>
      </div>
    </PageScroll>
  );
}

function ExerciseCard({
  title,
  description,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  icon: typeof Image;
  onClick: () => void;
}) {
  return (
    <Card className="flex min-h-[176px] flex-col rounded-[18px] p-4">
      <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#e7e5e4] bg-[#fbfbf9] text-[#57534d]">
        <Icon size={18} />
      </div>
      <div className="mt-4 flex-1">
        <h3 className="text-base font-black text-[#292524]">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-[#79716b]">{description}</p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onClick} className="mt-4 w-full justify-center">
        Начать
      </Button>
    </Card>
  );
}

function TrainingEmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: typeof BookOpen;
  title: string;
  description: string;
}) {
  return (
    <PageScroll className="bg-white">
      <div className="mx-auto flex min-h-full w-full max-w-3xl items-center px-4 py-8 sm:px-6">
        <div className="w-full rounded-[20px] border border-dashed border-[#d6d3d1] bg-[#fbfbf9] px-6 py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-[12px] border border-[#e7e5e4] bg-white text-[#57534d]">
            <Icon size={20} />
          </div>
          <h2 className="mt-4 text-lg font-black text-[#292524]">{title}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-[#79716b]">{description}</p>
        </div>
      </div>
    </PageScroll>
  );
}
