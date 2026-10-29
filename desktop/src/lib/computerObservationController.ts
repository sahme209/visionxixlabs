import {OBSERVATION_CAPTURE_MS,OBSERVATION_IDLE_MS,OBSERVATION_SESSION_MS,isObservationOwner,isMockWindowSelection,isMockWindowCapture,discardMockPixels,type ObservationOwner,type ObservationSnapshot,type MockWindowObserver,type MockWindowSelection} from './computerObservationContract';
/** Explicitly injected synthetic adapter only. No default adapter, IPC, storage,
 * model call, OS prompt or native permission is provided by this foundation. */
export function createMockObservationController(adapter:MockWindowObserver,readOwner:()=>ObservationOwner,options:{randomId?:()=>string;subscribeOwner?:(listener:()=>void)=>()=>void}={}){
 if(adapter.kind!=='mock_window_observer_v1'||!isObservationOwner(readOwner()))throw new Error('unsupported_observation_foundation');
 const ownerKey=(v:ObservationOwner)=>JSON.stringify([v.workspaceId,v.actorId,v.contextRevision,v.taskId,v.taskVersion]);
 const owner=ownerKey(readOwner()),listeners=new Set<()=>void>(),usedIds=new Set<string>();
 let generation=0,operation:AbortController|null=null,selected:MockWindowSelection|null=null,createdAt=0,idleAt=0,expiry:ReturnType<typeof setTimeout>|undefined,disposed=false;
 let state:ObservationSnapshot=Object.freeze({status:'idle',source:'synthetic_fixture',inputAvailable:false,aiSharingAvailable:false,backgroundCapture:false,session:null,observation:null});
 const now=()=>Date.now();
 const currentOwner=()=>{try{const value=readOwner();return !disposed&&isObservationOwner(value)&&ownerKey(value)===owner}catch{return false}};
 function publish(next:ObservationSnapshot){state=Object.freeze(next);for(const listener of listeners)listener()}
 function release(handle:string){try{void adapter.stop({handle}).catch(()=>{})}catch{/* An unconfirmed stop never restores authority. */}}
 function revoke(status:ObservationSnapshot['status'],error?:ObservationSnapshot['error']){generation++;operation?.abort();operation=null;clearTimeout(expiry);if(selected)release(selected.handle);selected=null;if(state.observation)state.observation.png.fill(0);publish({...state,status,session:null,observation:null,...(error?{error}:{error:undefined})})}
 function reconcile(){if(disposed)return false;if(!currentOwner()){if(state.error!=='owner_changed'||state.session||operation)revoke('stopped','owner_changed');return false}if(state.session&&now()>=Math.min(createdAt+OBSERVATION_SESSION_MS,idleAt+OBSERVATION_IDLE_MS)){revoke('expired');return false}return true}
 function schedule(){clearTimeout(expiry);const expires=Math.min(createdAt+OBSERVATION_SESSION_MS,idleAt+OBSERVATION_IDLE_MS);if(state.session)expiry=setTimeout(()=>{if(state.session)revoke('expired')},Math.max(0,expires-now()))}
 async function bounded(work:Promise<unknown>,controller:AbortController,epoch:number,late:(v:unknown)=>void){let timer:ReturnType<typeof setTimeout>|undefined;let cancel!:()=>void;
  const stopped=new Promise<never>((_resolve,reject)=>{cancel=()=>reject(new Error('stopped'));controller.signal.addEventListener('abort',cancel,{once:true});timer=setTimeout(()=>{controller.abort()},OBSERVATION_CAPTURE_MS)});
  void work.then(value=>{if(controller.signal.aborted||epoch!==generation||!currentOwner())late(value)},()=>{});
  try{return await Promise.race([work,stopped])}finally{clearTimeout(timer);controller.signal.removeEventListener('abort',cancel)}
 }
 const unsubscribe=options.subscribeOwner?.(()=>{reconcile()})??(()=>{});
 async function select(input:unknown){if(!reconcile()||operation)return;if(!input||typeof input!=='object'||Object.keys(input).join(',')!=='confirmSelect'||!('confirmSelect' in input)||input.confirmSelect!==true){publish({...state,error:'invalid_request'});return}
  revoke('selecting');const epoch=generation,controller=new AbortController();operation=controller;
  try{const result=await bounded(Promise.resolve().then(()=>{controller.signal.throwIfAborted();return adapter.select(controller.signal)}),controller,epoch,v=>{if(isMockWindowSelection(v))release(v.handle)});if(epoch!==generation||!reconcile()||controller.signal.aborted)return;if(!isMockWindowSelection(result))throw new Error();const uuid=(options.randomId??(()=>crypto.randomUUID()))();if(!/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(uuid)||usedIds.has(uuid)||usedIds.size>=128){release(result.handle);throw new Error()}usedIds.add(uuid);selected=Object.freeze({...result});createdAt=idleAt=now();publish({...state,status:'selected',error:undefined,session:Object.freeze({id:'mock_observation_'+uuid,revision:0,appLabel:result.appLabel,windowLabel:result.windowLabel,expiresAt:new Date(createdAt+OBSERVATION_IDLE_MS).toISOString()}),observation:null});schedule()
  }catch{if(epoch===generation&&currentOwner())revoke('error','selection_unavailable')}finally{if(operation===controller)operation=null}
 }
 async function capture(input:unknown){if(!reconcile()||operation||!state.session||!selected)return;const s=state.session;if(!input||typeof input!=='object'||Object.keys(input).sort().join(',')!=='confirmCapture,expectedRevision,sessionId'||!('sessionId'in input)||input.sessionId!==s.id||!('expectedRevision'in input)||input.expectedRevision!==s.revision||!('confirmCapture'in input)||input.confirmCapture!==true){publish({...state,error:'invalid_request'});return}
  const epoch=generation,controller=new AbortController(),handle=selected.handle,started=now();operation=controller;if(state.observation)state.observation.png.fill(0);publish({...state,status:'capturing',error:undefined,observation:null});
  try{const result=await bounded(Promise.resolve().then(()=>{controller.signal.throwIfAborted();return adapter.capture({handle},controller.signal)}),controller,epoch,discardMockPixels);if(epoch!==generation||!reconcile()||controller.signal.aborted){discardMockPixels(result);return}if(!isMockWindowCapture(result,handle,started,now())){discardMockPixels(result);revoke('error','capture_invalid');return}const png=result.png.slice();discardMockPixels(result);idleAt=now();publish({...state,status:'observed',session:Object.freeze({...s,revision:s.revision+1,expiresAt:new Date(Math.min(createdAt+OBSERVATION_SESSION_MS,idleAt+OBSERVATION_IDLE_MS)).toISOString()}),observation:Object.freeze({observedAt:result.observedAt,width:result.width,height:result.height,png})});schedule()
  }catch{if(epoch===generation&&currentOwner())revoke('error','capture_unconfirmed')}finally{if(operation===controller)operation=null}
 }
 return{snapshot(){reconcile();return state},subscribe(listener:()=>void){listeners.add(listener);return()=>{listeners.delete(listener)}},select,capture,async stop(){if(disposed)return;revoke('stopped')},reconcileOwner:reconcile,dispose(){if(disposed)return;revoke('stopped');disposed=true;unsubscribe();listeners.clear()}};
}
