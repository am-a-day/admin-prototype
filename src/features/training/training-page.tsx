import { useEffect, useMemo, useState } from "react";
import { BookOpen, Clock, ExternalLink, FileText, Image, Layers3, MapPinned, Scale, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { PageScroll } from "@/components/workspace/page-layout";
import { cn } from "@/lib/utils";
import {
  createFlashcards,
  createKnowledgeCheckQuestions,
  createRecognizeDishQuestions,
  createSectionLocationQuestions,
  getFlashcardDeckCount,
  trainingSectionOptions,
  type KnowledgeCheckFormat,
  type KnowledgeCheckTopic,
  type FlashcardDeckType,
  sectionLocationItems,
  trainingCatalogItems,
  type TrainingQuestionFormat,
  type TrainingActiveSession,
  type TrainingTab,
} from "./training-data";
import { QuizEngine } from "./quiz-engine";
import { FlashcardEngine } from "./flashcard-engine";
import { KnowledgeCheckEngine } from "./knowledge-check-engine";

type QuizMode = "home" | "recognize-dish" | "section-location";

const EXERCISES: {
  id: Exclude<QuizMode, "home"> | "weight" | "price";
  title: string;
  description: string;
  icon: typeof Image;
  available: boolean;
  meta?: string;
}[] = [
  {
    id: "recognize-dish",
    title: "Узнай блюдо",
    description: "Выберите название блюда по фотографии",
    icon: Image,
    available: true,
    meta: `${trainingCatalogItems.length} блюд доступно`,
  },
  {
    id: "section-location",
    title: "Где находится?",
    description: "Определите раздел, в котором находится позиция",
    icon: MapPinned,
    available: true,
    meta: `${sectionLocationItems.length} позиций доступно`,
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
];

export function TrainingPage({
  activeTab,
  menuUrl,
  onQuizActiveChange,
}: {
  activeTab: TrainingTab;
  menuUrl: string;
  onQuizActiveChange?: (active: boolean, kind?: TrainingActiveSession) => void;
}) {
  const [quizMode, setQuizMode] = useState<QuizMode>("home");
  const [practiceFormat, setPracticeFormat] = useState<TrainingQuestionFormat>("multiple-choice");
  const [checkTopic, setCheckTopic] = useState<KnowledgeCheckTopic>("mixed");
  const [checkFormat, setCheckFormat] = useState<KnowledgeCheckFormat>("mixed");
  const [checkActive, setCheckActive] = useState(false);
  const [checkSessionKey, setCheckSessionKey] = useState(0);
  const [activeDeck, setActiveDeck] = useState<FlashcardDeckType | null>(null);
  const [selectedSectionId, setSelectedSectionId] = useState("all");
  const [roundKey, setRoundKey] = useState(0);
  const [cardSessionKey, setCardSessionKey] = useState(0);
  const [cardsNotice, setCardsNotice] = useState<string | null>(null);
  const questions = useMemo(
    () =>
      quizMode === "section-location"
        ? createSectionLocationQuestions(10, selectedSectionId, practiceFormat)
        : createRecognizeDishQuestions(10, selectedSectionId, practiceFormat),
    [quizMode, practiceFormat, roundKey, selectedSectionId],
  );
  const checkQuestions = useMemo(
    () => createKnowledgeCheckQuestions({ sectionId: selectedSectionId, topic: checkTopic, format: checkFormat, total: 20 }),
    [checkFormat, checkSessionKey, checkTopic, selectedSectionId],
  );
  const exerciseTitle = quizMode === "section-location" ? "Где находится?" : "Узнай блюдо";
  const sessionCards = useMemo(
    () => (activeDeck ? createFlashcards(activeDeck, selectedSectionId, 20) : []),
    [activeDeck, selectedSectionId, cardSessionKey],
  );
  const selectedSectionLabel =
    selectedSectionId === "all"
      ? "Все разделы"
      : trainingSectionOptions.find((section) => section.id === selectedSectionId)?.path ?? "Выбранный раздел";

  useEffect(() => {
    const kind: TrainingActiveSession | undefined =
      activeDeck !== null ? "cards" : checkActive ? "check" : quizMode !== "home" ? "practice" : undefined;
    onQuizActiveChange?.(Boolean(kind), kind);
    return () => onQuizActiveChange?.(false);
  }, [activeDeck, checkActive, onQuizActiveChange, quizMode]);

  useEffect(() => {
    setQuizMode("home");
    setActiveDeck(null);
    setCheckActive(false);
  }, [activeTab]);

  if (quizMode === "recognize-dish" || quizMode === "section-location") {
    return (
      <QuizEngine
        key={roundKey}
        questions={questions}
        exerciseTitle={exerciseTitle}
        onExit={() => setQuizMode("home")}
        onRestart={() => {
          setRoundKey((value) => value + 1);
          setQuizMode(quizMode);
        }}
      />
    );
  }

  if (activeDeck) {
    const deckTitle = activeDeck === "photo-name" ? "Фото и название" : "Позиция и раздел";
    return (
      <FlashcardEngine
        key={`${activeDeck}-${selectedSectionId}-${cardSessionKey}`}
        cards={sessionCards}
        deckTitle={deckTitle}
        sectionLabel={selectedSectionLabel}
        onExit={() => setActiveDeck(null)}
        onCheckSelf={() => {
          setActiveDeck(null);
          setRoundKey((value) => value + 1);
          setQuizMode(activeDeck === "photo-name" ? "recognize-dish" : "section-location");
        }}
      />
    );
  }

  if (checkActive) {
    return (
      <KnowledgeCheckEngine
        key={`${selectedSectionId}-${checkTopic}-${checkFormat}-${checkSessionKey}`}
        questions={checkQuestions}
        title="Проверка знаний"
        onExit={() => setCheckActive(false)}
        onRestart={() => setCheckSessionKey((value) => value + 1)}
        onPracticeMistakes={() => {
          setCheckActive(false);
          setQuizMode(checkTopic === "position-section" ? "section-location" : "recognize-dish");
        }}
      />
    );
  }

  if (activeTab === "cards") {
    return (
      <CardsHome
        selectedSectionId={selectedSectionId}
        onSectionChange={(sectionId) => {
          setSelectedSectionId(sectionId);
          setCardsNotice(null);
        }}
        notice={cardsNotice}
        menuUrl={menuUrl}
        onStartDeck={(deckType) => {
          const count = getFlashcardDeckCount(deckType, selectedSectionId);
          if (count < 1) {
            setCardsNotice("В выбранном разделе нет подходящих карточек. Выберите другой раздел или весь каталог.");
            return;
          }
          setCardSessionKey((value) => value + 1);
          setActiveDeck(deckType);
        }}
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

  if (activeTab === "check") {
    return (
      <KnowledgeCheckHome
        selectedSectionId={selectedSectionId}
        topic={checkTopic}
        format={checkFormat}
        availableCount={checkQuestions.length}
        onSectionChange={setSelectedSectionId}
        onTopicChange={setCheckTopic}
        onFormatChange={setCheckFormat}
        onStart={() => {
          setCheckSessionKey((value) => value + 1);
          setCheckActive(true);
        }}
      />
    );
  }

  return (
    <PageScroll className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#292524]">Практика</h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-[#79716b]">
              Короткие упражнения помогут быстрее запомнить меню заведения.
            </p>
          </div>
        </div>

        <PracticeSetup
          selectedSectionId={selectedSectionId}
          format={practiceFormat}
          onSectionChange={setSelectedSectionId}
          onFormatChange={setPracticeFormat}
        />

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {EXERCISES.map((exercise) => (
            <ExerciseCard
              key={exercise.id}
              title={exercise.title}
              description={exercise.description}
              meta={exercise.meta}
              available={exercise.available}
              icon={exercise.icon}
              onClick={() => {
                if (!exercise.available || exercise.id === "weight" || exercise.id === "price") return;
                setRoundKey((value) => value + 1);
                setQuizMode(exercise.id);
              }}
            />
          ))}
        </div>
      </div>
    </PageScroll>
  );
}

const CARD_DECKS: {
  id: FlashcardDeckType | "description" | "weight" | "price";
  title: string;
  description: string;
  icon: typeof Image;
  available: boolean;
}[] = [
  {
    id: "photo-name",
    title: "Фото и название",
    description: "Посмотрите на фотографию и вспомните название блюда",
    icon: Image,
    available: true,
  },
  {
    id: "position-section",
    title: "Позиция и раздел",
    description: "Вспомните, в каком разделе находится позиция",
    icon: Layers3,
    available: true,
  },
  {
    id: "description",
    title: "Описание и состав",
    description: "Повторите описание и основные ингредиенты позиции",
    icon: FileText,
    available: false,
  },
  {
    id: "weight",
    title: "Вес и объём",
    description: "Запомните вес или объём порции",
    icon: Scale,
    available: false,
  },
  {
    id: "price",
    title: "Цена",
    description: "Повторите актуальные цены позиций",
    icon: Tag,
    available: false,
  },
];

function PracticeSetup({
  selectedSectionId,
  format,
  onSectionChange,
  onFormatChange,
}: {
  selectedSectionId: string;
  format: TrainingQuestionFormat;
  onSectionChange: (sectionId: string) => void;
  onFormatChange: (format: TrainingQuestionFormat) => void;
}) {
  return (
    <div className="grid gap-3 rounded-[16px] border border-[#e7e5e4] bg-[#fbfbf9] p-4 md:grid-cols-2">
      <SectionSelect selectedSectionId={selectedSectionId} onSectionChange={onSectionChange} />
      <SegmentedField
        label="Формат вопросов"
        value={format}
        options={[
          { id: "multiple-choice", label: "С вариантами" },
          { id: "typed-answer", label: "Ввести ответ" },
        ]}
        onChange={(value) => onFormatChange(value as TrainingQuestionFormat)}
      />
    </div>
  );
}

function KnowledgeCheckHome({
  selectedSectionId,
  topic,
  format,
  availableCount,
  onSectionChange,
  onTopicChange,
  onFormatChange,
  onStart,
}: {
  selectedSectionId: string;
  topic: KnowledgeCheckTopic;
  format: KnowledgeCheckFormat;
  availableCount: number;
  onSectionChange: (sectionId: string) => void;
  onTopicChange: (topic: KnowledgeCheckTopic) => void;
  onFormatChange: (format: KnowledgeCheckFormat) => void;
  onStart: () => void;
}) {
  const sectionLabel =
    selectedSectionId === "all"
      ? "Все разделы"
      : trainingSectionOptions.find((section) => section.id === selectedSectionId)?.path ?? "Выбранный раздел";
  const topicLabel = topic === "mixed" ? "Смешанная проверка" : topic === "photo-name" ? "Фото и название" : "Позиция и раздел";
  const formatLabel = format === "mixed" ? "Смешанный формат" : format === "multiple-choice" ? "С вариантами" : "Ввести ответ";

  return (
    <PageScroll className="bg-white">
      <div className="mx-auto w-full max-w-5xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <div className="mb-5">
          <h2 className="text-2xl font-black tracking-tight text-[#292524]">Проверка знаний</h2>
          <p className="mt-1 max-w-2xl text-sm leading-5 text-[#79716b]">
            Ответьте на вопросы по меню и получите итоговый результат.
          </p>
        </div>

        <div className="grid gap-4 rounded-[18px] border border-[#e7e5e4] bg-[#fbfbf9] p-4 lg:grid-cols-2">
          <SectionSelect selectedSectionId={selectedSectionId} onSectionChange={onSectionChange} />
          <SegmentedField
            label="Темы"
            value={topic}
            options={[
              { id: "mixed", label: "Смешанная проверка" },
              { id: "photo-name", label: "Фото и название" },
              { id: "position-section", label: "Позиция и раздел" },
            ]}
            onChange={(value) => onTopicChange(value as KnowledgeCheckTopic)}
          />
          <SegmentedField
            label="Формат вопросов"
            value={format}
            options={[
              { id: "mixed", label: "Смешанный формат" },
              { id: "multiple-choice", label: "С вариантами" },
              { id: "typed-answer", label: "Ввести ответ" },
            ]}
            onChange={(value) => onFormatChange(value as KnowledgeCheckFormat)}
          />
          <div className="rounded-[14px] border border-[#e7e5e4] bg-white px-4 py-3">
            <div className="text-sm font-semibold text-[#292524]">Резюме</div>
            <p className="mt-2 text-sm text-[#57534d]">
              {availableCount} вопросов · {topicLabel} · {formatLabel} · {sectionLabel}
            </p>
            {availableCount < 20 && (
              <p className="mt-1 text-xs text-[#79716b]">Подходящих вопросов меньше 20, используем доступное количество.</p>
            )}
          </div>
        </div>

        <div className="mt-4 flex justify-end">
          <Button type="button" onClick={onStart} disabled={availableCount < 1} className="w-full justify-center sm:w-auto">
            Начать проверку
          </Button>
        </div>
      </div>
    </PageScroll>
  );
}

function SectionSelect({
  selectedSectionId,
  onSectionChange,
}: {
  selectedSectionId: string;
  onSectionChange: (sectionId: string) => void;
}) {
  return (
    <div>
      <label className="text-sm font-semibold text-[#292524]" htmlFor="training-shared-section">
        Раздел
      </label>
      <select
        id="training-shared-section"
        value={selectedSectionId}
        onChange={(event) => onSectionChange(event.target.value)}
        className="mt-2 h-10 w-full rounded-[10px] border border-[#e7e5e4] bg-white px-3 text-sm font-medium text-[#292524] outline-none transition focus:border-[#a8a29e]"
      >
        <option value="all">Все разделы</option>
        {trainingSectionOptions.map((section) => (
          <option key={section.id} value={section.id}>
            {section.path}
          </option>
        ))}
      </select>
    </div>
  );
}

function SegmentedField({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { id: string; label: string }[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <div className="text-sm font-semibold text-[#292524]">{label}</div>
      <div className="mt-2 grid gap-1 rounded-[12px] bg-white p-1 sm:grid-cols-3">
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(option.id)}
            className={cn(
              "rounded-[10px] px-3 py-2 text-sm font-semibold transition",
              value === option.id ? "bg-[#292524] text-white" : "text-[#57534d] hover:bg-[#f5f5f4]",
            )}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function CardsHome({
  selectedSectionId,
  onSectionChange,
  onStartDeck,
  menuUrl,
  notice,
}: {
  selectedSectionId: string;
  onSectionChange: (sectionId: string) => void;
  onStartDeck: (deckType: FlashcardDeckType) => void;
  menuUrl: string;
  notice: string | null;
}) {
  return (
    <PageScroll className="bg-white">
      <div className="mx-auto w-full max-w-6xl px-4 pb-8 pt-4 sm:px-6 lg:px-8">
        <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#292524]">Карточки</h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-[#79716b]">
              Изучайте меню в удобном темпе и отмечайте позиции, которые нужно повторить.
            </p>
          </div>
          <Button type="button" variant="outline" size="sm" asChild className="w-full justify-center sm:w-auto">
            <a href={menuUrl} target="_blank" rel="noreferrer">
              <ExternalLink size={16} />
              Открыть меню заведения
            </a>
          </Button>
        </div>

        <CardDeckSetup
          selectedSectionId={selectedSectionId}
          onSectionChange={onSectionChange}
        />

        {notice && (
          <div className="mt-3 rounded-[14px] border border-[#e7e5e4] bg-[#fbfbf9] px-4 py-3 text-sm text-[#57534d]">
            {notice}
          </div>
        )}

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
          {CARD_DECKS.map((deck) => (
            <CardDeckTile
              key={deck.id}
              title={deck.title}
              description={deck.description}
              icon={deck.icon}
              available={deck.available}
              count={deck.available ? getFlashcardDeckCount(deck.id as FlashcardDeckType, selectedSectionId) : null}
              onStart={() => {
                if (deck.available) onStartDeck(deck.id as FlashcardDeckType);
              }}
            />
          ))}
        </div>
      </div>
    </PageScroll>
  );
}

function CardDeckSetup({
  selectedSectionId,
  onSectionChange,
}: {
  selectedSectionId: string;
  onSectionChange: (sectionId: string) => void;
}) {
  return (
    <div className="rounded-[16px] border border-[#e7e5e4] bg-[#fbfbf9] p-4 sm:max-w-xl">
      <div>
        <label className="text-sm font-semibold text-[#292524]" htmlFor="training-card-section">
          Раздел
        </label>
        <select
          id="training-card-section"
          value={selectedSectionId}
          onChange={(event) => onSectionChange(event.target.value)}
          className="mt-2 h-10 w-full rounded-[10px] border border-[#e7e5e4] bg-white px-3 text-sm font-medium text-[#292524] outline-none transition focus:border-[#a8a29e]"
        >
          <option value="all">Все разделы</option>
          {trainingSectionOptions.map((section) => (
            <option key={section.id} value={section.id}>
              {section.path}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

function CardDeckTile({
  title,
  description,
  icon: Icon,
  available,
  count,
  onStart,
}: {
  title: string;
  description: string;
  icon: typeof Image;
  available: boolean;
  count: number | null;
  onStart: () => void;
}) {
  return (
    <Card className="flex min-h-[188px] flex-col rounded-[18px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#e7e5e4] bg-[#fbfbf9] text-[#57534d]">
          <Icon size={18} />
        </div>
        {available ? (
          <div className="whitespace-nowrap rounded-[9px] border border-[#e7e5e4] bg-[#fbfbf9] px-2 py-1 text-xs font-semibold text-[#79716b]">
            {count} карточек
          </div>
        ) : null}
      </div>
      <div className="mt-4 flex-1">
        <h3 className="text-base font-black text-[#292524]">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-[#79716b]">{description}</p>
      </div>
      {available ? (
        <Button type="button" variant="outline" size="sm" onClick={onStart} className="mt-4 w-full justify-center">
          Начать
        </Button>
      ) : (
        <div className="mt-4 flex h-9 items-center justify-center rounded-[10px] border border-dashed border-[#d6d3d1] bg-[#fbfbf9] text-sm font-semibold text-[#79716b]">
          Скоро
        </div>
      )}
    </Card>
  );
}

function ExerciseCard({
  title,
  description,
  meta,
  available,
  icon: Icon,
  onClick,
}: {
  title: string;
  description: string;
  meta?: string;
  available: boolean;
  icon: typeof Image;
  onClick: () => void;
}) {
  return (
    <Card className="flex min-h-[188px] flex-col rounded-[18px] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-[10px] border border-[#e7e5e4] bg-[#fbfbf9] text-[#57534d]">
          <Icon size={18} />
        </div>
        {meta && (
          <div className="whitespace-nowrap rounded-[9px] border border-[#e7e5e4] bg-[#fbfbf9] px-2 py-1 text-xs font-semibold text-[#79716b]">
            {meta}
          </div>
        )}
      </div>
      <div className="mt-4 flex-1">
        <h3 className="text-base font-black text-[#292524]">{title}</h3>
        <p className="mt-1 text-sm leading-5 text-[#79716b]">{description}</p>
      </div>
      {available ? (
        <Button type="button" variant="outline" size="sm" onClick={onClick} className="mt-4 w-full justify-center">
          Начать
        </Button>
      ) : (
        <div className="mt-4 flex h-9 items-center justify-center rounded-[10px] border border-dashed border-[#d6d3d1] bg-[#fbfbf9] text-sm font-semibold text-[#79716b]">
          Скоро
        </div>
      )}
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
