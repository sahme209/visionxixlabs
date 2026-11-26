import "server-only";
import { hasDesktopCapability, type DesktopWorkspaceRole } from "@/lib/desktop/desktopAuthorization";
import { loadSignalConnection } from "@/lib/integrations/signals/signalConnection";
import { ArgoCdClient } from "@/lib/integrations/argocd/argoCdClient";
import { FluxClient } from "@/lib/integrations/flux/fluxClient";
import type { CloudObservationContext } from "./cloudObservation";

/**
 * Agent tool read_gitops_state: read-only application state from the workspace's connected Argo CD and
 * Flux (sync/readiness and the applied commit), so the Agent can explain whether a cluster runs what V19
 * deployed. Authority is rechecked before and after the reads. Never syncs, reconciles or suspends.
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

export async function executeGitopsStateTool(organizationId: string, args: Record<string, unknown>, context?: CloudObservationContext): Promise<Result> {
  if (!context || context.principal.organizationId !== organizationId) return { ok: false, error: "paired_gitops_observation_required" };
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).length > 0) return { ok: false, error: "invalid_gitops_args" };
  try {
    await assertAuthority(context);
    const [argo, flux] = await Promise.all([
      loadSignalConnection(organizationId, "argo_cd").then(async (c) => (await new ArgoCdClient(c.settings.baseUrl, c.settings.project, { authMode: "bearer", token: c.secret.token }).listApplications()), () => null),
      loadSignalConnection(organizationId, "flux").then(async (c) => (await new FluxClient(c.settings.baseUrl, c.settings.namespace, { authMode: "bearer", token: c.secret.token }).listKustomizations()), () => null),
    ]);
    await assertAuthority(context);
    if (argo === null && flux === null) return { ok: false, error: "gitops_not_connected" };
    return { ok: true, result: { kind: "gitops_observation", authority: "observation_only", observedAt: new Date().toISOString(), coverage: { maximumEntries: MAX }, argoCd: argo?.slice(0, MAX) ?? null, flux: flux?.slice(0, MAX) ?? null } };
  } catch {
    return { ok: false, error: "gitops_observation_unavailable" };
  }
}
