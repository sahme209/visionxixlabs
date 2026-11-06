import 'server-only';
import {verify} from 'node:crypto';
import {z} from 'zod';
import {parseReleaseOperationPlan,type ReleaseOperationPlan} from '@/lib/tauri/releaseOperationPlanContract';
import {sha256ContentHash} from '@/lib/tauri/contentHash';
import {FIXTURE_TENANT} from './fixtureAuthorizationFrame';
import {FIXTURE_GROUPS,fixtureRepository,fixtureInstallation,fixtureSha,type FixtureGroup} from './fixtureScenarioInputs';
const APP_ID=900;
const profiles=[{contents:'write',pull_requests:'read',metadata:'read'},{administration:'read',contents:'read',pull_requests:'read',metadata:'read'},{administration:'read',contents:'read',metadata:'read'}]as const;
const tokenBody=z.object({repositories:z.array(z.string()).length(1),permissions:z.record(z.string(),z.string())}).strict();
const mergeBody=z.object({sha:z.string(),merge_method:z.literal('squash')}).strict();
/** Reductions only, constructed by fixed private scenario source; never a data/request callback. */
export interface PrivateFixtureRevocationProgram { beforeProviderRead(group:FixtureGroup,phase:'read'|'write_credential'|'target_read',signal:AbortSignal):Promise<void>; }
/** Fixed simulated provider. No network fallback or caller-selected response/mode. */
export function createPrivateFixtureProvider(rawPlans:readonly ReleaseOperationPlan[],publicKey:string,revocations?:PrivateFixtureRevocationProgram):typeof fetch{
 if(typeof publicKey!=='string'||!publicKey||publicKey.length>16384||rawPlans.length!==FIXTURE_GROUPS.length)throw Error('fixture_provider_configuration_invalid');
 const plans=new Map<FixtureGroup,ReleaseOperationPlan>();
 for(const raw of rawPlans){const p=parseReleaseOperationPlan(structuredClone(raw)),group=FIXTURE_GROUPS.find(g=>fixtureRepository(g)===p.pullRequest.repositoryFullName);if(!group||plans.has(group)||p.organizationId!==FIXTURE_TENANT||p.connectionId!=='qualification_connection_'+group.replaceAll('-','_')||p.pullRequest.number!==1||p.pullRequest.headSha!==fixtureSha(group,'head')||p.pullRequest.baseSha!==fixtureSha(group,'base')||p.pullRequest.headRef!=='feature'||p.pullRequest.baseRef!=='main'||p.method!=='squash')throw Error('fixture_provider_plan_invalid');plans.set(group,p);}
 const issued=new Map<string,{group:FixtureGroup;permissions:Record<string,string>;expiresAt:number}>(),mintedWrites=new Set<FixtureGroup>(),writes=new Set<FixtureGroup>();let sequence=0;
 const refuse=():never=>{throw Error('fixed_fixture_provider_refused')};
 function appJwt(token:string){try{if(token.length>8192)refuse();const parts=token.split('.');if(parts.length!==3||parts.some(p=>!p||!/^[A-Za-z0-9_-]+$/.test(p)))refuse();const h=z.object({alg:z.literal('RS256'),typ:z.literal('JWT')}).strict().parse(JSON.parse(Buffer.from(parts[0],'base64url').toString('utf8'))),p=z.object({iss:z.literal(APP_ID),iat:z.number().int(),exp:z.number().int()}).strict().parse(JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8')));void h;const now=Math.floor(Date.now()/1000);if(p.iat>now||p.iat<now-120||p.exp<=now||p.exp>now+600||!verify('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),publicKey,Buffer.from(parts[2],'base64url')))refuse();}catch{refuse();}}
 const provider:typeof fetch=async(input,init={})=>{
  if(typeof input!=='string'&&!(input instanceof URL))return refuse();const url=new URL(String(input)),method=init.method??'GET',headers=new Headers(init.headers),signal=init.signal??new AbortController().signal;signal.throwIfAborted();
  if(url.origin!=='https://api.github.com'||url.username||url.password||url.hash||headers.get('X-GitHub-Api-Version')!=='2022-11-28'||!headers.get('Accept')?.includes('application/vnd.github+json'))return refuse();
  const authorization=headers.get('Authorization');if(!authorization?.startsWith('Bearer '))return refuse();const bearer=authorization.slice(7);const match=/^\/app\/installations\/([0-9]+)(\/access_tokens)?$/.exec(url.pathname);
  if(match){const group=FIXTURE_GROUPS.find(g=>fixtureInstallation(g)===match[1]);if(!group||url.search)return refuse();appJwt(bearer);
   if(match[2]){if(method!=='POST'||headers.get('Content-Type')!=='application/json'||typeof init.body!=='string'||Buffer.byteLength(init.body)>4096||issued.size>=256)return refuse();const body=tokenBody.parse(JSON.parse(init.body)),profile=profiles.find(p=>sha256ContentHash(p)===sha256ContentHash(body.permissions));if(!profile||body.repositories[0]!==group)return refuse();const write=body.permissions.contents==='write';if(write&&mintedWrites.has(group))return refuse();await revocations?.beforeProviderRead(group,write?'write_credential':'read',signal);signal.throwIfAborted();if(write)mintedWrites.add(group);const token='qualification_simulated_'+group+'_'+(++sequence),expiresAt=Date.now()+600000;issued.set(token,{group,permissions:{...body.permissions},expiresAt});return Response.json({token,expires_at:new Date(expiresAt).toISOString(),permissions:body.permissions,repository_selection:'selected',repositories:[{name:group,full_name:fixtureRepository(group),owner:{login:'axiom-qualification'}}]},{status:201});}
   if(method!=='GET')return refuse();return Response.json({id:Number(fixtureInstallation(group)),app_id:APP_ID,account:{id:901,login:'axiom-qualification',type:'Organization'},suspended_at:null,repository_selection:'selected',permissions:{administration:'read',contents:'write',pull_requests:'read',metadata:'read'}});
  }
  const group=FIXTURE_GROUPS.find(g=>url.pathname===`/repos/${fixtureRepository(g)}`||url.pathname.startsWith(`/repos/${fixtureRepository(g)}/`));if(!group)return refuse();const suffix=url.pathname.slice(('/repos/'+fixtureRepository(group)).length),plan=plans.get(group)!;
  if(suffix==='/installation'){if(method!=='GET'||url.search)return refuse();appJwt(bearer);return Response.json({id:Number(fixtureInstallation(group)),app_id:APP_ID,account:{id:901,login:'axiom-qualification',type:'Organization'},suspended_at:null,repository_selection:'selected',permissions:{administration:'read',contents:'write',pull_requests:'read',metadata:'read'}});}
  const credential=issued.get(bearer);if(!credential||credential.group!==group||credential.expiresAt<=Date.now())return refuse();
  const pr=()=>({number:1,state:writes.has(group)?'closed':'open',draft:false,merged:writes.has(group),merge_commit_sha:writes.has(group)?fixtureSha(group,'merged'):null,head:{sha:plan.pullRequest.headSha,ref:'feature',repo:{full_name:fixtureRepository(group)}},base:{sha:plan.pullRequest.baseSha,ref:'main',repo:{full_name:fixtureRepository(group)}}});
  if(method==='PUT'){if(suffix!=='/pulls/1/merge'||url.search||credential.permissions.contents!=='write'||writes.has(group)||headers.get('Content-Type')!=='application/json'||typeof init.body!=='string'||Buffer.byteLength(init.body)>1024)return refuse();const body=mergeBody.parse(JSON.parse(init.body));if(body.sha!==plan.pullRequest.headSha)return refuse();signal.throwIfAborted();writes.add(group);if(group==='unknown')throw Error('simulated_provider_acknowledgement_lost');return Response.json({sha:fixtureSha(group,'merged'),merged:true});}
  if(method!=='GET'||init.body!==undefined)return refuse();await revocations?.beforeProviderRead(group,credential.permissions.contents==='write'?'target_read':'read',signal);signal.throwIfAborted();
  if(suffix===''&&!url.search)return Response.json({id:1000+FIXTURE_GROUPS.indexOf(group),full_name:fixtureRepository(group),default_branch:'main',archived:false,disabled:false,allow_merge_commit:true,allow_squash_merge:true,allow_rebase_merge:true});
  if(suffix==='/pulls/1'&&!url.search)return Response.json(pr());
  if(suffix==='/pulls'&&url.search==='?state=open&per_page=100&page=1')return Response.json(writes.has(group)?[]:[pr()]);
  if(suffix===`/compare/${plan.pullRequest.baseSha}...${plan.pullRequest.headSha}`&&url.search==='?per_page=100&page=1')return Response.json({status:'ahead',ahead_by:1,behind_by:0,total_commits:1,base_commit:{sha:plan.pullRequest.baseSha},merge_base_commit:{sha:plan.pullRequest.baseSha},commits:[{sha:plan.pullRequest.headSha,parents:[{sha:plan.pullRequest.baseSha}]}]});
  if(suffix==='/rules/branches/main'&&url.search==='?per_page=100&page=1'||suffix==='/rulesets'&&url.search==='?includes_parents=true&per_page=100&page=1')return Response.json([]);
  if(suffix==='/branches/main/protection'&&!url.search)return Response.json({},{status:404});
  return refuse();
 };
 return Object.freeze(provider);
}
