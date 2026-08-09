import { beforeEach, describe, expect, it } from "vitest";
import { getCatalogSeedForScenario } from "@/data/catalog";
import { catalogStorageKey } from "@/lib/catalog-preview";
import {
  CATALOG_DATA_SCENARIO_STORAGE_KEY,
  readCatalogDataScenario,
  resetCatalogDataScenario,
  selectCatalogDataScenario,
  writeCatalogDataScenario,
} from "./catalog-data-scenarios";

describe("catalog prototype data scenarios", () => {
  beforeEach(() => window.localStorage.clear());

  it("provides empty, deterministic demo, and unchanged client seeds", () => {
    expect(getCatalogSeedForScenario("empty")).toEqual({ sections: [], items: [] });

    const firstDemo = getCatalogSeedForScenario("demo");
    const secondDemo = getCatalogSeedForScenario("demo");
    expect(firstDemo).toEqual(secondDemo);
    expect(firstDemo.sections).toHaveLength(3);
    expect(firstDemo.items).toHaveLength(7);
    expect(firstDemo.sections.some((section) => section.parentId !== null)).toBe(true);

    const client = getCatalogSeedForScenario("client");
    expect(client.sections).toHaveLength(64);
    expect(client.items).toHaveLength(528);
    expect(client.sections[0]?.name).toBe("Кухня");
  });

  it("persists the selected scenario outside catalog runtime keys", () => {
    writeCatalogDataScenario("demo");
    expect(readCatalogDataScenario()).toBe("demo");
    expect(window.localStorage.getItem(CATALOG_DATA_SCENARIO_STORAGE_KEY)).toBe("demo");
  });

  it("resets only catalog state and keeps the selected scenario and unrelated prototype settings", () => {
    window.localStorage.setItem("tasko.prototype.unrelated", "keep");
    window.localStorage.setItem(catalogStorageKey("createdItems"), "[1]");
    window.localStorage.setItem(catalogStorageKey("statusOverrides"), "{\"item\":\"archive\"}");

    selectCatalogDataScenario("empty");
    expect(readCatalogDataScenario()).toBe("empty");
    expect(window.localStorage.getItem(catalogStorageKey("createdItems"))).toBeNull();
    expect(window.localStorage.getItem(catalogStorageKey("statusOverrides"))).toBeNull();
    expect(window.localStorage.getItem(catalogStorageKey("phase"))).toBe("empty");
    expect(window.localStorage.getItem("tasko.prototype.unrelated")).toBe("keep");

    window.localStorage.setItem(catalogStorageKey("createdItems"), "[2]");
    resetCatalogDataScenario();
    expect(window.localStorage.getItem(catalogStorageKey("createdItems"))).toBeNull();
    expect(readCatalogDataScenario()).toBe("empty");
  });
});
