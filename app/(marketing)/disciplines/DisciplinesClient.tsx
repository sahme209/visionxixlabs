"use client";

/**
 * /disciplines — operator-facing inventory of every role Axiom covers.
 *
 * Each card is a discipline that an enterprise would normally fill with a
 * dedicated engineer or team. The `kernel` link points to the actual module
 * in the cockpit that implements that role, so the page doubles as proof
 * rather than marketing slogan.
 *
 * Selling angle: this is the million-dollar team in one platform.
 */

import { motion } from "framer-motion";
import Link from "next/link";
import { useMemo, useState } from "react";

interface Discipline {
  name: string;
  category:
    | "engineering"
    | "platform"
    | "security_compliance"
    | "data_ai"
    | "ops_sre"
    | "support_growth";
  marketRate: string;       // e.g. "$220k+"
  scope: string;
  evidence: string;         // route in the cockpit that proves it
  evidenceLabel: string;
}

const DISCIPLINES: readonly Discipline[] = [
  // engineering
  { name: "Backend Engineer",        category: "engineering", marketRate: "$210k+", scope: "API design, service contracts, request routing.",                 evidence: "/dashboard/agent-bus",            evidenceLabel: "agent bus + typed contracts" },
  { name: "Frontend Engineer",       category: "engineering", marketRate: "$200k+", scope: "Operator UI, accessibility, design system.",                       evidence: "/dashboard/command-center",       evidenceLabel: "command center" },
  { name: "Mobile Engineer (iOS)",   category: "engineering", marketRate: "$220k+", scope: "Swift surface, biometric auth, APNS push payloads.",              evidence: "/platforms",                       evidenceLabel: "platforms · mobile" },
  { name: "Mobile Engineer (Android)", category: "engineering", marketRate: "$215k+", scope: "Kotlin surface, FCM push, offline queue conflicts.",            evidence: "/platforms",                       evidenceLabel: "platforms · mobile" },
  { name: "Desktop Engineer",        category: "engineering", marketRate: "$200k+", scope: "macOS / Windows / Linux shells, tray state, keychain.",          evidence: "/dashboard/desktop",              evidenceLabel: "desktop companion" },
  { name: "Build / CI Engineer",     category: "engineering", marketRate: "$195k+", scope: "Pipelines, gating, deploy windows, freeze policies.",            evidence: "/dashboard/cicd",                 evidenceLabel: "CI/CD cockpit" },

  // platform / infra
  { name: "Cloud Architect",         category: "platform",    marketRate: "$260k+", scope: "Multi-cloud topology, account boundaries, blast-radius rules.", evidence: "/dashboard/cloud-inventory",      evidenceLabel: "cloud inventory" },
  { name: "AWS Specialist",          category: "platform",    marketRate: "$220k+", scope: "AWS service coverage, CloudTrail forensics, IAM least-priv.",   evidence: "/dashboard/aws",                  evidenceLabel: "AWS cockpit" },
  { name: "Azure Specialist",        category: "platform",    marketRate: "$220k+", scope: "Azure tenant policy + activity log alignment.",                 evidence: "/dashboard/azure",                evidenceLabel: "Azure cockpit" },
  { name: "Kubernetes / Containers", category: "platform",    marketRate: "$225k+", scope: "Workload topology, control-plane drift, ingress map.",          evidence: "/dashboard/containers",           evidenceLabel: "containers" },
  { name: "FinOps Analyst",          category: "platform",    marketRate: "$190k+", scope: "Spend attribution, anomaly detection, savings plans.",          evidence: "/dashboard/cost-overview",        evidenceLabel: "cost overview" },

  // security + compliance
  { name: "Security Engineer",       category: "security_compliance", marketRate: "$240k+", scope: "Threat model, prompt-injection defenses, secret hygiene.",   evidence: "/dashboard/cloud-security",      evidenceLabel: "cloud security" },
  { name: "IAM Specialist",          category: "security_compliance", marketRate: "$215k+", scope: "Role-binding drift, blast-radius tiering, escalation paths.", evidence: "/dashboard/admin-charters",     evidenceLabel: "tenant charters" },
  { name: "Compliance Officer",      category: "security_compliance", marketRate: "$200k+", scope: "SOC 2 + GDPR + HIPAA + ISO evidence packets.",              evidence: "/dashboard/compliance-packet",   evidenceLabel: "compliance packet" },
  { name: "Auditor",                 category: "security_compliance", marketRate: "$190k+", scope: "sha-256 rationale rows, hash recomputation, durable rows.", evidence: "/dashboard/audit",               evidenceLabel: "audit log" },

  // data + AI
  { name: "ML Engineer",             category: "data_ai", marketRate: "$245k+", scope: "Prompt + provider routing, free-tier failover, mock fallback.", evidence: "/dashboard/ai-settings",       evidenceLabel: "AI settings" },
  { name: "AI Researcher",           category: "data_ai", marketRate: "$260k+", scope: "Council weighting, hypothesis quality, drift inspection.",     evidence: "/dashboard/agi",                evidenceLabel: "AGI cockpit" },
  { name: "Data Engineer",           category: "data_ai", marketRate: "$210k+", scope: "Telemetry → typed events → durable rows.",                     evidence: "/dashboard/observability",      evidenceLabel: "observability (if surfaced)" },
  { name: "Analytics Engineer",      category: "data_ai", marketRate: "$185k+", scope: "Heatmaps, council decisions, cost explainer.",                 evidence: "/dashboard/decision-heatmap",   evidenceLabel: "decision heatmap" },

  // ops / SRE
  { name: "SRE / On-call",           category: "ops_sre", marketRate: "$225k+", scope: "Status, error budgets, paging, post-mortems.",                evidence: "/status",                       evidenceLabel: "/status" },
  { name: "Incident Commander",      category: "ops_sre", marketRate: "$220k+", scope: "Approval-packet staging, rollback proposals.",                evidence: "/dashboard/approvals",          evidenceLabel: "approvals" },
  { name: "Automation Engineer",     category: "ops_sre", marketRate: "$200k+", scope: "Cron health, boundary tiers, autonomy limits.",               evidence: "/dashboard/autonomous-ops",     evidenceLabel: "autonomous ops" },
  { name: "Release Manager",         category: "ops_sre", marketRate: "$195k+", scope: "Feature flags, deploy windows, freeze enforcement.",          evidence: "/dashboard/cicd",               evidenceLabel: "CI/CD cockpit" },

  // support + growth
  { name: "Solutions Engineer",      category: "support_growth", marketRate: "$210k+", scope: "Operator onboarding, demos, tenant charter setup.", evidence: "/operator/onboarding",       evidenceLabel: "operator onboarding" },
  { name: "Customer Success",        category: "support_growth", marketRate: "$170k+", scope: "Trial → growth conversion, billing, plan health.", evidence: "/dashboard/billing",         evidenceLabel: "billing cockpit" },
  { name: "Growth / Marketing Eng",  category: "support_growth", marketRate: "$180k+", scope: "Marketing surface, Web Vitals, conversion paths.",  evidence: "/team-of-one",                evidenceLabel: "marketing landing" },
];

