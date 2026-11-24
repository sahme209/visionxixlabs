import { realpathSync, statSync } from "node:fs";
import { PrismaClient } from "@/lib/prismaClient";
import { PrismaPg } from "@prisma/adapter-pg";
import { expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST as syncRepository } from "@/app/api/dashboard/repository-sync/route";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { decryptScopedCredential, encryptScopedCredential } from "@/lib/security/credentialVault";
import { readGitLabSetupState, registerPendingGitLabReadConnection, revokeGitLabReadConnection } from "../gitlabPendingRegistration";
import { activateGitLabReadConnection } from "../gitlabReadActivation";
import { createStoredGitLabEvidenceReader, createStoredGitLabEvidenceSync } from "../gitlabScopedEvidence";

const routePorts = vi.hoisted(() => ({db: null as PrismaClient | null, session: vi.fn()}));
vi.mock("@/lib/auth/currentContext", () => ({currentContext: routePorts.session}));
vi.mock("@/lib/db", () => ({get prisma() { return routePorts.db; }}));

const host = process.env.V19_GITLAB_OWNED_SOCKET;

async function ownedDatabase() {
  if (!host || !/^\/(?:private\/)?tmp\/v19-gitlab-owned-[^/]+\/socket$/.test(host)) throw Error("owned socket required");
  const socket = statSync(realpathSync(host));
  if ((socket.mode & 0o077) !== 0 || socket.uid !== process.getuid?.()) throw Error("owned socket required");
  const db = new PrismaClient({adapter: new PrismaPg({host, user: "v19_fixture", database: "postgres"})});
  try {
    const [identity] = await db.$queryRaw<{owned: boolean}[]>`SELECT current_user = 'v19_fixture' AND current_setting('listen_addresses') = '' AS owned`;
    if (!identity?.owned) throw Error("owned socket required");
    return db;
  } catch (error) {
    await db.$disconnect();
    throw error;
  }
}

it.skipIf(!host)("atomically saves all GitLab slices and rolls back refused writes", async () => {
  const db = await ownedDatabase();
  const binding = {organizationId: "org-one", userId: "user-one", repositoryId: "repository-one", connectionId: "connection-one"};
  const project = {owner: "fixture/group", name: "repo"};
  const expiry = Date.now() + 60_000;
  const ciphertext = encryptScopedCredential(JSON.stringify({
    type: "project", projectId: "17", ...project, token: "fixture-token", expiresAt: expiry,
  }), connectionCredentialContext({...binding, provider: "gitlab"}));
  try {
    await db.orgMembership.create({data: {organizationId: binding.organizationId, userId: binding.userId, role: "owner", acceptedAt: new Date()}});
    await db.repository.create({data: {id: binding.repositoryId, organizationId: binding.organizationId,
      provider: "gitlab", remoteOwner: project.owner, remoteName: project.name, remoteUrl: "https://gitlab.com/fixture/group/repo.git"}});
    await db.tenantIntegrationConnection.create({data: {
      id: binding.connectionId, organizationId: binding.organizationId, provider: "gitlab", status: "active",
      encryptedCredential: ciphertext, externalAccountId: "17", scopesJson: ["read_api"],
      consentedByUserId: binding.userId, consentedAt: new Date(Date.now() - 1_000), lastValidatedAt: new Date(),
    }});
    const sha = "a".repeat(40);
    const pipeline = {id: 24, sha, status: "success", web_url: "https://gitlab.com/fixture/group/repo/-/pipelines/24"};
    const release = {tag_name: "v1.0.0", commit: {id: sha}, released_at: "2026-11-23T00:00:00Z"};
    const mr = {iid: 2, title: "Fixture", source_branch: "dev", target_branch: "main", author: {username: "dev"},
      sha, state: "opened", web_url: "https://gitlab.com/fixture/group/repo/-/merge_requests/2"};
    const provider = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => Response.json([pipeline]))
      .mockImplementationOnce(async () => Response.json([release]))
      .mockImplementationOnce(async () => Response.json([mr]));
    const sync = createStoredGitLabEvidenceSync(db, binding, {canReadRepository: role => role === "owner", fetchImpl: provider});
    for (const kind of ["workflow_runs", "releases", "pull_requests"] as const) {
      await expect(sync(kind, project)).resolves.toEqual({fetched: 1, upserted: 1});
    }
    expect(await db.workflowRunRecord.findFirst()).toMatchObject({externalRunId: "24", organizationId: binding.organizationId});
    expect(await db.releaseTagRecord.findFirst()).toMatchObject({tagName: "v1.0.0", organizationId: binding.organizationId});
    expect(await db.pullRequestRecord.findFirst()).toMatchObject({number: 2, organizationId: binding.organizationId});

    provider.mockImplementationOnce(async () => {
      await db.orgMembership.updateMany({where: {organizationId: binding.organizationId, userId: binding.userId},
        data: {providerScopes: ["github"]}});
      return Response.json([{...pipeline, id: 25}]);
    });
    await expect(sync("workflow_runs", project)).rejects.toThrow("gitlab_evidence_unavailable");
    expect(await db.workflowRunRecord.count()).toBe(1);
    await db.orgMembership.updateMany({where: {organizationId: binding.organizationId, userId: binding.userId},
      data: {providerScopes: ["gitlab"]}});
    await db.$executeRawUnsafe('ALTER TABLE "WorkflowRunRecord" ADD CONSTRAINT "fixture_reject_one" CHECK ("externalRunId" <> \'29\')');
    provider.mockImplementationOnce(async () => Response.json([{...pipeline, id: 28}, {...pipeline, id: 29}]));
    await expect(sync("workflow_runs", project)).rejects.toThrow("gitlab_evidence_unavailable");
    expect(await db.workflowRunRecord.count()).toBe(1);
  } finally { await db.$disconnect(); }
});

