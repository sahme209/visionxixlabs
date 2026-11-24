import "server-only";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { PrismaClient } from "@/lib/prismaClient";
import { hasDesktopCapability } from "@/lib/desktop/desktopAuthorization";
import { connectionCredentialContext } from "@/lib/integrations/tenantAuthorization";
import { visibleTenantConnectionStatus } from "@/lib/integrations/tenantConnectionState";
import { decryptScopedCredential, encryptScopedCredential } from "@/lib/security/credentialVault";
import { gitlabProjectCredentialSchema, lockGitLabEvidenceAuthority, lockGitLabRepositoryAuthority, readGitLabRepositoryAccess, readStoredGitLabAuthority, type EvidenceBinding } from "./gitlabScopedEvidence";

const disconnectedCredentialSchema = gitlabProjectCredentialSchema
  .omit({token: true, expiresAt: true})
  .extend({type: z.literal("disconnected")});
const setupCredentialSchema = z.discriminatedUnion("type", [gitlabProjectCredentialSchema, disconnectedCredentialSchema]);

export async function registerPendingGitLabReadConnection(
  db: Pick<PrismaClient, "$transaction">,
  input: Omit<EvidenceBinding, "connectionId"> & {projectId: string; projectToken: string; expiresAt: number; revision?: Date; signal: AbortSignal},
): Promise<{connectionId: string; revision: Date}> {
  const {organizationId, userId, repositoryId, projectId, projectToken, expiresAt} = input;
  const binding = {organizationId, userId, repositoryId};
  const signal = AbortSignal.any([input.signal, AbortSignal.timeout(5_000)]);
  let writePrepared = false;
  try {
    if (Object.values(binding).some(value => !value) || !/^[!-~]{1,4096}$/.test(projectToken)) throw new Error();
    return await db.$transaction(async tx => {
      signal.throwIfAborted();
      await lockGitLabRepositoryAuthority(tx, binding);
      const repository = await readGitLabRepositoryAccess(tx, binding, role => hasDesktopCapability(role, "connections:manage"));
      if (!repository) throw new Error();

      const current = await tx.tenantIntegrationConnection.findUnique({
        where: {organizationId_provider: {organizationId, provider: "gitlab"}},
        select: {id: true, status: true, revokedAt: true, consentedByUserId: true, updatedAt: true, lastValidatedAt: true,
          encryptedCredential: true},
      });
      if (current) {
        const isPending = current.status === "pending" && current.revokedAt === null && current.consentedByUserId === userId;
        const isRevoked = current.status === "revoked" && current.revokedAt !== null;
        if ((!isPending && !isRevoked) || current.lastValidatedAt !== null
          || current.updatedAt.getTime() !== input.revision?.getTime()) throw new Error();
        const currentContext = connectionCredentialContext({organizationId, connectionId: current.id, provider: "gitlab"});
        const previous = setupCredentialSchema.parse(JSON.parse(decryptScopedCredential(current.encryptedCredential, currentContext)));
        if (previous.repositoryId !== repositoryId || previous.type !== (isRevoked ? "disconnected" : "project")) throw new Error();
      } else if (input.revision !== undefined) throw new Error();

      const now = Date.now();
      if (expiresAt <= now) throw new Error();
      const connectionId = current?.id ?? randomUUID();
      const revision = new Date(Math.max(now, current ? current.updatedAt.getTime() + 1 : now));
      const credential = gitlabProjectCredentialSchema.parse({
        type: "project", repositoryId, projectId, token: projectToken, expiresAt,
        owner: repository.remoteOwner, name: repository.remoteName,
      });
      const encryptedCredential = encryptScopedCredential(
        JSON.stringify(credential), connectionCredentialContext({organizationId, connectionId, provider: "gitlab"}),
      );
      const data = {
        encryptedCredential, externalAccountId: projectId, scopesJson: ["read_api"], consentedAt: new Date(now), updatedAt: revision,
        status: "pending", revokedAt: null, consentedByUserId: userId,
      };
      signal.throwIfAborted();
      if (current) {
        const changed = await tx.tenantIntegrationConnection.updateMany({
          where: {id: connectionId, organizationId, provider: "gitlab", status: current.status, revokedAt: current.revokedAt,
            lastValidatedAt: null, updatedAt: current.updatedAt, consentedByUserId: current.consentedByUserId},
          data,
        });
        if (changed.count !== 1) throw new Error();
      } else {
        await tx.tenantIntegrationConnection.create({
          data: {...data, id: connectionId, organizationId, provider: "gitlab"},
        });
      }
      signal.throwIfAborted();
      writePrepared = true;
      return {connectionId, revision};
    }, {isolationLevel: "ReadCommitted", maxWait: 1_000, timeout: 3_000});
  } catch {
    throw new Error(writePrepared ? "gitlab_registration_unconfirmed" : "gitlab_registration_unavailable");
  }
}

