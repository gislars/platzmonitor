import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./themes.css";
import { applyThemeToDocument, getInitialThemeId } from "./themes";
import "./index.css";
import App from "./App.tsx";

applyThemeToDocument(getInitialThemeId());

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
