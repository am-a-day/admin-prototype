import type { OverviewFilterId } from "../model/types";

const AUDIT_QUEUE_EMPTY_TITLE: Partial<Record<OverviewFilterId, string>> = {
  "quick:no-description": "У всех позиций есть описание",
  "quick:no-photo": "У всех позиций есть фото",
  "quick:no-weight": "У всех позиций указан вес",
  "quick:no-kbju": "У всех позиций заполнены КБЖУ",
  "quick:no-translation": "У всех позиций заполнены переводы",
  "quick:no-recommendations": "У всех позиций есть рекомендации",
  "status:stop": "В стоп-листе нет позиций",
};

export function DescriptionQueueComplete({ filterId, onBack }: { filterId: OverviewFilterId; onBack: () => void }) {
  return (
    <div className="flex min-w-0 flex-1 items-center justify-center p-8">
      <div className="w-full max-w-[360px] rounded-[12px] border border-[#e7e5e4] bg-white px-5 py-4 shadow-[0_2px_8px_rgba(41,37,36,0.05)]">
        <h2 className="text-[16px] font-medium leading-6 text-[#292524]">
          {AUDIT_QUEUE_EMPTY_TITLE[filterId] ?? "В текущей выборке нет позиций"}
        </h2>
        <p className="mt-2 text-[13px] leading-5 text-[#79716b]">
          В текущей выборке больше нет позиций для этой очереди.
        </p>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex h-8 items-center justify-center rounded-[8px] bg-[#292524] px-3 text-[13px] font-medium text-white transition hover:bg-[#44403b] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10"
        >
          Вернуться к таблице
        </button>
      </div>
    </div>
  );
}
