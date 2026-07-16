import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock3, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { QuizQuestion } from "./training-data";
import { isAcceptedTrainingAnswer } from "./answer-normalization";

type CheckStatus = "correct" | "wrong" | "timeout";

type CheckAnswer = {
  question: QuizQuestion;
  selectedAnswerId: string | null;
  typedAnswer?: string;
  status: CheckStatus;
};

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

export function KnowledgeCheckEngine({
  questions,
  title,
  onExit,
  onRestart,
  onPracticeMistakes,
}: {
  questions: QuizQuestion[];
  title: string;
  onExit: () => void;
  onRestart: () => void;
  onPracticeMistakes: () => void;
}) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(30);
  const [selectedAnswerId, setSelectedAnswerId] = useState<string | null>(null);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answers, setAnswers] = useState<CheckAnswer[]>([]);
  const [finished, setFinished] = useState(false);
  const [confirmExit, setConfirmExit] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const [completedAt, setCompletedAt] = useState<number | null>(null);

  const current = questions[currentIndex];

  const finishOrAdvance = (entry: CheckAnswer) => {
    setAnswers((items) => [...items, entry]);
    if (currentIndex >= questions.length - 1) {
      setCompletedAt(Date.now());
      setFinished(true);
      return;
    }
    setCurrentIndex((index) => index + 1);
    setSelectedAnswerId(null);
    setTypedAnswer("");
    setTimeLeft(30);
  };

  const submitCurrent = () => {
    if (!current || finished) return;

    if (current.format === "multiple-choice") {
      if (!selectedAnswerId) return;
      finishOrAdvance({
        question: current,
        selectedAnswerId,
        status: selectedAnswerId === current.correctAnswerId ? "correct" : "wrong",
      });
      return;
    }

    const answer = typedAnswer.trim();
    if (!answer) return;
    finishOrAdvance({
      question: current,
      selectedAnswerId: null,
      typedAnswer: answer,
      status: isAcceptedTrainingAnswer(answer, current.acceptedAnswers) ? "correct" : "wrong",
    });
  };

  useEffect(() => {
    if (finished || !current) return;
    const timer = window.setInterval(() => {
      setTimeLeft((value) => Math.max(0, value - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [finished, currentIndex, current]);

  useEffect(() => {
    if (timeLeft !== 0 || finished || !current) return;
    finishOrAdvance({ question: current, selectedAnswerId: null, status: "timeout" });
  }, [timeLeft, finished, current]);

  const result = useMemo(() => {
    const correct = answers.filter((answer) => answer.status === "correct").length;
    const wrong = answers.filter((answer) => answer.status === "wrong").length;
    const skipped = answers.filter((answer) => answer.status === "timeout").length;
    const total = answers.length || questions.length;
    const duration = Math.max(1, Math.round(((completedAt ?? Date.now()) - startedAt) / 1000));
    const percentage = total > 0 ? Math.round((correct / total) * 100) : 0;
    return { correct, wrong, skipped, total, duration, percentage };
  }, [answers, completedAt, questions.length, startedAt]);

  if (!current && !finished) {
    return (
      <KnowledgeCheckResult
        title={title}
        answers={[]}
        result={{ correct: 0, wrong: 0, skipped: 0, total: 0, duration: 0, percentage: 0 }}
        onRestart={onRestart}
        onExit={onExit}
        onPracticeMistakes={onPracticeMistakes}
      />
    );
  }

  if (finished) {
    return (
      <KnowledgeCheckResult
        title={title}
        answers={answers}
        result={result}
        onRestart={onRestart}
        onExit={onExit}
        onPracticeMistakes={onPracticeMistakes}
      />
    );
  }

  const canSubmit = current.format === "multiple-choice" ? Boolean(selectedAnswerId) : typedAnswer.trim().length > 0;
  const progress = ((currentIndex + 1) / questions.length) * 100;

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-[820px] flex-col px-4 py-4 sm:px-6 sm:py-6 lg:py-8">
        <KnowledgeCheckHeader
          currentIndex={currentIndex}
          total={questions.length}
          timeLeft={timeLeft}
          progress={progress}
          onExit={() => setConfirmExit(true)}
        />

        <div className="rounded-[20px] border border-[#e7e5e4] bg-[#fbfbf9] p-3 shadow-sm sm:p-4">
          {current.mediaUrl && (
            <div className="overflow-hidden rounded-[16px] border border-[#e7e5e4] bg-zinc-100">
              <img src={current.mediaUrl} alt={current.mediaAlt ?? ""} className="h-[190px] w-full object-cover sm:h-[300px]" />
            </div>
          )}
          {current.primaryText && (
            <div className="rounded-[16px] border border-[#e7e5e4] bg-white p-4 sm:p-5">
              {current.primaryLabel && (
                <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#a8a29e]">{current.primaryLabel}</div>
              )}
              <div className="mt-1 text-xl font-black leading-tight text-[#292524] sm:text-2xl">{current.primaryText}</div>
            </div>
          )}
          <div className="mt-4">
            <p className="text-sm font-medium text-[#79716b]">{current.prompt}</p>
            {current.format === "multiple-choice" ? (
              <div className="mt-3 grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                {current.answers.map((answer) => (
                  <button
                    key={answer.id}
                    type="button"
                    onClick={() => setSelectedAnswerId(answer.id)}
                    className={cn(
                      "min-h-12 rounded-[12px] border px-3.5 py-3 text-left text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10",
                      selectedAnswerId === answer.id
                        ? "border-[#292524] bg-white text-[#292524]"
                        : "border-[#e7e5e4] bg-white text-[#292524] hover:border-[#c7c2bd]",
                    )}
                  >
                    {answer.label}
                  </button>
                ))}
              </div>
            ) : (
              <input
                value={typedAnswer}
                onChange={(event) => setTypedAnswer(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" && typedAnswer.trim()) {
                    event.preventDefault();
                    submitCurrent();
                  }
                }}
                placeholder="Введите ответ"
                className="mt-3 h-11 w-full rounded-[12px] border border-[#e7e5e4] bg-white px-3 text-sm font-medium text-[#292524] outline-none transition placeholder:text-[#a8a29e] focus:border-[#a8a29e]"
              />
            )}
          </div>
        </div>

        <div className="sticky bottom-0 -mx-4 mt-4 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-0 sm:flex sm:justify-end sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
          <Button type="button" onClick={submitCurrent} disabled={!canSubmit} className="w-full justify-center sm:w-auto">
            Ответить
          </Button>
        </div>

        {confirmExit && (
          <ConfirmCheckExitDialog
            onContinue={() => setConfirmExit(false)}
            onFinish={onExit}
          />
        )}
      </div>
    </div>
  );
}

