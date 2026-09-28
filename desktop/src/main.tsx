import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";
import { hydrateApiKey } from "./lib/apiKeyStore";
import { hydrateAuthSession } from "./lib/authSession";
import { installDesktopFetchBridge } from "./lib/desktopTransport";

installDesktopFetchBridge();

// Hydrate persisted credentials BEFORE rendering so the very first
// data fetch (in the Dashboard's useEffect) already carries auth.
// API key wins over legacy pairing token when both are stored — that's
// the order of preference: vxlk_* is the modern surface, pairing token
// is the legacy fallback we're keeping for backward compat.
async function bootstrap(): Promise<void> {
  try { await hydrateAuthSession(); } catch { /* best-effort */ }
  try { await hydrateApiKey();     } catch { /* best-effort */ }
}

bootstrap().finally(() => {
  ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>,
  );
});
