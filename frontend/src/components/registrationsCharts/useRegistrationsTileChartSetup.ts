import { useMemo, useState } from "react";
import type { RegistrationsEventSerie } from "../../types";
import {
  registrationsHasAnyOnsite,
  resolveRegistrationsChannelMode,
  type RegistrationsChannelMode,
} from "../../registrationCharts";
import { useChartWidth } from "../../useChartWidth";

/** Breite, Kanalwahl und Chartmodus für die Anmeldungs-LineCharts. */
export function useRegistrationsTileChartSetup(events: RegistrationsEventSerie[]) {
  const chartW = useChartWidth(820, 56);

  const onsitePossible = useMemo(() => registrationsHasAnyOnsite(events), [events]);

  const [mode, setMode] = useState<RegistrationsChannelMode>(() =>
    onsitePossible ? "total" : "online"
  );

  const chartMode = resolveRegistrationsChannelMode(mode, onsitePossible);

  return {
    chartW,
    onsitePossible,
    chartMode,
    setMode,
  };
}
