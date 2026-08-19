import { createContext, useCallback, useContext, useEffect, useRef, type ComponentProps, type ReactNode } from "react";
import { DismissableLayer } from "@radix-ui/react-dismissable-layer";

type PositionSidePeekPointerDownOutsideEvent = Parameters<NonNullable<ComponentProps<typeof DismissableLayer>["onPointerDownOutside"]>>[0];

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

function isNeutralOutsideInteraction(event: PointerEvent) {
  const path = getEventPath(event);
  if (pathHasElement(path, SIDE_PEEK_INTERACTIVE_SELECTOR)) return false;
  if (isScrollbarInteraction(event, path)) return false;
  const selection = window.getSelection();
  if (selection && !selection.isCollapsed && selection.toString()) return false;
  return true;
}

type PositionSidePeekContextValue = {
  requestClose: () => void;
  registerOverlay: (overlayId: symbol, onEscape?: () => void) => () => void;
  consumePointerInteraction: (event: PointerEvent) => void;
  isPointerInteractionConsumed: (event: PointerEvent) => boolean;
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
  const consumedPointerInteractionsRef = useRef(new WeakSet<PointerEvent>());
  const registerOverlay = useCallback((overlayId: symbol, onEscape?: () => void) => {
    openOverlayHandlersRef.current.set(overlayId, onEscape ?? (() => {}));
    return () => {
      openOverlayHandlersRef.current.delete(overlayId);
    };
  }, []);
  const consumePointerInteraction = useCallback((event: PointerEvent) => {
    consumedPointerInteractionsRef.current.add(event);
  }, []);
  const isPointerInteractionConsumed = useCallback((event: PointerEvent) => {
    return consumedPointerInteractionsRef.current.has(event);
  }, []);

  const handlePointerDownOutside = useCallback((event: PositionSidePeekPointerDownOutsideEvent) => {
    const originalEvent = event.detail.originalEvent;
    if (
      openOverlayHandlersRef.current.size > 0
      || isPointerInteractionConsumed(originalEvent)
      || !isNeutralOutsideInteraction(originalEvent)
    ) {
      event.preventDefault();
    }
  }, [isPointerInteractionConsumed]);

  const handleEscapeKeyDown = useCallback((event: KeyboardEvent) => {
    const handlers = [...openOverlayHandlersRef.current.values()];
    const closeTopOverlay = handlers[handlers.length - 1];
    if (!closeTopOverlay) return;
    event.preventDefault();
    closeTopOverlay();
  }, []);

  return (
    <PositionSidePeekContext.Provider value={{ requestClose, registerOverlay, consumePointerInteraction, isPointerInteractionConsumed }}>
      <DismissableLayer
        asChild
        onPointerDownOutside={handlePointerDownOutside}
        onEscapeKeyDown={handleEscapeKeyDown}
        onDismiss={requestClose}
      >
        <div data-position-side-peek-scope className="contents">
          {children}
        </div>
      </DismissableLayer>
    </PositionSidePeekContext.Provider>
  );
}

export function usePositionSidePeek() {
  return useContext(PositionSidePeekContext);
}

export function usePositionSidePeekOverlayInteraction() {
  const sidePeek = usePositionSidePeek();
  return useCallback((event: { detail: { originalEvent: PointerEvent } }) => {
    sidePeek?.consumePointerInteraction(event.detail.originalEvent);
  }, [sidePeek]);
}

export function PositionSidePeekOverlayMarker({ onEscape }: { onEscape?: () => void }) {
  const sidePeek = usePositionSidePeek();
  const overlayIdRef = useRef(Symbol("position-side-peek-overlay-marker"));

  useEffect(() => {
    if (!sidePeek) return;
    return sidePeek.registerOverlay(overlayIdRef.current, onEscape);
  }, [onEscape, sidePeek]);

  return null;
}

export function usePositionSidePeekOverlay(open: boolean, onEscape?: () => void) {
  const sidePeek = usePositionSidePeek();
  const overlayIdRef = useRef(Symbol("position-side-peek-overlay"));

  useEffect(() => {
    if (!open || !sidePeek) return;
    return sidePeek.registerOverlay(overlayIdRef.current, onEscape);
  }, [onEscape, open, sidePeek]);
}
