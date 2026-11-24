import {afterEach, beforeEach, expect, it, vi} from "vitest";
import {connectionCredentialContext} from "@/lib/integrations/tenantAuthorization";
import {encryptScopedCredential} from "@/lib/security/credentialVault";
import type {PrismaClient} from "@/lib/prismaClient";
import {createScopedGitLabEvidenceReader, createStoredGitLabEvidenceReader, createStoredGitLabEvidenceSync} from "../gitlabScopedEvidence";

beforeEach(() => vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY", "synthetic-vault-fixture-only".repeat(2)));
afterEach(() => vi.unstubAllEnvs());

function fixture(signal?: AbortSignal) {
  const now = Date.now();
  const binding = {organizationId: "workspace", userId: "reader", repositoryId: "repo-17", connectionId: "connection"};
  const project = {owner: "test/group", name: "repository"};
  const context = connectionCredentialContext({...binding, provider: "gitlab"});
  const credential = {type: "project", projectId: "17", ...project, token: "synthetic-token", expiresAt: now + 60_000};
  const connection = {
    id: binding.connectionId, organizationId: binding.organizationId, provider: "gitlab",
    status: "active", scopesJson: ["read_api"], externalAccountId: "17", consentedByUserId: "workspace-owner",
    consentedAt: new Date(now - 2000), updatedAt: new Date(now - 1000),
    lastValidatedAt: new Date(now - 1000), revokedAt: null as Date | null,
  };
  const snapshot = {
    mayReadRepository: true,
    repository: {id: binding.repositoryId, organizationId: binding.organizationId, provider: "gitlab", remoteOwner: project.owner, remoteName: project.name},
    connection,
    encryptedCredential: encryptScopedCredential(JSON.stringify(credential), context),
  };
  const readCurrent = vi.fn(async () => snapshot);
  const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([{
    id: 4, sha: "a".repeat(40), status: "success",
    web_url: "https://gitlab.com/test/group/repository/-/pipelines/4",
  }]));
  const reader = createScopedGitLabEvidenceReader(binding, {readCurrent, fetchImpl, signal});
  return {binding, project, context, credential, snapshot, readCurrent, fetchImpl, reader};
}

it("checks current workspace authority before and after the bound project read", async () => {
  const f = fixture();
  await expect(f.reader.listPipelines(f.project, {})).resolves.toMatchObject([{id: 4}]);
  expect(f.readCurrent).toHaveBeenCalledTimes(2);
  expect(f.readCurrent).toHaveBeenCalledWith(f.binding, expect.any(AbortSignal));
  expect(f.fetchImpl).toHaveBeenCalledTimes(1);
  expect(f.fetchImpl.mock.calls[0][0]).toMatchObject({pathname: "/api/v4/projects/17/pipelines"});
});

const invalidGrants: Array<[string, (f: ReturnType<typeof fixture>) => void]> = [
  ["membership", f => { f.snapshot.mayReadRepository = false; }],
  ["repository workspace", f => { f.snapshot.repository.organizationId = "another-workspace"; }],
  ["project", f => { f.snapshot.repository.remoteName = "different-project"; }],
  ["connection identity", f => { f.snapshot.connection.id = "different-connection"; }],
  ["connection workspace", f => { f.snapshot.connection.organizationId = "another-workspace"; }],
  ["revocation", f => { f.snapshot.connection.revokedAt = new Date(); }],
  ["paused connection", f => { f.snapshot.connection.status = "suspended"; }],
  ["stale validation", f => { f.snapshot.connection.lastValidatedAt = new Date(0); }],
  ["future validation", f => { f.snapshot.connection.lastValidatedAt = new Date(Date.now() + 60_000); }],
  ["write grant", f => { f.snapshot.connection.scopesJson.push("api"); }],
  ["project identity", f => { f.snapshot.connection.externalAccountId = "18"; }],
  ["expiry", f => {
    f.snapshot.encryptedCredential = encryptScopedCredential(JSON.stringify({...f.credential, expiresAt: Date.now() - 1}), f.context);
  }],
  ["altered vault context", f => {
    f.snapshot.encryptedCredential = encryptScopedCredential(JSON.stringify(f.credential), "unrelated-vault-context");
  }],
];

it.each(invalidGrants)("refuses invalid %s before contacting the provider", async (_name, alter) => {
  const f = fixture();
  alter(f);
  await expect(f.reader.listPipelines(f.project, {})).rejects.toThrow(/^gitlab_evidence_unavailable$/);
  expect(f.fetchImpl).not.toHaveBeenCalled();
});

it.each(["membership", "revocation", "replacement"] as const)("drops evidence after a concurrent %s change", async change => {
  const f = fixture();
  const first = f.fetchImpl.getMockImplementation()!;
  f.fetchImpl.mockImplementationOnce(async (...args) => {
    if (change === "membership") f.snapshot.mayReadRepository = false;
    if (change === "revocation") f.snapshot.connection.revokedAt = new Date();
    if (change === "replacement") {
      f.snapshot.encryptedCredential = encryptScopedCredential(JSON.stringify(f.credential), f.context);
    }
    return first(...args);
  });
  await expect(f.reader.listPipelines(f.project, {})).rejects.toThrow(/^gitlab_evidence_unavailable$/);
  expect(f.readCurrent).toHaveBeenCalledTimes(2);
  expect(f.fetchImpl).toHaveBeenCalledTimes(1);
});

