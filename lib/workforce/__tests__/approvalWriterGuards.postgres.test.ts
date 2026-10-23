import {afterAll,afterEach,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {readFileSync,realpathSync,statSync} from "node:fs";
import {randomUUID} from "node:crypto";
import {PrismaClient} from "@prisma/client";
const f=vi.hoisted(()=>({client:undefined as unknown as PrismaClient}));vi.mock("@/lib/db",()=>({get prisma(){return f.client;}}));
import {persistApprovalVote,withBoundApprovalWrite} from "../persistApprovalVote";
const socket=process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
describe.skipIf(!socket)('retired approval writers refused by actual PostgreSQL guards',()=>{
 const snapshots:string[]=[],runs:string[]=[];let snapshotId:string,approvalRequestId:string;
 const names=['vote','snapshot','stage'];
 async function removeGuards(){for(const [name,table] of [['vote','EngineerApprovalDecision'],['snapshot','EngineerApprovalSnapshot'],['stage','PipelineStageRun']])await f.client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS axiom_bound_approval_${name} ON public."${table}"`);for(const name of names)await f.client.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public.axiom_bound_approval_${name}_guard()`);}
 async function installGuards(){
  const sql=readFileSync('ops/recovery/20261023_approval_writer_enforcement.sql','utf8').split('-- BEGIN ENFORCEMENT DEFINITIONS')[1].split('-- END ENFORCEMENT DEFINITIONS')[0];
  const functions=sql.match(/CREATE FUNCTION[\s\S]*?\$fn\$;/g)??[];const rest=sql.replace(/CREATE FUNCTION[\s\S]*?\$fn\$;/g,'').split(';').map(x=>x.trim()).filter(Boolean);expect(functions).toHaveLength(3);expect(rest).toHaveLength(6);
  for(const statement of [...functions,...rest])await f.client.$executeRawUnsafe(statement);
 }
 beforeAll(async()=>{
  if(!socket||!/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||statSync(socket).uid!==process.getuid?.())throw new Error('owned_private_socket_required');
  f.client=new PrismaClient({datasources:{db:{url:`postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}`}}});const [binding]=await f.client.$queryRawUnsafe<Array<{private:boolean}>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);if(!binding?.private)throw new Error('owned_fixture_binding_required');
 });
 beforeEach(async()=>{await removeGuards();approvalRequestId='owned_guard_'+randomUUID();const snap=await f.client.engineerApprovalSnapshot.create({data:{organizationId:'owned_guard_org',approvalRequestId,engineerId:'no_executor',action:'fixture_only',riskLevel:'low',effectiveRule:'two_step_approval',requiredApprovers:2,correlationId:'owned_guard_correlation',requestedBy:'owned_requester'}});snapshotId=snap.id;snapshots.push(snap.id);await installGuards();});
 afterEach(async()=>{await removeGuards();});
 afterAll(async()=>{if(f.client){await removeGuards();await f.client.engineerApprovalSnapshot.deleteMany({where:{id:{in:snapshots}}});await f.client.pipelineRun.deleteMany({where:{id:{in:runs}}});await f.client.$disconnect();}});
 function vote(id:string){return persistApprovalVote({approvalRequestId,organizationId:'owned_guard_org',principal:{kind:'api_key',id},rawDecision:'approved',engineSourceId:null});}
 it('refuses the exact legacy/default-ID insert, including a canonical-looking actor label',async()=>{
  await expect(f.client.engineerApprovalDecision.create({data:{snapshotId,organizationId:'owned_guard_org',approverUserId:'api_key:claimed_other',decision:'approved'}})).rejects.toThrow('approval_writer_upgrade_required');expect(await f.client.engineerApprovalDecision.count({where:{snapshotId}})).toBe(0);
 });
 it('does not accept a new-format ID without the transaction-local reviewed writer',async()=>{
  await expect(f.client.engineerApprovalDecision.create({data:{id:'boundvote_v1_'+randomUUID(),snapshotId,organizationId:'owned_guard_org',approverUserId:'api_key:claimed_other',decision:'approved'}})).rejects.toThrow('approval_writer_upgrade_required');
 });
 it('permits authenticated helper voting and resets the marker after commit',async()=>{
  expect(await vote('one')).toMatchObject({kind:'accepted',quorum:{isTerminal:false}});expect(await vote('two')).toMatchObject({kind:'accepted',quorum:{isTerminal:true}});
  const [state]=await f.client.$queryRawUnsafe<Array<{marker:string|null}>>(`SELECT current_setting('axiom.approval_actor_binding',true) AS marker`);expect(state.marker).not.toBe('v1');
 });
 it('refuses old terminal and execution claims but permits the reviewed claim',async()=>{
  await expect(f.client.engineerApprovalSnapshot.update({where:{id:snapshotId},data:{status:'approved'}})).rejects.toThrow('approval_writer_upgrade_required');await vote('one');await vote('two');
  await expect(f.client.engineerApprovalSnapshot.updateMany({where:{id:snapshotId,executionStatus:'not_started'},data:{executionStatus:'running'}})).rejects.toThrow('approval_writer_upgrade_required');
  expect(await withBoundApprovalWrite(tx=>tx.engineerApprovalSnapshot.updateMany({where:{id:snapshotId,status:'approved',executionStatus:'not_started'},data:{executionStatus:'running'}}))).toMatchObject({count:1});
 });
 it('refuses a legacy stage continuation even after a legitimate new quorum',async()=>{
  const run=await f.client.pipelineRun.create({data:{organizationId:'owned_guard_org',pipelineId:'owned_no_actions',triggeredBy:'owned_user',correlationId:'owned_guard_correlation'}});runs.push(run.id);
  const stage=await f.client.pipelineStageRun.create({data:{runId:run.id,stageId:'owned_gate',stageKind:'approval',ordering:0,status:'awaiting_approval',approvalRequestId}});
  await f.client.engineerApprovalSnapshot.update({where:{id:snapshotId},data:{sourceKind:'pipeline_stage',pipelineStageRunId:stage.id}});await vote('one');await vote('two');
  await expect(f.client.pipelineStageRun.updateMany({where:{id:stage.id,status:'awaiting_approval'},data:{status:'succeeded'}})).rejects.toThrow('approval_writer_upgrade_required');
  expect(await withBoundApprovalWrite(tx=>tx.pipelineStageRun.updateMany({where:{id:stage.id,status:'awaiting_approval'},data:{status:'succeeded'}}))).toMatchObject({count:1});
 });
 it('rejects an invalid quorum even when a reviewed writer requests a terminal transition',async()=>{
  await expect(withBoundApprovalWrite(tx=>tx.engineerApprovalSnapshot.update({where:{id:snapshotId},data:{status:'approved'}}))).rejects.toThrow('approval_actor_provenance_required');expect((await f.client.engineerApprovalSnapshot.findUniqueOrThrow({where:{id:snapshotId}})).status).toBe('pending');
 });
 it('preserves reviewed zero-approver rules while refusing the old execution writer',async()=>{
  await f.client.engineerApprovalSnapshot.update({where:{id:snapshotId},data:{requiredApprovers:0}});
  await withBoundApprovalWrite(tx=>tx.engineerApprovalSnapshot.update({where:{id:snapshotId},data:{status:'approved'}}));
  await expect(f.client.engineerApprovalSnapshot.updateMany({where:{id:snapshotId},data:{executionStatus:'running'}})).rejects.toThrow('approval_writer_upgrade_required');
  expect(await withBoundApprovalWrite(tx=>tx.engineerApprovalSnapshot.updateMany({where:{id:snapshotId,executionStatus:'not_started'},data:{executionStatus:'running'}}))).toMatchObject({count:1});
 });
 it('does not let a zero-approver rule launder an existing legacy vote',async()=>{
  await removeGuards();await f.client.engineerApprovalSnapshot.update({where:{id:snapshotId},data:{requiredApprovers:0}});
  await f.client.engineerApprovalDecision.create({data:{snapshotId,organizationId:'owned_guard_org',approverUserId:'legacy_actor',decision:'approved'}});await installGuards();
  await expect(withBoundApprovalWrite(tx=>tx.engineerApprovalSnapshot.update({where:{id:snapshotId},data:{status:'approved'}}))).rejects.toThrow('approval_actor_provenance_required');
 });

});
