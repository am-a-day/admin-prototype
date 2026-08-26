import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import type { LanguageCode } from "@/data/languages";
import { ContentLanguageControl } from "./content-language-control";

function ControlledLanguageControl() {
  const [value, setValue] = useState<LanguageCode>("ru");
  return <ContentLanguageControl value={value} onChange={setValue} />;
}

describe("preview language control", () => {
  it("switches only its controlled preview value and marks unpublished languages as drafts", async () => {
    const user = userEvent.setup();
    render(
      <MockAuthProvider fixture>
        <ControlledLanguageControl />
      </MockAuthProvider>,
    );

    const trigger = screen.getByRole("button", { name: "Язык предпросмотра" });
    expect(trigger).toHaveTextContent("Русский");

    await user.click(trigger);
    const kazakh = screen.getByRole("menuitem", { name: /Қазақша.*Черновик/ });
    expect(kazakh).toBeInTheDocument();
    expect(screen.queryByText("Управлять языками")).not.toBeInTheDocument();

    await user.click(kazakh);
    expect(trigger).toHaveTextContent("Қазақша");
  });
});
