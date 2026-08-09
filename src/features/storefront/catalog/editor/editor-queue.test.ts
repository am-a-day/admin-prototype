import { describe, expect, it } from "vitest";
import { deriveEditorQueue } from "./editor-queue";

describe("deriveEditorQueue", () => {
  it("keeps source order while removing ids that no longer exist", () => {
    expect(deriveEditorQueue(["a", "removed", "b"], "b", new Set(["a", "b"]))).toEqual({
      itemIds: ["a", "b"],
      queueIndex: 1,
      previousId: "a",
      nextId: null,
    });
  });

  it("returns adjacent ids for the middle of a selection", () => {
    expect(deriveEditorQueue(["a", "b", "c"], "b", new Set(["a", "b", "c"]))).toEqual({
      itemIds: ["a", "b", "c"],
      queueIndex: 1,
      previousId: "a",
      nextId: "c",
    });
  });

  it("keeps both navigation directions empty when current item is outside selection", () => {
    expect(deriveEditorQueue(["a", "b"], "missing", new Set(["a", "b", "missing"]))).toEqual({
      itemIds: ["a", "b"],
      queueIndex: -1,
      previousId: null,
      nextId: null,
    });
  });
});
