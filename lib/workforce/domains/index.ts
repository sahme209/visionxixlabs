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
  {
    engineerId: "pipeline_repair_engineer",
    reportTargetKind: "engineer_pipeline_repair_playbook",
    runDomainEndpoint: "/api/workforce/pipeline_repair_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/pipeline_repair_engineer",
    reportLabel: "Pipeline repair playbook",
  },
  {
    engineerId: "schema_engineer",
    reportTargetKind: "engineer_schema_proposal",
    runDomainEndpoint: "/dashboard/workforce/schema_engineer/proposals",
    reportHomeRoute: "/dashboard/workforce/schema_engineer/proposals",
    reportLabel: "Schema proposals",
    requiresInput: true,
  },
  {
    engineerId: "memory_consolidator_engineer",
    reportTargetKind: "engineer_memory_consolidation",
    runDomainEndpoint: "/api/workforce/memory_consolidator_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/memory_consolidator_engineer",
    reportLabel: "Memory consolidation",
  },
  {
    engineerId: "meta_reasoner_engineer",
    reportTargetKind: "engineer_meta_reasoner_resolution",
    runDomainEndpoint: "/api/workforce/meta_reasoner_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/meta_reasoner_engineer",
    reportLabel: "Meta-reasoner resolutions",
  },
  {
    engineerId: "council_engineer",
    reportTargetKind: "engineer_council_verdicts",
    runDomainEndpoint: "/api/workforce/council_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/council_engineer",
    reportLabel: "Council verdicts",
  },
  {
    engineerId: "migration_engineer",
    reportTargetKind: "engineer_migration_runbook",
    runDomainEndpoint: "/dashboard/workforce/migration_engineer/runbooks",
    reportHomeRoute: "/dashboard/workforce/migration_engineer/runbooks",
    reportLabel: "Migration runbooks",
    requiresInput: true,
  },
  {
    engineerId: "intent_parser_engineer",
    reportTargetKind: "engineer_intent_workflow",
    runDomainEndpoint: "/dashboard/workforce/intent_parser_engineer/workflows",
    reportHomeRoute: "/dashboard/workforce/intent_parser_engineer/workflows",
    reportLabel: "Parsed workflows",
    requiresInput: true,
  },
  {
    engineerId: "improvement_engineer",
    reportTargetKind: "engineer_improvement_proposals",
    runDomainEndpoint: "/api/workforce/improvement_engineer/run-domain",
    reportHomeRoute: "/dashboard/workforce/improvement_engineer",
    reportLabel: "Improvement proposals",
  },
  {
    engineerId: "reasoner_engineer",
    reportTargetKind: "engineer_reasoner_hypothesis",
    runDomainEndpoint: "/dashboard/workforce/reasoner_engineer/hypotheses",
    reportHomeRoute: "/dashboard/workforce/reasoner_engineer/hypotheses",
    reportLabel: "Reasoner hypotheses",
    requiresInput: true,
  },
  {
    engineerId: "simulator_engineer",
    reportTargetKind: "engineer_simulator_verdict",
    runDomainEndpoint: "/dashboard/workforce/simulator_engineer/simulations",
    reportHomeRoute: "/dashboard/workforce/simulator_engineer/simulations",
    reportLabel: "Simulator verdicts",
    requiresInput: true,
  },
  {
    engineerId: "workflow_orchestrator_engineer",
    reportTargetKind: "engineer_workflow_plan",
    runDomainEndpoint: "/dashboard/workforce/workflow_orchestrator_engineer/plans",
    reportHomeRoute: "/dashboard/workforce/workflow_orchestrator_engineer/plans",
    reportLabel: "Workflow plans",
    requiresInput: true,
  },
  {
    engineerId: "operator_assistant_engineer",
    reportTargetKind: "engineer_operator_copilot_reply",
    runDomainEndpoint: "/dashboard/workforce/operator_assistant_engineer/replies",
    reportHomeRoute: "/dashboard/workforce/operator_assistant_engineer/replies",
    reportLabel: "Operator copilot replies",
    requiresInput: true,
  },
  {
    engineerId: "approver_engineer",
    reportTargetKind: "engineer_approval_packet",
    runDomainEndpoint: "/dashboard/workforce/approver_engineer/packets",
    reportHomeRoute: "/dashboard/workforce/approver_engineer/packets",
    reportLabel: "Approval packets",
    requiresInput: true,
  },
];

export function findDomainImplementation(engineerId: string): DomainImplementation | undefined {
  return ENGINEER_DOMAIN_IMPLEMENTATIONS.find((d) => d.engineerId === engineerId);
}
