import { beforeAll, afterAll, afterEach, describe, it, expect, vi } from 'vitest';
import { createRequire } from 'node:module';
import { randomUUID } from 'node:crypto';
import { realpathSync, statSync } from 'node:fs';
const f = vi.hoisted(() => ({ db: null as any, locker: null as any, token: vi.fn(), afterIntent: null as null | (() => void), afterCredential: null as null | (() => Promise<void>), afterReceipt: null as null | (()=>Promise<void>), paths: [] as string[], org: "", issuer: true }));
vi.mock('@/lib/db', () => ({ get prisma() { return f.db; } }));
vi.mock('@/lib/audit/secureAudit', () => ({ record: async () => { } }));
vi.mock('@/lib/webhooks/dispatchWebhookEvent', () => ({ dispatchWebhookEvent: async () => { } }));
vi.mock('../budgetConfigStore', () => ({ loadBudgetConfig: async () => null }));
vi.mock('../codingGithubCredential', async (original) => ({ ...await original<typeof import('../codingGithubCredential')>(), resolveCodingGithubCredential: async () => ({ ok: true, token: 'SIMULATED_READ' }), readCodingGithubFile: async () => ({ ok: true, content: 'old\n' }) }));
vi.mock('@/lib/connectors/github/githubAppAuth', () => ({ resolveReleaseInstallationToken: async (input: any) => { const fresh = await input.assertCurrent(); fresh(); const value = await f.token(input); return value.ok ? value : null; } }));
// Positive issuer is explicitly simulated; production module remains unavailable.
vi.mock('../codingOutboundIssuer', async (original) => { const actual: any = await original(); return { readCodingOutboundIssuerDigest: () => f.issuer ? 'f'.repeat(64) : actual.readCodingOutboundIssuerDigest() }; });
import { advancePipelineRun } from '../pipelineRunner';
import { registerStageExecutor } from '../stageExecutorRegistry';
import { codePrOpenRealExecutor } from '../codePrOpenRealExecutor';
import {sha256ContentHash as contentHash} from '@/lib/tauri/contentHash';
import {claimCodingStage} from '../codingStageExecutionClaim';
import {readEnrollmentDrainBlockersLocked} from '@/lib/governance/intelligence/enrollmentDrainStore';
import { buildCodingArtifact } from '../codingArtifact';
const socket = process.env.AXIOM_CODING_OUTBOUND_SOCKET;
describe.skipIf(!socket)('actual coding stage/claim/artifact/effect stores, simulated auth/token/provider', () => {
    beforeAll(async () => { if (!socket || !/^\/private\/tmp\/axiom-coding-outbound-pg-[^/]+\/socket$/.test(socket) || realpathSync(socket) !== socket || (statSync(socket).mode & 0o077) !== 0)
        throw Error('owned_fixture_required'); const Client = createRequire(import.meta.url)(process.env.AXIOM_CODING_OUTBOUND_CLIENT!).PrismaClient; const url = `postgresql://coding_fixture@localhost/coding_fixture?host=${encodeURIComponent(socket)}`; const actual = new Client({ datasources: { db: { url } } }); f.db = new Proxy(actual, { get(db, key) { if (key === '$transaction')
            return async (...args: any[]) => { const result = await db.$transaction(...args); if(f.afterReceipt && await db.durableAgentWorkflow.count({where:{organizationId:f.org,workflowKind:'coding_outbound_effect_v1',currentStep:'confirmed'}})){const callback=f.afterReceipt;f.afterReceipt=null;await callback()} if (f.afterCredential && await db.durableAgentWorkflow.count({ where: { organizationId: f.org, workflowKind: 'coding_outbound_parent_v1', currentStep: 'credential_issued' } })) {
                const callback = f.afterCredential;
                f.afterCredential = null;
                await callback();
            } if (f.afterIntent && await db.durableAgentWorkflow.count({ where: { organizationId: f.org, workflowKind: 'coding_outbound_effect_v1', currentStep: 'submission_intent' } })) {
                const callback = f.afterIntent;
                f.afterIntent = null;
                callback();
            } return result; }; const value = db[key]; return typeof value === 'function' ? value.bind(db) : value; } }); f.locker = new Client({ datasources: { db: { url } } }); const [r] = await f.db.$queryRawUnsafe("SELECT current_database()='coding_fixture' AND current_user='coding_fixture' AND current_setting('listen_addresses')='' AS private"); expect(r.private).toBe(true); registerStageExecutor('code_pr_open', codePrOpenRealExecutor); });
    afterAll(async () => { await f.locker?.$disconnect(); await f.db?.$disconnect(); });
    afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
    async function fixture(machine = false, count=1, deletion=false) {
        f.issuer = true;
        f.afterIntent = null;
        f.afterCredential = null;f.afterReceipt=null;
        const org = 'coding-' + randomUUID(), actor = org + '-actor', runId = org + '-run', readId = org + '-read', proposeId = org + '-propose', gateId = org + '-gate', stageId = org + '-write', now = new Date();
        f.org = org;
        for (const userId of [actor, org + '-reviewer1', org + '-reviewer2'])
            await f.db.orgMembership.create({ data: { organizationId: org, userId, role: 'admin', acceptedAt: now } });
        await f.db.gitHubInstallation.create({ data: { id: org + '-connection', organizationId: org, githubInstallationId: '123', accountLogin: 'fixture', status: 'active', updatedAt: now } });
        await f.db.pipelineRun.create({ data: { id: runId, organizationId: org, pipelineId: 'ai_coding', triggeredBy: actor, status: 'running', correlationId: org, metadata: { repoRef: 'fixture/repository', instruction: 'Exact reviewed fix' } } });
        f.paths=Array.from({length:count},(_,i)=>count===1?'file.txt':`file${i}.txt`);const patch=f.paths.map(path=>deletion?`--- a/${path}\n+++ /dev/null\n@@ -1 +0,0 @@\n-old\n`:`--- a/${path}\n+++ b/${path}\n@@ -1 +1 @@\n-old\n+new\n`).join('');
        const built = buildCodingArtifact({ organizationId: org, runId, readStageRunId: readId, proposalStageRunId: proposeId, repositoryFullName: 'fixture/repository', baseBranch: 'main', baseCommitSha: 'a'.repeat(40), patchText: patch, baseFiles: f.paths.map(path=>({path,content:'old\n'})) });
        if (!built.ok)
            throw Error('badfixture');
        for (const [id, ordering, stageKind, outputDetail] of [[readId, 0, 'code_read', { owner: 'fixture', repo: 'repository', branch: 'main', headSha: 'a'.repeat(40) }], [proposeId, 1, 'code_propose', { proposedPatchText: patch }], [gateId, 2, 'approval_gate', { codingArtifact: built.artifact, codingArtifactDigest: built.digest }]])
            await f.db.pipelineStageRun.create({ data: { id, runId, ordering, stageId: stageKind === 'approval_gate' ? 'code_gate' : stageKind, stageKind, status: 'succeeded', outputDetail, completedAt: now } });
        const request = org + '-request';
        await f.db.pipelineStageRun.update({ where: { id: gateId }, data: { approvalRequestId: request } });
        const snap = await f.db.engineerApprovalSnapshot.create({ data: { organizationId: org, approvalRequestId: request, engineerId: 'fixture', action: `pipeline_stage:ai_coding:code_gate:${built.digest}`, riskLevel: 'high', effectiveRule: 'two_step_approval', requiredApprovers: 2, correlationId: org, status: 'approved', requestedBy: actor, sourceKind: 'pipeline_stage', pipelineStageRunId: gateId } });
        if (machine)
            for (const suffix of ['one', 'two'])
                await f.db.apiKey.create({ data: { id: org + '-' + suffix, organizationId: org, name: 'simulated machine', prefix: org + '-' + suffix, keyHash: org + '-' + suffix, env: 'test', scopes: ['pipeline:trigger'], createdBy: actor, expiresAt: new Date(Date.now() + 3000) } });
        for (const userId of machine ? ['api_key:' + org + '-one', 'api_key:' + org + '-two'] : [org + '-reviewer1', org + '-reviewer2'])
            await f.db.engineerApprovalDecision.create({ data: { id: 'boundvote_v1_' + randomUUID(), organizationId: org, snapshotId: snap.id, approverUserId: userId, decision: 'approved' } });
        await f.db.pipelineStageRun.create({ data: { id: stageId, runId, ordering: 3, stageId: 'code_pr_open', stageKind: 'code_pr_open', status: 'queued' } });
        f.token.mockReset();
        f.token.mockResolvedValue({ ok: true, token: 'SIMULATED', expiresAt: Date.now() + 300000, permissions: { contents: 'write', pull_requests: 'write', metadata: 'read' } });
        return { org, actor, runId, stageId };
    }
    it('[vertical] real queued-stage CAS and one reviewed file own five ordered effects', async () => {
        const t = await fixture();
        let writes = 0;
        const counts: number[] = [];
        vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => {
            if ((init.method ?? 'GET') === 'GET')
                return Response.json(url.includes('/git/ref/') ? { object: { sha: 'a'.repeat(40) } } : url.includes('/git/commits/') ? { tree: { sha: 'b'.repeat(40) } } : { truncated: false, tree: [{ path: 'file.txt', type: 'blob', mode: '100644', sha: 'c'.repeat(40) }] });
            const count = await f.db.durableAgentWorkflow.count({ where: { organizationId: t.org, workflowKind: 'coding_outbound_effect_v1' } });
            counts.push(count);
            console.info('CODING_FIXED_WRITE_CHILDREN', JSON.stringify(counts));
            expect(count).toBe(writes + 1);
            expect(await f.db.durableAgentWorkflow.count({ where: { organizationId: t.org, workflowKind: 'coding_outbound_effect_v1', currentStep: 'submission_intent' } })).toBe(1);
            await f.locker.$transaction(async (tx: any) => { await tx.$queryRawUnsafe('SELECT \"id\" FROM \"PipelineStageRun\" WHERE \"id\"=$1 FOR UPDATE NOWAIT', t.stageId); });
            writes++;
            return Response.json(writes === 4 ? { ref: `refs/heads/ai/${t.runId.slice(-8)}`, object: { sha: '3'.repeat(40) } } : writes === 5 ? { number: 42, html_url: 'https://github.com/fixture/repository/pull/42', head: { ref: `ai/${t.runId.slice(-8)}`, sha: '3'.repeat(40), repo: { full_name: 'fixture/repository' } }, base: { ref: 'main', sha: 'a'.repeat(40), repo: { full_name: 'fixture/repository' } } } : { sha: String(writes).repeat(40) });
        }));
        await advancePipelineRun(t.runId);
        expect(counts).toEqual([1, 2, 3, 4, 5]);
        expect(writes).toBe(5);
        expect(await f.db.pipelineStageRun.findUnique({ where: { id: t.stageId } })).toMatchObject({ status: 'succeeded' });
        expect(f.token).toHaveBeenCalledOnce();
    });
    function basicRead(url: string) { return Response.json(url.includes('/git/ref/') ? { object: { sha: 'a'.repeat(40) } } : url.includes('/git/commits/') ? { tree: { sha: 'b'.repeat(40) } } : { truncated: false, tree: f.paths.map(path=>({path,type:'blob',mode:'100755',sha:'c'.repeat(40)})) }); }
    it('[freshness] API-key approval expires after intent commit before fetch, without human substitution', async () => {
        const t = await fixture(true);
        let writes = 0;
        const original = Date.now;
        f.afterIntent = () => { vi.spyOn(Date, 'now').mockImplementation(() => original() + 5000); };
        vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => { if ((init.method ?? 'GET') === 'GET')
            return basicRead(url); writes++; return Response.json({ sha: '1'.repeat(40) }); }));
        await advancePipelineRun(t.runId);
        expect(writes).toBe(0);
        expect(await f.db.durableAgentWorkflow.count({ where: { organizationId: t.org, workflowKind: 'coding_outbound_effect_v1', currentStep: 'submission_intent' } })).toBe(1);
    });
    it('[freshness] enrollment appearing after credential issuance refuses all physical effects', async () => {
        const t = await fixture();
        let writes = 0;
        f.afterCredential = async () => { await f.db.durableAgentWorkflow.create({ data: { id: 'governance_active_' + t.org, organizationId: t.org, workflowKind: 'governance_baseline_active_v1', requestedByUserId: t.actor, objective: 'SIMULATED enrollment metadata only', autonomyLevel: 'observe', status: 'paused_for_input', currentStep: 'active', inputJson: {}, stateJson: {}, maxAttempts: 1 } }); };
        vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => { if ((init.method ?? 'GET') === 'GET')
            return basicRead(url); writes++; return Response.json({ sha: '1'.repeat(40) }); }));
        await advancePipelineRun(t.runId);
        expect(writes).toBe(0);
        expect(await f.db.durableAgentWorkflow.count({ where: { organizationId: t.org, workflowKind: 'coding_outbound_effect_v1' } })).toBe(0);
    });
    it('[canonical] unavailable actual issuer leaves original queued stage and all ledgers untouched', async () => {
        const t = await fixture();
        f.issuer = false;
        const fetch = vi.fn();
        vi.stubGlobal('fetch', fetch);
        await advancePipelineRun(t.runId);
        expect(await f.db.pipelineStageRun.findUnique({ where: { id: t.stageId } })).toMatchObject({ status: 'queued' });
        expect(f.token).not.toHaveBeenCalled();
        expect(fetch).not.toHaveBeenCalled();
        expect(await f.db.durableAgentWorkflow.count({ where: { organizationId: t.org } })).toBe(0);
    });
    it.each([1, 2, 3, 4, 5])('[unknown] lost response at physical effect %i never resumes or resends', async (lost) => {
        const t = await fixture();
        let writes = 0;
        vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => { if ((init.method ?? 'GET') === 'GET')
            return basicRead(url); writes++; if (writes === lost)
            throw Error('SIMULATED lost provider acknowledgment'); return Response.json(writes === 4 ? { ref: `refs/heads/ai/${t.runId.slice(-8)}`, object: { sha: '3'.repeat(40) } } : writes === 5 ? { number: 42, head: { ref: `ai/${t.runId.slice(-8)}`, sha: '3'.repeat(40), repo: { full_name: 'fixture/repository' } }, base: { ref: 'main', sha: 'a'.repeat(40), repo: { full_name: 'fixture/repository' } } } : { sha: String(writes).repeat(40) }); }));
        await advancePipelineRun(t.runId);
        expect(writes).toBe(lost);
        const before = await f.db.durableAgentWorkflow.findMany({ where: { organizationId: t.org }, orderBy: { id: 'asc' } });
        expect(before.filter((r: any) => r.currentStep === 'submission_intent')).toHaveLength(1);
        await advancePipelineRun(t.runId);
        expect(writes).toBe(lost);
        expect(await f.db.durableAgentWorkflow.findMany({ where: { organizationId: t.org }, orderBy: { id: 'asc' } })).toEqual(before);
        expect(f.token).toHaveBeenCalledOnce();
    });
    it.each(['reviewer', 'installation'])('[current] %s revoked during first response blocks receipt and every dependent effect', async (what) => {
        const t = await fixture();
        let writes = 0;
        vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => { if ((init.method ?? 'GET') === 'GET')
            return basicRead(url); writes++; if (what === 'reviewer')
            await f.locker.orgMembership.update({ where: { userId_organizationId: { userId: t.org + '-reviewer1', organizationId: t.org } }, data: { role: 'viewer' } });
        else
            await f.locker.gitHubInstallation.update({ where: { id: t.org + '-connection' }, data: { revokedAt: new Date() } }); return Response.json({ sha: '1'.repeat(40) }); }));
        await advancePipelineRun(t.runId);
        expect(writes).toBe(1);
        expect(await f.db.durableAgentWorkflow.count({ where: { organizationId: t.org, workflowKind: 'coding_outbound_effect_v1', currentStep: 'submission_intent' } })).toBe(1);
        await advancePipelineRun(t.runId);
        expect(writes).toBe(1);
    });
    it('[ack] lost acknowledgment after actual intent commit preserves unknown without dispatch or restart adoption', async () => {
        const t = await fixture();
        let writes = 0;
        f.afterIntent = () => { throw Error('SIMULATED commit acknowledgment lost'); };
        vi.stubGlobal('fetch', vi.fn(async (url: string, init: any) => { if ((init.method ?? 'GET') === 'GET')
            return basicRead(url); writes++; return Response.json({ sha: '1'.repeat(40) }); }));
        await advancePipelineRun(t.runId);
        expect(writes).toBe(0);
        expect(await f.db.durableAgentWorkflow.count({ where: { organizationId: t.org, workflowKind: 'coding_outbound_effect_v1', currentStep: 'submission_intent' } })).toBe(1);
        await advancePipelineRun(t.runId);
        expect(writes).toBe(0);
        expect(f.token).toHaveBeenCalledOnce();
    });
 it.each([[1,true],[20,false]] as const)('[bounds] %i changed files deletion=%s preserve B+4 effects and executable modes',async(count,deletion)=>{
  const t=await fixture(false,count,deletion);let writes=0;const b=deletion?0:count;vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{if((init.method??'GET')==='GET')return basicRead(url);writes++;const body=JSON.parse(init.body);if(writes===b+1){expect(body.tree).toHaveLength(count);expect(body.tree.every((x:any)=>x.mode==='100755')).toBe(true);if(deletion)expect(body.tree.every((x:any)=>x.sha===null)).toBe(true)}return Response.json(writes===b+3?{ref:`refs/heads/ai/${t.runId.slice(-8)}`,object:{sha:'d'.repeat(40)}}:writes===b+4?{number:42,html_url:'https://github.com/fixture/repository/pull/42',head:{ref:`ai/${t.runId.slice(-8)}`,sha:'d'.repeat(40),repo:{full_name:'fixture/repository'}},base:{ref:'main',sha:'a'.repeat(40),repo:{full_name:'fixture/repository'}}}:{sha:writes===b+2?'d'.repeat(40):'e'.repeat(40)})}));
  await advancePipelineRun(t.runId);expect(writes).toBe(b+4);expect(await f.db.pipelineStageRun.findUnique({where:{id:t.stageId}})).toMatchObject({status:'succeeded'});expect(f.token).toHaveBeenCalledOnce();
  const blockers=await f.db.$transaction((tx:any)=>readEnrollmentDrainBlockersLocked(tx,t.org,{signal:AbortSignal.timeout(15000),assertCurrent:async()=>()=>{}}));expect(blockers.blockingCount).toBe(b+5);expect(blockers.runtimeQualification).toBe('unavailable');
 });
 it('[claim] concurrent attempts cannot mint a second private stage claim or adopt running history',async()=>{
  const t=await fixture();const results=await Promise.all([claimCodingStage(f.db,t.org,t.runId,t.stageId),claimCodingStage(f.db,t.org,t.runId,t.stageId)]);expect(results.filter(Boolean)).toHaveLength(1);expect(await f.db.durableAgentWorkflow.count({where:{organizationId:t.org}})).toBe(1);expect(await claimCodingStage(f.db,t.org,t.runId,t.stageId)).toBeNull();expect(f.token).not.toHaveBeenCalled();
 });
 it.each(['receipt','history'])('[dependency] substituted canonical child %s stops all later writes',async kind=>{
  const t=await fixture();let writes=0;f.afterReceipt=async()=>{const row=await f.db.durableAgentWorkflow.findFirst({where:{organizationId:t.org,workflowKind:'coding_outbound_effect_v1',currentStep:'confirmed'}});if(kind==='receipt')await f.locker.durableAgentWorkflow.update({where:{id:row.id},data:{stateJson:{phase:'confirmed',receipt:{sha:'9'.repeat(40)}}}});else await f.locker.durableAgentWorkflowEvent.updateMany({where:{workflowRunId:row.id,sequence:2},data:{eventType:'SIMULATED_SUBSTITUTION'}})};
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{if((init.method??'GET')==='GET')return basicRead(url);writes++;return Response.json({sha:'1'.repeat(40)})}));await advancePipelineRun(t.runId);expect(writes).toBe(1);expect(await f.db.durableAgentWorkflow.count({where:{organizationId:t.org,workflowKind:'coding_outbound_effect_v1'}})).toBe(1);await advancePipelineRun(t.runId);expect(writes).toBe(1);
 });

 it.each([4,5])('[typed-receipt] coherent event rewrite at effect %i cannot substitute ref or final PR proof',async target=>{
  const t=await fixture();let writes=0;async function alter(){const n=await f.db.durableAgentWorkflow.count({where:{organizationId:t.org,workflowKind:'coding_outbound_effect_v1',currentStep:'confirmed'}});if(n!==target){f.afterReceipt=alter;return}const row=await f.db.durableAgentWorkflow.findFirst({where:{organizationId:t.org,workflowKind:'coding_outbound_effect_v1',currentStep:'confirmed'},orderBy:{createdAt:'desc'}});const state={phase:'confirmed',receipt:{sha:'9'.repeat(40)}};const event=await f.db.durableAgentWorkflowEvent.findFirst({where:{workflowRunId:row.id,sequence:2}});await f.locker.$transaction(async(tx:any)=>{await tx.durableAgentWorkflow.update({where:{id:row.id},data:{stateJson:state}});await tx.durableAgentWorkflowEvent.update({where:{id:event.id},data:{detailJson:{...event.detailJson,state,stateDigest:contentHash(state)}}})})}f.afterReceipt=alter;
  vi.stubGlobal('fetch',vi.fn(async(url:string,init:any)=>{if((init.method??'GET')==='GET')return basicRead(url);writes++;return Response.json(writes===4?{ref:`refs/heads/ai/${t.runId.slice(-8)}`,object:{sha:'3'.repeat(40)}}:writes===5?{number:42,html_url:'https://github.com/fixture/repository/pull/42',head:{ref:`ai/${t.runId.slice(-8)}`,sha:'3'.repeat(40),repo:{full_name:'fixture/repository'}},base:{ref:'main',sha:'a'.repeat(40),repo:{full_name:'fixture/repository'}}}:{sha:String(writes).repeat(40)})}));await advancePipelineRun(t.runId);expect(writes).toBe(target);expect(await f.db.pipelineStageRun.findUnique({where:{id:t.stageId}})).toMatchObject({status:'failed'});await advancePipelineRun(t.runId);expect(writes).toBe(target);
 });

});