it.skipIf(!host)("registers, validates, revalidates, revokes and reconnects the exact grant", async () => {
  const db = await ownedDatabase();
  const owner = {organizationId: "activation-org", userId: "owner", repositoryId: "activation-repo"};
  const project = {owner: "fixture/group", name: "repo"};
  const expiresAt = Date.now() + 60_000;
  const credential = {type: "project", repositoryId: owner.repositoryId, projectId: "42", ...project, token: "fixture-project", expiresAt};
  const self = {id: 21, user_id: 14, active: true, revoked: false, scopes: ["read_api"], expires_at: "2099-01-20"};
  const verifierToken = "fixture-review";
  try {
    const member = await db.orgMembership.create({data: {organizationId: owner.organizationId, userId: owner.userId, role: "owner", acceptedAt: new Date()}});
    await db.repository.create({data: {id: owner.repositoryId, organizationId: owner.organizationId,
      provider: "gitlab", remoteOwner: project.owner, remoteName: project.name, remoteUrl: "https://gitlab.com/fixture/group/repo.git"}});
    const signal = new AbortController().signal;
    const other = {...owner, repositoryId: "activation-other"};
    await db.repository.create({data: {id: other.repositoryId, organizationId: owner.organizationId,
      provider: "gitlab", remoteOwner: project.owner, remoteName: "other", remoteUrl: "https://gitlab.com/fixture/group/other.git"}});
    await expect(readGitLabSetupState(db, other, signal)).resolves.toEqual({status: "not_connected"});
    const registration = {...owner, projectId: "42", projectToken: "fixture-project", expiresAt, signal};
    const first = await registerPendingGitLabReadConnection(db, registration);
    await expect(registerPendingGitLabReadConnection(db, registration)).rejects.toThrow(/^gitlab_registration_unavailable$/);
    const pending = await registerPendingGitLabReadConnection(db, {...registration, revision: first.revision});
    expect(pending.connectionId).toBe(first.connectionId);
    expect(pending.revision.getTime()).toBeGreaterThan(first.revision.getTime());
    const binding = {...owner, connectionId: pending.connectionId};
    const context = connectionCredentialContext({...binding, provider: "gitlab"});
    await expect(readGitLabSetupState(db, owner, signal)).resolves.toEqual({
      status: "awaiting_validation", connectionId: pending.connectionId, revision: pending.revision.toISOString(), validatedAt: null,
    });
    await expect(readGitLabSetupState(db, other, signal)).resolves.toEqual({status: "bound_to_other_repository"});
    await expect(registerPendingGitLabReadConnection(db, {...registration, ...other, revision: pending.revision}))
      .rejects.toThrow(/^gitlab_registration_unavailable$/);
    const fetchImpl = vi.fn<typeof fetch>()
      .mockImplementationOnce(async () => Response.json(self))
      .mockImplementationOnce(async () => Response.json({id: 42, path_with_namespace: "fixture/group/repo"}))
      .mockImplementationOnce(async () => {
        await db.orgMembership.update({where: {id: member.id}, data: {role: "operator"}});
        return Response.json(self);
      });
    const input = {...binding, revision: pending.revision, verifierToken, signal, fetchImpl};
    await expect(activateGitLabReadConnection(db, input)).rejects.toThrow(/^gitlab_read_activation_unavailable$/);
    const stored = () => db.tenantIntegrationConnection.findUniqueOrThrow({where: {id: binding.connectionId}});
    expect(await stored()).toMatchObject({status: "pending", lastValidatedAt: null});
    await db.orgMembership.update({where: {id: member.id}, data: {role: "owner"}});
    fetchImpl
      .mockImplementationOnce(async () => Response.json(self))
      .mockImplementationOnce(async () => Response.json({id: 42, path_with_namespace: "fixture/group/repo"}))
      .mockImplementationOnce(async () => Response.json(self));
    const result = await activateGitLabReadConnection(db, input);
    expect(result).toMatchObject({connectionId: binding.connectionId, projectId: "42"});
    const active = await stored();
    expect(active).toMatchObject({status: "active", lastValidatedAt: result.validatedAt});
    expect(active.updatedAt.getTime()).toBeGreaterThan(pending.revision.getTime());
    expect(JSON.parse(decryptScopedCredential(active.encryptedCredential, context))).toEqual(credential);

    await expect(activateGitLabReadConnection(db, input)).rejects.toThrow(/^gitlab_read_activation_unavailable$/);
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    await expect(registerPendingGitLabReadConnection(db, {...registration, revision: active.updatedAt})).rejects.toThrow();
    await expect(readGitLabSetupState(db, owner, signal)).resolves.toMatchObject({status: "active", connectionId: pending.connectionId});
    fetchImpl.mockImplementationOnce(async () => Response.json([]));
    const reader = createStoredGitLabEvidenceReader(db, binding, {canReadRepository: role => role === "owner", fetchImpl});
    await expect(reader.listPipelines(project, {})).resolves.toEqual([]);

    const revalidate = {...input, revision: active.updatedAt, mode: "revalidate" as const};
    fetchImpl.mockImplementationOnce(async () => new Response(null, {status: 403}));
    await expect(activateGitLabReadConnection(db, revalidate)).rejects.toThrow();
    expect(await stored()).toMatchObject({updatedAt: active.updatedAt, lastValidatedAt: active.lastValidatedAt});
    fetchImpl
      .mockImplementationOnce(async () => Response.json(self))
      .mockImplementationOnce(async () => Response.json({id: 42, path_with_namespace: "fixture/group/repo"}))
      .mockImplementationOnce(async () => Response.json(self));
    const refreshed = await activateGitLabReadConnection(db, revalidate);
    const current = await stored();
    expect(current.updatedAt.getTime()).toBeGreaterThan(active.updatedAt.getTime());
    expect(current.lastValidatedAt).toEqual(refreshed.validatedAt);

    const callsBeforeRevocation = fetchImpl.mock.calls.length;
    const manager = {...binding, userId: "recovery-admin"};
    await db.orgMembership.create({data: {organizationId: manager.organizationId, userId: manager.userId, role: "admin", acceptedAt: new Date()}});
    await expect(revokeGitLabReadConnection(db, {...manager, revision: active.updatedAt, signal})).rejects.toThrow();
    const revoked = await revokeGitLabReadConnection(db, {...manager, revision: current.updatedAt, signal});
    const revokedRow = await stored();
    expect(revokedRow).toMatchObject({status: "revoked", scopesJson: [], lastValidatedAt: null});
    expect(JSON.parse(decryptScopedCredential(revokedRow.encryptedCredential, context))).toEqual({
      type: "disconnected", repositoryId: binding.repositoryId, projectId: "42", ...project,
    });
    await expect(reader.listPipelines(project, {})).rejects.toThrow();
    await expect(activateGitLabReadConnection(db, {...revalidate, revision: revoked.revision})).rejects.toThrow();
    expect(fetchImpl).toHaveBeenCalledTimes(callsBeforeRevocation);
    await expect(readGitLabSetupState(db, manager, signal)).resolves.toMatchObject({status: "revoked", revision: revoked.revision.toISOString()});
    await expect(readGitLabSetupState(db, {...other, userId: manager.userId}, signal)).resolves.toEqual({
      status: "bound_to_other_repository",
    });
    const replacement = await registerPendingGitLabReadConnection(db, {...registration, userId: manager.userId, revision: revoked.revision});
    expect(replacement.connectionId).toBe(revoked.connectionId);
    expect(await stored()).toMatchObject({status: "pending", revokedAt: null, consentedByUserId: manager.userId});

  } finally { await db.$disconnect(); }
});

