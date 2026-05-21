"use client";

/**
 * /dashboard/agent-bus — live agent conversation tail.
 *
 * Renders the durable AgentBusMessage history with per-message
 * sender + recipient + kind chips. Thread filter lets operators
 * follow one decision through every stage.
 */

import { useCallback, useEffect, useState } from "react";
import { ChatBubbleLeftRightIcon, ArrowPathIcon } from "@heroicons/react/24/outline";

interface BusMessage {
  id: string;
  sender: string;
  recipient: string | null;
  kind: string;
  summary: string;
  threadId?: string;
  publishedAt: string;
}

interface Report { messages: BusMessage[]; total: number }

const SENDER_TONE: Record<string, string> = {
  detector:       "bg-cyan-500/15 text-cyan-300 border-cyan-500/30",
  reasoner:       "bg-violet-500/15 text-violet-300 border-violet-500/30",
  simulator:      "bg-sky-500/15 text-sky-300 border-sky-500/30",
  policy_gate:    "bg-amber-500/15 text-amber-300 border-amber-500/30",
  boundary_gate:  "bg-amber-500/15 text-amber-300 border-amber-500/30",
  approver:       "bg-fuchsia-500/15 text-fuchsia-300 border-fuchsia-500/30",
  verifier:       "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  auditor:        "bg-zinc-500/15 text-zinc-300 border-zinc-500/30",
  council:        "bg-rose-500/15 text-rose-300 border-rose-500/30",
  improver:       "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
};

export default function AgentBusPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [thread, setThread] = useState<string>("");

  const load = useCallback((threadId?: string) => {
    setLoading(true);
    setError(null);
    const qs = threadId ? `?limit=200&threadId=${encodeURIComponent(threadId)}` : "?limit=200";
    fetch(`/api/agents/bus${qs}`, { credentials: "include" })
      .then((r) => r.json())
      .then((j: { ok?: boolean; data?: Report; error?: { userMessage?: string } }) => {
        if (j.ok && j.data) setReport(j.data);
        else setError(j.error?.userMessage ?? "Bus unavailable.");
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Network error."))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(thread || undefined); }, [thread, load]);

  return (
    <div className="relative">
      <div className="relative mb-8 rounded-3xl border border-white/[0.05] bg-gradient-to-br from-white/[0.025] via-white/[0.015] to-transparent p-6 md:p-8 overflow-hidden">
        <div className="flex items-center gap-2 mb-3 flex-wrap">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/[0.06] bg-white/[0.02] px-2.5 py-1">
            <ChatBubbleLeftRightIcon className="h-3.5 w-3.5 text-violet-300" />
            <span className="text-[10px] font-semibold uppercase tracking-widest text-violet-300">
              Agent Bus
            </span>
          </span>
          <button
            onClick={() => load(thread || undefined)}
            disabled={loading}
            className="ml-2 inline-flex items-center gap-1.5 text-[11px] font-mono px-2.5 py-1 rounded-full border bg-white/[0.02] text-zinc-300 border-white/[0.06] hover:text-white disabled:opacity-50"
          >
            <ArrowPathIcon className={`h-3 w-3 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </button>
        </div>
        <h1 className="text-4xl md:text-5xl font-bold text-white tracking-[-0.045em] leading-[1.05] mb-3">
          What our agents <span className="text-gradient">say to each other.</span>
        </h1>
        <p className="text-[15px] text-zinc-400 max-w-2xl leading-relaxed">
          Every typed inter-agent message is durably audited. Filter by thread to follow one decision through
          detect → reason → simulate → policy gate → approver → verifier → auditor.
        </p>

        <div className="mt-5 flex items-center gap-2 flex-wrap">
          <input
            value={thread}
            onChange={(e) => setThread(e.target.value)}
            placeholder="Filter by threadId…"
            className="flex-1 min-w-[260px] rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 text-[12px] font-mono text-white focus:border-violet-400/60 focus:outline-none"
          />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-amber-500/[0.18] bg-amber-500/[0.04] p-5 mb-6 text-[13px] text-zinc-300">
          {error}
        </div>
      )}

      {report && (
        report.messages.length === 0 ? (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-8 text-center text-[13px] text-zinc-400">
            No messages on the bus yet. Run an autonomy cycle (or wait for the */15 cron) to populate.
          </div>
        ) : (
          <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] divide-y divide-white/[0.04] overflow-hidden mb-8">
            {report.messages.map((m) => (
              <div key={m.id} className="px-3 py-2 hover:bg-white/[0.02]">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className={`text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border ${
                    SENDER_TONE[m.sender] ?? "bg-zinc-500/15 text-zinc-300 border-zinc-500/30"
                  }`}>{m.sender}</span>
                  <span className="text-[10px] font-mono text-zinc-500">→ {m.recipient ?? "all"}</span>
                  <span className="text-[9px] font-mono text-zinc-400 uppercase tracking-wider">{m.kind}</span>
                  {m.threadId && (
                    <button
                      onClick={() => setThread(m.threadId!)}
                      className="text-[10px] font-mono text-cyan-300 hover:text-cyan-200"
                      title="Filter to this thread"
                    >
                      thread:{m.threadId.slice(0, 8)}
                    </button>
                  )}
                  <span className="text-[10px] font-mono text-zinc-500 ml-auto">{new Date(m.publishedAt).toLocaleString()}</span>
                </div>
                <p className="text-[12px] text-white truncate">{m.summary}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
