/**
 * Pure compliance control mapper.
 *
 * Input: a stream of audit events the platform has captured + the
 * compliance frameworks an operator cares about. Output: per-control
 * evidence rows showing which audit events satisfy which controls,
 * which controls have NO evidence (gap), and a per-framework
 * readiness score.
 *
 * Pure / deterministic. No I/O. Caller passes in events drawn from
 * AxiomAuditEvent / SecureAuditRecord; the kernel never queries the
 * DB directly.
 *
 * Why this matters for AGI:
 *   "Did we satisfy SOC 2 CC 6.1 this quarter?" is the kind of
 *   question every compliance officer asks. Answering it manually
 *   means grepping logs. This kernel turns the audit stream into a
 *   typed map of control → evidence, refreshed on every event.
 */

export type ComplianceFramework = "soc2" | "iso27001" | "gdpr" | "hipaa";

export type ControlStatus = "satisfied" | "partial" | "gap" | "not_applicable";

export type RiskTier = "low" | "medium" | "high" | "critical";

export interface ControlDefinition {
  /** Framework this control belongs to. */
  framework: ComplianceFramework;
  /** Canonical id (e.g. "CC 6.1", "A.5.1", "Art. 32(1)(b)"). */
  id: string;
  /** Display name. */
  title: string;
  /** What the control requires, in plain English. */
  requirement: string;
  /** Audit-event kinds that count as evidence. */
  evidenceKinds: ReadonlyArray<string>;
  /** Minimum number of events in the window for "satisfied". */
  minEvidenceCount: number;
  /** Closed-union risk tier if this control is a gap. */
  gapRiskTier: RiskTier;
}

export interface AuditEvent {
  id: string;
  /** ISO timestamp. */
  at: string;
  /** Event kind — must match ControlDefinition.evidenceKinds entries. */
  kind: string;
  /** Operator-readable description. */
  description: string;
  /** Actor (user email / kernel id). */
  actor: string;
}

export interface ControlEvidenceRow {
  controlId: string;
  framework: ComplianceFramework;
  status: ControlStatus;
  evidenceCount: number;
  /** Up to 3 sample events that satisfied this control (newest first). */
  sampleEvidence: readonly { id: string; at: string; kind: string; actor: string }[];
  /** Operator-readable rationale. */
  rationale: string;
  /** Recommended action when status is gap or partial. */
  recommendedAction: string | null;
}

export interface FrameworkReadiness {
  framework: ComplianceFramework;
  /** % of controls satisfied (excluding not_applicable). */
  readinessPct: number;
  /** Counts per status. */
  byStatus: Readonly<Record<ControlStatus, number>>;
  /** Total controls considered. */
  total: number;
}

export interface MapResult {
  rows: readonly ControlEvidenceRow[];
  byFramework: readonly FrameworkReadiness[];
  /** Hard gaps that need attention regardless of framework. */
  blockingGaps: readonly ControlEvidenceRow[];
}

const FRAMEWORK_ORDER: readonly ComplianceFramework[] = ["soc2", "iso27001", "gdpr", "hipaa"];

export function mapControls(
  controls: readonly ControlDefinition[],
  events: readonly AuditEvent[],
  windowDays = 90,
  now: Date = new Date(),
): MapResult {
  const since = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const recent = events.filter((e) => new Date(e.at).getTime() >= since.getTime());

  // Bucket recent events by kind for fast lookup.
  const eventsByKind = new Map<string, AuditEvent[]>();
  for (const e of recent) {
    const arr = eventsByKind.get(e.kind) ?? [];
    arr.push(e);
    eventsByKind.set(e.kind, arr);
  }

  const rows: ControlEvidenceRow[] = controls.map((c) => {
    // Collect all events from the kinds the control accepts.
    const matched: AuditEvent[] = [];
    for (const kind of c.evidenceKinds) {
      const arr = eventsByKind.get(kind);
      if (arr) matched.push(...arr);
    }
    // Sort newest first.
    matched.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());

    let status: ControlStatus;
    let rationale: string;
    let recommendedAction: string | null = null;

    if (matched.length === 0) {
      status = "gap";
      rationale = `No evidence in the last ${windowDays}d. Required event kinds: ${c.evidenceKinds.join(", ")}.`;
      recommendedAction = `Schedule a recurring task that emits at least ${c.minEvidenceCount} of: ${c.evidenceKinds.join(", ")}.`;
    } else if (matched.length < c.minEvidenceCount) {
      status = "partial";
      rationale = `${matched.length} event(s) found in ${windowDays}d; control requires ≥ ${c.minEvidenceCount}.`;
      recommendedAction = `Lift the cadence so ${c.minEvidenceCount}+ events land per ${windowDays}-day window.`;
    } else {
      status = "satisfied";
      rationale = `${matched.length} event(s) in ${windowDays}d ≥ required ${c.minEvidenceCount}.`;
    }

    return {
      controlId: c.id,
      framework: c.framework,
      status,
      evidenceCount: matched.length,
      sampleEvidence: matched.slice(0, 3).map((e) => ({ id: e.id, at: e.at, kind: e.kind, actor: e.actor })),
      rationale,
      recommendedAction,
    };
  });

  // Per-framework readiness.
  const byFramework: FrameworkReadiness[] = [];
  for (const fw of FRAMEWORK_ORDER) {
    const fwRows = rows.filter((r) => r.framework === fw);
    if (fwRows.length === 0) continue;
    const byStatus: Record<ControlStatus, number> = {
      satisfied: 0, partial: 0, gap: 0, not_applicable: 0,
    };
    for (const r of fwRows) byStatus[r.status] += 1;
    const considered = fwRows.length - byStatus.not_applicable;
    const readinessPct = considered === 0 ? 100 : Math.round((byStatus.satisfied / considered) * 100);
    byFramework.push({ framework: fw, readinessPct, byStatus, total: fwRows.length });
  }

  // Blocking gaps = gap rows where the control's risk tier is high or critical.
  const blockingGaps = rows.filter((r) => {
    if (r.status !== "gap") return false;
    const c = controls.find((x) => x.id === r.controlId && x.framework === r.framework);
    return c && (c.gapRiskTier === "high" || c.gapRiskTier === "critical");
  });

  return { rows, byFramework, blockingGaps };
}

