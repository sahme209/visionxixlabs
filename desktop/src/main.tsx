import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { hydrateDesktopCredential } from "./lib/activeDesktopCredential";
import { installDesktopFetchBridge } from "./lib/desktopTransport";

installDesktopFetchBridge();

// Hydrate the explicitly selected credential before App's server verification.
// A corrupt/missing selected value must not fall back to an older identity.
async function bootstrap(): Promise<void> {
  try { await hydrateDesktopCredential(); } catch { /* App remains locked for recovery. */ }
}

bootstrap().finally(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
