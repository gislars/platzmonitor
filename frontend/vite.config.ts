import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// Konfiguration: https://vite.dev/config/
export default defineConfig(({ mode }) => ({
  base: mode === "production" ? "/frontend/" : "/",
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://127.0.0.1:8000",
        changeOrigin: true,
      },
    },
  },
}));
