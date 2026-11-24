import "server-only";
import type {OrgRole, Prisma, PrismaClient} from "@/lib/prismaClient";
import {hasDesktopCapability} from "@/lib/desktop/desktopAuthorization";
import {connectionCredentialContext} from "@/lib/integrations/tenantAuthorization";
import {decryptScopedCredential, encryptScopedCredential} from "@/lib/security/credentialVault";
import {gitlabProjectCredentialSchema, lockGitLabEvidenceAuthority, readStoredGitLabAuthority, type EvidenceBinding} from "./gitlabScopedEvidence";
import {readGitLabProjectTokenEvidence} from "./gitlabTokenScopeEvidence";

/** Read activation or revalidation of a connection already registered by
 * an authenticated workspace connection manager. The caller controls the verifier's custody. */
export async function activateGitLabReadConnection(
  db: Pick<PrismaClient, "$transaction">,
  input: EvidenceBinding & {revision: Date; verifierToken: string; mode?: "revalidate"; signal: AbortSignal; fetchImpl?: typeof fetch},
): Promise<{connectionId: string; projectId: string; validatedAt: Date}> {
  const {organizationId, userId, repositoryId, connectionId, verifierToken, fetchImpl} = input;
  const binding = {organizationId, userId, repositoryId, connectionId};
  const signal = AbortSignal.any([input.signal, AbortSignal.timeout(10_000)]);
  const expectedStatus = input.mode === "revalidate" ? "active" : "pending";
  const canManage = (role: OrgRole) => hasDesktopCapability(role, "connections:manage");
  let writePrepared = false;

  try {
    const revision = input.revision.getTime();
    if (!Number.isFinite(revision) || Object.values(binding).some(value => !value)) throw new Error();
    const readExactGrant = async (tx: Prisma.TransactionClient) => {
      const snapshot = await readStoredGitLabAuthority(tx, canManage)(binding, signal);
      const {repository, connection, encryptedCredential} = snapshot;
      if (!snapshot.mayReadRepository || !repository || !encryptedCredential || !connection
        || connection.status !== expectedStatus || connection.revokedAt !== null
        || (expectedStatus === "pending" ? connection.lastValidatedAt !== null : connection.lastValidatedAt === null)
        || connection.updatedAt.getTime() !== revision || connection.consentedByUserId !== userId
        || !(connection.consentedAt.getTime() <= Date.now())
        || !Array.isArray(connection.scopesJson) || connection.scopesJson.length !== 1 || connection.scopesJson[0] !== "read_api") {
        throw new Error();
      }
      return {repository, connection, encryptedCredential};
    };
    const original = await db.$transaction(readExactGrant, {isolationLevel: "RepeatableRead", maxWait: 1_000, timeout: 2_000});
    const context = connectionCredentialContext({organizationId, connectionId, provider: "gitlab"});
    const credential = gitlabProjectCredentialSchema.parse(JSON.parse(decryptScopedCredential(original.encryptedCredential, context)));
    if (credential.repositoryId !== repositoryId || credential.projectId !== original.connection.externalAccountId || credential.owner !== original.repository.remoteOwner
      || credential.name !== original.repository.remoteName || credential.expiresAt <= Date.now()) throw new Error();

    const proof = await readGitLabProjectTokenEvidence({
      projectId: credential.projectId,
      projectPath: `${credential.owner}/${credential.name}`,
      projectToken: credential.token,
      verifierToken,
    }, {signal, fetchImpl});
    const expiresAt = Math.min(credential.expiresAt, proof.expiresAt);
    const encryptedCredential = encryptScopedCredential(JSON.stringify({...credential, expiresAt}), context);
    signal.throwIfAborted();

    return await db.$transaction(async tx => {
      await lockGitLabEvidenceAuthority(tx, binding);
      const current = await readExactGrant(tx);
      const validatedAt = new Date();
      if (expiresAt <= validatedAt.getTime() || current.encryptedCredential !== original.encryptedCredential
        || current.connection.externalAccountId !== proof.projectId || current.repository.remoteOwner !== credential.owner
        || current.repository.remoteName !== credential.name) throw new Error();

      signal.throwIfAborted();
      const result = await tx.tenantIntegrationConnection.updateMany({
        where: {id: connectionId, organizationId, provider: "gitlab", status: expectedStatus, updatedAt: new Date(revision)},
        data: {status: "active", lastValidatedAt: validatedAt, encryptedCredential,
          updatedAt: new Date(Math.max(revision + 1, validatedAt.getTime()))},
      });
      signal.throwIfAborted();
      if (result.count !== 1) throw new Error();
      writePrepared = true;
      return {connectionId, projectId: proof.projectId, validatedAt};
    }, {isolationLevel: "ReadCommitted", maxWait: 1_000, timeout: 3_000});
  } catch {
    throw new Error(writePrepared ? "gitlab_read_activation_unconfirmed" : "gitlab_read_activation_unavailable");
  }
}
