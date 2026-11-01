import {beforeAll,afterAll,describe,it,expect,vi} from 'vitest';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
import {realpathSync,statSync} from 'node:fs';
import {NextRequest} from 'next/server';
const httpActors=vi.hoisted(()=>new Map<string,unknown>());
vi.mock('@/lib/desktop/resolveRequestDesktopSession',()=>({resolveRequestDesktopSession:async(r:NextRequest)=>httpActors.get(r.headers.get('x-fixture-actor')??'')??null}));
vi.mock('@/lib/api/rateLimiter',()=>({consumeToken:()=>({allowed:true})}));
import {createGovernanceExecutionPolicyHttp} from '../executionPolicyHttp';
vi.mock('../requestAuthority',()=>({createGovernanceRequestAuthority:()=>async(tx:any,s:any,role:string)=>{
 const rows=await tx.$queryRaw`SELECT "role" FROM "OrgMembership" WHERE "organizationId"=${s.organizationId} AND "userId"=${s.actorUserId}`;
 const expected=role==='policy_admin'?'admin':role==='approver'?'security_reviewer':null;
 if(rows.length!==1||expected&&rows[0].role!==expected)throw Error('fixture_paired_authority_refused');
}}));
import {createGovernanceExecutionPolicyRequestService} from '../executionPolicyRequestService';
const socket=process.env.AXIOM_EXECUTION_POLICY_PG_SOCKET;
describe.skipIf(!socket)('execution policies on owned isolated PostgreSQL',()=>{
 let db:any;
 beforeAll(async()=>{
  const generated=process.env.AXIOM_EXECUTION_POLICY_PG_CLIENT;
  if(!socket||!/^\/private\/tmp\/axiom-execution-policy-pg-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||!generated||!generated.startsWith(socket.slice(0,-7)+'/generated/'))throw Error('owned_fixture_required');
  const Client=createRequire(import.meta.url)(generated).PrismaClient;
  db=new Client({datasources:{db:{url:`postgresql://policy_fixture@localhost/policy_fixture?host=${encodeURIComponent(socket)}`}}});
  const [r]=await db.$queryRawUnsafe("SELECT current_database()='policy_fixture' AND current_user='policy_fixture' AND current_setting('listen_addresses')='' AS private");if(!r?.private)throw Error('owned_fixture_required');
 });
 afterAll(async()=>db?.$disconnect());
 async function fixture(){
  const org='policy-'+randomUUID(),selection={repositoryId:'org/repo',resourceId:'github:repository:org/repo',environment:'production' as const};
  const scopes=Object.fromEntries(['owner','reviewer','executor'].map(userId=>[userId,{organizationId:org,actorUserId:userId,sessionId:org+'-'+userId}]));
  for(const[userId,role]of [['owner','admin'],['reviewer','security_reviewer'],['executor','operator']]){
   await db.orgMembership.create({data:{organizationId:org,userId,role,acceptedAt:new Date()}});
   await db.desktopSessionRecord.create({data:{id:scopes[userId].sessionId,organizationId:org,userId,expiresAt:new Date(Date.now()+60000)}});
  }
  const service=(actor:string)=>createGovernanceExecutionPolicyRequestService(new NextRequest('https://app.test/local'),db,scopes[actor],()=>true);
  const policy=(parentDigest:string|null=null,autonomyLevel=4)=>({organizationId:org,scope:selection,parentDigest,autonomyLevel,actions:['repository.merge'],executorUserIds:['executor'],expiresAt:new Date(Date.now()+60000).toISOString()});
  const owner=service('owner'),reviewer=service('reviewer'),executor=service('executor');
  async function approved(raw=policy()){
   const r=await owner.propose(raw,randomUUID());await reviewer.approve(r.id,0,r.policy.digest,randomUUID());return r;
  }
  return{org,selection,scopes,owner,reviewer,executor,policy,approved};
 }
 it('persists actual independent review, activation, recovery and revocation with immutable history',async()=>{
  const f=await fixture(),raw=f.policy(),requestId=randomUUID(),r=await f.owner.propose(raw,requestId);
  expect((await f.owner.propose(raw,requestId)).id).toBe(r.id);
  await expect(f.owner.approve(r.id,0,r.policy.digest,randomUUID())).rejects.toThrow();
  await expect(f.owner.activate(r.id,null,null,randomUUID())).rejects.toThrow();
  await f.reviewer.approve(r.id,0,r.policy.digest,randomUUID());
  const activationId=randomUUID(),a=await f.owner.activate(r.id,null,null,activationId);
  expect(await f.owner.activate(r.id,null,null,activationId)).toEqual(a);
  expect(await f.executor.readAuthority(f.selection,'repository.merge',r.policy.digest)).toMatchObject({autonomyLevel:4,executionAuthorized:false});
  await expect(f.executor.readAuthority({...f.selection,environment:'staging'},'repository.merge')).rejects.toThrow();
  await expect(f.executor.readAuthority(f.selection,'deployment.dispatch')).rejects.toThrow();
  const original=(await db.durableAgentWorkflow.findUnique({where:{id:r.id}})).inputJson;
  await f.owner.revoke(r.id,1,randomUUID());await expect(f.executor.readAuthority(f.selection,'repository.merge')).rejects.toThrow();
  expect((await db.durableAgentWorkflow.findUnique({where:{id:r.id}})).inputJson).toEqual(original);
  expect(await db.durableAgentWorkflowEvent.count({where:{workflowRunId:r.id}})).toBe(3);
 });
 it('serializes competing activations and rejects old pointer versions and old authority digests',async()=>{
  const f=await fixture(),first=await f.approved();await f.owner.activate(first.id,null,null,randomUUID());
  const a=await f.approved(f.policy(first.policy.digest,3)),b=await f.approved(f.policy(first.policy.digest,2));
  const outcomes=await Promise.allSettled([f.owner.activate(a.id,0,first.policy.digest,randomUUID()),f.owner.activate(b.id,0,first.policy.digest,randomUUID())]);
  expect(outcomes.filter(x=>x.status==='fulfilled')).toHaveLength(1);expect(outcomes.filter(x=>x.status==='rejected')).toHaveLength(1);
  await expect(f.executor.readAuthority(f.selection,'repository.merge',first.policy.digest)).rejects.toThrow();
  expect((await f.executor.readAuthority(f.selection,'repository.merge')).pointerVersion).toBe(1);
 });
 it('refuses changed recorded roles and sessions and expired stored policy without external I/O',async()=>{
  const f=await fixture(),r=await f.approved();await f.owner.activate(r.id,null,null,randomUUID());
  await db.orgMembership.updateMany({where:{organizationId:f.org,userId:'reviewer'},data:{role:'read_only'}});
  await expect(f.executor.readAuthority(f.selection,'repository.merge')).rejects.toThrow();
  await db.orgMembership.updateMany({where:{organizationId:f.org,userId:'reviewer'},data:{role:'security_reviewer'}});
  await db.desktopSessionRecord.update({where:{id:f.scopes.reviewer.sessionId},data:{revokedAt:new Date()}});
  await expect(f.executor.readAuthority(f.selection,'repository.merge')).rejects.toThrow();
  await expect(f.owner.propose({...f.policy(),expiresAt:new Date(Date.now()-1000).toISOString()},randomUUID())).rejects.toThrow();
 });
 it('binds durable request nonces to exact inputs and operations across revisions',async()=>{
  const f=await fixture(),requestId=randomUUID(),raw=f.policy(null,5),first=await f.owner.propose(raw,requestId);
  await expect(f.owner.propose({...raw,autonomyLevel:4},requestId)).rejects.toThrow();
  const a=await f.owner.propose(f.policy(null,4),randomUUID()),b=await f.owner.propose(f.policy(null,3),randomUUID());
  const reviewNonce=randomUUID();await f.reviewer.approve(a.id,0,a.policy.digest,reviewNonce);
  await expect(f.reviewer.approve(b.id,0,b.policy.digest,reviewNonce)).rejects.toThrow();
  const activationNonce=randomUUID(),saved=await f.owner.activate(a.id,null,null,activationNonce);
  await expect(f.owner.revoke(a.id,1,activationNonce)).rejects.toThrow();
  await f.owner.revoke(a.id,1,randomUUID());
  expect(await f.owner.activate(a.id,null,null,activationNonce)).toEqual(saved);
  await expect(f.executor.readAuthority(f.selection,'repository.merge')).rejects.toThrow();
  expect((await f.owner.readRevision(first.id)).status).toBe('proposed');
 });

 it('HTTP to durable policy lifecycle preserves independent review, exact activation and revocation',async()=>{
  const f=await fixture();httpActors.clear();
  for(const name of ['owner','reviewer','executor']){const scope=f.scopes[name];httpActors.set(name,{id:scope.sessionId,userId:name,organizationId:f.org,credentialKind:'desktop_session',capabilities:name==='reviewer'?['workspace:read','agent:approve']:name==='owner'?['workspace:read','policy:manage','agent:approve']:['workspace:read']})}
  const handle=createGovernanceExecutionPolicyHttp((r,scope)=>createGovernanceExecutionPolicyRequestService(r,db,scope,()=>true),()=>true);
  const request=(name:string,body:unknown)=>handle(new NextRequest('https://fixture.test/api/desktop/governance-intelligence/execution-policy',{method:'POST',headers:{'content-type':'application/json','x-fixture-actor':name},body:JSON.stringify(body)}));
  const {organizationId:ignored,...policy}=f.policy();
  const saved=await request('owner',{operation:'propose',policy,requestId:randomUUID()});expect(saved.status).toBe(200);const proposal=(await saved.json()).data;
  const self=await request('owner',{operation:'approve',id:proposal.id,version:0,digest:proposal.policy.digest,requestId:randomUUID()});expect(self.status).toBe(409);
  expect((await request('reviewer',{operation:'approve',id:proposal.id,version:0,digest:proposal.policy.digest,requestId:randomUUID()})).status).toBe(200);
  expect((await request('owner',{operation:'activate',id:proposal.id,pointerVersion:null,parentDigest:null,requestId:randomUUID()})).status).toBe(200);
  const authority=await f.executor.readAuthority(f.selection,'repository.merge');expect(authority).toMatchObject({policyDigest:proposal.policy.digest,autonomyLevel:4,executionAuthorized:false});
  expect((await request('executor',{operation:'activate',id:proposal.id,pointerVersion:0,parentDigest:null,requestId:randomUUID()})).status).toBe(403);
  expect((await request('owner',{operation:'revoke',id:proposal.id,version:1,requestId:randomUUID()})).status).toBe(200);
  await expect(f.executor.readAuthority(f.selection,'repository.merge')).rejects.toThrow();
  const history=await request('executor',{operation:'read',id:proposal.id});expect(history.status).toBe(200);expect((await history.json()).data.status).toBe('revoked');
 });

});
