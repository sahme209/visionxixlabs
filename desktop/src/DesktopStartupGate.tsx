import {useEffect, useRef, useState} from "react";
import App from "./App";
import {hydrateDesktopCredential} from "./lib/activeDesktopCredential";

/** A stalled vault read never unlocks operations or activates a late identity. */
export function DesktopStartupGate() {
  const [ready, setReady] = useState(false), [stalled, setStalled] = useState(false);
  const hydration = useRef<Promise<void> | null>(null), controller = useRef(new AbortController()), lifetime = useRef(0);
  useEffect(() => {
    let mounted = true; const generation = ++lifetime.current;
    // Effect replay observes the same vault read instead of opening another prompt.
    hydration.current ??= hydrateDesktopCredential(controller.current.signal).catch(() => undefined);
    const timer = window.setTimeout(() => {if (mounted) setStalled(true);}, 15000);
    void hydration.current.then(() => {window.clearTimeout(timer); if (mounted) setReady(true);});
    return () => {
      mounted = false; window.clearTimeout(timer);
      // StrictMode's synchronous effect replay keeps its shared read alive.
      queueMicrotask(() => {if (lifetime.current === generation) controller.current.abort();});
    };
  }, []);
  if (ready) return <App />;
  return <main className="flex min-h-screen items-center justify-center bg-[#111214] px-6 text-zinc-200">
    <div className="max-w-sm text-center">
      <p className="text-lg font-semibold tracking-tight">Axiom Agent</p>
      <p role="status" className="mt-3 text-sm text-zinc-400">{stalled ? "Secure storage is taking longer than expected." : "Opening secure sign-in…"}</p>
      <p className="mt-2 text-xs leading-5 text-zinc-500">If your system requests permission to use secure storage, review that prompt to continue. Your workspace remains locked.</p>
      {stalled && <div className="mt-5"><button type="button" onClick={() => {controller.current.abort(); setReady(true);}} className="rounded-lg border border-white/15 bg-white/5 px-4 py-2 text-xs text-zinc-200 hover:bg-white/10">Continue to sign in</button><p className="mt-3 text-xs leading-5 text-zinc-500">Continue without loading a saved identity. Sign-in must still be verified before the workspace opens.</p></div>}
    </div>
  </main>;
}
