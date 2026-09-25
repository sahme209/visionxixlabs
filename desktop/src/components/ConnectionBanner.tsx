/**
 * Top-of-window connectivity banner. The browser connectivity signal is
 * intentionally narrow: it reports whether the workstation is offline and
 * never claims that workspace sync or updates succeeded without evidence.
 */

import { useEffect, useState } from "react";

type Connection = "online" | "offline";

function currentConnection(): Connection {
  return navigator.onLine ? "online" : "offline";
}

export function ConnectionBanner() {
  const [connection, setConnection] = useState<Connection>(currentConnection);

  useEffect(() => {
    const handleOnline = () => setConnection("online");
    const handleOffline = () => setConnection("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  if (connection === "online") return null;

  return (
    <div className="px-4 pt-3">
      <div
        role="alert"
        className="flex items-center gap-2 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-200"
      >
        <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-red-400" />
        <span>
          You&apos;re offline. Connected workspace actions are unavailable until
          this device reconnects.
        </span>
      </div>
    </div>
  );
}
