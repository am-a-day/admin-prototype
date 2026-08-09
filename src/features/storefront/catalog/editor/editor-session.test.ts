import { describe, expect, it } from "vitest";
import { editorSessionReducer, getEditorSessionCurrentId, type EditorSessionState } from "./editor-session";

const initialState: EditorSessionState = {
  queue: {
    snapshot: {
      itemIds: ["one", "two"],
      filterId: "quick:all",
      entryFilterId: "quick:all",
      query: "",
      tableQuery: "",
      sectionScopeId: "section-a",
      scrollTop: 12,
      entryItemId: "one",
      sort: "none",
      entryFromSection: false,
    },
    currentId: "one",
  },
  activePositionId: "one",
  view: "editor",
};

describe("editor session owner", () => {
  it("updates queue and current identity together through the session boundary", () => {
    const next = editorSessionReducer(initialState, {
      type: "set-queue",
      value: (current) => current && { ...current, currentId: "two" },
    });

    expect(next.queue?.currentId).toBe("two");
    expect(getEditorSessionCurrentId(next)).toBe("two");
    expect(next.activePositionId).toBe("one");
  });

  it("keeps the non-queue active identity for restored table state", () => {
    const closed = editorSessionReducer(initialState, { type: "set-queue", value: null });
    const next = editorSessionReducer(closed, { type: "set-active-position", value: "two" });

    expect(next.queue).toBeNull();
    expect(getEditorSessionCurrentId(next)).toBe("two");
    expect(next.view).toBe("editor");
  });
});
