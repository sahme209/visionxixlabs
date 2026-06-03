/**
 * Engineer domain-work registry — Phase 583.
 *
 * Maps an engineer id → the metadata needed to render its domain
 * output on the engineer detail page. The detail page reads this
 * registry; future engineers slot in with one entry.
 *
 * The shape stays minimal on purpose: each registered engineer
 * declares its report targetKind, the surface where the report is
 * surfaced (so the run button knows where to 303-redirect), and
 * the run-domain endpoint to POST to.
 */

export interface DomainImplementation {
  engineerId: string;
  reportTargetKind: string;
  /** Endpoint the detail-page button targets. For no-input engineers
   *  (compliance, detector) this is a POST route. For input-shape
   *  engineers (spec writer) this is a dashboard route that hosts the
   *  form — detail page renders a Link instead of a form. */
  runDomainEndpoint: string;
  reportHomeRoute: string;
  /** Plain-English label for the surface header. */
  reportLabel: string;
  /** When true, the engineer needs operator input before producing
   *  output. The engineer detail page renders a Link rather than a
   *  form submission. */
  requiresInput?: boolean;
}

export const ENGINEER_DOMAIN_IMPLEMENTATIONS: ReadonlyArray<DomainImplementation> = [
  {
    engineerId: "compliance_engineer",
    reportTargetKind: "engineer_compliance_report",
    runDomainEndpoint: "/api/workforce/compliance_engineer/run-domain",
    reportHomeRoute: "/dashboard/compliance",
    reportLabel: "Compliance evidence report",
  },
  {
    engineerId: "detector_engineer",
    reportTargetKind: "engineer_detector_signals",
    runDomainEndpoint: "/api/workforce/detector_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/detector_engineer",
    reportLabel: "Detected signals",
  },
  {
    engineerId: "spec_writer_engineer",
    reportTargetKind: "engineer_spec_writer_spec",
    runDomainEndpoint: "/dashboard/workforce/spec_writer_engineer/specs",
    reportHomeRoute: "/dashboard/workforce/spec_writer_engineer/specs",
    reportLabel: "Written specs",
    requiresInput: true,
  },
  {
    engineerId: "incident_engineer",
    reportTargetKind: "engineer_incident_triage",
    runDomainEndpoint: "/api/workforce/incident_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/incident_engineer",
    reportLabel: "Incident triage",
  },
  {
    engineerId: "secrets_hygiene_engineer",
    reportTargetKind: "engineer_secrets_hygiene_candidates",
    runDomainEndpoint: "/api/workforce/secrets_hygiene_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/secrets_hygiene_engineer",
    reportLabel: "Secrets hygiene scan",
  },
  {
    engineerId: "finops_engineer",
    reportTargetKind: "engineer_finops_recommendations",
    runDomainEndpoint: "/api/workforce/finops_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/finops_engineer",
    reportLabel: "FinOps recommendations",
  },
  {
    engineerId: "anomaly_engineer",
    reportTargetKind: "engineer_anomaly_notices",
    runDomainEndpoint: "/api/workforce/anomaly_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/anomaly_engineer",
    reportLabel: "Anomaly notices",
  },
  {
    engineerId: "auditor_engineer",
    reportTargetKind: "engineer_auditor_observations",
    runDomainEndpoint: "/api/workforce/auditor_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/auditor_engineer",
    reportLabel: "Audit observations",
  },
  {
    engineerId: "test_coverage_engineer",
    reportTargetKind: "engineer_test_coverage_proposal",
    runDomainEndpoint: "/dashboard/workforce/test_coverage_engineer/proposals",
    reportHomeRoute: "/dashboard/workforce/test_coverage_engineer/proposals",
    reportLabel: "Test proposals",
    requiresInput: true,
  },
  {
    engineerId: "refactor_engineer",
    reportTargetKind: "engineer_refactor_plan",
    runDomainEndpoint: "/dashboard/workforce/refactor_engineer/plans",
    reportHomeRoute: "/dashboard/workforce/refactor_engineer/plans",
    reportLabel: "Refactor plans",
    requiresInput: true,
  },
  {
    engineerId: "release_notes_engineer",
    reportTargetKind: "engineer_release_notes_draft",
    runDomainEndpoint: "/dashboard/workforce/release_notes_engineer/drafts",
    reportHomeRoute: "/dashboard/workforce/release_notes_engineer/drafts",
    reportLabel: "Release notes drafts",
    requiresInput: true,
  },
  {
    engineerId: "alert_noise_engineer",
    reportTargetKind: "engineer_alert_noise_classification",
    runDomainEndpoint: "/api/workforce/alert_noise_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/alert_noise_engineer",
    reportLabel: "Alert noise classification",
  },
  {
    engineerId: "verifier_engineer",
    reportTargetKind: "engineer_verifier_verdicts",
    runDomainEndpoint: "/api/workforce/verifier_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/verifier_engineer",
    reportLabel: "Verifier verdicts",
  },
];

export function findDomainImplementation(engineerId: string): DomainImplementation | undefined {
  return ENGINEER_DOMAIN_IMPLEMENTATIONS.find((d) => d.engineerId === engineerId);
}
