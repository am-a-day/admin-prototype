import { describe, expect, it } from "vitest";
import { createSessionReducer, type CreateSessionState } from "./create-session";

const draft = {
  id: "draft-1",
  title: "",
  sectionId: "section-a",
  sectionName: "Раздел A",
} as CreateSessionState["draft"];

describe("position create session owner", () => {
  it("keeps structure and direct contexts as adapter data while sharing lifecycle", () => {
    const structure = createSessionReducer(
      { mode: null, draft: null, context: null, dirty: false, submitting: false, completedItemId: null },
      { type: "begin", mode: "structure", draft: draft!, context: { targetSectionId: "section-a", returnItemId: "item-1" } },
    );
    const direct = createSessionReducer(
      structure,
      { type: "begin", mode: "direct", draft: { ...draft!, id: "draft-2" }, context: { targetSectionId: "section-a" } },
    );

    expect(structure.mode).toBe("structure");
    expect(structure.context?.returnItemId).toBe("item-1");
    expect(direct.mode).toBe("direct");
    expect(direct.context?.returnItemId).toBeUndefined();
  });

  it("does not discard the draft on update, and complete/cancel clear the owner", () => {
    const started = createSessionReducer(
      { mode: null, draft: null, context: null, dirty: false, submitting: false, completedItemId: null },
      { type: "begin", mode: "direct", draft: draft!, context: { targetSectionId: "section-a" } },
    );
    const updated = createSessionReducer(started, { type: "update-draft", patch: { title: "Draft" } });
    const submitting = createSessionReducer(updated, { type: "set-submitting", value: true });

    expect(updated.draft?.title).toBe("Draft");
    expect(updated.dirty).toBe(true);
    expect(submitting.submitting).toBe(true);
    const completed = createSessionReducer(submitting, { type: "complete", createdItemId: "created-1" });
    expect(completed.draft).toBeNull();
    expect(completed.completedItemId).toBe("created-1");
    expect(createSessionReducer(submitting, { type: "cancel" }).mode).toBeNull();
  });
});
