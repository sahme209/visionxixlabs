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
  runDomainEndpoint: string;
  reportHomeRoute: string;
  /** Plain-English label for the surface header. */
  reportLabel: string;
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
];

export function findDomainImplementation(engineerId: string): DomainImplementation | undefined {
  return ENGINEER_DOMAIN_IMPLEMENTATIONS.find((d) => d.engineerId === engineerId);
}
