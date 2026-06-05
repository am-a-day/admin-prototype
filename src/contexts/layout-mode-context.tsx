import { createContext, useContext, useState, type ReactNode } from "react";

export type LayoutVersion = "sidebar" | "rail";

/** UX-эксперимент: модель применения изменений. */
export type ChangeModel = "publish" | "save-live";

type LayoutModeContextValue = {
  layoutVersion: LayoutVersion;
  setLayoutVersion: (v: LayoutVersion) => void;
  /** Experimental: enable manual drag-resize of the preview panel */
  resizablePreview: boolean;
  setResizablePreview: (v: boolean) => void;
  /** Experimental: how edits become visible to guests */
  changeModel: ChangeModel;
  setChangeModel: (v: ChangeModel) => void;
  /** Experimental: simulate a failed storefront update after save */
  simulateUpdateError: boolean;
  setSimulateUpdateError: (v: boolean) => void;
};

const LayoutModeContext = createContext<LayoutModeContextValue | null>(null);

export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [layoutVersion, setLayoutVersion] = useState<LayoutVersion>("sidebar");
  const [resizablePreview, setResizablePreview] = useState(false);
  const [changeModel, setChangeModel] = useState<ChangeModel>("publish");
  const [simulateUpdateError, setSimulateUpdateError] = useState(false);
  return (
    <LayoutModeContext.Provider
      value={{
        layoutVersion,
        setLayoutVersion,
        resizablePreview,
        setResizablePreview,
        changeModel,
        setChangeModel,
        simulateUpdateError,
        setSimulateUpdateError,
      }}
    >
      {children}
    </LayoutModeContext.Provider>
  );
}

export function useLayoutMode() {
  const ctx = useContext(LayoutModeContext);
  if (!ctx) throw new Error("useLayoutMode must be used within LayoutModeProvider");
  return ctx;
}
