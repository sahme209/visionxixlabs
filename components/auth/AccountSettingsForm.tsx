"use client";

import { FormEvent, useRef, useState } from "react";

export function AccountSettingsForm({ initialDisplayName, email }: { initialDisplayName: string; email: string }) {
  const pending = useRef(false);
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending.current) return;
    pending.current = true;
    setState("saving");
    try {
      const response = await fetch("/api/account/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName }),
      });
      setState(response.ok ? "saved" : "error");
    } catch {
      setState("error");
    } finally {
      pending.current = false;
    }
  }

  return (
    <form onSubmit={save} className="w-full rounded-xl border border-white/8 bg-white/2.5 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-medium text-zinc-100">Profile</h2>
          <p className="mt-1 text-xs leading-5 text-zinc-400">This name appears in your Axiom workspace. Your sign-in email and workspace access remain protected.</p>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/6 px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-200">Verified account</span>
      </div>
      <label className="mt-5 block text-xs font-medium text-zinc-300" htmlFor="display-name">Display name</label>
      <input id="display-name" disabled={state === "saving"} value={displayName} onChange={(event) => { setDisplayName(event.target.value); setState("idle"); }} maxLength={80} required className="mt-2 min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-zinc-100 outline-hidden transition placeholder:text-zinc-600 focus:border-orange-300/50" />
      <p className="mt-5 text-xs text-zinc-600">Sign-in email · {email}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === "saving"} className="min-h-9 rounded-lg bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-60">{state === "saving" ? "Saving…" : "Save profile"}</button>
        {state === "saved" && <p className="text-sm text-emerald-300">Profile saved.</p>}
        {state === "error" && <p className="text-sm text-rose-300">The profile update was not confirmed. Refresh to verify the saved name before trying again.</p>}
      </div>
    </form>
  );
}
