import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";

const SIDE_PEEK_SCOPE_SELECTOR = "[data-position-side-peek-scope]";
const SIDE_PEEK_INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "input",
  "textarea",
  "select",
  "option",
  "label",
  "summary",
  "[contenteditable=\"true\"]",
  "[draggable=\"true\"]",
  "[role=\"button\"]",
  "[role=\"checkbox\"]",
  "[role=\"combobox\"]",
  "[role=\"listbox\"]",
  "[role=\"menuitem\"]",
  "[role=\"option\"]",
  "[role=\"radio\"]",
  "[role=\"slider\"]",
  "[role=\"spinbutton\"]",
  "[role=\"switch\"]",
  "[role=\"tab\"]",
  "[data-catalog-dnd-handle]",
  "[data-catalog-column-resize-handle]",
  "[data-position-editor-resize-handle]",
].join(", ");
const SIDE_PEEK_OVERLAY_SELECTOR = [
  "[data-radix-popper-content-wrapper]",
  "[data-radix-menu-content]",
  "[data-radix-popover-content]",
  "[data-radix-select-content]",
  "[data-radix-dialog-content]",
  "[data-radix-tooltip-content]",
  "[data-catalog-column-settings]",
  "[data-catalog-schedule-popover]",
  "[data-move-to-section-popover]",
  "[data-option-popover]",
  "[data-recommendation-picker]",
  "[role=\"dialog\"]",
  "[role=\"menu\"]",
  "[role=\"tooltip\"]",
].join(", ");

function getEventPath(event: Event) {
  return typeof event.composedPath === "function"
    ? event.composedPath()
    : event.target
      ? [event.target]
      : [];
}

function pathHasElement(path: EventTarget[], selector: string) {
  return path.some((entry) => entry instanceof Element && entry.matches(selector));
}

function isScrollbarInteraction(event: MouseEvent, path: EventTarget[]) {
  return path.some((entry) => {
    if (!(entry instanceof HTMLElement)) return false;
    const style = window.getComputedStyle(entry);
    const hasHorizontalScrollbar = entry.scrollWidth > entry.clientWidth && ["auto", "scroll"].includes(style.overflowX);
    const hasVerticalScrollbar = entry.scrollHeight > entry.clientHeight && ["auto", "scroll"].includes(style.overflowY);
    if (!hasHorizontalScrollbar && !hasVerticalScrollbar) return false;
    const rect = entry.getBoundingClientRect();
    const scrollbarSize = 16;
    return (
      (hasHorizontalScrollbar && event.clientY >= rect.bottom - scrollbarSize)
      || (hasVerticalScrollbar && event.clientX >= rect.right - scrollbarSize)
    );
  });
}

function isNeutralOutsideClick(event: MouseEvent, path: EventTarget[]) {
  if (pathHasElement(path, SIDE_PEEK_SCOPE_SELECTOR)) return false;
  if (pathHasElement(path, SIDE_PEEK_INTERACTIVE_SELECTOR)) return false;
  if (pathHasElement(path, SIDE_PEEK_OVERLAY_SELECTOR)) return false;
  if (isScrollbarInteraction(event, path)) return false;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString()) return false;
  return true;
}

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

  useEffect(() => {
    const onDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || openOverlayHandlersRef.current.size > 0) return;
      const path = getEventPath(event);
      if (isNeutralOutsideClick(event, path)) requestClose();
    };
    document.addEventListener("click", onDocumentClick, true);
    return () => document.removeEventListener("click", onDocumentClick, true);
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
