import { useState } from "react";
import { open } from "@tauri-apps/plugin-shell";
import { desktopClient, type VerifiedDesktopIdentity } from "../lib/desktopClient";
import { clearApiKey } from "../lib/apiKeyStore";
import { clearAuthSession } from "../lib/authSession";

const WEB_BASE = "https://visionxixlabs.com";

export function DesktopAccessRequiredView({
  identity,
  onAccessGranted,
  onSignedOut,
}: {
  identity: VerifiedDesktopIdentity;
  onAccessGranted: (identity: VerifiedDesktopIdentity) => void;
  onSignedOut: () => void;
}) {
  const [checking, setChecking] = useState(false);
  const [openingBilling, setOpeningBilling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkAgain() {
    setChecking(true);
    setError(null);
    const verified = await desktopClient.verifyCurrentCredential();
    setChecking(false);
    if (!verified.ok) {
      setError(verified.error);
      return;
    }
    if (!verified.data.access.allowed) {
      setError("Access is not active yet. If an administrator just provisioned it, wait a moment and check again.");
      return;
    }
    onAccessGranted(verified.data);
  }

  async function signOut() {
    await Promise.allSettled([clearApiKey(), clearAuthSession()]);
    desktopClient.setSession(undefined);
    onSignedOut();
  }

  async function openBillingPortal() {
    setOpeningBilling(true);
    setError(null);
    try {
      const result = await desktopClient.desktopBillingPortal();
      if (!result.ok) throw new Error(result.error);
      const destination = new URL(result.data.url);
      if (destination.protocol !== "https:" || !(destination.hostname === "stripe.com" || destination.hostname.endsWith(".stripe.com"))) {
        throw new Error("The billing service returned an unexpected destination.");
      }
      await open(destination.toString());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "The billing portal could not be opened.");
    } finally {
      setOpeningBilling(false);
    }
  }

  return (
    <main className="h-screen w-screen bg-axiom-bg text-white flex items-center justify-center px-6 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none" aria-hidden>
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[680px] h-[680px] rounded-full bg-amber-500/[0.08] blur-[150px]" />
      </div>
      <div className="relative w-full max-w-lg rounded-2xl border border-white/[0.08] bg-zinc-950/85 p-8 shadow-2xl">
        <div className="flex items-start gap-4">
          <div className="h-12 w-12 shrink-0 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-500 flex items-center justify-center text-lg font-bold">A</div>
          <div>
            <p className="text-[10px] font-mono uppercase tracking-[0.22em] text-emerald-300">Identity verified</p>
            <h1 className="mt-1 text-2xl font-bold">{identity.access.title}</h1>
          </div>
        </div>
        <p className="mt-6 text-sm leading-6 text-zinc-300">{identity.access.message}</p>
        <div className="mt-5 rounded-xl border border-white/[0.08] bg-black/25 px-4 py-3 text-xs text-zinc-400">
          <div className="flex justify-between gap-4"><span>Workspace</span><span className="font-mono text-zinc-200">{identity.organizationId}</span></div>
          <div className="mt-2 flex justify-between gap-4"><span>Access status</span><span className="font-mono text-amber-200">{identity.access.billingStatus.replaceAll("_", " ")}</span></div>
        </div>
        {error && <div role="alert" className="mt-4 rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">{error}</div>}
        {identity.access.code === "payment_past_due" || identity.access.code === "access_canceled" ? (
          <button type="button" disabled={openingBilling} onClick={() => void openBillingPortal()} className="mt-6 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-100 disabled:opacity-60">
            {openingBilling ? "Opening billing…" : "Manage billing"}
          </button>
        ) : (
          <button type="button" onClick={() => void open(`${WEB_BASE}${identity.access.accessRequestPath}`)} className="mt-6 w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-100">
            Request production access
          </button>
        )}
        <button type="button" onClick={() => void checkAgain()} disabled={checking} className="mt-3 w-full rounded-full bg-violet-600 px-5 py-3 text-sm font-semibold hover:bg-violet-500 disabled:opacity-60">
          {checking ? "Checking access…" : "Check access again"}
        </button>
        <div className="mt-4 flex items-center justify-center gap-4 text-xs">
          <button type="button" onClick={() => void open(`${WEB_BASE}${identity.access.pricingPath}`)} className="text-violet-300 hover:text-violet-200">Review access model</button>
          <span className="text-zinc-700">•</span>
          <button type="button" onClick={() => void signOut()} className="text-zinc-400 hover:text-white">Use another account</button>
        </div>
        <p className="mt-6 text-center text-xs leading-5 text-zinc-600">Creating an account verifies identity only. Deployment operations require a separately provisioned approved pilot or commercial workspace entitlement.</p>
      </div>
    </main>
  );
}
