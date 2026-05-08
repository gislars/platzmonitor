import { useMemo, useState } from "react";
import type { RegistrationsEventSerie } from "../../types";
import {
  registrationsHasAnyOnsite,
  resolveRegistrationsChannelMode,
  type RegistrationsChannelMode,
} from "../../registrationCharts";
import { useChartWidth } from "../../useChartWidth";

/** LineChart padR für Anmeldungsdiagramme. */
export const REGISTRATIONS_LINE_CHART_PAD_R = 28;

/** Breite, Kanalwahl und Chartmodus für die Anmeldungs-LineCharts. */
export function useRegistrationsTileChartSetup(events: RegistrationsEventSerie[]) {
  const chartW = useChartWidth(820, 56);

  /** Anteil padR/chartW für CSS calc mit 100% Breite der Kachel. */
  const lineChartHeadPadRFraction = useMemo(
    () => REGISTRATIONS_LINE_CHART_PAD_R / Math.max(chartW, 1),
    [chartW]
  );

  const onsitePossible = useMemo(() => registrationsHasAnyOnsite(events), [events]);

  const [mode, setMode] = useState<RegistrationsChannelMode>(() =>
    onsitePossible ? "total" : "online"
  );

  const chartMode = resolveRegistrationsChannelMode(mode, onsitePossible);

  return {
    chartW,
    lineChartHeadPadRFraction,
    onsitePossible,
    chartMode,
    setMode,
  };
}
