import {
  createContext,
  useCallback,
  useContext,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";

// Two separate contexts so pages can call setActions without subscribing to
// actions-state changes (avoids infinite re-render loops).
const SetActionsCtx = createContext<(node: ReactNode) => void>(() => {});
const ActionsCtx = createContext<ReactNode>(null);

export function HeaderActionsProvider({ children }: { children: ReactNode }) {
  const [actions, setActionsState] = useState<ReactNode>(null);

  // Stable reference — never triggers re-renders in consumers.
  const setActions = useCallback((node: ReactNode) => {
    setActionsState(node);
  }, []);

  return (
    <SetActionsCtx.Provider value={setActions}>
      <ActionsCtx.Provider value={actions}>{children}</ActionsCtx.Provider>
    </SetActionsCtx.Provider>
  );
}

/** Read-only: used by ContentHeader to render the current slot. */
export function useHeaderActionsSlot() {
  return useContext(ActionsCtx);
}

/**
 * Called from a page component to inject a node into the header's right slot.
 * Stays in sync with parent renders (re-registers after every render).
 */
export function useHeaderActions(node: ReactNode) {
  const setActions = useContext(SetActionsCtx);
  const nodeRef = useRef(node);
  nodeRef.current = node;

  // Sync on every render of the calling component.
  useLayoutEffect(() => {
    setActions(nodeRef.current);
  });

  // Clean up when the page unmounts.
  useLayoutEffect(() => {
    return () => setActions(null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
