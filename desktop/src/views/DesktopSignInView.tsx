import { useState } from "react";
import { signInWithBrowser } from "../lib/desktopPairing";

export function DesktopSignInView({ onSignedIn, onPreview }: { onSignedIn: () => void; onPreview: () => void }) {
  const [state, setState] = useState<"idle" | "opening" | "waiting">("idle");
  const [error, setError] = useState<string | null>(null);

  async function signIn() {
    setError(null);
    setState("opening");
    try {
      await signInWithBrowser(() => setState("waiting"));
      onSignedIn();
    } catch (cause) {
      setState("idle");
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    }
  }

  return (
    <main className="h-screen w-screen bg-axiom-bg text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full bg-violet-500/[0.12] blur-[150px]" />
      </div>
      <div className="relative w-full max-w-md rounded-2xl border border-white/[0.08] bg-zinc-950/80 p-8 shadow-2xl text-center">
        <div className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-xl font-bold">A</div>
        <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-violet-300">Axiom Agent</p>
        <h1 className="mt-2 text-2xl font-bold">Sign in to your workspace</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Your browser handles Google, GitHub, or email authentication securely. Return here after approving this desktop.
        </p>
        {error && <div className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-left text-xs text-red-200">{error}</div>}
        <button
          type="button"
          onClick={signIn}
          disabled={state !== "idle"}
          className="mt-6 w-full rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-60"
        >
          {state === "opening" ? "Opening browser…" : state === "waiting" ? "Waiting for approval…" : "Continue in browser"}
        </button>
        <button type="button" onClick={onPreview} className="mt-4 text-xs text-zinc-500 hover:text-zinc-300">
          Explore preview without signing in
        </button>
      </div>
    </main>
  );
}
