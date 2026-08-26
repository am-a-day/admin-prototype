import { act, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { CatalogStoreProvider, useCatalogStore } from "./catalog-store-context";
import { MockAuthProvider } from "./mock-auth-context";
import { catalogItems } from "@/data/catalog";

describe("CatalogStoreProvider menu language translations", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("tasko.mockAuth.session.v1", "seed-owner");
  });

  it("adds mock translations for every enabled language to a new position", async () => {
    let store: ReturnType<typeof useCatalogStore> | null = null;

    function Probe() {
      store = useCatalogStore();
      return null;
    }

    render(
      <MockAuthProvider>
        <CatalogStoreProvider>
          <Probe />
        </CatalogStoreProvider>
      </MockAuthProvider>,
    );

    act(() => {
      store?.addItem({
        ...catalogItems[0],
        id: "new-translated-position",
        title: "Новое блюдо",
        titleTranslations: { ru: "Новое блюдо" },
      });
    });

    await waitFor(() => {
      expect(store?.items.find(({ id }) => id === "new-translated-position")?.titleTranslations)
        .toEqual({
          ru: "Новое блюдо",
          kk: "Новое блюдо",
          en: "Новое блюдо",
          zh: "Новое блюдо",
          fr: "Новое блюдо",
          es: "Новое блюдо",
        });
    });
  });
});
