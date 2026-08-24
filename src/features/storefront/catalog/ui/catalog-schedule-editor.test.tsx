import { fireEvent, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { CatalogSchedulePopover, createDefaultWeeklySchedule } from "./catalog-schedule-editor";

describe("CatalogSchedulePopover", () => {
  it("autosaves a time change while Done only closes the popover", () => {
    const onChange = vi.fn();
    const onClose = vi.fn();

    render(
      <CatalogSchedulePopover
        scheduleId="test-schedule"
        hasSchedule
        initialSchedule={createDefaultWeeklySchedule()}
        initialOutsideScheduleMode="hidden"
        layout="cascade"
        onChange={onChange}
        onClose={onClose}
        showDelete={false}
      />,
    );

    fireEvent.change(screen.getByLabelText("Понедельник: начало интервала"), {
      target: { value: "10:00" },
    });

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        monday: { mode: "custom", timeRange: { start: "10:00", end: "18:00" } },
      }),
      "hidden",
    );

    fireEvent.click(screen.getByRole("button", { name: "Готово" }));

    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledTimes(1);
  });

  it("autosaves day and outside-schedule modes immediately", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();

    render(
      <CatalogSchedulePopover
        scheduleId="test-schedule"
        hasSchedule
        initialSchedule={createDefaultWeeklySchedule()}
        initialOutsideScheduleMode="hidden"
        layout="cascade"
        onChange={onChange}
        onClose={vi.fn()}
        showDelete={false}
      />,
    );

    await user.click(screen.getByRole("button", { name: "Среда: режим расписания" }));
    await user.click(screen.getByRole("menuitemradio", { name: "По часам" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        wednesday: { mode: "custom", timeRange: { start: "09:00", end: "18:00" } },
      }),
      "hidden",
    );

    await user.click(screen.getByRole("button", { name: "Режим вне расписания" }));
    await user.click(screen.getByRole("menuitemradio", { name: "Показывать как «скоро будет»" }));

    expect(onChange).toHaveBeenCalledTimes(2);
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({
        wednesday: { mode: "custom", timeRange: { start: "09:00", end: "18:00" } },
      }),
      "comingSoon",
    );
  });
});
