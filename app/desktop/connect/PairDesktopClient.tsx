"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { verificationDesktopCallback } from "@/lib/auth/verificationCallback";

export function PairDesktopClient({ challenge, deviceLabel, accountEmail, children }: {
  challenge: string;
  deviceLabel: string;
  accountEmail?: string;
  children: ReactNode;
}) {
  const [state, setState] = useState<"idle" | "loading" | "switching" | "done" | "unavailable" | "signed_out">("idle");
  const [error, setError] = useState("");
  const action = useRef<"approve" | "switch" | null>(null);
  const recovery = useRef<HTMLParagraphElement>(null);
  const callback = verificationDesktopCallback(`/desktop/connect?challenge=${encodeURIComponent(challenge)}&intent=sign_in`, challenge);

  useEffect(() => {
    if (state === "unavailable" || state === "signed_out") recovery.current?.focus();
  }, [state]);

  async function approve() {
    if (action.current !== null) return;
    action.current = "approve";
    setState("loading");
    setError("");
    try {
      const response = await fetch("/api/desktop/pair/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ challenge }),
      });
      const body = await response.json().catch(() => null);
      if (response.status === 404 || response.status === 410 || body?.status === "consumed") {
        setState("unavailable");
        return;
      }
      if (response.status === 401) {
        setState("signed_out");
        return;
      }
      if (response.status === 409) {
        throw new Error("This request is already being processed. Check V19 before trying again.");
      }
      if (!response.ok || body?.status !== "approved") {
        throw new Error(typeof body?.message === "string" ? body.message : "The desktop could not be approved. Try again.");
      }
      setState("done");
      window.setTimeout(() => window.location.assign("axiom-agent://auth/complete"), 450);
    } catch (cause) {
      action.current = null;
      setState("idle");
      setError(cause instanceof Error ? cause.message : "Pairing failed.");
    }
  }

  async function useAnotherAccount() {
    if (action.current !== null) return;
    if (!callback) {
      setError("This pairing request cannot be resumed. Return to V19 and choose Log in again.");
      return;
    }
    action.current = "switch";
    setState("switching");
    setError("");
    try {
      // NextAuth ends only the browser session and navigates to explicit login.
      // No pairing approval, desktop revocation, or identity selection occurs.
      await signOut({ callbackUrl: `/auth/signin?callbackUrl=${encodeURIComponent(callback)}&switchAccount=1` });
    } catch {
      action.current = null;
      setState("idle");
      setError("Could not switch browser accounts. Try again, or reload this pairing page before continuing.");
    }
  }

  const reviewContext = state !== "signed_out" && (
    <>
      <p className="mb-7 mt-2 text-sm leading-6 text-zinc-400">
        {accountEmail && <>Signed in as <span className="text-zinc-200">{accountEmail}</span>. </>}
        Approve only if this is your desktop.
      </p>
      {children}
    </>
  );

  let controls;
  if (state === "done") {
    controls = (
      <div className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-5 text-emerald-100">
        <p className="font-semibold">V19 is authorized</p>
        <p className="mt-1 text-sm text-emerald-200/75">The installed app will verify and consume this approval once. You may close this tab after V19 opens.</p>
        <a href="axiom-agent://auth/complete" className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-white px-5 py-3 text-sm font-semibold text-black hover:bg-zinc-100">
          Open V19
        </a>
      </div>
    );
  } else if (state === "unavailable" || state === "signed_out") {
    controls = (
      <div className={`space-y-4 rounded-xl border border-white/10 bg-white/3 p-4${state === "signed_out" ? " mt-7" : ""}`}>
        <p ref={recovery} tabIndex={-1} className="text-sm text-zinc-200">
          {state === "signed_out" && callback
            ? "Your browser session ended. Sign in again to review this device request."
            : "This pairing request is no longer available. Return to V19 and choose Log in to start again."}
        </p>
        {state === "signed_out" && callback && (
          <Link href={`/auth/signin?callbackUrl=${encodeURIComponent(callback)}`} className="text-sm text-orange-300 underline">
            Sign in again
          </Link>
        )}
      </div>
    );
  } else {
    controls = (
      <div className="space-y-4">
        <div className="rounded-xl border border-white/10 bg-white/3 p-4">
          <p className="text-xs uppercase tracking-widest text-zinc-500">Device requesting access</p>
          <p className="mt-2 font-mono text-zinc-100">{deviceLabel}</p>
        </div>
        {error && <p role="alert" className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-200">{error}</p>}
        <div className="grid grid-cols-2 gap-3">
          <Link href="/" className="inline-flex items-center justify-center rounded-full border border-white/10 bg-white/4 px-5 py-3 text-sm font-semibold text-zinc-300 hover:bg-white/8">Cancel</Link>
          <button
            type="button"
            onClick={approve}
            disabled={state !== "idle"}
            className="w-full rounded-full bg-white px-5 py-3 text-sm font-semibold text-black transition hover:bg-zinc-100 disabled:opacity-50"
          >
            {state === "loading" ? "Connecting…" : "Continue"}
          </button>
        </div>
        <div className="border-t border-white/10 pt-4">
          <button type="button" onClick={useAnotherAccount} disabled={state !== "idle"} aria-describedby="browser-account-switch-note" className="text-sm text-orange-300 underline disabled:opacity-50">
            {state === "switching" ? "Switching browser account…" : "Use another account"}
          </button>
          <p id="browser-account-switch-note" className="mt-2 text-xs leading-5 text-zinc-500">This signs out only this browser. Existing paired desktop sessions remain signed in. Sign in with the intended account, then review and approve this device.</p>
        </div>
      </div>
    );
  }

  return <>{reviewContext}{controls}</>;
}
