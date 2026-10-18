import "server-only";
import { createHash } from "node:crypto";
import { sha256ContentHash } from "@/lib/tauri/contentHash";
import { resolveTenantScopedToken, parseRepositoryFullName, type InstallationRepo } from "@/lib/connectors/github/resolveTenantScopedToken";
import { readGithubProvenanceResource, readGithubTerraformSource, readGithubProvenanceBundle, type GithubBundleDownloadRule, type GithubProvenanceResource, type GithubTerraformSourceResource } from "@/lib/connectors/github/githubWriteClient";
import { withGithubAbort } from "@/lib/connectors/github/boundedGithubRead";
import { bytesDigest } from "./savedPlanArtifact";
import { customerPath, parseCustomerPlanProfile } from "./customerPlanContract";
export interface CustomerPlanGithubInput {
 profile:unknown;run:{id:string;attempt:number};receiptDigest:string;
 installation:{id:string;githubInstallationId:string;accountLogin:string;status:string;revokedAt:Date|null;suspendedAt:Date|null;updatedAt:Date};
 repo:InstallationRepo;current:()=>Promise<boolean>;signal:AbortSignal;downloadPolicy:readonly GithubBundleDownloadRule[];
}
const unavailable=()=>({kind:"unavailable" as const,reason:"customer_plan_github_unavailable"});
function requireValue(condition:unknown):asserts condition {if(!condition)throw new Error("customer_plan_github_unavailable");}
function object(value:unknown):Record<string,unknown>{requireValue(value&&typeof value==="object"&&!Array.isArray(value));return value as Record<string,unknown>;}
function numberId(value:unknown):string|null {return typeof value==="number"&&Number.isSafeInteger(value)&&value>0?String(value):typeof value==="string"&&/^[1-9]\d{0,31}$/.test(value)?value:null;}
function decodeFile(value:unknown,path:string):{bytes:Buffer;sha:string}{
 const file=object(value);requireValue(file.type==="file"&&file.path===path&&file.encoding==="base64"&&typeof file.content==="string"&&/^[A-Za-z0-9+/=\r\n]+$/.test(file.content));
 const bytes=Buffer.from(file.content,"base64");requireValue(bytes.length>0&&bytes.length<=128*1024&&file.size===bytes.length&&bytes.toString("base64")===file.content.replace(/[\r\n]/g,""));
 const sha=createHash("sha1").update(`blob ${bytes.length}\0`).update(bytes).digest("hex");requireValue(file.sha===sha);new TextDecoder("utf-8",{fatal:true}).decode(bytes);return {bytes,sha};
}
/** Read-only source/run observations and untrusted signed-bundle bytes. This
 * function NEVER labels them verified: official plan-subject verification follows. */
