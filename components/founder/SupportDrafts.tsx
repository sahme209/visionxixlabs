"use client";
import { useState } from "react";
import type { SupportDraft } from "@/lib/founder/supportDrafts";

type Item = { question: string; count: number; draft: SupportDraft | null };
const ERRORS: Record<string, string> = {
  workspace_ai_credit_pool_exhausted: "Your workspace has no AI credit left. Add credit and try again.",
  workspace_ai_provider_unavailable: "AI is not available for your workspace right now.",
  workspace_required: "Open a workspace first; its AI settings and credit are used.",
  rate_limited: "Wait a moment before drafting again.",
};

/** Drafts answers for the most-asked unanswered questions, through the governed AI path, on request. */
export function SupportDrafts() {
  const [state, setState] = useState<{ kind: "idle" | "busy" } | { kind: "done"; items: Item[] } | { kind: "error"; text: string }>({ kind: "idle" });
  async function run() {
    setState({ kind: "busy" });
    try {
      const res = await fetch("/api/founder/support-drafts", { method: "POST" });
      const body = await res.json().catch(() => null) as { ok?: boolean; error?: string; data?: { drafts: Item[] } } | null;
      if (body?.ok && body.data) setState({ kind: "done", items: body.data.drafts });
      else setState({ kind: "error", text: ERRORS[body?.error ?? ""] ?? "Drafts could not be made right now. Try again." });
    } catch { setState({ kind: "error", text: "Drafting could not be reached. Try again." }); }
  }
  return (
    <div className="mt-4 rounded-xl border border-white/8 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-zinc-300">Let an agent draft answers for the most-asked open questions, from your documentation only.</p>
        <button type="button" disabled={state.kind === "busy"} onClick={() => void run()} className="inline-flex min-h-8 items-center rounded-lg bg-white/5 px-3 text-xs text-zinc-100 hover:bg-white/10 disabled:opacity-50">{state.kind === "busy" ? "Drafting…" : "Draft answers"}</button>
      </div>
      <div aria-live="polite">
        {state.kind === "error" && <p role="alert" className="mt-2 text-xs text-amber-300">{state.text}</p>}
        {state.kind === "done" && (state.items.length === 0 ? <p className="mt-2 text-xs text-zinc-400">No open questions to draft for.</p> : (
          <ol className="mt-3 space-y-3">{state.items.map((it, i) => (
            <li key={i} className="rounded-lg bg-black/20 p-3 text-xs">
              <p className="text-zinc-100">&ldquo;{it.question}&rdquo; <span className="text-zinc-500">asked {it.count} time{it.count === 1 ? "" : "s"}</span></p>
              {it.draft === null ? <p className="mt-1 text-amber-300">No usable draft came back.</p>
                : it.draft.status === "answered" ? <>
                  <p className="mt-1 text-[11px] text-emerald-300">Draft answer from your docs</p>
                  <p className="mt-1 whitespace-pre-wrap leading-5 text-zinc-200">{it.draft.answer}</p>
                  <p className="mt-1 text-zinc-500">Sources: {it.draft.citations.map((c, j, all) => <a key={c.id} href={c.href} className="underline underline-offset-2">{c.title}{j < all.length - 1 ? ", " : ""}</a>)}</p>
                </> : <>
                  <p className="mt-1 text-[11px] text-amber-200">Your docs do not cover this. Suggested page outline:</p>
                  <ul className="mt-1 list-disc pl-5 text-zinc-300">{it.draft.docOutline.map((h) => <li key={h}>{h}</li>)}</ul>
                </>}
            </li>))}</ol>))}
      </div>
      <p className="mt-2 text-[11px] text-zinc-500">Uses your workspace&apos;s governed AI and credit. Drafts are for you to review; nothing is published.</p>
    </div>
  );
}
