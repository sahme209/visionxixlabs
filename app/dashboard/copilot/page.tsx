"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRightIcon,
  CpuChipIcon,
  ShieldCheckIcon,
  SparklesIcon,
  PaperAirplaneIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Reveal } from "@/components/motion/Reveal";
import { Stagger } from "@/components/motion/Stagger";

// Local mirror of the API response shape (avoids forcing the page into 'use server').
interface CopilotResponse {
  summary: string;
  evidence: { source: string; detail: string }[];
  recommendedActions: { label: string; href: string }[];
  risk?: "low" | "medium" | "high";
  safety?: string[];
  relatedDocs?: { label: string; href: string }[];
  confidence: number;
  source: "typed_state" | "diagnose" | "fallback";
  safetyFlags?: string[];
  safetyNotes?: string[];
}

const SUGGESTED_QUESTIONS: { intent: string; label: string; icon: typeof CpuChipIcon }[] = [
  { intent: "next_best_action", label: "What should I do next?", icon: SparklesIcon },
  { intent: "explain_state", label: "What's the current platform state?", icon: CpuChipIcon },
  { intent: "explain_policy", label: "Why is approval required?", icon: ShieldCheckIcon },
  { intent: "explain_release", label: "What's blocking my releases?", icon: ExclamationTriangleIcon },
  { intent: "explain_desktop", label: "What can the desktop agent do?", icon: CheckCircleIcon },
  { intent: "general_help", label: "How do I connect AWS securely?", icon: CheckCircleIcon },
];

interface Turn {
  id: string;
  role: "user" | "copilot";
  text: string;
  response?: CopilotResponse;
  timestamp: string;
}

