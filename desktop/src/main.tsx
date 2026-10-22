import React from "react";
import ReactDOM from "react-dom/client";
import { DesktopStartupGate } from "./DesktopStartupGate";
import "./styles.css";
import { installDesktopFetchBridge } from "./lib/desktopTransport";

installDesktopFetchBridge();

// Paint a locked startup status immediately. The gate hydrates the explicitly
// selected credential before App verifies identity or loads operational data.
ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <DesktopStartupGate />
  </React.StrictMode>,
);
