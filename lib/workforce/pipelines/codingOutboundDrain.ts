import 'server-only';
import type { Prisma, PrismaClient } from '@/lib/prismaClient';
import { z } from 'zod';
import { sha256ContentHash as hash } from '@/lib/tauri/contentHash';
import { readEnrollmentDrainBarrierLocked } from '@/lib/governance/intelligence/enrollmentDrainStore';
import type { ReleaseOperationPlanTransaction as Tx, ReleaseOperationPlanRow as Row } from '@/lib/agent/workflows/releaseOperationPlanStore';
import { readCodingClaimLocked, codingClaimWorker, appendCodingEvent, codingDbClock, type CodingStageClaim } from './codingStageExecutionClaim';
import { CODING_EFFECT, codingEffectId, effectInputSchema, effectStateSchema, validateCodingRow, deny, parentStateSchema } from './codingOutboundHistory';
export interface CodingEffectDescriptor {
    index: number;
    method: 'POST';
    path: string;
    body: unknown;
}
export interface CodingWriteCredential {
    ok: true;
    token: string;
    expiresAt: number;
    permissions: Record<string, string>;
}
export interface CodingOutboundLifecycle {
    signal: AbortSignal;
    current(phase?: "credential_pending"): Promise<() => void>;
    initialize(base: {
        commitSha: string;
        treeSha: string;
        modes: Array<{
            path: string;
            mode: '100644' | '100755';
        }>;
    }): Promise<void>;
    credential(resolve: () => Promise<{
        ok: boolean;
        token?: string;
        expiresAt?: number;
        permissions?: Record<string, string>;
    }>): Promise<CodingWriteCredential>;
    beforeEffect(effect: CodingEffectDescriptor): Promise<{
        beforeFetch(): void;
        recordReceipt(value: unknown): Promise<void>;
    }>;
    complete(): Promise<void>;
}
const sha = z.string().regex(/^[a-f0-9]{40}$/);
type Repo = Pick<PrismaClient, '$transaction'>;
export function createCodingOutboundLifecycle(repo: Repo, proof: CodingStageClaim, signal: AbortSignal): CodingOutboundLifecycle {
    let token: CodingWriteCredential | undefined, issuance: Promise<CodingWriteCredential> | undefined;
    async function transaction<T>(run: (tx: Prisma.TransactionClient, p: Awaited<ReturnType<typeof readCodingClaimLocked>>) => Promise<T>) {
        let fresh: (() => void) | undefined;
        const result = await repo.$transaction(async (tx) => {
            const worker = codingClaimWorker(proof);
            await tx.$queryRaw `SELECT 1 FROM pg_advisory_xact_lock(hashtext(${'governance_org_' + hash(worker.organizationId)}))`;
            const current = await readCodingClaimLocked(tx, proof, signal);
            const barrier = await readEnrollmentDrainBarrierLocked(tx as unknown as Tx, worker.organizationId, signal);
            if (barrier && barrier.status !== 'aborted')
                deny();
            const value = await run(tx, current);
            fresh = (await readCodingClaimLocked(tx, proof, signal)).fresh;
            return value;
        }, { maxWait: 15000, timeout: 15000 });
        if (!fresh)
            deny();
        fresh!();
        return result;
    }
    async function change(tx: Prisma.TransactionClient, row: Row, state: unknown) {
        const parsed = parentStateSchema.parse(state), at = await codingDbClock(tx as unknown as Tx);
        const changed = await tx.durableAgentWorkflow.updateMany({ where: { id: row.id, organizationId: row.organizationId, version: row.version, inputJson: { equals: row.inputJson as Prisma.InputJsonValue }, stateJson: { equals: row.stateJson as Prisma.InputJsonValue } }, data: { stateJson: parsed, currentStep: parsed.phase, version: { increment: 1 }, updatedAt: at } });
        if (changed.count !== 1)
            deny();
        await appendCodingEvent(tx as unknown as Tx, { ...row, version: row.version + 1, stateJson: parsed, currentStep: parsed.phase, updatedAt: at }, row.stateJson);
    }
    function plan(p: Awaited<ReturnType<typeof readCodingClaimLocked>>) {
        const metadata = p.source.run.metadata as {
            instruction?: unknown;
        };
        const instruction = z.string().min(1).parse(metadata?.instruction);
        const a = p.source.artifact, [owner, repo] = a.repositoryFullName.split('/'), branch = `ai/${p.context.worker.runId.slice(-8)}`;
        return { artifact: a, prefix: `/repos/${owner}/${repo}`, branch, message: `[ai-coding] ${instruction.slice(0, 60)}\n\nApplied via VisionXIXLabs AI coding loop.\nCorrelation: ${p.source.run.correlationId}`, title: `[ai-coding] ${instruction.slice(0, 80)}`, body: [`Staged by the VisionXIXLabs AI coding loop.`, ``, `**Instruction:** ${instruction}`, `**Correlation:** \`${p.source.run.correlationId}\``, `**Run id:** \`${p.context.worker.runId}\``, ``, `This change passed the platform's configured approval gate before this branch was pushed. Approval principals may include authenticated API keys; this does not assert two distinct human reviewers. Please review the diff carefully before merging.`].join('\n') };
    }
    function expected(p: Awaited<ReturnType<typeof readCodingClaimLocked>>, index: number, receipts: any[]): CodingEffectDescriptor {
        const value = plan(p), files = value.artifact.files.filter(f => f.after !== null), b = files.length, base = p.state.base;
        if (!base || index < 0 || index >= b + 4 || receipts.length !== index)
            deny();
        const path = value.prefix;
        if (index < b)
            return { index, method: 'POST', path: path + '/git/blobs', body: { content: Buffer.from(files[index].after!, 'utf8').toString('base64'), encoding: 'base64' } };
        if (index === b) {
            let blob = 0;
            return { index, method: 'POST', path: path + '/git/trees', body: { base_tree: base!.treeSha, tree: value.artifact.files.map(file => ({ path: file.path, mode: base!.modes.find(m => m.path === file.path)!.mode, type: 'blob', sha: file.after === null ? null : receipts[blob++].sha })) } };
        }
        if (index === b + 1)
            return { index, method: 'POST', path: path + '/git/commits', body: { message: value.message, tree: receipts[index - 1].sha, parents: [value.artifact.baseCommitSha] } };
        if (index === b + 2)
            return { index, method: 'POST', path: path + '/git/refs', body: { ref: 'refs/heads/' + value.branch, sha: receipts[index - 1].sha } };
        return { index, method: 'POST', path: path + '/pulls', body: { title: value.title, body: value.body, head: value.branch, base: value.artifact.baseBranch } };
    }
    const descriptor = (e: CodingEffectDescriptor) => ({ method: e.method, path: e.path, bodyDigest: hash(e.body) });
    async function children(tx: Prisma.TransactionClient, p: Awaited<ReturnType<typeof readCodingClaimLocked>>, active = false) {
        const rows = await tx.durableAgentWorkflow.findMany({ where: { organizationId: p.context.worker.organizationId, inputJson: { path: ['parentId'], equals: proof.parentId } }, orderBy: { id: 'asc' }, take: 25 });
        const max = p.source.artifact.files.filter(f => f.after !== null).length + 4;
        if (rows.length > max)
            deny();
        const sorted = rows.map(row => ({ row, input: effectInputSchema.parse(row.inputJson) })).sort((a, b) => a.input.index - b.input.index), receipts: any[] = [];
        for (let i = 0; i < sorted.length; i++) {
            const { row, input } = sorted[i], wanted = { format: 1, worker: p.context.worker, parentId: proof.parentId, index: i, descriptor: descriptor(expected(p, i, receipts)), previousDigest: hash(receipts) };
            const checked = await validateCodingRow(tx as unknown as Tx, row);
            if (row.id !== codingEffectId(proof.parentId, i) || hash(input) !== hash(wanted))
                deny();
            const state = effectStateSchema.parse(checked.state);
            if (state.phase === 'confirmed') {
                const b = p.source.artifact.files.filter(f => f.after !== null).length;
                if (i < b + 3) {
                    if (!('sha' in state.receipt) || i === b + 2 && state.receipt.sha !== receipts[b + 1].sha)
                        deny();
                }
                else if (!('number' in state.receipt) || state.receipt.headSha !== receipts[b + 1].sha)
                    deny();
                receipts.push(state.receipt);
            }
            else if (!active || i !== sorted.length - 1)
                deny();
        }
        return { sorted, receipts };
    }
    return {
        signal,
        async current(phase) {
            return transaction(async (_tx, p) => {
                if (phase && p.state.phase !== phase)
                    deny();
                return p.fresh;
            });
        },
        async initialize(raw) {
            await transaction(async (tx, p) => {
                if (p.state.phase !== 'claimed')
                    deny();
                const base = parentStateSchema.shape.base.unwrap().parse(raw);
                if (base.commitSha !== p.source.artifact.baseCommitSha || hash(base.modes.map(m => m.path).sort()) !== hash(p.source.artifact.files.map(f => f.path).sort()) || new Set(base.modes.map(m => m.path)).size !== base.modes.length)
                    deny();
                await change(tx, p.row, { phase: 'base_bound', base, providerExpiresAt: null });
            });
        },
        async credential(resolve) {
            if (!issuance)
                issuance = (async () => {
                    await transaction(async (tx, p) => {
                        if (p.state.phase !== 'base_bound')
                            deny();
                        await change(tx, p.row, { ...p.state, phase: 'credential_pending' });
                    });
                    const value = await resolve();
                    if (!value.ok || typeof value.token !== 'string' || !value.token || !Number.isSafeInteger(value.expiresAt) || value.expiresAt! <= Date.now() || hash(value.permissions) !== hash({ contents: 'write', pull_requests: 'write', metadata: 'read' }))
                        deny();
                    const credential = value as CodingWriteCredential;
                    await transaction(async (tx, p) => {
                        const at = await codingDbClock(tx as unknown as Tx);
                        if (p.state.phase !== 'credential_pending' || credential.expiresAt <= at.getTime())
                            deny();
                        await change(tx, p.row, { ...p.state, phase: 'credential_issued', providerExpiresAt: credential.expiresAt });
                    });
                    token = credential;
                    return credential;
                })();
            return issuance;
        },
        async beforeEffect(raw) {
            const initial = await transaction(async (tx, p) => {
                if (p.state.phase !== 'credential_issued' || !token || p.state.providerExpiresAt !== token.expiresAt || token.expiresAt <= Date.now())
                    deny();
                const previous = await children(tx, p);
                const index = previous.receipts.length, effect = expected(p, index, previous.receipts);
                if (hash(effect) !== hash(raw))
                    deny();
                const at = await codingDbClock(tx as unknown as Tx), input = { format: 1, worker: p.context.worker, parentId: proof.parentId, index, descriptor: descriptor(effect), previousDigest: hash(previous.receipts) }, state = { phase: 'reserved' };
                const row = await tx.durableAgentWorkflow.create({ data: { id: codingEffectId(proof.parentId, index), organizationId: p.context.worker.organizationId, workflowKind: CODING_EFFECT, objective: 'Fixed coding physical effect; no independent authority', requestedByUserId: p.context.worker.actorUserId, autonomyLevel: 'observe', status: 'paused_for_input', currentStep: 'reserved', inputJson: input, stateJson: state, attemptCount: 1, maxAttempts: 1, version: 0, leaseOwner: null, leaseExpiresAt: null, approvalProposalId: null, createdAt: at, updatedAt: at } });
                await appendCodingEvent(tx as unknown as Tx, row, null);
                return { index, input };
            });
            let fresh: (() => void) | undefined;
            await transaction(async (tx, p) => {
                const all = await children(tx, p, true), row = all.sorted.at(-1)?.row;
                if (!row || row.id !== codingEffectId(proof.parentId, initial.index) || row.currentStep !== 'reserved')
                    deny();
                const state = { phase: 'submission_intent' }, at = await codingDbClock(tx as unknown as Tx);
                const changed = await tx.durableAgentWorkflow.updateMany({ where: { id: row!.id, version: 0, inputJson: { equals: initial.input }, stateJson: { equals: { phase: 'reserved' } } }, data: { stateJson: state, currentStep: 'submission_intent', version: { increment: 1 }, updatedAt: at } });
                if (changed.count !== 1)
                    deny();
                await appendCodingEvent(tx as unknown as Tx, { ...row!, version: 1, stateJson: state, currentStep: 'submission_intent', updatedAt: at }, row!.stateJson);
                fresh = p.fresh;
            });
            const deadline = Date.now() + 15000;
            let sent = false, recorded = false;
            return { beforeFetch() {
                    signal.throwIfAborted();
                    if (sent || !fresh || Date.now() >= deadline || !token || token.expiresAt <= Date.now() || hash(descriptor(raw)) !== hash(initial.input.descriptor))
                        deny();
                    fresh!();
                    sent = true;
                }, async recordReceipt(rawReceipt) {
                    if (!sent || recorded)
                        deny();
                    recorded = true;
                    await transaction(async (tx, p) => {
                        const all = await children(tx, p, true), row = all.sorted.at(-1)?.row;
                        if (!row || row.currentStep !== 'submission_intent' || row.id !== codingEffectId(proof.parentId, initial.index))
                            deny();
                        const b = p.source.artifact.files.filter(f => f.after !== null).length, v = rawReceipt as any;
                        let receipt: any;
                        if (initial.index < b + 2)
                            receipt = { sha: sha.parse(v?.sha) };
                        else if (initial.index === b + 2) {
                            const commit = all.receipts[b + 1].sha;
                            if (v?.ref !== 'refs/heads/' + plan(p).branch || v?.object?.sha !== commit)
                                deny();
                            receipt = { sha: commit };
                        }
                        else {
                            const value = plan(p), commit = all.receipts[b + 1].sha;
                            if (!Number.isSafeInteger(v?.number) || v.number <= 0 || v?.head?.repo?.full_name !== value.artifact.repositoryFullName || v?.base?.repo?.full_name !== value.artifact.repositoryFullName || v.head.ref !== value.branch || v.head.sha !== commit || v.base.ref !== value.artifact.baseBranch || v.base.sha !== value.artifact.baseCommitSha)
                                deny();
                            receipt = { number: v.number, headSha: commit };
                        }
                        const at = await codingDbClock(tx as unknown as Tx), state = { phase: 'confirmed', receipt };
                        const changed = await tx.durableAgentWorkflow.updateMany({ where: { id: row!.id, version: 1, inputJson: { equals: initial.input }, stateJson: { equals: { phase: 'submission_intent' } } }, data: { stateJson: state, currentStep: 'confirmed', version: { increment: 1 }, updatedAt: at } });
                        if (changed.count !== 1)
                            deny();
                        await appendCodingEvent(tx as unknown as Tx, { ...row!, version: 2, stateJson: state, currentStep: 'confirmed', updatedAt: at }, row!.stateJson);
                    });
                } };
        },
        async complete() {
            await transaction(async (tx, p) => {
                const all = await children(tx, p);
                if (all.receipts.length !== p.source.artifact.files.filter(f => f.after !== null).length + 4)
                    deny();
            });
        }
    };
}
