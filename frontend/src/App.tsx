import { useEffect, useMemo } from "react";
import { isEmbedPathname } from "./chartEmbed";
import { installEmbedIframeResizePostMessage } from "./embedIframeResizePostMessage";
import { Dashboard } from "./components/Dashboard";
import { EmbedPage } from "./components/EmbedPage";
import "./App.css";

function App() {
  const embed = useMemo(
    () => isEmbedPathname(window.location.pathname, import.meta.env.BASE_URL),
    []
  );

  useEffect(() => {
    document.documentElement.classList.toggle("html--embed", embed);
    return () => {
      document.documentElement.classList.remove("html--embed");
    };
  }, [embed]);

  useEffect(() => {
    if (!embed) {
      return undefined;
    }
    return installEmbedIframeResizePostMessage();
  }, [embed]);

  if (embed) {
    return <EmbedPage />;
  }
  return <Dashboard />;
}

export default App;
