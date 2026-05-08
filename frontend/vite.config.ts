import react from "@vitejs/plugin-react";
import { defineConfig, loadEnv } from "vite";

const DEFAULT_FRAME_ANCESTORS = "'self' https://fossgis-konferenz.de https://www.fossgis-konferenz.de";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const custom = env.VITE_EMBED_FRAME_ANCESTORS?.trim();
  // Dev: frame-ancestors *. Preview/Prod: Allowlist, außer VITE_EMBED_FRAME_ANCESTORS setzt etwas anderes.
  const frameAncestors =
    custom !== undefined && custom !== ""
      ? custom
      : mode === "development"
        ? "*"
        : DEFAULT_FRAME_ANCESTORS;
  const cspFrameAncestors = `frame-ancestors ${frameAncestors}`;

  return {
    base: mode === "production" ? "/frontend/" : "/",
    plugins: [react()],
    server: {
      port: 5173,
      // CORS: Skript mit crossorigin von anderem Host laden
      cors: true,
      headers: {
        "Content-Security-Policy": cspFrameAncestors,
      },
      proxy: {
        "/api": {
          target: "http://127.0.0.1:8000",
          changeOrigin: true,
        },
      },
    },
    preview: {
      cors: true,
      headers: {
        "Content-Security-Policy": cspFrameAncestors,
      },
    },
  };
});
