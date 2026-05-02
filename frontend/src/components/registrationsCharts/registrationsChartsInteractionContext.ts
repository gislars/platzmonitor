import { createContext, type Dispatch, type SetStateAction } from "react";

export type RegistrationsChartsInteractionCtx = {
  activeChartKey: string | null;
  setActiveChartKey: Dispatch<SetStateAction<string | null>>;
};

export const RegistrationsChartsInteractionContext = createContext<RegistrationsChartsInteractionCtx | null>(
  null
);
