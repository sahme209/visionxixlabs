"use client";

/**
 * /compare — head-to-head coverage matrix.
 *
 * Three tabs reflecting the three buyer alternatives an operator
 * actually weighs: hire the team, glue point AI tools, or stitch
 * a SaaS stack. Each row is a capability and each column is a
 * verdict from a closed union: full | partial | none. Verdicts
 * stay opinionated but defensible — if a row would need
 * hand-waving, leave it off the page.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { useState } from "react";

type Verdict = "full" | "partial" | "none";

interface Row {
  capability: string;
  axiom: Verdict;
  rival: Verdict;
  note?: string;
}

interface CompareTab {
  id: "team" | "ai_tools" | "saas_stack";
  label: string;
  rivalLabel: string;
  tagline: string;
  rows: readonly Row[];
}

const TABS: readonly CompareTab[] = [
  {
    id: "team",
    label: "vs hiring the team",
    rivalLabel: "26-person team",
    tagline:
      "Hiring the disciplines on /disciplines yourself, fully loaded with benefits and equity.",
    rows: [
      { capability: "Annual fully-loaded cost",          axiom: "full", rival: "none",    note: "~$2.96M/year for the team, single fixed contract for Axiom." },
      { capability: "Time to first proposal",            axiom: "full", rival: "none",    note: "Hours after wiring credentials vs. months of hiring + ramp." },
      { capability: "Attrition risk on critical paths",  axiom: "full", rival: "none" },
      { capability: "24/7 coverage across surfaces",     axiom: "full", rival: "partial" },
      { capability: "Domain depth (security, FinOps…)",  axiom: "full", rival: "full",    note: "Humans win on edge cases; Axiom wins on consistency + 100% recall." },
      { capability: "Provenance + sha-256 audit rows",   axiom: "full", rival: "partial" },
      { capability: "Approval-only-no-execution gate",   axiom: "full", rival: "partial", note: "Humans approve their own work without a forcing function." },
      { capability: "Onboarding cost for net-new hires", axiom: "full", rival: "none" },
    ],
  },
  {
    id: "ai_tools",
    label: "vs point AI tools",
    rivalLabel: "Cursor / Cline / Copilot",
    tagline:
      "Editor-resident copilots that pair with a developer. Axiom is an operator surface that pairs with your whole company.",
    rows: [
      { capability: "Writes + reviews production code",       axiom: "full", rival: "full" },
      { capability: "Reads cloud telemetry directly",         axiom: "full", rival: "none" },
      { capability: "Forms hypotheses about prod incidents",  axiom: "full", rival: "none" },
      { capability: "Sandboxed simulation before action",     axiom: "full", rival: "none" },
      { capability: "Council voting · ⅔ consensus default",   axiom: "full", rival: "none" },
      { capability: "Approval packets across surfaces",       axiom: "full", rival: "none" },
      { capability: "Closed-union verdicts (no any-types)",   axiom: "full", rival: "partial" },
      { capability: "Durable rationale + replayable audit",   axiom: "full", rival: "none" },
      { capability: "Pairs cleanly inside an IDE",            axiom: "partial", rival: "full",  note: "Axiom is a cockpit, not a code editor. Use both." },
    ],
  },
  {
    id: "saas_stack",
    label: "vs SaaS stack",
    rivalLabel: "Datadog + PagerDuty + Snyk + Vanta + Linear + …",
    tagline:
      "Six to ten point tools, each with its own bill, glue scripts, and dashboard. Axiom replaces the seams.",
    rows: [
      { capability: "Single bill, single contract",            axiom: "full", rival: "none" },
      { capability: "Unified blast-radius classifier",         axiom: "full", rival: "none" },
      { capability: "Cross-tool causal timeline",              axiom: "full", rival: "partial" },
      { capability: "SOC 2 + GDPR + HIPAA + ISO evidence",     axiom: "full", rival: "partial", note: "Stack has the data; assembly is on the operator." },
      { capability: "Closed-loop autonomous remediation",      axiom: "full", rival: "none" },
      { capability: "Council + approval gate across surfaces", axiom: "full", rival: "none" },
      { capability: "AI-routed free-tier provider fallback",   axiom: "full", rival: "none" },
      { capability: "Best-in-class APM dashboards",            axiom: "partial", rival: "full",  note: "Datadog dashboards are still gorgeous. Axiom focuses on the verdict, not the dashboard." },
    ],
  },
];

const VERDICT_STYLE: Record<Verdict, { icon: string; tone: string; label: string }> = {
  full:    { icon: "✓", tone: "text-emerald-300 bg-emerald-500/10 border-emerald-500/30", label: "covered" },
  partial: { icon: "~", tone: "text-amber-300  bg-amber-500/10  border-amber-500/30",  label: "partial" },
  none:    { icon: "·", tone: "text-zinc-500   bg-white/[0.02] border-white/10",       label: "missing" },
};

export function CompareClient() {
  const [tab, setTab] = useState<CompareTab["id"]>("team");
  const active = TABS.find((t) => t.id === tab) ?? TABS[0];

  return (
    <div className="relative">
      {/* Huly aurora — coral × violet × cyan */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="ambient-drift absolute -top-1/4 left-1/3 h-[60vh] w-[50vw] rounded-full bg-brand-violet/[0.08] blur-[140px]" />
        <div className="ambient-drift absolute top-[15%] right-[5%] h-[50vh] w-[40vw] rounded-full bg-brand-coral/[0.06] blur-[130px]" style={{ animationDelay: "-8s" }} />
        <div className="ambient-drift absolute bottom-0 right-1/4 h-[45vh] w-[35vw] rounded-full bg-cyan-500/[0.05] blur-[120px]" style={{ animationDelay: "-14s" }} />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 md:px-10 pt-24 pb-8">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mono-label inline-flex items-center gap-3"
        >
          <span className="text-brand-coral/90 tabular-nums">CM</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Buyer-honest comparison
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display mt-5 text-4xl md:text-6xl font-bold leading-[1.04]"
        >
          Compare —{" "}
          <span className="relative inline-block">
            three alternatives, side by side.
            <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-[88%] rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[15px] text-zinc-400 leading-relaxed"
        >
          Every row below is a capability a buyer asks about within the first
          thirty minutes. Where the alternative wins, we say so — Axiom is a
          cockpit, not a religion.
        </motion.p>
      </section>

      {/* ===== TABS ===== */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 md:px-10 pb-6">
        <div className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={[
                "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition border",
                tab === t.id
                  ? "bg-cyan-500/15 border-cyan-500/40 text-cyan-200"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.05]",
              ].join(" ")}
            >
              {t.label}
            </button>
          ))}
        </div>
        <p className="mt-4 text-[13px] text-zinc-500 max-w-2xl leading-relaxed">{active.tagline}</p>
      </section>

      {/* ===== MATRIX ===== */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 md:px-10 pb-12">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="surface-glass overflow-hidden rounded-2xl"
        >
          {/* header */}
          <div className="grid grid-cols-[1fr_110px_110px] md:grid-cols-[1fr_140px_140px] border-b border-white/[0.06] bg-white/[0.02] px-4 py-3 text-[11px] font-mono uppercase tracking-widest text-zinc-400">
            <span>Capability</span>
            <span className="text-center text-indigo-300">Axiom</span>
            <span className="text-center text-zinc-300">{active.rivalLabel}</span>
          </div>
          {/* rows */}
          {active.rows.map((row, i) => (
            <motion.div
              key={row.capability}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: Math.min(i * 0.025, 0.2) }}
              className="grid grid-cols-[1fr_110px_110px] md:grid-cols-[1fr_140px_140px] items-start gap-3 border-b border-white/[0.04] px-4 py-3 last:border-b-0 hover:bg-white/[0.02] transition"
            >
              <div>
                <p className="text-[13.5px] text-white">{row.capability}</p>
                {row.note ? (
                  <p className="mt-1 text-[11.5px] text-zinc-500 leading-snug">{row.note}</p>
                ) : null}
              </div>
              <Cell verdict={row.axiom} />
              <Cell verdict={row.rival} />
            </motion.div>
          ))}
        </motion.div>
      </section>

      {/* ===== LEGEND ===== */}
      <section className="relative z-10 mx-auto max-w-5xl px-6 md:px-10 pb-12">
        <div className="flex flex-wrap gap-3 text-[11px] text-zinc-400">
          {(Object.keys(VERDICT_STYLE) as Verdict[]).map((v) => (
            <span key={v} className={["inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1", VERDICT_STYLE[v].tone].join(" ")}>
              <span className="font-mono">{VERDICT_STYLE[v].icon}</span>
              <span className="font-mono uppercase tracking-widest text-[10px]">{VERDICT_STYLE[v].label}</span>
            </span>
          ))}
        </div>
      </section>

      {/* ===== CLOSER ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 py-16 text-center">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          Comparing on dashboards alone misses the point.
        </h3>
        <p className="mt-3 text-zinc-400 text-[14px]">
          The cockpit ships approval packets across every surface above, with
          sha-256 rationale rows for every action. That's the line the
          alternatives won't cross.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/plans"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition"
          >
            See plans
          </Link>
          <Link
            href="/faq"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
          >
            Read the FAQ
          </Link>
        </div>
      </section>
    </div>
  );
}

function Cell({ verdict }: { verdict: Verdict }) {
  const style = VERDICT_STYLE[verdict];
  return (
    <div className="flex justify-center">
      <span
        title={style.label}
        className={["inline-flex h-7 w-7 items-center justify-center rounded-full border text-[13px] font-mono", style.tone].join(" ")}
      >
        {style.icon}
      </span>
    </div>
  );
}
