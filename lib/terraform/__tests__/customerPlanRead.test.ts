import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {authorityFixture} from "./customerPlanAuthorityFixtures";
import {backendState,hash} from "./customerPlanFixtures";
import {binding as localBinding,show as localShow,sealSavedPlan} from "./savedPlanFixtures";
import type {SavedPlanRecord} from "../savedPlanArtifact";
import {parseSavedPlanBinding,bytesDigest} from "../savedPlanArtifact";
import {inspectCustomerPlanAuthority} from "../customerPlanAuthority";
import {encryptScopedCredential,decryptScopedCredential} from "@/lib/security/credentialVault";
import {customerArtifactContext,verifyCustomerPlanProducer,sealVerifiedCustomerPlan} from "../customerPlanProvenance";
import type {SavedPlanDatabase} from "../savedPlanStore";
const m=vi.hoisted(()=>({ready:vi.fn(),legacyReady:vi.fn(),trust:vi.fn(),backend:vi.fn(),github:vi.fn(),verify:vi.fn()}));
vi.mock("../customerPlanStore",async original=>({...await original<typeof import("../customerPlanStore")>(),readCustomerPlanStorageReadiness:m.ready}));
vi.mock("../savedPlanStore",async original=>({...await original<typeof import("../savedPlanStore")>(),readSavedPlanStorageReadiness:m.legacyReady}));
vi.mock("../customerPlanTrust",()=>({readConfiguredCustomerPlanTrust:m.trust}));
vi.mock("../customerPlanRuntime",()=>({readCustomerBackendForPrincipal:m.backend,customerPlanGithubRepository:{}}));
vi.mock("../customerPlanGithubRead",()=>({readCustomerPlanGithubEvidence:m.github}));
// Unit composition only; the genuine Terraform signed-tuple gate remains open.
vi.mock("@/lib/releaseops/ecsReleaseV2/sigstoreBuildVerifier",()=>({verifyBuildProvenance:m.verify}));
import {readTerraformPlans} from "../customerPlanRead";
async function fixture(){
 const f=authorityFixture(),context=inspectCustomerPlanAuthority(f.profile,f.rows,f.principal,"read",f.now)!;
 const trust={publicProfile:{kind:"synthetic-unit-composition"},digest:hash("trust"),terraformVersion:"1.9.8",executableDigest:hash("cli"),reviewExpiresAt:"2026-10-18T12:30:00Z",downloadPolicy:[]};m.trust.mockReturnValue(trust);
 const binary=Buffer.from("SYNTHETIC-NOT-GENUINE-TERRAFORM"),show=Buffer.from(JSON.stringify({format_version:"1.2",terraform_version:"1.9.8",resource_changes:[{address:"terraform_data.owned",provider_name:"terraform.io/builtin/terraform",change:{actions:["create"],after:{private:"DO-NOT-LEAK"}}}]}));
 const receipt=Buffer.from(JSON.stringify({schema:"axiom.terraform.plan-receipt.v2",profileDigest:hash(f.profile),requestContentHash:context.requestContentHash,targetDigest:context.targetDigest,producer:{repositoryId:f.profile.repository.remoteId,repositoryFullName:f.profile.repository.fullName,sourceRef:f.profile.repository.sourceRef,sourceSha:f.profile.repository.sourceSha,workflowPath:f.profile.producer.workflowPath,workflowSha:f.profile.producer.workflowSha,runId:"888",runAttempt:1,roleArn:f.profile.producer.planRoleArn},backendIdentityDigest:hash(f.profile.backend),workspace:"default",stateBefore:backendState(),stateAfter:backendState(),lock:"released",configurationDigest:f.profile.configuration.treeDigest,providerLockDigest:f.profile.configuration.providerLockDigest,terraformVersion:"1.9.8",executableDigest:hash("cli"),binary:{digest:bytesDigest(binary),bytes:binary.length},show:{digest:bytesDigest(show),bytes:show.length},createdAt:f.now.toISOString(),expiresAt:"2026-10-18T12:15:00.000Z"}));
 const proof=await verifyCustomerPlanProducer({profile:f.profile,requestContentHash:context.requestContentHash,targetDigest:context.targetDigest,run:{id:"888",attempt:1},binary,show,receipt,bundle:Buffer.from("SYNTHETIC-NOT-GENUINE-PROVENANCE"),trust,now:f.now,authorize:async()=>true});if(proof.kind!=="verified_customer_plan")throw Error("owned synthetic fixture did not verify");
 const historicalVersion=structuredClone(f.rows.version),sealed=sealVerifiedCustomerPlan(proof),state={currentStatus:"active",many:false,legacy:null as SavedPlanRecord|null};m.verify.mockClear();
 const db={$queryRawUnsafe:vi.fn(async(sql:string,...values:unknown[])=>{
  expect(values).toContain(f.principal.organizationId);
  if(sql.includes('FROM public."TerraformSavedPlanArtifact"'))return state.legacy?[structuredClone(state.legacy)]:state.many?Array.from({length:21},()=>structuredClone(sealed.artifact)):[structuredClone(sealed.artifact)];
  if(sql.includes('FROM public."TerraformCustomerPlanProvenance"'))return [structuredClone(sealed.provenance)];
  if(sql.includes('FROM public."TerraformCustomerPlanCurrent"'))return [{id:f.profile.id,revision:f.profile.revision,status:state.currentStatus,profileJson:f.profile,profileDigest:hash(f.profile)}];
  const table=/FROM public\."([^"]+)"/.exec(sql)?.[1],names={DesktopSessionRecord:"device",OrgMembership:"membership",TauriDeploymentRequest:"request",TauriDeploymentRequestVersion:"version",Environment:"environment",Repository:"repository",GitHubInstallation:"installation",CloudAccount:"account",CloudAccountCredential:"credential"} as const;
  if(table==="TauriDeploymentRequestVersion"&&values[2]!==f.rows.version.version)return [structuredClone(historicalVersion)];
  const name=names[table as keyof typeof names];if(!name)throw Error("unexpected owned query");return [structuredClone(f.rows[name])];
 })};
 m.backend.mockResolvedValue({kind:"observed_customer_backend",state:backendState(),lock:"unlocked_at_observation",observedAt:f.now.toISOString()});m.github.mockResolvedValue({kind:"read_customer_plan_source",bundles:[Buffer.from("SYNTHETIC-NOT-GENUINE-PROVENANCE")]});
 return {...f,...sealed,state,db,typedDb:db as unknown as SavedPlanDatabase};
}
beforeEach(()=>{vi.clearAllMocks();vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY","synthetic-owned-customer-read-key-at-least32");m.ready.mockResolvedValue("ready");m.legacyReady.mockResolvedValue("ready");m.verify.mockImplementation(async({binding}:{binding:object})=>({kind:"verified_build_provenance",...binding}));});
afterEach(()=>vi.unstubAllEnvs());
it("lists bounded customer metadata without crypto/decryption/provider observation or claiming verification",async()=>{
 const f=await fixture(),result=await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,undefined,f.now);
 expect(result).toMatchObject({status:200,body:{ok:true,data:{plans:[{evidenceScope:"customer_ci_attested",inspection:"metadata_only",currentTarget:"not_observed",approval:"unavailable",executionEnabled:false}],executionEnabled:false}}});expect(m.verify).not.toHaveBeenCalled();expect(m.backend).not.toHaveBeenCalled();expect(m.github).not.toHaveBeenCalled();
 expect(f.db.$queryRawUnsafe.mock.calls.find(([sql])=>sql.includes('FROM public."TerraformSavedPlanArtifact"'))?.[0]).not.toContain('"encryptedBinary"');expect(JSON.stringify(result)).not.toContain("DO-NOT-LEAK");
});
it("checks encrypted bytes and official-verifier composition, then independently observes a current backend with no approval or held-lock claim",async()=>{
 const f=await fixture(),result=await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,f.now);
 expect(result).toMatchObject({status:200,body:{ok:true,data:{plans:[{inspection:"producer_bytes_verified",currentTarget:"observed_match",historical:false,approval:"unavailable",executionEnabled:false,summary:{counts:{create:1}}}]}}});expect(m.verify).toHaveBeenCalledOnce();expect(m.backend).toHaveBeenCalledOnce();expect(m.github).toHaveBeenCalledOnce();expect(JSON.stringify(result)).not.toContain("DO-NOT-LEAK");
});
it.each(["requestChanged","profileRevoked","credentialRevoked","expired"])("keeps valid historical producer bytes separate from unavailable current target on %s",async mode=>{
 const f=await fixture();if(mode==="requestChanged"){f.rows.request.version=2;f.rows.version.version=2;}if(mode==="profileRevoked")f.state.currentStatus="revoked";if(mode==="credentialRevoked")f.rows.credential.revokedAt=f.now;if(mode==="expired")f.now.setTime(Date.parse("2026-10-18T12:16:00Z"));
 const result=await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,f.now);expect(result).toMatchObject({status:200,body:{ok:true,data:{plans:[{inspection:"producer_bytes_verified",currentTarget:"unavailable",approval:"unavailable",executionEnabled:false}]}}});expect(m.backend).not.toHaveBeenCalled();
 if(mode==="expired")expect(result).toMatchObject({body:{data:{plans:[{validity:"expired"}]}}});
});
it.each(["binaryEnvelope","proofEnvelope","binding","signature"])("fails closed on tampered %s without returning raw plan/summary or provider IO",async mode=>{
 const f=await fixture();if(mode==="binaryEnvelope")f.artifact.encryptedBinary+="x";if(mode==="proofEnvelope")f.provenance.encryptedProof+="x";if(mode==="binding")f.artifact.bindingDigest=hash("wrong");if(mode==="signature")m.verify.mockResolvedValue({kind:"unavailable"});
 const result=await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,f.now);expect(result.status).not.toBe(200);expect(JSON.stringify(result)).not.toContain("summary");expect(m.backend).not.toHaveBeenCalled();
});
it("fails closed before optional rows/providers when v2 storage is absent",async()=>{
 const f=await fixture();m.ready.mockResolvedValue("not_installed");const result=await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,f.now);expect(result.status).toBe(503);expect(f.db.$queryRawUnsafe.mock.calls.every(([sql])=>!sql.includes('FROM public."TerraformCustomerPlan'))).toBe(true);expect(m.backend).not.toHaveBeenCalled();
});
it("refuses final current actor revocation after a provider observation",async()=>{
 const f=await fixture();m.backend.mockImplementation(async()=>{f.rows.device.revokedAt=f.now;return {kind:"observed_customer_backend",state:backendState(),lock:"unlocked_at_observation",observedAt:f.now.toISOString()};});
 expect((await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,f.now)).status).toBe(403);
});
it("does not display verified detail when its immutable request content hash no longer matches canonical version evidence",async()=>{
 const f=await fixture();f.rows.version.contentHash=hash("changed-canonical-request");expect((await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,f.now)).status).toBe(409);expect(m.backend).not.toHaveBeenCalled();
});
it("does not turn a caller-relabelled expired timestamp into historical verification",async()=>{
 const f=await fixture(),plaintext={binary:decryptScopedCredential(f.artifact.encryptedBinary,customerArtifactContext(f.artifact,"binary")),show:decryptScopedCredential(f.artifact.encryptedShow,customerArtifactContext(f.artifact,"show")),proof:decryptScopedCredential(f.provenance.encryptedProof,customerArtifactContext(f.artifact,"proof"))};const binding=f.artifact.bindingJson;binding.createdAt="2026-10-18T11:00:00.000Z";binding.expiresAt="2026-10-18T11:15:00.000Z";f.artifact.createdAt=new Date(binding.createdAt);f.artifact.expiresAt=new Date(binding.expiresAt);f.artifact.bindingDigest=hash(binding);f.provenance.bindingDigest=f.artifact.bindingDigest;f.provenance.createdAt=f.artifact.createdAt;f.artifact.encryptedBinary=encryptScopedCredential(plaintext.binary,customerArtifactContext(f.artifact,"binary"));f.artifact.encryptedShow=encryptScopedCredential(plaintext.show,customerArtifactContext(f.artifact,"show"));f.provenance.encryptedProof=encryptScopedCredential(plaintext.proof,customerArtifactContext(f.artifact,"proof"));
 expect((await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,f.now)).status).toBe(409);expect(m.backend).not.toHaveBeenCalled();
});

