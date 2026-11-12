import {z} from 'zod';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import type {PrivateGithubJobSource} from './nativeGithubJobIdentity';
import type {OperationalRemoteHandoffProfile} from './remoteHandoffSource';
const digest=z.string().regex(/^[a-f0-9]{64}$/);
export const githubJobConfiguration=z.object({environment:z.string().regex(/^[-A-Za-z0-9_ ]{1,128}$/),protectionRevision:digest,audience:z.string().regex(/^[-A-Za-z0-9_]{1,256}$/),endpoint:z.string().max(2048),preflightEndpoint:z.string().max(2048)}).strict();
/** Setup-qualified metadata for channel trust, NOT authenticated workload proof.
 * No actual native coordinate, runtime qualification or default is supplied. */
export const githubBootstrapProfile=githubJobConfiguration.extend({format:z.literal(2),purpose:z.literal('github_native_bootstrap_channel_v2'),repository:z.literal('sahme209/visionxixlabs'),ref:z.literal('refs/heads/main'),workflowPath:z.literal('.github/workflows/axiom-deploy-aws-ecs.yml'),workflowSha256:digest,nativeOrigin:z.string().max(512),nativePath:z.string().max(1024).regex(/^\/[A-Za-z0-9_./-]+$/),nativeQueryKeys:z.array(z.string().regex(/^[A-Za-z0-9_-]{1,64}$/)).max(16).readonly(),expiresAt:z.number().int().positive().safe()}).strict();
export type GithubBootstrapProfile=z.infer<typeof githubBootstrapProfile>;
const keys=['ACTIONS_ID_TOKEN_REQUEST_URL','ACTIONS_ID_TOKEN_REQUEST_TOKEN','GITHUB_REPOSITORY','GITHUB_REF','GITHUB_SHA','GITHUB_WORKFLOW_SHA','GITHUB_WORKFLOW_REF','GITHUB_RUN_ID','GITHUB_RUN_ATTEMPT'] as const;
export type GithubJobEnvironmentKey=typeof keys[number];
export type GithubJobEnvironmentReader=(key:GithubJobEnvironmentKey)=>string|undefined;
const fail=():never=>{throw Error('operational_job_unconfirmed')};
function endpoint(raw:string){const u=new URL(raw);if(u.protocol!=='https:'||u.username||u.password||u.port||u.search||u.hash||u.href!==raw||!/^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z][a-z0-9-]*$/.test(u.hostname))return fail();return u}
export function readGithubBootstrapProfile(raw:unknown):Readonly<GithubBootstrapProfile>{try{
 const p=githubBootstrapProfile.parse(raw),origin=new URL(p.nativeOrigin);
 if(p.expiresAt<=Date.now()||origin.origin!==p.nativeOrigin||origin.protocol!=='https:'||origin.username||origin.password||origin.port||!origin.hostname.endsWith('.actions.githubusercontent.com')||p.nativeQueryKeys.includes('audience')||new Set(p.nativeQueryKeys).size!==p.nativeQueryKeys.length||endpoint(p.endpoint).origin!==endpoint(p.preflightEndpoint).origin||p.endpoint===p.preflightEndpoint)return fail();
 return Object.freeze({...p,nativeQueryKeys:Object.freeze([...p.nativeQueryKeys])});
}catch{return fail()}}
/** Only specific native variables are read, once plus exact currentness checks.
 * Hints can reject a mismatch; they cannot authenticate a job or approve work. */
export function createGithubBootstrap(raw:unknown,read:GithubJobEnvironmentReader){
 const p=readGithubBootstrapProfile(raw);
 function snapshot(){
  if(p.expiresAt<=Date.now())return fail();
  const v=Object.fromEntries(keys.map(k=>[k,read(k)]));
  if(keys.some(k=>typeof v[k]!=='string'||!v[k]||v[k]!.length>16384))return fail();
  if(v.GITHUB_REPOSITORY!==p.repository||v.GITHUB_REF!==p.ref||v.GITHUB_WORKFLOW_REF!==p.repository+'/'+p.workflowPath+'@'+p.ref||!/^\d{1,20}$/.test(v.GITHUB_RUN_ID!)||!/^\d{1,6}$/.test(v.GITHUB_RUN_ATTEMPT!)||Number(v.GITHUB_RUN_ATTEMPT)<1||!Number.isSafeInteger(Number(v.GITHUB_RUN_ATTEMPT))||!/^([a-f0-9]{40})$/.test(v.GITHUB_SHA!)||!/^([a-f0-9]{40})$/.test(v.GITHUB_WORKFLOW_SHA!))return fail();
  const u=new URL(v.ACTIONS_ID_TOKEN_REQUEST_URL!);
  const actual=[...u.searchParams.keys()];
  if(u.origin!==p.nativeOrigin||u.pathname!==p.nativePath||u.username||u.password||u.port||u.hash||u.protocol!=='https:'||actual.length!==p.nativeQueryKeys.length||new Set(actual).size!==actual.length||actual.some(k=>!p.nativeQueryKeys.includes(k))||[...u.searchParams.values()].some(v=>!/^[-A-Za-z0-9_.]{1,256}$/.test(v)))return fail();
  return v;
 }
 const held=snapshot();
 const remote:OperationalRemoteHandoffProfile={endpoint:p.endpoint,preflightEndpoint:p.preflightEndpoint,audience:p.audience,workload:{environment:p.environment,protectionRevision:p.protectionRevision,repository:p.repository,ref:p.ref,commit:held.GITHUB_SHA!,workflowCommit:held.GITHUB_WORKFLOW_SHA!,workflowPath:p.workflowPath,workflowSha256:p.workflowSha256,runId:held.GITHUB_RUN_ID!,attempt:Number(held.GITHUB_RUN_ATTEMPT)}};
 function current(profile:Readonly<OperationalRemoteHandoffProfile>,signal:AbortSignal){signal.throwIfAborted();const snapshotValues=snapshot();if(p.expiresAt<=Date.now()||sha256ContentHash(profile)!==sha256ContentHash(remote)||keys.some(k=>snapshotValues[k]!==held[k]))return fail()}
 const source:PrivateGithubJobSource={async assertChannelQualified(profile,signal){current(profile,signal)},async capture(profile,signal){current(profile,signal);return {origin:p.nativeOrigin,requestUrl:held.ACTIONS_ID_TOKEN_REQUEST_URL!,requestToken:held.ACTIONS_ID_TOKEN_REQUEST_TOKEN!}},async assertCurrent(profile,signal){current(profile,signal)}};
 return {remote,source};
}
