"use client";

/**
 * Embeddable team-cost ROI calculator. Operator picks which specialist
 * roles they would otherwise hire; we show annual savings vs Axiom's
 * (single) per-seat price. Pure client component — no fetch.
 */

import { motion } from "framer-motion";
import { useMemo, useState } from "react";

interface RoleRow {
  id: string;
  label: string;
  loadedAnnualUsd: number;
}

const ROLES: readonly RoleRow[] = [
  { id: "devops",   label: "Senior DevOps",          loadedAnnualUsd: 220_000 },
  { id: "sre",      label: "Senior SRE",             loadedAnnualUsd: 240_000 },
  { id: "sec",      label: "Senior security",        loadedAnnualUsd: 260_000 },
  { id: "platform", label: "Platform engineer",      loadedAnnualUsd: 230_000 },
  { id: "finops",   label: "FinOps analyst",         loadedAnnualUsd: 170_000 },
  { id: "data",     label: "Data engineer",          loadedAnnualUsd: 220_000 },
  { id: "ml",       label: "ML engineer",            loadedAnnualUsd: 260_000 },
  { id: "qa",       label: "QA lead",                loadedAnnualUsd: 180_000 },
  { id: "net",      label: "Network engineer",       loadedAnnualUsd: 200_000 },
  { id: "frontend", label: "Frontend engineer",      loadedAnnualUsd: 200_000 },
  { id: "mobile",   label: "Mobile engineer",        loadedAnnualUsd: 210_000 },
  { id: "iam",      label: "IAM / identity",         loadedAnnualUsd: 200_000 },
  { id: "obs",      label: "Observability",          loadedAnnualUsd: 230_000 },
  { id: "helpdesk", label: "IT helpdesk lead",       loadedAnnualUsd: 140_000 },
];

// illustrative — operators set their real plan separately.
const AXIOM_ANNUAL_USD: number = 120_000;

const usd = (n: number): string => `$${n.toLocaleString("en-US")}`;

export function RoiCalculatorClient() {
  const [picked, setPicked] = useState<Set<string>>(new Set(ROLES.slice(0, 6).map((r) => r.id)));
  const total = useMemo(
    () => ROLES.filter((r) => picked.has(r.id)).reduce((s, r) => s + r.loadedAnnualUsd, 0),
    [picked],
  );
  const savings = Math.max(0, total - AXIOM_ANNUAL_USD);
  const multiplier = AXIOM_ANNUAL_USD === 0 ? 0 : total / AXIOM_ANNUAL_USD;

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 24 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ duration: 0.7 }}
      className="rounded-3xl border border-white/[0.08] bg-white/[0.02] p-6 md:p-10"
    >
      <p className="text-[10px] font-mono uppercase tracking-widest text-indigo-300">
        ROI calculator · pick the roles you would hire
      </p>
      <h3 className="mt-3 text-2xl md:text-3xl font-bold tracking-[-0.025em]">
        How much does your team cost <span className="text-emerald-300">without</span> Axiom?
      </h3>

      <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-2">
        {ROLES.map((r) => {
          const on = picked.has(r.id);
          return (
            <button
              key={r.id}
              type="button"
              onClick={() => toggle(r.id)}
              aria-pressed={on}
              className={[
                "text-left rounded-lg border px-3 py-2 transition flex items-center justify-between",
                on
                  ? "border-indigo-500/40 bg-indigo-500/[0.08] text-white"
                  : "border-white/[0.06] bg-white/[0.02] text-zinc-400 hover:bg-white/[0.04]",
              ].join(" ")}
            >
              <span className="text-[13px]">{r.label}</span>
              <span className="text-[12px] font-mono tabular-nums opacity-80">{usd(r.loadedAnnualUsd)}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="surface-glass rounded-2xl p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Team loaded cost</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{usd(total)}</p>
        </div>
        <div className="surface-glass rounded-2xl p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">Axiom annual (illustrative)</p>
          <p className="mt-2 text-3xl font-bold tabular-nums">{usd(AXIOM_ANNUAL_USD)}</p>
        </div>
        <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.06] p-5">
          <p className="text-[10px] font-mono uppercase tracking-widest text-emerald-300">Annual savings</p>
          <p className="mt-2 text-3xl font-bold tabular-nums text-emerald-200">{usd(savings)}</p>
          <p className="mt-1 text-[11px] font-mono text-emerald-300/80">
            {multiplier > 0 ? `${multiplier.toFixed(1)}× of Axiom annual` : ""}
          </p>
        </div>
      </div>

      <p className="mt-6 text-[12px] text-zinc-500 leading-relaxed">
        Salary numbers are US-market loaded annual estimates (base + benefits + tooling). The Axiom
        figure shown is illustrative — your actual contract is per workspace + tier. Approval-only-
        no-execution: Axiom never applies changes; the human review queue is what scales.
      </p>
    </motion.div>
  );
}