it("retains fixture-v1 list/detail semantics without requiring any customer-v2 optional schema or producer",async()=>{
 const f=await fixture(),binding=parseSavedPlanBinding({...localBinding(),organizationId:f.principal.organizationId,deploymentRequestId:f.profile.deploymentRequestId,environmentId:f.profile.environmentId,createdAt:"2026-10-18T11:30:00.000Z",expiresAt:"2026-10-18T12:30:00.000Z"});f.state.legacy=sealSavedPlan("owned-local-fixture",binding,Buffer.from("SYNTHETIC-LOCAL-NOT-TERRAFORM"),JSON.stringify(localShow()));m.ready.mockResolvedValue("not_installed");
 expect(await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,undefined,f.now)).toMatchObject({status:200,body:{data:{producer:"unavailable",plans:[{evidenceScope:"owned_local_fixture",inspection:"metadata_only",approval:"unavailable",currentTarget:"unavailable"}]}}});
 expect(await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.state.legacy.id,f.now)).toMatchObject({status:200,body:{data:{plans:[{evidenceScope:"owned_local_fixture",inspection:"artifact_bytes_checked",summary:{counts:{create:1}}}]}}});expect(m.ready).not.toHaveBeenCalled();expect(m.verify).not.toHaveBeenCalled();expect(m.backend).not.toHaveBeenCalled();expect(f.db.$queryRawUnsafe.mock.calls.every(([sql])=>!sql.includes('public."TauriDeploymentRequestVersion"'))).toBe(true);
});
it("updates validity when the signed evidence expires during backend observation and never returns a current match",async()=>{
 const f=await fixture();m.backend.mockImplementation(async()=>{f.now.setTime(Date.parse("2026-10-18T12:16:00Z"));return {kind:"observed_customer_backend",state:backendState(),lock:"unlocked_at_observation",observedAt:f.now.toISOString()};});
 expect(await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,()=>new Date(f.now))).toMatchObject({status:200,body:{data:{plans:[{validity:"expired",historical:true,currentTarget:"unavailable"}]}}});expect(m.github).not.toHaveBeenCalled();
});
it("withholds verified detail when the currently reviewed trust is revoked during observation",async()=>{
 const f=await fixture(),trust=m.trust();let revoked=false;m.trust.mockImplementation(()=>revoked?null:trust);m.backend.mockImplementation(async()=>{revoked=true;return {kind:"observed_customer_backend",state:backendState(),lock:"unlocked_at_observation",observedAt:f.now.toISOString()};});
 expect((await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,f.now)).status).toBe(409);expect(m.github).not.toHaveBeenCalled();
});
it("denies a foreign parent before either optional storage probe or artifact/provider access",async()=>{
 const f=await fixture();f.rows.request.organizationId="foreign";expect((await readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,undefined,f.now)).status).toBe(404);expect(m.ready).not.toHaveBeenCalled();expect(m.legacyReady).not.toHaveBeenCalled();expect(m.backend).not.toHaveBeenCalled();
});

