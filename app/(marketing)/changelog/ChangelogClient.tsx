"use client";

/**
 * /changelog — public phase history.
 *
 * Each row reflects a real shipped phase batch (5 phases at a time, by
 * convention). The page is a static narrative — entries here should be
 * appended on every phase batch so visitors can see velocity without a
 * blog system. Approval-only-no-execution applies here too: nothing on
 * the page changes without an operator-staged update to this file.
 */

import { motion } from "framer-motion";
import Link from "next/link";

interface ChangelogEntry {
  date: string;
  title: string;
  summary: string;
  tag: "marketing" | "kernel" | "agent" | "platform" | "safety" | "ops";
  surface: "web" | "mobile" | "desktop" | "all";
}

// Historical engineering notes are retained for repository context. They are
// not a public capability catalogue: several predate the current desktop-first
// product boundary and have not been re-verified as customer-facing workflows.
export const HISTORICAL_ENGINEERING_NOTES = [
  {
    phases: "336-341",
    title: "Intent · anomaly · risk · secrets · compliance — five new kernels",
    summary:
      "Five pure-function kernels (73 new tests). intentParser turns natural-language operator input into a typed ActionSpec. anomalyDetector uses MAD-based z-scores for robust time-series anomaly classification. changeRiskAssessor scores blast radius of a proposed change against the service topology graph. secretsHygieneScanner detects AWS / Stripe / GitHub / OpenAI / Anthropic / Slack / PEM secrets with redacted previews. complianceControlMapper turns the audit stream into per-control evidence for SOC 2 / ISO 27001 / GDPR / HIPAA + a per-framework readiness %.",
    tag: "agent",
    surface: "all",
  },
  {
    phases: "329-335",
    title: "Product-layer separation — client app vs VisionXIXLabs admin",
    summary:
      "Hard separation of client-facing surfaces from VisionXIXLabs internal tools. /dashboard/marketing moved to /admin/marketing (operator-only). Typed productLayer field added to subToolCatalog; client sub-tools center filters out internal entries; defense-in-depth notFound on the dynamic detail route. Marketing / sales / lead-enricher kernels marked as internal_admin in their headers. Azure connector setup UX rebuilt — replaced the bare \"AZURE_TENANT_ID, AZURE_CLIENT_ID\" env-var dump with a guided card list (label + description + secret pill + help link), with the raw env names tucked into an Advanced section.",
    tag: "platform",
    surface: "web",
  },
  {
    phases: "323-328",
    title: "Top AGI — workflow orchestrator + meta-reasoner + calibrator + debate + memory",
    summary:
      "Five keystone kernels that separate \"tools that call AI\" from a real autonomous agent workforce (64 new tests). agentWorkflowOrchestrator chains kernels into typed multi-step workflows with per-step gates. metaReasonerKernel picks the right kernel for an operator problem. confidenceCalibrator computes Wilson-lower-bound accuracy + recommends trust_more / pause / trust_less. multiAgentDebate reconciles N proposals with safety-tier veto. agentMemoryConsolidator promotes recurrent episodes to semantic memory.",
    tag: "agent",
    surface: "all",
  },
  {
    phases: "316-322",
    title: "Operations breadth — database, cloud cost, observability, HR, sales kernels",
    summary:
      "Six new pure-function kernels covering the operations domains the platform hadn't deeply hit yet (73 new tests). databaseSchemaReviewer audits tables for missing indexes / FKs / naming drift. slowQueryProposer emits add_index DDL or rewrite proposals. idleCloudResourceDetector finds idle EBS/EIP/Lambda/Snapshot/RDS/ELB with $/mo savings. alertNoiseReducer proposes threshold/window/pairing changes. hrOnboardingPlanner builds 4-phase onboarding plans. salesLeadEnricher classifies inbound leads with ICP fit score + plan suggestion + next action.",
    tag: "agent",
    surface: "all",
  },
  {
    phases: "308-315",
    title: "Python contract + execution planner + local model invocation + GitHub + incident pipeline",
    summary:
      "Seven new pure-function kernels with closed-union types (101 new tests). pythonScriptContract validates Python manifests + inputs. scriptExecutionPlanner composes typed plans with risk verdicts for cloud or desktop mode. localModelInvocation guards every local AI model call with PII redaction + bounded inputs + output validation. githubPipelineRepairer classifies Actions failures into typed PR proposals. githubReleaseNotesDrafter renders conventional-commit release notes with SemVer recommendation. incidentTimelineWeaver phase-tags incident events; postmortemDrafter renders the canonical write-up.",
    tag: "agent",
    surface: "all",
  },
  {
    phases: "301-307",
    title: "AI marketing + LinkedIn safe foundation + desktop script catalog",
    summary:
      "Two new agent kernels — marketingContentDrafter (typed multi-channel drafts with risk tiering) and socialPostScheduler (caps + blackout + dedup). Typed LinkedIn UGC post builder with OAuth scope guardrails — no live POST, payload preview only. Desktop script catalog wired for macOS / Windows / Linux runtimes. New /dashboard/marketing cockpit shipped as a business-ops sub-tool.",
    tag: "marketing",
    surface: "all",
  },
  {
    phases: "296-300",
    title: "Liveness pass · platform shell reads real Prisma data",
    summary:
      "/dashboard/connectors, /dashboard/agents, /dashboard/automation, /dashboard/modules, /dashboard/sub-tools all read live CloudAccount + AxiomAgentRun + AgentBusMessage + AxiomApprovalItem rows. <LiveBadge/> + <PlatformHealthStrip/> primitives ship. No new Prisma models — existing schema covers the domain.",
    tag: "platform",
    surface: "web",
  },
  {
    phases: "291-295",
    title: "AGI Engineers — spec writer + test coverage + refactor sequencer + migration coordinator",
    summary:
      "Four new planning-tier agent kernels in lib/agents/, each pure-function with closed-union types and a vitest suite. Public /capabilities maps every kernel on the bus — perception / reasoning / planning / safety / verification / memory — to the lib/ module that proves it.",
    tag: "agent",
    surface: "all",
  },
  {
    phases: "286-290",
    title: "/compare · /faq · social proof · /contact rebuild",
    summary:
      "Three-tab coverage matrix vs hire-team / AI tools / SaaS stack. Thirteen-question FAQ with category filter. Shared social-proof rail wired into team-of-one, plans, and disciplines closers. /contact moved into the unified marketing layout with an Axiom-flavored form posting to the existing /api/contact endpoint.",
    tag: "marketing",
    surface: "web",
  },
  {
    phases: "282-285",
    title: "Disciplines + changelog + nav polish",
    summary:
      "Public /disciplines maps every role Axiom replaces to the kernel module that proves it. Public /changelog documents shipped velocity. Marketing nav + footer + sitemap updated.",
    tag: "marketing",
    surface: "web",
  },
  {
    phases: "277-281",
    title: "How-it-works · trust · plans · platforms",
    summary:
      "Animated 10-agent walkthrough, 6-contract trust matrix, 5-tier pricing with annual toggle, three-surface platform page. Vercel build hardened against literal-type inference.",
    tag: "marketing",
    surface: "web",
  },
  {
    phases: "272-276",
    title: "/team-of-one Huly-flavored landing + ROI calculator",
    summary:
      "Cursor-tracking aurora, scroll-revealed sections, IntersectionObserver count-ups, interactive ROI calculator. Headline number: the team you'd hire would cost ≈ $2.96M/year.",
    tag: "marketing",
    surface: "web",
  },
  {
    phases: "267-271",
    title: "a11y · Web Vitals · DR · GDPR DSR · AI code review",
    summary:
      "Accessibility audit kernel, Web Vitals collector, disaster-recovery runbook generator, GDPR Article-12 data-subject request handler, AI code-review prioritizer (free-tier provider chain with fallback).",
    tag: "kernel",
    surface: "all",
  },
  {
    phases: "262-266",
    title: "Helpdesk + SCIM + observability + customer success + i18n",
    summary:
      "Help-ticket router, SCIM provisioning sync, log-aggregator with bucket inference fix, customer-success health score, i18n catalog with closed-union locale.",
    tag: "kernel",
    surface: "web",
  },
  {
    phases: "257-261",
    title: "Desktop companion — macOS + Windows + Linux",
    summary:
      "OS detection + capability map, per-OS notifications (UNNotificationContent / Toast XML / libnotify), cross-platform keychain, auto-updater manifest validator, tray-icon state machine.",
    tag: "platform",
    surface: "desktop",
  },
  {
    phases: "252-256",
    title: "QA visual regression + ML drift + network + crash fingerprint",
    summary:
      "Snapshot differ, drift detector with severity tiers, network reachability state, crash-report fingerprinting, freshness monitor for ML predictions.",
    tag: "kernel",
    surface: "all",
  },
  {
    phases: "247-251",
    title: "Mobile companion surface",
    summary:
      "Typed mobileApiClient (closed-union error kinds), APNS + FCM push payload builder, offline-queue store with conflict detection, axiom:// deep links, biometric re-auth + session security.",
    tag: "platform",
    surface: "mobile",
  },
  {
    phases: "242-246",
    title: "Detector + approver + auditor + improver + data-eng kernels",
    summary:
      "Five agent kernels added to the bus. Approver stages approval packets, auditor writes sha-256 rationale rows, improver proposes method improvements.",
    tag: "agent",
    surface: "web",
  },
  {
    phases: "237-241",
    title: "Reasoner + simulator + policy + boundary + verifier kernels",
    summary:
      "Hypothesis formation, sandboxed simulation, tenant-charter policy gate, blast-radius boundary gate, post-execution verifier.",
    tag: "agent",
    surface: "web",
  },
  {
    phases: "232-236",
    title: "Slack + MS Teams + Outlook integrations",
    summary:
      "Outbound payload validators, inbound webhook signature checks, channel/team/inbox routing tables with closed-union surfaces.",
    tag: "platform",
    surface: "all",
  },
  {
    phases: "227-231",
    title: "Escalation + deploy windows + backup RPO + runbook + post-mortem",
    summary:
      "Operator escalation chain, deploy-window enforcement, backup RPO/RTO calculator, runbook validator with link health, post-mortem template generator.",
    tag: "ops",
    surface: "web",
  },
  {
    phases: "222-226",
    title: "Idempotency + rate-limit + auto-tagger + cost normalizer + webhook validator",
    summary:
      "Request-idempotency keystore, distributed rate-limit gate, resource auto-tagger, cross-cloud cost normalizer, signed-webhook validator.",
    tag: "kernel",
    surface: "web",
  },
  {
    phases: "217-221",
    title: "Baseline differ + lint summary + PR risk + AI PR writer + export estimator",
    summary:
      "Cloud baseline differ, lint findings summarizer, PR-risk scorer, AI PR description writer (free-tier chain), export size estimator.",
    tag: "kernel",
    surface: "web",
  },
  {
    phases: "151-216",
    title: "Foundations — multi-agent bus + safety contract + free AI provider chain",
    summary:
      "Established the bus, council voting, approval packets, durable rationale rows, free-AI provider routing (GitHub Models → Ollama → LM Studio → Groq → HuggingFace → OpenRouter → Gemini → Cloudflare → Mock).",
    tag: "safety",
    surface: "all",
  },
];

