import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {createSavedBotTask,updateSavedBotTask} from '../savedTaskRepo';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {createPullRequestEvidenceRun,claimPullRequestEvidenceRun,finishPullRequestEvidenceRun} from '../pullRequestEvidenceRepo';
import {createAiTaskRun} from '../aiTaskRepo';
import {claimAiTaskRun,claimAiTaskDispatch,completeAiTaskRun} from '../aiTaskLifecycle';
import {aiTaskRunId,aiTaskCorrelationId} from '../aiTaskContract';
const socket=process.env.AXIOM_BOT_CONTEXT_PG_SOCKET;
describe.skipIf(!socket)('selected PR AI context actual owned PostgreSQL',()=>{
 let client:any;const scope={organizationId:'owned-org',userId:'owned-user'},authority='c'.repeat(64),workerId='worker_'+'a'.repeat(32);
 beforeAll(async()=>{
  if(!socket||!/^\/private\/tmp\/axiom-bot-context-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0)throw new Error('owned_socket_required');
  const generated=process.env.AXIOM_BOT_CONTEXT_PG_CLIENT;if(!generated||!/^\/private\/tmp\/axiom-bot-context-pg-evidence-[^/]+\/generated\/index\.js$/.test(generated))throw new Error('owned_client_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;client=new Client({datasources:{db:{url:`postgresql://recovery_fixture@localhost/neondb?host=${encodeURIComponent(socket)}`}}});
  const [check]=await client.$queryRawUnsafe("SELECT current_database()='neondb' AND current_user='recovery_fixture' AND current_setting('listen_addresses')='' AS private");if(!check?.private)throw new Error('owned_binding_required');
 });
 afterAll(async()=>{await client?.$disconnect()});
 const bind=(row:any)=>({runId:row.id,expectedRevision:row.revision,snapshotDigest:row.snapshotDigest,workerId});
 async function fixture(){
  const task=await createSavedBotTask(client,scope,{clientRequestId:randomUUID(),title:'Owned context',instruction:'Explain the selected recorded PR evidence. No tools.',context:'Unicode: 界 😀; punctuation: { , : }'});
  const releaseId='release-'+randomUUID(),connectionId='connection-'+randomUUID(),revision=new Date();
  await client.$executeRaw`INSERT INTO "TauriDeploymentRequest"("id","organizationId","status","version","intakeJson") VALUES (${releaseId},${scope.organizationId},'submitted',1,'{"target":"owned"}'::jsonb)`;
  await client.$executeRaw`INSERT INTO "GitHubInstallation"("id","organizationId","status","updatedAt","githubInstallationId") VALUES (${connectionId},${scope.organizationId},'active',${revision},'123')`;
  const prInput={taskId:task.id,expectedVersion:task.version,clientRequestId:randomUUID()},binding={releaseId,releaseVersion:1,releaseDigest:sha256ContentHash({requestVersion:1,intake:{target:'owned'}}),repositoryFullName:'owner/repository',pullRequestNumber:7,connectionId,connectionRevision:revision.toISOString()};
  const queued=await createPullRequestEvidenceRun(client,scope,prInput,binding),running=await claimPullRequestEvidenceRun(client,scope,bind(queued));
  const observedAt=new Date(),card={kind:'release_pull_request_evidence_v1',authority:'evidence_only',observedAt:observedAt.toISOString(),...binding,pullRequest:{number:7,repositoryFullName:'owner/repository',headRepositoryFullName:'owner/repository',headRef:'feature',headSha:'a'.repeat(40),baseRef:'main',baseSha:'b'.repeat(40),state:'open',draft:false,merged:false}};
  await finishPullRequestEvidenceRun(client,scope,bind(running),{status:'completed',content:JSON.stringify(card),observedAt});
  const artifact=await client.botPullRequestEvidenceArtifact.findFirst({where:{runId:queued.id}});
  const input={taskId:task.id,expectedVersion:task.version,kind:'ai_task_response_v1',modelId:'anthropic/test',clientRequestId:randomUUID(),confirmSend:true,evidenceContext:{kind:'saved_pr_evidence_v1',runId:queued.id,artifactHash:artifact.contentHash,confirmUse:true}};
  return{task,binding,input};
 }
 it('creates and concurrently replays one format2 snapshot/event without a provider call',async()=>{const f=await fixture();const rows=await Promise.all([createAiTaskRun(client,scope,f.input,authority),createAiTaskRun(client,scope,f.input,authority)]);expect(rows[0].id).toBe(rows[1].id);expect(rows[0].snapshotJson.format).toBe(2);expect(await client.botAiTaskEvent.count({where:{runId:rows[0].id}})).toBe(1);await expect(createAiTaskRun(client,scope,{...f.input,evidenceContext:{...f.input.evidenceContext,artifactHash:'0'.repeat(64)}},authority)).rejects.toThrow();const [size]=await client.$queryRaw`SELECT octet_length("snapshotJson"::text) AS bytes FROM "BotAiTaskRun" WHERE "id"=${rows[0].id}`;expect(size.bytes).toBeLessThanOrEqual(22000)});
 it.each(['revision','revoked'])('refuses installation %s before dispatch with zero attempts',async mode=>{const f=await fixture();let row=await createAiTaskRun(client,scope,f.input,authority);row=await claimAiTaskRun(client,scope,bind(row));if(mode==='revision')await client.$executeRaw`UPDATE "GitHubInstallation" SET "updatedAt"="updatedAt"+interval '1 millisecond' WHERE "id"=${f.binding.connectionId}`;else await client.$executeRaw`UPDATE "GitHubInstallation" SET "revokedAt"=CURRENT_TIMESTAMP WHERE "id"=${f.binding.connectionId}`;await expect(claimAiTaskDispatch(client,scope,bind(row),authority)).rejects.toThrow();expect((await client.botAiTaskRun.findUnique({where:{id:row.id}})).attemptCount).toBe(0);expect(await client.botAiTaskArtifact.count({where:{runId:row.id}})).toBe(0)});
 it.each(['task','source'])('refuses late %s change at completion without artifact or success event',async mode=>{const f=await fixture();let row=await createAiTaskRun(client,scope,f.input,authority);row=await claimAiTaskRun(client,scope,bind(row));row=await claimAiTaskDispatch(client,scope,bind(row),authority);if(mode==='task')await updateSavedBotTask(client,scope,f.task.id,{title:f.task.title,instruction:'Changed during inference',context:f.task.context,expectedVersion:f.task.version});else await client.$executeRaw`UPDATE "TauriDeploymentRequest" SET "version"=2 WHERE "id"=${f.binding.releaseId}`;await expect(completeAiTaskRun(client,scope,bind(row),authority,{kind:'answer',message:'Mock analysis only'},{usageReceiptId:'owned-usage',organizationId:scope.organizationId,userId:scope.userId,modelId:row.modelId,correlationId:row.correlationId})).rejects.toThrow();expect(await client.botAiTaskArtifact.count({where:{runId:row.id}})).toBe(0);expect((await client.botAiTaskRun.findUnique({where:{id:row.id}})).status).toBe('dispatching');expect(await client.botAiTaskEvent.count({where:{runId:row.id}})).toBe(3)});
 it('enforces the real 22,000-byte JSONB snapshot constraint including Unicode and whitespace expansion',async()=>{
  const f=await fixture(),row=await createAiTaskRun(client,scope,f.input,authority);
  // Probe the actual table constraint in a rollback-only transaction. The extra
  // padding is deliberately not an application snapshot and is never retained.
  for(const padding of ['界😀 { , : }'.repeat(70),'界😀 { , : }'.repeat(2500)]){
   const snapshotJson={...row.snapshotJson,padding},text=JSON.stringify(snapshotJson),[size]=await client.$queryRaw`SELECT octet_length(${text}::jsonb::text) AS bytes`;
   const uuid=randomUUID(),id=aiTaskRunId(scope,uuid);
   const probe=client.$transaction(async(tx:any)=>{await tx.botAiTaskRun.create({data:{...row,id,clientRequestId:uuid,correlationId:aiTaskCorrelationId(id),snapshotJson}});throw new Error('owned_probe_rollback')});
   if(size.bytes<=22000)await expect(probe).rejects.toThrow('owned_probe_rollback');else await expect(probe).rejects.toThrow(/snapshotJson|check constraint/);
   expect(await client.botAiTaskRun.count({where:{id}})).toBe(0);
   expect(size.bytes).toBeGreaterThan(Buffer.byteLength(text));
  }
 });
});
