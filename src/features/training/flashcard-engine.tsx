import { useEffect, useState } from "react";
import { ArrowLeft, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Flashcard as FlashcardModel } from "./training-data";

type CardStatus = "known" | "learning";

function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function FlashcardEngine({
  cards,
  deckTitle,
  sectionLabel,
  trackProgress,
  onExit,
  onCheckSelf,
}: {
  cards: FlashcardModel[];
  deckTitle: string;
  sectionLabel: string;
  trackProgress: boolean;
  onExit: () => void;
  onCheckSelf: () => void;
}) {
  const [sessionCards, setSessionCards] = useState(() => cards);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [hasRevealedCurrentCard, setHasRevealedCurrentCard] = useState(false);
  const [knownCardIds, setKnownCardIds] = useState<Set<string>>(() => new Set());
  const [learningCardIds, setLearningCardIds] = useState<Set<string>>(() => new Set());
  const [completedAt, setCompletedAt] = useState<number | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);

  const current = sessionCards[currentIndex];
  const completed = completedAt !== null;
  const progress = sessionCards.length > 0 ? ((completed ? sessionCards.length : currentIndex) / sessionCards.length) * 100 : 0;

  const resetCardSide = () => {
    setFlipped(false);
    setHasRevealedCurrentCard(false);
  };

  const toggleCardSide = () => {
    setFlipped((value) => {
      const next = !value;
      if (next) setHasRevealedCurrentCard(true);
      return next;
    });
  };

  const exitSession = () => {
    if (!completed) {
      setConfirmExit(true);
      return;
    }
    onExit();
  };

  const goToPreviousCard = () => {
    if (currentIndex === 0) return;
    setCurrentIndex((index) => index - 1);
    resetCardSide();
  };

  const goToNextCard = () => {
    if (currentIndex >= sessionCards.length - 1) {
      setCompletedAt(Date.now());
      return;
    }
    setCurrentIndex((index) => index + 1);
    resetCardSide();
  };

  const markCard = (status: CardStatus) => {
    if (!current || !trackProgress || !hasRevealedCurrentCard) return;

    setKnownCardIds((ids) => {
      const next = new Set(ids);
      if (status === "known") next.add(current.id);
      else next.delete(current.id);
      return next;
    });
    setLearningCardIds((ids) => {
      const next = new Set(ids);
      if (status === "learning") next.add(current.id);
      else next.delete(current.id);
      return next;
    });
    goToNextCard();
  };

  const repeatDifficult = () => {
    const difficultCards = shuffle(sessionCards.filter((card) => learningCardIds.has(card.id)));
    if (!difficultCards.length) return;
    setSessionCards(difficultCards);
    setCurrentIndex(0);
    resetCardSide();
    setKnownCardIds(new Set());
    setLearningCardIds(new Set());
    setCompletedAt(null);
  };

  const restartSession = () => {
    setSessionCards(shuffle(sessionCards));
    setCurrentIndex(0);
    resetCardSide();
    setKnownCardIds(new Set());
    setLearningCardIds(new Set());
    setCompletedAt(null);
  };

  useEffect(() => {
    if (completed || !current) return;
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest("button,a,input,textarea,select") || event.repeat) return;

      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        toggleCardSide();
        return;
      }

      if (trackProgress && hasRevealedCurrentCard && event.key === "ArrowLeft") {
        event.preventDefault();
        markCard("learning");
        return;
      }

      if (trackProgress && hasRevealedCurrentCard && event.key === "ArrowRight") {
        event.preventDefault();
        markCard("known");
        return;
      }

      if (!trackProgress && event.key === "ArrowLeft") {
        event.preventDefault();
        goToPreviousCard();
        return;
      }

      if (!trackProgress && event.key === "ArrowRight") {
        event.preventDefault();
        goToNextCard();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [completed, current, currentIndex, hasRevealedCurrentCard, trackProgress]);

  if (!current && !completed) {
    return (
      <div className="flex min-h-0 flex-1 overflow-y-auto bg-white">
        <div className="mx-auto flex w-full max-w-[760px] flex-col px-4 py-6 sm:px-6 lg:py-10">
          <div className="rounded-[20px] border border-[#e7e5e4] bg-[#fbfbf9] p-5 shadow-sm">
            <h2 className="text-xl font-black text-[#292524]">Карточки не найдены</h2>
            <p className="mt-2 text-sm text-[#79716b]">Выберите другой раздел или весь каталог.</p>
            <Button type="button" className="mt-4" onClick={onExit}>
              К карточкам
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (completed) {
    return (
      <FlashcardSessionResult
        deckTitle={deckTitle}
        sectionLabel={sectionLabel}
        trackProgress={trackProgress}
        total={sessionCards.length}
        known={knownCardIds.size}
        learning={learningCardIds.size}
        canRepeat={trackProgress && learningCardIds.size > 0}
        onRepeat={repeatDifficult}
        onRestart={restartSession}
        onCheckSelf={onCheckSelf}
        onExit={onExit}
      />
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-[820px] flex-col px-4 py-4 sm:px-6 sm:py-6 lg:py-8">
        <FlashcardSessionHeader
          deckTitle={deckTitle}
          sectionLabel={sectionLabel}
          currentIndex={currentIndex}
          total={sessionCards.length}
          progress={progress}
          trackProgress={trackProgress}
          known={knownCardIds.size}
          learning={learningCardIds.size}
          onExit={exitSession}
        />

        <Flashcard card={current} flipped={flipped} onFlip={toggleCardSide} />

        {trackProgress && hasRevealedCurrentCard && (
          <FlashcardActions onLearning={() => markCard("learning")} onKnown={() => markCard("known")} />
        )}

        {!trackProgress && (
          <FreeReviewNavigation
            currentIndex={currentIndex}
            total={sessionCards.length}
            onPrevious={goToPreviousCard}
            onNext={goToNextCard}
          />
        )}

        {confirmExit && (
          <ConfirmExitDialog
            onContinue={() => setConfirmExit(false)}
            onFinish={onExit}
          />
        )}
      </div>
    </div>
  );
}

function FlashcardSessionHeader({
  deckTitle,
  sectionLabel,
  currentIndex,
  total,
  progress,
  trackProgress,
  known,
  learning,
  onExit,
}: {
  deckTitle: string;
  sectionLabel: string;
  currentIndex: number;
  total: number;
  progress: number;
  trackProgress: boolean;
  known: number;
  learning: number;
  onExit: () => void;
}) {
  return (
    <div className="mb-4 rounded-[16px] border border-[#e7e5e4] bg-[#fbfbf9] p-3 shadow-sm">
      <div className="flex items-center justify-between gap-3">
        <Button type="button" variant="ghost" size="sm" onClick={onExit} className="shrink-0 px-2.5">
          <ArrowLeft size={15} />
          Выйти
        </Button>
        <div className="min-w-0 text-center">
          <div className="truncate text-sm font-semibold text-[#292524]">{deckTitle}</div>
          <div className="truncate text-xs text-[#79716b]">{sectionLabel}</div>
        </div>
        <div className="shrink-0 rounded-lg border border-[#e7e5e4] bg-white px-2.5 py-1.5 text-sm font-semibold text-[#292524]">
          {currentIndex + 1} из {total}
        </div>
      </div>
      {trackProgress && (
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs font-semibold text-[#57534d]">
          <div className="rounded-lg border border-[#e7e5e4] bg-white px-2.5 py-1.5">Ещё изучаю {learning}</div>
          <div className="rounded-lg border border-emerald-100 bg-emerald-50 px-2.5 py-1.5 text-emerald-900">Знаю {known}</div>
        </div>
      )}
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[#e7e5e4]">
        <div className="h-full rounded-full bg-[#292524] transition-[width]" style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}

function Flashcard({
  card,
  flipped,
  onFlip,
}: {
  card: FlashcardModel;
  flipped: boolean;
  onFlip: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onFlip}
      className="group block w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
      aria-label={flipped ? "Вернуться к вопросу" : "Посмотреть ответ"}
    >
      <div className="[perspective:1000px] motion-reduce:[perspective:none]">
        <div
          className={cn(
            "relative min-h-[390px] rounded-[22px] transition-transform duration-300 [transform-style:preserve-3d] motion-reduce:transition-opacity motion-reduce:duration-150 sm:min-h-[450px]",
            flipped && "[transform:rotateY(180deg)] motion-reduce:[transform:none]",
          )}
        >
          <div className={cn("absolute inset-0 [backface-visibility:hidden]", flipped && "motion-reduce:opacity-0")}>
            <FlashcardFront card={card} />
          </div>
          <div className={cn("absolute inset-0 [backface-visibility:hidden] [transform:rotateY(180deg)] motion-reduce:[transform:none]", !flipped && "motion-reduce:opacity-0")}>
            <FlashcardBack card={card} />
          </div>
        </div>
      </div>
    </button>
  );
}

function FlashcardFront({ card }: { card: FlashcardModel }) {
  return (
    <div className="flex h-full min-h-[390px] flex-col rounded-[22px] border border-[#e7e5e4] bg-[#fbfbf9] p-4 shadow-sm transition group-hover:border-[#d6d3d1] sm:min-h-[450px] sm:p-5">
      {card.front.imageUrl ? (
        <div className="overflow-hidden rounded-[18px] border border-[#e7e5e4] bg-zinc-100">
          <img src={card.front.imageUrl} alt="" className="h-[220px] w-full object-cover sm:h-[300px]" />
        </div>
      ) : (
        <div className="rounded-[18px] border border-[#e7e5e4] bg-white p-5">
          <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#a8a29e]">Позиция</div>
          <div className="mt-2 text-2xl font-black leading-tight text-[#292524]">{card.front.title}</div>
        </div>
      )}
      <div className="mt-5 flex flex-1 flex-col justify-end">
        <div className="text-lg font-black text-[#292524]">{card.front.prompt}</div>
        <div className="mt-2 text-sm font-medium text-[#79716b]">Нажмите, чтобы посмотреть ответ</div>
      </div>
    </div>
  );
}

function FlashcardBack({ card }: { card: FlashcardModel }) {
  return (
    <div
      className={cn(
        "flex h-full min-h-[390px] flex-col rounded-[22px] border border-[#e7e5e4] bg-white p-5 shadow-sm sm:min-h-[450px] sm:p-6",
        !card.back.imageUrl && "justify-center",
      )}
    >
      {card.back.imageUrl && (
        <div className="mb-4 overflow-hidden rounded-[16px] border border-[#e7e5e4] bg-zinc-100">
          <img src={card.back.imageUrl} alt="" className="h-[130px] w-full object-cover sm:h-[170px]" />
        </div>
      )}
      <div className={cn(card.back.imageUrl && "mt-auto")}>
        <div className="text-xs font-semibold uppercase tracking-[0.08em] text-[#a8a29e]">Ответ</div>
        <div className="mt-2 text-2xl font-black leading-tight text-[#292524] sm:text-3xl">{card.back.title}</div>
        {card.back.subtitle && <div className="mt-3 text-sm font-medium text-[#79716b]">{card.back.subtitle}</div>}
        <div className="mt-5 text-sm font-medium text-[#79716b]">Нажмите, чтобы вернуться к вопросу</div>
      </div>
    </div>
  );
}

function FlashcardActions({
  onLearning,
  onKnown,
}: {
  onLearning: () => void;
  onKnown: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-4 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-auto sm:grid sm:w-full sm:max-w-[520px] sm:grid-cols-2 sm:gap-2 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <div className="grid grid-cols-2 gap-2 sm:contents">
        <Button type="button" variant="outline" onClick={onLearning} className="h-11 justify-center" aria-label="Ещё изучаю">
          Ещё изучаю
        </Button>
        <Button type="button" onClick={onKnown} className="h-11 justify-center" aria-label="Знаю">
          Знаю
        </Button>
      </div>
    </div>
  );
}

function FreeReviewNavigation({
  currentIndex,
  total,
  onPrevious,
  onNext,
}: {
  currentIndex: number;
  total: number;
  onPrevious: () => void;
  onNext: () => void;
}) {
  return (
    <div className="sticky bottom-0 -mx-4 mt-4 bg-white/95 px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] backdrop-blur sm:static sm:mx-auto sm:flex sm:w-full sm:max-w-[360px] sm:items-center sm:justify-center sm:gap-3 sm:bg-transparent sm:p-0 sm:backdrop-blur-none">
      <div className="grid grid-cols-[48px_1fr_48px] items-center gap-2">
        <Button type="button" variant="outline" size="icon" onClick={onPrevious} disabled={currentIndex === 0} aria-label="Предыдущая карточка">
          ←
        </Button>
        <div className="text-center text-sm font-semibold text-[#57534d]">{currentIndex + 1} из {total}</div>
        <Button type="button" variant="outline" size="icon" onClick={onNext} aria-label={currentIndex >= total - 1 ? "Завершить просмотр" : "Следующая карточка"}>
          →
        </Button>
      </div>
    </div>
  );
}

function FlashcardSessionResult({
  deckTitle,
  sectionLabel,
  trackProgress,
  total,
  known,
  learning,
  canRepeat,
  onRepeat,
  onRestart,
  onCheckSelf,
  onExit,
}: {
  deckTitle: string;
  sectionLabel: string;
  trackProgress: boolean;
  total: number;
  known: number;
  learning: number;
  canRepeat: boolean;
  onRepeat: () => void;
  onRestart: () => void;
  onCheckSelf: () => void;
  onExit: () => void;
}) {
  if (!trackProgress) {
    return (
      <div className="flex min-h-0 flex-1 overflow-y-auto bg-white">
        <div className="mx-auto flex w-full max-w-[760px] flex-col px-4 py-6 sm:px-6 lg:py-10">
          <div className="rounded-[20px] border border-[#e7e5e4] bg-[#fbfbf9] p-5 shadow-sm sm:p-6">
            <h2 className="text-2xl font-black tracking-tight text-[#292524]">Карточки просмотрены</h2>
            <p className="mt-1 text-sm text-[#79716b]">
              {deckTitle} · {sectionLabel}
            </p>
            <div className="mt-5 rounded-[14px] border border-[#e7e5e4] bg-white px-4 py-3">
              <div className="text-lg font-black text-[#292524]">{total}</div>
              <div className="mt-0.5 text-xs text-[#79716b]">Просмотрено карточек</div>
            </div>
            <div className="mt-5 flex flex-wrap gap-2">
              <Button type="button" onClick={onRestart}>
                <RotateCcw size={16} />
                Пройти ещё раз
              </Button>
              <Button type="button" variant="outline" onClick={onCheckSelf}>
                Проверить себя
              </Button>
              <Button type="button" variant="ghost" onClick={onExit}>
                К карточкам
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-y-auto bg-white">
      <div className="mx-auto flex w-full max-w-[760px] flex-col px-4 py-6 sm:px-6 lg:py-10">
        <div className="rounded-[20px] border border-[#e7e5e4] bg-[#fbfbf9] p-5 shadow-sm sm:p-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-[#292524]">Сессия завершена</h2>
            <p className="mt-1 text-sm text-[#79716b]">
              {deckTitle} · {sectionLabel}
            </p>
            {!canRepeat && <p className="mt-2 text-sm text-[#57534d]">Все карточки отмечены как знакомые.</p>}
          </div>

          <div className="mt-5 grid gap-2 sm:grid-cols-3">
            <ResultMetric label="Просмотрено" value={total} />
            <ResultMetric label="Знаю" value={known} />
            <ResultMetric label="Ещё изучаю" value={learning} />
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {canRepeat && (
              <Button type="button" onClick={onRepeat}>
                <RotateCcw size={16} />
                Повторить сложные
              </Button>
            )}
            <Button type="button" variant={canRepeat ? "outline" : "default"} onClick={onCheckSelf}>
              Проверить себя
            </Button>
            <Button type="button" variant="ghost" onClick={onExit}>
              К карточкам
            </Button>
          </div>
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

function ConfirmExitDialog({
  onContinue,
  onFinish,
}: {
  onContinue: () => void;
  onFinish: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/30 px-4">
      <div className="w-full max-w-sm rounded-[18px] border border-[#e7e5e4] bg-white p-5 shadow-xl">
        <h2 className="text-lg font-black text-[#292524]">Завершить изучение?</h2>
        <p className="mt-2 text-sm leading-5 text-[#79716b]">Прогресс текущей сессии не будет сохранён.</p>
        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onFinish}>
            Завершить
          </Button>
          <Button type="button" onClick={onContinue}>
            Продолжить изучение
          </Button>
        </div>
      </div>
    </div>
  );
}
