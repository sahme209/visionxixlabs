import type { Prisma, PrismaClient } from "@prisma/client";
import { evidenceDigest } from "./contract";
import type { ReviewStore, ReviewTransaction, ReviewPacket, ReviewDecision, ReviewCheckpoint, ReviewPolicy } from "./reviewCore";
type Database = Pick<Prisma.TransactionClient, "$queryRawUnsafe" | "$executeRawUnsafe">;
/** Reused read-only selected-policy interpretation; not approval or execution authority. */
export async function readPostgresReviewPolicy(db: Pick<Prisma.TransactionClient, "$queryRawUnsafe">, org: string, environment: string): Promise<ReviewPolicy | null> {
    const rows = await db.$queryRawUnsafe<{ id: string; enabled: boolean; blockAction: boolean; requiredApprovals: number; requiredRoles: string[]; updatedAt: Date }[]>(
        'SELECT p."id",p."enabled",p."blockAction",p."requiredApprovals",p."requiredRoles",p."updatedAt" FROM "Environment" e JOIN "AxiomApprovalPolicy" p ON p."id"=e."approvalPolicyId" AND p."organizationId"=e."organizationId" WHERE e."organizationId"=$1 AND e."id"=$2', org, environment);
    const row = rows[0];
    if (!row || !row.enabled || !Array.isArray(row.requiredRoles) || row.requiredRoles.some(role => !["owner", "admin"].includes(role))) return null;
    const material = { id: row.id, updatedAt: row.updatedAt.toISOString(), requiredApprovals: row.requiredApprovals, allowedRoles: row.requiredRoles, allowSelfApproval: false, blocked: row.blockAction };
    return { ...material, digest: evidenceDigest(material) } satisfies ReviewPolicy;
}
/** SQL text is static; every caller value is a parameter, never interpolation.
 * No factory is connected to any public route or execution dispatcher. */
function transactionStore(db: Database): ReviewTransaction {
    const one = async <T>(sql: string, ...parameters: unknown[]) => (await db.$queryRawUnsafe<T[]>(sql, ...parameters))[0] ?? null;
    return {
        packetByOperation: (org, operation) => one<ReviewPacket>('SELECT * FROM "EcsReleaseReviewPacket" WHERE "organizationId"=$1 AND "operationId"=$2', org, operation),
        packetById: (org, id) => one<ReviewPacket>('SELECT * FROM "EcsReleaseReviewPacket" WHERE "organizationId"=$1 AND "id"=$2', org, id),
        async createPacket(p) {
            await db.$executeRawUnsafe('INSERT INTO "EcsReleaseReviewPacket" ("id","organizationId","environmentId","operationId","manifestJson","manifestDigest","imageSetDigest","healthPolicyDigest","verifiedEvidenceJson","evidenceDigest","policyDigest","createdByUserId","createdAt","expiresAt") VALUES ($1,$2,$3,$4,$5::jsonb,$6,$7,$8,$9::jsonb,$10,$11,$12,$13,$14)', p.id, p.organizationId, p.environmentId, p.operationId, JSON.stringify(p.manifestJson), p.manifestDigest, p.imageSetDigest, p.healthPolicyDigest, JSON.stringify(p.verifiedEvidenceJson), p.evidenceDigest, p.policyDigest, p.createdByUserId, p.createdAt, p.expiresAt);
        },
        latestDecisions: (org, packet) => db.$queryRawUnsafe<ReviewDecision[]>('SELECT DISTINCT ON ("userId") * FROM "EcsReleaseReviewDecision" WHERE "organizationId"=$1 AND "packetId"=$2 ORDER BY "userId", "revision" DESC', org, packet),
        async appendDecision(d) {
            await db.$executeRawUnsafe('INSERT INTO "EcsReleaseReviewDecision" ("id","packetId","organizationId","userId","revision","decision","manifestDigest","policyDigest","decidedAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)', d.id, d.packetId, d.organizationId, d.userId, d.revision, d.decision, d.manifestDigest, d.policyDigest, d.decidedAt, d.expiresAt);
        },
        checkpoint: (org, packet, digest) => one<ReviewCheckpoint>('SELECT * FROM "EcsReleaseReviewCheckpoint" WHERE "organizationId"=$1 AND "packetId"=$2 AND "decisionSetDigest"=$3', org, packet, digest),
        async createCheckpoint(c) {
            await db.$executeRawUnsafe('INSERT INTO "EcsReleaseReviewCheckpoint" ("id","packetId","organizationId","manifestDigest","policyDigest","decisionSetDigest","decisionIds","createdAt","expiresAt") VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8,$9)', c.id, c.packetId, c.organizationId, c.manifestDigest, c.policyDigest, c.decisionSetDigest, JSON.stringify(c.decisionIds), c.createdAt, c.expiresAt);
        },
        membership: (org, user) => one<{
            acceptedAt: Date | null;
            role: string;
        }>('SELECT "acceptedAt","role" FROM "OrgMembership" WHERE "organizationId"=$1 AND "userId"=$2', org, user),
        policy: (org, environment) => readPostgresReviewPolicy(db, org, environment),
    };
}
export function postgresReviewStore(client: Pick<PrismaClient, "$transaction">): ReviewStore {
    return { transaction: operation => client.$transaction(tx => operation(transactionStore(tx)), { isolationLevel: "Serializable" }) };
}
