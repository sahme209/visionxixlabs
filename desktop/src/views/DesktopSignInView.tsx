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
    <main className="h-screen w-screen bg-[#111214] text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div className="relative w-full max-w-[430px] text-center">
        <div className="mx-auto mb-7 h-16 w-16 rounded-2xl border border-white/[0.10] bg-[#202225] flex items-center justify-center text-2xl font-semibold">A</div>
        <p className="text-xs font-medium text-zinc-400">Axiom Agent</p>
        <h1 className="mt-3 text-[30px] font-medium leading-[1.12] tracking-[-0.035em]">Deployment control, from request to closure.</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-6 text-zinc-400">
          Sign in through your system browser, then return here automatically. Your workspace and paid access are verified before operational data loads.
        </p>
        {error && <div role="alert" className="mt-5 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-left text-xs text-red-200">{error}</div>}
        <button
          type="button"
          onClick={() => void continueInBrowser("sign_in")}
          disabled={state !== "idle"}
          className="mt-7 w-full rounded-xl bg-white px-5 py-3.5 text-sm font-semibold text-black hover:bg-zinc-100 disabled:opacity-60"
        >
          {state === "opening" ? "Opening secure browser…" : state === "waiting" ? "Waiting for browser approval…" : "Log in"}
        </button>
        <button type="button" onClick={() => void continueInBrowser("sign_up")} disabled={state !== "idle"} className="mt-3 w-full rounded-xl border border-white/[0.10] bg-white/[0.04] px-5 py-3.5 text-sm font-semibold text-zinc-100 hover:bg-white/[0.08] disabled:opacity-60">
          Create account
        </button>
        {state !== "idle" && (
          <button type="button" onClick={cancelBrowserSignIn} className="mt-3 w-full rounded-xl px-5 py-2 text-sm font-medium text-zinc-400 hover:bg-white/[0.04] hover:text-white">
            Cancel
          </button>
        )}
        <p className="mt-4 text-xs leading-5 text-zinc-500">Both options open visionxixlabs.com in your default browser. Axiom never embeds your identity-provider password.</p>
        <details className="mt-5 rounded-xl border border-white/[0.07] bg-white/[0.025] p-4 text-left">
          <summary className="cursor-pointer text-xs font-medium text-zinc-500">Enterprise recovery sign-in</summary>
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
