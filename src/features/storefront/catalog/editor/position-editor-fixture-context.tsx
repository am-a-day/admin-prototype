import { createContext, useContext, type ReactNode } from "react";

type PositionEditorFixtureState = {
  /** Allows deterministic visual fixtures to exercise the existing validation UI. */
  nameError?: string;
  /** Keeps the existing header actions menu open for deterministic Design Lab captures. */
  positionActionsOpen?: boolean;
  /** Keeps real Recommendations-tab controls open for deterministic Design Lab captures. */
  promo?: {
    recommendationPickerOpen?: boolean;
    creatingLabelType?: "tag" | "sticker";
    editingLabelType?: "tag" | "sticker";
    showRecommendationRemoveAction?: boolean;
  };
};

const PositionEditorFixtureContext = createContext<PositionEditorFixtureState | null>(null);

export function PositionEditorFixtureProvider({
  children,
  value,
}: {
  children: ReactNode;
  value: PositionEditorFixtureState | null;
}) {
  return (
    <PositionEditorFixtureContext.Provider value={value}>
      {children}
    </PositionEditorFixtureContext.Provider>
  );
}

export function usePositionEditorFixture() {
  return useContext(PositionEditorFixtureContext);
}
