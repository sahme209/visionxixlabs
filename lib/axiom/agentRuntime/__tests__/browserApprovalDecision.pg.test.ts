import {afterAll,beforeAll,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
const f=vi.hoisted(()=>({db:null as any,identity:vi.fn(),execute:vi.fn()}));
vi.mock('@/lib/db',()=>({prisma:new Proxy({}, {get(_target,key){const value=f.db[key];return typeof value==='function'?value.bind(f.db):value}})}));
vi.mock('../agentIdentityPolicy',()=>({readWorkspaceAgentIdentity:f.identity}));
vi.mock('../actionApprovalResponder',()=>({executeApprovedAction:f.execute}));
import {decideAgentAction} from '../browserApprovalDecision';
import {agentActionDigest} from '../proposalIntegrity';
const socket=process.env.AXIOM_EXECUTION_POLICY_PG_SOCKET;
describe.skipIf(!socket)('actual review-only Agent decision transaction',()=>{
 beforeAll(async()=>{
  const generated=process.env.AXIOM_EXECUTION_POLICY_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-execution-policy-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!generated.startsWith(socket.slice(0,-7)+'/generated/'))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;f.db=new Client({datasources:{db:{url:`postgresql://policy_fixture@localhost/policy_fixture?host=${encodeURIComponent(socket)}`}}});
  const [r]=await f.db.$queryRawUnsafe("SELECT current_database()='policy_fixture' AND current_user='policy_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required');
 });
 afterAll(async()=>f.db?.$disconnect());
 async function fixture(lifetime=60000){
  f.identity.mockReset().mockResolvedValue({enabled:true,allowedTools:['open_github_pull_request']});f.execute.mockReset();
  const org='review-'+randomUUID(),user='requester',conversation=await f.db.agentConversation.create({data:{organizationId:org,userId:user}});
  for(const [userId,role]of [[user,'operator'],['reviewer','security_reviewer'],['other-reviewer','security_reviewer']])await f.db.orgMembership.create({data:{organizationId:org,userId,role,acceptedAt:new Date()}});
  const input={organizationId:org,conversationId:conversation.id,proposedByUserId:user,toolName:'open_github_pull_request',args:{repositoryFullName:'fixture/repository',head:'change',base:'main',title:'Exact fixture'}};
  const proposal=await f.db.agentActionProposal.create({data:{...input,args:undefined,argsJson:input.args,actionDigest:agentActionDigest(input),riskLevel:'medium',approvalExpiresAt:new Date(Date.now()+lifetime)}});
  const decide=(actor='reviewer')=>decideAgentAction({organizationId:org,proposalId:proposal.id,actorUserId:actor,actorRole:'admin',decision:'approve'});
  return{org,proposal,decide};
 }
 it('saves one review with no execution, then refuses another review of that record',async()=>{
  const t=await fixture();expect(await t.decide()).toEqual({ok:true,status:'approved'});
  const saved=await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}});expect(saved).toMatchObject({status:'approved',decidedByUserId:'reviewer',executedAt:null,resultJson:null});
  const audits=await f.db.secureAuditRecord.findMany({where:{organizationId:t.org,entityRef:'agent_action:'+t.proposal.id}});expect(audits).toHaveLength(1);expect(audits[0].detail).toMatchObject({decisionFormat:'agent_review_only_v1',actionDigest:t.proposal.actionDigest,requesterUserId:'requester',actorRole:'security_reviewer'});
  expect(await t.decide()).toEqual({ok:false,error:'already_decided'});expect(f.execute).not.toHaveBeenCalled();
 });
 it('permits only one winner for competing genuine review transactions',async()=>{
  const t=await fixture(),results=await Promise.all([t.decide(),t.decide('other-reviewer')]);expect(results.filter(r=>r.ok&&r.status==='approved')).toHaveLength(1);
  expect(await f.db.secureAuditRecord.count({where:{organizationId:t.org,action:'approval.grant'}})).toBe(1);expect(f.execute).not.toHaveBeenCalled();
 });
 it('refuses persisted role loss while the Agent policy read is awaited',async()=>{
  const t=await fixture();f.identity.mockImplementationOnce(async()=>{await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:'reviewer'}},data:{role:'read_only'}});return{enabled:true,allowedTools:['open_github_pull_request']}});
  expect(await t.decide()).toEqual({ok:false,error:'approval_authority_required'});expect((await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}})).status).toBe('proposed');expect(f.execute).not.toHaveBeenCalled();
 });
 it('refuses a source edit during the prior policy await without approving the replacement',async()=>{
  const t=await fixture();f.identity.mockImplementationOnce(async()=>{await f.db.agentActionProposal.update({where:{id:t.proposal.id},data:{argsJson:{repositoryFullName:'other/repository'}}});return{enabled:true,allowedTools:['open_github_pull_request']}});
  expect(await t.decide()).toEqual({ok:false,error:'already_decided'});expect(await f.db.secureAuditRecord.count({where:{organizationId:t.org}})).toBe(0);expect(f.execute).not.toHaveBeenCalled();
 });
 it('uses the database decision time when approval expires during a prior await',async()=>{
  const t=await fixture(1000);f.identity.mockImplementationOnce(async()=>{await f.db.$queryRawUnsafe('SELECT 1 FROM pg_sleep(1.1)');return{enabled:true,allowedTools:['open_github_pull_request']}});
  expect(await t.decide()).toEqual({ok:false,error:'approval_expired'});expect(f.identity).toHaveBeenCalledOnce();expect(await f.db.secureAuditRecord.count({where:{organizationId:t.org}})).toBe(0);expect(f.execute).not.toHaveBeenCalled();
 });
 it('refuses expiry reached while the proposal row is locked by another transaction',async()=>{
  const t=await fixture(1000);let unlock!:()=>void,locked!:()=>void;
  const release=new Promise<void>(r=>{unlock=r}),ready=new Promise<void>(r=>{locked=r});
  const holding=f.db.$transaction(async(tx:any)=>{await tx.$queryRaw`SELECT "id" FROM "AgentActionProposal" WHERE "id"=${t.proposal.id} FOR UPDATE`;locked();await release});
  await ready;let decision:ReturnType<typeof t.decide>|undefined;
  try{decision=t.decide();await f.db.$queryRawUnsafe('SELECT 1 FROM pg_sleep(1.1)')}
  finally{unlock();await holding}
  expect(await decision).toEqual({ok:false,error:'approval_expired'});expect(await f.db.secureAuditRecord.count({where:{organizationId:t.org}})).toBe(0);expect(f.execute).not.toHaveBeenCalled();
 });

 it('allows a current read-only proposer to stop only their own pending proposal',async()=>{
  const t=await fixture();await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:'requester'}},data:{role:'read_only'}});
  expect(await decideAgentAction({organizationId:t.org,proposalId:t.proposal.id,actorUserId:'requester',actorRole:'admin',decision:'reject'})).toEqual({ok:true,status:'rejected'});
  const saved=await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}});expect(saved).toMatchObject({status:'rejected',decidedByUserId:'requester',executedAt:null,resultJson:null});
  expect(await f.db.secureAuditRecord.count({where:{organizationId:t.org,action:'approval.deny'}})).toBe(1);expect(f.execute).not.toHaveBeenCalled();
 });
 it('refuses another read-only member stopping someone else proposal even with stale admin label',async()=>{
  const t=await fixture();await f.db.orgMembership.update({where:{organizationId_userId:{organizationId:t.org,userId:'reviewer'}},data:{role:'read_only'}});
  expect(await decideAgentAction({organizationId:t.org,proposalId:t.proposal.id,actorUserId:'reviewer',actorRole:'admin',decision:'reject'})).toEqual({ok:false,error:'approval_authority_required'});
  expect((await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}})).status).toBe('proposed');expect(await f.db.secureAuditRecord.count({where:{organizationId:t.org}})).toBe(0);
 });
 it('refuses a removed proposer without changing their now-expired proposal or history',async()=>{
  const t=await fixture(200);await f.db.orgMembership.delete({where:{organizationId_userId:{organizationId:t.org,userId:'requester'}}});await f.db.$queryRawUnsafe('SELECT 1 FROM pg_sleep(0.25)');
  const before=await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}});
  expect(await decideAgentAction({organizationId:t.org,proposalId:t.proposal.id,actorUserId:'requester',actorRole:'owner',decision:'reject'})).toEqual({ok:false,error:'approval_authority_required'});
  expect(await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}})).toEqual(before);expect(await f.db.secureAuditRecord.count({where:{organizationId:t.org}})).toBe(0);expect(f.execute).not.toHaveBeenCalled();
 });
 it('expires a naturally elapsed self-stop only after current membership validation',async()=>{
  const t=await fixture(200);await f.db.$queryRawUnsafe('SELECT 1 FROM pg_sleep(0.25)');
  expect(await decideAgentAction({organizationId:t.org,proposalId:t.proposal.id,actorUserId:'requester',actorRole:'owner',decision:'reject'})).toEqual({ok:false,error:'approval_expired'});
  expect((await f.db.agentActionProposal.findUnique({where:{id:t.proposal.id}})).status).toBe('expired');expect(await f.db.secureAuditRecord.count({where:{organizationId:t.org}})).toBe(0);expect(f.execute).not.toHaveBeenCalled();
 });

});
