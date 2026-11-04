import "server-only";
import {signJwt} from "./githubAppJwt";
import {readBoundedGithubBody,withGithubAbort} from "./boundedGithubRead";
import type {GithubAppAuthDependencies} from "./githubAppAuthCore";

export type ReleaseTokenPurpose = 'merge' | 'dispatch' | 'workflow_read' | 'source_policy_read' | 'merge_policy_read' | 'coding_pr_write';
export interface ReleaseInstallationEligibilityBinding {
 organizationId:string;connectionId:string;connectionRevision:string;installationId:string;
 repositoryFullName:string;purpose:'merge'|'dispatch';planDigest:string;
}
export interface ReleaseInstallationEligibilityInput extends ReleaseInstallationEligibilityBinding {
 isEnabled:()=>boolean;assertCurrent:()=>Promise<void|(()=>void)>;fetch:typeof fetch;
}

/** Bound only by trusted composition. Legacy request transport selection is
 * supplied explicitly; private instances always return their captured fetch. */
export interface GithubReleaseAuthDependencies extends Pick<GithubAppAuthDependencies,"getGithubConfig"|"resolveGithubAppPrivateKey"|"resolveSigningConfiguration"|"now"> {
 transportForRequest: (input:{fetch?:typeof fetch})=>typeof fetch|undefined;
}
export function createGithubReleaseAuthCore(dependencies:GithubReleaseAuthDependencies){
 const {getGithubConfig,resolveGithubAppPrivateKey,resolveSigningConfiguration,now,transportForRequest}=dependencies;
const GITHUB_API = "https://api.github.com";
const releasePermissions = {
  coding_pr_write: {contents:"write",pull_requests:"write",metadata:"read"},
  merge: { contents:'write', pull_requests:'read', metadata:'read' },
  dispatch: { actions:'write', contents:'read', metadata:'read' },
  workflow_read: { actions:'read', contents:'read', metadata:'read' },
  source_policy_read: { administration:'read', contents:'read', metadata:'read' },
  merge_policy_read: { administration:'read', contents:'read', pull_requests:'read', metadata:'read' },
} as const;
/** Explicit, uncached, one-repository release token. No JWT/key is exposed, no
 * default installation or inherited permission set is accepted. Calling this
 * requires a separately installed current-actor verifier and activation gate. */
async function resolveReleaseInstallationToken(input:{
 installationId:string;repositoryFullName:string;purpose:ReleaseTokenPurpose;
 isEnabled?:()=>boolean;assertCurrent?:()=>Promise<void|(()=>void)>;fetch?:typeof fetch;
},callerSignal:AbortSignal):Promise<{token:string;expiresAt:number;permissions:Record<string,string>}|null>{
 const fetcher=transportForRequest(input);
 if(!input.isEnabled?.()||!input.assertCurrent||!fetcher||callerSignal.aborted)return null;
 const permissions=releasePermissions[input.purpose];
 if(!permissions||!Object.hasOwn(releasePermissions,input.purpose)||!/^[1-9]\d{0,14}$/.test(input.installationId)||!Number.isSafeInteger(Number(input.installationId))||Number(input.installationId)<1||!/^([A-Za-z0-9][A-Za-z0-9_.-]{0,99})\/([A-Za-z0-9][A-Za-z0-9_.-]{0,99})$/.test(input.repositoryFullName))return null;
 let sessionFresh:(()=>void)|undefined;const deadline=now()+8000,signal=AbortSignal.any([callerSignal,AbortSignal.timeout(8000)]);
 const guard=()=>{signal.throwIfAborted();if(!input.isEnabled?.()||now()>=deadline)throw Error('release_token_unavailable');sessionFresh?.()};
 const current=async()=>{guard();const fresh=await withGithubAbort(input.assertCurrent!(),signal);if(fresh!==undefined&&typeof fresh!=='function')throw Error('release_token_unavailable');if(typeof fresh==='function'){const prior=sessionFresh;sessionFresh=()=>{prior?.();if(fresh()!==undefined)throw Error('release_token_unavailable')}}guard()};
 let received:Response|undefined;
 try{
  await current();const signing=resolveSigningConfiguration ? await withGithubAbort(resolveSigningConfiguration(),signal) : undefined;guard();const cfg=resolveSigningConfiguration ? signing! : await withGithubAbort(getGithubConfig(),signal);guard();
  if(!cfg.appConfigured||!cfg.appId||!Number.isSafeInteger(cfg.appId)||cfg.appId<1)return null;
  const key=resolveSigningConfiguration ? signing!.privateKey : await withGithubAbort(resolveGithubAppPrivateKey(),signal);guard();if(!key)return null;
  const jwt=signJwt(cfg.appId,key,now);await current();
  const url=`${GITHUB_API}/app/installations/${input.installationId}/access_tokens`;
  const pending=Promise.resolve().then(()=>{guard();return fetcher(url,{method:'POST',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{Authorization:`Bearer ${jwt}`,Accept:'application/vnd.github+json','Content-Type':'application/json','X-GitHub-Api-Version':'2022-11-28'},body:JSON.stringify({repositories:[input.repositoryFullName.split('/')[1]],permissions})})});
  void pending.then(r=>{if(signal.aborted||now()>=deadline)void r.body?.cancel().catch(()=>{})},()=>{});
  const response=await withGithubAbort(pending,signal);received=response;guard();
  if(response.status!==201||response.redirected||response.url&&response.url!==url)return null;
  const bytes=await readBoundedGithubBody(response,signal,65536);guard();
  const value:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value||typeof value!=='object'||Array.isArray(value))return null;
  const v=value as Record<string,unknown>,returned=v.permissions;
  if(typeof v.token!=='string'||!v.token||v.token.length>4096||/[\s\x00-\x1f\x7f]/.test(v.token)||typeof v.expires_at!=='string'||!returned||typeof returned!=='object'||Array.isArray(returned)||Object.keys(returned).sort().join()!==Object.keys(permissions).sort().join()||Object.entries(permissions).some(([k,p])=>(returned as Record<string,unknown>)[k]!==p)||v.repository_selection!=='selected'||!Array.isArray(v.repositories)||v.repositories.length!==1)return null;
  const repo=v.repositories[0];if(!repo||typeof repo!=='object'||repo.full_name!==input.repositoryFullName||repo.name!==input.repositoryFullName.split('/')[1]||repo.owner?.login!==input.repositoryFullName.split('/')[0])return null;
  const expiresAt=Date.parse(v.expires_at);if(!Number.isFinite(expiresAt)||expiresAt<=now()+20000||expiresAt>now()+65*60000)return null;
  await current();guard();return{token:v.token,expiresAt,permissions:{...permissions}};
 }catch{return null}finally{void received?.body?.cancel().catch(()=>{})}
}