// Newest first. Public changelog entries describe shipped, user-relevant
// behavior and why it matters. Do not add a source-only kernel here.
const ENTRIES: readonly ChangelogEntry[] = [
  {
    date: "Sep 30, 2026",
    title: "Secure browser pairing for Axiom Agent",
    summary: "The browser companion can establish a short-lived, device-bound sign-in handoff to the installed Agent. This keeps identity in the browser while release operations remain in the desktop workspace.",
    tag: "safety",
    surface: "desktop",
  },
  {
    date: "Sep 29, 2026",
    title: "Revision history that preserves the decision",
    summary: "Release records now preserve meaningful edits and attribution so operators can see what changed, who recorded it, and the context that existed at review time.",
    tag: "safety",
    surface: "desktop",
  },
  {
    date: "Sep 28, 2026",
    title: "Request-to-Playbook workflow",
    summary: "The guided desktop flow keeps release scope, readiness, approval context, validation, recovery, and evidence connected instead of treating a successful trigger as a completed release.",
    tag: "ops",
    surface: "desktop",
  },
  {
    date: "Sep 27, 2026",
    title: "Explicit reconnect and stale-record handling",
    summary: "Last-known records remain visible with their freshness state rather than being silently presented as live production truth after a connection changes or goes away.",
    tag: "platform",
    surface: "all",
  },
];

