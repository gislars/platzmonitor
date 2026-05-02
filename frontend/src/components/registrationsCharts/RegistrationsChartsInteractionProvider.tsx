import { useMemo, useState, type ReactNode } from "react";
import { RegistrationsChartsInteractionContext } from "./registrationsChartsInteractionContext";

export function RegistrationsChartsInteractionProvider({ children }: { children: ReactNode }) {
  const [activeChartKey, setActiveChartKey] = useState<string | null>(null);
  const value = useMemo(() => ({ activeChartKey, setActiveChartKey }), [activeChartKey]);
  return (
    <RegistrationsChartsInteractionContext.Provider value={value}>
      {children}
    </RegistrationsChartsInteractionContext.Provider>
  );
}
