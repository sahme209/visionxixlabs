/** Current receipts contain workflow observations, not immutable artifact or
 * application-health attestations. A filename is not a verified protocol. */
export function deploymentEvidence(requestedOperation?: "service_restart") {
  return {
    operation: "unknown" as const,
    ...(requestedOperation ? { requestedOperation } : {}),
    statusScope: "github_workflow" as const,
    sourceArtifactVerified: false as const,
    applicationHealthVerified: false as const,
    rollbackImageVerified: false as const,
  };
}
