import {platformActionId,platformInspectionSchema,type PlatformInspection} from '../../../lib/governance/platform/viewContract';
import {platformDeploymentPreview,type PlatformDeploymentPreview} from '../../../lib/governance/platform/deploymentContract';
import {deploymentHistoryView,type DeploymentHistoryView} from '../../../lib/governance/platform/deploymentHistoryContract';
import {createPlatformDeploymentClient} from './platformReview';
import {releaseOperationPlanRequest,type ReleasePlanResult} from './releaseOperationPlanTransport';
type Context=Parameters<typeof releaseOperationPlanRequest>[0];
const fail=(outcomeUnconfirmed=false)=>({ok:false as const,error:outcomeUnconfirmed?'Deployment result is unconfirmed. Read the original saved receipt; do not repeat automatically.':'Load the exact current approved deployment and its source in this account.',outcomeUnconfirmed});
function normalize(v:unknown):unknown{if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).sort(([a],[b])=>a.localeCompare(b)).map(([k,c])=>[k,normalize(c)]));return v}
async function hash(v:unknown){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(normalize(v))));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
function owner(c:Context,signal?:AbortSignal){const config=c.getConfig(),revision=c.getRevision(),base=config.apiBase,token=config.sessionToken;return ()=>!signal?.aborted&&c.getConfig()===config&&c.getRevision()===revision&&config.apiBase===base&&config.sessionToken===token}
function secure(c:Context){try{const u=new URL(c.getConfig().apiBase);return u.protocol==='https:'&&!u.username&&!u.password&&u.origin===c.getConfig().apiBase}catch{return false}}
async function exactPlan(a:PlatformInspection){const {digest,...body}=a.plan;return digest===await hash({kind:'platform_governance_plan_v1',...body})}
async function exactSource(a:PlatformInspection,p:PlatformDeploymentPreview){
 const e=a.plan.effects[0];if(a.plan.effects.length!==1||e.kind!=='deployment.vercel'||!e.target.leadId||!e.target.leadRevision||p.actionId!==a.actionId||p.planDigest!==a.plan.digest||p.sourceDigest!==a.plan.sourceDigest||p.effectId!==e.id||!await exactPlan(a))return false;
 const files=p.files.map(f=>({file:f.path,data:btoa(Array.from(new TextEncoder().encode(f.content),b=>String.fromCharCode(b)).join('')),encoding:'base64'}));
 return e.target.filesDigest===await hash(files)&&e.target.configurationDigest===await hash({provider:'vercel',endpoint:'https://api.vercel.com/v13/deployments',teamId:e.target.teamId});
}
async function exactHistory(h:DeploymentHistoryView){if(!await exactPlan(h.action))return false;for(const r of h.requests){const {receiptDigest,...body}=r,e=h.action.plan.effects[r.effectIndex];if(e.kind!=='deployment.vercel'||receiptDigest!==await hash(body)||r.nativeKey!==await hash({purpose:'platform_vercel_target_v1',provider:'vercel',teamId:e.target.teamId,projectName:e.target.projectName,environment:e.target.environment}))return false}return true}
/** Prepared fixed-route execution/readback client. No caller package, credential,
 * URL, provider outcome, replacement action, approval or automatic retry. */
export function createPlatformDeploymentExecutionClient(context:Context){const source=createPlatformDeploymentClient(context);return {
 async preview(raw:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<PlatformDeploymentPreview>>{const owns=owner(context,signal),a=platformInspectionSchema.safeParse(raw);if(!secure(context)||!a.success||a.data.status!=='approved'||a.data.expired||Date.parse(a.data.plan.expiresAt)<=Date.now())return fail();
  try{if(!await exactPlan(a.data)||!owns())return fail();const result=await source.preview(a.data,signal);if(!result.ok)return result;const p=platformDeploymentPreview.safeParse(result.data);if(!p.success||!await exactSource(a.data,p.data)||!owns())return fail();return {ok:true,data:p.data}}catch{return fail()}
 },
 async inspect(id:string,signal?:AbortSignal):Promise<ReleasePlanResult<DeploymentHistoryView>>{const owns=owner(context,signal);if(!secure(context)||!platformActionId.safeParse(id).success)return fail();const result=await releaseOperationPlanRequest(context,'POST','/api/desktop/platform-governance/deployment',{operation:'inspect_deployment',actionId:id},(raw):raw is DeploymentHistoryView=>{const v=deploymentHistoryView.safeParse(raw);return v.success&&v.data.action.actionId===id},signal);if(!result.ok)return result;try{if(!await exactHistory(result.data)||!owns())return fail();return result}catch{return fail()}},
 async execute(raw:unknown,rawPreview:unknown,signal?:AbortSignal):Promise<ReleasePlanResult<DeploymentHistoryView>>{const owns=owner(context,signal),a=platformInspectionSchema.safeParse(raw),p=platformDeploymentPreview.safeParse(rawPreview);if(!secure(context)||!a.success||!p.success||a.data.status!=='approved'||a.data.version!==1||a.data.expired||Date.parse(a.data.plan.expiresAt)<=Date.now())return fail();let submitted=false;
  try{if(!await exactSource(a.data,p.data)||!owns())return fail();submitted=true;const saved=a.data,result=await releaseOperationPlanRequest(context,'POST','/api/desktop/platform-governance/deployment-execution',{operation:'execute',actionId:saved.actionId,expectedVersion:1,planDigest:saved.plan.digest},(raw):raw is DeploymentHistoryView=>{const v=deploymentHistoryView.safeParse(raw);return v.success&&v.data.action.actionId===saved.actionId&&JSON.stringify(v.data.action.plan)===JSON.stringify(saved.plan)&&v.data.action.requesterUserId===saved.requesterUserId&&v.data.action.reviewerUserId===saved.reviewerUserId&&v.data.action.status==='confirmed'&&v.data.action.attemptCount===1&&v.data.requests.length===1&&v.data.requests[0].effectIndex===0&&v.data.requests[0].outcome==='accepted'},signal);if(!result.ok)return result;if(!await exactHistory(result.data)||!owns())return fail(true);return result;
  }catch{return fail(submitted)}
 },
}}
export type PlatformDeploymentExecutionClient=ReturnType<typeof createPlatformDeploymentExecutionClient>;