/** Reload the exact registration after an interrupted or unconfirmed reply. */
export async function readGitLabSetupState(
  db: Pick<PrismaClient, "$transaction">,
  binding: Omit<EvidenceBinding, "connectionId">,
  signal: AbortSignal,
) {
  return db.$transaction(async tx => {
    signal.throwIfAborted();
    const repository = await readGitLabRepositoryAccess(tx, binding, role => hasDesktopCapability(role, "connections:manage"));
    if (!repository) throw new Error("gitlab_setup_unavailable");
    const {organizationId, repositoryId} = binding;
    const row = await tx.tenantIntegrationConnection.findUnique({
      where: {organizationId_provider: {organizationId, provider: "gitlab"}},
      select: {id: true, encryptedCredential: true, externalAccountId: true, updatedAt: true, status: true,
        consentedAt: true, scopesJson: true, lastValidatedAt: true, revokedAt: true},
    });
    if (!row) return {status: "not_connected" as const};
    const context = connectionCredentialContext({organizationId, connectionId: row.id, provider: "gitlab"});
    const credential = setupCredentialSchema.parse(JSON.parse(decryptScopedCredential(row.encryptedCredential, context)));
    if (credential.projectId !== row.externalAccountId) throw new Error("gitlab_setup_unavailable");
    signal.throwIfAborted();
    if (credential.repositoryId !== repositoryId) return {status: "bound_to_other_repository" as const};
    const pathMatches = credential.owner === repository.remoteOwner && credential.name === repository.remoteName;
    const now = new Date();
    const validatedAt = row.lastValidatedAt?.getTime() ?? NaN;
    const exactScope = Array.isArray(row.scopesJson) && row.scopesJson.length === 1 && row.scopesJson[0] === "read_api";
    const currentProof = row.consentedAt.getTime() <= validatedAt && validatedAt <= now.getTime()
      && credential.type === "project" && credential.expiresAt > now.getTime() && exactScope;
    const status = row.revokedAt ? "revoked"
      : !pathMatches || (row.status === "active" && !currentProof) ? "needs_attention"
      : visibleTenantConnectionStatus(row, now);
    signal.throwIfAborted();
    return {status, connectionId: row.id, revision: row.updatedAt.toISOString(), validatedAt: row.lastValidatedAt?.toISOString() ?? null};
  }, {isolationLevel: "RepeatableRead", maxWait: 1_000, timeout: 2_000});
}

/** Revoke local read authority and replace the stored token with binding metadata. */
export async function revokeGitLabReadConnection(
  db: Pick<PrismaClient, "$transaction">,
  input: EvidenceBinding & {revision: Date; signal: AbortSignal},
): Promise<{connectionId: string; revision: Date}> {
  const {organizationId, connectionId, repositoryId, userId} = input;
  const binding = {organizationId, connectionId, repositoryId, userId};
  const signal = AbortSignal.any([input.signal, AbortSignal.timeout(5_000)]);
  let writePrepared = false;
  try {
    return await db.$transaction(async tx => {
      signal.throwIfAborted();
      await lockGitLabEvidenceAuthority(tx, binding);
      const snapshot = await readStoredGitLabAuthority(tx, role => hasDesktopCapability(role, "connections:manage"))(binding, signal);
      const {repository, connection, encryptedCredential} = snapshot;
      if (!snapshot.mayReadRepository || !repository || !connection || !encryptedCredential
        || !["pending", "active", "needs_attention", "suspended"].includes(connection.status)
        || connection.revokedAt !== null || connection.updatedAt.getTime() !== input.revision.getTime()) throw new Error();

      const context = connectionCredentialContext({organizationId, connectionId, provider: "gitlab"});
      const credential = gitlabProjectCredentialSchema.parse(JSON.parse(decryptScopedCredential(encryptedCredential, context)));
      if (credential.repositoryId !== repositoryId || credential.projectId !== connection.externalAccountId) throw new Error();
      const disconnected = encryptScopedCredential(JSON.stringify(disconnectedCredentialSchema.parse({
        type: "disconnected", repositoryId, projectId: credential.projectId,
        owner: repository.remoteOwner, name: repository.remoteName,
      })), context);
      const now = Date.now();
      const revision = new Date(Math.max(now, connection.updatedAt.getTime() + 1));
      signal.throwIfAborted();
      const saved = await tx.tenantIntegrationConnection.updateMany({
        where: {id: connectionId, organizationId, provider: "gitlab", status: connection.status,
          revokedAt: null, updatedAt: connection.updatedAt},
        data: {status: "revoked", revokedAt: new Date(now), lastValidatedAt: null, scopesJson: [],
          encryptedCredential: disconnected, updatedAt: revision},
      });
      signal.throwIfAborted();
      if (saved.count !== 1) throw new Error();
      writePrepared = true;
      return {connectionId, revision};
    }, {isolationLevel: "ReadCommitted", maxWait: 1_000, timeout: 3_000});
  } catch {
    throw new Error(writePrepared ? "gitlab_revocation_unconfirmed" : "gitlab_revocation_unavailable");
  }
}
