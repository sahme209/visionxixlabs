import {afterEach,beforeEach,expect,it,vi} from "vitest";
import {authorityFixture} from "./customerPlanAuthorityFixtures";
import {parseCustomerPlanProfile} from "../customerPlanContract";
import type {SavedPlanDatabase} from "../savedPlanStore";
const m=vi.hoisted(()=>({ready:vi.fn(),legacyReady:vi.fn(),trust:vi.fn(),backend:vi.fn(),github:vi.fn(),verify:vi.fn(),binding:vi.fn()}));
vi.mock("../customerPlanStore",async original=>({...await original<typeof import("../customerPlanStore")>(),readCustomerPlanStorageReadiness:m.ready}));
vi.mock("../savedPlanStore",async original=>({...await original<typeof import("../savedPlanStore")>(),readSavedPlanStorageReadiness:m.legacyReady}));
vi.mock("../customerPlanTrust",()=>({readConfiguredCustomerPlanTrust:m.trust}));
// Synthetic service composition only; never a positive runtime/HTTP signature fixture.
vi.mock("../customerPlanRuntime",()=>({readCustomerBackendForPrincipal:m.backend,readCustomerPlanConnectionBinding:m.binding,customerPlanGithubRepository:{}}));
vi.mock("../customerPlanGithubRead",()=>({readCustomerPlanGithubEvidence:m.github}));
vi.mock("@/lib/releaseops/ecsReleaseV2/sigstoreBuildVerifier",()=>({verifyBuildProvenance:m.verify}));
import {inspectCustomerPlanAuthority} from "../customerPlanAuthority";
import {backendState,hash} from "./customerPlanFixtures";
import {bytesDigest} from "../savedPlanArtifact";
import {importCustomerSavedPlan,configureCustomerPlanProfile,revokeCustomerPlanProfile,readCustomerPlanProfile,type CustomerPlanServiceDatabase} from "../customerPlanService";
function fixture(){
 const f=authorityFixture(),writes:Array<{sql:string;values:unknown[]}>=[];
 const state={current:null as null|{profile:ReturnType<typeof parseCustomerPlanProfile>;status:"active"|"revoked"},beforeTransaction:()=>{},onWrite:()=>{},existingArtifact:null as null|Record<string,unknown>,existingProof:null as null|Record<string,unknown>,failProof:false,pointerFails:false,serializationFailure:false};
 const db={$queryRawUnsafe:vi.fn(async(sql:string,...values:unknown[])=>{
  expect(values).toContain(f.principal.organizationId);
  if(sql.startsWith('INSERT INTO public."TerraformSavedPlanArtifact"')){writes.push({sql,values});state.onWrite();return [{id:values[0]}];}
  if(sql.startsWith('INSERT INTO public."TerraformCustomerPlanProvenance"')){if(state.failProof)throw Error("synthetic linked insert failed");writes.push({sql,values});state.onWrite();return [{artifactId:values[0]}];}
  if(sql.includes('FROM public."TerraformSavedPlanArtifact"'))return state.existingArtifact?[state.existingArtifact]:[];
  if(sql.includes('FROM public."TerraformCustomerPlanProvenance"'))return state.existingProof?[state.existingProof]:[];
  if(sql.startsWith('INSERT INTO public."TerraformCustomerPlanProfile"')){writes.push({sql,values});state.onWrite();return [{id:values[0],revision:values[1]}];}
  if(sql.startsWith('INSERT INTO public."TerraformCustomerPlanCurrent"')||sql.startsWith('UPDATE public."TerraformCustomerPlanCurrent"')){writes.push({sql,values});state.onWrite();return state.pointerFails?[]:[{id:values[0],revision:values[1]}];}
  if(sql.includes('FROM public."TerraformCustomerPlanCurrent"'))return state.current?[{id:state.current.profile.id,revision:state.current.profile.revision,status:state.current.status,profileJson:structuredClone(state.current.profile),profileDigest:requireHash(state.current.profile)}]:[];
  const table=/FROM public\."([^"]+)"/.exec(sql)?.[1],names={DesktopSessionRecord:"device",OrgMembership:"membership",TauriDeploymentRequest:"request",TauriDeploymentRequestVersion:"version",Environment:"environment",Repository:"repository",GitHubInstallation:"installation",CloudAccount:"account",CloudAccountCredential:"credential",AxiomApprovalPolicy:"policy"} as const;
  const name=names[table as keyof typeof names];if(!name)throw Error("unexpected owned query");const row=f.rows[name];return row?[structuredClone(row)]:[];
 }),$transaction:vi.fn(async<T>(work:(db:SavedPlanDatabase)=>Promise<T>,options:unknown)=>{expect(options).toMatchObject({isolationLevel:"Serializable"});state.beforeTransaction();const before=writes.length;try{const result=await work(db as unknown as SavedPlanDatabase);if(state.serializationFailure)throw {code:"P2034"};return result;}catch(error){writes.splice(before);throw error;}})};
 const profileInput=()=>({environmentId:f.profile.environmentId,repository:structuredClone(f.profile.repository),producer:structuredClone(f.profile.producer),configuration:structuredClone(f.profile.configuration),backend:{region:f.profile.backend.region,bucket:f.profile.backend.bucket,key:f.profile.backend.key,lockTable:f.profile.backend.lockTable},artifacts:structuredClone(f.profile.artifacts),connection:{id:f.profile.connection.id}});
 const deps={db:db as unknown as CustomerPlanServiceDatabase,now:()=>new Date(f.now)};
 return {...f,state,db,writes,deps,profileInput};
}
import {sha256ContentHash as requireHash} from "@/lib/tauri/contentHash";
beforeEach(()=>{m.ready.mockReset().mockResolvedValue("ready");m.legacyReady.mockReset().mockResolvedValue("ready");m.trust.mockReset().mockReturnValue({publicProfile:{kind:"synthetic-unit-composition-only"},digest:hash("trust"),terraformVersion:"1.9.8",executableDigest:hash("cli"),reviewExpiresAt:"2026-10-18T12:20:00Z",downloadPolicy:[]});m.backend.mockReset();m.github.mockReset();m.binding.mockReset().mockResolvedValue(true);m.verify.mockReset().mockImplementation(async({binding}:{binding:object})=>({kind:"verified_build_provenance",...binding}));vi.stubEnv("CREDENTIAL_ENCRYPTION_KEY","synthetic-owned-customer-profile-service-key32");});
it("creates immutable current-profile revision with server-derived scope/credential facts and no approval or execution authority",async()=>{
 const f=fixture(),result=await configureCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:1,expectedRevision:0,profileInput:f.profileInput()});
 expect(result).toMatchObject({kind:"customer_plan_profile",status:"active",currentTarget:"not_observed",executionAllowed:false,approval:"unavailable",profile:{organizationId:f.principal.organizationId,requestVersion:1,revision:1,connection:{id:f.profile.connection.id,version:3},backend:{accountId:"123456789012",lockKey:"customer-state/infra/terraform.tfstate",workspace:"default"}}});
 expect(f.writes).toHaveLength(2);expect(f.db.$transaction).toHaveBeenCalledOnce();
 for(const {sql,values} of f.writes){const indexes=new Set([...sql.matchAll(/\$(\d+)/g)].map(match=>Number(match[1])));expect([...indexes].sort((a,b)=>a-b)).toEqual(Array.from({length:values.length},(_,i)=>i+1));}
 const inserted=f.writes[0];expect(inserted.values[2]).toBe(f.principal.organizationId);expect(inserted.values[9]).toBe(f.principal.userId);
});
it("revises through expectedRevision CAS while preserving profile id and immutable environment",async()=>{
 const f=fixture();f.state.current={profile:parseCustomerPlanProfile(f.profile),status:"active"};
 expect(await configureCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:1,expectedRevision:1,profileInput:f.profileInput()})).toMatchObject({kind:"customer_plan_profile",profile:{id:f.profile.id,revision:2}});
 expect(f.writes[1].sql).toContain('"revision"=$7');expect(f.writes[1].values[6]).toBe(1);
});
it("rejects environment retarget on an existing request with new-request guidance rather than broadening the schema",async()=>{
 const f=fixture();f.state.current={profile:parseCustomerPlanProfile(f.profile),status:"active"};const input=f.profileInput();input.environmentId="different-environment";
 expect(await configureCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:1,expectedRevision:1,profileInput:input})).toMatchObject({kind:"conflict",reason:"customer_plan_environment_immutable_new_request"});expect(f.writes).toHaveLength(0);
});
it.each(["organizationId","revision","targetDigest","binary","url"])("rejects untrusted %s fields rather than adopting request authority",async key=>{
 const f=fixture();expect(await configureCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:1,expectedRevision:0,profileInput:{...f.profileInput(),[key]:"untrusted"}})).toMatchObject({kind:"invalid"});expect(f.writes).toHaveLength(0);
});
it.each(["not_installed","drift","unavailable"])("fails closed on %s optional storage without optional-table access or writes",async status=>{
 const f=fixture();m.ready.mockResolvedValue(status);expect(await readCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId)).toMatchObject({kind:"unavailable",reason:"customer_plan_storage_unavailable"});
 expect(f.db.$queryRawUnsafe.mock.calls.every(([sql])=>!sql.includes('public."TerraformCustomerPlan'))).toBe(true);expect(f.writes).toHaveLength(0);
});
it("returns foreign requests as not found before optional storage inspection",async()=>{
 const f=fixture();f.rows.request.organizationId="foreign";expect(await readCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId)).toMatchObject({kind:"not_found"});expect(m.ready).not.toHaveBeenCalled();expect(f.writes).toHaveLength(0);
});
it.each(["demoted","revoked","expired","unaccepted","credentialRevoked","requestChanged","profileChanged"])("rejects final %s race before any profile/current write",async mode=>{
 const f=fixture();f.state.beforeTransaction=()=>{if(mode==="demoted")f.rows.membership.role="operator";if(mode==="revoked")f.rows.device.revokedAt=f.now;if(mode==="expired")f.rows.device.expiresAt=f.now;if(mode==="unaccepted")f.rows.membership.acceptedAt=null;if(mode==="credentialRevoked")f.rows.credential.revokedAt=f.now;if(mode==="requestChanged")f.rows.request.version=2;if(mode==="profileChanged")f.state.current={profile:parseCustomerPlanProfile(f.profile),status:"active"};};
 const result=await configureCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:1,expectedRevision:0,profileInput:f.profileInput()});expect(["forbidden","conflict"]).toContain(result.kind);expect(f.writes).toHaveLength(0);
});
it("revoke remains available after target/request drift and credential disconnection, preserving prior configuration/version exactly",async()=>{
 const f=fixture();f.state.current={profile:parseCustomerPlanProfile(f.profile),status:"active"};f.rows.request.version=2;f.rows.version.version=2;f.rows.credential.revokedAt=f.now;f.rows.account.externalAccountId="999999999999";
 const result=await revokeCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:2,profileId:f.profile.id,expectedRevision:1});
 expect(result).toMatchObject({kind:"customer_plan_profile",status:"revoked",currentTarget:"unavailable",approval:"unavailable",executionAllowed:false,profile:{...f.profile,revision:2,requestVersion:1}});expect(f.writes).toHaveLength(2);expect(m.trust).not.toHaveBeenCalled();expect(m.binding).not.toHaveBeenCalled();
 expect(f.db.$queryRawUnsafe.mock.calls.every(([sql])=>!sql.includes('public."CloudAccount')&&!sql.includes('public."GitHubInstallation"'))).toBe(true);
});
it.each(["staleCAS","roleLost","requestChanged","foreign"])("revoke denies %s without configuration or pointer mutation",async mode=>{
 const f=fixture();f.state.current={profile:parseCustomerPlanProfile(f.profile),status:"active"};if(mode==="staleCAS")f.state.current.profile.revision=2;if(mode==="foreign")f.rows.request.organizationId="foreign";
 f.state.beforeTransaction=()=>{if(mode==="roleLost")f.rows.membership.role="operator";if(mode==="requestChanged")f.rows.request.version=2;};
 const result=await revokeCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:1,profileId:f.profile.id,expectedRevision:1});expect(["forbidden","conflict","not_found"]).toContain(result.kind);expect(f.writes).toHaveLength(0);
});

