import { type ReactNode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppSettingsProvider } from "@/contexts/app-settings-context";
import { CatalogStoreProvider, useCatalogStore } from "@/contexts/catalog-store-context";
import { MockAuthProvider } from "@/contexts/mock-auth-context";
import { TranslationsProvider, useTranslations } from "@/contexts/translations-context";
import { catalogItems, catalogSections } from "@/data/catalog";

function Providers({ children }: { children: ReactNode }) {
  const sourceItem = catalogItems[0];
  const section = catalogSections.find((candidate) => candidate.id === sourceItem.sectionId) ?? catalogSections[0];
  return (
    <MockAuthProvider>
      <AppSettingsProvider>
        <CatalogStoreProvider initialData={{
          sections: [section],
          items: [{
            ...sourceItem,
            id: "translation-status-item",
            title: "Статусная позиция",
            description: "Описание для перевода",
            hasDescription: true,
            titleTranslations: {},
            descriptionTranslations: {},
          }],
        }}>
          <TranslationsProvider>{children}</TranslationsProvider>
        </CatalogStoreProvider>
      </AppSettingsProvider>
    </MockAuthProvider>
  );
}

function CatalogSummaryProbe() {
  const { items } = useCatalogStore();
  const { autoTranslateField, getCatalogSummary, languages, materials, updateField } = useTranslations();
  const item = items[0];
  const material = materials.find((candidate) => candidate.catalogItemId === item.id)!;
  const english = getCatalogSummary(item).languages.find(({ code }) => code === "en")!;

  return (
    <>
      <output aria-label="Статус английского">{english.complete ? "complete" : "incomplete"}</output>
      <output aria-label="Языки каталога">
        {languages.map(({ code, published }) => `${code}:${published ? "visible" : "hidden"}`).join(",")}
      </output>
      <button type="button" onClick={() => updateField(material.id, "title", "en", "Status item")}>Ввести название вручную</button>
      <button type="button" onClick={() => autoTranslateField(material.id, "description", "en")}>Перевести описание AI</button>
      <button type="button" onClick={() => updateField(material.id, "description", "en", "")}>Удалить перевод описания</button>
    </>
  );
}

describe("catalog translation summary", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
    window.localStorage.setItem("tasko.translations.reset-languages.v1.seed-owner", JSON.stringify(["en"]));
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      translatedText: "AI description",
      provider: "mymemory",
      upstreamRequestCount: 1,
      durationMs: 1,
      artificialDelayMs: 0,
    }), { status: 200, headers: { "content-type": "application/json" } })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("uses all added target languages and reacts to manual, AI, and cleared translations", async () => {
    const user = userEvent.setup();
    render(<CatalogSummaryProbe />, { wrapper: Providers });

    expect(screen.getByLabelText("Языки каталога")).not.toHaveTextContent("ru:");
    expect(screen.getByLabelText("Языки каталога")).toHaveTextContent("kk:hidden");
    expect(screen.getByLabelText("Статус английского")).toHaveTextContent("incomplete");

    await user.click(screen.getByRole("button", { name: "Ввести название вручную" }));
    expect(screen.getByLabelText("Статус английского")).toHaveTextContent("incomplete");

    await user.click(screen.getByRole("button", { name: "Перевести описание AI" }));
    await waitFor(() => expect(screen.getByLabelText("Статус английского")).toHaveTextContent("complete"));

    await user.click(screen.getByRole("button", { name: "Удалить перевод описания" }));
    expect(screen.getByLabelText("Статус английского")).toHaveTextContent("incomplete");
  });
});
