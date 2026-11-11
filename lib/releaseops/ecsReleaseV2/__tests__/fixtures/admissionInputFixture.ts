import type { PrismaClient } from "@/lib/prismaClient";
import type { createEcsCheckedInputReader } from "../../admissionInputs/read";
import { vi } from "vitest";
import type { GithubBuildSnapshotClient } from "../../githubBuildSnapshot";
import { directBinding } from "./directWorkflowFixture";
export const now = new Date("2026-10-16T12:00:00Z");
export const principal = { organizationId: "org", userId: "admin", sessionId: "session" };
export const date = new Date("2026-10-16T00:00:00Z");
const { organizationId: _organizationId, sourceRef: _sourceRef, ...expectedBuild } = directBinding;
void _organizationId; void _sourceRef;
export const selectors = { repositoryRecordId: "repo", environmentId: "env", cloudAccountId: "account", baselineArn: "arn:aws:ecs:us-east-1:123456789012:task-definition/app:1", proposedArn: "arn:aws:ecs:us-east-1:123456789012:task-definition/app:2", build: expectedBuild };
export function contextFixture() {
  const session = { id: "session", ...principal, issuedAt: date, expiresAt: new Date("2026-10-17T00:00:00Z"), revokedAt: null as Date | null };
  const member = { id: "member", organizationId: "org", userId: "admin", role: "admin", providerScopes: [] as string[], acceptedAt: date as Date | null, updatedAt: date };
  const repository = { id: "repo", organizationId: "org", provider: "github", remoteOwner: "github", remoteName: "artifact-attestations-workflows", updatedAt: date };
  const environment = { id: "env", organizationId: "org", approvalPolicyId: "policy", tier: "stage", updatedAt: date };
  const installation = { id: "install", organizationId: "org", githubInstallationId: "19", accountLogin: "github", accountType: "Organization", repositorySelection: "selected", status: "active", installedAt: date, updatedAt: date, revokedAt: null, suspendedAt: null };
  const target = { id: "target", organizationId: "org", environmentId: "env", provider: "aws", roleArn: "arn:aws:iam::123456789012:role/axiom", region: "us-east-1", ecsCluster: "app", ecsService: "web", updatedAt: date };
  const account = { id: "account", organizationId: "org", provider: "aws", externalAccountId: "123456789012", credentialRef: "cloud-v2:account", regions: ["us-east-1"], enabled: false, updatedAt: date };
  const credential = { id: "account", organizationId: "org", version: 1, revokedAt: null as Date | null };
  const policy = { id: "policy", enabled: true, blockAction: false, requiredApprovals: 2, requiredRoles: ["admin"], updatedAt: date };
  const branchPolicies: unknown[] = [];
  const tx = { desktopSessionRecord: { findUnique: vi.fn(async () => session) }, orgMembership: { findUnique: vi.fn(async () => member) }, repository: { findFirst: vi.fn(async () => repository) }, environment: { findFirst: vi.fn(async () => environment) }, gitHubInstallation: { findFirst: vi.fn(async () => installation) }, branchEnvironmentPolicy: { findMany: vi.fn(async () => branchPolicies) }, deploymentTarget: { findUnique: vi.fn(async () => target) }, cloudAccount: { findFirst: vi.fn(async () => account) }, cloudAccountCredential: { findFirst: vi.fn(async () => credential) }, $queryRawUnsafe: vi.fn(async () => [policy]), $executeRawUnsafe: vi.fn() };
  const transaction = vi.fn(async (operation: (value: typeof tx) => Promise<unknown>) => operation(tx));
  const client = { $transaction: transaction } as unknown as GithubBuildSnapshotClient;
  return { client, tx, transaction, session, member, repository, environment, installation, target, account, credential, policy, branchPolicies };
}

// Compile-time source assertion: real Prisma needs no cast, authorization stub or write facade.
type Assert<T extends true> = T;
export type ActualPrismaCheckedInputClient = Assert<PrismaClient extends Parameters<typeof createEcsCheckedInputReader>[0]["client"] ? true : false>;
