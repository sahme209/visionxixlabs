import type { Metadata } from "next";
import Link from "next/link";
import { DocHeader, DocSection, Callout, TrustGrid, DocFooterNav, DocFeedback } from "@/components/docs/DocPrimitives";

export const metadata: Metadata = {
  title: "Audit logs — Axiom Documentation",
  description: "Every action Axiom takes is logged immutably. Connection events, scans, findings, approvals, executions, Terraform exports, rollbacks, user actions — all queryable, exportable, and SOC 2 / ISO 27001 control-mapped.",
};

const EVENT_TYPES = [
  { kind: "Connection events", what: "Provider connected, disconnected, role assumed, role assumption failed, External ID rotated.", retention: "Indefinite" },
  { kind: "Scan events", what: "Scan started, completed, failed, partial. Includes region, account, scan duration, resource counts.", retention: "90 days · exportable" },
  { kind: "Findings", what: "Every finding produced by a scan with category, severity, affected resources, confidence, and timestamp.", retention: "90 days · exportable" },
  { kind: "Recommendations", what: "Every recommendation tied to a finding — rationale, risk level, monthly impact, disposition.", retention: "90 days · exportable" },
  { kind: "Execution plans", what: "Plan generated, phases, blast radius, rollback strategy, expected impact. Immutable per plan version.", retention: "Indefinite" },
  { kind: "Approvals", what: "Approver identity, plan items approved/rejected, optional note, timestamp. Captures multi-party approval chains.", retention: "Indefinite" },
  { kind: "Terraform exports", what: "Plan downloaded — who, when, which phases, what bytes were served. Marks 'applied externally' if user confirms.", retention: "Indefinite" },
  { kind: "Apply events", what: "Each cloud mutation: provider, resource, action type, before-state, after-state, status, RTO if rolled back.", retention: "Indefinite · SOC 2 evidence" },
  { kind: "Rollback events", what: "Trigger reason, snapshot used, rollback path executed, post-rollback verification result.", retention: "Indefinite" },
  { kind: "User actions", what: "Sign-in, sign-out, settings changes, connection management, approval policy edits.", retention: "90 days · exportable" },
  { kind: "Workflow events", what: "Recurring workflow runs, drift detection cycles, post-execution verification jobs, compliance sweeps.", retention: "90 days · exportable" },
  { kind: "ReleaseOps events", what: "Release assessed, approved, deployed, blocked, rolled back, drift detected, readiness score updated.", retention: "Indefinite" },
];

