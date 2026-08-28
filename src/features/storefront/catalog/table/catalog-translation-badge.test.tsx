import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CatalogTranslationBadge } from "./catalog-table";

function renderBadge(complete: boolean) {
  return render(
    <TooltipProvider>
      <CatalogTranslationBadge
        progress={{ code: "en", label: "English", complete }}
      />
    </TooltipProvider>,
  );
}

describe("CatalogTranslationBadge", () => {
  it("renders a neutral, non-interactive completed badge with the Figma dimensions", async () => {
    const user = userEvent.setup();
    renderBadge(true);

    const badge = screen.getByRole("img", { name: "English: Переведено" });
    expect(badge.tagName).toBe("SPAN");
    expect(badge.closest("button")).toBeNull();
    expect(badge).toHaveTextContent("EN");
    expect(badge).toHaveClass("h-[14px]", "gap-[2px]", "rounded-[4px]", "border-[#d6d3d1]", "text-[#333]");
    expect(badge.querySelector("svg")).toHaveAttribute("width", "10");
    expect(badge.querySelector("svg")).toHaveAttribute("height", "10");

    await user.hover(badge);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Переведено");
  });

  it("uses CircleDashed and the incomplete tooltip when a required field is empty", async () => {
    const user = userEvent.setup();
    renderBadge(false);

    const badge = screen.getByRole("img", { name: "English: Не всё переведено" });
    expect(badge).toHaveClass("border-[#e7e5e4]", "text-[#999]");

    await user.hover(badge);
    expect(await screen.findByRole("tooltip")).toHaveTextContent("Не всё переведено");
  });
});