/** Discover the final canonical actor read from a successful real-reader pass,
 * then defer that same DB boundary. No production timing hook is introduced. */
async function finalActorBarrier(){
 const f=await fixture(),clock=()=>new Date(f.now),requestId=f.profile.deploymentRequestId;
 expect(await readTerraformPlans(f.typedDb,f.principal,requestId,f.artifact.id,clock)).toMatchObject({status:200,body:{data:{plans:[{currentTarget:"observed_match",validity:"unexpired"}]}}});
 const memberSql='FROM public."OrgMembership"',lastActor=f.db.$queryRawUnsafe.mock.calls.filter(([sql])=>sql.includes(memberSql)).length,query=f.db.$queryRawUnsafe.getMockImplementation()!;
 f.db.$queryRawUnsafe.mockClear();let actorReads=0,release!:()=>void,entered!:()=>void;
 const held=new Promise<void>(resolve=>{release=resolve;}),waiting=new Promise<void>(resolve=>{entered=resolve;});
 f.db.$queryRawUnsafe.mockImplementation(async(sql:string,...values:unknown[])=>{const rows=await query(sql,...values);if(sql.includes(memberSql)&&++actorReads===lastActor){entered();await held;}return rows;});
 return {f,clock,waiting,release};
}
it("expires observed evidence after the deferred final actor read without returning its old match or observation time",async()=>{
 const {f,clock,waiting,release}=await finalActorBarrier(),pending=readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,clock);await waiting;
 f.now.setTime(Date.parse("2026-10-18T12:16:00Z"));release();const result=await pending;
 expect(result).toMatchObject({status:200,body:{data:{plans:[{validity:"expired",historical:true,currentTarget:"unavailable"}]}}});expect(JSON.stringify(result)).not.toContain("observedAt");
});
it("fails closed when the absolute reader deadline expires during the deferred final actor read",async()=>{
 const {f,clock,waiting,release}=await finalActorBarrier();vi.useFakeTimers();
 try{const pending=readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,clock);await waiting;await vi.advanceTimersByTimeAsync(30_001);release();const result=await pending;expect(result.status).toBe(409);expect(JSON.stringify(result)).not.toContain("summary");}
 finally{release();vi.useRealTimers();}
});
it("withholds verified detail when trust is revoked during the deferred final actor read",async()=>{
 const {f,clock,waiting,release}=await finalActorBarrier(),pending=readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,clock);await waiting;
 m.trust.mockReturnValue(null);release();const result=await pending;expect(result.status).toBe(409);expect(JSON.stringify(result)).not.toContain("summary");
});
it("fails closed when its parent is cancelled during the deferred final actor read",async()=>{
 const {f,clock,waiting,release}=await finalActorBarrier(),parent=new AbortController(),pending=readTerraformPlans(f.typedDb,f.principal,f.profile.deploymentRequestId,f.artifact.id,clock,parent.signal);await waiting;
 parent.abort();release();const result=await pending;expect(result.status).toBe(409);expect(JSON.stringify(result)).not.toContain("summary");
});
