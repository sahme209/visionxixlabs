"use client";

import { motion } from "framer-motion";
import Link from "next/link";
import { PageHero } from "@/components/marketing/PageHero";

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
  return (
    <div className="public-detail-page public-trust-page">
      <section className="public-detail-header">
        <PageHero eyebrow="Axiom · Trust and safety" title="The safety contract" muted="is the product." lead="These are implemented product controls and explicit limitations—not certification badges. Each control still depends on configuration, permissions, and verification of the exact workflow being used." />
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
                ? "border-emerald-500/30 bg-emerald-500/6 text-emerald-200"
                : c.status === "unverified"
                ? "border-white/30 bg-white/6 text-zinc-200"
                : "border-white/6 bg-white/2 text-zinc-400";
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
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/2 px-5 py-2.5 text-sm text-zinc-300 hover:bg-white/6 transition"
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
