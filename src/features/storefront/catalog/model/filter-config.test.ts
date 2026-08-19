import { describe, expect, it } from "vitest";
import {
  normalizeCatalogTableFilterIds,
  updateCatalogTableFilterIds,
} from "./filter-config";

describe("catalog table filter groups", () => {
  it("combines filters from different categories", () => {
    expect(updateCatalogTableFilterIds(["status:active"], "quick:no-photo")).toEqual([
      "status:active",
      "quick:no-photo",
    ]);
  });

  it("replaces only the selected category", () => {
    expect(updateCatalogTableFilterIds(["status:active", "quick:no-photo"], "quick:no-description")).toEqual([
      "status:active",
      "quick:no-description",
    ]);
  });

  it("clears every category through all positions", () => {
    expect(updateCatalogTableFilterIds(["status:active", "quick:no-photo"], "quick:all")).toEqual([]);
  });

  it("normalizes restored filters to one value per category", () => {
    expect(normalizeCatalogTableFilterIds([
      "status:active",
      "quick:no-photo",
      "status:archived",
      "display:full",
      "display:no-button",
    ])).toEqual(["quick:no-photo", "status:archived", "display:no-button"]);
  });
});
