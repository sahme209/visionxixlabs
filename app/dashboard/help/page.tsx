"use client";

/**
 * /dashboard/help — in-app knowledge base.
 *
 * Browse every Axiom surface grouped by category, or search by
 * natural-language query. Every entry shows its description, what
 * permissions are needed, its safety contract, and a link to the
 * actual surface.
 */

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  QuestionMarkCircleIcon,
  MagnifyingGlassIcon,
  ArrowRightIcon,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";

type Category = "operator" | "providers" | "telemetry" | "security" | "cost" | "containers" | "autonomy" | "notifications" | "audit" | "setup";

interface HelpEntry {
  id: string;
  title: string;
  category: Category;
  description: string;
  requirements: string[];
  href?: string;
  safetyContract?: string;
  evidenceRef: string;
  keywords: string[];
}

interface EntriesReport {
  total: number;
  entries: HelpEntry[];
  byCategory: Record<Category, HelpEntry[]>;
  categoryLabels: Record<Category, string>;
}

interface SearchHit {
  entry: HelpEntry;
  score: number;
  matchedTokens: string[];
}

interface HelpAnswer {
  query: string;
  totalTokens: number;
  hits: SearchHit[];
  primary?: HelpEntry;
  verdict: "found_primary" | "ambiguous" | "no_match";
  fallbackSuggestion: string;
}

