import {
  createContext,
  useCallback,
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
  sidePeekOpen: boolean;
  toggle: () => void;
  show: () => void;
  registerSidePeek: () => () => void;
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
  const [sidePeekCount, setSidePeekCount] = useState(0);

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

  const registerSidePeek = useCallback(() => {
    setSidePeekCount((count) => count + 1);
    return () => setSidePeekCount((count) => Math.max(0, count - 1));
  }, []);

  const value = useMemo<PreviewPanelContextValue>(() => ({
    open,
    returnControlVisible,
    sidePeekOpen: sidePeekCount > 0,
    toggle: () => onOpenChange(!open),
    show: () => onOpenChange(true),
    registerSidePeek,
  }), [onOpenChange, open, registerSidePeek, returnControlVisible, sidePeekCount]);

  return <PreviewPanelContext.Provider value={value}>{children}</PreviewPanelContext.Provider>;
}

export function usePreviewPanel() {
  return useContext(PreviewPanelContext);
}