/**
 * A minimal seed catalog of controls so the cockpit + tests have
 * something concrete. Real tenants extend this from their auditor's
 * scope. Keep this list short on purpose — it's the kernel's
 * starting point, not a complete library.
 */
export const SEED_CONTROLS: readonly ControlDefinition[] = [
  // ── SOC 2 (Trust Services Criteria) ──────────────────────────
  {
    framework: "soc2",
    id: "CC 6.1",
    title: "Logical + physical access controls",
    requirement: "Restrict logical + physical access to information assets based on assessed risk.",
    evidenceKinds: ["iam_change", "access_review_completed", "user_provisioned", "user_deprovisioned"],
    minEvidenceCount: 1,
    gapRiskTier: "high",
  },
  {
    framework: "soc2",
    id: "CC 7.2",
    title: "Detection of anomalies",
    requirement: "Monitor system components for anomalies + indicators of compromise.",
    evidenceKinds: ["anomaly_detected", "alert_fired", "incident_opened"],
    minEvidenceCount: 1,
    gapRiskTier: "medium",
  },
  {
    framework: "soc2",
    id: "CC 7.4",
    title: "Security incident response",
    requirement: "Respond to security incidents per documented procedures.",
    evidenceKinds: ["incident_opened", "postmortem_published"],
    minEvidenceCount: 1,
    gapRiskTier: "high",
  },
  // ── ISO 27001 (Annex A) ──────────────────────────────────────
  {
    framework: "iso27001",
    id: "A.5.15",
    title: "Access control",
    requirement: "Establish rules to control physical + logical access based on business + security requirements.",
    evidenceKinds: ["iam_change", "access_review_completed"],
    minEvidenceCount: 1,
    gapRiskTier: "high",
  },
  {
    framework: "iso27001",
    id: "A.8.16",
    title: "Monitoring activities",
    requirement: "Monitor networks, systems + applications for anomalies.",
    evidenceKinds: ["alert_fired", "anomaly_detected"],
    minEvidenceCount: 1,
    gapRiskTier: "medium",
  },
  // ── GDPR (Articles) ──────────────────────────────────────────
  {
    framework: "gdpr",
    id: "Art. 32(1)(b)",
    title: "Confidentiality, integrity, availability of processing systems",
    requirement: "Ensure ongoing confidentiality, integrity, availability + resilience of systems.",
    evidenceKinds: ["backup_verified", "system_restore_tested"],
    minEvidenceCount: 1,
    gapRiskTier: "high",
  },
  {
    framework: "gdpr",
    id: "Art. 33",
    title: "Breach notification",
    requirement: "Notify the supervisory authority of personal-data breaches within 72 hours.",
    evidenceKinds: ["breach_notification_sent", "incident_opened"],
    minEvidenceCount: 1,
    gapRiskTier: "critical",
  },
  // ── HIPAA (Security Rule) ────────────────────────────────────
  {
    framework: "hipaa",
    id: "164.308(a)(1)(ii)(A)",
    title: "Risk analysis",
    requirement: "Conduct an accurate + thorough assessment of risk to PHI.",
    evidenceKinds: ["risk_analysis_completed"],
    minEvidenceCount: 1,
    gapRiskTier: "high",
  },
  {
    framework: "hipaa",
    id: "164.312(b)",
    title: "Audit controls",
    requirement: "Record + examine activity in information systems that contain PHI.",
    evidenceKinds: ["audit_log_review_completed", "iam_change"],
    minEvidenceCount: 1,
    gapRiskTier: "medium",
  },
];