export default function CopilotPage() {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);

  async function ask(intent: string, question: string) {
    if (!question.trim()) return;
    const userTurn: Turn = {
      id: `turn_${Date.now()}_u`,
      role: "user",
      text: question,
      timestamp: new Date().toISOString(),
    };
    setTurns((t) => [...t, userTurn]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/copilot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ intent, question }),
      });
      if (!res.ok) throw new Error("Copilot request failed");
      const data = (await res.json()) as CopilotResponse;
      setTurns((t) => [
        ...t,
        {
          id: `turn_${Date.now()}_c`,
          role: "copilot",
          text: data.summary,
          response: data,
          timestamp: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setTurns((t) => [
        ...t,
        {
          id: `turn_${Date.now()}_c`,
          role: "copilot",
          text: `Couldn't reach the copilot endpoint: ${err instanceof Error ? err.message : "unknown error"}. Sign in if you haven't, then retry.`,
          response: undefined,
          timestamp: new Date().toISOString(),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      {/* Hero */}
      <Reveal direction="up" blur>
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <SparklesIcon className="h-4 w-4 text-zinc-500" />
            <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">
              AI Operations Copilot
            </p>
            <span className="text-[9px] font-semibold text-emerald-400 bg-emerald-500/15 border border-emerald-500/30 rounded-full px-2 py-0.5 uppercase tracking-wider">
              Governance-aware · Tenant-isolated
            </span>
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white tracking-[-0.04em] mb-2">
            Ask Axiom <span className="text-gradient">anything operational.</span>
          </h1>
          <p className="text-dim-paragraph text-base max-w-3xl leading-relaxed">
            Every answer is composed from typed platform state — no hidden chain-of-thought. <span className="dim-1">The copilot respects autonomy levels, never bypasses approval, and surfaces evidence + doc links inline.</span>
          </p>
        </div>
      </Reveal>

      {/* Two-pane: chat on left, suggestions/context on right */}
      <div className="grid lg:grid-cols-3 gap-5">
        {/* Conversation */}
        <div className="lg:col-span-2 flex flex-col">
          <Reveal direction="up" delay={0.05}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] flex flex-col" style={{ minHeight: "60vh" }}>
              <div className="px-6 py-4 border-b border-white/[0.06] bg-white/[0.01] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-sm font-semibold text-white">Operations Copilot</span>
                </div>
                <span className="text-[10px] text-zinc-600 font-mono uppercase tracking-wider">Typed-state composer</span>
              </div>

              {/* Conversation body */}
              <div className="flex-1 px-6 py-5 space-y-4 overflow-y-auto">
                {turns.length === 0 && (
                  <div className="text-center py-10">
                    <SparklesIcon className="h-8 w-8 text-zinc-500 mx-auto mb-3 opacity-60" />
                    <p className="text-sm font-semibold text-white mb-1">Start with a suggested question.</p>
                    <p className="text-xs text-zinc-500">Or type a free-form question below.</p>
                  </div>
                )}
                {turns.map((t) => (
                  <TurnView key={t.id} turn={t} />
                ))}
                {loading && (
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <ArrowPathIcon className="h-3 w-3 animate-spin" />
                    Composing answer from typed state…
                  </div>
                )}
              </div>

              {/* Input row */}
              <div className="px-6 py-4 border-t border-white/[0.06] bg-white/[0.01]">
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    ask("general_help", input);
                  }}
                  className="flex gap-2 items-stretch"
                >
                  <input
                    type="text"
                    aria-label="Ask the copilot about scans, approvals, releases, desktop, or governance"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Ask about scans, approvals, releases, desktop, governance…"
                    className="flex-1 rounded-full bg-white/[0.04] border border-white/[0.08] px-4 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:outline-none focus:border-violet-500/40 focus:ring-2 focus:ring-violet-500/20"
                  />
                  <button
                    type="submit"
                    disabled={!input.trim() || loading}
                    className={`btn-amber-shimmer inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-xs font-semibold uppercase tracking-wider ${(!input.trim() || loading) ? "opacity-40 cursor-not-allowed" : ""}`}
                  >
                    <PaperAirplaneIcon className="h-3.5 w-3.5" />
                    Send
                  </button>
                </form>
              </div>
            </div>
          </Reveal>
        </div>

        {/* Right sidebar — suggested questions + safety */}
        <div className="space-y-5">
          <Reveal direction="up" delay={0.1}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] overflow-hidden">
              <div className="px-5 py-3 border-b border-white/[0.06] bg-white/[0.01]">
                <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest">Suggested questions</p>
              </div>
              <div className="p-2 space-y-1">
                {SUGGESTED_QUESTIONS.map((q) => {
                  const Icon = q.icon;
                  return (
                    <button
                      key={q.label}
                      onClick={() => ask(q.intent, q.label)}
                      className="w-full text-left rounded-lg px-3 py-2 hover:bg-white/[0.04] transition-colors group flex items-center gap-2.5"
                    >
                      <Icon className="h-3.5 w-3.5 text-zinc-500 shrink-0" />
                      <span className="text-xs text-zinc-300 group-hover:text-white transition-colors leading-snug">{q.label}</span>
                      <ArrowRightIcon className="h-3 w-3 text-zinc-700 ml-auto group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all shrink-0" />
                    </button>
                  );
                })}
              </div>
            </div>
          </Reveal>

          <Reveal direction="up" delay={0.14}>
            <div className="rounded-2xl border border-emerald-500/15 bg-emerald-500/[0.03] p-4">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheckIcon className="h-4 w-4 text-emerald-400" />
                <p className="text-[10px] font-semibold text-emerald-400 uppercase tracking-widest">Safety guarantees</p>
              </div>
              <ul className="space-y-1.5 text-[11px] text-zinc-300 leading-snug">
                {[
                  "Answers composed from typed state — no hidden chain-of-thought",
                  "Approval / rollback / autonomy caveats appended automatically",
                  "Forbidden phrases redacted",
                  "Tenant isolation enforced server-side",
                  "Never claims preview features are live",
                  "Contact CTAs only as fallback",
                ].map((line) => (
                  <li key={line} className="flex items-start gap-1.5">
                    <CheckCircleIcon className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{line}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Reveal>

          <Reveal direction="up" delay={0.18}>
            <div className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[10px] font-semibold text-zinc-500 uppercase tracking-widest mb-3">Learn how the copilot works</p>
              <div className="space-y-1">
                {[
                  { href: "/docs/approval-workflow", label: "Approval workflow" },
                  { href: "/docs/security-model", label: "Security model" },
                  { href: "/docs/permissions-model", label: "Permissions model" },
                  { href: "/docs/architecture", label: "Architecture overview" },
                ].map((doc) => (
                  <Link
                    key={doc.href}
                    href={doc.href}
                    className="flex items-center justify-between rounded-lg px-3 py-1.5 hover:bg-white/[0.04] transition-colors group"
                  >
                    <span className="text-[11px] text-zinc-400 group-hover:text-white transition-colors">{doc.label}</span>
                    <ArrowRightIcon className="h-3 w-3 text-zinc-700 group-hover:text-zinc-400 group-hover:translate-x-0.5 transition-all" />
                  </Link>
                ))}
              </div>
            </div>
          </Reveal>
        </div>
      </div>
    </div>
  );
}

function TurnView({ turn }: { turn: Turn }) {
  if (turn.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="rounded-2xl bg-violet-500/10 border border-white/[0.08] px-4 py-2.5 text-sm text-white max-w-[80%]">
          {turn.text}
        </div>
      </div>
    );
  }
  const res = turn.response;
  return (
    <div className="flex justify-start">
      <div className="rounded-2xl bg-white/[0.03] border border-white/[0.06] px-4 py-3 max-w-[90%] w-full">
        <p className="text-sm text-zinc-200 leading-relaxed mb-3">{turn.text}</p>
        {res && (
          <>
            {/* Evidence chips */}
            {res.evidence.length > 0 && (
              <div className="flex flex-wrap gap-1 mb-3">
                {res.evidence.map((e) => (
                  <span key={`${e.source}-${e.detail}`} className="inline-flex items-center gap-1 text-[10px] text-zinc-400 bg-white/[0.04] border border-white/[0.06] rounded-full px-2 py-0.5 font-mono">
                    <span className="text-zinc-600">{e.source}:</span>
                    {e.detail}
                  </span>
                ))}
              </div>
            )}

            {/* Risk + confidence pill row */}
            <div className="flex items-center gap-2 flex-wrap mb-3 text-[10px] font-semibold uppercase tracking-wider">
              <span className="text-zinc-500">confidence</span>
              <span className={`${res.confidence >= 0.8 ? "text-emerald-400" : res.confidence >= 0.6 ? "text-amber-400" : "text-red-400"}`}>{Math.round(res.confidence * 100)}%</span>
              {res.risk && (
                <>
                  <span className="text-zinc-700">·</span>
                  <span className="text-zinc-500">risk</span>
                  <span className={`${res.risk === "high" ? "text-red-400" : res.risk === "medium" ? "text-amber-400" : "text-emerald-400"}`}>{res.risk}</span>
                </>
              )}
              <span className="text-zinc-700">·</span>
              <span className="text-zinc-500">source</span>
              <span className="text-zinc-400">{res.source.replace(/_/g, " ")}</span>
            </div>

            {/* Recommended actions */}
            {res.recommendedActions.length > 0 && (
              <div className="flex flex-wrap gap-2 mb-2">
                {res.recommendedActions.map((a) => (
                  <Link
                    key={a.href}
                    href={a.href}
                    className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold text-violet-300 bg-violet-500/10 border border-white/[0.08] hover:bg-violet-500/20 hover:border-white/[0.12] transition-colors"
                  >
                    {a.label}
                    <ArrowRightIcon className="h-3 w-3" />
                  </Link>
                ))}
              </div>
            )}

            {/* Safety caveats */}
            {res.safety && res.safety.length > 0 && (
              <div className="rounded-lg bg-amber-500/[0.04] border border-amber-500/15 px-3 py-2 mb-2">
                {res.safety.map((s) => (
                  <p key={s} className="text-[11px] text-amber-300 leading-snug">⚠ {s}</p>
                ))}
              </div>
            )}

            {/* Related docs */}
            {res.relatedDocs && res.relatedDocs.length > 0 && (
              <div className="flex flex-wrap gap-x-3 gap-y-1 text-[10px] pt-2 border-t border-white/[0.04]">
                {res.relatedDocs.map((d) => (
                  <Link key={d.href} href={d.href} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                    {d.label} →
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
