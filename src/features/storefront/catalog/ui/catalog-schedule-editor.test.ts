import { describe, expect, it } from "vitest";
import type { CatalogItem } from "@/data/catalog";
import { getEffectiveAvailability } from "../editor/position-editor";
import {
  DAY_LABELS,
  isWeeklyScheduleOrderable,
  type WeeklySchedule,
} from "./catalog-schedule-editor";

const baseSchedule: WeeklySchedule = {
  monday: { mode: "allDay" },
  tuesday: { mode: "allDay" },
  wednesday: { mode: "custom", timeRange: { start: "10:00", end: "12:00" } },
  thursday: { mode: "allDay" },
  friday: { mode: "allDay" },
  saturday: { mode: "allDay" },
  sunday: { mode: "allDay" },
};

describe("catalog position schedule semantics", () => {
  it("uses one custom time range as the available window in available mode", () => {
    expect(isWeeklyScheduleOrderable(baseSchedule, "available", new Date(2026, 7, 12, 11, 0))).toBe(true);
    expect(isWeeklyScheduleOrderable(baseSchedule, "available", new Date(2026, 7, 12, 13, 0))).toBe(false);
  });

  it("uses one custom time range as an exclusion in unavailable mode and leaves other days available", () => {
    expect(isWeeklyScheduleOrderable(baseSchedule, "unavailable", new Date(2026, 7, 12, 11, 0))).toBe(false);
    expect(isWeeklyScheduleOrderable(baseSchedule, "unavailable", new Date(2026, 7, 12, 13, 0))).toBe(true);
    expect(isWeeklyScheduleOrderable(baseSchedule, "unavailable", new Date(2026, 7, 13, 11, 0))).toBe(true);
  });

  it("keeps the weekday labels complete and ordered", () => {
    expect(DAY_LABELS.map((day) => day.label)).toEqual([
      "Понедельник",
      "Вторник",
      "Среда",
      "Четверг",
      "Пятница",
      "Суббота",
      "Воскресенье",
    ]);
  });

  it("gives a manual stop priority over the schedule display mode", () => {
    const scheduledItem = {
      status: "active",
      scheduled: true,
    } as CatalogItem;
    const settings = {
      unavailableDisplayMode: "hidden" as const,
      outsideScheduleMode: "comingSoon" as const,
      weeklySchedule: baseSchedule,
      scheduleMode: "available" as const,
    };

    expect(getEffectiveAvailability(scheduledItem, new Date(2026, 7, 12, 13, 0), settings)).toEqual({
      visible: true,
      orderable: false,
      badge: "Скоро будет",
    });
    expect(getEffectiveAvailability({ ...scheduledItem, status: "stopped" }, new Date(2026, 7, 12, 13, 0), settings)).toEqual({
      visible: false,
      orderable: false,
      badge: null,
    });
  });
});