function KnowledgeCheckHeader({
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
          Выйти
        </Button>
        <div className="truncate text-sm font-semibold text-[#292524]">Вопрос {currentIndex + 1} из {total}</div>
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

function KnowledgeCheckResult({
  title,
  answers,
  result,
  onRestart,
  onExit,
  onPracticeMistakes,
}: {
  title: string;
  answers: CheckAnswer[];
  result: { correct: number; wrong: number; skipped: number; total: number; duration: number; percentage: number };
  onRestart: () => void;
  onExit: () => void;
  onPracticeMistakes: () => void;
}) {
  const mistakes = answers.filter((answer) => answer.status !== "correct");
  const topicBreakdown = getBreakdown(answers, (answer) => answer.question.exerciseTitle);
  const formatBreakdown = getBreakdown(answers, (answer) => answer.question.format === "typed-answer" ? "Ввести ответ" : "С вариантами");

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-5xl flex-col px-4 py-6 sm:px-6 lg:py-10">
        <div className="rounded-[20px] border border-[#e7e5e4] bg-[#fbfbf9] p-5 shadow-sm sm:p-6">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-2xl font-black tracking-tight text-[#292524]">Проверка завершена</h2>
              <p className="mt-1 text-sm text-[#79716b]">{title}</p>
            </div>
            <div className="rounded-[16px] border border-[#e7e5e4] bg-white px-5 py-4 text-right">
              <div className="text-3xl font-black text-[#292524]">{result.correct} из {result.total}</div>
              <div className="text-sm font-semibold text-[#79716b]">{result.percentage}%</div>
            </div>
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-5">
            <Metric label="Правильные" value={result.correct} />
            <Metric label="Ошибки" value={result.wrong} />
            <Metric label="Пропущенные" value={result.skipped} />
            <Metric label="Длительность" value={formatDuration(result.duration)} />
            <Metric label="Всего" value={result.total} />
          </div>

          <ResultBreakdown title="По темам" rows={topicBreakdown} />
          <ResultBreakdown title="По форматам" rows={formatBreakdown} />

          <MistakesList mistakes={mistakes} />

          <div className="mt-5 flex flex-wrap gap-2">
            <Button type="button" onClick={onPracticeMistakes}>
              Поработать над ошибками
            </Button>
            <Button type="button" variant="outline" onClick={onRestart}>
              <RotateCcw size={16} />
              Пройти ещё раз
            </Button>
            <Button type="button" variant="ghost" onClick={onExit}>
              К проверкам
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function getBreakdown(answers: CheckAnswer[], getKey: (answer: CheckAnswer) => string) {
  const rows = new Map<string, { correct: number; total: number }>();
  for (const answer of answers) {
    const key = getKey(answer);
    const row = rows.get(key) ?? { correct: 0, total: 0 };
    row.total += 1;
    if (answer.status === "correct") row.correct += 1;
    rows.set(key, row);
  }
  return Array.from(rows.entries()).map(([label, value]) => ({ label, ...value }));
}

function ResultBreakdown({ title, rows }: { title: string; rows: { label: string; correct: number; total: number }[] }) {
  if (!rows.length) return null;
  return (
    <div className="mt-5 rounded-[16px] border border-[#e7e5e4] bg-white p-4">
      <div className="text-sm font-semibold text-[#292524]">{title}</div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between rounded-[12px] bg-[#fbfbf9] px-3 py-2 text-sm">
            <span className="font-medium text-[#57534d]">{row.label}</span>
            <span className="font-black text-[#292524]">{row.correct} из {row.total}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function MistakesList({ mistakes }: { mistakes: CheckAnswer[] }) {
  if (!mistakes.length) return null;
  return (
    <div className="mt-5 rounded-[16px] border border-[#e7e5e4] bg-white p-4">
      <div className="text-sm font-semibold text-[#292524]">Ошибки</div>
      <div className="mt-3 space-y-2">
        {mistakes.map((answer) => {
          const selected = answer.selectedAnswerId
            ? answer.question.answers.find((item) => item.id === answer.selectedAnswerId)?.label
            : answer.typedAnswer;
          return (
            <div key={answer.question.id} className="rounded-[12px] bg-[#fbfbf9] px-3 py-2 text-sm text-[#57534d]">
              <div className="font-semibold text-[#292524]">{answer.question.exerciseTitle}</div>
              <div>{answer.question.primaryText ?? answer.question.mediaAlt ?? answer.question.feedback.correctAnswer}</div>
              <div>Ваш ответ: {selected || "Пропущено"}</div>
              <div>Правильный ответ: {answer.question.feedback.correctAnswer}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-[14px] border border-[#e7e5e4] bg-white px-4 py-3">
      <div className="text-lg font-black text-[#292524]">{value}</div>
      <div className="mt-0.5 text-xs text-[#79716b]">{label}</div>
    </div>
  );
}

function ConfirmCheckExitDialog({
  onContinue,
  onFinish,
}: {
  onContinue: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-[18px] border border-[#e7e5e4] bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black text-[#292524]">Завершить проверку?</h2>
        <p className="mt-2 text-sm leading-5 text-[#79716b]">Незавершённая попытка не попадёт в результаты</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onFinish}>
            Завершить
          </Button>
          <Button type="button" onClick={onContinue}>
            Продолжить проверку
          </Button>
        </div>
      </div>
    </div>
  );
}
