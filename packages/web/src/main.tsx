import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { App } from "./App";
import { start } from "./sync";
import { startFonts } from "./fonts";
import { startLinks } from "./links";
import { startTheme } from "./theme";
import "./styles.css";

startTheme();
startFonts(); // TEMPORARY font tester
startLinks();
start();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
