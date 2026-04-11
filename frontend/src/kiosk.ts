import { getBuildKioskDefault } from "./config";

/** Kiosk: Build-Flag `VITE_KIOSK=true` oder URL-Parameter `?kiosk=1`. */
export function getKioskMode(): boolean {
  if (getBuildKioskDefault()) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  return new URLSearchParams(window.location.search).get("kiosk") === "1";
}
