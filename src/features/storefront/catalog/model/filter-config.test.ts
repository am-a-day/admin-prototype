import { describe, expect, it } from "vitest";
import {
  normalizeCatalogTableActiveFilter,
  updateCatalogTableActiveFilter,
} from "./filter-config";

describe("catalog table active filter", () => {
  it("replaces a selected value with one from another category", () => {
    expect(updateCatalogTableActiveFilter("quick:no-description", "status:archived")).toBe("status:archived");
  });

  it("replaces a selected value inside the same category", () => {
    expect(updateCatalogTableActiveFilter("quick:no-photo", "quick:no-description")).toBe("quick:no-description");
  });

  it("clears the current value through all positions", () => {
    expect(updateCatalogTableActiveFilter("status:active", "quick:all")).toBeNull();
  });

  it("restores only the last value from legacy multi-filter state", () => {
    expect(normalizeCatalogTableActiveFilter([
      "status:active",
      "quick:no-photo",
      "status:archived",
      "display:full",
      "display:no-button",
    ])).toBe("display:no-button");
  });
});
