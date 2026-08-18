import { useLayoutEffect, useState } from "react";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  PREVIEW_PANEL_TRANSITION_MS,
  PreviewPanelProvider,
  usePreviewPanel,
} from "./preview-panel-context";

function SidePeekProbe() {
  const previewPanel = usePreviewPanel();
  const [item, setItem] = useState("Первая позиция");

  useLayoutEffect(() => previewPanel?.registerSidePeek(), [previewPanel?.registerSidePeek]);

  if (!previewPanel) return null;
  return (
    <>
      <span>{item}</span>
      <button type="button" onClick={previewPanel.toggle}>Переключить предпросмотр</button>
      <button type="button" onClick={() => setItem("Вторая позиция")}>Следующая позиция</button>
      {previewPanel.returnControlVisible && (
        <button type="button" onClick={previewPanel.show}>Показать предпросмотр</button>
      )}
    </>
  );
}

function PreviewHarness() {
  const [open, setOpen] = useState(true);
  return (
    <PreviewPanelProvider open={open} onOpenChange={setOpen}>
      <SidePeekProbe />
    </PreviewPanelProvider>
  );
}

describe("PreviewPanelProvider", () => {
  afterEach(() => vi.useRealTimers());

  it("shows the return control after the exit and keeps it across position changes", () => {
    vi.useFakeTimers();
    render(<PreviewHarness />);

    fireEvent.click(screen.getByRole("button", { name: "Переключить предпросмотр" }));
    expect(screen.queryByRole("button", { name: "Показать предпросмотр" })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(PREVIEW_PANEL_TRANSITION_MS - 1));
    expect(screen.queryByRole("button", { name: "Показать предпросмотр" })).not.toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    fireEvent.click(screen.getByRole("button", { name: "Следующая позиция" }));
    expect(screen.getByText("Вторая позиция")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Показать предпросмотр" })).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Показать предпросмотр" }));
    expect(screen.queryByRole("button", { name: "Показать предпросмотр" })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: "Переключить предпросмотр" }));
    act(() => vi.advanceTimersByTime(PREVIEW_PANEL_TRANSITION_MS));
    expect(screen.getByRole("button", { name: "Показать предпросмотр" })).toBeInTheDocument();
  });
});
