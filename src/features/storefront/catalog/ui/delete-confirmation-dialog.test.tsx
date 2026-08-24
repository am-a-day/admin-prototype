import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { DeleteConfirmationDialog } from "./delete-confirmation-dialog";

function ControlledDialog({ onConfirm = vi.fn() }: { onConfirm?: () => void | Promise<void> }) {
  const [open, setOpen] = useState(true);
  return (
    <DeleteConfirmationDialog
      kind="position"
      open={open}
      title="Удалить позицию «Том-ям» навсегда?"
      description="После удаления восстановить позицию будет нельзя."
      onOpenChange={setOpen}
      onConfirm={onConfirm}
    />
  );
}

describe("DeleteConfirmationDialog", () => {
  it("renders the compact destructive confirmation and closes without confirming", async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn();
    const { rerender } = render(<ControlledDialog onConfirm={onConfirm} />);

    const dialog = screen.getByRole("alertdialog", { name: "Удалить позицию «Том-ям» навсегда?" });
    expect(dialog).toHaveClass("max-w-[338px]", "rounded-[16px]", "p-0");
    expect(screen.getByText("После удаления восстановить позицию будет нельзя.")).toHaveClass("text-[13px]", "leading-5");
    expect(screen.getByRole("button", { name: "Удалить навсегда" })).toHaveClass("h-7", "bg-[#ec003f]");

    await user.click(screen.getByRole("button", { name: "Отмена" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(<ControlledDialog key="close-button" onConfirm={onConfirm} />);
    await user.click(screen.getByRole("button", { name: "Закрыть" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();

    rerender(<ControlledDialog key="escape" onConfirm={onConfirm} />);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("guards an in-flight deletion from repeated confirmation", async () => {
    let resolveDelete: (() => void) | undefined;
    const onConfirm = vi.fn(() => new Promise<void>((resolve) => {
      resolveDelete = resolve;
    }));
    render(<ControlledDialog onConfirm={onConfirm} />);

    const confirm = screen.getByRole("button", { name: "Удалить навсегда" });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(confirm).toBeDisabled();
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();

    resolveDelete?.();
    await waitFor(() => expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument());
  });

  it("keeps the dialog open and reports a failed deletion", async () => {
    const user = userEvent.setup();
    render(<ControlledDialog onConfirm={() => Promise.reject(new Error("Удаление недоступно"))} />);

    await user.click(screen.getByRole("button", { name: "Удалить навсегда" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Удаление недоступно");
    expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Удалить навсегда" })).toBeEnabled();
  });
});
