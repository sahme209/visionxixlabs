import {postImageWorkflowPreview} from '../../../lib/governance/platform/imageWorkflowContract';
import type {ImageWorkflowClient} from '../lib/imageWorkflow';
import type {z} from 'zod';
import {platformTemplateReviewPreview,type PlatformTemplateReviewPreview} from '../../../lib/governance/platform/templateContract';
import {useEffect,useRef,useState,useSyncExternalStore} from 'react';
import {desktopClient} from '../lib/desktopClient';
import {platformDeploymentPreview,type PlatformDeploymentPreview} from '../../../lib/governance/platform/deploymentContract';
import type {PlatformTemplateClient,PlatformDeploymentClient,PlatformReviewClient} from '../lib/platformReview';
import {platformInspectionSchema,platformGrowthPreviewSchema,type PlatformInspection,type PlatformGrowthPreview} from '../../../lib/governance/platform/viewContract';
import {PlatformDeploymentSourcePreview,PlatformActionSummary,PlatformSourcePreview} from './PlatformActionSummary';
interface Props{imageClient?:Pick<ImageWorkflowClient,'previewPost'>;templateClient?:Pick<PlatformTemplateClient,'preview'>;deploymentClient?:Pick<PlatformDeploymentClient,'preview'>;action:PlatformInspection;currentUserId:string;canApprove:boolean;client:PlatformReviewClient;onRecorded:(action:PlatformInspection)=>void}
/** Prepared, unregistered panel. It never executes an operation; actual server
 * review and source gates remain authoritative. No live acceptance is implied. */
