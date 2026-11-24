import "server-only";
import {z} from "zod";
import type {OrgRole, Prisma, PrismaClient} from "@/lib/prismaClient";
import {withGithubAbort} from "@/lib/connectors/github/boundedGithubRead";
import {connectionCredentialContext} from "@/lib/integrations/tenantAuthorization";
import {CONNECTION_VALIDATION_FRESH_FOR_MS} from "@/lib/integrations/tenantConnectionState";
import {decryptScopedCredential} from "@/lib/security/credentialVault";
import {createGitLabFetcher} from "./gitlabFetcher";
import {upsertPullRequestRecord, upsertReleaseTagRecord, upsertWorkflowRunRecord, type GitDiscoveryRepo} from "./gitDiscoveryRepo";
import {projectGitlabMergeRequest, projectGitlabPipeline, projectGitlabReleaseTag} from "./providers/gitlabProjectors";
import type {GitLabFetcher, SyncKind, SyncRepositoryRow} from "./repositorySyncResponder";

export const gitlabProjectCredentialSchema = z.object({
  type: z.literal("project"),
  repositoryId: z.string().min(1).optional(),
  projectId: z.string().regex(/^[1-9][0-9]{0,19}$/),
  owner: z.string(),
  name: z.string(),
  token: z.string(),
  expiresAt: z.number().int().safe(),
}).strict();

interface ConsentRecord {
  id: string;
  organizationId: string;
  provider: string;
  status: string;
  scopesJson: unknown;
  externalAccountId: string | null;
  consentedByUserId: string | null;
  consentedAt: Date;
  updatedAt: Date;
  lastValidatedAt: Date | null;
  revokedAt: Date | null;
}

export interface EvidenceBinding {
  organizationId: string;
  userId: string;
  repositoryId: string;
  connectionId: string;
}

/** A future authenticated route must supply current, authoritative membership,
 * repository and connection records from the requested workspace. */
