import {useEffect,useRef,useState} from 'react';
import {open} from '@tauri-apps/plugin-shell';
import {ProviderLogo} from './CatalogIcon';
import {desktopClient,type VerifiedDesktopIdentity} from '../lib/desktopClient';
import {gcpGuidedConnectionClient as client} from '../lib/gcpGuidedConnectionClient';
import type {GcpGuidedState} from '../lib/gcpGuidedConnectionContract';
export function GcpGuidedConnection({identity}:{identity:VerifiedDesktopIdentity}){
 const config=desktopClient.config,key=[identity.organizationId,identity.userId,identity.kind,identity.capabilities.join('|')].join(':');
 const [binding,setBinding]=useState(()=>({config,key,revision:0}));const changed=binding.config!==config||binding.key!==key;
 if(changed)setBinding({config,key,revision:binding.revision+1});
 return <GcpConnectionWorkspace key={changed?binding.revision+1:binding.revision} identity={identity}/>;
}
function GcpConnectionWorkspace({identity}:{identity:VerifiedDesktopIdentity}){
 const context=desktopClient.config;const canRead=identity.kind==='desktop_session'&&identity.capabilities.includes('workspace:read');const canManage=canRead&&identity.capabilities.includes('connections:manage');
 const [state,setState]=useState<GcpGuidedState>({status:'not_connected'}),[busy,setBusy]=useState<string|null>('status'),[error,setError]=useState<string|null>(null),[held,setHeld]=useState(false);
 const owner=useRef({mounted:true,revision:0,mutating:false,reading:false,controller:new AbortController(),state,held:false});owner.current.state=state;
 const owns=()=>owner.current.mounted&&desktopClient.config===context&&!owner.current.controller.signal.aborted;
 const hold=(value:boolean)=>{owner.current.held=value;setHeld(value)};
 async function refresh(){const o=owner.current;if(!owns()||!canRead||o.mutating||o.reading)return;o.reading=true;const revision=o.revision;
  try{const result=await client.status(o.state.attemptId,o.controller.signal);if(!owns()||revision!==o.revision)return;if(result.ok){setState(result.data);setError(null);hold(['working','outcome_unknown'].includes(result.data.status))}else{setError(result.error);hold(true)}}finally{o.reading=false;if(owns()&&revision===o.revision)setBusy(null)}
 }
 useEffect(()=>{owner.current.mounted=true;if(canRead)void refresh();else setBusy(null);const focus=()=>{void refresh()};window.addEventListener('focus',focus);return()=>{owner.current.mounted=false;owner.current.controller.abort();window.removeEventListener('focus',focus)}},[]);
 useEffect(()=>{if(!['awaiting_consent','working'].includes(state.status)||!state.expiresAt||Date.parse(state.expiresAt)<=Date.now())return;const timer=window.setInterval(()=>{if(Date.parse(state.expiresAt!)<=Date.now())window.clearInterval(timer);void refresh()},4000);return()=>window.clearInterval(timer)},[state.status,state.attemptId,state.expiresAt]);
 async function start(){const o=owner.current;if(!owns()||!canManage||o.mutating||o.held||busy)return;o.mutating=true;const revision=++o.revision;setBusy('start');hold(true);setError(null);
  try{const result=await client.start(o.controller.signal);if(!owns()||revision!==o.revision)return;if(!result.ok){setError(result.error);return}setState({status:'awaiting_consent',attemptId:result.data.attemptId,expiresAt:result.data.expiresAt});try{await open(result.data.authorizationUrl)}catch{if(owns())setError('Google sign-in did not open. Cancel this attempt and connect again.')}if(owns())hold(false)}finally{o.mutating=false;if(owns()&&revision===o.revision)setBusy(null)}
 }
 async function select(resourceId:string){const o=owner.current;if(!owns()||!canManage||o.mutating||o.held||!state.attemptId)return;o.mutating=true;const revision=++o.revision;setBusy('complete');hold(true);setError(null);
  try{const result=await client.complete(state.attemptId,resourceId,o.controller.signal);if(!owns()||revision!==o.revision)return;if(result.ok){setState(result.data);hold(result.data.status==='outcome_unknown'||result.data.status==='working')}else setError(result.error)}finally{o.mutating=false;if(owns()&&revision===o.revision)setBusy(null)}
 }
 async function cancel(){const o=owner.current;if(!owns()||!canManage||o.mutating||!state.attemptId)return;o.mutating=true;const revision=++o.revision;setBusy('cancel');setError(null);
  try{const result=await client.cancel(state.attemptId,o.controller.signal);if(!owns()||revision!==o.revision)return;if(result.ok){setState(result.data);hold(result.data.status==='outcome_unknown'||result.data.status==='working')}else{setError(result.error);hold(true)}}finally{o.mutating=false;if(owns()&&revision===o.revision)setBusy(null)}
 }
 const idle=['not_connected','expired','cancelled'].includes(state.status);
 return <section aria-label="Google Cloud connection" className="rounded-xl border border-white/10 bg-white/1.5 p-4">
  <div className="flex items-center justify-between gap-4"><div><h3 className="flex items-center gap-2 text-sm font-medium text-zinc-100"><ProviderLogo provider="gcp" />Google Cloud</h3><p className="mt-1 text-xs leading-5 text-zinc-400">Sign in, choose your project and return to Axiom.</p></div>{state.status==='connected_read_only'&&!error?<span className="text-xs text-zinc-300">Connected · read-only</span>:idle&&canManage?<button type="button" className="btn-primary" disabled={busy!==null||held} onClick={()=>void start()}>{busy==='start'?'Opening…':'Connect Google Cloud'}</button>:null}</div>
  {!canManage&&<p className="mt-3 text-xs text-zinc-400">Ask a workspace owner or administrator to connect Google Cloud.</p>}
  {state.status==='awaiting_consent'&&<p role="status" className="mt-3 text-xs text-zinc-300">Finish signing in with Google, then return here. Axiom checks the connection automatically.</p>}
  {state.status==='working'&&<p role="status" className="mt-3 text-xs text-zinc-300">Checking your approved access…</p>}
  {state.status==='selection_required'&&<div className="mt-4 space-y-2"><p className="text-xs text-zinc-300">Choose the project to connect.</p>{state.resources?.map(resource=><button key={resource.id} type="button" disabled={!canManage||busy!==null||held} onClick={()=>void select(resource.id)} className="flex w-full items-center justify-between rounded-lg border border-white/10 px-3 py-2 text-left text-sm text-zinc-200 disabled:opacity-50" aria-label={`Connect ${resource.label} (${resource.id})`}><span>{resource.label}<span className="mt-1 block text-xs text-zinc-500">{resource.id}</span></span><span className="text-xs">{busy==='complete'?'Connecting…':'Connect'}</span></button>)}{state.resources?.length===0&&<p className="text-xs text-zinc-400">No accessible projects were returned. Cancel and sign in with an account that has project access.</p>}</div>}
  {state.status==='connected_read_only'&&state.connection&&<p className="mt-3 text-xs text-zinc-400">{error?'Last recorded project: ':''}{state.connection.resourceId}. Deployment permissions remain separately governed.</p>}
  {state.status==='outcome_unknown'&&<p role="status" className="mt-3 text-xs text-zinc-300">The connection result is uncertain. Check status before starting another attempt.</p>}
  {state.status==='expired'&&<p className="mt-3 text-xs text-zinc-400">This sign-in attempt expired. Connect again when ready.</p>}
  {state.status==='cancelled'&&<p className="mt-3 text-xs text-zinc-400">This sign-in attempt was cancelled.</p>}
  {error&&<p role="alert" className="mt-3 text-xs text-zinc-300">{error}</p>}
  <div className="mt-3 flex flex-wrap gap-3">{canRead&&<button type="button" className="text-xs text-zinc-400 underline underline-offset-4" disabled={busy!==null} onClick={()=>void refresh()}>Check connection status</button>}{canManage&&['awaiting_consent','selection_required','working','outcome_unknown'].includes(state.status)&&<button type="button" disabled={busy!==null} className="text-xs text-zinc-400 underline underline-offset-4" onClick={()=>void cancel()}>Cancel connection</button>}</div>
 </section>;
}