afterEach(()=>vi.unstubAllEnvs());
function importFixture(){
 const f=fixture();f.state.current={profile:parseCustomerPlanProfile(f.profile),status:"active"};
 const current=inspectCustomerPlanAuthority(f.profile,f.rows,f.principal,"import",f.now);if(!current)throw Error("owned current fixture invalid");
 const binary=Buffer.from("SYNTHETIC-NOT-GENUINE-TERRAFORM-PLAN"),show=Buffer.from(JSON.stringify({format_version:"1.2",terraform_version:"1.9.8",resource_changes:[{address:"terraform_data.owned",provider_name:"terraform.io/builtin/terraform",change:{actions:["create"],after:{private:"DO-NOT-LEAK"}}}]})),bundle=Buffer.from("SYNTHETIC-NOT-GENUINE-PROVENANCE");
 const receipt=Buffer.from(JSON.stringify({schema:"axiom.terraform.plan-receipt.v2",profileDigest:hash(f.profile),requestContentHash:current.requestContentHash,targetDigest:current.targetDigest,producer:{repositoryId:f.profile.repository.remoteId,repositoryFullName:f.profile.repository.fullName,sourceRef:f.profile.repository.sourceRef,sourceSha:f.profile.repository.sourceSha,workflowPath:f.profile.producer.workflowPath,workflowSha:f.profile.producer.workflowSha,runId:"888",runAttempt:1,roleArn:f.profile.producer.planRoleArn},backendIdentityDigest:hash(f.profile.backend),workspace:"default",stateBefore:backendState(),stateAfter:backendState(),lock:"released",configurationDigest:f.profile.configuration.treeDigest,providerLockDigest:f.profile.configuration.providerLockDigest,terraformVersion:"1.9.8",executableDigest:hash("cli"),binary:{digest:bytesDigest(binary),bytes:binary.length},show:{digest:bytesDigest(show),bytes:show.length},createdAt:f.now.toISOString(),expiresAt:"2026-10-18T12:15:00.000Z"}));
 const observation={kind:"observed_customer_backend",state:backendState(),lock:"unlocked_at_observation",observedAt:f.now.toISOString()};
 const initialObservation={...observation,artifacts:{binary:{bytes:binary,versionId:"binary-v"},show:{bytes:show,versionId:"show-v"},receipt:{bytes:receipt,versionId:"receipt-v"}}};m.backend.mockResolvedValueOnce(initialObservation).mockResolvedValue({...observation});
 m.github.mockResolvedValue({kind:"read_customer_plan_source",bundles:[bundle]});
 const body={requestVersion:1,profileId:f.profile.id,profileRevision:1,runId:"888",runAttempt:1};
 return {...f,body,observation,initialObservation};
}
it("atomically imports sealed exact v2 artifact/provenance through real verification composition without making approval/apply authority (synthetic crypto only)",async()=>{
 const f=importFixture(),result=await importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body);
 expect(result,JSON.stringify({result,backend:m.backend.mock.calls.length,github:m.github.mock.calls.length,verify:m.verify.mock.calls.length,writeCount:f.writes.length})).toMatchObject({kind:"customer_plan_imported",approval:"unavailable",executionAllowed:false,reused:false});expect(f.writes).toHaveLength(2);expect(f.writes[0].sql).toContain('public."TerraformSavedPlanArtifact"');expect(f.writes[1].sql).toContain('public."TerraformCustomerPlanProvenance"');expect(JSON.stringify(f.writes)).not.toContain("DO-NOT-LEAK");
 expect(m.backend).toHaveBeenCalledTimes(2);expect(m.github).toHaveBeenCalledOnce();expect(m.verify).toHaveBeenCalledOnce();expect(f.db.$transaction).toHaveBeenCalledOnce();
 const calls=m.backend.mock.calls;expect(calls[0][3]).toBe(calls[1][3]);expect(m.github.mock.calls[0][0].budget).toBe(calls[0][3]);expect(calls[0][2]).toBe(calls[1][2]);expect(m.github.mock.calls[0][0].signal).toBe(calls[0][2]);
});
it.each(["storageMissing","credentialRevoked","staleProfile","nonAdmin"])("rejects %s import before provider calls or writes",async mode=>{
 const f=importFixture();if(mode==="storageMissing")m.ready.mockResolvedValue("not_installed");if(mode==="credentialRevoked")f.rows.credential.revokedAt=f.now;if(mode==="staleProfile")f.body.profileRevision=2;if(mode==="nonAdmin")f.rows.membership.role="operator";
 expect((await importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body)).kind).not.toBe("customer_plan_imported");expect(m.backend).not.toHaveBeenCalled();expect(m.github).not.toHaveBeenCalled();expect(f.writes).toHaveLength(0);
});
it.each(["signature","stateChanged","locked","demotedFinal","requestChanged","profileRevoked","expiredDuringFinalRead"])("rejects %s import without linked evidence commit",async mode=>{
 const f=importFixture();if(mode==="signature")m.verify.mockResolvedValue({kind:"unavailable"});if(mode==="stateChanged")m.backend.mockResolvedValue({...f.observation,state:{...backendState(),serial:10}});if(mode==="locked")m.backend.mockReset().mockResolvedValue({kind:"unavailable",reason:"customer_plan_backend_locked"});
 f.state.beforeTransaction=()=>{if(mode==="demotedFinal")f.rows.membership.role="operator";if(mode==="requestChanged")f.rows.request.version=2;if(mode==="profileRevoked")f.state.current!.status="revoked";};
 if(mode==="expiredDuringFinalRead")m.backend.mockImplementationOnce(async()=>{f.now.setTime(Date.parse("2026-10-18T12:16:00Z"));return f.observation;});
 expect((await importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body)).kind).not.toBe("customer_plan_imported");expect(f.writes).toHaveLength(0);
});