it("propagates request cancellation to a pending provider read", async () => {
  const abort = new AbortController();
  const f = fixture(abort.signal);
  f.fetchImpl.mockImplementationOnce(async () => { abort.abort(); return new Promise(() => {}); });
  await expect(f.reader.listPipelines(f.project, {})).rejects.toThrow(/^gitlab_evidence_unavailable$/);
  expect(f.fetchImpl).toHaveBeenCalledTimes(1);
});

function storedFixture() {
  const f = fixture();
  const member = {acceptedAt: new Date() as Date | null, role: "operator", providerScopes: ["gitlab"]};
  const tx = {
    orgMembership: {findUnique: vi.fn(async () => member)},
    repository: {findFirst: vi.fn(async () => f.snapshot.repository)},
    tenantIntegrationConnection: {findFirst: vi.fn(async () => ({
      ...f.snapshot.connection, encryptedCredential: f.snapshot.encryptedCredential,
    }))},
  };
  let transactionOpen = false;
  const transaction = vi.fn(async (read: (port: typeof tx) => Promise<unknown>) => {
    transactionOpen = true;
    try { return await read(tx); } finally { transactionOpen = false; }
  });
  const canReadRepository = vi.fn(() => true);
  const transport = f.fetchImpl.getMockImplementation()!;
  f.fetchImpl.mockImplementation((...args) => {
    expect(transactionOpen).toBe(false);
    return transport(...args);
  });
  const reader = createStoredGitLabEvidenceReader(
    {$transaction: transaction} as unknown as Pick<PrismaClient, "$transaction">,
    f.binding, {canReadRepository, fetchImpl: f.fetchImpl},
  );
  return {...f, tx, transaction, member, canReadRepository, reader};
}

it("reads current membership, repository and matching consent in separate snapshots around transport", async () => {
  const f = storedFixture();
  await expect(f.reader.listPipelines(f.project, {})).resolves.toMatchObject([{id: 4}]);
  const {organizationId, userId, repositoryId, connectionId} = f.binding;
  expect(f.transaction).toHaveBeenCalledTimes(2);
  expect(f.transaction).toHaveBeenCalledWith(expect.any(Function), expect.objectContaining({isolationLevel: "RepeatableRead"}));
  expect(f.tx.orgMembership.findUnique).toHaveBeenCalledWith(expect.objectContaining({
    where: {userId_organizationId: {userId, organizationId}},
  }));
  expect(f.tx.repository.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: {id: repositoryId, organizationId, provider: "gitlab"},
  }));
  expect(f.tx.tenantIntegrationConnection.findFirst).toHaveBeenCalledWith(expect.objectContaining({
    where: {id: connectionId, organizationId, provider: "gitlab"},
  }));
  expect(f.canReadRepository).toHaveBeenCalledWith("operator", f.snapshot.repository);
});

it.each(["pending", "provider scope", "repository policy"] as const)("withholds credentials for a denied %s", async kind => {
  const f = storedFixture();
  if (kind === "pending") f.member.acceptedAt = null;
  if (kind === "provider scope") f.member.providerScopes = ["github"];
  if (kind === "repository policy") f.canReadRepository.mockReturnValue(false);
  await expect(f.reader.listPipelines(f.project, {})).rejects.toThrow(/^gitlab_evidence_unavailable$/);
  expect(f.tx.tenantIntegrationConnection.findFirst).not.toHaveBeenCalled();
  expect(f.fetchImpl).not.toHaveBeenCalled();
});

it("discards evidence when the current repository policy denies a previously allowed read", async () => {
  const f = storedFixture();
  f.canReadRepository.mockReturnValueOnce(true).mockReturnValueOnce(false);
  await expect(f.reader.listPipelines(f.project, {})).rejects.toThrow(/^gitlab_evidence_unavailable$/);
  expect(f.fetchImpl).toHaveBeenCalledTimes(1);
  expect(f.tx.tenantIntegrationConnection.findFirst).toHaveBeenCalledTimes(1);
});

it("reports an unconfirmed commit without attempting the evidence write again", async () => {
  const f = storedFixture();
  const upsert = vi.fn(async (_write: {create: Record<string, unknown>}) => ({}));
  const tx = {...f.tx, $queryRaw: vi.fn(async () => [{id: "locked"}]), workflowRunRecord: {upsert}};
  const transaction = vi.fn(async (callback: (port: typeof tx) => Promise<unknown>) => {
    const result = await callback(tx);
    if (upsert.mock.calls.length) throw new Error("connection closed");
    return result;
  });
  const sync = createStoredGitLabEvidenceSync(
    {$transaction: transaction} as unknown as Pick<PrismaClient, "$transaction">,
    f.binding, {canReadRepository: f.canReadRepository, fetchImpl: f.fetchImpl},
  );
  await expect(sync("workflow_runs", f.project)).rejects.toThrow(/^gitlab_evidence_persistence_unconfirmed$/);
  expect(transaction).toHaveBeenCalledTimes(2);
  expect(upsert).toHaveBeenCalledTimes(1);
  const [write] = upsert.mock.calls[0];
  expect(write.create).not.toHaveProperty("observedAt");
  expect(write.create.lastSyncedAt).toBeInstanceOf(Date);
});
