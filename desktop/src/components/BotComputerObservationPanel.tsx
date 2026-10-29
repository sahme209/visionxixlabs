import type {ComputerInputSelectionRef} from '../lib/computerInputContract';
import {subscribeNativeObservationFocus} from '../lib/nativeObservationFocus';
import {nativeObservationRecoveryMessage} from '../lib/nativeObservationContract';
import {useEffect,useRef,useState} from 'react';
import {createNativeObservationAdapter} from '../lib/nativeObservationAdapter';
import {createNativeObservationController,type NativeObservationSnapshot} from '../lib/nativeObservationController';
import type {ObservationOwner} from '../lib/computerObservationContract';
import {desktopClient} from '../lib/desktopClient';
const empty:NativeObservationSnapshot={status:'unavailable',source:'native_selected_window',supported:false,session:null,observation:null};
export function BotComputerObservationPanel({owner,active,onInputSelection}:{owner?:ObservationOwner;active:boolean;onInputSelection?:(selection:ComputerInputSelectionRef|null)=>void}){
 const selectionCallback=useRef(onInputSelection);selectionCallback.current=onInputSelection;
 const ownerRef=useRef(owner);ownerRef.current=owner;const key=JSON.stringify(owner),[stored,setStored]=useState<{key:string|undefined;value:NativeObservationSnapshot}>({key,value:empty}),[image,setImage]=useState<string>();
 const state=active&&stored.key===key?stored.value:empty;
 const controller=useRef<ReturnType<typeof createNativeObservationController>|null>(null);
 useEffect(()=>{
  const setState=(value:NativeObservationSnapshot)=>setStored({key,value});
  setState(empty);selectionCallback.current?.(null);if(!active||!owner)return;
  const config=desktopClient.config,revision=desktopClient.getContextRevision();
  const readOwner=()=>desktopClient.config===config&&desktopClient.getContextRevision()===revision?ownerRef.current!:{...owner,contextRevision:-1};
  const next=createNativeObservationController(createNativeObservationAdapter(),readOwner,{subscribeOwner:desktopClient.subscribeContext});controller.current=next;
  const unsubscribe=next.subscribe(()=>{setState(next.snapshot());selectionCallback.current?.(next.inputSelection())});let stopped=false,unfocus:(()=>void)|undefined;
  void subscribeNativeObservationFocus(focused=>{if(stopped)return;if(focused)void next.revalidate();else next.focusLost()}).then(remove=>{if(stopped){remove();return}unfocus=remove;void next.check()}).catch(()=>{if(!stopped){next.dispose();setState({...empty,error:'native_observation_focus_unavailable'})}});
  return()=>{stopped=true;unfocus?.();unsubscribe();next.dispose();selectionCallback.current?.(null);if(controller.current===next)controller.current=null};
 },[key,active]);
 useEffect(()=>{setImage(undefined);if(!state.observation)return;const url=URL.createObjectURL(new Blob([state.observation.png.slice().buffer],{type:'image/png'}));setImage(url);return()=>URL.revokeObjectURL(url)},[state.observation]);
 const busy=state.status==='checking'||state.status==='selecting'||state.status==='capturing'||state.status==='checking_session';
 return <section aria-label="Local computer observation" className="space-y-3"><h2 className="text-sm font-medium text-zinc-200">Observe one window</h2><p className="text-xs leading-6 text-zinc-500">Choose a window with the macOS picker, then capture it once. The snapshot stays in this app&apos;s memory. Nothing is sent to AI or saved. Mouse, keyboard and background capture are unavailable.</p>
 <p role="status" className="text-xs text-zinc-400">{state.error==='native_observation_focus_unavailable'?'Window focus monitoring is unavailable. Reopen the Computer panel before selecting a window.':state.status==='checking_session'?'Checking the selected window session…':state.status==='unavailable'?'Window observation is unavailable. It requires a supported native macOS build (15.2 or later).':state.status==='checking'?'Checking native observation support…':state.status==='selecting'?'Choose one window in the macOS picker.':state.status==='capturing'?'Capturing the selected window once…':state.status==='expired'?'Observation expired. Select a window again.':state.error?(nativeObservationRecoveryMessage(state.error)??'Observation stopped or could not be confirmed. Select a window again.'):state.session?`${state.session.appLabel} · ${state.session.windowLabel}`:'No window selected.'}</p>
 <div className="flex flex-wrap gap-2"><button type="button" className="btn-secondary" disabled={!state.supported||busy} onClick={()=>void controller.current?.select(true)}>Select window</button><button type="button" className="btn-secondary" disabled={!state.session||busy} onClick={()=>{const s=state.session;if(s)void controller.current?.capture({sessionId:s.sessionId,expectedRevision:s.revision,confirmCapture:true})}}>Capture once</button><button type="button" className="btn-secondary" disabled={!state.session&&!busy} onClick={()=>controller.current?.stop()}>Stop</button></div>
 {state.session&&<p className="text-[11px] text-zinc-500">Expires {new Date(state.session.expiresAt).toLocaleTimeString()}. Changing task, workspace or leaving this panel stops observation.</p>}
 {image&&state.observation&&<figure><img src={image} width={state.observation.width} height={state.observation.height} alt="One explicitly captured local window; not shared with AI" className="max-h-80 max-w-full rounded-lg border border-white/10 object-contain"/><figcaption className="mt-2 text-[11px] text-zinc-500">Local capture · {state.observation.observedAt}</figcaption></figure>}
 </section>;
}
