import { createContext, useContext, type ReactNode } from "react";

type PositionSidePeekContextValue = {
  requestClose: () => void;
};

const PositionSidePeekContext = createContext<PositionSidePeekContextValue | null>(null);

export function PositionSidePeekProvider({
  children,
  requestClose,
}: {
  children: ReactNode;
  requestClose: () => void;
}) {
  return (
    <PositionSidePeekContext.Provider value={{ requestClose }}>
      {children}
    </PositionSidePeekContext.Provider>
  );
}

export function usePositionSidePeek() {
  return useContext(PositionSidePeekContext);
}
