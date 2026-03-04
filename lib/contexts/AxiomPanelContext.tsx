"use client";

import { createContext, useContext, useState, useCallback } from "react";

type AxiomPanelContextValue = {
  isAxiomOpen: boolean;
  setIsAxiomOpen: (open: boolean) => void;
};

const AxiomPanelContext = createContext<AxiomPanelContextValue | null>(null);

export function AxiomPanelProvider({ children }: { children: React.ReactNode }) {
  const [isAxiomOpen, setIsAxiomOpenState] = useState(false);
  const setIsAxiomOpen = useCallback((open: boolean) => setIsAxiomOpenState(open), []);
  return (
    <AxiomPanelContext.Provider value={{ isAxiomOpen, setIsAxiomOpen }}>
      {children}
    </AxiomPanelContext.Provider>
  );
}

export function useAxiomPanel(): AxiomPanelContextValue | null {
  return useContext(AxiomPanelContext);
}
