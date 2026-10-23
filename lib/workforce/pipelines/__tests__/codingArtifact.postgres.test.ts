import {afterAll,beforeAll,beforeEach,describe,expect,it,vi} from "vitest";
import {readFileSync,realpathSync,statSync} from "node:fs";
import {randomUUID,createHash} from "node:crypto";
import {PrismaClient} from "@prisma/client";
const f=vi.hoisted(()=>({client:undefined as unknown as PrismaClient,read:vi.fn()}));
vi.mock("@/lib/db",()=>({get prisma(){return f.client;}}));
vi.mock("../codingGithubCredential",()=>({readCodingGithubFile:f.read}));
import {mintCodingArtifactApproval} from "../mintCodingArtifactApproval";
import {persistApprovalVote,withBoundApprovalWrite} from "@/lib/workforce/persistApprovalVote";
import {loadApprovedCodingArtifact} from "../approvedCodingArtifact";
import {openPullRequest} from "../githubWriteClient";
const socket=process.env.AXIOM_OWNED_AGENT_PG_SOCKET;
const patch="--- a/file.txt\n+++ b/file.txt\n@@ -1 +1 @@\n-old\n+new\n",head="a".repeat(40);
describe.skipIf(!socket)("exact coding approval on owned PostgreSQL with inert provider",()=>{
 const org="owned_coding_"+randomUUID(),actor="owned_member_"+randomUUID();let runId:string,gateId:string;const runs:string[]=[];
 async function guards(install:boolean){
  for(const [name,table]of [["vote","EngineerApprovalDecision"],["snapshot","EngineerApprovalSnapshot"],["stage","PipelineStageRun"]])await f.client.$executeRawUnsafe(`DROP TRIGGER IF EXISTS axiom_bound_approval_${name} ON public."${table}"`);
  for(const name of ["vote","snapshot","stage"])await f.client.$executeRawUnsafe(`DROP FUNCTION IF EXISTS public.axiom_bound_approval_${name}_guard()`);
  if(install){const sql=readFileSync("ops/recovery/20261023_approval_writer_enforcement.sql","utf8").split("-- BEGIN ENFORCEMENT DEFINITIONS")[1].split("-- END ENFORCEMENT DEFINITIONS")[0];const functions=sql.match(/CREATE FUNCTION[\s\S]*?\$fn\$;/g)??[];const rest=sql.replace(/CREATE FUNCTION[\s\S]*?\$fn\$;/g,"").split(";").map(x=>x.trim()).filter(Boolean);for(const stmt of [...functions,...rest])await f.client.$executeRawUnsafe(stmt);}
 }
 beforeAll(async()=>{
  if(!socket||!/^\/(?:private\/)?tmp\/axiom-agent-chain-[^/]+\/socket$/.test(socket)||realpathSync(socket)!==socket||(statSync(socket).mode&0o077)!==0||statSync(socket).uid!==process.getuid?.())throw Error("owned_private_socket_required");
  f.client=new PrismaClient({datasources:{db:{url:`postgresql://agent_fixture@localhost/axiom_agent_fixture?host=${encodeURIComponent(socket)}`}}});
  const [binding]=await f.client.$queryRawUnsafe<Array<{private:boolean}>>(`SELECT current_database()='axiom_agent_fixture' AND current_user='agent_fixture' AND current_setting('listen_addresses')='' AS private`);if(!binding?.private)throw Error("owned_fixture_binding_required");
  await guards(true);await f.client.orgMembership.create({data:{organizationId:org,userId:actor,role:"admin",acceptedAt:new Date()}});
 });
 beforeEach(async()=>{
  vi.unstubAllGlobals();f.read.mockReset();f.read.mockResolvedValue({ok:true,content:"old\n"});await f.client.orgMembership.update({where:{userId_organizationId:{userId:actor,organizationId:org}},data:{role:"admin",acceptedAt:new Date()}});
  const run=await f.client.pipelineRun.create({data:{organizationId:org,pipelineId:"ai_coding",status:"running",triggeredBy:actor,correlationId:"owned_coding",metadata:{repoRef:"owned/repo"}}});runId=run.id;runs.push(runId);
  const stamp={schema:1,repositoryFullName:"owned/repo",baseBranch:"main",baseCommitSha:head,patchSha256:createHash("sha256").update(patch).digest("hex")};
  for(const [ordering,kind,detail]of [[0,"code_read",{owner:"owned",repo:"repo",branch:"main",headSha:head}],[1,"code_propose",{proposedPatchText:patch}],[2,"code_lint",{codingValidation:stamp}],[3,"code_test",{codingValidation:stamp}]] as const)await f.client.pipelineStageRun.create({data:{runId,stageId:kind,stageKind:kind,ordering,status:"succeeded",completedAt:new Date(),outputDetail:detail}});
  gateId=(await f.client.pipelineStageRun.create({data:{runId,stageId:"code_gate",stageKind:"approval_gate",ordering:4,status:"queued",requiresApproval:true}})).id;
 });
 afterAll(async()=>{vi.unstubAllGlobals();if(f.client){await guards(false);await f.client.engineerApprovalSnapshot.deleteMany({where:{organizationId:org}});await f.client.pipelineRun.deleteMany({where:{id:{in:runs}}});await f.client.orgMembership.deleteMany({where:{organizationId:org}});await f.client.$disconnect();}});
 function mint(){return mintCodingArtifactApproval({organizationId:org,pipelineId:"ai_coding",runId,stageRunId:gateId,stageId:"code_gate",stageName:"PR review",requestedBy:actor,correlationId:"owned_coding"});}
 async function review(){const approval=await mint();const gate=await f.client.pipelineStageRun.findUniqueOrThrow({where:{id:gateId}});const digest=(gate.outputDetail as {codingArtifactDigest:string}).codingArtifactDigest;return{...approval,digest};}
 function vote(request:string,digest:unknown,voter:string){return persistApprovalVote({approvalRequestId:request,organizationId:org,principal:{kind:"api_key",id:voter},rawDecision:"approved",reviewDigest:digest,engineSourceId:null});}
 async function approved(){const a=await review();expect(await vote(a.approvalRequestId,a.digest,"one")).toMatchObject({kind:"accepted",quorum:{isTerminal:false}});expect(await vote(a.approvalRequestId,a.digest,"two")).toMatchObject({kind:"accepted",quorum:{isTerminal:true}});await withBoundApprovalWrite(tx=>tx.pipelineStageRun.update({where:{id:gateId},data:{status:"succeeded"}}));return a;}
 const scope=()=>({organizationId:org,runId,actorUserId:actor});
 it("atomically captures bytes, obtains two bound votes, resumes and writes only the reviewed inert PR",async()=>{
  const a=await approved();expect(await loadApprovedCodingArtifact(scope())).toMatchObject({ok:true,digest:a.digest,artifact:{files:[{before:"old\n",after:"new\n"}]}});
  const writes:Array<unknown>=[];vi.stubGlobal("fetch",vi.fn(async(url:string,init:any)=>{if(init.method!=="GET"){writes.push(JSON.parse(init.body));return Response.json(url.endsWith("/pulls")?{number:12,html_url:"https://github.com/owned/repo/pull/12"}:{sha:"b".repeat(40)});}if(url.includes("/git/ref/"))return Response.json({object:{sha:head}});if(url.includes("/git/commits/"))return Response.json({tree:{sha:"c".repeat(40)}});return Response.json({truncated:false,tree:[{path:"file.txt",mode:"100644",type:"blob",sha:"d".repeat(40)}]});}));
  const result=await openPullRequest({resolveToken:async()=>{const current=await loadApprovedCodingArtifact(scope());return current.ok&&current.digest===a.digest?{ok:true,token:"synthetic_inert_token"}:{ok:false,error:"review_unavailable"};},owner:"owned",repo:"repo",baseBranch:"main",expectedBaseSha:head,newBranch:"ai/owned",files:[{path:"file.txt",content:"new\n"}],commitMessage:"owned",prTitle:"owned",prBody:"owned"});expect(result).toMatchObject({ok:true});expect(writes).toHaveLength(5);
 });
 it("refuses missing or stale review fingerprints without recording a vote",async()=>{const a=await review();for(const digest of [undefined,"b".repeat(64)])expect(await vote(a.approvalRequestId,digest,"one")).toMatchObject({kind:"reject",reason:"coding_review_required"});expect(await f.client.engineerApprovalDecision.count({where:{snapshotId:a.snapshotId}})).toBe(0);});
 it("refuses altered durable artifact bytes after approval",async()=>{await approved();const gate=await f.client.pipelineStageRun.findUniqueOrThrow({where:{id:gateId}});const data=gate.outputDetail as any;data.codingArtifact.files[0].after="unreviewed\n";await f.client.pipelineStageRun.update({where:{id:gateId},data:{outputDetail:data}});expect(await loadApprovedCodingArtifact(scope())).toMatchObject({ok:false});});
 it("stops after membership revocation without granting a replacement actor",async()=>{await approved();await f.client.orgMembership.update({where:{userId_organizationId:{userId:actor,organizationId:org}},data:{role:"read_only"}});expect(await loadApprovedCodingArtifact(scope())).toMatchObject({ok:false});});
 it("stops after cancellation",async()=>{await approved();await f.client.pipelineRun.update({where:{id:runId},data:{status:"cancelled"}});expect(await loadApprovedCodingArtifact(scope())).toMatchObject({ok:false});});
 it("rolls back the snapshot when the queued gate claim is refused",async()=>{
  await f.client.$executeRawUnsafe(`CREATE FUNCTION public.axiom_owned_coding_refuse() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN IF NEW.status='awaiting_approval' THEN RAISE EXCEPTION 'owned_claim_refused'; END IF; RETURN NEW; END $$`);await f.client.$executeRawUnsafe(`CREATE TRIGGER axiom_owned_coding_refuse BEFORE UPDATE ON "PipelineStageRun" FOR EACH ROW EXECUTE FUNCTION public.axiom_owned_coding_refuse()`);
  try{await expect(mint()).rejects.toThrow();expect(await f.client.engineerApprovalSnapshot.count({where:{organizationId:org,pipelineStageRunId:gateId}})).toBe(0);expect(await f.client.pipelineStageRun.findUniqueOrThrow({where:{id:gateId}})).toMatchObject({status:"queued",approvalRequestId:null});}finally{await f.client.$executeRawUnsafe(`DROP TRIGGER axiom_owned_coding_refuse ON "PipelineStageRun"`);await f.client.$executeRawUnsafe(`DROP FUNCTION public.axiom_owned_coding_refuse()`);}
 });
 it("refuses a changed proposal during immutable remote capture before minting",async()=>{f.read.mockImplementationOnce(async()=>{await f.client.pipelineStageRun.updateMany({where:{runId,stageKind:"code_propose"},data:{outputDetail:{proposedPatchText:patch.replace("+new","+different")}}});return{ok:true,content:"old\n"};});await expect(mint()).rejects.toThrow();expect(await f.client.engineerApprovalSnapshot.count({where:{organizationId:org,pipelineStageRunId:gateId}})).toBe(0);});
});
