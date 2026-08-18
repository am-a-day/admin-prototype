import { useState } from "react";
import { createPortal } from "react-dom";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { PositionSidePeekProvider, usePositionSidePeekOverlay } from "./side-peek-context";

function OverlayProbe({ open, onClose }: { open: boolean; onClose: () => void }) {
  usePositionSidePeekOverlay(open, onClose);
  return open ? createPortal(<div role="dialog" data-testid="portal-overlay">Настройки</div>, document.body) : null;
}

function SidePeekHarness({ onRequestClose }: { onRequestClose: () => void }) {
  const [overlayOpen, setOverlayOpen] = useState(false);
  return (
    <>
      <PositionSidePeekProvider requestClose={onRequestClose}>
        <button type="button" onClick={() => setOverlayOpen(true)}>Открыть overlay</button>
        <div data-testid="side-peek-content">Содержимое Side Peek</div>
        <OverlayProbe open={overlayOpen} onClose={() => setOverlayOpen(false)} />
      </PositionSidePeekProvider>
      <div data-testid="neutral-surface">Пустое место</div>
      <div role="button" data-catalog-table-row="position-1">Позиция</div>
      <button type="button">Другая кнопка</button>
    </>
  );
}

describe("PositionSidePeekProvider", () => {
  it("closes on a neutral outside click but ignores controls and table-like rows", () => {
    const onRequestClose = vi.fn();
    render(<SidePeekHarness onRequestClose={onRequestClose} />);

    fireEvent.click(screen.getByTestId("side-peek-content"));
    fireEvent.click(screen.getByRole("button", { name: "Позиция" }));
    fireEvent.click(screen.getByRole("button", { name: "Другая кнопка" }));
    fireEvent.click(screen.getByTestId("neutral-surface"));

    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the pane open for a portal overlay and closes the overlay before the pane on Escape", () => {
    const onRequestClose = vi.fn();
    render(<SidePeekHarness onRequestClose={onRequestClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Открыть overlay" }));
    expect(screen.getByTestId("portal-overlay")).toBeInTheDocument();

    fireEvent.click(screen.getByTestId("neutral-surface"));
    expect(onRequestClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(screen.queryByTestId("portal-overlay")).not.toBeInTheDocument();
    expect(onRequestClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: "Escape" });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
  });
});
