import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

export const PREVIEW_PANEL_TRANSITION_MS = 225;

type PreviewPanelContextValue = {
  open: boolean;
  returnControlVisible: boolean;
  toggle: () => void;
  show: () => void;
};

const PreviewPanelContext = createContext<PreviewPanelContextValue | null>(null);

export function PreviewPanelProvider({
  open,
  onOpenChange,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: ReactNode;
}) {
  const [returnControlVisible, setReturnControlVisible] = useState(false);

  useEffect(() => {
    if (open) {
      setReturnControlVisible(false);
      return;
    }

    const reducedMotion = typeof window !== "undefined"
      && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const timer = window.setTimeout(
      () => setReturnControlVisible(true),
      reducedMotion ? 0 : PREVIEW_PANEL_TRANSITION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [open]);

  const value = useMemo<PreviewPanelContextValue>(() => ({
    open,
    returnControlVisible,
    toggle: () => onOpenChange(!open),
    show: () => onOpenChange(true),
  }), [onOpenChange, open, returnControlVisible]);

  return <PreviewPanelContext.Provider value={value}>{children}</PreviewPanelContext.Provider>;
}

export function usePreviewPanel() {
  return useContext(PreviewPanelContext);
}
