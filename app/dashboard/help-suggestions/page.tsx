"use client";

/**
 * /dashboard/help-suggestions — proposed HelpEntry candidates.
 *
 * Each row clusters a recurring no_match query and proposes a title,
 * category, and keyword list ready to paste into the catalog.
 */

import { useEffect, useState } from "react";
import { SparklesIcon, ClipboardDocumentIcon, CheckIcon } from "@heroicons/react/24/outline";

interface Suggestion {
  normalizedQuery: string;
  sampleQuery: string;
  count: number;
  suggestedCategory: string;
  suggestedKeywords: string[];
  confidence: number;
}

interface Report {
  totalNoMatchQueries: number;
  suggestions: Suggestion[];
  errors: string[];
}

function snippetFor(s: Suggestion): string {
  const id = s.normalizedQuery.replace(/\s+/g, "-").slice(0, 40);
  return `  {
    id: "${id}",
    title: "${s.sampleQuery.replace(/"/g, '\\"')}",
    category: "${s.suggestedCategory}",
    description: "TODO: one paragraph explaining what this surface does.",
    requirements: [],
    safetyContract: "trust_center_read_only",
    evidenceRef: "TODO: path to the lib/route that backs this entry.",
    keywords: ${JSON.stringify(s.suggestedKeywords)},
  },`;
}

export default function HelpSuggestionsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/help/suggestions?limit=25", { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Suggestions unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."));
  }, []);

  function copyOne(key: string, snippet: string) {
    navigator.clipboard.writeText(snippet).then(() => {
      setCopied(key);
      setTimeout(() => setCopied((c) => (c === key ? null : c)), 1500);
    });
  }

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-white/[0.08] to-transparent" aria-hidden />
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <SparklesIcon className="h-3.5 w-3.5 text-fuchsia-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-fuchsia-300">
              Doc gaps · auto-suggested
            </span>
          </span>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          What we <span className="text-gradient">should document.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every recurring no_match query becomes a suggested HelpEntry candidate — copy the snippet straight
          into lib/help/helpKnowledgeBase.ts, fill the description + evidenceRef, ship.
        </p>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {report && (
        report.suggestions.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No recurring no_match queries yet. Run the help bubble more or wait for users to ask.
          </div>
        ) : (
          <div className="space-y-3 mb-8">
            {report.suggestions.map((s) => {
              const snippet = snippetFor(s);
              const key = s.normalizedQuery;
              const confidencePct = Math.round(s.confidence * 100);
              return (
                <div key={key} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30">
                      {s.suggestedCategory}
                    </span>
                    <p className="text-[14px] font-semibold text-white">{s.sampleQuery}</p>
                    <span className="text-[10px] font-mono text-zinc-500">×{s.count} queries</span>
                    <span className="text-[10px] font-mono text-zinc-400 ml-auto">confidence {confidencePct}%</span>
                  </div>
                  <pre className="max-h-64 overflow-auto rounded-lg border border-white/[0.08] bg-black/40 p-3 text-[10px] font-mono text-zinc-100 leading-relaxed">
{snippet}
                  </pre>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <p className="text-[10px] font-mono text-zinc-500 truncate">
                      keywords [{s.suggestedKeywords.join(", ")}]
                    </p>
                    <button
                      onClick={() => copyOne(key, snippet)}
                      className="inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded border bg-black/30 border-white/[0.08] text-zinc-300 hover:text-white"
                    >
                      {copied === key ? (
                        <>
                          <CheckIcon className="h-3 w-3 text-emerald-300" />
                          copied
                        </>
                      ) : (
                        <>
                          <ClipboardDocumentIcon className="h-3 w-3" />
                          copy snippet
                        </>
                      )}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}
    </div>
  );
}
