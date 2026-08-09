import { describe, expect, it } from "vitest";
import {
  moveCatalogIdToIndex,
  moveCatalogItemIds,
  reorderCatalogIds,
  validateCatalogSiblingReorder,
} from "./mutations";

describe("catalog mutation order contract", () => {
  it("uses the same before/after contract for table and composition reorder", () => {
    expect(reorderCatalogIds(["a", "b", "c"], "c", "a", "before")).toEqual(["c", "a", "b"]);
    expect(reorderCatalogIds(["a", "b", "c"], "a", "c", "after")).toEqual(["b", "c", "a"]);
    expect(moveCatalogIdToIndex(["a", "b", "c"], "a", "c")).toEqual(["b", "c", "a"]);
    expect(moveCatalogIdToIndex(["a", "b", "c"], "c", "a")).toEqual(["c", "a", "b"]);
  });

  it("allows sibling reorder and rejects cross-parent DnD", () => {
    expect(validateCatalogSiblingReorder(
      { kind: "item", id: "a", parentId: "leaf" },
      { kind: "item", id: "b", parentId: "leaf" },
    )).toEqual({ valid: true });
    expect(validateCatalogSiblingReorder(
      { kind: "item", id: "a", parentId: "leaf" },
      { kind: "item", id: "b", parentId: "other-leaf" },
    )).toEqual({ valid: false, reason: "Для переноса в другой раздел используйте «Переместить»" });
    expect(validateCatalogSiblingReorder(
      { kind: "section", id: "a", parentId: "root" },
      { kind: "section", id: "b", parentId: "other-root" },
    )).toEqual({ valid: false, reason: "Для переноса в другой раздел используйте «Переместить»" });
  });

  it("moves an item into a destination at the canonical index", () => {
    expect(moveCatalogItemIds(["a", "b"], ["c", "d"], "b", 1)).toEqual({
      sourceIds: ["a"],
      targetIds: ["c", "b", "d"],
    });
  });
});
