import 'server-only';
import { z } from 'zod';
import { sha256ContentHash as hash } from '@/lib/tauri/contentHash';
import type { ReleaseOperationPlanTransaction as Tx, ReleaseOperationPlanRow as Row } from '@/lib/agent/workflows/releaseOperationPlanStore';
export const CODING_PARENT = 'coding_outbound_parent_v1', CODING_EFFECT = 'coding_outbound_effect_v1';
const digest = z.string().regex(/^[a-f0-9]{64}$/);
export const workerSchema = z.object({ kind: z.literal('coding_stage'), organizationId: z.string().min(1).max(256), actorUserId: z.string().min(1).max(256), runId: z.string().min(1).max(256), stageRunId: z.string().min(1).max(256), nonce: z.string().uuid() }).strict();
export const parentInputSchema = z.object({ format: z.literal(1), worker: workerSchema, artifactDigest: digest, sourceDigest: digest, installation: z.object({ id: z.string(), githubInstallationId: z.string(), updatedAt: z.string().datetime() }).strict(), issuerDigest: digest, claimedAt: z.string().datetime(), expiresAt: z.string().datetime() }).strict();
export const parentStateSchema = z.object({ phase: z.enum(['claimed', 'base_bound', 'credential_pending', 'credential_issued']), base: z.object({ commitSha: z.string().regex(/^[a-f0-9]{40}$/), treeSha: z.string().regex(/^[a-f0-9]{40}$/), modes: z.array(z.object({ path: z.string(), mode: z.enum(['100644', '100755']) }).strict()).min(1).max(20) }).strict().nullable(), providerExpiresAt: z.number().int().positive().nullable() }).strict();
export const effectInputSchema = z.object({ format: z.literal(1), worker: workerSchema, parentId: z.string(), index: z.number().int().min(0).max(23), descriptor: z.object({ method: z.literal('POST'), path: z.string().max(2000), bodyDigest: digest }).strict(), previousDigest: digest }).strict();
export const effectStateSchema = z.discriminatedUnion('phase', [z.object({ phase: z.literal('reserved') }).strict(), z.object({ phase: z.literal('submission_intent') }).strict(), z.object({ phase: z.literal('confirmed'), receipt: z.union([z.object({ sha: z.string().regex(/^[a-f0-9]{40}$/) }).strict(), z.object({ number: z.number().int().positive(), headSha: z.string().regex(/^[a-f0-9]{40}$/) }).strict()]) }).strict()]);
export const deny = (): never => {
    throw Error('coding_outbound_unavailable');
};
export function codingParentId(worker: z.infer<typeof workerSchema>) {
    return 'coding_outbound_parent_' + hash(worker);
}
export function codingEffectId(parentId: string, index: number) {
    return 'coding_outbound_effect_' + hash({ parentId, index });
}
export async function validateCodingRow(tx: Tx, row: Row) {
    const parent = row.workflowKind === CODING_PARENT;
    if (!parent && row.workflowKind !== CODING_EFFECT)
        deny();
    const input = parent ? parentInputSchema.parse(row.inputJson) : effectInputSchema.parse(row.inputJson), state = parent ? parentStateSchema.parse(row.stateJson) : effectStateSchema.parse(row.stateJson), phase = state.phase;
    const expectedId = parent ? codingParentId(input.worker) : codingEffectId((input as z.infer<typeof effectInputSchema>).parentId, (input as z.infer<typeof effectInputSchema>).index);
    const expectedVersion = parent ? ['claimed', 'base_bound', 'credential_pending', 'credential_issued'].indexOf(phase) : ['reserved', 'submission_intent', 'confirmed'].indexOf(phase);
    if (row.id !== expectedId || row.organizationId !== input.worker.organizationId || row.requestedByUserId !== input.worker.actorUserId || row.currentStep !== phase || row.status !== 'paused_for_input' || row.version !== expectedVersion || row.attemptCount !== 1 || row.maxAttempts !== 1 || row.leaseOwner !== null || row.leaseExpiresAt !== null || row.approvalProposalId !== null || (row as Row & {
        autonomyLevel?: string;
    }).autonomyLevel !== 'observe')
        deny();
    const events = await tx.durableAgentWorkflowEvent.findMany({ where: { organizationId: row.organizationId, workflowRunId: row.id }, orderBy: { sequence: 'asc' }, take: 5 });
    if (events.length !== row.version + 1)
        deny();
    let previous: unknown = null;
    let at = row.createdAt;
    for (let i = 0; i < events.length; i++) {
        const e = events[i], d = z.object({ inputDigest: digest, stateDigest: digest, previousStateDigest: digest.nullable(), state: z.unknown() }).strict().parse(e.detailJson), s = parent ? parentStateSchema.parse(d.state) : effectStateSchema.parse(d.state);
        if (e.organizationId !== row.organizationId || e.workflowRunId !== row.id || e.sequence !== i || e.actorKind !== 'system' || e.actorId !== input.worker.actorUserId || e.eventType !== row.workflowKind + '.' + s.phase || d.inputDigest !== hash(input) || d.stateDigest !== hash(s) || d.previousStateDigest !== (previous === null ? null : hash(previous)) || s.phase !== (parent ? ['claimed', 'base_bound', 'credential_pending', 'credential_issued'][i] : ['reserved', 'submission_intent', 'confirmed'][i]) || !Number.isFinite(e.occurredAt.getTime()) || e.occurredAt < at || i === 0 && e.occurredAt.getTime() !== row.createdAt.getTime() || i === row.version && (hash(s) !== hash(state) || e.occurredAt.getTime() !== row.updatedAt.getTime()))
            deny();
        previous = s;
        at = e.occurredAt;
    }
    if (parent) {
        const current = parentStateSchema.parse(state), original = parentInputSchema.parse(input);
        if ((current.phase === 'claimed') !== (current.base === null) || current.phase !== 'credential_issued' && current.providerExpiresAt !== null || current.phase === 'credential_issued' && current.providerExpiresAt === null || Date.parse(original.expiresAt) <= Date.parse(original.claimedAt) || Date.parse(original.expiresAt) > Date.parse(original.claimedAt) + 600000)
            deny();
        let fixedBase: unknown = null;
        for (let i = 0; i < events.length; i++) {
            const s = parentStateSchema.parse((events[i].detailJson as {
                state: unknown;
            }).state);
            if (i === 1)
                fixedBase = s.base;
            if (i >= 1 && hash(s.base) !== hash(fixedBase))
                deny();
            if (i < 3 && s.providerExpiresAt !== null || i === 3 && s.providerExpiresAt === null)
                deny();
        }
    }
    return { input, state };
}
export async function readCodingOutboundBlockersLocked(tx: Tx, org: string, fresh: () => void) {
    let cursor: string | undefined, count = 0;
    for (let page = 0;; page++) {
        fresh();
        const rows = await tx.durableAgentWorkflow.findMany({ where: { organizationId: org, OR: [{ workflowKind: { in: [CODING_PARENT, CODING_EFFECT] } }, { id: { startsWith: 'coding_outbound_' } }] }, orderBy: [{ id: 'asc' }], take: 100, ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}) });
        if (rows.length > 100 || page >= 100 && rows.length)
            deny();
        for (const row of rows) {
            if (row.organizationId !== org)
                deny();
            await validateCodingRow(tx, row);
            fresh();
            count++;
        }
        if (rows.length < 100)
            break;
        cursor = rows[rows.length - 1].id;
    }
    return count;
}