it("rolls back the artifact insert when linked provenance cannot commit",async()=>{
 const f=importFixture();f.state.failProof=true;expect((await importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body)).kind).toBe("unavailable");expect(f.writes).toHaveLength(0);expect(m.verify).toHaveBeenCalledOnce();
});
it("never calls a provider with final DB locks held",async()=>{
 const f=importFixture();let final=false;f.state.beforeTransaction=()=>{final=true;};const before=m.backend.getMockImplementation()!;m.backend.mockImplementation(async(...args:unknown[])=>{expect(final).toBe(false);return before(...args);});
 expect((await importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body)).kind).toBe("customer_plan_imported");expect(final).toBe(true);
});

it("exports only a fresh local profile/request/toolchain binding and derives UI permissions from current role",async()=>{
 const f=fixture();f.state.current={profile:parseCustomerPlanProfile(f.profile),status:"active"};const result=await readCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId);
 expect(result).toMatchObject({kind:"customer_plan_profile",permissions:{configure:true,import:true},profileExport:{schema:"axiom.terraform.profile-export.v2",profile:f.profile,requestContentHash:f.rows.version.contentHash,toolchain:{version:"1.9.8"}}});expect(result).not.toHaveProperty("currentTarget","observed_match");
 f.rows.membership.role="read_only";expect(await readCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId)).toMatchObject({permissions:{configure:false,import:false}});
 f.rows.credential.revokedAt=f.now;expect(await readCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId)).not.toHaveProperty("profileExport");expect(m.backend).not.toHaveBeenCalled();
});