export default function HelpPage() {
  const [data, setData] = useState<EntriesReport | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [answer, setAnswer] = useState<HelpAnswer | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/help/entries", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: EntriesReport; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setData(j.data);
        else setError(j.error?.userMessage ?? "Help unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."));
  }, []);

  async function ask() {
    const q = query.trim();
    if (!q) return;
    setBusy(true);
    setAnswer(null);
    try {
      const r = await fetch(`/api/help/ask?q=${encodeURIComponent(q)}`, { credentials: "include" });
      const j = (await r.json()) as { ok?: boolean; data?: HelpAnswer };
      if (j.ok && j.data) setAnswer(j.data);
    } finally {
      setBusy(false);
    }
  }

  const categories = useMemo(() => (data ? (Object.keys(data.byCategory) as Category[]).filter((c) => data.byCategory[c].length > 0) : []), [data]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div
          className="absolute inset-0 -z-10 opacity-90 pointer-events-none"
          style={{
            background:
              "radial-gradient(900px 320px at 12% 0%, rgba(99,102,241,0.10), transparent 60%), radial-gradient(700px 260px at 88% 110%, rgba(34,211,238,0.06), transparent 60%)",
          }}
          aria-hidden
        />
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />

        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <QuestionMarkCircleIcon className="h-3.5 w-3.5 text-cyan-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-300">
              Help · trust_center_read_only
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          Every surface. <span className="text-gradient">Explained honestly.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Ask a question, search by topic, or browse every Axiom feature. Answers come from grounded knowledge-base
          entries — never a hallucination. When no entry matches, we say so.
        </p>

        <form
          onSubmit={(e) => { e.preventDefault(); ask(); }}
          className="mt-5 flex items-center gap-2 flex-wrap"
        >
          <div className="relative flex-1 min-w-[260px]">
            <MagnifyingGlassIcon className="h-4 w-4 text-zinc-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="What does the autonomy charter do? How do I wire Slack? Why didn't cost flag this?"
              className="w-full rounded-lg border border-white/[0.08] bg-black/30 pl-9 pr-3 py-2 text-[13px] text-white focus:border-cyan-400/60 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex items-center gap-1.5 text-[12px] font-medium px-3 py-2 rounded-lg bg-cyan-500/15 text-cyan-200 border border-cyan-500/30 hover:bg-cyan-500/20 disabled:opacity-50"
          >
            {busy ? "Searching…" : "Ask"}
          </button>
        </form>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {/* Answer panel */}
      {answer && (
        <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 mb-6">
          <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
            <p className="text-[11px] font-mono text-cyan-300/80 uppercase tracking-wider">// answer for {JSON.stringify(answer.query)}</p>
            <span className={`text-[10px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
              answer.verdict === "found_primary"
                ? "bg-emerald-500/15 text-emerald-300 border-emerald-500/30"
                : answer.verdict === "ambiguous"
                  ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
                  : "bg-rose-500/15 text-rose-300 border-rose-500/30"
            }`}>{answer.verdict}</span>
          </div>

          {answer.primary && (
            <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/[0.04] p-3 mb-3">
              <p className="text-[10px] font-mono text-emerald-300/80 uppercase tracking-wider mb-1">// primary suspect</p>
              <p className="text-[14px] font-semibold text-white">{answer.primary.title}</p>
              <p className="text-[12px] text-zinc-300 mt-1 leading-relaxed">{answer.primary.description}</p>
              {answer.primary.href && (
                <Link href={answer.primary.href} className="mt-2 inline-flex items-center gap-1 text-[12px] font-medium text-emerald-200 hover:text-emerald-100">
                  Open {answer.primary.title} <ArrowRightIcon className="h-3 w-3" />
                </Link>
              )}
            </div>
          )}

          {answer.hits.length > (answer.primary ? 1 : 0) && (
            <details className="mt-2">
              <summary className="text-[11px] font-mono text-zinc-400 cursor-pointer hover:text-white">
                {answer.hits.length - (answer.primary ? 1 : 0)} other relevant{answer.hits.length - (answer.primary ? 1 : 0) === 1 ? "" : "s"}
              </summary>
              <div className="mt-2 space-y-1.5">
                {answer.hits.slice(answer.primary ? 1 : 0).map((h) => (
                  <div key={h.entry.id} className="rounded border border-white/[0.06] bg-black/20 p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[12px] font-semibold text-white">{h.entry.title}</p>
                      <span className="text-[10px] font-mono text-zinc-500">score {h.score.toFixed(2)}</span>
                    </div>
                    {h.entry.href && (
                      <Link href={h.entry.href} className="text-[10px] font-mono text-cyan-300 hover:text-cyan-200">
                        {h.entry.href}
                      </Link>
                    )}
                  </div>
                ))}
              </div>
            </details>
          )}

          {!answer.primary && answer.fallbackSuggestion && (
            <p className="text-[12px] text-amber-200 leading-relaxed">{answer.fallbackSuggestion}</p>
          )}
        </div>
      )}

      {/* Browse by category */}
      {data && (
        <div className="space-y-6 mb-8">
          {categories.map((cat) => (
            <div key={cat}>
              <p className="text-[11px] font-mono text-cyan-300/80 uppercase tracking-[0.18em] mb-2">
                // {data.categoryLabels[cat]} · {data.byCategory[cat].length}
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {data.byCategory[cat].map((e) => (
                  <div key={e.id} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 flex flex-col">
                    <p className="text-[13px] font-semibold text-white">{e.title}</p>
                    <p className="text-[11px] text-zinc-400 mt-1 leading-snug flex-1">{e.description}</p>

                    {e.requirements.length > 0 && (
                      <details className="mt-2">
                        <summary className="text-[10px] font-mono text-zinc-500 cursor-pointer hover:text-zinc-300 uppercase tracking-wider">
                          {e.requirements.length} requirement{e.requirements.length === 1 ? "" : "s"}
                        </summary>
                        <div className="mt-1 space-y-0.5 text-[10px] text-zinc-400">
                          {e.requirements.map((r, i) => <p key={i}>· {r}</p>)}
                        </div>
                      </details>
                    )}

                    <div className="mt-3 flex items-center justify-between gap-2 flex-wrap text-[10px] font-mono">
                      {e.safetyContract && (
                        <span className="inline-flex items-center gap-1 rounded border bg-emerald-500/[0.05] text-emerald-300 border-emerald-500/20 px-1.5 py-0.5">
                          <ShieldCheckIcon className="h-3 w-3" />
                          {e.safetyContract}
                        </span>
                      )}
                      {e.href && (
                        <Link href={e.href} className="inline-flex items-center gap-1 text-cyan-300 hover:text-cyan-200 ml-auto">
                          open <ArrowRightIcon className="h-3 w-3" />
                        </Link>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
