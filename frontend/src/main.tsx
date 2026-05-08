import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./themes.css";
import { applyThemeToDocument, getInitialThemeId } from "./themes";
import "./index.css";
import { isEmbedPathname } from "./chartEmbed";
import App from "./App.tsx";

applyThemeToDocument(getInitialThemeId());

// Vor erstem Paint: sonst greifen body/#root min-height 100vh aus index.css im Iframe und die Resize-Höhe wird zu groß (Ausgleich in App.css unter html.html--embed)
if (isEmbedPathname(window.location.pathname, import.meta.env.BASE_URL)) {
  document.documentElement.classList.add("html--embed");
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
