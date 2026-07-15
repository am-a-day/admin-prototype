import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, CheckCircle2, Clock3, RotateCcw, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "./training-data";

type AnswerStatus = "correct" | "wrong" | "timeout";

type AnswerState = {
  selectedAnswerId: string | null;
  status: AnswerStatus;
};

type HistoryEntry = {
  questionId: string;
  title: string;
  sectionName: string;
  status: AnswerStatus;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function QuizEngine({
  questions,
  onExit,
  onRestart,
}: {
  questions: QuizQuestion[];
  onExit: () => void;
  onRestart: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [answerState, setAnswerState] = useState<AnswerState | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [finished, setFinished] = useState(false);
  const [roundStartedAt] = useState(() => Date.now());
  const [roundFinishedAt, setRoundFinishedAt] = useState<number | null>(null);

  const current = questions[currentIndex];

  const finishOrAdvance = () => {
    if (currentIndex >= questions.length - 1) {
      setRoundFinishedAt((value) => value ?? Date.now());
      setFinished(true);
      return;
    }
    setCurrentIndex((index) => index + 1);
    setAnswerState(null);
    setTimeLeft(30);
  };

  const recordAnswer = (selectedAnswerId: string | null, status: AnswerStatus) => {
    if (answerState || finished) return;
    setAnswerState({ selectedAnswerId, status });
    setHistory((entries) => [
      ...entries,
      {
        questionId: current.id,
        title: current.feedback.correctAnswer,
        sectionName: current.feedback.sectionName,
        status,
      },
    ]);
  };

  useEffect(() => {
    if (finished || answerState) return;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [answerState, finished, currentIndex]);

  useEffect(() => {
    if (timeLeft === 0 && !answerState && !finished) {
      recordAnswer(null, "timeout");
    }
  }, [timeLeft, answerState, finished]);

  useEffect(() => {
    if (!answerState || finished) return;
    const timeout = window.setTimeout(finishOrAdvance, 1300);
    return () => window.clearTimeout(timeout);
  }, [answerState, finished, currentIndex]);

  const result = useMemo(() => {
    const correct = history.filter((entry) => entry.status === "correct").length;
    const wrong = history.filter((entry) => entry.status === "wrong").length;
    const skipped = history.filter((entry) => entry.status === "timeout").length;
    const duration = Math.max(1, Math.round(((roundFinishedAt ?? Date.now()) - roundStartedAt) / 1000));
    return { correct, wrong, skipped, duration };
  }, [history, roundFinishedAt, roundStartedAt]);

  if (!current) {
    return (
      <QuizResult
        correct={0}
        wrong={0}
        skipped={0}
        duration={0}
        mistakes={[]}
        onRestart={onRestart}
        onExit={onExit}
      />
    );
  }

  if (finished) {
    return (
      <QuizResult
        correct={result.correct}
        wrong={result.wrong}
        skipped={result.skipped}
        duration={result.duration}
        mistakes={history.filter((entry) => entry.status !== "correct")}
        onRestart={onRestart}
        onExit={onExit}
      />
    );
  }

  const progress = ((currentIndex + (answerState ? 1 : 0)) / questions.length) * 100;

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-[820px] flex-col px-4 py-4 sm:px-6 sm:py-6 lg:py-8">
        <QuizHeader
          currentIndex={currentIndex}
          total={questions.length}
          timeLeft={timeLeft}
          progress={progress}
          onExit={onExit}
        />
        <QuizQuestion
          question={current}
          answerState={answerState}
          onAnswer={(answerId) =>
            recordAnswer(answerId, answerId === current.correctAnswerId ? "correct" : "wrong")
          }
        />
        <QuizFeedback question={current} answerState={answerState} />
        {answerState && (
          <div className="mt-4 flex justify-end">
            <Button type="button" variant="outline" size="sm" onClick={finishOrAdvance}>
              Дальше
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}

function QuizHeader({
  currentIndex,
  total,
  timeLeft,
  progress,
  onExit,
}: {
  currentIndex: number;
  total: number;
  timeLeft: number;
  progress: number;
  onExit: () => void;
}) {
  return (
    <div className="mb-4 rounded-[16px] border border-[#e7e5e4] bg-[#fbfbf9] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onExit} className="shrink-0 px-2.5">
          <ArrowLeft size={15} />
          Назад
        </Button>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold text-[#292524]">
            Вопрос {currentIndex + 1} из {total}
          </div>
        </div>
        <div className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-[#e7e5e4] bg-white px-2.5 text-sm font-semibold text-[#292524]">
          <Clock3 size={15} className="text-[#79716b]" />
          {timeLeft} с
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e7e5e4]">
        <div className="h-full rounded-full bg-[#292524] transition-[width]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function QuizQuestion({
  question,
  answerState,
  onAnswer,
}: {
  question: QuizQuestion;
  answerState: AnswerState | null;
  onAnswer: (answerId: string) => void;
}) {
  return (
    <div className="rounded-[20px] border border-[#e7e5e4] bg-[#fbfbf9] p-3 shadow-sm sm:p-4">
      <div className="overflow-hidden rounded-[16px] border border-[#e7e5e4] bg-zinc-100">
        <img
          src={question.mediaUrl}
          alt={question.mediaAlt}
          className="h-[210px] w-full object-cover sm:h-[300px]"
        />
      </div>
      <div className="mt-4">
        <p className="text-sm font-medium text-[#79716b]">{question.prompt}</p>
        <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {question.answers.map((answer) => (
            <AnswerOption
              key={answer.id}
              label={answer.label}
              state={getOptionState(answer.id, question.correctAnswerId, answerState)}
              onClick={() => onAnswer(answer.id)}
              locked={Boolean(answerState)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function getOptionState(answerId: string, correctAnswerId: string, answerState: AnswerState | null) {
  if (!answerState) return "idle";
  if (answerId === correctAnswerId) return "correct";
  if (answerId === answerState.selectedAnswerId && answerState.status === "wrong") return "wrong";
  return "inactive";
}

function AnswerOption({
  label,
  state,
  locked,
  onClick,
}: {
  label: string;
  state: "idle" | "correct" | "wrong" | "inactive";
  locked: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={locked}
      className={cn(
        "flex min-h-12 w-full items-center justify-between gap-3 rounded-[12px] border px-3.5 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
        state === "idle" && "border-[#e7e5e4] bg-white text-[#292524] hover:border-[#c7c2bd] hover:bg-[#fafaf9]",
        state === "correct" && "border-emerald-300 bg-emerald-50 text-emerald-900",
        state === "wrong" && "border-red-300 bg-red-50 text-red-900",
        state === "inactive" && "border-[#e7e5e4] bg-white text-[#a8a29e]",
      )}
    >
      <span>{label}</span>
      {state === "correct" && <CheckCircle2 size={17} className="shrink-0 text-emerald-600" />}
      {state === "wrong" && <XCircle size={17} className="shrink-0 text-red-600" />}
    </button>
  );
}

function QuizFeedback({
  question,
  answerState,
}: {
  question: QuizQuestion;
  answerState: AnswerState | null;
}) {
  if (!answerState) return null;

  const title =
    answerState.status === "correct"
      ? "Верно"
      : answerState.status === "timeout"
        ? "Время вышло"
        : "Неверно";

  return (
    <div
      className={cn(
        "mt-3 rounded-[16px] border px-4 py-3 text-sm",
        answerState.status === "correct"
          ? "border-emerald-200 bg-emerald-50 text-emerald-900"
          : "border-[#e7e5e4] bg-white text-[#44403b]",
      )}
    >
      <div className="font-semibold">{title}</div>
      {answerState.status !== "correct" && (
        <div className="mt-1 space-y-0.5 text-[#57534d]">
          <div>Правильный ответ: {question.feedback.correctAnswer}</div>
          <div>Раздел: {question.feedback.sectionName}</div>
        </div>
      )}
    </div>
  );
}

function QuizResult({
  correct,
  wrong,
  skipped,
  duration,
  mistakes,
  onRestart,
  onExit,
}: {
  correct: number;
  wrong: number;
  skipped: number;
  duration: number;
  mistakes: HistoryEntry[];
  onRestart: () => void;
  onExit: () => void;
}) {
  const [showMistakes, setShowMistakes] = useState(false);
  const total = correct + wrong + skipped || 10;
  const message =
    correct >= 8
      ? "Хороший результат. Можно закрепить раунд ещё раз."
      : correct >= 5
        ? "Базу видно, но часть позиций стоит повторить."
        : "Лучше пройти раунд ещё раз и сверить спорные блюда.";

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-[760px] flex-col px-4 py-6 sm:px-6 lg:py-10">
        <div className="rounded-[20px] border border-[#e7e5e4] bg-[#fbfbf9] p-5 shadow-sm sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-[#292524]">Раунд завершён</h2>
              <p className="mt-1 text-sm text-[#79716b]">{message}</p>
            </div>
            <div className="rounded-[14px] border border-[#e7e5e4] bg-white px-4 py-3 text-right">
              <div className="text-2xl font-black text-[#292524]">{correct} из {total}</div>
              <div className="text-xs text-[#79716b]">результат</div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ResultMetric label="Правильные" value={correct} />
            <ResultMetric label="Ошибки и пропуски" value={wrong + skipped} />
            <ResultMetric label="Длительность" value={formatDuration(duration)} />
          </div>

          <div className="mt-5 rounded-[16px] border border-[#e7e5e4] bg-white p-4 text-sm text-[#57534d]">
            <div>Неправильных ответов: {wrong}</div>
            <div>Пропущено по таймеру: {skipped}</div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={onRestart}>
              <RotateCcw size={16} />
              Пройти ещё раз
            </Button>
            <Button type="button" variant="outline" onClick={onExit}>
              К тренажёрам
            </Button>
            {mistakes.length > 0 && (
              <Button type="button" variant="ghost" onClick={() => setShowMistakes((value) => !value)}>
                Посмотреть ошибки
              </Button>
            )}
          </div>

          {showMistakes && (
            <div className="mt-4 rounded-[16px] border border-[#e7e5e4] bg-white p-4">
              <div className="text-sm font-semibold text-[#292524]">Позиции для повторения</div>
              <ul className="mt-2 space-y-1 text-sm text-[#57534d]">
                {mistakes.map((entry) => (
                  <li key={entry.questionId}>
                    {entry.title} · {entry.sectionName}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResultMetric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] border border-[#e7e5e4] bg-white px-4 py-3">
      <div className="text-lg font-black text-[#292524]">{value}</div>
      <div className="mt-0.5 text-xs text-[#79716b]">{label}</div>
    </div>
  );
}
