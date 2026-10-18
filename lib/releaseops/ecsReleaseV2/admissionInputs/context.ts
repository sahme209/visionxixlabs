import "server-only";
import type { EnrollmentPrincipal } from "@/lib/cloud/aws/enrollment/service";
import { hasDesktopCapability } from "@/lib/desktop/desktopAuthorization";
import { readGithubBuildSnapshotInTransaction, type GithubBuildSnapshotClient } from "../githubBuildSnapshot";
import { validGithubBuildSnapshot, type GithubBuildRequest, type GithubBuildSnapshot } from "../githubBuildEvidence";
import { projectTargetSnapshot } from "../targetSnapshot";
import type { TargetSnapshot } from "../contract";

export interface EcsInputSelectors {
  repositoryRecordId: string;
  environmentId: string;
  cloudAccountId: string;
  baselineArn: string;
  proposedArn: string;
  build: GithubBuildRequest["expected"];
}
type CurrentGithubSnapshot = GithubBuildSnapshot & {
  membership: GithubBuildSnapshot["membership"] & { providerScopes: string[] };
  environment: GithubBuildSnapshot["environment"] & { tier: "dev" | "test" | "stage" };
  installation: GithubBuildSnapshot["installation"] & { accountType: "User" | "Organization"; repositorySelection: "all" | "selected" };
};
export interface EcsAdmissionContextV1 {
  schema: "axiom.ecs.checked-input-context.v1";
  session: { id: string; organizationId: string; userId: string; issuedAt: string; expiresAt: string; revokedAt: null };
  github: CurrentGithubSnapshot;
  target: TargetSnapshot;
  configurationDigest: string;
}
const finiteDate = (date: unknown): date is Date => date instanceof Date && Number.isFinite(date.getTime());
/** Current inputs only. No authorization permit, policy-fact proof, packet or durable claim. */
export async function readEcsAdmissionContext(client: GithubBuildSnapshotClient, principal: EnrollmentPrincipal, selectors: EcsInputSelectors, configurationDigest: string, now: Date): Promise<EcsAdmissionContextV1 | null> {
  principal = structuredClone(principal); selectors = structuredClone(selectors); now = new Date(now);
  return client.$transaction(async tx => {
    const session = await tx.desktopSessionRecord.findUnique({ where: { id: principal.sessionId }, select: { id: true, organizationId: true, userId: true, issuedAt: true, expiresAt: true, revokedAt: true } });
    if (!session || session.id !== principal.sessionId || session.organizationId !== principal.organizationId || session.userId !== principal.userId
      || session.revokedAt !== null || !finiteDate(now) || !finiteDate(session.issuedAt) || !finiteDate(session.expiresAt)
      || session.issuedAt > now || session.expiresAt <= now) return null;
    const scope = { organizationId: principal.organizationId, userId: principal.userId };
    const request = { repositoryRecordId: selectors.repositoryRecordId, environmentId: selectors.environmentId, policyDigest: "", expected: selectors.build };
    const github = await readGithubBuildSnapshotInTransaction(tx, scope, request);
    if (!github || !validGithubBuildSnapshot(github, scope, { ...request, policyDigest: github.policy.digest })
      || new Date(github.membership.acceptedAt ?? "invalid") > now
      || !["owner", "admin"].includes(github.membership.role)
      || !hasDesktopCapability(github.membership.role === "owner" ? "owner" : "admin", "connections:manage")) return null;
    const providerScopes = github.membership.providerScopes;
    if (!Array.isArray(providerScopes) || providerScopes.length > 100 || !providerScopes.every(scope => typeof scope === "string" && /^[a-z][a-z0-9_-]{0,49}$/.test(scope))
      || (providerScopes.length > 0 && !providerScopes.includes("aws"))) return null;
    const tier = github.environment.tier, accountType = github.installation.accountType, repositorySelection = github.installation.repositorySelection;
    if ((tier !== "dev" && tier !== "test" && tier !== "stage") || (accountType !== "User" && accountType !== "Organization") || (repositorySelection !== "all" && repositorySelection !== "selected")) return null;
    const [target, account, credential] = await Promise.all([
      tx.deploymentTarget.findUnique({ where: { environmentId: selectors.environmentId }, select: { id: true, organizationId: true, environmentId: true, provider: true, roleArn: true, region: true, ecsCluster: true, ecsService: true, updatedAt: true } }),
      tx.cloudAccount.findFirst({ where: { id: selectors.cloudAccountId, organizationId: principal.organizationId, provider: "aws" }, select: { id: true, organizationId: true, provider: true, externalAccountId: true, credentialRef: true, regions: true, enabled: true, updatedAt: true } }),
      tx.cloudAccountCredential.findFirst({ where: { id: selectors.cloudAccountId, organizationId: principal.organizationId }, select: { id: true, organizationId: true, version: true, revokedAt: true } }),
    ]);
    if (!target || !account || !credential || account.id !== selectors.cloudAccountId || target.environmentId !== selectors.environmentId) return null;
    const environment = { id: github.environment.id, organizationId: github.environment.organizationId, updatedAt: new Date(github.environment.updatedAt) };
    const snapshot = projectTargetSnapshot({ target, environment, account, credential });
    if (!snapshot) return null;
    const partition = target.roleArn.split(":")[1], prefix = `arn:${partition}:ecs:${target.region}:${account.externalAccountId}:task-definition/`;
    if (selectors.baselineArn === selectors.proposedArn || ![selectors.baselineArn, selectors.proposedArn].every(arn => typeof arn === "string" && arn.startsWith(prefix) && /^[A-Za-z0-9_-]{1,255}:[1-9][0-9]{0,9}$/.test(arn.slice(prefix.length)))) return null;
    return {
      schema: "axiom.ecs.checked-input-context.v1",
      session: { id: session.id, organizationId: session.organizationId, userId: session.userId, issuedAt: session.issuedAt.toISOString(), expiresAt: session.expiresAt.toISOString(), revokedAt: null },
      github: { ...github, membership: { ...github.membership, providerScopes: [...providerScopes] }, environment: { ...github.environment, tier }, installation: { ...github.installation, accountType, repositorySelection } },
      target: snapshot, configurationDigest,
    };
  }, { isolationLevel: "Serializable", maxWait: 3_000, timeout: 5_000 });
}
