import { createContext, useContext, useState, type ReactNode } from "react";

export type LayoutVersion = "sidebar" | "rail";

type LayoutModeContextValue = {
  layoutVersion: LayoutVersion;
  setLayoutVersion: (v: LayoutVersion) => void;
  /** Experimental: enable manual drag-resize of the preview panel */
  resizablePreview: boolean;
  setResizablePreview: (v: boolean) => void;
};

const LayoutModeContext = createContext<LayoutModeContextValue | null>(null);

export function LayoutModeProvider({ children }: { children: ReactNode }) {
  const [layoutVersion, setLayoutVersion] = useState<LayoutVersion>("sidebar");
  const [resizablePreview, setResizablePreview] = useState(false);
  return (
    <LayoutModeContext.Provider
      value={{ layoutVersion, setLayoutVersion, resizablePreview, setResizablePreview }}
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
