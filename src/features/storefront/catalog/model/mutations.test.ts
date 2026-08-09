import { describe, expect, it } from "vitest";
import { moveCatalogItemIds, reorderCatalogIds } from "./mutations";

describe("catalog mutation order contract", () => {
  it("uses the same before/after contract for table and composition reorder", () => {
    expect(reorderCatalogIds(["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"]);
    expect(reorderCatalogIds(["a", "b", "c"], "a", "c", "after")).toEqual(["b", "c", "a"]);
  });

  it("moves an item into a destination at the canonical index", () => {
    expect(moveCatalogItemIds(["a", "b"], ["c", "d"], "b", 1)).toEqual({
      sourceIds: ["a"],
      targetIds: ["c", "b", "d"],
    });
  });
});