it("rolls back a newly inserted immutable profile when current-pointer CAS cannot confirm the update",async()=>{
 const f=fixture();f.state.pointerFails=true;expect(await configureCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:1,expectedRevision:0,profileInput:f.profileInput()})).toMatchObject({kind:"conflict"});expect(f.writes).toHaveLength(0);
});
it.each(["same","conflictingProof","roleLost"])("reauthorizes an unknown-outcome retry and handles %s durable evidence without duplicate writes",async mode=>{
 const f=importFixture();expect((await importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body)).kind).toBe("customer_plan_imported");
 const [a,p]=f.writes;const ak=["id","organizationId","deploymentRequestId","requestVersion","bindingJson","bindingDigest","binaryDigest","binaryBytes","showDigest"],pk=["artifactId","organizationId","deploymentRequestId","requestVersion","profileId","profileRevision","bindingDigest","binaryDigest","showDigest","receiptDigest","attestationDigest","trustDigest"];
 f.state.existingArtifact=Object.fromEntries(["id","requestVersion","bindingDigest","binaryDigest","showDigest","binaryBytes"].map(key=>[key,a.values[ak.indexOf(key)]]));f.state.existingProof=Object.fromEntries(pk.map((key,index)=>[key,p.values[index]]));f.writes.splice(0);
 if(mode==="conflictingProof")f.state.existingProof.receiptDigest=hash("conflict");if(mode==="roleLost")f.rows.membership.role="operator";
 m.backend.mockReset().mockResolvedValueOnce(f.initialObservation).mockResolvedValue(f.observation);
 const result=await importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body);expect(result).toMatchObject(mode==="same"?{kind:"customer_plan_imported",reused:true}:mode==="roleLost"?{kind:"forbidden"}:{kind:"conflict"});expect(f.writes).toHaveLength(0);if(mode==="roleLost")expect(m.backend).not.toHaveBeenCalled();
});
it.each(["sessionRevoked","credentialRotated","repositoryRevised"])("refuses final %s import race after valid provider/crypto composition",async mode=>{
 const f=importFixture();f.state.beforeTransaction=()=>{if(mode==="sessionRevoked")f.rows.device.revokedAt=f.now;if(mode==="credentialRotated")f.rows.credential.version++;if(mode==="repositoryRevised")f.rows.repository.updatedAt=new Date(f.now);};
 expect((await importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body)).kind).not.toBe("customer_plan_imported");expect(m.verify).toHaveBeenCalledOnce();expect(m.backend).toHaveBeenCalledTimes(2);expect(f.writes).toHaveLength(0);
});