export function PlatformReviewPanel(props:Props){
 const parsed=platformInspectionSchema.safeParse(props.action);if(!parsed.success)return <p role="alert">This saved action cannot be verified. Load it again before reviewing.</p>;
 return <ExactPlatformReview key={parsed.data.actionId+':'+parsed.data.version+':'+parsed.data.plan.digest+':'+props.currentUserId} {...props} action={parsed.data}/>;
}
function ExactPlatformReview({imageClient,templateClient,deploymentClient,action,currentUserId,canApprove,client,onRecorded}:Props){
 const revision=useSyncExternalStore(desktopClient.subscribeContext,desktopClient.getContextRevision,desktopClient.getContextRevision),owner=useRef({revision,config:desktopClient.config}).current;
 const [preview,setPreview]=useState<PlatformGrowthPreview|PlatformDeploymentPreview|PlatformTemplateReviewPreview|undefined>(undefined);
 const [image,setImage]=useState<z.infer<typeof postImageWorkflowPreview>|undefined>(undefined),[imageUrl,setImageUrl]=useState<string|undefined>(undefined);
 const [checked,setChecked]=useState(false),[busy,setBusy]=useState(false),[held,setHeld]=useState(false),[message,setMessage]=useState(''),[clock,setClock]=useState(Date.now());
 const alive=useRef(true),running=useRef(false),active=useRef<AbortController|undefined>(undefined);
 useEffect(()=>{alive.current=true;const timer=setInterval(()=>setClock(Date.now()),1000);return()=>{alive.current=false;clearInterval(timer);active.current?.abort()}},[]);
 const owns=()=>alive.current&&owner.revision===desktopClient.getContextRevision()&&owner.config===desktopClient.config;
 const selectedImage=action.plan.effects.length===1&&(action.plan.effects[0].kind==='growth.post.publish'||action.plan.effects[0].kind==='growth.schedule.change')&&Boolean(action.plan.effects[0].target.imageUploadActionId);
 const expired=action.expired||Math.max(clock,Date.now())>=Date.parse(action.plan.expiresAt),independent=Boolean(currentUserId)&&currentUserId!==action.requesterUserId,eligible=canApprove&&independent&&action.status==='proposed'&&!expired&&Boolean(preview)&&(!selectedImage||Boolean(image&&imageUrl));
 const effect=action.plan.effects[0],deployment=action.plan.effects.length===1&&effect.kind==='deployment.vercel'&&Boolean(effect.target.leadId)&&Boolean(effect.target.leadRevision);
 const template=action.plan.effects.length===1&&(effect.kind==='template.bucket.create'||effect.kind==='template.object.put'||effect.kind==='template.access.grant');
 const supportsPreview=action.plan.effects.length===1&&(['growth.post.publish','growth.schedule.change','growth.post.delete'].includes(effect.kind)&&(!selectedImage||Boolean(imageClient))||deployment&&Boolean(deploymentClient)||template&&Boolean(templateClient));
 useEffect(()=>{
  if(!image||expired||revision!==owner.revision||desktopClient.config!==owner.config)return;
  let url:string|undefined;const binary=atob(image.bytesBase64url.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-image.bytesBase64url.length%4)%4)),bytes=Uint8Array.from(binary,c=>c.charCodeAt(0));
  try{url=URL.createObjectURL(new Blob([bytes],{type:image.artifact.mimeType}));setImageUrl(url)}catch{setImage(undefined);setPreview(undefined);setChecked(false)}finally{bytes.fill(0)}
  return()=>{if(url)URL.revokeObjectURL(url);setImageUrl(undefined)};
 },[image,expired,revision,owner,desktopClient.config]);
 async function run(kind:'inspect'|'preview'|'approve'){
  if(!owns()||running.current||kind==='preview'&&(!supportsPreview||expired||!['proposed','approved'].includes(action.status))||kind==='approve'&&(!eligible||held||!checked||Date.now()>=Date.parse(action.plan.expiresAt)))return;
  running.current=true;setBusy(true);setMessage('');const c=new AbortController();active.current=c;
  if(kind==='inspect'||kind==='preview'){setPreview(undefined);setImage(undefined);setChecked(false)}
  if(kind==='approve'){setHeld(true);setChecked(false);setImage(undefined);setPreview(undefined)}
  try{
   if(kind==='preview'&&selectedImage){
    if(!imageClient)return;const result=await imageClient.previewPost(action.actionId,c.signal);if(!owns()||c.signal.aborted)return;
    const v=result.ok?postImageWorkflowPreview.safeParse(result.data):undefined;
    if(!v?.success||v.data.action.actionId!==action.actionId||v.data.action.version!==action.version||JSON.stringify(v.data.action.plan)!==JSON.stringify(action.plan)||v.data.action.requesterUserId!==action.requesterUserId||v.data.action.reviewerUserId!==action.reviewerUserId||Date.now()>=Date.parse(action.plan.expiresAt))throw Error('mismatch');
    setImage(v.data);setPreview(platformGrowthPreviewSchema.parse({actionId:action.actionId,planDigest:action.plan.digest,sourceDigest:action.plan.sourceDigest,effectId:effect.id,renderedPost:v.data.renderedPost,authority:'review_preview_only'}));setMessage('Exact image and post loaded. Inspect both before recording your decision.');return;
   }
   const result=kind==='inspect'?await client.inspect(action.actionId,c.signal):kind==='preview'?template&&templateClient?await templateClient.preview(action,c.signal):deployment&&deploymentClient?await deploymentClient.preview(action,c.signal):await client.preview(action,c.signal):await client.approve(action,c.signal);if(!owns())return;
   if(!result.ok){setMessage(kind==='approve'?'Decision outcome is unconfirmed. Inspect this saved action; do not resubmit automatically.':kind==='preview'?'Exact source preview is unavailable or changed. Approval stays unavailable.':'Saved history is unavailable. The previous record is historical.');return}
   if(kind==='preview'){const source=template?platformTemplateReviewPreview.safeParse(result.data):deployment?platformDeploymentPreview.safeParse(result.data):platformGrowthPreviewSchema.safeParse(result.data);if(!source.success||source.data.actionId!==action.actionId||source.data.planDigest!==action.plan.digest||source.data.sourceDigest!==action.plan.sourceDigest||source.data.effectId!==action.plan.effects[0].id){setMessage('Source preview does not match the saved plan. Approval stays unavailable.');return}if(template&&('kind' in source.data&&source.data.kind==='template.source')&&((effect.kind!=='template.object.put'&&effect.kind!=='template.access.grant')||source.data.bytesDigest!==effect.target.bytesDigest)){setMessage('Template source does not match the saved bytes. Approval stays unavailable.');return}if(template&&('kind' in source.data&&source.data.kind==='template.bucket')&&(effect.kind!=='template.bucket.create'||source.data.target.accountId!==effect.target.accountId||source.data.target.region!==effect.target.region||source.data.target.bucket!==effect.target.bucket)){setMessage('Bucket target does not match the saved proposal. Approval stays unavailable.');return}setPreview(source.data);setMessage('Exact saved source loaded. Inspect it before recording your decision.');return}
   const saved=platformInspectionSchema.safeParse(result.data);
   if(!saved.success||saved.data.actionId!==action.actionId||saved.data.plan.digest!==action.plan.digest||saved.data.version<action.version||JSON.stringify(saved.data.plan)!==JSON.stringify(action.plan)||kind==='approve'&&saved.data.reviewerUserId!==currentUserId){setMessage('The response does not match this exact review. Inspect the saved action before continuing.');return}
   if(kind==='inspect')setHeld(false);
   onRecorded(saved.data);setMessage(kind==='approve'?'Independent decision recorded. No operation was executed.':'Saved record refreshed. Source and execution eligibility are checked separately.');
  }catch{if(owns())setMessage(kind==='preview'?'Exact source preview is unavailable or changed. Approval stays unavailable.':'The saved outcome is unconfirmed. Inspect this same action; no automatic resend.')}
  finally{if(owns())setBusy(false);running.current=false}
 }
 if(revision!==owner.revision||desktopClient.config!==owner.config)return <p role="status">Account context changed. Load the saved platform action again.</p>;
 return <section aria-label="Exact platform review" aria-busy={busy} className="rounded-xl border border-white/10 bg-axiom-surface p-5 space-y-4">
  <header className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wider text-zinc-400">Platform operation</p><h2 className="mt-1 text-lg font-medium">Review the exact change</h2><p className="mt-2 text-sm text-zinc-400">{action.status} · version {action.version} · {action.attemptCount} attempt recorded</p></div><button className="btn-secondary" disabled={busy} onClick={()=>void run('inspect')}>Inspect saved action</button></header>
  <p className="text-sm text-zinc-400">Approval records an independent decision. It does not execute a change or establish current source validation.</p>
  {action.status==='unknown'&&<p role="alert" className="rounded-lg border border-amber-400/30 p-3 text-sm">The outcome is unknown. Do not resend or create a replacement action. Inspect the original record before recovery.</p>}
  {expired&&<p role="status" className="text-sm">The review window has expired. Historical approval cannot authorize another attempt.</p>}
  <PlatformActionSummary action={action}/>
  {['proposed','approved'].includes(action.status)&&<div className="border-t border-white/10 pt-4 space-y-3"><button className="btn-secondary" disabled={busy||expired||!supportsPreview} onClick={()=>void run('preview')}>Load exact source preview</button>{!supportsPreview&&<p className="text-xs text-zinc-400">Source preview is not available for this operation yet. Approval remains unavailable here.</p>}{preview&&('kind' in preview?preview.kind==='template.source'?<div className="space-y-2"><p className="text-sm text-zinc-400">Exact template source. Read-only text; no resources are created by this preview.</p><pre className="max-h-96 overflow-auto rounded-lg border border-white/10 p-4 text-xs">{preview.yaml}</pre></div>:preview.kind==='template.bucket'?<p className="text-sm text-zinc-400">Requested bucket target reconstructed from the saved proposal. Account ownership and bucket absence have not been observed. No template content, permissions or resource creation is supplied by this preview.</p>:<PlatformDeploymentSourcePreview preview={preview}/>:<PlatformSourcePreview preview={preview}/>)}</div>}
  {image&&imageUrl&&!expired&&<figure aria-label="Exact selected image" className="space-y-2"><img src={imageUrl} alt="Exact image selected for this reviewed post" className="max-h-80 max-w-full rounded-lg object-contain"/><figcaption className="text-xs text-zinc-400">Confirmed upload {image.lineage.uploadActionId}. This new action has its own review; no draft or original upload was changed.</figcaption></figure>}
  <details className="text-xs text-zinc-400"><summary>Review identity and history</summary><p className="mt-2 break-all">{action.actionId}</p><p className="mt-2 break-all">Plan {action.plan.digest}</p><p className="mt-2">Requested by {action.requesterUserId}</p><p>Reviewed by {action.reviewerUserId??'Not yet reviewed'}</p><p>Expires {new Date(action.plan.expiresAt).toLocaleString()}</p></details>
  {action.status==='proposed'&&<div className="border-t border-white/10 pt-4 space-y-3"><p className="text-xs text-zinc-400">Load and inspect the exact source preview before recording a decision.</p><label className="flex gap-2 text-sm"><input type="checkbox" checked={checked} disabled={!eligible||busy||held} onChange={e=>setChecked(e.target.checked)}/>I reviewed these exact operations and target references.</label><button className="btn-primary" disabled={!eligible||!checked||busy||held} onClick={()=>void run('approve')}>Record independent approval</button>{!independent&&<p className="text-xs text-zinc-400">Another authorized person must review your proposal.</p>}</div>}
  {message&&<p role="status" className="text-sm">{message}</p>}
 </section>;
}
