import "server-only";
import { hasDesktopCapability, type DesktopWorkspaceRole } from "@/lib/desktop/desktopAuthorization";
import { loadSignalConnection } from "@/lib/integrations/signals/signalConnection";
import { JenkinsReadClient } from "@/lib/integrations/jenkins/jenkinsReadClient";
import type { CloudObservationContext } from "./cloudObservation";

/**
 * Agent tool read_ci_jobs: jobs and their last build from the workspace's connected Jenkins, read-only.
 * Authority is rechecked before and after the read. Never starts, aborts or configures a job.
 */
type Result = { ok: true; result: Record<string, unknown> } | { ok: false; error: string };
const roles: readonly DesktopWorkspaceRole[] = ["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"];
const MAX = 20;

async function assertAuthority(context: CloudObservationContext) {
  const { principal, repo } = context;
  const [device, member] = await Promise.all([
    repo.desktopSessionRecord.findUnique({ where: { id: principal.sessionId } }),
    repo.orgMembership.findUnique({ where: { userId_organizationId: { userId: principal.userId, organizationId: principal.organizationId } } }),
  ]);
  if (!device || device.id !== principal.sessionId || device.userId !== principal.userId || device.organizationId !== principal.organizationId || device.revokedAt || device.expiresAt <= new Date()
    || !member?.acceptedAt || !roles.includes(member.role) || !hasDesktopCapability(member.role, "workspace:read")) throw new Error("authority_unavailable");
}

export async function executeCiJobsTool(organizationId: string, args: Record<string, unknown>, context?: CloudObservationContext): Promise<Result> {
  if (!context || context.principal.organizationId !== organizationId) return { ok: false, error: "paired_ci_observation_required" };
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length > 0) return { ok: false, error: "invalid_ci_jobs_args" };
  try {
    await assertAuthority(context);
    const connection = await loadSignalConnection(organizationId, "jenkins").catch(() => null);
    if (!connection) return { ok: false, error: "jenkins_not_connected" };
    const jobs = await new JenkinsReadClient(connection.settings.baseUrl, connection.settings.user, connection.secret.token).listJobs();
    await assertAuthority(context);
    const failing = jobs.filter((j) => j.lastBuild?.result === "FAILURE" || j.lastBuild?.result === "UNSTABLE");
    return { ok: true, result: { kind: "ci_jobs_observation", provider: "jenkins", authority: "observation_only", observedAt: new Date().toISOString(), coverage: { maximumEntries: MAX }, failingCount: failing.length, jobs: [...failing, ...jobs.filter((j) => !failing.includes(j))].slice(0, MAX), truncated: jobs.length > MAX } };
  } catch {
    return { ok: false, error: "ci_jobs_observation_unavailable" };
  }
}
