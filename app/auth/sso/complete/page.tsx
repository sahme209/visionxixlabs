"use client";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";

/** Exchanges the one-time ticket from the URL fragment for a normal session, then clears the fragment. */
export default function CompanySignInComplete() {
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const params = new URLSearchParams(window.location.hash.slice(1));
    history.replaceState(null, "", window.location.pathname);
    const ticket = params.get("ticket");
    const raw = params.get("callbackUrl") ?? "/control";
    const callbackUrl = raw.startsWith("/") && !raw.startsWith("//") && !raw.includes("\\") ? raw : "/control";
    if (!ticket) { queueMicrotask(() => setFailed(true)); return; }
    signIn("sso-ticket", { ticket, callbackUrl, redirect: false }).then((r) => {
      if (r?.ok && !r.error) window.location.assign(callbackUrl);
      else setFailed(true);
    }, () => setFailed(true));
  }, []);
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#111] px-4 text-zinc-100">
      <p role="status" className="text-xs text-zinc-300">
        {failed ? <>Company sign-in expired or was already used. <a href="/auth/sso" className="underline underline-offset-2">Try again</a>.</> : "Signing you in…"}
      </p>
    </main>
  );
}