export default function AuditLogsPage() {
  return (
    <>
      <DocHeader
        kicker="Trust & security · Audit"
        title="Audit logs."
        summary="Every action Axiom takes is logged immutably. Connection events, scans, findings, approvals, executions, Terraform exports, rollbacks — all queryable from the dashboard, exportable to SIEM, and SOC 2 / ISO 27001 control-mapped."
      />

      <Callout variant="safe" title="The contract">
        Audit logs are immutable. Once written, no Axiom employee, no API caller, no automation can modify or delete them. The audit fabric is append-only by design.
      </Callout>

      <DocSection id="event-types" title="What gets logged" kicker="01 · Event types">
        <div className="space-y-2">
          {EVENT_TYPES.map((e) => (
            <div key={e.kind} className="rounded-xl bg-white/[0.02] border border-white/[0.06] p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-1.5">
                <p className="text-sm font-bold text-white">{e.kind}</p>
                <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 rounded-full px-1.5 py-px">
                  {e.retention}
                </span>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">{e.what}</p>
            </div>
          ))}
        </div>
      </DocSection>

      <DocSection id="where-to-find" title="Where to find audit logs" kicker="02 · Access">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Dashboard</strong> — <Link href="/dashboard/command-center" className="text-violet-300 hover:text-violet-200">/dashboard/command-center</Link> shows live activity feed; <Link href="/dashboard/memory" className="text-violet-300 hover:text-violet-200">/dashboard/memory</Link> shows 90-day timeline with filtering</li>
          <li><strong>API</strong> — REST endpoint at <code>GET /api/operations/events</code> returns recent activity stream</li>
          <li><strong>Export</strong> — full audit export from <code>Settings → Audit → Export</code> (CSV, JSON, or SIEM-formatted)</li>
          <li><strong>SIEM integration</strong> — webhook delivery to your SIEM for real-time forwarding (Enterprise tier)</li>
          <li><strong>Desktop app</strong> — local audit log lives in OS-native storage, exportable to disk without leaving your machine</li>
        </ul>
      </DocSection>

      <DocSection id="format" title="Audit event shape" kicker="03 · Format">
        <p>Every event has a stable schema:</p>
        <ul className="list-disc list-inside space-y-1 text-zinc-400 ml-1">
          <li><code>id</code> — globally unique event ID</li>
          <li><code>timestamp</code> — ISO 8601 UTC</li>
          <li><code>organizationId</code> — tenant scope</li>
          <li><code>userId</code> — actor (user, service, or &quot;system&quot; for agent-initiated events)</li>
          <li><code>provider</code> — aws | azure | gcp | system</li>
          <li><code>actionType</code> — event kind (one of the categories above)</li>
          <li><code>resourceIds</code> — affected resources (array of strings)</li>
          <li><code>beforeState</code> / <code>afterState</code> — JSON state snapshots (for apply events)</li>
          <li><code>status</code> — pending | applied | failed | rolled_back</li>
          <li><code>riskLevel</code> — low | medium | high</li>
          <li><code>metadata</code> — extra context (region, cost impact, approver, etc.)</li>
        </ul>
      </DocSection>

      <DocSection id="why" title="Why audit logs matter" kicker="04 · Enterprise trust">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>SOC 2 / ISO 27001 evidence</strong> — control mappings built in; audit-export is the artifact auditors actually want</li>
          <li><strong>Incident forensics</strong> — when something goes wrong, the timeline of every action is queryable in seconds</li>
          <li><strong>Compliance reporting</strong> — quarterly reports generate themselves from the same audit fabric</li>
          <li><strong>Vendor accountability</strong> — if Axiom misbehaves, the proof is in your own audit logs, not ours</li>
          <li><strong>Internal governance</strong> — who approved what, when, with what justification — is the entire audit story</li>
        </ul>
      </DocSection>

      <DocSection id="immutability" title="Immutability guarantees" kicker="05 · Hard guarantees">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li>No API endpoint allows modification or deletion of audit events</li>
          <li>No internal Axiom tool allows modification</li>
          <li>Application-layer encryption protects sensitive fields (before/after states) without breaking auditability</li>
          <li>Cross-region replication on Enterprise tier — audit fabric survives single-region failure</li>
          <li>Audit-log integrity hash chain (planned) — tamper detection at the row level</li>
        </ul>
      </DocSection>

      <DocSection id="retention" title="Retention" kicker="06 · Retention">
        <ul className="list-disc list-inside space-y-1.5 text-zinc-400 ml-1">
          <li><strong>Operational events</strong> (scans, findings, recommendations, workflow runs) — 90 days at the platform; exportable indefinitely</li>
          <li><strong>Material actions</strong> (connections, plans, approvals, applies, rollbacks, exports) — indefinite retention</li>
          <li><strong>Custom retention</strong> — Enterprise tier supports configurable retention windows up to 7 years</li>
          <li><strong>Customer-controlled storage</strong> — Enterprise tier can write audit events directly to your own S3/Azure Blob/GCS</li>
        </ul>
      </DocSection>

      <DocSection id="trust" title="Trust questions">
        <TrustGrid
          items={[
            { question: "What gets logged?", answer: "Every action Axiom takes — connections, scans, findings, approvals, executions, exports, rollbacks, user operations." },
            { question: "Why does it matter?", answer: "SOC 2 / ISO 27001 evidence, incident forensics, compliance reporting, vendor accountability, internal governance — all run off the same audit fabric." },
            { question: "Is it safe and tamper-proof?", answer: "Yes — append-only, no modification API, application-layer encryption on sensitive fields, planned integrity hash chain." },
            { question: "What's the retention?", answer: "90 days for operational events, indefinite for material actions. Configurable up to 7 years on Enterprise." },
            { question: "Where do I find it?", answer: "Dashboard (activity feed + memory timeline), REST API, full CSV/JSON export, SIEM webhook delivery." },
            { question: "Can Axiom employees see my audit logs?", answer: "No. Tenant isolation is enforced at the data layer. Support access requires a documented break-glass process with your prior approval." },
          ]}
        />
      </DocSection>

      <DocFooterNav
        prev={{ href: "/docs/permissions-model", label: "Permissions model" }}
        next={{ href: "/docs/troubleshooting", label: "Troubleshooting" }}
      />
      <DocFeedback />
    </>
  );
}
