/**
 * Top-of-window connection banner. Renders when the desktop runtime is not
 * in a happy state — never spammy when everything is fine.
 */

import { useEffect, useState } from "react";

type Connection = "online" | "degraded" | "offline" | "unknown";

interface RuntimeProbe {
  connection: Connection;
  auditPending: number;
  updateReady: boolean;
}

export function ConnectionBanner() {
  const [probe] = useState<RuntimeProbe>({ connection: "online", auditPending: 0, updateReady: false });

  // Real implementation would invoke a Tauri command. For now keep the probe
  // in a healthy default so we don't render misleading banners.
  useEffect(() => {
    // no-op placeholder
    return () => {};
  }, []);

  if (probe.connection === "online" && probe.auditPending === 0 && !probe.updateReady) return null;

  const messages: { tone: "warning" | "error" | "info"; text: string }[] = [];
  if (probe.connection === "offline") messages.push({ tone: "error", text: "Offline — handoffs and audit sync are paused until the web app is reachable." });
  if (probe.connection === "degraded") messages.push({ tone: "warning", text: "Connection unstable — retrying in the background." });
  if (probe.auditPending > 0) messages.push({ tone: "warning", text: `${probe.auditPending} local audit event(s) waiting to sync.` });
  if (probe.updateReady) messages.push({ tone: "info", text: "An update has been downloaded — restart to apply." });

  return (
    <div className="space-y-1 px-4 pt-3">
      {messages.map((m, i) => (
        <div
          key={i}
          className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs ${
            m.tone === "error"   ? "bg-red-500/10 text-red-200 border border-red-500/20" :
            m.tone === "warning" ? "bg-amber-500/10 text-amber-200 border border-amber-500/20" :
                                    "bg-violet-500/10 text-violet-200 border border-violet-500/20"
          }`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${
            m.tone === "error" ? "bg-red-400" : m.tone === "warning" ? "bg-amber-400" : "bg-violet-400"
          }`} />
          {m.text}
        </div>
      ))}
    </div>
  );
}