const CATEGORIES: ReadonlyArray<{ id: Discipline["category"] | "all"; label: string }> = [
  { id: "all",                  label: "All disciplines" },
  { id: "engineering",          label: "Engineering" },
  { id: "platform",             label: "Platform / Cloud" },
  { id: "security_compliance",  label: "Security + Compliance" },
  { id: "data_ai",              label: "Data + AI" },
  { id: "ops_sre",              label: "Ops / SRE" },
  { id: "support_growth",       label: "Support + Growth" },
];

// Rough market salary table, USD, fully-loaded with benefits and equity.
// Used to compute the "team you would otherwise hire" headline.
function parseRate(rate: string): number {
  const digits = rate.replace(/[^\d]/g, "");
  return digits ? Number(digits) * 1000 : 0;
}

export function DisciplinesClient() {
  const [filter, setFilter] = useState<Discipline["category"] | "all">("all");

  const visible = useMemo(
    () => (filter === "all" ? DISCIPLINES : DISCIPLINES.filter((d) => d.category === filter)),
    [filter],
  );

  const totalAnnual = useMemo(
    () => DISCIPLINES.reduce((acc, d) => acc + parseRate(d.marketRate), 0),
    [],
  );

  return (
    <div className="relative">
      {/* Ambient aurora */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-50">
        <div className="absolute -top-1/4 right-1/4 h-[70vh] w-[60vw] rounded-full bg-gradient-to-br from-fuchsia-500/15 via-indigo-500/8 to-transparent blur-3xl" />
        <div className="absolute bottom-0 left-1/4 h-[50vh] w-[40vw] rounded-full bg-gradient-to-tr from-emerald-500/10 to-transparent blur-3xl" />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pt-20 pb-10">
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[10px] font-mono uppercase tracking-widest text-fuchsia-300"
        >
          the team you would otherwise hire
        </motion.span>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="mt-5 text-4xl md:text-6xl font-bold tracking-[-0.04em] leading-[1.05]"
        >
          {DISCIPLINES.length} disciplines.{" "}
          <span className="bg-gradient-to-r from-fuchsia-300 to-indigo-300 bg-clip-text text-transparent">
            One platform.
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[16px] text-zinc-400 leading-relaxed"
        >
          Hiring this team yourself would cost roughly{" "}
          <span className="font-semibold text-white">
            ${(totalAnnual / 1_000_000).toFixed(1)}M
          </span>{" "}
          per year, fully loaded. Every card below links to the kernel module that
          covers that role today — not a roadmap promise.
        </motion.p>
      </section>

      {/* ===== FILTER PILLS ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-6">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setFilter(c.id)}
              className={[
                "rounded-full px-3.5 py-1.5 text-[12px] font-medium transition border",
                filter === c.id
                  ? "bg-fuchsia-500/15 border-fuchsia-500/40 text-fuchsia-200"
                  : "bg-white/[0.02] border-white/[0.06] text-zinc-400 hover:text-white hover:bg-white/[0.05]",
              ].join(" ")}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* ===== DISCIPLINE GRID ===== */}
      <section className="relative z-10 mx-auto max-w-6xl px-6 md:px-10 pb-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {visible.map((d, i) => (
            <motion.div
              key={d.name}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: Math.min(i * 0.03, 0.3) }}
              whileHover={{ y: -3, transition: { duration: 0.18 } }}
              className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-fuchsia-500/30 hover:bg-white/[0.04] transition"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-[13px] font-semibold text-white">{d.name}</p>
                <span className="text-[10px] font-mono text-fuchsia-300 whitespace-nowrap">
                  {d.marketRate}/yr
                </span>
              </div>
              <p className="mt-2 text-[12.5px] text-zinc-400 leading-snug">{d.scope}</p>
              <Link
                href={d.evidence}
                className="mt-3 inline-flex items-center gap-1 text-[11px] font-mono text-indigo-300 hover:text-indigo-200 transition"
              >
                → {d.evidenceLabel}
              </Link>
            </motion.div>
          ))}
        </div>
      </section>

      {/* ===== CLOSER ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 py-16 text-center">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          One operator. One platform. The whole team.
        </h3>
        <p className="mt-3 text-zinc-400 text-[14px]">
          Approval-only-no-execution. Closed-union types. sha-256 rationale rows.
          The same safety contract applies across every discipline above.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/plans"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition"
          >
            See plans
          </Link>
          <Link
            href="/dashboard/command-center"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
          >
            Open cockpit
          </Link>
        </div>
      </section>
    </div>
  );
}
