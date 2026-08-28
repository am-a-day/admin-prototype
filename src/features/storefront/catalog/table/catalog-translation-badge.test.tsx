import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CatalogTranslationBadge } from "./catalog-table";

function renderBadge(complete: boolean, onOpen = vi.fn()) {
  const result = render(
    <TooltipProvider>
      <CatalogTranslationBadge
        progress={{ code: "en", label: "English", complete }}
        onOpen={onOpen}
      />
    </TooltipProvider>,
  );
  return { ...result, onOpen };
}

describe("CatalogTranslationBadge", () => {
  it("renders a neutral completed chip with the exact Figma dimensions", async () => {
    const user = userEvent.setup();
    renderBadge(true);

    const badge = screen.getByRole("button", { name: "English: Переведено" });
    expect(badge.tagName).toBe("BUTTON");
    expect(badge).toHaveTextContent("EN");
    expect(badge).toHaveClass(
      "h-[17px]",
      "gap-[2.429px]",
      "rounded-[6px]",
      "border-[0.867px]",
      "py-[1.64px]",
      "pl-[2.429px]",
      "pr-[4.857px]",
      "text-[12px]",
      "font-medium",
      "border-[#d6d3d1]",
      "text-[#333]",
      "cursor-pointer",
      "hover:bg-[#f5f5f4]",
    );
    expect(badge.querySelector("svg")).toHaveAttribute("width", "13");
    expect(badge.querySelector("svg")).toHaveAttribute("height", "13");

    await user.hover(badge);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Переведено");
  });

  it("opens the selected language for both completed and incomplete chips", async () => {
    const user = userEvent.setup();
    const complete = renderBadge(true);

    await user.click(screen.getByRole("button", { name: "English: Переведено" }));
    expect(complete.onOpen).toHaveBeenCalledWith("en");

    complete.unmount();
    const incomplete = renderBadge(false);
    const badge = screen.getByRole("button", { name: "English: Не всё переведено" });
    expect(badge).toHaveClass("border-[#e7e5e4]", "font-normal", "text-[#999]");

    await user.hover(badge);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Не всё переведено");
    await user.unhover(badge);

    await user.click(badge);
    expect(incomplete.onOpen).toHaveBeenCalledWith("en");
  });

  it("does not trigger the table row action when the chip is clicked", async () => {
    const user = userEvent.setup();
    const rowAction = vi.fn();
    const onOpen = vi.fn();
    render(
      <TooltipProvider>
        <div role="button" tabIndex={0} onClick={rowAction}>
          <CatalogTranslationBadge
            progress={{ code: "kk", label: "Қазақша", complete: false }}
            onOpen={onOpen}
          />
        </div>
      </TooltipProvider>,
    );

    await user.click(screen.getByRole("button", { name: "Қазақша: Не всё переведено" }));

    expect(onOpen).toHaveBeenCalledWith("kk");
    expect(rowAction).not.toHaveBeenCalled();
  });
});
