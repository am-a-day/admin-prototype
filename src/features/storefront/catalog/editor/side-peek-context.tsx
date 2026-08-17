import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

type PositionSidePeekContextValue = {
  requestClose: () => void;
  registerOverlay: (overlayId: symbol, onEscape?: () => void) => () => void;
};

const PositionSidePeekContext = createContext<PositionSidePeekContextValue | null>(null);

export function PositionSidePeekProvider({
  children,
  requestClose,
}: {
  children: ReactNode;
  requestClose: () => void;
}) {
  const openOverlayHandlersRef = useRef(new Map<symbol, () => void>());
  const registerOverlay = useCallback((overlayId: symbol, onEscape?: () => void) => {
    openOverlayHandlersRef.current.set(overlayId, onEscape ?? (() => {}));
    return () => {
      openOverlayHandlersRef.current.delete(overlayId);
    };
  }, []);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      const handlers = [...openOverlayHandlersRef.current.values()];
      const closeTopOverlay = handlers[handlers.length - 1];
      if (closeTopOverlay) {
        event.preventDefault();
        closeTopOverlay();
        return;
      }
      requestClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [requestClose]);

  return (
    <PositionSidePeekContext.Provider value={{ requestClose, registerOverlay }}>
      <div data-position-side-peek-scope className="contents">
        {children}
      </div>
    </PositionSidePeekContext.Provider>
  );
}

export function usePositionSidePeek() {
  return useContext(PositionSidePeekContext);
}

export function usePositionSidePeekOverlay(open: boolean, onEscape?: () => void) {
  const sidePeek = usePositionSidePeek();
  const overlayIdRef = useRef(Symbol("position-side-peek-overlay"));

  useEffect(() => {
    if (!open || !sidePeek) return;
    return sidePeek.registerOverlay(overlayIdRef.current, onEscape);
  }, [onEscape, open, sidePeek]);
}