const TAG_STYLE: Record<ChangelogEntry["tag"], string> = {
  marketing: "bg-fuchsia-500/15 text-fuchsia-200 border-fuchsia-500/30",
  kernel:    "bg-indigo-500/15 text-indigo-200 border-indigo-500/30",
  agent:     "bg-emerald-500/15 text-emerald-200 border-emerald-500/30",
  platform:  "bg-cyan-500/15 text-cyan-200 border-cyan-500/30",
  safety:    "bg-amber-500/15 text-amber-200 border-amber-500/30",
  ops:       "bg-rose-500/15 text-rose-200 border-rose-500/30",
};

const SURFACE_LABEL: Record<ChangelogEntry["surface"], string> = {
  web: "web",
  mobile: "mobile",
  desktop: "desktop",
  all: "all surfaces",
};

export function ChangelogClient() {
  return (
    <div className="relative">
      {/* Huly aurora — coral × violet × cyan */}
      <div aria-hidden className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="ambient-drift absolute -top-1/4 left-1/4 h-[60vh] w-[50vw] rounded-full bg-brand-violet/[0.08] blur-[140px]" />
        <div className="ambient-drift absolute top-[15%] right-[5%] h-[50vh] w-[40vw] rounded-full bg-brand-coral/[0.06] blur-[130px]" style={{ animationDelay: "-8s" }} />
        <div className="ambient-drift absolute bottom-[5%] left-[10%] h-[40vh] w-[35vw] rounded-full bg-cyan-500/[0.04] blur-[120px]" style={{ animationDelay: "-14s" }} />
      </div>

      {/* ===== HERO ===== */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 md:px-10 pt-24 pb-10">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="mono-label inline-flex items-center gap-3"
        >
          <span className="text-brand-coral/90 tabular-nums">CL</span>
          <span className="h-px w-6 bg-gradient-to-r from-brand-coral/60 to-transparent" />
          Shipped, not promised
        </motion.p>
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="font-display mt-5 text-4xl md:text-5xl font-bold leading-[1.04]"
        >
          Changelog —{" "}
          <span className="relative inline-block">
            phase by phase.
            <span aria-hidden className="absolute left-0 -bottom-0.5 h-[2px] w-full rounded-full bg-gradient-to-r from-brand-coral via-fuchsia-400/70 to-transparent" />
          </span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="mt-5 max-w-2xl text-[15px] text-zinc-400 leading-relaxed"
        >
          A concise record of shipped, user-relevant changes. Each entry explains
          what changed and why it matters; detailed internal engineering history is
          not presented as a live capability promise.
        </motion.p>
      </section>

      {/* ===== TIMELINE ===== */}
      <section className="relative z-10 mx-auto max-w-4xl px-6 md:px-10 pb-16">
        <div className="space-y-3">
          {ENTRIES.map((e, i) => (
            <motion.article
              key={e.phases}
              initial={{ opacity: 0, y: 12 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.2 }}
              transition={{ duration: 0.45, delay: Math.min(i * 0.03, 0.25) }}
              className="surface-glass rounded-2xl p-5 md:p-6 hover:border-brand-coral/25 transition-all"
            >
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  {e.date}
                </span>
                <span className={["text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded-full border", TAG_STYLE[e.tag]].join(" ")}>
                  {e.tag}
                </span>
                <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                  · {SURFACE_LABEL[e.surface]}
                </span>
              </div>
              <h2 className="text-[15px] font-semibold text-white">{e.title}</h2>
              <p className="mt-2 text-[13px] text-zinc-400 leading-relaxed">{e.summary}</p>
            </motion.article>
          ))}
        </div>
      </section>

      {/* ===== CLOSER ===== */}
      <section className="relative z-10 mx-auto max-w-3xl px-6 md:px-10 py-12 text-center">
        <h3 className="text-xl md:text-2xl font-semibold tracking-tight">
          Want to see what shipped this week?
        </h3>
        <p className="mt-3 text-zinc-400 text-[14px]">
          The cockpit's audit log shows every approval packet — including the one
          that staged this page.
        </p>
        <div className="mt-6 flex items-center justify-center gap-2">
          <Link
            href="/docs/audit-logs"
            className="inline-flex items-center gap-2 rounded-full bg-indigo-500 px-4 py-2 text-[12.5px] font-medium text-white shadow-[0_0_20px_rgba(99,102,241,0.45)] hover:bg-indigo-400 transition"
          >
            Open audit log
          </Link>
          <Link
            href="/disciplines"
            className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-[12.5px] font-medium text-zinc-200 hover:bg-white/[0.07] transition"
          >
            Browse disciplines
          </Link>
        </div>
      </section>
    </div>
  );
}
