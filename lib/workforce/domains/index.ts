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
];

export function findDomainImplementation(engineerId: string): DomainImplementation | undefined {
  return ENGINEER_DOMAIN_IMPLEMENTATIONS.find((d) => d.engineerId === engineerId);
}
