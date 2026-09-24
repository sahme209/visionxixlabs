"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const CONTRACTS: ReadonlyArray<{ title: string; body: string; symbol: string }> = [
  {
    symbol: "✓",
    title: "approval_only_no_execution",
    body: "Every action becomes a packet for human review. Axiom never auto-applies, never auto-rolls-back. The IaC pipeline picks up approved rows through real change control.",
  },
  {
    symbol: "△",
    title: "Closed unions end-to-end",
    body: "Agent roles, message kinds, severities, trigger types — every dimension is a closed-union TypeScript type. Hallucinated values break the build, never reach prod.",
  },
  {
    symbol: "◊",
    title: "sha-256 rationale rows",
    body: "Every decision the council reaches is hash-stamped over a canonical-key-sorted JSON body. Auditors verify by recomputing the hash — no trust required.",
  },
  {
    symbol: "○",
    title: "Free AI providers only",
    body: "Nine providers in a deterministic fallback chain. No paid OpenAI / Anthropic dependency. Mock provider is always last so the platform never hard-fails on missing keys.",
  },
  {
    symbol: "▽",
    title: "Prompt-free + secret-free logging",
    body: "Usage logger records provider / model / latency / status — never prompts, never tokens, never response bodies. Safe to share with anyone in the org.",
  },
  {
    symbol: "◇",
    title: "Tiered boundary gate",
    body: "Six blast-radius classes (read_only → data_plane). data_plane + org_scoped require ALL approver roles (strict mode). One slip can't ship.",
  },
];

const COMPLIANCE: ReadonlyArray<{ tag: string; status: "live" | "in_progress" | "planned"; detail: string }> = [
  { tag: "SOC 2 Type II",       status: "in_progress", detail: "controls mapped, evidence stream live; auditor onboarding underway" },
  { tag: "GDPR Art-12 DSR",     status: "live",        detail: "DSR workflow tracker with 30/60-day deadlines + per-system status" },
  { tag: "Approval traceability", status: "live",     detail: "deterministic compliance packet with sha-256 integrity hash" },
  { tag: "Tenant data export",  status: "live",        detail: "GDPR-shaped tenant data export builder" },
  { tag: "HIPAA",               status: "planned",     detail: "data-plane boundary already strict-all-roles; BAA workflow on roadmap" },
  { tag: "ISO 27001",           status: "planned",     detail: "controls inventoried via the platform validation matrix" },
];

export function TrustClient() {
  const reduce = useReducedMotion();
  return (
    <div className="relative">
      {!reduce && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div className="ambient-drift absolute -top-1/4 right-1/4 h-[60vh] w-[50vw] rounded-full bg-brand-violet/[0.08] blur-[140px]" />
          <div className="ambient-drift absolute top-[15%] left-[5%] h-[50vh] w-[40vw] rounded-full bg-brand-coral/[0.06] blur-[130px]" style={{ animationDelay: "-8s" }} />
          <div className="ambient-drift absolute bottom-[5%] right-[10%] h-[40vh] w-[35vw] rounded-full bg-emerald-500/[0.05] blur-[120px]" style={{ animationDelay: "-14s" }} />
        </div>
      )}

      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-24 pb-12">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mono-label inline-flex items-center gap-3"
        >
          <span className="text-brand-coral/90 tabular-nums">TR</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Trust + safety
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display mt-5 text-4xl md:text-6xl font-bold leading-[1.04]"
        >
          The safety contract{" "}
          <span className="relative inline-block">
            is the product.
            <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[16px] text-zinc-400 leading-relaxed"
        >
          Axiom is an approval-only platform. Six guarantees keep the cockpit safe
          even when the agents disagree.
        </motion.p>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {CONTRACTS.map((c, i) => (
            <motion.div
              key={c.title}
              initial={{ opacity: 0, y: 18 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.5, delay: Math.min(i * 0.05, 0.3) }}
              whileHover={{ y: -3, transition: { duration: 0.2 } }}
              className="surface-glass rounded-2xl p-5 hover:border-brand-coral/25 transition-all"
            >
              <div className="text-2xl text-emerald-300 mb-2 font-mono">{c.symbol}</div>
              <p className="text-[14px] font-semibold text-white">{c.title}</p>
              <p className="mt-2 text-[12.5px] text-zinc-400 leading-relaxed">{c.body}</p>
            </motion.div>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 py-16">
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          className="text-2xl md:text-3xl font-bold tracking-[-0.02em]"
        >
          Compliance roster
        </motion.h2>
        <p className="mt-2 text-zinc-400 text-[14px]">
          Live status of the audit-frameworks Axiom maps to. No vendor-supplied stamps — every row links to evidence the cockpit produces.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          {COMPLIANCE.map((c) => {
            const tone =
              c.status === "live"
                ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200"
                : c.status === "in_progress"
                ? "border-amber-500/30 bg-amber-500/[0.06] text-amber-200"
                : "border-white/[0.06] bg-white/[0.02] text-zinc-400";
            return (
              <div key={c.tag} className={`rounded-2xl border p-4 ${tone}`}>
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-semibold">{c.tag}</span>
                  <span className="ml-auto text-[10px] font-mono uppercase tracking-wider opacity-80">
                    {c.status.replace("_", " ")}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] opacity-90 leading-snug">{c.detail}</p>
              </div>
            );
          })}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 py-20 text-center">
        <h2 className="text-2xl md:text-3xl font-bold tracking-[-0.02em]">
          Want the live evidence?
        </h2>
        <p className="mt-3 text-zinc-400">
          The compliance packet endpoint produces a deterministic, hash-stamped JSON document covering the last N days of platform activity.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <Link
            href="/status"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.02] px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/[0.06] transition"
          >
            Public status
          </Link>
          <Link
            href="/docs/audit-logs"
            className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-5 py-2.5 text-sm font-medium text-white shadow-[0_0_24px_rgba(52,211,153,0.45)] hover:bg-emerald-400 transition"
          >
            Generate a compliance packet →
          </Link>
        </div>
      </section>
    </div>
  );
}
