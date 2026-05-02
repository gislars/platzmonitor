import { useCallback, useMemo, useState } from "react";
import type { RegistrationsEventSerie } from "../../types";
import {
  registrationsHasAnyOnsite,
  resolveRegistrationsChannelMode,
  type RegistrationsChannelMode,
} from "../../registrationCharts";
import { useChartWidth } from "../../useChartWidth";
import { useRegistrationsChartsInteraction } from "./useRegistrationsChartsInteraction";

export function useRegistrationsTileChartSetup(
  events: RegistrationsEventSerie[],
  interactionChartKey?: string
) {
  const chartW = useChartWidth(820, 56);
  const { activeChartKey, setActiveChartKey } = useRegistrationsChartsInteraction();

  const onPlotHoverChange = useCallback(
    (hovering: boolean) => {
      if (interactionChartKey === undefined) {
        return;
      }
      if (hovering) {
        setActiveChartKey(interactionChartKey);
      } else {
        setActiveChartKey((cur) => (cur === interactionChartKey ? null : cur));
      }
    },
    [interactionChartKey, setActiveChartKey]
  );

  const peerDimmed =
    interactionChartKey !== undefined &&
    activeChartKey !== null &&
    activeChartKey !== interactionChartKey;

  const onsitePossible = useMemo(() => registrationsHasAnyOnsite(events), [events]);

  const [mode, setMode] = useState<RegistrationsChannelMode>(() =>
    onsitePossible ? "total" : "online"
  );

  const chartMode = resolveRegistrationsChannelMode(mode, onsitePossible);

  return {
    chartW,
    onPlotHoverChange,
    peerDimmed,
    onsitePossible,
    chartMode,
    setMode,
  };
}
