import { prisma } from "@/lib/db";
import { hasDesktopCapability, type DesktopWorkspaceRole } from "@/lib/desktop/desktopAuthorization";
import { readDesktopCommercialAccess } from "@/lib/desktop/desktopCommercialAccess";
import { readReleaseBatchReadiness, type ReleaseBatchReadinessRepo } from "@/lib/integrations/airflow/releaseBatchReadiness";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { releaseBatchObservationBindingSchema, checkpointReleaseBatchObservation } from "./releaseBatchObservationCheckpoint";
import { claimReleaseBatchObservation } from "./releaseBatchObservationLease";

/** One internal read-only observation. No scheduler, public endpoint, inference,
 * merge, workflow dispatch or approval consumption. Ready pauses for preflight.
 */
export async function runReleaseBatchObservation(input: {
  organizationId: string; workflowRunId: string; expectedVersion: number; workerId: string;
}) {
  const { organizationId, workflowRunId, expectedVersion, workerId } = input;
  const claim = await claimReleaseBatchObservation({ organizationId, workflowRunId, expectedVersion, workerId });
  if (!claim) return { observed: false };
  if (claim.organizationId !== organizationId || claim.id !== workflowRunId || claim.version !== expectedVersion + 1) throw new Error("Observation claim identity changed.");
  const binding = releaseBatchObservationBindingSchema.parse(claim.inputJson);
  const controller = new AbortController();
  async function actorCurrent() {
    if (controller.signal.aborted) return false;
    const [membership, access] = await Promise.all([
      prisma.orgMembership.findUnique({ where: { userId_organizationId: { userId: claim!.requestedByUserId, organizationId } }, select: { acceptedAt: true, role: true } }),
      readDesktopCommercialAccess(organizationId),
    ]);
    return !controller.signal.aborted && !!membership?.acceptedAt && ["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"].includes(membership.role)
      && hasDesktopCapability(membership.role as DesktopWorkspaceRole, "workspace:read") && access.allowed;
  }
  async function releaseCurrent() {
    if (controller.signal.aborted) return false;
    const row = await prisma.tauriDeploymentRequest.findFirst({ where: { id: binding.requestId, organizationId } });
    return !controller.signal.aborted && !!row && row.id === binding.requestId && row.organizationId === organizationId && row.status === "submitted" && row.version === binding.requestVersion
      && sha256ContentHash({ requestVersion: row.version, intake: row.intakeJson }) === binding.intakeDigest;
  }
  type Observation = "ready" | "waiting" | "changed" | "unavailable";
  async function observe(): Promise<Observation> {
    try {
      if (Date.now() < binding.startedAt || Date.now() >= binding.deadlineAt || !await actorCurrent()) return "unavailable";
      if (!await releaseCurrent()) return "changed";
      if (controller.signal.aborted) return "unavailable";
      const result = await readReleaseBatchReadiness(prisma as unknown as ReleaseBatchReadinessRepo,
        { organizationId, requestId: binding.requestId, expectedVersion: binding.requestVersion, signal: controller.signal });
      if (controller.signal.aborted || !await actorCurrent()) return "unavailable";
      if (!await releaseCurrent()) return "changed";
      return result.ready ? result.requestVersion === binding.requestVersion ? "ready" : "changed" : result.reason;
    } catch { return "unavailable"; }
  }
  const budget = Math.max(0, Math.min(45_000, binding.deadlineAt - Date.now(), claim.leaseExpiresAt!.getTime() - Date.now() - 5_000));
  let timer: ReturnType<typeof setTimeout> | undefined;
  let observation: Observation;
  try {
    observation = await Promise.race([observe(), new Promise<Observation>(resolve => {
      timer = setTimeout(() => { controller.abort(); resolve("unavailable"); }, budget);
    })]);
  } finally { if (timer !== undefined) clearTimeout(timer); controller.abort(); }
  await checkpointReleaseBatchObservation({ organizationId, workflowRunId, workerId, expectedVersion: claim.version, observation, now: new Date() });
  return { observed: true };
}
