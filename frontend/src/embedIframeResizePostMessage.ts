import { EMBED_IFRAME_RESIZE_MESSAGE } from "./chartEmbed";

// Iframe-Inhalt meldet die Dokumenthöhe per postMessage; die einbettende Seite passt die Iframe-Höhe an.
export function installEmbedIframeResizePostMessage(): () => void {
  if (typeof window === "undefined" || window.parent === window) {
    return () => undefined;
  }

  // Zusatzpixel gegen Subpixel-Overflow und Reflow nach SVG-Skalierung
  const heightSlackPx = 20;

  let raf = 0;
  const send = () => {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const root = document.getElementById("root");
      let raw = 0;
      if (root !== null) {
        raw = Math.max(root.scrollHeight, Math.ceil(root.getBoundingClientRect().height));
      }
      if (raw <= 0) {
        raw = Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight
        );
      }
      const h = Math.ceil(raw) + heightSlackPx;
      window.parent.postMessage({ type: EMBED_IFRAME_RESIZE_MESSAGE, height: h }, "*");
    });
  };

  send();
  const ro = new ResizeObserver(send);
  ro.observe(document.documentElement);
  window.addEventListener("load", send);

  return () => {
    window.removeEventListener("load", send);
    ro.disconnect();
    cancelAnimationFrame(raf);
  };
}