it.skipIf(!host)("syncs the exact GitLab workspace through the authenticated dashboard route", async () => {
  const db = await ownedDatabase();
  const organizationId = "sync-route-org";
  const userId = "route-user";
  const repositoryId = "sync-route-repo";
  const connectionId = "sync-route-grant";
  const now = Date.now();
  const origin = "https://workspace.test";
  const request = (requestOrigin = origin, target = repositoryId) => new NextRequest(origin + "/api/dashboard/repository-sync", {
    method: "POST", headers: {origin: requestOrigin, "content-type": "application/json"},
    body: JSON.stringify({repositoryId: target, kind: "workflow_runs"}),
  });
  const provider = vi.fn<typeof fetch>().mockImplementation(async () => Response.json([{
    id: 41, sha: "b".repeat(40), status: "success", web_url: "https://gitlab.com/team/route/-/pipelines/41",
  }]));
  routePorts.db = db;
  routePorts.session.mockResolvedValue({isAuthenticated: true, organizationId, sessionUserId: userId, userId, roles: ["owner"]});
  vi.stubGlobal("fetch", provider);
  try {
    await db.orgMembership.create({data: {organizationId, userId, role: "owner", acceptedAt: new Date()}});
    await db.repository.create({data: {id: repositoryId, organizationId, provider: "gitlab",
      remoteOwner: "team", remoteName: "route", remoteUrl: "https://gitlab.com/team/route.git"}});
    await db.repository.create({data: {id: "foreign-sync-repo", organizationId: "other-org", provider: "gitlab",
      remoteOwner: "other", remoteName: "route", remoteUrl: "https://gitlab.com/other/route.git"}});
    const context = connectionCredentialContext({organizationId, connectionId, provider: "gitlab"});
    await db.tenantIntegrationConnection.create({data: {
      id: connectionId, organizationId, provider: "gitlab", status: "active", scopesJson: ["read_api"],
      externalAccountId: "42", consentedByUserId: userId,
      consentedAt: new Date(now - 259_200_000), lastValidatedAt: new Date(now),
      encryptedCredential: encryptScopedCredential(JSON.stringify({
        type: "project", repositoryId, projectId: "42", owner: "team", name: "route", token: "fixture-project",
        expiresAt: now + 60_000,
      }), context),
    }});
    vi.stubEnv("GITLAB_WORKSPACE_SETUP_ENABLED", undefined);
    expect((await syncRepository(request())).status).toBe(501);
    vi.stubEnv("GITLAB_WORKSPACE_SETUP_ENABLED", "true");
    expect((await syncRepository(request("https://foreign.test"))).status).toBe(403);
    expect((await syncRepository(request(origin, "foreign-sync-repo"))).status).toBe(403);
    await db.orgMembership.updateMany({where: {organizationId, userId}, data: {role: "operator"}});
    expect((await syncRepository(request())).status).toBe(503);
    expect(provider).not.toHaveBeenCalled();
    await db.orgMembership.updateMany({where: {organizationId, userId}, data: {role: "owner"}});

    const response = await syncRepository(request());
    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    await expect(response.json()).resolves.toMatchObject({ok: true, data: {repositoryId, fetched: 1, upserted: 1, skipped: 0}});
    expect(provider).toHaveBeenCalledTimes(1);
    expect(String(provider.mock.calls[0][0])).toContain("https://gitlab.com/api/v4/projects/42/pipelines");
    expect(await db.workflowRunRecord.findFirst({where: {organizationId, repositoryId}})).toMatchObject({externalRunId: "41"});
    expect(await db.auditEvent.count({where: {organizationId, subjectId: repositoryId, kind: "repository.sync", actorUserId: userId}})).toBe(1);

    await db.tenantIntegrationConnection.update({where: {id: connectionId}, data: {lastValidatedAt: new Date(now - 172_800_000)}});
    expect((await syncRepository(request())).status).toBe(503);
    expect(provider).toHaveBeenCalledTimes(1);
    await db.tenantIntegrationConnection.update({where: {id: connectionId}, data: {lastValidatedAt: new Date()}});
    provider.mockImplementationOnce(async () => {
      await db.tenantIntegrationConnection.update({where: {id: connectionId}, data: {status: "revoked", revokedAt: new Date()}});
      return Response.json([{id: 42, sha: "b".repeat(40), status: "success",
        web_url: "https://gitlab.com/team/route/-/pipelines/42"}]);
    });
    expect((await syncRepository(request())).status).toBe(503);
    expect(await db.workflowRunRecord.count({where: {organizationId, repositoryId}})).toBe(1);
    expect((await syncRepository(request())).status).toBe(409);
    expect(provider).toHaveBeenCalledTimes(2);
    expect(await db.auditEvent.count({where: {organizationId, subjectId: repositoryId}})).toBe(1);
  } finally {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    routePorts.db = null;
    await db.$disconnect();
  }
});
