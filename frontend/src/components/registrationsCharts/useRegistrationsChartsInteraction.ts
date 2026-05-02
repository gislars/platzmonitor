import { useContext } from "react";
import {
  RegistrationsChartsInteractionContext,
  type RegistrationsChartsInteractionCtx,
} from "./registrationsChartsInteractionContext";

export function useRegistrationsChartsInteraction(): RegistrationsChartsInteractionCtx {
  const ctx = useContext(RegistrationsChartsInteractionContext);
  if (ctx === null) {
    return {
      activeChartKey: null,
      setActiveChartKey: () => {},
    };
  }
  return ctx;
}
