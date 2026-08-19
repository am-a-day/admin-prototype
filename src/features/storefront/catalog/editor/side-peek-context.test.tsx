import { useState } from "react";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import {
  DropdownMenu as SharedDropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PositionSidePeekProvider, usePositionSidePeekOverlay } from "./side-peek-context";

function SidePeekContent() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [selectValue, setSelectValue] = useState("one");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div data-testid="side-peek-content">
      <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
        <PopoverTrigger asChild>
          <button type="button">Открыть Popover</button>
        </PopoverTrigger>
        <PopoverContent>
          <div data-testid="popover-content">Содержимое Popover</div>
        </PopoverContent>
      </Popover>

      <Select value={selectValue} onValueChange={setSelectValue}>
        <SelectTrigger aria-label="Выбрать значение">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="one">Первое значение</SelectItem>
          <SelectItem value="two">Второе значение</SelectItem>
        </SelectContent>
      </Select>

      <DropdownMenu.Root open={dropdownOpen} onOpenChange={setDropdownOpen}>
        <DropdownMenu.Trigger asChild>
          <button type="button">Открыть Dropdown</button>
        </DropdownMenu.Trigger>
        <DropdownMenu.Portal>
          <DropdownMenu.Content>
            <DropdownMenu.Item>Пункт Dropdown</DropdownMenu.Item>
          </DropdownMenu.Content>
        </DropdownMenu.Portal>
      </DropdownMenu.Root>
    </div>
  );
}

function NestedOverlayContent() {
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  usePositionSidePeekOverlay(popoverOpen, () => setPopoverOpen(false));

  return (
    <Popover
      open={popoverOpen}
      onOpenChange={setPopoverOpen}
    >
      <PopoverTrigger asChild>
        <button type="button">Открыть внешний Popover</button>
      </PopoverTrigger>
      <PopoverContent
        data-testid="outer-popover-content"
        onPointerDownOutside={() => setPopoverOpen(false)}
      >
        <SharedDropdownMenu modal={false} open={dropdownOpen} onOpenChange={setDropdownOpen}>
          <DropdownMenuTrigger asChild>
            <button type="button">Открыть внутренний Dropdown</button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Внутренний пункт</DropdownMenuItem>
          </DropdownMenuContent>
        </SharedDropdownMenu>
      </PopoverContent>
    </Popover>
  );
}

function SidePeekHarness({ onRequestClose }: { onRequestClose: () => void }) {
  return (
    <>
      <PositionSidePeekProvider requestClose={onRequestClose}>
        <SidePeekContent />
      </PositionSidePeekProvider>
      <div data-testid="neutral-surface">Пустое место</div>
      <div role="button" data-catalog-table-row="position-1">Позиция</div>
      <button type="button">Другая кнопка</button>
    </>
  );
}

describe("PositionSidePeekProvider", () => {
  it("dismisses a Popover first and keeps Side Peek open for the same pointer interaction", async () => {
    const onRequestClose = vi.fn();
    const user = userEvent.setup();
    render(<SidePeekHarness onRequestClose={onRequestClose} />);

    await user.click(screen.getByRole("button", { name: "Открыть Popover" }));
    expect(screen.getByTestId("popover-content")).toBeInTheDocument();

    await user.click(screen.getByTestId("neutral-surface"));
    await waitFor(() => expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument());
    expect(onRequestClose).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("neutral-surface"));
    await waitFor(() => expect(onRequestClose).toHaveBeenCalledTimes(1));
  });

  it("keeps Side Peek open when a Select value is chosen", async () => {
    const onRequestClose = vi.fn();
    render(<SidePeekHarness onRequestClose={onRequestClose} />);

    fireEvent.click(screen.getByRole("combobox", { name: "Выбрать значение" }));
    await waitFor(() => expect(screen.getByRole("option", { name: "Второе значение" })).toBeInTheDocument());
    fireEvent.click(screen.getByRole("option", { name: "Второе значение" }));

    expect(screen.getByRole("combobox", { name: "Выбрать значение" })).toHaveTextContent("Второе значение");
    expect(screen.queryByRole("option", { name: "Второе значение" })).not.toBeInTheDocument();
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("keeps Side Peek open when a Dropdown item is selected", async () => {
    const onRequestClose = vi.fn();
    const user = userEvent.setup();
    render(<SidePeekHarness onRequestClose={onRequestClose} />);

    await user.click(screen.getByRole("button", { name: "Открыть Dropdown" }));
    await waitFor(() => expect(screen.getByRole("menuitem", { name: "Пункт Dropdown" })).toBeInTheDocument());
    await user.click(screen.getByRole("menuitem", { name: "Пункт Dropdown" }));

    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("dismisses nested portal layers from top to bottom", async () => {
    const onRequestClose = vi.fn();
    const user = userEvent.setup();
    render(
      <>
        <PositionSidePeekProvider requestClose={onRequestClose}>
          <NestedOverlayContent />
        </PositionSidePeekProvider>
        <div data-testid="nested-neutral-surface">Пустое место</div>
      </>,
    );

    await user.click(screen.getByRole("button", { name: "Открыть внешний Popover" }));
    await user.click(screen.getByRole("button", { name: "Открыть внутренний Dropdown" }));
    await user.click(screen.getByTestId("nested-neutral-surface"));

    await waitFor(() => expect(screen.queryByRole("menuitem", { name: "Внутренний пункт" })).not.toBeInTheDocument());
    expect(screen.getByTestId("outer-popover-content")).toBeInTheDocument();
    expect(onRequestClose).not.toHaveBeenCalled();

    await user.click(screen.getByTestId("nested-neutral-surface"));
    await waitFor(() => expect(screen.queryByTestId("outer-popover-content")).not.toBeInTheDocument());
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it("closes a Popover before Side Peek on Escape", async () => {
    const onRequestClose = vi.fn();
    const user = userEvent.setup();
    render(<SidePeekHarness onRequestClose={onRequestClose} />);

    await user.click(screen.getByRole("button", { name: "Открыть Popover" }));
    await user.keyboard("{Escape}");
    await waitFor(() => expect(screen.queryByTestId("popover-content")).not.toBeInTheDocument());
    expect(onRequestClose).not.toHaveBeenCalled();

    await user.keyboard("{Escape}");
    await waitFor(() => expect(onRequestClose).toHaveBeenCalledTimes(1));
  });

  it("closes Side Peek for a neutral outside click when no overlay is open", async () => {
    const onRequestClose = vi.fn();
    const user = userEvent.setup();
    render(<SidePeekHarness onRequestClose={onRequestClose} />);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    await user.click(screen.getByTestId("neutral-surface"));

    await waitFor(() => expect(onRequestClose).toHaveBeenCalledTimes(1));
  });

  it("ignores clicks on Side Peek content and controls", async () => {
    const onRequestClose = vi.fn();
    const user = userEvent.setup();
    render(<SidePeekHarness onRequestClose={onRequestClose} />);
    await new Promise((resolve) => window.setTimeout(resolve, 0));

    await user.click(screen.getByTestId("side-peek-content"));
    await user.click(screen.getByRole("button", { name: "Позиция" }));
    await user.click(screen.getByRole("button", { name: "Другая кнопка" }));

    expect(onRequestClose).not.toHaveBeenCalled();
  });
});
