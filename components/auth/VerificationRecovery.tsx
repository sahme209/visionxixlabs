"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { verificationDesktopCallback } from "@/lib/auth/verificationCallback";

/** Public account-neutral recovery, never a claim that a mailbox/account exists. */
export function VerificationRecovery({ initialEmail = "", callbackUrl }: { initialEmail?: string; callbackUrl?: string | null }) {
  const [email, setEmail] = useState(initialEmail);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const inFlight = useRef(false);
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setMessage("");
    setError("");
    try {
      const callback = verificationDesktopCallback(callbackUrl);
      const response = await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), ...(callback ? { callbackUrl: callback } : {}) }),
      });
      if (!response.ok) throw new Error("unavailable");
      setMessage("If your account needs email verification, check your inbox for a new link. If it does not arrive, try again later or contact support.");
    } catch {
      setError("Email verification recovery is temporarily unavailable. Try again later.");
    } finally {
      inFlight.current = false;
      setPending(false);
    }
  }
  if (!open) return <button type="button" onClick={() => { setEmail(initialEmail); setOpen(true); }} className="mt-4 text-sm text-orange-300 underline">Need a verification email?</button>;
  return (
    <section aria-label="Email verification recovery" className="mt-5 space-y-3 rounded-lg border border-white/10 p-4 text-sm">
      <p className="text-zinc-300">Request a new verification link for an existing email/password account. This does not reset your password or create an account.</p>
      <form onSubmit={submit} className="space-y-3">
        <label className="block text-zinc-300">Verification email address
          <input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} className="auth-input mt-1 w-full rounded-lg border border-white/10 bg-white/5 px-3 py-2" />
        </label>
        <button type="submit" disabled={pending} className="rounded-lg border border-white/20 px-3 py-2 text-zinc-200 disabled:opacity-50">{pending ? "Requesting link…" : "Request verification link"}</button>
      </form>
      {message && <p role="status" className="text-zinc-300">{message}</p>}
      {error && <p role="alert" className="text-red-300">{error}</p>}
      <p className="text-xs text-zinc-500">A new link replaces previous unused links. If desktop pairing expires, return to Axiom Agent and choose Log in again.</p>
      <Link href="/contact" className="text-orange-300 underline">Contact support</Link>
    </section>
  );
}
