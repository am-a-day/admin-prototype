import { createContext, useContext, type ReactNode } from "react";

type PositionEditorFixtureState = {
  /** Allows deterministic visual fixtures to exercise the existing validation UI. */
  nameError?: string;
  /** Keeps real Recommendations-tab controls open for deterministic Design Lab captures. */
  promo?: {
    recommendationPickerOpen?: boolean;
    creatingLabelType?: "tag" | "sticker";
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
