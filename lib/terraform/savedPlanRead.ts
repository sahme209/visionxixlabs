import "server-only";
import { openSavedPlan, readSavedPlanMetadata, type SavedPlanProjection, type SavedPlanMetadata } from "./savedPlanArtifact";
import { readSavedPlanStorageReadiness, listSavedPlanRecords, type SavedPlanDatabase } from "./savedPlanStore";
import { evaluateTerraformBoundary } from "@/lib/execution/terraformBoundary";

export type SavedPlanReadResult = { status: number; body:
  | { ok: true; data: { plans: Array<SavedPlanProjection | SavedPlanMetadata>; truncated: boolean; producer: "unavailable"; executionEnabled: false } }
  | { ok: false; error: string } };

/** Auth is supplied by the paired route. Stored evidence is a read projection,
 * never permission to plan/apply or a current target/approval attestation. */
export async function readSavedPlans(db: SavedPlanDatabase, scope: { organizationId: string; requestId: string }, artifactId?: string, now = new Date()): Promise<SavedPlanReadResult> {
  const failure = (status: number, error: string): SavedPlanReadResult => ({ status, body: { ok: false, error } });
  try {
    const [parent] = await db.$queryRawUnsafe<Array<{ id: string; organizationId: string; version: number }>>('SELECT "id","organizationId","version" FROM public."TauriDeploymentRequest" WHERE "organizationId"=$1 AND "id"=$2', scope.organizationId, scope.requestId);
    if (!parent || parent.id !== scope.requestId || parent.organizationId !== scope.organizationId) return failure(404, "not_found");
    const readiness = await readSavedPlanStorageReadiness(db);
    if (readiness !== "ready") return failure(503, `saved_plan_storage_${readiness}`);
    const rows = await listSavedPlanRecords(db, scope, artifactId);
    if (artifactId !== undefined && (rows.length !== 1 || rows[0].id !== artifactId)) return failure(404, "not_found");
    const plans = rows.slice(0, 20).map(row => (artifactId === undefined ? readSavedPlanMetadata : openSavedPlan)(row, { ...scope, requestVersion: parent.version }, now));
    const boundary = evaluateTerraformBoundary({ provider: "platform", brokerCredentialsPresent: false, applyFeatureFlagOn: false, auditSinkReady: false, desktopSigningReady: false });
    if (boundary.applyAvailable) return failure(503, "saved_plan_execution_boundary_unavailable");
    return { status: 200, body: { ok: true, data: { plans, truncated: rows.length > 20, producer: "unavailable", executionEnabled: false } } };
  } catch { return failure(409, "saved_plan_evidence_unavailable"); }
}
