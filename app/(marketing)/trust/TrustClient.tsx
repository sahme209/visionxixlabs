"use client";

import { motion, useReducedMotion } from "framer-motion";
import Link from "next/link";

const CONTRACTS: ReadonlyArray<{ title: string; body: string; symbol: string }> = [
  {
    symbol: "✓",
    title: "Approval is not execution",
    body: "The product model keeps review, approval, merge, workflow dispatch, environment approval, and change management distinct. Current desktop builds keep local infrastructure apply disabled.",
  },
  {
    symbol: "△",
    title: "Typed workflow states",
    body: "Core roles, workflow states, severities, and trigger kinds use closed-union types so unknown values are rejected by application validation.",
  },
  {
    symbol: "◊",
    title: "Attributable evidence",
    body: "Supported workflows preserve actor, action, rationale, timestamp, and outcome records. Hash utilities exist, but export and integrity coverage remain workflow-specific.",
  },
  {
    symbol: "○",
    title: "Human-confirmed AI output",
    body: "AI output is guidance until a person confirms it. Uncertainty and unavailable providers must stay visible rather than falling back to simulated production success.",
  },
  {
    symbol: "▽",
    title: "Secret-aware handling",
    body: "Redaction utilities protect supported input and logging paths. This does not make every record safe to share; operators must still apply tenant and data-classification policy.",
  },
  {
    symbol: "◇",
    title: "Bounded planning kernel",
    body: "The orchestration kernel splits oversized resource groups and rejects steps outside configured limits. Enforcement against a released live cloud mutation path is not yet verified.",
  },
];

const COMPLIANCE: ReadonlyArray<{ tag: string; status: "implemented" | "unverified" | "not_certified"; detail: string }> = [
  { tag: "Approval traceability", status: "implemented", detail: "Actor, decision, and outcome models exist in supported workflows; end-to-end export coverage varies." },
  { tag: "Secret redaction", status: "implemented", detail: "Application utilities redact supported secret patterns before selected storage and notification paths." },
  { tag: "Tenant isolation", status: "unverified", detail: "Organization identifiers and access checks exist; every service and restore path still needs deployment-specific verification." },
  { tag: "Retention + deletion", status: "unverified", detail: "Requirements are tracked, but consistent customer-configurable retention and deletion are not verified across every store." },
  { tag: "SOC 2 / ISO 27001", status: "not_certified", detail: "No independent certification or active audit is claimed." },
  { tag: "Customer compliance", status: "not_certified", detail: "Product controls can support a customer program; they do not make a customer compliant automatically." },
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
          These are implemented product controls and explicit limitations—not certification badges. Each control still depends on configuration, permissions, and verification of the exact workflow being used.
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
          Control and assurance status
        </motion.h2>
        <p className="mt-2 text-zinc-400 text-[14px]">
          Product controls are separate from independent certifications and from each customer&apos;s own legal and compliance obligations.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-3">
          {COMPLIANCE.map((c) => {
            const tone =
              c.status === "implemented"
                ? "border-emerald-500/30 bg-emerald-500/[0.06] text-emerald-200"
                : c.status === "unverified"
                ? "border-white/30 bg-white/[0.06] text-zinc-200"
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
          Review the evidence model.
        </h2>
        <p className="mt-3 text-zinc-400">
          The documentation describes the audit records the application is designed to preserve, along with workflow-specific limitations.
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
            Read audit documentation →
          </Link>
        </div>
      </section>
    </div>
  );
}
