import { useEffect, useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { CaretDown, CaretUpDown, Clock, Copy, Eye, MinusCircle } from "@phosphor-icons/react";
import type {
  CatalogAvailabilityScheduleMode,
  CatalogScheduleDay,
  CatalogScheduleDayKey,
  CatalogWeeklySchedule,
} from "@/data/catalog";
import { cn } from "@/lib/utils";
import {
  CATALOG_DROPDOWN_CONTENT_CLASS,
  CATALOG_DROPDOWN_ITEM_CLASS,
  CATALOG_DROPDOWN_SEPARATOR_CLASS,
} from "./catalog-dropdown";
import { usePositionSidePeekOverlay, usePositionSidePeekOverlayLayer } from "../editor/side-peek-context";

export type ScheduleDay = CatalogScheduleDay;
export type ScheduleDayKey = CatalogScheduleDayKey;
export type WeeklySchedule = CatalogWeeklySchedule;
export type AvailabilityScheduleMode = CatalogAvailabilityScheduleMode;
export type ScheduleOutsideDisplayMode = "hidden" | "comingSoon";

type ScheduleTimeRange = { start: string; end: string };

const DEFAULT_TIME_RANGE: ScheduleTimeRange = { start: "09:00", end: "18:00" };

export const DAY_LABELS: { key: ScheduleDayKey; label: string }[] = [
  { key: "monday", label: "Понедельник" },
  { key: "tuesday", label: "Вторник" },
  { key: "wednesday", label: "Среда" },
  { key: "thursday", label: "Четверг" },
  { key: "friday", label: "Пятница" },
  { key: "saturday", label: "Суббота" },
  { key: "sunday", label: "Воскресенье" },
];

export function createDefaultWeeklySchedule(): WeeklySchedule {
  return {
    monday: { mode: "custom", timeRange: { ...DEFAULT_TIME_RANGE } },
    tuesday: { mode: "allDay" },
    wednesday: { mode: "unavailable" },
    thursday: { mode: "allDay" },
    friday: { mode: "unavailable" },
    saturday: { mode: "allDay" },
    sunday: { mode: "allDay" },
  };
}

export function createEmptyWeeklySchedule(): WeeklySchedule {
  return {
    monday: { mode: "unavailable" },
    tuesday: { mode: "unavailable" },
    wednesday: { mode: "unavailable" },
    thursday: { mode: "unavailable" },
    friday: { mode: "unavailable" },
    saturday: { mode: "unavailable" },
    sunday: { mode: "unavailable" },
  };
}

function timeToMinutes(value: string) {
  const match = /^(\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;
  return hours * 60 + minutes;
}

/** Converts schedules saved by the former multi-interval prototype to the new single-range model. */
function getTimeRange(day: Extract<ScheduleDay, { mode: "custom" }>): ScheduleTimeRange {
  const legacyDay = day as unknown as { timeRange?: ScheduleTimeRange; intervals?: ScheduleTimeRange[] };
  return legacyDay.timeRange ?? legacyDay.intervals?.[0] ?? DEFAULT_TIME_RANGE;
}

function cloneDay(day: ScheduleDay): ScheduleDay {
  return day.mode === "custom"
    ? { mode: "custom", timeRange: { ...getTimeRange(day) } }
    : { ...day };
}

function normalizeWeeklySchedule(schedule: WeeklySchedule): WeeklySchedule {
  return DAY_LABELS.reduce<WeeklySchedule>((normalized, { key }) => {
    normalized[key] = cloneDay(schedule[key]);
    return normalized;
  }, {} as WeeklySchedule);
}

export function validateDaySchedule(day: ScheduleDay): string[] {
  if (day.mode !== "custom") return [];
  const range = getTimeRange(day);
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  if (start == null || end == null) return ["Укажите время"];
  if (start >= end) return ["Время начала должно быть раньше времени окончания"];
  return [];
}

export function isWeeklyScheduleValid(schedule: WeeklySchedule) {
  return DAY_LABELS.every((day) => validateDaySchedule(schedule[day.key]).length === 0);
}

const JS_DAY_TO_SCHEDULE_KEY: Record<number, ScheduleDayKey> = {
  0: "sunday",
  1: "monday",
  2: "tuesday",
  3: "wednesday",
  4: "thursday",
  5: "friday",
  6: "saturday",
};

export function isWeeklyScheduleOrderable(
  schedule: WeeklySchedule,
  mode: AvailabilityScheduleMode,
  now: Date,
) {
  const day = schedule[JS_DAY_TO_SCHEDULE_KEY[now.getDay()]];
  if (day.mode === "allDay") return true;
  if (day.mode === "unavailable") return false;
  const range = getTimeRange(day);
  const start = timeToMinutes(range.start);
  const end = timeToMinutes(range.end);
  const minute = now.getHours() * 60 + now.getMinutes();
  const insideRange = start != null && end != null && start < end && minute >= start && minute < end;
  return mode === "available" ? insideRange : !insideRange;
}

const DAY_MODE_OPTIONS = [
  { value: "allDay", label: "Круглосуточно" },
  { value: "custom", label: "По часам" },
  { value: "unavailable", label: "Недоступно" },
] as const;

function WeeklyScheduleRows({
  scheduleId,
  weeklySchedule,
  onWeeklyScheduleChange,
  variant = "default",
}: {
  scheduleId: string;
  weeklySchedule: WeeklySchedule;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  variant?: "default" | "availability";
}) {
  const [openDayMenu, setOpenDayMenu] = useState<ScheduleDayKey | null>(null);
  const schedule = normalizeWeeklySchedule(weeklySchedule);
  const compactAvailability = variant === "availability";
  const { marker, shouldPreventOverlayDismissal } = usePositionSidePeekOverlayLayer();
  usePositionSidePeekOverlay(openDayMenu !== null, () => setOpenDayMenu(null));

  const updateDay = (dayKey: ScheduleDayKey, day: ScheduleDay) => {
    onWeeklyScheduleChange({ ...schedule, [dayKey]: cloneDay(day) });
  };

  const applyToAllDays = (day: ScheduleDay) => {
    const next = DAY_LABELS.reduce<WeeklySchedule>((allDays, { key }) => {
      allDays[key] = cloneDay(day);
      return allDays;
    }, {} as WeeklySchedule);
    onWeeklyScheduleChange(next);
  };

  return (
    <div data-weekly-schedule-id={scheduleId} className={cn("overflow-hidden border border-[#e7e5e4] bg-white", compactAvailability ? "rounded-[15px]" : "rounded-[11px]")}>
      {DAY_LABELS.map(({ key, label }) => {
        const day = schedule[key];
        const timeRange = day.mode === "custom" ? getTimeRange(day) : null;
        const errors = validateDaySchedule(day);
        const statusLabel = day.mode === "allDay" ? "Круглосуточно" : "Недоступно";
        const setDayMode = (nextMode: ScheduleDay["mode"]) => {
          updateDay(
            key,
            nextMode === "custom"
              ? { mode: "custom", timeRange: day.mode === "custom" ? { ...getTimeRange(day) } : { ...DEFAULT_TIME_RANGE } }
              : { mode: nextMode },
          );
        };

        return (
          <div
            key={key}
            data-schedule-day={key}
            data-day-mode={day.mode}
            className="flex h-[42px] items-center gap-2 border-b border-[#e7e5e4] px-3 last:border-b-0"
          >
            <span className={cn("min-w-0 flex-1 truncate text-[13px] leading-5", day.mode === "unavailable" ? "text-[#a6a09b]" : "text-[#1c1917]")}>{label}</span>
            <DropdownMenu.Root open={openDayMenu === key} onOpenChange={(open) => setOpenDayMenu(open ? key : null)}>
              <div className={cn("flex shrink-0 items-center justify-end", day.mode === "custom" ? "w-[162px] gap-1" : "w-[120px]")}>
                {timeRange ? (
                  <>
                    <div className={cn("relative shrink-0", compactAvailability ? "w-[60px]" : "w-[52px]")}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={timeRange.start}
                        aria-label={`${label}: начало интервала`}
                        aria-invalid={errors.length > 0}
                        onChange={(event) => updateDay(key, { mode: "custom", timeRange: { ...timeRange, start: event.target.value } })}
                        className={cn(
                          "h-7 w-full rounded-[9px] border bg-white text-[13px] leading-5 text-[#44403b] outline-none transition focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5",
                          compactAvailability ? "pl-2 pr-6 text-left" : "px-1 text-center",
                          errors.length > 0 ? "border-[#b42318]" : "border-[#e7e5e4]",
                        )}
                      />
                      {compactAvailability && <Clock size={14} className="pointer-events-none absolute right-1.5 top-1.5 text-[#79716b]" aria-hidden="true" />}
                    </div>
                    <span className="px-0.5 text-[14px] leading-none text-[#79716b]">–</span>
                    <div className={cn("relative shrink-0", compactAvailability ? "w-[66px]" : "w-[52px]")}>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={timeRange.end}
                        aria-label={`${label}: конец интервала`}
                        aria-invalid={errors.length > 0}
                        onChange={(event) => updateDay(key, { mode: "custom", timeRange: { ...timeRange, end: event.target.value } })}
                        className={cn(
                          "h-7 w-full rounded-[9px] border bg-white text-[13px] leading-5 text-[#44403b] outline-none transition focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5",
                          compactAvailability ? "pl-2 pr-6 text-left" : "px-1 text-center",
                          errors.length > 0 ? "border-[#b42318]" : "border-[#e7e5e4]",
                        )}
                      />
                      {compactAvailability && <Clock size={14} className="pointer-events-none absolute right-1.5 top-1.5 text-[#79716b]" aria-hidden="true" />}
                    </div>
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        aria-label={`${label}: режим расписания`}
                        className="flex size-6 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] outline-none transition hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                      >
                        <CaretUpDown size={16} className="shrink-0" />
                      </button>
                    </DropdownMenu.Trigger>
                  </>
                ) : (
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      aria-label={`${label}: режим расписания`}
                      className="flex h-8 w-full items-center justify-end gap-2 rounded-[8px] text-[13px] leading-5 text-[#57534d] outline-none transition hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                    >
                      <span>{statusLabel}</span>
                      <CaretUpDown size={16} className="shrink-0 text-[#79716b]" />
                    </button>
                  </DropdownMenu.Trigger>
                )}
              </div>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  collisionPadding={12}
                  onPointerDownOutside={(event) => {
                    if (shouldPreventOverlayDismissal(event)) event.preventDefault();
                  }}
                  onInteractOutside={(event) => {
                    if (shouldPreventOverlayDismissal(event)) event.preventDefault();
                  }}
                  className={cn("z-[100006] min-w-[184px]", CATALOG_DROPDOWN_CONTENT_CLASS)}
                >
                  {marker}
                  <DropdownMenu.RadioGroup
                    value={day.mode}
                    onValueChange={(value) => {
                      setDayMode(value as ScheduleDay["mode"]);
                      setOpenDayMenu(null);
                    }}
                  >
                    {DAY_MODE_OPTIONS.map((option) => (
                      <DropdownMenu.RadioItem
                        key={option.value}
                        value={option.value}
                        className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "w-full justify-start text-left text-[#44403b]")}
                      >
                        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border bg-white", day.mode === option.value ? "border-[#292524]" : "border-[#d6d3d1]")}>
                          <DropdownMenu.ItemIndicator>
                            <span className="block size-2 rounded-full bg-[#292524]" />
                          </DropdownMenu.ItemIndicator>
                        </span>
                        <span className="min-w-0 flex-1 text-left">{option.label}</span>
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                  <DropdownMenu.Separator className={CATALOG_DROPDOWN_SEPARATOR_CLASS} />
                  <DropdownMenu.Item
                    onSelect={() => {
                      applyToAllDays(day);
                      setOpenDayMenu(null);
                    }}
                    className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}
                  >
                    <Copy size={15} className="shrink-0 text-[#57534d]" />
                    <span>Применить ко всем</span>
                  </DropdownMenu.Item>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
          </div>
        );
      })}
    </div>
  );
}

export function CatalogWeeklyScheduleEditor({
  scheduleId,
  weeklySchedule,
  onWeeklyScheduleChange,
  variant = "default",
}: {
  scheduleId: string;
  weeklySchedule: WeeklySchedule;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
  variant?: "default" | "availability";
}) {
  return (
    <div data-weekly-schedule-editor={scheduleId}>
      <WeeklyScheduleRows
        scheduleId={scheduleId}
        weeklySchedule={weeklySchedule}
        onWeeklyScheduleChange={onWeeklyScheduleChange}
        variant={variant}
      />
    </div>
  );
}

export function PositionWeeklyScheduleEditor({
  scheduleId,
  weeklySchedule,
  onWeeklyScheduleChange,
}: {
  scheduleId: string;
  weeklySchedule: WeeklySchedule;
  onWeeklyScheduleChange: (schedule: WeeklySchedule) => void;
}) {
  const [activeDay, setActiveDay] = useState<ScheduleDayKey>("monday");
  const [openDayMenu, setOpenDayMenu] = useState<ScheduleDayKey | null>(null);
  const [schedule, setSchedule] = useState<WeeklySchedule>(() => normalizeWeeklySchedule(weeklySchedule));
  const { marker, shouldPreventOverlayDismissal } = usePositionSidePeekOverlayLayer();

  useEffect(() => {
    setSchedule(normalizeWeeklySchedule(weeklySchedule));
  }, [scheduleId, weeklySchedule]);

  const updateDay = (dayKey: ScheduleDayKey, day: ScheduleDay) => {
    setActiveDay(dayKey);
    const nextSchedule = { ...schedule, [dayKey]: cloneDay(day) };
    setSchedule(nextSchedule);
    if (isWeeklyScheduleValid(nextSchedule)) onWeeklyScheduleChange(nextSchedule);
  };

  const applyActiveDayToAll = () => {
    const source = schedule[activeDay];
    if (validateDaySchedule(source).length > 0) return;
    const nextSchedule = DAY_LABELS.reduce<WeeklySchedule>((next, { key }) => {
      next[key] = cloneDay(source);
      return next;
    }, {} as WeeklySchedule);
    setSchedule(nextSchedule);
    onWeeklyScheduleChange(nextSchedule);
  };

  return (
    <section
      aria-label="Расписание"
      data-position-weekly-schedule={scheduleId}
      className="overflow-hidden rounded-[11px] border border-[#e7e5e4] bg-white"
    >
      <div className="flex h-10 items-center justify-between border-b border-[#e7e5e4] px-3">
        <h3 className="text-[13px] font-medium text-[#292524]">Расписание</h3>
        <button
          type="button"
          onClick={applyActiveDayToAll}
          disabled={validateDaySchedule(schedule[activeDay]).length > 0}
          className="rounded-[7px] px-1.5 py-1 text-[12px] font-medium text-[#79716b] transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#292524]/10 disabled:pointer-events-none disabled:opacity-40"
        >
          Применить ко всем
        </button>
      </div>

      {DAY_LABELS.map(({ key, label }) => {
        const day = schedule[key];
        const timeRange = day.mode === "custom" ? getTimeRange(day) : null;
        const errors = validateDaySchedule(day);
        const errorId = `${scheduleId}-${key}-time-error`;
        const statusLabel = day.mode === "allDay" ? "Круглосуточно" : "Недоступно";
        const setDayMode = (nextMode: ScheduleDay["mode"]) => {
          updateDay(
            key,
            nextMode === "custom"
              ? { mode: "custom", timeRange: day.mode === "custom" ? { ...getTimeRange(day) } : { ...DEFAULT_TIME_RANGE } }
              : { mode: nextMode },
          );
        };

        return (
          <div
            key={key}
            data-schedule-day={key}
            data-day-mode={day.mode}
            className="flex min-h-10 items-center gap-2 border-b border-[#e7e5e4] px-3 last:border-b-0"
            onPointerDown={() => setActiveDay(key)}
            onFocus={() => setActiveDay(key)}
          >
            <span className="min-w-0 flex-1 truncate text-[13px] leading-5 text-[#292524]">{label}</span>
            <DropdownMenu.Root open={openDayMenu === key} onOpenChange={(open) => {
              setActiveDay(key);
              setOpenDayMenu(open ? key : null);
            }}>
              <div className={cn("flex shrink-0 items-center justify-end", timeRange ? "gap-1" : "w-[126px]") }>
                {timeRange ? (
                  <>
                    <input
                      type="time"
                      value={timeRange.start}
                      aria-label={`${label}: начало`}
                      aria-invalid={errors.length > 0}
                      aria-describedby={errors.length ? errorId : undefined}
                      onChange={(event) => updateDay(key, { mode: "custom", timeRange: { ...timeRange, start: event.target.value } })}
                      className={cn("h-7 w-[62px] rounded-[8px] border bg-white px-1 text-center text-[12px] text-[#44403b] outline-none transition focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5", errors.length ? "border-[#b42318]" : "border-[#e7e5e4]")}
                    />
                    <span className="text-[13px] text-[#a8a29e]">—</span>
                    <input
                      type="time"
                      value={timeRange.end}
                      aria-label={`${label}: конец`}
                      aria-invalid={errors.length > 0}
                      aria-describedby={errors.length ? errorId : undefined}
                      onChange={(event) => updateDay(key, { mode: "custom", timeRange: { ...timeRange, end: event.target.value } })}
                      className={cn("h-7 w-[62px] rounded-[8px] border bg-white px-1 text-center text-[12px] text-[#44403b] outline-none transition focus:border-[#c7c2bd] focus:ring-2 focus:ring-[#292524]/5", errors.length ? "border-[#b42318]" : "border-[#e7e5e4]")}
                    />
                    <DropdownMenu.Trigger asChild>
                      <button
                        type="button"
                        aria-label={`${label}: режим расписания`}
                        className="flex size-6 shrink-0 items-center justify-center rounded-[7px] text-[#79716b] outline-none transition hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                      >
                        <CaretDown size={13} weight="bold" />
                      </button>
                    </DropdownMenu.Trigger>
                  </>
                ) : (
                  <DropdownMenu.Trigger asChild>
                    <button
                      type="button"
                      aria-label={`${label}: режим расписания`}
                      className="flex h-8 w-full items-center justify-end gap-1.5 rounded-[8px] px-1.5 text-[13px] leading-5 text-[#79716b] outline-none transition hover:bg-[#f5f5f4] hover:text-[#292524] focus-visible:ring-2 focus-visible:ring-[#292524]/10"
                    >
                      <span>{statusLabel}</span>
                      <CaretDown size={13} weight="bold" className="shrink-0" />
                    </button>
                  </DropdownMenu.Trigger>
                )}
              </div>
              <DropdownMenu.Portal>
                <DropdownMenu.Content
                  side="bottom"
                  align="end"
                  sideOffset={4}
                  collisionPadding={12}
                  onPointerDownOutside={(event) => {
                    if (shouldPreventOverlayDismissal(event)) event.preventDefault();
                  }}
                  onInteractOutside={(event) => {
                    if (shouldPreventOverlayDismissal(event)) event.preventDefault();
                  }}
                  className={cn("z-[100006] min-w-[168px]", CATALOG_DROPDOWN_CONTENT_CLASS)}
                >
                  {marker}
                  <DropdownMenu.RadioGroup
                    value={day.mode}
                    onValueChange={(value) => {
                      setDayMode(value as ScheduleDay["mode"]);
                      setOpenDayMenu(null);
                    }}
                  >
                    {([
                      { value: "allDay", label: "Круглосуточно" },
                      { value: "custom", label: "Своё время" },
                      { value: "unavailable", label: "Недоступно" },
                    ] as const).map((option) => (
                      <DropdownMenu.RadioItem
                        key={option.value}
                        value={option.value}
                        className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "w-full justify-start text-left text-[#44403b]")}
                      >
                        <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border bg-white", day.mode === option.value ? "border-[#292524]" : "border-[#d6d3d1]") }>
                          <DropdownMenu.ItemIndicator>
                            <span className="block size-2 rounded-full bg-[#292524]" />
                          </DropdownMenu.ItemIndicator>
                        </span>
                        <span className="min-w-0 flex-1">{option.label}</span>
                      </DropdownMenu.RadioItem>
                    ))}
                  </DropdownMenu.RadioGroup>
                </DropdownMenu.Content>
              </DropdownMenu.Portal>
            </DropdownMenu.Root>
            {errors.length > 0 && <span id={errorId} className="sr-only">{errors[0]}</span>}
          </div>
        );
      })}
    </section>
  );
}

export function CatalogSchedulePopover({
  scheduleId,
  hasSchedule,
  initialSchedule,
  initialOutsideScheduleMode,
  onChange,
  onDelete,
}: {
  scheduleId: string;
  hasSchedule: boolean;
  initialSchedule: WeeklySchedule;
  initialOutsideScheduleMode: ScheduleOutsideDisplayMode;
  onChange: (schedule: WeeklySchedule, outsideScheduleMode: ScheduleOutsideDisplayMode) => void;
  onDelete: () => void;
}) {
  const [schedule, setSchedule] = useState<WeeklySchedule>(() => normalizeWeeklySchedule(initialSchedule));
  const [outsideScheduleMode, setOutsideScheduleMode] = useState<ScheduleOutsideDisplayMode>(initialOutsideScheduleMode);
  const [outsideMenuOpen, setOutsideMenuOpen] = useState(false);
  const { marker, shouldPreventOverlayDismissal } = usePositionSidePeekOverlayLayer();
  usePositionSidePeekOverlay(outsideMenuOpen, () => setOutsideMenuOpen(false));

  const handleScheduleChange = (nextSchedule: WeeklySchedule) => {
    setSchedule(nextSchedule);
    onChange(nextSchedule, outsideScheduleMode);
  };

  const handleOutsideScheduleModeChange = (nextMode: ScheduleOutsideDisplayMode) => {
    setOutsideScheduleMode(nextMode);
    onChange(schedule, nextMode);
    setOutsideMenuOpen(false);
  };

  return (
    <div data-catalog-schedule-popover className={cn(CATALOG_DROPDOWN_CONTENT_CLASS, "w-[314px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[11px] border-[#e7e5e4] p-0")}>
      <WeeklyScheduleRows
        scheduleId={scheduleId}
        weeklySchedule={schedule}
        onWeeklyScheduleChange={handleScheduleChange}
      />

      <div className="border-t border-[#e7e5e4] bg-white">
        <DropdownMenu.Root open={outsideMenuOpen} onOpenChange={setOutsideMenuOpen}>
          <div className="flex h-[42px] items-center gap-3 px-3">
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <Eye size={16} className="shrink-0 text-[#1c1917]" />
              <span className="truncate text-[13px] leading-5 text-[#1c1917]">Вне расписания</span>
            </div>
            <DropdownMenu.Trigger asChild>
              <button
                type="button"
                aria-label="Режим вне расписания"
                className="flex h-8 w-[120px] shrink-0 items-center justify-end gap-2 rounded-[8px] text-[13px] leading-5 text-[#57534d] outline-none transition hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-[#292524]/10"
              >
                <span>{outsideScheduleMode === "comingSoon" ? "Показывать" : "Скрывать"}</span>
                <CaretUpDown size={16} className="shrink-0 text-[#79716b]" />
              </button>
            </DropdownMenu.Trigger>
          </div>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              side="bottom"
              align="end"
              sideOffset={4}
              collisionPadding={12}
              onPointerDownOutside={(event) => {
                if (shouldPreventOverlayDismissal(event)) event.preventDefault();
              }}
              onInteractOutside={(event) => {
                if (shouldPreventOverlayDismissal(event)) event.preventDefault();
              }}
              className={cn("z-[100006] min-w-[232px]", CATALOG_DROPDOWN_CONTENT_CLASS)}
            >
              {marker}
              <DropdownMenu.RadioGroup
                value={outsideScheduleMode}
                onValueChange={(value) => handleOutsideScheduleModeChange(value as ScheduleOutsideDisplayMode)}
              >
                {([
                  { value: "hidden", label: "Скрывать из меню" },
                  { value: "comingSoon", label: "Показывать как “скоро будет”" },
                ] as const).map((option) => (
                  <DropdownMenu.RadioItem
                    key={option.value}
                    value={option.value}
                    className={cn(CATALOG_DROPDOWN_ITEM_CLASS, "text-[#44403b]")}
                  >
                    <span className={cn("flex size-4 shrink-0 items-center justify-center rounded-full border bg-white", outsideScheduleMode === option.value ? "border-[#292524]" : "border-[#d6d3d1]")}>
                      <DropdownMenu.ItemIndicator>
                        <span className="block size-2 rounded-full bg-[#292524]" />
                      </DropdownMenu.ItemIndicator>
                    </span>
                    <span className="min-w-0 flex-1">{option.label}</span>
                  </DropdownMenu.RadioItem>
                ))}
              </DropdownMenu.RadioGroup>
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>

        {hasSchedule && (
          <>
            <div className="mx-3 h-px bg-[#e7e5e4]" />
            <button
              type="button"
              onClick={onDelete}
              className="flex h-[42px] w-full items-center gap-2 px-3 text-left text-[13px] leading-5 text-[#1c1917] outline-none transition hover:bg-[#f5f5f4] focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#292524]/10"
            >
              <MinusCircle size={16} className="shrink-0" />
              <span>Убрать расписание</span>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
