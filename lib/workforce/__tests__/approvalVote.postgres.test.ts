import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { realpathSync, statSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PrismaClient } from "@prisma/client";
const f=vi.hoisted(()=>({client:undefined as unknown as PrismaClient}));
vi.mock("@/lib/db",()=>({get prisma(){return f.client;}}));
import {persistApprovalVote,hasBoundApprovalVoteIdentity} from "../persistApprovalVote";
const socket=process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
describe.skipIf(!socket)("authenticated approval votes on owned real PostgreSQL",()=>{
 const ids:string[]=[];
 beforeAll(async()=>{
  if(!socket||!/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||statSync(socket).uid!==process.getuid?.())throw new Error("owned_private_socket_required");
  f.client=new PrismaClient({datasources:{db:{url:`postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}`}}});
  const [binding]=await f.client.$queryRawUnsafe<Array<{private:boolean}>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);if(!binding?.private)throw new Error("owned_fixture_binding_required");
 });
 beforeEach(async()=>{await f.client.engineerApprovalSnapshot.deleteMany({where:{id:{in:ids}}});});
 afterAll(async()=>{if(f.client){await f.client.engineerApprovalSnapshot.deleteMany({where:{id:{in:ids}}});await f.client.$disconnect();}});
 async function create(){const approvalRequestId='owned_vote_'+randomUUID();const snap=await f.client.engineerApprovalSnapshot.create({data:{organizationId:'owned_vote_org',approvalRequestId,engineerId:'owned_no_executor',action:'fixture_only',riskLevel:'low',effectiveRule:'require_approval',requiredApprovers:2,correlationId:'owned_vote_correlation',requestedBy:'owned_requester'}});ids.push(snap.id);return snap;}
 function vote(approvalRequestId:string,id:string,organizationId='owned_vote_org'){return persistApprovalVote({approvalRequestId,organizationId,principal:{kind:'api_key',id},rawDecision:'approved',engineSourceId:null});}
 it('serializes two independent voters and atomically reaches quorum once',async()=>{
  const snap=await create();const outcomes=await Promise.all([vote(snap.approvalRequestId,'one'),vote(snap.approvalRequestId,'two')]);expect(outcomes.every(x=>x.kind==='accepted')).toBe(true);expect(outcomes.filter(x=>x.kind==='accepted'&&x.quorum.isTerminal)).toHaveLength(1);
  const saved=await f.client.engineerApprovalSnapshot.findUniqueOrThrow({where:{id:snap.id},include:{decisions:true}});expect(saved.status).toBe('approved');expect(saved.decisions).toHaveLength(2);expect(saved.decisions.every(hasBoundApprovalVoteIdentity)).toBe(true);
 });
 it('allows one durable vote for simultaneous requests from the same credential',async()=>{
  const snap=await create();const outcomes=await Promise.all([vote(snap.approvalRequestId,'one'),vote(snap.approvalRequestId,'one')]);expect(outcomes.filter(x=>x.kind==='accepted')).toHaveLength(1);expect(outcomes).toContainEqual(expect.objectContaining({kind:'reject',reason:'already_voted'}));
  expect(await f.client.engineerApprovalDecision.count({where:{snapshotId:snap.id}})).toBe(1);expect((await f.client.engineerApprovalSnapshot.findUniqueOrThrow({where:{id:snap.id}})).status).toBe('pending');
 });
 it('refuses all ambiguous legacy rows without rewriting history',async()=>{
  const snap=await create();const legacy=await f.client.engineerApprovalDecision.create({data:{snapshotId:snap.id,organizationId:snap.organizationId,approverUserId:'api_key:claimed_other_key',decision:'approved'}});
  expect(await vote(snap.approvalRequestId,'one')).toMatchObject({kind:'reject',reason:'approval_actor_provenance_required'});expect(await f.client.engineerApprovalDecision.findMany({where:{snapshotId:snap.id}})).toEqual([legacy]);
 });
 it('rolls back the new vote when the terminal snapshot update fails',async()=>{
  const snap=await create();await vote(snap.approvalRequestId,'one');
  await f.client.$executeRawUnsafe(`CREATE FUNCTION public.axiom_owned_vote_reject() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='approved' THEN RAISE EXCEPTION 'owned_fixture_terminal_refused'; END IF; RETURN NEW; END $$`);
  await f.client.$executeRawUnsafe(`CREATE TRIGGER axiom_owned_vote_reject BEFORE UPDATE ON "EngineerApprovalSnapshot" FOR EACH ROW EXECUTE FUNCTION public.axiom_owned_vote_reject()`);
  try{await expect(vote(snap.approvalRequestId,'two')).rejects.toThrow();expect(await f.client.engineerApprovalDecision.count({where:{snapshotId:snap.id}})).toBe(1);}finally{await f.client.$executeRawUnsafe('DROP TRIGGER axiom_owned_vote_reject ON "EngineerApprovalSnapshot"');await f.client.$executeRawUnsafe('DROP FUNCTION public.axiom_owned_vote_reject()');}
  expect(await vote(snap.approvalRequestId,'two')).toMatchObject({kind:'accepted',quorum:{isTerminal:true}});
 });
 it('preserves tenant and decision guards without adding votes',async()=>{
  const snap=await create();expect(await vote(snap.approvalRequestId,'one','other_tenant')).toMatchObject({kind:'reject',reason:'cross_tenant'});
  expect(await persistApprovalVote({approvalRequestId:snap.approvalRequestId,organizationId:snap.organizationId,principal:{kind:'user',id:'actual_user'},rawDecision:'invalid',engineSourceId:null})).toMatchObject({kind:'reject',reason:'invalid_decision'});
  expect(await f.client.engineerApprovalDecision.count({where:{snapshotId:snap.id}})).toBe(0);
 });
});
