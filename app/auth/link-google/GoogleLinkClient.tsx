"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { signIn } from "next-auth/react";

const messages: Record<string, string> = {
  code_sent: "Paste the confirmation code from your email into this window.",
  delivery_unavailable: "Email confirmation is unavailable. Use your existing password or contact support.",
  proof_refused: "That confirmation did not work. Check your password or code and try again.",
  wait: "Please wait a minute before requesting another code.",
  wait_and_retry: "Please wait a minute and try again.",
  google_link_unavailable: "Account confirmation is temporarily unavailable. Try again later or contact support.",
};
const control = "inline-flex min-h-[30px] w-full items-center justify-center rounded-lg border border-white/10 bg-[#202020] px-3 py-1.5 text-xs leading-4 font-medium text-zinc-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-zinc-300";
export default function GoogleLinkClient({ provider = "google" }: { provider?: "google" | "gitlab" }) {
  const providerName = provider === "google" ? "Google" : "GitLab";
  const endpoint = `/api/auth/${provider}-link`;
  const restart = `Start ${providerName} sign-in again. If you came from the desktop app, restart pairing there.`;
  function messageFor(code: string): string {
    return Object.hasOwn(messages, code) ? messages[code] : messages.google_link_unavailable;
  }
  const [email, setEmail] = useState("");
  const [csrf, setCsrf] = useState("");
  const [mode, setMode] = useState<"password" | "code" | null>(null);
  const [proof, setProof] = useState("");
  const [message, setMessage] = useState("");
  const [restartRequired, setRestartRequired] = useState(false);
  const [callbackUrl, setCallbackUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inFlight = useRef(false);
  const proofInput = useRef<HTMLInputElement>(null);
  const methodButton = useRef<HTMLButtonElement>(null);
  const restartLink = useRef<HTMLAnchorElement>(null);
  const continueButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (busy) return;
    if (callbackUrl) continueButton.current?.focus();
    else if (restartRequired) restartLink.current?.focus();
    else if (mode) proofInput.current?.focus();
    else methodButton.current?.focus();
  }, [mode, busy, callbackUrl, restartRequired]);
  useEffect(() => {
    let active = true;
    fetch(endpoint, { cache: "no-store" }).then(async res => {
      const data = await res.json();
      if (!active) return;
      if (res.ok && typeof data.csrf === "string" && typeof data.email === "string") { setCsrf(data.csrf); setEmail(data.email); }
      else if (data.error === `restart_${provider}_signin`) { setRestartRequired(true); setMessage(restart); }
      else setMessage(messages.google_link_unavailable);
    }).catch(() => { if (active) setMessage(messages.google_link_unavailable); });
    return () => { active = false; };
  }, [endpoint, provider, restart]);
  async function submit(action: "send_code" | "confirm") {
    if (!csrf || inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    try {
      const response = await fetch(endpoint, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, csrf, ...(action === "confirm" && mode ? { [mode]: proof } : {}) }) });
      const data = await response.json();
      setProof("");
      if (data.result === "linked" && response.ok && typeof data.callbackUrl === "string") { setCallbackUrl(data.callbackUrl); setCsrf(""); setMessage(`${providerName} is linked. Continue to finish signing in.`); }
      else if (data.result === "restart" || data.error === `restart_${provider}_signin`) {
        setCsrf("");
        setEmail("");
        setMode(null);
        setRestartRequired(true);
        setMessage(`This request expired or changed. ${restart}`);
      } else setMessage(messageFor(data.result ?? data.error));
    } catch { setMessage(messages.google_link_unavailable); }
    finally { inFlight.current = false; setBusy(false); }
  }
  return <main className="isolate flex min-h-screen items-center justify-center bg-[#111111] before:fixed before:inset-0 before:-z-10 before:bg-[#111111] px-6 py-16 text-zinc-100">
    <section className="relative w-full max-w-[230px]">
      <Link href="/" aria-label="vxix home" className="mx-auto mb-[30px] flex w-fit rounded-sm focus-visible:outline-2 focus-visible:outline-offset-8 focus-visible:outline-zinc-300"><Image src="/brand/vxix-mark.svg" alt="vxix" width={24} height={24} /></Link>
      <h1 className="mb-[30px] text-center text-[20px] font-medium leading-6 tracking-[-0.02em]">{`Finish ${providerName} sign-in`}</h1>
      <p className="mb-5 text-xs leading-5 text-zinc-400">Confirm account ownership before {email ? <>the {providerName} account <strong className="break-words font-normal text-zinc-200">{email}</strong> is linked to V19.</> : `${providerName} is linked to V19.`}</p>
      {message && <p role="status" className="mb-5 text-xs leading-5">{message}</p>}
      {restartRequired && <Link href="/auth/signin" ref={restartLink} className={control}>Back to sign-in</Link>}
      {callbackUrl ? <button type="button" disabled={busy} ref={continueButton} className={control.replace("bg-[#202020]", "bg-white").replace("text-zinc-100", "text-zinc-950")} onClick={() => { if (inFlight.current) return; inFlight.current = true; setBusy(true); void signIn(provider, { callbackUrl }).catch(() => { setMessage(messages.google_link_unavailable); setBusy(false); inFlight.current = false; }); }}>Continue with {providerName}</button> : csrf && <>
        {!mode ? <div className="space-y-2.5">
          <button type="button" disabled={busy} ref={methodButton} className={control} onClick={() => { setProof(""); setMode("password"); }}>Use existing password</button>
          <button type="button" disabled={busy} className={control} onClick={() => { setProof(""); setMode("code"); void submit("send_code"); }}>Email me a confirmation code</button>
        </div> : <form className="space-y-2.5" onSubmit={event => { event.preventDefault(); void submit("confirm"); }}>
          <label className="sr-only" htmlFor="google-link-proof">{mode === "password" ? "Existing account password" : "Email confirmation code"}</label>
          <input id="google-link-proof" ref={proofInput} disabled={busy} type={mode === "password" ? "password" : "text"} autoComplete={mode === "password" ? "current-password" : "one-time-code"} maxLength={mode === "password" ? 1024 : 128} spellCheck={false} placeholder={mode === "password" ? "Existing account password" : "Email confirmation code"} value={proof} onChange={event => setProof(mode === "code" ? event.target.value.trim() : event.target.value)} className="block min-h-[30px] w-full rounded-lg border border-white/10 bg-[#202020] px-2.5 py-1.5 text-xs leading-4 [@media(pointer:coarse)]:text-base text-white outline-hidden focus:border-white/30 focus:ring-2 focus:ring-white/15" />
          <button type="submit" disabled={busy || !proof} className={control}>Confirm and link {providerName}</button>
          <button type="button" disabled={busy} className="min-h-[30px] w-full text-[10px] text-zinc-400 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-zinc-300" onClick={() => { setProof(""); setMode(null); }}>Use another method</button>
        </form>}
      </>}
      <details className="mt-3 text-center text-[10px] text-zinc-400">
        <summary className="mx-auto min-h-[30px] w-fit cursor-pointer content-center rounded-sm px-2 focus-visible:outline-2 focus-visible:outline-zinc-300">Need help?</summary>
        <p className="mt-2 leading-5">Use the password for an existing verified account, or a fresh code sent to its mailbox. Desktop pairing still requires your separate approval.</p>
        {provider === "gitlab" && <p className="mt-2 leading-5">GitLab must share a verified email address. You can also return to V19 and choose another sign-in method. Repository access is managed separately.</p>}
        <p className="mt-2">{!restartRequired && <><Link href="/auth/signin" className="underline underline-offset-4">Back to sign-in</Link> · </>}<Link href="/contact" className="underline underline-offset-4">Contact support</Link></p>
      </details>
    </section>
  </main>;
}
