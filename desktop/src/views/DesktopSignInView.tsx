import { useState } from "react";
import { signInWithBrowser } from "../lib/desktopPairing";
import { clearApiKey, saveApiKey } from "../lib/apiKeyStore";
import { desktopClient, type VerifiedDesktopIdentity } from "../lib/desktopClient";
import { clearAuthSession } from "../lib/authSession";

export function DesktopSignInView({
  onSignedIn,
  initialError,
}: {
  onSignedIn: (identity: VerifiedDesktopIdentity) => void;
  initialError?: string | null;
}) {
  const [state, setState] = useState<"idle" | "opening" | "waiting">("idle");
  const [error, setError] = useState<string | null>(initialError ?? null);
  const [apiKey, setApiKey] = useState("");
  const [checkingKey, setCheckingKey] = useState(false);

  async function signIn() {
    setError(null);
    setState("opening");
    try {
      await signInWithBrowser(() => setState("waiting"));
      const verified = await desktopClient.verifyCurrentCredential();
      if (!verified.ok) {
        await clearAuthSession().catch(() => undefined);
        throw new Error(`The approved desktop session could not be verified. ${verified.error}`);
      }
      onSignedIn(verified.data);
    } catch (cause) {
      setState("idle");
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    }
  }

  async function signInWithKey() {
    setError(null);
    setCheckingKey(true);
    try {
      await saveApiKey(apiKey);
      const verified = await desktopClient.verifyCurrentCredential();
      if (!verified.ok) throw new Error(verified.error);
      setApiKey("");
      onSignedIn(verified.data);
    } catch (cause) {
      await clearApiKey().catch(() => undefined);
      setError(cause instanceof Error ? cause.message : "The workspace key could not be verified.");
    } finally {
      setCheckingKey(false);
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
        <h1 className="mt-2 text-2xl font-bold">Sign in or create your account</h1>
        <p className="mt-2 text-sm leading-6 text-zinc-400">
          Continue in your system browser. Your account verifies your identity; an active paid workspace is required before deployment operations unlock.
        </p>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-left text-xs text-red-200">{error}</div>}
        <button
          type="button"
          onClick={signIn}
          disabled={state !== "idle"}
          className="mt-6 w-full rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-60"
        >
          {state === "opening" ? "Opening browser…" : state === "waiting" ? "Waiting for approval…" : "Continue securely in browser"}
        </button>
        <details className="mt-5 rounded-xl border border-white/[0.07] bg-black/20 p-4 text-left">
          <summary className="cursor-pointer text-xs font-medium text-zinc-400">Administrator workspace key</summary>
          <p className="mt-3 text-xs leading-5 text-zinc-600">For administrator-issued recovery access only. The workspace must still have an active commercial entitlement.</p>
          <label htmlFor="workspace-key" className="mt-3 block text-xs font-medium text-zinc-300">Workspace API key</label>
          <input id="workspace-key" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => { setApiKey(event.target.value); setError(null); }} onKeyDown={(event) => { if (event.key === "Enter" && apiKey.trim() && !checkingKey) void signInWithKey(); }} placeholder="vxlk_live_…" className="mt-2 w-full rounded-xl border border-white/[0.10] bg-black/30 px-4 py-3 text-sm font-mono text-white outline-none placeholder:text-zinc-700 focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/15" />
          <button type="button" onClick={() => void signInWithKey()} disabled={!apiKey.trim() || checkingKey || state !== "idle"} className="mt-3 w-full rounded-full border border-white/[0.10] bg-white/[0.05] px-5 py-3 text-sm font-semibold text-zinc-100 hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50">
            {checkingKey ? "Verifying workspace…" : "Use administrator key"}
          </button>
        </details>
        <p className="mt-5 text-xs leading-5 text-zinc-600">
          Product demonstrations use the isolated website sandbox. This installed workspace never substitutes sample records for service data.
        </p>
      </div>
    </main>
  );
}