interface GitLabEvidenceDependencies {
  readCurrent(binding: Readonly<EvidenceBinding>, signal: AbortSignal): Promise<{
    mayReadRepository: boolean;
    repository: SyncRepositoryRow | null;
    connection: ConsentRecord | null;
    encryptedCredential: string | null;
  }>;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

interface StoredEvidenceDependencies extends Omit<GitLabEvidenceDependencies, "readCurrent"> {
  canReadRepository(role: OrgRole, repository: Readonly<SyncRepositoryRow>): boolean;
}

type AuthorityReader = GitLabEvidenceDependencies["readCurrent"];
type ProjectPath = {owner: string; name: string};

type RepositoryBinding = Omit<EvidenceBinding, "connectionId">;

export async function readGitLabRepositoryAccess(
  tx: Prisma.TransactionClient,
  {organizationId, userId, repositoryId}: RepositoryBinding,
  canReadRepository: StoredEvidenceDependencies["canReadRepository"],
) {
  const member = await tx.orgMembership.findUnique({
    where: {userId_organizationId: {userId, organizationId}},
    select: {acceptedAt: true, role: true, providerScopes: true},
  });
  if (!member?.acceptedAt || (member.providerScopes.length && !member.providerScopes.includes("gitlab"))) return null;

  const repository = await tx.repository.findFirst({
    where: {id: repositoryId, organizationId, provider: "gitlab"},
    select: {id: true, organizationId: true, provider: true, remoteOwner: true, remoteName: true},
  });
  return repository && canReadRepository(member.role, repository) ? repository : null;
}

export function readStoredGitLabAuthority(tx: Prisma.TransactionClient, canReadRepository: StoredEvidenceDependencies["canReadRepository"]): AuthorityReader {
  return async ({organizationId, userId, repositoryId, connectionId}, signal) => {
    const denied = {mayReadRepository: false, repository: null, connection: null, encryptedCredential: null};
    signal.throwIfAborted();
    const repository = await readGitLabRepositoryAccess(tx, {organizationId, userId, repositoryId}, canReadRepository);
    if (!repository) return denied;

    signal.throwIfAborted();
    const record = await tx.tenantIntegrationConnection.findFirst({
      where: {id: connectionId, organizationId, provider: "gitlab"},
      select: {
        id: true, organizationId: true, provider: true, status: true, scopesJson: true,
        consentedAt: true, consentedByUserId: true, updatedAt: true, lastValidatedAt: true,
        revokedAt: true, externalAccountId: true, encryptedCredential: true,
      },
    });
    signal.throwIfAborted();
    if (!record) return denied;
    const {encryptedCredential, ...connection} = record;
    return {mayReadRepository: true, repository, connection, encryptedCredential};
  };
}

export async function lockGitLabRepositoryAuthority(
  tx: Prisma.TransactionClient,
  {userId, organizationId, repositoryId}: RepositoryBinding,
) {
  const members = await tx.$queryRaw<{id: string}[]>`SELECT "id" FROM "OrgMembership"
    WHERE "userId" = ${userId} AND "organizationId" = ${organizationId} FOR SHARE`;
  if (members.length !== 1) throw new Error("gitlab_evidence_unavailable");
  const repositories = await tx.$queryRaw<{id: string}[]>`SELECT "id" FROM "Repository" WHERE "id" = ${repositoryId}
    AND "organizationId" = ${organizationId} AND "provider" = 'gitlab' FOR NO KEY UPDATE`;
  if (repositories.length !== 1) throw new Error("gitlab_evidence_unavailable");
}

export async function lockGitLabEvidenceAuthority(tx: Prisma.TransactionClient, binding: EvidenceBinding) {
  await lockGitLabRepositoryAuthority(tx, binding);
  const {organizationId, connectionId} = binding;
  const connections = await tx.$queryRaw<{id: string}[]>`SELECT "id" FROM "TenantIntegrationConnection" WHERE "id" = ${connectionId}
    AND "organizationId" = ${organizationId} AND "provider" = 'gitlab' FOR SHARE`;
  if (connections.length !== 1) throw new Error("gitlab_evidence_unavailable");
}

function storedReadDependencies(
  db: Pick<PrismaClient, "$transaction">,
  dependencies: StoredEvidenceDependencies,
): GitLabEvidenceDependencies {
  return {
    ...dependencies,
    readCurrent: (binding, signal) => db.$transaction(
      tx => readStoredGitLabAuthority(tx, dependencies.canReadRepository)(binding, signal),
      {isolationLevel: "RepeatableRead", maxWait: 1_000, timeout: 2_000},
    ),
  };
}

/** The authenticated entry point supplies a reviewed repository-read policy and a canonical user ID. */
export function createStoredGitLabEvidenceReader(
  db: Pick<PrismaClient, "$transaction">,
  binding: EvidenceBinding,
  dependencies: StoredEvidenceDependencies,
): GitLabFetcher {
  return createScopedGitLabEvidenceReader(binding, storedReadDependencies(db, dependencies));
}

/** The transaction callback finished, but the database did not confirm the commit. */
export class GitLabEvidencePersistenceUnconfirmed extends Error {
  constructor() {
    super("gitlab_evidence_persistence_unconfirmed");
  }
}

/** Staged sync. Provider I/O completes before taking storage locks. Evidence
 * and its final authority check belong to one database transaction. */
export function createStoredGitLabEvidenceSync(
  db: Pick<PrismaClient, "$transaction">,
  input: EvidenceBinding,
  dependencies: StoredEvidenceDependencies,
) {
  const binding = Object.freeze({...input});
  const run = createScopedGitLabRead(binding, storedReadDependencies(db, dependencies));
  return (kind: SyncKind, requestedProject: ProjectPath, perPage = 100): Promise<{fetched: number; upserted: number}> => run(
    requestedProject,
    (reader, project) => collectGitLabSlice(reader, kind, project, perPage),
    async (slice, assertCurrent, signal) => {
      signal.throwIfAborted();
      let writesPrepared = false;
      try {
        return await db.$transaction(async tx => {
          signal.throwIfAborted();
          await lockGitLabEvidenceAuthority(tx, binding);
          // Use the existing discovery persistence delegates, all in this transaction.
          const repo = tx as unknown as GitDiscoveryRepo;
          await assertCurrent(readStoredGitLabAuthority(tx, dependencies.canReadRepository));
          const observedAt = new Date();
          switch (slice.kind) {
            case "pull_requests":
              for (const row of slice.rows) await upsertPullRequestRecord(repo, {...projectGitlabMergeRequest(row, binding), observedAt});
              break;
            case "releases":
              for (const row of slice.rows) await upsertReleaseTagRecord(repo, {...projectGitlabReleaseTag(row, binding), observedAt});
              break;
            case "workflow_runs":
              for (const row of slice.rows) await upsertWorkflowRunRecord(repo, {...projectGitlabPipeline(row, binding), observedAt});
              break;
          }
          // Recheck expiration and cancellation before allowing the commit.
          await assertCurrent(readStoredGitLabAuthority(tx, dependencies.canReadRepository));
          writesPrepared = slice.rows.length > 0;
          return {fetched: slice.rows.length, upserted: slice.rows.length};
        }, {isolationLevel: "ReadCommitted", maxWait: 1_000, timeout: 3_000});
      } catch (error) {
        if (writesPrepared) throw new GitLabEvidencePersistenceUnconfirmed();
        throw error;
      }
    },
  );
}

async function collectGitLabSlice(reader: GitLabFetcher, kind: SyncKind, project: ProjectPath, perPage: number) {
  switch (kind) {
    case "pull_requests": return {kind, rows: await reader.listMergeRequests(project, {state: "all", perPage})};
    case "releases": return {kind, rows: await reader.listReleases(project, {perPage})};
    case "workflow_runs": return {kind, rows: await reader.listPipelines(project, {perPage})};
  }
}

export function createScopedGitLabEvidenceReader(
  input: EvidenceBinding,
  deps: GitLabEvidenceDependencies,
): GitLabFetcher {
  const run = createScopedGitLabRead(input, deps);
  return {
    listMergeRequests: (project, options) => run(project, (reader, bound) => reader.listMergeRequests(bound, options)),
    listReleases: (project, options) => run(project, (reader, bound) => reader.listReleases(bound, options)),
    listPipelines: (project, options) => run(project, (reader, bound) => reader.listPipelines(bound, options)),
  };
}

function createScopedGitLabRead(input: EvidenceBinding, deps: GitLabEvidenceDependencies) {
  const binding = Object.freeze({...input});
  const parentSignal = deps.signal;

  async function readGrant(project: ProjectPath, signal: AbortSignal, readCurrent = deps.readCurrent) {
    signal.throwIfAborted();
    const {mayReadRepository, repository, connection, encryptedCredential} =
      await withGithubAbort(readCurrent(binding, signal), signal);
    const now = Date.now();
    const validatedAt = connection?.lastValidatedAt?.getTime() ?? NaN;
    const consentedAt = connection?.consentedAt.getTime() ?? NaN;
    if (
      !binding.userId || !binding.organizationId || !mayReadRepository
      || repository?.id !== binding.repositoryId || repository.organizationId !== binding.organizationId
      || repository.provider !== "gitlab" || repository.remoteOwner !== project.owner || repository.remoteName !== project.name
      || connection?.id !== binding.connectionId || connection.organizationId !== binding.organizationId
      || connection.provider !== "gitlab" || connection.status !== "active" || connection.revokedAt !== null
      || !connection.consentedByUserId || !(consentedAt <= validatedAt && validatedAt <= now)
      || now - validatedAt > CONNECTION_VALIDATION_FRESH_FOR_MS
      || !Array.isArray(connection.scopesJson) || connection.scopesJson.length !== 1
      || connection.scopesJson[0] !== "read_api" || !encryptedCredential
    ) throw new Error("gitlab_evidence_unavailable");
    return {connection, encryptedCredential};
  }

  type Finish<T, R> = (evidence: T, assertCurrent: (readCurrent?: AuthorityReader) => Promise<void>, signal: AbortSignal) => Promise<R>;
  function run<T>(project: ProjectPath, read: (reader: GitLabFetcher, project: ProjectPath) => Promise<T>): Promise<T>;
  function run<T, R>(project: ProjectPath, read: (reader: GitLabFetcher, project: ProjectPath) => Promise<T>, finish: Finish<T, R>): Promise<R>;
  async function run<T, R>(
    requestedProject: ProjectPath,
    read: (reader: GitLabFetcher, project: ProjectPath) => Promise<T>,
    finish?: Finish<T, R>,
  ): Promise<T | R> {
    const project = {...requestedProject};
    const deadline = AbortSignal.timeout(10_000);
    const signal = parentSignal ? AbortSignal.any([parentSignal, deadline]) : deadline;
    try {
      const initial = await readGrant(project, signal);
      const context = connectionCredentialContext({
        organizationId: binding.organizationId, connectionId: binding.connectionId, provider: "gitlab",
      });
      const credential = gitlabProjectCredentialSchema.parse(JSON.parse(decryptScopedCredential(initial.encryptedCredential, context)));
      const revision = initial.connection.updatedAt.getTime();
      const consentOwner = initial.connection.consentedByUserId;
      if (!Number.isFinite(revision) || credential.projectId !== initial.connection.externalAccountId
        || (credential.repositoryId !== undefined && credential.repositoryId !== binding.repositoryId)
        || credential.owner !== project.owner || credential.name !== project.name
        || credential.expiresAt <= Date.now()) throw new Error("gitlab_evidence_unavailable");
      const reader = createGitLabFetcher({
        token: credential.token, expiresAt: credential.expiresAt,
        project: {...project, id: credential.projectId}, signal, fetchImpl: deps.fetchImpl,
      });
      const evidence = await read(reader, project);
      const assertCurrent = async (readCurrent?: AuthorityReader) => {
        const current = await readGrant(project, signal, readCurrent);
        if (current.connection.updatedAt.getTime() !== revision || current.connection.consentedByUserId !== consentOwner
          || current.connection.externalAccountId !== credential.projectId || current.encryptedCredential !== initial.encryptedCredential
          || credential.expiresAt <= Date.now()) throw new Error("gitlab_evidence_unavailable");
        signal.throwIfAborted();
      };
      if (finish) return await finish(evidence, assertCurrent, signal);
      await assertCurrent();
      return evidence;
    } catch (error) {
      if (error instanceof GitLabEvidencePersistenceUnconfirmed) throw error;
      throw new Error("gitlab_evidence_unavailable");
    }
  }
  return run;
}