/** Server-only release eligibility. Metadata is NOT an issued write grant. */
const releaseEligibilityProofs=new WeakMap<object,{binding:string;assertFresh:()=>void}>();
function eligibilityBinding(raw:ReleaseInstallationEligibilityBinding):ReleaseInstallationEligibilityBinding{
 const fields=['organizationId','connectionId','connectionRevision','installationId','repositoryFullName','purpose','planDigest'];
 if(!raw||typeof raw!=='object'||Object.keys(raw).length!==fields.length||Object.keys(raw).some(k=>!fields.includes(k)))throw Error('release_eligibility_unavailable');
 const b={organizationId:raw.organizationId,connectionId:raw.connectionId,connectionRevision:raw.connectionRevision,installationId:raw.installationId,repositoryFullName:raw.repositoryFullName,purpose:raw.purpose,planDigest:raw.planDigest};
 if([b.organizationId,b.connectionId].some(v=>typeof v!=='string'||!v.trim()||v!==v.trim()||v.length>240||/[\x00-\x1f\x7f]/.test(v))||typeof b.connectionRevision!=='string'||!/^\d{4}-\d\d-\d\dT/.test(b.connectionRevision)||!Number.isFinite(Date.parse(b.connectionRevision))||typeof b.installationId!=='string'||!(/^[1-9]\d{0,14}$/.test(b.installationId))||!Number.isSafeInteger(Number(b.installationId))||typeof b.repositoryFullName!=='string'||!/^([A-Za-z0-9][A-Za-z0-9_.-]{0,99})\/([A-Za-z0-9][A-Za-z0-9_.-]{0,99})$/.test(b.repositoryFullName)||!['merge','dispatch'].includes(b.purpose)||!(/^[a-f0-9]{64}$/.test(b.planDigest)))throw Error('release_eligibility_unavailable');
 return b;
}
async function readReleaseInstallationEligibility(input:ReleaseInstallationEligibilityInput,parent:AbortSignal):Promise<object|null>{
 let received:Response|undefined;
 try{
  // Snapshot every scope primitive and trusted callback before configuration IO.
  const binding=eligibilityBinding({organizationId:input.organizationId,connectionId:input.connectionId,connectionRevision:input.connectionRevision,installationId:input.installationId,repositoryFullName:input.repositoryFullName,purpose:input.purpose,planDigest:input.planDigest});
  const isEnabled=input.isEnabled,assertCurrent=input.assertCurrent,fetcher=transportForRequest(input),started=now();
  const signal=AbortSignal.any([parent,AbortSignal.timeout(15000)]);let sessionFresh:(()=>void)|undefined,observedAt:number|undefined;
  const guard=()=>{signal.throwIfAborted();const at=now();if(typeof isEnabled!=='function'||typeof assertCurrent!=='function'||typeof fetcher!=='function'||!isEnabled()||!Number.isFinite(started)||!Number.isFinite(at)||at<started||at>=started+15000||observedAt!==undefined&&(at<observedAt||at>=observedAt+5000))throw Error('release_eligibility_unavailable');if(sessionFresh)sessionFresh()};
  const current=async()=>{guard();const fresh=await withGithubAbort(assertCurrent(),signal);if(fresh!==undefined&&typeof fresh!=='function')throw Error('release_eligibility_unavailable');sessionFresh=fresh??undefined;guard()};
  await current();const signing=resolveSigningConfiguration ? await withGithubAbort(resolveSigningConfiguration(),signal) : undefined;guard();const cfg=resolveSigningConfiguration ? signing! : await withGithubAbort(getGithubConfig(),signal);guard();
  if(!cfg.appConfigured||!Number.isSafeInteger(cfg.appId)||!cfg.appId||cfg.appId<1)return null;
  const appId=cfg.appId,key=resolveSigningConfiguration ? signing!.privateKey : await withGithubAbort(resolveGithubAppPrivateKey(),signal);guard();if(!key)return null;
  const jwt=signJwt(appId,key,now),[owner,repo]=binding.repositoryFullName.split('/');
  // Installation metadata eligibility does not establish implicit metadata access.
  // Actual read/write token responses still require their strict metadata grant.
  const required=binding.purpose==='merge'?{contents:'write',pull_requests:'read'}:{actions:'write',contents:'read'};
  async function metadata(url:string){
   await current();guard();
   const pending=Promise.resolve().then(()=>{guard();return fetcher!(url,{method:'GET',redirect:'error',credentials:'omit',cache:'no-store',signal,headers:{Authorization:`Bearer ${jwt}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}})});
   void pending.then(r=>{if(signal.aborted||now()>=started+15000)void r.body?.cancel().catch(()=>{})},()=>{});
   const response=await withGithubAbort(pending,signal);received=response;guard();if(response.status!==200||response.redirected||response.url&&response.url!==url)throw Error('release_eligibility_unavailable');
   const bytes=await readBoundedGithubBody(response,signal,65536);guard();const raw:unknown=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('release_eligibility_unavailable');const v=raw as Record<string,unknown>,account=v.account,permissions=v.permissions;
   if(v.id!==Number(binding.installationId)||v.app_id!==appId||v.suspended_at!==null||!['all','selected'].includes(v.repository_selection as string)||!account||typeof account!=='object'||Array.isArray(account)||!permissions||typeof permissions!=='object'||Array.isArray(permissions)||Object.keys(permissions).length>128)throw Error('release_eligibility_unavailable');
   const a=account as Record<string,unknown>,p=permissions as Record<string,unknown>;
   if(Object.hasOwn(p,'metadata')&&p.metadata!=='read')throw Error('release_eligibility_unavailable');
   if(!Number.isSafeInteger(a.id)||Number(a.id)<1||typeof a.login!=='string'||a.login.toLowerCase()!==owner.toLowerCase()||!['User','Organization'].includes(a.type as string)||Object.entries(required).some(([k,level])=>level==='write'?p[k]!=='write':!['read','write'].includes(p[k] as string)))throw Error('release_eligibility_unavailable');
   if(observedAt===undefined)observedAt=now();guard();return {accountId:a.id,accountLogin:a.login.toLowerCase(),accountType:a.type};
  }
  const installation=await metadata(`${GITHUB_API}/app/installations/${binding.installationId}`),repository=await metadata(`${GITHUB_API}/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/installation`);
  if(JSON.stringify(installation)!==JSON.stringify(repository))return null;
  await current();guard();
  const proof=Object.freeze({kind:'release_installation_eligibility_v1'});releaseEligibilityProofs.set(proof,{binding:JSON.stringify(binding),assertFresh:guard});return proof;
 }catch{return null}finally{void received?.body?.cancel().catch(()=>{})}
}
/** Only original one-use metadata proof qualifies eligibility, never actual write
 * access. Callers retain assertFresh through later claim/DB/transport awaits. */
function consumeReleaseInstallationEligibility(proof:object,raw:ReleaseInstallationEligibilityBinding):{providerEligibilityVerified:true;assertFresh:()=>void}{
 const saved=releaseEligibilityProofs.get(proof);releaseEligibilityProofs.delete(proof);
 const unavailable=()=>{throw Error('release_eligibility_unavailable')};
 try{if(!saved||saved.binding!==JSON.stringify(eligibilityBinding(raw)))return unavailable();saved.assertFresh();return Object.freeze({providerEligibilityVerified:true as const,assertFresh:()=>{try{saved.assertFresh()}catch{return unavailable()}}})}catch{return unavailable()}
}

return Object.freeze({resolveReleaseInstallationToken,readReleaseInstallationEligibility,consumeReleaseInstallationEligibility});
}
