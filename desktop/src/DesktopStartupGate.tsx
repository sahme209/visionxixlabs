import { useEffect, useRef, useState } from "react";
import App from "./App";
import { hydrateDesktopCredential } from "./lib/activeDesktopCredential";

/** Paint before secure storage responds; App still owns server verification. */
export function DesktopStartupGate() {
  const [ready, setReady] = useState(false);
  const hydration = useRef<Promise<void> | null>(null);
  useEffect(() => {
    let mounted = true;
    // StrictMode effect replay must observe the same in-flight vault read.
    hydration.current ??= hydrateDesktopCredential().catch(() => undefined);
    void hydration.current.then(() => { if (mounted) setReady(true); });
    return () => { mounted = false; };
  }, []);

  if (ready) return <App />;
  return <main className="flex min-h-screen items-center justify-center bg-[#111214] px-6 text-zinc-200">
    <div className="max-w-sm text-center">
      <p className="text-lg font-semibold tracking-tight">Axiom Agent</p>
      <p role="status" className="mt-3 text-sm text-zinc-400">Opening secure sign-in…</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">If your system requests permission to use secure storage, review that prompt to continue. Your workspace remains locked.</p>
    </div>
  </main>;
}