it("does not configure or export a profile whose CI role is not distinct from the current scoped read connection",async()=>{
 const f=fixture();m.binding.mockResolvedValue(false);expect(await configureCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:1,expectedRevision:0,profileInput:f.profileInput()})).toMatchObject({kind:"conflict",reason:"customer_plan_connection_binding_unavailable"});expect(f.writes).toHaveLength(0);expect(m.backend).not.toHaveBeenCalled();
 f.state.current={profile:parseCustomerPlanProfile(f.profile),status:"active"};expect(await readCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId)).not.toHaveProperty("profileExport");
});

it("returns a bounded retryable conflict on serialization abort without keeping either linked evidence insert",async()=>{
 const f=importFixture();f.state.serializationFailure=true;expect(await importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body)).toMatchObject({kind:"conflict",reason:"customer_plan_concurrent_change"});expect(f.writes).toHaveLength(0);
});

it.each(["configure","revoke","import"])("rolls back %s when its bounded validity expires during persistence",async mode=>{
 const f=importFixture();f.state.onWrite=()=>f.now.setTime(Date.parse(mode==="import"?"2026-10-18T12:16:00Z":"2026-10-20T12:00:00Z"));
 const result=mode==="import"?await importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body):mode==="revoke"?await revokeCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:1,profileId:f.profile.id,expectedRevision:1}):await configureCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId,{requestVersion:1,expectedRevision:1,profileInput:f.profileInput()});expect(["forbidden","conflict"]).toContain(result.kind);expect(f.writes).toHaveLength(0);
});
it.each(["trustRevoked","targetChanged"])("does not export a profile when %s during its local binding read",async mode=>{
 const f=fixture();f.state.current={profile:parseCustomerPlanProfile(f.profile),status:"active"};m.binding.mockImplementation(async()=>{if(mode==="trustRevoked")m.trust.mockReturnValue(null);else f.rows.account.externalAccountId="999999999999";return true;});
 expect(await readCustomerPlanProfile(f.deps,f.principal,f.profile.deploymentRequestId)).not.toHaveProperty("profileExport");expect(f.writes).toHaveLength(0);expect(m.backend).not.toHaveBeenCalled();
});
it("uses one absolute service deadline and stops before source verification or persistence when the initial provider read stalls",async()=>{
 vi.useFakeTimers();const f=importFixture();let started!:()=>void;const reading=new Promise<void>(resolve=>{started=resolve;});m.backend.mockReset().mockImplementation(async(_principal:unknown,_profile:unknown,signal:AbortSignal)=>{started();return new Promise((_,reject)=>signal.addEventListener("abort",()=>reject(Error("synthetic bounded abort")),{once:true}));});
 try{const pending=importCustomerSavedPlan(f.deps,f.principal,f.profile.deploymentRequestId,f.body);await reading;await vi.advanceTimersByTimeAsync(30001);expect((await pending).kind).toBe("unavailable");expect(m.github).not.toHaveBeenCalled();expect(f.writes).toHaveLength(0);expect(vi.getTimerCount()).toBe(0);}finally{vi.useRealTimers();}
});
