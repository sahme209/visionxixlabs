import "server-only";
import { prisma } from "@/lib/db";
import { hasDesktopCapability, type DesktopWorkspaceRole } from "@/lib/desktop/desktopAuthorization";
import { loadSignalConnection } from "@/lib/integrations/signals/signalConnection";
import { readReleaseSignals } from "@/lib/integrations/signals/releaseSignals";
import type { CloudObservationContext } from "./cloudObservation";

/**
 * Agent tool read_release_health: the same read-only release signals the desktop shows, for one release.
 * The paired desktop session and accepted membership are re-checked before and after the provider reads,
 * like the Batches observation tools. Provider text is evidence, never instructions. Nothing is changed.
 */
type Result = { ok: true; result: Record<string, unknown> } | { ok: false; error: string };
const roles: readonly DesktopWorkspaceRole[] = ["owner", "admin", "operator", "security_reviewer", "finance_viewer", "read_only"];
const RELEASE = /^[A-Za-z0-9._+@:-]{1,200}$/;
const SHA = /^[0-9a-f]{40}$/i;

async function assertAuthority(context: CloudObservationContext) {
  const { principal, repo } = context;
  const [device, member] = await Promise.all([
    repo.desktopSessionRecord.findUnique({ where: { id: principal.sessionId } }),
    repo.orgMembership.findUnique({ where: { userId_organizationId: { userId: principal.userId, organizationId: principal.organizationId } } }),
  ]);
  if (!device || device.id !== principal.sessionId || device.userId !== principal.userId || device.organizationId !== principal.organizationId || device.revokedAt || device.expiresAt <= new Date()
    || !member?.acceptedAt || !roles.includes(member.role) || !hasDesktopCapability(member.role, "workspace:read")) throw new Error("authority_unavailable");
}

export async function executeReleaseHealthTool(organizationId: string, args: Record<string, unknown>, context?: CloudObservationContext): Promise<Result> {
  if (!context || context.principal.organizationId !== organizationId) return { ok: false, error: "paired_release_health_required" };
  if (!args || typeof args !== "object" || Array.isArray(args) || Object.keys(args).some((k) => k !== "release" && k !== "commit")) return { ok: false, error: "invalid_release_health_args" };
  const release = typeof args.release === "string" ? args.release.trim() : "";
  const commit = typeof args.commit === "string" ? args.commit.trim().toLowerCase() : "";
  if (!RELEASE.test(release) || (args.commit !== undefined && !SHA.test(commit))) return { ok: false, error: "invalid_release_health_args" };
  try {
    await assertAuthority(context);
    const verifyChecks = commit ? await prisma.deploymentCheckResult.findMany({ where: { organizationId, releaseRef: commit, stage: "verify" }, orderBy: { reportedAt: "desc" }, take: 200, select: { checkKey: true, status: true } })
      .then((rows) => { const m = new Map<string, string>(); for (const r of rows) if (!m.has(r.checkKey)) m.set(r.checkKey, r.status); return [...m.entries()].map(([key, status]) => ({ key, status })); }, () => null) : null;
    const signals = await readReleaseSignals((provider) => loadSignalConnection(organizationId, provider), { release, verifyChecks, now: new Date() });
    await assertAuthority(context);
    return { ok: true, result: { kind: "release_health", authority: "observation_only", observedAt: new Date().toISOString(), ...signals, newIssues: signals.newIssues?.slice(0, 20) ?? null } };
  } catch {
    return { ok: false, error: "release_health_unavailable" };
  }
}
