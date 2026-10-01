"use client";

import { FormEvent, useState } from "react";

export function AccountSettingsForm({ initialDisplayName, email }: { initialDisplayName: string; email: string }) {
  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [state, setState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    const response = await fetch("/api/account/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ displayName }),
    });
    setState(response.ok ? "saved" : "error");
  }

  return (
    <form onSubmit={save} className="mt-8 max-w-xl rounded-2xl border border-white/[0.08] bg-white/[0.025] p-5 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-medium text-zinc-100">Profile</h2>
          <p className="mt-1 text-sm leading-6 text-zinc-500">This name appears in your Axiom companion. Your sign-in email and workspace access remain protected.</p>
        </div>
        <span className="rounded-full border border-emerald-400/20 bg-emerald-400/[0.06] px-2.5 py-1 text-[10px] uppercase tracking-[0.14em] text-emerald-200">Verified account</span>
      </div>
      <label className="mt-7 block text-xs font-medium text-zinc-300" htmlFor="display-name">Display name</label>
      <input id="display-name" value={displayName} onChange={(event) => { setDisplayName(event.target.value); setState("idle"); }} maxLength={80} required className="mt-2 min-h-11 w-full rounded-lg border border-white/[0.1] bg-black/20 px-3 text-sm text-zinc-100 outline-none transition placeholder:text-zinc-600 focus:border-violet-300/50" />
      <p className="mt-5 text-xs text-zinc-600">Sign-in email · {email}</p>
      <div className="mt-6 flex flex-wrap items-center gap-3">
        <button type="submit" disabled={state === "saving"} className="min-h-11 rounded-full bg-zinc-100 px-5 text-sm font-semibold text-zinc-950 transition hover:bg-white disabled:opacity-60">{state === "saving" ? "Saving…" : "Save profile"}</button>
        {state === "saved" && <p className="text-sm text-emerald-300">Profile saved.</p>}
        {state === "error" && <p className="text-sm text-rose-300">Could not save that name. Use 1–80 characters and try again.</p>}
      </div>
    </form>
  );
}
