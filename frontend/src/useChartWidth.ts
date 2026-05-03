import { useEffect, useState } from "react";

/** SVG-Breite aus Fensterbreite und optionalem Seitenrand (unabhängig vom CSS-Layout). */
export function useChartWidth(max = 900, pad = 48): number {
  const [w, setW] = useState(() =>
    typeof window === "undefined" ? max : Math.max(280, Math.min(max, window.innerWidth - pad))
  );
  useEffect(() => {
    const r = (): void => {
      setW(Math.max(280, Math.min(max, window.innerWidth - pad)));
    };
    r();
    window.addEventListener("resize", r);
    return () => window.removeEventListener("resize", r);
  }, [max, pad]);
  return w;
}