export async function readCustomerPlanGithubEvidence(input:CustomerPlanGithubInput):Promise<{kind:"read_customer_plan_source";bundles:Buffer[]}|ReturnType<typeof unavailable>>{
 try{
  const profile=parseCustomerPlanProfile(input.profile),run=structuredClone(input.run),installation=structuredClone(input.installation),policy=structuredClone(input.downloadPolicy),current=input.current;
  const receiptDigest=input.receiptDigest,repo=input.repo,signal=AbortSignal.any([input.signal,AbortSignal.timeout(30_000)]),budget={remainingBytes:8*1024*1024};
  const repository=parseRepositoryFullName(profile.repository.fullName);
  requireValue(repository&&policy.length>0&&policy.length<=8&&policy.every(p=>p.pathPrefix===`/attestations/${profile.repository.remoteId}/`));
  requireValue(typeof run.id==="string"&&/^[1-9]\d{0,31}$/.test(run.id)&&Number.isSafeInteger(run.attempt)&&run.attempt>0&&/^[a-f0-9]{64}$/.test(receiptDigest));
  requireValue(installation.id&&installation.status==="active"&&!installation.revokedAt&&!installation.suspendedAt&&Number.isFinite(installation.updatedAt.getTime())
   &&/^[1-9]\d{0,15}$/.test(installation.githubInstallationId)&&Number.isSafeInteger(Number(installation.githubInstallationId))&&installation.accountLogin.toLowerCase()===repository.owner.toLowerCase());
  async function authority(){signal.throwIfAborted();requireValue(await withGithubAbort(current(),signal));}
  await authority();
  const credential=await withGithubAbort(resolveTenantScopedToken(profile.organizationId,repository,{id:installation.id,githubInstallationId:installation.githubInstallationId,updatedAt:installation.updatedAt,signal,permissionProfile:"provenance_read"},repo),signal);
  requireValue(credential.ok);const token=credential.token;
  async function read(resource:GithubProvenanceResource){await authority();const result=await readGithubProvenanceResource({...repository!,installationToken:token,signal,budget,resource});requireValue(result.ok);return result.data;}
  async function source(resource:GithubTerraformSourceResource){await authority();const result=await readGithubTerraformSource({...repository!,installationToken:token,signal,budget,resource});requireValue(result.ok);return result.data;}
  function matchRepository(value:unknown){const r=object(value);requireValue(numberId(r.id)===profile.repository.remoteId&&r.full_name===profile.repository.fullName);}
  async function checkRepository(){const value=object(await read({kind:"repository"}));matchRepository(value);requireValue(value.private===false);}
  async function checkRun(attempt?:number){const value=object(await read({kind:"run",runId:run.id,...(attempt===undefined?{}:{attempt})}));matchRepository(value.repository);matchRepository(value.head_repository);
   requireValue(numberId(value.id)===run.id&&value.run_attempt===run.attempt&&value.head_sha===profile.repository.sourceSha&&value.head_branch===profile.repository.sourceRef.slice("refs/heads/".length)
    &&value.path===profile.producer.workflowPath&&value.event==="workflow_dispatch"&&value.status==="completed"&&value.conclusion==="success"&&(value.referenced_workflows===undefined||(Array.isArray(value.referenced_workflows)&&value.referenced_workflows.length===0)));
  }
  await checkRepository();await checkRun();await checkRun(run.attempt);
  const workflow=decodeFile(await read({kind:"workflow",workflowPath:profile.producer.workflowPath,commitSha:profile.repository.sourceSha}),profile.producer.workflowPath);
  requireValue(bytesDigest(workflow.bytes)===profile.producer.workflowDigest);
  const script=decodeFile(await source({kind:"file",path:profile.producer.scriptPath,commitSha:profile.repository.sourceSha}),profile.producer.scriptPath);
  requireValue(bytesDigest(script.bytes)===profile.producer.scriptDigest);
  const lockPath=`${profile.configuration.root}/.terraform.lock.hcl`,lock=decodeFile(await source({kind:"file",path:lockPath,commitSha:profile.repository.sourceSha}),lockPath);
  requireValue(bytesDigest(lock.bytes)===profile.configuration.providerLockDigest);
  const commit=object(await source({kind:"commit",sha:profile.repository.sourceSha})),commitTree=object(commit.tree);requireValue(commit.sha===profile.repository.sourceSha&&typeof commitTree.sha==="string"&&/^[a-f0-9]{40}$/.test(commitTree.sha));
  const tree=object(await source({kind:"tree",sha:commitTree.sha}));requireValue(tree.sha===commitTree.sha&&tree.truncated===false&&Array.isArray(tree.tree)&&tree.tree.length<=1000);
  const entries=tree.tree.map(object),paths=new Set<string>();
  for(const entry of entries){requireValue(typeof entry.path==="string"&&entry.path.length<=1024&&!paths.has(entry.path));paths.add(entry.path);}
  function exactBlob(path:string,sha:string){const entry=entries.find(e=>e.path===path);requireValue(entry&&entry.type==="blob"&&["100644","100755"].includes(String(entry.mode))&&entry.sha===sha);}
  exactBlob(profile.producer.workflowPath,workflow.sha);exactBlob(profile.producer.scriptPath,script.sha);exactBlob(lockPath,lock.sha);
  const config=entries.filter(e=>String(e.path).startsWith(`${profile.configuration.root}/`)&&e.type!=="tree").map(e=>{
   const path=String(e.path).slice(profile.configuration.root.length+1);requireValue(customerPath(path)&&!path.startsWith(".terraform/")&&e.type==="blob"&&["100644","100755"].includes(String(e.mode))&&typeof e.sha==="string"&&/^[a-f0-9]{40}$/.test(e.sha));
   return {path,mode:e.mode as string,sha:e.sha as string};
  }).sort((a,b)=>a.path<b.path?-1:a.path>b.path?1:0);
  requireValue(config.length>0&&sha256ContentHash(config)===profile.configuration.treeDigest);
  const listing=object(await read({kind:"attestations",subjectSha256:receiptDigest}));requireValue(Array.isArray(listing.attestations)&&listing.attestations.length>0&&listing.attestations.length<=5);
  const bundles:Buffer[]=[];
  for(const raw of listing.attestations){const entry=object(raw);requireValue(numberId(entry.repository_id)===profile.repository.remoteId&&typeof entry.bundle_url==="string");await authority();
   const result=await readGithubProvenanceBundle({url:entry.bundle_url,policy,signal,budget});requireValue(result.ok&&result.data.byteLength<=1024*1024);bundles.push(Buffer.from(result.data));
  }
  await checkRepository();await checkRun();await checkRun(run.attempt);await authority();
  return {kind:"read_customer_plan_source",bundles:bundles.sort((a,b)=>bytesDigest(a).localeCompare(bytesDigest(b)))};
 }catch{return unavailable();}
}
