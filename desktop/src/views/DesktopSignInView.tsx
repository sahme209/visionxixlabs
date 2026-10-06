import { useRef, useState } from "react";
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
  const browserSignIn = useRef<AbortController | null>(null);

  async function continueInBrowser(intent: "sign_in" | "sign_up") {
    setError(null);
    setState("opening");
    const controller = new AbortController();
    browserSignIn.current = controller;
    try {
      await signInWithBrowser(intent, () => setState("waiting"), controller.signal);
      const verified = await desktopClient.verifyCurrentCredential();
      if (!verified.ok) {
        await clearAuthSession().catch(() => undefined);
        throw new Error(`The approved desktop session could not be verified. ${verified.error}`);
      }
      onSignedIn(verified.data);
    } catch (cause) {
      setState("idle");
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError(cause instanceof Error ? cause.message : "Sign-in failed.");
    } finally {
      if (browserSignIn.current === controller) browserSignIn.current = null;
    }
  }

  function cancelBrowserSignIn() {
    browserSignIn.current?.abort();
    browserSignIn.current = null;
    setState("idle");
    setError(null);
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
    <main className="h-screen w-screen bg-[#0a0a0b] text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute top-[-10%] left-1/2 -translate-x-1/2 w-[720px] h-[720px] rounded-full bg-violet-500/[0.08] blur-[160px]" />
        <div className="absolute bottom-[-15%] right-[-10%] w-[480px] h-[480px] rounded-full bg-fuchsia-500/[0.05] blur-[140px]" />
      </div>
      <div className="relative w-full max-w-[420px] text-center">
        <div className="mx-auto mb-8 h-14 w-14 rounded-[18px] border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-transparent shadow-[0_8px_30px_rgba(0,0,0,0.4)] flex items-center justify-center text-xl font-semibold">A</div>
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-zinc-500">Axiom Agent</p>
        <h1 className="mt-3 text-[28px] font-medium leading-[1.15] tracking-[-0.03em]">Deployment control, from request to closure.</h1>
        <p className="mx-auto mt-3 max-w-sm text-[14px] leading-6 text-zinc-500">
          Sign in through your system browser, then return here automatically. Your workspace access is verified before operational data loads.
        </p>
        {error && <div role="alert" className="mt-5 rounded-xl border border-red-500/20 bg-red-500/[0.08] p-3.5 text-left text-xs leading-5 text-red-200">{error}</div>}
        <div className="mt-8 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-1.5 shadow-[0_1px_0_rgba(255,255,255,0.03)_inset]">
          <button
            type="button"
            onClick={() => void continueInBrowser("sign_in")}
            disabled={state !== "idle"}
            className="group relative w-full rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-black transition-all duration-150 hover:bg-zinc-100 hover:shadow-[0_4px_20px_rgba(255,255,255,0.12)] active:scale-[0.99] disabled:opacity-60 disabled:active:scale-100"
          >
            <span className="inline-flex items-center justify-center gap-2">
              {state !== "idle" && <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/20 border-t-black/70" aria-hidden />}
              {state === "opening" ? "Opening secure browser…" : state === "waiting" ? "Waiting for browser approval…" : "Log in"}
            </span>
          </button>
          <button type="button" onClick={() => void continueInBrowser("sign_up")} disabled={state !== "idle"} className="mt-1.5 w-full rounded-xl px-5 py-3.5 text-sm font-medium text-zinc-200 transition-colors duration-150 hover:bg-white/[0.06] disabled:opacity-60">
            Create account
          </button>
        </div>
        {state !== "idle" && (
          <button type="button" onClick={cancelBrowserSignIn} className="mt-3 w-full rounded-xl px-5 py-2 text-sm font-medium text-zinc-500 transition-colors hover:bg-white/[0.04] hover:text-white">
            Cancel
          </button>
        )}
        <p className="mt-5 text-xs leading-5 text-zinc-600">Both options open visionxixlabs.com in your default browser. Axiom never embeds your identity-provider password.</p>
        <details className="group mt-6 rounded-xl border border-white/[0.06] bg-white/[0.015] p-4 text-left transition-colors open:border-white/[0.09] open:bg-white/[0.025]">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500 transition-colors group-hover:text-zinc-300">Enterprise recovery sign-in</summary>
          <p className="mt-3 text-xs leading-5 text-zinc-600">For administrator-issued recovery access only. The workspace must still have an active approved pilot or commercial entitlement.</p>
          <label htmlFor="workspace-key" className="mt-3 block text-xs font-medium text-zinc-300">Workspace API key</label>
          <input id="workspace-key" type="password" autoComplete="off" spellCheck={false} value={apiKey} onChange={(event) => { setApiKey(event.target.value); setError(null); }} onKeyDown={(event) => { if (event.key === "Enter" && apiKey.trim() && !checkingKey) void signInWithKey(); }} placeholder="vxlk_live_…" className="mt-2 w-full rounded-xl border border-white/[0.10] bg-black/30 px-4 py-3 text-sm font-mono text-white outline-none placeholder:text-zinc-700 transition-colors focus:border-violet-500/60 focus:ring-2 focus:ring-violet-500/15" />
          <button type="button" onClick={() => void signInWithKey()} disabled={!apiKey.trim() || checkingKey || state !== "idle"} className="mt-3 w-full rounded-full border border-white/[0.10] bg-white/[0.05] px-5 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-white/[0.09] disabled:cursor-not-allowed disabled:opacity-50">
            {checkingKey ? "Verifying workspace…" : "Use administrator key"}
          </button>
        </details>
        <p className="mt-6 text-xs leading-5 text-zinc-700">
          Product demonstrations use the isolated website sandbox. This installed workspace never substitutes sample records for service data.
        </p>
      </div>
    </main>
  );
}
